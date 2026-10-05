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
        'Status belum berubah dan belum diproses.',
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

function getGroups(column) {
    // `column` hanya berasal dari kode di bawah, bukan input luar.
    return db
        .prepare(
            `
            SELECT *
            FROM whatsapp_groups
            WHERE enabled = 1
              AND ${column} = 1
            ORDER BY id
        `
        )
        .all();
}

// Mengirim ke semua grup. Mengembalikan jumlah grup yang berhasil.
// Penanda "sudah dinotifikasi" disimpan oleh poller, bukan di sini.
async function broadcast(column, text, label) {
    const groups = getGroups(column);

    if (!groups.length) {
        return 0;
    }

    const sessionName = resolveSessionName();
    let sent = 0;

    for (const group of groups) {
        try {
            await sendText(group.chat_id, text, sessionName);

            sent += 1;

            console.log(
                `📤 ${label} dikirim ke ${group.group_name || group.chat_id}`
            );
        } catch (error) {
            console.error(
                `❌ Gagal kirim ${label} ke ${group.chat_id}:`,
                error.message
            );
        }
    }

    return sent;
}

function notifyNewKeluhan(keluhan) {
    return broadcast('notify_new', formatNewKeluhan(keluhan), 'Keluhan baru');
}

function notifyReminder(keluhan) {
    return broadcast('notify_reminder', formatReminder(keluhan), 'Reminder');
}

module.exports = {
    notifyNewKeluhan,
    notifyReminder,
    formatNewKeluhan,
    formatReminder
};
