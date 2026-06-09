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
