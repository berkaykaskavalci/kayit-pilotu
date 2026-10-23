// Number guards shared by every module: nothing on screen may ever read NaN,
// Infinity or undefined. Pure functions, no DOM.

/** True for a finite number (not NaN, not ±Infinity, not a string). */
export const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

/**
 * Parse user input into a finite number, or null. Accepts a decimal comma
 * ("1,88"), surrounding spaces and a leading sign; rejects "", "abc", "1.2.3", "1e999".
 */
export function toNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Clamp a finite number; non-numbers become `lo`. */
export function clamp(x, lo, hi) {
  if (!isNum(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

/** a / b, or null when the result would not be a finite number. */
export function ratio(a, b) {
  if (!isNum(a) || !isNum(b) || b === 0) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}

/** Round half away from zero to `digits` decimals (avoids 0.1 + 0.2 artefacts). */
export function round(x, digits = 2) {
  if (!isNum(x)) return null;
  const f = 10 ** digits;
  return Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9) / f;
}

/**
 * Format a number for display. Non-numbers give `dash` ("—"), never "NaN".
 * Turkish uses a decimal comma. "-0" is shown as "0".
 */
export function fmtNum(x, { digits = 0, lang = 'en', dash = '—' } = {}) {
  if (!isNum(x)) return dash;
  const r = round(x, digits);
  let s = (Object.is(r, -0) || r === 0 ? 0 : r).toFixed(digits);
  if (lang === 'tr') s = s.replace('.', ',');
  return s;
}

/** True when a rendered text contains a value that should never reach the screen. */
export function hasBadText(text) {
  return /\bNaN\b|\bundefined\b|\[object Object\]|\bInfinity\b|\bnull\b/.test(String(text));
}
