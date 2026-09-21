const {
    session,
    getSessionUser
} = require('../config/session');

const {
    getKeluhan,
    FINAL_STATUSES
} = require('../services/apkt');

const {
    db
} = require('../config/database');

const {
    notifyNewKeluhan,
    notifyReminder
} = require('../bot/notifier');


const POLL_INTERVAL =
    Number(
        process.env.KELUHAN_POLL_INTERVAL_MS
    ) || 60000;


const REMINDER_INTERVAL =
    Number(
        process.env.KELUHAN_REMINDER_INTERVAL_MS
    ) || 900000;


const POLL_LIMIT =
    Number(
        process.env.KELUHAN_POLL_LIMIT
    ) || 20;


let running = false;
let timer = null;


/**
 * Format YYYY-MM-DD
 */
function formatDate(date) {

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, '0');

    const day =
        String(
            date.getDate()
        ).padStart(2, '0');

    return `${year}-${month}-${day}`;
}


/**
 * Ambil konfigurasi monitoring
 */
function getMonitorConfig() {

    return db
        .prepare(`
            SELECT *
            FROM whatsapp_monitor_config
            WHERE id = 1
        `)
        .get();
}


/**
 * Simpan konfigurasi monitoring
 */
function saveMonitorConfig(
    user
) {

    const existing =
        getMonitorConfig();


    if (!existing) {

        db.prepare(`
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
            VALUES (
                1,
                ?,
                ?,
                ?,
                ?,
                ?,
                1,
                ?
            )
        `).run(
            user.idUid,
            user.userId,
            user.idUp3,
            user.idUlp,

            Number(
                process.env.KELUHAN_RANGE_DAYS
            ) || 2,

            new Date().toISOString()
        );

        return;
    }


    db.prepare(`
        UPDATE whatsapp_monitor_config

        SET id_uid = ?,
            user_id = ?,
            id_up3 = ?,
            id_ulp = ?,
            updated_at = ?

        WHERE id = 1
    `).run(
        user.idUid,
        user.userId,
        user.idUp3,
        user.idUlp,

        new Date().toISOString()
    );
}


/**
 * Simpan keluhan baru
 */
function insertKeluhan(
    keluhan,
    user,
    now
) {

    db.prepare(`
        INSERT INTO keluhan_monitoring (

            no_laporan,

            id_uid,
            user_id,
            id_up3,
            id_ulp,

            tanggal_mulai,
            tanggal_selesai,

            nama_pelapor,
            id_pelanggan,
            no_meter,

            status,
            status_terakhir,

            status_changed_at,

            first_seen_at,
            last_seen_at,

            raw_data,

            created_at,
            updated_at
        )

        VALUES (

            ?,
            ?,
            ?,
            ?,
            ?,

            ?,
            ?,

            ?,
            ?,
            ?,

            ?,
            ?,

            ?,

            ?,
            ?,

            ?,

            ?,
            ?
        )
    `).run(

        keluhan.no_laporan,

        user.idUid,
        user.userId,
        user.idUp3,
        user.idUlp,

        null,
        null,

        keluhan.nama_pelapor,
        keluhan.id_pelanggan,
        keluhan.no_meter,

        keluhan.status,
        keluhan.status,

        now,

        now,
        now,

        JSON.stringify(keluhan),

        now,
        now
    );
}


/**
 * Update keluhan yang sudah ada
 */
function updateExistingKeluhan(
    existing,
    keluhan,
    now
) {

    const oldStatus =
        existing.status_terakhir;

    const newStatus =
        keluhan.status;


    /*
     * Status berubah
     */
    if (
        oldStatus !== newStatus
    ) {

        db.prepare(`
            UPDATE keluhan_monitoring

            SET status = ?,
                status_terakhir = ?,

                status_changed_at = ?,

                last_seen_at = ?,
                last_reminder_at = NULL,

                raw_data = ?,

                updated_at = ?

            WHERE no_laporan = ?
        `).run(

            newStatus,
            newStatus,

            now,
            now,

            JSON.stringify(keluhan),

            now,

            keluhan.no_laporan
        );


        console.log(
            `🔄 Status berubah ${keluhan.no_laporan}: ${oldStatus} → ${newStatus}`
        );

        return {
            changed: true
        };
    }


    /*
     * Status tidak berubah
     */
    db.prepare(`
        UPDATE keluhan_monitoring

        SET status = ?,
            last_seen_at = ?,
            raw_data = ?,
            updated_at = ?

        WHERE no_laporan = ?
    `).run(

        newStatus,
        now,

        JSON.stringify(keluhan),

        now,

        keluhan.no_laporan
    );


    return {
        changed: false
    };
}


/**
 * Cek apakah sudah waktunya reminder
 */
