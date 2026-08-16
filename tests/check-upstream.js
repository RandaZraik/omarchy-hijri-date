"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual: same } = require("node:util");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const DATA_PATH = path.join(ROOT, "calendar-data.json");
const MODEL_PATH = path.join(ROOT, "Model.js");
const README_PATH = path.join(ROOT, "README.md");
const snapshot = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const API_BASE = snapshot.conversionSource;
const MONTH_LENGTHS_URL = snapshot.source;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_ENTRIES = 2500;
const writeChanges = process.argv.includes("--write");
const reportIndex = process.argv.indexOf("--report");
const reportPath = reportIndex >= 0 ? process.argv[reportIndex + 1] : "";

if (reportIndex >= 0 && !reportPath)
  throw new Error("--report requires a file path");

function loadModel() {
  const source = fs.readFileSync(MODEL_PATH, "utf8")
    .replace(/^\.pragma library\s*\n/, "");
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "Model.js" });
  return context;
}

function fail(message) {
  throw new Error(
    `${message}\n` +
    "The official response was not published. Inspect KACST and this workflow before retrying."
  );
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "omarchy-hijri-date-source-check" },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Unable to read ${url}: HTTP ${response.status}`);

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES)
    fail(`KACST response exceeds ${MAX_RESPONSE_BYTES} bytes.`);

  const body = await response.text();
  if (body.length > MAX_RESPONSE_BYTES)
    fail(`KACST response exceeds ${MAX_RESPONSE_BYTES} bytes.`);
  let value = JSON.parse(body);
  while (typeof value === "string") {
    if (value.length > MAX_RESPONSE_BYTES)
      fail(`KACST response exceeds ${MAX_RESPONSE_BYTES} bytes.`);
    value = JSON.parse(value);
  }
  return value;
}

function conversionUrl(hijri) {
  const [year, month, day] = hijri;
  return `${API_BASE}/GetGregorianFromHijri?yh=${year}&mh=${month}&dh=${day}`;
}

function gregorianArray(value) {
  return [value.year, value.month, value.day];
}

function isoDate(parts) {
  if (!parts) return "—";
  return parts.map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0")).join("-");
}

function monthBoundaries(data, model) {
  let rjd = model.gregorianToRjd(...data.firstGregorian);
  const boundaries = new Map();
  for (const entry of data.monthLengths) {
    entry.months.forEach((length, monthIndex) => {
      const parts = model.rjdToGregorian(rjd);
      boundaries.set(`${entry.year}-${monthIndex + 1}`, {
        year: entry.year,
        month: monthIndex + 1,
        start: gregorianArray(parts),
        length
      });
      rjd += length;
    });
  }
  return boundaries;
}

function changedBoundaries(before, after, model) {
  const oldRows = monthBoundaries(before, model);
  const newRows = monthBoundaries(after, model);
  const keys = [...new Set([...oldRows.keys(), ...newRows.keys()])]
    .sort((a, b) => {
      const [ay, am] = a.split("-").map(Number);
      const [by, bm] = b.split("-").map(Number);
      return ay - by || am - bm;
    });

  return keys.flatMap(key => {
    const oldRow = oldRows.get(key);
    const newRow = newRows.get(key);
    if (oldRow && newRow && oldRow.length === newRow.length && same(oldRow.start, newRow.start))
      return [];
    const row = newRow || oldRow;
    return [{
      year: row.year,
      month: row.month,
      oldStart: oldRow?.start,
      newStart: newRow?.start,
      oldLength: oldRow?.length,
      newLength: newRow?.length
    }];
  });
}

function changedReferences(before, after) {
  const oldRows = new Map(before.references.map(reference =>
    [reference.hijri.join("-"), reference.gregorian]
  ));
  const newRows = new Map(after.references.map(reference =>
    [reference.hijri.join("-"), reference.gregorian]
  ));
  const keys = [...new Set([...oldRows.keys(), ...newRows.keys()])].sort();
  return keys.flatMap(key => {
    const oldDate = oldRows.get(key);
    const newDate = newRows.get(key);
    return same(oldDate, newDate) ? [] : [{ hijri: key, oldDate, newDate }];
  });
}

function markdownReport(before, after, changes, referenceChanges, changed) {
  const workflowUrl = process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "";
  const lines = [
    "# KACST calendar data review",
    "",
    `Checked: ${new Date().toISOString()}`,
    `Official source: ${MONTH_LENGTHS_URL}`,
    ...(workflowUrl ? [`Workflow run: ${workflowUrl}`] : []),
    "",
    changed
      ? `Outcome: **review required** — ${changes.length} month boundaries and ` +
        `${referenceChanges.length} conversion anchors differ.`
      : "Outcome: **current** — the published data matches KACST.",
    "",
    "## Supported range",
    "",
    "| | Existing | Candidate |",
    "| --- | --- | --- |",
    `| Revision | ${before.revision} | ${after.revision} |`,
    `| Hijri | ${before.firstHijriYear}–${before.lastHijriYear} AH | ${after.firstHijriYear}–${after.lastHijriYear} AH |`,
    `| Gregorian | ${isoDate(before.firstGregorian)}–${isoDate(before.lastGregorian)} | ${isoDate(after.firstGregorian)}–${isoDate(after.lastGregorian)} |`,
    "",
    `## Changed month boundaries (${changes.length})`,
    ""
  ];

  if (changes.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push(
      "| Hijri month | Existing start | Candidate start | Existing days | Candidate days |",
      "| --- | --- | --- | ---: | ---: |"
    );
    for (const change of changes) {
      lines.push(
        `| ${change.year}-${String(change.month).padStart(2, "0")} | ` +
        `${isoDate(change.oldStart)} | ${isoDate(change.newStart)} | ` +
        `${change.oldLength ?? "—"} | ${change.newLength ?? "—"} |`
      );
    }
    lines.push("");
  }

  lines.push(`## Changed conversion anchors (${referenceChanges.length})`, "");
  if (referenceChanges.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push(
      "| Hijri date | Existing Gregorian | Candidate Gregorian |",
      "| --- | --- | --- |"
    );
    for (const change of referenceChanges)
      lines.push(`| ${change.hijri} | ${isoDate(change.oldDate)} | ${isoDate(change.newDate)} |`);
    lines.push("");
  }

  lines.push(
    "## Approval gate",
    "",
    "- The official table and conversion anchors were fetched directly from KACST.",
    "- The candidate data and compiled offline fallback were generated together.",
    "- The full repository test suite must pass before the pull request is opened or updated.",
    "- Nothing reaches `master` or installed users until a maintainer reviews and merges the pull request.",
    ""
  );
  return lines.join("\n");
}

