"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "Model.js"), "utf8");
const model = {};
vm.createContext(model);
vm.runInContext(source, model, { filename: "Model.js" });

const official = JSON.parse(
  fs.readFileSync(path.join(__dirname, "official-references.json"), "utf8")
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8")
);

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function hijriYmd(value) {
  return [value.year, value.month, value.day];
}

function gregorianYmd(value) {
  return [value.year, value.month, value.day];
}

function settingOptions(key) {
  return manifest.barWidget.schema.find(entry => entry.key === key).options;
}

test("matches every month in the pinned KACST snapshot", () => {
  assert.equal(official.firstHijriYear, model.MIN_HIJRI_YEAR);
  assert.equal(official.lastHijriYear, model.MAX_HIJRI_YEAR);
  assert.equal(official.monthLengths.length, 183);

  const expectedCodes = official.monthLengths.flatMap((entry, yearIndex) => {
    assert.equal(entry.year, model.MIN_HIJRI_YEAR + yearIndex,
      "snapshot years must be consecutive");
    assert.equal(entry.months.length, 12,
      `${entry.year} AH must contain twelve months`);
    for (const length of entry.months)
      assert.ok(length === 29 || length === 30,
        `${entry.year} AH contains an invalid month length`);
    return entry.months.map(length => String(length - 28));
  }).join("");

  assert.equal(model.MONTH_LENGTH_CODES, expectedCodes);
  assert.equal(
    crypto.createHash("sha256").update(model.MONTH_LENGTH_CODES).digest("hex"),
    "fe3726b8e8be0a2ce65d9d13f9276bc464709a200646b652bba7d07685488789"
  );

  const starts = model.monthStarts();
  assert.equal(starts.length, 2197);
  assert.equal(starts[0], 15140);
  assert.equal(starts.at(-1), 79990);
  let expectedYearStart = 15140;
  for (let yearIndex = 0; yearIndex < official.monthLengths.length; yearIndex++) {
    const monthIndex = yearIndex * 12;
    assert.equal(starts[monthIndex], expectedYearStart,
      `${official.monthLengths[yearIndex].year} AH has the wrong year start`);
    expectedYearStart += official.monthLengths[yearIndex].months
      .reduce((total, length) => total + length, 0);
  }
  for (let index = 0; index < expectedCodes.length; index++)
    assert.equal(starts[index + 1] - starts[index],
      28 + Number(expectedCodes[index]),
      `month boundary ${index + 1} differs from the KACST snapshot`);
});

test("matches KACST anchor conversions in both directions", () => {
  for (const reference of official.references) {
    assert.deepEqual(
      hijriYmd(model.gregorianToHijri(...reference.gregorian)),
      reference.hijri
    );
    assert.deepEqual(
      gregorianYmd(model.hijriToGregorian(...reference.hijri)),
      reference.gregorian
    );
  }
});

test("rejects dates outside the pinned range", () => {
  assert.equal(model.gregorianToHijri(1900, 4, 29).valid, false);
  assert.equal(model.gregorianToHijri(2077, 11, 17).valid, false);
  assert.equal(model.hijriToGregorian(1317, 12, 29).valid, false);
  assert.equal(model.hijriToGregorian(1501, 1, 1).valid, false);
  assert.equal(model.hijriToGregorian(1448, 3, 30).valid, false);
});

test("round-trips all 64,850 supported calendar days", () => {
  const first = model.gregorianToRjd(1900, 4, 30);
  const last = model.gregorianToRjd(2077, 11, 16);
  assert.equal(last - first + 1, 64850);

  for (let rjd = first; rjd <= last; rjd++) {
    const gregorian = model.rjdToGregorian(rjd);
    const hijri = model.gregorianToHijri(
      gregorian.year, gregorian.month, gregorian.day
    );
    assert.equal(hijri.valid, true, `conversion failed at RJD ${rjd}`);
    assert.deepEqual(
      gregorianYmd(model.hijriToGregorian(hijri.year, hijri.month, hijri.day)),
      gregorianYmd(gregorian),
      `round trip failed at RJD ${rjd}`
    );
  }
});

