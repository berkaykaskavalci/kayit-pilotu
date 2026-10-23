# Kayıt Pilotu / Registration Pilot

An unofficial student assistant around course registration, built for ENGR 4451 (Generative AI for engineering
applications): plan the registration, prepare for registration day, track attendance and grades, keep the dates,
and see the shortest road to graduation.

**Live site:** https://berkaykaskavalci.github.io/kayit-pilotu/  
**Demo video (2:16):** [demo/kayit-pilotu-demo.mp4](demo/kayit-pilotu-demo.mp4)

## The problem

The university's student information system (OBS) tells you about a timetable conflict, a missing prerequisite or
an exceeded credit limit only *after* you have clicked through the registration, and it gives no help in choosing
between sections. Kayıt Pilotu lets a student plan *before* registration opens, using the real 2026-2027 Fall
timetable of the Mechanical Engineering programme.

## The flow

The app is laid out like a student information system (sidebar, term chip, EN/TR toggle), but it is our own
neutral design ("KP" mark), with a fictional demo student ("Demo Student") and no login. The app opens on an
entry screen with a single "Log in as Demo Student" button: there are no username, number or password fields,
no credentials are asked for or stored, and nothing is sent anywhere. "Log out" in the top bar returns to it.

1. **Ana Sayfa (home)** – student card (fictional), CGPA with the resulting ECTS limit (40 with a CGPA of 2.00 or
   above, otherwise 32) and its article, passed ECTS out of 240, registration status, advisor (placeholder) and a
   "Ders kaydına başla" button. On the first visit the fictional sample student is loaded automatically.
2. **Ders Kayıt (registration)** – compulsory courses of the current semester and failed compulsory courses
   (retakes, marked "Alttan", cannot be removed) are added automatically; single-section courses get their section
   automatically. Each course shows its section count and status (selected / choose a section / prerequisite missing,
   naming the course / not offered this term). Department electives offered this term can be added. Sections are
   picked directly on the weekly grid: the sections of the focused course appear as dashed blocks, sections that
   clash with an already chosen course are locked and say why ("ME 3220 ile Salı 08:40'ta çakışıyor"). The same
   choice is available as a keyboard-friendly list under the grid.
3. **Otomatik program önerisi** – an exact search (not AI): every section combination of the ticked courses is
   tried, every conflict-free timetable is listed with a mini weekly grid, ranked by fewest days on campus, fewest
   idle gaps, no lessons before 10:40 and free weekend. If none exists, the app names the courses that clash in
   every combination and suggests which one to leave out.
4. **Kaydı tamamla** – a registration summary (section, code, name, type, ECTS, total vs limit) with the
   pre-flight checklist (no overlap, prerequisites, ECTS limit, retake first, 20 ECTS minimum), each citing its
   article. "Danışman onayına gönder" only changes a status stored in the browser: nothing is sent anywhere.
5. **Haftalık Program** – the final timetable and course list; download as PNG (drawn on a canvas), copy as text,
   or print.
6. **Durumum** – mark every curriculum course as passed, failed or not taken, enter CGPA, semesters completed and
   the graduation flag. **Kurallar ve Kaynaklar** – rules, sources, data date and disclaimers.

### Student assistant pages (v5)

The sidebar has four groups: **Registration**, **This term**, **Graduation** and **About**.

- **Home (dashboard)** – adds a "Needs your attention" list built from the real state (retakes this term, clashes,
  missing sections, failed pre-flight checks, a draft registration, attendance at 75% / at the limit / over it,
  CGPA below 2.00, official deadlines in the next 21 days, holidays and make-up days in the next 14, your own exams
  in the next 14), each with a "Go" link; a mini weekly timetable; the next five dates; the earliest graduation term.
  "Today" is the real date; `?today=YYYY-MM-DD` overrides it for demos and tests.
- **Course catalogue** – search by code or English / Turkish name (accent-insensitive), filters (compulsory /
  elective, semester 1-8 or elective pool, offered this term, eligible now, hide passed). Each row: ECTS, T+U+L,
  sections, prerequisite status, "Opens: …" (reverse prerequisite chain, transitive) and an add button. "Details"
  opens a side sheet with the prerequisite chain, assessment weights, attendance limit and the sections.
