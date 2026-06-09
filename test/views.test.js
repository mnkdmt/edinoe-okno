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
