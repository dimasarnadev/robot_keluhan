const express = require('express');
const axios = require('axios');

const GRAPHQL_MASTER_URL =
    process.env.GRAPHQL_MASTER_URL;


module.exports = ({
    db,
    session
}) => {

    const router = express.Router();


    // ====================================================
    // MASTER UP3
    // ====================================================

    router.post('/up3', async (req, res) => {

        if (
            !session.authToken ||
            session.statusToken !== 'Aktif'
        ) {

            return res.status(401).json({
                status: false,
                message:
                    'Belum login / Token Expired.'
            });
        }

        const body = req.body || {};

        if (
            body.id_uid === undefined ||
            body.id_uid === null ||
            body.id_uid === ''
        ) {

            return res.status(400).json({
                status: false,
                message:
                    'Parameter id_uid wajib dikirim.'
            });
        }

        const idUid =
            Number(body.id_uid);

        if (!Number.isInteger(idUid)) {

            return res.status(400).json({
                status: false,
                message:
                    'id_uid harus berupa integer.'
            });
        }

        const queryUp3 = `
            query getUp3ByUid(
                $id_uid: BigInteger
            ) {

                getUp3ByUid(
                    id_uid: $id_uid
                ) {

                    status
                    message

                    data {
                        id
                        id_uid
                        nama
                        kode
                        alamat
                        location
                        created_date
                        created_by
                        updated_date
                        updated_by
                        telepon
                        aktif
                        geomPoint
                        city
                        zip
                        fax
                        email
                    }
                }
            }
        `
            .replace(/\s+/g, ' ')
            .trim();


        try {

            const response =
                await axios.post(
                    GRAPHQL_MASTER_URL,
                    {
                        query: queryUp3,

                        variables: {
                            id_uid: idUid
                        }
                    },
                    {
                        headers: {
                            Authorization:
                                `Bearer ${session.authToken}`
                        },

                        timeout: 15000
                    }
                );


            if (response.data?.errors) {

                return res.status(400).json({
                    status: false,
                    errors:
                        response.data.errors
                });
            }


            return res.json(
                response.data
            );

        } catch (error) {

            if (
                error.response?.status === 401
            ) {

                db.prepare(`
                    UPDATE app_session
                    SET statusToken = 'Expired'
                    WHERE id = 1
                `).run();

                session.statusToken =
                    'Expired';

                return res.status(401).json({
                    status: false,
                    message:
                        'Token expired'
                });
            }


            return res.status(500).json({
                status: false,
                message:
                    'Gagal mengambil data UP3 dari server APKT.',
                error:
                    error.message
            });
        }
    });


    // ====================================================
    // MASTER ULP
    // ====================================================

    router.post('/ulp', async (req, res) => {

        if (
            !session.authToken ||
            session.statusToken !== 'Aktif'
        ) {

            return res.status(401).json({
                status: false,
                message:
                    'Belum login / Token Expired.'
            });
        }

        const body = req.body || {};

        if (
            body.id_up3 === undefined ||
            body.id_up3 === null ||
            body.id_up3 === ''
        ) {

            return res.status(400).json({
                status: false,
                message:
                    'Parameter id_up3 wajib dikirim.'
            });
        }

        const idUp3 =
            Number(body.id_up3);

        if (!Number.isInteger(idUp3)) {

            return res.status(400).json({
                status: false,
                message:
                    'id_up3 harus berupa integer.'
            });
        }


        const queryUlp = `
            query getUlpByUp3(
                $idUp3: BigInteger
            ) {

                getUlpByUp3(
                    idUp3: $idUp3
                ) {

                    id
                    id_up3
                    nama
                    kode
                    alamat
                    created_date
                    created_by
                    updated_date
                    updated_by
                    telepon
                    aktif
                    city
                    zip
                    mobile
                    fax
                    email
                    unit_ap2t

                    master_up3 {
                        nama
                    }
                }
            }
        `
            .replace(/\s+/g, ' ')
            .trim();


        try {

            const response =
                await axios.post(
                    GRAPHQL_MASTER_URL,
                    {
                        query: queryUlp,

                        variables: {
                            idUp3
                        }
                    },
                    {
                        headers: {
                            Authorization:
                                `Bearer ${session.authToken}`
                        },

                        timeout: 15000
                    }
                );


            if (response.data?.errors) {

                return res.status(400).json({
                    status: false,
                    errors:
                        response.data.errors
                });
            }


            return res.json(
                response.data
            );

        } catch (error) {

            if (
                error.response?.status === 401
            ) {

                db.prepare(`
                    UPDATE app_session
                    SET statusToken = 'Expired'
                    WHERE id = 1
                `).run();

                session.statusToken =
                    'Expired';

                return res.status(401).json({
                    status: false,
                    message:
                        'Token expired'
                });
            }


            return res.status(500).json({
                status: false,
                message:
                    'Gagal mengambil data ULP dari server APKT.',
                error:
                    error.message
            });
        }
    });


    return router;
};