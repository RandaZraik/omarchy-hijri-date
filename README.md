# Hijri Date for Omarchy

A multilingual Umm al-Qura Hijri date and calendar for the Omarchy bar.

<p align="center">
  <img src="preview.png" width="681" alt="Hijri date in the Omarchy bar with its anchored Arabic calendar, Gregorian dates, and Islamic occasion markers">
</p>

## Install

```bash
omarchy plugin add https://github.com/RandaZraik/omarchy-hijri-date.git --enable
```

Place it immediately before the built-in clock:

```bash
omarchy bar move io.github.randazraik.hijri-date --before omarchy.clock
```

Replace `omarchy.clock` if you use a custom clock ID.

## Features

- Arabic, English, Turkish, and Bengali dates with native or Latin numerals
- Full, compact, numeric, and month/day bar formats
- Optional weekday and Islamic occasion beside the bar date
- Localized Hijri calendar with Gregorian dates in every cell
- Major and opt-in traditional Islamic occasion markers
- Configurable week start and `−2` to `+2` local adjustment
- Anchored or centered popup on horizontal and vertical bars
- Mouse and keyboard controls

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
omarchy bar set io.github.randazraik.hijri-date barMarker Name
```

`Auto` language follows the desktop locale and falls back to English. On a
vertical bar, both `Dot` and `Name` use a compact dot.

## Controls

- Left click: open or close the calendar
- Right click: cycle the bar format
- Click a day: select it and show its occasion
- Left/right or `H`/`L`: change month
- Up/down or `K`/`J`: change year
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
- Traditional dates vary between communities; the local adjustment shifts the
  date and its markers together.

## Calendar data

- Uses KACST's official [Umm al-Qura Calendar](https://www.ummulqura.org.sa/en/annual-reference)
  and [date-conversion API](https://umqserv.kacst.gov.sa/api/v1/DateConversion/GetHijriMonthLengths).
<!-- BEGIN GENERATED CALENDAR RANGE -->
- Current bundled data: revision 1; Hijri 1318-01-01–1500-12-30 AH; Gregorian 1900-04-30–2077-11-16.
<!-- END GENERATED CALENDAR RANGE -->
- Calendar updates are optional; the bundled calendar remains available without
  internet.
- Use `dayOffset` if your local authority announces a different month start.

## Update or remove

Update the plugin:

```bash
omarchy plugin update io.github.randazraik.hijri-date
```

Remove it:

```bash
omarchy plugin remove io.github.randazraik.hijri-date
```

## License and attribution

MIT licensed. Calendar data is provided by KACST's Umm al-Qura Calendar
service.
