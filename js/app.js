// UI layer: state, rendering and events. All rules live in engine.js.
import { DATA, META, RULES, OBSERVED, SAMPLE, DEMO_STUDENT } from './data.js';
import * as E from './engine.js';
import { STR } from './i18n.js';

const STORE_KEY = 'kayit-pilotu:v2';
const OLD_KEY = 'kayit-pilotu:v1';
const VIEWS = ['home', 'register', 'timetable', 'status', 'rules'];
const LEGACY = { courses: 'register', schedule: 'register', check: 'register' };
// Ordered so that the first few hues are far apart on the colour wheel.
// Reds are left out: red is reserved for clashes.
const HUES = [212, 28, 140, 282, 178, 52, 248, 96, 314, 196, 120, 266];
const TOTAL_ECTS = DATA.semesters.reduce((n, s) => n + s.ects, 0);
const DEMO = new URLSearchParams(location.search).get('demo') === '1';
const PREF_KEYS = ['fewDays', 'fewGaps', 'lateStart', 'freeWeekend'];
const PAGE = 12; // plan cards shown per "show more"

// ---------------------------------------------------------------------------
// State (persisted in localStorage) and UI state (not persisted)
// ---------------------------------------------------------------------------
function fresh() {
  return {
    lang: 'tr',
    hasProfile: false,
    profile: { status: {}, cgpa: null, semestersCompleted: 0, graduating: false },
    added: [], // courses the student added (electives, earlier courses, internship)
    dropped: [], // automatic compulsory courses the student removed (never retakes)
    picks: {}, // chosen section number per course
    prefs: { ...E.DEFAULT_PREFS },
    reg: 'draft', // 'draft' | 'pending' (simulated "sent to advisor")
    sentAt: null,
    openElectives: false,
  };
}

function clearRegistration(s) {
  s.added = [];
  s.dropped = [];
  s.picks = {};
  s.reg = 'draft';
  s.sentAt = null;
}

function withSample(s) {
  s.profile = JSON.parse(JSON.stringify(SAMPLE.profile));
  s.hasProfile = true;
  clearRegistration(s);
  return s;
}

const arr = (x) => (Array.isArray(x) ? x.filter((c) => typeof c === 'string') : []);
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

function load() {
  const base = fresh();
  let raw = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch (e) {
    /* storage unavailable */
  }
  if (raw) {
    try {
      const s = JSON.parse(raw);
      return {
        ...base,
        ...s,
        profile: { ...base.profile, ...obj(s.profile), status: { ...obj(obj(s.profile).status) } },
        prefs: { ...base.prefs, ...obj(s.prefs) },
        added: arr(s.added),
        dropped: arr(s.dropped),
        picks: obj(s.picks),
        reg: s.reg === 'pending' ? 'pending' : 'draft',
        lang: s.lang === 'en' ? 'en' : 'tr',
      };
    } catch (e) {
      /* fall through to a fresh start */
    }
  }
  // First visit: keep a profile entered in the previous version, otherwise load the
  // fictional sample student so the whole flow can be seen at once.
  let old = null;
  try {
    old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
  } catch (e) {
    old = null;
  }
  if (old && old.hasProfile && old.profile) {
    base.profile = { ...base.profile, ...obj(old.profile), status: { ...obj(obj(old.profile).status) } };
    base.hasProfile = true;
  } else {
    withSample(base);
  }
  if (old && old.lang === 'en') base.lang = 'en';
  return base;
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    /* storage unavailable: the app still works for this session */
  }
}

let state = load();
const ui = { focus: null, navOpen: false, sg: null, sent: false, openers: {} };

function viewFromHash() {
  const h = location.hash.slice(1);
  if (VIEWS.includes(h)) return h;
  if (LEGACY[h]) return LEGACY[h];
  return 'home';
}
let view = viewFromHash();

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
const program = () => (state.lang === 'tr' ? META.programTr : META.program);
const fmtRange = (r) => `${t('day.' + r.d)} ${E.slotStart(r.from)}–${E.slotEnd(r.to)}`;
const times = (slots) => E.mergeSlots(slots).map(fmtRange).join(', ');
const codeList = (codes) => codes.map(lbl).join(', ');
const fmt2 = (n) => (state.lang === 'tr' ? n.toFixed(2).replace('.', ',') : n.toFixed(2));
const initials = (name) => name.split(/\s+/).map((w) => w.charAt(0)).join('').slice(0, 2).toLocaleUpperCase('tr');
const sectionOf = (code, no) => (DATA.sectionsByCourse[code] || []).find((s) => s.no === no);
const ta = (s) => esc(s); // attribute-safe text

function say(msg) {
  const live = $('#live');
  live.textContent = '';
  setTimeout(() => { live.textContent = msg; }, 30);
}

