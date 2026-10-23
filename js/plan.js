// Registration-day plan: Plan A, entry order, "if this section is full -> switch to",
// and Plan B / Plan C from the exact search. Pure functions, no DOM.
// `full` = { [code]: [section numbers the student marked as full] } (a simulation: the live
// quota is not public; room capacity is only the size of the room).
import * as E from './engine.js';

export function isFull(full, code, no) {
  return !!(full && Array.isArray(full[code]) && full[code].includes(no));
}

/** Data with the full sections removed (sections with the same times stay as separate options). */
export function dataWithout(data, full) {
  const sectionsByCourse = {};
  for (const [code, list] of Object.entries(data.sectionsByCourse)) sectionsByCourse[code] = list.filter((s) => !isFull(full, code, s.no));
  return { ...data, sectionsByCourse };
}

/** Timed courses whose every section is marked full. */
export function exhausted(codes, data, full) {
  return codes.filter((c) => {
    const list = data.sectionsByCourse[c] || [];
    return list.length > 0 && list.every((s) => isFull(full, c, s.no));
  });
}

const timedOf = (codes, data) => codes.filter((c) => E.needsSection(c, data));
const sectionOf = (data, code, no) => (data.sectionsByCourse[code] || []).find((s) => s.no === no) || null;

function sectionsFromPlan(items, plan, prefer = {}) {
  const out = {};
  items.forEach((it, i) => {
    const o = it.options[plan[i]];
    if (o.untimed) return;
    out[it.code] = o.nos.includes(prefer[it.code]) ? prefer[it.code] : o.nos[0];
  });
  return out;
}

/**
 * Plan A = the student's chosen sections. Courses without a choice are filled with the best
 * match of the exact search; if the chosen sections clash, the best plan without pins is used.
 * Returns { ok, sections, filled: [codes not chosen by the student], source: 'picks' | 'filled' | 'search' | 'none' }.
 */
export function planA(codes, picks, data, prefs = E.DEFAULT_PREFS) {
  const timed = timedOf(codes, data);
  const pins = {};
  for (const c of timed) {
    const p = picks ? picks[c] : undefined;
    const opts = E.optionsFor(c, data);
    if (p !== undefined && p !== null && opts.some((o) => o.nos.includes(p))) pins[c] = p;
    else if (opts.length === 1) pins[c] = opts[0].nos[0]; // single timetable: chosen automatically
  }
  let items = E.buildItems(timed, data, pins);
  let res = E.searchPlans(items, prefs, { keep: 1 });
  let source = timed.every((c) => pins[c] !== undefined) ? 'picks' : 'filled';
  if (!res.total) {
    items = E.buildItems(timed, data, {});
    res = E.searchPlans(items, prefs, { keep: 1 });
    source = 'search';
    if (!res.total) return { ok: false, sections: {}, filled: [], source: 'none' };
  }
  const sections = sectionsFromPlan(items, res.best[0].plan, pins);
  return { ok: true, sections, filled: timed.filter((c) => sections[c] !== pins[c]), source };
}

/**
 * Sections that can replace the Plan A section of `code` if it is full: not marked full
 * and no overlap with the other Plan A sections. Same-time sections first (nothing else
 * changes), then larger rooms.
 */
export function alternatives(code, sectionsA, data, full) {
  const cur = sectionOf(data, code, sectionsA[code]);
  const restSlots = Object.keys(sectionsA)
    .filter((c) => c !== code)
    .flatMap((c) => {
      const s = sectionOf(data, c, sectionsA[c]);
      return s ? s.slots : [];
    });
  const restMask = E.maskOf(restSlots);
  const key = (s) => s.slots.map((x) => x.d * 100 + x.h).sort((a, b) => a - b).join(',');
  const out = [];
  for (const s of data.sectionsByCourse[code] || []) {
    if (cur && s.no === cur.no) continue;
    if (isFull(full, code, s.no)) continue;
    if (E.masksOverlap(E.maskOf(s.slots), restMask)) continue;
    out.push({ code, no: s.no, slots: s.slots, room: s.room, cap: s.cap, online: s.online, sameTime: !!cur && key(s) === key(cur) });
  }
  return out.sort((a, b) => (b.sameTime - a.sameTime) || (b.cap - a.cap) || (a.no - b.no));
}

/**
 * Order in which to enter the courses on registration day: the section with the fewest
 * clash-free alternatives first, then the smallest room (rooms are a proxy: the live quota
 * is not public), then the course code.
 */
export function entryOrder(sectionsA, data, full) {
  return Object.keys(sectionsA)
    .map((code) => {
      const s = sectionOf(data, code, sectionsA[code]);
      return {
        code,
        no: sectionsA[code],
        cap: s ? s.cap : 0,
        room: s ? s.room : '',
        online: s ? s.online : false,
        slots: s ? s.slots : [],
        full: isFull(full, code, sectionsA[code]),
        alternatives: alternatives(code, sectionsA, data, full),
      };
    })
    .sort((a, b) => (a.alternatives.length - b.alternatives.length) || (a.cap - b.cap) || (a.code < b.code ? -1 : 1));
}

/**
 * Best full timetable once the full sections are removed, changing as few Plan A courses
 * as possible (ties broken by the ranking preferences). Exact: every combination is visited.
 * Returns { ok, sections, changed, blocked } (blocked = courses with every section full).
 */
export function repairPlan(codes, sectionsA, data, full, prefs = E.DEFAULT_PREFS, { countLimit = 2000000 } = {}) {
  const timed = timedOf(codes, data);
  const blocked = exhausted(timed, data, full);
  if (blocked.length) return { ok: false, sections: {}, changed: [], blocked };
  const items = E.buildItems(timed, dataWithout(data, full), {});
  let best = null;
  E.eachPlan(items, (p) => {
    let changed = 0;
    items.forEach((it, i) => {
      if (!it.options[p[i]].nos.includes(sectionsA[it.code])) changed++;
    });
    if (best && changed > best.changed) return;
    const cost = E.planCost(E.planMetrics(items, p), prefs);
    if (!best || changed < best.changed || cost < best.cost) best = { changed, cost, plan: p.slice() };
  }, countLimit);
  if (!best) return { ok: false, sections: {}, changed: [], blocked: [] };
  const sections = sectionsFromPlan(items, best.plan, sectionsA);
  return { ok: true, sections, changed: timed.filter((c) => sections[c] !== sectionsA[c]), blocked: [] };
}

/**
 * Plan B and Plan C: the next-best complete timetables from the exact search (full
 * sections excluded), skipping Plan A itself.
 * Returns { plans: [{ sections, metrics, cost, changed }], total, blocked }.
 */
export function backupPlans(codes, sectionsA, data, full, prefs = E.DEFAULT_PREFS, n = 2) {
  const timed = timedOf(codes, data);
  const blocked = exhausted(timed, data, full);
  if (blocked.length) return { plans: [], total: 0, blocked };
  const items = E.buildItems(timed, dataWithout(data, full), {});
  const res = E.searchPlans(items, prefs, { keep: n + 30 });
  const same = (s) => timed.every((c) => s[c] === sectionsA[c]);
  const plans = [];
  for (const e of res.best) {
    const sections = sectionsFromPlan(items, e.plan, sectionsA);
    if (same(sections)) continue;
    plans.push({ sections, metrics: e.metrics, cost: e.cost, changed: timed.filter((c) => sections[c] !== sectionsA[c]) });
    if (plans.length >= n) break;
  }
  return { plans, total: res.total, blocked: [] };
}
