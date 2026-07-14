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

test('почта сохраняется, если указана', () => {
  const db = setup();
  const { id } = createBooking(db, { ...valid, email:'ivan@mail.ru' }, TODAY);
  assert.equal(db.prepare('SELECT email FROM bookings WHERE id=?').get(id).email, 'ivan@mail.ru');
});

test('без почты запись создаётся — она по желанию', () => {
  const db = setup();
  const { id } = createBooking(db, valid, TODAY);
  assert.equal(db.prepare('SELECT email FROM bookings WHERE id=?').get(id).email, null);
});

test('кривая почта отклоняется', () => {
  const db = setup();
  assert.throws(() => createBooking(db, { ...valid, email:'не-почта' }, TODAY),
    e => e instanceof BookingError && e.code === 'invalid');
});
