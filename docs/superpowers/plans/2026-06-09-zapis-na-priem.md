# Сайт записи на приём — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Рабочий сайт, где житель Солнечногорска выбирает тему, видит ответственного руководителя, бронирует свободный 20-минутный слот по вторникам и оставляет ФИО/телефон/вопрос; сотрудник в админке видит все заявки и управляет статусами и расписанием.

**Architecture:** Один процесс Node.js (Express) с SQLite-файлом. Страницы рендерятся на сервере (обычная многостраничная навигация и POST-формы), без клиентского фреймворка. Логика (слоты, бронирование, авторизация) вынесена в отдельные чистые модули и покрыта тестами на встроенном `node:test`.

**Tech Stack:** Node.js (ESM), Express 4, better-sqlite3, встроенный тест-раннер `node --test`, ванильные CSS/JS.

---

## Структура файлов

```
solnechnogorsk-priem/
  package.json
  index.js            — точка входа: открыть БД, миграция, сид, запустить сервер
  seed.js             — скрипт ручного засева каталога тем/руководителей
  src/
    db.js             — открытие SQLite + схема (migrate)
    data.js           — каталог из 10 тем + руководителей + seedCatalog()
    slots.js          — ЧИСТЫЕ функции: даты приёма, времена слотов, фильтр занятых
    booking.js        — создание записи (правила + транзакция), смена статуса
    auth.js           — пароль/cookie-токен админки
    views.js          — серверные HTML-шаблоны
    server.js         — createApp(db, config): все маршруты
  public/
    styles.css        — оформление (крупные кнопки, плитки, таблица)
    app.js            — маска телефона
    gerb.svg          — заглушка герба (заменить на настоящий)
  test/
    slots.test.js
    booking.test.js
    auth.test.js
    server.test.js
  data/               — здесь живёт app.sqlite (в .gitignore)
```

Каждый модуль — одна ответственность. `slots.js` и `booking.js` не знают про HTTP; `views.js` не знает про БД; `server.js` всё связывает.

---

## Task 1: Каркас проекта

**Files:**
- Create: `package.json`

- [ ] **Step 1: Инициализировать проект и поставить зависимости**

Run:
```bash
cd /Users/dmtmnk/Projects/solnechnogorsk-priem
npm init -y
npm pkg set type=module
npm pkg set scripts.start="node index.js"
npm pkg set scripts.seed="node seed.js"
npm pkg set scripts.test="node --test"
npm install express@^4.19.2 better-sqlite3@^11.3.0
mkdir -p src public test data
```
Expected: появляется `node_modules/`, `package-lock.json`, в `package.json` есть `"type":"module"` и три скрипта.

- [ ] **Step 2: Проверить, что better-sqlite3 загружается**

Run: `node -e "import('better-sqlite3').then(m=>{const d=new m.default(':memory:');d.exec('create table t(x)');console.log('ok')})"`
Expected: печатает `ok` (нативный модуль собрался / подтянул prebuild).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: каркас проекта и зависимости"
```

---

## Task 2: База данных и схема (`src/db.js`)

**Files:**
- Create: `src/db.js`
- Test: `test/db.test.js`

- [ ] **Step 1: Написать падающий тест**

`test/db.test.js`:
```js
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
```

- [ ] **Step 2: Запустить тест — должен упасть**

Run: `node --test test/db.test.js`
Expected: FAIL — `Cannot find module '../src/db.js'`.

- [ ] **Step 3: Реализовать `src/db.js`**

```js
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
```

- [ ] **Step 4: Запустить тест — должен пройти**

Run: `node --test test/db.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db.js test/db.test.js
git commit -m "feat: схема БД и миграция"
```

---

## Task 3: Каталог тем и руководителей (`src/data.js`)

**Files:**
- Create: `src/data.js`
- Test: `test/data.test.js`

- [ ] **Step 1: Написать падающий тест**

`test/data.test.js`:
```js
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
```

- [ ] **Step 2: Запустить — должен упасть**

Run: `node --test test/data.test.js`
Expected: FAIL — нет модуля `../src/data.js`.

- [ ] **Step 3: Реализовать `src/data.js`**

```js
export const CATALOG = [
  { slug:'zhkh',         emoji:'🚰', title:'ЖКХ и коммуналка',         subtitle:'вода, тепло, свет, мусор, плата',
    position:'Начальник Управления ЖКХ и экологии' },
  { slug:'dorogi',       emoji:'🛣️', title:'Дороги и благоустройство',  subtitle:'дороги, транспорт, дворы, освещение',
    position:'Заместитель главы по строительству, дорожной инфраструктуре, благоустройству, транспорту и связи' },
  { slug:'imushchestvo', emoji:'🏗️', title:'Земля, имущество, архитектура', subtitle:'аренда, участки, разрешения на стройку',
    position:'Председатель Комитета по управлению имуществом' },
  { slug:'obrazovanie',  emoji:'🎓', title:'Образование',               subtitle:'школы, детские сады',
    position:'Начальник Управления образования' },
  { slug:'kultura',      emoji:'🎭', title:'Культура',                  subtitle:'дома культуры, мероприятия',
    position:'Начальник Управления культуры' },
  { slug:'sport',        emoji:'⚽', title:'Спорт и физкультура',        subtitle:'секции, площадки, соревнования',
    position:'Начальник Управления физической культуры и спорта' },
  { slug:'soczashchita', emoji:'👪', title:'Соцзащита и семья',          subtitle:'поддержка, льготы, несовершеннолетние',
    position:'Заместитель главы по образованию, культуре, физической культуре, спорту и социальному развитию' },
  { slug:'bezopasnost',  emoji:'🛡️', title:'Безопасность и порядок',    subtitle:'ЧС, общественный порядок',
    position:'Заместитель главы по безопасности' },
  { slug:'biznes',       emoji:'🏪', title:'Бизнес и торговля',          subtitle:'торговля, реклама, туризм, сельское хозяйство',
    position:'Заместитель главы по промышленности, инвестициям, потребительскому рынку, сельскому хозяйству, туризму и рекламе' },
  { slug:'drugoe',       emoji:'❓', title:'Не знаю / другой вопрос',   subtitle:'обращения и общие вопросы',
    position:'Заместитель главы по территориальной политике и общественным связям' },
];

export function seedCatalog(db) {
  const existing = db.prepare('SELECT COUNT(*) c FROM topics').get().c;
  if (existing > 0) return;
  const insOff = db.prepare('INSERT INTO officials(full_name, position) VALUES(?,?)');
  const insTop = db.prepare('INSERT INTO topics(slug,emoji,title,subtitle,official_id,sort_order) VALUES(?,?,?,?,?,?)');
  const tx = db.transaction(() => {
    CATALOG.forEach((c, i) => {
      const off = insOff.run('— (ФИО уточняется)', c.position);
      insTop.run(c.slug, c.emoji, c.title, c.subtitle, off.lastInsertRowid, i);
    });
  });
  tx();
}
```

- [ ] **Step 4: Запустить — должен пройти**

Run: `node --test test/data.test.js`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/data.js test/data.test.js
git commit -m "feat: каталог 10 тем и руководителей с засевом"
```

