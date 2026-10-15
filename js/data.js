// Data module. Everything here is transcribed from the team's source notes
// (collected 2026-10-13). The raw lines are kept in the source format and parsed
// below, so they can be compared line by line with the source file.
// Nothing in this file is invented; where the source has no data, a flag says so.

export const META = {
  collected: '2026-10-13',
  term: '2026-2027 Fall',
  termTr: '2026-2027 Güz',
  program: 'Mechanical Engineering (2025-2026 Bologna curriculum)',
  programTr: 'Makine Mühendisliği (2025-2026 Bologna müfredatı)',
  sources: [
    {
      id: 'curriculum',
      url: 'https://obs.yasar.edu.tr/oibs/bologna/progCourses.aspx?lang=tr&curSunit=401166',
    },
    {
      id: 'regulation',
      url: 'https://www.lexpera.com.tr/resmi-gazete/metin/yasar-universitesi-on-lisans-ve-lisans-egitim-ogretim-ve-sinav-yonetmeligi-29801',
    },
  ],
};

// ---------------------------------------------------------------------------
// 1. Curriculum. Format: code | Turkish name | T+U+L | ECTS | type
// ---------------------------------------------------------------------------
const CURRICULUM_RAW = {
  1: [
    'ENGR 1115 | PROGRAMLAMAYA GİRİŞ | 2+2+0 | 5 | Z',
    'MATH 1100 | MATEMATİKSEL MANTIK | 2+2+0 | 5 | Z',
    'MATH 1131 | ANALİZ I | 3+2+0 | 7 | Z',
    'PHYS 1121 | FİZİK I | 3+2+0 | 7 | Z',
    'SOFL 1101 | AKADEMİK İNGİLİZCE I | 4+0+0 | 4 | Z',
    'UMFD 1020 | ELEŞTİREL VE ANALİTİK DÜŞÜNMENİN TEMELLERİ | 2+0+0 | 2 | Z (online)',
  ],
  2: [
    'CHEM 1130 | MÜHENDİSLİK KİMYASI | 3+2+0 | 6 | Z',
    'MATH 1132 | ANALİZ II | 3+2+0 | 7 | Z',
    'ME 1110 | MAKİNE MÜHENDİSLİĞİNE GİRİŞ | 2+0+0 | 2 | Z',
    'PHYS 1122 | FİZİK II | 3+2+0 | 7 | Z',
    'SOFL 1102 | AKADEMİK İNGİLİZCE II | 4+0+0 | 4 | Z',
    'UMFD 1120 | GİRİŞİMCİLİĞİN TEMELLERİ | 2+0+0 | 2 | Z (online)',
    'UMFD 1220 | TASARIM ODAKLI DÜŞÜNMENİN TEMELLERİ | 2+0+0 | 2 | Z (online)',
  ],
  3: [
    'EEE 2280 | ELEKTRİK DEVRELERİ VE SİSTEMLERİ | 3+2+0 | 7 | Z',
    'ENGR 2120 | BİLGİSAYAR DESTEKLİ MODELLEMEYE GİRİŞ | 2+2+0 | 5 | Z',
    'HIST 1110 | ATATÜRK İLKELERİ VE İNKILAP TARİHİ I | 2+0+0 | 2 | Z (online)',
    'ISG 9110 | İŞ SAĞLIĞI VE GÜVENLİĞİ I | 2+0+0 | 2 | Z (online)',
    'ISG 9210 | İŞ SAĞLIĞI VE GÜVENLİĞİ II | 2+0+0 | 2 | Z (online)',
    'ME 2210 | MÜHENDİSLİK MEKANİĞİ I | 2+2+0 | 6 | Z',
    'ME 2710 | MALZEME BİLİMİ | 2+2+0 | 4 | Z',
    'TURK 1110 | TÜRK DİLİ I | 2+0+0 | 2 | Z (online)',
  ],
  4: [
    'HIST 1210 | ATATÜRK İLKELERİ VE İNKILAP TARİHİ II | 2+0+0 | 2 | Z (online)',
    'MATH 2230 | MÜHENDİSLİKTE HESAPLAMA YÖNTEMLERİ | 2+2+0 | 6 | Z',
    'MATH 2263 | DİFERANSİYEL DENKLEMLER VE DİNAMİK SİSTEMLER | 3+2+0 | 7 | Z',
    'ME 2220 | MALZEMELERİN MEKANİĞİ | 3+2+0 | 6 | Z',
    'ME 2320 | TERMODİNAMİK | 3+2+0 | 6 | Z',
    'TURK 1210 | TÜRK DİLİ II | 2+0+0 | 2 | Z (online)',
    'UFND 7010 | SOSYAL SORUMLULUK | 0+2+0 | 1 | Z (online)',
  ],
  5: [
    'EEE 3718 | GERİ BESLEME SİSTEMLERİ | 3+2+0 | 6 | Z',
    'ENGR 3450 | PROJE YÖNETİMİ | 3+0+0 | 5 | Z',
    'ME 3220 | MÜHENDİSLİK MEKANİĞİ II | 2+2+0 | 5 | Z',
    'ME 3320 | ISI VE KÜTLE TRANSFERİ | 3+2+0 | 6 | Z',
    'ME 3420 | ÜRETİM YÖNTEMLERİ VE PROSESLERİ | 2+2+0 | 4 | Z',
    'UNV ELECT ME1 | ÜNİVERSİTE SEÇMELİ DERS ME1 | - | 4 | S (pick 1)',
  ],
  6: [
    'MATH 2260 | MÜHENDİSLER İÇİN OLASILIK VE İSTATİSTİK | 3+2+0 | 6 | Z',
    'ME 3330 | AKIŞKANLAR MEKANİĞİ VE MAKİNALARI | 3+2+0 | 6 | Z',
    'ME 3410 | MAKİNA ELEMANLARI | 2+2+0 | 6 | Z',
    'ME 3510 | MAKİNE TEORİSİ VE MEKANİZMALAR | 2+2+0 | 6 | Z',
    'ELECT ME A1 | BÖLÜM SEÇMELİ DERS A1 | - | 6 | S (pick 1)',
  ],
  7: [
    'ENGR 4400 | MÜHENDİSLİK ETİĞİ VE SEMİNER | 0+2+0 | 2 | Z',
    'ENGR 4411 | SÜRDÜRÜLEBİLİR KALKINMA İÇİN MÜHENDİSLİK | 1+1+0 | 3 | Z',
    'ME 4910 | MEZUNİYET TASARIM PROJESİ I | 1+4+0 | 8 | Z',
    'UMFD 1720 | KARİYER PLANLAMA | 2+0+0 | 2 | Z',
    'ELECT ME A2 | BÖLÜM SEÇMELİ DERS A2 | - | 6 | S (pick 1)',
    'ELECT ME B1 | BÖLÜM SEÇMELİ DERS B1 | - | 6 | S (pick 1)',
    'ME 4830 | STAJ | - | 4 | Z',
  ],
  8: [
    'ME 4920 | MEZUNİYET TASARIM PROJESİ II | 1+4+0 | 8 | Z',
    'ELECT ME A3 | BÖLÜM SEÇMELİ DERS A3 | - | 6 | S (pick 1)',
    'ELECT ME B2 | BÖLÜM SEÇMELİ DERS B2 | - | 6 | S (pick 1)',
    'ELECT ME B3 | BÖLÜM SEÇMELİ DERS B3 | - | 6 | S (pick 1)',
    'UNV ELECT ME3 | ÜNİVERSİTE SEÇMELİ ME3 | - | 3 | S (pick 1)',
  ],
};

