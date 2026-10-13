// Rule and scheduling engine. Pure functions only: no DOM, no storage, no i18n.
// Everything takes the data object from data.js (or a test double) as an argument.

export const FIRST_HOUR = 8; // first lesson starts 08:40
export const LAST_HOUR = 21; // last lesson starts 21:40 and ends 22:30
export const MIN_ECTS = 20;
export const MAX_ECTS = 40;

// ---------------------------------------------------------------------------
// Time helpers. A slot is { d: 0..6 (Mon..Sun), h: start hour }. Each slot is a
// 50-minute lesson from h:40 to (h+1):30.
// ---------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
export const slotStart = (h) => `${pad(h)}:40`;
export const slotEnd = (h) => `${pad(h + 1)}:30`;

/** Per-day bitmask (bit h set = lesson starting at hour h). */
export function maskOf(slots) {
  const m = [0, 0, 0, 0, 0, 0, 0];
  for (const s of slots) m[s.d] |= 1 << s.h;
  return m;
}

export function masksOverlap(a, b) {
  for (let d = 0; d < 7; d++) if (a[d] & b[d]) return true;
  return false;
}

/** Slots present in both lists, sorted by day then hour. */
export function sharedSlots(slotsA, slotsB) {
  const keys = new Set(slotsB.map((s) => s.d * 100 + s.h));
  return slotsA
    .filter((s) => keys.has(s.d * 100 + s.h))
    .sort((x, y) => x.d - y.d || x.h - y.h);
}

/** True when two sections (objects with .slots) share at least one lesson slot. */
export function sectionsOverlap(a, b) {
  return sharedSlots(a.slots, b.slots).length > 0;
}

/** Merge consecutive slots into ranges: [{ d, from, to }] with `to` = last start hour. */
export function mergeSlots(slots) {
  const sorted = [...slots].sort((x, y) => x.d - y.d || x.h - y.h);
  const out = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.d === s.d && last.to + 1 === s.h) last.to = s.h;
    else if (!(last && last.d === s.d && last.to === s.h)) out.push({ d: s.d, from: s.h, to: s.h });
  }
  return out;
}

const popcount = (x) => {
  let n = 0;
  while (x) {
    x &= x - 1;
    n++;
  }
  return n;
};

// ---------------------------------------------------------------------------
// Prerequisites. prereqs[code] = [[A, B], [C]] means (A or B) and (C).
// ---------------------------------------------------------------------------
export function evalPrereq(code, passed, prereqs) {
  const has = passed instanceof Set ? (c) => passed.has(c) : (c) => passed.includes(c);
  const groups = (prereqs[code] || []).map((options) => {
    const by = options.find(has) || null;
    return { options, ok: by !== null, by };
  });
  return { ok: groups.every((g) => g.ok), groups, missing: groups.filter((g) => !g.ok).map((g) => g.options) };
}

export function passedSet(profile) {
  return new Set(Object.keys(profile.status || {}).filter((c) => profile.status[c] === 'passed'));
}

// ---------------------------------------------------------------------------
// CGPA status and ECTS limits.
// ---------------------------------------------------------------------------
export function cgpaBand(cgpa, semestersCompleted) {
  if (!(semestersCompleted >= 2)) return 'exempt'; // Art. 22(2)
  if (cgpa === null || cgpa === undefined || Number.isNaN(cgpa)) return 'unknown';
  if (cgpa >= 2.0) return 'successful';
  if (cgpa >= 1.75) return 'probation';
  return 'unsuccessful';
}

/**
 * max    = total ECTS allowed this semester
 * newMax = cap on ECTS of courses never taken before (null = no separate cap)
 * newMaxUnclear = the source does not say how many new courses are allowed
 */
export function ectsLimits(profile, hasRepeats) {
  const band = cgpaBand(profile.cgpa, profile.semestersCompleted);
  switch (band) {
    case 'successful':
      return { band, max: 40, newMax: null, newMaxUnclear: false, article: '23' };
    case 'probation':
      return { band, max: 32, newMax: 20, newMaxUnclear: false, article: '24(1), 24(4)' };
    case 'unsuccessful':
      return { band, max: 32, newMax: hasRepeats ? null : 20, newMaxUnclear: !!hasRepeats, article: '24(2), 24(5)' };
    case 'exempt':
      return { band, max: MAX_ECTS, newMax: null, newMaxUnclear: false, article: '22(1), 22(2)' };
    default:
      return { band, max: MAX_ECTS, newMax: null, newMaxUnclear: false, article: '22(1)' };
  }
}

