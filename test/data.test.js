import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, migrate } from '../src/db.js';
import { CATALOG, seedCatalog } from '../src/data.js';

test('каталог содержит 10 тем с уникальными слагами', () => {
  assert.equal(CATALOG.length, 10);
  const slugs = new Set(CATALOG.map(c => c.slug));
  assert.equal(slugs.size, 10);
});

test('seedCatalog создаёт темы и связанных руководителей', () => {
  const db = openDb(':memory:'); migrate(db); seedCatalog(db);
  const topics = db.prepare('SELECT COUNT(*) c FROM topics').get().c;
  const offs = db.prepare('SELECT COUNT(*) c FROM officials').get().c;
  assert.equal(topics, 10);
  assert.equal(offs, 10);
  const zhkh = db.prepare(`SELECT t.title, o.position FROM topics t
    JOIN officials o ON o.id=t.official_id WHERE t.slug='zhkh'`).get();
  assert.match(zhkh.position, /ЖКХ/);
});

test('seedCatalog идемпотентен (повтор не дублирует)', () => {
  const db = openDb(':memory:'); migrate(db); seedCatalog(db); seedCatalog(db);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM topics').get().c, 10);
});
