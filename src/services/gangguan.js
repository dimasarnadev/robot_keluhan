require('dotenv').config();
const axios = require('axios');

const STATUS_GANGGUAN = [
    'Lapor',
    'Lapor (Kwh Periksa)',
    'Lapor (Cancel WO)',
    'Menunggu Konfirmasi',
    'Penugasan Regu',
    'Dalam Perjalanan',
    'Dalam Pengerjaan',
    'Nyala',
    'Nyala Sementara',
    'Selesai',
    'Selesai(PEMADAMAN MELUAS)',
    'Selesai(GANGGUAN SISTEM)',
    'Dibatalkan'
];

const CLOSE_STATUS_GANGGUAN = [
    'Dibatalkan',
    'Nyala',
    'Nyala Sementara',
    'Selesai',
    'Selesai(PEMADAMAN MELUAS)',
    'Selesai(GANGGUAN SISTEM)'
];

const MAX_PAGES = 10;

const QUERY_GANGGUAN = `
    query getMonitoringGangguanAll(
        $search: SearchWithDateArrayInput
        $idUid: BigInteger
        $idPosko: BigInteger
        $userId: BigInteger
    ) {
        getMonitoringGangguanAll(
            search: $search
            idUid: $idUid
            idPosko: $idPosko
            userId: $userId
        ) {
            totalCount
            totalPage
            status
            message
            data {
            rating
            feedback_rating
            durasi
            alasan_nyala_sementara
            alamat_pelanggan
            alamat_pelapor
            alasan
            deskripsi
            alasan_pembatalan
            appuser {
                username
            }
            created_date
            email_pelapor
            equipment {
                id
                nama
            }
            eskalasi
            fax_pelapor
            hp_pelapor
            id
            master_regu {
                id
                id_posko
                nama
            }
            master_posko {
                id
                nama
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
            }
            pelanggan_no_meter {
                id_pelanggan
                no_meter
                nama
                telepon
                alamat
                kode_gardu
                no_tiang
                lokasi
            }
            jarak
            jumlah_lapor
            jumlah_pelanggan_termarking
            keterangan
            konfirmasi
            lokasi
            keterangan_lokasi
            media
            nama_pelapor
            no_laporan
            patokan
            permasalahan
            prioritas {
                id
                nama
            }
            status_akhir
            sub_fasilitas {
                id
                nama
            }
            telepon_pelapor
            tipe_permasalahan {
                id
                nama
            }
            tipe_gangguan
            tipe_wo
            unit
            updated_by
            updated_date
            waktu_batal
            waktu_konfirmasi
            waktu_lapor
            waktu_nyala
            waktu_nyala_sementara
            waktu_padam
            waktu_pengerjaan
            waktu_penugasan
            waktu_perjalanan
            waktu_selesai
            sub_tipe_permasalahan {
                id
                nama
            }
            kelompok {
                id
                nama
            }
            penyebab_gangguan {
                id
                nama
            }
            fasilitas {
                id
                nama
            }
            kelompok_utama {
                id
                nama
            }
            dampak {
                id
                nama
            }
            grup_penyebab_gangguan {
                id
                nama
            }
            gangguan_transaksi {
                regu {
                nama
                }
                id
                waktu
                jenis
                catatan_petugas
                appuser {
                username
                }
            }
            master_kelurahan {
                nama_kelurahan
            }
            tindakan {
                id
                nama
            }
            cuaca {
                id
                nama
            }
            fax
            waktu_fax
            nama_media
            waktu_media
            master_merk_meter {
                merk_meter
            }
            tarif_daya {
                daya
                tarif
            }
            penyebab_sementara
            tindakan_telah_dilakukan_nyala_sementara
            usulan_tindakan_selanjutnya
            tindakan_telah_dilakukan_nyala
            penyebab_nyala
            jumlah_pelanggan_padam
            pelanggaran
            master_feeder {
                nama
            }
            komponen_yang_terganggu_feeder
            tindakan_yang_dilakukan_feeder
            no_tiket_crm
            no_lapor_pln
            no_kerja
            }
        }
    }`
    .replace(/\s+/g, ' ')
    .trim();

function normalizeGangguan(row) {
    return {
        id: row.id,
        no_laporan: row.no_laporan,
        nama_pelapor: row.nama_pelapor,
        telepon_pelapor: row.telepon_pelapor,
        alamat_pelapor: row.alamat_pelapor,
        deskripsi: row.deskripsi,
        permasalahan: row.permasalahan,
        waktu_lapor: row.waktu_lapor,
        waktu_penugasan: row.waktu_penugasan,
        waktu_perjalanan: row.waktu_perjalanan,
        waktu_pengerjaan: row.waktu_pengerjaan,
        waktu_batal: row.waktu_batal,
        waktu_selesai: row.waktu_selesai,
        waktu_nyala: row.waktu_nyala,
        durasi: row.durasi,
        status_akhir: row.status_akhir,
        media: row.media,

        id_pelanggan: row.pelanggan_no_meter?.id_pelanggan,
        no_meter: row.pelanggan_no_meter?.no_meter,
        nama_pelanggan: row.pelanggan_no_meter?.nama,
        alamat_pelanggan: row.pelanggan_no_meter?.alamat,

        id_posko: row.master_posko?.id,
        nama_posko: row.master_posko?.nama,
        id_ulp: row.master_posko?.master_ulp?.id,
        nama_ulp: row.master_posko?.master_ulp?.nama,
        id_up3: row.master_posko?.master_ulp?.master_up3?.id,
        nama_up3: row.master_posko?.master_ulp?.master_up3?.nama,
        gangguan_transaksi: row.gangguan_transaksi
    };
}

async function getMonitoringGangguanAll({
    token,
    idUid,
    userId,
    idPosko,
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
            query: QUERY_GANGGUAN,
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
                idPosko,
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

    const result = response.data?.data?.getMonitoringGangguanAll;

    if (!result) {
        throw new Error('Response APKT tidak memiliki data gangguan.');
    }

    return {
        totalCount: result.totalCount,
        totalPage: result.totalPage,
        status: result.status,
        message: result.message,
        data: result.data
    };
}

async function postGangguan(params) {
    const result = await getMonitoringGangguanAll(params);

    return {
        ...result,
        data: result.data.map(normalizeGangguan)
    };
}

module.exports = {
    postGangguan,
    getMonitoringGangguanAll,
    STATUS_GANGGUAN,
    CLOSE_STATUS_GANGGUAN
};
