const express = require('express');
const axios = require('axios');

const AUTH_BASE =
    process.env.AUTH_BASE_URL;


module.exports = ({
    db,
    session
}) => {

    const router = express.Router();

    router.get('/captcha', async (req, res) => {

        try {

            const response =
                await axios.get(
                    `${AUTH_BASE}/auth/captcha`,
                    {
                        timeout: 10000
                    }
                );

            session.captchaId =
                response.data.captchaId;

            res.json(response.data);

        } catch (error) {

            res.status(500).json({
                status: false,
                message:
                    'Gagal terhubung ke server APKT'
            });
        }
    });


    router.get('/status', (req, res) => {

        const loggedIn =
            Boolean(session.authToken) &&
            session.statusToken === 'Aktif';

        if (!loggedIn) {

            return res.status(401).json({
                status: false,
                loggedIn: false,
                statusToken:
                    session.statusToken ||
                    'Belum Login',
                user: null
            });
        }

        return res.json({
            status: true,
            loggedIn: true,
            statusToken:
                session.statusToken,
            user: session.user
        });
    });


    router.post('/login', async (req, res) => {

        try {

            const payload = {
                username:
                    req.body.username,

                password:
                    req.body.password,

                captcha:
                    req.body.captcha,

                captchaId:
                    session.captchaId
            };

            const response =
                await axios.post(
                    `${AUTH_BASE}/auth`,
                    payload,
                    {
                        timeout: 10000
                    }
                );

            if (
                response.data.status &&
                response.data.user?.authToken
            ) {

                const freshUser =
                    response.data.user;

                const freshToken =
                    freshUser.authToken;

                db.prepare(`
                    INSERT INTO app_session
                    (
                        id,
                        authToken,
                        statusToken,
                        user_json,
                        updated_at
                    )
                    VALUES
                    (
                        1,
                        ?,
                        'Aktif',
                        ?,
                        ?
                    )

                    ON CONFLICT(id)
                    DO UPDATE SET

                        authToken =
                            excluded.authToken,

                        statusToken =
                            excluded.statusToken,

                        user_json =
                            excluded.user_json,

                        updated_at =
                            excluded.updated_at
                `).run(
                    freshToken,
                    JSON.stringify(freshUser),
                    new Date().toISOString()
                );

                session.authToken =
                    freshToken;

                session.statusToken =
                    'Aktif';

                session.user =
                    freshUser;

                return res.json({
                    status: true,
                    message:
                        'Login sukses & sesi disimpan',
                    user: freshUser
                });
            }

            return res.json({
                status: false,
                message:
                    response.data.message ||
                    'Gagal login'
            });

        } catch (error) {

            return res.status(500).json({
                status: false,
                message:
                    'Error Server saat memproses login'
            });
        }
    });


    return router;
};