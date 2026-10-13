// UI layer: state, rendering and events. All rules live in engine.js.
import { DATA, META, RULES, OBSERVED, SAMPLE } from './data.js';
import * as E from './engine.js';
import { STR } from './i18n.js';

const STORE_KEY = 'kayit-pilotu:v1';
const VIEWS = ['status', 'courses', 'schedule', 'check', 'rules'];
// Ordered so that the first few hues are far apart on the colour wheel.
const HUES = [212, 28, 140, 282, 344, 178, 52, 248, 96, 314, 8, 160];
const TOTAL_ECTS = DATA.semesters.reduce((n, s) => n + s.ects, 0);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
function fresh() {
  return {
    lang: 'en',
    hasProfile: false,
    profile: { status: {}, cgpa: null, semestersCompleted: 0, graduating: false },
    selected: [],
    pins: {},
    prefs: { ...E.DEFAULT_PREFS },
    planIndex: 0,
  };
}

function load() {
  const base = fresh();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return base;
    const s = JSON.parse(raw);
    return {
      ...base,
      ...s,
      profile: { ...base.profile, ...(s.profile || {}), status: { ...((s.profile || {}).status || {}) } },
      prefs: { ...base.prefs, ...(s.prefs || {}) },
      selected: Array.isArray(s.selected) ? s.selected : [],
      pins: s.pins && typeof s.pins === 'object' ? s.pins : {},
      lang: s.lang === 'tr' ? 'tr' : 'en',
    };
  } catch (e) {
    return base;
  }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    /* storage unavailable: the app still works for this session */
  }
}

let state = load();
let view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'status';
let schedCache = { key: null, val: null };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function t(key, vars) {
  let s = STR[state.lang][key];
  if (s === undefined) s = STR.en[key];
  if (s === undefined) return key;
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

const course = (code) => DATA.courseMap[code];
const lbl = (code) => (DATA.courseMap[code] ? DATA.courseMap[code].label : code);
const cname = (c) => (c.name ? esc(c.name) : `<span class="muted">${t('nameMissing')}</span>`);
const cnamePlain = (c) => c.name || t('nameMissing');
const term = () => (state.lang === 'tr' ? META.termTr : META.term);
const fmtRange = (r) => `${t('day.' + r.d)} ${E.slotStart(r.from)}–${E.slotEnd(r.to)}`;
const times = (slots) => E.mergeSlots(slots).map(fmtRange).join(', ');
const rooms = (o) => (o.sections.find((s) => s.no === secNo(o)) || o.sections[0]).room;
const codeList = (codes) => codes.map(lbl).join(', ');

function say(msg) {
  const live = $('#live');
  live.textContent = '';
  setTimeout(() => { live.textContent = msg; }, 30);
}

function hueMap() {
  const map = {};
  [...state.selected].sort().forEach((code, i) => { map[code] = HUES[i % HUES.length]; });
  return map;
}

/** Section number to show for an option (the pinned one if it is part of it). */
function secNo(o) {
  const pin = state.pins[o.course];
  return o.nos.includes(pin) ? pin : o.nos[0];
}

function missingText(groups) {
  return groups
    .map((options) => {
      const known = options.filter((c) => DATA.courseMap[c]);
      const old = options.filter((c) => !DATA.courseMap[c]);
      const names = known.map((c) => lbl(c) + (state.profile.status[c] === 'failed' ? ` (${t('st.failed').toLowerCase()})` : ''));
      let s = names.length > 1 ? `${t('oneOf')} ${names.join(' / ')}` : names[0] || old.join(' / ');
      if (known.length && old.length) s += ` (${t('oldCodes')}: ${old.join(', ')})`;
      return s;
    })
    .join(` ${t('and')} `);
}

// ---------------------------------------------------------------------------
// Derived data
// ---------------------------------------------------------------------------
function derive() {
  const cls = E.classify(state.profile, DATA);
  state.selected = state.selected.filter((c) => cls[c] && E.SELECTABLE.has(cls[c].cat));
  for (const k of Object.keys(state.pins)) if (!state.selected.includes(k)) delete state.pins[k];
  const hasRepeats = DATA.courses.some((c) => cls[c.code].failed && E.SELECTABLE.has(cls[c.code].cat));
  const limits = E.ectsLimits(state.profile, hasRepeats);
  const sum = E.ectsSummary(state.selected, state.profile, DATA);
  return { cls, limits, sum };
}

function schedule() {
  const key = JSON.stringify([state.selected, state.pins, state.prefs, state.profile.status]);
  if (schedCache.key === key) return schedCache.val;
  const items = E.buildItems(state.selected, DATA, state.pins);
  const res = E.searchPlans(items, state.prefs);
  let explain = null;
  if (!res.total && items.length) {
    const keep = {};
    for (const it of items) {
      const c = course(it.code);
      keep[it.code] = c.type === 'Z' ? (state.profile.status[it.code] === 'failed' ? 3 : 2) : 1;
    }
    explain = E.explainNoSolution(items, { unpinned: E.buildItems(state.selected, DATA, {}), keep });
  }
  const val = { items, res, explain };
  schedCache = { key, val };
  return val;
}

function currentPlan(sch) {
  if (!sch.res.best.length) return null;
  if (state.planIndex >= sch.res.best.length || state.planIndex < 0) state.planIndex = 0;
  return sch.res.best[state.planIndex];
}

// ---------------------------------------------------------------------------
// Chrome: header texts, nav, ECTS bar, footer
// ---------------------------------------------------------------------------
function renderChrome(d) {
  document.documentElement.lang = state.lang;
  document.title = t('app.title');
  $('#tagline').textContent = t('app.tagline');
  $('#skip').textContent = t('skip');
  $('#steps').setAttribute('aria-label', t('nav.label'));
  $('#langgroup').setAttribute('aria-label', t('lang.label'));
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang));
  $('#nav').innerHTML = VIEWS.map(
    (v, i) =>
      `<a href="#${v}" class="step"${v === view ? ' aria-current="page"' : ''}><span class="step-n" aria-hidden="true">${i < 4 ? i + 1 : 'i'}</span><span class="step-t">${t('nav.' + v)}</span></a>`,
  ).join('');
  $('#foot').innerHTML = `${t('foot.disclaimer')} <a href="#rules">${t('nav.rules')}</a> · ${t('foot.data', { date: META.collected })}`;
  renderBar(d);
}

