// Graduation roadmap and CGPA projection. Pure functions, no DOM.
//
// Assumptions (shown in the app):
//  - Courses of odd curriculum semesters are offered in fall, even ones in spring.
//  - In the current term (Fall 2026-27) a course must also really be in the timetable
//    (or be the internship / a course whose sections were not captured); elective slots
//    can be filled in the term matching their curriculum semester.
//  - In later falls, courses that have Fall 2026-27 sections are assumed to be offered again.
//  - A prerequisite must be passed in an EARLIER term (Art. 28(c)); ME 4920 therefore comes after ME 4910.
//  - Every planned course is passed with the expected letter; no summer school.
//  - Load limit per term: 40 ECTS with a (projected) CGPA of 2.00 or more, otherwise 32.
//  - A retaken course's new grade replaces the F in the CGPA ("last grade counts").
import * as E from './engine.js';
import { GP } from './grades.js';
import { isNum, round } from './util.js';

const SEASONS = ['fall', 'spring'];

/** Term number k (0 = current term, Fall 2026-27) -> { season, y1, y2 }. */
export function termOf(k, startYear = 2026) {
  const season = SEASONS[k % 2];
  const y1 = startYear + Math.floor(k / 2);
  return { k, season, y1, y2: y1 + 1 };
}

/** Curriculum units not passed yet: courses and elective slots of semesters 1-8. */
export function remainingUnits(profile, data) {
  const st = profile.status || {};
  const out = [];
  for (const s of data.semesters) {
    for (const c of s.courses) {
      if (st[c.code] === 'passed') continue;
      out.push({ code: c.code, ects: c.ects, semester: s.n, kind: c.kind, failed: st[c.code] === 'failed' });
    }
  }
  return out;
}

/** Is the unit offered in term k? */
export function offeredIn(unit, k, data) {
  const { season } = termOf(k);
  const pattern = unit.semester % 2 === 1 ? 'fall' : 'spring';
  const c = data.courseMap[unit.code];
  const hasFallSections = !!(c && (c.noTimetable || c.sectionsNotLoaded || (data.sectionsByCourse[unit.code] || []).length));
  if (unit.kind === 'slot') return season === pattern;
  if (k === 0) return hasFallSections; // the current term: the real timetable decides
  if (season === 'fall') return pattern === 'fall' || hasFallSections;
  return pattern === 'spring';
}

/** ECTS counted in the CGPA so far (curriculum units with a passing or failing grade). */
export function gradedEcts(profile, data) {
  const st = profile.status || {};
  let n = 0;
  for (const s of data.semesters) for (const c of s.courses) if (st[c.code] === 'passed' || st[c.code] === 'failed') n += c.ects;
  return n;
}

/**
 * CGPA after a term: the term's new courses add credits; retakes replace an F (0 points)
 * without adding credits. Returns null when the CGPA is unknown.
 */
export function cgpaAfter({ cgpa, base, termEcts, retakeEcts, gp }) {
  if (!isNum(cgpa) || !isNum(base) || !isNum(gp)) return null;
  const newCredits = base + termEcts - retakeEcts;
  if (newCredits <= 0) return null;
  return (cgpa * base + gp * termEcts) / newCredits;
}

/**
 * Term average (on the 4.00 scale) needed to reach `target` CGPA after a term:
 *   avg >= (target × (base + T − R) − cgpa × base) / T
 * Returns { need, state }: state 'already' (any passing average works, need <= 1.00 means
 * a D average is enough), 'reachable' (need ≤ 4), 'impossible' (need > 4), or 'unknown'.
 */
export function averageNeeded({ cgpa, base, termEcts, retakeEcts, target = 2.0 }) {
  if (!isNum(cgpa) || !isNum(base) || !isNum(termEcts) || termEcts <= 0) return { need: null, state: 'unknown' };
  const need = (target * (base + termEcts - retakeEcts) - cgpa * base) / termEcts;
  if (!Number.isFinite(need)) return { need: null, state: 'unknown' };
  if (need <= 0) return { need: 0, state: 'already' };
  if (need > 4 + 1e-9) return { need: round(need, 2), state: 'impossible' };
  return { need: Math.ceil(need * 100 - 1e-6) / 100, state: 'reachable' };
}

/** Lowest letter whose grade point is at least `need`. */
export function letterAtLeast(need) {
  if (!isNum(need)) return null;
  const order = ['D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A'];
  return order.find((l) => GP[l] + 1e-9 >= need) || null;
}

// Prerequisite groups of a unit that are not yet satisfied by `passed`, restricted to
// options that are still remaining units (other options can never be satisfied by the plan).
function openGroups(code, passed, remainingSet, data) {
  return (data.prereqs[code] || []).filter((g) => !g.some((o) => passed.has(o))).map((g) => g.filter((o) => remainingSet.has(o)));
}

