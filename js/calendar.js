// Date helpers for the official calendar, exam dates and countdowns.
// Dates are ISO strings "YYYY-MM-DD" handled as calendar days (UTC arithmetic, so no
// daylight-saving surprises). Pure functions, no DOM.

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Valid calendar date "YYYY-MM-DD" -> { y, m, d }, otherwise null (rejects 2026-02-30). */
export function parseIso(s) {
  const m = ISO.exec(String(s || ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

export const isIso = (s) => parseIso(s) !== null;

/** Day number (days since 1970-01-01) of an ISO date, or null. */
export function dayNum(iso) {
  const p = parseIso(iso);
  return p ? Date.UTC(p.y, p.m - 1, p.d) / 86400000 : null;
}

export function isoFromDayNum(n) {
  const t = new Date(n * 86400000);
  const pad = (x) => String(x).padStart(2, '0');
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export const addDays = (iso, n) => isoFromDayNum(dayNum(iso) + n);

/** Whole days from a to b (b - a). */
export const daysBetween = (a, b) => dayNum(b) - dayNum(a);

/** Weekday 0 = Monday … 6 = Sunday (the app's convention). */
export function weekday(iso) {
  const n = dayNum(iso);
  return ((n % 7) + 7 + 3) % 7; // 1970-01-01 was a Thursday (index 3)
}

/** Local calendar date of a Date object. */
export function localIso(date) {
  const pad = (x) => String(x).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Today": ?today=YYYY-MM-DD when valid (demos and tests), otherwise the real local date. */
export function resolveToday(search = '', now = new Date()) {
  let q = null;
  try {
    q = new URLSearchParams(search).get('today');
  } catch (e) {
    q = null;
  }
  return isIso(q) ? q : localIso(now);
}

/**
 * Events relative to today, sorted by start date:
 * [{ ...event, state: 'past' | 'ongoing' | 'upcoming', daysUntil, daysLeft }]
 * daysUntil = days until the start (0 while ongoing); daysLeft = days until the end.
 */
export function relativeEvents(events, today) {
  const t = dayNum(today);
  return events
    .map((e) => {
      const s = dayNum(e.start);
      const en = dayNum(e.end || e.start);
      const state = en < t ? 'past' : s > t ? 'upcoming' : 'ongoing';
      return { ...e, state, daysUntil: Math.max(0, s - t), daysLeft: en - t };
    })
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id < b.id ? -1 : 1));
}

/** Not-yet-finished events, optionally only those starting within `withinDays`. */
export function upcoming(events, today, { withinDays = Infinity, kinds = null } = {}) {
  return relativeEvents(events, today).filter(
    (e) => e.state !== 'past' && e.daysUntil <= withinDays && (!kinds || kinds.includes(e.kind)),
  );
}

/** The next (or current) event of a kind, e.g. the next registration window. */
export function nextOfKind(events, kind, today) {
  return upcoming(events, today, { kinds: [kind] })[0] || null;
}

/** Time left until a target (milliseconds since epoch). */
export function countdown(targetMs, nowMs) {
  if (!Number.isFinite(targetMs) || !Number.isFinite(nowMs)) return null;
  const diff = targetMs - nowMs;
  if (diff <= 0) return { past: true, days: 0, hours: 0, minutes: 0 };
  const minutes = Math.floor(diff / 60000);
  return { past: false, days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 };
}

/** "HH:MM" 24-hour time -> minutes since midnight, otherwise null. */
export function parseTime(s) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Local "YYYY-MM-DDTHH:MM" (datetime-local input) -> { date, time } or null. */
export function parseLocalDateTime(s) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(String(s || ''));
  if (!m || !isIso(m[1]) || parseTime(m[2]) === null) return null;
  return { date: m[1], time: m[2] };
}
