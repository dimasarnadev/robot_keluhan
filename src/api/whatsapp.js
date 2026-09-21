const express = require('express');

const {
    handleCommand
} = require('../bot/commands');

const {
    getActiveBot
} = require('../bot/whatsapp');

const router = express.Router();


// ============================================================
// WAHA WEBHOOK
// ============================================================

router.post(
    '/webhook',
    async (req, res) => {

        // WAHA harus mendapat response cepat
        res.status(200).json({
            status: true
        });

        try {

            const payload =
                req.body || {};

            console.log(
                '[WAHA] Webhook:',
                payload.event
            );

            // Kita hanya memproses event message
            if (
                payload.event !== 'message'
            ) {
                return;
            }

            const message =
                payload.payload;

            if (!message) {
                return;
            }

            // Jangan proses pesan yang dikirim bot sendiri
            if (
                message.fromMe === true
            ) {
                return;
            }

            const chatId =
                message.from ||
                message.chatId;

            const body =
                message.body ||
                message.text?.body ||
                '';

            if (!chatId || !body) {
                return;
            }

            const bot =
                getActiveBot();

            if (!bot) {

                console.warn(
                    '[WAHA] Bot belum terdaftar.'
                );

                return;
            }

            await handleCommand({
                chatId,
                message: body,
                sessionName:
                    bot.session_name
            });

        } catch (error) {

            console.error(
                '[WAHA] Webhook processing error:',
                error
            );
        }
    }
);


module.exports = router;