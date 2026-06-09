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

test('забронированные слоты исчезают со страницы выбора времени', async () => {
  const a = await startApp();
  const page = await (await fetch(a.base + '/tema/zhkh/vremya')).text();
  const dates = [...new Set([...page.matchAll(/date=(\d{4}-\d{2}-\d{2})/g)].map(m => m[1]))];
  const target = dates[1]; // второй ближайший вторник — гарантированно будущий, все 5 слотов
  const slotPage = await (await fetch(a.base + '/tema/zhkh/vremya?date=' + target)).text();
  const times = [...new Set([...slotPage.matchAll(/time=(\d{2}:\d{2})/g)].map(m => m[1]))];
  assert.equal(times.length, 5);
  for (let i = 0; i < times.length; i++) {
    const r = await fetch(a.base + '/zapis', { method:'POST', redirect:'manual',
      body: new URLSearchParams({ slug:'zhkh', date:target, time:times[i],
        full_name:'Житель'+i, phone:'+790500001'+String(i).padStart(2,'0'), question:'вопрос' }) });
    assert.equal(r.status, 302, 'слот ' + times[i] + ' должен забронироваться');
  }
  const after = await (await fetch(a.base + '/tema/zhkh/vremya?date=' + target)).text();
  assert.match(after, /свободного времени нет/);
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