// Semester ECTS totals as printed in the source headings.
export const SEMESTER_ECTS = { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30, 6: 30, 7: 31, 8: 29 };

// ---------------------------------------------------------------------------
// 2. Department elective pool. Exact A/B group membership is NOT known.
//    Format: [code, Turkish name (null = not captured), ECTS]
// ---------------------------------------------------------------------------
const ELECTIVE_POOL_RAW = [
  ['ME4110', 'MAKİNA ELEMANLARI II', 6],
  ['ME4120', 'SONLU ELEMANLAR YÖNTEMİNE GİRİŞ', 6],
  ['ME4230', 'MEKANİK TİTREŞİMLER', 6],
  ['ENGR4451', 'MÜHENDİSLİK UYGULAMALARI İÇİN ÜRETKEN YAPAY ZEKA', 6],
  ['ME4340', 'TURBOMAKİNELERE GİRİŞ', 6],
  ['ME4210', 'MAKİNA DİNAMİĞİ', 6],
  ['ME4350', 'GAZ DİNAMİĞİ', 6],
  ['ME4420', 'MÜHENDİSLİK MALZEMELERİ', 6],
  ['ME4510', 'TALAŞLI ÜRETİM YÖNTEMLERİ', 6],
  ['ME4520', 'ÇUBUK MEKANİZMALARIN SENTEZİ', 6],
  ['ME4610', 'MEKATRONİK MÜHENDİSLİĞİNE GİRİŞ', 6],
  ['ME4620', 'İLERİ MEKATRONİK', 6],
  ['ME4240', 'ROBOT MEKANİĞİNE GİRİŞ', 6],
  ['ME4410', 'KOMPOZİT MALZEME MEKANİĞİ', 6],
  ['ME4220', 'MALZEME MEKANİĞİ II', 6],
  ['ME4330', 'HESAPLAMALI AKIŞKANLAR DİNAMİĞİNE GİRİŞ', 6],
  ['ME4851', 'ENDÜSTRİYEL DENEYİM I', 6],
  ['EEE4122', 'ENDÜSTRİYEL OTOMASYON', 6],
  ['ESE4112', 'ISITMA HAVALANDIRMA İKLİMLENDİRME', 6],
  ['ESE4212', 'ENERJİ DEPOLAMA SİSTEMLERİ', 6],
  ['ESE3260', 'RÜZGAR ENERJİSİ SİSTEMLERİ', 4],
  ['ESE4240', null, 6],
];

