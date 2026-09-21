const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3001;

const AUTH_BASE =
    process.env.AUTH_BASE_URL;

const GRAPHQL_MASTER_URL =
    process.env.GRAPHQL_MASTER_URL;

const GRAPHQL_KELUHAN_URL =
    process.env.GRAPHQL_KELUHAN_URL;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'REST API Gateway v1 - APKT PLN',
            version: '1.0.0',
            description: 'Dokumentasi REST API Gateway v1 untuk authentication dan ambil data keluhan.',
            contact: { name: 'TEKNIK ULP PANGKALPINANG' }
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'Localhost'
            }
        ]
    },
    apis: [__filename] 
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const db = new Database('session.db');
db.prepare(`
    CREATE TABLE IF NOT EXISTS app_session (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        authToken TEXT,
        statusToken TEXT,
        user_json TEXT,
        updated_at TEXT
    )
`).run();

let session = {
    authToken: "",
    user: null,
    statusToken: "Belum Login",
    captchaId: ""
};

function loadSessionFromDB() {
    const row = db
        .prepare('SELECT * FROM app_session WHERE id = 1')
        .get();

    if (!row) {
        console.log('📂 [SQLite3] Tidak ada session tersimpan.');
        return;
    }

    session.authToken = row.authToken || '';
    session.statusToken = row.statusToken || 'Belum Login';

    try {
        session.user = row.user_json
            ? JSON.parse(row.user_json)
            : null;
    } catch (error) {
        console.error(
            '❌ [SQLite3] user_json tidak valid:',
            error.message
        );

        session.user = null;
        session.authToken = '';
        session.statusToken = 'Belum Login';
    }

    console.log(
        `📂 [SQLite3] Session: ${session.statusToken} | User: ${
            session.user?.employeeName || '-'
        }`
    );
}

loadSessionFromDB();

function getTodayDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * @openapi
 * /api/v1/auth/captcha:
 *   get:
 *     summary: Mendapatkan CAPTCHA APKT
 *     description: Mengambil CAPTCHA dari server APKT.
 *     tags:
 *       - Autentikasi
 *     responses:
 *       200:
 *         description: CAPTCHA berhasil diambil
 *         content:
 *           application/json:
 *             example:
 *               status: true
 *               captchaId: "xxxxxxxx"
 *               image: "data:image/png;base64,..."
 *
 *       500:
 *         description: Gagal terhubung ke server APKT
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Gagal terhubung ke server APKT"
 */
app.get('/api/v1/auth/captcha', async (req, res) => {
    try {
        const response = await axios.get(`${AUTH_BASE}/auth/captcha`, { timeout: 10000 });
        session.captchaId = response.data.captchaId;
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ status: false, message: 'Gagal terhubung ke server APKT' });
    }
});

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
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 loggedIn:
 *                   type: boolean
 *                   example: true
 *                 statusToken:
 *                   type: string
 *                   example: Aktif
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: integer
 *                       example: 254456
 *                     idUid:
 *                       type: integer
 *                       example: 161
 *                     idUp3:
 *                       type: integer
 *                       example: 163
 *                     idUlp:
 *                       type: integer
 *                       example: 16100
 *                     username:
 *                       type: string
 *                       example: 16100.AZIS
 *                     employeeName:
 *                       type: string
 *                       example: AZIS
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
 *
 *       401:
 *         description: Tidak ada session login aktif
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 loggedIn:
 *                   type: boolean
 *                   example: false
 *                 statusToken:
 *                   type: string
 *                   example: Belum Login
 *                 user:
 *                   nullable: true
 *                   example: null
 *             example:
 *               status: false
 *               loggedIn: false
 *               statusToken: Belum Login
 *               user: null
 */
app.get('/api/v1/auth/status', (req, res) => {
    const loggedIn =
        Boolean(session.authToken) &&
        session.statusToken === 'Aktif';

    if (!loggedIn) {
        return res.status(401).json({
            status: false,
            loggedIn: false,
            statusToken: session.statusToken || 'Belum Login',
            user: null
        });
    }

    return res.json({
        status: true,
        loggedIn: true,
        statusToken: session.statusToken,
        user: session.user
    });
});

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Login ke server APKT
 *     description: Melakukan autentikasi user ke server APKT.
 *     tags:
 *       - Autentikasi
 *
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
 *                 example: "password"
 *               captcha:
 *                 type: string
 *                 example: "wee6w"
 *
 *           example:
 *             username: "16100.AZIS"
 *             password: "password"
 *             captcha: "wee6w"
 *
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
 *
 *               failed:
 *                 summary: Login gagal
 *                 value:
 *                   status: false
 *                   message: "Gagal login"
 *
 *       400:
 *         description: Request login tidak valid
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Parameter captcha wajib dikirim."
 *
 *       500:
 *         description: Error server
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Error Server saat memproses login"
 */