---

## Task 4: Логика слотов (`src/slots.js`)

**Files:**
- Create: `src/slots.js`
- Test: `test/slots.test.js`

- [ ] **Step 1: Написать падающий тест**

`test/slots.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeToMinutes, minutesToTime, slotTimes, formatDate, parseDate, upcomingDates, availableSlots } from '../src/slots.js';

test('конвертация времени', () => {
  assert.equal(timeToMinutes('12:20'), 740);
  assert.equal(minutesToTime(740), '12:20');
  assert.equal(minutesToTime(60), '01:00');
});

test('slotTimes: 5 слотов по 20 минут с 12:00', () => {
  assert.deepEqual(
    slotTimes({ start_time:'12:00', slot_minutes:20, slot_count:5 }),
    ['12:00','12:20','12:40','13:00','13:20']
  );
});

test('formatDate / parseDate', () => {
  assert.equal(formatDate(new Date(2026,5,9)), '2026-06-09');
  assert.equal(parseDate('2026-06-09').getDay(), 2); // вторник
});

test('upcomingDates: ближайшие 4 вторника, начиная с самого вторника', () => {
  // 2026-06-09 — вторник (weekday=2)
  assert.deepEqual(
    upcomingDates(2, '2026-06-09', 4),
    ['2026-06-09','2026-06-16','2026-06-23','2026-06-30']
  );
});

test('upcomingDates: если стартовая дата не вторник — берём следующий', () => {
  // 2026-06-10 — среда
  assert.equal(upcomingDates(2, '2026-06-10', 1)[0], '2026-06-16');
});

test('availableSlots убирает занятые и закрытые', () => {
  const all = ['12:00','12:20','12:40','13:00','13:20'];
  assert.deepEqual(availableSlots(all, ['12:00','12:40'], ['13:20']), ['12:20','13:00']);
});
```

- [ ] **Step 2: Запустить — должен упасть**

Run: `node --test test/slots.test.js`
Expected: FAIL — нет модуля `../src/slots.js`.

- [ ] **Step 3: Реализовать `src/slots.js`**

```js
export function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

export function slotTimes(settings) {
  const start = timeToMinutes(settings.start_time);
  return Array.from({ length: settings.slot_count }, (_, i) => minutesToTime(start + i * settings.slot_minutes));
}

export function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d); // локальная полночь — getDay() стабилен
}

export function upcomingDates(weekday, fromDateStr, count) {
  const result = [];
  const d = parseDate(fromDateStr);
  while (result.length < count) {
    if (d.getDay() === weekday) result.push(formatDate(d));
    d.setDate(d.getDate() + 1);
  }
  return result;
}

export function availableSlots(allTimes, takenTimes, blockedTimes = []) {
  const blocked = new Set([...takenTimes, ...blockedTimes]);
  return allTimes.filter(t => !blocked.has(t));
}
```

- [ ] **Step 4: Запустить — должен пройти**

Run: `node --test test/slots.test.js`
Expected: PASS (6 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/slots.js test/slots.test.js
git commit -m "feat: чистая логика слотов и дат приёма"
```

---

## Task 5: Бронирование (`src/booking.js`)

**Files:**
- Create: `src/booking.js`
- Test: `test/booking.test.js`

- [ ] **Step 1: Написать падающий тест**

`test/booking.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, migrate } from '../src/db.js';
import { createBooking, setStatus, BookingError } from '../src/booking.js';

function setup() {
  const db = openDb(':memory:'); migrate(db);
  db.prepare('INSERT INTO officials(id,full_name,position) VALUES(1,?,?)').run('Иванов', 'Начальник');
  db.prepare('INSERT INTO officials(id,full_name,position) VALUES(2,?,?)').run('Петров', 'Зам');
  return db;
}
const TODAY = '2026-06-09'; // вторник
const valid = { officialId:1, date:'2026-06-16', time:'12:00', fullName:'Сидоров', phone:'+79050000000', question:'вопрос' };

test('создание записи возвращает id и сохраняет статус new', () => {
  const db = setup();
  const { id } = createBooking(db, valid, TODAY);
  const row = db.prepare('SELECT * FROM bookings WHERE id=?').get(id);
  assert.equal(row.status, 'new');
  assert.equal(row.time, '12:00');
});

test('двойная бронь одного слота запрещена', () => {
  const db = setup();
  createBooking(db, valid, TODAY);
  assert.throws(() => createBooking(db, { ...valid, fullName:'Другой', phone:'+79051111111' }, TODAY),
    e => e instanceof BookingError && e.code === 'slot_taken');
});

test('один телефон не записывается на одно и то же время дважды', () => {
  const db = setup();
  createBooking(db, valid, TODAY);
  assert.throws(() => createBooking(db, { ...valid, officialId:2 }, TODAY),
    e => e instanceof BookingError && e.code === 'phone_busy');
});

test('тот же телефон на другое время к другому — можно', () => {
  const db = setup();
  createBooking(db, valid, TODAY);
  const r = createBooking(db, { ...valid, officialId:2, time:'12:20' }, TODAY);
  assert.ok(r.id);
});

test('отмена освобождает слот', () => {
  const db = setup();
  const { id } = createBooking(db, valid, TODAY);
  setStatus(db, id, 'cancelled');
  const r = createBooking(db, { ...valid, fullName:'Новый', phone:'+79052222222' }, TODAY);
  assert.ok(r.id);
});

test('недоступная дата отклоняется', () => {
  const db = setup();
  assert.throws(() => createBooking(db, { ...valid, date:'2026-06-17' }, TODAY),
    e => e instanceof BookingError && e.code === 'invalid');
});

test('пустые поля отклоняются', () => {
  const db = setup();
  assert.throws(() => createBooking(db, { ...valid, fullName:'  ' }, TODAY),
    e => e instanceof BookingError && e.code === 'invalid');
});
```

- [ ] **Step 2: Запустить — должен упасть**

Run: `node --test test/booking.test.js`
Expected: FAIL — нет модуля `../src/booking.js`.

- [ ] **Step 3: Реализовать `src/booking.js`**

```js
import { slotTimes, upcomingDates, formatDate } from './slots.js';

export class BookingError extends Error {
  constructor(code, message) { super(message); this.code = code; this.name = 'BookingError'; }
}

const STATUSES = ['new', 'confirmed', 'cancelled'];

