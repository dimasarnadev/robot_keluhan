require('dotenv').config();

const { db } = require('../config/database');
const { getSession } = require('../config/session');
const {
    postKeluhan,
    STATUS_KELUHAN,
    CLOSE_STATUS_KELUHAN
} = require('../services/keluhan');
const {
    postGangguan,
    STATUS_GANGGUAN,
    CLOSE_STATUS_GANGGUAN
} = require('../services/gangguan');
const {
    resolveDefaultDateRange,
    resolveSessionDefaults
} = require('../services/common');
const {
    formatDateOnly,
    formatDateTime,
    sanitizeText
} = require('../utils/format');
const { sendText } = require('./whatsapp');

const NO_LAPORAN_PATTERN = /^[A-Za-z0-9]{5,30}$/;
const LIST_LIMIT = process.env.POLL_LIMIT;

function isCommandAllowed(chatId) {
    const row = db
        .prepare(
            'SELECT * FROM whatsapp_groups WHERE enabled = 1 AND chat_id = ? LIMIT 1'
        )
        .get(chatId);

    return !!row;
}

function isKeluhanOpenStatus(status) {
    if (!status) {
        return true;
    }

    return !CLOSE_STATUS_KELUHAN.includes(String(status).trim());
}

function isGangguanOpenStatus(status) {
    if (!status) {
        return true;
    }

    return !CLOSE_STATUS_GANGGUAN.includes(String(status).trim());
}

function helpMessage() {
    return [
        '🤖 *BOT MONITORING KELUHAN*',
        '',
        '*Command tersedia:*',
        '',
        '*/keluhan*',
        `Menampilkan ${LIST_LIMIT} keluhan berstatus open.`,
        '',
        '*/gangguan*',
        `Menampilkan ${LIST_LIMIT} gangguan berstatus open.`,
        '',
        '*/detail <no_laporan>*',
        'Menampilkan detail keluhan atau gangguan berdasarkan prefix nomor laporan (K/G).',
        '',
        '*/help*',
        'Menampilkan bantuan command.'
    ].join('\n');
}

function formatTransactionHistory(items, { includeRegu = false } = {}) {
    if (!Array.isArray(items) || !items.length) {
        return [];
    }

    return items.map((item) => {
        const waktu = String(item?.waktu || '').trim();
        const jenis = String(item?.jenis || '').trim();
        const username = String(item?.appuser?.username || '').trim();
        const regu =
            includeRegu && item?.regu ? String(item.regu.nama).trim() : '';

        const parts = [];

        if (waktu) parts.push(waktu);
        if (jenis) parts.push(jenis);
        if (regu) parts.push(regu);
        if (username) parts.push(username);

        return `• ${parts.join(' — ')}`;
    });
}

