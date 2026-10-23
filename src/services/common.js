const { formatDateOnly } = require('../utils/format');

function resolveDefaultDateRange({
    tanggalMulai,
    tanggalSelesai,
    rangeDays = Number(process.env.POLL_RANGE_DAYS || 1)
} = {}) {
    const dateNow = new Date();

    const start =
        tanggalMulai ||
        formatDateOnly(
            new Date(dateNow.getTime() - rangeDays * 24 * 60 * 60 * 1000)
        );
    const end = tanggalSelesai || formatDateOnly(dateNow);

    return {
        tanggalMulai: start,
        tanggalSelesai: end
    };
}

function resolveSessionDefaults(session, params = {}) {
    const sessionObj = session && typeof session === 'object' ? session : {};
    const sessionUser = sessionObj.user ?? {};

    return {
        token: params.token ?? sessionObj.authToken ?? null,
        idUid: params.idUid ?? sessionUser.idUid ?? null,
        userId: params.userId ?? sessionUser.userId ?? null,
        idUlp: params.idUlp ?? sessionUser.idUlp ?? null,
        idPosko: params.idPosko ?? sessionUser.idPosko ?? null,
        ...params
    };
}

module.exports = {
    resolveDefaultDateRange,
    resolveSessionDefaults
};
