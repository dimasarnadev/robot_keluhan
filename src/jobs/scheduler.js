const { db } = require('../config/database');
const { parseSession, getSession } = require('../config/session');
const {
    postKeluhan,
    STATUS_KELUHAN,
    CLOSE_STATUS_KELUHAN
} = require('../services/keluhan');
const {
    postGangguan,
    STATUS_GANGGUAN,
    CLOSE_STATUS_GANGGUAN
} = require('../services/gangguan');
const {
    notifyKeluhanBaru,
    notifyReminder,
    notifyStatusChange,
    notifyGangguanBaru,
    notifyGangguanStatusChange
} = require('../bot/notifier');
const { formatDateOnly } = require('../utils/format');

const INTERVAL_MAP = {
    fast: 1 * 60 * 1000, // 1 menit
    short: 5 * 60 * 1000, // 5 menit
    medium: 15 * 60 * 1000, // 15 menit
    long: 30 * 60 * 1000 // 30 menit
};

const getAllJobs = db.prepare(`
    SELECT s.auth_token, s.session_data, j.id, j.job_name, j.worker_name, j.worker_type, j.enabled
    FROM jobs_poller as j
    INNER JOIN user_sessions as s
    on j.session_id = s.session_id;
`);

const getKeluhanByNoLaporan = db.prepare(`
    SELECT *
    FROM keluhan
    WHERE no_laporan = ?
    LIMIT 1
`);