test("applies and clamps the local sighting adjustment", () => {
  const localDate = new Date(2026, 7, 16, 23, 59);
  assert.deepEqual(
    plain(model.hijriForDate(localDate, 0)),
    { valid: true, year: 1448, month: 3, day: 3, weekday: 0 }
  );
  const expectedDays = new Map([[-2, 1], [-1, 2], [0, 3], [1, 4], [2, 5]]);
  for (let offset = -2; offset <= 2; offset++) {
    const adjusted = model.hijriForDate(localDate, offset);
    assert.deepEqual(hijriYmd(adjusted), [1448, 3, expectedDays.get(offset)]);
    assert.equal(adjusted.weekday, 0,
      `adjustment ${offset} must preserve the actual civil weekday`);
  }
  assert.equal(model.clampOffset(-99), -2);
  assert.equal(model.clampOffset(99), 2);
  assert.equal(model.clampOffset("not a number"), 0);
  assert.equal(model.offsetLabel(-2, "en", "Latin"), "Local adjustment −2 days");
  assert.equal(model.offsetLabel(1, "ar", "Latin"), "تعديل محلي +1 يوم");
  assert.equal(model.offsetLabel(0, "en", "Latin"), "");
});

test("normalizes every finite manifest setting and rejects unknown values", () => {
  const explicitLanguages = new Map([
    ["English", "en"], ["العربية", "ar"], ["Türkçe", "tr"], ["বাংলা", "bn"]
  ]);
  for (const option of settingOptions("language")) {
    if (option === "Auto") continue;
    assert.equal(model.normalizeLanguage(option, "de_DE"), explicitLanguages.get(option));
  }
  assert.equal(model.normalizeLanguage("Auto", "ar_PS"), "ar");
  assert.equal(model.normalizeLanguage("Auto", "tr_TR"), "tr");
  assert.equal(model.normalizeLanguage("Auto", "bn_BD"), "bn");
  assert.equal(model.normalizeLanguage("Auto", "de_DE"), "en");
  assert.equal(model.normalizeLanguage("Unknown", "de_DE"), "en");

  for (const option of settingOptions("numerals"))
    assert.equal(model.normalizeNumerals(option), option);
  for (const option of settingOptions("format"))
    assert.equal(model.normalizeFormat(option), option);
  for (const option of settingOptions("markers"))
    assert.equal(model.normalizeMarkerMode(option), option);
  for (const option of settingOptions("barMarker"))
    assert.equal(model.normalizeBarMarker(option), option);
  for (const option of settingOptions("panelPosition"))
    assert.equal(model.normalizePanelPosition(option), option);

  assert.equal(model.normalizeNumerals("Unknown"), "Native");
  assert.equal(model.normalizeFormat("Unknown"), "Full");
  assert.equal(model.normalizeMarkerMode("Unknown"), "Major dates");
  assert.equal(model.normalizeBarMarker("Unknown"), "Off");
  assert.equal(model.normalizePanelPosition("Unknown"), "Anchored");
});

test("localizes both numeral modes and all full weekday names", () => {
  assert.equal(model.localizeNumber(1448, "ar", "Native"), "١٤٤٨");
  assert.equal(model.localizeNumber(1448, "bn", "Native"), "১৪৪৮");
  assert.equal(model.localizeNumber(1448, "ar", "Latin"), "1448");

  const expectedWeekdays = {
    en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    ar: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
    tr: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
    bn: ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"]
  };
  for (const [language, names] of Object.entries(expectedWeekdays)) {
    assert.deepEqual(names.map((_, weekday) => model.weekdayName(weekday, language)), names);
  }
});

