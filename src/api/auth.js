const axios = require('axios');
const express = require('express');

const env = require('../config/env');
const { toPublicUser } = require('../config/session');

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
                `${env.authBaseUrl}/auth/captcha`,
                {
                    timeout: 10000
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
        const loggedIn =
            Boolean(session.authToken) && session.statusToken === 'Aktif';

        if (!loggedIn) {
            return res.status(401).json({
                status: false,
                loggedIn: false,
                statusToken: session.statusToken || 'Belum Login',
                user: null
            });
        }

        return res.json({
            status: true,
            loggedIn: true,
            statusToken: session.statusToken,
            user: toPublicUser(session.user)
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
                `${env.authBaseUrl}/auth`,
                payload,
                {
                    timeout: 10000
                }
            );

            if (response.data?.status && response.data.user?.authToken) {
                const { authToken, ...profile } = response.data.user;
                const publicUser = toPublicUser(profile);

                db.prepare(
                    `
                    INSERT INTO app_session (
                        id,
                        authToken,
                        statusToken,
                        user_json,
                        updated_at
                    )
                    VALUES (
                        1,
                        ?,
                        'Aktif',
                        ?,
                        ?
                    )

                    ON CONFLICT(id)
                    DO UPDATE SET
                        authToken = excluded.authToken,
                        statusToken = excluded.statusToken,
                        user_json = excluded.user_json,
                        updated_at = excluded.updated_at
                `
                ).run(
                    authToken,
                    JSON.stringify(publicUser),
                    new Date().toISOString()
                );

                session.authToken = authToken;
                session.statusToken = 'Aktif';
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
