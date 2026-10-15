# Kayıt Pilotu / Registration Pilot

An unofficial pre-registration planner, built for ENGR 4451 (Generative AI for engineering applications).

**Live site:** https://berkaykaskavalci.github.io/kayit-pilotu/  
**Demo video (2:16):** [demo/kayit-pilotu-demo.mp4](demo/kayit-pilotu-demo.mp4)

## The problem

The university's student information system (OBS) tells you about a timetable conflict, a missing prerequisite or
an exceeded credit limit only *after* you have clicked through the registration, and it gives no help in choosing
between sections. Kayıt Pilotu lets a student plan *before* registration opens, using the real 2026-2027 Fall
timetable of the Mechanical Engineering programme.

## The flow

The app is laid out like a student information system (sidebar, term chip, EN/TR toggle), but it is our own
neutral design ("KP" mark), with a fictional demo student and no login.

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

Everything is stored only in the browser (localStorage). The interface is in Turkish by default, with an EN/TR
toggle (the stored choice wins). Course names are shown in Turkish, as in the source.

### Demo mode (for screen recordings)

Open `index.html?demo=1`. `window.kpDemo.caption(text)` shows a subtitle-style caption at the bottom of the
screen (`caption(null)` hides it), `window.kpDemo.reset()` restores the sample student and clears the
registration. Interactive elements carry stable `data-testid` attributes.

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
- `js/engine.js` – rules, scheduling and registration logic (pure functions, no DOM)
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
- The student, student number, advisor, financial status and advisor approval are fictional demo values.
- The 32 / 40 ECTS limits (40 with a CGPA of 2.00 or above, otherwise 32; 32 also when no CGPA is entered or in the
  first two semesters) reflect current practice as reported by students, not the 2016 regulation text. Confirm them
  with your advisor. The app has no separate cap on new courses.
- Only the Mechanical Engineering programme and the 2026-2027 Fall term are covered.

## Team

Group of three, ENGR 4451 (2026-2027 Fall). Member names to be added before the presentation.