- **Registration-day plan** – Plan A (your sections; unchosen ones filled by the exact search), the order to enter
  the courses (fewest clash-free alternatives first, then the smallest room — room capacity is not the live quota),
  "if section X is full → switch to section Y" where Y fits the rest of Plan A (same-time sections first) or "no
  clash-free alternative: ask your advisor / add-drop", and Plan B / Plan C = the next-best timetables of the exact
  search. "Simulate: section full" recomputes everything at once, including the closest complete timetable that
  changes as few courses as possible. Copy, print, works offline. Countdown to the next official registration window
  (or to a date and time you enter).
- **Attendance** – per registered course, allowed theory and practice absence (Art. 29(2): 30% of weekly theory
  hours × 14 and 20% of weekly practice hours × 14, from T+U+L), +/− buttons, progress bars, warnings at 75% and
  "one more hour means NA". Courses without T+U+L in the source get no invented limit.
- **Grades and final** – Bologna weights per course, inputs per item (items with up to 4 instances get one input
  each and are averaged, larger ones take the average), points so far, and the final score needed for each letter
  (rounded up, "secured" / "not reachable"). Courses whose weights do not add up to 100% in the source (ESE 3260,
  UMFD 1720) are flagged and never projected; courses without a final show the weighted total. The letter thresholds
  are editable example values.
- **Calendar and exams** – the official 2026-2027 calendar (past dates can be shown), your own exam dates (no
  midterm date is invented), the weekly classes, and a valid `.ics` export (CRLF, folding at 75 octets, UID,
  DTSTAMP, all-day events with exclusive end dates, escaped text, weekly classes with RRULE / EXDATE for 28-29 Oct
  and the Saturday make-up days).
- **Graduation roadmap** – earliest term-by-term plan from your passed / failed courses, the remaining ECTS and the
  expected graduation term; when the plan length equals a lower bound (remaining ECTS / 40, longest prerequisite
  chain) the page says it is provably the earliest under the assumptions. CGPA projection with an expected average
  letter (chart + values) and the term average needed to reach or keep 2.00 (probation exit, 40-ECTS limit).
- **Import from OBS** – paste the text of the OBS "Müfredat Durum" page (entry screen button or the Graduation
  group); a preview shows the counts, CGPA and terms before anything changes. Everything stays in the browser.
- **Why not just OBS?** – a comparison table (problem / in OBS today / in Registration Pilot), each row linking to
  the feature, plus what only this app does.

Fictional values are always labelled: the Demo Student, and the "Demo data" attendance hours and scores (with a
"Clear demo values" button). The stored state uses the key `kayit-pilotu:v5`, so everyone starts with the fresh
sample once.

Everything is stored only in the browser (localStorage). The interface is in English by default, with an EN/TR
toggle (the stored choice wins). Course names follow the language: English names come from the official Bologna
catalogue (English pages, collected 2026-10-15, shown in Title Case; the name of ME 4851 has no English entry
there and is translated by the team), Turkish names are as in the Turkish catalogue.

### Demo mode (for screen recordings)

Open `index.html?demo=1` (optionally with `&today=2026-10-23`). `window.kpDemo.caption(text)` shows a subtitle-style caption at the bottom of the
screen (`caption(null)` hides it), `window.kpDemo.reset()` restores the sample student and clears the
registration (it does not skip the entry screen; `window.kpDemo.showEntry()` returns to it). `window.kpDemo.state()`
also reports `today`, and `window.kpDemo.icsText()` returns the calendar export. Interactive elements carry stable
`data-testid` attributes.

## Data sources

Collected on 2026-10-13:

- Curriculum, elective pool and prerequisites: 2025-2026 Mechanical Engineering Bologna curriculum,
  https://obs.yasar.edu.tr/oibs/bologna/progCourses.aspx?lang=tr&curSunit=401166
- Section timetables: OBS department course schedule, Mechanical Engineering, 2026-2027 Fall.
- Rules: Yaşar University Associate and Undergraduate Education and Examination Regulation
  (Official Gazette 14.08.2016, no. 29801),
  https://www.lexpera.com.tr/resmi-gazete/metin/yasar-universitesi-on-lisans-ve-lisans-egitim-ogretim-ve-sinav-yonetmeligi-29801

Collected on 2026-10-23 (`js/data-extra.js`):

- Assessment weights: Bologna catalogue course pages ("Assessment Criteria"), 41 courses. ESE 3260 (60%) and
  UMFD 1720 (40%) do not add up to 100% in the source and are shown as incomplete.
