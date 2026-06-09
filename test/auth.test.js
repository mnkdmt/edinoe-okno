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