function renderBar(d) {
  const bar = $('#ectsbar');
  const show = view === 'courses' || view === 'schedule' || view === 'check';
  bar.hidden = !show;
  if (!show) return;
  const { limits, sum } = d;
  const over = sum.total > limits.max;
  const overNew = limits.newMax !== null && sum.newEcts > limits.newMax;
  const pct = Math.min(100, (sum.total / limits.max) * 100);
  const chips = [`<span class="chip">${t('band.' + limits.band)} · ${t('art')} ${limits.article}</span>`];
  if (limits.newMax !== null) chips.push(`<span class="chip${overNew ? ' chip-bad' : ''}">${overNew ? '! ' : ''}${t('bar.new', { n: sum.newEcts, max: limits.newMax })}</span>`);
  if (over) chips.push(`<span class="chip chip-bad">! ${t('bar.over', { n: sum.total - limits.max })}</span>`);
  else if (sum.total > 0 && sum.total < E.MIN_ECTS && !state.profile.graduating && !(state.profile.semestersCompleted >= 8)) chips.push(`<span class="chip chip-warn">${t('bar.under', { min: E.MIN_ECTS })}</span>`);
  bar.innerHTML = `<div class="wrap bar-in">
    <div class="bar-main"><span class="bar-num"><strong>${sum.total}</strong> / ${limits.max} ${t('ects')}</span>
      <span class="bar-lbl">${t('bar.selected', { n: state.selected.length })}</span></div>
    <div class="meter${over ? ' is-over' : ''}" aria-hidden="true"><span style="width:${pct}%"></span></div>
    <div class="bar-side">${chips.join('')}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// View 1: My status
// ---------------------------------------------------------------------------
function seg(c) {
  const cur = state.profile.status[c.code] || 'none';
  const opts = c.kind === 'slot' ? ['none', 'passed'] : ['none', 'passed', 'failed'];
  return (
    `<fieldset class="seg"><legend class="sr">${esc(c.label)} — ${t('status.legend')}</legend>` +
    opts
      .map(
        (o) =>
          `<input class="sr" type="radio" name="st-${c.code}" id="st-${c.code}-${o}" value="${o}" data-chg="status" data-code="${c.code}"${cur === o ? ' checked' : ''}>` +
          `<label for="st-${c.code}-${o}" class="seg-${o}">${t('st.' + o)}</label>`,
      )
      .join('') +
    `</fieldset>`
  );
}

function statusRow(c) {
  const tags = [];
  if (c.kind === 'slot') tags.push(t('electiveSlot'));
  if (c.online) tags.push(t('online'));
  if (c.tul) tags.push(c.tul);
  return `<li class="row srow"><div class="row-main"><span class="code">${esc(c.label)}</span><span class="name">${cname(c)}</span>
    <span class="meta">${c.ects} ${t('ects')}${tags.length ? ' · ' + tags.join(' · ') : ''}</span></div>${seg(c)}</li>`;
}

function bandLine(limits) {
  const p = state.profile;
  let s = `<strong>${t('band.' + limits.band)}</strong> — ${t('band.max', { max: limits.max })}`;
  if (limits.newMax !== null) s += `, ${t('band.newMax', { max: limits.newMax })}`;
  s += ` <span class="art">${t('art')} ${limits.article}</span>`;
  if (limits.band === 'unknown') s += `<br><span class="muted">${t('band.unknownHint')}</span>`;
  if (limits.band === 'exempt') s += `<br><span class="muted">${t('band.exemptHint')}</span>`;
  if (limits.newMaxUnclear) s += `<br><span class="muted">${t('band.unclear')}</span>`;
  if (p.graduating || p.semestersCompleted >= 8) s += `<br><span class="muted">${t('band.noMin')}</span>`;
  return s;
}

function viewStatus(d) {
  const p = state.profile;
  const st = p.status;
  const passedEcts = DATA.semesters.reduce((n, s) => n + s.courses.reduce((m, c) => m + (st[c.code] === 'passed' ? c.ects : 0), 0), 0);
  let h = `<h2 id="view-title" tabindex="-1">${t('status.title')}</h2><p class="lead">${t('status.lead')}</p>`;

  if (!state.hasProfile) {
    h += `<section class="card hero" aria-labelledby="hero-t"><h3 id="hero-t">${t('first.title')}</h3><p>${t('first.text')}</p>
      <div class="btns"><button class="btn btn-primary" id="btn-sample" data-act="sample">${t('first.sample')}</button>
      <button class="btn" id="btn-empty" data-act="empty">${t('first.empty')}</button></div>
      <p class="muted small">${t('first.note')}</p></section>`;
  }

  h += `<section class="card" aria-labelledby="prof-t"><div class="card-head"><h3 id="prof-t">${t('status.profile')}</h3>
      <div class="btns">${state.hasProfile ? `<button class="btn btn-small" id="btn-sample2" data-act="sample">${t('first.sample')}</button>` : ''}
      <button class="btn btn-small btn-danger" id="btn-reset" data-act="reset">${t('status.reset')}</button></div></div>
    <div class="fields">
      <div class="field"><label for="f-cgpa">${t('status.cgpa')}</label>
        <input id="f-cgpa" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00 – 4.00" value="${p.cgpa === null ? '' : esc(p.cgpa)}" data-inp="cgpa" aria-describedby="band-line"></div>
      <div class="field"><label for="f-sem">${t('status.semesters')}</label>
        <input id="f-sem" type="number" min="0" max="20" step="1" value="${esc(p.semestersCompleted)}" data-inp="semesters" aria-describedby="band-line"></div>
      <div class="field field-check"><input id="f-grad" type="checkbox" data-chg="graduating"${p.graduating ? ' checked' : ''}>
        <label for="f-grad">${t('status.graduating')}</label></div>
    </div>
    <p class="band" id="band-line">${bandLine(d.limits)}</p>
    <div class="progress"><div class="progress-txt">${t('status.progress', { n: passedEcts, total: TOTAL_ECTS })}</div>
      <div class="meter" aria-hidden="true"><span style="width:${(passedEcts / TOTAL_ECTS) * 100}%"></span></div></div>
  </section>`;

  for (const s of DATA.semesters) {
    const done = s.courses.reduce((m, c) => m + (st[c.code] === 'passed' ? c.ects : 0), 0);
    const failed = s.courses.filter((c) => st[c.code] === 'failed').length;
    h += `<section class="card sem" aria-labelledby="sem-${s.n}"><div class="card-head">
        <h3 id="sem-${s.n}">${t('semester', { n: s.n })} <span class="count">${t('status.semProgress', { n: done, total: s.ects })}${failed ? ' · ' + t('status.semFailed', { n: failed }) : ''}</span></h3>
        <div class="btns"><button class="btn btn-small" id="sem-pass-${s.n}" data-act="sem-pass" data-sem="${s.n}">${t('status.markAll')}</button>
        <button class="btn btn-small btn-ghost" id="sem-clear-${s.n}" data-act="sem-clear" data-sem="${s.n}">${t('status.clear')}</button></div></div>
      <ul class="rows">${s.courses.map(statusRow).join('')}</ul></section>`;
  }

  const takenEl = DATA.electives.filter((c) => st[c.code]).length;
  h += `<details class="card" id="det-electives"${takenEl || state.openElectives ? ' open' : ''}><summary><span class="h3">${t('status.electives')}</span> <span class="count">${t('status.electivesCount', { n: takenEl })}</span></summary>
    <p class="note">${t('status.electivesNote')}</p>
    <ul class="rows">${DATA.electives.map(statusRow).join('')}</ul></details>`;

  h += `<div class="next"><a class="btn btn-primary" href="#courses">${t('next.courses')}</a></div>`;
  return h;
}

// ---------------------------------------------------------------------------
// View 2: What can I take?
// ---------------------------------------------------------------------------
function pickRow(c, info) {
  const on = state.selected.includes(c.code);
  const secs = DATA.sectionsByCourse[c.code] || [];
  const meta = [c.semester ? t('semN', { n: c.semester }) : t('deptElective')];
  if (c.sectionsNotLoaded) meta.push(t('secNotLoaded'));
  else if (c.noTimetable) meta.push(t('noTimetable'));
  else {
    meta.push(secs.length === 1 ? t('sec1') : t('secN', { n: secs.length }));
    if (secs.every((s) => s.online)) meta.push(t('online'));
  }
  if (info.failed) meta.push(t('failedBefore'));
  return `<li class="row pick${on ? ' is-on' : ''}"><input type="checkbox" id="pick-${c.code}" data-chg="pick" data-code="${c.code}"${on ? ' checked' : ''}>
    <label for="pick-${c.code}" class="row-main"><span class="code">${esc(c.label)}</span><span class="name">${cname(c)}</span><span class="meta">${meta.join(' · ')}</span></label>
    <span class="ects">${c.ects} ${t('ects')}</span></li>`;
}

function infoRow(c, reason) {
  return `<li class="row"><div class="row-main"><span class="code">${esc(c.label)}</span><span class="name">${cname(c)}</span>
    <span class="meta">${c.semester ? t('semN', { n: c.semester }) : t('deptElective')}${reason ? ' · ' + reason : ''}</span></div><span class="ects">${c.ects} ${t('ects')}</span></li>`;
}

function group(id, cat, count, body, { open = true, mark = '' } = {}) {
  return `<details class="card grp grp-${cat}" id="${id}"${open ? ' open' : ''}><summary><span class="h3">${mark ? `<span class="mark mark-${cat}" aria-hidden="true">${mark}</span>` : ''}${t('cat.' + cat)}</span>
    <span class="count">${count}</span></summary><p class="note">${t('cat.' + cat + '.note')}</p>${body}</details>`;
}

function viewCourses(d) {
  const g = { repeat: [], eligible: [], noData: [], blocked: [], notOffered: [], passed: [], slot: [] };
  for (const c of DATA.courses) g[d.cls[c.code].cat].push(c);
  const { limits } = d;
  let h = `<h2 id="view-title" tabindex="-1">${t('courses.title')}</h2><p class="lead">${t('courses.lead', { term: term() })}</p>`;

  if (!state.hasProfile) {
    h += `<section class="card hero"><h3>${t('courses.noProfile')}</h3><p>${t('courses.noProfileText')}</p>
      <div class="btns"><button class="btn btn-primary" id="btn-sample" data-act="sample">${t('first.sample')}</button>
      <a class="btn" href="#status">${t('nav.status')}</a></div></section>`;
  }

  h += `<section class="card limit" aria-labelledby="lim-t"><h3 id="lim-t">${t('courses.limitTitle')}</h3><p class="band">${bandLine(limits)}</p></section>`;

  if (g.repeat.length) {
    h += group('g-repeat', 'repeat', g.repeat.length, `<ul class="rows">${g.repeat.map((c) => pickRow(c, d.cls[c.code])).join('')}</ul>`, { mark: '!' });
  }

  const elZ = g.eligible.filter((c) => c.type === 'Z');
  const elS = g.eligible.filter((c) => c.type !== 'Z');
  let body = '';
  if (!g.eligible.length) body = `<p class="empty">${t('courses.noneEligible')}</p>`;
  if (elZ.length) body += `<h4>${t('compulsory')}</h4><ul class="rows">${elZ.map((c) => pickRow(c, d.cls[c.code])).join('')}</ul>`;
  if (elS.length) body += `<h4>${t('deptElectives')}</h4><p class="note">${t('courses.electiveNote')}</p><ul class="rows">${elS.map((c) => pickRow(c, d.cls[c.code])).join('')}</ul>`;
  h += group('g-eligible', 'eligible', g.eligible.length, body, { mark: '✓' });

  if (g.noData.length) {
    h += group('g-nodata', 'noData', g.noData.length, `<ul class="rows">${g.noData.map((c) => pickRow(c, d.cls[c.code])).join('')}</ul>`, { mark: '?' });
  }

  if (g.blocked.length) {
    h += group(
      'g-blocked', 'blocked', g.blocked.length,
      `<ul class="rows">${g.blocked.map((c) => infoRow(c, `<span class="why">${t('courses.missing')} ${esc(missingText(d.cls[c.code].missing))}</span>`)).join('')}</ul>`,
      { mark: '×' },
    );
  }

  h += group(
    'g-notoffered', 'notOffered', g.notOffered.length,
    `<ul class="rows">${g.notOffered.map((c) => infoRow(c, d.cls[c.code].failed ? `<span class="why">${t('courses.failedNotOffered')}</span>` : '')).join('')}</ul>`,
    { open: false, mark: '–' },
  );

  h += group(
    'g-slot', 'slot', g.slot.length,
    `<ul class="rows">${g.slot.map((c) => infoRow(c, c.slotKind === 'university' ? t('courses.slotUniv') : t('courses.slotDept'))).join('')}</ul>`,
    { open: false, mark: '?' },
  );

  h += group(
    'g-passed', 'passed', g.passed.length,
    g.passed.length ? `<ul class="rows">${g.passed.map((c) => infoRow(c, '')).join('')}</ul>` : `<p class="empty">${t('courses.nonePassed')}</p>`,
    { open: false, mark: '✓' },
  );

  h += `<div class="next"><a class="btn btn-primary" href="#schedule">${t('next.schedule', { n: state.selected.length })}</a></div>`;
  return h;
}

// ---------------------------------------------------------------------------
// Timetable + plan details (shared by views 3 and 4)
// ---------------------------------------------------------------------------
function timetable(items, plan, hue) {
  const cell = Array.from({ length: 7 }, () => ({}));
  let maxH = 17;
  let sat = false;
  let sun = false;
  items.forEach((it, i) => {
    const o = it.options[plan[i]];
    for (const s of o.slots) {
      cell[s.d][s.h] = { it, o };
      if (s.h > maxH) maxH = s.h;
      if (s.d === 5) sat = true;
      if (s.d === 6) sun = true;
    }
  });
  const days = [0, 1, 2, 3, 4];
  if (sat || sun) days.push(5);
  if (sun) days.push(6);
  let h = `<div class="tt-wrap"><table class="tt${days.length > 5 ? ' tt-wide' : ''}"><caption class="sr">${t('tt.caption')}</caption><thead><tr><th scope="col" class="tt-time"><span class="sr">${t('tt.time')}</span></th>`;
  h += days.map((d) => `<th scope="col"><abbr title="${t('dayLong.' + d)}">${t('day.' + d)}</abbr></th>`).join('') + '</tr></thead><tbody>';
  for (let hr = E.FIRST_HOUR; hr <= maxH; hr++) {
    h += `<tr><th scope="row" class="tt-time">${E.slotStart(hr)}</th>`;
    for (const d of days) {
      const c = cell[d][hr];
      if (!c) {
        h += '<td></td>';
        continue;
      }
      const prev = cell[d][hr - 1];
      if (prev && prev.it === c.it) continue;
      let span = 1;
      while (cell[d][hr + span] && cell[d][hr + span].it === c.it) span++;
      h += `<td rowspan="${span}" class="tt-busy" style="--h:${hue[c.it.code]}"><strong>${esc(lbl(c.it.code))}</strong>
        <span>${t('secShort')} ${secNo(c.o)}</span><span>${esc(rooms(c.o))}${c.o.online ? ' · ' + t('online') : ''}</span>
        <span class="sr">${E.slotStart(hr)}–${E.slotEnd(hr + span - 1)}</span></td>`;
    }
    h += '</tr>';
  }
  return h + '</tbody></table></div>';
}

function planDetails(items, plan, hue) {
  return (
    `<ul class="seclist">` +
    items
      .map((it, i) => {
        const o = it.options[plan[i]];
        const c = course(it.code);
        let info;
        if (c.sectionsNotLoaded) info = `<span class="why">${t('plan.notLoaded')}</span>`;
        else if (o.untimed) info = t('noTimetable');
        else {
          const cap = (o.sections.find((s) => s.no === secNo(o)) || o.sections[0]).cap;
          info = `${t('sec')} ${secNo(o)} · ${times(o.slots)} · ${esc(rooms(o))}${o.online ? ' (' + t('online') + ')' : ''} · <span class="muted">${t('plan.capacity', { n: cap })}</span>`;
          if (o.nos.length > 1) info += ` · <span class="muted">${t('plan.sameTime', { n: o.nos.filter((n) => n !== secNo(o)).join(', ') })}</span>`;
        }
        return `<li><span class="dot" style="--h:${hue[it.code]}" aria-hidden="true"></span><div><strong>${esc(c.label)}</strong> ${cname(c)} <span class="muted">· ${c.ects} ${t('ects')}</span><br><span class="small">${info}</span></div></li>`;
      })
      .join('') +
    `</ul>`
  );
}

function metricChips(m) {
  const chips = [
    t('m.campusDays', { n: m.campusDays }),
    m.first === null ? null : t('m.first', { t: E.slotStart(m.first) }),
    m.early ? t('m.early', { n: m.early }) : t('m.noEarly'),
    t('m.gaps', { n: m.gaps }),
    m.weekendDays ? t('m.weekend', { n: m.weekendLessons }) : t('m.weekendFree'),
  ];
  return `<ul class="chips">${chips.filter(Boolean).map((c) => `<li class="chip">${c}</li>`).join('')}</ul>`;
}

// ---------------------------------------------------------------------------
// View 3: Schedule builder
// ---------------------------------------------------------------------------
function explainHtml(sch) {
  const ex = sch.explain;
  let h = `<section class="card alert" role="status" aria-labelledby="nosol-t"><h3 id="nosol-t"><span class="mark mark-blocked" aria-hidden="true">×</span>${t('nosol.title')}</h3>`;
  if (ex.pairs.length) {
    h += `<p>${t('nosol.pairsIntro')}</p><ul class="bul">`;
    for (const p of ex.pairs) {
      h += `<li><strong>${esc(lbl(p.a))}</strong> ${t('and')} <strong>${esc(lbl(p.b))}</strong>: `;
      h += p.allSections ? t('nosol.pairAll') : t('nosol.pairSlots', { times: times(p.shared) });
      h += '</li>';
    }
    h += '</ul>';
  } else {
    h += `<p>${t('nosol.noPair')}</p>`;
  }
  if (ex.pinsBlame) {
    h += `<p>${t('nosol.pins')}</p><div class="btns"><button class="btn btn-primary" id="btn-clearpins" data-act="clear-pins">${t('nosol.clearPins')}</button></div>`;
  }
  if (ex.recommended) {
    const c = course(ex.recommended);
    const kind = c.type === 'Z' ? t('compulsoryOne') : t('deptElective');
    h += `<p><strong>${t('nosol.suggest')}</strong> ${t('nosol.drop', { code: esc(c.label), kind, ects: c.ects, n: ex.plansAfter })}</p>
      <div class="btns"><button class="btn btn-primary" id="btn-drop-${c.code}" data-act="remove" data-code="${c.code}">${t('nosol.dropBtn', { code: esc(c.label) })}</button></div>`;
    const others = ex.singleDrops.slice(1);
    if (others.length) h += `<p class="small muted">${t('nosol.others', { codes: esc(codeList(others)) })}</p>`;
    if (state.profile.status[ex.recommended] === 'failed' && c.type === 'Z') h += `<p class="small why">${t('nosol.repeatWarn')}</p>`;
  } else if (ex.pairDrops.length) {
    h += `<p><strong>${t('nosol.suggest')}</strong> ${t('nosol.dropTwo')}</p><ul class="bul">${ex.pairDrops.map((p) => `<li>${esc(lbl(p[0]))} + ${esc(lbl(p[1]))}</li>`).join('')}</ul>`;
  } else {
    h += `<p>${t('nosol.many')}</p>`;
  }
  return h + '</section>';
}

function viewSchedule(d) {
  let h = `<h2 id="view-title" tabindex="-1">${t('schedule.title')}</h2><p class="lead">${t('schedule.lead')}</p>`;
  if (!state.selected.length) {
    return h + `<section class="card hero"><h3>${t('schedule.emptyTitle')}</h3><p>${t('schedule.emptyText')}</p>
      <div class="btns"><a class="btn btn-primary" href="#courses">${t('nav.courses')}</a>${state.hasProfile ? '' : `<button class="btn" id="btn-sample" data-act="sample">${t('first.sample')}</button>`}</div></section>`;
  }
  const sch = schedule();
  const hue = hueMap();
  const cur = currentPlan(sch);

  // Left column: courses, pins, preferences
  let side = `<section class="card" aria-labelledby="sel-t"><div class="card-head"><h3 id="sel-t">${t('schedule.courses')} <span class="count">${state.selected.length}</span></h3>
    <a class="btn btn-small" href="#courses">${t('schedule.edit')}</a></div><ul class="sel">`;
  for (const code of state.selected) {
    const c = course(code);
    const opts = E.optionsFor(code, DATA);
    let pin;
    if (c.sectionsNotLoaded) pin = `<span class="small why">${t('plan.notLoaded')}</span>`;
    else if (opts[0].untimed) pin = `<span class="small muted">${t('noTimetable')}</span>`;
    else if (opts.length === 1) pin = `<span class="small muted">${t('schedule.onlyOne')}: ${times(opts[0].slots)}</span>`;
    else {
      const p = state.pins[code];
      pin = `<label class="sr" for="pin-${code}">${t('schedule.pinLabel', { code: esc(c.label) })}</label><select id="pin-${code}" data-chg="pin" data-code="${code}">
        <option value="">${t('schedule.anySection', { n: opts.length })}</option>` +
        opts.map((o) => `<option value="${o.nos[0]}"${o.nos.includes(p) ? ' selected' : ''}>${t('sec')} ${o.nos.join('/')} · ${times(o.slots)}${o.online ? ' · ' + t('online') : ''}</option>`).join('') +
        `</select>`;
    }
    side += `<li><span class="dot" style="--h:${hue[code]}" aria-hidden="true"></span><div class="sel-main"><strong>${esc(c.label)}</strong> <span class="muted small">${c.ects} ${t('ects')}</span>${state.pins[code] ? ` <span class="chip chip-pin">${t('schedule.pinned')}</span>` : ''}
      <div class="small">${cname(c)}</div>${pin}</div>
      <button class="icon-btn" id="rm-${code}" data-act="remove" data-code="${code}" aria-label="${t('schedule.remove', { code: esc(c.label) })}" title="${t('schedule.remove', { code: esc(c.label) })}"><span aria-hidden="true">×</span></button></li>`;
  }
  side += `</ul></section><section class="card" aria-labelledby="pref-t"><h3 id="pref-t">${t('schedule.prefs')}</h3><p class="note">${t('schedule.prefsNote')}</p><ul class="prefs">`;
  for (const k of ['fewDays', 'lateStart', 'fewGaps', 'freeWeekend']) {
    side += `<li><input type="checkbox" id="pref-${k}" data-chg="pref" data-pref="${k}"${state.prefs[k] ? ' checked' : ''}><label for="pref-${k}">${t('pref.' + k)}</label></li>`;
  }
  side += '</ul></section>';

  // Right column: result
  let main;
  if (!cur) {
    main = explainHtml(sch);
  } else {
    const n = sch.res.best.length;
    const total = sch.res.total;
    main = `<section class="card" aria-labelledby="plan-t"><div class="pager"><button class="btn" id="btn-prev" data-act="prev"${n < 2 ? ' disabled' : ''}><span aria-hidden="true">‹</span> ${t('schedule.prev')}</button>
      <h3 id="plan-t" class="pager-t">${t('schedule.planOf', { i: state.planIndex + 1, n: total })}</h3>
      <button class="btn" id="btn-next" data-act="next"${n < 2 ? ' disabled' : ''}>${t('schedule.next')} <span aria-hidden="true">›</span></button></div>
      <p class="note center">${total === 1 ? t('schedule.onlyPlan') : t('schedule.ranked')}${total > n ? ' ' + t('schedule.capped', { n }) : ''}${sch.res.truncated ? ' ' + t('schedule.truncated') : ''}</p>
      ${metricChips(cur.metrics)}${timetable(sch.items, cur.plan, hue)}${planDetails(sch.items, cur.plan, hue)}
      <p class="note">${t('plan.capNote')}</p></section>
      <div class="next"><a class="btn btn-primary" href="#check">${t('next.check')}</a></div>`;
  }
  return h + `<div class="cols"><div class="col-side">${side}</div><div class="col-main">${main}</div></div>`;
}

// ---------------------------------------------------------------------------
// View 4: Pre-flight check + export
// ---------------------------------------------------------------------------
function checkDetail(ch) {
  switch (ch.id) {
    case 'overlap':
      if (ch.state === 'fail') return t('chk.overlap.fail');
      if (ch.state === 'warn') return t('chk.overlap.warn', { codes: esc(codeList(ch.unverified)) });
      return t('chk.overlap.pass');
    case 'prereq':
      if (ch.state === 'fail') return ch.blocked.map((b) => `${esc(lbl(b.code))}: ${t('courses.missing')} ${esc(missingText(b.missing))}`).join('; ');
      return t('chk.prereq.pass', { n: ch.count });
    case 'ects': {
      const parts = [];
      const v = { total: ch.sum.total, max: ch.limits.max, band: t('band.' + ch.limits.band), n: ch.sum.newEcts, newMax: ch.limits.newMax, over: ch.sum.total - ch.limits.max };
      parts.push(ch.overTotal ? t('chk.ects.over', v) : t('chk.ects.ok', v));
      if (ch.limits.newMax !== null) parts.push(ch.overNew ? t('chk.ects.newOver', v) : t('chk.ects.newOk', v));
      if (ch.limits.band === 'unknown') parts.push(t('band.unknownHint'));
      if (ch.limits.newMaxUnclear) parts.push(t('band.unclear'));
      return parts.join(' ');
    }
    case 'repeat':
      if (ch.state === 'fail') return t('chk.repeat.fail', { codes: esc(codeList(ch.missingRepeats)) });
      if (ch.state === 'warn') return t('chk.repeat.warn', { codes: esc(codeList(ch.unknownRepeats)) });
      return ch.mustRepeat.length ? t('chk.repeat.pass', { codes: esc(codeList(ch.mustRepeat)) }) : t('chk.repeat.none');
    default:
      if (ch.state === 'fail') return t('chk.min.fail', { total: ch.total, min: ch.min });
      return ch.exceptionUsed ? t('chk.min.exception', { total: ch.total, min: ch.min }) : t('chk.min.pass', { total: ch.total, min: ch.min });
  }
}

function exportText(sch, cur, d) {
  const L = [`${t('exp.title')} — ${term()} — ${state.lang === 'tr' ? META.programTr : META.program}`, ''];
  sch.items.forEach((it, i) => {
    const o = it.options[cur.plan[i]];
    const c = course(it.code);
    const tail = ` — ${c.ects} ${t('ects')} — ${cnamePlain(c)}`;
    if (c.sectionsNotLoaded) L.push(`${it.code}(?) — ${t('exp.notLoaded')}${tail}`);
    else if (o.untimed) L.push(`${it.code} — ${t('exp.noTimetable')}${tail}`);
    else {
      const alt = o.nos.filter((n) => n !== secNo(o));
      L.push(`${it.code}(${secNo(o)}) — ${times(o.slots)} — ${rooms(o)}${tail}${alt.length ? ` [${t('exp.alt', { n: alt.join(', ') })}]` : ''}`);
    }
  });
  L.push('', t('exp.total', { n: d.sum.total, max: d.limits.max, band: t('band.' + d.limits.band) }), t('exp.foot'));
  return L.join('\n');
}

function viewCheck(d) {
  let h = `<h2 id="view-title" tabindex="-1">${t('check.title')}</h2><p class="lead">${t('check.lead')}</p>`;
  if (!state.selected.length) {
    return h + `<section class="card hero"><h3>${t('schedule.emptyTitle')}</h3><p>${t('check.emptyText')}</p>
      <div class="btns"><a class="btn btn-primary" href="#courses">${t('nav.courses')}</a></div></section>`;
  }
  const sch = schedule();
  const cur = currentPlan(sch);
  const checks = E.preflight({ selected: state.selected, profile: state.profile, data: DATA, feasible: !!cur });
  const fails = checks.filter((c) => c.state === 'fail').length;
  const warns = checks.filter((c) => c.state === 'warn').length;
  const verdict = fails ? 'fail' : warns ? 'warn' : 'pass';
  const sym = { pass: '✓', fail: '×', warn: '!' };

  h += `<section class="card verdict verdict-${verdict}" role="status"><p class="verdict-t"><span class="mark mark-${verdict}" aria-hidden="true">${sym[verdict]}</span>
    ${fails ? t('check.verdictFail', { n: fails }) : warns ? t('check.verdictWarn', { n: warns }) : t('check.verdictPass', { n: checks.length })}</p></section>`;

  h += `<section class="card" aria-labelledby="chk-t"><h3 id="chk-t">${t('check.listTitle')}</h3><ul class="checks">`;
  for (const ch of checks) {
    h += `<li class="check check-${ch.state}"><span class="mark mark-${ch.state}" aria-hidden="true">${sym[ch.state]}</span>
      <div><p class="check-t"><span class="state">${t('state.' + ch.state)}</span> ${t('chk.' + ch.id + '.title')} <span class="art">${t('art')} ${ch.article}</span></p>
      <p class="check-d">${checkDetail(ch)}</p></div></li>`;
  }
  h += `</ul>${fails ? `<div class="btns no-print"><a class="btn" href="#courses">${t('check.fixCourses')}</a><a class="btn" href="#schedule">${t('check.fixSchedule')}</a></div>` : ''}</section>`;

  if (cur) {
    const hue = hueMap();
    const text = exportText(sch, cur, d);
    h += `<section class="card" aria-labelledby="pl-t"><h3 id="pl-t">${t('check.planTitle', { i: state.planIndex + 1, n: sch.res.total })} <span class="count">${term()}</span></h3>
      ${timetable(sch.items, cur.plan, hue)}${planDetails(sch.items, cur.plan, hue)}</section>
      <section class="card no-print" aria-labelledby="exp-t"><h3 id="exp-t">${t('check.exportTitle')}</h3><p class="note">${t('check.exportNote')}</p>
      <label class="sr" for="exp-text">${t('check.exportTitle')}</label>
      <textarea id="exp-text" class="export" readonly rows="${Math.min(14, text.split('\n').length + 1)}">${esc(text)}</textarea>
      <div class="btns"><button class="btn btn-primary" id="btn-copy" data-act="copy">${t('check.copy')}</button>
      <button class="btn" id="btn-print" data-act="print">${t('check.print')}</button><span id="copy-msg" class="small" role="status"></span></div></section>`;
  } else {
    h += `<section class="card"><p>${t('check.noPlan')}</p><div class="btns"><a class="btn btn-primary" href="#schedule">${t('nav.schedule')}</a></div></section>`;
  }
  h += `<p class="print-only small">${t('foot.disclaimer')} ${t('foot.data', { date: META.collected })}</p>`;
  return h;
}

// ---------------------------------------------------------------------------
// View 5: Rules & sources
// ---------------------------------------------------------------------------
function viewRules() {
  const L = state.lang;
  let h = `<h2 id="view-title" tabindex="-1">${t('rules.title')}</h2><p class="lead">${t('rules.lead')}</p>`;
  h += `<section class="card alert" aria-labelledby="dis-t"><h3 id="dis-t"><span class="mark mark-warn" aria-hidden="true">!</span>${t('rules.disTitle')}</h3>
    <ul class="bul">${['d1', 'd2', 'd3', 'd4'].map((k) => `<li>${t('rules.' + k)}</li>`).join('')}</ul></section>`;
  h += `<section class="card" aria-labelledby="rl-t"><h3 id="rl-t">${t('rules.listTitle')}</h3><ul class="rules">`;
  for (const r of RULES) h += `<li><span class="art">${t('art')} ${r.art}</span><span>${esc(r[L])}</span></li>`;
  h += `</ul><p class="note">${esc(OBSERVED[L])}</p></section>`;
  h += `<section class="card" aria-labelledby="src-t"><h3 id="src-t">${t('rules.srcTitle')}</h3><p>${t('rules.collected', { date: META.collected, term: term() })}</p><ul class="bul">`;
  for (const s of META.sources) h += `<li>${t('rules.src.' + s.id)}<br><a href="${esc(s.url)}" rel="noopener noreferrer" target="_blank" class="url">${esc(s.url)}</a></li>`;
  h += `<li>${t('rules.src.timetable')}</li></ul></section>`;
  h += `<section class="card" aria-labelledby="gap-t"><h3 id="gap-t">${t('rules.gapTitle')}</h3><ul class="bul">${['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].map((k) => `<li>${t('rules.' + k)}</li>`).join('')}</ul></section>`;
  return h;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render({ focusTitle = false } = {}) {
  const active = document.activeElement && document.activeElement.id;
  const d = derive();
  let html;
  if (view === 'status') html = viewStatus(d);
  else if (view === 'courses') html = viewCourses(d);
  else if (view === 'schedule') html = viewSchedule(d);
  else if (view === 'check') html = viewCheck(d);
  else html = viewRules();
  const main = $('#main');
  main.innerHTML = html;
  main.dataset.view = view;
  renderChrome(d);
  save();
  if (focusTitle) {
    const title = $('#view-title');
    if (title) title.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } else if (active) {
    const el = document.getElementById(active);
    if (el && el !== document.activeElement) el.focus({ preventScroll: true });
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function touchProfile() {
  state.hasProfile = true;
  state.planIndex = 0;
}

function setStatus(code, value) {
  if (value === 'none') delete state.profile.status[code];
  else state.profile.status[code] = value;
}

function parseCgpa(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(4, n));
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'skip') {
    e.preventDefault();
    $('#main').focus();
    return;
  }
  if (act === 'lang') {
    state.lang = el.dataset.lang === 'tr' ? 'tr' : 'en';
  } else if (act === 'sample') {
    const s = JSON.parse(JSON.stringify(SAMPLE));
    state.profile = s.profile;
    state.selected = s.selected;
    state.pins = {};
    touchProfile();
    say(t('msg.sampleLoaded'));
  } else if (act === 'empty') {
    touchProfile();
  } else if (act === 'reset') {
    if (!window.confirm(t('status.resetConfirm'))) return;
    const lang = state.lang;
    state = fresh();
    state.lang = lang;
    say(t('msg.reset'));
  } else if (act === 'sem-pass' || act === 'sem-clear') {
    const sem = DATA.semesters.find((s) => s.n === Number(el.dataset.sem));
    for (const c of sem.courses) setStatus(c.code, act === 'sem-pass' ? 'passed' : 'none');
    touchProfile();
  } else if (act === 'remove') {
    state.selected = state.selected.filter((c) => c !== el.dataset.code);
    delete state.pins[el.dataset.code];
    state.planIndex = 0;
  } else if (act === 'clear-pins') {
    state.pins = {};
    state.planIndex = 0;
  } else if (act === 'prev' || act === 'next') {
    const n = schedule().res.best.length;
    if (n) state.planIndex = (state.planIndex + (act === 'next' ? 1 : n - 1)) % n;
  } else if (act === 'copy') {
    copyExport();
    return;
  } else if (act === 'print') {
    window.print();
    return;
  } else {
    return;
  }
  render();
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-chg]');
  if (!el) {
    if (e.target.closest('[data-inp]')) render();
    return;
  }
  const chg = el.dataset.chg;
  if (chg === 'status') {
    setStatus(el.dataset.code, el.value);
    touchProfile();
  } else if (chg === 'graduating') {
    state.profile.graduating = el.checked;
    touchProfile();
  } else if (chg === 'pick') {
    const code = el.dataset.code;
    if (el.checked && !state.selected.includes(code)) state.selected.push(code);
    if (!el.checked) state.selected = state.selected.filter((c) => c !== code);
    state.planIndex = 0;
  } else if (chg === 'pref') {
    state.prefs[el.dataset.pref] = el.checked;
    state.planIndex = 0;
  } else if (chg === 'pin') {
    if (el.value === '') delete state.pins[el.dataset.code];
    else state.pins[el.dataset.code] = Number(el.value);
    state.planIndex = 0;
  }
  render();
});

// Typing in the profile fields updates the limit line live without re-rendering
// the whole view (so the caret stays where it is).
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-inp]');
  if (!el) return;
  if (el.dataset.inp === 'cgpa') state.profile.cgpa = parseCgpa(el.value);
  else state.profile.semestersCompleted = Math.max(0, Math.min(20, parseInt(el.value, 10) || 0));
  state.hasProfile = true;
  const d = derive();
  const line = $('#band-line');
  if (line) line.innerHTML = bandLine(d.limits);
  save();
});

