const RU_DAYS = ['вс','пн','вт','ср','чт','пт','сб'];
const RU_MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

export const STATUS_LABELS = { new:'Новая', confirmed:'Подтверждена', cancelled:'Отменена' };

// Контурные иконки тем (stroke=currentColor). Ключ — slug темы.
const ICONS = {
  zhkh: '<path d="M12 3c3.5 4.3 6 7.6 6 10.7A6 6 0 0 1 6 13.7C6 10.6 8.5 7.3 12 3Z"/>',
  dorogi: '<path d="M5 20 9.5 4M19 20 14.5 4M12 5.5v2.5M12 11v2.5M12 16.5V19"/>',
  imushchestvo: '<path d="M4 21h16M6 21V9.5L12 4l6 5.5V21M10 21v-5.5h4V21"/>',
  obrazovanie: '<path d="m12 4 9 4.5-9 4.5-9-4.5L12 4Z"/><path d="M7 11v4.3c0 1.2 2.2 2.7 5 2.7s5-1.5 5-2.7V11"/>',
  kultura: '<path d="M5 4h14v7a7 7 0 0 1-14 0V4Z"/><path d="M9 9h.01M15 9h.01M9 13.3c.8 1 1.9 1.5 3 1.5s2.2-.5 3-1.5"/>',
  sport: '<circle cx="12" cy="12" r="8.5"/><path d="M4.6 8.7c2.5 1.7 12.3 1.7 14.8 0M4.6 15.3c2.5-1.7 12.3-1.7 14.8 0"/>',
  soczashchita: '<path d="M12 20s-7.5-4.7-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.3-7.5 10-7.5 10Z"/>',
  bezopasnost: '<path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  biznes: '<path d="M4.5 9 6 4h12l1.5 5M4.5 9v11h15V9M4.5 9h15M10 20v-6h4v6"/>',
  drugoe: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 0 1 4.8.5c0 1.6-2.4 2-2.4 3.4M12 17h.01"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M5 20c1-3.6 3.8-5.2 7-5.2s6 1.6 7 5.2"/>',
};

const icon = (name, size = 24) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.drugoe}</svg>`;

const CHEVRON = '<svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
const CHECK_SM = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.5 12.5 5 5 10-11"/></svg>';

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

export function humanDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${RU_DAYS[dt.getDay()]}, ${d} ${RU_MONTHS[m - 1]}`;
}

function stepper(current) {
  const steps = ['Тема', 'Время', 'Данные', 'Готово'];
  const items = steps.map((s, i) => {
    const n = i + 1;
    const cls = n < current ? 'step step--done' : n === current ? 'step step--on' : 'step';
    return `<li class="${cls}"><span class="step-n">${n < current ? CHECK_SM : n}</span><span class="step-t">${s}</span></li>`;
  }).join('');
  return `<ol class="steps" aria-label="Шаг ${current} из 4">${items}</ol>`;
}

export function layout({ title, body, admin = false }) {
  return `<!DOCTYPE html><html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css"></head>
<body${admin ? ' class="is-admin"' : ''}>
<div class="ribbon" aria-hidden="true"></div>
<header class="topbar">
  <a class="brand" href="/">
    <img src="/gerb.svg" alt="Герб городского округа Солнечногорск" class="gerb">
    <span class="brand-text">
      <span class="brand-name">Солнечногорск</span>
      <span class="brand-sub">Запись на приём к руководителям администрации</span>
    </span>
  </a>
  ${admin ? '<span class="admin-mark">Служебный раздел</span>' : ''}
</header>
<main class="wrap">${body}</main>
<footer class="foot">Администрация городского округа Солнечногорск</footer>
<script src="/app.js"></script>
</body></html>`;
}

export function topicsPage(topics) {
  const tiles = topics.map(t => `
    <a class="tile" href="/tema/${escapeHtml(t.slug)}">
      <span class="tile-ic">${icon(t.slug)}</span>
      <span class="tile-body">
        <span class="tile-title">${escapeHtml(t.title)}</span>
        <span class="tile-sub">${escapeHtml(t.subtitle)}</span>
      </span>
      ${CHEVRON}
    </a>`).join('');
  const body = `
    <h1 class="h1">С каким вопросом вы обращаетесь?</h1>
    <p class="lead">Выберите тему — покажем, кто за неё отвечает, и свободное время личного приёма.</p>
    <div class="tiles">${tiles}</div>`;
  return layout({ title: 'Запись на приём — Солнечногорск', body });
}

