import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, migrate } from '../src/db.js';

test('migrate создаёт таблицы и строку настроек по умолчанию', () => {
  const db = openDb(':memory:');
  migrate(db);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  for (const t of ['officials','topics','settings','blocked_slots','bookings']) {
    assert.ok(tables.includes(t), `нет таблицы ${t}`);
  }
  const s = db.prepare('SELECT * FROM settings WHERE id=1').get();
  assert.equal(s.weekday, 2);
  assert.equal(s.start_time, '12:00');
  assert.equal(s.slot_minutes, 20);
  assert.equal(s.slot_count, 5);
  assert.equal(s.weeks_ahead, 4);
});
