import nodemailer from 'nodemailer';

const RU_DAYS = ['вс','пн','вт','ср','чт','пт','сб'];
const RU_MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function humanDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${RU_DAYS[dt.getDay()]}, ${d} ${RU_MONTHS[m - 1]}`;
}

// Транспорт из переменных окружения. Если SMTP_HOST не задан — возвращаем null
// (режим лога: письма не уходят, а печатаются в консоль).
export function buildTransportFromEnv(env = process.env) {
  if (!env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

export function renderConfirmation(booking, official) {
  const when = `${humanDate(booking.date)}, ${booking.time}`;
  const text =
`Здравствуйте, ${booking.full_name}!

Вы записаны на личный приём.

  Когда: ${when}
  К кому: ${official.full_name}
          ${official.position}

При себе — паспорт. Если не сможете прийти, позвоните в приёмную.

Администрация городского округа Солнечногорск`;

  const html =
`<div style="font-family:Arial,sans-serif;font-size:15px;color:#15171C;line-height:1.5">
  <p>Здравствуйте, ${escapeHtml(booking.full_name)}!</p>
  <p>Вы записаны на личный приём.</p>
  <table style="border-collapse:collapse;margin:12px 0">
    <tr><td style="padding:4px 12px 4px 0;color:#5A6472">Когда</td><td style="padding:4px 0"><b>${escapeHtml(when)}</b></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#5A6472">К кому</td><td style="padding:4px 0">${escapeHtml(official.full_name)}<br><span style="color:#5A6472">${escapeHtml(official.position)}</span></td></tr>
  </table>
  <p>При себе — паспорт. Если не сможете прийти, позвоните в приёмную.</p>
  <p style="color:#5A6472">Администрация городского округа Солнечногорск</p>
</div>`;

  return { subject: 'Вы записаны на приём — Солнечногорск', text, html };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

// mailer с методом sendBookingConfirmation. transport — объект с .sendMail()
// (nodemailer или тестовый двойник) либо null для режима лога.
export function createMailer({ transport, from }) {
  return {
    async sendBookingConfirmation(booking, official) {
      if (!booking.email) return { status: 'skipped' };
      const { subject, text, html } = renderConfirmation(booking, official);
      if (!transport) {
        console.log(`[mail:log] Кому: ${booking.email} · Тема: ${subject} (SMTP не настроен, письмо не отправлено)`);
        return { status: 'logged' };
      }
      await transport.sendMail({ from, to: booking.email, subject, text, html });
      return { status: 'sent' };
    },
  };
}
