// iCalendar (RFC 5545) export. Pure functions, no DOM.
// Times are local Turkey time (UTC+3 all year since 2016, no daylight saving), converted
// to UTC ("Z") so no VTIMEZONE block is needed and every calendar app agrees.
import { parseIso, dayNum, isoFromDayNum, weekday } from './calendar.js';

export const TZ_OFFSET_MIN = 180;
const CRLF = '\r\n';

/** Escape TEXT values: backslash, semicolon, comma and newlines. */
export function icsEscape(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

const utf8Len = (s) => new TextEncoder().encode(s).length;

/** Fold a content line at 75 octets (continuation lines start with one space). Never splits a character. */
export function foldLine(line) {
  if (utf8Len(line) <= 75) return line;
  const out = [];
  let cur = '';
  let curLen = 0;
  let limit = 75;
  for (const ch of line) {
    const n = utf8Len(ch);
    if (curLen + n > limit) {
      out.push(cur);
      cur = ' ';
      curLen = 1;
      limit = 75;
    }
    cur += ch;
    curLen += n;
  }
  out.push(cur);
  return out.join(CRLF);
}

const pad = (x, n = 2) => String(x).padStart(n, '0');
const ymd = (iso) => iso.replace(/-/g, '');

/** Date -> "YYYYMMDDTHHMMSSZ". */
export function utcStamp(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/** Local date + minutes since midnight (Turkey time) -> UTC stamp. */
export function localToUtc(iso, minutes, offsetMin = TZ_OFFSET_MIN) {
  const p = parseIso(iso);
  return utcStamp(new Date(Date.UTC(p.y, p.m - 1, p.d) + (minutes - offsetMin) * 60000));
}

/**
 * Build a VCALENDAR. events:
 *  all-day : { uid, summary, description?, location?, date, endDate? }  (endDate inclusive)
 *  timed   : { uid, summary, description?, location?, date, start, end? } (minutes since midnight)
 *  weekly  : timed + { weeklyUntil: 'YYYY-MM-DD', exdates: ['YYYY-MM-DD'] }
 * Events with an invalid date are skipped (never written half-formed).
 */
export function buildIcs({ name = 'Kayıt Pilotu', events = [], dtstamp = new Date() } = {}) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kayit Pilotu//Student planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsEscape(name)}`];
  const stamp = utcStamp(dtstamp);
  for (const e of events) {
    if (!parseIso(e.date)) continue;
    const timed = Number.isInteger(e.start);
    if (!timed && e.endDate && !parseIso(e.endDate)) continue;
    L.push('BEGIN:VEVENT', `UID:${icsEscape(e.uid)}`, `DTSTAMP:${stamp}`);
    if (timed) {
      L.push(`DTSTART:${localToUtc(e.date, e.start)}`);
      if (Number.isInteger(e.end) && e.end > e.start) L.push(`DTEND:${localToUtc(e.date, e.end)}`);
      if (e.weeklyUntil && parseIso(e.weeklyUntil)) {
        L.push(`RRULE:FREQ=WEEKLY;UNTIL=${localToUtc(e.weeklyUntil, 23 * 60 + 59)}`);
        for (const x of e.exdates || []) if (parseIso(x)) L.push(`EXDATE:${localToUtc(x, e.start)}`);
      }
    } else {
      const last = e.endDate && dayNum(e.endDate) >= dayNum(e.date) ? e.endDate : e.date;
      L.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${ymd(isoFromDayNum(dayNum(last) + 1))}`, 'TRANSP:TRANSPARENT');
    }
    L.push(`SUMMARY:${icsEscape(e.summary)}`);
    if (e.location) L.push(`LOCATION:${icsEscape(e.location)}`);
    if (e.description) L.push(`DESCRIPTION:${icsEscape(e.description)}`);
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(foldLine).join(CRLF) + CRLF;
}

/**
 * Weekly class events for chosen sections.
 * blocks: [{ key, summary, location, d (0=Mon), fromMin, toMin }]
 * term  : { start, end, noClass: [iso], makeup: [{ date, runs: weekday }] }
 * Every block repeats weekly from its first weekday on/after term.start until term.end,
 * skips no-class days, and is added once more on a Saturday make-up day that runs its weekday.
 */
export function weeklyClassEvents(blocks, term) {
  const out = [];
  for (const b of blocks) {
    let first = term.start;
    while (weekday(first) !== b.d) first = isoFromDayNum(dayNum(first) + 1);
    if (dayNum(first) > dayNum(term.end)) continue;
    const exdates = (term.noClass || []).filter((x) => weekday(x) === b.d && dayNum(x) >= dayNum(first) && dayNum(x) <= dayNum(term.end));
    out.push({ uid: `class-${b.key}@kayit-pilotu`, summary: b.summary, location: b.location, description: b.description, date: first, start: b.fromMin, end: b.toMin, weeklyUntil: term.end, exdates });
    for (const mk of term.makeup || []) {
      if (mk.runs !== b.d) continue;
      out.push({ uid: `makeup-${mk.date}-${b.key}@kayit-pilotu`, summary: b.summary, location: b.location, description: b.makeupNote || b.description, date: mk.date, start: b.fromMin, end: b.toMin });
    }
  }
  return out;
}

/**
 * Structural validation used by the tests: CRLF line endings, no line over 75 octets,
 * balanced BEGIN/END, and UID + DTSTAMP + DTSTART in every VEVENT.
 * Returns a list of problems (empty = valid).
 */
export function validateIcs(text) {
  const problems = [];
  if (!text.endsWith(CRLF)) problems.push('does not end with CRLF');
  if (/[^\r]\n/.test(text) || /\r(?!\n)/.test(text)) problems.push('bare LF or CR');
  const lines = text.split(CRLF).slice(0, -1);
  lines.forEach((l, i) => { if (utf8Len(l) > 75) problems.push(`line ${i + 1} longer than 75 octets`); });
  const unfolded = [];
  for (const l of lines) {
    if (l.startsWith(' ') && unfolded.length) unfolded[unfolded.length - 1] += l.slice(1);
    else unfolded.push(l);
  }
  if (unfolded[0] !== 'BEGIN:VCALENDAR' || unfolded[unfolded.length - 1] !== 'END:VCALENDAR') problems.push('not wrapped in VCALENDAR');
  if (!unfolded.includes('VERSION:2.0')) problems.push('VERSION missing');
  if (!unfolded.some((l) => l.startsWith('PRODID:'))) problems.push('PRODID missing');
  const stack = [];
  let props = null;
  const uids = new Set();
  for (const l of unfolded) {
    if (l.startsWith('BEGIN:')) {
      stack.push(l.slice(6));
      if (l === 'BEGIN:VEVENT') props = [];
    } else if (l.startsWith('END:')) {
      const top = stack.pop();
      if (top !== l.slice(4)) problems.push(`unbalanced ${l}`);
      if (l === 'END:VEVENT') {
        for (const p of ['UID', 'DTSTAMP', 'DTSTART', 'SUMMARY']) if (!props.some((x) => x === p)) problems.push(`VEVENT without ${p}`);
        props = null;
      }
    } else if (props) {
      const name = l.split(/[;:]/)[0];
      props.push(name);
      if (name === 'UID') {
        const v = l.slice(4);
        if (uids.has(v)) problems.push(`duplicate UID ${v}`);
        uids.add(v);
      }
    }
  }
  if (stack.length) problems.push('unclosed component');
  return problems;
}
