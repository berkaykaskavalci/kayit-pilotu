// Course catalogue: search, filters and prerequisite chains. Pure functions, no DOM.
import * as E from './engine.js';

/** Case- and accent-insensitive form for searching ("ANALİZ" and "analiz" match; ş->s, ı->i …). */
export function normalize(s) {
  return String(s || '')
    .toLocaleLowerCase('tr')
    .replace(/[ıİ]/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** { [code]: [courses that list `code` in one of their prerequisite groups] } */
export function reversePrereqs(prereqs) {
  const rev = {};
  for (const [target, groups] of Object.entries(prereqs)) {
    for (const g of groups) for (const o of g) {
      rev[o] = rev[o] || [];
      if (!rev[o].includes(target)) rev[o].push(target);
    }
  }
  for (const k of Object.keys(rev)) rev[k].sort();
  return rev;
}

/** Courses this one opens: { direct: [...], all: [...] } (all = transitive, breadth first). */
export function unlocks(code, prereqs) {
  const rev = reversePrereqs(prereqs);
  const direct = rev[code] || [];
  const seen = new Set([code]);
  const all = [];
  const queue = [...direct];
  while (queue.length) {
    const c = queue.shift();
    if (seen.has(c)) continue;
    seen.add(c);
    all.push(c);
    for (const n of rev[c] || []) if (!seen.has(n)) queue.push(n);
  }
  return { direct: [...direct], all };
}

/**
 * Everything a course needs, transitively, as levels:
 * [{ code, groups }] for the course itself and every prerequisite course in the data
 * (old equivalent codes that are not in the data stop the chain).
 */
export function requiresChain(code, prereqs, courseMap) {
  const out = [];
  const seen = new Set();
  const visit = (c) => {
    if (seen.has(c)) return;
    seen.add(c);
    const groups = prereqs[c] || [];
    if (groups.length) out.push({ code: c, groups });
    for (const g of groups) for (const o of g) if (courseMap[o]) visit(o);
  };
  visit(code);
  return out;
}

export const OFFERED_CATS = new Set(['repeat', 'eligible', 'noData', 'blocked', 'passed']);

/**
 * Filter the catalogue (elective slots are not courses and are left out).
 * f = { q, type: 'all'|'compulsory'|'elective', sem: 'all'|'1'…'8'|'pool', offered, eligible, hidePassed }
 */
export function filterCourses(data, profile, f = {}) {
  const cls = E.classify(profile, data);
  const q = normalize(f.q);
  return data.courses.filter((c) => {
    if (c.kind === 'slot') return false;
    const k = cls[c.code];
    if (f.type === 'compulsory' && !(c.kind === 'course' && c.type === 'Z')) return false;
    if (f.type === 'elective' && c.kind !== 'elective') return false;
    if (f.sem && f.sem !== 'all') {
      if (f.sem === 'pool' ? c.kind !== 'elective' : String(c.semester) !== String(f.sem)) return false;
    }
    if (f.offered && !(E.isOffered(c, data) || c.sectionsNotLoaded)) return false;
    if (f.eligible && !E.SELECTABLE.has(k.cat)) return false;
    if (f.hidePassed && k.cat === 'passed') return false;
    if (q) {
      const hay = normalize([c.code, c.label, c.name || '', c.nameEn || ''].join(' '));
      const compact = hay.replace(/\s+/g, '');
      if (!q.split(' ').every((w) => hay.includes(w) || compact.includes(w))) return false;
    }
    return true;
  });
}