export function createBooking(db, input, today = formatDate(new Date())) {
  const { officialId, date, time, fullName, phone, question } = input;

  if (!fullName?.trim() || !phone?.trim() || !question?.trim())
    throw new BookingError('invalid', 'Заполните все поля.');

  const official = db.prepare('SELECT id FROM officials WHERE id=? AND active=1').get(officialId);
  if (!official) throw new BookingError('invalid', 'Руководитель не найден.');

  const s = db.prepare('SELECT * FROM settings WHERE id=1').get();
  const dates = upcomingDates(s.weekday, today, s.weeks_ahead);
  if (!dates.includes(date)) throw new BookingError('invalid', 'Эта дата недоступна для записи.');
  if (!slotTimes(s).includes(time)) throw new BookingError('invalid', 'Это время недоступно.');

  const blocked = db.prepare('SELECT 1 FROM blocked_slots WHERE official_id=? AND date=? AND time=?')
    .get(officialId, date, time);
  if (blocked) throw new BookingError('slot_taken', 'Этот слот закрыт. Выберите другое время.');

  try {
    const info = db.prepare(`INSERT INTO bookings(official_id,date,time,full_name,phone,question,status,created_at)
      VALUES(?,?,?,?,?,?, 'new', ?)`)
      .run(officialId, date, time, fullName.trim(), phone.trim(), question.trim(), new Date().toISOString());
    return { id: info.lastInsertRowid };
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const slotTaken = db.prepare(`SELECT 1 FROM bookings WHERE official_id=? AND date=? AND time=? AND status!='cancelled'`)
        .get(officialId, date, time);
      if (slotTaken) throw new BookingError('slot_taken', 'Этот слот только что заняли. Выберите другое время.');
      throw new BookingError('phone_busy', 'На это время у вас уже есть запись.');
    }
    throw e;
  }
}

export function setStatus(db, id, status) {
  if (!STATUSES.includes(status)) throw new BookingError('invalid', 'Неверный статус.');
  const info = db.prepare('UPDATE bookings SET status=? WHERE id=?').run(status, id);
  if (info.changes === 0) throw new BookingError('invalid', 'Запись не найдена.');
}
```

- [ ] **Step 4: Запустить — должен пройти**

Run: `node --test test/booking.test.js`
Expected: PASS (7 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/booking.js test/booking.test.js
git commit -m "feat: бронирование с защитой от двойной записи"
```

---

## Task 6: Авторизация админки (`src/auth.js`)

**Files:**
- Create: `src/auth.js`
- Test: `test/auth.test.js`

- [ ] **Step 1: Написать падающий тест**

`test/auth.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPassword, expectedToken, isAuthed, parseCookie } from '../src/auth.js';

test('checkPassword сравнивает корректно', () => {
  assert.equal(checkPassword('secret', 'secret'), true);
  assert.equal(checkPassword('wrong', 'secret'), false);
  assert.equal(checkPassword('', 'secret'), false);
});

test('parseCookie разбирает заголовок', () => {
  assert.deepEqual(parseCookie('a=1; admin=xyz'), { a:'1', admin:'xyz' });
  assert.deepEqual(parseCookie(''), {});
});

test('isAuthed принимает правильный токен и отвергает чужой', () => {
  const secret = 'sec';
  const good = expectedToken(secret);
  assert.equal(isAuthed({ headers: { cookie: 'admin=' + good } }, secret), true);
  assert.equal(isAuthed({ headers: { cookie: 'admin=podделка' } }, secret), false);
  assert.equal(isAuthed({ headers: {} }, secret), false);
});
```

- [ ] **Step 2: Запустить — должен упасть**

Run: `node --test test/auth.test.js`
Expected: FAIL — нет модуля `../src/auth.js`.

- [ ] **Step 3: Реализовать `src/auth.js`**

```js
import crypto from 'node:crypto';

export function expectedToken(secret) {
  return crypto.createHmac('sha256', String(secret)).update('admin-session-v1').digest('hex');
}

export function checkPassword(input, password) {
  const a = Buffer.from(String(input));
  const b = Buffer.from(String(password));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function parseCookie(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export function isAuthed(req, secret) {
  const token = parseCookie(req.headers?.cookie || '')['admin'];
  if (!token) return false;
  const exp = expectedToken(secret);
  const a = Buffer.from(token), b = Buffer.from(exp);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Запустить — должен пройти**

Run: `node --test test/auth.test.js`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/auth.js test/auth.test.js
git commit -m "feat: авторизация админки на cookie-токене"
```

---

## Task 7: HTML-шаблоны (`src/views.js`)

**Files:**
- Create: `src/views.js`
- Test: `test/views.test.js`

- [ ] **Step 1: Написать падающий тест (smoke)**

`test/views.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, humanDate, topicsPage, confirmationPage } from '../src/views.js';

test('escapeHtml экранирует опасные символы', () => {
  assert.equal(escapeHtml('<b>&"x'), '&lt;b&gt;&amp;&quot;x');
});

test('humanDate печатает русскую дату', () => {
  assert.equal(humanDate('2026-06-16'), 'вт, 16 июня');
});

test('topicsPage содержит заголовок и плитки', () => {
  const html = topicsPage([{ slug:'zhkh', emoji:'🚰', title:'ЖКХ', subtitle:'вода' }]);
  assert.match(html, /С каким вопросом вы обращаетесь/);
  assert.match(html, /href="\/tema\/zhkh"/);
});

test('confirmationPage показывает дату, время и ФИО', () => {
  const html = confirmationPage(
    { date:'2026-06-16', time:'12:20' },
    { full_name:'Иванов', position:'Начальник' });
  assert.match(html, /Вы записаны на приём/);
  assert.match(html, /12:20/);
  assert.match(html, /Иванов/);
});
```

- [ ] **Step 2: Запустить — должен упасть**

Run: `node --test test/views.test.js`
Expected: FAIL — нет модуля `../src/views.js`.

- [ ] **Step 3: Реализовать `src/views.js`**

```js
const RU_DAYS = ['вс','пн','вт','ср','чт','пт','сб'];
const RU_MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

export const STATUS_LABELS = { new:'Новая', confirmed:'Подтверждена', cancelled:'Отменена' };

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

export function humanDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${RU_DAYS[dt.getDay()]}, ${d} ${RU_MONTHS[m - 1]}`;
}

export function layout({ title, body, admin = false }) {
  return `<!DOCTYPE html><html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><link rel="stylesheet" href="/styles.css"></head>
<body>
<header class="topbar${admin ? ' topbar--admin' : ''}">
  <img src="/gerb.svg" alt="Герб" class="gerb">
  <div><div class="topbar-title">Запись на приём</div>
  <div class="topbar-sub">Администрация городского округа Солнечногорск</div></div>
</header>
<main class="wrap">${body}</main>
<script src="/app.js"></script>
</body></html>`;
}

