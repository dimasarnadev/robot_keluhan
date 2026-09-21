const Database = require('better-sqlite3');

const db = new Database(
    process.env.DATABASE_PATH || './database.sqlite'
);

db.pragma('journal_mode = WAL');

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

    CREATE TABLE IF NOT EXISTS keluhan_monitoring (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        no_laporan TEXT NOT NULL UNIQUE,

        id_uid INTEGER,
        user_id INTEGER,
        id_up3 INTEGER,
        id_ulp INTEGER,

        tanggal_mulai TEXT,
        tanggal_selesai TEXT,

        nama_pelapor TEXT,
        id_pelanggan TEXT,
        no_meter TEXT,

        status TEXT,
        status_terakhir TEXT,

        status_changed_at TEXT,

        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT,

        last_notified_new_at TEXT,
        last_reminder_at TEXT,

        raw_data TEXT,

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

module.exports = {
    db
};