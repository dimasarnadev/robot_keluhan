require('dotenv').config();

const path = require('path');

const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');

const { db } = require('./config/database');
const { loadAndReturnSession } = require('./config/session');

const authRoutes = require('./api/auth');
const keluhanRoutes = require('./api/keluhan');
const masterRoutes = require('./api/master');
const whatsappRoutes = require('./api/whatsapp');

const { startScheduler, stopScheduler } = require('./jobs/scheduler');
const swaggerSpec = require('./swagger/swagger');
const { start } = require('repl');

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
                'upgrade-insecure-requests': null
            }
        }
    })
);

// Tanpa CORS_ORIGIN, hanya same-origin yang diizinkan.
app.use(
    cors({
        origin: false
    })
);

app.use(express.json({ limit: '100kb' }));

const session = loadAndReturnSession(process.env.SESSION_ID);

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

app.listen(process.env.PORT || 3000, () => {
    console.log(`🚀 REST API running on port ${process.env.PORT || 3000}`);
    console.log(
        `📚 Swagger: http://localhost:${process.env.PORT || 3000}/api-docs`
    );
    console.log(
        `📱 WAHA webhook: http://localhost:${process.env.PORT || 3000}/api/v1/whatsapp/webhook`
    );

    startScheduler();
});

process.on('SIGTERM', () => {
    server.close(() => {
        stopScheduler();
        db.close();
        process.exit(0);
    });
});
