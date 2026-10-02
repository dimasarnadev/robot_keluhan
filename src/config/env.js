function toPositiveInt(value, fallback) {
    const number = Number(value);

    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function toList(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

const port = toPositiveInt(process.env.PORT, 3001);

module.exports = {
    port,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${port}`,
    corsOrigins: toList(process.env.CORS_ORIGIN),
    databasePath: process.env.DATABASE_PATH || './database.sqlite',

    authBaseUrl: process.env.AUTH_BASE_URL || '',
    graphqlMasterUrl: process.env.GRAPHQL_MASTER_URL || '',
    graphqlKeluhanUrl: process.env.GRAPHQL_KELUHAN_URL || '',
    requestTimeout: toPositiveInt(process.env.GRAPHQL_TIMEOUT_MS, 15000),

    webhookSecret: process.env.WAHA_WEBHOOK_SECRET || '',

    waha: {
        url: process.env.WAHA_URL || 'http://localhost:3000',
        session: process.env.WAHA_SESSION || 'default',
        apiKey: process.env.WAHA_API_KEY || ''
    },

    typing: {
        minMs: toPositiveInt(process.env.TYPING_DELAY_MIN_MS, 3000),
        maxMs: toPositiveInt(process.env.TYPING_DELAY_MAX_MS, 20000),
        charsPerSecond: toPositiveInt(
            process.env.TYPING_DELAY_CHARS_PER_SECOND,
            6
        )
    },

    keluhan: {
        pollInterval: toPositiveInt(
            process.env.KELUHAN_POLL_INTERVAL_MS,
            60000
        ),
        reminderInterval: toPositiveInt(
            process.env.KELUHAN_REMINDER_INTERVAL_MS,
            900000
        ),
        pollLimit: toPositiveInt(process.env.KELUHAN_POLL_LIMIT, 100),
        rangeDays: toPositiveInt(process.env.KELUHAN_RANGE_DAYS, 7)
    }
};
