const { db } = require('../config/database');
const { sendText } = require('./whatsapp');
const { pollKeluhan } = require('../jobs/keluhan-poller');

const FINAL_STATUSES = [
    'Selesai',
    'Batal'
];

function isOpenStatus(status) {
    if (!status) {
        return true;
    }

    return !FINAL_STATUSES.includes(
        String(status).trim()
    );
}

function isCommandAllowed(chatId) {

    const row = db.prepare(`
        SELECT
            enabled,
            command_enabled
        FROM whatsapp_groups
        WHERE chat_id = ?
        LIMIT 1
    `).get(chatId);

    if (!row) {
        return false;
    }

    return (
        row.enabled === 1 &&
        row.command_enabled === 1
    );
}

function formatDate(value) {

    if (!value) {
        return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
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

    return db.prepare(`
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
           OR TRIM(status) NOT IN ('Selesai', 'Batal')
        ORDER BY
            COALESCE(
                last_seen_at,
                first_seen_at,
                created_at
            ) DESC
        LIMIT 20
    `).all();
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

        let raw = {};

        try {
            raw = row.raw_data
                ? JSON.parse(row.raw_data)
                : {};
        } catch {
            raw = {};
        }

        const nama =
            row.nama_pelapor ||
            raw.nama_pelapor ||
            raw.nama_pelanggan ||
            '-';

        const permasalahan =
            raw.permasalahan || '-';

        const status =
            row.status ||
            row.status_terakhir ||
            '-';

        lines.push(
            `*${index + 1}. ${row.no_laporan}*`
        );

        lines.push(
            `👤 ${nama}`
        );

        lines.push(
            `⚡ ${permasalahan}`
        );

        lines.push(
            `🔄 ${status}`
        );

        lines.push('');
    });

    lines.push(
        'Gunakan */detail <no_laporan>* untuk melihat detail.'
    );

    return lines.join('\n');
}


// ============================================================
// /DETAIL
// ============================================================

function getDetailKeluhan(noLaporan) {

    return db.prepare(`
        SELECT *
        FROM keluhan_monitoring
        WHERE no_laporan = ?
        LIMIT 1
    `).get(noLaporan);
}


function formatDetail(row) {

    if (!row) {

        return [
            '❌ *KELUHAN TIDAK DITEMUKAN*',
            '',
            'No laporan tidak ditemukan di database monitoring.'
        ].join('\n');
    }

    let raw = {};

    try {
        raw = row.raw_data
            ? JSON.parse(row.raw_data)
            : {};
    } catch {
        raw = {};
    }

    const namaPelanggan =
        raw.nama_pelanggan ||
        raw.pelanggan_no_meter?.nama ||
        row.nama_pelapor ||
        '-';

    const noMeter =
        raw.no_meter ||
        raw.pelanggan_no_meter?.no_meter ||
        row.no_meter ||
        '-';

    const idPelanggan =
        raw.id_pelanggan ||
        raw.pelanggan_no_meter?.id_pelanggan ||
        row.id_pelanggan ||
        '-';

    const namaUlp =
        raw.nama_ulp ||
        raw.master_ulp?.nama ||
        '-';

    const namaUp3 =
        raw.nama_up3 ||
        raw.master_ulp?.master_up3?.nama ||
        '-';

    const permasalahan =
        raw.permasalahan ||
        '-';

    const alamat =
        raw.alamat_pelanggan ||
        '-';

    const waktuLapor =
        raw.waktu_lapor ||
        '-';

    const status =
        row.status ||
        row.status_terakhir ||
        '-';

    return [
        '📋 *DETAIL KELUHAN*',
        '',
        `*No Laporan:* ${row.no_laporan}`,
        '',
        `👤 *Pelanggan:* ${namaPelanggan}`,
        `🆔 *ID Pelanggan:* ${idPelanggan}`,
        `⚡ *No Meter:* ${noMeter}`,
        '',
        `🏢 *UP3:* ${namaUp3}`,
        `📍 *ULP:* ${namaUlp}`,
        '',
        `📝 *Permasalahan:*`,
        permasalahan,
        '',
        `📍 *Alamat:*`,
        alamat,
        '',
        `🕐 *Waktu Lapor:*`,
        formatDate(waktuLapor),
        '',
        `🔄 *Status:* ${status}`,
        '',
        `⏱️ *Status berubah:*`,
        formatDate(row.status_changed_at)
    ].join('\n');
}


// ============================================================
// /REFRESH
// ============================================================

async function handleRefresh(chatId, sessionName) {

    try {

        await sendText(
            chatId,
            '🔄 *REFRESH DATA*\n\nSedang mengambil data keluhan terbaru dari APKT...',
            sessionName
        );

        const result =
            await pollKeluhan();

        const total =
            result?.total ??
            result?.count ??
            0;

        await sendText(
            chatId,
            [
                '✅ *REFRESH SELESAI*',
                '',
                `Data monitoring telah diperbarui.`,
                `Keluhan diproses: ${total}`
            ].join('\n'),
            sessionName
        );

    } catch (error) {

        console.error(
            '[BOT] Refresh error:',
            error
        );

        await sendText(
            chatId,
            [
                '❌ *REFRESH GAGAL*',
                '',
                error.message ||
                    'Data APKT tidak dapat diperbarui.'
            ].join('\n'),
            sessionName
        );
    }
}


// ============================================================
// COMMAND HANDLER
// ============================================================

async function handleCommand({
    chatId,
    text,
    sessionName = null
}) {

    if (!isCommandAllowed(chatId)) {
        return false;
    }

    if (!text.trim().startsWith('/')) {
        return false;
    }

    const parts =
        text.split(/\s+/);

    const command =
        parts[0]
            .toLowerCase();

    switch (command) {

        case '/help': {

            await sendText(
                chatId,
                helpMessage(),
                sessionName
            );

            return true;
        }


        case '/keluhan': {

            const rows =
                getOpenKeluhan();

            await sendText(
                chatId,
                formatKeluhanList(rows),
                sessionName
            );

            return true;
        }


        case '/detail': {

            const noLaporan =
                parts[1];

            if (!noLaporan) {

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

            const row =
                getDetailKeluhan(
                    noLaporan
                );

            await sendText(
                chatId,
                formatDetail(row),
                sessionName
            );

            return true;
        }


        case '/refresh': {

            await handleRefresh(
                chatId,
                sessionName
            );

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