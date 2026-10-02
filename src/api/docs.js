/**
 * @openapi
 * /api/v1/auth/captcha:
 *   get:
 *     summary: Mendapatkan CAPTCHA APKT
 *     description: Mengambil gambar CAPTCHA dari server APKT.
 *     tags:
 *       - Autentikasi
 *     responses:
 *       200:
 *         description: CAPTCHA berhasil diambil
 *         content:
 *           application/json:
 *             example:
 *               status: true
 *               image: "data:image/png;base64,..."
 *       502:
 *         description: Respons CAPTCHA dari server APKT tidak valid
 *       500:
 *         description: Gagal terhubung ke server APKT
 */

/**
 * @openapi
 * /api/v1/auth/status:
 *   get:
 *     summary: Mengecek status autentikasi backend
 *     tags:
 *       - Autentikasi
 *     responses:
 *       200:
 *         description: Backend memiliki session login aktif
 *         content:
 *           application/json:
 *             example:
 *               status: true
 *               loggedIn: true
 *               statusToken: Aktif
 *               user:
 *                 userId: 254456
 *                 idUid: 161
 *                 idUp3: 163
 *                 idUlp: 16100
 *                 username: 16100.AZIS
 *                 employeeName: AZIS
 *       401:
 *         description: Tidak ada session login aktif
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               loggedIn: false
 *               statusToken: Belum Login
 *               user: null
 */

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Login ke server APKT
 *     description: Melakukan autentikasi user ke server APKT. Dibatasi 10 percobaan per 15 menit.
 *     tags:
 *       - Autentikasi
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - captcha
 *             properties:
 *               username:
 *                 type: string
 *                 example: "16100.AZIS"
 *               password:
 *                 type: string
 *                 format: password
 *               captcha:
 *                 type: string
 *                 example: "wee6w"
 *     responses:
 *       200:
 *         description: Response login dari backend
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 summary: Login berhasil
 *                 value:
 *                   status: true
 *                   message: "Login sukses & sesi disimpan"
 *                   user:
 *                     username: "16100.AZIS"
 *                     employeeName: "AZIS"
 *                     userId: 254456
 *                     idUid: 161
 *                     idUp3: 163
 *                     idUlp: 16100
 *               failed:
 *                 summary: Login gagal
 *                 value:
 *                   status: false
 *                   message: "Gagal login"
 *       400:
 *         description: Input login tidak valid
 *       429:
 *         description: Terlalu banyak percobaan login
 *       500:
 *         description: Error server
 */

/**
 * @openapi
 * /api/v1/master/up3:
 *   post:
 *     summary: Mendapatkan daftar UP3 berdasarkan id_uid
 *     description: Mengambil data UP3 dari GraphQL Master APKT.
 *     tags:
 *       - Referensi Master Data
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_uid
 *             properties:
 *               id_uid:
 *                 type: integer
 *                 example: 161
 *     responses:
 *       200:
 *         description: Berhasil mendapatkan daftar UP3
 *         content:
 *           application/json:
 *             example:
 *               data:
 *                 getUp3ByUid:
 *                   status: true
 *                   message: Data ditemukan
 *                   data:
 *                     - id: 163
 *                       id_uid: 161
 *                       nama: UP3 BANGKA
 *                       kode: 16BGK
 *                       aktif: true
 *       400:
 *         description: Parameter tidak valid atau GraphQL error
 *       401:
 *         description: Belum login atau token expired
 *       502:
 *         description: Server APKT bermasalah
 */

/**
 * @openapi
 * /api/v1/master/ulp:
 *   post:
 *     summary: Mendapatkan daftar ULP berdasarkan id_up3
 *     description: Mengambil daftar Unit Layanan Pelanggan dari GraphQL Master APKT.
 *     tags:
 *       - Referensi Master Data
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_up3
 *             properties:
 *               id_up3:
 *                 type: integer
 *                 example: 163
 *     responses:
 *       200:
 *         description: Berhasil mendapatkan daftar ULP
 *         content:
 *           application/json:
 *             example:
 *               data:
 *                 getUlpByUp3:
 *                   - id: 16100
 *                     id_up3: 163
 *                     nama: ULP PANGKALPINANG
 *                     aktif: true
 *       400:
 *         description: Parameter tidak valid atau GraphQL error
 *       401:
 *         description: Belum login atau token expired
 *       502:
 *         description: Server APKT bermasalah
 */

/**
 * @openapi
 * /api/v1/keluhan:
 *   post:
 *     summary: Mengambil data keluhan disertai filter
 *     description: >
 *       Mengambil data keluhan melalui server APKT.
 *       Seluruh parameter divalidasi ketat (tipe dan format).
 *       Pastikan sudah login terlebih dahulu.
 *     tags:
 *       - Transaksi Keluhan
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
 *               id_uid:
 *                 type: integer
 *                 example: 161
 *               user_id:
 *                 type: integer
 *                 example: 254456
 *               id_up3:
 *                 type: integer
 *                 example: 163
 *               id_ulp:
 *                 type: integer
 *                 example: 16100
 *               tanggal_mulai:
 *                 type: string
 *                 format: date
 *                 example: "2026-09-18"
 *               tanggal_selesai:
 *                 type: string
 *                 format: date
 *                 example: "2026-09-18"
 *               status:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 100
 *                 example: "Selesai"
 *               no_laporan:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 100
 *                 example: "K1626090800017"
 *               nama_pelapor:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 100
 *                 example: "BP SAMSUL"
 *               id_pelanggan:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 100
 *                 example: "161002085370"
 *               no_meter:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 100
 *                 example: "161002085370"
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 500
 *                 example: 50
 *               skip:
 *                 type: integer
 *                 minimum: 0
 *                 example: 0
 *     responses:
 *       200:
 *         description: Berhasil mengambil data keluhan
 *       400:
 *         description: Parameter tidak valid atau GraphQL error
 *       401:
 *         description: Belum login atau token APKT telah expired
 *       502:
 *         description: Server APKT bermasalah
 *       504:
 *         description: Server APKT tidak merespons
 */
