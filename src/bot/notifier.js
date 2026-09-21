const {
    sendText
} = require('./whatsapp');

const {
    db
} = require('../config/database');


function formatDate(value) {

    if (!value) {
        return '-';
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return date.toLocaleString(
        'id-ID',
        {
            timeZone:
                'Asia/Jakarta',

            day: '2-digit',
            month: '2-digit',
            year: 'numeric',

            hour: '2-digit',
            minute: '2-digit'
        }
    );
}


/**
 * Format keluhan baru
 */
function formatNewKeluhan(
    keluhan
) {

    return [
        '🚨 KELUHAN BARU',
        '',
        `No Laporan : ${keluhan.no_laporan || '-'}`,
        `Pelanggan  : ${keluhan.nama_pelanggan || '-'}`,
        `No Meter   : ${keluhan.no_meter || '-'}`,
        `ULP        : ${keluhan.nama_ulp || '-'}`,
        '',
        'Permasalahan:',
        keluhan.permasalahan || '-',
        '',
        `Status     : ${keluhan.status || '-'}`,
        `Waktu Lapor: ${formatDate(keluhan.waktu_lapor)}`,
        '',
        'Mohon segera ditindaklanjuti.'
    ].join('\n');
}


/**
 * Format reminder
 */
function formatReminder(
    keluhan
) {

    return [
        '⚠️ REMINDER KELUHAN',
        '',
        `No Laporan : ${keluhan.no_laporan || '-'}`,
        `Pelanggan  : ${keluhan.nama_pelanggan || '-'}`,
        `ULP        : ${keluhan.nama_ulp || '-'}`,
        '',
        `Status     : ${keluhan.status || '-'}`,
        '',
        '⏱ Status belum berubah selama 15 menit.',
        '',
        'Mohon segera ditindaklanjuti.'
    ].join('\n');
}


/**
 * Ambil grup untuk notifikasi keluhan baru
 */
function getNewNotificationGroups() {

    return db
        .prepare(`
            SELECT *
            FROM whatsapp_groups
            WHERE enabled = 1
              AND notify_new = 1
            ORDER BY id
        `)
        .all();
}


/**
 * Ambil grup untuk reminder
 */
function getReminderGroups() {

    return db
        .prepare(`
            SELECT *
            FROM whatsapp_groups
            WHERE enabled = 1
              AND notify_reminder = 1
            ORDER BY id
        `)
        .all();
}


/**
 * Kirim keluhan baru ke semua grup
 */
async function notifyNewKeluhan(
    keluhan
) {

    const groups =
        getNewNotificationGroups();

    if (!groups.length) {

        console.log(
            'ℹ️ Tidak ada grup untuk notifikasi keluhan baru.'
        );

        return;
    }


    const text =
        formatNewKeluhan(
            keluhan
        );


    for (const group of groups) {

        try {

            await sendText(
                group.chat_id,
                text
            );


            db.prepare(`
                UPDATE keluhan_monitoring
                SET last_notified_new_at = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE no_laporan = ?
            `).run(
                new Date().toISOString(),
                keluhan.no_laporan
            );


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


/**
 * Kirim reminder
 */
async function notifyReminder(
    keluhan
) {

    const groups =
        getReminderGroups();

    if (!groups.length) {
        return;
    }


    const text =
        formatReminder(
            keluhan
        );


    for (const group of groups) {

        try {

            await sendText(
                group.chat_id,
                text
            );


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


    db.prepare(`
        UPDATE keluhan_monitoring
        SET last_reminder_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE no_laporan = ?
    `).run(
        new Date().toISOString(),
        keluhan.no_laporan
    );
}


module.exports = {
    notifyNewKeluhan,
    notifyReminder,
    formatNewKeluhan,
    formatReminder
};