// ---------------------------------------------------------------------------
// 3. Prerequisites. `|` = OR (old / equivalent codes), `ve` = AND.
// ---------------------------------------------------------------------------
const PREREQ_RAW = [
  'MATH1132 < (MATH1131|MATH131|MATH111)',
  'SOFL1102 < (SOFL1101)',
  'ME2220 < (ME2210|ME1222)',
  'EEE3718 < (MATH2263|MATH263)',
  'ME3220 < (ME2210|ME1222|ME2211)',
  'ME3420 < (CHEM1120|ME2710|CHEM1130)',
  'MATH2263 < (MATH1131|MATH131|MATH111)',
  'ME3510 < (ME1222|ME2211|CE2203|ME2210) ve (MATH2263)',
  'ME3410 < (ME2212|ME2220)',
  'ME4120 < (ME2212|ME2220)',
  'ME4230 < (MATH2263) ve (ME2222|ME3220)',
  'ME4410 < (CHEM1120|CHEM1130) ve (ME2212|ME2220)',
  'ME4330 < (ME3310|ME3330|ME2102)',
  'ESE4212 < (ME2310|ME2320)',
  'ME4920 < (ME4910)',
  'ME4830 < (ISG9110|UFND091)',
];

// ---------------------------------------------------------------------------
// 4. Sections offered in 2026-2027 Fall. Format: CODE(section):slots:room:roomCapacity
//    Slot = day + start hour (Pzt08 = Monday 08:40-09:30).
// ---------------------------------------------------------------------------
const SECTIONS_RAW = [
  // Year 1
  'MATH1132(1):Pzt08,Pzt09,Pzt10,Sal13,Sal14:M216:82',
  'MATH1132(2):Pzt13,Pzt14,Pzt15,Car12,Car13:M216:82',
  'MATH1132(3):Sal08,Sal09,Sal10,Car14,Car15:M109:87',
  'ENGR1115(1):Sal10,Sal11,Car08,Car09:Y314:60',
  'ENGR1115(2):Sal08,Sal09,Cum08,Cum09:Y314:60',
  'ENGR1115(3):Sal12,Sal13,Per08,Per09:Y314:60',
  'ENGR1115(4):Pzt09,Pzt10,Cum10,Cum11:Y314:60',
  'ENGR1115(5):Pzt11,Pzt12,Per10,Per11:Y314:60',
  'ENGR1115(6):Pzt13,Pzt14,Car11,Car12:Y314:60',
  'MATH1100(1):Sal12,Sal13,Cum14,Cum15:Y007:168',
  'MATH1100(2):Pzt11,Pzt12,Sal14,Sal15:X001:2000',
  'MATH1100(3):Pzt11,Pzt12,Per10,Per11:X001:2000',
  'MATH1100(4):Per12,Per13,Cum16,Cum17:Y007:168',
  'MATH1100(5):Per14,Per15,Cum16,Cum17:Y007:168',
  'MATH1100(6):Pzt13,Pzt14,Per16,Per17:M114:93',
  'MATH1100(7):Pzt15,Pzt16,Per16,Per17:M114:93',
  'MATH1131(1):Sal10,Sal11,Car08,Car09,Car10:M114:93',
  'MATH1131(2):Sal08,Sal09,Car13,Car14,Car15:M114:93',
  'MATH1131(3):Sal12,Sal13,Sal14,Per08,Per09:M114:93',
  'MATH1131(4):Car08,Car09,Car10,Per10,Per11:M114:93',
  'MATH1131(5):Car13,Car14,Car15,Per14,Per15:M114:93',
  'MATH1131(6):Car08,Car09,Car10,Per13,Per14:M109:87',
  'MATH1131(7):Car13,Car14,Car15,Cum08,Cum09:M109:87',
  'MATH1131(8):Per08,Per09,Per10,Cum10,Cum11:M109:87',
  'PHYS1121(1):Sal10,Sal11,Sal12,Car09,Car10:M528:65',
  'PHYS1121(2):Sal10,Sal11,Sal12,Per12,Per13:M528:65',
  'PHYS1121(3):Sal09,Sal10,Sal11,Per10,Per11:M115:93',
  'PHYS1121(4):Sal09,Sal10,Sal11,Cum14,Cum15:M115:93',
  'PHYS1121(5):Sal14,Sal15,Sal16,Per08,Per09:M534:65',
  'PHYS1121(6):Sal14,Sal15,Sal16,Cum14,Cum15:M534:65',
  'PHYS1121(7):Sal14,Sal15,Sal16,Per16,Per17:M528:65',
  'PHYS1121(8):Sal14,Sal15,Sal16,Cum12,Cum13:M528:65',
  'PHYS1121(9):Car08,Car09,Car10,Per14,Per15:M528:65',
  'PHYS1121(10):Car08,Car09,Car10,Cum12,Cum13:M528:65',
  'PHYS1121(11):Car14,Car15,Car16,Cum08,Cum09:M528:65',
  'PHYS1121(12):Car14,Car15,Car16,Per12,Per13:M528:65',
  'PHYS1121(13):Car11,Car12,Car13,Cum10,Cum11:M115:93',
  'PHYS1121(14):Sal10,Sal11,Sal12,Car11,Car12:M113:82',
  'PHYS1121(15):Sal10,Sal11,Sal12,Car15,Car16:M113:82',
  'PHYS1121(16):Sal14,Sal15,Sal16,Car13,Car14:M113:82',
  'PHYS1121(17):Sal14,Sal15,Sal16,Car15,Car16:M113:82',
  'TURK1110(1):Pzt18,Pzt19:X004:1500',
  'TURK1110(2):Pzt20,Pzt21:X003:1500',
  'TURK1110(3):Cum18,Cum19:X001:2000',
  'TURK1110(4):Per20,Per21:X004:1500',
  'HIST1110(1):Per20,Per21:X002:2000',
  'HIST1110(2):Pzt20,Pzt21:X002:2000',
  'HIST1110(3):Sal20,Sal21:X002:2000',
  'HIST1110(4):Cum20,Cum21:X001:2000',
  'HIST1210(1):Car18,Car19:X009:1500',
  'ISG9110(1):Car18,Car19:X003:1500',
  'ISG9210(1):Car20,Car21:X003:1500',
  'UMFD1020(1):Cum18,Cum19:X001:2000',
  'UMFD1020(2):Cum20,Cum21:X003:1500',
  'UFND7010(1):Sal18,Sal19:X003:1500',
  'TURK1210(1):Cum20:X005:1500',
  // Year 2
  'ENGR2120(1):Pzt08,Pzt09,Car10,Car11:M434:60',
  'ENGR2120(2):Pzt10,Pzt11,Car08,Car09:M434:60',
  'ENGR2120(3):Pzt12,Pzt13,Pzt14,Pzt15:T(-2 B14):39',
  'MATH2260(1):Pzt08,Pzt09,Pzt10,Car14,Car15:M115:93',
  'MATH2260(2):Pzt13,Pzt14,Pzt15,Per08,Per09:M115:93',
  'MATH2260(3):Car08,Car09,Car10,Per10,Per11:T(-1 B10):89',
  'ME2210(1):Pzt13,Pzt14,Cum08,Cum09:M621:88',
  'ME2210(2):Per10,Per11,Cum11,Cum12:M212:87',
  'MATH2263(1):Pzt14,Pzt15,Car13,Car14,Car15:M433:60',
  'MATH2263(2):Car08,Car09,Car13,Car14,Car15:M433:60',
  'MATH2263(3):Car10,Car11,Per08,Per09,Per10:M433:60',
  'MATH2263(4):Car08,Car09,Per08,Per09,Per10:M433:60',
  'ME2710(1):Pzt16,Pzt17,Sal15,Sal16:Y007:168',
  'ME2710(2):Car10,Car11,Car14,Car15:M211:50',
  'MATH2230(1):Sal08,Sal09,Cum10,Cum11:M216:82',
  'EEE2280(1):Sal11,Sal12,Cum12,Cum13,Cum14:M535:60',
  'EEE2280(2):Sal13,Sal14,Cum12,Cum13,Cum14:M535:60',
  'ME2320(1):Sal12,Sal13,Sal14,Per12,Per13:M109:87',
  // Year 3
  'EEE3718(1):Pzt10,Pzt11,Pzt12,Per09,Per10:M528:65',
  'EEE3718(2):Sal11,Sal12,Sal13,Per11,Per12:M534:65',
  'ME3320(1):Pzt13,Pzt14,Pzt15,Cum08,Cum09:M113:82',
  'ME3320(2):Car10,Car11,Car12,Cum14,Cum15:M534:65',
  'ESE4112(1):Sal08,Sal09,Sal10:M527:30',
  'ME3220(1):Sal08,Sal09,Cum12,Cum13:M528:65',
  'ME4610(1):Sal08,Sal09,Sal10:M531:41',
  'ESE4212(1):Sal14,Sal15,Sal16:M531:41',
  'ME3420(1):Car08,Car09,Cum10,Cum11:M534:65',
  'ENGR3450(1):Car14,Car15,Car16:M110:63',
  'ENGR3450(2):Car15,Car16,Car17:M115:93',
  'ENGR3450(3):Per14,Per15,Per16:M114:93',
  'ENGR3450(4):Per14,Per15,Per16:M116:93',
  'ESE3260(1):Car14,Car15,Car16:M534:65',
  'ME4330(1):Per08,Per09,Per10:M527:30',
  // Year 4
  'ENGR4411(1):Pzt13,Pzt14:X001:2000',
  'ENGR4400(1):Sal10,Sal11:X001:2000',
  'ENGR4400(2):Car10,Car11:X001:2000',
  'ME4240(1):Sal12,Sal13,Sal14:M527:30',
  'EEE4122(1):Sal14,Sal15,Sal16,Cum08,Cum09:F004:80',
  'EEE4122(2):Sal14,Sal15,Sal16,Cum10,Cum11:F004:80',
  'ESE4240(1):Car13,Car14,Car15:M531:41',
  'UMFD1720(1):Car20,Car21:X005:1500',
  'UMFD1720(2):Car18,Car19:X005:1500',
  'ME4910(1):Per12,Cmt08,Cmt09,Cmt10,Cmt11:M534:65',
  'ME4910(2):Per12,Cmt12,Cmt13,Cmt14,Cmt15:M534:65',
  'ME4910(3):Per12,Cmt08,Cmt09,Cmt10,Cmt11:M534:65',
  'ME4910(4):Per12,Cmt12,Cmt13,Cmt14,Cmt15:M534:65',
  'ME4910(5):Per12,Paz08,Paz09,Paz10,Paz11:M534:65',
  'ME4910(6):Per12,Paz12,Paz13,Paz14,Paz15:M534:65',
  'ME4910(7):Per12,Paz08,Paz09,Paz10,Paz11:M534:65',
  'ME4910(8):Per12,Paz12,Paz13,Paz14,Paz15:M534:65',
  'ME4340(1):Per14,Per15,Per16:M531:41',
  'ENGR4451(1):Cum11,Cum12,Cum13:M531:41',
  'ME4851(1):Cmt08,Cmt09,Cmt10,Cmt11,Cmt12,Cmt13:M528:65',
];

