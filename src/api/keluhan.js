const express = require('express');
const axios = require('axios');

const router = express.Router();

const GRAPHQL_KELUHAN_URL =
    process.env.GRAPHQL_KELUHAN_URL;

const REQUEST_TIMEOUT = 15000;


// ============================================================
// GRAPHQL QUERY
// ============================================================

const QUERY_KELUHAN = `
    query getMonitoringKeluhanAll(
        $search: SearchWithDateArrayInput,
        $userId: BigInteger,
        $idUid: BigInteger,
        $idUlp: BigInteger
    ) {
        getMonitoringKeluhanAll(
            search: $search,
            userId: $userId,
            idUid: $idUid,
            idUlp: $idUlp
        ) {
            totalCount
            totalPage
            status
            message

            data {
                id
                no_laporan
                nama_pelapor
                permasalahan
                waktu_lapor
                status_akhir
                alamat_pelanggan

                pelanggan_no_meter {
                    no_meter
                    nama
                    id_pelanggan
                }

                master_ulp {
                    id
                    nama

                    master_up3 {
                        id
                        nama
                    }
                }
            }
        }
    }
`
    .replace(/\s+/g, ' ')
    .trim();


// ============================================================
// HELPER - CHECK LOGIN
// ============================================================

function isAuthenticated(session) {
    return (
        session &&
        session.authToken &&
        session.statusToken === 'Aktif'
    );
}


// ============================================================
// HELPER - VALIDATION
// ============================================================

function validateRequiredFields(body) {

    const requiredFields = [
        'id_uid',
        'user_id',
        'id_up3',
        'id_ulp',
        'tanggal_mulai',
        'tanggal_selesai',
        'limit',
        'skip'
    ];

    return requiredFields.filter((field) => {

        const value = body[field];

        return (
            value === undefined ||
            value === null ||
            value === ''
        );

    });
}


function parseInteger(value) {

    const number = Number(value);

    return Number.isInteger(number)
        ? number
        : null;
}


function validateIntegerFields(body) {

    const integerFields = [
        'id_uid',
        'user_id',
        'id_up3',
        'id_ulp',
        'limit',
        'skip'
    ];

    for (const field of integerFields) {

        const value = parseInteger(body[field]);

        if (value === null) {

            return {
                field,
                message:
                    `${field} harus berupa integer.`
            };

        }
    }

    return null;
}


function validatePagination(limit, skip) {

    if (limit < 1) {

        return {
            field: 'limit',
            message:
                'limit minimal adalah 1.'
        };

    }

    if (limit > 500) {

        return {
            field: 'limit',
            message:
                'limit maksimal adalah 500.'
        };

    }

    if (skip < 0) {

        return {
            field: 'skip',
            message:
                'skip tidak boleh kurang dari 0.'
        };

    }

    return null;
}


function validateDateRange(tanggalMulai, tanggalSelesai) {

    const start = new Date(tanggalMulai);
    const end = new Date(tanggalSelesai);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
    ) {

        return {
            message:
                'Format tanggal_mulai atau tanggal_selesai tidak valid.'
        };

    }

    if (start > end) {

        return {
            message:
                'tanggal_mulai tidak boleh lebih besar dari tanggal_selesai.'
        };

    }

    return null;
}


// ============================================================
// HELPER - GRAPHQL FILTER
// ============================================================

function addFilter(filters, field, value) {

    if (
        value !== undefined &&
        value !== null &&
        value !== ''
    ) {

        filters.push({
            field,
            value: [String(value)]
        });

    }
}


function buildGraphQLFilters(body, idUp3, idUlp) {

    const filters = [

        {
            field:
                'master_ulp.master_up3.id',

            value: [idUp3]
        },

        {
            field:
                'master_ulp.id',

            value: [idUlp]
        }

    ];


    addFilter(
        filters,
        'status_akhir',
        body.status
    );


    addFilter(
        filters,
        'no_laporan',
        body.no_laporan
    );


    addFilter(
        filters,
        'nama_pelapor',
        body.nama_pelapor
    );


    addFilter(
        filters,
        'pelanggan_no_meter.id_pelanggan',
        body.id_pelanggan
    );


    addFilter(
        filters,
        'pelanggan_no_meter.no_meter',
        body.no_meter
    );


    return filters;
}


