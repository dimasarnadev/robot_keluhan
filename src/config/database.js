const Database = require('better-sqlite3');

const db = new Database('data.db');

// Pragmas first — always
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -20000');
db.pragma('temp_store = MEMORY');

// Migration tracking table
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT DEFAULT (datetime('now'))
  )
`);

function migrate(name, sql) {
    const exists = db
        .prepare('SELECT 1 FROM _migrations WHERE name = ?')
        .get(name);
    if (!exists) {
        const run = db.transaction(() => {
            db.exec(sql);
            db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
        });
        run();
        console.log(`Migration applied: ${name}`);
    }
}

// Migrations in order
migrate(
    '001_user_sessions',
    `
  CREATE TABLE user_sessions (
    session_id TEXT PRIMARY KEY,
    auth_token TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    username TEXT,
    email TEXT,
    session_data TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL
  ) STRICT;
`
);

migrate(
    '002_transactions',
    `
  CREATE TABLE keluhan (
    id INTEGER PRIMARY KEY,
    no_laporan TEXT NOT NULL,
    status_akhir TEXT NOT NULL
      CHECK (status_akhir IN (
        'Batal',
        'Konfirmasi',
        'Dalam Proses Pengiriman Email',
        'Menunggu Tanggapan Supervisor CC',
        'Dalam Proses Manager Unit',
        'Dalam Proses Bidang Unit',
        'Selesai Dijawab Bidang Unit',
        'Selesai'
      )),
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL
  ) STRICT;

  CREATE TABLE gangguan (
    id INTEGER PRIMARY KEY,
    no_laporan TEXT NOT NULL,
    status_akhir TEXT NOT NULL
      CHECK (status_akhir IN (
        'Lapor',
        'Menunggu Konfirmasi',
        'Penugasan Regu',
        'Dalam Perjalanan',
        'Dalam Pengerjaan',
        'Nyala',
        'Nyala Sementara',
        'Selesai',
        'Dibatalkan'
      )),
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL
  ) STRICT;

  CREATE INDEX idx_keluhan_no_laporan ON keluhan(no_laporan);
  CREATE INDEX idx_gangguan_no_laporan ON gangguan(no_laporan);
`
);

migrate(
    '003_whatsapp_groups',
    `
  CREATE TABLE whatsapp_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES user_sessions(user_id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL
  ) STRICT;

  CREATE INDEX idx_whatsapp_groups_user_id ON whatsapp_groups(user_id);
`
);

migrate(
    '004_jobs_poller',
    `
  CREATE TABLE jobs_poller (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES user_sessions(session_id) ON DELETE CASCADE,
    job_name TEXT NOT NULL,
    worker_name TEXT NOT NULL,
    worker_type TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL
  ) STRICT;

  CREATE INDEX idx_jobs_poller_session_id ON jobs_poller(session_id);
`
);

migrate(
    '005_gangguan_add_status_akhir',
    `
  -- 1. Create the new table with the updated CHECK constraint
    CREATE TABLE gangguan_new (
        id INTEGER PRIMARY KEY,
        no_laporan TEXT NOT NULL,
        status_akhir TEXT NOT NULL
        CHECK (status_akhir IN (
            'Lapor',
            'Menunggu Konfirmasi',
            'Penugasan Regu',
            'Dalam Perjalanan',
            'Dalam Pengerjaan',
            'Nyala',
            'Nyala Sementara',
            'Selesai',
            'Selesai(PEMADAMAN MELUAS)', -- New status added here
            'Dibatalkan'
        )),
        created_at TEXT DEFAULT (datetime('now')) NOT NULL,
        updated_at TEXT DEFAULT (datetime('now')) NOT NULL
    ) STRICT;

    -- 2. Copy all data from the existing table into the new table
    INSERT INTO gangguan_new (id, no_laporan, status_akhir, created_at, updated_at)
    SELECT id, no_laporan, status_akhir, created_at, updated_at 
    FROM gangguan;

    -- 3. Drop the old table
    DROP TABLE gangguan;

    -- 4. Rename the new table to the original table name
    ALTER TABLE gangguan_new RENAME TO gangguan;

    -- 5. Recreate the index on the new table
    CREATE INDEX idx_gangguan_no_laporan ON gangguan(no_laporan);
`
);

migrate(
    '006_gangguan_add_status_akhir_selesai_gangguan_sistem',
    `
  -- 1. Create the new table with the updated CHECK constraint
    CREATE TABLE gangguan_new (
        id INTEGER PRIMARY KEY,
        no_laporan TEXT NOT NULL,
        status_akhir TEXT NOT NULL
        CHECK (status_akhir IN (
            'Lapor',
            'Menunggu Konfirmasi',
            'Penugasan Regu',
            'Dalam Perjalanan',
            'Dalam Pengerjaan',
            'Nyala',
            'Nyala Sementara',
            'Selesai',
            'Selesai(PEMADAMAN MELUAS)',
            'Selesai(GANGGUAN SISTEM)',
            'Dibatalkan'
        )),
        created_at TEXT DEFAULT (datetime('now')) NOT NULL,
        updated_at TEXT DEFAULT (datetime('now')) NOT NULL
    ) STRICT;

    -- 2. Copy all data from the existing table into the new table
    INSERT INTO gangguan_new (id, no_laporan, status_akhir, created_at, updated_at)
    SELECT id, no_laporan, status_akhir, created_at, updated_at 
    FROM gangguan;

    -- 3. Drop the old table
    DROP TABLE gangguan;

    -- 4. Rename the new table to the original table name
    ALTER TABLE gangguan_new RENAME TO gangguan;

    -- 5. Recreate the index on the new table
    CREATE INDEX idx_gangguan_no_laporan ON gangguan(no_laporan);
`
);

module.exports = {
    db
};
