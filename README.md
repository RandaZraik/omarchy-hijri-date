# Hijri Date for Omarchy

A native, offline-first Omarchy Quattro bar widget for the official KACST
Umm al-Qura calendar. It can update its calendar data without downloading or
executing plugin code.

<p align="center">
  <img src="preview.png" width="681" alt="Hijri date in the Omarchy bar with its anchored Arabic calendar, Gregorian dates, and Islamic occasion markers">
</p>

## Features

- Arabic, English, Turkish, and Bengali dates
- Native or Latin numerals
- Full, compact, numeric, and month/day bar formats
- Optional full weekday and today's occasion beside the bar date
- Localized Hijri calendar with Gregorian dates in every cell
- Major and opt-in traditional Islamic occasion markers
- Saturday, Sunday, Monday, or locale-derived week start
- `−2` to `+2` local crescent-sighting adjustment
- Anchored or centered popup
- Horizontal and vertical Omarchy bars
- Mouse, keyboard, and shell IPC controls

## Install

```bash
omarchy plugin add https://github.com/RandaZraik/omarchy-hijri-date.git --enable
```

Place it immediately before the built-in clock:

```bash
omarchy bar move io.github.randazraik.hijri-date --before omarchy.clock
```

Replace `omarchy.clock` if you use a custom clock ID.

## Options

| Setting | Key | Choices |
| --- | --- | --- |
| Language | `language` | Auto, English, العربية, Türkçe, বাংলা |
| Numerals | `numerals` | Native, Latin |
| Bar format | `format` | Full, Compact, Numeric, Month and day |
| Show weekday | `showWeekday` | On, Off |
| Automatic calendar updates | `autoUpdate` | On, Off |
| Local adjustment | `dayOffset` | `−2` through `+2` days |
| Week starts on | `weekStart` | Auto, Saturday, Sunday, Monday |
| Calendar markers | `markers` | Major dates, Major + traditional, Off |
| Today's marker in bar | `barMarker` | Off, Dot, localized Name |
| Panel position | `panelPosition` | Anchored, Centered |
| Font family | `fontFamily` | Empty to inherit Omarchy, or any installed font |

Configure through the bar editor or CLI:

```bash
omarchy bar set io.github.randazraik.hijri-date language العربية
omarchy bar set io.github.randazraik.hijri-date numerals Latin
omarchy bar set io.github.randazraik.hijri-date barMarker Name
omarchy bar set io.github.randazraik.hijri-date dayOffset 1
```

`Auto` language follows the desktop locale and falls back to English. On a
vertical bar, both `Dot` and `Name` use a compact dot.

## Controls

- Left click: open or close the calendar
- Right click: cycle the bar format
- Click a day: select it and show its occasion
- Left/right or `H`/`L`: previous/next month
- Up/down or `K`/`J`: previous/next year
- `T`: return to today
- `C` or Enter: copy the selected Hijri date
- Escape: close
- Tab/Shift+Tab: move between neighboring bar panels

## Markers

Major dates use the accent dot:

- Islamic New Year — رأس السنة الهجرية
- Ashura — عاشوراء
- Ramadan begins — بداية رمضان
- Eid al-Fitr — عيد الفطر
- Day of Arafah — يوم عرفة
- Eid al-Adha — عيد الأضحى
- Days of Tashriq — أيام التشريق

The optional traditional tier uses a muted dot and also includes:

- Mawlid — المولد النبوي
- Isra and Mi'raj — الإسراء والمعراج
- Mid-Sha'ban — ليلة النصف من شعبان
- 27th night of Ramadan — ليلة ٢٧ من رمضان
- White Days — الأيام البيض

- Select a marked day to see its localized name below the grid.
- Set `barMarker` to `Dot` or `Name` to show today's occasion beside the date.
- Traditional dates vary between communities; markers are reminders, not rulings.
- The local day adjustment moves the date, calendar, and markers together.

## Accuracy

- Calendar: exact month tables, not an approximate arithmetic formula.
- Authority: KACST's official [Umm al-Qura Calendar](https://www.ummulqura.org.sa/en/annual-reference) and [date-conversion API](https://umqserv.kacst.gov.sa/api/v1/DateConversion/GetHijriMonthLengths).
<!-- BEGIN GENERATED CALENDAR RANGE -->
- Current bundled data: revision 1; Hijri 1318-01-01–1500-12-30 AH; Gregorian 1900-04-30–2077-11-16.
<!-- END GENERATED CALENDAR RANGE -->
- Verification: CI derives and checks every declared year start and month boundary, the official conversion anchors, and every supported day in both directions.
- Offline behavior: the bundled KACST table works immediately with no internet.
- Marker behavior: fixed Hijri occasions recur automatically and follow the selected calendar date and local adjustment; they do not need annual edits.
- Local sightings: if an authority announces a different religious month start, the user changes `dayOffset`; the plugin author does not patch that year's calendar.
- Religious decisions: the Saudi Supreme Court, for example, [requests sighting reports before announcing Ramadan](https://www.spa.gov.sa/en/N2512732).

## Updates

- Calendar data updates automatically when online and continues working from bundled or last-known-good data when offline.
- Code and UI updates remain user-controlled:

```bash
omarchy plugin update io.github.randazraik.hijri-date
```

## Privacy

- Network access is limited to calendar data from `raw.githubusercontent.com`
- The only stored data is the validated calendar cache in Quickshell's state directory
- No analytics, subprocesses, shell commands, downloaded code, or elevated privileges
- Clipboard access only after `C` or Enter
- Community plugins run unsandboxed inside `omarchy-shell`; review before enabling

## Remove

```bash
omarchy plugin remove io.github.randazraik.hijri-date
```

## License and attribution

MIT licensed. Calendar data is attributed above to KACST's official Umm
al-Qura Calendar service.

<!-- temporary calendar automation PR test; do not merge -->