app.post('/api/v1/auth/login', async (req, res) => {
    try {
        const payload = { 
            username: req.body.username, 
            password: req.body.password, 
            captcha: req.body.captcha, 
            captchaId: session.captchaId 
        };
        const response = await axios.post(`${AUTH_BASE}/auth`, payload, { timeout: 10000 });
        
        if (response.data.status && response.data.user?.authToken) {
            const freshUser = response.data.user;
            const freshToken = freshUser.authToken;

            db.prepare(`
                INSERT INTO app_session (id, authToken, statusToken, user_json, updated_at)
                VALUES (1, ?, 'Aktif', ?, ?)
                ON CONFLICT(id) DO UPDATE SET authToken=excluded.authToken, statusToken=excluded.statusToken, user_json=excluded.user_json, updated_at=excluded.updated_at
            `).run(freshToken, JSON.stringify(freshUser), new Date().toISOString());

            session.authToken = freshToken;
            session.statusToken = "Aktif";
            session.user = freshUser;

            return res.json({ status: true, message: "Login sukses & sesi disimpan", user: freshUser });
        }
        res.json({ status: false, message: response.data.message || 'Gagal login' });
    } catch (error) {
        res.status(500).json({ status: false, message: 'Error Server saat memproses login' });
    }
});

/**
 * @openapi
 * /api/v1/master/up3:
 *   post:
 *     summary: Mendapatkan daftar UP3 berdasarkan id_uid
 *     description: >
 *       Mengambil data UP3 dari GraphQL Master APKT.
 *       Parameter id_uid sepenuhnya berasal dari dashboard/frontend.
 *     tags:
 *       - Referensi Master Data
 *
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
 *                 description: ID UID yang digunakan untuk mendapatkan daftar UP3.
 *                 example: 161
 *           example:
 *             id_uid: 161
 *
 *     responses:
 *
 *       200:
 *         description: Berhasil mendapatkan daftar UP3
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     getUp3ByUid:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: boolean
 *                           example: true
 *                         message:
 *                           type: string
 *                           example: Data ditemukan
 *                         data:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 example: 163
 *                               id_uid:
 *                                 type: integer
 *                                 example: 161
 *                               nama:
 *                                 type: string
 *                                 example: UP3 BANGKA
 *                               kode:
 *                                 type: string
 *                                 example: 16BGK
 *                               alamat:
 *                                 type: string
 *                                 example: JL. JEND. SUDIRMAN NO. 180
 *                               location:
 *                                 nullable: true
 *                                 example: null
 *                               created_date:
 *                                 type: string
 *                                 nullable: true
 *                                 example: 18/07/2012 18:13:13
 *                               created_by:
 *                                 nullable: true
 *                                 example: null
 *                               updated_date:
 *                                 nullable: true
 *                                 example: null
 *                               updated_by:
 *                                 nullable: true
 *                                 example: null
 *                               telepon:
 *                                 type: string
 *                                 nullable: true
 *                                 example: "(0717) 422713"
 *                               aktif:
 *                                 type: boolean
 *                                 example: true
 *                               geomPoint:
 *                                 type: string
 *                                 nullable: true
 *                                 example: "POINT (106.11175833859 -2.10001941118902)"
 *                               city:
 *                                 type: string
 *                                 example: PANGKAL PINANG
 *                               zip:
 *                                 nullable: true
 *                                 example: null
 *                               fax:
 *                                 nullable: true
 *                                 example: null
 *                               email:
 *                                 nullable: true
 *                                 example: null
 *
 *             example:
 *               data:
 *                 getUp3ByUid:
 *                   status: true
 *                   message: Data ditemukan
 *                   data:
 *                     - id: 162
 *                       id_uid: 161
 *                       nama: UP3 BELITUNG
 *                       kode: 16TJP
 *                       alamat: JL A.YANI NO 111
 *                       location: null
 *                       created_date: "18/07/2012 18:13:11"
 *                       created_by: null
 *                       updated_date: null
 *                       updated_by: null
 *                       telepon: null
 *                       aktif: true
 *                       geomPoint: "POINT (107.661720507535 -2.74242196703057)"
 *                       city: TANJUNG PANDAN
 *                       zip: null
 *                       fax: null
 *                       email: null
 *
 *                     - id: 163
 *                       id_uid: 161
 *                       nama: UP3 BANGKA
 *                       kode: 16BGK
 *                       alamat: JL. JEND. SUDIRMAN NO. 180
 *                       location: null
 *                       created_date: "18/07/2012 18:13:13"
 *                       created_by: null
 *                       updated_date: null
 *                       updated_by: null
 *                       telepon: "(0717) 422713"
 *                       aktif: true
 *                       geomPoint: "POINT (106.11175833859 -2.10001941118902)"
 *                       city: PANGKAL PINANG
 *                       zip: null
 *                       fax: null
 *                       email: null
 *
 *       400:
 *         description: Parameter id_uid tidak valid atau GraphQL mengembalikan error
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: id_uid harus berupa integer.
 *
 *       401:
 *         description: Session belum login atau token expired
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: Belum login / Token Expired.
 *
 *       500:
 *         description: Gagal mengambil data UP3
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: Gagal mengambil data UP3 dari server APKT.
 *               error: Request failed with status code 500
 */
