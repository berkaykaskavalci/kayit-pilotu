// Extra source data, collected 2026-10-23 (see raw-data/EXTRA_DATA.md).
// A. Assessment weights per course (Bologna catalogue, "Assessment Criteria").
// B. Official 2026-2027 academic calendar (undergraduate column).
// C. Attendance rule (regulation Art. 29(2)).
// Nothing in this file is invented. Per-course midterm dates and rooms are NOT in the
// source, so there are none here: students enter their own exam dates in the app.

export const EXTRA_META = {
  collected: '2026-10-23',
  calendarUrl: 'https://oim.yasar.edu.tr/wp-content/uploads/2026/04/2026-2027-Akademik-Takvim.pdf',
};

// ---------------------------------------------------------------------------
// A. Format: CODE :: item~count~weight% ; ...  ("Final" = final exam / final project)
//    Lines that do not sum to 100 in the source keep their note.
// ---------------------------------------------------------------------------
export const ASSESSMENT_RAW = [
  'ENGR1115 :: Mid-Term~1~30;Practice~14~30;Final~1~40',
  'MATH1100 :: Mid-Term~1~40;Final~1~60',
  'MATH1131 :: Mid-Term~1~40;Practice~2~10;Final~1~50',
  'MATH1132 :: Mid-Term~1~40;Quiz~2~10;Final~1~50',
  'PHYS1121 :: Mid-Term~1~35;Practice~1~20;Final~1~45',
  'SOFL1101 :: Mid-Term~1~35;Seminar~2~35;Final~1~30',
  'UMFD1020 :: Homework~2~40;Final~1~60',
  'TURK1110 :: Mid-Term~1~40;Final~1~60',
  'TURK1210 :: Mid-Term~1~40;Final~1~60',
  'HIST1110 :: Mid-Term~1~40;Final~1~60',
  'HIST1210 :: Mid-Term~1~40;Final~1~60',
  'ISG9110 :: Mid-Term~1~40;Final~1~60',
  'ISG9210 :: Mid-Term~1~40;Final~1~60',
  'UFND7010 :: Project~1~40;Final~1~60',
  'EEE2280 :: Mid-Term~1~26;Quiz~10~5;Project~1~8;Practice~7~25;Final~1~36',
  'ENGR2120 :: Mid-Term~1~40;Final~1~60',
  'ME2210 :: Mid-Term~1~40;Final~1~60',
  'ME2710 :: Mid-Term~2~60;Final~1~40',
  'MATH2230 :: Mid-Term~1~35;Quiz~2~10;Homework~1~10;Final~1~45',
  'MATH2263 :: Mid-Term~1~20;Quiz~2~10;Practice~14~40;Final~1~30',
  'ME2320 :: Mid-Term~1~30;Quiz~2~20;Practice~2~10;Final~1~40',
  'MATH2260 :: Mid-Term~1~40;Quiz~1~10;Final~1~50',
  'EEE3718 :: Mid-Term~1~25;Project~1~20;Practice~14~25;Final~1~30',
  'ENGR3450 :: Mid-Term~1~25;Quiz~2~10;Homework~2~15;Project~1~20;Final~1~30',
  'ME3220 :: Mid-Term~1~40;Final~1~60',
  'ME3320 :: Mid-Term~1~30;Quiz~2~20;Practice~1~10;Final~1~40',
  'ME3420 :: Mid-Term~1~30;Quiz~2~10;Project~1~10;Final~1~50',
  'ENGR4400 :: Mid-Term~1~50;Final~1~50',
  'ENGR4411 :: Mid-Term~1~30;Homework~1~20;Project~1~50',
  'ENGR4451 :: Project~1~100',
  'ME4240 :: Mid-Term~1~40;Final~1~60',
  'ME4330 :: Mid-Term~1~25;Project~1~35;Final~1~40',
  'ME4340 :: Mid-Term~1~30;Homework~1~20;Final~1~50',
  'ME4610 :: Final~1~100',
  'ME4910 :: Homework~1~10;Project~1~30;Seminar~1~25;Practice~1~5;Final~1~30',
  'EEE4122 :: Mid-Term~1~30;Quiz~4~15;Practice~5~20;Final~1~35',
  'ESE3260 :: Mid-Term~1~20;Quiz~2~10;Project~1~20;Practice~1~10   (INCOMPLETE: sums to 60)',
  'ESE4112 :: Mid-Term~1~20;Quiz~1~10;Project~1~14;Seminar~1~8;Practice~1~8;Final~1~40',
  'ESE4212 :: Mid-Term~1~24;Quiz~2~16;Project~1~20;Final~1~40',
  'ESE4240 :: Quiz~6~30;Project~1~40;Final~1~30',
  'UMFD1720 :: Homework~4~20;Seminar~4~20   (INCOMPLETE: sums to 40)',
];

