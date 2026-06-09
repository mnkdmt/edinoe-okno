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
