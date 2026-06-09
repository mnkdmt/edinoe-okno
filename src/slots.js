export function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

export function slotTimes(settings) {
  const start = timeToMinutes(settings.start_time);
  return Array.from({ length: settings.slot_count }, (_, i) => minutesToTime(start + i * settings.slot_minutes));
}

export function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d); // локальная полночь — getDay() стабилен
}

export function upcomingDates(weekday, fromDateStr, count) {
  const result = [];
  const d = parseDate(fromDateStr);
  while (result.length < count) {
    if (d.getDay() === weekday) result.push(formatDate(d));
    d.setDate(d.getDate() + 1);
  }
  return result;
}

export function availableSlots(allTimes, takenTimes, blockedTimes = []) {
  const blocked = new Set([...takenTimes, ...blockedTimes]);
  return allTimes.filter(t => !blocked.has(t));
}