export function topicsPage(topics) {
  const tiles = topics.map(t => `
    <a class="tile" href="/tema/${escapeHtml(t.slug)}">
      <div class="tile-emoji">${t.emoji}</div>
      <div class="tile-title">${escapeHtml(t.title)}</div>
      <div class="tile-sub">${escapeHtml(t.subtitle)}</div>
    </a>`).join('');
  const body = `<h1 class="h1">С каким вопросом вы обращаетесь?</h1>
    <p class="lead">Выберите тему — покажем, кто за неё отвечает, и свободное время приёма.</p>
    <div class="tiles">${tiles}</div>`;
  return layout({ title: 'Запись на приём — Солнечногорск', body });
}

export function officialPage(topic, official) {
  const body = `<a class="back" href="/">← К темам</a>
    <div class="card">
      <div class="avatar">👤</div>
      <div>
        <div class="card-name">${escapeHtml(official.full_name)}</div>
        <div class="card-pos">${escapeHtml(official.position)}</div>
        <div class="card-meta">Тема: ${escapeHtml(topic.title)}</div>
      </div>
    </div>
    <a class="btn btn--primary btn--big" href="/tema/${escapeHtml(topic.slug)}/vremya">Записаться на приём →</a>`;
  return layout({ title: 'Запись — ' + topic.title, body });
}

export function slotsPage(topic, dates, selectedDate, available) {
  const days = dates.map(d =>
    `<a class="day${d === selectedDate ? ' day--on' : ''}" href="/tema/${escapeHtml(topic.slug)}/vremya?date=${d}">${humanDate(d)}</a>`).join('');
  const times = available.length
    ? available.map(t => `<a class="slot" href="/tema/${escapeHtml(topic.slug)}/forma?date=${selectedDate}&time=${t}">${t}</a>`).join('')
    : `<div class="empty">На этот день свободного времени нет. Выберите другой день.</div>`;
  const body = `<a class="back" href="/tema/${escapeHtml(topic.slug)}">← Назад</a>
    <h2 class="h2">Выберите день</h2><div class="days">${days}</div>
    <h2 class="h2">Выберите время</h2><div class="slots">${times}</div>`;
  return layout({ title: 'Выбор времени', body });
}

export function formPage(topic, date, time, values = {}, error = '') {
  const body = `<a class="back" href="/tema/${escapeHtml(topic.slug)}/vremya?date=${date}">← Назад</a>
    <div class="note">Запись: <b>${escapeHtml(topic.title)}</b> · ${humanDate(date)}, <b>${time}</b></div>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    <form method="post" action="/zapis" class="form">
      <input type="hidden" name="slug" value="${escapeHtml(topic.slug)}">
      <input type="hidden" name="date" value="${date}">
      <input type="hidden" name="time" value="${time}">
      <label class="field"><span>Ваше ФИО</span>
        <input name="full_name" required value="${escapeHtml(values.full_name || '')}" placeholder="Петров Пётр Петрович"></label>
      <label class="field"><span>Контактный телефон</span>
        <input name="phone" required inputmode="tel" value="${escapeHtml(values.phone || '')}" placeholder="+7 (___) ___-__-__"></label>
      <label class="field"><span>Коротко суть вопроса</span>
        <textarea name="question" required rows="4" placeholder="Опишите вопрос в двух словах">${escapeHtml(values.question || '')}</textarea></label>
      <button class="btn btn--green btn--big" type="submit">Записаться</button>
    </form>`;
  return layout({ title: 'Запись', body });
}

export function confirmationPage(booking, official) {
  const body = `<div class="done">
    <div class="done-mark">✅</div>
    <div class="done-title">Вы записаны на приём</div>
    <div class="done-info"><b>${humanDate(booking.date)}, ${booking.time}</b><br>
      ${escapeHtml(official.full_name)}<br>${escapeHtml(official.position)}</div>
    <div class="done-note">Запишите дату и время. При себе — паспорт.<br>
      Если не сможете прийти — позвоните в приёмную.</div>
    <a class="btn btn--big" href="/">На главную</a></div>`;
  return layout({ title: 'Готово', body });
}

export function adminLoginPage(error = '') {
  const body = `<div class="login">
    <div class="login-lock">🔒</div><h2 class="h2">Вход для сотрудников</h2>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    <form method="post" action="/admin/vhod" class="form">
      <input name="password" type="password" required placeholder="Пароль" autofocus>
      <button class="btn btn--primary btn--big" type="submit">Войти</button>
    </form></div>`;
  return layout({ title: 'Вход', body, admin: true });
}

export function adminListPage(bookings, topics, filter = {}) {
  const chips = [`<a class="chip${!filter.topic ? ' chip--on' : ''}" href="/admin">Все</a>`]
    .concat(topics.map(t =>
      `<a class="chip${filter.topic === t.slug ? ' chip--on' : ''}" href="/admin?topic=${t.slug}">${escapeHtml(t.title)}</a>`))
    .join('');
  const rows = bookings.map(b => `<tr>
    <td>${humanDate(b.date)}<br>${b.time}</td>
    <td>${escapeHtml(b.full_name)}</td>
    <td>${escapeHtml(b.phone)}</td>
    <td>${escapeHtml(b.topic_title || '')}<br><span class="muted">${escapeHtml(b.official_name)}</span></td>
    <td>${escapeHtml(b.question)}</td>
    <td><span class="badge badge--${b.status}">${STATUS_LABELS[b.status]}</span></td>
    <td class="actions">
      <form method="post" action="/admin/zapis/${b.id}/status"><input type="hidden" name="status" value="confirmed"><button ${b.status === 'confirmed' ? 'disabled' : ''} title="Подтвердить">✓</button></form>
      <form method="post" action="/admin/zapis/${b.id}/status"><input type="hidden" name="status" value="cancelled"><button ${b.status === 'cancelled' ? 'disabled' : ''} title="Отменить">✕</button></form>
    </td></tr>`).join('');
  const body = `<div class="admin-head">
      <h2 class="h2">Записи на приём</h2>
      <div class="admin-head-actions">
        <a class="btn" href="/admin/raspisanie">Расписание</a>
        <form method="post" action="/admin/vyhod"><button class="btn">Выйти</button></form>
      </div></div>
    <div class="chips">${chips}</div>
    <table class="tbl">
      <tr><th>Когда</th><th>Житель</th><th>Телефон</th><th>Тема / к кому</th><th>Вопрос</th><th>Статус</th><th></th></tr>
      ${rows || '<tr><td colspan="7" class="muted">Записей пока нет</td></tr>'}
    </table>`;
  return layout({ title: 'Админка', body, admin: true });
}