function hueMap(codes) {
  const map = {};
  codes.forEach((code, i) => { map[code] = HUES[i % HUES.length]; });
  return map;
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

/** "ME 3220 ile Salı 08:40'ta çakışıyor" */
function clashText(code, shared) {
  const s = shared[0];
  return t('clash.with', { code: lbl(code), when: `${t('dayLong.' + s.d)} ${E.slotStart(s.h)}` });
}

// Inline SVG icons (decorative; every icon sits next to visible text or an aria-label).
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  book: '<path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h11"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12.5 10 17l9-10"/>',
  alert: '<path d="M12 3.5 2.5 20.5h19z"/><path d="M12 10v5M12 17.8v.4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M6 12h12"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17.5h7M17.5 14v7"/>',
  send: '<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
  advisor: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 11l2 2 4-4"/>',
  gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
};
const ic = (name, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name]}</svg>`;

// ---------------------------------------------------------------------------
// Derived data
// ---------------------------------------------------------------------------
function derive() {
  const p = state.profile;
  const plan = E.registrationPlan(p, DATA);
  const okAdd = new Set(plan.optional.filter((o) => E.SELECTABLE.has(o.cat)).map((o) => o.code));
  state.added = state.added.filter((c) => okAdd.has(c));
  const selected = E.composeSelection(plan, { added: state.added, dropped: state.dropped });
  const sections = E.resolveSections(selected, state.picks, DATA);
  const chosen = E.chosenSections(sections, DATA);
  const clashes = E.chosenClashes(chosen);
  const missing = selected.filter((c) => E.needsSection(c, DATA) && sections[c] === undefined);
  const limits = E.ectsLimits(p);
  const sum = E.ectsSummary(selected, p, DATA);
  if (ui.focus && !selected.includes(ui.focus)) ui.focus = null;
  return { plan, selected, sections, chosen, clashes, missing, limits, sum, hue: hueMap(selected) };
}

const isLocked = () => state.reg === 'pending';

// ---------------------------------------------------------------------------
// Chrome: top bar, sidebar, footer
// ---------------------------------------------------------------------------
function renderChrome(d) {
  document.documentElement.lang = state.lang;
  document.title = `${t('view.' + view)} · Kayıt Pilotu`;
  $('#skip').textContent = t('skip');
  $('#brand-t').textContent = 'Kayıt Pilotu';
  $('#brand').setAttribute('aria-label', `Kayıt Pilotu — ${t('view.home')}`);
  $('#term-chip').textContent = term();
  $('#term-chip').setAttribute('title', t('top.term'));
  $('#langgroup').setAttribute('aria-label', t('lang.label'));
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang));
  $('#who-av').textContent = initials(DEMO_STUDENT.name);
  $('#who-name').textContent = DEMO_STUDENT.name;
  $('#who-sub').textContent = t('demo.fictional');
  $('#who').setAttribute('title', `${DEMO_STUDENT.name} — ${t('demo.fictional')}`);
  const tog = $('#nav-toggle');
  tog.setAttribute('aria-expanded', String(ui.navOpen));
  tog.setAttribute('aria-label', ui.navOpen ? t('nav.close') : t('nav.open'));
  document.body.classList.toggle('nav-open', ui.navOpen);
  $('#sidebar').setAttribute('aria-label', t('nav.label'));

  const link = (v, icon, extra = '') =>
    `<a href="#${v}" class="nav-a" data-testid="nav-${v}"${v === view ? ' aria-current="page"' : ''}>${ic(icon)}<span class="nav-t">${t('nav.' + v)}</span>${extra}</a>`;
  const regBadge = `<span class="nav-badge nav-badge-${state.reg}">${t('regShort.' + state.reg)}</span>`;
  $('#nav').innerHTML = `<p class="side-term">${esc(term())}</p><ul class="nav">
    <li>${link('home', 'home')}</li>
    <li class="nav-group"><span class="nav-group-t">${ic('folder')}<span>${t('nav.group')}</span></span>
      <ul><li>${link('register', 'book', regBadge)}</li><li>${link('timetable', 'calendar')}</li></ul></li>
    <li>${link('status', 'user')}</li>
    <li>${link('rules', 'info')}</li>
  </ul><p class="side-note">${t('side.note')}</p>`;
  $('#foot').innerHTML = `<p>${t('foot.disclaimer')} <a href="#rules">${t('nav.rules')}</a> · ${t('foot.data', { date: META.collected })}</p>`;
  renderPrintArea(d);
}

// ---------------------------------------------------------------------------
// Timetable grid. blocks = [{ d, from, to, code, kind, ... }].
// Overlapping blocks of one day are placed side by side (lanes).
// ---------------------------------------------------------------------------
function layoutDays(blocks) {
  const used = new Set(blocks.map((b) => b.d));
  const days = [0, 1, 2, 3, 4];
  if (used.has(5) || used.has(6)) days.push(5);
  if (used.has(6)) days.push(6);
  let lo = 8;
  let hi = 16;
  if (blocks.length) {
    lo = Math.min(...blocks.map((b) => b.from));
    hi = Math.max(...blocks.map((b) => b.to));
  }
  return { days, lo, hi };
}

function assignLanes(list) {
  const sorted = [...list].sort((a, b) => a.from - b.from || a.to - b.to);
  let cluster = [];
  let end = -1;
  const flush = () => {
    const lanes = [];
    for (const b of cluster) {
      let k = lanes.findIndex((e) => e < b.from);
      if (k < 0) {
        k = lanes.length;
        lanes.push(b.to);
      } else lanes[k] = b.to;
      b.lane = k;
    }
    for (const b of cluster) b.lanes = lanes.length;
    cluster = [];
  };
  for (const b of sorted) {
    if (cluster.length && b.from > end) {
      flush();
      end = -1;
    }
    cluster.push(b);
    end = Math.max(end, b.to);
  }
  flush();
  return sorted;
}

function blockHtml(b, lo, hue, interactive) {
  const span = b.to - b.from + 1;
  const style = `--h:${hue[b.code] === undefined ? 210 : hue[b.code]};top:calc(var(--rh) * ${b.from - lo});height:calc(var(--rh) * ${span} - 3px);left:calc(100% * ${b.lane} / ${b.lanes});width:calc(100% / ${b.lanes} - 3px)`;
  const when = `${t('dayLong.' + b.d)} ${E.slotStart(b.from)}–${E.slotEnd(b.to)}`;
  const secTxt = `${t('secShort')} ${b.nos.join('/')}`;
  const room = b.room ? `<span class="blk-l">${esc(b.room)}</span>` : '';
  let tag = '';
  let why = '';
  let stTxt = '';
  if (b.kind === 'locked') {
    why = clashText(b.clashes[0].code, b.clashes[0].shared);
    tag = `<span class="blk-tag">${ic('lock')}${t('blk.locked')}</span><span class="blk-l blk-why">${esc(why)}</span>`;
    stTxt = `${t('blk.locked')}: ${why}`;
  } else if (b.kind === 'ghost') {
    tag = `<span class="blk-tag">${ic('plus')}${t('blk.pick')}</span>`;
    stTxt = t('blk.free');
  } else if (b.kind === 'cur') {
    tag = `<span class="blk-tag">${ic('check')}${t('blk.current')}</span>`;
    stTxt = t('blk.current');
  } else if (b.kind === 'clash') {
    tag = `<span class="blk-tag">${ic('alert')}${t('blk.clash')}</span>`;
    stTxt = t('blk.clash');
  }
  const narrowCode = b.lanes >= 3 ? `${esc(lbl(b.code).split(' ').pop())}<br>${t('secShort')} ${b.nos.join('/')}` : esc(lbl(b.code));
  const inner = `<strong class="blk-c">${narrowCode}</strong><span class="blk-l">${secTxt}</span>${tag}${b.kind === 'locked' ? '' : room}`;
  const label = `${lbl(b.code)}, ${t('sec').toLowerCase()} ${b.nos.join('/')}, ${when}${stTxt ? ', ' + stTxt : ''}`;
  const narrow = b.lanes >= 3 ? ' blk-narrow' : b.lanes === 2 ? ' blk-half' : '';
  if (!interactive) return `<div class="blk blk-${b.kind}${narrow}" style="${style}" title="${ta(label)}"><span class="sr">${esc(label)}</span><span aria-hidden="true" class="blk-in">${inner}</span></div>`;
  const act = b.act === 'pick' ? `data-act="pick" data-code="${b.code}" data-no="${b.nos[0]}"` : `data-act="focus" data-code="${b.code}"`;
  const extra = b.kind === 'locked' ? ' aria-disabled="true"' : b.act === 'pick' ? ` aria-pressed="${b.kind === 'cur'}"` : '';
  return `<button type="button" class="blk blk-${b.kind}${narrow}" style="${style}" ${act} data-testid="${b.testid}" aria-label="${ta(label)}" title="${ta(label)}"${extra}${isLocked() ? ' disabled' : ''}><span class="blk-in" aria-hidden="true">${inner}</span></button>`;
}

function gridHtml(blocks, hue, { interactive = false, testid = 'timetable-grid', cls = '' } = {}) {
  const { days, lo, hi } = layoutDays(blocks);
  const rows = hi - lo + 1;
  let h = `<div class="tt-scroll"><div class="tt ${cls}" data-testid="${testid}" style="--rows:${rows};--days:${days.length}" role="group" aria-label="${ta(t('tt.caption'))}">`;
  h += `<div class="tt-corner" aria-hidden="true"></div>`;
  h += days.map((d, i) => `<div class="tt-dh" style="grid-column:${i + 2}"><abbr title="${t('dayLong.' + d)}">${t('day.' + d)}</abbr></div>`).join('');
  h += `<div class="tt-times" aria-hidden="true">`;
  for (let hr = lo; hr <= hi; hr++) h += `<div>${E.slotStart(hr)}</div>`;
  h += `</div>`;
  days.forEach((d, i) => {
    const list = assignLanes(blocks.filter((b) => b.d === d));
    h += `<div class="tt-col" style="grid-column:${i + 2}">${list.map((b) => blockHtml(b, lo, hue, interactive)).join('')}</div>`;
  });
  return h + `</div></div>`;
}

/** Solid blocks for the chosen sections (optionally leaving one course out). */
function chosenBlocks(d, skip = null) {
  const out = [];
  for (const ch of d.chosen) {
    if (ch.code === skip) continue;
    const clash = d.clashes.some((p) => p.a === ch.code || p.b === ch.code);
    const sec = sectionOf(ch.code, ch.no);
    for (const r of E.mergeSlots(ch.slots)) {
      out.push({ ...r, code: ch.code, nos: [ch.no], room: sec ? sec.room : '', kind: clash ? 'clash' : 'sel', act: 'focus', testid: `tt-course-${ch.code}` });
    }
  }
  return out;
}

/** Chosen blocks + every section of the focused course as selectable / locked ghost blocks. */
function registerBlocks(d) {
  const focus = ui.focus;
  const out = chosenBlocks(d, focus);
  if (!focus) return out;
  const others = d.chosen.filter((c) => c.code !== focus);
  const cur = d.sections[focus];
  for (const x of E.sectionConflicts(focus, others, DATA)) {
    const isCur = x.option.nos.includes(cur);
    const kind = isCur ? (x.clashes.length ? 'clash' : 'cur') : x.clashes.length ? 'locked' : 'ghost';
    for (const r of E.mergeSlots(x.option.slots)) {
      out.push({ ...r, code: focus, nos: x.option.nos, room: x.option.sections[0].room, kind, clashes: x.clashes, act: 'pick', testid: `tt-section-${focus}-${x.option.nos[0]}` });
    }
  }
  return out;
}

function legendHtml() {
  return `<ul class="legend" aria-label="${ta(t('legend.label'))}">
    <li><span class="lg lg-sel" aria-hidden="true"></span>${t('legend.sel')}</li>
    <li><span class="lg lg-ghost" aria-hidden="true"></span>${t('legend.ghost')}</li>
    <li><span class="lg lg-locked" aria-hidden="true"></span>${t('legend.locked')}</li>
  </ul>`;
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------
function roleBadge(role) {
  return `<span class="badge badge-${role}">${role === 'retake' ? ic('alert') : ''}${t('role.' + role)}</span>`;
}

function regStatusBadge(testid) {
  const ico = state.reg === 'pending' ? ic('send') : ic('edit');
  return `<span class="status-badge status-${state.reg}" data-testid="${testid}" data-state="${state.reg}">${ico}${t('reg.' + state.reg)}</span>`;
}

function ectsMeter(d, testid = 'ects-total') {
  const { limits, sum } = d;
  const over = sum.total > limits.max;
  const pct = Math.min(100, (sum.total / limits.max) * 100);
  const minMark = (E.MIN_ECTS / limits.max) * 100;
  return `<div class="ects-meter${over ? ' is-over' : ''}">
    <p class="ects-num"><strong data-testid="${testid}">${sum.total} / ${limits.max}</strong> ${t('ects')}</p>
    <div class="meter" aria-hidden="true"><span style="width:${pct}%"></span><i style="left:${minMark}%"></i></div>
    <p class="small muted">${t('art')} ${limits.article} · ${t('ects.min', { min: E.MIN_ECTS })}${over ? ` · <strong class="txt-bad">${t('bar.over', { n: sum.total - limits.max })}</strong>` : ''}</p>
  </div>`;
}

function courseState(code, d) {
  const c = course(code);
  if (c.sectionsNotLoaded) return { st: 'notLoaded', tone: 'warn', icon: 'info', text: t('cst.notLoaded') };
  if (!E.needsSection(code, DATA)) return { st: 'noTimetable', tone: 'ok', icon: 'check', text: t('cst.noTimetable') };
  const no = d.sections[code];
  if (no === undefined) {
    const conf = E.sectionConflicts(code, d.chosen, DATA);
    if (conf.every((x) => x.clashes.length)) return { st: 'allClash', tone: 'bad', icon: 'alert', text: t('cst.allClash') };
    return { st: 'choose', tone: 'warn', icon: 'target', text: t('cst.choose') };
  }
  const cl = d.clashes.find((p) => p.a === code || p.b === code);
  if (cl) return { st: 'clash', tone: 'bad', icon: 'alert', text: clashText(cl.a === code ? cl.b : cl.a, cl.shared) };
  return { st: 'selected', tone: 'ok', icon: 'check', text: t('cst.selected', { no }) };
}

const pill = (code, st, tone, icon, text) =>
  `<span class="pill pill-${tone}" data-testid="course-status-${code}" data-state="${st}">${ic(icon)}<span>${text}</span></span>`;

function secCountText(code) {
  const c = course(code);
  const n = (DATA.sectionsByCourse[code] || []).length;
  if (c.sectionsNotLoaded) return t('secNotLoaded');
  if (c.noTimetable) return t('noTimetable');
  return n === 1 ? t('sec1') : t('secN', { n });
}

// ---------------------------------------------------------------------------
// View: Ana Sayfa (dashboard)
// ---------------------------------------------------------------------------
function viewHome(d) {
  const p = state.profile;
  const st = p.status;
  const passedEcts = DATA.semesters.reduce((n, s) => n + s.courses.reduce((m, c) => m + (st[c.code] === 'passed' ? c.ects : 0), 0), 0);
  const sem = E.currentSemester(p);
  const first = DEMO_STUDENT.name.split(' ')[0];
  let h = `<header class="page-head"><p class="crumb">${t('view.home')}</p>
    <h1 id="view-title" tabindex="-1">${t('home.hello', { name: esc(first) })}</h1>
    <p class="lead">${t('home.lead', { term: esc(term()) })}</p></header>`;

  if (d.plan.locked.length) {
    h += `<div class="notice notice-warn" role="note">${ic('alert')}<p>${t('home.retake', { codes: esc(codeList(d.plan.locked)) })}</p></div>`;
  }

  h += `<div class="dash">`;
  // Student
  h += `<section class="card dcard" data-testid="card-student" aria-labelledby="c-st"><h2 id="c-st" class="dcard-t">${ic('user')}${t('home.student')}</h2>
    <div class="who-big"><span class="avatar avatar-lg" aria-hidden="true">${esc(initials(DEMO_STUDENT.name))}</span>
    <div><p class="big">${esc(DEMO_STUDENT.name)}</p><p class="small muted">${t('demo.fictional')}</p></div></div>
    <dl class="kv"><div><dt>${t('home.number')}</dt><dd>${esc(DEMO_STUDENT.number)}</dd></div>
    <div><dt>${t('home.program')}</dt><dd>${esc(program())}</dd></div>
    <div><dt>${t('home.semester')}</dt><dd>${t('semN', { n: sem })}</dd></div></dl>
    <a class="btn btn-small" href="#status" data-testid="edit-profile">${ic('edit')}${t('home.editProfile')}</a></section>`;
  // CGPA and limit
  h += `<section class="card dcard" data-testid="card-gpa" aria-labelledby="c-gpa"><h2 id="c-gpa" class="dcard-t">${ic('gauge')}${t('home.gpa')}</h2>
    <p class="metric">${p.cgpa === null || p.cgpa === undefined ? '—' : fmt2(p.cgpa)}</p>
    <p>${t('home.maxEcts', { max: d.limits.max })} <span class="art">${t('art')} ${d.limits.article}</span></p>
    <p class="small muted">${t('band.rule')}</p>${d.limits.reason === 'noCgpa' ? `<p class="small muted">${t('band.unknownHint')}</p>` : ''}</section>`;
  // Passed ECTS
  h += `<section class="card dcard" data-testid="card-ects-passed" aria-labelledby="c-pe"><h2 id="c-pe" class="dcard-t">${ic('check')}${t('home.passed')}</h2>
    <p class="metric">${passedEcts}<span class="metric-of"> / ${TOTAL_ECTS} ${t('ects')}</span></p>
    <div class="meter" aria-hidden="true"><span style="width:${(passedEcts / TOTAL_ECTS) * 100}%"></span></div>
    <p class="small muted">${t('home.passedNote', { pct: Math.round((passedEcts / TOTAL_ECTS) * 100) })}</p></section>`;
  // Registration status
  h += `<section class="card dcard" data-testid="card-reg-status" aria-labelledby="c-rs"><h2 id="c-rs" class="dcard-t">${ic('book')}${t('home.regStatus')}</h2>
    <p>${regStatusBadge('dash-reg-status')}</p>
    <p class="small">${t('home.regLine', { n: d.selected.length, ects: d.sum.total, max: d.limits.max })}</p>
    ${state.reg === 'pending' && state.sentAt ? `<p class="small muted">${t('home.sentAt', { at: esc(new Date(state.sentAt).toLocaleString(state.lang === 'tr' ? 'tr-TR' : 'en-GB')) })}</p>` : `<p class="small muted">${t('home.regSteps')}</p>`}</section>`;
  // Advisor
  h += `<section class="card dcard" data-testid="card-advisor" aria-labelledby="c-ad"><h2 id="c-ad" class="dcard-t">${ic('advisor')}${t('home.advisor')}</h2>
    <p class="big">${esc(DEMO_STUDENT.advisor)}</p><p class="small muted">${t('home.advisorNote')}</p></section>`;
  // Call to action
  h += `<section class="card dcard dcard-cta" aria-labelledby="c-cta"><h2 id="c-cta" class="dcard-t">${ic('calendar')}${t('home.ctaTitle', { term: esc(term()) })}</h2>
    <p class="small">${t('home.ctaText')}</p>
    <a class="btn btn-primary btn-lg" href="#register" data-testid="start-registration">${state.reg === 'pending' ? t('home.ctaView') : t('home.cta')}${ic('arrow')}</a></section>`;
  h += `</div>`;
  return h;
}

// ---------------------------------------------------------------------------
// View: Ders Kayıt
// ---------------------------------------------------------------------------
function courseRow(code, d, { rowState = 'auto', missing = [] } = {}) {
  const c = course(code);
  const role = E.courseRole(code, state.profile, DATA);
  const selected = d.selected.includes(code);
  const locked = d.plan.locked.includes(code);
  const isAuto = d.plan.auto.includes(code);
  const ro = isLocked();
  let status;
  let actions = '';
  if (rowState === 'blocked') status = pill(code, 'blocked', 'bad', 'lock', `${t('cst.blocked')}: ${esc(missingText(missing))}`);
  else if (rowState === 'notOffered') status = pill(code, 'notOffered', 'muted', 'minus', t('cst.notOffered'));
  else if (!selected) {
    status = pill(code, 'dropped', 'muted', 'minus', t('cst.dropped'));
    actions = `<button type="button" class="btn btn-small" data-act="readd" data-code="${code}" data-testid="course-readd-${code}" id="readd-${code}"${ro ? ' disabled' : ''}>${ic('undo')}${t('act.readd')}</button>`;
  } else {
    const s = courseState(code, d);
    status = pill(code, s.st, s.tone, s.icon, s.text);
    if (E.needsSection(code, DATA)) {
      const lab = d.sections[code] === undefined ? t('act.choose') : t('act.change');
      actions += `<button type="button" class="btn btn-small${ui.focus === code ? ' is-active' : ''}${d.sections[code] === undefined ? ' btn-primary' : ''}" data-act="focus" data-code="${code}" data-testid="course-focus-${code}" id="focus-${code}" aria-pressed="${ui.focus === code}"${ro ? ' disabled' : ''}>${ic('target')}${lab}<span class="sr"> — ${esc(c.label)}</span></button>`;
    }
    if (locked) actions += `<span class="lockmark" title="${ta(t('act.lockedRetake'))}">${ic('lock')}<span class="sr">${t('act.lockedRetake')}</span></span>`;
    else actions += `<button type="button" class="icon-btn" data-act="remove" data-code="${code}" data-testid="course-remove-${code}" id="rm-${code}" aria-label="${ta(t('act.remove', { code: c.label }))}" title="${ta(t('act.remove', { code: c.label }))}"${ro ? ' disabled' : ''}>${ic('x')}</button>`;
  }
  const dot = selected ? `<span class="cdot" style="--h:${d.hue[code]}" aria-hidden="true"></span>` : `<span class="cdot cdot-off" aria-hidden="true"></span>`;
  const meta = [secCountText(code)];
  if ((DATA.sectionsByCourse[code] || []).length && (DATA.sectionsByCourse[code] || []).every((s) => s.online)) meta.push(t('online'));
  if (isAuto && rowState === 'auto' && !locked) meta.push(t('row.auto'));
  return `<li class="crow${ui.focus === code ? ' is-focus' : ''}${rowState !== 'auto' || !selected ? ' is-off' : ''}" data-testid="course-row-${code}">
    ${dot}<div class="crow-main"><p class="crow-top"><strong class="code">${esc(c.label)}</strong>${roleBadge(role)}<span class="ects">${c.ects} ${t('ects')}</span></p>
    <p class="name">${cname(c)}</p><p class="crow-meta"><span class="muted">${meta.join(' · ')}</span>${status}</p></div>
    ${actions ? `<div class="crow-act">${actions}</div>` : ''}</li>`;
}

function optionalRow(o, d) {
  const c = course(o.code);
  const ro = isLocked();
  const n = (DATA.sectionsByCourse[o.code] || []).length;
  let right = '';
  let status = '';
  if (o.cat === 'blocked') status = pill(o.code, 'blocked', 'bad', 'lock', `${t('cst.blocked')}: ${esc(missingText(o.missing))}`);
  else right = `<button type="button" class="btn btn-small" data-act="add" data-code="${o.code}" data-testid="course-add-${o.code}" id="add-${o.code}"${ro ? ' disabled' : ''}>${ic('plus')}${t('act.add')}<span class="sr"> — ${esc(c.label)}</span></button>`;
  const meta = [c.semester ? t('semN', { n: c.semester }) : t('role.elective'), secCountText(o.code)];
  if (n && (DATA.sectionsByCourse[o.code] || []).every((s) => s.online)) meta.push(t('online'));
  return `<li class="orow" data-testid="course-row-${o.code}"><div class="crow-main"><p class="crow-top"><strong class="code">${esc(c.label)}</strong><span class="ects">${c.ects} ${t('ects')}</span></p>
    <p class="name">${cname(c)}</p><p class="crow-meta"><span class="muted">${meta.join(' · ')}</span>${status}</p></div>${right ? `<div class="crow-act">${right}</div>` : ''}</li>`;
}

function sectionPicker(d) {
  const code = ui.focus;
  if (!code) {
    return `<div class="picker-empty">${ic('target')}<p>${d.missing.length ? t('pick.hintMissing', { n: d.missing.length }) : t('pick.hint')}</p></div>`;
  }
  const c = course(code);
  const others = d.chosen.filter((x) => x.code !== code);
  const cur = d.sections[code];
  const items = E.sectionConflicts(code, others, DATA).map((x) => {
    const o = x.option;
    const isCur = o.nos.includes(cur);
    const lockedX = x.clashes.length > 0 && !isCur;
    const sec = o.sections[0];
    let st;
    if (isCur && x.clashes.length) st = `<span class="pill pill-bad">${ic('alert')}<span>${esc(clashText(x.clashes[0].code, x.clashes[0].shared))}</span></span>`;
    else if (isCur) st = `<span class="pill pill-ok">${ic('check')}<span>${t('blk.current')}</span></span>`;
    else if (lockedX) st = `<span class="pill pill-muted">${ic('lock')}<span>${t('blk.locked')}: ${esc(clashText(x.clashes[0].code, x.clashes[0].shared))}</span></span>`;
    else st = `<span class="pill pill-info">${ic('plus')}<span>${t('blk.free')}</span></span>`;
    return `<li><button type="button" class="secopt${isCur ? ' is-cur' : ''}${lockedX ? ' is-locked' : ''}" data-act="pick" data-code="${code}" data-no="${o.nos[0]}" data-testid="section-option-${code}-${o.nos[0]}" id="so-${code}-${o.nos[0]}" aria-pressed="${isCur}"${lockedX ? ' aria-disabled="true"' : ''}${isLocked() ? ' disabled' : ''}>
      <span class="secopt-n">${t('sec')} ${o.nos.join(' / ')}</span><span class="secopt-t">${times(o.slots)}</span>
      <span class="secopt-r muted">${esc(sec.room)}${o.online ? ' · ' + t('online') : ''} · ${t('plan.capacity', { n: sec.cap })}</span>${st}</button></li>`;
  });
  return `<div class="picker"><div class="picker-head"><h3 id="picker-t" tabindex="-1">${t('pick.title', { code: esc(c.label) })}</h3>
    <button type="button" class="btn btn-small btn-ghost" data-act="unfocus" data-testid="focus-close" id="focus-close">${ic('x')}${t('pick.close')}</button></div>
    <p class="small muted">${t('pick.lead')}</p><ul class="seclist" aria-labelledby="picker-t">${items.join('')}</ul>
    <p class="small muted">${t('plan.capNote')}</p></div>`;
}

function viewRegister(d) {
  const sem = d.plan.semester;
  const ro = isLocked();
  let h = `<header class="page-head"><p class="crumb">${t('nav.group')} <span aria-hidden="true">›</span> ${t('nav.register')}</p>
    <h1 id="view-title" tabindex="-1">${t('nav.register')}</h1>
    <p class="lead">${t('reg.lead', { term: esc(term()), sem })}</p></header>`;

  if (ro) {
    h += `<div class="notice notice-info" role="status" data-testid="reg-pending-banner">${ic('send')}<div><p><strong>${t('reg.pending')}</strong> — ${t('reg.pendingText')}</p>
      <button type="button" class="btn btn-small" data-act="unlock" data-testid="reg-unlock" id="reg-unlock">${ic('undo')}${t('reg.unlock')}</button></div></div>`;
  }

  // Header cards
  h += `<div class="hcards">
    <section class="card hcard" aria-labelledby="hc-fin"><h2 id="hc-fin" class="hcard-t">${ic('wallet')}${t('rc.finance')}</h2><p class="hcard-v"><span class="status-badge status-ok">${ic('check')}${t('rc.financeOk')}</span></p><p class="small muted">${t('rc.financeNote')}</p></section>
    <section class="card hcard" aria-labelledby="hc-adv"><h2 id="hc-adv" class="hcard-t">${ic('advisor')}${t('rc.advisor')}</h2><p class="hcard-v">${regStatusBadge('reg-status')}</p><p class="small muted">${esc(DEMO_STUDENT.advisor)}</p></section>
    <section class="card hcard" aria-labelledby="hc-term"><h2 id="hc-term" class="hcard-t">${ic('calendar')}${t('rc.term')}</h2><p class="hcard-v big">${esc(term())}</p><p class="small muted">${t('semN', { n: sem })} · ${t('reg.program')}</p></section>
    <section class="card hcard" aria-labelledby="hc-ects" aria-live="polite"><h2 id="hc-ects" class="hcard-t">${ic('gauge')}${t('rc.ects')}</h2>${ectsMeter(d)}</section>
  </div>`;

  // Toolbar
  h += `<div class="toolbar no-print" role="toolbar" aria-label="${ta(t('reg.toolbar'))}">
    <button type="button" class="btn btn-accent" data-act="suggest" data-testid="open-suggest" id="open-suggest"${ro ? ' disabled' : ''}>${ic('grid')}${t('act.suggest')}</button>
    <button type="button" class="btn btn-primary" data-act="complete" data-testid="complete-registration" id="complete-registration">${ic('check')}${t('act.complete')}</button>
    <span class="toolbar-sp"></span>
    <button type="button" class="btn btn-small" data-act="png" data-testid="download-png" id="download-png">${ic('download')}${t('act.png')}</button>
    <button type="button" class="btn btn-small" data-act="copy" data-testid="copy-text" id="copy-text">${ic('copy')}${t('act.copy')}</button>
    <button type="button" class="btn btn-small" data-act="print" data-testid="print" id="print">${ic('print')}${t('act.print')}</button>
    <span id="copy-msg" class="small" role="status"></span>
  </div>`;

  // Left column: courses
  const rowCodes = new Set(d.plan.rows.map((r) => r.code));
  let left = `<section class="card" aria-labelledby="cz-t"><div class="card-head"><h2 id="cz-t" class="h3">${t('reg.compulsory')} <span class="count">${d.plan.rows.length}</span></h2></div>
    <p class="note">${t('reg.compulsoryNote')}</p>`;
  left += d.plan.rows.length
    ? `<ul class="crows">${d.plan.rows.map((r) => courseRow(r.code, d, { rowState: r.state, missing: r.missing })).join('')}</ul>`
    : `<p class="empty">${t('reg.noCompulsory')}</p>`;
  left += `</section>`;

  const addedCodes = d.selected.filter((c) => !rowCodes.has(c));
  const electives = d.plan.optional.filter((o) => o.group === 'elective' && !d.selected.includes(o.code));
  const others = d.plan.optional.filter((o) => o.group === 'other' && !d.selected.includes(o.code));
  left += `<section class="card" aria-labelledby="ce-t"><div class="card-head"><h2 id="ce-t" class="h3">${t('reg.electives')}</h2></div>`;
  if (addedCodes.length) left += `<h3 class="h4">${t('reg.added')}</h3><ul class="crows">${addedCodes.map((c) => courseRow(c, d)).join('')}</ul>`;
  left += `<h3 class="h4">${t('reg.deptElectives')}</h3><p class="note">${t('courses.electiveNote')}</p>`;
  left += electives.length ? `<ul class="orows">${electives.map((o) => optionalRow(o, d)).join('')}</ul>` : `<p class="empty">${t('reg.noElectives')}</p>`;
  if (others.length) {
    left += `<details class="more"${state.openOthers ? ' open' : ''} id="det-others"><summary>${t('reg.others')} <span class="count">${others.length}</span></summary>
      <p class="note">${t('reg.othersNote')}</p><ul class="orows">${others.map((o) => optionalRow(o, d)).join('')}</ul></details>`;
  }
  left += `</section>`;

  // Right column: timetable with section picking
  const right = `<section class="card tt-card" aria-labelledby="tt-t"><div class="card-head"><h2 id="tt-t" class="h3">${t('reg.weekly')}</h2>${legendHtml()}</div>
    ${ui.focus ? `<p class="focus-hint" role="status">${ic('target')}<span>${t('pick.gridHint', { code: esc(lbl(ui.focus)) })}</span></p>` : ''}
    ${gridHtml(registerBlocks(d), d.hue, { interactive: true })}
    ${sectionPicker(d)}</section>`;

  h += `<div class="reg-cols"><div class="reg-left">${left}</div><div class="reg-right">${right}</div></div>`;
  return h;
}

// ---------------------------------------------------------------------------
// View: Haftalık Program
// ---------------------------------------------------------------------------
function courseTable(d, prefix = 'tp') {
  const rows = d.selected.map((code) => {
    const c = course(code);
    const role = E.courseRole(code, state.profile, DATA);
    const no = d.sections[code];
    let sec = '—';
    if (no !== undefined) sec = String(no);
    else if (E.needsSection(code, DATA)) sec = `<span class="txt-warn">${t('tbl.noSection')}</span>`;
    else if (c.sectionsNotLoaded) sec = `<span class="muted">${t('tbl.obs')}</span>`;
    return `<tr data-testid="${prefix}-row-${code}"><td>${sec}</td><td class="nowrap"><strong>${esc(c.label)}</strong></td><td>${cname(c)}</td><td>${roleBadge(role)}</td><td class="num">${c.ects}</td></tr>`;
  });
  return `<div class="table-wrap"><table class="ctable"><caption class="sr">${t('tbl.caption')}</caption>
    <thead><tr><th scope="col">${t('secShort')}</th><th scope="col">${t('tbl.code')}</th><th scope="col">${t('tbl.name')}</th><th scope="col">${t('tbl.type')}</th><th scope="col" class="num">${t('ects')}</th></tr></thead>
    <tbody>${rows.join('') || `<tr><td colspan="5" class="muted">${t('tbl.empty')}</td></tr>`}</tbody>
    <tfoot><tr><th scope="row" colspan="4">${t('tbl.total')} <span class="art">${t('art')} ${d.limits.article}</span></th><td class="num" data-testid="${prefix}-total"><strong>${d.sum.total} / ${d.limits.max}</strong> ${t('ects')}</td></tr></tfoot></table></div>`;
}

function viewTimetable(d) {
  let h = `<header class="page-head"><p class="crumb">${t('nav.group')} <span aria-hidden="true">›</span> ${t('nav.timetable')}</p>
    <h1 id="view-title" tabindex="-1">${t('nav.timetable')}</h1><p class="lead">${t('tp.lead', { term: esc(term()) })}</p></header>`;
  const notes = [];
  if (d.missing.length) notes.push(`<div class="notice notice-warn" role="note">${ic('alert')}<p>${t('tp.missing', { codes: esc(codeList(d.missing)) })} <a href="#register">${t('nav.register')}</a></p></div>`);
  if (d.clashes.length) notes.push(`<div class="notice notice-bad" role="note">${ic('alert')}<p>${d.clashes.map((p) => `${esc(lbl(p.a))}: ${esc(clashText(p.b, p.shared))}`).join('; ')}</p></div>`);
  h += notes.join('');
  h += `<div class="toolbar no-print" role="toolbar" aria-label="${ta(t('reg.toolbar'))}">${regStatusBadge('tp-reg-status')}<span class="toolbar-sp"></span>
    <button type="button" class="btn btn-small btn-primary" data-act="png" data-testid="download-png" id="download-png">${ic('download')}${t('act.png')}</button>
    <button type="button" class="btn btn-small" data-act="copy" data-testid="copy-text" id="copy-text">${ic('copy')}${t('act.copy')}</button>
    <button type="button" class="btn btn-small" data-act="print" data-testid="print" id="print">${ic('print')}${t('act.print')}</button>
    <span id="copy-msg" class="small" role="status"></span></div>`;
  h += `<section class="card" aria-labelledby="tp-g"><h2 id="tp-g" class="h3">${t('reg.weekly')} <span class="count">${esc(term())}</span></h2>
    ${gridHtml(chosenBlocks(d), d.hue, { testid: 'timetable-page-grid', cls: 'tt-big' })}</section>`;
  h += `<section class="card" aria-labelledby="tp-l"><h2 id="tp-l" class="h3">${t('tp.list')}</h2>${courseTable(d)}</section>`;
  h += `<details class="card no-print" id="det-export"><summary><span class="h3">${t('tp.text')}</span></summary>
    <p class="note">${t('tp.textNote')}</p><label class="sr" for="exp-text">${t('tp.text')}</label>
    <textarea id="exp-text" class="export" readonly rows="10">${esc(exportText(d))}</textarea></details>`;
  return h;
}

// ---------------------------------------------------------------------------
// View: Durumum
// ---------------------------------------------------------------------------
function seg(c) {
  const cur = state.profile.status[c.code] || 'none';
  const opts = c.kind === 'slot' ? ['none', 'passed'] : ['none', 'passed', 'failed'];
  return (
    `<fieldset class="seg"><legend class="sr">${esc(c.label)} — ${t('status.legend')}</legend>` +
    opts
      .map(
        (o) =>
          `<input class="sr" type="radio" name="st-${c.code}" id="st-${c.code}-${o}" value="${o}" data-chg="status" data-code="${c.code}" data-testid="status-${c.code}-${o}"${cur === o ? ' checked' : ''}>` +
          `<label for="st-${c.code}-${o}" class="seg-${o}">${o === 'passed' ? ic('check') : o === 'failed' ? ic('x') : ''}${t('st.' + o)}</label>`,
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
  s += ` <span class="art">${t('art')} ${limits.article}</span>`;
  s += `<br><span class="muted">${t('band.rule')}</span>`;
  if (limits.reason === 'noCgpa') s += `<br><span class="muted">${t('band.unknownHint')}</span>`;
  if (p.graduating || p.semestersCompleted >= 8) s += `<br><span class="muted">${t('band.noMin')}</span>`;
  return s;
}

function viewStatus(d) {
  const p = state.profile;
  const st = p.status;
  const passedEcts = DATA.semesters.reduce((n, s) => n + s.courses.reduce((m, c) => m + (st[c.code] === 'passed' ? c.ects : 0), 0), 0);
  let h = `<header class="page-head"><p class="crumb">${t('nav.status')}</p><h1 id="view-title" tabindex="-1">${t('status.title')}</h1><p class="lead">${t('status.lead')}</p></header>`;

  h += `<section class="card" aria-labelledby="prof-t"><div class="card-head"><h2 id="prof-t" class="h3">${t('status.profile')}</h2>
      <div class="btns"><button type="button" class="btn btn-small" id="btn-sample" data-act="sample" data-testid="profile-load-sample">${t('first.sample')}</button>
      <button type="button" class="btn btn-small btn-danger" id="btn-reset" data-act="reset" data-testid="profile-reset">${t('status.reset')}</button></div></div>
    <p class="small muted">${t('first.note')}</p>
    <div class="fields">
      <div class="field"><label for="f-cgpa">${t('status.cgpa')}</label>
        <input id="f-cgpa" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00 – 4.00" value="${p.cgpa === null || p.cgpa === undefined ? '' : esc(p.cgpa)}" data-inp="cgpa" data-testid="profile-cgpa" aria-describedby="band-line"></div>
      <div class="field"><label for="f-sem">${t('status.semesters')}</label>
        <input id="f-sem" type="number" min="0" max="20" step="1" value="${esc(p.semestersCompleted)}" data-inp="semesters" data-testid="profile-semesters" aria-describedby="band-line"></div>
      <div class="field field-check"><input id="f-grad" type="checkbox" data-chg="graduating" data-testid="profile-graduating"${p.graduating ? ' checked' : ''}>
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
        <h2 id="sem-${s.n}" class="h3">${t('semester', { n: s.n })} <span class="count">${t('status.semProgress', { n: done, total: s.ects })}${failed ? ' · ' + t('status.semFailed', { n: failed }) : ''}</span></h2>
        <div class="btns"><button type="button" class="btn btn-small" id="sem-pass-${s.n}" data-act="sem-pass" data-sem="${s.n}" data-testid="sem-pass-${s.n}">${t('status.markAll')}</button>
        <button type="button" class="btn btn-small btn-ghost" id="sem-clear-${s.n}" data-act="sem-clear" data-sem="${s.n}" data-testid="sem-clear-${s.n}">${t('status.clear')}</button></div></div>
      <ul class="rows">${s.courses.map(statusRow).join('')}</ul></section>`;
  }

  const takenEl = DATA.electives.filter((c) => st[c.code]).length;
  h += `<details class="card" id="det-electives"${takenEl || state.openElectives ? ' open' : ''}><summary><span class="h3">${t('status.electives')}</span> <span class="count">${t('status.electivesCount', { n: takenEl })}</span></summary>
    <p class="note">${t('status.electivesNote')}</p>
    <ul class="rows">${DATA.electives.map(statusRow).join('')}</ul></details>`;

  h += `<div class="next"><a class="btn btn-primary" href="#register">${t('next.register')}${ic('arrow')}</a></div>`;
  return h;
}

// ---------------------------------------------------------------------------
// View: Kurallar ve Kaynaklar
// ---------------------------------------------------------------------------
function viewRules() {
  const L = state.lang;
  let h = `<header class="page-head"><p class="crumb">${t('nav.rules')}</p><h1 id="view-title" tabindex="-1">${t('rules.title')}</h1><p class="lead">${t('rules.lead')}</p></header>`;
  h += `<section class="card alert" aria-labelledby="dis-t"><h2 id="dis-t" class="h3">${ic('alert')}${t('rules.disTitle')}</h2>
    <ul class="bul">${['d1', 'd2', 'd3', 'd4', 'd5'].map((k) => `<li>${t('rules.' + k)}</li>`).join('')}</ul></section>`;
  h += `<section class="card" aria-labelledby="rl-t"><h2 id="rl-t" class="h3">${t('rules.listTitle')}</h2><ul class="rules">`;
  for (const r of RULES) h += `<li><span class="art">${t('art')} ${r.art}</span><span>${esc(r[L])}</span></li>`;
  h += `</ul><p class="note">${t('rules.limitNote')}</p><p class="note">${esc(OBSERVED[L])}</p></section>`;
  h += `<section class="card" aria-labelledby="src-t"><h2 id="src-t" class="h3">${t('rules.srcTitle')}</h2><p>${t('rules.collected', { date: META.collected, term: esc(term()) })}</p><ul class="bul">`;
  for (const s of META.sources) h += `<li>${t('rules.src.' + s.id)}<br><a href="${esc(s.url)}" rel="noopener noreferrer" target="_blank" class="url">${esc(s.url)}</a></li>`;
  h += `<li>${t('rules.src.timetable')}</li></ul></section>`;
  h += `<section class="card" aria-labelledby="gap-t"><h2 id="gap-t" class="h3">${t('rules.gapTitle')}</h2><ul class="bul">${['g1', 'g2', 'g3', 'g4', 'g5'].map((k) => `<li>${t('rules.' + k)}</li>`).join('')}</ul></section>`;
  return h;
}

// ---------------------------------------------------------------------------
// Dialog: Otomatik program önerisi (exact search over all section combinations)
// ---------------------------------------------------------------------------
function suggestCandidates(d) {
  const locked = d.selected.filter((c) => d.plan.auto.includes(c));
  const list = [...d.selected];
  for (const c of d.plan.auto) if (!list.includes(c)) list.push(c);
  for (const o of d.plan.optional) if (o.group === 'elective' && o.cat === 'eligible' && !list.includes(o.code)) list.push(o.code);
  return { list, locked };
}

let sgCache = { key: null, val: null };
function suggestResult(d) {
  const codes = suggestCandidates(d).list.filter((c) => ui.sg.include.includes(c));
  const key = JSON.stringify([codes, state.prefs, state.profile.status]);
  if (sgCache.key === key) return sgCache.val;
  const items = E.buildItems(codes, DATA, {});
  const res = E.searchPlans(items, state.prefs, { keep: 200 });
  let explain = null;
  if (!res.total && items.length) {
    const keep = {};
    for (const it of items) {
      const c = course(it.code);
      keep[it.code] = d.plan.locked.includes(it.code) ? 3 : c.type === 'Z' ? 2 : 1;
    }
    explain = E.explainNoSolution(items, { keep });
  }
  const val = { codes, items, res, explain, ects: E.ectsSummary(codes, state.profile, DATA).total };
  sgCache = { key, val };
  return val;
}

function miniGrid(blocks, hue) {
  const { days, lo, hi } = layoutDays(blocks);
  let h = `<div class="mini" aria-hidden="true" style="--days:${days.length};--rows:${hi - lo + 1}">`;
  h += days.map((dd, i) => `<span class="mini-d" style="grid-column:${i + 1}">${t('day.' + dd)}</span>`).join('');
  h += days.map((dd, i) => `<span class="mini-bg" style="grid-column:${i + 1};grid-row:2 / span ${hi - lo + 1}"></span>`).join('');
  for (const b of blocks) {
    const col = days.indexOf(b.d) + 1;
    h += `<span class="mini-b" style="--h:${hue[b.code]};grid-column:${col};grid-row:${b.from - lo + 2} / span ${b.to - b.from + 1}"></span>`;
  }
  return h + `</div>`;
}

function planCard(i, sg, entry, hue) {
  const m = entry.metrics;
  const blocks = [];
  const secs = [];
  sg.items.forEach((it, k) => {
    const o = it.options[entry.plan[k]];
    if (o.untimed) return;
    secs.push(`${esc(lbl(it.code))} ${t('secShort')} ${o.nos.join('/')}`);
    for (const r of E.mergeSlots(o.slots)) blocks.push({ ...r, code: it.code });
  });
  return `<li class="plan" data-testid="plan-card-${i + 1}"><div class="plan-top"><h3 class="plan-t">${t('sg.planN', { n: i + 1 })}</h3>${i === 0 ? `<span class="pill pill-ok">${ic('check')}<span>${t('sg.best')}</span></span>` : ''}</div>
    ${miniGrid(blocks, hue)}
    <dl class="plan-m"><div><dt>${t('sg.days')}</dt><dd>${m.campusDays}</dd></div><div><dt>${t('sg.gaps')}</dt><dd>${m.gaps}</dd></div>
    <div><dt>${t('sg.first')}</dt><dd>${m.first === null ? '—' : E.slotStart(m.first)}</dd></div><div><dt>${t('sg.weekend')}</dt><dd>${m.weekendDays ? t('sg.weekendN', { n: m.weekendLessons }) : t('sg.weekendFree')}</dd></div></dl>
    <p class="plan-secs small">${secs.join(' · ')}</p>
    <button type="button" class="btn btn-primary btn-block" data-act="use-plan" data-i="${i}" data-testid="plan-use-${i + 1}" id="use-${i + 1}">${t('sg.use')}<span class="sr"> — ${t('sg.planN', { n: i + 1 })}</span></button></li>`;
}

function explainHtml(sg, locked) {
  const ex = sg.explain;
  let h = `<section class="notice notice-bad nosol" data-testid="suggest-nosolution" aria-labelledby="nosol-t">${ic('alert')}<div><h3 id="nosol-t">${t('nosol.title')}</h3>`;
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
  if (ex.recommended) {
    const c = course(ex.recommended);
    const kind = t('role.' + E.courseRole(c.code, state.profile, DATA));
    h += `<p><strong>${t('nosol.suggest')}</strong> ${t('nosol.drop', { code: esc(c.label), kind, ects: c.ects, n: ex.plansAfter })}</p>`;
    if (!locked.includes(c.code)) h += `<div class="btns"><button type="button" class="btn btn-primary" data-act="sg-drop" data-code="${c.code}" data-testid="suggest-drop-${c.code}" id="sg-drop-${c.code}">${t('nosol.dropBtn', { code: esc(c.label) })}</button></div>`;
    else h += `<p class="small">${t('nosol.lockedDrop')}</p>`;
    const others = ex.singleDrops.slice(1);
    if (others.length) h += `<p class="small">${t('nosol.others', { codes: esc(codeList(others)) })}</p>`;
    if (state.profile.status[ex.recommended] === 'failed' && c.type === 'Z') h += `<p class="small">${t('nosol.repeatWarn')}</p>`;
  } else if (ex.pairDrops.length) {
    h += `<p><strong>${t('nosol.suggest')}</strong> ${t('nosol.dropTwo')}</p><ul class="bul">${ex.pairDrops.map((p) => `<li>${esc(lbl(p[0]))} + ${esc(lbl(p[1]))}</li>`).join('')}</ul>`;
  } else {
    h += `<p>${t('nosol.many')}</p>`;
  }
  return h + '</div></section>';
}

function renderSuggest() {
  const dlg = $('#dlg-suggest');
  if (!dlg.open || !ui.sg) return;
  const d = derive();
  const { list, locked } = suggestCandidates(d);
  const sg = suggestResult(d);
  const hue = hueMap([...d.selected, ...sg.codes.filter((c) => !d.selected.includes(c))]);
  let h = `<div class="dlg-head"><h2 id="sg-title">${ic('grid')}${t('sg.title')}</h2>
    <button type="button" class="icon-btn" data-act="close-dlg" data-dlg="dlg-suggest" data-testid="suggest-close" id="sg-close" aria-label="${ta(t('dlg.close'))}">${ic('x')}</button></div>
    <div class="dlg-body"><p class="note">${t('sg.lead')}</p>
    <div class="sg-cols"><fieldset class="sg-courses"><legend class="h4">${t('sg.include')}</legend>`;
  const item = (code) => {
    const c = course(code);
    const isL = locked.includes(code);
    const on = ui.sg.include.includes(code);
    const role = E.courseRole(code, state.profile, DATA);
    return `<li><input type="checkbox" id="sgc-${code}" data-chg="sg-course" data-code="${code}" data-testid="suggest-course-${code}"${on ? ' checked' : ''}${isL ? ' disabled aria-describedby="sg-locked-note"' : ''}>
      <label for="sgc-${code}"><strong>${esc(c.label)}</strong> <span class="small">${cname(c)}</span> <span class="small muted">· ${c.ects} ${t('ects')} · ${t('role.' + role)}${isL ? ` · ${ic('lock')}${t('sg.lockedShort')}` : ''}</span></label></li>`;
  };
  const opt = list.filter((c) => !locked.includes(c));
  const optOn = opt.filter((c) => ui.sg.include.includes(c)).length;
  h += `<ul>${locked.map(item).join('')}</ul>`;
  if (opt.length) {
    h += `<details class="sg-opt" id="sg-opt"${ui.sg.openMore || optOn ? ' open' : ''}><summary data-testid="suggest-more-courses">${t('sg.optional', { n: opt.length })}${optOn ? ` <span class="count">${t('sg.optionalOn', { n: optOn })}</span>` : ''}</summary><ul>${opt.map(item).join('')}</ul></details>`;
  }
  h += `<p class="small muted" id="sg-locked-note">${t('sg.lockedNote')}</p></fieldset>
    <fieldset class="sg-prefs"><legend class="h4">${t('schedule.prefs')}</legend><ul class="prefs">`;
  for (const k of PREF_KEYS) {
    h += `<li><input type="checkbox" id="pref-${k}" data-chg="pref" data-pref="${k}" data-testid="suggest-pref-${k}"${state.prefs[k] ? ' checked' : ''}><label for="pref-${k}">${t('pref.' + k)}</label></li>`;
  }
  const over = sg.ects > d.limits.max;
  h += `</ul><p class="small ${over ? 'txt-bad' : 'muted'}">${t('sg.ects', { n: sg.ects, max: d.limits.max })}</p></fieldset></div>`;

  const total = sg.res.total;
  h += `<p class="sg-count" data-testid="suggest-count" data-total="${total}" role="status">${total ? t(total === 1 ? 'sg.count1' : 'sg.countN', { n: total.toLocaleString(state.lang === 'tr' ? 'tr-TR' : 'en-GB') }) : ''}${total > sg.res.best.length ? ' ' + t('schedule.capped', { n: sg.res.best.length }) : ''}${sg.res.truncated ? ' ' + t('schedule.truncated') : ''}</p>`;
  if (!sg.items.length) h += `<p class="empty">${t('sg.none')}</p>`;
  else if (!total) h += explainHtml(sg, locked);
  else {
    const shown = sg.res.best.slice(0, ui.sg.show);
    h += `<ol class="plans">${shown.map((e, i) => planCard(i, sg, e, hue)).join('')}</ol>`;
    if (sg.res.best.length > shown.length) {
      h += `<div class="btns center-btns"><button type="button" class="btn" data-act="sg-more" data-testid="suggest-more" id="sg-more">${t('sg.more', { n: shown.length, total: sg.res.best.length })}</button></div>`;
    }
  }
  h += `</div>`;
  const active = document.activeElement && dlg.contains(document.activeElement) ? document.activeElement.id : null;
  $('#sg-inner').innerHTML = h;
  dlg.setAttribute('aria-labelledby', 'sg-title');
  if (active) {
    const el = document.getElementById(active);
    if (el) el.focus({ preventScroll: true });
  }
}

function openSuggest(opener) {
  const d = derive();
  ui.sg = { include: [...d.selected], show: PAGE };
  openDialog('dlg-suggest', opener);
  renderSuggest();
  const first = $('#sg-opt > summary') || $('#use-1') || $('#sg-close');
  if (first) first.focus();
}

function usePlan(i) {
  const d = derive();
  const sg = suggestResult(d);
  const entry = sg.res.best[i];
  if (!entry) return;
  state.added = sg.codes.filter((c) => !d.plan.auto.includes(c));
  state.dropped = d.plan.auto.filter((c) => !sg.codes.includes(c) && !d.plan.locked.includes(c));
  sg.items.forEach((it, k) => {
    const o = it.options[entry.plan[k]];
    if (o.untimed) return;
    const prev = state.picks[it.code];
    state.picks[it.code] = o.nos.includes(prev) ? prev : o.nos[0];
  });
  state.reg = 'draft';
  ui.focus = null;
  closeDialog('dlg-suggest');
  render();
  say(t('msg.planUsed', { n: i + 1 }));
}

// ---------------------------------------------------------------------------
// Dialog: Kaydı tamamla (summary + pre-flight checklist + simulated sending)
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
      const v = { total: ch.sum.total, max: ch.limits.max, band: t('band.' + ch.limits.band), over: ch.sum.total - ch.limits.max };
      const parts = [ch.overTotal ? t('chk.ects.over', v) : t('chk.ects.ok', v)];
      if (ch.limits.reason === 'noCgpa') parts.push(t('band.unknownHint'));
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

function summaryData(d) {
  const feasible = E.isFeasible(E.buildItems(d.selected, DATA, d.sections));
  const checks = E.preflight({ selected: d.selected, profile: state.profile, data: DATA, feasible });
  const fails = checks.filter((c) => c.state === 'fail').length;
  const warns = checks.filter((c) => c.state === 'warn').length;
  const canSend = !fails && !d.missing.length && d.selected.length > 0 && state.reg !== 'pending';
  return { checks, fails, warns, canSend };
}

function renderSummary() {
  const dlg = $('#dlg-summary');
  if (!dlg.open) return;
  const d = derive();
  const s = summaryData(d);
  const sym = { pass: 'check', fail: 'x', warn: 'alert' };
  let h = `<div class="dlg-head"><h2 id="sm-title">${ic('book')}${t('sm.title')}</h2>
    <button type="button" class="icon-btn" data-act="close-dlg" data-dlg="dlg-summary" data-testid="summary-close" id="sm-close" aria-label="${ta(t('dlg.close'))}">${ic('x')}</button></div>
    <div class="dlg-body"><p class="small muted">${esc(DEMO_STUDENT.name)} (${t('demo.fictional')}) · ${esc(term())} · ${t('semN', { n: d.plan.semester })} · ${regStatusBadge('summary-reg-status')}</p>`;
  if (ui.sent && state.reg === 'pending') {
    h += `<div class="notice notice-ok sent" data-testid="summary-sent" role="status">${ic('send')}<div><h3 id="sm-sent-t" tabindex="-1">${t('sm.sentTitle')}</h3><p>${t('sm.sentText', { advisor: esc(DEMO_STUDENT.advisor) })}</p></div></div>`;
  }
  if (d.missing.length) h += `<div class="notice notice-warn" role="note" data-testid="summary-missing">${ic('alert')}<p>${t('sm.missing', { codes: esc(codeList(d.missing)) })}</p></div>`;
  h += courseTable(d, 'summary');
  const verdict = s.fails ? 'fail' : s.warns ? 'warn' : 'pass';
  h += `<h3 class="h4">${t('check.listTitle')}</h3><p class="verdict verdict-${verdict}" data-testid="summary-verdict" data-state="${verdict}">${ic(sym[verdict])}${s.fails ? t('check.verdictFail', { n: s.fails }) : s.warns ? t('check.verdictWarn', { n: s.warns }) : t('check.verdictPass', { n: s.checks.length })}</p><ul class="checks">`;
  for (const ch of s.checks) {
    h += `<li class="check check-${ch.state}" data-testid="check-${ch.id}" data-state="${ch.state}"><span class="mark mark-${ch.state}">${ic(sym[ch.state])}</span>
      <div><p class="check-t"><span class="state">${t('state.' + ch.state)}</span> ${t('chk.' + ch.id + '.title')} <span class="art">${t('art')} ${ch.article}</span></p>
      <p class="check-d">${checkDetail(ch)}</p></div></li>`;
  }
  h += `</ul><p class="small muted sim-note">${ic('info')}${t('sm.simNote')}</p></div>
    <div class="dlg-foot">
      <button type="button" class="btn" data-act="close-dlg" data-dlg="dlg-summary" data-testid="summary-back" id="sm-back">${state.reg === 'pending' ? t('dlg.close') : t('sm.back')}</button>
      ${state.reg === 'pending'
        ? `<button type="button" class="btn" data-act="png" data-testid="summary-png" id="sm-png">${ic('download')}${t('act.png')}</button>`
        : `<button type="button" class="btn btn-primary" data-act="send" data-testid="send-to-advisor" id="send-to-advisor"${s.canSend ? '' : ' disabled aria-describedby="sm-why"'}>${ic('send')}${t('sm.send')}</button>`}
    </div>${!s.canSend && state.reg !== 'pending' ? `<p class="small txt-bad dlg-why" id="sm-why">${t('sm.cannot')}</p>` : ''}`;
  const active = document.activeElement && dlg.contains(document.activeElement) ? document.activeElement.id : null;
  $('#sm-inner').innerHTML = h;
  if (active) {
    const el = document.getElementById(active);
    if (el) el.focus({ preventScroll: true });
  }
}

function openSummary(opener) {
  ui.sent = false;
  openDialog('dlg-summary', opener);
  renderSummary();
  const btn = $('#send-to-advisor:not([disabled])') || $('#sm-close');
  if (btn) btn.focus();
}

function sendToAdvisor() {
  const d = derive();
  if (!summaryData(d).canSend) return;
  state.reg = 'pending';
  state.sentAt = new Date().toISOString();
  ui.sent = true;
  ui.focus = null;
  render();
  renderSummary();
  const h = $('#sm-sent-t');
  if (h) h.focus();
  say(t('msg.sent'));
}

// ---------------------------------------------------------------------------
// Dialog helpers (native <dialog>: focus stays inside, Escape closes)
// ---------------------------------------------------------------------------
function openDialog(id, opener) {
  const dlg = $('#' + id);
  const op = opener || document.activeElement;
  ui.openers[id] = op && op.dataset ? op.dataset.testid || op.id || null : null;
  if (!dlg.open) dlg.showModal();
  raiseCaption();
}

/** Keep the demo caption above modal dialogs: a popover shown last sits on top of the top layer. */
function raiseCaption() {
  const el = $('#demo-caption');
  if (!el.showPopover || !el.classList.contains('is-on')) return;
  if (el.matches(':popover-open')) el.hidePopover();
  el.showPopover();
}

// Every close goes through closeDialog (buttons, Escape, backdrop), so state is cleaned
// up and focus returns to the opener right away, without waiting for the 'close' event.
function closeDialog(id) {
  const dlg = $('#' + id);
  if (!dlg.open) return;
  dlg.close();
  afterClose(id);
}

function afterClose(id) {
  if (id === 'dlg-suggest') ui.sg = null;
  if (id === 'dlg-summary') ui.sent = false;
  if (!(id in ui.openers)) return;
  const key = ui.openers[id];
  delete ui.openers[id];
  const el = key && (document.querySelector(`[data-testid="${key}"]`) || document.getElementById(key));
  if (el && !el.disabled) el.focus({ preventScroll: true });
  else $('#main').focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
// Exports: text, print, PNG
// ---------------------------------------------------------------------------
function exportText(d) {
  const L = [`${t('exp.title')} — ${term()} — ${program()}`, `${DEMO_STUDENT.name} (${t('demo.fictional')}) — ${t('reg.' + state.reg)}`, ''];
  for (const code of d.selected) {
    const c = course(code);
    const role = t('role.' + E.courseRole(code, state.profile, DATA));
    const tail = ` — ${c.ects} ${t('ects')} — ${cnamePlain(c)} [${role}]`;
    const no = d.sections[code];
    if (c.sectionsNotLoaded) L.push(`${code}(?) — ${t('exp.notLoaded')}${tail}`);
    else if (!E.needsSection(code, DATA)) L.push(`${code} — ${t('exp.noTimetable')}${tail}`);
    else if (no === undefined) L.push(`${code}(?) — ${t('exp.noSection')}${tail}`);
    else {
      const sec = sectionOf(code, no);
      L.push(`${code}(${no}) — ${times(sec.slots)} — ${sec.room}${tail}`);
    }
  }
  L.push('', t('exp.total', { n: d.sum.total, max: d.limits.max, band: t('band.' + d.limits.band) }), t('exp.foot'));
  return L.join('\n');
}

async function copyText() {
  const text = exportText(derive());
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch (err) {
    try {
      const tmp = document.createElement('textarea');
      tmp.value = text;
      tmp.setAttribute('readonly', '');
      tmp.style.position = 'fixed';
      tmp.style.opacity = '0';
      document.body.appendChild(tmp);
      tmp.select();
      ok = document.execCommand('copy');
      tmp.remove();
    } catch (err2) {
      ok = false;
    }
  }
  const msg = ok ? t('msg.copied') : t('msg.copyFailed');
  const out = $('#copy-msg');
  if (out) out.textContent = msg;
  say(msg);
}

function renderPrintArea(d) {
  $('#print-area').innerHTML = `<h1>Kayıt Pilotu — ${t('nav.timetable')}</h1>
    <p>${esc(DEMO_STUDENT.name)} (${t('demo.fictional')}) · ${esc(term())} · ${esc(program())} · ${t('reg.' + state.reg)}</p>
    ${gridHtml(chosenBlocks(d), d.hue, { testid: 'print-grid', cls: 'tt-print' })}${courseTable(d, 'print')}
    <p class="small">${t('foot.disclaimer')} ${t('foot.data', { date: META.collected })}</p>`;
}

function drawPng(d) {
  const S = 2; // pixel density
  const W = 1200;
  const pad = 40;
  const blocks = chosenBlocks(d);
  const { days, lo, hi } = layoutDays(blocks);
  const rows = hi - lo + 1;
  const timeW = 64;
  const headH = 28;
  const rowH = 38;
  const colW = (W - pad * 2 - timeW) / days.length;
  const listRowH = 28;
  const gridTop = pad + 92;
  const gridH = headH + rows * rowH;
  const listTop = gridTop + gridH + 36;
  const H = listTop + 30 + Math.max(1, d.selected.length) * listRowH + 40 + 56;
  const cv = document.createElement('canvas');
  cv.width = W * S;
  cv.height = H * S;
  const g = cv.getContext('2d');
  g.scale(S, S);
  const font = (w, px) => `${w} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  const fit = (text, maxW) => {
    let s = String(text);
    if (g.measureText(s).width <= maxW) return s;
    while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  };
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  // Header
  g.fillStyle = '#23587d';
  g.beginPath();
  g.roundRect ? g.roundRect(pad, pad, 44, 44, 10) : g.rect(pad, pad, 44, 44);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = font(700, 17);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('KP', pad + 22, pad + 23);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#1b2330';
  g.font = font(700, 24);
  g.fillText(`Kayıt Pilotu — ${t('nav.timetable')}`, pad + 58, pad + 20);
  g.font = font(400, 14);
  g.fillStyle = '#566173';
  g.fillText(fit(`${DEMO_STUDENT.name} (${t('demo.fictional')}) · ${term()} · ${program()}`, W - pad * 2 - 58 - 230), pad + 58, pad + 42);
  // Status badge
  const badge = t('reg.' + state.reg);
  g.font = font(600, 13);
  const bw = g.measureText(badge).width + 24;
  g.fillStyle = state.reg === 'pending' ? '#e3eef6' : '#fbf0d4';
  g.beginPath();
  g.roundRect ? g.roundRect(W - pad - bw, pad + 8, bw, 28, 14) : g.rect(W - pad - bw, pad + 8, bw, 28);
  g.fill();
  g.fillStyle = state.reg === 'pending' ? '#23587d' : '#7a5200';
  g.fillText(badge, W - pad - bw + 12, pad + 27);
  // Grid
  g.font = font(600, 13);
  g.fillStyle = '#566173';
  days.forEach((dd, i) => {
    g.textAlign = 'center';
    g.fillText(t('dayLong.' + dd), pad + timeW + colW * i + colW / 2, gridTop + 18);
  });
  g.textAlign = 'right';
  g.font = font(500, 12);
  for (let r = 0; r < rows; r++) {
    const y = gridTop + headH + r * rowH;
    g.fillStyle = r % 2 ? '#f7f8fa' : '#eef1f5';
    g.fillRect(pad + timeW, y, colW * days.length, rowH);
    g.fillStyle = '#566173';
    g.fillText(E.slotStart(lo + r), pad + timeW - 8, y + 16);
  }
  g.strokeStyle = '#d5dbe4';
  g.lineWidth = 1;
  for (let i = 0; i <= days.length; i++) {
    const x = pad + timeW + colW * i + 0.5;
    g.beginPath();
    g.moveTo(x, gridTop + headH);
    g.lineTo(x, gridTop + gridH);
    g.stroke();
  }
  g.textAlign = 'left';
  for (const dd of days) {
    const list = assignLanes(blocks.filter((b) => b.d === dd));
    const di = days.indexOf(dd);
    for (const b of list) {
      const hue = d.hue[b.code];
      const w = colW / b.lanes;
      const x = pad + timeW + colW * di + w * b.lane + 2;
      const y = gridTop + headH + (b.from - lo) * rowH + 2;
      const bh = (b.to - b.from + 1) * rowH - 4;
      const bw2 = w - 4;
      g.fillStyle = b.kind === 'clash' ? '#fbe6e6' : `hsl(${hue} 70% 91%)`;
      g.fillRect(x, y, bw2, bh);
      g.fillStyle = b.kind === 'clash' ? '#a3282d' : `hsl(${hue} 55% 40%)`;
      g.fillRect(x, y, 4, bh);
      g.fillStyle = `hsl(${hue} 50% 18%)`;
      g.font = font(700, 13);
      g.fillText(fit(lbl(b.code), bw2 - 14), x + 10, y + 17);
      if (bh > 34) {
        g.font = font(400, 12);
        g.fillText(fit(`${t('secShort')} ${b.nos.join('/')} · ${b.room}`, bw2 - 14), x + 10, y + 33);
      }
      if (bh > 52) g.fillText(fit(`${E.slotStart(b.from)}–${E.slotEnd(b.to)}`, bw2 - 14), x + 10, y + 49);
    }
  }
  // Course list
  const cols = [pad, pad + 70, pad + 180, W - pad - 260, W - pad - 60];
  g.font = font(700, 16);
  g.fillStyle = '#1b2330';
  g.fillText(t('tp.list'), pad, listTop - 6);
  g.font = font(600, 12);
  g.fillStyle = '#566173';
  [t('secShort'), t('tbl.code'), t('tbl.name'), t('tbl.type'), t('ects')].forEach((s, i) => g.fillText(s, cols[i], listTop + 18));
  g.strokeStyle = '#9aa5b5';
  g.beginPath();
  g.moveTo(pad, listTop + 26.5);
  g.lineTo(W - pad, listTop + 26.5);
  g.stroke();
  d.selected.forEach((code, i) => {
    const c = course(code);
    const y = listTop + 30 + i * listRowH + 19;
    const no = d.sections[code];
    g.fillStyle = `hsl(${d.hue[code]} 55% 45%)`;
    g.fillRect(cols[0], y - 11, 10, 10);
    g.fillStyle = '#1b2330';
    g.font = font(400, 13);
    g.fillText(no === undefined ? (E.needsSection(code, DATA) ? '?' : '—') : String(no), cols[0] + 18, y);
    g.font = font(700, 13);
    g.fillText(c.label, cols[1], y);
    g.font = font(400, 13);
    g.fillText(fit(cnamePlain(c), cols[3] - cols[2] - 12), cols[2], y);
    g.fillText(t('role.' + E.courseRole(code, state.profile, DATA)), cols[3], y);
    g.fillText(String(c.ects), cols[4], y);
  });
  const totY = listTop + 30 + Math.max(1, d.selected.length) * listRowH + 26;
  g.strokeStyle = '#d5dbe4';
  g.beginPath();
  g.moveTo(pad, totY - 18.5);
  g.lineTo(W - pad, totY - 18.5);
  g.stroke();
  g.font = font(700, 14);
  g.fillStyle = '#1b2330';
  g.fillText(`${t('tbl.total')}: ${d.sum.total} / ${d.limits.max} ${t('ects')} (${t('art')} ${d.limits.article})`, pad, totY);
  g.font = font(400, 11);
  g.fillStyle = '#566173';
  g.fillText(fit(t('png.foot', { date: META.collected }), W - pad * 2), pad, H - 28);
  return cv;
}