// ---------------------------------------------------------------------------
// Classification of every course for this term.
// ---------------------------------------------------------------------------
export const SELECTABLE = new Set(['repeat', 'eligible', 'noData']);

export function isOffered(course, data) {
  return !!course.noTimetable || (data.sectionsByCourse[course.code] || []).length > 0;
}

/**
 * Returns { [code]: { cat, failed, missing } } where cat is one of
 * passed | slot | notOffered | blocked | noData | repeat | eligible.
 */
export function classify(profile, data) {
  const passed = passedSet(profile);
  const out = {};
  for (const c of data.courses) {
    const st = (profile.status || {})[c.code];
    const failed = st === 'failed';
    const pre = evalPrereq(c.code, passed, data.prereqs);
    let cat;
    if (st === 'passed') cat = 'passed';
    else if (c.kind === 'slot') cat = 'slot';
    else if (!isOffered(c, data) && !c.sectionsNotLoaded) cat = 'notOffered';
    else if (!pre.ok) cat = 'blocked';
    else if (c.sectionsNotLoaded) cat = 'noData';
    else if (failed && c.type === 'Z') cat = 'repeat';
    else cat = 'eligible';
    out[c.code] = { cat, failed, missing: cat === 'blocked' ? pre.missing : [] };
  }
  return out;
}

export function ectsSummary(selected, profile, data) {
  let total = 0;
  let repeatEcts = 0;
  for (const code of selected) {
    const c = data.courseMap[code];
    if (!c) continue;
    total += c.ects;
    if ((profile.status || {})[code] === 'failed') repeatEcts += c.ects;
  }
  return { total, repeatEcts, newEcts: total - repeatEcts };
}

// ---------------------------------------------------------------------------
// Section options. Sections of one course with identical timetables are merged
// into a single option (e.g. ENGR3450 sections 3 and 4), so equal timetables are
// not counted twice.
// ---------------------------------------------------------------------------
export function optionsFor(code, data) {
  const sections = data.sectionsByCourse[code] || [];
  if (!sections.length) {
    return [{ course: code, nos: [], sections: [], slots: [], mask: maskOf([]), online: false, untimed: true }];
  }
  const byKey = new Map();
  for (const s of sections) {
    const key = s.slots.map((x) => x.d * 100 + x.h).sort((a, b) => a - b).join(',');
    if (!byKey.has(key)) {
      byKey.set(key, { course: code, nos: [], sections: [], slots: s.slots, mask: maskOf(s.slots), online: true, untimed: false });
    }
    const o = byKey.get(key);
    o.nos.push(s.no);
    o.sections.push(s);
    if (!s.online) o.online = false;
  }
  return [...byKey.values()];
}

/** items = [{ code, ects, options }] with pins applied (pins[code] = section number). */
export function buildItems(codes, data, pins = {}) {
  return codes.map((code) => {
    let options = optionsFor(code, data);
    const pin = pins[code];
    if (pin !== undefined && pin !== null) {
      const only = options.filter((o) => o.nos.includes(pin));
      if (only.length) options = only;
    }
    return { code, ects: data.courseMap[code] ? data.courseMap[code].ects : 0, options };
  });
}

// ---------------------------------------------------------------------------
// Backtracking over all conflict-free combinations.
// The course with the fewest options is placed first, and a partial timetable is
// abandoned as soon as two lessons collide, so large products stay fast.
// onLeaf(plan) receives an array aligned with `items` (option index per item);
// the array is reused, so copy it if you keep it.
// ---------------------------------------------------------------------------
function walk(items, onLeaf, countLimit) {
  const n = items.length;
  const order = items.map((_, i) => i).sort((a, b) => items[a].options.length - items[b].options.length);
  const busy = [0, 0, 0, 0, 0, 0, 0];
  const pick = new Array(n).fill(0);
  let total = 0;
  let stopped = false;
  const rec = (k) => {
    if (k === n) {
      total++;
      onLeaf(pick);
      if (total >= countLimit) stopped = true;
      return;
    }
    const idx = order[k];
    const opts = items[idx].options;
    for (let o = 0; o < opts.length && !stopped; o++) {
      const m = opts[o].mask;
      if ((busy[0] & m[0]) | (busy[1] & m[1]) | (busy[2] & m[2]) | (busy[3] & m[3]) | (busy[4] & m[4]) | (busy[5] & m[5]) | (busy[6] & m[6])) continue;
      for (let d = 0; d < 7; d++) busy[d] |= m[d];
      pick[idx] = o;
      rec(k + 1);
      for (let d = 0; d < 7; d++) busy[d] &= ~m[d];
    }
  };
  rec(0);
  return { total, stopped };
}