export function adminSchedulePage(settings, officials = [], saved = false) {
  const days = [['1','Понедельник'],['2','Вторник'],['3','Среда'],['4','Четверг'],['5','Пятница']];
  const weekdayOpts = days.map(([v, l]) =>
    `<option value="${v}" ${Number(settings.weekday) === Number(v) ? 'selected' : ''}>${l}</option>`).join('');
  const offOpts = officials.map(o =>
    `<option value="${o.id}">${escapeHtml(o.full_name)} — ${escapeHtml(o.position)}</option>`).join('');
  const body = `<a class="back" href="/admin">← К записям</a>
    <h2 class="h2">Параметры приёма</h2>
    ${saved ? '<div class="ok">Сохранено</div>' : ''}
    <form method="post" action="/admin/raspisanie" class="form">
      <label class="field"><span>День приёма</span><select name="weekday">${weekdayOpts}</select></label>
      <label class="field"><span>Начало (ЧЧ:ММ)</span><input name="start_time" value="${escapeHtml(settings.start_time)}"></label>
      <label class="field"><span>Длина слота, мин</span><input name="slot_minutes" type="number" min="5" value="${settings.slot_minutes}"></label>
      <label class="field"><span>Количество слотов</span><input name="slot_count" type="number" min="1" value="${settings.slot_count}"></label>
      <label class="field"><span>На сколько недель вперёд</span><input name="weeks_ahead" type="number" min="1" value="${settings.weeks_ahead}"></label>
      <button class="btn btn--primary btn--big" type="submit">Сохранить</button>
    </form>
    <h2 class="h2">Закрыть отдельный слот</h2>
    <form method="post" action="/admin/slot/zakryt" class="form">
      <label class="field"><span>Кому</span><select name="official_id">${offOpts}</select></label>
      <label class="field"><span>Дата (ГГГГ-ММ-ДД)</span><input name="date" placeholder="2026-06-16"></label>
      <label class="field"><span>Время (ЧЧ:ММ)</span><input name="time" placeholder="12:20"></label>
      <button class="btn btn--big" type="submit">Закрыть слот</button>
    </form>`;
  return layout({ title: 'Расписание', body, admin: true });
}
```

- [ ] **Step 4: Запустить — должен пройти**

Run: `node --test test/views.test.js`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add src/views.js test/views.test.js
git commit -m "feat: серверные HTML-шаблоны"
```

---

## Task 8: Express-приложение и маршруты (`src/server.js`)

**Files:**
- Create: `src/server.js`
- Test: `test/server.test.js`

- [ ] **Step 1: Написать падающий интеграционный тест**

`test/server.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, migrate } from '../src/db.js';
import { seedCatalog } from '../src/data.js';
import { createApp } from '../src/server.js';

const CONFIG = { adminPassword: 'secret', cookieSecret: 'sec' };

async function startApp() {
  const db = openDb(':memory:'); migrate(db); seedCatalog(db);
  const app = createApp(db, CONFIG);
  const server = await new Promise(res => { const s = app.listen(0, () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { db, server, base, stop: () => server.close() };
}

test('главная отдаёт список тем', async () => {
  const a = await startApp();
  const res = await fetch(a.base + '/');
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /С каким вопросом вы обращаетесь/);
  assert.match(html, /ЖКХ и коммуналка/);
  a.stop();
});

test('страница темы показывает должность', async () => {
  const a = await startApp();
  const res = await fetch(a.base + '/tema/zhkh');
  const html = await res.text();
  assert.match(html, /Управления ЖКХ/);
  a.stop();
});

test('создание записи редиректит на подтверждение', async () => {
  const a = await startApp();
  const body = new URLSearchParams({
    slug:'zhkh', date:'2026-06-16', time:'12:00',
    full_name:'Сидоров', phone:'+79050000000', question:'нет воды'
  });
  const res = await fetch(a.base + '/zapis', { method:'POST', body, redirect:'manual' });
  assert.equal(res.status, 302);
  const loc = res.headers.get('location');
  assert.match(loc, /^\/gotovo\/\d+$/);
  const done = await (await fetch(a.base + loc)).text();
  assert.match(done, /Вы записаны на приём/);
  a.stop();
});

test('занятый слот возвращает форму с ошибкой', async () => {
  const a = await startApp();
  const mk = () => fetch(a.base + '/zapis', { method:'POST', redirect:'manual',
    body: new URLSearchParams({ slug:'zhkh', date:'2026-06-16', time:'12:00',
      full_name:'A', phone:'+79050000001', question:'x' }) });
  await mk();
  const res2 = await fetch(a.base + '/zapis', { method:'POST', redirect:'manual',
    body: new URLSearchParams({ slug:'zhkh', date:'2026-06-16', time:'12:00',
      full_name:'B', phone:'+79050000002', question:'y' }) });
  const html = await res2.text();
  assert.match(html, /только что заняли|слот закрыт/i);
  a.stop();
});

test('админка без входа редиректит на форму входа', async () => {
  const a = await startApp();
  const res = await fetch(a.base + '/admin', { redirect:'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/admin/vhod');
  a.stop();
});

test('неверный пароль — 401; верный — доступ к списку', async () => {
  const a = await startApp();
  const bad = await fetch(a.base + '/admin/vhod', { method:'POST', redirect:'manual',
    body: new URLSearchParams({ password:'nope' }) });
  assert.equal(bad.status, 401);

  const ok = await fetch(a.base + '/admin/vhod', { method:'POST', redirect:'manual',
    body: new URLSearchParams({ password:'secret' }) });
  assert.equal(ok.status, 302);
  const cookie = ok.headers.get('set-cookie').split(';')[0];

  const list = await fetch(a.base + '/admin', { headers: { cookie } });
  const html = await list.text();
  assert.equal(list.status, 200);
  assert.match(html, /Записи на приём/);
  a.stop();
});
```

- [ ] **Step 2: Запустить — должен упасть**

Run: `node --test test/server.test.js`
Expected: FAIL — нет модуля `../src/server.js`.

- [ ] **Step 3: Реализовать `src/server.js`**

