const { db } = require('./database');

const session = {
    authToken: '',
    user: null,
    statusToken: 'Belum Login',
    captchaId: ''
};

function loadSessionFromDB() {

    const row = db
        .prepare(`
            SELECT *
            FROM app_session
            WHERE id = 1
        `)
        .get();

    if (!row) {

        console.log(
            '📂 [SQLite3] Tidak ada session tersimpan.'
        );

        return;
    }

    session.authToken =
        row.authToken || '';

    session.statusToken =
        row.statusToken || 'Belum Login';

    try {

        session.user =
            row.user_json
                ? JSON.parse(row.user_json)
                : null;

    } catch (error) {

        console.error(
            '❌ [SQLite3] user_json tidak valid:',
            error.message
        );

        session.user = null;
        session.authToken = '';
        session.statusToken =
            'Belum Login';
    }

    console.log(
        `📂 [SQLite3] Session: ${
            session.statusToken
        } | User: ${
            session.user?.employeeName || '-'
        }`
    );
}


/**
 * Mengambil informasi user APKT
 * yang sedang tersimpan di session.
 */
function getSessionUser() {

    const user = session.user;

    if (!user) {
        return null;
    }

    return {
        idUid: Number(user.idUid),
        userId: Number(user.userId),
        idUp3: Number(user.idUp3),
        idUlp: Number(user.idUlp),

        namaUid: user.namaUid || '',
        namaUp3: user.namaUp3 || '',
        namaUlp: user.namaUlp || '',

        employeeName:
            user.employeeName || '',

        phone:
            user.phone || '',

        username:
            user.username || ''
    };
}


module.exports = {
    session,
    loadSessionFromDB,
    getSessionUser
};