async function getOpenKeluhan() {
    const sessionData = getSession(process.env.SESSION_ID);
    const baseParams = resolveSessionDefaults(sessionData, {
        token: sessionData?.authToken,
        idUid: sessionData?.user?.idUid,
        userId: sessionData?.user?.userId,
        idUlp: sessionData?.user?.idUlp
    });
    const dates = resolveDefaultDateRange({
        tanggalMulai: undefined,
        tanggalSelesai: undefined,
        rangeDays: Number(process.env.POLL_RANGE_DAYS || 1)
    });

    const result = await postKeluhan({
        ...baseParams,
        ...dates
    });

    const open = result.data.filter((row) =>
        isKeluhanOpenStatus(row.status_akhir)
    );

    return {
        rows: open.slice(0, LIST_LIMIT),
        totalOpen: open.length,
        truncated: open.length > LIST_LIMIT
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
        lines.push(`💬 *Permasalahan:* ${sanitizeText(row.permasalahan, 200)}`);
        lines.push(`🔄 *Status:* ${sanitizeText(row.status_akhir, 100)}`);
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

async function getDetailKeluhan(noLaporan) {
    const sessionData = getSession(process.env.SESSION_ID);
    const baseParams = resolveSessionDefaults(sessionData, {
        token: sessionData?.authToken,
        idUid: sessionData?.user?.idUid,
        userId: sessionData?.user?.userId,
        idUlp: sessionData?.user?.idUlp
    });
    const dates = resolveDefaultDateRange({
        tanggalMulai: undefined,
        tanggalSelesai: undefined,
        rangeDays: Number(process.env.POLL_RANGE_DAYS || 1)
    });

    const result = await postKeluhan({
        ...baseParams,
        ...dates,
        filters: [{ field: 'no_laporan', value: [noLaporan] }]
    });

    return result.data.find((row) => row.no_laporan === noLaporan) || null;
}

function formatDetail(row) {
    if (!row) {
        return [
            '❌ *KELUHAN TIDAK DITEMUKAN*',
            '',
            `No laporan tidak ditemukan di APKT (rentang ${process.env.POLL_RANGE_DAYS} hari terakhir).`
        ].join('\n');
    }

    const lines = [
        '📋 *DETAIL KELUHAN*',
        '',
        `*No Laporan:* ${sanitizeText(row.no_laporan, 50)}`,
        '',
        `👤 *Pelapor:* ${sanitizeText(row.nama_pelapor, 100)}`,
        `📞 *Telepon:* ${sanitizeText(row.telepon_pelapor, 50)}`,
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
        `🔄 *Status:* ${sanitizeText(row.status_akhir, 100)}`,
        `⌛ *Durasi:* ${sanitizeText(row.durasi, 50)}`
    ];

    const transaksi = formatTransactionHistory(row.keluhan_transaksi || []);

    if (transaksi.length) {
        lines.push('', '🕘 *Histori Transaksi:*');
        lines.push(...transaksi);
    }

    return lines.join('\n');
}

async function getOpenGangguan() {
    const sessionData = getSession(process.env.SESSION_ID);
    const baseParams = resolveSessionDefaults(sessionData, {
        token: sessionData?.authToken,
        idUid: sessionData?.user?.idUid,
        userId: sessionData?.user?.userId,
        idUlp: sessionData?.user?.idUlp,
        idPosko: sessionData?.user?.idPosko
    });

    const dates = resolveDefaultDateRange({
        tanggalMulai: undefined,
        tanggalSelesai: undefined,
        rangeDays: Number(process.env.POLL_RANGE_DAYS || 1)
    });

    const result = await postGangguan({
        ...baseParams,
        ...dates
    });

    const open = result.data.filter((row) =>
        isGangguanOpenStatus(row.status_akhir)
    );

    return {
        rows: open.slice(0, LIST_LIMIT),
        totalOpen: open.length,
        truncated: open.length > LIST_LIMIT
    };
}

function formatGangguanList({ rows, totalOpen, truncated }) {
    if (!rows.length) {
        return [
            '📋 *DAFTAR GANGGUAN OPEN*',
            '',
            '✅ Tidak ada gangguan open saat ini.'
        ].join('\n');
    }

    const lines = [
        '📋 *DAFTAR GANGGUAN OPEN*',
        '',
        `Menampilkan ${rows.length} dari ${totalOpen} gangguan open.`,
        ''
    ];

    rows.forEach((row, index) => {
        lines.push(`*${index + 1}. ${sanitizeText(row.no_laporan, 50)}*`);
        lines.push(`👤 *Pelapor:* ${sanitizeText(row.nama_pelapor, 100)}`);
        lines.push(
            `💬 *Permasalahan:* ${sanitizeText(row.permasalahan ?? row.deskripsi, 200)}`
        );
        lines.push(`🔄 *Status:* ${sanitizeText(row.status_akhir, 100)}`);
        lines.push(`🕐 *Waktu Lapor:* ${formatDateTime(row.waktu_lapor)}`);
        lines.push(`📍 *Posko:* ${sanitizeText(row.nama_posko, 100)}`);
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

async function getDetailGangguan(noLaporan) {
    const sessionData = getSession(process.env.SESSION_ID);
    const baseParams = resolveSessionDefaults(sessionData, {
        token: sessionData?.authToken,
        idUid: sessionData?.user?.idUid,
        userId: sessionData?.user?.userId,
        idUlp: sessionData?.user?.idUlp,
        idPosko: sessionData?.user?.idPosko
    });

    const dates = resolveDefaultDateRange({
        tanggalMulai: undefined,
        tanggalSelesai: undefined,
        rangeDays: Number(process.env.POLL_RANGE_DAYS || 1)
    });

    const result = await postGangguan({
        ...baseParams,
        ...dates,
        filters: [{ field: 'no_laporan', value: [noLaporan] }]
    });

    return result.data.find((row) => row.no_laporan === noLaporan) || null;
}

function formatDetailGangguan(row) {
    if (!row) {
        return [
            '❌ *GANGGUAN TIDAK DITEMUKAN*',
            '',
            `No laporan tidak ditemukan di APKT (rentang ${process.env.POLL_RANGE_DAYS} hari terakhir).`
        ].join('\n');
    }

    const lines = [
        '📋 *DETAIL GANGGUAN*',
        '',
        `*No Laporan:* ${sanitizeText(row.no_laporan, 50)}`,
        '',
        `👤 *Pelapor:* ${sanitizeText(row.nama_pelapor, 100)}`,
        `📞 *Telepon:* ${sanitizeText(row.telepon_pelapor, 50)}`,
        `📍 *Posko:* ${sanitizeText(row.nama_posko, 100)}`,
        `🆔 *ID Pelanggan:* ${sanitizeText(row.id_pelanggan, 50)}`,
        `⚡ *No Meter:* ${sanitizeText(row.no_meter, 50)}`,
        '',
        '📝 *Permasalahan:*',
        sanitizeText(row.permasalahan, 500),
        '',
        '📍 *Alamat:*',
        sanitizeText(row.alamat_pelanggan, 300),
        '',
        '🕐 *Waktu Lapor:*',
        formatDateTime(row.waktu_lapor),
        `🔄 *Status:* ${sanitizeText(row.status_akhir, 100)}`,
        `⌛ *Durasi:* ${sanitizeText(row.durasi, 50)}`
    ];

    const transaksi = formatTransactionHistory(row.gangguan_transaksi || [], {
        includeRegu: true
    });

    if (transaksi.length) {
        lines.push('', '🕘 *Histori Transaksi:*');
        lines.push(...transaksi);
    }

    return lines.join('\n');
}

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

    if (incomingSession !== process.env.WAHA_SESSION) {
        return false;
    }

    const trimmed = String(text).trim();

    if (!trimmed.startsWith('/')) {
        return false;
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();

    const sessionName = incomingSession;

    switch (command) {
        case '/help': {
            await sendText(chatId, helpMessage(), sessionName);

            return true;
        }

        case '/keluhan': {
            const message = formatKeluhanList(await getOpenKeluhan());

            await sendText(chatId, message, sessionName);

            return true;
        }

        case '/gangguan': {
            const message = formatGangguanList(await getOpenGangguan());

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

            const prefix = String(noLaporan).slice(0, 1).toUpperCase();

            let row = null;
            let message = '';

            if (prefix === 'G') {
                row = await getDetailGangguan(noLaporan);
                message = formatDetailGangguan(row);
            } else {
                row = await getDetailKeluhan(noLaporan);
                message = formatDetail(row);
            }

            await sendText(chatId, message, sessionName);

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
    getOpenGangguan,
    getDetailGangguan,
    formatKeluhanList,
    formatDetail,
    formatGangguanList,
    formatDetailGangguan,
    helpMessage,
    isKeluhanOpenStatus,
    isGangguanOpenStatus,
    isCommandAllowed
};
