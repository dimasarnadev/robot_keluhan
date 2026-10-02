const crypto = require('crypto');
const express = require('express');

const env = require('../config/env');
const { handleCommand } = require('../bot/commands');
const { sanitizeText } = require('../utils/format');

const MAX_TEXT_LENGTH = 500;

module.exports = () => {
    const router = express.Router();

    router.post('/webhook', async (req, res) => {
        // WAHA harus mendapatkan response secepat mungkin.
        res.status(200).json({ status: true });

        try {
            const event = req.body || {};

            console.log('📥 WAHA EVENT:', String(event.event).slice(0, 50));

            if (event.event !== 'message') {
                return;
            }

            const payload = event.payload || {};
            const chatId = payload.from || payload.chatId;
            const text = payload.body;

            // Nama session WAHA yang menerima pesan ini apa adanya. Resolusi
            // menjadi session yang dipakai untuk membalas terjadi di dalam
            // handleCommand -> resolveSessionName(), bukan di sini.
            const incomingSession =
                typeof event.session === 'string' ? event.session : null;

            if (
                payload.fromMe ||
                typeof chatId !== 'string' ||
                typeof text !== 'string' ||
                !text ||
                text.length > MAX_TEXT_LENGTH
            ) {
                return;
            }

            console.log(`💬 ${chatId}: ${sanitizeText(text, 100)}`);

            await handleCommand({ chatId, text, incomingSession });
        } catch (error) {
            console.error('❌ Webhook WAHA:', error.message);
        }
    });

    return router;
};