// Courses the source says are offered but have no timetable slots.
const NO_TIMETABLE = ['ME4830'];
// Courses whose sections were not captured in the source ("section info not loaded").
const SECTIONS_NOT_LOADED = ['SOFL1101', 'SOFL1102'];

// ---------------------------------------------------------------------------
// 5. Registration rules (2016 text of the regulation; may have been amended).
// ---------------------------------------------------------------------------
export const RULES = [
  { id: 'credit', art: '3 / 22',
    en: 'Credit means ECTS.',
    tr: 'Kredi, AKTS anlamına gelir.' },
  { id: 'load', art: '22(1)',
    en: 'Semester load: minimum 20 ECTS. There is no minimum for graduating students or students past 8 semesters.',
    tr: 'Dönem ders yükü: en az 20 AKTS. Mezuniyet aşamasındaki veya 8 dönemi aşmış öğrenciler için alt sınır yoktur.' },
  { id: 'statusFrom', art: '22(2)',
    en: 'The CGPA-based rules apply from the end of the 2nd semester; until then the normal maximum of 32 ECTS is used.',
    tr: 'GANO\'ya bağlı kurallar 2. dönemin sonundan itibaren uygulanır; o zamana kadar normal üst sınır olan 32 AKTS kullanılır.' },
  { id: 'maxLoad', art: '23 / 24',
    en: 'Maximum semester load: 32 ECTS normally; 40 ECTS if your CGPA is 2.00 or above.',
    tr: 'Dönem ders yükü üst sınırı: normalde 32 AKTS; GANO\'n 2,00 veya üzerindeyse 40 AKTS.' },
  { id: 'prereq', art: '28(c)',
    en: 'Prerequisite courses must have been passed in earlier semesters.',
    tr: 'Önkoşul dersleri önceki dönemlerde başarılmış olmalıdır.' },
  { id: 'overlap', art: '29(3)',
    en: 'Courses with an attendance requirement whose timetables overlap can never be taken together; there are no tolerance hours.',
    tr: 'Devam zorunluluğu olan ve ders saatleri çakışan dersler hiçbir şekilde birlikte alınamaz; tolerans saati yoktur.' },
  { id: 'repeatFirst', art: '26',
    en: 'A failed compulsory course (F/U/W/NA) must be retaken in the first semester it is offered.',
    tr: 'Kalınan zorunlu ders (F/U/W/NA) açıldığı ilk dönemde tekrar (alttan) alınmalıdır.' },
  { id: 'repeatGrades', art: '26',
    en: 'Successful students may repeat only C-, D+ and D grades, during add-drop and if capacity allows; probation and unsuccessful students may repeat them freely.',
    tr: 'Başarılı öğrenciler yalnızca C-, D+ ve D notlu dersleri, ekle-bırak döneminde ve kontenjan elverirse tekrar edebilir; sınamalı ve başarısız öğrenciler serbestçe tekrar edebilir.' },
  { id: 'addDrop', art: '25 / 19',
    en: 'Add-drop is done with advisor guidance; there is no registration after add-drop (Art. 25). The student is responsible for registration errors (Art. 19).',
    tr: 'Ekle-bırak danışman rehberliğinde yapılır; ekle-bırak sonrasında kayıt yapılmaz (Md. 25). Kayıt hatalarından öğrenci sorumludur (Md. 19).' },
  { id: 'attendance', art: '29(2)',
    en: 'Attendance: at least 70% of theory hours and 80% of practice hours.',
    tr: 'Devam: teorik saatlerin en az %70\'i, uygulama saatlerinin en az %80\'i.' },
  { id: 'graduation', art: '34',
    en: 'Graduation requires a CGPA of 2.00 or above.',
    tr: 'Mezuniyet için GANO en az 2,00 olmalıdır.' },
];

