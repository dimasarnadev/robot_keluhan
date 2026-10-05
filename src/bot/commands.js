const env = require('../config/env');
const { db } = require('../config/database');
const { pollKeluhan } = require('../jobs/keluhan-poller');
const { FINAL_STATUSES } = require('../services/apkt');
const {
    SessionUnavailableError,
    fetchLiveKeluhan
} = require('../services/keluhan-live');
const { formatDateTime, sanitizeText } = require('../utils/format');
const { resolveSessionName } = require('./waha-session');
const { sendText } = require('./whatsapp');

const NO_LAPORAN_PATTERN = /^[A-Za-z0-9]{5,30}$/;
const REFRESH_COOLDOWN_MS = 30000;
const LIST_LIMIT = 20;
const HISTORY_LIMIT = 10;

let lastRefreshAt = 0;

function isOpenStatus(status) {
    if (!status) {
        return true;
    }

    return !FINAL_STATUSES.includes(String(status).trim());
}

function isCommandAllowed(chatId) {
    const row = db
        .prepare(
            `
            SELECT
                enabled,
                command_enabled
            FROM whatsapp_groups
            WHERE chat_id = ?
            LIMIT 1
        `
        )
        .get(chatId);

    if (!row) {
        return false;
    }

    return row.enabled === 1 && row.command_enabled === 1;
}

function liveErrorMessage(error) {
    if (error instanceof SessionUnavailableError) {
        return [
            '🔒 *SESSION APKT TIDAK AKTIF*',
            '',
            'Login ulang melalui dashboard agar data dapat diambil.'
        ].join('\n');
    }

    console.error('[BOT] Gagal mengambil data APKT:', error.message);

    return [
        '❌ *GAGAL MENGAMBIL DATA*',
        '',
        'Server APKT tidak dapat dihubungi. Coba lagi beberapa saat.'
    ].join('\n');
}

// ============================================================
// /HELP
// ============================================================

function helpMessage() {
    return [
        '🤖 *BOT MONITORING KELUHAN*',
        '',
        '*Command tersedia:*',
        '',
        '*/keluhan*',
        `Menampilkan ${LIST_LIMIT} keluhan open (data langsung dari APKT).`,
        '',
        '*/detail <no_laporan>*',
        'Menampilkan detail keluhan beserta histori status.',
        '',
        '*/refresh*',
        'Memeriksa APKT sekarang dan mengirim notifikasi bila ada.',
        '',
        '*/help*',
        'Menampilkan bantuan command.'
    ].join('\n');
}

// ============================================================
// /KELUHAN  (live dari APKT)
// ============================================================

async function getOpenKeluhan() {
    const result = await fetchLiveKeluhan();
    const open = result.data.filter((row) => isOpenStatus(row.status));

    return {
        rows: open.slice(0, LIST_LIMIT),
        totalOpen: open.length,
        truncated: result.truncated
    };
}

function formatKeluhanList({ rows, totalOpen, truncated }) {
    if (!rows.length) {
        return [
            '📋 *DAFTAR KELUHAN OPEN*',
            '',
            '✅ Tidak ada keluhan open saat ini.'
        ].join('\n');
    }

    const lines = [
        '📋 *DAFTAR KELUHAN OPEN*',
        '',
        `Menampilkan ${rows.length} dari ${totalOpen} keluhan open.`,
        ''
    ];

    rows.forEach((row, index) => {
        lines.push(`*${index + 1}. ${sanitizeText(row.no_laporan, 50)}*`);
        lines.push(`👤 *Pelapor:* ${sanitizeText(row.nama_pelapor, 100)}`);
        lines.push(
            `💬 *Permasalahan:* ${sanitizeText(row.permasalahan, 200)}`
        );
        lines.push(`🔄 *Status:* ${sanitizeText(row.status, 100)}`);
        lines.push(`🕐 *Waktu Lapor:* ${formatDateTime(row.waktu_lapor)}`);
        lines.push(`⌛ *Durasi:* ${sanitizeText(row.durasi, 50)}`);
        lines.push('');
    });

    if (truncated) {
        lines.push('⚠️ Sebagian data APKT tidak terbaca (melebihi batas).');
        lines.push('');
    }

    lines.push('Gunakan */detail <no_laporan>* untuk melihat detail.');

    return lines.join('\n');
}

// ============================================================
// /DETAIL  (live dari APKT + histori status dari database)
// ============================================================

async function getDetailKeluhan(noLaporan) {
    const result = await fetchLiveKeluhan({
        rangeDays: env.keluhan.detailRangeDays,
        extraFilters: [{ field: 'no_laporan', value: [noLaporan] }]
    });

    return result.data.find((row) => row.no_laporan === noLaporan) || null;
}

function getStatusHistory(noLaporan) {
    return db
        .prepare(
            `
            SELECT status_lama, status_baru, changed_at
            FROM (
                SELECT id, status_lama, status_baru, changed_at
                FROM keluhan_status_history
                WHERE no_laporan = ?
                ORDER BY id DESC
                LIMIT ${HISTORY_LIMIT}
            )
            ORDER BY id ASC
        `
        )
        .all(noLaporan);
}

