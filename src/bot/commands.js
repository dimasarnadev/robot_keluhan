const {
    sendText
} = require('./whatsapp');

const {
    pollKeluhan
} = require('../jobs/keluhan-poller');


async function handleCommand({
    db,
    session,
    chatId,
    text
}) {

    const parts =
        text
            .trim()
            .split(/\s+/);

    const command =
        parts[0].toLowerCase();


    // ==============================
    // HELP
    // ==============================

    if (command === '/help') {

        await sendText(
            chatId,
            [
                '🤖 *BOT MONITORING KELUHAN*',
                '',
                '/status',
                'Ringkasan keluhan berjalan',
                '',
                '/keluhan',
                'Daftar keluhan berjalan',
                '',
                '/detail <no_laporan>',
                'Detail keluhan',
                '',
                '/refresh',
                'Refresh data APKT',
                '',
                '/help',
                'Daftar command'
            ].join('\n')
        );

        return;
    }


    // ==============================
    // STATUS
    // ==============================

    if (
        command === '/status' ||
        command === '/keluhan'
    ) {

        const rows =
            db.prepare(`
                SELECT
                    no_laporan,
                    nama_pelapor,
                    status,
                    id_up3,
                    id_ulp,
                    status_changed_at
                FROM keluhan_monitoring
                ORDER BY status_changed_at DESC
            `).all();


        if (!rows.length) {

            await sendText(
                chatId,
                '✅ Tidak ada keluhan yang sedang dimonitor.'
            );

            return;
        }


        let message =
            `📊 *MONITORING KELUHAN*\n\n` +
            `Total: ${rows.length}\n\n`;


        rows.forEach(
            (row, index) => {

                message +=
                    `${index + 1}. *${row.no_laporan}*\n` +
                    `   👤 ${row.nama_pelapor || '-'}\n` +
                    `   📍 ULP: ${row.id_ulp || '-'}\n` +
                    `   📊 ${row.status || '-'}\n\n`;
            }
        );


        await sendText(
            chatId,
            message
        );

        return;
    }


    // ==============================
    // DETAIL
    // ==============================

    if (command === '/detail') {

        const noLaporan =
            parts[1];


        if (!noLaporan) {

            await sendText(
                chatId,
                'Gunakan:\n/detail K1626090800017'
            );

            return;
        }


        const row =
            db.prepare(`
                SELECT *
                FROM keluhan_monitoring
                WHERE no_laporan = ?
            `).get(noLaporan);


        if (!row) {

            await sendText(
                chatId,
                `❌ ${noLaporan} tidak ditemukan.`
            );

            return;
        }


        await sendText(
            chatId,
            [
                '📋 *DETAIL KELUHAN*',
                '',
                `📌 No. Laporan : ${row.no_laporan}`,
                `👤 Pelapor     : ${row.nama_pelapor || '-'}`,
                `👥 Pelanggan   : ${row.id_pelanggan || '-'}`,
                `⚡ No. Meter   : ${row.no_meter || '-'}`,
                `📍 UP3         : ${row.id_up3 || '-'}`,
                `📍 ULP         : ${row.id_ulp || '-'}`,
                `📊 Status      : ${row.status || '-'}`,
                `🕐 Status sejak: ${row.status_changed_at || '-'}`
            ].join('\n')
        );

        return;
    }


    // ==============================
    // REFRESH
    // ==============================

    if (command === '/refresh') {

        await sendText(
            chatId,
            '🔄 Mengambil data terbaru dari APKT...'
        );


        await pollKeluhan({
            db,
            session
        });


        await sendText(
            chatId,
            '✅ Refresh data APKT selesai.'
        );

        return;
    }


    // ==============================
    // UNKNOWN COMMAND
    // ==============================

    await sendText(
        chatId,
        [
            '❓ Command tidak dikenal.',
            '',
            'Gunakan /help untuk melihat daftar command.'
        ].join('\n')
    );
}


module.exports = {
    handleCommand
};