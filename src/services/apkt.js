const axios = require('axios');

const GRAPHQL_KELUHAN_URL =
    process.env.GRAPHQL_KELUHAN_URL;

const REQUEST_TIMEOUT =
    Number(process.env.GRAPHQL_TIMEOUT_MS) || 15000;


/*
 * Status resmi APKT
 */
const STATUS_APKT = [
    'Batal',
    'Konfirmasi',
    'Dalam Proses Pengiriman Email',
    'Menunggu Tanggapan Supervisor CC',
    'Dalam Proses Manager Unit',
    'Dalam Proses Bidang Unit',
    'Selesai Dijawab Bidang Unit',
    'Selesai'
];


/*
 * Status yang dianggap selesai.
 * Reminder tidak dikirim lagi.
 */
const FINAL_STATUSES = [
    'Batal',
    'Selesai'
];


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
`;


/**
 * Normalisasi data APKT
 */
function normalizeKeluhan(row) {

    return {
        id: row.id ?? null,

        no_laporan:
            row.no_laporan ?? null,

        nama_pelapor:
            row.nama_pelapor ?? null,

        permasalahan:
            row.permasalahan ?? null,

        waktu_lapor:
            row.waktu_lapor ?? null,

        status:
            row.status_akhir ?? null,

        status_akhir:
            row.status_akhir ?? null,

        alamat_pelanggan:
            row.alamat_pelanggan ?? null,

        no_meter:
            row.pelanggan_no_meter?.no_meter ?? null,

        nama_pelanggan:
            row.pelanggan_no_meter?.nama ?? null,

        id_pelanggan:
            row.pelanggan_no_meter?.id_pelanggan ?? null,

        id_ulp:
            row.master_ulp?.id ?? null,

        nama_ulp:
            row.master_ulp?.nama ?? null,

        id_up3:
            row.master_ulp?.master_up3?.id ?? null,

        nama_up3:
            row.master_ulp?.master_up3?.nama ?? null
    };
}


/**
 * Ambil keluhan dari APKT
 */
async function getKeluhan({
    token,
    idUid,
    userId,
    idUlp,

    tanggalMulai,
    tanggalSelesai,

    limit = 100,
    skip = 0,

    filters = []
}) {

    if (!GRAPHQL_KELUHAN_URL) {
        throw new Error(
            'GRAPHQL_KELUHAN_URL belum dikonfigurasi.'
        );
    }

    if (!token) {
        throw new Error(
            'Token APKT kosong.'
        );
    }

    const response =
        await axios.post(
            GRAPHQL_KELUHAN_URL,

            {
                query:
                    QUERY_KELUHAN,

                variables: {

                    search: {
                        skip,
                        take: limit,

                        sort: null,

                        requireTotalCount:
                            true,

                        dateFrom:
                            tanggalMulai,

                        dateTo:
                            tanggalSelesai,

                        isCreateDate:
                            false,

                        filter:
                            filters
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


    if (
        response.data?.errors &&
        response.data.errors.length
    ) {

        const message =
            response.data.errors
                .map(item => item.message)
                .join('; ');

        const error =
            new Error(message);

        error.graphqlErrors =
            response.data.errors;

        throw error;
    }


    const result =
        response.data
            ?.data
            ?.getMonitoringKeluhanAll;


    if (!result) {

        throw new Error(
            'Response APKT tidak memiliki data keluhan.'
        );
    }


    return {

        totalCount:
            result.totalCount || 0,

        totalPage:
            result.totalPage || 0,

        status:
            result.status,

        message:
            result.message,

        data:
            (result.data || [])
                .map(normalizeKeluhan)
    };
}


module.exports = {
    getKeluhan,
    normalizeKeluhan,
    STATUS_APKT,
    FINAL_STATUSES
};