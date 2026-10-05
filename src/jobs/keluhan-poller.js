const env = require('../config/env');
const { db } = require('../config/database');
const { notifyNewKeluhan, notifyReminder } = require('../bot/notifier');
const { FINAL_STATUSES } = require('../services/apkt');
const {
    SessionUnavailableError,
    getActiveScope,
    fetchLiveKeluhan
} = require('../services/keluhan-live');

const POLL_INTERVAL = env.keluhan.pollInterval;
const REMINDER_INTERVAL = env.keluhan.reminderInterval;

let running = false;
let timer = null;

// Data keluhan TIDAK disimpan. Yang disimpan hanya status terakhir,
// penanda notifikasi, dan histori perubahan status.
const stmt = {
    find: db.prepare('SELECT * FROM keluhan_monitoring WHERE no_laporan = ?'),
    count: db.prepare('SELECT COUNT(*) AS total FROM keluhan_monitoring'),
    insert: db.prepare(`
        INSERT INTO keluhan_monitoring (
            no_laporan, status_terakhir, status_changed_at, first_seen_at,
            last_seen_at, is_final, new_notified_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    touch: db.prepare(`
        UPDATE keluhan_monitoring
        SET last_seen_at = ?, updated_at = ?
        WHERE no_laporan = ?
    `),
    changeStatus: db.prepare(`
        UPDATE keluhan_monitoring
        SET status_terakhir = ?,
            status_changed_at = ?,
            is_final = ?,
            last_reminder_at = NULL,
            last_seen_at = ?,
            updated_at = ?
        WHERE no_laporan = ?
    `),
    addHistory: db.prepare(`
        INSERT INTO keluhan_status_history (
            no_laporan, status_lama, status_baru, changed_at
        )
        VALUES (?, ?, ?, ?)
    `),
    markNewNotified: db.prepare(`
        UPDATE keluhan_monitoring
        SET new_notified_at = ?, updated_at = ?
        WHERE no_laporan = ?
    `),
    markReminded: db.prepare(`
        UPDATE keluhan_monitoring
        SET last_reminder_at = ?, updated_at = ?
        WHERE no_laporan = ?
    `)
};

// Ambil konfigurasi monitoring
function getMonitorConfig() {
    return db
        .prepare(
            `
            SELECT *
            FROM whatsapp_monitor_config
            WHERE id = 1
        `
        )
        .get();
}

// Simpan konfigurasi monitoring
function saveMonitorConfig(user) {
    const existing = getMonitorConfig();
    const now = new Date().toISOString();

    if (!existing) {
        db.prepare(
            `
            INSERT INTO whatsapp_monitor_config (
                id,
                id_uid,
                user_id,
                id_up3,
                id_ulp,
                tanggal_range_hari,
                enabled,
                updated_at
            )
            VALUES (1, ?, ?, ?, ?, ?, 1, ?)
        `
        ).run(
            user.idUid,
            user.userId,
            user.idUp3,
            user.idUlp,
            env.keluhan.rangeDays,
            now
        );

        return;
    }

    db.prepare(
        `
        UPDATE whatsapp_monitor_config

        SET id_uid = ?,
            user_id = ?,
            id_up3 = ?,
            id_ulp = ?,
            updated_at = ?

        WHERE id = 1
    `
    ).run(user.idUid, user.userId, user.idUp3, user.idUlp, now);
}

function isFinalStatus(status) {
    return FINAL_STATUSES.includes(String(status ?? '').trim());
}

// Reminder: status tidak berubah >= interval, lalu diulang tiap interval.
function shouldReminder(row, nowMs) {
    if (row.is_final) {
        return false;
    }

    if (nowMs - Date.parse(row.status_changed_at) < REMINDER_INTERVAL) {
        return false;
    }

    if (!row.last_reminder_at) {
        return true;
    }

    return nowMs - Date.parse(row.last_reminder_at) >= REMINDER_INTERVAL;
}

// Sinkronisasi status ke database (satu transaksi).
// Mengembalikan daftar notifikasi yang harus dikirim.
const syncKeluhan = db.transaction((list, now, silent) => {
    const nowMs = Date.parse(now);
    const actions = [];

    for (const keluhan of list) {
        const noLaporan = keluhan.no_laporan;

        if (!noLaporan) {
            continue;
        }

        const status = String(keluhan.status ?? '').trim();
        const final = isFinalStatus(status) ? 1 : 0;
        const existing = stmt.find.get(noLaporan);

        if (!existing) {
            // Baseline / laporan selesai tidak perlu notifikasi "baru".
            const notified = silent || final ? now : null;

            stmt.insert.run(noLaporan, status, now, now, now, final, notified, now);
            stmt.addHistory.run(noLaporan, null, status, now);

            if (!notified) {
                actions.push({ type: 'new', keluhan });
            }

            continue;
        }

        if (existing.status_terakhir !== status) {
            stmt.changeStatus.run(status, now, final, now, now, noLaporan);
            stmt.addHistory.run(noLaporan, existing.status_terakhir, status, now);

            console.log(
                `🔄 Status berubah ${noLaporan}: ${existing.status_terakhir} → ${status}`
            );
        } else {
            stmt.touch.run(now, now, noLaporan);
        }

        const row = stmt.find.get(noLaporan);

        if (!row.is_final && !row.new_notified_at) {
            // Notifikasi keluhan baru sebelumnya belum terkirim: coba lagi.
            actions.push({ type: 'new', keluhan });
        } else if (shouldReminder(row, nowMs)) {
            actions.push({ type: 'reminder', keluhan });
        }
    }

    return actions;
});

async function deliver(actions) {
    let newSent = 0;
    let reminderSent = 0;

    for (const { type, keluhan } of actions) {
        try {
            const isNew = type === 'new';
            const sent = isNew
                ? await notifyNewKeluhan(keluhan)
                : await notifyReminder(keluhan);

            if (sent > 0) {
                const ts = new Date().toISOString();

                if (isNew) {
                    stmt.markNewNotified.run(ts, ts, keluhan.no_laporan);
                    newSent += 1;
                } else {
                    stmt.markReminded.run(ts, ts, keluhan.no_laporan);
                    reminderSent += 1;
                }
            }
        } catch (error) {
            console.error(`❌ Notifikasi ${type}:`, error.message);
        }
    }

    return { newSent, reminderSent };
}

// Satu siklus: ambil langsung dari APKT -> catat status -> kirim notifikasi.
async function pollKeluhan() {
    if (running) {
        console.log('⏳ Poller masih berjalan, skip.');

        return { ok: false, skipped: true, reason: 'Polling masih berjalan.' };
    }

    running = true;

    try {
        const user = getActiveScope();

        // Sinkronisasi konfigurasi dengan user session APKT.
        saveMonitorConfig(user);

        const config = getMonitorConfig();

        if (!config || !config.enabled) {
            console.log('ℹ️ Monitoring WhatsApp dinonaktifkan.');

            return {
                ok: false,
                skipped: true,
                reason: 'Monitoring dinonaktifkan.'
            };
        }

        const result = await fetchLiveKeluhan();

        console.log(`📊 APKT: ${result.data.length} keluhan diterima.`);

        if (result.truncated) {
            console.warn(
                '⚠️ Data APKT melebihi batas halaman, sebagian tidak terbaca.'
            );
        }

        const now = new Date().toISOString();
        const silent =
            !env.keluhan.notifyOnFirstRun && stmt.count.get().total === 0;

        if (silent && result.data.length) {
            console.log('ℹ️ Polling pertama: dicatat sebagai baseline.');
        }

        const actions = syncKeluhan(result.data, now, silent);
        const sent = await deliver(actions);

        console.log(
            `✅ Polling selesai. Baru: ${sent.newSent}, reminder: ${sent.reminderSent}.`
        );

        return { ok: true, total: result.data.length, ...sent };
    } catch (error) {
        if (error instanceof SessionUnavailableError) {
            console.log(`⚠️ Poller: ${error.message}`);

            return { ok: false, skipped: true, reason: error.message };
        }

        console.error('❌ Poller APKT:', error.message);

        return { ok: false, reason: error.message };
    } finally {
        running = false;
    }
}

// Start poller
function startKeluhanPoller() {
    if (timer) {
        console.log('⚠️ Poller sudah berjalan.');

        return;
    }

    console.log(
        `🚀 Keluhan Poller aktif setiap ${POLL_INTERVAL / 1000} detik.`
    );

    // Jalankan pertama kali, lalu berulang sesuai interval.
    pollKeluhan();

    timer = setInterval(pollKeluhan, POLL_INTERVAL);
}

// Stop poller
function stopKeluhanPoller() {
    if (timer) {
        clearInterval(timer);

        timer = null;

        console.log('🛑 Keluhan Poller dihentikan.');
    }
}

module.exports = {
    startKeluhanPoller,
    stopKeluhanPoller,
    pollKeluhan
};