/** All conflict-free plans (up to `limit` stored). */
export function enumeratePlans(items, { limit = 100000, countLimit = 5000000 } = {}) {
  const plans = [];
  const r = walk(items, (p) => { if (plans.length < limit) plans.push(p.slice()); }, countLimit);
  return { total: r.total, plans, truncated: r.stopped || r.total > plans.length };
}

export function isFeasible(items) {
  return walk(items, () => {}, 1).total > 0;
}

export function countPlans(items, countLimit = 5000000) {
  return walk(items, () => {}, countLimit).total;
}

// ---------------------------------------------------------------------------
// Ranking.
// ---------------------------------------------------------------------------
const EARLY_MASK = (1 << 8) | (1 << 9); // lessons starting 08:40 and 09:40

export function planMetrics(items, plan) {
  const all = [0, 0, 0, 0, 0, 0, 0];
  const campus = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < items.length; i++) {
    const o = items[i].options[plan[i]];
    for (let d = 0; d < 7; d++) {
      all[d] |= o.mask[d];
      if (!o.online) campus[d] |= o.mask[d];
    }
  }
  const m = { days: 0, campusDays: 0, early: 0, gaps: 0, weekendDays: 0, weekendLessons: 0, lessons: 0, first: null, last: null };
  for (let d = 0; d < 7; d++) {
    const x = all[d];
    if (!x) continue;
    const cnt = popcount(x);
    const hi = 31 - Math.clz32(x);
    const lo = 31 - Math.clz32(x & -x);
    m.days++;
    if (campus[d]) m.campusDays++;
    m.lessons += cnt;
    m.gaps += hi - lo + 1 - cnt;
    m.early += popcount(x & EARLY_MASK);
    if (d >= 5) {
      m.weekendDays++;
      m.weekendLessons += cnt;
    }
    if (m.first === null || lo < m.first) m.first = lo;
    if (m.last === null || hi > m.last) m.last = hi;
  }
  return m;
}

export const DEFAULT_PREFS = { fewDays: true, lateStart: false, fewGaps: true, freeWeekend: true };

/** Lower is better. Enabled preferences dominate; the rest only break ties. */
export function planCost(m, prefs = DEFAULT_PREFS) {
  let cost = 0;
  if (prefs.fewDays) cost += 100 * m.campusDays + 10 * m.days;
  if (prefs.lateStart) cost += 40 * m.early;
  if (prefs.fewGaps) cost += 30 * m.gaps;
  if (prefs.freeWeekend) cost += 150 * m.weekendDays + 10 * m.weekendLessons;
  cost += 0.01 * (m.campusDays + m.days + m.gaps + m.early + m.weekendDays);
  return cost;
}

/** Sort already enumerated plans (used by tests and small cases). */
export function rankPlans(items, plans, prefs = DEFAULT_PREFS) {
  return plans
    .map((plan, seq) => {
      const metrics = planMetrics(items, plan);
      return { plan, metrics, cost: planCost(metrics, prefs), seq };
    })
    .sort((a, b) => a.cost - b.cost || a.seq - b.seq);
}

/**
 * Enumerate every conflict-free plan, count them all, and keep only the `keep`
 * best ones according to the preferences (memory stays small however many exist).
 */
export function searchPlans(items, prefs = DEFAULT_PREFS, { keep = 200, countLimit = 5000000 } = {}) {
  let best = [];
  let threshold = Infinity;
  let seq = 0;
  const cmp = (a, b) => a.cost - b.cost || a.seq - b.seq;
  const r = walk(
    items,
    (p) => {
      const metrics = planMetrics(items, p);
      const cost = planCost(metrics, prefs);
      const s = seq++;
      if (cost > threshold) return;
      best.push({ plan: p.slice(), metrics, cost, seq: s });
      if (best.length >= keep * 2) {
        best.sort(cmp);
        best.length = keep;
        threshold = best[keep - 1].cost;
      }
    },
    countLimit,
  );
  best.sort(cmp);
  if (best.length > keep) best.length = keep;
  return { total: r.total, best, truncated: r.stopped };
}

// ---------------------------------------------------------------------------
// Why is there no conflict-free plan?
// ---------------------------------------------------------------------------
/**
 * pairs        : pairs of courses that clash in EVERY section combination
 * singleDrops  : courses whose removal alone makes a plan possible
 * pairDrops    : if no single drop works, pairs of courses to remove
 * recommended  : the single drop we suggest (lowest `keep` weight, then lowest ECTS)
 * plansAfter   : number of plans once `recommended` is dropped
 * pinsBlame    : true if the selection works once pinned sections are released
 */