document.addEventListener('toggle', (e) => {
  if (e.target.id === 'det-electives') state.openElectives = e.target.open;
}, true);

async function copyExport() {
  const ta = $('#exp-text');
  if (!ta) return;
  let ok = false;
  try {
    await navigator.clipboard.writeText(ta.value);
    ok = true;
  } catch (err) {
    try {
      ta.focus();
      ta.select();
      ok = document.execCommand('copy');
    } catch (err2) {
      ok = false;
    }
  }
  const msg = ok ? t('msg.copied') : t('msg.copyFailed');
  const out = $('#copy-msg');
  if (out) out.textContent = msg;
  if (!ok) {
    ta.focus();
    ta.select();
  }
}

window.addEventListener('hashchange', () => {
  const v = location.hash.slice(1);
  if (!VIEWS.includes(v) || v === view) return;
  view = v;
  render({ focusTitle: true });
});

try {
  render();
} catch (err) {
  // Stored state that no longer matches the expected shape: start clean instead of a blank page.
  let retried = true;
  try {
    retried = sessionStorage.getItem(STORE_KEY + ':recovered') === '1';
    sessionStorage.setItem(STORE_KEY + ':recovered', '1');
    localStorage.removeItem(STORE_KEY);
  } catch (e) { /* ignore */ }
  if (retried) throw err;
  location.reload();
}