function downloadPng() {
  const url = drawPng(derive()).toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kayit-pilotu-program.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  say(t('msg.png'));
  return url;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render({ focusTitle = false } = {}) {
  const activeEl = document.activeElement;
  const active = activeEl && $('#main').contains(activeEl) ? activeEl.id : null;
  const d = derive();
  let html;
  if (view === 'home') html = viewHome(d);
  else if (view === 'register') html = viewRegister(d);
  else if (view === 'timetable') html = viewTimetable(d);
  else if (view === 'status') html = viewStatus(d);
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
function profileChanged() {
  state.hasProfile = true;
  if (state.reg === 'pending') {
    state.reg = 'draft';
    say(t('msg.backToDraft'));
  }
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

function setNav(open, { returnFocus = false } = {}) {
  ui.navOpen = open;
  document.body.classList.toggle('nav-open', open);
  const tog = $('#nav-toggle');
  tog.setAttribute('aria-expanded', String(open));
  tog.setAttribute('aria-label', open ? t('nav.close') : t('nav.open'));
  if (open) {
    const a = $('#nav a[aria-current]') || $('#nav a');
    if (a) a.focus();
  } else if (returnFocus) tog.focus();
}

/** In the one-column layout the grid sits below the course lists: bring it into view. */
function revealGrid() {
  const card = $('.tt-card');
  if (!card || !window.matchMedia('(max-width: 1240px)').matches) return;
  const r = card.getBoundingClientRect();
  if (r.top < 60 || r.top > window.innerHeight * 0.6) card.scrollIntoView({ block: 'start' });
}

function pick(code, no) {
  if (isLocked()) return;
  const d = derive();
  const others = d.chosen.filter((c) => c.code !== code);
  const x = E.sectionConflicts(code, others, DATA).find((y) => y.option.nos.includes(no));
  if (!x) return;
  if (x.clashes.length) {
    say(`${t('blk.locked')}: ${clashText(x.clashes[0].code, x.clashes[0].shared)}`);
    return;
  }
  state.picks[code] = no;
  const d2 = derive();
  ui.focus = d2.missing.find((c) => c !== code) || null;
  render();
  say(t('msg.picked', { code: lbl(code), no }) + (ui.focus ? ' ' + t('msg.nextCourse', { code: lbl(ui.focus) }) : ''));
  const target = ui.focus ? $('#picker-t') : document.getElementById('focus-' + code);
  if (target) target.focus({ preventScroll: true });
}

document.addEventListener('click', (e) => {
  const dlg = e.target.closest('dialog');
  if (dlg && e.target === dlg) {
    // click on the backdrop
    closeDialog(dlg.id);
    return;
  }
  const el = e.target.closest('[data-act]');
  if (!el) {
    if (e.target.closest('#nav a') && ui.navOpen) setNav(false);
    return;
  }
  const act = el.dataset.act;
  const code = el.dataset.code;
  if (el.getAttribute('aria-disabled') === 'true') {
    if (act === 'pick') pick(code, Number(el.dataset.no)); // announces the reason
    return;
  }
  switch (act) {
    case 'skip':
      e.preventDefault();
      $('#main').focus();
      return;
    case 'nav':
      setNav(!ui.navOpen);
      return;
    case 'nav-close':
      setNav(false, { returnFocus: true });
      return;
    case 'lang':
      state.lang = el.dataset.lang === 'en' ? 'en' : 'tr';
      break;
    case 'sample': {
      const lang = state.lang;
      state = withSample(fresh());
      state.lang = lang;
      ui.focus = null;
      say(t('msg.sampleLoaded'));
      break;
    }
    case 'reset': {
      if (!window.confirm(t('status.resetConfirm'))) return;
      const lang = state.lang;
      state = fresh();
      state.lang = lang;
      state.hasProfile = true;
      ui.focus = null;
      say(t('msg.reset'));
      break;
    }
    case 'sem-pass':
    case 'sem-clear': {
      const sem = DATA.semesters.find((s) => s.n === Number(el.dataset.sem));
      for (const c of sem.courses) setStatus(c.code, act === 'sem-pass' ? 'passed' : 'none');
      profileChanged();
      break;
    }
    case 'focus':
      if (isLocked()) return;
      ui.focus = ui.focus === code && el.closest('.crow') ? null : code;
      render();
      if (ui.focus && el.closest('.crow')) {
        revealGrid();
        const pt = $('#picker-t');
        // keyboard users continue in the section list; mouse users see the grid update
        if (e.detail === 0 && pt) pt.focus({ preventScroll: true });
      }
      return;
    case 'unfocus':
      ui.focus = null;
      break;
    case 'pick':
      pick(code, Number(el.dataset.no));
      return;
    case 'remove':
      if (isLocked()) return;
      if (state.added.includes(code)) state.added = state.added.filter((c) => c !== code);
      else if (!state.dropped.includes(code)) state.dropped.push(code);
      if (ui.focus === code) ui.focus = null;
      say(t('msg.removed', { code: lbl(code) }));
      break;
    case 'readd':
      if (isLocked()) return;
      state.dropped = state.dropped.filter((c) => c !== code);
      say(t('msg.added', { code: lbl(code) }));
      break;
    case 'add':
      if (isLocked()) return;
      if (!state.added.includes(code)) state.added.push(code);
      state.dropped = state.dropped.filter((c) => c !== code);
      ui.focus = E.needsSection(code, DATA) && E.optionsFor(code, DATA).length > 1 ? code : ui.focus;
      say(t('msg.added', { code: lbl(code) }));
      render();
      if (ui.focus === code) revealGrid();
      return;
    case 'unlock':
      state.reg = 'draft';
      state.sentAt = null;
      say(t('msg.backToDraft'));
      break;
    case 'suggest':
      if (isLocked()) return;
      openSuggest(el);
      return;
    case 'complete':
      openSummary(el);
      return;
    case 'send':
      sendToAdvisor();
      return;
    case 'close-dlg':
      closeDialog(el.dataset.dlg);
      return;
    case 'use-plan':
      usePlan(Number(el.dataset.i));
      return;
    case 'sg-more':
      ui.sg.show += PAGE;
      renderSuggest();
      return;
    case 'sg-drop':
      ui.sg.include = ui.sg.include.filter((c) => c !== code);
      ui.sg.show = PAGE;
      renderSuggest();
      say(t('msg.removed', { code: lbl(code) }));
      return;
    case 'png':
      downloadPng();
      return;
    case 'copy':
      copyText();
      return;
    case 'print':
      window.print();
      return;
    default:
      return;
  }
  render();
  renderSuggest();
  renderSummary();
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
    profileChanged();
  } else if (chg === 'graduating') {
    state.profile.graduating = el.checked;
    profileChanged();
  } else if (chg === 'pref') {
    state.prefs[el.dataset.pref] = el.checked;
    if (ui.sg) ui.sg.show = PAGE;
    save();
    renderSuggest();
    return;
  } else if (chg === 'sg-course') {
    const code = el.dataset.code;
    ui.sg.include = ui.sg.include.filter((c) => c !== code);
    if (el.checked) ui.sg.include.push(code);
    ui.sg.show = PAGE;
    renderSuggest();
    return;
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
  profileChanged();
  const d = derive();
  const line = $('#band-line');
  if (line) line.innerHTML = bandLine(d.limits);
  save();
});

document.addEventListener('toggle', (e) => {
  if (e.target.id === 'det-electives') state.openElectives = e.target.open;
  if (e.target.id === 'det-others') state.openOthers = e.target.open;
  if (e.target.id === 'sg-opt' && ui.sg) ui.sg.openMore = e.target.open;
}, true);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.navOpen && !document.querySelector('dialog[open]')) setNav(false, { returnFocus: true });
});

