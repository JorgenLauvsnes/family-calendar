import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(process.cwd(), 'data');

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

function createAndMigrateDb(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new Database(path.join(DATA_DIR, 'calendar.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      name                TEXT    NOT NULL,
      role                TEXT    NOT NULL CHECK(role IN ('adult', 'child')),
      birthdate           TEXT,
      color               TEXT    NOT NULL DEFAULT '#2563EB',
      avatar_initials     TEXT,
      institution_name    TEXT,
      institution_address TEXT,
      gcal_calendar_id    TEXT,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS google_tokens (
      member_id     INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
      access_token  TEXT    NOT NULL,
      refresh_token TEXT    NOT NULL,
      token_type    TEXT    NOT NULL DEFAULT 'Bearer',
      scope         TEXT    NOT NULL DEFAULT '',
      expires_at    TEXT    NOT NULL,
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id   INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      label       TEXT    NOT NULL,
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
      start_time  TEXT    NOT NULL,
      end_time    TEXT    NOT NULL,
      location    TEXT,
      category    TEXT    NOT NULL DEFAULT 'work',
      active      INTEGER NOT NULL DEFAULT 1,
      valid_from  TEXT,
      valid_until TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      title                TEXT    NOT NULL,
      description          TEXT,
      category             TEXT    NOT NULL DEFAULT 'other',
      start_datetime       TEXT    NOT NULL,
      end_datetime         TEXT    NOT NULL,
      all_day              INTEGER NOT NULL DEFAULT 0,
      location             TEXT,
      color_override       TEXT,
      source               TEXT    NOT NULL DEFAULT 'manual'
                           CHECK(source IN ('manual', 'google', 'generated')),
      gcal_event_id        TEXT,
      schedule_id          INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
      created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS event_members (
      event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      member_id   INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      PRIMARY KEY (event_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_events_start    ON events(start_datetime);
    CREATE INDEX IF NOT EXISTS idx_events_source   ON events(source);
    CREATE INDEX IF NOT EXISTS idx_events_gcal_id  ON events(gcal_event_id);
    CREATE INDEX IF NOT EXISTS idx_em_member       ON event_members(member_id);
    CREATE INDEX IF NOT EXISTS idx_sched_member    ON schedules(member_id);
    CREATE INDEX IF NOT EXISTS idx_sched_dow       ON schedules(day_of_week);
  `);

  // Seed default settings
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  const defaultSettings: [string, string][] = [
    ['family_name', 'Familien'],
    ['weather_lat', '63.4350'],
    ['weather_lon', '10.5167'],
    ['weather_location', 'Ranheim, Trondheim'],
    ['vacation_mode', '0'],
    ['vacation_lat', ''],
    ['vacation_lon', ''],
    ['vacation_location', ''],
    ['admin_password_hash', ''],
    ['display_wake_lock', '1'],
    ['google_sync_interval_minutes', '30'],
  ];
  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value);
  }

  // Set default admin password on first run
  const hashRow = db
    .prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'")
    .get() as { value: string } | undefined;
  if (!hashRow?.value) {
    const initialPassword =
      process.env.INITIAL_ADMIN_PASSWORD || 'familie';
    const hash = bcrypt.hashSync(initialPassword, 10);
    db.prepare(
      "UPDATE settings SET value = ? WHERE key = 'admin_password_hash'"
    ).run(hash);
  }

  // Seed default family members if table is empty
  const count = (
    db.prepare('SELECT COUNT(*) as c FROM members').get() as { c: number }
  ).c;
  if (count === 0) {
    const ins = db.prepare(
      `INSERT INTO members (name, role, color, avatar_initials)
       VALUES (?, ?, ?, ?)`
    );
    const defaultMembers: [string, string, string, string][] = [
      ['Jørgen', 'adult', '#2563EB', 'JØ'],
      ['Kine', 'adult', '#DB2777', 'KI'],
      ['Markus', 'child', '#0D9488', 'MA'],
      ['Jorunn Lovise', 'child', '#7C3AED', 'JL'],
      ['Vilde', 'child', '#EA580C', 'VI'],
      ['Victor', 'child', '#16A34A', 'VC'],
    ];
    for (const [name, role, color, initials] of defaultMembers) {
      ins.run(name, role, color, initials);
    }
  }

  return db;
}

export function getDb(): Database.Database {
  if (!global.__db) {
    global.__db = createAndMigrateDb();
  }
  return global.__db;
}

export default getDb;
