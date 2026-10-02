const axios = require('axios');

const env = require('../config/env');

const client = axios.create({
    baseURL: env.waha.url,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        ...(env.waha.apiKey ? { 'X-Api-Key': env.waha.apiKey } : {})
    }
});

/**
 * PENTING: file ini tidak pernah menebak atau menghitung sendiri nama
 * session WAHA. Semua fungsi di bawah menerima `sessionName` sebagai
 * parameter wajib. Yang menentukan nilainya adalah `bot/waha-session.js`
 * (lihat resolveSessionName), dipanggil sekali di titik masuk
 * (webhook atau job internal), bukan di sini.
 */

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Menghitung durasi typing berdasarkan panjang pesan dan kecepatan mengetik.
 *
 * Rumus: (jumlah karakter / karakter per detik) x 1000,
 * dibatasi antara typing.minMs dan typing.maxMs.
 * Ditambah randomisasi kecil (+-10%) agar durasi tidak selalu sama.
 */
function calculateTypingDelay(text) {
    const characterCount = String(text || '').length;

    const calculatedDelay =
        (characterCount / env.typing.charsPerSecond) * 1000;

    const delay = Math.max(
        env.typing.minMs,
        Math.min(calculatedDelay, env.typing.maxMs)
    );

    const randomFactor = 0.9 + Math.random() * 0.2;

    return Math.round(delay * randomFactor);
}

async function startTyping(chatId, sessionName) {
    return client.post('/api/startTyping', { session: sessionName, chatId });
}

async function stopTyping(chatId, sessionName) {
    return client.post('/api/stopTyping', { session: sessionName, chatId });
}

/**
 * Kirim teks dengan alur:
 * START TYPING -> DELAY -> STOP TYPING -> SEND TEXT
 *
 * @param {string} chatId
 * @param {string} text
 * @param {string} sessionName - wajib diisi, hasil dari resolveSessionName().
 */
async function sendText(chatId, text, sessionName) {
    if (!chatId) {
        throw new Error('chatId WhatsApp kosong.');
    }

    if (!text) {
        throw new Error('Pesan WhatsApp kosong.');
    }

    if (!sessionName) {
        throw new Error(
            'sessionName wajib diisi. Panggil resolveSessionName() ' +
                'sebelum memanggil sendText().'
        );
    }

    const typingDelay = calculateTypingDelay(text);

    console.log(`⌨️ WAHA typing → ${chatId} (${typingDelay} ms)`);

    await startTyping(chatId, sessionName);

    try {
        await sleep(typingDelay);
    } finally {
        // Tetap dilakukan walaupun terjadi error pada delay.
        try {
            await stopTyping(chatId, sessionName);
        } catch (error) {
            console.error('⚠️ Gagal stop typing:', error.message);
        }
    }

    console.log(`📤 WAHA sendText → ${chatId}`);

    const response = await client.post('/api/sendText', {
        session: sessionName,
        chatId,
        text
    });

    return response.data;
}

// Ambil informasi akun WAHA untuk satu session tertentu.
async function getMe(sessionName) {
    const response = await client.get(
        `/api/${encodeURIComponent(sessionName)}/me`
    );

    return response.data;
}

// Ambil daftar grup WhatsApp untuk satu session tertentu.
async function getGroups(sessionName) {
    const response = await client.get(
        `/api/${encodeURIComponent(sessionName)}/groups`
    );

    return response.data;
}

module.exports = {
    sendText,
    startTyping,
    stopTyping,
    getMe,
    getGroups
};