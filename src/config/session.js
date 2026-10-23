const { db } = require('./database');

const session = {
    sessionId: '',
    authToken: '',
    user: null
};

const PUBLIC_USER_FIELDS = [
    'userId',
    'idUid',
    'idUp3',
    'idUlp',
    'idPosko',
    'namaUid',
    'namaUp3',
    'namaUlp',
    'namaPosko',
    'employeeName',
    'username'
];

function parseSession(user) {
    if (!user || typeof user !== 'object' || Array.isArray(user)) {
        return null;
    }

    return Object.fromEntries(
        PUBLIC_USER_FIELDS.filter((key) => user[key] !== undefined).map(
            (key) => [key, user[key]]
        )
    );
}

function loadSession(sessionId) {
    const row = db
        .prepare(
            `
            SELECT *
            FROM user_sessions
            WHERE session_id = ?
            LIMIT 1
        `
        )
        .get(sessionId);

    if (!row) {
        console.log('📂 [SQLite3] Session tidak ditemukan.');
        return;
    }

    session.authToken = row.auth_token;
    session.user = row.session_data
        ? parseSession(JSON.parse(row.session_data))
        : null;

    console.log(
        `📂 [SQLite3] Session: ${session.user?.username} | User: ${
            session.user?.employeeName
        }`
    );
}

function loadAndReturnSession(sessionId) {
    loadSession(sessionId);
    return session;
}

function getSession(sessionId) {
    return session;
}

module.exports = {
    parseSession,
    loadAndReturnSession,
    getSession
};
