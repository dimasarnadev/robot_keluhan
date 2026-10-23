require('dotenv').config();

const axios = require('axios');

const client = axios.create({
    baseURL: process.env.WAHA_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        ...(process.env.WAHA_API_KEY
            ? { 'X-Api-Key': process.env.WAHA_API_KEY }
            : {})
    }
});

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateTypingDelay(text) {
    const characterCount = String(text || '').length;

    const calculatedDelay =
        (characterCount / process.env.TYPING_DELAY_CHARS_PER_SECOND) * 1000;

    const delay = Math.max(
        process.env.TYPING_DELAY_MIN_MS,
        Math.min(calculatedDelay, process.env.TYPING_DELAY_MAX_MS)
    );

    return Math.round(delay);
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
 * @param {string} sessionName
 */
async function sendText(chatId, text, sessionName) {
    if (!chatId) {
        throw new Error('chatId WhatsApp kosong.');
    }

    if (!text) {
        throw new Error('Pesan WhatsApp kosong.');
    }

    if (!sessionName) {
        throw new Error('sessionName wajib diisi.');
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
