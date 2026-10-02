const { db } = require('../config/database');
const env = require('../config/env');

/**
 * Satu-satunya tempat yang berhak menentukan "session WAHA" mana yang
 * dipakai untuk mengirim atau membalas pesan.
 *
 * Tidak ada file lain (bot/whatsapp.js, bot/commands.js, bot/notifier.js,
 * api/whatsapp.js) yang boleh menghitung atau menebak nama session sendiri.
 * Semua memanggil resolveSessionName() di sini, sekali, lalu meneruskan
 * hasilnya sebagai nilai yang sudah pasti.
 *
 * Saat ini aplikasi hanya mendukung satu nomor WhatsApp aktif, yaitu baris
 * `whatsapp_bot` dengan enabled = 1. Kalau nanti perlu multi-nomor, cukup
 * ubah logika di file ini saja.
 */

function getActiveBot() {
    return db
        .prepare(
            `
            SELECT *
            FROM whatsapp_bot
            WHERE enabled = 1
            ORDER BY id
            LIMIT 1
        `
        )
        .get();
}

/**
 * Menentukan nama session WAHA yang dipakai untuk membalas pesan.
 *
 * @param {string|null} incomingSession - nama session yang dikirim WAHA
 *   pada body webhook (field `session` di level atas event). Isi ini
 *   kosong/null untuk aksi yang dipicu dari dalam aplikasi sendiri,
 *   misalnya job poller yang mengirim notifikasi tanpa event masuk.
 * @returns {string} nama session yang harus dipakai untuk mengirim balasan.
 */
function resolveSessionName(incomingSession = null) {
    const activeBot = getActiveBot();
    const activeSessionName = activeBot?.session_name || env.waha.session;

    if (incomingSession && incomingSession !== activeSessionName) {
        // Pesan masuk lewat session yang berbeda dari bot aktif di database.
        // Selama hanya ada satu nomor terdaftar, ini kemungkinan salah
        // konfigurasi dan layak diselidiki, bukan langsung diabaikan.
        console.warn(
            `⚠️ Event WAHA dari session "${incomingSession}" ` +
                `tapi bot aktif di database adalah "${activeSessionName}".`
        );
    }

    return activeSessionName;
}

module.exports = { resolveSessionName, getActiveBot };