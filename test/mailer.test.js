import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMailer, renderConfirmation } from '../src/mailer.js';

const booking = { full_name:'Иванов Иван', email:'ivan@mail.ru', date:'2026-06-16', time:'12:20' };
const official = { full_name:'Петров П.П.', position:'Начальник управления' };

test('renderConfirmation содержит дату, время и адресата', () => {
  const { subject, text, html } = renderConfirmation(booking, official);
  assert.match(subject, /записаны/i);
  assert.match(text, /12:20/);
  assert.match(text, /Петров/);
  assert.match(html, /Иванов Иван/);
});

test('sendBookingConfirmation вызывает транспорт с нужным адресом', async () => {
  const calls = [];
  const transport = { sendMail: async (m) => { calls.push(m); return { ok: true }; } };
  const mailer = createMailer({ transport, from: 'noreply@soln.ru' });
  const r = await mailer.sendBookingConfirmation(booking, official);
  assert.equal(r.status, 'sent');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, 'ivan@mail.ru');
  assert.equal(calls[0].from, 'noreply@soln.ru');
  assert.match(calls[0].subject, /записаны/i);
});

test('без почты письмо не отправляется', async () => {
  const transport = { sendMail: async () => { throw new Error('не должно вызываться'); } };
  const mailer = createMailer({ transport, from: 'x' });
  const r = await mailer.sendBookingConfirmation({ ...booking, email: null }, official);
  assert.equal(r.status, 'skipped');
});

test('без транспорта — режим лога, без исключений', async () => {
  const mailer = createMailer({ transport: null, from: 'x' });
  const r = await mailer.sendBookingConfirmation(booking, official);
  assert.equal(r.status, 'logged');
});
