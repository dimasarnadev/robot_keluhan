const { db } = require('../config/database');
const { pollKeluhan } = require('../jobs/keluhan-poller');
const { FINAL_STATUSES } = require('../services/apkt');
const { formatDateTime, sanitizeText } = require('../utils/format');
const { resolveSessionName } = require('./waha-session');
const { sendText } = require('./whatsapp');

const NO_LAPORAN_PATTERN = /^[A-Za-z0-9]{5,30}$/;
const REFRESH_COOLDOWN_MS = 30000;

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

function parseRawData(value) {
    try {
        const parsed = value ? JSON.parse(value) : {};

        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
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
        'Menampilkan 20 keluhan terbaru yang masih open.',
        '',
        '*/detail <no_laporan>*',
        'Menampilkan detail satu keluhan.',
        '',
        '*/refresh*',
        'Mengambil data terbaru dari APKT.',
        '',
        '*/help*',
        'Menampilkan bantuan command.'
    ].join('\n');
}

// ============================================================
// /KELUHAN
// ============================================================

function getOpenKeluhan() {
    const placeholders = FINAL_STATUSES.map(() => '?').join(', ');

    return db
        .prepare(
            `
            SELECT
                id,
                no_laporan,
                nama_pelapor,
                id_pelanggan,
                no_meter,
                status,
                status_terakhir,
                status_changed_at,
                first_seen_at,
                last_seen_at,
                raw_data
            FROM keluhan_monitoring
            WHERE status IS NULL
               OR TRIM(status) NOT IN (${placeholders})
            ORDER BY
                COALESCE(
                    last_seen_at,
                    first_seen_at,
                    created_at
                ) DESC
            LIMIT 20
        `
        )
        .all(...FINAL_STATUSES);
}

function formatKeluhanList(rows) {
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
        `Menampilkan ${rows.length} keluhan terbaru.`,
        ''
    ];

    rows.forEach((row, index) => {
        const raw = parseRawData(row.raw_data);
        const nama = row.nama_pelapor;
        const status = row.status_terakhir;

        lines.push(`*${index + 1}. ${sanitizeText(row.no_laporan, 50)}*`);
        lines.push(`👤 *Pelapor:* ${sanitizeText(nama, 100)}`);
        lines.push(`💬 *Permasalahan:* ${sanitizeText(raw.permasalahan, 200)}`);
        lines.push(`🔄 *Status:* ${sanitizeText(status, 100)}`);
        lines.push(`🕐 *Waktu Lapor:* ${formatDateTime(raw.waktu_lapor)}`);
        lines.push(`⌛ *Durasi:* ${sanitizeText(raw.durasi, 50)}`);
        lines.push('');
    });

    lines.push('Gunakan */detail <no_laporan>* untuk melihat detail.');

    return lines.join('\n');
}

// ============================================================
// /DETAIL
// ============================================================

function getDetailKeluhan(noLaporan) {
    return db
        .prepare(
            `
            SELECT *
            FROM keluhan_monitoring
            WHERE no_laporan = ?
            LIMIT 1
        `
        )
        .get(noLaporan);
}

function formatDetail(row) {
    if (!row) {
        return [
            '❌ *KELUHAN TIDAK DITEMUKAN*',
            '',
            'No laporan tidak ditemukan di database monitoring.'
        ].join('\n');
    }

    const raw = parseRawData(row.raw_data);

    const namaPelapor = row.nama_pelapor;
    const namaPelanggan = raw.nama_pelanggan;
    const noMeter = raw.no_meter || row.no_meter;
    const idPelanggan = raw.id_pelanggan || row.id_pelanggan;
    const namaUlp = raw.nama_ulp;
    const namaUp3 = raw.nama_up3;

    const status = row.status_terakhir;

    return [
        '📋 *DETAIL KELUHAN*',
        '',
        `*No Laporan:* ${sanitizeText(row.no_laporan, 50)}`,
        '',
        `👤 *Pelapor:* ${sanitizeText(namaPelapor, 100)}`,
        `🆔 *ID Pelanggan:* ${sanitizeText(idPelanggan, 50)}`,
        `⚡ *No Meter:* ${sanitizeText(noMeter, 50)}`,
        '',
        `🏢 *UP3:* ${sanitizeText(namaUp3, 100)}`,
        `📍 *ULP:* ${sanitizeText(namaUlp, 100)}`,
        '',
        '📝 *Permasalahan:*',
        sanitizeText(raw.permasalahan, 500),
        '',
        '📍 *Alamat:*',
        sanitizeText(raw.alamat_pelanggan, 300),
        '',
        '🕐 *Waktu Lapor:*',
        formatDateTime(raw.waktu_lapor),
        `🔄 *Status:* ${sanitizeText(status, 100)}`,
        `⌛ *Durasi:* ${sanitizeText(raw.durasi, 50)}`,
    ].join('\n');
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

    try {
        await sendText(
            chatId,
            '🔄 *REFRESH DATA*\n\nSedang mengambil data keluhan terbaru dari APKT...',
            sessionName
        );

        await pollKeluhan();

        await sendText(
            chatId,
            ['✅ *REFRESH SELESAI*', '', 'Data keluhan telah diperbarui.'].join(
                '\n'
            ),
            sessionName
        );
    } catch (error) {
        console.error('[BOT] Refresh error:', error);

        await sendText(
            chatId,
            [
                '❌ *REFRESH GAGAL*',
                '',
                'Data APKT tidak dapat diperbarui.'
            ].join('\n'),
            sessionName
        );
    }
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
            await sendText(
                chatId,
                formatKeluhanList(getOpenKeluhan()),
                sessionName
            );

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

            await sendText(
                chatId,
                formatDetail(getDetailKeluhan(noLaporan)),
                sessionName
            );

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
    formatKeluhanList,
    formatDetail,
    helpMessage,
    isOpenStatus,
    isCommandAllowed
};