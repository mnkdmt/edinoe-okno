import crypto from 'node:crypto';

export function expectedToken(secret) {
  return crypto.createHmac('sha256', String(secret)).update('admin-session-v1').digest('hex');
}

export function checkPassword(input, password) {
  const a = Buffer.from(String(input));
  const b = Buffer.from(String(password));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function parseCookie(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export function isAuthed(req, secret) {
  const token = parseCookie(req.headers?.cookie || '')['admin'];
  if (!token) return false;
  const exp = expectedToken(secret);
  const a = Buffer.from(token), b = Buffer.from(exp);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