// ============================================================
// HELPER - GRAPHQL REQUEST
// ============================================================

async function fetchKeluhan({
    token,
    idUid,
    userId,
    idUlp,
    skip,
    limit,
    tanggalMulai,
    tanggalSelesai,
    filters
}) {

    if (!GRAPHQL_KELUHAN_URL) {

        throw new Error(
            'GRAPHQL_KELUHAN_URL belum dikonfigurasi.'
        );

    }


    const response = await axios.post(

        GRAPHQL_KELUHAN_URL,

        {
            query: QUERY_KELUHAN,

            variables: {

                search: {

                    skip,

                    take: limit,

                    sort: null,

                    requireTotalCount: true,

                    dateFrom: tanggalMulai,

                    dateTo: tanggalSelesai,

                    isCreateDate: false,

                    filter: filters

                },

                userId,

                idUid,

                idUlp

            }

        },

        {
            headers: {

                Authorization:
                    `Bearer ${token}`,

                'Content-Type':
                    'application/json'

            },

            timeout:
                REQUEST_TIMEOUT

        }

    );


    return response.data;

}


// ============================================================
// ROUTE
// ============================================================

module.exports = ({
    db,
    session
}) => {

    const router = express.Router();


    router.post(
        '/keluhan',
        async (req, res) => {

            const requestId =
                `${Date.now()}-${Math.random()
                    .toString(36)
                    .substring(2, 8)}`;


            console.log(
                `[${requestId}] 🔎 [KELUHAN] Request`
            );


            // ==================================================
            // AUTHENTICATION
            // ==================================================

            if (!isAuthenticated(session)) {

                console.warn(
                    `[${requestId}] ⚠️ Unauthorized`
                );

                return res.status(401).json({

                    status: false,

                    message:
                        'Belum login / Token Expired.'

                });

            }


            // ==================================================
            // REQUEST BODY
            // ==================================================

            const body =
                req.body || {};


            // ==================================================
            // REQUIRED FIELD
            // ==================================================

            const missingFields =
                validateRequiredFields(body);


            if (missingFields.length > 0) {

                return res.status(400).json({

                    status: false,

                    message:
                        'Parameter wajib belum lengkap.',

                    missing_fields:
                        missingFields

                });

            }


            // ==================================================
            // INTEGER VALIDATION
            // ==================================================

            const integerError =
                validateIntegerFields(body);


            if (integerError) {

                return res.status(400).json({

                    status: false,

                    message:
                        integerError.message

                });

            }


            // ==================================================
            // CONVERT INTEGER
            // ==================================================

            const idUid =
                parseInteger(body.id_uid);

            const userId =
                parseInteger(body.user_id);

            const idUp3 =
                parseInteger(body.id_up3);

            const idUlp =
                parseInteger(body.id_ulp);

            const limit =
                parseInteger(body.limit);

            const skip =
                parseInteger(body.skip);


            // ==================================================
            // PAGINATION VALIDATION
            // ==================================================

            const paginationError =
                validatePagination(
                    limit,
                    skip
                );


            if (paginationError) {

                return res.status(400).json({

                    status: false,

                    message:
                        paginationError.message

                });

            }


            // ==================================================
            // DATE VALIDATION
            // ==================================================

            const dateError =
                validateDateRange(
                    body.tanggal_mulai,
                    body.tanggal_selesai
                );


            if (dateError) {

                return res.status(400).json({

                    status: false,

                    message:
                        dateError.message

                });

            }


            // ==================================================
            // BUILD FILTER
            // ==================================================

            const graphqlFilters =
                buildGraphQLFilters(
                    body,
                    idUp3,
                    idUlp
                );


            // ==================================================
            // LOG REQUEST
            // ==================================================

            console.log({

                requestId,

                idUid,

                userId,

                idUp3,

                idUlp,

                tanggal_mulai:
                    body.tanggal_mulai,

                tanggal_selesai:
                    body.tanggal_selesai,

                limit,

                skip,

                filters:
                    graphqlFilters.length

            });


            // ==================================================
            // CALL APKT
            // ==================================================

            try {

                const graphqlResponse =
                    await fetchKeluhan({

                        token:
                            session.authToken,

                        idUid,

                        userId,

                        idUlp,

                        skip,

                        limit,

                        tanggalMulai:
                            body.tanggal_mulai,

                        tanggalSelesai:
                            body.tanggal_selesai,

                        filters:
                            graphqlFilters

                    });


                // ==============================================
                // GRAPHQL ERROR
                // ==============================================

                if (
                    graphqlResponse?.errors &&
                    graphqlResponse.errors.length > 0
                ) {

                    console.error(

                        `[${requestId}] ❌ GraphQL Error:`,

                        graphqlResponse.errors

                    );


                    return res.status(400).json({

                        status: false,

                        errors:
                            graphqlResponse.errors

                    });

                }


                // ==============================================
                // GET DATA
                // ==============================================

                const outData =
                    graphqlResponse
                        ?.data
                        ?.getMonitoringKeluhanAll;


                if (!outData) {

                    console.error(

                        `[${requestId}] ❌ Invalid GraphQL response`

                    );


                    return res.status(500).json({

                        status: false,

                        message:
                            'Response GraphQL tidak memiliki data.'

                    });

                }


                // ==============================================
                // SUCCESS
                // ==============================================

                console.log(

                    `[${requestId}] ✅ Keluhan berhasil diambil. Total: ${outData.totalCount}`

                );


                return res.json({

                    status: true,

                    total_data:
                        outData.totalCount,

                    total_halaman:
                        outData.totalPage,

                    data_keluhan:
                        outData.data || []

                });


            } catch (error) {

                // ==============================================
                // TOKEN EXPIRED
                // ==============================================

                if (
                    error.response?.status === 401
                ) {

                    console.warn(

                        `[${requestId}] 🔐 Token APKT expired`

                    );


                    if (db) {

                        db.prepare(`
                            UPDATE app_session
                            SET statusToken = 'Expired'
                            WHERE id = 1
                        `).run();

                    }


                    session.statusToken =
                        'Expired';


                    return res.status(401).json({

                        status: false,

                        message:
                            'Token expired'

                    });

                }


                // ==============================================
                // TIMEOUT
                // ==============================================

                if (
                    error.code ===
                    'ECONNABORTED'
                ) {

                    console.error(

                        `[${requestId}] ⏱️ APKT timeout`

                    );


                    return res.status(504).json({

                        status: false,

                        message:
                            'Server APKT tidak merespons dalam waktu yang ditentukan.'

                    });

                }


                // ==============================================
                // APKT HTTP ERROR
                // ==============================================

                if (error.response) {

                    console.error(

                        `[${requestId}] ❌ APKT HTTP ${error.response.status}`

                    );


                    return res.status(502).json({

                        status: false,

                        message:
                            'Server APKT mengalami gangguan.'

                    });

                }


                // ==============================================
                // CONNECTION ERROR
                // ==============================================

                if (error.request) {

                    console.error(

                        `[${requestId}] ❌ Tidak dapat terhubung ke APKT`

                    );


                    return res.status(502).json({

                        status: false,

                        message:
                            'Tidak dapat terhubung ke server APKT.'

                    });

                }


                // ==============================================
                // UNKNOWN ERROR
                // ==============================================

                console.error(

                    `[${requestId}] ❌ Internal Error:`,

                    error

                );


                return res.status(500).json({

                    status: false,

                    message:
                        'Gagal mengambil data keluhan dari server APKT.'

                });

            }

        }
    );


    return router;
};