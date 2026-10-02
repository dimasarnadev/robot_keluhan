const axios = require('axios');
const express = require('express');

const env = require('../config/env');
const { requireAuth, respondUpstreamError } = require('../middleware/auth');
const { ValidationError, requireInteger } = require('../utils/validate');

const QUERY_UP3 = `
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

const QUERY_ULP = `
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

async function requestMaster({ session, query, variables }) {
    const response = await axios.post(
        env.graphqlMasterUrl,
        { query, variables },
        {
            headers: {
                Authorization: `Bearer ${session.authToken}`
            },
            timeout: env.requestTimeout
        }
    );

    if (response.data?.errors) {
        const error = new Error('GraphQL error');

        error.graphqlErrors = response.data.errors;

        throw error;
    }

    return response.data;
}

module.exports = ({ db, session }) => {
    const router = express.Router();

    function handleError(res, error, label) {
        if (error instanceof ValidationError) {
            return res.status(400).json({
                status: false,
                message: error.message
            });
        }

        return respondUpstreamError(res, error, { db, session, label });
    }

    // ====================================================
    // MASTER UP3
    // ====================================================

    router.post('/up3', requireAuth(session), async (req, res) => {
        try {
            const idUid = requireInteger(req.body || {}, 'id_uid');

            const data = await requestMaster({
                session,
                query: QUERY_UP3,
                variables: { id_uid: idUid }
            });

            return res.json(data);
        } catch (error) {
            return handleError(res, error, 'MASTER UP3');
        }
    });

    // ====================================================
    // MASTER ULP
    // ====================================================

    router.post('/ulp', requireAuth(session), async (req, res) => {
        try {
            const idUp3 = requireInteger(req.body || {}, 'id_up3');

            const data = await requestMaster({
                session,
                query: QUERY_ULP,
                variables: { idUp3 }
            });

            return res.json(data);
        } catch (error) {
            return handleError(res, error, 'MASTER ULP');
        }
    });

    return router;
};
