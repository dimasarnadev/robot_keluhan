const { db } = require('../config/database');
const { formatDateTime, sanitizeText } = require('../utils/format');
const { resolveSessionName } = require('./waha-session');
const { sendText } = require('./whatsapp');

// Format keluhan baru
function formatNewKeluhan(keluhan) {
    return [
        '🚨 KELUHAN BARU',
        '',
        `*No Laporan:* ${sanitizeText(keluhan.no_laporan, 50)}`,
        `*Pelapor:* ${sanitizeText(keluhan.nama_pelapor, 100)}`,
        `*No Meter:* ${sanitizeText(keluhan.no_meter, 50)}`,
        `*ULP:* ${sanitizeText(keluhan.nama_ulp, 100)}`,
        '',
        '*Permasalahan:*',
        sanitizeText(keluhan.permasalahan, 500),
        '',
        `*Status:* ${sanitizeText(keluhan.status, 100)}`,
        `*Waktu Lapor:* ${formatDateTime(keluhan.waktu_lapor)}`,
        '',
        'Mohon segera ditindaklanjuti.'
    ].join('\n');
}

// Format reminder
function formatReminder(keluhan) {
    return [
        '⚠️ REMINDER KELUHAN',
        '',
        `*No Laporan:* ${sanitizeText(keluhan.no_laporan, 50)}`,
        `*Pelapor:* ${sanitizeText(keluhan.nama_pelapor, 100)}`,
        `*ULP:* ${sanitizeText(keluhan.nama_ulp, 100)}`,
        '',
        '*Permasalahan:*',
        sanitizeText(keluhan.permasalahan, 500),
        '',
        `*Status:* ${sanitizeText(keluhan.status, 100)}`,
        `*Durasi:* ${sanitizeText(keluhan.durasi, 50)}`,
        '',
        'Mohon segera ditindaklanjuti.'
    ].join('\n');
}

// Ambil grup untuk notifikasi keluhan baru
function getNewNotificationGroups() {
    return db
        .prepare(
            `
            SELECT *
            FROM whatsapp_groups
            WHERE enabled = 1
              AND notify_new = 1
            ORDER BY id
        `
        )
        .all();
}

// Ambil grup untuk reminder
function getReminderGroups() {
    return db
        .prepare(
            `
            SELECT *
            FROM whatsapp_groups
            WHERE enabled = 1
              AND notify_reminder = 1
            ORDER BY id
        `
        )
        .all();
}

// Kirim keluhan baru ke semua grup
async function notifyNewKeluhan(keluhan) {
    const groups = getNewNotificationGroups();

    if (!groups.length) {
        console.log('ℹ️ Tidak ada grup untuk notifikasi keluhan baru.');

        return;
    }

    // Di-resolve sekali di sini, bukan ditebak ulang oleh sendText per grup.
    const sessionName = resolveSessionName();
    const text = formatNewKeluhan(keluhan);

    for (const group of groups) {
        try {
            await sendText(group.chat_id, text, sessionName);

            db.prepare(
                `
                UPDATE keluhan_monitoring
                SET last_notified_new_at = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE no_laporan = ?
            `
            ).run(new Date().toISOString(), keluhan.no_laporan);

            console.log(
                `📤 Keluhan baru dikirim ke ${group.group_name || group.chat_id}`
            );
        } catch (error) {
            console.error(
                `❌ Gagal kirim ke grup ${group.chat_id}:`,
                error.message
            );
        }
    }
}

// Kirim reminder
async function notifyReminder(keluhan) {
    const groups = getReminderGroups();

    if (!groups.length) {
        return;
    }

    const sessionName = resolveSessionName();
    const text = formatReminder(keluhan);

    for (const group of groups) {
        try {
            await sendText(group.chat_id, text, sessionName);

            console.log(
                `⏰ Reminder dikirim ke ${group.group_name || group.chat_id}`
            );
        } catch (error) {
            console.error(
                `❌ Gagal kirim reminder ke ${group.chat_id}:`,
                error.message
            );
        }
    }

    db.prepare(
        `
        UPDATE keluhan_monitoring
        SET last_reminder_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE no_laporan = ?
    `
    ).run(new Date().toISOString(), keluhan.no_laporan);
}

module.exports = {
    notifyNewKeluhan,
    notifyReminder,
    formatNewKeluhan,
    formatReminder
};