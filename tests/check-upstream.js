"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const API_BASE = "https://umqserv.kacst.gov.sa/api/v1/DateConversion";
const MONTH_LENGTHS_URL = `${API_BASE}/GetHijriMonthLengths`;

const snapshot = JSON.parse(
  fs.readFileSync(path.join(__dirname, "official-references.json"), "utf8")
);

function fail(message) {
  throw new Error(
    `${message}\n` +
    "KACST's official Umm al-Qura data may have changed. Do not update the " +
    "bundled table automatically: review every changed boundary, update the " +
    "pinned snapshot and supported range, then run the full test suite."
  );
}

function loadLocalCodes() {
  const source = fs.readFileSync(path.join(__dirname, "..", "Model.js"), "utf8");
  const model = {};
  vm.createContext(model);
  vm.runInContext(source, model, { filename: "Model.js" });
  return model.MONTH_LENGTH_CODES;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "omarchy-hijri-date-source-check" },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Unable to read ${url}: HTTP ${response.status}`);

  let value = await response.json();
  while (typeof value === "string") value = JSON.parse(value);
  return value;
}

function encodedMonths(years) {
  return years.flatMap((entry, yearIndex) => {
    const expectedYear = snapshot.firstHijriYear + yearIndex;
    if (entry.year !== expectedYear)
      fail(`Expected Hijri year ${expectedYear}; found ${entry.year}.`);
    if (!Array.isArray(entry.months) || entry.months.length !== 12)
      fail(`${entry.year} AH does not contain twelve month lengths.`);

    return entry.months.map((length, monthIndex) => {
      if (length !== 29 && length !== 30)
        fail(`${entry.year} AH month ${monthIndex + 1} has invalid length ${length}.`);
      return String(length - 28);
    });
  }).join("");
}

function conversionUrl(hijri) {
  const [year, month, day] = hijri;
  return `${API_BASE}/GetGregorianFromHijri?yh=${year}&mh=${month}&dh=${day}`;
}

function gregorianParts(value) {
  return [value.year, value.month, value.day];
}

async function main() {
  const expectedYears = snapshot.lastHijriYear - snapshot.firstHijriYear + 1;
  if (snapshot.monthLengths.length !== expectedYears)
    fail(`Pinned snapshot contains ${snapshot.monthLengths.length} years; expected ${expectedYears}.`);

  const response = await fetchJson(MONTH_LENGTHS_URL);
  if (!Array.isArray(response)) fail("KACST month-length response is not an array.");
  const upstreamYears = response.filter(entry =>
    entry.year >= snapshot.firstHijriYear && entry.year <= snapshot.lastHijriYear
  );
  if (upstreamYears.length !== expectedYears)
    fail(`KACST returned ${upstreamYears.length} supported years; expected ${expectedYears}.`);

  const pinnedCodes = encodedMonths(snapshot.monthLengths);
  const upstreamCodes = encodedMonths(upstreamYears);
  const changes = [];
  for (let index = 0; index < pinnedCodes.length; index++) {
    if (pinnedCodes[index] === upstreamCodes[index]) continue;
    changes.push({
      year: snapshot.firstHijriYear + Math.floor(index / 12),
      month: index % 12 + 1,
      pinned: 28 + Number(pinnedCodes[index]),
      upstream: 28 + Number(upstreamCodes[index])
    });
  }
  if (changes.length > 0) {
    for (const change of changes)
      console.error(
        `${change.year} AH month ${change.month}: ` +
        `pinned ${change.pinned} days, KACST ${change.upstream} days`
      );
    fail(`${changes.length} KACST month ${changes.length === 1 ? "boundary has" : "boundaries have"} changed.`);
  }

  const localCodes = loadLocalCodes();
  if (localCodes !== pinnedCodes)
    fail("Model.js does not match the pinned KACST snapshot.");

  const anchors = [
    snapshot.references[0],
    snapshot.references.find(reference => reference.hijri[0] === 1448),
    snapshot.references.at(-1)
  ];
  for (const anchor of anchors) {
    const actual = gregorianParts(await fetchJson(conversionUrl(anchor.hijri)));
    if (actual.join("-") !== anchor.gregorian.join("-"))
      fail(
        `KACST converts ${anchor.hijri.join("-")} AH to ${actual.join("-")}; ` +
        `the snapshot expects ${anchor.gregorian.join("-")}.`
      );
  }

  console.log(
    `KACST source matches: ${expectedYears} years, ${pinnedCodes.length} month lengths, ` +
    `${anchors.length} conversion anchors.`
  );
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