function serializeData(data) {
  const metadataKeys = [
    "schemaVersion", "revision", "authority", "description", "source",
    "conversionSource", "annualReference", "retrieved", "firstHijriYear",
    "lastHijriYear", "firstGregorian", "lastGregorian"
  ];
  const lines = ["{"];
  for (const key of metadataKeys)
    lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(data[key])},`);
  lines.push('  "monthLengths": [');
  data.monthLengths.forEach((entry, index) => {
    const comma = index + 1 === data.monthLengths.length ? "" : ",";
    lines.push(
      `    { "year": ${entry.year}, "months": [${entry.months.join(",")}] }${comma}`
    );
  });
  lines.push('  ],', '  "references": [');
  data.references.forEach((reference, index) => {
    const comma = index + 1 === data.references.length ? "" : ",";
    lines.push(
      `    { "hijri": [${reference.hijri.join(",")}], ` +
      `"gregorian": [${reference.gregorian.join(",")}] }${comma}`
    );
  });
  lines.push("  ]", "}", "");
  return lines.join("\n");
}

function generatedModelBlock(data, codes, model) {
  const firstRjd = model.gregorianToRjd(...data.firstGregorian);
  const chunks = codes.match(/.{1,104}/g);
  const codeLines = chunks.map((chunk, index) =>
    `  ${JSON.stringify(chunk)}${index + 1 === chunks.length ? "" : " +"}`
  ).join("\n");
  const [minYear, minMonth, minDay] = data.firstGregorian;
  const [maxYear, maxMonth, maxDay] = data.lastGregorian;

  return [
    "// BEGIN GENERATED CALENDAR DATA",
    `var CALENDAR_REVISION = ${data.revision}`,
    `var MIN_GREGORIAN = { year: ${minYear}, month: ${minMonth}, day: ${minDay} }`,
    `var MAX_GREGORIAN = { year: ${maxYear}, month: ${maxMonth}, day: ${maxDay} }`,
    `var MIN_HIJRI_YEAR = ${data.firstHijriYear}`,
    `var MAX_HIJRI_YEAR = ${data.lastHijriYear}`,
    `var HIJRI_OFFSET = ${(data.firstHijriYear - 1) * 12}`,
    `var FIRST_MONTH_RJD = ${firstRjd}`,
    "",
    "// Each character is the exact length of one Hijri month minus 28 (1 = 29",
    "// days, 2 = 30 days). This is the bundled, generated offline fallback.",
    "var MONTH_LENGTH_CODES =",
    codeLines,
    "// END GENERATED CALENDAR DATA"
  ].join("\n");
}

function generatedReadmeRange(data) {
  const lastDay = data.monthLengths.at(-1).months[11];
  return [
    "<!-- BEGIN GENERATED CALENDAR RANGE -->",
    `- Current bundled data: revision ${data.revision}; ` +
      `Hijri ${data.firstHijriYear}-01-01–${data.lastHijriYear}-12-${lastDay} AH; ` +
      `Gregorian ${isoDate(data.firstGregorian)}–${isoDate(data.lastGregorian)}.`,
    "<!-- END GENERATED CALENDAR RANGE -->"
  ].join("\n");
}

function writeCandidate(data, codes, model) {
  const modelSource = fs.readFileSync(MODEL_PATH, "utf8");
  const generated = generatedModelBlock(data, codes, model);
  const readme = fs.readFileSync(README_PATH, "utf8");
  const modelPattern = /\/\/ BEGIN GENERATED CALENDAR DATA[\s\S]*?\/\/ END GENERATED CALENDAR DATA/;
  const readmePattern = /<!-- BEGIN GENERATED CALENDAR RANGE -->[\s\S]*?<!-- END GENERATED CALENDAR RANGE -->/;
  if (!modelPattern.test(modelSource))
    fail("Could not locate Model.js's generated data block.");
  if (!readmePattern.test(readme))
    fail("Could not locate README.md's generated calendar range.");

  const outputs = [
    [DATA_PATH, serializeData(data)],
    [MODEL_PATH, modelSource.replace(modelPattern, generated)],
    [README_PATH, readme.replace(readmePattern, generatedReadmeRange(data))]
  ];
  for (const [target, contents] of outputs) fs.writeFileSync(target, contents);
}

async function officialReferences(monthLengths, lastHijriYear) {
  const oldLast = snapshot.references.at(-1)?.hijri;
  const stable = snapshot.references
    .map(reference => reference.hijri)
    .filter(hijri => !same(hijri, oldLast));
  const lastMonthLength = monthLengths.at(-1).months[11];
  const hijriDates = [...stable, [lastHijriYear, 12, lastMonthLength]];
  const unique = hijriDates.filter((hijri, index) =>
    hijriDates.findIndex(other => same(other, hijri)) === index
  );

  return Promise.all(unique.map(async hijri => ({
    hijri,
    gregorian: gregorianArray(await fetchJson(conversionUrl(hijri)))
  })));
}

async function main() {
  const model = loadModel();
  const checked = model.validateCalendarData(snapshot);
  if (!checked.valid) fail(`Published calendar-data.json is invalid: ${checked.error}`);

  const pinnedCodes = checked.codes;
  if (model.MONTH_LENGTH_CODES !== pinnedCodes)
    fail("Model.js does not match calendar-data.json.");

  const response = await fetchJson(MONTH_LENGTHS_URL);
  if (!Array.isArray(response)) fail("KACST month-length response is not an array.");
  if (response.length > MAX_SOURCE_ENTRIES)
    fail(`KACST month-length response exceeds ${MAX_SOURCE_ENTRIES} entries.`);
  const upstreamYears = response
    .filter(entry => entry.year >= snapshot.firstHijriYear)
    .sort((a, b) => a.year - b.year);
  if (upstreamYears.length === 0 || upstreamYears[0].year !== snapshot.firstHijriYear)
    fail(`KACST no longer provides the first supported year ${snapshot.firstHijriYear}.`);
  if (upstreamYears.at(-1).year < snapshot.lastHijriYear)
    fail(`KACST's range shrank below ${snapshot.lastHijriYear} AH.`);

  const lastHijriYear = upstreamYears.at(-1).year;
  const references = await officialReferences(upstreamYears, lastHijriYear);
  const firstGregorian = references.find(reference =>
    same(reference.hijri, [snapshot.firstHijriYear, 1, 1])
  )?.gregorian || gregorianArray(
    await fetchJson(conversionUrl([snapshot.firstHijriYear, 1, 1]))
  );
  const lastGregorian = references.at(-1).gregorian;

  const rawCandidate = {
    ...snapshot,
    retrieved: new Date().toISOString().slice(0, 10),
    lastHijriYear,
    firstGregorian,
    lastGregorian,
    monthLengths: upstreamYears,
    references
  };
  const checkedCandidate = model.validateCalendarData(rawCandidate);
  if (!checkedCandidate.valid)
    fail(`KACST response produced an invalid candidate: ${checkedCandidate.error}`);
  const upstreamCodes = checkedCandidate.codes;
  const contentChanged = pinnedCodes !== upstreamCodes
    || snapshot.lastHijriYear !== rawCandidate.lastHijriYear
    || !same(snapshot.firstGregorian, rawCandidate.firstGregorian)
    || !same(snapshot.lastGregorian, rawCandidate.lastGregorian)
    || !same(snapshot.references, rawCandidate.references);
  const candidate = {
    ...rawCandidate,
    revision: contentChanged ? snapshot.revision + 1 : snapshot.revision,
    retrieved: contentChanged ? rawCandidate.retrieved : snapshot.retrieved
  };
  const changes = contentChanged ? changedBoundaries(snapshot, candidate, model) : [];
  const referenceChanges = contentChanged ? changedReferences(snapshot, candidate) : [];
  const report = markdownReport(
    snapshot, candidate, changes, referenceChanges, contentChanged
  );

  if (reportPath) fs.writeFileSync(reportPath, report);
  console.log(report);

  if (!contentChanged) return;
  if (writeChanges) {
    writeCandidate(candidate, upstreamCodes, model);
    return;
  }
  process.exitCode = 1;
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
