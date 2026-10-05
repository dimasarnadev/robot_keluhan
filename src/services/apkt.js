const axios = require('axios');

const env = require('../config/env');

// Status resmi APKT
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

// Status yang dianggap selesai. Reminder tidak dikirim lagi.
const FINAL_STATUSES = ['Batal', 'Selesai'];

const MAX_PAGES = 50;

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
    }
`
    .replace(/\s+/g, ' ')
    .trim();

// Normalisasi data APKT (dipakai poller dan bot)
function normalizeKeluhan(row) {
    return {
        id: row.id ?? null,
        no_laporan: row.no_laporan ?? null,
        nama_pelapor: row.nama_pelapor ?? null,
        permasalahan: row.permasalahan ?? null,
        waktu_lapor: row.waktu_lapor ?? null,
        waktu_batal: row.waktu_batal ?? null,
        waktu_selesai: row.waktu_selesai ?? null,
        waktu_nyala: row.waktu_nyala ?? null,
        durasi: row.durasi ?? null,
        status: row.status_akhir ?? null,
        status_akhir: row.status_akhir ?? null,
        alamat_pelanggan: row.alamat_pelanggan ?? null,

        no_meter: row.pelanggan_no_meter?.no_meter ?? null,
        nama_pelanggan: row.pelanggan_no_meter?.nama ?? null,
        id_pelanggan: row.pelanggan_no_meter?.id_pelanggan ?? null,

        id_ulp: row.master_ulp?.id ?? null,
        nama_ulp: row.master_ulp?.nama ?? null,
        id_up3: row.master_ulp?.master_up3?.id ?? null,
        nama_up3: row.master_ulp?.master_up3?.nama ?? null
    };
}

// Request ke APKT. Mengembalikan data mentah (bentuk asli GraphQL).
async function fetchKeluhanRaw({
    token,
    idUid,
    userId,
    idUlp,
    tanggalMulai,
    tanggalSelesai,
    limit = 20,
    skip = 0,
    filters = []
}) {
    if (!env.graphqlKeluhanUrl) {
        throw new Error('GRAPHQL_KELUHAN_URL belum dikonfigurasi.');
    }

    if (!token) {
        throw new Error('Token APKT kosong.');
    }

    const response = await axios.post(
        env.graphqlKeluhanUrl,
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
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: env.requestTimeout
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
        totalCount: result.totalCount || 0,
        totalPage: result.totalPage || 0,
        status: result.status,
        message: result.message,
        data: result.data || []
    };
}

// Sama seperti fetchKeluhanRaw, dengan data yang sudah dinormalisasi.
async function getKeluhan(params) {
    const result = await fetchKeluhanRaw(params);

    return {
        ...result,
        data: result.data.map(normalizeKeluhan)
    };
}

// Mengambil SEMUA halaman (data ternormalisasi, tanpa duplikat).
// `truncated` = true bila batas halaman tercapai sebelum semua data terbaca.
async function fetchAllKeluhan({ pageSize = 100, ...params }) {
    const rows = [];
    const seen = new Set();

    let skip = 0;
    let totalCount = 0;

    for (let page = 0; page < MAX_PAGES; page += 1) {
        const result = await getKeluhan({ ...params, limit: pageSize, skip });

        totalCount = result.totalCount;

        if (!result.data.length) {
            break;
        }

        for (const row of result.data) {
            const key = row.no_laporan ?? `id:${row.id}`;

            if (!seen.has(key)) {
                seen.add(key);
                rows.push(row);
            }
        }

        skip += result.data.length;

        if (skip >= totalCount || result.data.length < pageSize) {
            break;
        }
    }

    return { totalCount, data: rows, truncated: skip < totalCount };
}

module.exports = {
    fetchKeluhanRaw,
    fetchAllKeluhan,
    getKeluhan,
    normalizeKeluhan,
    STATUS_APKT,
    FINAL_STATUSES
};
