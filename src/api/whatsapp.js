const express = require('express');

const {
    handleCommand
} = require('../bot/commands');


module.exports = ({
    db,
    session
}) => {

    const router =
        express.Router();


    router.post(
        '/webhook',
        async (req, res) => {

            /*
             * WAHA harus mendapatkan response
             * secepat mungkin.
             */

            res.status(200).json({
                status: true
            });


            try {

                const event =
                    req.body;


                console.log(
                    '📥 WAHA EVENT:',
                    event.event
                );


                // Kita hanya memproses pesan
                if (
                    event.event !== 'message'
                ) {
                    return;
                }


                const payload =
                    event.payload || {};


                const chatId =
                    payload.from ||
                    payload.chatId;


                const text =
                    payload.body ||
                    '';


                if (
                    !chatId ||
                    !text
                ) {
                    return;
                }


                console.log(
                    `💬 ${chatId}: ${text}`
                );


                // =========================
                // HANYA GROUP TERDAFTAR
                // =========================

                const group =
                    db.prepare(`
                        SELECT *
                        FROM whatsapp_groups
                        WHERE chat_id = ?
                          AND enabled = 1
                    `).get(chatId);


                if (!group) {

                    console.log(
                        `🚫 Group tidak terdaftar: ${chatId}`
                    );

                    return;
                }


                if (
                    !group.command_enabled
                ) {
                    return;
                }


                // =========================
                // HANYA COMMAND
                // =========================

                if (
                    !text.trim().startsWith('/')
                ) {
                    return;
                }


                await handleCommand({
                    db,
                    session,
                    chatId,
                    text
                });


            } catch (error) {

                console.error(
                    '❌ Webhook WAHA:',
                    error
                );
            }
        }
    );


    return router;
};