require('dotenv').config();

const { db } = require('../config/database');
const { formatDateTime, sanitizeText } = require('../utils/format');
const { sendText } = require('./whatsapp');

const getGroupsByUserId = db.prepare(`
    SELECT *
    FROM whatsapp_groups
    WHERE enabled = 1
      AND user_id = ?
    ORDER BY id
`);

function formatKeluhanBaru(keluhan) {
    return [
        '🚨 KELUHAN BARU',
        '',
        `*No Laporan:* ${sanitizeText(keluhan.no_laporan, 50)}`,
        `*Pelapor:* ${sanitizeText(keluhan.nama_pelapor, 100)}`,
        `*Telepon:* ${sanitizeText(keluhan.telepon_pelapor, 50)}`,
        `*No Meter:* ${sanitizeText(keluhan.no_meter, 50)}`,
        `*ULP:* ${sanitizeText(keluhan.nama_ulp, 100)}`,
        '',
        '*Permasalahan:*',
        sanitizeText(keluhan.permasalahan, 500),
        '',
        `*Status:* ${sanitizeText(keluhan.status_akhir, 100)}`,
        `*Waktu Lapor:* ${formatDateTime(keluhan.waktu_lapor)}`,
        '',
        'Mohon segera ditindaklanjuti.'
    ].join('\n');
}

function formatReminder(keluhan) {
    return [
        '⚠️ REMINDER KELUHAN',
        '',
        'Status belum berubah dan belum diproses.',
        '',
        `*No Laporan:* ${sanitizeText(keluhan.no_laporan, 50)}`,
        `*Pelapor:* ${sanitizeText(keluhan.nama_pelapor, 100)}`,
        `*Telepon:* ${sanitizeText(keluhan.telepon_pelapor, 50)}`,
        `*ULP:* ${sanitizeText(keluhan.nama_ulp, 100)}`,
        '',
        '*Permasalahan:*',
        sanitizeText(keluhan.permasalahan, 500),
        '',
        `*Status:* ${sanitizeText(keluhan.status_akhir, 100)}`,
        `*Durasi:* ${sanitizeText(keluhan.durasi, 50)}`,
        '',
        'Mohon segera ditindaklanjuti.'
    ].join('\n');
}

function formatStatusChange(keluhan) {
    return [
        'ℹ️ STATUS KELUHAN BERUBAH',
        '',
        `*No Laporan:* ${sanitizeText(keluhan.no_laporan, 50)}`,
        `*Pelapor:* ${sanitizeText(keluhan.nama_pelapor, 100)}`,
        `*Telepon:* ${sanitizeText(keluhan.telepon_pelapor, 50)}`,
        `*ULP:* ${sanitizeText(keluhan.nama_ulp, 100)}`,
        '',
        '*Permasalahan:*',
        sanitizeText(keluhan.permasalahan, 500),
        '',
        `*Status Baru:* ${sanitizeText(keluhan.status_akhir, 100)}`,
        `*Durasi:* ${sanitizeText(keluhan.durasi, 50)}`
    ].join('\n');
}

function formatGangguanBaru(gangguan) {
    return [
        '🚨 GANGGUAN BARU',
        '',
        `*No Laporan:* ${sanitizeText(gangguan.no_laporan, 50)}`,
        `*Pelapor:* ${sanitizeText(gangguan.nama_pelapor, 100)}`,
        `*Telepon:* ${sanitizeText(gangguan.telepon_pelapor, 50)}`,
        `*Posko:* ${sanitizeText(gangguan.nama_posko, 100)}`,
        '',
        '*Permasalahan:*',
        sanitizeText(gangguan.permasalahan, 500),
        '',
        `*Status:* ${sanitizeText(gangguan.status_akhir, 100)}`,
        `*Waktu Lapor:* ${formatDateTime(gangguan.waktu_lapor)}`,
        '',
        'Mohon segera ditindaklanjuti.'
    ].join('\n');
}

function formatGangguanStatusChange(gangguan) {
    return [
        'ℹ️ STATUS GANGGUAN BERUBAH',
        '',
        `*No Laporan:* ${sanitizeText(gangguan.no_laporan, 50)}`,
        `*Pelapor:* ${sanitizeText(gangguan.nama_pelapor, 100)}`,
        `*Telepon:* ${sanitizeText(gangguan.telepon_pelapor, 50)}`,
        `*Posko:* ${sanitizeText(gangguan.nama_posko, 100)}`,
        '',
        '*Permasalahan:*',
        sanitizeText(gangguan.permasalahan, 500),
        '',
        `*Status Baru:* ${sanitizeText(gangguan.status_akhir, 100)}`,
        `*Durasi:* ${sanitizeText(gangguan.durasi, 50)}`
    ].join('\n');
}

async function broadcast(userId, text, label) {
    const groups = getGroupsByUserId.all(userId);

    if (!groups.length) {
        return 0;
    }

    const session = process.env.WAHA_SESSION;

    if (!session) {
        throw new Error('WAHA_SESSION belum dikonfigurasi.');
    }

    let sent = 0;

    for (const group of groups) {
        try {
            await sendText(group.chat_id, text, session);

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

function notifyKeluhanBaru(userId, keluhan) {
    return broadcast(userId, formatKeluhanBaru(keluhan), 'Keluhan Baru');
}

function notifyReminder(userId, keluhan) {
    return broadcast(userId, formatReminder(keluhan), 'Reminder');
}

function notifyStatusChange(userId, keluhan) {
    return broadcast(userId, formatStatusChange(keluhan), 'Status Berubah');
}

function notifyGangguanBaru(userId, gangguan) {
    return broadcast(userId, formatGangguanBaru(gangguan), 'Gangguan Baru');
}

function notifyGangguanStatusChange(userId, gangguan) {
    return broadcast(
        userId,
        formatGangguanStatusChange(gangguan),
        'Status Gangguan Berubah'
    );
}

module.exports = {
    notifyKeluhanBaru,
    notifyReminder,
    notifyStatusChange,
    notifyGangguanBaru,
    notifyGangguanStatusChange,
    formatKeluhanBaru,
    formatReminder,
    formatStatusChange,
    formatGangguanBaru,
    formatGangguanStatusChange
};