app.post('/api/v1/master/up3', async (req, res) => {
    // ========================================================
    // AUTH SAJA
    // Tidak digunakan untuk menentukan parameter data
    // ========================================================

    if (
        !session.authToken ||
        session.statusToken !== 'Aktif'
    ) {
        return res.status(401).json({
            status: false,
            message: 'Belum login / Token Expired.'
        });
    }

    // ========================================================
    // REQUEST BODY
    // ========================================================

    const body = req.body || {};

    if (
        body.id_uid === undefined ||
        body.id_uid === null ||
        body.id_uid === ''
    ) {
        return res.status(400).json({
            status: false,
            message: 'Parameter id_uid wajib dikirim.'
        });
    }

    const idUid = Number(body.id_uid);

    if (!Number.isInteger(idUid)) {
        return res.status(400).json({
            status: false,
            message: 'id_uid harus berupa integer.'
        });
    }

    // ========================================================
    // GRAPHQL
    // ========================================================

    const queryUp3 = `
        query getUp3ByUid($id_uid: BigInteger) {
            getUp3ByUid(id_uid: $id_uid) {
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

    try {
        const response = await axios.post(
            GRAPHQL_MASTER_URL,
            {
                query: queryUp3,
                variables: {
                    id_uid: idUid
                }
            },
            {
                headers: {
                    Authorization:
                        `Bearer ${session.authToken}`
                },
                timeout: 15000
            }
        );

        if (response.data?.errors) {
            return res.status(400).json({
                status: false,
                errors: response.data.errors
            });
        }

        return res.json(response.data);

    } catch (error) {
        if (
            error.response?.status === 401
        ) {
            db.prepare(`
                UPDATE app_session
                SET statusToken = 'Expired'
                WHERE id = 1
            `).run();

            session.statusToken = 'Expired';

            return res.status(401).json({
                status: false,
                message: 'Token expired'
            });
        }

        console.error(
            '[MASTER UP3]',
            error.message
        );

        return res.status(500).json({
            status: false,
            message:
                'Gagal mengambil data UP3 dari server APKT.',
            error: error.message
        });
    }
});

/**
 * @openapi
 * /api/v1/master/ulp:
 *   post:
 *     summary: Mendapatkan daftar ULP berdasarkan id_up3
 *     description: >
 *       Mengambil daftar Unit Layanan Pelanggan dari GraphQL Master APKT.
 *       Parameter id_up3 sepenuhnya berasal dari dashboard/frontend.
 *     tags:
 *       - Referensi Master Data
 *
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
 *           example:
 *             id_up3: 163
 *
 *     responses:
 *
 *       200:
 *         description: Berhasil mendapatkan daftar ULP
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     getUlpByUp3:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 16100
 *                           id_up3:
 *                             type: integer
 *                             example: 163
 *                           nama:
 *                             type: string
 *                             example: ULP PANGKALPINANG
 *                           kode:
 *                             type: string
 *                             example: 16100
 *                           alamat:
 *                             type: string
 *                             example: JL GARUDA
 *                           created_date:
 *                             nullable: true
 *                             example: null
 *                           created_by:
 *                             nullable: true
 *                             example: null
 *                           updated_date:
 *                             nullable: true
 *                             example: null
 *                           updated_by:
 *                             nullable: true
 *                             example: null
 *                           telepon:
 *                             nullable: true
 *                             example: null
 *                           aktif:
 *                             type: boolean
 *                             example: true
 *                           city:
 *                             type: string
 *                             example: PANGKALPINANG
 *                           zip:
 *                             nullable: true
 *                             example: null
 *                           mobile:
 *                             nullable: true
 *                             example: null
 *                           fax:
 *                             nullable: true
 *                             example: null
 *                           email:
 *                             nullable: true
 *                             example: null
 *                           unit_ap2t:
 *                             type: string
 *                             example: "16100"
 *                           master_up3:
 *                             type: object
 *                             properties:
 *                               nama:
 *                                 type: string
 *                                 example: UP3 BANGKA
 *
 *             example:
 *               data:
 *                 getUlpByUp3:
 *                   - id: 16100
 *                     id_up3: 163
 *                     nama: ULP PANGKALPINANG
 *                     kode: "16100"
 *                     alamat: JL GARUDA
 *                     created_date: null
 *                     created_by: null
 *                     updated_date: null
 *                     updated_by: null
 *                     telepon: null
 *                     aktif: true
 *                     city: PANGKALPINANG
 *                     zip: null
 *                     mobile: null
 *                     fax: null
 *                     email: null
 *                     unit_ap2t: "16100"
 *                     master_up3:
 *                       nama: UP3 BANGKA
 *
 *                   - id: 16110
 *                     id_up3: 163
 *                     nama: ULP SUNGAILIAT
 *                     kode: "16110"
 *                     alamat: JL AHMAD YANI JALUR II
 *                     created_date: null
 *                     created_by: null
 *                     updated_date: null
 *                     updated_by: null
 *                     telepon: null
 *                     aktif: true
 *                     city: SUNGAILIAT
 *                     zip: null
 *                     mobile: null
 *                     fax: null
 *                     email: null
 *                     unit_ap2t: "16110"
 *                     master_up3:
 *                       nama: UP3 BANGKA
 *
 *       400:
 *         description: Parameter id_up3 tidak valid
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: id_up3 harus berupa integer.
 *
 *       401:
 *         description: Session belum login atau token expired
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: Belum login / Token Expired.
 *
 *       500:
 *         description: Gagal mengambil data ULP
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: Gagal mengambil data ULP dari server APKT.
 *               error: Request failed with status code 500
 */
app.post('/api/v1/master/ulp', async (req, res) => {
    if (
        !session.authToken ||
        session.statusToken !== 'Aktif'
    ) {
        return res.status(401).json({
            status: false,
            message: 'Belum login / Token Expired.'
        });
    }

    const body = req.body || {};

    if (
        body.id_up3 === undefined ||
        body.id_up3 === null ||
        body.id_up3 === ''
    ) {
        return res.status(400).json({
            status: false,
            message: 'Parameter id_up3 wajib dikirim.'
        });
    }

    const idUp3 = Number(body.id_up3);

    if (!Number.isInteger(idUp3)) {
        return res.status(400).json({
            status: false,
            message: 'id_up3 harus berupa integer.'
        });
    }

    const queryUlp = `
        query getUlpByUp3($idUp3: BigInteger) {
            getUlpByUp3(idUp3: $idUp3) {
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

    try {
        const response = await axios.post(
            GRAPHQL_MASTER_URL,
            {
                query: queryUlp,
                variables: {
                    idUp3
                }
            },
            {
                headers: {
                    Authorization:
                        `Bearer ${session.authToken}`
                },
                timeout: 15000
            }
        );

        if (response.data?.errors) {
            return res.status(400).json({
                status: false,
                errors: response.data.errors
            });
        }

        return res.json(response.data);

    } catch (error) {
        if (
            error.response?.status === 401
        ) {
            db.prepare(`
                UPDATE app_session
                SET statusToken = 'Expired'
                WHERE id = 1
            `).run();

            session.statusToken = 'Expired';

            return res.status(401).json({
                status: false,
                message: 'Token expired'
            });
        }

        return res.status(500).json({
            status: false,
            message:
                'Gagal mengambil data ULP dari server APKT.',
            error: error.message
        });
    }
});

/**
 * @openapi
 * /api/v1/keluhan:
 *   post:
 *     summary: Mengambil data keluhan berdasarkan filter dashboard
 *     description: >
 *       Mengambil data keluhan melalui GraphQL APKT port 32269.
 *       Seluruh parameter filter berasal dari frontend/dashboard.
 *       Session backend hanya digunakan untuk Authorization Bearer Token.
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
 *                 example: 50
 *
 *               skip:
 *                 type: integer
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 total_data:
 *                   type: integer
 *                   example: 15
 *                 total_halaman:
 *                   type: integer
 *                   example: 1
 *                 data_keluhan:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 123456
 *                       no_laporan:
 *                         type: string
 *                         example: K1626090800017
 *                       nama_pelapor:
 *                         type: string
 *                         example: BP SAMSUL
 *                       permasalahan:
 *                         type: string
 *                         example: Gangguan listrik
 *                       waktu_lapor:
 *                         type: string
 *                         example: "18/09/2026 08:15:22"
 *                       status_akhir:
 *                         type: string
 *                         example: Selesai
 *                       alamat_pelanggan:
 *                         type: string
 *                         example: JL GARUDA
 *                       pelanggan_no_meter:
 *                         type: object
 *                         properties:
 *                           no_meter:
 *                             type: string
 *                             example: "161002085370"
 *                           nama:
 *                             type: string
 *                             example: "BP SAMSUL"
 *                           id_pelanggan:
 *                             type: string
 *                             example: "161002085370"
 *                       master_ulp:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 16100
 *                           nama:
 *                             type: string
 *                             example: ULP PANGKALPINANG
 *                           master_up3:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 example: 163
 *                               nama:
 *                                 type: string
 *                                 example: UP3 BANGKA
 *
 *             example:
 *               status: true
 *               total_data: 15
 *               total_halaman: 1
 *               data_keluhan:
 *                 - id: 123456
 *                   no_laporan: K1626090800017
 *                   nama_pelapor: BP SAMSUL
 *                   permasalahan: Gangguan listrik
 *                   waktu_lapor: "18/09/2026 08:15:22"
 *                   status_akhir: Selesai
 *                   alamat_pelanggan: JL GARUDA
 *                   pelanggan_no_meter:
 *                     no_meter: "161002085370"
 *                     nama: BP SAMSUL
 *                     id_pelanggan: "161002085370"
 *                   master_ulp:
 *                     id: 16100
 *                     nama: ULP PANGKALPINANG
 *                     master_up3:
 *                       id: 163
 *                       nama: UP3 BANGKA
 *
 *       400:
 *         description: Parameter tidak valid atau GraphQL error
 *         content:
 *           application/json:
 *             examples:
 *               invalidParameter:
 *                 summary: Parameter tidak valid
 *                 value:
 *                   status: false
 *                   message: id_ulp harus berupa integer.
 *
 *               graphqlError:
 *                 summary: GraphQL error
 *                 value:
 *                   status: false
 *                   errors:
 *                     - message: Contoh error dari GraphQL
 *
 *       401:
 *         description: Belum login atau token APKT telah expired
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: Token expired
 *
 *       500:
 *         description: Gagal mengambil data keluhan
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: Gagal mengambil data keluhan dari server APKT.
 *               error: Request failed with status code 500
 */
app.post('/api/v1/keluhan', async (req, res) => {
    if (
        !session.authToken ||
        session.statusToken !== 'Aktif'
    ) {
        return res.status(401).json({
            status: false,
            message: 'Belum login / Token Expired.'
        });
    }

    const body = req.body || {};

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

    const missingFields =
        requiredFields.filter(
            (field) =>
                body[field] === undefined ||
                body[field] === null ||
                body[field] === ''
        );

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message:
                'Parameter wajib belum lengkap.',
            missing_fields:
                missingFields
        });
    }

    const idUid = Number(body.id_uid);
    const userId = Number(body.user_id);
    const idUp3 = Number(body.id_up3);
    const idUlp = Number(body.id_ulp);
    const limit = Number(body.limit);
    const skip = Number(body.skip);

    if (!Number.isInteger(idUid)) {
        return res.status(400).json({
            status: false,
            message:
                'id_uid harus berupa integer.'
        });
    }

    if (!Number.isInteger(userId)) {
        return res.status(400).json({
            status: false,
            message:
                'user_id harus berupa integer.'
        });
    }

    if (!Number.isInteger(idUp3)) {
        return res.status(400).json({
            status: false,
            message:
                'id_up3 harus berupa integer.'
        });
    }

    if (!Number.isInteger(idUlp)) {
        return res.status(400).json({
            status: false,
            message:
                'id_ulp harus berupa integer.'
        });
    }

    if (!Number.isInteger(limit)) {
        return res.status(400).json({
            status: false,
            message:
                'limit harus berupa integer.'
        });
    }

    if (!Number.isInteger(skip)) {
        return res.status(400).json({
            status: false,
            message:
                'skip harus berupa integer.'
        });
    }

    const graphqlFilters = [
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

    if (
        body.status !== undefined &&
        body.status !== null &&
        body.status !== ''
    ) {
        graphqlFilters.push({
            field: 'status_akhir',
            value: [
                String(body.status)
            ]
        });
    }

    if (
        body.no_laporan !== undefined &&
        body.no_laporan !== null &&
        body.no_laporan !== ''
    ) {
        graphqlFilters.push({
            field: 'no_laporan',
            value: [
                String(body.no_laporan)
            ]
        });
    }

    if (
        body.nama_pelapor !== undefined &&
        body.nama_pelapor !== null &&
        body.nama_pelapor !== ''
    ) {
        graphqlFilters.push({
            field: 'nama_pelapor',
            value: [
                String(body.nama_pelapor)
            ]
        });
    }

    if (
        body.id_pelanggan !== undefined &&
        body.id_pelanggan !== null &&
        body.id_pelanggan !== ''
    ) {
        graphqlFilters.push({
            field:
                'pelanggan_no_meter.id_pelanggan',
            value: [
                String(body.id_pelanggan)
            ]
        });
    }

    if (
        body.no_meter !== undefined &&
        body.no_meter !== null &&
        body.no_meter !== ''
    ) {
        graphqlFilters.push({
            field:
                'pelanggan_no_meter.no_meter',
            value: [
                String(body.no_meter)
            ]
        });
    }

    const queryKeluhan = `
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

    try {
        console.log(
            '================================================'
        );

        console.log(
            '🔎 [KELUHAN] Request Dashboard'
        );

        console.log({
            idUid,
            userId,
            idUp3,
            idUlp,
            tanggal_mulai:
                body.tanggal_mulai,
            tanggal_selesai:
                body.tanggal_selesai,
            limit,
            skip
        });

        const response = await axios.post(
            GRAPHQL_KELUHAN_URL,
            {
                query: queryKeluhan,

                variables: {
                    search: {
                        skip,
                        take: limit,
                        sort: null,
                        requireTotalCount: true,

                        dateFrom:
                            body.tanggal_mulai,

                        dateTo:
                            body.tanggal_selesai,

                        isCreateDate: false,

                        filter:
                            graphqlFilters
                    },

                    userId,
                    idUid,
                    idUlp
                }
            },
            {
                headers: {
                    Authorization:
                        `Bearer ${session.authToken}`
                },
                timeout: 15000
            }
        );

        if (response.data?.errors) {
            console.error(
                '❌ GraphQL Error:',
                response.data.errors
            );

            return res.status(400).json({
                status: false,
                errors: response.data.errors
            });
        }

        const outData =
            response.data?.data
                ?.getMonitoringKeluhanAll;

        if (!outData) {
            return res.status(500).json({
                status: false,
                message:
                    'Response GraphQL tidak memiliki data.'
            });
        }

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
        if (
            error.response?.status === 401
        ) {
            db.prepare(`
                UPDATE app_session
                SET statusToken = 'Expired'
                WHERE id = 1
            `).run();

            session.statusToken =
                'Expired';

            return res.status(401).json({
                status: false,
                message: 'Token expired'
            });
        }

        console.error(
            '❌ [KELUHAN]',
            error.message
        );

        return res.status(500).json({
            status: false,
            message:
                'Gagal mengambil data keluhan dari server APKT.',
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 REST API running on port ${PORT}`);
    console.log(`📝 Swagger UI Docs available at http://localhost:${PORT}/api-docs`);
});