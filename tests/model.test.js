"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "Model.js"), "utf8")
  .replace(/^\.pragma library\s*\n/, "");

function loadModel() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "Model.js" });
  return context;
}

const model = loadModel();

const official = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "calendar-data.json"), "utf8")
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

function shiftGregorian(parts, days, conversionModel = model) {
  return gregorianYmd(conversionModel.rjdToGregorian(
    conversionModel.gregorianToRjd(...parts) + days
  ));
}

function settingOptions(key) {
  return manifest.barWidget.schema.find(entry => entry.key === key).options;
}

test("keeps popup settings synchronized with the manifest", () => {
  const fields = plain(model.settingsFields("en"));
  const fieldsByKey = new Map(fields.map(field => [field.key, field]));

  assert.deepEqual(plain(model.settingsDefaults()), manifest.barWidget.defaults);
  assert.equal(fieldsByKey.size, fields.length, "popup setting keys must be unique");
  assert.deepEqual(
    [...fieldsByKey.keys()].sort(),
    manifest.barWidget.schema.map(entry => entry.key).sort()
  );

  for (const entry of manifest.barWidget.schema) {
    const field = fieldsByKey.get(entry.key);
    assert.equal(field.type, entry.type, `${entry.key} has the wrong popup editor`);

    if (entry.type === "enum")
      assert.deepEqual(field.options.map(option => option.value), entry.options);
    else if (entry.type === "integer") {
      assert.equal(field.minimum, entry.min);
      assert.equal(field.maximum, entry.max);
      assert.equal(field.step, entry.step);
    }
  }
});

