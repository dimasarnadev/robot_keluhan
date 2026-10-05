const Database = require('better-sqlite3');

const env = require('./env');
const { FINAL_STATUSES } = require('../services/apkt');

const db = new Database(env.databasePath);

db.pragma('journal_mode = WAL');

// Database TIDAK menyimpan data keluhan. Hanya jejak pemantauan:
// - keluhan_monitoring     : status terakhir + penanda notifikasi per laporan
// - keluhan_status_history : histori perubahan status
const MONITORING_SCHEMA = `
    CREATE TABLE IF NOT EXISTS keluhan_monitoring (
        no_laporan TEXT PRIMARY KEY,
        status_terakhir TEXT NOT NULL DEFAULT '',
        status_changed_at TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        is_final INTEGER NOT NULL DEFAULT 0,
        new_notified_at TEXT,
        last_reminder_at TEXT,
        updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_keluhan_monitoring_final
        ON keluhan_monitoring(is_final);

    CREATE TABLE IF NOT EXISTS keluhan_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        no_laporan TEXT NOT NULL,
        status_lama TEXT,
        status_baru TEXT NOT NULL,
        changed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_keluhan_status_history_no
        ON keluhan_status_history(no_laporan, id);
`;

db.exec(`
    CREATE TABLE IF NOT EXISTS app_session (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        authToken TEXT,
        statusToken TEXT,
        user_json TEXT,
        updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS whatsapp_bot (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_name TEXT NOT NULL UNIQUE,
        phone_number TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS whatsapp_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL UNIQUE,
        group_name TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,

        notify_new INTEGER NOT NULL DEFAULT 1,
        notify_reminder INTEGER NOT NULL DEFAULT 1,
        command_enabled INTEGER NOT NULL DEFAULT 1,

        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS whatsapp_monitor_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),

        id_uid INTEGER,
        user_id INTEGER,
        id_up3 INTEGER,
        id_ulp INTEGER,

        tanggal_range_hari INTEGER NOT NULL DEFAULT 7,

        enabled INTEGER NOT NULL DEFAULT 1,

        updated_at TEXT
    );
`);

// Migrasi sekali jalan: tabel lama menyimpan raw_data (payload keluhan).
// Isinya dikonversi menjadi status + histori awal, lalu tabel lama dihapus.
function migrateLegacyMonitoring() {
    const columns = db.prepare('PRAGMA table_info(keluhan_monitoring)').all();

    if (!columns.some((column) => column.name === 'raw_data')) {
        return;
    }

    const placeholders = FINAL_STATUSES.map(() => '?').join(', ');

    db.transaction(() => {
        db.exec(
            'ALTER TABLE keluhan_monitoring RENAME TO keluhan_monitoring_legacy'
        );

        db.exec(MONITORING_SCHEMA);

        db.prepare(
            `
            INSERT INTO keluhan_monitoring (
                no_laporan,
                status_terakhir,
                status_changed_at,
                first_seen_at,
                last_seen_at,
                is_final,
                new_notified_at,
                last_reminder_at,
                updated_at
            )
            SELECT
                no_laporan,
                COALESCE(status_terakhir, status, ''),
                COALESCE(status_changed_at, first_seen_at),
                first_seen_at,
                COALESCE(last_seen_at, first_seen_at),
                CASE
                    WHEN TRIM(COALESCE(status_terakhir, status, ''))
                        IN (${placeholders}) THEN 1
                    ELSE 0
                END,
                COALESCE(last_notified_new_at, first_seen_at),
                last_reminder_at,
                COALESCE(last_seen_at, first_seen_at)
            FROM keluhan_monitoring_legacy
        `
        ).run(...FINAL_STATUSES);

        db.exec(`
            INSERT INTO keluhan_status_history (
                no_laporan, status_lama, status_baru, changed_at
            )
            SELECT no_laporan, NULL, status_terakhir, status_changed_at
            FROM keluhan_monitoring
        `);

        db.exec('DROP TABLE keluhan_monitoring_legacy');
    })();

    console.log('🗄️ Migrasi keluhan_monitoring (tanpa raw_data) selesai.');
}

migrateLegacyMonitoring();

db.exec(MONITORING_SCHEMA);

module.exports = { db };