function formatDetail(row, history) {
    if (!row) {
        return [
            '❌ *KELUHAN TIDAK DITEMUKAN*',
            '',
            `No laporan tidak ditemukan di APKT (rentang ${env.keluhan.detailRangeDays} hari terakhir).`
        ].join('\n');
    }

    const lines = [
        '📋 *DETAIL KELUHAN*',
        '',
        `*No Laporan:* ${sanitizeText(row.no_laporan, 50)}`,
        '',
        `👤 *Pelapor:* ${sanitizeText(row.nama_pelapor, 100)}`,
        `🆔 *ID Pelanggan:* ${sanitizeText(row.id_pelanggan, 50)}`,
        `⚡ *No Meter:* ${sanitizeText(row.no_meter, 50)}`,
        '',
        `🏢 *UP3:* ${sanitizeText(row.nama_up3, 100)}`,
        `📍 *ULP:* ${sanitizeText(row.nama_ulp, 100)}`,
        '',
        '📝 *Permasalahan:*',
        sanitizeText(row.permasalahan, 500),
        '',
        '📍 *Alamat:*',
        sanitizeText(row.alamat_pelanggan, 300),
        '',
        '🕐 *Waktu Lapor:*',
        formatDateTime(row.waktu_lapor),
        `🔄 *Status:* ${sanitizeText(row.status, 100)}`,
        `⌛ *Durasi:* ${sanitizeText(row.durasi, 50)}`
    ];

    if (history.length) {
        lines.push('', '🕘 *Histori Status:*');

        for (const item of history) {
            lines.push(
                `• ${formatDateTime(item.changed_at)} — ${sanitizeText(item.status_baru, 100)}`
            );
        }
    }

    return lines.join('\n');
}

// ============================================================
// /REFRESH
// ============================================================

async function handleRefresh(chatId, sessionName) {
    const now = Date.now();

    if (now - lastRefreshAt < REFRESH_COOLDOWN_MS) {
        await sendText(
            chatId,
            '⏳ Refresh baru saja dijalankan. Coba lagi beberapa saat.',
            sessionName
        );

        return;
    }

    lastRefreshAt = now;

    await sendText(
        chatId,
        '🔄 *REFRESH DATA*\n\nSedang memeriksa data keluhan terbaru dari APKT...',
        sessionName
    );

    const result = await pollKeluhan();

    if (result.ok) {
        await sendText(
            chatId,
            [
                '✅ *REFRESH SELESAI*',
                '',
                `${result.total} keluhan diperiksa.`,
                `Notifikasi baru: ${result.newSent}, reminder: ${result.reminderSent}.`
            ].join('\n'),
            sessionName
        );

        return;
    }

    await sendText(
        chatId,
        result.skipped
            ? `ℹ️ *REFRESH DILEWATI*\n\n${result.reason}`
            : [
                  '❌ *REFRESH GAGAL*',
                  '',
                  'Data APKT tidak dapat diperiksa.'
              ].join('\n'),
        sessionName
    );
}

// ============================================================
// COMMAND HANDLER
// ============================================================

/**
 * @param {object} input
 * @param {string} input.chatId
 * @param {string} input.text
 * @param {string|null} [input.incomingSession] - nilai `session` dari body
 *   webhook WAHA (event.session), apa adanya, boleh null/undefined.
 *   Resolusi menjadi nama session yang dipakai untuk membalas dilakukan
 *   SEKALI di sini lewat resolveSessionName(), lalu diteruskan sebagai
 *   nilai pasti ke seluruh pemanggilan sendText di bawah.
 */
async function handleCommand({ chatId, text, incomingSession = null }) {
    if (!isCommandAllowed(chatId)) {
        return false;
    }

    const trimmed = String(text).trim();

    if (!trimmed.startsWith('/')) {
        return false;
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();

    // Satu-satunya tempat sessionName ditentukan untuk seluruh command ini.
    const sessionName = resolveSessionName(incomingSession);

    switch (command) {
        case '/help': {
            await sendText(chatId, helpMessage(), sessionName);

            return true;
        }

        case '/keluhan': {
            let message;

            try {
                message = formatKeluhanList(await getOpenKeluhan());
            } catch (error) {
                message = liveErrorMessage(error);
            }

            await sendText(chatId, message, sessionName);

            return true;
        }

        case '/detail': {
            const noLaporan = parts[1];

            if (!noLaporan || !NO_LAPORAN_PATTERN.test(noLaporan)) {
                await sendText(
                    chatId,
                    [
                        '❌ Format command salah.',
                        '',
                        'Gunakan:',
                        '/detail <no_laporan>'
                    ].join('\n'),
                    sessionName
                );

                return true;
            }

            let message;

            try {
                const row = await getDetailKeluhan(noLaporan);

                message = formatDetail(row, getStatusHistory(noLaporan));
            } catch (error) {
                message = liveErrorMessage(error);
            }

            await sendText(chatId, message, sessionName);

            return true;
        }

        case '/refresh': {
            await handleRefresh(chatId, sessionName);

            return true;
        }

        default: {
            await sendText(
                chatId,
                [
                    '❓ Command tidak dikenal.',
                    '',
                    'Gunakan */help* untuk melihat command yang tersedia.'
                ].join('\n'),
                sessionName
            );

            return true;
        }
    }
}

module.exports = {
    handleCommand,
    getOpenKeluhan,
    getDetailKeluhan,
    getStatusHistory,
    formatKeluhanList,
    formatDetail,
    helpMessage,
    isOpenStatus,
    isCommandAllowed
};