// ---------------------------------------------------------------------------
// B. Official 2026-2027 academic calendar. Dates are inclusive (start..end).
//    kind drives icons, colours and which events count as deadlines.
// ---------------------------------------------------------------------------
const ev = (id, start, end, kind, term, en, tr) => ({ id, start, end: end || start, kind, term, en, tr });

export const CALENDAR = [
  // Fall 2026
  ev('fall-tuition', '2026-09-07', '2026-09-18', 'payment', 'fall', 'Tuition payment (Fall)', 'Öğrenim ücreti ödemesi (Güz)'),
  ev('fall-reg', '2026-09-14', '2026-09-18', 'registration', 'fall', 'Course registration (Fall)', 'Ders kaydı (Güz)'),
  ev('fall-start', '2026-09-21', null, 'classes', 'fall', 'Classes start (Fall)', 'Derslerin başlaması (Güz)'),
  ev('fall-adddrop', '2026-09-21', '2026-09-30', 'adddrop', 'fall', 'Add-drop (Fall)', 'Ekle-bırak (Güz)'),
  ev('fall-withdraw', '2026-10-09', null, 'withdraw', 'fall', 'Last day to withdraw from a course (W)', 'Dersten çekilme (W) için son gün'),
  ev('hol-republic', '2026-10-28', '2026-10-29', 'holiday', 'fall', 'Republic Day, 29 Oct (no classes on 28 Oct)', 'Cumhuriyet Bayramı, 29 Ekim (28 Ekim\'de ders yok)'),
  ev('fall-makeup-1', '2026-11-07', null, 'makeup', 'fall', 'Make-up day: Saturday runs the Wednesday 28 Oct timetable', 'Telafi günü: Cumartesi, 28 Ekim Çarşamba programı uygulanır'),
  ev('fall-makeup-2', '2026-11-14', null, 'makeup', 'fall', 'Make-up day: Saturday runs the Thursday 29 Oct timetable', 'Telafi günü: Cumartesi, 29 Ekim Perşembe programı uygulanır'),
  ev('fall-end', '2026-12-25', null, 'classesEnd', 'fall', 'Classes end (Fall)', 'Derslerin bitişi (Güz)'),
  ev('fall-finals-1', '2026-12-26', '2026-12-30', 'exams', 'fall', 'Final exams (Fall, part 1)', 'Final sınavları (Güz, 1. bölüm)'),
  ev('hol-newyear', '2027-01-01', null, 'holiday', 'fall', 'New Year\'s Day', 'Yılbaşı'),
  ev('fall-finals-2', '2027-01-04', '2027-01-12', 'exams', 'fall', 'Final exams (Fall, part 2)', 'Final sınavları (Güz, 2. bölüm)'),
  ev('fall-grades', '2027-01-13', null, 'grades', 'fall', 'Final grade entry deadline (Fall)', 'Final notlarının girilmesi için son gün (Güz)'),
  ev('fall-objection', '2027-01-14', '2027-01-19', 'objection', 'fall', 'Grade objection (material error) applications', 'Not itirazı (maddi hata) başvuruları'),
  ev('fall-objection-res', '2027-01-20', null, 'objection', 'fall', 'Grade objection results', 'Not itirazı sonuçları'),
  ev('fall-twocourse-app', '2027-01-20', null, 'twoCourse', 'fall', 'Two-course exam application deadline', 'İki ders sınavı başvurusu için son gün'),
  ev('fall-twocourse', '2027-01-25', '2027-01-26', 'twoCourse', 'fall', 'Two-course exam', 'İki ders sınavı'),
  // Spring 2027
  ev('spring-tuition', '2027-01-18', '2027-01-29', 'payment', 'spring', 'Tuition payment (Spring)', 'Öğrenim ücreti ödemesi (Bahar)'),
  ev('spring-reg', '2027-01-26', '2027-01-29', 'registration', 'spring', 'Course registration (Spring)', 'Ders kaydı (Bahar)'),
  ev('spring-start', '2027-02-01', null, 'classes', 'spring', 'Classes start (Spring)', 'Derslerin başlaması (Bahar)'),
  ev('spring-adddrop', '2027-02-01', '2027-02-10', 'adddrop', 'spring', 'Add-drop (Spring)', 'Ekle-bırak (Bahar)'),
  ev('spring-withdraw', '2027-02-19', null, 'withdraw', 'spring', 'Last day to withdraw from a course (W)', 'Dersten çekilme (W) için son gün'),
  ev('hol-ramadan', '2027-03-08', '2027-03-11', 'holiday', 'spring', 'Ramadan Bayram (8 Mar is the eve)', 'Ramazan Bayramı (8 Mart arife)'),
  ev('hol-apr23', '2027-04-23', null, 'holiday', 'spring', 'National Sovereignty and Children\'s Day', 'Ulusal Egemenlik ve Çocuk Bayramı'),
  ev('hol-may1', '2027-05-01', null, 'holiday', 'spring', 'Labour Day', 'Emek ve Dayanışma Günü'),
  ev('spring-makeup', '2027-05-08', null, 'makeup', 'spring', 'Make-up day: Saturday runs the Friday 23 Apr timetable', 'Telafi günü: Cumartesi, 23 Nisan Cuma programı uygulanır'),
  ev('spring-end', '2027-05-14', null, 'classesEnd', 'spring', 'Classes end (Spring)', 'Derslerin bitişi (Bahar)'),
  ev('hol-kurban', '2027-05-15', '2027-05-19', 'holiday', 'spring', 'Kurban Bayram (15 May is the eve)', 'Kurban Bayramı (15 Mayıs arife)'),
  ev('hol-may19', '2027-05-19', null, 'holiday', 'spring', 'Commemoration of Atatürk, Youth and Sports Day', 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı'),
  ev('spring-finals', '2027-05-24', '2027-06-06', 'exams', 'spring', 'Final exams (Spring)', 'Final sınavları (Bahar)'),
  // Summer 2027
  ev('summer-reg', '2027-06-14', '2027-06-15', 'registration', 'summer', 'Course registration (Summer school)', 'Ders kaydı (Yaz okulu)'),
  ev('summer-classes', '2027-06-21', '2027-08-06', 'classes', 'summer', 'Summer school classes', 'Yaz okulu dersleri'),
  ev('ceremony', '2027-06-30', '2027-07-01', 'ceremony', 'summer', 'Graduation ceremony', 'Mezuniyet töreni'),
  ev('hol-jul15', '2027-07-15', null, 'holiday', 'summer', 'Democracy and National Unity Day', 'Demokrasi ve Millî Birlik Günü'),
  ev('hol-aug30', '2027-08-30', null, 'holiday', 'summer', 'Victory Day', 'Zafer Bayramı'),
];

// Teaching weeks of the term covered by the timetable, used for the weekly classes in the
// .ics export: no classes on the listed days, and Saturday make-up days that run the
// timetable of another weekday (d: 0 = Monday … 6 = Sunday).
export const CLASS_TERM = {
  start: '2026-09-21',
  end: '2026-12-25',
  noClass: ['2026-10-28', '2026-10-29'],
  makeup: [
    { date: '2026-11-07', runs: 2 },
    { date: '2026-11-14', runs: 3 },
  ],
};

// ---------------------------------------------------------------------------
// C. Attendance (Art. 29(2)): at least 70% of theory and 80% of practice hours,
//    over a 14-week term.
// ---------------------------------------------------------------------------
export const ATTENDANCE_RULE = { article: '29(2)', theoryMin: 0.7, practiceMin: 0.8, weeks: 14 };