export function officialPage(topic, official) {
  const body = `
    ${stepper(1)}
    <a class="back" href="/">← К темам</a>
    <div class="card">
      <span class="avatar">${icon('person', 30)}</span>
      <div>
        <div class="card-name">${escapeHtml(official.full_name)}</div>
        <div class="card-pos">${escapeHtml(official.position)}</div>
        <div class="card-meta">${escapeHtml(topic.title)}</div>
      </div>
    </div>
    <a class="btn btn--primary btn--big" href="/tema/${escapeHtml(topic.slug)}/vremya">Выбрать время приёма</a>`;
  return layout({ title: 'Запись — ' + topic.title, body });
}

export function slotsPage(topic, dates, selectedDate, available) {
  const days = dates.map(d =>
    `<a class="day${d === selectedDate ? ' day--on' : ''}" href="/tema/${escapeHtml(topic.slug)}/vremya?date=${d}">${humanDate(d)}</a>`).join('');
  const times = available.length
    ? available.map(t => `<a class="slot" href="/tema/${escapeHtml(topic.slug)}/forma?date=${selectedDate}&time=${t}">${t}</a>`).join('')
    : `<div class="empty">На этот день свободного времени нет. Выберите другой день.</div>`;
  const body = `
    ${stepper(2)}
    <a class="back" href="/tema/${escapeHtml(topic.slug)}">← Назад</a>
    <h1 class="h1 h1--sm">Выберите день и время</h1>
    <div class="label-row">День приёма</div>
    <div class="days">${days}</div>
    <div class="label-row">Свободное время · приём 20 минут</div>
    <div class="slots">${times}</div>`;
  return layout({ title: 'Выбор времени', body });
}

export function formPage(topic, date, time, values = {}, error = '') {
  const body = `
    ${stepper(3)}
    <a class="back" href="/tema/${escapeHtml(topic.slug)}/vremya?date=${date}">← Назад</a>
    <div class="note"><b>${escapeHtml(topic.title)}</b> · ${humanDate(date)}, <b>${time}</b></div>
    ${error ? `<div class="error" role="alert">${escapeHtml(error)}</div>` : ''}
    <form method="post" action="/zapis" class="form">
      <input type="hidden" name="slug" value="${escapeHtml(topic.slug)}">
      <input type="hidden" name="date" value="${date}">
      <input type="hidden" name="time" value="${time}">
      <div class="field">
        <label for="f-name">Ваше ФИО</label>
        <input id="f-name" name="full_name" required autocomplete="name" enterkeyhint="next"
          value="${escapeHtml(values.full_name || '')}" placeholder="Петров Пётр Петрович">
      </div>
      <div class="field">
        <label for="f-phone">Контактный телефон</label>
        <input id="f-phone" name="phone" type="tel" required autocomplete="tel" inputmode="tel"
          enterkeyhint="next" aria-describedby="f-phone-hint"
          value="${escapeHtml(values.phone || '')}" placeholder="+7 (___) ___-__-__">
        <span class="hint" id="f-phone-hint">На этот номер позвонят, если приём перенесётся</span>
      </div>
      <div class="field">
        <label for="f-q">Коротко суть вопроса</label>
        <textarea id="f-q" name="question" required rows="4"
          placeholder="Опишите вопрос в двух-трёх предложениях">${escapeHtml(values.question || '')}</textarea>
      </div>
      <button class="btn btn--primary btn--big" type="submit">Записаться</button>
    </form>`;
  return layout({ title: 'Запись', body });
}

export function confirmationPage(booking, official) {
  const body = `
    ${stepper(4)}
    <div class="done">
      <svg class="done-mark" width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <circle cx="36" cy="36" r="33" stroke="currentColor" stroke-width="3"/>
        <path d="M22 37.5 32 47l18-21" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h1 class="done-title">Вы записаны на приём</h1>
      <div class="done-when">${humanDate(booking.date)} · ${booking.time}</div>
      <div class="done-who">${escapeHtml(official.full_name)}<br><span>${escapeHtml(official.position)}</span></div>
      <div class="done-note">Запишите дату и время. При себе — паспорт.<br>Если не сможете прийти — позвоните в приёмную.</div>
      <a class="btn btn--big" href="/">На главную</a>
    </div>`;
  return layout({ title: 'Готово', body });
}