/**
 * Earliest graduation plan.
 * opts: { gp: grade point of the expected average (null = unknown CGPA path), maxTerms }
 * Returns {
 *   terms: [{ k, season, y1, y2, codes, ects, limit, retakeEcts, cgpaAfter }],
 *   remainingEcts, unscheduled: [codes], lowerBound, proven, graduation: { k, season, y1, y2 } | null
 * }
 * Greedy fill per term in this order: retakes first, then lower curriculum semester, then
 * the course with the longer chain of courses waiting on it. `lowerBound` ignores ECTS
 * limits per course (each unit's earliest possible term) and also divides the remaining
 * ECTS by 40; when the plan needs exactly that many terms it is provably the earliest
 * under these assumptions.
 */
export function earliestPlan(profile, data, { gp = null, maxTerms = 12 } = {}) {
  const units = remainingUnits(profile, data);
  const remainingSet = new Set(units.map((u) => u.code));
  const passed = E.passedSet(profile);
  const byCode = Object.fromEntries(units.map((u) => [u.code, u]));

  // How many terms of courses wait on each unit (longer chain = schedule earlier).
  const dependents = {};
  for (const u of units) {
    for (const g of openGroups(u.code, passed, remainingSet, data)) for (const o of g) (dependents[o] = dependents[o] || []).push(u.code);
  }
  const depthMemo = {};
  const depth = (code, seen = new Set()) => {
    if (depthMemo[code] !== undefined) return depthMemo[code];
    if (seen.has(code)) return 0;
    seen.add(code);
    const d = 1 + Math.max(0, ...(dependents[code] || []).map((x) => depth(x, seen)));
    depthMemo[code] = d;
    return d;
  };

  // Lower bound: earliest term of every unit when ECTS limits are ignored.
  const earliestMemo = {};
  const earliest = (code, seen = new Set()) => {
    if (earliestMemo[code] !== undefined) return earliestMemo[code];
    if (seen.has(code)) return Infinity;
    seen.add(code);
    let from = 0;
    for (const g of openGroups(code, passed, remainingSet, data)) {
      const best = g.length ? Math.min(...g.map((o) => earliest(o, seen) + 1)) : Infinity;
      from = Math.max(from, best);
    }
    let k = from;
    while (k < maxTerms && !offeredIn(byCode[code], k, data)) k++;
    const v = k < maxTerms ? k : Infinity;
    earliestMemo[code] = v;
    return v;
  };
  const remainingEcts = units.reduce((n, u) => n + u.ects, 0);
  const chainBound = units.length ? Math.max(...units.map((u) => earliest(u.code))) + 1 : 0;
  const lowerBound = Math.max(chainBound, Math.ceil(remainingEcts / E.HIGH_MAX_ECTS));

  let cgpa = isNum(profile.cgpa) ? profile.cgpa : null;
  let base = gradedEcts(profile, data);
  const done = new Set(passed);
  const left = new Set(remainingSet);
  const terms = [];
  for (let k = 0; k < maxTerms && left.size; k++) {
    const limit = E.ectsLimits({ cgpa: gp === null ? profile.cgpa : cgpa }).max;
    const cand = [...left]
      .map((c) => byCode[c])
      .filter((u) => offeredIn(u, k, data) && E.evalPrereq(u.code, done, data.prereqs).ok)
      .sort((a, b) => (b.failed - a.failed) || (a.semester - b.semester) || (depth(b.code) - depth(a.code)) || (b.ects - a.ects) || (a.code < b.code ? -1 : 1));
    const codes = [];
    let ects = 0;
    let retakeEcts = 0;
    for (const u of cand) {
      if (ects + u.ects > limit) continue;
      codes.push(u.code);
      ects += u.ects;
      if (u.failed) retakeEcts += u.ects;
    }
    const t = termOf(k);
    let after = null;
    if (gp !== null && cgpa !== null && ects > 0) {
      after = cgpaAfter({ cgpa, base, termEcts: ects, retakeEcts, gp });
      base = base + ects - retakeEcts;
      cgpa = after;
    } else if (gp !== null) after = cgpa;
    terms.push({ ...t, codes, ects, limit, retakeEcts, cgpaAfter: after === null ? null : round(after, 2) });
    for (const c of codes) {
      done.add(c);
      left.delete(c);
    }
  }
  // Trailing empty terms (nothing could be scheduled) are not part of the plan.
  while (terms.length && !terms[terms.length - 1].codes.length) terms.pop();
  const unscheduled = [...left].sort();
  const complete = units.length > 0 && !unscheduled.length;
  return {
    terms,
    remainingEcts,
    unscheduled,
    lowerBound: Number.isFinite(lowerBound) ? lowerBound : null,
    proven: complete && terms.length === lowerBound,
    graduation: complete ? termOf(terms.length - 1) : null,
    alreadyDone: !units.length,
  };
}
