// Grades and "what do I need on the final" from the Bologna assessment weights.
// Pure functions, no DOM.
import { ASSESSMENT_RAW } from './data-extra.js';
import { isNum, round } from './util.js';

// Standard Turkish 4.00 letter scale (assumed; the regulation text we have does not list it).
export const LETTERS = [
  { l: 'A', gp: 4.0 },
  { l: 'A-', gp: 3.7 },
  { l: 'B+', gp: 3.3 },
  { l: 'B', gp: 3.0 },
  { l: 'B-', gp: 2.7 },
  { l: 'C+', gp: 2.3 },
  { l: 'C', gp: 2.0 },
  { l: 'C-', gp: 1.7 },
  { l: 'D+', gp: 1.3 },
  { l: 'D', gp: 1.0 },
  { l: 'F', gp: 0.0 },
];
export const GP = Object.fromEntries(LETTERS.map((x) => [x.l, x.gp]));
export const PASS_LETTERS = LETTERS.filter((x) => x.l !== 'F').map((x) => x.l);

// Example letter thresholds (minimum course score for each letter). They are NOT from the
// university: every instructor sets their own in the syllabus, so the app lets you edit them.
export const DEFAULT_THRESHOLDS = { A: 90, 'A-': 85, 'B+': 80, B: 75, 'B-': 70, 'C+': 65, C: 60, 'C-': 55, 'D+': 50, D: 45 };

/** Safe key for a letter in ids / data-testid: "A-" -> "Am", "B+" -> "Bp". */
export const letterKey = (l) => l.replace('+', 'p').replace('-', 'm');

/** Up to this many instances an item gets one input each; above it, one "average" input. */
export const MAX_SPLIT = 4;

/** "ME3320 :: Mid-Term~1~30;Quiz~2~20;Practice~1~10;Final~1~40" -> scheme object. */
export function parseAssessment(line) {
  const [code, restRaw] = line.split('::').map((s) => s.trim());
  const note = /\(INCOMPLETE[^)]*\)/.exec(restRaw);
  const rest = restRaw.replace(/\(INCOMPLETE[^)]*\)/, '').trim();
  const items = rest
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [name, count, weight] = s.split('~').map((x) => x.trim());
      return { name, count: Number(count), weight: Number(weight), isFinal: name === 'Final' };
    });
  const total = items.reduce((n, it) => n + it.weight, 0);
  return {
    code,
    items,
    total,
    complete: total === 100,
    hasFinal: items.some((it) => it.isFinal),
    finalWeight: items.filter((it) => it.isFinal).reduce((n, it) => n + it.weight, 0),
    sourceNote: note ? note[0] : null,
  };
}

export const ASSESSMENTS = Object.fromEntries(ASSESSMENT_RAW.map((l) => {
  const s = parseAssessment(l);
  return [s.code, s];
}));

/** How many inputs an item has in the UI. */
export const inputsFor = (item) => (item.count <= MAX_SPLIT ? item.count : 1);

/** A score is a finite number from 0 to 100; anything else counts as not entered. */
export const validScore = (v) => isNum(v) && v >= 0 && v <= 100;

/** { avg, entered, needed, complete } for one item's entered scores. */
export function itemAverage(item, values) {
  const needed = inputsFor(item);
  const list = (Array.isArray(values) ? values : []).slice(0, needed).filter(validScore);
  const avg = list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
  return { avg, entered: list.length, needed, complete: list.length === needed };
}

/**
 * Current standing for a course.
 * scores: { [itemIndex]: number[] }
 * Returns { status, earned, knownWeight, missing: [itemIndex], ... } where status is
 *   'noScheme'   - no weights in the source
 *   'incomplete' - the weights do not sum to 100 in the source: nothing is projected
 *   'noFinal'    - no final in the scheme: the course score is the weighted sum
 *   'ok'         - normal scheme with a final
 * earned = points already secured (weight × average / 100 over fully entered non-final items).
 */
export function courseStanding(scheme, scores = {}) {
  if (!scheme) return { status: 'noScheme', earned: 0, knownWeight: 0, missing: [] };
  let earned = 0;
  let knownWeight = 0;
  const missing = [];
  scheme.items.forEach((it, i) => {
    if (it.isFinal) return;
    const a = itemAverage(it, scores[i]);
    if (a.complete) {
      earned += (it.weight * a.avg) / 100;
      knownWeight += it.weight;
    } else missing.push(i);
  });
  earned = round(earned, 4);
  const status = !scheme.complete ? 'incomplete' : scheme.hasFinal ? 'ok' : 'noFinal';
  return { status, earned, knownWeight, missing };
}

/** Thresholds must be numbers from 0 to 100, strictly decreasing from A to D. */
export function validThresholds(th) {
  let prev = Infinity;
  for (const l of PASS_LETTERS) {
    const v = th ? th[l] : undefined;
    if (!validScore(v) || v >= prev) return false;
    prev = v;
  }
  return true;
}

/** Letter for a course score with the given thresholds ("F" below D). */
export function letterFor(score, th = DEFAULT_THRESHOLDS) {
  if (!isNum(score)) return null;
  for (const l of PASS_LETTERS) if (score + 1e-9 >= th[l]) return l;
  return 'F';
}

/**
 * Final score needed for each letter:
 *   need = (threshold - earned) / (finalWeight / 100), rounded UP to one decimal.
 * Every row: { letter, threshold, need, state } with state
 *   'secured'    - reached even with 0 on the final
 *   'need'       - need is between 0 and 100
 *   'impossible' - would need more than 100
 * Returns { status } (see courseStanding) plus rows only when status is 'ok' and every
 * non-final item has been entered.
 */
export function finalNeeded(scheme, scores, th = DEFAULT_THRESHOLDS) {
  const st = courseStanding(scheme, scores);
  if (st.status !== 'ok') return { ...st, rows: [] };
  if (!validThresholds(th)) return { ...st, status: 'badThresholds', rows: [] };
  if (st.missing.length) return { ...st, status: 'missing', rows: [] };
  const fw = scheme.finalWeight;
  const rows = PASS_LETTERS.map((letter) => {
    const threshold = th[letter];
    const raw = ((threshold - st.earned) * 100) / fw;
    const need = Math.ceil(raw * 10 - 1e-6) / 10;
    let state = 'need';
    if (raw <= 1e-9) state = 'secured';
    else if (raw > 100 + 1e-9) state = 'impossible';
    return { letter, threshold, need: state === 'need' ? Math.max(0, need) : null, state };
  });
  return { ...st, finalWeight: fw, rows };
}

/** For schemes without a final: the course score once every item is entered. */
export function totalWithoutFinal(scheme, scores, th = DEFAULT_THRESHOLDS) {
  const st = courseStanding(scheme, scores);
  if (st.status !== 'noFinal') return { ...st, total: null, letter: null };
  if (st.missing.length) return { ...st, total: null, letter: null };
  return { ...st, total: st.earned, letter: validThresholds(th) ? letterFor(st.earned, th) : null };
}