```js
import express from 'express';
import { upcomingDates, slotTimes, availableSlots, formatDate } from './slots.js';
import { createBooking, setStatus, BookingError } from './booking.js';
import { isAuthed, checkPassword, expectedToken } from './auth.js';
import * as V from './views.js';

export function createApp(db, config) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static('public'));

  const getSettings = () => db.prepare('SELECT * FROM settings WHERE id=1').get();
  const getTopics = () => db.prepare(`SELECT t.slug, t.emoji, t.title, t.subtitle
      FROM topics t WHERE t.active=1 ORDER BY t.sort_order`).all();
  const getTopic = (slug) => db.prepare(`SELECT t.slug, t.title,
      o.id AS official_id, o.full_name, o.position
      FROM topics t JOIN officials o ON o.id=t.official_id WHERE t.slug=?`).get(slug);

  const today = () => formatDate(new Date());
  const nowHM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const notFound = (res) =>
    res.status(404).send(V.layout({ title:'Не найдено', body:'<p>Страница не найдена. <a href="/">На главную</a></p>' }));

  // ---------- Публичная часть ----------
  app.get('/', (req, res) => res.send(V.topicsPage(getTopics())));

  app.get('/tema/:slug', (req, res) => {
    const topic = getTopic(req.params.slug);
    if (!topic) return notFound(res);
    res.send(V.officialPage(topic, { full_name: topic.full_name, position: topic.position }));
  });

  app.get('/tema/:slug/vremya', (req, res) => {
    const topic = getTopic(req.params.slug);
    if (!topic) return notFound(res);
    const s = getSettings();
    const dates = upcomingDates(s.weekday, today(), s.weeks_ahead);
    const selectedDate = dates.includes(req.query.date) ? req.query.date : dates[0];
    let times = slotTimes(s);
    if (selectedDate === today()) times = times.filter(t => t > nowHM());
    const taken = db.prepare(`SELECT time FROM bookings WHERE official_id=? AND date=? AND status!='cancelled'`)
      .all(topic.official_id, selectedDate).map(r => r.time);
    const blocked = db.prepare(`SELECT time FROM blocked_slots WHERE official_id=? AND date=?`)
      .all(topic.official_id, selectedDate).map(r => r.time);
    res.send(V.slotsPage(topic, dates, selectedDate, availableSlots(times, taken, blocked)));
  });

  app.get('/tema/:slug/forma', (req, res) => {
    const topic = getTopic(req.params.slug);
    if (!topic) return notFound(res);
    res.send(V.formPage(topic, req.query.date, req.query.time));
  });

  app.post('/zapis', (req, res) => {
    const { slug, date, time, full_name, phone, question } = req.body;
    const topic = getTopic(slug);
    if (!topic) return notFound(res);
    try {
      const { id } = createBooking(db, {
        officialId: topic.official_id, date, time, fullName: full_name, phone, question });
      res.redirect('/gotovo/' + id);
    } catch (e) {
      if (e instanceof BookingError)
        return res.send(V.formPage(topic, date, time, { full_name, phone, question }, e.message));
      throw e;
    }
  });

  app.get('/gotovo/:id', (req, res) => {
    const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
    if (!b) return notFound(res);
    const o = db.prepare('SELECT * FROM officials WHERE id=?').get(b.official_id);
    res.send(V.confirmationPage(b, o));
  });

  // ---------- Админка ----------
  const requireAdmin = (req, res, next) =>
    isAuthed(req, config.cookieSecret) ? next() : res.redirect('/admin/vhod');

  app.get('/admin/vhod', (req, res) => res.send(V.adminLoginPage()));

  app.post('/admin/vhod', (req, res) => {
    if (checkPassword(req.body.password, config.adminPassword)) {
      res.cookie('admin', expectedToken(config.cookieSecret), { httpOnly: true, sameSite: 'lax' });
      return res.redirect('/admin');
    }
    res.status(401).send(V.adminLoginPage('Неверный пароль'));
  });

  app.post('/admin/vyhod', (req, res) => { res.clearCookie('admin'); res.redirect('/admin/vhod'); });

  app.get('/admin', requireAdmin, (req, res) => {
    const { topic, status } = req.query;
    let sql = `SELECT b.*, t.title AS topic_title, t.slug AS topic_slug, o.full_name AS official_name
      FROM bookings b
      JOIN officials o ON o.id=b.official_id
      LEFT JOIN topics t ON t.official_id=b.official_id`;
    const where = [], args = [];
    if (topic) { where.push('t.slug=?'); args.push(topic); }
    if (status) { where.push('b.status=?'); args.push(status); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY b.date, b.time';
    const rows = db.prepare(sql).all(...args);
    res.send(V.adminListPage(rows, getTopics(), { topic, status }));
  });

  app.post('/admin/zapis/:id/status', requireAdmin, (req, res) => {
    try { setStatus(db, Number(req.params.id), req.body.status); }
    catch (e) { if (!(e instanceof BookingError)) throw e; }
    res.redirect('back');
  });

  app.get('/admin/raspisanie', requireAdmin, (req, res) => {
    const officials = db.prepare('SELECT * FROM officials WHERE active=1 ORDER BY id').all();
    res.send(V.adminSchedulePage(getSettings(), officials, req.query.saved === '1'));
  });

  app.post('/admin/raspisanie', requireAdmin, (req, res) => {
    const { weekday, start_time, slot_minutes, slot_count, weeks_ahead } = req.body;
    db.prepare(`UPDATE settings SET weekday=?, start_time=?, slot_minutes=?, slot_count=?, weeks_ahead=? WHERE id=1`)
      .run(Number(weekday), start_time, Number(slot_minutes), Number(slot_count), Number(weeks_ahead));
    res.redirect('/admin/raspisanie?saved=1');
  });

  app.post('/admin/slot/zakryt', requireAdmin, (req, res) => {
    const { official_id, date, time } = req.body;
    db.prepare('INSERT OR IGNORE INTO blocked_slots(official_id, date, time) VALUES(?,?,?)')
      .run(Number(official_id), date, time);
    res.redirect('/admin/raspisanie?saved=1');
  });

  return app;
}
```

- [ ] **Step 4: Запустить — должен пройти**

Run: `node --test test/server.test.js`
Expected: PASS (6 тестов).

- [ ] **Step 5: Прогнать весь набор тестов**

Run: `node --test`
Expected: PASS — все файлы тестов зелёные.

- [ ] **Step 6: Commit**

```bash
git add src/server.js test/server.test.js
git commit -m "feat: маршруты публичной части и админки"
```

---

## Task 9: Оформление и статика (`public/`)

**Files:**
- Create: `public/styles.css`
- Create: `public/app.js`
- Create: `public/gerb.svg`

- [ ] **Step 1: Создать `public/gerb.svg` (заглушка герба)**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 72" width="44" height="52">
  <path d="M2 2 H58 V44 C58 60 30 70 30 70 C30 70 2 60 2 44 Z" fill="#1a6fc4" stroke="#fff" stroke-width="2"/>
  <circle cx="30" cy="20" r="9" fill="#f5c518"/>
  <circle cx="16" cy="46" r="6" fill="#f5c518"/>
  <circle cx="30" cy="48" r="6" fill="#f5c518"/>
  <circle cx="44" cy="46" r="6" fill="#f5c518"/>