const addKeluhan = db.prepare(`
    INSERT INTO keluhan (no_laporan, status_akhir, created_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

const updateKeluhanStatus = db.prepare(`
    UPDATE keluhan
    SET status_akhir = ?, updated_at = CURRENT_TIMESTAMP
    WHERE no_laporan = ?
`);

const getGangguanByNoLaporan = db.prepare(`
    SELECT *
    FROM gangguan
    WHERE no_laporan = ?
    LIMIT 1
`);

const addGangguan = db.prepare(`
    INSERT INTO gangguan (no_laporan, status_akhir, created_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

const updateGangguanStatus = db.prepare(`
    UPDATE gangguan
    SET status_akhir = ?, updated_at = CURRENT_TIMESTAMP
    WHERE no_laporan = ?
`);

const keluhanPerluReminder = db.prepare(`
    SELECT *
    FROM keluhan
    WHERE status_akhir NOT IN (${CLOSE_STATUS_KELUHAN.map((s) => `'${s}'`).join(', ')})
      AND updated_at <= datetime('now', '-15 minutes')
      AND updated_at > datetime('now', '-17 minutes')
`);

const workers = {
    pollingKeluhan: async (token, session, jobName) => {
        console.log(
            `[${session.username}] Running pollingKeluhan for ${jobName}`
        );

        const dateNow = new Date();
        const tanggalMulai = formatDateOnly(
            new Date(dateNow.getTime() - 24 * 60 * 60 * 1000)
        );
        const tanggalSelesai = formatDateOnly(dateNow);

        const result = await postKeluhan({
            token,
            idUid: session.idUid,
            userId: session.userId,
            idUlp: session.idUlp,
            tanggalMulai: tanggalMulai,
            tanggalSelesai: tanggalSelesai
        });

        if (result.status) {
            const keluhanBaru = [];
            const keluhanStatusBerubah = [];

            const syncKeluhan = db.transaction((keluhans) => {
                keluhans.forEach((keluhan) => {
                    const existing = getKeluhanByNoLaporan.get(
                        keluhan.no_laporan
                    );
                    if (existing) {
                        if (existing.status_akhir !== keluhan.status_akhir) {
                            updateKeluhanStatus.run(
                                keluhan.status_akhir,
                                keluhan.no_laporan
                            );
                            keluhanStatusBerubah.push(keluhan);
                        }
                    } else {
                        addKeluhan.run(
                            keluhan.no_laporan,
                            keluhan.status_akhir
                        );
                        keluhanBaru.push(keluhan);
                    }
                });
            });

            syncKeluhan(result.data);
            const keluhanBelumProses = keluhanPerluReminder.all();

            keluhanBaru.forEach((keluhan) => {
                notifyKeluhanBaru(session.userId, keluhan);
            });

            keluhanStatusBerubah.forEach((keluhan) => {
                notifyStatusChange(session.userId, keluhan);
            });

            keluhanBelumProses.forEach((keluhan) => {
                const data = result.data.find(
                    (k) => k.no_laporan === keluhan.no_laporan
                );
                if (data) {
                    notifyReminder(session.userId, data);
                }
            });

            console.log(
                `[${session.username}] pollingKeluhan completed. Baru: ${keluhanBaru.length}, Status berubah: ${keluhanStatusBerubah.length}, Belum proses lebih lanjut: ${keluhanBelumProses.length}`
            );
        }
    },

    pollingGangguan: async (token, session, jobName) => {
        console.log(
            `[${session.username}] Running pollingGangguan for ${jobName}`
        );

        const dateNow = new Date();
        const tanggalMulai = formatDateOnly(
            new Date(dateNow.getTime() - 24 * 60 * 60 * 1000)
        );
        const tanggalSelesai = formatDateOnly(dateNow);

        const result = await postGangguan({
            token,
            idUid: session.idUid,
            userId: session.userId,
            idPosko: session.idPosko,
            tanggalMulai: tanggalMulai,
            tanggalSelesai: tanggalSelesai
        });

        if (result.status) {
            const gangguanBaru = [];
            const gangguanStatusBerubah = [];

            const syncGangguan = db.transaction((gangguans) => {
                gangguans.forEach((gangguan) => {
                    const existing = getGangguanByNoLaporan.get(
                        gangguan.no_laporan
                    );
                    if (existing) {
                        if (existing.status_akhir !== gangguan.status_akhir) {
                            updateGangguanStatus.run(
                                gangguan.status_akhir,
                                gangguan.no_laporan
                            );
                            gangguanStatusBerubah.push(gangguan);
                        }
                    } else {
                        addGangguan.run(
                            gangguan.no_laporan,
                            gangguan.status_akhir
                        );
                        gangguanBaru.push(gangguan);
                    }
                });
            });

            syncGangguan(result.data);

            gangguanBaru.forEach((gangguan) => {
                notifyGangguanBaru(session.userId, gangguan);
            });

            gangguanStatusBerubah.forEach((gangguan) => {
                notifyGangguanStatusChange(session.userId, gangguan);
            });

            console.log(
                `[${session.username}] pollingGangguan completed. Baru: ${gangguanBaru.length}, Status berubah: ${gangguanStatusBerubah.length}`
            );
        }
    }
};

const activeJobs = new Map();

function startJob(jobKey, job) {
    const { auth_token, session_data, job_name, worker_name, worker_type } =
        job;

    const token = auth_token;
    const session = parseSession(JSON.parse(session_data));
    const intervalMs = INTERVAL_MAP[worker_type];
    const workerFunction = workers[worker_name];

    if (!workerFunction) {
        console.error(`Worker ${worker_name} tidak ditemukan!`);
        return;
    }

    const intervalId = setInterval(async () => {
        try {
            await workerFunction(token, session, job_name);
        } catch (error) {
            console.error(`Error executing job ${jobKey}:`, error);
        }
    }, intervalMs);

    activeJobs.set(jobKey, intervalId);
    console.log(`Job STARTED: ${jobKey} [${worker_type}]`);
}

function stopJob(jobKey) {
    if (activeJobs.has(jobKey)) {
        clearInterval(activeJobs.get(jobKey));
        activeJobs.delete(jobKey);
        console.log(`Job STOPPED: ${jobKey}`);
    }
}

async function syncJobsFromDB() {
    const allJobsInDb = getAllJobs.all();

    const currentDbJobKeys = new Set();

    allJobsInDb.forEach((job) => {
        const jobKey = `${job.id}_${job.job_name}`;
        currentDbJobKeys.add(jobKey);

        const isCurrentlyRunning = activeJobs.has(jobKey);

        if (job.enabled && !isCurrentlyRunning) {
            startJob(jobKey, job);
        } else if (!job.enabled && isCurrentlyRunning) {
            stopJob(jobKey);
        }
    });

    for (const [activeKey] of activeJobs.entries()) {
        if (!currentDbJobKeys.has(activeKey)) {
            stopJob(activeKey);
        }
    }
}

function startScheduler() {
    console.log('Scheduler started...');
    syncJobsFromDB();
    setInterval(syncJobsFromDB, 60 * 1000);
}

function stopScheduler() {
    console.log('Stopping all jobs...');
    for (const [jobKey] of activeJobs.entries()) {
        stopJob(jobKey);
    }
    console.log('Scheduler stopped.');
}

module.exports = {
    startScheduler,
    stopScheduler
};
