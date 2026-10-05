const env = require('../config/env');
const { db } = require('../config/database');
const { session, getSessionUser } = require('../config/session');
const { expireSession } = require('../middleware/auth');
const { formatDateOnly } = require('../utils/format');
const { fetchAllKeluhan } = require('./apkt');

// Dilempar bila session APKT belum aktif / profil user tidak lengkap.
class SessionUnavailableError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SessionUnavailableError';
    }
}

function getActiveScope() {
    if (!session.authToken || session.statusToken !== 'Aktif') {
        throw new SessionUnavailableError('Session APKT belum aktif.');
    }

    const user = getSessionUser();

    if (
        !user ||
        ![user.idUid, user.userId, user.idUp3, user.idUlp].every(
            Number.isInteger
        )
    ) {
        throw new SessionUnavailableError('Data user APKT belum lengkap.');
    }

    return user;
}

function getConfiguredRangeDays() {
    const row = db
        .prepare('SELECT tanggal_range_hari FROM whatsapp_monitor_config')
        .get();

    return Number(row?.tanggal_range_hari) || env.keluhan.rangeDays;
}

// Mengambil keluhan langsung dari APKT. Tidak ada yang disimpan ke database.
async function fetchLiveKeluhan({ rangeDays, extraFilters = [] } = {}) {
    const user = getActiveScope();

    const end = new Date();
    const start = new Date();

    start.setDate(start.getDate() - (rangeDays || getConfiguredRangeDays()));

    try {
        return await fetchAllKeluhan({
            token: session.authToken,
            idUid: user.idUid,
            userId: user.userId,
            idUlp: user.idUlp,
            tanggalMulai: formatDateOnly(start),
            tanggalSelesai: formatDateOnly(end),
            pageSize: env.keluhan.pollLimit,
            filters: [
                { field: 'master_ulp.master_up3.id', value: [user.idUp3] },
                { field: 'master_ulp.id', value: [user.idUlp] },
                ...extraFilters
            ]
        });
    } catch (error) {
        if (error.response?.status === 401) {
            expireSession(db, session);

            throw new SessionUnavailableError('Token APKT expired.');
        }

        throw error;
    }
}

module.exports = {
    SessionUnavailableError,
    getActiveScope,
    fetchLiveKeluhan
};