test("matches every month in the pinned KACST snapshot", () => {
  assert.equal(official.firstHijriYear, model.MIN_HIJRI_YEAR);
  assert.equal(official.lastHijriYear, model.MAX_HIJRI_YEAR);
  assert.equal(
    official.monthLengths.length,
    official.lastHijriYear - official.firstHijriYear + 1
  );

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

  const starts = model.monthStarts();
  assert.equal(starts.length, expectedCodes.length + 1);
  assert.equal(starts[0], model.gregorianToRjd(...official.firstGregorian));
  assert.equal(starts.at(-1), model.gregorianToRjd(...official.lastGregorian) + 1);
  let expectedYearStart = starts[0];
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

test("strictly validates the distributable KACST data pack", () => {
  const result = model.validateCalendarData(official);
  assert.equal(result.valid, true);
  assert.equal(result.revision, official.revision);
  assert.equal(result.codes, model.MONTH_LENGTH_CODES);

  const invalidMonth = structuredClone(official);
  invalidMonth.monthLengths[0].months[0] = 31;
  assert.match(model.validateCalendarData(invalidMonth).error, /29 or 30/);

  const wrongRange = structuredClone(official);
  wrongRange.lastGregorian = [2077, 11, 15];
  assert.match(model.validateCalendarData(wrongRange).error, /range does not match/);

  const wrongSource = structuredClone(official);
  wrongSource.source = "https://example.com/calendar.json";
  assert.match(model.validateCalendarData(wrongSource).error, /expected KACST/);

  const tooManyReferences = structuredClone(official);
  while (tooManyReferences.references.length <= 32)
    tooManyReferences.references.push(structuredClone(official.references[0]));
  assert.match(model.validateCalendarData(tooManyReferences).error, /3 and 32/);

  const duplicateReference = structuredClone(official);
  duplicateReference.references[1] = structuredClone(duplicateReference.references[0]);
  assert.match(model.validateCalendarData(duplicateReference).error, /distinct/);

  const missingBoundary = structuredClone(official);
  missingBoundary.references.splice(0, 1);
  assert.match(model.validateCalendarData(missingBoundary).error, /both supported-range boundaries/);

  const unsafeRevision = structuredClone(official);
  unsafeRevision.revision = 2147483648;
  assert.match(model.validateCalendarData(unsafeRevision).error, /32-bit/);
});

test("installs only newer valid revisions and can extend the offline range", () => {
  const isolated = loadModel();
  const sameRevisionChange = structuredClone(official);
  sameRevisionChange.monthLengths.at(-1).months[0] = 30;
  sameRevisionChange.monthLengths.at(-1).months[1] = 29;
  assert.match(isolated.installCalendarData(sameRevisionChange).error, /newer revision/);

  const extended = structuredClone(official);
  extended.revision += 1;
  extended.lastHijriYear += 1;
  const addedMonths = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
  extended.monthLengths.push({ year: extended.lastHijriYear, months: addedMonths });
  const oldLastRjd = isolated.gregorianToRjd(...official.lastGregorian);
  const newLast = isolated.rjdToGregorian(
    oldLastRjd + addedMonths.reduce((total, length) => total + length, 0)
  );
  extended.lastGregorian = [newLast.year, newLast.month, newLast.day];
  extended.references.push({
    hijri: [extended.lastHijriYear, 12, addedMonths[11]],
    gregorian: extended.lastGregorian
  });

  const installed = isolated.installCalendarData(extended);
  assert.deepEqual(plain(installed), {
    valid: true, changed: true, revision: official.revision + 1
  });
  assert.equal(isolated.MAX_HIJRI_YEAR, extended.lastHijriYear);
  assert.deepEqual(
    gregorianYmd(isolated.hijriToGregorian(
      extended.lastHijriYear, 12, addedMonths[11]
    )),
    extended.lastGregorian
  );

  const shrunk = structuredClone(official);
  shrunk.revision = extended.revision + 1;
  assert.match(isolated.installCalendarData(shrunk).error, /not shrink/);
  assert.equal(isolated.installCalendarData(official).ignored, "older");
});

test("rejects newer packs that move the first supported boundary", () => {
  const shiftedModel = loadModel();
  const shifted = structuredClone(official);
  shifted.revision += 1;
  shifted.firstGregorian = shiftGregorian(shifted.firstGregorian, 1, shiftedModel);
  shifted.lastGregorian = shiftGregorian(shifted.lastGregorian, 1, shiftedModel);
  for (const reference of shifted.references)
    reference.gregorian = shiftGregorian(reference.gregorian, 1, shiftedModel);
  assert.equal(shiftedModel.validateCalendarData(shifted).valid, true);
  assert.match(shiftedModel.installCalendarData(shifted).error, /preserve the first boundary/);

  const rebasedModel = loadModel();
  const rebased = structuredClone(official);
  rebased.revision += 1;
  rebased.firstHijriYear += 1;
  rebased.monthLengths.shift();
  rebased.firstGregorian = gregorianYmd(
    rebasedModel.hijriToGregorian(rebased.firstHijriYear, 1, 1)
  );
  rebased.references = rebased.references.filter(
    reference => reference.hijri[0] >= rebased.firstHijriYear
  );
  rebased.references.unshift({
    hijri: [rebased.firstHijriYear, 1, 1],
    gregorian: rebased.firstGregorian
  });
  assert.equal(rebasedModel.validateCalendarData(rebased).valid, true);
  assert.match(rebasedModel.installCalendarData(rebased).error, /preserve the first boundary/);
});

test("coordinates one update request across multiple monitor bars", () => {
  const isolated = loadModel();
  const start = isolated.CALENDAR_CHECK_INTERVAL_MS + 10_000;
  assert.equal(isolated.claimCalendarUpdate(start, false), true);
  assert.equal(isolated.claimCalendarUpdate(start + 1, false), false);
  isolated.finishCalendarUpdate();
  assert.equal(
    isolated.claimCalendarUpdate(start + isolated.CALENDAR_CHECK_INTERVAL_MS - 1, false),
    false
  );
  assert.equal(isolated.claimCalendarUpdate(start + 1, true), true,
    "a manual check should bypass freshness after the active request finishes");
  isolated.finishCalendarUpdate();
  assert.equal(
    isolated.claimCalendarUpdate(start + 1 + isolated.CALENDAR_CHECK_INTERVAL_MS, false),
    true
  );
  isolated.finishCalendarUpdate();
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
  const before = model.rjdToGregorian(model.gregorianToRjd(...official.firstGregorian) - 1);
  const after = model.rjdToGregorian(model.gregorianToRjd(...official.lastGregorian) + 1);
  assert.equal(model.gregorianToHijri(before.year, before.month, before.day).valid, false);
  assert.equal(model.gregorianToHijri(after.year, after.month, after.day).valid, false);
  assert.equal(model.hijriToGregorian(official.firstHijriYear - 1, 12, 29).valid, false);
  assert.equal(model.hijriToGregorian(official.lastHijriYear + 1, 1, 1).valid, false);

  const shortMonth = official.monthLengths.flatMap(entry =>
    entry.months.map((length, index) => ({ year: entry.year, month: index + 1, length }))
  ).find(entry => entry.length === 29);
  assert.equal(model.hijriToGregorian(shortMonth.year, shortMonth.month, 30).valid, false);
});

test("round-trips every supported calendar day", () => {
  const first = model.gregorianToRjd(...official.firstGregorian);
  const last = model.gregorianToRjd(...official.lastGregorian);
  const declaredDays = official.monthLengths.reduce((yearTotal, entry) =>
    yearTotal + entry.months.reduce((total, length) => total + length, 0), 0
  );
  assert.equal(last - first + 1, declaredDays);

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