</svg>
```
*(Заглушка. Заменить на настоящий герб от заказчика, сохранив имя файла `gerb.svg` или поправив путь в `views.js`.)*

- [ ] **Step 2: Создать `public/styles.css`**

```css
:root { --blue:#1a6fc4; --ink:#1f2a37; --muted:#5b6675; --line:#e2e8f0; --bg:#f4f6f9; }
* { box-sizing: border-box; }
body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: var(--bg); color: var(--ink); font-size: 17px; line-height: 1.45; }
.topbar { background: var(--blue); color:#fff; padding:16px 20px; display:flex; align-items:center; gap:14px; }
.topbar--admin { background:#243b53; }
.gerb { width:44px; height:52px; background:#fff; border-radius:4px; padding:2px; }
.topbar-title { font-size:20px; font-weight:700; }
.topbar-sub { font-size:13px; opacity:.9; }
.wrap { max-width: 860px; margin:0 auto; padding:20px 16px 48px; }
.h1 { font-size:26px; margin:8px 0 6px; }
.h2 { font-size:20px; margin:22px 0 10px; }
.lead { color: var(--muted); margin:0 0 18px; }
.back { display:inline-block; color: var(--muted); text-decoration:none; margin-bottom:12px; }
.back:hover { color: var(--blue); }

.tiles { display:grid; grid-template-columns: repeat(3, 1fr); gap:14px; }
.tile { display:block; background:#fff; border:1px solid var(--line); border-radius:14px;
  padding:18px 14px; text-align:center; text-decoration:none; color:var(--ink);
  box-shadow:0 1px 2px rgba(0,0,0,.04); transition:.12s; }
.tile:hover { border-color: var(--blue); box-shadow:0 4px 14px rgba(26,111,196,.15); transform:translateY(-1px); }
.tile-emoji { font-size:38px; }
.tile-title { font-weight:700; margin-top:6px; }
.tile-sub { font-size:13px; color:#8a94a3; margin-top:3px; }

.card { background:#fff; border:1px solid var(--line); border-radius:14px; padding:20px;
  display:flex; gap:16px; align-items:center; }
.avatar { width:72px; height:72px; border-radius:50%; background:#dbe7f4;
  display:flex; align-items:center; justify-content:center; font-size:32px; flex:0 0 auto; }
.card-name { font-size:19px; font-weight:700; }
.card-pos { color: var(--muted); margin-top:2px; }
.card-meta { color:#8a94a3; font-size:14px; margin-top:6px; }

.btn { display:inline-block; background:#fff; border:1px solid #cbd5e1; color:var(--ink);
  border-radius:10px; padding:12px 20px; font-size:16px; font-weight:600; text-decoration:none;
  cursor:pointer; }
.btn--big { width:100%; text-align:center; padding:16px; font-size:18px; margin-top:16px; }
.btn--primary { background: var(--blue); color:#fff; border:none; }
.btn--green { background:#1a8a3f; color:#fff; border:none; }
.btn[disabled] { opacity:.4; cursor:default; }

.days { display:flex; flex-wrap:wrap; gap:10px; }
.day { background:#fff; border:1px solid var(--line); border-radius:10px; padding:12px 16px;
  text-decoration:none; color:var(--ink); }
.day--on { background: var(--blue); color:#fff; border-color: var(--blue); }
.slots { display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; }
.slot { background:#fff; border:1px solid var(--line); border-radius:10px; padding:16px;
  text-align:center; text-decoration:none; color:var(--ink); font-weight:700; font-size:18px; }
.slot:hover { border-color: var(--blue); color: var(--blue); }
.empty { color: var(--muted); padding:8px 0; }

.note { background:#eaf3fb; border:1px solid #c4ddf2; border-radius:10px; padding:12px 14px;
  color:#1a4d7a; margin-bottom:16px; }
.form { display:flex; flex-direction:column; gap:14px; max-width:520px; }
.field { display:flex; flex-direction:column; gap:6px; font-weight:600; }
.field input, .field textarea, .field select { font-size:17px; padding:14px; border:1px solid #cbd5e1;
  border-radius:8px; font-family:inherit; }
.error { background:#fdeaea; border:1px solid #f3c4c4; color:#9a2a2a; border-radius:8px; padding:12px 14px; }
.ok { background:#e7f6ec; border:1px solid #bfe3c9; color:#1a6b2a; border-radius:8px; padding:10px 14px; max-width:520px; }

.done { background:#fff; border:1px solid var(--line); border-radius:14px; padding:32px 22px; text-align:center; }
.done-mark { font-size:56px; }
.done-title { font-size:23px; font-weight:800; margin-top:8px; }
.done-info { font-size:18px; margin-top:14px; line-height:1.6; }
.done-note { color: var(--muted); margin-top:16px; }
.done .btn { margin-top:22px; display:inline-block; width:auto; }

.login { max-width:340px; margin:40px auto; text-align:center; }
.login-lock { font-size:32px; }
.login .form { align-items:stretch; }

.admin-head { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
.admin-head-actions { display:flex; gap:8px; align-items:center; }
.admin-head-actions form { margin:0; }
.chips { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }
.chip { font-size:13px; background:#eef1f5; color:var(--muted); border-radius:8px; padding:6px 12px; text-decoration:none; }
.chip--on { background: var(--blue); color:#fff; }
.tbl { width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--line);
  border-radius:12px; overflow:hidden; font-size:14px; }
.tbl th { background:#f8fafc; color:var(--muted); text-align:left; padding:10px 12px; }
.tbl td { border-top:1px solid #eef1f5; padding:10px 12px; vertical-align:top; }
.muted { color:#8a94a3; }
.badge { border-radius:6px; padding:3px 8px; font-size:12px; white-space:nowrap; }
.badge--new { background:#fde9c8; color:#9a6a00; }
.badge--confirmed { background:#cdeccf; color:#1a6b2a; }
.badge--cancelled { background:#f3d4d4; color:#9a2a2a; }
.actions { white-space:nowrap; }
.actions form { display:inline; margin:0; }
.actions button { border:1px solid #cbd5e1; background:#fff; border-radius:6px; padding:6px 10px; cursor:pointer; }

@media (max-width:640px) {
  .tiles { grid-template-columns: repeat(2, 1fr); }
  .slots { grid-template-columns: repeat(3, 1fr); }
  .tbl { display:block; overflow-x:auto; }
}
```

- [ ] **Step 3: Создать `public/app.js` (маска телефона)**

```js
document.querySelectorAll('input[name="phone"]').forEach((inp) => {
  const format = (digits) => {
    let d = digits.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (!d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    let out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ') ' + d.slice(4, 7);
    if (d.length >= 7) out += '-' + d.slice(7, 9);
    if (d.length >= 9) out += '-' + d.slice(9, 11);
    return out;
  };
  inp.addEventListener('input', () => { inp.value = format(inp.value); });
  inp.addEventListener('focus', () => { if (!inp.value) inp.value = '+7 ('; });
});
```

- [ ] **Step 4: Проверить вручную в браузере (preview)**

Запустить временно сервер и открыть главную (после Task 11 будет `npm start`; пока можно через готовый `index.js`, если он уже есть, иначе пропустить до Task 11).
Если `index.js` ещё не создан — пропустить визуальную проверку до Task 11.

- [ ] **Step 5: Commit**

```bash
git add public/styles.css public/app.js public/gerb.svg
git commit -m "feat: оформление, маска телефона, заглушка герба"
```

---

## Task 10: Точка входа, скрипт засева, README (`index.js`, `seed.js`, `README.md`)

**Files:**
- Create: `index.js`
- Create: `seed.js`
- Create: `README.md`

- [ ] **Step 1: Создать `index.js`**

```js
import fs from 'node:fs';
import { openDb, migrate } from './src/db.js';
import { seedCatalog } from './src/data.js';
import { createApp } from './src/server.js';

fs.mkdirSync('data', { recursive: true });
const db = openDb('data/app.sqlite');
migrate(db);
seedCatalog(db);

const config = {
  port: Number(process.env.PORT || 3000),
  adminPassword: process.env.ADMIN_PASSWORD || 'admin',
  cookieSecret: process.env.COOKIE_SECRET || 'dev-insecure-secret-change-me',
};

if (config.adminPassword === 'admin' || config.cookieSecret.startsWith('dev-insecure'))
  console.warn('⚠  Заданы значения по умолчанию. Перед запуском в проде задайте ADMIN_PASSWORD и COOKIE_SECRET.');

const app = createApp(db, config);
app.listen(config.port, () => console.log(`Сервер запущен: http://localhost:${config.port}`));
```

- [ ] **Step 2: Создать `seed.js`**

```js
import { openDb, migrate } from './src/db.js';
import { seedCatalog } from './src/data.js';
import fs from 'node:fs';

fs.mkdirSync('data', { recursive: true });
const db = openDb('data/app.sqlite');
migrate(db);
seedCatalog(db);
console.log('Каталог тем и руководителей засеян (если был пуст).');
```

- [ ] **Step 3: Создать `README.md`**

```markdown
# Запись на приём — г.о. Солнечногорск

Сайт записи жителей на личный приём к руководителям администрации.

## Запуск

    npm install
    npm start
    # открыть http://localhost:3000

Админка: http://localhost:3000/admin/vhod

## Переменные окружения

- `PORT` — порт (по умолчанию 3000)
- `ADMIN_PASSWORD` — пароль входа в админку (по умолчанию `admin` — сменить!)
- `COOKIE_SECRET` — секрет для подписи cookie сессии (сменить в проде!)

Пример:

    ADMIN_PASSWORD=мой_пароль COOKIE_SECRET=случайная_строка npm start

## Данные

SQLite-файл лежит в `data/app.sqlite` (в .gitignore). Каталог тем и руководителей
засевается из `src/data.js` при первом запуске. Чтобы изменить ФИО руководителей —
отредактируйте `src/data.js` и удалите `data/app.sqlite`, затем `npm run seed`.

## Тесты

    npm test

## Что заменить перед запуском

- `public/gerb.svg` — заглушка, поставить настоящий герб.
- ФИО руководителей в `src/data.js` (сейчас «— (ФИО уточняется)»).
- Сверить название «Комитет по управлению имуществом».
```

- [ ] **Step 4: Запустить сервер и проверить весь путь в браузере (preview)**

Run: `npm start` (в фоне), затем через preview-инструменты:
- открыть `http://localhost:3000/` → видна сетка из 10 плиток;
- кликнуть «ЖКХ и коммуналка» → карточка с должностью и кнопкой;
- «Записаться» → выбрать день и время → форма → заполнить → «Записаться»;
- появляется зелёный экран «Вы записаны на приём» с датой/временем;
- открыть `http://localhost:3000/admin/vhod`, войти паролем `admin` → запись видна в таблице;
- нажать ✓ (подтвердить) → статус меняется на «Подтверждена».

Expected: весь путь проходит без ошибок в консоли; запись отображается в админке.

- [ ] **Step 5: Финальный прогон тестов**

Run: `node --test`
Expected: PASS — все тесты зелёные.

- [ ] **Step 6: Commit**

```bash
git add index.js seed.js README.md
git commit -m "feat: точка входа, засев, README"
```

---

## Self-Review (проверка плана против спеки)

**Покрытие спеки:**
- Навигация от темы → ответственный: Task 3 (каталог) + Task 7 (`topicsPage`, `officialPage`) + Task 8 (маршруты `/`, `/tema/:slug`). ✅
- 10 плиток-тем: Task 3 `CATALOG`. ✅
- Слоты по вторникам, 20 мин, 5 штук, занятые недоступны: Task 4 (`slots.js`) + Task 8 (`/tema/:slug/vremya`). ✅
- Форма ФИО+телефон+вопрос, без email/капчи: Task 7 (`formPage`) + Task 8 (`/zapis`). ✅
- Подтверждение «Вы записаны на …»: Task 7 (`confirmationPage`) + Task 8 (`/gotovo/:id`). ✅
- Один слот = одна запись; телефон не на одно время дважды: Task 2 (уникальные индексы) + Task 5 (`booking.js`). ✅
- Отмена освобождает слот: Task 5 (тест + частичный индекс). ✅
- Админка: один общий вход, список, статусы, расписание, закрытие слота: Task 6 (`auth.js`) + Task 7 (`adminListPage`, `adminSchedulePage`) + Task 8 (admin-маршруты). ✅
- Node.js + Express + SQLite, серверный рендеринг: Task 1, 2, 8. ✅
- Доступность (крупные кнопки, маска телефона, одна колонка на телефоне): Task 9 (CSS + `app.js`). ✅
- Открытые вопросы (ФИО, герб, название комитета): отражены в `data.js`-заглушках и README (Task 3, 10). ✅

**Плейсхолдеры:** в коде нет TODO/«реализовать позже»; «— (ФИО уточняется)» — намеренная видимая заглушка данных, описанная в README.

**Согласованность имён:** `openDb`, `migrate`, `seedCatalog`, `slotTimes`, `upcomingDates`, `availableSlots`, `formatDate`, `parseDate`, `createBooking`, `setStatus`, `BookingError`, `expectedToken`, `checkPassword`, `isAuthed`, `parseCookie`, `createApp` и функции `views.js` используются одинаково во всех задачах и тестах. Статусы везде `new`/`confirmed`/`cancelled`. ✅
