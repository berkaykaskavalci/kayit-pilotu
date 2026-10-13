# Kayıt Pilotu / Registration Pilot

An unofficial pre-registration planner, built for ENGR 4451 (Generative AI for engineering applications).

## The problem

The university's student information system (OBS) tells you about a timetable conflict, a missing prerequisite or
an exceeded credit limit only *after* you have clicked through the registration, and it gives no help in choosing
between sections. Kayıt Pilotu lets a student plan *before* registration opens, using the real 2026-2027 Fall
timetable of the Mechanical Engineering programme.

## The four features

1. **My status** – mark every curriculum course as passed, failed or not taken (per semester, with a
   "mark whole semester passed" shortcut) and enter your CGPA. Stored only in your browser (localStorage).
   A fictional sample student can be loaded with one click.
2. **What can I take this semester?** – every course is sorted into: must repeat first, eligible, blocked by a
   prerequisite (showing exactly which one is missing), not offered this term, already passed. Your ECTS limit
   (up to 40 ECTS with a CGPA of 2.00 or above, otherwise up to 32 ECTS) is shown with its article number, with a
   live counter.
3. **Schedule builder** – tick the courses you want; the app enumerates all section combinations without a time
   overlap, ranks them by your preferences (fewest days on campus, no lessons before 10:40, fewest idle gaps,
   free weekend) and shows them on a weekly grid. You can page through the alternatives and pin a section.
   If no combination exists, it names the courses that always clash and suggests which one to drop.
4. **Pre-flight check + export** – a pass/fail checklist (no overlap, prerequisites, ECTS limit, repeat-first rule,
   20 ECTS minimum), each citing its article, then a "copy for OBS / send to advisor" text and a print view.

The interface is in Turkish by default, with an EN/TR toggle (the stored choice wins). Course names are shown in Turkish, as in the source.

## Data sources

Collected on 2026-10-13:

- Curriculum, elective pool and prerequisites: 2025-2026 Mechanical Engineering Bologna curriculum,
  https://obs.yasar.edu.tr/oibs/bologna/progCourses.aspx?lang=tr&curSunit=401166
- Section timetables: OBS department course schedule, Mechanical Engineering, 2026-2027 Fall.
- Rules: Yaşar University Associate and Undergraduate Education and Examination Regulation
  (Official Gazette 14.08.2016, no. 29801),
  https://www.lexpera.com.tr/resmi-gazete/metin/yasar-universitesi-on-lisans-ve-lisans-egitim-ogretim-ve-sinav-yonetmeligi-29801

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
- `js/data.js` – curriculum, prerequisites, sections and rules, transcribed from the source file
- `js/engine.js` – rules and scheduling logic (pure functions, no DOM)
- `js/i18n.js` – English and Turkish interface texts
- `js/app.js` – state, rendering and events
- `tests.html` – browser tests for the engine and the data

## Limitations

- Unofficial student project. It is not OBS and is not affiliated with the university. Always confirm in OBS and
  with your advisor.
- The rules are taken from the 2016 text of the regulation; later amendments could not be read.
- Room capacity is shown, not the live enrolment quota (which is not public).
- SOFL 1101 / SOFL 1102 sections were not captured: their ECTS can be counted, but their times are not checked.
- The A/B group of each department elective and the university elective list are not in the data.
- Grades are not tracked, so repeating passed courses (C-, D+, D) is not modelled.
- The 32 / 40 ECTS limits (40 with a CGPA of 2.00 or above, otherwise 32; 32 also when no CGPA is entered or in the
  first two semesters) reflect current practice as reported by students, not the 2016 regulation text. Confirm them
  with your advisor. The app has no separate cap on new courses.
- Only the Mechanical Engineering programme and the 2026-2027 Fall term are covered.

## Team

Group of three, ENGR 4451 (2026-2027 Fall). Member names to be added before the presentation.
