import Database from 'better-sqlite3';

export function openDb(path = 'data/app.sqlite') {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS officials (
      id INTEGER PRIMARY KEY,
      full_name TEXT NOT NULL,
      position TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      emoji TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      official_id INTEGER NOT NULL REFERENCES officials(id),
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      slot_minutes INTEGER NOT NULL,
      slot_count INTEGER NOT NULL,
      weeks_ahead INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blocked_slots (
      id INTEGER PRIMARY KEY,
      official_id INTEGER NOT NULL REFERENCES officials(id),
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      UNIQUE(official_id, date, time)
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY,
      official_id INTEGER NOT NULL REFERENCES officials(id),
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      question TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_slot
      ON bookings(official_id, date, time) WHERE status != 'cancelled';
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_phone_time
      ON bookings(phone, date, time) WHERE status != 'cancelled';
  `);
  const hasSettings = db.prepare('SELECT 1 FROM settings WHERE id=1').get();
  if (!hasSettings) {
    db.prepare(`INSERT INTO settings(id,weekday,start_time,slot_minutes,slot_count,weeks_ahead)
                VALUES(1,2,'12:00',20,5,4)`).run();
  }
}