- Official 2026-2027 academic calendar (undergraduate column):
  https://oim.yasar.edu.tr/wp-content/uploads/2026/04/2026-2027-Akademik-Takvim.pdf
- Attendance: Art. 29(2) of the regulation (70% theory, 80% practice), over a 14-week term.

## Run locally

No build step and no dependencies. From this folder:

```
python3 -m http.server
```

Then open http://localhost:8000/ for the app and http://localhost:8000/tests.html for the engine tests
(the page ends with `ALL TESTS PASSED` or `TESTS FAILED: n`). The site uses relative URLs only, so it also works
under a sub-path such as GitHub Pages.

## Structure

- `index.html`, `css/style.css` – page shell and styles
- `js/data.js` – curriculum, English and Turkish course names, prerequisites, sections and rules, transcribed from the source file
- `js/data-extra.js` – assessment weights, academic calendar and attendance rule, transcribed from the source file
- `js/engine.js` – rules, scheduling and registration logic (pure functions, no DOM)
- `js/plan.js` – registration-day plan: Plan A, alternatives, entry order, repair, Plan B / C
- `js/attendance.js`, `js/grades.js`, `js/calendar.js`, `js/ics.js`, `js/importer.js`, `js/catalog.js`,
  `js/roadmap.js`, `js/util.js` – the other pure modules (no DOM); `util.js` holds the number guards
- `js/i18n.js` – English and Turkish interface texts (identical key sets, checked by the tests)
- `js/app.js` – state, rendering and events of the shell and the registration pages
- `js/pages.js` – rendering and events of the student-assistant pages
- `tests.html` – browser tests for every pure module plus an integration run of the whole app in a 375 px iframe
  (every page in EN and TR: renders, no NaN / undefined / null, no horizontal scroll). `tests.html?unit` skips the
  integration part.

## Limitations

- Unofficial student project. It is not OBS and is not affiliated with the university. Always confirm in OBS and
  with your advisor.
- The rules are taken from the 2016 text of the regulation; later amendments could not be read.
- Room capacity is shown, not the live enrolment quota (which is not public).
- SOFL 1101 / SOFL 1102 sections were not captured: their ECTS can be counted, but their times are not checked.
- The A/B group of each department elective and the university elective list are not in the data.
- The English course names are from the catalogue as collected on 2026-10-15 and may change.
- Repeating passed courses (C-, D+, D) is not modelled. Scores you enter are only used for the final calculator.
- Letter thresholds differ per instructor; the defaults (A 90, A- 85, B+ 80, B 75, B- 70, C+ 65, C 60, C- 55, D+ 50,
  D 45) are editable examples, not university values. The 4.00 letter scale (A 4.00 … D 1.00, F 0) is assumed.
- Per-course midterm dates and rooms are not in any source we could read; students enter their own.
- Only the Fall 2026-27 timetable is in the data. The registration-day countdown points to the next official window
  (Spring: 26-29 Jan 2027) but the Spring sections are not known yet; the calendar gives no opening time.
- Roadmap assumptions: odd curriculum semesters in fall, even ones in spring (in Fall 2026-27 the real timetable
  decides; later falls also offer the courses that have Fall 2026-27 sections); a prerequisite must be passed in an
  earlier term; 40 ECTS with a projected CGPA ≥ 2.00, else 32; no summer school; elective slots filled in the term
  of their curriculum semester; every planned course passed with the expected average; a retake replaces the F in
  the CGPA; graded ECTS are estimated from the courses marked passed / failed. The plan is greedy; it is reported as
  "earliest possible" only when it meets the lower bound.
- The OBS importer was written against the format described by students (tab / newline / " | " separated cells, or
  one row per line); other layouts may need adjusting. Unknown codes are listed and ignored.
- The demo attendance hours and scores are invented and labelled "Demo data".
- The student, student number, advisor, financial status, advisor approval and the demo attendance / scores are
  fictional demo values.
- The 32 / 40 ECTS limits (40 with a CGPA of 2.00 or above, otherwise 32; 32 also when no CGPA is entered or in the
  first two semesters) reflect current practice as reported by students, not the 2016 regulation text. Confirm them
  with your advisor. The app has no separate cap on new courses.
- Only the Mechanical Engineering programme and the 2026-2027 Fall term are covered.

## Team

Group of three, ENGR 4451 (2026-2027 Fall). Member names to be added before the presentation.
