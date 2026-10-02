require('dotenv').config();

const path = require('path');

const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const { db } = require('./config/database');
const { session, loadSessionFromDB } = require('./config/session');

const authRoutes = require('./api/auth');
const keluhanRoutes = require('./api/keluhan');
const masterRoutes = require('./api/master');
const whatsappRoutes = require('./api/whatsapp');

const { startKeluhanPoller } = require('./jobs/keluhan-poller');
const swaggerSpec = require('./swagger/swagger');

const app = express();

app.disable('x-powered-by');

// Swagger dipasang sebelum helmet karena UI-nya memerlukan inline script.
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/api-docs.json', (req, res) => {
    res.json(swaggerSpec);
});

// Security header dan Content-Security-Policy.
app.use(
    helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                'img-src': ["'self'", 'data:'],
                // Server dijalankan lewat HTTP di jaringan internal.
                'upgrade-insecure-requests': null
            }
        }
    })
);

// Tanpa CORS_ORIGIN, hanya same-origin yang diizinkan.
app.use(
    cors({
        origin: env.corsOrigins.length ? env.corsOrigins : false
    })
);

app.use(express.json({ limit: '100kb' }));

loadSessionFromDB();

// Batasi percobaan login (mencegah brute force).
app.use(
    '/api/v1/auth/login',
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            status: false,
            message: 'Terlalu banyak percobaan login. Coba lagi nanti.'
        }
    })
);

app.use('/api/v1/auth', authRoutes({ db, session }));
app.use('/api/v1/master', masterRoutes({ db, session }));
app.use('/api/v1', keluhanRoutes({ db, session }));
app.use('/api/v1/whatsapp', whatsappRoutes({ db, session }));

// Frontend hasil build
app.use(express.static(path.join(__dirname, 'public')));

// Penanganan error umum (JSON rusak, body terlalu besar, dan lainnya).
app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            status: false,
            message: 'Format JSON tidak valid.'
        });
    }

    if (error.type === 'entity.too.large') {
        return res.status(413).json({
            status: false,
            message: 'Ukuran request terlalu besar.'
        });
    }

    console.error('❌ Unhandled error:', error.message);

    return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan internal.'
    });
});

app.listen(env.port, () => {
    console.log(`🚀 REST API running on port ${env.port}`);
    console.log(`📚 Swagger: http://localhost:${env.port}/api-docs`);
    console.log(
        `📱 WAHA webhook: http://localhost:${env.port}/api/v1/whatsapp/webhook`
    );

    startKeluhanPoller();
});
