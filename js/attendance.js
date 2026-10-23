// Attendance limits (regulation Art. 29(2)). Pure functions, no DOM.
// At least 70% of theory hours and 80% of practice hours must be attended, so over a
// 14-week term the allowed absence is 30% of (weekly theory hours × 14) and 20% of
// (weekly practice hours × 14). Practice = U + L of the curriculum's T+U+L.
import { isNum } from './util.js';

export const WEEKS = 14;
export const WARN_RATIO = 0.75; // warn once 75% of the allowed absence is used

/** "3+2+0" -> { t: 3, u: 2, l: 0 }; anything else (null, "-", "3+x") -> null. */
export function parseTul(tul) {
  const m = /^\s*(\d+)\s*\+\s*(\d+)\s*\+\s*(\d+)\s*$/.exec(String(tul || ''));
  if (!m) return null;
  return { t: Number(m[1]), u: Number(m[2]), l: Number(m[3]) };
}

/**
 * Allowed absence for a course. Integer arithmetic (percent × hours / 100) keeps the
 * results exact: MATH 2263 (3+2+0) -> theory 42 h, 12.6 h allowed; practice 28 h, 5.6 h.
 * Returns null when the weekly hours are not known.
 */
export function attendanceLimits(tul, weeks = WEEKS) {
  const x = parseTul(tul);
  if (!x || !isNum(weeks) || weeks <= 0) return null;
  const theoryWeekly = x.t;
  const practiceWeekly = x.u + x.l;
  return {
    theoryWeekly,
    practiceWeekly,
    theoryHours: theoryWeekly * weeks,
    practiceHours: practiceWeekly * weeks,
    theoryAllowed: (30 * theoryWeekly * weeks) / 100,
    practiceAllowed: (20 * practiceWeekly * weeks) / 100,
  };
}

/** Largest whole number of hours that can be missed without going over the limit. */
export const wholeHours = (allowed) => (isNum(allowed) && allowed > 0 ? Math.floor(allowed + 1e-9) : 0);

/**
 * Status of one part (theory or practice).
 * state: 'none' (no hours of this kind) | 'ok' | 'warn' (>= 75% used) |
 *        'last' (one more missed hour goes over the limit) | 'over' (limit exceeded -> NA risk)
 */
export function attendanceStatus(used, allowed) {
  const u = isNum(used) && used > 0 ? used : 0;
  if (!isNum(allowed) || allowed <= 0) return { state: 'none', used: u, allowed: 0, ratio: 0, left: 0, wholeLeft: 0 };
  const left = Math.round((allowed - u) * 100) / 100;
  const r = u / allowed;
  let state = 'ok';
  if (u > allowed + 1e-9) state = 'over';
  else if (u + 1 > allowed + 1e-9) state = 'last';
  else if (r >= WARN_RATIO) state = 'warn';
  return { state, used: u, allowed, ratio: r, left, wholeLeft: Math.max(0, wholeHours(allowed) - u) };
}

/** The more serious of two states (for a course-level badge). */
const ORDER = ['none', 'ok', 'warn', 'last', 'over'];
export const worstState = (a, b) => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);

/** Clean stored usage: whole, non-negative hours, capped at the total hours of that kind. */
export function cleanUsed(v, max = 999) {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), max);
}
