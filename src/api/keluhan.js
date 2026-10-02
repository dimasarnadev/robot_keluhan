const express = require('express');

const { requireAuth, respondUpstreamError } = require('../middleware/auth');
const { fetchKeluhanRaw } = require('../services/apkt');
const {
    ValidationError,
    requireInteger,
    requireDate,
    optionalString
} = require('../utils/validate');

// [field GraphQL, field pada body request]
const OPTIONAL_FILTERS = [
    ['status_akhir', 'status'],
    ['no_laporan', 'no_laporan'],
    ['nama_pelapor', 'nama_pelapor'],
    ['pelanggan_no_meter.id_pelanggan', 'id_pelanggan'],
    ['pelanggan_no_meter.no_meter', 'no_meter']
];

function parseRequest(input) {
    const body =
        input && typeof input === 'object' && !Array.isArray(input)
            ? input
            : {};

    const params = {
        idUid: requireInteger(body, 'id_uid'),
        userId: requireInteger(body, 'user_id'),
        idUp3: requireInteger(body, 'id_up3'),
        idUlp: requireInteger(body, 'id_ulp'),
        tanggalMulai: requireDate(body, 'tanggal_mulai'),
        tanggalSelesai: requireDate(body, 'tanggal_selesai'),
        limit: requireInteger(body, 'limit', { min: 1, max: 500 }),
        skip: requireInteger(body, 'skip', { min: 0, max: 1000000 })
    };

    // Format YYYY-MM-DD sudah tervalidasi, sehingga aman dibandingkan sebagai string.
    if (params.tanggalMulai > params.tanggalSelesai) {
        throw new ValidationError(
            'tanggal_mulai tidak boleh lebih besar dari tanggal_selesai.'
        );
    }

    params.filters = [
        { field: 'master_ulp.master_up3.id', value: [params.idUp3] },
        { field: 'master_ulp.id', value: [params.idUlp] }
    ];

    for (const [field, key] of OPTIONAL_FILTERS) {
        const value = optionalString(body, key);

        if (value) {
            params.filters.push({ field, value: [value] });
        }
    }

    return params;
}

module.exports = ({ db, session }) => {
    const router = express.Router();

    router.post('/keluhan', requireAuth(session), async (req, res) => {
        let params;

        try {
            params = parseRequest(req.body);
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).json({
                    status: false,
                    message: error.message
                });
            }

            return respondUpstreamError(res, error, {
                db,
                session,
                label: 'KELUHAN'
            });
        }

        try {
            const result = await fetchKeluhanRaw({
                token: session.authToken,
                ...params
            });

            return res.json({
                status: true,
                total_data: result.totalCount,
                total_halaman: result.totalPage,
                data_keluhan: result.data
            });
        } catch (error) {
            return respondUpstreamError(res, error, {
                db,
                session,
                label: 'KELUHAN'
            });
        }
    });

    return router;
};