export const OBSERVED = {
  en: 'Observed in OBS (2026-27 Fall): registration closed on 09.10.2026 17:00; registrations are approved by the advisor.',
  tr: 'OBS\'de gözlemlenen (2026-27 Güz): kayıt 09.10.2026 17:00\'de kapandı; kayıtlar danışman tarafından onaylanır.',
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------
const DAY_INDEX = { Pzt: 0, Sal: 1, Car: 2, Per: 3, Cum: 4, Cmt: 5, Paz: 6 };

function spacedLabel(code) {
  return code.replace(/^([A-Z]+)(\d)/, '$1 $2');
}

function parseCurriculumLine(line, semester) {
  const [label, name, tul, ects, typeRaw] = line.split('|').map((s) => s.trim());
  const isSlot = label.includes('ELECT');
  const code = label.replace(/\s+/g, '');
  return {
    code,
    label,
    name,
    tul: tul === '-' ? null : tul,
    ects: Number(ects),
    type: typeRaw.charAt(0), // Z = compulsory, S = elective
    online: typeRaw.includes('online'),
    kind: isSlot ? 'slot' : 'course',
    slotKind: isSlot ? (label.startsWith('UNV') ? 'university' : 'department') : null,
    semester,
    noTimetable: NO_TIMETABLE.includes(code),
    sectionsNotLoaded: SECTIONS_NOT_LOADED.includes(code),
  };
}

function parsePrereqLine(line) {
  const [target, rest] = line.split('<').map((s) => s.trim());
  const groups = rest.split(/\s+ve\s+/).map((g) => g.replace(/[()]/g, '').trim().split('|'));
  return [target, groups];
}

function parseSectionLine(line) {
  const m = /^([A-Z]+\d+)\((\d+)\):([^:]*):(.*):(\d+)$/.exec(line);
  if (!m) throw new Error('Bad section line: ' + line);
  const slots = m[3].split(',').map((s) => {
    const day = DAY_INDEX[s.slice(0, 3)];
    const hour = Number(s.slice(3));
    if (day === undefined || Number.isNaN(hour)) throw new Error('Bad slot: ' + s + ' in ' + line);
    return { d: day, h: hour };
  });
  return {
    course: m[1],
    no: Number(m[2]),
    slots,
    room: m[4],
    cap: Number(m[5]),
    online: m[4].startsWith('X'),
  };
}

// ---------------------------------------------------------------------------
// English course names: official Bologna catalogue (lang=en), collected 2026-10-15,
// stored as in the source (UPPER CASE) and shown in Title Case. Obvious typos in the
// source were corrected; ME4851 has no English name there and is translated by the team.
// ---------------------------------------------------------------------------
const NAMES_EN_RAW = [
  'CHEM1130|ENGINEERING CHEMISTRY',
  'EEE2280|ELECTRIC CIRCUITS AND SYSTEMS',
  'EEE3718|FEEDBACK SYSTEMS',
  'ENGR1115|INTRODUCTION TO PROGRAMMING',
  'ENGR2120|INTRO TO COMPUTER AIDED MODELING',
  'ENGR3450|PROJECT MANAGEMENT',
  'ENGR4400|ENGINEERING ETHICS AND SEMINAR',
  'ENGR4411|ENGINEERING FOR SUSTAINABLE DEVELOPMENT',
  'HIST1110|ATATÜRK\'S PRINCIPLES AND HISTORY OF REVOLUTION I',
  'HIST1210|ATATÜRK\'S PRINCIPLES AND HISTORY OF REVOLUTION II',
  'ISG9110|OCCUPATIONAL HEALTH AND SAFETY I',
  'ISG9210|OCCUPATIONAL HEALTH AND SAFETY II',
  'MATH1100|MATHEMATICAL LOGIC',
  'MATH1131|CALCULUS I',
  'MATH1132|CALCULUS II',
  'MATH2230|COMPUTATIONAL METHODS IN ENGINEERING',
  'MATH2260|PROBABILITY AND STATISTICS FOR ENGINEERING',
  'MATH2263|DIFFERENTIAL EQUATIONS AND DYNAMICAL SYSTEMS',
  'ME1110|INTRODUCTION TO ME',
  'ME2210|ENGINEERING MECHANICS I',
  'ME2220|MECHANICS OF MATERIALS',
  'ME2320|THERMODYNAMICS',
  'ME2710|MATERIAL SCIENCE',
  'ME3220|ENGINEERING MECHANICS II',
  'ME3320|HEAT AND MASS TRANSFER',
  'ME3330|FLUID MECHANICS AND MACHINERY',
  'ME3410|MECHANICAL COMPONENTS',
  'ME3420|PRODUCTION TECHNOLOGIES AND PROCESSES',
  'ME3510|THEORY OF MACHINES AND MECHANISMS',
  'ME4830|INTERNSHIP',
  'ME4910|SENIOR DESIGN PROJECT I',
  'ME4920|SENIOR DESIGN PROJECT II',
  'PHYS1121|PHYSICS I',
  'PHYS1122|PHYSICS II',
  'SOFL1101|ENGLISH FOR ACADEMIC PURPOSES I',
  'SOFL1102|ENGLISH FOR ACADEMIC PURPOSES II',
  'TURK1110|TURKISH I',
  'TURK1210|TURKISH II',
  'UFND7010|SOCIAL RESPONSIBILITY',
  'UMFD1020|FOUNDATIONS OF CRITICAL AND ANALYTICAL THINKING',
  'UMFD1120|FOUNDATIONS OF ENTREPRENEURSHIP',
  'UMFD1220|FOUNDATIONS OF DESIGN THINKING',
  'UMFD1720|CAREER PLANNING',
  'ME4110|MECHANICAL COMPONENTS II',
  'ME4120|INTRODUCTION TO FINITE ELEMENT METHOD',
  'ME4230|MECHANICAL VIBRATIONS',
  'ENGR4451|GEN-AI FOR ENGINEERING APPLICATIONS',
  'ME4340|INTRODUCTION TO TURBOMACHINERY',
  'ME4210|DYNAMICS OF MACHINERY',
  'ME4350|GAS DYNAMICS',
  'ME4420|ENGINEERING MATERIALS',
  'ME4510|MACHINING PRODUCTION METHODS',
  'ME4520|SYNTHESIS OF LINKAGES',
  'ME4610|INTRODUCTION TO MECHATRONIC ENGINEERING',
  'ME4620|ADVANCED MECHATRONICS',
  'ME4240|INTRODUCTION TO ROBOT MECHANICS',
  'ME4410|MECHANICS OF COMPOSITE MATERIALS',
  'ME4220|MECHANICS OF MATERIALS II',
  'ME4330|INTRODUCTION TO COMPUTATIONAL FLUID DYNAMICS',
  'ME4851|INDUSTRIAL EXPERIENCE I',
  'EEE4122|INDUSTRIAL AUTOMATION',
  'ESE4112|HVAC-R SYSTEMS',
  'ESE4212|ENERGY STORAGE SYSTEMS',
  'ESE3260|WIND ENERGY SYSTEMS',
  'ESE4240|INTEGRATION OF RENEWABLE ENERGY SYSTEMS',
];

const EN_SMALL = new Set(['and', 'of', 'for', 'to', 'in', 'the', 'on', 'a', 'an', 'at', 'by', 'or']);
const EN_KEEP = new Set(['ME', 'HVAC-R', 'I', 'II', 'III', 'IV']);

/** Title Case for the upper-case English names: small words stay lower case unless first. */
export function titleCaseEn(name) {
  return name
    .toLocaleLowerCase('en')
    .split(' ')
    .map((w, i) => {
      const up = w.toLocaleUpperCase('en');
      if (EN_KEEP.has(up)) return up;
      if (w === 'gen-ai') return 'Gen-AI';
      if (i > 0 && EN_SMALL.has(w)) return w;
      return w.charAt(0).toLocaleUpperCase('en') + w.slice(1);
    })
    .join(' ');
}

export const NAMES_EN = Object.fromEntries(
  NAMES_EN_RAW.map((l) => {
    const [code, name] = l.split('|');
    return [code, titleCaseEn(name)];
  }),
);

// Slots (e.g. "ELECT ME A1") have no catalogue entry: derive the English label.
function slotNameEn(label) {
  const m = /^(UNV )?ELECT ME ?([A-Z]?\d)$/.exec(label);
  if (!m) return null;
  return (m[1] ? 'University Elective ' : 'Department Elective ') + m[2];
}

export const SEMESTERS = Object.keys(CURRICULUM_RAW).map((k) => {
  const n = Number(k);
  return { n, ects: SEMESTER_ECTS[n], courses: CURRICULUM_RAW[n].map((l) => parseCurriculumLine(l, n)) };
});

export const ELECTIVES = ELECTIVE_POOL_RAW.map(([code, name, ects]) => ({
  code,
  label: spacedLabel(code),
  name,
  tul: null,
  ects,
  type: 'S',
  online: false,
  kind: 'elective',
  slotKind: null,
  semester: null,
  noTimetable: false,
  sectionsNotLoaded: false,
}));

export const COURSES = [...SEMESTERS.flatMap((s) => s.courses), ...ELECTIVES];
for (const c of COURSES) c.nameEn = NAMES_EN[c.code] || (c.kind === 'slot' ? slotNameEn(c.label) : null) || null;

export const COURSE_MAP = Object.fromEntries(COURSES.map((c) => [c.code, c]));

export const PREREQS = Object.fromEntries(PREREQ_RAW.map(parsePrereqLine));

export const SECTIONS = SECTIONS_RAW.map(parseSectionLine);

export const SECTIONS_BY_COURSE = SECTIONS.reduce((acc, s) => {
  (acc[s.course] = acc[s.course] || []).push(s);
  return acc;
}, {});

// One object the engine can work with.
export const DATA = {
  courses: COURSES,
  courseMap: COURSE_MAP,
  semesters: SEMESTERS,
  electives: ELECTIVES,
  prereqs: PREREQS,
  sections: SECTIONS,
  sectionsByCourse: SECTIONS_BY_COURSE,
};

// ---------------------------------------------------------------------------
// FICTIONAL sample profile for the demo. Not a real person.
// A student who finished 4 semesters, failed MATH 2263 and has not yet taken
// UFND 7010; everything else in semesters 1-4 is passed.
// ---------------------------------------------------------------------------
function buildSample() {
  const status = {};
  for (const s of SEMESTERS) {
    if (s.n > 4) continue;
    for (const c of s.courses) status[c.code] = 'passed';
  }
  status.MATH2263 = 'failed';
  delete status.UFND7010;
  return {
    profile: { status, cgpa: 2.41, semestersCompleted: 4, graduating: false },
    selected: ['MATH2263', 'ME3220', 'ME3320', 'ME3420', 'ENGR3450'],
  };
}
export const SAMPLE = buildSample();

// FICTIONAL display data for the demo student and advisor shown in the interface.
// Placeholders only: not real people, not a real student number.
export const DEMO_STUDENT = {
  name: 'Demo Student',
  number: 'DEMO-0001',
  advisor: 'Dr. Demo Advisor',
};
