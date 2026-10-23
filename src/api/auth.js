require('dotenv').config();

const axios = require('axios');
const express = require('express');

const { parseSession } = require('../config/session');

const MAX_FIELD_LENGTH = 200;
const MAX_CAPTCHA_IMAGE_LENGTH = 200000;

function isSafeCaptchaImage(value) {
    return (
        typeof value === 'string' &&
        value.length <= MAX_CAPTCHA_IMAGE_LENGTH &&
        value.startsWith('data:image/')
    );
}

function isValidCredential(value) {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= MAX_FIELD_LENGTH
    );
}

module.exports = ({ db, session }) => {
    const router = express.Router();

    router.get('/captcha', async (req, res) => {
        try {
            const response = await axios.get(
                `${process.env.APKT_AUTH_URL}/auth/captcha`,
                {
                    timeout: 15000
                }
            );

            const image = response.data?.image;

            if (!isSafeCaptchaImage(image)) {
                return res.status(502).json({
                    status: false,
                    message: 'Respons captcha dari server APKT tidak valid.'
                });
            }

            session.captchaId = response.data.captchaId;

            return res.json({
                status: true,
                image
            });
        } catch (error) {
            return res.status(500).json({
                status: false,
                message: 'Gagal terhubung ke server APKT'
            });
        }
    });

    router.get('/status', (req, res) => {
        const loggedIn = Boolean(session.authToken);

        if (!loggedIn) {
            return res.status(401).json({
                status: false,
                loggedIn: false,
                user: null
            });
        }

        return res.json({
            status: true,
            loggedIn: true,
            user: parseSession(session.user)
        });
    });

    router.post('/login', async (req, res) => {
        const { username, password, captcha } = req.body || {};

        if (![username, password, captcha].every(isValidCredential)) {
            return res.status(400).json({
                status: false,
                message: 'username, password, dan captcha wajib berupa string.'
            });
        }

        try {
            const payload = {
                username,
                password,
                captcha,
                captchaId: session.captchaId
            };

            const response = await axios.post(
                `${process.env.APKT_AUTH_URL}/auth`,
                payload,
                {
                    timeout: 15000
                }
            );

            if (response.data?.status && response.data.user?.authToken) {
                const { authToken, ...profile } = response.data.user;
                const publicUser = parseSession(profile);

                db.prepare(
                    `
                    INSERT INTO user_sessions (
                        session_id,
                        auth_token,
                        user_id,
                        username,
                        email,
                        session_data,
                        is_active,
                        created_at
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

                    ON CONFLICT(session_id)
                    DO UPDATE SET
                        auth_token = excluded.auth_token,
                        user_id = excluded.user_id,
                        username = excluded.username,
                        email = excluded.email,
                        session_data = excluded.session_data,
                        created_at = excluded.created_at
                `
                ).run(
                    authToken,
                    publicUser.userId,
                    publicUser.username,
                    publicUser.email,
                    JSON.stringify(publicUser),
                    new Date().toISOString()
                );

                session.authToken = authToken;
                session.user = publicUser;

                return res.json({
                    status: true,
                    message: 'Login sukses & sesi disimpan',
                    user: publicUser
                });
            }

            return res.json({
                status: false,
                message: response.data?.message || 'Gagal login'
            });
        } catch (error) {
            console.error('[LOGIN] ❌', error.message);

            return res.status(500).json({
                status: false,
                message: 'Error Server saat memproses login'
            });
        }
    });

    return router;
};