test("formats every language, numeral, format, weekday, and orientation combination", () => {
  const current = model.gregorianToHijri(2026, 8, 16);
  const languages = ["en", "ar", "tr", "bn"];
  const weekdayNames = {
    en: "Sunday", ar: "الأحد", tr: "Pazar", bn: "রবিবার"
  };

  for (const language of languages) {
    for (const numerals of settingOptions("numerals")) {
      for (const format of settingOptions("format")) {
        for (const showWeekday of [false, true]) {
          for (const vertical of [false, true]) {
            const text = model.formatHijri(current, {
              language, numerals, format, showWeekday, vertical
            });
            assert.ok(text.length > 0);
            assert.doesNotMatch(text, /undefined|null/);

            if (vertical) {
              assert.equal(text.split("\n").length, 2);
              assert.equal(text.includes(weekdayNames[language]), false);
            } else {
              assert.equal(text.includes("\n"), false);
              assert.equal(text.startsWith(weekdayNames[language]), showWeekday);
              if (format === "Numeric") assert.match(text, /\//);
              if (format === "Month and day") assert.equal(text.includes("1448"), false);
            }

            if (numerals === "Latin") assert.doesNotMatch(text, /[٠-٩০-৯]/);
            if (numerals === "Native" && language === "ar") assert.match(text, /[٠-٩]/);
            if (numerals === "Native" && language === "bn") assert.match(text, /[০-৯]/);
          }
        }
      }
    }
  }

  assert.equal(
    model.formatHijri(current, { language: "ar", numerals: "Latin", format: "Full" }),
    "3 ربيع الأول 1448 هـ"
  );
  assert.equal(
    model.formatHijri(current, { language: "en", numerals: "Latin", format: "Compact" }),
    "3 Rab I 1448"
  );
  assert.equal(
    model.formatHijri(current, { language: "en", numerals: "Latin", format: "Numeric" }),
    "3/03/1448"
  );
  assert.equal(
    model.formatHijri(current, { language: "en", numerals: "Latin", format: "Month and day" }),
    "3 Rabi' al-Awwal"
  );
  assert.equal(
    model.formatHijri(current, { language: "en", numerals: "Latin", vertical: true }),
    "3\nRab I"
  );
  assert.equal(
    model.formatHijri(current, {
      language: "ar", numerals: "Latin", format: "Full", showWeekday: true
    }),
    "الأحد، 3 ربيع الأول 1448 هـ"
  );
});

test("formats Gregorian dates without slicing localized month names", () => {
  const current = { valid: true, year: 2026, month: 8, day: 16, weekday: 0 };
  assert.equal(
    model.formatGregorianLong(current, "ar", "Latin"),
    "الأحد، 16 أغسطس 2026"
  );
  assert.equal(
    model.gregorianCellLabel({ ...current, day: 1 }, "bn", "Native"),
    "১ আগ"
  );
  assert.equal(
    model.gregorianCellLabel({ ...current, day: 1 }, "tr", "Latin"),
    "1 Ağu"
  );
});

test("aligns month grids for every supported week start", () => {
  const current = model.gregorianToHijri(2026, 8, 16);
  const firstGregorian = model.hijriToGregorian(1448, 3, 1);
  const expectedStarts = new Map([["Saturday", 6], ["Sunday", 0], ["Monday", 1]]);

  for (const option of settingOptions("weekStart")) {
    if (option === "Auto") continue;
    assert.equal(model.normalizeWeekStart(option, 4), expectedStarts.get(option));
  }
  for (const localeFirstDay of [0, 1, 6])
    assert.equal(model.normalizeWeekStart("Auto", localeFirstDay), localeFirstDay);
  assert.equal(model.normalizeWeekStart("Unknown", 1), 1);
  assert.equal(model.normalizeWeekStart("Auto", 99), 0);

  for (const firstDay of [0, 1, 6]) {
    const grid = model.monthGrid(1448, 3, firstDay, 0, current);
    const firstCell = grid.findIndex(cell => cell.inMonth);
    const inMonth = grid.filter(cell => cell.inMonth);

    assert.equal(grid.length % 7, 0);
    assert.equal(firstCell, (firstGregorian.weekday - firstDay + 7) % 7);
    assert.equal(inMonth.length, model.hijriMonthLength(1448, 3));
    assert.deepEqual(plain(inMonth.map(cell => cell.day)),
      Array.from({ length: inMonth.length }, (_, index) => index + 1));
    assert.equal(grid.filter(cell => cell.today).length, 1);
  }

  const adjusted = model.monthGrid(1448, 3, 0, 1, current)
    .find(cell => cell.inMonth);
  assert.deepEqual(gregorianYmd(adjusted.gregorian), [2026, 8, 13]);
});

test("calculates Hijri year progress from actual month lengths", () => {
  const current = model.gregorianToHijri(2026, 8, 16);
  assert.equal(model.hijriYearLength(1448), 355);
  assert.equal(model.hijriDayOfYear(current), 62);
  assert.equal(Math.round(model.hijriYearProgress(current) * 100), 17);
});

test("separates major, traditional, combined, and disabled markers", () => {
  assert.deepEqual(
    plain(model.observancesFor(1448, 12, 10, "Major dates", "en")),
    [{ key: "eidAdha", tier: "major", name: "Eid al-Adha" }]
  );
  assert.deepEqual(
    plain(model.observancesFor(1448, 3, 12, "Major dates", "ar")),
    []
  );
  assert.deepEqual(
    plain(model.observancesFor(1448, 3, 12, "Major + traditional", "ar")),
    [{ key: "mawlid", tier: "traditional", name: "المولد النبوي" }]
  );

  const combined = plain(
    model.observancesFor(1448, 12, 13, "Major + traditional", "en")
  );
  assert.deepEqual(combined, [
    { key: "tashriq", tier: "major", name: "Days of Tashriq" },
    { key: "whiteDays", tier: "traditional", name: "White Days" }
  ]);
  assert.equal(model.hasMajorObservance(combined), true);
  assert.equal(model.observanceSummary(combined), "Days of Tashriq · White Days");
  assert.deepEqual(plain(model.observancesFor(1448, 9, 1, "Off", "en")), []);
});

test("provides English and Arabic names for every marker", () => {
  const keys = [...new Set(model.FIXED_OBSERVANCES.map(item => item.key)), "whiteDays"];
  for (const key of keys) {
    const english = model.observanceName(key, "en");
    const arabic = model.observanceName(key, "ar");
    assert.notEqual(english, key, `${key} is missing its English name`);
    assert.notEqual(arabic, key, `${key} is missing its Arabic name`);
    assert.match(english, /[A-Za-z]/);
    assert.match(arabic, /[\u0600-\u06ff]/);
  }
});

test("shows today's marker beside the bar date in every display mode", () => {
  const eid = plain(model.observancesFor(1448, 12, 10, "Major dates", "en"));
  const combined = plain(
    model.observancesFor(1448, 12, 13, "Major + traditional", "en")
  );

  assert.equal(model.formatBarText("10 Dhu H 1448", eid, "Off", false),
    "10 Dhu H 1448");
  assert.equal(model.formatBarText("10 Dhu H 1448", eid, "Dot", false),
    "10 Dhu H 1448  •");
  assert.equal(model.formatBarText("10 Dhu H 1448", eid, "Name", false),
    "10 Dhu H 1448  Eid al-Adha");
  assert.equal(model.formatBarText("13 Dhu H 1448", combined, "Name", false),
    "13 Dhu H 1448  Days of Tashriq · White Days");
  assert.equal(model.formatBarText("10\nDhu H", eid, "Name", true),
    "10\nDhu H\n•");
  assert.equal(model.formatBarText("10 Dhu H 1448", [], "Name", false),
    "10 Dhu H 1448");
});
