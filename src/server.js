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
