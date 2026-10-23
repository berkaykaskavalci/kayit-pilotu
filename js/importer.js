// Import of the OBS "Müfredat Durum" (curriculum status) page, pasted as text.
// The student selects all on that page, copies and pastes it here; nothing leaves the browser.
// Pure functions, no DOM.
//
// A row looks like (cells separated by tabs, newlines or " | "):
//   ENGR 1115 | PROGRAMLAMAYA GİRİŞ | Z | 5 | [22-23G] | SE 1115 | PROGRAMLAMAYA GİRİŞ | 6 | D
//   curriculum code, name, Z/S, ECTS, then (only if taken) term, taken code, taken name, ECTS, letter grade.
// Rows without a term are not taken; rows with a term but no grade are in progress.
import { toNum } from './util.js';

const CODE_RE = /^(?:[A-ZÇĞİÖŞÜ]{2,5}\s?\d{3,4}[A-Z]?|UNV\s+ELECT\s+ME\s?\d|ELECT\s+ME\s+[A-Z]\d)$/;
const TERM_RE = /^\[?\s*(\d{2}|\d{4})\s*[-/]\s*(\d{2}|\d{4})\s*(G|B|Y|GÜZ|BAHAR|YAZ)\s*\]?$/i;
const PASS = new Set(['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'AA', 'BA', 'BB', 'CB', 'CC', 'DC', 'DD', 'S', 'P', 'G', 'EX', 'M', 'YT']);
const FAIL = new Set(['F', 'FF', 'FD', 'U', 'NA', 'W', 'YZ']);

/** Curriculum / course code as used in the app: "ENGR 1115" -> "ENGR1115", "ELECT ME A1" -> "ELECTMEA1". */
export const normCode = (s) => String(s).toLocaleUpperCase('tr').replace(/\s+/g, '');

/** 'passed' (A … D, and pass-type grades), 'failed' (F, FF, U, NA, W …) or null for anything else. */
export function gradeResult(letter) {
  const g = String(letter || '').trim().toLocaleUpperCase('en');
  if (PASS.has(g)) return 'passed';
  if (FAIL.has(g)) return 'failed';
  return null;
}

const isGrade = (s) => gradeResult(s) !== null;

/** Split the pasted text into non-empty cells. */
export function tokenize(text) {
  return String(text || '')
    .replace(/ /g, ' ')
    .split(/\t|\r?\n|\r|\s+\|\s+|\|/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const isCode = (s) => CODE_RE.test(s);
const isType = (s) => s === 'Z' || s === 'S';
const isInt = (s) => /^\d{1,2}$/.test(s);

/** A row starts with code, name, Z/S and an ECTS number (a "taken code" cell is not followed by Z/S). */
function rowStart(tok, i) {
  return isCode(tok[i]) && i + 3 < tok.length && !isCode(tok[i + 1]) && isType(tok[i + 2]) && isInt(tok[i + 3]);
}

function termInfo(s) {
  const m = TERM_RE.exec(s);
  if (!m) return null;
  const season = m[3].toUpperCase().charAt(0); // G = fall, B = spring, Y = summer
  return { label: s.replace(/^\[|\]$/g, ''), key: `${m[1].slice(-2)}-${m[2].slice(-2)}${season}`, season };
}

/** Fallback for rows pasted as one space-separated line. */
const LINE_RE = /^([A-ZÇĞİÖŞÜ]{2,5}\s?\d{3,4}[A-Z]?)\s+(.+?)\s+([ZS])\s+(\d{1,2})(?:\s+(\[?\d{2,4}\s*-\s*\d{2,4}\s*[GBY]\]?)(?:\s+([A-ZÇĞİÖŞÜ]{2,5}\s?\d{3,4}[A-Z]?)\s+(.+?)\s+(\d{1,2}))?(?:\s+(\S+))?)?\s*$/;

function parseRows(text) {
  const tok = tokenize(text);
  const rows = [];
  for (let i = 0; i < tok.length; i++) {
    if (!rowStart(tok, i)) continue;
    let j = i + 4;
    while (j < tok.length && !rowStart(tok, j)) j++;
    const seg = tok.slice(i + 4, j);
    const ti = seg.findIndex((s) => TERM_RE.test(s));
    let term = null;
    let grade = null;
    let takenCode = null;
    if (ti >= 0) {
      term = termInfo(seg[ti]);
      const after = seg.slice(ti + 1);
      takenCode = after.find(isCode) || null;
      for (let k = after.length - 1; k >= 0; k--) {
        if (isGrade(after[k])) {
          grade = after[k].toLocaleUpperCase('en');
          break;
        }
      }
    }
    rows.push({ code: normCode(tok[i]), label: tok[i], name: tok[i + 1], type: tok[i + 2], ects: Number(tok[i + 3]), term, takenCode: takenCode ? normCode(takenCode) : null, grade });
    i = j - 1;
  }
  if (rows.length) return rows;
  // Space-separated fallback, one row per line.
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = LINE_RE.exec(line.replace(/\s+/g, ' ').trim());
    if (!m) continue;
    rows.push({ code: normCode(m[1]), label: m[1], name: m[2], type: m[3], ects: Number(m[4]), term: m[5] ? termInfo(m[5].replace(/\s+/g, '')) : null, takenCode: m[6] ? normCode(m[6]) : null, grade: m[9] && isGrade(m[9]) ? m[9].toLocaleUpperCase('en') : null });
  }
  return rows;
}

const RANK = { passed: 3, failed: 2, inProgress: 1, notTaken: 0 };

/**
 * Parse the pasted page against the app data.
 * Returns {
 *   rows, status: { [code]: 'passed' | 'failed' }, cgpa (or null), credits (or null),
 *   semesters (distinct fall/spring terms with a grade), counts: { rows, passed, failed, inProgress, notTaken },
 *   unknownCodes: codes that are not in this curriculum
 * }
 */
export function parseObsStatus(text, data) {
  const rows = parseRows(text);
  const best = {};
  const unknown = new Set();
  const terms = new Set();
  const counts = { rows: rows.length, passed: 0, failed: 0, inProgress: 0, notTaken: 0 };
  for (const r of rows) {
    r.result = !r.term ? 'notTaken' : r.grade ? gradeResult(r.grade) : 'inProgress';
    counts[r.result]++;
    if (r.term && r.grade && r.term.season !== 'Y') terms.add(r.term.key);
    const known = !!data.courseMap[r.code];
    r.known = known;
    if (!known) {
      unknown.add(r.label);
      continue;
    }
    const isSlot = data.courseMap[r.code].kind === 'slot';
    const res = isSlot && r.result === 'failed' ? 'notTaken' : r.result; // a slot is only ever "filled"
    if (!best[r.code] || RANK[res] > RANK[best[r.code]]) best[r.code] = res;
    // The course actually taken for an elective slot may be in the department elective pool.
    if (isSlot && r.takenCode && data.courseMap[r.takenCode] && data.courseMap[r.takenCode].kind === 'elective') {
      if (!best[r.takenCode] || RANK[r.result] > RANK[best[r.takenCode]]) best[r.takenCode] = r.result;
    }
  }
  const status = {};
  for (const [code, res] of Object.entries(best)) if (res === 'passed' || res === 'failed') status[code] = res;

  const flat = String(text || '').replace(/\s+/g, ' ');
  const g = /(?:Genel\s*Not\s*Ort(?:alamas[ıi])?\.?|GANO|AGNO|CGPA)\s*[:=]?\s*([0-4](?:[.,]\d{1,2})?)(?![\d.,])/i.exec(flat);
  let cgpa = g ? toNum(g[1]) : null;
  if (cgpa !== null && (cgpa < 0 || cgpa > 4)) cgpa = null;
  const c = /Al[ıi]nan\s*Kredi\s*[:=]?\s*(\d{1,3})(?!\d)/i.exec(flat);
  return {
    rows,
    status,
    cgpa,
    credits: c ? Number(c[1]) : null,
    semesters: terms.size,
    counts,
    unknownCodes: [...unknown],
  };
}

// A FICTIONAL example in the OBS layout, for the "load example" button and the tests.
// Not a real student: every grade and number here is made up.
export const SAMPLE_PASTE = [
  'MÜFREDAT DURUM (örnek, kurgusal)',
  'Alınan Kredi\t88',
  'Genel Not Ort\t1,88',
  'Ders Kodu\tDers Adı\tZ/S\tAKTS\tDönem\tAlınan Ders\tDers Adı\tAKTS\tNot',
  'ENGR 1115\tPROGRAMLAMAYA GİRİŞ\tZ\t5\t[22-23G]\tSE 1115\tPROGRAMLAMAYA GİRİŞ\t6\tD',
  'MATH 1100\tMATEMATİKSEL MANTIK\tZ\t5\t[22-23G]\tMATH 1100\tMATEMATİKSEL MANTIK\t5\tC+',
  'MATH 1131\tANALİZ I\tZ\t7\t[22-23G]\tMATH 1131\tANALİZ I\t7\tB-',
  'PHYS 1121\tFİZİK I\tZ\t7\t[22-23G]\tPHYS 1121\tFİZİK I\t7\tF',
  'SOFL 1101\tAKADEMİK İNGİLİZCE I\tZ\t4\t[22-23G]\tSOFL 1101\tAKADEMİK İNGİLİZCE I\t4\tB+',
  'UMFD 1020\tELEŞTİREL VE ANALİTİK DÜŞÜNMENİN TEMELLERİ\tZ\t2\t[22-23G]\tUMFD 1020\tELEŞTİREL VE ANALİTİK DÜŞÜNMENİN TEMELLERİ\t2\tA',
  'CHEM 1130\tMÜHENDİSLİK KİMYASI\tZ\t6\t[22-23B]\tCHEM 1130\tMÜHENDİSLİK KİMYASI\t6\tNA',
  'MATH 1132\tANALİZ II\tZ\t7\t[22-23B]\tMATH 1132\tANALİZ II\t7\tC',
  'ME 1110\tMAKİNE MÜHENDİSLİĞİNE GİRİŞ\tZ\t2\t[22-23B]\tME 1110\tMAKİNE MÜHENDİSLİĞİNE GİRİŞ\t2\tA-',
  'PHYS 1122\tFİZİK II\tZ\t7\t[22-23B]\tPHYS 1122\tFİZİK II\t7\tW',
  'SOFL 1102\tAKADEMİK İNGİLİZCE II\tZ\t4\t[22-23B]\tSOFL 1102\tAKADEMİK İNGİLİZCE II\t4\tC-',
  'UMFD 1120\tGİRİŞİMCİLİĞİN TEMELLERİ\tZ\t2\t[22-23B]\tUMFD 1120\tGİRİŞİMCİLİĞİN TEMELLERİ\t2\tB',
  'UMFD 1220\tTASARIM ODAKLI DÜŞÜNMENİN TEMELLERİ\tZ\t2\t[22-23B]\tUMFD 1220\tTASARIM ODAKLI DÜŞÜNMENİN TEMELLERİ\t2\tD+',
  'EEE 2280\tELEKTRİK DEVRELERİ VE SİSTEMLERİ\tZ\t7\t[23-24G]\tEEE 2280\tELEKTRİK DEVRELERİ VE SİSTEMLERİ\t7\tC',
  'ENGR 2120\tBİLGİSAYAR DESTEKLİ MODELLEMEYE GİRİŞ\tZ\t5\t[23-24G]\tENGR 2120\tBİLGİSAYAR DESTEKLİ MODELLEMEYE GİRİŞ\t5\tB',
  'ME 2210\tMÜHENDİSLİK MEKANİĞİ I\tZ\t6\t[23-24G]\tME 2210\tMÜHENDİSLİK MEKANİĞİ I\t6\tDD',
  'ME 2710\tMALZEME BİLİMİ\tZ\t4\t[26-27G]\tME 2710\tMALZEME BİLİMİ\t4\t',
  'TURK 1110\tTÜRK DİLİ I\tZ\t2',
  'ISG 9110\tİŞ SAĞLIĞI VE GÜVENLİĞİ I\tZ\t2\t[23-24Y]\tISG 9110\tİŞ SAĞLIĞI VE GÜVENLİĞİ I\t2\tB+',
  'ELECT ME A1\tBÖLÜM SEÇMELİ DERS A1\tS\t6\t[23-24G]\tME 4610\tMEKATRONİK MÜHENDİSLİĞİNE GİRİŞ\t6\tC+',
  'XYZ 1000\tKATALOGDA OLMAYAN DERS\tZ\t3\t[23-24G]\tXYZ 1000\tKATALOGDA OLMAYAN DERS\t3\tA',
].join('\n');
