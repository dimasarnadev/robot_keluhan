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
        media: row.media,

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
        $search: SearchWithDateArrayInput
        $userId: BigInteger
        $idUid: BigInteger
        $idUlp: BigInteger
    ) {
        getMonitoringKeluhanAll(search: $search, userId: $userId, idUid: $idUid, idUlp: $idUlp) {
            totalCount
            totalPage
            status
            message
            data {
            appuser {
                userId
            }
            keluhan_transaksi {
                id
                waktu
                jenis
                catatan_petugas
                appuser {
                username
                }
            }
            durasi
            id
            pelanggan_no_meter {
                nama
                no_meter
                id_pelanggan
                kode_gardu
                no_tiang
            }
            master_ulp {
                id
                nama
                master_up3 {
                id
                nama
                master_uid {
                    id
                    nama
                }
                }
            }
            id_tipe_permasalahan
            alamat_pelanggan
            daya_tarif
            nama_pelapor
            telepon_pelapor
            hp_pelapor
            fax_pelapor
            email_pelapor
            alamat_pelapor
            media
            waktu_padam
            konfirmasi
            lokasi
            no_laporan
            keterangan
            created_date
            appuser {
                username
            }
            updated_date
            updated_by
            status_akhir
            tipe_wo
            unit
            eskalasi
            permasalahan
            waktu_lapor
            master_regu {
                nama
            }
            waktu_penugasan
            waktu_perjalanan
            waktu_pengerjaan
            waktu_nyala_sementara
            waktu_nyala
            waktu_batal
            waktu_selesai
            issuetype {
                issuetypename
            }
            subissuetype {
                subissuetypename
            }
            alasan
            deskripsi
            patokan
            jarak
            no_lapor_pln
            respon_pelanggan
            uraian
            pelaksana
            summary
            jumlah_lapor
            keluhan_lapor_ulang {
                keterangan
            }
            }
        }
    }`
    .replace(/\s+/g, ' ')
    .trim();

async function getMonitoringKeluhanAll({
    token,
    idUid,
    userId,
    idUlp,
    tanggalMulai,
    tanggalSelesai,
    limit = 500,
    skip = 0,
    filters = []
}) {
    if (!process.env.APKT_TRANSACTION_URL) {
        throw new Error('APKT_TRANSACTION_URL belum dikonfigurasi.');
    }

    const response = await axios.post(
        `${process.env.APKT_TRANSACTION_URL}/graphql`,
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
                idUid,
                idUlp,
                userId
            }
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
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

async function postKeluhan(params) {
    const result = await getMonitoringKeluhanAll(params);

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
