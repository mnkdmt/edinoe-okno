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