function shouldReminder(
    row,
    now
) {

    /*
     * Batal / Selesai
     * tidak perlu reminder.
     */
    if (
        FINAL_STATUSES.includes(
            row.status_terakhir
        )
    ) {
        return false;
    }


    if (!row.status_changed_at) {
        return false;
    }


    const changedAt =
        new Date(
            row.status_changed_at
        ).getTime();


    const currentTime =
        new Date(now).getTime();


    const elapsed =
        currentTime - changedAt;


    /*
     * Belum 15 menit
     */
    if (
        elapsed <
        REMINDER_INTERVAL
    ) {
        return false;
    }


    /*
     * Belum pernah reminder
     */
    if (!row.last_reminder_at) {
        return true;
    }


    const lastReminder =
        new Date(
            row.last_reminder_at
        ).getTime();


    return (
        currentTime -
        lastReminder >=
        REMINDER_INTERVAL
    );
}


/**
 * Proses satu siklus monitoring
 */
async function pollKeluhan(options = {}) {

    const {
        notifyNew = true,
        notifyReminder = true
    } = options;

    if (running) {

        console.log(
            '⏳ Poller masih berjalan, skip.'
        );

        return;
    }


    running = true;


    try {

        if (!session.authToken) {

            console.log(
                '⚠️ Poller: token APKT belum tersedia.'
            );

            return;
        }


        const user =
            getSessionUser();


        if (!user) {

            console.log(
                '⚠️ Poller: user APKT belum tersedia.'
            );

            return;
        }


        /*
         * Sinkronisasi konfigurasi
         * dengan user session APKT.
         */
        saveMonitorConfig(
            user
        );


        const config =
            getMonitorConfig();


        if (
            !config ||
            !config.enabled
        ) {

            console.log(
                'ℹ️ Monitoring WhatsApp dinonaktifkan.'
            );

            return;
        }


        const rangeDays =
            Number(
                config.tanggal_range_hari
            ) || 7;


        const today =
            new Date();


        const start =
            new Date();


        start.setDate(
            start.getDate() -
            rangeDays
        );


        const tanggalMulai =
            formatDate(start);


        const tanggalSelesai =
            formatDate(today);


        console.log(
            `🔎 Polling APKT ${tanggalMulai} s/d ${tanggalSelesai}`
        );


        const result =
            await getKeluhan({

                token:
                    session.authToken,

                idUid:
                    user.idUid,

                userId:
                    user.userId,

                idUlp:
                    user.idUlp,

                tanggalMulai,
                tanggalSelesai,

                limit:
                    POLL_LIMIT,

                skip:
                    0
            });


        console.log(
            `📊 APKT: ${result.data.length} keluhan diterima.`
        );


        const now =
            new Date().toISOString();


        for (
            const keluhan
            of result.data
        ) {

            if (
                !keluhan.no_laporan
            ) {
                continue;
            }


            const existing =
                db.prepare(`
                    SELECT *
                    FROM keluhan_monitoring
                    WHERE no_laporan = ?
                `).get(
                    keluhan.no_laporan
                );


            /*
             * =========================
             * KELUHAN BARU
             * =========================
             */
            if (!existing) {

                insertKeluhan(
                    keluhan,
                    user,
                    now
                );


                console.log(
                    `🆕 Keluhan baru: ${keluhan.no_laporan}`
                );


                try {

                    if (notifyNew) {
                        await notifyNewKeluhan(keluhan);
                    }

                } catch (error) {

                    console.error(
                        '❌ Notifikasi keluhan baru:',
                        error.message
                    );
                }


                continue;
            }


            /*
             * =========================
             * KELUHAN LAMA
             * =========================
             */

            updateExistingKeluhan(
                existing,
                keluhan,
                now
            );


            /*
             * Ambil data terbaru
             */
            const current =
                db.prepare(`
                    SELECT *
                    FROM keluhan_monitoring
                    WHERE no_laporan = ?
                `).get(
                    keluhan.no_laporan
                );


            /*
             * =========================
             * REMINDER
             * =========================
             */

            if (
                shouldReminder(
                    current,
                    now
                )
            ) {

                try {

                    if (notifyReminder) {
                        await notifyReminder(
                            {
                                ...keluhan,

                                status:
                                    current.status_terakhir
                            }
                        );
                    }

                } catch (error) {

                    console.error(
                        '❌ Notifikasi reminder:',
                        error.message
                    );
                }
            }
        }


        console.log(
            '✅ Polling keluhan selesai.'
        );

    } catch (error) {

        console.error(
            '❌ Poller APKT:',
            error.message
        );

    } finally {

        running = false;
    }
}


/**
 * Start poller
 */
function startKeluhanPoller() {

    if (timer) {

        console.log(
            '⚠️ Poller sudah berjalan.'
        );

        return;
    }


    console.log(
        `🚀 Keluhan Poller aktif setiap ${
            POLL_INTERVAL / 1000
        } detik.`
    );


    /*
     * Jalankan pertama kali
     */
    pollKeluhan();


    /*
     * Kemudian interval
     */
    timer =
        setInterval(
            pollKeluhan,
            POLL_INTERVAL
        );
}


/**
 * Stop poller
 */
function stopKeluhanPoller() {

    if (timer) {

        clearInterval(
            timer
        );

        timer = null;

        console.log(
            '🛑 Keluhan Poller dihentikan.'
        );
    }
}


module.exports = {
    startKeluhanPoller,
    stopKeluhanPoller,
    pollKeluhan
};