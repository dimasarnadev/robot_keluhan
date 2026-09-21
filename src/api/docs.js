/**
 * @openapi
 * /api/v1/keluhan:
 *   post:
 *     summary: Mengambil data keluhan disertai filter
 *     description: >
 *       Mengambil data keluhan melalui server APKT.
 *       Seluruh parameter filter ditentukan oleh user.
 *       Pastikan sudah login terlebih dahulu.
 *     tags:
 *       - Transaksi Keluhan
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_uid
 *               - user_id
 *               - id_up3
 *               - id_ulp
 *               - tanggal_mulai
 *               - tanggal_selesai
 *               - limit
 *               - skip
 *             properties:
 *
 *               id_uid:
 *                 type: integer
 *                 example: 161
 *
 *               user_id:
 *                 type: integer
 *                 example: 254456
 *
 *               id_up3:
 *                 type: integer
 *                 example: 163
 *
 *               id_ulp:
 *                 type: integer
 *                 example: 16100
 *
 *               tanggal_mulai:
 *                 type: string
 *                 format: date
 *                 example: "2026-09-18"
 *
 *               tanggal_selesai:
 *                 type: string
 *                 format: date
 *                 example: "2026-09-18"
 *
 *               status:
 *                 type: string
 *                 nullable: true
 *                 example: "Selesai"
 *
 *               no_laporan:
 *                 type: string
 *                 nullable: true
 *                 example: "K1626090800017"
 *
 *               nama_pelapor:
 *                 type: string
 *                 nullable: true
 *                 example: "BP SAMSUL"
 *
 *               id_pelanggan:
 *                 type: string
 *                 nullable: true
 *                 example: "161002085370"
 *
 *               no_meter:
 *                 type: string
 *                 nullable: true
 *                 example: "161002085370"
 *
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 500
 *                 example: 50
 *
 *               skip:
 *                 type: integer
 *                 minimum: 0
 *                 example: 0
 *
 *           example:
 *             id_uid: 161
 *             user_id: 254456
 *             id_up3: 163
 *             id_ulp: 16100
 *             tanggal_mulai: "2026-09-18"
 *             tanggal_selesai: "2026-09-18"
 *             status: null
 *             no_laporan: null
 *             nama_pelapor: null
 *             id_pelanggan: null
 *             no_meter: null
 *             limit: 50
 *             skip: 0
 *
 *     responses:
 *
 *       200:
 *         description: Berhasil mengambil data keluhan
 *
 *       400:
 *         description: Parameter tidak valid atau GraphQL error
 *
 *       401:
 *         description: Belum login atau token APKT telah expired
 *
 *       500:
 *         description: Gagal mengambil data keluhan
 */