for (const id of ['dlg-suggest', 'dlg-summary']) {
  const dlg = $('#' + id);
  dlg.addEventListener('cancel', (e) => {
    // Escape
    e.preventDefault();
    closeDialog(id);
  });
  dlg.addEventListener('close', () => { if (!dlg.open) afterClose(id); }); // safety net for any other close
}

window.addEventListener('hashchange', () => {
  const v = viewFromHash();
  if (ui.navOpen) setNav(false);
  if (v === view) return;
  view = v;
  render({ focusTitle: true });
});

// ---------------------------------------------------------------------------
// Demo hooks for screen recordings (?demo=1)
// ---------------------------------------------------------------------------
if (DEMO) document.documentElement.classList.add('is-demo');

window.kpDemo = {
  /** Show a subtitle-style caption at the bottom of the viewport; null hides it. */
  caption(text) {
    const el = $('#demo-caption');
    if (text === null || text === undefined || text === '') {
      el.classList.remove('is-on');
      el.setAttribute('aria-hidden', 'true');
      if (el.hidePopover && el.matches(':popover-open')) el.hidePopover();
      return;
    }
    el.textContent = String(text);
    el.removeAttribute('aria-hidden');
    el.classList.add('is-on');
    raiseCaption();
  },
  /** Restore the fictional sample student and clear the registration (keeps the language and the page). */
  reset() {
    const lang = state.lang;
    for (const id of ['dlg-suggest', 'dlg-summary']) closeDialog(id);
    state = withSample(fresh());
    state.lang = lang;
    ui.focus = null;
    ui.sg = null;
    ui.sent = false;
    if (ui.navOpen) setNav(false);
    render();
  },
  /** Read-only snapshot for assertions in the recording script. */
  state() {
    const d = derive();
    return {
      view,
      lang: state.lang,
      selected: [...d.selected],
      sections: { ...d.sections },
      missingSections: [...d.missing],
      clashes: d.clashes.map((p) => [p.a, p.b]),
      totalEcts: d.sum.total,
      maxEcts: d.limits.max,
      regStatus: state.reg,
    };
  },
  /** The PNG export as a data URL (same drawing as the download button). */
  pngDataUrl() {
    return drawPng(derive()).toDataURL('image/png');
  },
};

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