export function adminLoginPage(error = '') {
  const body = `<div class="login">
    <h1 class="h1 h1--sm">Вход для сотрудников</h1>
    ${error ? `<div class="error" role="alert">${escapeHtml(error)}</div>` : ''}
    <form method="post" action="/admin/vhod" class="form">
      <div class="field">
        <label for="a-pass">Пароль</label>
        <input id="a-pass" name="password" type="password" required autocomplete="current-password" autofocus>
      </div>
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
    <td class="td-when">${humanDate(b.date)}<br><b>${b.time}</b></td>
    <td>${escapeHtml(b.full_name)}</td>
    <td class="td-num">${escapeHtml(b.phone)}</td>
    <td>${escapeHtml(b.topic_title || '')}<br><span class="muted">${escapeHtml(b.official_name)}</span></td>
    <td class="td-q">${escapeHtml(b.question)}</td>
    <td><span class="badge badge--${b.status}">${STATUS_LABELS[b.status]}</span></td>
    <td class="actions">
      <form method="post" action="/admin/zapis/${b.id}/status"><input type="hidden" name="status" value="confirmed"><button class="btn btn--xs" ${b.status === 'confirmed' ? 'disabled' : ''}>Подтвердить</button></form>
      <form method="post" action="/admin/zapis/${b.id}/status"><input type="hidden" name="status" value="cancelled"><button class="btn btn--xs btn--danger" ${b.status === 'cancelled' ? 'disabled' : ''}>Отменить</button></form>
    </td></tr>`).join('');
  const body = `<div class="admin-head">
      <h1 class="h1 h1--sm">Записи на приём</h1>
      <div class="admin-head-actions">
        <a class="btn" href="/admin/raspisanie">Расписание</a>
        <form method="post" action="/admin/vyhod"><button class="btn">Выйти</button></form>
      </div></div>
    <div class="chips">${chips}</div>
    <div class="tbl-wrap"><table class="tbl">
      <tr><th>Когда</th><th>Житель</th><th>Телефон</th><th>Тема / к кому</th><th>Вопрос</th><th>Статус</th><th></th></tr>
      ${rows || '<tr><td colspan="7" class="muted">Записей пока нет</td></tr>'}
    </table></div>`;
  return layout({ title: 'Админка', body, admin: true });
}

export function adminSchedulePage(settings, officials = [], saved = false) {
  const days = [['1','Понедельник'],['2','Вторник'],['3','Среда'],['4','Четверг'],['5','Пятница']];
  const weekdayOpts = days.map(([v, l]) =>
    `<option value="${v}" ${Number(settings.weekday) === Number(v) ? 'selected' : ''}>${l}</option>`).join('');
  const offOpts = officials.map(o =>
    `<option value="${o.id}">${escapeHtml(o.full_name)} — ${escapeHtml(o.position)}</option>`).join('');
  const body = `<a class="back" href="/admin">← К записям</a>
    <h1 class="h1 h1--sm">Параметры приёма</h1>
    ${saved ? '<div class="ok" role="status">Сохранено</div>' : ''}
    <form method="post" action="/admin/raspisanie" class="form">
      <div class="field"><label for="s-wd">День приёма</label><select id="s-wd" name="weekday">${weekdayOpts}</select></div>
      <div class="field"><label for="s-st">Начало (ЧЧ:ММ)</label><input id="s-st" name="start_time" value="${escapeHtml(settings.start_time)}"></div>
      <div class="field"><label for="s-sm">Длина слота, мин</label><input id="s-sm" name="slot_minutes" type="number" min="5" value="${settings.slot_minutes}"></div>
      <div class="field"><label for="s-sc">Количество слотов</label><input id="s-sc" name="slot_count" type="number" min="1" value="${settings.slot_count}"></div>
      <div class="field"><label for="s-wa">На сколько недель вперёд</label><input id="s-wa" name="weeks_ahead" type="number" min="1" value="${settings.weeks_ahead}"></div>
      <button class="btn btn--primary btn--big" type="submit">Сохранить</button>
    </form>
    <h2 class="h2">Закрыть отдельный слот</h2>
    <form method="post" action="/admin/slot/zakryt" class="form">
      <div class="field"><label for="b-off">Кому</label><select id="b-off" name="official_id">${offOpts}</select></div>
      <div class="field"><label for="b-date">Дата (ГГГГ-ММ-ДД)</label><input id="b-date" name="date" placeholder="2026-06-16"></div>
      <div class="field"><label for="b-time">Время (ЧЧ:ММ)</label><input id="b-time" name="time" placeholder="12:20"></div>
      <button class="btn btn--big" type="submit">Закрыть слот</button>
    </form>`;
  return layout({ title: 'Расписание', body, admin: true });
}
