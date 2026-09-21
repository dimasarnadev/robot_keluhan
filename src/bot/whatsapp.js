const axios = require('axios');

const { db } =
    require('../config/database');


const WAHA_URL =
    process.env.WAHA_URL ||
    'http://localhost:3000';

const WAHA_API_KEY =
    process.env.WAHA_API_KEY || '';


const client =
    axios.create({
        baseURL: WAHA_URL,

        timeout: 30000,

        headers: {
            'Content-Type':
                'application/json',

            ...(WAHA_API_KEY
                ? {
                    'X-Api-Key':
                        WAHA_API_KEY
                }
                : {})
        }
    });


function getActiveBot() {

    return db
        .prepare(`
            SELECT *
            FROM whatsapp_bot
            WHERE enabled = 1
            ORDER BY id
            LIMIT 1
        `)
        .get();
}


/**
 * Ambil session WAHA aktif
 */
function getSessionName(
    sessionName = null
) {

    const bot =
        getActiveBot();

    return (
        sessionName ||
        bot?.session_name ||
        process.env.WAHA_SESSION ||
        'default'
    );
}


/**
 * Delay
 */
function sleep(ms) {

    return new Promise(
        resolve => setTimeout(
            resolve,
            ms
        )
    );
}


const TYPING_DELAY_MIN_MS =
    Number(
        process.env.TYPING_DELAY_MIN_MS
    ) || 3000;

const TYPING_DELAY_MAX_MS =
    Number(
        process.env.TYPING_DELAY_MAX_MS
    ) || 20000;

const TYPING_DELAY_CHARS_PER_SECOND =
    Number(
        process.env.TYPING_DELAY_CHARS_PER_SECOND
    ) || 6;


/**
 * Menghitung durasi typing berdasarkan
 * panjang pesan dan kecepatan mengetik.
 *
 * Rumus:
 *
 * jumlah karakter
 * ---------------- × 1000
 * karakter/detik
 *
 * Hasil kemudian dibatasi antara
 * TYPING_DELAY_MIN_MS dan
 * TYPING_DELAY_MAX_MS.
 */
function calculateTypingDelay(text) {

    const characterCount =
        String(text || '').length;


    const calculatedDelay =
        (
            characterCount /
            TYPING_DELAY_CHARS_PER_SECOND
        ) * 1000;


    const delay =
        Math.max(
            TYPING_DELAY_MIN_MS,
            Math.min(
                calculatedDelay,
                TYPING_DELAY_MAX_MS
            )
        );


    /*
     * Randomisasi kecil agar tidak selalu
     * memiliki durasi yang persis sama.
     *
     * ±10%
     */
    const randomFactor =
        0.9 +
        Math.random() * 0.2;


    return Math.round(
        delay * randomFactor
    );
}


/**
 * START TYPING
 */
async function startTyping(
    chatId,
    sessionName = null
) {

    const session =
        getSessionName(
            sessionName
        );


    return client.post(
        '/api/startTyping',
        {
            session,
            chatId
        }
    );
}


/**
 * STOP TYPING
 */
async function stopTyping(
    chatId,
    sessionName = null
) {

    const session =
        getSessionName(
            sessionName
        );


    return client.post(
        '/api/stopTyping',
        {
            session,
            chatId
        }
    );
}


/**
 * SEND TEXT DENGAN PROSES:
 *
 * START TYPING
 *      ↓
 * RANDOM DELAY
 *      ↓
 * STOP TYPING
 *      ↓
 * SEND TEXT
 */
async function sendText(
    chatId,
    text,
    sessionName = null
) {

    if (!chatId) {
        throw new Error(
            'chatId WhatsApp kosong.'
        );
    }


    if (!text) {
        throw new Error(
            'Pesan WhatsApp kosong.'
        );
    }


    const session =
        getSessionName(
            sessionName
        );


    const typingDelay =
        calculateTypingDelay(
            text
        );


    console.log(
        `⌨️ WAHA typing → ${chatId} (${typingDelay} ms)`
    );


    /*
     * 1. START TYPING
     */
    await startTyping(
        chatId,
        session
    );


    try {

        /*
         * 2. RANDOM DELAY
         */
        await sleep(
            typingDelay
        );

    } finally {

        /*
         * 3. STOP TYPING
         *
         * Tetap dilakukan walaupun
         * terjadi error pada delay.
         */
        try {

            await stopTyping(
                chatId,
                session

            );

        } catch (error) {

            console.error(
                '⚠️ Gagal stop typing:',
                error.message
            );
        }
    }


    /*
     * 4. SEND TEXT
     */
    console.log(
        `📤 WAHA sendText → ${chatId}`
    );


    const response =
        await client.post(
            '/api/sendText',
            {
                session,
                chatId,
                text
            }
        );


    return response.data;
}


/**
 * Ambil informasi akun WAHA
 */
async function getMe(
    sessionName = null
) {

    const session =
        getSessionName(
            sessionName
        );


    const response =
        await client.get(
            `/api/${encodeURIComponent(session)}/me`
        );


    return response.data;
}


/**
 * Ambil daftar grup WhatsApp
 */
async function getGroups(
    sessionName = null
) {

    const session =
        getSessionName(
            sessionName
        );


    const response =
        await client.get(
            `/api/${encodeURIComponent(session)}/groups`
        );


    return response.data;
}


module.exports = {
    sendText,
    startTyping,
    stopTyping,
    getMe,
    getGroups,
    getActiveBot
};