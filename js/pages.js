// UI for the student-assistant pages: dashboard extras, catalogue, registration-day plan,
// attendance, grades, calendar, graduation roadmap, OBS import and the comparison page.
// All logic lives in the pure modules; this file only turns their results into HTML and
// handles the events of these pages. `c` is the context object built in app.js.
import { DATA } from './data.js';
import * as E from './engine.js';
import { CALENDAR, CLASS_TERM, EXTRA_META } from './data-extra.js';
import * as U from './util.js';
import * as A from './attendance.js';
import * as G from './grades.js';
import * as CAL from './calendar.js';
import * as ICS from './ics.js';
import * as IMP from './importer.js';
import * as K from './catalog.js';
import * as PL from './plan.js';
import * as R from './roadmap.js';

const DEADLINE_KINDS = ['registration', 'adddrop', 'withdraw', 'payment', 'exams', 'grades', 'objection', 'twoCourse'];
const EXAM_KINDS = ['midterm', 'quiz', 'final', 'makeup', 'other'];
export const LETTER_CHOICES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D'];

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------
const head = (c, crumb, title, lead) => `<header class="page-head"><p class="crumb">${crumb}</p>
  <h1 id="view-title" tabindex="-1">${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</header>`;
const crumbOf = (c, group, page) => `${c.t(group)} <span aria-hidden="true">›</span> ${c.t(page)}`;

export const demoTag = (c, testid = 'demo-tag') => `<span class="demo-tag" data-testid="${testid}">${c.ic('flask')}${c.t('demo.tag')}</span>`;

function relText(c, e) {
  if (e.state === 'past') return c.t('rel.past');
  if (e.state === 'ongoing') return e.daysLeft === 0 ? c.t('rel.endsToday') : c.t('rel.ongoing', { n: e.daysLeft });
  if (e.daysUntil === 0) return c.t('rel.today');
  if (e.daysUntil === 1) return c.t('rel.tomorrow');
  return c.t('rel.inDays', { n: e.daysUntil });
}

function dateBadge(c, iso) {
  const p = CAL.parseIso(iso);
  if (!p) return '';
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d));
  const loc = c.locale();
  const mon = d.toLocaleDateString(loc, { month: 'short', timeZone: 'UTC' });
  const wd = d.toLocaleDateString(loc, { weekday: 'short', timeZone: 'UTC' });
  return `<span class="dbadge" aria-hidden="true"><span class="dbadge-m">${c.esc(mon)}</span><span class="dbadge-d">${p.d}</span><span class="dbadge-w">${c.esc(wd)}</span></span>`;
}

function rangeText(c, start, end) {
  if (!end || end === start) return c.fmtDate(start);
  return `${c.fmtDate(start)} – ${c.fmtDate(end)}`;
}

/** Exams entered by the student, as calendar events. */
function examEvents(c) {
  return (c.state.exams || []).map((x) => ({
    id: 'exam-' + x.id,
    start: x.date,
    end: x.date,
    kind: 'exam',
    exam: x,
    en: '',
    tr: '',
  }));
}

function examTitle(c, x) {
  return `${c.t('exam.kind.' + x.kind)}: ${c.lbl(x.code)}`;
}

function eventTitle(c, e) {
  if (e.kind === 'exam') return examTitle(c, e.exam);
  return c.state.lang === 'tr' ? e.tr : e.en;
}

function eventDetail(c, e) {
  if (e.kind !== 'exam') return '';
  const x = e.exam;
  const bits = [];
  if (x.start) bits.push(x.end ? `${x.start}–${x.end}` : x.start);
  if (x.room) bits.push(x.room);
  return bits.join(' · ');
}

// ---------------------------------------------------------------------------
// Attendance helpers (shared by the dashboard and the attendance page)
// ---------------------------------------------------------------------------
function attFor(c, code) {
  const course = c.course(code);
  const lim = course && course.tul ? A.attendanceLimits(course.tul) : null;
  const used = (c.state.att || {})[code] || {};
  if (!lim) return { code, lim: null };
  const t = A.attendanceStatus(A.cleanUsed(used.t), lim.theoryAllowed);
  const p = A.attendanceStatus(A.cleanUsed(used.p), lim.practiceAllowed);
  return { code, lim, t, p, worst: A.worstState(t.state, p.state) };
}

// ---------------------------------------------------------------------------
// Dashboard: "Needs your attention", mini timetable, next dates, graduation card
// ---------------------------------------------------------------------------
export function roadmapFor(c) {
  const key = JSON.stringify([c.state.profile, c.state.expLetter]);
  if (c.cache.road && c.cache.road.key === key) return c.cache.road.val;
  const val = R.earliestPlan(c.state.profile, DATA, { gp: G.GP[c.state.expLetter] });
  c.cache.road = { key, val };
  return val;
}

