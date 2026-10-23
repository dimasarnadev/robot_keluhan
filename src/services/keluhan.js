require('dotenv').config();
const axios = require('axios');
const { resolveDefaultDateRange, resolveSessionDefaults } = require('./common');

const STATUS_KELUHAN = [
    'Batal',
    'Konfirmasi',
    'Dalam Proses Pengiriman Email',
    'Menunggu Tanggapan Supervisor CC',
    'Dalam Proses Manager Unit',
    'Dalam Proses Bidang Unit',
    'Selesai Dijawab Bidang Unit',
    'Selesai'
];

const CLOSE_STATUS_KELUHAN = ['Batal', 'Selesai'];

const MAX_PAGES = 10;

function normalizeKeluhan(row) {
    return {
        id: row.id,
        no_laporan: row.no_laporan,
        nama_pelapor: row.nama_pelapor,
        telepon_pelapor: row.telepon_pelapor,
        alamat_pelapor: row.alamat_pelapor,
        permasalahan: row.permasalahan,
        waktu_lapor: row.waktu_lapor,
        waktu_batal: row.waktu_batal,
        waktu_selesai: row.waktu_selesai,
        waktu_nyala: row.waktu_nyala,
        durasi: row.durasi,
        status_akhir: row.status_akhir,

        id_pelanggan: row.pelanggan_no_meter?.id_pelanggan,
        no_meter: row.pelanggan_no_meter?.no_meter,
        nama_pelanggan: row.pelanggan_no_meter?.nama,
        alamat_pelanggan: row.alamat_pelanggan,

        id_ulp: row.master_ulp?.id,
        nama_ulp: row.master_ulp?.nama,
        id_up3: row.master_ulp?.master_up3?.id,
        nama_up3: row.master_ulp?.master_up3?.nama,
        keluhan_transaksi: row.keluhan_transaksi
    };
}

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
                waktu_batal
                waktu_selesai
                waktu_nyala
                durasi
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
    }`
    .replace(/\s+/g, ' ')
    .trim();

async function getMonitoringKeluhanAll(params = {}) {
    const request = {
        ...resolveSessionDefaults(params.session, params),
        ...resolveDefaultDateRange({
            tanggalMulai: params.tanggalMulai,
            tanggalSelesai: params.tanggalSelesai,
            rangeDays: Number(process.env.POLL_RANGE_DAYS || 1)
        })
    };

    if (!process.env.APKT_TRANSACTION_URL) {
        throw new Error('APKT_TRANSACTION_URL belum dikonfigurasi.');
    }

    const response = await axios.post(
        `${process.env.APKT_TRANSACTION_URL}/graphql`,
        {
            query: QUERY_KELUHAN,
            variables: {
                search: {
                    skip: request.skip ?? 0,
                    take: request.limit ?? 20,
                    sort: null,
                    requireTotalCount: true,
                    dateFrom: request.tanggalMulai,
                    dateTo: request.tanggalSelesai,
                    isCreateDate: false,
                    filter: request.filters ?? []
                },
                userId: request.userId,
                idUid: request.idUid,
                idUlp: request.idUlp
            }
        },
        {
            headers: {
                Authorization: `Bearer ${request.token}`,
                'Content-Type': 'application/json'
            },
            timeout: process.env.APKT_TIMEOUT_MS
        }
    );

    if (response.data?.errors && response.data.errors.length) {
        const message = response.data.errors
            .map((item) => item.message)
            .join('; ');

        const error = new Error(message);

        error.graphqlErrors = response.data.errors;

        throw error;
    }

    const result = response.data?.data?.getMonitoringKeluhanAll;

    if (!result) {
        throw new Error('Response APKT tidak memiliki data keluhan.');
    }

    return {
        totalCount: result.totalCount,
        totalPage: result.totalPage,
        status: result.status,
        message: result.message,
        data: result.data
    };
}

async function postKeluhan(params = {}) {
    const request = {
        ...resolveSessionDefaults(params.session, params),
        ...resolveDefaultDateRange({
            tanggalMulai: params.tanggalMulai,
            tanggalSelesai: params.tanggalSelesai,
            rangeDays: Number(process.env.POLL_RANGE_DAYS || 1)
        })
    };

    const result = await getMonitoringKeluhanAll(request);

    return {
        ...result,
        data: result.data.map(normalizeKeluhan)
    };
}

module.exports = {
    postKeluhan,
    getMonitoringKeluhanAll,
    STATUS_KELUHAN,
    CLOSE_STATUS_KELUHAN
};