export function explainNoSolution(items, { unpinned = null, keep = {} } = {}) {
  const pairs = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const A = items[i];
      const B = items[j];
      const always = A.options.every((a) => B.options.every((b) => masksOverlap(a.mask, b.mask)));
      if (!always) continue;
      const single = A.options.length === 1 && B.options.length === 1;
      pairs.push({
        a: A.code,
        b: B.code,
        allSections: !single,
        shared: single ? sharedSlots(A.options[0].slots, B.options[0].slots) : [],
      });
    }
  }
  const without = (codes) => items.filter((it) => !codes.includes(it.code));
  const weight = (code) => (keep[code] === undefined ? 1 : keep[code]);
  const byPreference = (a, b) => weight(a.code) - weight(b.code) || a.ects - b.ects || (a.code < b.code ? -1 : 1);

  const singleDrops = items.filter((it) => isFeasible(without([it.code]))).sort(byPreference).map((it) => it.code);
  const pairDrops = [];
  if (!singleDrops.length) {
    for (let i = 0; i < items.length && pairDrops.length < 6; i++) {
      for (let j = i + 1; j < items.length && pairDrops.length < 6; j++) {
        if (isFeasible(without([items[i].code, items[j].code]))) pairDrops.push([items[i].code, items[j].code]);
      }
    }
  }
  const recommended = singleDrops.length ? singleDrops[0] : null;
  return {
    pairs,
    singleDrops,
    pairDrops,
    recommended,
    plansAfter: recommended ? countPlans(without([recommended])) : 0,
    pinsBlame: unpinned ? isFeasible(unpinned) : false,
  };
}

// ---------------------------------------------------------------------------
// Pre-flight check. Returns language-neutral results; the UI turns them into text.
// state: 'pass' | 'fail' | 'warn'
// ---------------------------------------------------------------------------
export function preflight({ selected, profile, data, feasible }) {
  const cls = classify(profile, data);
  const passed = passedSet(profile);
  const checks = [];

  // 1. No timetable overlap — Art. 29(3)
  const unverified = selected.filter((c) => data.courseMap[c] && data.courseMap[c].sectionsNotLoaded);
  checks.push({
    id: 'overlap',
    article: '29(3)',
    state: !feasible ? 'fail' : unverified.length ? 'warn' : 'pass',
    unverified,
  });

  // 2. Prerequisites — Art. 28(c)
  const blocked = selected
    .map((code) => ({ code, missing: evalPrereq(code, passed, data.prereqs).missing }))
    .filter((x) => x.missing.length);
  checks.push({ id: 'prereq', article: '28(c)', state: blocked.length ? 'fail' : 'pass', blocked, count: selected.length });

  // 3. ECTS limit — Art. 23 / 24
  const failedSelectable = data.courses.some((c) => cls[c.code].failed && SELECTABLE.has(cls[c.code].cat));
  const limits = ectsLimits(profile, failedSelectable);
  const sum = ectsSummary(selected, profile, data);
  const overTotal = sum.total > limits.max;
  const overNew = limits.newMax !== null && sum.newEcts > limits.newMax;
  checks.push({
    id: 'ects',
    article: limits.article,
    state: overTotal || overNew ? 'fail' : limits.band === 'unknown' || limits.newMaxUnclear ? 'warn' : 'pass',
    overTotal,
    overNew,
    limits,
    sum,
  });

  // 4. Repeat failed compulsory courses first — Art. 26
  const mustRepeat = data.courses.filter((c) => cls[c.code].cat === 'repeat').map((c) => c.code);
  const missingRepeats = mustRepeat.filter((c) => !selected.includes(c));
  const unknownRepeats = data.courses
    .filter((c) => cls[c.code].cat === 'noData' && cls[c.code].failed && c.type === 'Z' && !selected.includes(c.code))
    .map((c) => c.code);
  checks.push({
    id: 'repeat',
    article: '26',
    state: missingRepeats.length ? 'fail' : unknownRepeats.length ? 'warn' : 'pass',
    mustRepeat,
    missingRepeats,
    unknownRepeats,
  });

  // 5. Minimum load — Art. 22(1)
  const exempt = !!profile.graduating || profile.semestersCompleted >= 8;
  checks.push({
    id: 'min',
    article: '22(1)',
    state: sum.total >= MIN_ECTS || exempt ? 'pass' : 'fail',
    total: sum.total,
    min: MIN_ECTS,
    exceptionUsed: sum.total < MIN_ECTS && exempt,
  });

  return checks;
}