export function attentionItems(c, d) {
  const out = [];
  const st = c.state;
  if (d.plan.locked.length) out.push({ id: 'retake', tone: 'warn', href: '#register', text: c.t('att.retake', { codes: c.esc(c.codeList(d.plan.locked)) }) });
  if (d.clashes.length) out.push({ id: 'clash', tone: 'bad', href: '#register', text: c.t('att.clash', { codes: c.esc(d.clashes.map((p) => `${c.lbl(p.a)} / ${c.lbl(p.b)}`).join(', ')) }) });
  if (d.missing.length) out.push({ id: 'sections', tone: 'warn', href: '#register', text: c.t('att.sections', { codes: c.esc(c.codeList(d.missing)) }) });
  const feasible = !d.clashes.length;
  for (const ch of E.preflight({ selected: d.selected, profile: st.profile, data: DATA, feasible })) {
    if (ch.id === 'overlap' && (d.clashes.length || d.missing.length)) continue;
    if (ch.state === 'fail') out.push({ id: 'check-' + ch.id, tone: 'bad', href: '#register', text: c.t('att.checkFail', { check: c.t('chk.' + ch.id + '.title'), art: ch.article }) });
  }
  if (st.reg === 'draft' && d.selected.length) out.push({ id: 'draft', tone: 'info', href: '#register', text: c.t('att.draft') });
  for (const code of d.selected) {
    const a = attFor(c, code);
    if (!a.lim || !['warn', 'last', 'over'].includes(a.worst)) continue;
    const part = A.worstState(a.t.state, a.p.state) === a.t.state && a.t.state !== 'none' && a.t.state !== 'ok' ? 't' : 'p';
    const s = a[part];
    out.push({ id: 'abs-' + code, tone: a.worst === 'warn' ? 'warn' : 'bad', href: '#attendance', demo: !!(st.demo && st.demo.att), text: c.t('att.abs.' + a.worst, { code: c.esc(c.lbl(code)), kind: c.t('abs.' + part).toLowerCase(), used: c.num(s.used, 0), allowed: c.num(s.allowed, 1) }) });
  }
  if (U.isNum(st.profile.cgpa) && st.profile.cgpa < 2) out.push({ id: 'probation', tone: 'warn', href: '#roadmap', text: c.t('att.probation', { cgpa: c.num(st.profile.cgpa, 2) }) });
  for (const e of CAL.upcoming(examEvents(c), c.TODAY, { withinDays: 14 })) {
    out.push({ id: e.id, tone: 'warn', href: '#calendar', text: c.t('att.exam', { title: c.esc(eventTitle(c, e)), when: relText(c, e), date: c.fmtDate(e.start) }) });
  }
  for (const e of CAL.upcoming(CALENDAR, c.TODAY, { withinDays: 21 })) {
    const deadline = DEADLINE_KINDS.includes(e.kind);
    if (!deadline && e.daysUntil > 14) continue;
    out.push({ id: 'cal-' + e.id, tone: deadline ? 'warn' : 'info', href: '#calendar', text: c.t('att.cal', { title: c.esc(eventTitle(c, e)), when: relText(c, e), date: c.esc(rangeText(c, e.start, e.end)) }) });
  }
  const rank = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

export function dashExtras(c, d) {
  const items = attentionItems(c, d);
  const toneIc = { bad: 'alert', warn: 'alert', info: 'info' };
  let att = `<section class="card dash-att" aria-labelledby="att-t" data-testid="attention-card"><div class="card-head"><h2 id="att-t" class="h3">${c.ic('bell')}${c.t('dash.attention')} <span class="count">${items.length}</span></h2></div>`;
  if (!items.length) att += `<p class="empty" data-testid="attention-empty">${c.ic('check')} ${c.t('dash.attentionNone')}</p>`;
  else {
    att += `<ul class="att-list" data-testid="attention-list">${items.map((it) => `<li class="att-item att-${it.tone}" data-testid="attention-item-${it.id}">
      <span class="att-dot">${c.ic(toneIc[it.tone])}</span><p>${it.text}${it.demo ? ` <span class="demo-inline">(${c.t('demo.tag').toLowerCase()})</span>` : ''}</p>
      <a class="btn btn-small" href="${it.href}" data-testid="attention-go-${it.id}">${c.t('dash.go')}${c.ic('arrow')}<span class="sr"> — ${c.esc(stripTags(it.text))}</span></a></li>`).join('')}</ul>`;
  }
  att += `</section>`;

  const blocks = c.chosenBlocks(d);
  const tt = `<section class="card dash-tt" aria-labelledby="dtt-t"><div class="card-head"><h2 id="dtt-t" class="h3">${c.ic('calendar')}${c.t('dash.timetable')}</h2><a class="btn btn-small btn-ghost" href="#timetable" data-testid="dash-open-timetable">${c.t('dash.open')}${c.ic('arrow')}</a></div>
    ${blocks.length ? c.gridHtml(blocks, d.hue, { testid: 'dash-mini-tt', cls: 'tt-mini' }) : `<p class="empty">${c.t('dash.noTimetable')}</p>`}
    ${d.missing.length ? `<p class="small muted">${c.t('tp.missing', { codes: c.esc(c.codeList(d.missing)) })}</p>` : ''}</section>`;

  const next = CAL.upcoming([...CALENDAR, ...examEvents(c)], c.TODAY).slice(0, 5);
  const dates = `<section class="card dash-dates" aria-labelledby="dd-t" data-testid="dash-next-dates"><div class="card-head"><h2 id="dd-t" class="h3">${c.ic('event')}${c.t('dash.dates')}</h2><a class="btn btn-small btn-ghost" href="#calendar" data-testid="dash-open-calendar">${c.t('dash.open')}${c.ic('arrow')}</a></div>
    <p class="small muted">${c.t('dash.today', { date: c.fmtDate(c.TODAY, true) })}</p>
    ${next.length ? `<ul class="dates">${next.map((e) => `<li class="date-item kind-${e.kind}">${dateBadge(c, e.start)}<div><p class="date-t">${c.esc(eventTitle(c, e))}</p><p class="small muted">${c.esc(rangeText(c, e.start, e.end))} · ${relText(c, e)}</p></div></li>`).join('')}</ul>` : `<p class="empty">${c.t('dash.noDates')}</p>`}
    <p class="small muted">${c.t('dash.datesSource')}</p></section>`;
  return { att, tt, dates };
}

export function graduationCard(c) {
  const r = roadmapFor(c);
  let body;
  if (r.alreadyDone) body = `<p class="metric metric-sm">${c.t('rm.allDone')}</p>`;
  else if (!r.graduation) body = `<p class="metric metric-sm">—</p><p class="small txt-warn">${c.t('rm.unscheduledShort', { n: r.unscheduled.length })}</p>`;
  else body = `<p class="metric metric-sm" data-testid="dash-graduation">${c.esc(c.termLabel(r.graduation))}</p><p class="small muted">${c.t('rm.termsLeft', { n: r.terms.length })}${r.proven ? ' · ' + c.t('rm.provenShort') : ''}</p>`;
  return `<section class="card dcard" data-testid="card-graduation" aria-labelledby="c-gr"><h2 id="c-gr" class="dcard-t">${c.ic('flag')}${c.t('dash.graduation')}</h2>${body}
    <a class="btn btn-small" href="#roadmap" data-testid="dash-open-roadmap">${c.t('dash.roadmap')}${c.ic('arrow')}</a></section>`;
}

const stripTags = (s) => String(s).replace(/<[^>]*>/g, '');

// ---------------------------------------------------------------------------
// Course catalogue
// ---------------------------------------------------------------------------
export const CAT_DEFAULT = { q: '', type: 'all', sem: 'all', offered: false, eligible: false, hidePassed: false };

function prereqLine(c, code) {
  const groups = DATA.prereqs[code] || [];
  if (!groups.length) return `<span class="muted">${c.t('cat.noPrereq')}</span>`;
  const ev = E.evalPrereq(code, E.passedSet(c.state.profile), DATA.prereqs);
  if (ev.ok) return `<span class="txt-ok">${c.ic('check')}${c.t('cat.prereqMet', { list: c.esc(c.missingText(groups)) })}</span>`;
  return `<span class="txt-bad">${c.ic('lock')}${c.t('cat.prereqMissing', { list: c.esc(c.missingText(ev.missing)) })}</span>`;
}

function unlocksLine(c, code) {
  const u = K.unlocks(code, DATA.prereqs);
  const known = u.all.filter((x) => DATA.courseMap[x]);
  if (!known.length) return '';
  const direct = u.direct.filter((x) => DATA.courseMap[x]);
  const indirect = known.filter((x) => !direct.includes(x));
  return `<p class="cat-unlocks">${c.ic('key')}<span>${c.t('cat.unlocks')} <strong>${c.esc(c.codeList(direct))}</strong>${indirect.length ? ` ${c.t('cat.thenAlso', { codes: c.esc(c.codeList(indirect)) })}` : ''}</span></p>`;
}

function catStatus(c, code, cat) {
  const map = {
    passed: ['ok', 'check', 'cat.st.passed'],
    repeat: ['warn', 'alert', 'cat.st.repeat'],
    eligible: ['info', 'check', 'cat.st.eligible'],
    noData: ['warn', 'info', 'cat.st.noData'],
    blocked: ['bad', 'lock', 'cat.st.blocked'],
    notOffered: ['muted', 'minus', 'cat.st.notOffered'],
  };
  const [tone, icon, key] = map[cat] || ['muted', 'minus', 'cat.st.notOffered'];
  return `<span class="pill pill-${tone}" data-testid="catalogue-status-${code}" data-state="${cat}">${c.ic(icon)}<span>${c.t(key)}</span></span>`;
}

/** Add button / state for a course (catalogue rows and the detail drawer). */
function addControl(c, d, code, where) {
  const cls = E.classify(c.state.profile, DATA)[code];
  if (d.selected.includes(code)) return `<span class="pill pill-ok">${c.ic('check')}<span>${c.t('cat.inReg')}</span></span>`;
  const addable = d.plan.auto.includes(code) || d.plan.optional.some((o) => o.code === code && E.SELECTABLE.has(o.cat));
  if (addable && c.state.reg !== 'pending') {
    return `<button type="button" class="btn btn-small btn-primary" data-act="cat-add" data-code="${code}" data-testid="${where}-add-${code}" id="${where}-add-${code}">${c.ic('plus')}${c.t('cat.add')}<span class="sr"> — ${c.esc(c.lbl(code))}</span></button>`;
  }
  if (addable) return `<span class="small muted">${c.t('cat.lockedPending')}</span>`;
  const why = cls.cat === 'passed' ? 'cat.why.passed' : cls.cat === 'blocked' ? 'cat.why.blocked' : cls.cat === 'notOffered' ? 'cat.why.notOffered' : 'cat.why.other';
  return `<span class="small muted">${c.t(why)}</span>`;
}

function catRow(c, d, course, cls) {
  const code = course.code;
  const n = (DATA.sectionsByCourse[code] || []).length;
  const meta = [course.semester ? c.t('semN', { n: course.semester }) : c.t('cat.pool')];
  if (course.tul) meta.push(`T+U+L ${course.tul}`);
  meta.push(c.secCountText(code));
  if (n && DATA.sectionsByCourse[code].every((s) => s.online)) meta.push(c.t('online'));
  const type = course.kind === 'elective' ? 'elective' : course.code === 'ME4830' ? 'internship' : 'compulsory';
  return `<li class="cat-row" data-testid="catalogue-row-${code}">
    <div class="cat-main"><p class="crow-top"><strong class="code">${c.esc(course.label)}</strong><span class="badge badge-${type}">${c.t('role.' + type)}</span>${catStatus(c, code, cls.cat === 'slot' ? 'notOffered' : cls.cat)}<span class="ects">${course.ects} ${c.t('ects')}</span></p>
    <p class="name">${c.cname(course)}</p>
    <p class="cat-meta muted">${meta.map((x) => c.esc(x)).join(' · ')}</p>
    <p class="cat-pre small">${prereqLine(c, code)}</p>${unlocksLine(c, code)}</div>
    <div class="cat-act"><button type="button" class="btn btn-small" data-act="cat-detail" data-code="${code}" data-testid="catalogue-detail-${code}" id="cat-detail-${code}">${c.ic('info')}${c.t('cat.details')}<span class="sr"> — ${c.esc(course.label)}</span></button>${addControl(c, d, code, 'catalogue')}</div></li>`;
}

export function catalogueList(c, d) {
  const f = c.ui.cat;
  const list = K.filterCourses(DATA, c.state.profile, f);
  const cls = E.classify(c.state.profile, DATA);
  const rows = list.map((course) => catRow(c, d, course, cls[course.code])).join('');
  return `<p class="cat-count" role="status" data-testid="catalogue-count">${c.t('cat.count', { n: list.length })}</p>
    ${list.length ? `<ul class="cat-list">${rows}</ul>` : `<p class="empty">${c.t('cat.none')}</p>`}`;
}

export function viewCatalogue(c, d) {
  const f = c.ui.cat;
  const opt = (v, label, cur) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${label}</option>`;
  let h = head(c, crumbOf(c, 'nav.group', 'nav.catalogue'), c.t('nav.catalogue'), c.t('cat.lead', { term: c.esc(c.term()) }));
  h += `<form class="card filters" role="search" aria-label="${c.ta(c.t('cat.filters'))}" data-testid="catalogue-filters" id="cat-form">
    <div class="field field-grow"><label for="cat-q">${c.t('cat.search')}</label>
      <input id="cat-q" type="search" autocomplete="off" placeholder="${c.ta(c.t('cat.searchPh'))}" value="${c.ta(f.q)}" data-inp="cat-q" data-testid="catalogue-search"></div>
    <div class="field"><label for="cat-type">${c.t('cat.type')}</label><select id="cat-type" data-chg="cat" data-key="type" data-testid="catalogue-type">
      ${opt('all', c.t('cat.all'), f.type)}${opt('compulsory', c.t('role.compulsory'), f.type)}${opt('elective', c.t('role.elective'), f.type)}</select></div>
    <div class="field"><label for="cat-sem">${c.t('cat.semester')}</label><select id="cat-sem" data-chg="cat" data-key="sem" data-testid="catalogue-sem">
      ${opt('all', c.t('cat.all'), f.sem)}${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => opt(n, c.t('semN', { n }), f.sem)).join('')}${opt('pool', c.t('cat.pool'), f.sem)}</select></div>
    <div class="checks-row">
      <label class="chk"><input type="checkbox" id="cat-offered" data-chg="cat" data-key="offered" data-testid="catalogue-offered"${f.offered ? ' checked' : ''}>${c.t('cat.offered')}</label>
      <label class="chk"><input type="checkbox" id="cat-eligible" data-chg="cat" data-key="eligible" data-testid="catalogue-eligible"${f.eligible ? ' checked' : ''}>${c.t('cat.eligible')}</label>
      <label class="chk"><input type="checkbox" id="cat-hide" data-chg="cat" data-key="hidePassed" data-testid="catalogue-hide-passed"${f.hidePassed ? ' checked' : ''}>${c.t('cat.hidePassed')}</label>
      <button type="button" class="btn btn-small btn-ghost" data-act="cat-reset" data-testid="catalogue-reset" id="cat-reset">${c.ic('undo')}${c.t('cat.reset')}</button>
    </div></form>`;
  h += `<p class="note">${c.t('cat.note')}</p>`;
  h += `<section class="card" aria-labelledby="cat-res-t"><h2 id="cat-res-t" class="sr">${c.t('cat.results')}</h2><div id="cat-list">${catalogueList(c, d)}</div></section>`;
  return h;
}

export function courseDrawer(c, d, code) {
  const course = c.course(code);
  if (!course) return '';
  const cls = E.classify(c.state.profile, DATA)[code];
  const passed = E.passedSet(c.state.profile);
  let h = `<div class="dlg-head"><h2 id="cd-title">${c.ic('book')}<span>${c.esc(course.label)} — ${c.cname(course)}</span></h2>
    <button type="button" class="icon-btn" data-act="close-dlg" data-dlg="dlg-course" data-testid="course-drawer-close" id="cd-close" aria-label="${c.ta(c.t('dlg.close'))}">${c.ic('x')}</button></div><div class="dlg-body">`;
  h += `<dl class="facts"><div><dt>${c.t('ects')}</dt><dd>${course.ects}</dd></div><div><dt>T+U+L</dt><dd>${course.tul ? c.esc(course.tul) : `<span class="muted">${c.t('cat.noTul')}</span>`}</dd></div>
    <div><dt>${c.t('cat.semester')}</dt><dd>${course.semester ? c.t('semN', { n: course.semester }) : c.t('cat.pool')}</dd></div><div><dt>${c.t('cat.status')}</dt><dd>${catStatus(c, code, cls.cat === 'slot' ? 'notOffered' : cls.cat)}</dd></div></dl>
    <div class="btns">${addControl(c, d, code, 'drawer')}</div>`;

  // Prerequisite chain
  const chain = K.requiresChain(code, DATA.prereqs, DATA.courseMap);
  h += `<h3 class="h4">${c.t('cd.requires')}</h3>`;
  if (!chain.length) h += `<p class="small muted">${c.t('cat.noPrereq')}</p>`;
  else {
    h += `<ul class="chain">${chain.map((lvl) => `<li><strong>${c.esc(c.lbl(lvl.code))}</strong> ${c.t('cd.needs')} ${lvl.groups.map((g) => {
      const ok = g.some((o) => passed.has(o));
      return `<span class="chip ${ok ? 'chip-ok' : 'chip-bad'}">${c.ic(ok ? 'check' : 'x')}${c.esc(g.map((o) => c.lbl(o)).join(' / '))}</span>`;
    }).join(` ${c.t('and')} `)}</li>`).join('')}</ul>`;
  }
  const u = K.unlocks(code, DATA.prereqs);
  h += `<h3 class="h4">${c.t('cd.unlocks')}</h3>${u.all.length ? `<p class="small">${c.t('cd.unlocksDirect')} <strong>${c.esc(c.codeList(u.direct))}</strong>${u.all.length > u.direct.length ? `<br>${c.t('cd.unlocksAll')} ${c.esc(c.codeList(u.all.filter((x) => !u.direct.includes(x))))}` : ''}</p>` : `<p class="small muted">${c.t('cd.unlocksNone')}</p>`}`;

  // Assessment
  const sch = G.ASSESSMENTS[code];
  h += `<h3 class="h4">${c.t('cd.assessment')}</h3>`;
  if (!sch) h += `<p class="small muted">${c.t('gr.noScheme')}</p>`;
  else {
    h += `<div class="table-wrap"><table class="ctable" data-testid="drawer-assessment"><caption class="sr">${c.t('cd.assessment')}</caption><thead><tr><th scope="col">${c.t('gr.item')}</th><th scope="col" class="num">${c.t('gr.count')}</th><th scope="col" class="num">${c.t('gr.weight')}</th></tr></thead><tbody>
      ${sch.items.map((it) => `<tr><td>${c.t('item.' + it.name)}</td><td class="num">${it.count}</td><td class="num">${it.weight}%</td></tr>`).join('')}</tbody>
      <tfoot><tr><th scope="row" colspan="2">${c.t('tbl.total')}</th><td class="num">${sch.total}%</td></tr></tfoot></table></div>`;
    if (!sch.complete) h += `<p class="notice notice-warn small">${c.ic('alert')}<span>${c.t('gr.incompleteDrawer', { n: sch.total })}</span></p>`;
  }
  // Attendance
  const lim = course.tul ? A.attendanceLimits(course.tul) : null;
  h += `<h3 class="h4">${c.t('cd.attendance')}</h3>`;
  h += lim ? `<p class="small">${c.t('cd.attLine', { th: lim.theoryHours, ta: c.num(lim.theoryAllowed, 1), ph: lim.practiceHours, pa: c.num(lim.practiceAllowed, 1) })} <span class="art">${c.t('art')} 29(2)</span></p>` : `<p class="small muted">${c.t('abs.noTul')}</p>`;
  // Sections
  const secs = DATA.sectionsByCourse[code] || [];
  h += `<h3 class="h4">${c.t('cd.sections', { term: c.esc(c.term()) })}</h3>`;
  if (!secs.length) h += `<p class="small muted">${course.sectionsNotLoaded ? c.t('cst.notLoaded') : course.noTimetable ? c.t('noTimetable') : c.t('cst.notOffered')}</p>`;
  else {
    h += `<div class="table-wrap"><table class="ctable"><caption class="sr">${c.t('cd.sections', { term: c.esc(c.term()) })}</caption><thead><tr><th scope="col">${c.t('secShort')}</th><th scope="col">${c.t('cd.times')}</th><th scope="col">${c.t('cd.room')}</th><th scope="col" class="num">${c.t('cd.cap')}</th></tr></thead><tbody>
      ${secs.map((s) => `<tr><td>${s.no}</td><td>${c.times(s.slots)}</td><td>${c.esc(s.room)}${s.online ? ' · ' + c.t('online') : ''}</td><td class="num">${s.cap}</td></tr>`).join('')}</tbody></table></div>
      <p class="small muted">${c.t('plan.capNote')}</p>`;
  }
  return h + `</div>`;
}

// ---------------------------------------------------------------------------
// Registration-day plan
// ---------------------------------------------------------------------------
export function regdayData(c, d) {
  const st = c.state;
  const key = JSON.stringify([d.selected, st.picks, st.full, st.prefs]);
  if (c.cache.rd && c.cache.rd.key === key) return c.cache.rd.val;
  const a = PL.planA(d.selected, st.picks, DATA, st.prefs);
  let val = { a, order: [], repair: null, backups: { plans: [], total: 0, blocked: [] }, untimed: d.selected.filter((x) => !E.needsSection(x, DATA)) };
  if (a.ok) {
    const fullInA = Object.keys(a.sections).filter((code) => PL.isFull(st.full, code, a.sections[code]));
    val.order = PL.entryOrder(a.sections, DATA, st.full);
    val.fullInA = fullInA;
    if (fullInA.length) val.repair = PL.repairPlan(d.selected, a.sections, DATA, st.full, st.prefs);
    val.backups = PL.backupPlans(d.selected, a.sections, DATA, st.full, st.prefs, 2);
  }
  c.cache.rd = { key, val };
  return val;
}

function regTarget(c) {
  const st = c.state;
  const custom = CAL.parseLocalDateTime(st.regAt);
  const ev = CAL.nextOfKind(CALENDAR, 'registration', c.TODAY);
  return { custom, ev };
}

export function countdownText(c) {
  const { custom, ev } = regTarget(c);
  if (custom) {
    const p = CAL.parseIso(custom.date);
    const [hh, mm] = custom.time.split(':').map(Number);
    const target = new Date(p.y, p.m - 1, p.d, hh, mm).getTime();
    const cd = CAL.countdown(target, c.now().getTime());
    if (!cd) return '';
    if (cd.past) return c.t('rd.cdPast');
    return c.t('rd.cdLeft', { d: cd.days, h: cd.hours, m: cd.minutes });
  }
  if (!ev) return c.t('rd.cdNone');
  if (ev.state === 'ongoing') return c.t('rd.cdOpen');
  return c.t('rd.cdDays', { n: ev.daysUntil });
}

function secTimes(c, code, no) {
  const s = (DATA.sectionsByCourse[code] || []).find((x) => x.no === no);
  return s ? c.times(s.slots) : '';
}

function planCardRd(c, d, label, tag, sections, { testid, useAct = null, changed = [], full = [], metrics = null } = {}) {
  const codes = Object.keys(sections);
  const blocks = [];
  for (const code of codes) {
    const s = (DATA.sectionsByCourse[code] || []).find((x) => x.no === sections[code]);
    if (s) for (const r of E.mergeSlots(s.slots)) blocks.push({ ...r, code });
  }
  const hue = c.hueMap([...d.selected]);
  return `<li class="plan rd-plan" data-testid="${testid}"><div class="plan-top"><h3 class="plan-t">${label}</h3>${tag}</div>
    ${c.miniGrid(blocks, hue)}
    ${metrics ? `<p class="small muted">${c.t('rd.metrics', { days: metrics.campusDays, gaps: metrics.gaps })}</p>` : ''}
    <ul class="rd-secs">${codes.map((code) => `<li${changed.includes(code) ? ' class="is-changed"' : ''}><strong>${c.esc(c.lbl(code))}</strong> ${c.t('secShort')} ${sections[code]}${changed.includes(code) ? ` <span class="badge badge-retake">${c.t('rd.changed')}</span>` : ''}${full.includes(code) ? ` <span class="badge badge-full">${c.t('rd.isFull')}</span>` : ''}<br><span class="small muted">${secTimes(c, code, sections[code])}</span></li>`).join('')}</ul>
    ${useAct ? `<button type="button" class="btn btn-block" data-act="${useAct.act}" data-i="${useAct.i}" data-testid="${useAct.testid}" id="${useAct.testid}">${c.t('rd.use')}<span class="sr"> — ${label}</span></button>` : ''}</li>`;
}

export function viewRegday(c, d) {
  const st = c.state;
  const rd = regdayData(c, d);
  let h = head(c, crumbOf(c, 'nav.group', 'nav.regday'), c.t('nav.regday'), c.t('rd.lead'));
  const { ev } = regTarget(c);
  h += `<section class="card" aria-labelledby="rd-when-t"><div class="card-head"><h2 id="rd-when-t" class="h3">${c.ic('clock')}${c.t('rd.when')}</h2></div>
    <p>${ev ? c.t('rd.nextWindow', { title: c.esc(eventTitle(c, ev)), dates: c.esc(rangeText(c, ev.start, ev.end)) }) : c.t('rd.cdNone')}</p>
    <div class="fields"><div class="field"><label for="rd-at">${c.t('rd.at')}</label><input id="rd-at" type="datetime-local" value="${c.ta(st.regAt || '')}" data-chg="rd-at" data-testid="regday-datetime"></div>
    ${st.regAt ? `<button type="button" class="btn btn-small btn-ghost" data-act="rd-at-clear" data-testid="regday-datetime-clear" id="rd-at-clear">${c.ic('x')}${c.t('rd.atClear')}</button>` : ''}</div>
    <p class="countdown" id="rd-countdown" data-testid="regday-countdown" role="timer" aria-live="off">${countdownText(c)}</p>
    <p class="small muted">${c.t('rd.timeNote')}</p></section>`;

  h += `<div class="toolbar no-print" role="toolbar" aria-label="${c.ta(c.t('rd.toolbar'))}">
    <button type="button" class="btn btn-small" data-act="rd-copy" data-testid="regday-copy" id="rd-copy">${c.ic('copy')}${c.t('rd.copy')}</button>
    <button type="button" class="btn btn-small" data-act="print" data-testid="regday-print" id="rd-print">${c.ic('print')}${c.t('rd.print')}</button>
    ${Object.keys(st.full || {}).length ? `<button type="button" class="btn btn-small btn-ghost" data-act="rd-reset-full" data-testid="regday-reset-full" id="rd-reset-full">${c.ic('undo')}${c.t('rd.resetFull')}</button>` : ''}
    <span class="toolbar-sp"></span><span class="small muted">${c.ic('wifiOff')} ${c.t('rd.offline')}</span><span id="copy-msg" class="small" role="status"></span></div>`;

  if (!d.selected.length) return h + `<p class="empty">${c.t('rd.empty')} <a href="#register">${c.t('nav.register')}</a></p>`;
  if (!rd.a.ok) return h + `<div class="notice notice-bad" role="note">${c.ic('alert')}<p>${c.t('rd.noPlan')} <a href="#register">${c.t('nav.register')}</a></p></div>`;
  if (rd.a.source === 'filled') h += `<div class="notice notice-info" role="note">${c.ic('info')}<p>${c.t('rd.filled', { codes: c.esc(c.codeList(rd.a.filled)) })}</p></div>`;
  if (rd.a.source === 'search') h += `<div class="notice notice-warn" role="note">${c.ic('alert')}<p>${c.t('rd.searchFallback')}</p></div>`;

  // Entry order
  h += `<section class="card" aria-labelledby="rd-order-t"><div class="card-head"><h2 id="rd-order-t" class="h3">${c.ic('list')}${c.t('rd.order')}</h2></div>
    <p class="note">${c.t('rd.orderNote')}</p><ol class="steps" data-testid="regday-order">`;
  rd.order.forEach((x, i) => {
    const alts = x.alternatives;
    let alt;
    if (alts.length) {
      const first = alts[0];
      alt = `<p class="step-if">${c.ic('arrow')}<span>${c.t('rd.ifFull', { no: x.no })} <strong>${c.t('rd.switchTo', { no: first.no })}</strong> (${c.times(first.slots)} · ${c.esc(first.room)}${first.sameTime ? ' · ' + c.t('rd.sameTime') : ''})${alts.length > 1 ? ` ${c.t('rd.orAlso', { list: alts.slice(1, 4).map((a) => a.no).join(', ') })}` : ''}</span></p>`;
    } else {
      alt = `<p class="step-if step-none">${c.ic('alert')}<span>${c.t('rd.noAlt', { no: x.no })}</span></p>`;
    }
    h += `<li class="step${x.full ? ' is-full' : ''}" data-testid="regday-step-${x.code}"><span class="step-n" aria-hidden="true">${i + 1}</span><div class="step-b">
      <p class="step-t"><strong>${c.esc(c.lbl(x.code))} · ${c.t('secShort')} ${x.no}</strong> <span class="small">${c.cname(c.course(x.code))}</span>${x.full ? ` <span class="pill pill-bad">${c.ic('x')}<span>${c.t('rd.isFull')}</span></span>` : ''}</p>
      <p class="small muted">${c.times(x.slots)} · ${c.esc(x.room)}${x.online ? ' · ' + c.t('online') : ''} · ${c.t('plan.capacity', { n: x.cap })} · ${c.t('rd.altCount', { n: alts.length })}</p>
      ${alt}
      <button type="button" class="btn btn-small${x.full ? ' is-active' : ''}" data-act="rd-full" data-code="${x.code}" data-no="${x.no}" aria-pressed="${x.full}" data-testid="regday-full-${x.code}-${x.no}" id="rd-full-${x.code}-${x.no}">${c.ic(x.full ? 'undo' : 'ban')}${x.full ? c.t('rd.unmarkFull') : c.t('rd.markFull')}<span class="sr"> — ${c.esc(c.lbl(x.code))} ${c.t('secShort')} ${x.no}</span></button>
      ${alts.filter((a) => PL.isFull(st.full, a.code, a.no)).length ? '' : ''}
    </div></li>`;
  });
  h += `</ol>`;
  if (rd.untimed.length) h += `<p class="small muted">${c.t('rd.untimed', { codes: c.esc(c.codeList(rd.untimed)) })}</p>`;
  h += `<p class="small muted">${c.t('plan.capNote')}</p></section>`;

  // Recomputed plan when a Plan A section is full
  if (rd.repair) {
    h += `<section class="card rd-repair" aria-labelledby="rd-rep-t" data-testid="regday-repair"><h2 id="rd-rep-t" class="h3">${c.ic('refresh')}${c.t('rd.repairTitle')}</h2>`;
    if (rd.repair.ok) {
      h += `<p>${c.t('rd.repairText', { n: rd.repair.changed.length, codes: c.esc(rd.repair.changed.map((x) => `${c.lbl(x)} → ${c.t('secShort')} ${rd.repair.sections[x]}`).join(', ')) })}</p>
        <ul class="plans plans-1">${planCardRd(c, d, c.t('rd.repairPlan'), '', rd.repair.sections, { testid: 'regday-repair-plan', changed: rd.repair.changed, useAct: { act: 'rd-use', i: 'repair', testid: 'regday-use-repair' } })}</ul>`;
    } else if (rd.repair.blocked.length) h += `<div class="notice notice-bad" role="note">${c.ic('alert')}<p>${c.t('rd.blocked', { codes: c.esc(c.codeList(rd.repair.blocked)) })}</p></div>`;
    else h += `<div class="notice notice-bad" role="note">${c.ic('alert')}<p>${c.t('rd.repairNone')}</p></div>`;
    h += `</section>`;
  }

  // Plan A / B / C
  h += `<section aria-labelledby="rd-abc-t"><h2 id="rd-abc-t" class="h3 sec-t">${c.t('rd.abc')}</h2><p class="note">${c.t('rd.abcNote', { n: rd.backups.total.toLocaleString(c.locale()) })}</p><ol class="plans">`;
  h += planCardRd(c, d, c.t('rd.planA'), `<span class="pill pill-ok">${c.ic('check')}<span>${c.t('rd.main')}</span></span>`, rd.a.sections, { testid: 'regday-plan-a', full: rd.fullInA || [] });
  ['B', 'C'].forEach((L, i) => {
    const p = rd.backups.plans[i];
    if (p) h += planCardRd(c, d, c.t('rd.planX', { x: L }), `<span class="pill pill-info"><span>${c.t('rd.backup')}</span></span>`, p.sections, { testid: 'regday-plan-' + L.toLowerCase(), changed: p.changed, metrics: p.metrics, useAct: { act: 'rd-use', i, testid: 'regday-use-' + L.toLowerCase() } });
    else h += `<li class="plan rd-plan plan-empty" data-testid="regday-plan-${L.toLowerCase()}"><h3 class="plan-t">${c.t('rd.planX', { x: L })}</h3><p class="small muted">${rd.backups.blocked.length ? c.t('rd.blocked', { codes: c.esc(c.codeList(rd.backups.blocked)) }) : c.t('rd.noBackup')}</p></li>`;
  });
  h += `</ol></section>`;
  return h;
}

export function regdayText(c, d) {
  const rd = regdayData(c, d);
  const L = [`${c.t('nav.regday')} — ${c.term()} — ${c.demoName()}`];
  const { ev, custom } = regTarget(c);
  if (custom) L.push(`${c.t('rd.at')}: ${custom.date} ${custom.time}`);
  else if (ev) L.push(stripTags(c.t('rd.nextWindow', { title: eventTitle(c, ev), dates: rangeText(c, ev.start, ev.end) })));
  L.push('');
  if (!rd.a.ok) {
    L.push(c.t('rd.noPlan'));
    return L.join('\n');
  }
  L.push(c.t('rd.order') + ':');
  rd.order.forEach((x, i) => {
    L.push(`${i + 1}. ${c.lbl(x.code)} ${c.t('secShort')} ${x.no} — ${c.times(x.slots)} — ${x.room}${x.full ? ' — ' + c.t('rd.isFull') : ''}`);
    if (x.alternatives.length) L.push(`   ${c.t('rd.ifFull', { no: x.no })} ${c.t('rd.switchTo', { no: x.alternatives[0].no })} (${c.times(x.alternatives[0].slots)})`);
    else L.push(`   ${stripTags(c.t('rd.noAlt', { no: x.no }))}`);
  });
  if (rd.untimed.length) L.push(stripTags(c.t('rd.untimed', { codes: c.codeList(rd.untimed) })));
  ['B', 'C'].forEach((X, i) => {
    const p = rd.backups.plans[i];
    if (!p) return;
    L.push('', `${c.t('rd.planX', { x: X })}: ${Object.keys(p.sections).map((code) => `${c.lbl(code)}(${p.sections[code]})`).join(', ')}`);
  });
  L.push('', c.t('plan.capNote'), c.t('exp.foot'));
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
function attPartStatus(c, code, part) {
  const a = attFor(c, code);
  const s = a[part];
  const pct = s.allowed > 0 ? Math.min(100, (s.used / s.allowed) * 100) : 0;
  let msg;
  if (s.state === 'over') msg = c.t('abs.over', { over: c.num(s.used - s.allowed, 1) });
  else if (s.state === 'last') msg = c.t('abs.last');
  else msg = c.t('abs.left', { n: s.wholeLeft, left: c.num(s.left, 1) });
  return `<div class="meter att-meter st-${s.state}" aria-hidden="true"><span style="width:${U.isNum(pct) ? pct : 0}%"></span><i style="left:75%"></i></div>
    <p class="att-msg st-${s.state}">${c.ic(s.state === 'ok' ? 'check' : 'alert')}<span>${c.t('abs.used', { used: c.num(s.used, 0), allowed: c.num(s.allowed, 1) })} · ${msg}</span></p>`;
}

function attBadge(c, a) {
  const tone = { ok: 'ok', warn: 'warn', last: 'bad', over: 'bad', none: 'muted' }[a.worst] || 'muted';
  return `<span class="pill pill-${tone}" data-testid="att-badge-${a.code}" data-state="${a.worst}"><span>${c.t('abs.st.' + a.worst)}</span></span>`;
}

export function viewAttendance(c, d) {
  const st = c.state;
  let h = head(c, crumbOf(c, 'nav.gTerm', 'nav.attendance'), c.t('nav.attendance'), c.t('abs.lead'));
  h += `<div class="toolbar no-print">${st.demo && st.demo.att ? demoTag(c, 'attendance-demo-tag') + `<span class="small muted">${c.t('abs.demoNote')}</span>` : ''}<span class="toolbar-sp"></span>
    ${st.demo && st.demo.att ? `<button type="button" class="btn btn-small" data-act="att-clear-demo" data-testid="attendance-clear-demo" id="att-clear-demo">${c.ic('x')}${c.t('demo.clear')}</button>` : ''}
    <button type="button" class="btn btn-small btn-ghost" data-act="att-reset" data-testid="attendance-reset" id="att-reset">${c.ic('undo')}${c.t('abs.reset')}</button></div>`;
  if (!d.selected.length) return h + `<p class="empty">${c.t('abs.empty')} <a href="#register">${c.t('nav.register')}</a></p>`;
  h += `<div class="att-grid">`;
  for (const code of d.selected) {
    const course = c.course(code);
    const a = attFor(c, code);
    h += `<section class="card att-card" aria-labelledby="ac-${code}" data-testid="att-card-${code}"><div class="card-head"><h2 id="ac-${code}" class="h3"><span class="code">${c.esc(course.label)}</span> <span class="small muted">${c.cname(course)}</span></h2><span id="att-${code}-badge">${a.lim ? attBadge(c, a) : ''}</span></div>`;
    if (!a.lim) {
      const secs = DATA.sectionsByCourse[code] || [];
      const n = secs.length ? secs[0].slots.length : 0;
      h += `<p class="small muted">${n ? c.t('abs.noTulHours', { n }) : c.t('abs.noTul')}</p></section>`;
      continue;
    }
    for (const part of ['t', 'p']) {
      const hours = part === 't' ? a.lim.theoryHours : a.lim.practiceHours;
      if (!hours) continue;
      const weekly = part === 't' ? a.lim.theoryWeekly : a.lim.practiceWeekly;
      const allowed = part === 't' ? a.lim.theoryAllowed : a.lim.practiceAllowed;
      const used = a[part].used;
      const id = `att-${code}-${part}`;
      const lab = `${c.t('abs.' + part)} — ${course.label}`;
      h += `<div class="att-row"><p class="att-k"><strong>${c.t('abs.' + part)}</strong> <span class="small muted">${c.t('abs.hours', { w: weekly, total: hours, allowed: c.num(allowed, 1), whole: A.wholeHours(allowed), pct: part === 't' ? 30 : 20 })}</span></p>
        <div class="stepper"><button type="button" class="icon-btn" data-act="att-step" data-code="${code}" data-part="${part}" data-d="-1" data-testid="${id}-minus" id="${id}-minus" aria-label="${c.ta(c.t('abs.minus', { what: lab }))}"${used <= 0 ? ' disabled' : ''}>${c.ic('minus')}</button>
        <label class="sr" for="${id}">${c.t('abs.usedLabel', { what: lab })}</label><input id="${id}" type="number" inputmode="numeric" min="0" max="${hours}" step="1" value="${used}" data-inp="att" data-code="${code}" data-part="${part}" data-testid="${id}-input">
        <button type="button" class="icon-btn" data-act="att-step" data-code="${code}" data-part="${part}" data-d="1" data-testid="${id}-plus" id="${id}-plus" aria-label="${c.ta(c.t('abs.plus', { what: lab }))}"${used >= hours ? ' disabled' : ''}>${c.ic('plus')}</button><span class="small muted">${c.t('abs.hUsed')}</span></div>
        <div id="${id}-status" aria-live="polite">${attPartStatus(c, code, part)}</div></div>`;
    }
    h += `</section>`;
  }
  h += `</div><p class="note">${c.t('abs.footNote')}</p>`;
  return h;
}

/** Update one attendance row in place (keeps focus in the input / on the button). */
export function refreshAttRow(c, code, part) {
  const box = document.getElementById(`att-${code}-${part}-status`);
  if (box) box.innerHTML = attPartStatus(c, code, part);
  const badge = document.getElementById(`att-${code}-badge`);
  const a = attFor(c, code);
  if (badge && a.lim) badge.innerHTML = attBadge(c, a);
  const hours = part === 't' ? a.lim.theoryHours : a.lim.practiceHours;
  const used = a[part].used;
  const inp = document.getElementById(`att-${code}-${part}`);
  if (inp && document.activeElement !== inp) inp.value = String(used);
  const minus = document.getElementById(`att-${code}-${part}-minus`);
  const plus = document.getElementById(`att-${code}-${part}-plus`);
  if (minus) minus.disabled = used <= 0;
  if (plus) plus.disabled = used >= hours;
}

// ---------------------------------------------------------------------------
// Grades and final calculator
// ---------------------------------------------------------------------------
function gradeResult(c, code) {
  const sch = G.ASSESSMENTS[code];
  const sc = (c.state.grades || {})[code] || {};
  const th = c.state.thresholds;
  if (!sch) return `<p class="small muted">${c.t('gr.noScheme')}</p>`;
  const stg = G.courseStanding(sch, sc);
  const nameList = (idx) => idx.map((i) => c.t('item.' + sch.items[i].name)).join(', ');
  if (stg.status === 'incomplete') {
    return `<div class="notice notice-warn" role="note" data-testid="grade-incomplete-${code}">${c.ic('alert')}<p>${c.t('gr.incomplete', { n: sch.total, rest: 100 - sch.total, pts: c.num(stg.earned, 1), known: stg.knownWeight })}</p></div>`;
  }
  if (stg.status === 'noFinal') {
    const tw = G.totalWithoutFinal(sch, sc, th);
    if (tw.total === null) return `<p class="small" data-testid="grade-result-${code}">${c.t('gr.noFinal')} ${c.t('gr.soFar', { pts: c.num(stg.earned, 1), known: stg.knownWeight })} ${stg.missing.length ? c.t('gr.enterRest', { items: c.esc(nameList(stg.missing)) }) : ''}</p>`;
    return `<p class="gr-total" data-testid="grade-result-${code}">${c.t('gr.noFinal')} <strong>${c.t('gr.total', { pts: c.num(tw.total, 1), letter: tw.letter || '—' })}</strong></p>`;
  }
  const fn = G.finalNeeded(sch, sc, th);
  let h = `<p class="small" data-testid="grade-points-${code}">${c.t('gr.soFar', { pts: c.num(stg.earned, 1), known: stg.knownWeight })} ${c.t('gr.finalIs', { w: sch.finalWeight })}</p>`;
  if (fn.status === 'badThresholds') return h + `<p class="small txt-bad">${c.t('gr.badThresholds')}</p>`;
  if (fn.status === 'missing') return h + `<p class="small muted">${c.t('gr.enterRest', { items: c.esc(nameList(fn.missing)) })}</p>`;
  h += `<div class="table-wrap"><table class="ctable need-table" data-testid="grade-need-${code}"><caption class="sr">${c.t('gr.needCaption', { code: c.esc(c.lbl(code)) })}</caption>
    <thead><tr><th scope="col">${c.t('gr.letter')}</th><th scope="col" class="num">${c.t('gr.threshold')}</th><th scope="col">${c.t('gr.needFinal')}</th></tr></thead><tbody>`;
  for (const r of fn.rows) {
    let cell;
    if (r.state === 'secured') cell = `<span class="txt-ok">${c.ic('check')}${c.t('gr.secured')}</span>`;
    else if (r.state === 'impossible') cell = `<span class="muted">${c.t('gr.impossible')}</span>`;
    else cell = `<span class="need"><span class="need-bar" aria-hidden="true"><span style="width:${r.need}%"></span></span><strong>${c.num(r.need, 1)}</strong></span>`;
    h += `<tr class="need-${r.state}" data-testid="grade-need-${code}-${G.letterKey(r.letter)}"><th scope="row">${r.letter}</th><td class="num">≥ ${c.num(r.threshold, 0)}</td><td>${cell}</td></tr>`;
  }
  return h + `</tbody></table></div>`;
}

function gradeInputs(c, code, sch) {
  const sc = (c.state.grades || {})[code] || {};
  return sch.items.map((it, i) => {
    if (it.isFinal) return `<tr><th scope="row">${c.t('item.Final')}</th><td class="num">${it.weight}%</td><td class="muted small">${c.t('gr.finalRow')}</td></tr>`;
    const n = G.inputsFor(it);
    const vals = sc[i] || [];
    const inputs = Array.from({ length: n }, (_, k) => {
      const v = vals[k];
      const id = `gr-${code}-${i}-${k}`;
      const lab = n === 1 && it.count > 1 ? c.t('gr.avgOf', { n: it.count, item: c.t('item.' + it.name) }) : n > 1 ? `${c.t('item.' + it.name)} ${k + 1}` : c.t('item.' + it.name);
      return `<label class="sr" for="${id}">${c.esc(lab)} — ${c.esc(c.lbl(code))} (0–100)</label><input id="${id}" class="score" type="text" inputmode="decimal" autocomplete="off" placeholder="${n === 1 && it.count > 1 ? c.ta(c.t('gr.avgPh')) : '0–100'}" value="${U.isNum(v) ? c.ta(String(v)) : ''}" data-inp="grade" data-code="${code}" data-i="${i}" data-k="${k}" data-testid="grade-${code}-${i}-${k}">`;
    }).join('');
    const label = `${c.t('item.' + it.name)}${it.count > 1 ? ` <span class="muted small">× ${it.count}${n === 1 ? ' · ' + c.t('gr.avgShort') : ''}</span>` : ''}`;
    return `<tr><th scope="row">${label}</th><td class="num">${it.weight}%</td><td><div class="scores">${inputs}</div></td></tr>`;
  }).join('');
}

export function viewGrades(c, d) {
  const st = c.state;
  let h = head(c, crumbOf(c, 'nav.gTerm', 'nav.grades'), c.t('nav.grades'), c.t('gr.lead'));
  h += `<div class="toolbar no-print">${st.demo && st.demo.grades ? demoTag(c, 'grades-demo-tag') + `<span class="small muted">${c.t('gr.demoNote')}</span>` : ''}<span class="toolbar-sp"></span>
    ${st.demo && st.demo.grades ? `<button type="button" class="btn btn-small" data-act="gr-clear-demo" data-testid="grades-clear-demo" id="gr-clear-demo">${c.ic('x')}${c.t('demo.clear')}</button>` : ''}</div>`;
  const th = st.thresholds;
  h += `<details class="card" id="det-thresholds" data-testid="grades-thresholds"${c.ui.openTh ? ' open' : ''}><summary><span class="h3">${c.t('gr.thTitle')}</span></summary>
    <p class="note">${c.t('gr.thNote')}</p><div class="th-grid">${G.PASS_LETTERS.map((l) => `<div class="field"><label for="th-${G.letterKey(l)}">${l}</label><input id="th-${G.letterKey(l)}" type="text" inputmode="decimal" value="${U.isNum(th[l]) ? th[l] : ''}" data-inp="threshold" data-letter="${l}" data-testid="threshold-${G.letterKey(l)}"></div>`).join('')}</div>
    <p class="small" id="th-msg" role="status">${G.validThresholds(th) ? '' : `<span class="txt-bad">${c.t('gr.badThresholds')}</span>`}</p>
    <button type="button" class="btn btn-small" data-act="th-reset" data-testid="grades-thresholds-reset" id="th-reset">${c.ic('undo')}${c.t('gr.thReset')}</button>
    <p class="small muted">${c.t('gr.scale')}</p></details>`;
  if (!d.selected.length) return h + `<p class="empty">${c.t('gr.empty')} <a href="#register">${c.t('nav.register')}</a></p>`;
  h += `<div class="gr-grid">`;
  for (const code of d.selected) {
    const course = c.course(code);
    const sch = G.ASSESSMENTS[code];
    h += `<section class="card gr-card" aria-labelledby="gc-${code}" data-testid="grade-card-${code}"><div class="card-head"><h2 id="gc-${code}" class="h3"><span class="code">${c.esc(course.label)}</span> <span class="small muted">${c.cname(course)}</span></h2>
      ${sch && !sch.complete ? `<span class="pill pill-warn">${c.ic('alert')}<span>${c.t('gr.incompleteShort', { n: sch.total })}</span></span>` : ''}</div>`;
    if (sch) {
      h += `<div class="table-wrap"><table class="ctable gr-table"><caption class="sr">${c.t('gr.caption', { code: c.esc(course.label) })}</caption><thead><tr><th scope="col">${c.t('gr.item')}</th><th scope="col" class="num">${c.t('gr.weight')}</th><th scope="col">${c.t('gr.yours')}</th></tr></thead>
        <tbody>${gradeInputs(c, code, sch)}</tbody><tfoot><tr><th scope="row">${c.t('tbl.total')}</th><td class="num">${sch.total}%</td><td></td></tr></tfoot></table></div>`;
    }
    h += `<div class="gr-res" id="gr-res-${code}" aria-live="polite">${gradeResult(c, code)}</div></section>`;
  }
  h += `</div><p class="note">${c.t('gr.footNote')}</p>`;
  return h;
}

export function refreshGrade(c, code) {
  const box = document.getElementById('gr-res-' + code);
  if (box) box.innerHTML = gradeResult(c, code);
}

export function refreshAllGrades(c) {
  for (const el of document.querySelectorAll('.gr-res')) el.innerHTML = gradeResult(c, el.id.slice(7));
  const msg = document.getElementById('th-msg');
  if (msg) msg.innerHTML = G.validThresholds(c.state.thresholds) ? '' : `<span class="txt-bad">${c.t('gr.badThresholds')}</span>`;
}

// ---------------------------------------------------------------------------
// Calendar and exams
// ---------------------------------------------------------------------------
export function viewCalendar(c, d) {
  const st = c.state;
  let h = head(c, crumbOf(c, 'nav.gTerm', 'nav.calendar'), c.t('nav.calendar'), c.t('cal.lead'));
  const o = st.icsOpts;
  h += `<section class="card" aria-labelledby="ics-t"><div class="card-head"><h2 id="ics-t" class="h3">${c.ic('download')}${c.t('cal.icsTitle')}</h2></div>
    <p class="note">${c.t('cal.icsNote')}</p><div class="checks-row">
    <label class="chk"><input type="checkbox" data-chg="ics-opt" data-key="official" data-testid="ics-opt-official" id="ics-official"${o.official ? ' checked' : ''}>${c.t('cal.optOfficial')}</label>
    <label class="chk"><input type="checkbox" data-chg="ics-opt" data-key="exams" data-testid="ics-opt-exams" id="ics-exams"${o.exams ? ' checked' : ''}>${c.t('cal.optExams', { n: (st.exams || []).length })}</label>
    <label class="chk"><input type="checkbox" data-chg="ics-opt" data-key="classes" data-testid="ics-opt-classes" id="ics-classes"${o.classes ? ' checked' : ''}>${c.t('cal.optClasses', { n: d.chosen.length })}</label></div>
    <div class="btns"><button type="button" class="btn btn-primary" data-act="ics" data-testid="ics-download" id="ics-download"${o.official || o.exams || o.classes ? '' : ' disabled'}>${c.ic('download')}${c.t('cal.icsBtn')}</button><span id="ics-msg" class="small" role="status"></span></div></section>`;

  // Exam form
  const opts = d.selected.map((code) => `<option value="${code}">${c.esc(c.lbl(code))}</option>`).join('');
  const f = c.ui.examErr || {};
  h += `<section class="card" aria-labelledby="ex-t"><div class="card-head"><h2 id="ex-t" class="h3">${c.ic('edit')}${c.t('cal.examsTitle')}</h2></div>
    <p class="note">${c.t('cal.examsNote')}</p>`;
  if (!d.selected.length) h += `<p class="empty">${c.t('cal.noCourses')} <a href="#register">${c.t('nav.register')}</a></p>`;
  else {
    h += `<form class="exam-form" id="exam-form" data-form="exam" data-testid="exam-form" novalidate>
      <div class="field"><label for="ex-code">${c.t('cal.course')}</label><select id="ex-code" name="code" data-testid="exam-course">${opts}</select></div>
      <div class="field"><label for="ex-kind">${c.t('cal.kind')}</label><select id="ex-kind" name="kind" data-testid="exam-kind">${EXAM_KINDS.map((k) => `<option value="${k}">${c.t('exam.kind.' + k)}</option>`).join('')}</select></div>
      <div class="field"><label for="ex-date">${c.t('cal.date')} <span class="req">*</span></label><input id="ex-date" name="date" type="date" required min="2026-09-01" max="2027-08-31" data-testid="exam-date"${f.date ? ' aria-invalid="true" aria-describedby="ex-err"' : ''}></div>
      <div class="field"><label for="ex-start">${c.t('cal.start')}</label><input id="ex-start" name="start" type="time" data-testid="exam-start"></div>
      <div class="field"><label for="ex-end">${c.t('cal.end')}</label><input id="ex-end" name="end" type="time" data-testid="exam-end"${f.end ? ' aria-invalid="true" aria-describedby="ex-err"' : ''}></div>
      <div class="field"><label for="ex-room">${c.t('cal.room')}</label><input id="ex-room" name="room" type="text" maxlength="40" autocomplete="off" data-testid="exam-room"></div>
      <div class="field field-btn"><button type="submit" class="btn btn-primary" data-testid="exam-add" id="exam-add">${c.ic('plus')}${c.t('cal.add')}</button></div>
    </form><p id="ex-err" class="small txt-bad" role="alert">${f.msg ? c.esc(f.msg) : ''}</p>`;
  }
  const exams = [...(st.exams || [])].sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
  if (exams.length) {
    h += `<ul class="exam-list" data-testid="exam-list">${exams.map((x) => `<li class="exam-item" data-testid="exam-item-${x.id}">${dateBadge(c, x.date)}<div class="exam-b"><p class="date-t">${c.esc(examTitle(c, x))}</p><p class="small muted">${c.esc(c.fmtDate(x.date))}${x.start ? ` · ${c.esc(x.start)}${x.end ? '–' + c.esc(x.end) : ''}` : ''}${x.room ? ` · ${c.esc(x.room)}` : ''}</p></div>
      <button type="button" class="icon-btn" data-act="exam-del" data-id="${x.id}" data-testid="exam-delete-${x.id}" id="exam-del-${x.id}" aria-label="${c.ta(c.t('cal.delete', { what: examTitle(c, x) + ', ' + c.fmtDate(x.date) }))}">${c.ic('trash')}</button></li>`).join('')}</ul>`;
  } else h += `<p class="small muted">${c.t('cal.noExams')}</p>`;
  h += `</section>`;

  // Weekly classes
  h += `<section class="card" aria-labelledby="cw-t"><div class="card-head"><h2 id="cw-t" class="h3">${c.ic('calendar')}${c.t('cal.weekly')}</h2><a class="btn btn-small btn-ghost" href="#timetable">${c.t('dash.open')}${c.ic('arrow')}</a></div>
    ${d.chosen.length ? c.gridHtml(c.chosenBlocks(d), d.hue, { testid: 'calendar-weekly-grid', cls: 'tt-mini' }) : `<p class="empty">${c.t('dash.noTimetable')}</p>`}
    <p class="small muted">${c.t('cal.weeklyNote')}</p></section>`;

  // Agenda
  const all = CAL.relativeEvents([...CALENDAR, ...examEvents(c)], c.TODAY);
  const shown = st.calPast ? all : all.filter((e) => e.state !== 'past');
  h += `<section class="card" aria-labelledby="ag-t"><div class="card-head"><h2 id="ag-t" class="h3">${c.ic('event')}${c.t('cal.agenda')}</h2>
    <label class="chk"><input type="checkbox" data-chg="cal-past" data-testid="cal-show-past" id="cal-past"${st.calPast ? ' checked' : ''}>${c.t('cal.showPast', { n: all.length - all.filter((e) => e.state !== 'past').length })}</label></div>
    <p class="small muted">${c.t('dash.today', { date: c.fmtDate(c.TODAY, true) })} · ${c.t('cal.source')} <a href="${c.esc(EXTRA_META.calendarUrl)}" rel="noopener noreferrer" target="_blank" class="url">${c.t('cal.pdf')}</a></p>`;
  let month = '';
  let todayShown = false;
  h += `<ol class="agenda" data-testid="calendar-agenda">`;
  for (const e of shown) {
    if (!todayShown && e.state !== 'past') {
      h += `<li class="today-mark" data-testid="calendar-today"><span>${c.t('cal.todayMark', { date: c.fmtDate(c.TODAY, true) })}</span></li>`;
      todayShown = true;
    }
    const m = e.start.slice(0, 7);
    if (m !== month) {
      month = m;
      const p = CAL.parseIso(e.start);
      h += `<li class="ag-month" aria-hidden="true">${c.esc(new Date(Date.UTC(p.y, p.m - 1, 1)).toLocaleDateString(c.locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }))}</li>`;
    }
    h += `<li class="date-item kind-${e.kind} is-${e.state}" data-testid="cal-event-${e.id}">${dateBadge(c, e.start)}<div><p class="date-t">${c.esc(eventTitle(c, e))} <span class="ktag ktag-${e.kind}">${c.t('ev.kind.' + e.kind)}</span></p>
      <p class="small muted">${c.esc(rangeText(c, e.start, e.end))}${eventDetail(c, e) ? ' · ' + c.esc(eventDetail(c, e)) : ''} · ${relText(c, e)}</p></div></li>`;
  }
  if (!todayShown) h += `<li class="today-mark"><span>${c.t('cal.todayMark', { date: c.fmtDate(c.TODAY, true) })}</span></li>`;
  h += `</ol><p class="small muted">${c.t('cal.noMidterms')}</p></section>`;
  return h;
}

/** Validate the exam form; returns { exam } or { error: { msg, date?, end? } }. */
export function readExamForm(c, form, d) {
  const fd = new FormData(form);
  const code = String(fd.get('code') || '');
  const kind = String(fd.get('kind') || 'other');
  const date = String(fd.get('date') || '');
  const start = String(fd.get('start') || '');
  const end = String(fd.get('end') || '');
  const room = String(fd.get('room') || '').trim().slice(0, 40);
  if (!d.selected.includes(code)) return { error: { msg: c.t('cal.errCourse') } };
  if (!CAL.isIso(date)) return { error: { msg: c.t('cal.errDate'), date: true } };
  if (start && CAL.parseTime(start) === null) return { error: { msg: c.t('cal.errTime') } };
  if (end && (CAL.parseTime(end) === null || !start || CAL.parseTime(end) <= CAL.parseTime(start))) return { error: { msg: c.t('cal.errEnd'), end: true } };
  const id = 'x' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  return { exam: { id, code, kind: EXAM_KINDS.includes(kind) ? kind : 'other', date, start: start || '', end: end || '', room } };
}

export function buildCalendarIcs(c, d) {
  const st = c.state;
  const o = st.icsOpts;
  const events = [];
  const L = st.lang;
  if (o.official) {
    for (const e of CALENDAR) events.push({ uid: `${e.id}@kayit-pilotu`, summary: e[L], description: c.t('cal.icsDescOfficial'), date: e.start, endDate: e.end });
  }
  if (o.exams) {
    for (const x of st.exams || []) {
      const ev = { uid: `exam-${x.id}@kayit-pilotu`, summary: examTitle(c, x), location: x.room || '', description: `${c.lbl(x.code)} — ${c.cnamePlain(c.course(x.code))}`, date: x.date };
      if (x.start) {
        ev.start = CAL.parseTime(x.start);
        if (x.end) ev.end = CAL.parseTime(x.end);
      }
      events.push(ev);
    }
  }
  if (o.classes) {
    const blocks = [];
    for (const ch of d.chosen) {
      const s = (DATA.sectionsByCourse[ch.code] || []).find((x) => x.no === ch.no);
      for (const r of E.mergeSlots(ch.slots)) {
        blocks.push({ key: `${ch.code}-${ch.no}-${r.d}-${r.from}`, summary: `${c.lbl(ch.code)} (${c.t('secShort')} ${ch.no})`, location: s ? s.room : '', description: c.cnamePlain(c.course(ch.code)), makeupNote: c.t('cal.icsMakeup'), d: r.d, fromMin: r.from * 60 + 40, toMin: (r.to + 1) * 60 + 30 });
      }
    }
    events.push(...ICS.weeklyClassEvents(blocks, CLASS_TERM));
  }
  return { text: ICS.buildIcs({ name: `Kayıt Pilotu — ${c.term()}`, events, dtstamp: c.now() }), count: events.length };
}

// ---------------------------------------------------------------------------
// Graduation roadmap
// ---------------------------------------------------------------------------
function cgpaChart(c, road) {
  const pts = [{ label: c.t('rm.now'), v: c.state.profile.cgpa }, ...road.terms.map((tm) => ({ label: c.termLabel(tm, true), v: tm.cgpaAfter }))].filter((p) => U.isNum(p.v));
  if (pts.length < 2) return '';
  const W = 640;
  const H = 220;
  const padL = 44;
  const padR = 20;
  const padT = 14;
  const padB = 40;
  const lo = Math.max(0, Math.min(1.5, ...pts.map((p) => p.v)) - 0.2);
  const hi = Math.min(4, Math.max(2.5, ...pts.map((p) => p.v)) + 0.2);
  const x = (i) => padL + (i * (W - padL - padR)) / (pts.length - 1);
  const y = (v) => padT + ((hi - v) * (H - padT - padB)) / (hi - lo);
  const ticks = [];
  for (let v = Math.ceil(lo * 2) / 2; v <= hi + 1e-9; v += 0.5) ticks.push(v);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const summary = pts.map((p) => `${p.label}: ${c.num(p.v, 2)}`).join(', ');
  return `<figure class="chart" data-testid="roadmap-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${c.ta(c.t('rm.chartLabel', { list: summary }))}">
    ${ticks.map((v) => `<g class="ch-grid"><line x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${padL - 14}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${c.num(v, 1)}</text></g>`).join('')}
    ${2 >= lo && 2 <= hi ? `<line class="ch-ref" x1="${padL}" x2="${W - padR}" y1="${y(2).toFixed(1)}" y2="${y(2).toFixed(1)}"/><text class="ch-ref-t" x="${W - padR}" y="${(y(2) - 6).toFixed(1)}" text-anchor="end">2.00</text>` : ''}
    <path class="ch-line" d="${path}"/>
    ${pts.map((p, i) => {
      const anchor = i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle';
      const lx = i === 0 ? x(i) - 4 : i === pts.length - 1 ? x(i) + 4 : x(i);
      return `<circle class="ch-dot" cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4"/><text class="ch-val" x="${lx.toFixed(1)}" y="${(y(p.v) - 10).toFixed(1)}" text-anchor="${anchor}">${c.num(p.v, 2)}</text><text class="ch-x" x="${lx.toFixed(1)}" y="${H - 14}" text-anchor="${anchor}">${c.esc(p.label)}</text>`;
    }).join('')}
  </svg><figcaption class="small muted">${c.t('rm.chartCaption')}</figcaption></figure>`;
}

export function viewRoadmap(c) {
  const st = c.state;
  const road = roadmapFor(c);
  const p = st.profile;
  let h = head(c, crumbOf(c, 'nav.gGrad', 'nav.roadmap'), c.t('nav.roadmap'), c.t('rm.lead'));
  if (st.profile && c.isSampleProfile()) h += `<p class="small muted demo-line">${demoTag(c, 'roadmap-demo-tag')} ${c.t('rm.demoNote')}</p>`;
  h += `<div class="card rm-ctl"><div class="field"><label for="rm-letter">${c.t('rm.letter')}</label><select id="rm-letter" data-chg="rm-letter" data-testid="roadmap-letter">${LETTER_CHOICES.map((l) => `<option value="${l}"${l === st.expLetter ? ' selected' : ''}>${l} (${c.num(G.GP[l], 2)})</option>`).join('')}</select></div><p class="small muted">${c.t('rm.letterNote')}</p></div>`;
  if (road.alreadyDone) return h + `<div class="notice notice-ok">${c.ic('check')}<p>${c.t('rm.allDoneLong')}</p></div>`;
  const last = road.terms[road.terms.length - 1];
  h += `<div class="dash rm-cards">
    <section class="card dcard"><h2 class="dcard-t">${c.ic('gauge')}${c.t('rm.remaining')}</h2><p class="metric" data-testid="roadmap-remaining">${road.remainingEcts}<span class="metric-of"> ${c.t('ects')}</span></p></section>
    <section class="card dcard"><h2 class="dcard-t">${c.ic('flag')}${c.t('rm.graduation')}</h2><p class="metric metric-sm" data-testid="roadmap-graduation">${road.graduation ? c.esc(c.termLabel(road.graduation)) : '—'}</p><p class="small muted">${road.graduation ? c.t('rm.termsLeft', { n: road.terms.length }) : c.t('rm.unscheduledShort', { n: road.unscheduled.length })}</p></section>
    <section class="card dcard"><h2 class="dcard-t">${c.ic('chart')}${c.t('rm.cgpaEnd')}</h2><p class="metric metric-sm" data-testid="roadmap-cgpa-end">${last && U.isNum(last.cgpaAfter) ? c.num(last.cgpaAfter, 2) : '—'}</p><p class="small muted">${U.isNum(p.cgpa) ? c.t('rm.withLetter', { l: st.expLetter }) : c.t('rm.noCgpa')}</p></section></div>`;
  h += `<div class="notice ${road.proven ? 'notice-ok' : 'notice-info'}" role="note" data-testid="roadmap-proof">${c.ic(road.proven ? 'check' : 'info')}<p>${road.proven ? c.t('rm.proven', { n: road.terms.length }) : road.lowerBound !== null && road.graduation ? c.t('rm.notProven', { n: road.terms.length, lb: road.lowerBound }) : c.t('rm.noBound')}</p></div>`;
  if (road.unscheduled.length) h += `<div class="notice notice-warn" role="note">${c.ic('alert')}<p>${c.t('rm.unscheduled', { codes: c.esc(c.codeList(road.unscheduled)) })}</p></div>`;

  // CGPA / probation box
  const t0 = road.terms[0];
  h += `<section class="card" aria-labelledby="rm-cg-t" data-testid="roadmap-cgpa"><h2 id="rm-cg-t" class="h3">${c.ic('chart')}${c.t('rm.cgpaTitle')}</h2>`;
  if (!U.isNum(p.cgpa)) h += `<p>${c.t('rm.noCgpaLong')} <a href="#status">${c.t('nav.status')}</a></p>`;
  else {
    const base = R.gradedEcts(p, DATA);
    const need = t0 ? R.averageNeeded({ cgpa: p.cgpa, base, termEcts: t0.ects, retakeEcts: t0.retakeEcts, target: 2 }) : { state: 'unknown' };
    const band = p.cgpa >= 2 ? 'rm.bandOk' : p.cgpa >= 1.75 ? 'rm.bandProb' : 'rm.bandLow';
    h += `<p>${c.t('rm.current', { cgpa: c.num(p.cgpa, 2), base })} <strong>${c.t(band)}</strong></p>`;
    const vars = { n: t0 ? t0.ects : 0, term: t0 ? c.esc(c.termLabel(t0)) : '', need: c.num(need.need, 2), letter: R.letterAtLeast(need.need) || '—' };
    const key = p.cgpa >= 2 ? { already: 'rm.keepAlready', reachable: 'rm.keepNeed', impossible: 'rm.keepNeed', unknown: 'rm.needUnknown' } : { already: 'rm.liftAlready', reachable: 'rm.liftNeed', impossible: 'rm.liftImpossible', unknown: 'rm.needUnknown' };
    h += `<p class="need-line" data-testid="roadmap-needed">${c.t(key[need.state], vars)}</p>`;
    h += `<p class="small muted">${c.t('rm.limitNote')}</p>`;
    h += cgpaChart(c, road);
  }
  h += `</section>`;

  // Terms
  h += `<section aria-labelledby="rm-terms-t"><h2 id="rm-terms-t" class="h3 sec-t">${c.t('rm.terms')}</h2><ol class="terms" data-testid="roadmap-terms">`;
  for (const tm of road.terms) {
    h += `<li class="card term" data-testid="roadmap-term-${tm.k}"><div class="card-head"><h3 class="h3">${c.esc(c.termLabel(tm))}${tm.k === 0 ? ` <span class="badge badge-compulsory">${c.t('rm.thisTerm')}</span>` : ''}</h3>
      <span class="small"><strong>${tm.ects}</strong> / ${tm.limit} ${c.t('ects')}${U.isNum(tm.cgpaAfter) ? ` · ${c.t('rm.cgpaAfter', { v: c.num(tm.cgpaAfter, 2) })}` : ''}</span></div>
      ${tm.codes.length ? `<ul class="chips">${tm.codes.map((code) => `<li class="chip${st.profile.status[code] === 'failed' ? ' chip-warn' : ''}${c.course(code).kind === 'slot' ? ' chip-slot' : ''}" title="${c.ta(c.cnamePlain(c.course(code)))}">${c.esc(c.lbl(code))} <span class="muted">${c.course(code).ects}</span>${st.profile.status[code] === 'failed' ? ` <span class="sr">(${c.t('role.retake')})</span>` : ''}</li>`).join('')}</ul>` : `<p class="small muted">${c.t('rm.gap')}</p>`}</li>`;
  }
  h += `</ol></section>`;
  h += `<section class="card" aria-labelledby="rm-as-t"><h2 id="rm-as-t" class="h3">${c.ic('info')}${c.t('rm.assumptions')}</h2><ul class="bul">${['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'].map((k) => `<li>${c.t('rm.' + k)}</li>`).join('')}</ul></section>`;
  return h;
}

// ---------------------------------------------------------------------------
// Import from OBS
// ---------------------------------------------------------------------------
export function viewImport(c) {
  const imp = c.ui.imp;
  let h = head(c, crumbOf(c, 'nav.gGrad', 'nav.import'), c.t('nav.import'), c.t('imp.lead'));
  h += `<section class="card" aria-labelledby="imp-how"><h2 id="imp-how" class="h3">${c.ic('upload')}${c.t('imp.howTitle')}</h2>
    <ol class="numbered"><li>${c.t('imp.s1')}</li><li>${c.t('imp.s2')}</li><li>${c.t('imp.s3')}</li></ol>
    <p class="small muted">${c.ic('lock')} ${c.t('imp.privacy')}</p>
    <label for="imp-text" class="lbl">${c.t('imp.label')}</label>
    <textarea id="imp-text" class="export imp-text" rows="9" spellcheck="false" data-testid="import-text" placeholder="${c.ta(c.t('imp.ph'))}">${c.esc(c.ui.impText || '')}</textarea>
    <div class="btns"><button type="button" class="btn btn-primary" data-act="imp-parse" data-testid="import-parse" id="imp-parse">${c.ic('search')}${c.t('imp.parse')}</button>
      <button type="button" class="btn" data-act="imp-example" data-testid="import-example" id="imp-example">${c.ic('flask')}${c.t('imp.example')}</button>
      <button type="button" class="btn btn-ghost" data-act="imp-clear" data-testid="import-clear" id="imp-clear">${c.ic('x')}${c.t('imp.clear')}</button></div></section>`;
  if (c.ui.impDone) h += `<div class="notice notice-ok" role="status" data-testid="import-done">${c.ic('check')}<p>${c.t('imp.done', { n: c.ui.impDone.n })} <a href="#home">${c.t('nav.home')}</a> · <a href="#roadmap">${c.t('nav.roadmap')}</a> · <a href="#status">${c.t('nav.status')}</a></p></div>`;
  if (imp) {
    const n = imp.counts;
    h += `<section class="card" aria-labelledby="imp-pv" data-testid="import-preview"><h2 id="imp-pv" class="h3" tabindex="-1">${c.t('imp.preview')}</h2>`;
    if (!n.rows) h += `<div class="notice notice-warn" role="note">${c.ic('alert')}<p>${c.t('imp.noRows')}</p></div>`;
    else {
      h += `<dl class="facts facts-wide">
        <div><dt>${c.t('imp.rows')}</dt><dd data-testid="import-count-rows">${n.rows}</dd></div>
        <div><dt>${c.t('st.passed')}</dt><dd data-testid="import-count-passed">${n.passed}</dd></div>
        <div><dt>${c.t('st.failed')}</dt><dd data-testid="import-count-failed">${n.failed}</dd></div>
        <div><dt>${c.t('imp.inProgress')}</dt><dd>${n.inProgress}</dd></div>
        <div><dt>${c.t('st.none')}</dt><dd>${n.notTaken}</dd></div>
        <div><dt>${c.t('status.cgpa')}</dt><dd data-testid="import-cgpa">${U.isNum(imp.cgpa) ? c.num(imp.cgpa, 2) : `<span class="muted">${c.t('imp.notFound')}</span>`}</dd></div>
        <div><dt>${c.t('status.semesters')}</dt><dd>${imp.semesters || `<span class="muted">${c.t('imp.notFound')}</span>`}</dd></div>
        ${U.isNum(imp.credits) ? `<div><dt>${c.t('imp.credits')}</dt><dd>${imp.credits}</dd></div>` : ''}</dl>`;
      if (imp.unknownCodes.length) h += `<p class="small txt-warn">${c.t('imp.unknown', { codes: c.esc(imp.unknownCodes.join(', ')) })}</p>`;
      h += `<details class="more"><summary>${c.t('imp.rowsTitle')}</summary><div class="table-wrap"><table class="ctable"><caption class="sr">${c.t('imp.rowsTitle')}</caption><thead><tr><th scope="col">${c.t('tbl.code')}</th><th scope="col">${c.t('tbl.name')}</th><th scope="col">${c.t('imp.term')}</th><th scope="col">${c.t('imp.grade')}</th><th scope="col">${c.t('imp.result')}</th></tr></thead><tbody>
        ${imp.rows.map((r) => `<tr${r.known ? '' : ' class="muted"'}><td class="nowrap">${c.esc(r.label)}</td><td>${c.esc(r.name)}</td><td>${r.term ? c.esc(r.term.label) : '—'}</td><td>${r.grade ? c.esc(r.grade) : '—'}</td><td>${c.t('imp.r.' + r.result)}${r.known ? '' : ' · ' + c.t('imp.r.unknown')}</td></tr>`).join('')}</tbody></table></div></details>
        <p class="small muted">${c.t('imp.applyNote')}</p>
        <div class="btns"><button type="button" class="btn btn-primary" data-act="imp-apply" data-testid="import-apply" id="imp-apply">${c.ic('check')}${c.t('imp.apply')}</button>
        <button type="button" class="btn" data-act="imp-cancel" data-testid="import-cancel" id="imp-cancel">${c.t('imp.cancel')}</button></div>`;
    }
    h += `</section>`;
  }
  return h;
}

// ---------------------------------------------------------------------------
// Why not just OBS?
// ---------------------------------------------------------------------------
const CMP_ROWS = [
  ['clash', '#register'],
  ['choose', '#register'],
  ['nosol', '#register'],
  ['rules', '#register'],
  ['full', '#regday'],
  ['catalogue', '#catalogue'],
  ['attendance', '#attendance'],
  ['final', '#grades'],
  ['calendar', '#calendar'],
  ['graduation', '#roadmap'],
  ['import', '#import'],
  ['honest', '#rules'],
];

export function viewCompare(c) {
  let h = head(c, crumbOf(c, 'nav.gAbout', 'nav.compare'), c.t('nav.compare'), c.t('cmp.lead'));
  h += `<section class="card" aria-labelledby="cmp-t"><h2 id="cmp-t" class="sr">${c.t('nav.compare')}</h2><div class="table-wrap"><table class="ctable cmp" data-testid="compare-table"><caption class="sr">${c.t('cmp.caption')}</caption>
    <thead><tr><th scope="col">${c.t('cmp.problem')}</th><th scope="col">${c.t('cmp.obs')}</th><th scope="col">${c.t('cmp.us')}</th></tr></thead><tbody>`;
  for (const [id, href] of CMP_ROWS) {
    h += `<tr data-testid="compare-row-${id}"><th scope="row">${c.t('cmp.' + id + '.p')}</th><td class="muted">${c.t('cmp.' + id + '.o')}</td><td>${c.t('cmp.' + id + '.u')} <a href="${href}" class="cmp-go" data-testid="compare-go-${id}">${c.t('cmp.open')}${c.ic('arrow')}<span class="sr"> — ${c.esc(stripTags(c.t('cmp.' + id + '.p')))}</span></a></td></tr>`;
  }
  h += `</tbody></table></div><p class="small muted">${c.t('cmp.obsNote')}</p></section>`;
  h += `<section class="card" aria-labelledby="uniq-t"><h2 id="uniq-t" class="h3">${c.ic('star')}${c.t('cmp.uniqueTitle')}</h2><ul class="uniq">${['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].map((k) => `<li>${c.ic('check')}<span>${c.t('cmp.' + k)}</span></li>`).join('')}</ul></section>`;
  return h;
}

// ---------------------------------------------------------------------------
// Events of these pages. Return true when handled.
// ---------------------------------------------------------------------------
export function handleClick(c, act, el) {
  const st = c.state;
  const code = el.dataset.code;
  switch (act) {
    case 'cat-reset':
      c.ui.cat = { ...CAT_DEFAULT };
      c.render();
      return true;
    case 'cat-add': {
      if (st.reg === 'pending') return true;
      const d = c.derive();
      if (d.plan.auto.includes(code)) st.dropped = st.dropped.filter((x) => x !== code);
      else if (!st.added.includes(code)) st.added.push(code);
      c.say(c.t('msg.added', { code: c.lbl(code) }));
      c.render();
      c.renderCourseDlg();
      return true;
    }
    case 'cat-detail':
      c.ui.courseDlg = code;
      c.openDialog('dlg-course', el);
      c.renderCourseDlg();
      { const b = document.getElementById('cd-close'); if (b) b.focus(); }
      return true;
    case 'rd-full': {
      const no = Number(el.dataset.no);
      st.full = st.full || {};
      const list = st.full[code] || [];
      st.full[code] = list.includes(no) ? list.filter((x) => x !== no) : [...list, no];
      if (!st.full[code].length) delete st.full[code];
      c.say(list.includes(no) ? c.t('rd.msgUnfull', { code: c.lbl(code), no }) : c.t('rd.msgFull', { code: c.lbl(code), no }));
      c.render();
      return true;
    }
    case 'rd-reset-full':
      st.full = {};
      c.render();
      return true;
    case 'rd-at-clear':
      st.regAt = '';
      c.render();
      return true;
    case 'rd-use': {
      const d = c.derive();
      const rd = regdayData(c, d);
      const src = el.dataset.i === 'repair' ? rd.repair && rd.repair.sections : rd.backups.plans[Number(el.dataset.i)] && rd.backups.plans[Number(el.dataset.i)].sections;
      if (!src) return true;
      for (const k of Object.keys(src)) st.picks[k] = src[k];
      st.reg = 'draft';
      c.say(c.t('rd.msgUsed'));
      c.render();
      return true;
    }
    case 'rd-copy':
      c.copy(regdayText(c, c.derive()));
      return true;
    case 'att-step': {
      const part = el.dataset.part;
      const a = attFor(c, code);
      if (!a.lim) return true;
      const max = part === 't' ? a.lim.theoryHours : a.lim.practiceHours;
      st.att[code] = st.att[code] || { t: 0, p: 0 };
      st.att[code][part] = A.cleanUsed(A.cleanUsed(st.att[code][part]) + Number(el.dataset.d), max);
      c.save();
      refreshAttRow(c, code, part);
      if (el.disabled) {
        const other = document.getElementById(`att-${code}-${part}-${el.dataset.d === '1' ? 'minus' : 'plus'}`);
        if (other) other.focus();
      }
      return true;
    }
    case 'att-reset':
      if (!window.confirm(c.t('abs.resetConfirm'))) return true;
      st.att = {};
      st.demo.att = false;
      c.render();
      return true;
    case 'att-clear-demo':
      st.att = {};
      st.demo.att = false;
      c.say(c.t('demo.cleared'));
      c.render();
      return true;
    case 'gr-clear-demo':
      st.grades = {};
      st.demo.grades = false;
      c.say(c.t('demo.cleared'));
      c.render();
      return true;
    case 'th-reset':
      st.thresholds = { ...G.DEFAULT_THRESHOLDS };
      c.ui.openTh = true;
      c.render();
      return true;
    case 'exam-del':
      st.exams = (st.exams || []).filter((x) => x.id !== el.dataset.id);
      c.say(c.t('cal.deleted'));
      c.render();
      { const f = document.getElementById('ex-date') || document.getElementById('view-title'); if (f) f.focus(); }
      return true;
    case 'ics': {
      const { text, count } = buildCalendarIcs(c, c.derive());
      c.downloadText('kayit-pilotu-calendar.ics', 'text/calendar;charset=utf-8', text);
      c.lastIcs = text;
      const msg = document.getElementById('ics-msg');
      const m = c.t('cal.icsDone', { n: count });
      if (msg) msg.textContent = m;
      c.say(m);
      return true;
    }
    case 'imp-parse': {
      const ta = document.getElementById('imp-text');
      c.ui.impText = ta ? ta.value : '';
      c.ui.imp = IMP.parseObsStatus(c.ui.impText, DATA);
      c.ui.impDone = null;
      c.render();
      const pv = document.getElementById('imp-pv');
      if (pv) pv.focus();
      return true;
    }
    case 'imp-example':
      c.ui.impText = IMP.SAMPLE_PASTE;
      c.ui.imp = null;
      c.ui.impDone = null;
      c.render();
      { const ta = document.getElementById('imp-text'); if (ta) ta.focus(); }
      return true;
    case 'imp-clear':
    case 'imp-cancel':
      if (act === 'imp-clear') c.ui.impText = '';
      c.ui.imp = null;
      c.render();
      return true;
    case 'imp-apply': {
      const imp = c.ui.imp;
      if (!imp || !imp.counts.rows) return true;
      c.applyImport(imp);
      c.ui.impDone = { n: Object.keys(imp.status).length };
      c.ui.imp = null;
      c.render();
      c.say(c.t('imp.done', { n: c.ui.impDone.n }));
      return true;
    }
    default:
      return false;
  }
}

export function handleChange(c, el) {
  const st = c.state;
  const chg = el.dataset.chg;
  if (chg === 'cat') {
    const k = el.dataset.key;
    c.ui.cat[k] = el.type === 'checkbox' ? el.checked : el.value;
    const box = document.getElementById('cat-list');
    if (box) box.innerHTML = catalogueList(c, c.derive());
    return true;
  }
  if (chg === 'rd-at') {
    st.regAt = CAL.parseLocalDateTime(el.value) ? el.value : '';
    c.render();
    return true;
  }
  if (chg === 'ics-opt') {
    st.icsOpts[el.dataset.key] = el.checked;
    c.render();
    return true;
  }
  if (chg === 'cal-past') {
    st.calPast = el.checked;
    c.render();
    return true;
  }
  if (chg === 'rm-letter') {
    if (LETTER_CHOICES.includes(el.value)) st.expLetter = el.value;
    c.render();
    return true;
  }
  return false;
}

export function handleInput(c, el) {
  const st = c.state;
  const inp = el.dataset.inp;
  if (inp === 'cat-q') {
    c.ui.cat.q = el.value;
    const box = document.getElementById('cat-list');
    if (box) box.innerHTML = catalogueList(c, c.derive());
    return true;
  }
  if (inp === 'att') {
    const code = el.dataset.code;
    const part = el.dataset.part;
    const a = attFor(c, code);
    if (!a.lim) return true;
    const max = part === 't' ? a.lim.theoryHours : a.lim.practiceHours;
    st.att[code] = st.att[code] || { t: 0, p: 0 };
    const n = U.toNum(el.value);
    st.att[code][part] = n === null ? 0 : A.cleanUsed(n, max);
    el.setAttribute('aria-invalid', String(el.value !== '' && (n === null || n < 0 || n > max)));
    c.save();
    refreshAttRow(c, code, part);
    return true;
  }
  if (inp === 'grade') {
    const code = el.dataset.code;
    const i = Number(el.dataset.i);
    const k = Number(el.dataset.k);
    const n = U.toNum(el.value);
    const valid = n !== null && n >= 0 && n <= 100;
    el.setAttribute('aria-invalid', String(el.value.trim() !== '' && !valid));
    st.grades[code] = st.grades[code] || {};
    const arr = Array.isArray(st.grades[code][i]) ? st.grades[code][i] : [];
    arr[k] = valid ? n : null;
    st.grades[code][i] = arr;
    c.save();
    refreshGrade(c, code);
    return true;
  }
  if (inp === 'threshold') {
    const n = U.toNum(el.value);
    st.thresholds[el.dataset.letter] = n === null ? null : n;
    el.setAttribute('aria-invalid', String(n === null || n < 0 || n > 100));
    c.save();
    refreshAllGrades(c);
    return true;
  }
  return false;
}

export function handleSubmit(c, form) {
  if (form.dataset.form !== 'exam') return false;
  const d = c.derive();
  const r = readExamForm(c, form, d);
  if (r.error) {
    c.ui.examErr = r.error;
    const err = document.getElementById('ex-err');
    if (err) err.textContent = r.error.msg;
    const bad = r.error.date ? 'ex-date' : r.error.end ? 'ex-end' : null;
    for (const id of ['ex-date', 'ex-end']) {
      const f = document.getElementById(id);
      if (f) {
        if (id === bad) { f.setAttribute('aria-invalid', 'true'); f.setAttribute('aria-describedby', 'ex-err'); } else f.removeAttribute('aria-invalid');
      }
    }
    if (bad) document.getElementById(bad).focus();
    c.say(r.error.msg);
    return true;
  }
  c.ui.examErr = null;
  c.state.exams = [...(c.state.exams || []), r.exam];
  c.render();
  c.say(c.t('cal.added', { what: examTitle(c, r.exam) }));
  const f = document.getElementById('ex-date');
  if (f) f.focus();
  return true;
}
