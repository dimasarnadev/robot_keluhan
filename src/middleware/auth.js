function requireAuth(session) {
    return (req, res, next) => {
        if (session.authToken !== '') {
            return next();
        }

        return res.status(401).json({
            status: false,
            message: 'Belum login. Silakan login terlebih dahulu.'
        });
    };
}

function expireSession(db, session) {
    db.prepare(
        `
        UPDATE user_sessions
        SET auth_token = ''
        WHERE id = ?
    `
    ).run(session.sessionId);
}

function respondUpstreamError(res, error, { db, session, label }) {
    if (error.response?.status === 401) {
        expireSession(db, session);

        console.warn(`[${label}] 🔐 Token APKT expired`);

        return res.status(401).json({
            status: false,
            message: 'Token expired'
        });
    }

    if (error.code === 'ECONNABORTED') {
        console.error(`[${label}] ⏱️ APKT timeout`);

        return res.status(504).json({
            status: false,
            message: 'Server APKT tidak merespons dalam waktu yang ditentukan.'
        });
    }

    if (error.graphqlErrors) {
        console.error(`[${label}] ❌ GraphQL Error:`, error.graphqlErrors);

        return res.status(400).json({
            status: false,
            errors: error.graphqlErrors.map((item) => ({
                message: String(item?.message || 'GraphQL error')
            }))
        });
    }

    if (error.response || error.request) {
        console.error(`[${label}] ❌ APKT tidak dapat diakses:`, error.message);

        return res.status(502).json({
            status: false,
            message:
                'Server APKT mengalami gangguan atau tidak dapat dihubungi.'
        });
    }

    console.error(`[${label}] ❌ Internal Error:`, error.message);

    return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan internal.'
    });
}

module.exports = {
    requireAuth,
    expireSession,
    respondUpstreamError
};
