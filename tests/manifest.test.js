"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const calendarData = JSON.parse(
  fs.readFileSync(path.join(root, "calendar-data.json"), "utf8")
);
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

function schemaEntry(key) {
  return manifest.barWidget.schema.find(entry => entry.key === key);
}

test("declares a valid bar-widget identity and entry point", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.match(manifest.id, /^[a-z0-9][a-z0-9._-]*$/);
  assert.equal(manifest.id.startsWith("omarchy."), false);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(manifest.kinds, ["bar-widget"]);
  assert.equal(manifest.entryPoints.barWidget, "BarWidget.qml");
  assert.equal(manifest.barWidget.allowMultiple, false);
  assert.equal(manifest.barWidget.defaultSection, "right");
});

test("includes the runtime, marketplace, and legal assets", () => {
  const requiredAssets = [
    "manifest.json",
    manifest.entryPoints.barWidget,
    "state/CalendarUpdater.qml",
    "ui/Panel.qml",
    "ui/SettingsPane.qml",
    "lib/Model.js",
    "calendar-data.json",
    "preview.png",
    "README.md",
    "LICENSE"
  ];

  for (const relativePath of requiredAssets) {
    const target = path.join(root, relativePath);
    assert.equal(fs.existsSync(target), true, `${relativePath} is missing`);
    assert.equal(fs.lstatSync(target).isFile(), true, `${relativePath} must be a regular file`);
  }
});

test("keeps every setting default synchronized with its schema", () => {
  const defaults = manifest.barWidget.defaults;
  const schema = manifest.barWidget.schema;
  const schemaKeys = schema.map(entry => entry.key);

  assert.equal(new Set(schemaKeys).size, schemaKeys.length, "schema keys must be unique");
  assert.deepEqual(schemaKeys.slice().sort(), Object.keys(defaults).sort());

  for (const entry of schema) {
    assert.deepEqual(entry.defaultValue, defaults[entry.key],
      `${entry.key} default differs between defaults and schema`);

    if (entry.type === "enum") {
      assert.ok(entry.options.includes(entry.defaultValue),
        `${entry.key} default must be one of its options`);
    } else if (entry.type === "integer") {
      assert.equal(Number.isInteger(entry.defaultValue), true);
      assert.ok(entry.defaultValue >= entry.min && entry.defaultValue <= entry.max);
    } else if (entry.type === "boolean") {
      assert.equal(typeof entry.defaultValue, "boolean");
    } else if (entry.type === "string") {
      assert.equal(typeof entry.defaultValue, "string");
    } else {
      assert.fail(`unsupported schema type ${entry.type} for ${entry.key}`);
    }
  }
});

test("exposes the documented formatting and calendar choices", () => {
  assert.deepEqual(schemaEntry("language").options,
    ["Auto", "English", "العربية", "Türkçe", "বাংলা"]);
  assert.deepEqual(schemaEntry("format").options,
    ["Full", "Compact", "Numeric", "Month and day"]);
  assert.deepEqual(schemaEntry("weekStart").options,
    ["Auto", "Saturday", "Sunday", "Monday"]);
  assert.deepEqual(schemaEntry("markers").options,
    ["Major dates", "Major + traditional", "Off"]);
  assert.deepEqual(schemaEntry("barMarker").options, ["Off", "Dot", "Name"]);
  assert.deepEqual(schemaEntry("panelPosition").options, ["Anchored", "Centered"]);
  assert.equal(schemaEntry("autoUpdate").defaultValue, true);

  const dayOffset = schemaEntry("dayOffset");
  assert.equal(dayOffset.min, -2);
  assert.equal(dayOffset.max, 2);
  assert.equal(dayOffset.step, 1);
});

test("documents the exact generated calendar revision and range", () => {
  const lastDay = calendarData.monthLengths.at(-1).months[11];
  const isoDate = parts => parts
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
    .join("-");
  const expected = `- Current bundled data: revision ${calendarData.revision}; ` +
    `Hijri ${calendarData.firstHijriYear}-01-01–` +
    `${calendarData.lastHijriYear}-12-${lastDay} AH; ` +
    `Gregorian ${isoDate(calendarData.firstGregorian)}–` +
    `${isoDate(calendarData.lastGregorian)}.`;
  assert.ok(readme.includes(expected));
});
