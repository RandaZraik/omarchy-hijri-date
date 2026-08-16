// Offline Umm al-Qura calendar conversion and presentation helpers.
//
// Month lengths are pinned from KACST's official Umm al-Qura API, retrieved
// 2026-08-16. See README.md and tests/official-references.json for provenance.

var MIN_GREGORIAN = { year: 1900, month: 4, day: 30 }
var MAX_GREGORIAN = { year: 2077, month: 11, day: 16 }
var MIN_HIJRI_YEAR = 1318
var MAX_HIJRI_YEAR = 1500
var HIJRI_OFFSET = 1317 * 12
var FIRST_MONTH_RJD = 15140
var UNIX_EPOCH_RJD = 40588
var DAY_MS = 86400000

// Each character is the exact length of one Hijri month minus 28 (1 = 29
// days, 2 = 30 days). Keeping lengths instead of 2,197 full month-start
// values is compact without approximating any boundary.
var MONTH_LENGTH_CODES =
  "2122122121211212212122121211212122212121121122221212111212221221211121221221212112122121221212121121" +
  "2212122121121212212212112112221221211211221222121121122122122112121212122121221121122122122111212122" +
  "2121212112122122121211212122212121121212122122112121212122212112112122221211211212221221112121221221" +
  "2112121212212121221121212122212112112122221211211212221221121121221222112112122122121212121122122121" +
  "2121121221221212112121222121121212122122121121122122122112121212122211212112122212121211212212212121" +
  "1122122212121121212212211212121212212121212121212122121211212122221121121212221212112121221221211212" +
  "1212221121212121221212212112121212221211212121222112121121222121212112122122121211212122122121211212" +
  "1222121211211222122121112122122212111212212212121212121212122121211212122122121121122212212112112212" +
  "2212112112212221211211221221212121212121221212121211221221221121121222121212112122122121211212122122" +
  "1211212121222121121212122122121121122122122112112122122211121212212212112121212212122121121212122212" +
  "1121121222212112112122212211211212212212121121212221211221121221212212112121212221212112112222121211" +
  "2112221221211211221221221121212121222112121121222121212112122122121211212122212121121212212211212121" +
  "2122121212121212121222111211212222121121112222122112111222122121211212122122121121212122121221211212" +
  "1221221211212122122121121122212212112112212212211212121212212121211212221212121121221221212112121221" +
  "2211212121212212121212121212212211212112212221121121212221212112121222121211212122122121121212122121" +
  "2121212121221212211212121222121121121222122112112122212121211212212212121121212212212121121212212221" +
  "1211221221221121121221221212112121221221212112122121221211212121222121121121222212112112122212211211" +
  "2122122121211212122121212211212122121221121212122212121121122212212112112212221211121221221221121212" +
  "1212212121211212212212121121221221212112121221221211212122121212211212121221221121211221222112112121" +
  "2221212112112222121211212122122121121212122121212121212121221212121121222212112112122212211211212221" +
  "2121211212212212121121212212212121121212212212112121212221211212121221221121211221221212121122121221" +
  "212121121222121212111222122121121122122212112112212212121212121212212121212112212122121211212122"

var MONTHS = {
  en: ["Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani", "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qa'dah", "Dhu al-Hijjah"],
  ar: ["محرم", "صفر", "ربيع الأول", "ربيع الثاني", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"],
  tr: ["Muharrem", "Safer", "Rebiülevvel", "Rebiülahir", "Cemaziyelevvel", "Cemaziyelahir", "Recep", "Şaban", "Ramazan", "Şevval", "Zilkade", "Zilhicce"],
  bn: ["মুহাররম", "সফর", "রবিউল আউয়াল", "রবিউস সানী", "জুমাদাল উলা", "জুমাদাস সানী", "রজব", "শাবান", "রমজান", "শাওয়াল", "জিলক্বদ", "জিলহজ"]
}

var SHORT_MONTHS = {
  en: ["Muh", "Saf", "Rab I", "Rab II", "Jum I", "Jum II", "Raj", "Sha", "Ram", "Shaw", "Dhu Q", "Dhu H"],
  ar: ["محرم", "صفر", "ر.أ", "ر.ث", "ج.أ", "ج.ث", "رجب", "شعبان", "رمضان", "شوال", "قعدة", "حجة"],
  tr: ["Muh", "Saf", "Reb I", "Reb II", "Cem I", "Cem II", "Rec", "Şab", "Ram", "Şev", "Zil K", "Zil H"],
  bn: ["মুহ", "সফ", "রবি আ", "রবি সা", "জুমা উ", "জুমা সা", "রজ", "শাব", "রম", "শাও", "জিল ক", "জিল হ"]
}

// Sunday-first to match JavaScript Date.getDay() and Qt Locale weekday values.
var WEEKDAYS = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  ar: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  tr: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
  bn: ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"]
}

var GREGORIAN_MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  tr: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
  bn: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"]
}

// Explicit labels avoid cutting a localized name in the middle of a grapheme.
var SHORT_GREGORIAN_MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ar: ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"],
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
  bn: ["জানু", "ফেব", "মার্চ", "এপ্রি", "মে", "জুন", "জুল", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"]
}

var ERAS = { en: "AH", ar: "هـ", tr: "Hicri", bn: "হিজরি" }
var NATIVE_DIGITS = {
  ar: "٠١٢٣٤٥٦٧٨٩",
  bn: "০১২৩৪৫৬৭৮৯"
}

var OBSERVANCE_NAMES = {
  newYear: {
    en: "Islamic New Year", ar: "رأس السنة الهجرية", tr: "Hicri Yılbaşı", bn: "ইসলামি নববর্ষ"
  },
  ashura: {
    en: "Ashura", ar: "عاشوراء", tr: "Aşure Günü", bn: "আশুরা"
  },
  mawlid: {
    en: "Mawlid", ar: "المولد النبوي", tr: "Mevlid Kandili", bn: "ঈদে মিলাদুন্নবী"
  },
  israMiraj: {
    en: "Isra and Mi'raj", ar: "الإسراء والمعراج", tr: "Miraç Kandili", bn: "শবে মেরাজ"
  },
  midShaban: {
    en: "Mid-Sha'ban", ar: "ليلة النصف من شعبان", tr: "Berat Kandili", bn: "শবে বরাত"
  },
  ramadan: {
    en: "Ramadan begins", ar: "بداية رمضان", tr: "Ramazan başlangıcı", bn: "রমজানের শুরু"
  },
  ramadan27: {
    en: "27th night of Ramadan", ar: "ليلة ٢٧ من رمضان", tr: "Ramazan'ın 27. gecesi", bn: "রমজানের ২৭তম রাত"
  },
  eidFitr: {
    en: "Eid al-Fitr", ar: "عيد الفطر", tr: "Ramazan Bayramı", bn: "ঈদুল ফিতর"
  },
  arafah: {
    en: "Day of Arafah", ar: "يوم عرفة", tr: "Arefe Günü", bn: "আরাফার দিন"
  },
  eidAdha: {
    en: "Eid al-Adha", ar: "عيد الأضحى", tr: "Kurban Bayramı", bn: "ঈদুল আজহা"
  },
  tashriq: {
    en: "Days of Tashriq", ar: "أيام التشريق", tr: "Teşrik Günleri", bn: "আইয়ামে তাশরিক"
  },
  whiteDays: {
    en: "White Days", ar: "الأيام البيض", tr: "Eyyâm-ı Bîd", bn: "আইয়ামে বীজ"
  }
}

var FIXED_OBSERVANCES = [
  { month: 1, day: 1, key: "newYear", tier: "major" },
  { month: 1, day: 10, key: "ashura", tier: "major" },
  { month: 3, day: 12, key: "mawlid", tier: "traditional" },
  { month: 7, day: 27, key: "israMiraj", tier: "traditional" },
  { month: 8, day: 15, key: "midShaban", tier: "traditional" },
  { month: 9, day: 1, key: "ramadan", tier: "major" },
  { month: 9, day: 27, key: "ramadan27", tier: "traditional" },
  { month: 10, day: 1, key: "eidFitr", tier: "major" },
  { month: 12, day: 9, key: "arafah", tier: "major" },
  { month: 12, day: 10, key: "eidAdha", tier: "major" },
  { month: 12, day: 11, key: "tashriq", tier: "major" },
  { month: 12, day: 12, key: "tashriq", tier: "major" },
  { month: 12, day: 13, key: "tashriq", tier: "major" }
]

var _monthStarts = null

function monthStarts() {
  if (_monthStarts !== null) return _monthStarts
  var starts = [FIRST_MONTH_RJD]
  for (var i = 0; i < MONTH_LENGTH_CODES.length; i++)
    starts.push(starts[i] + 28 + Number(MONTH_LENGTH_CODES.charAt(i)))
  _monthStarts = starts
  return _monthStarts
}

function compareParts(a, b) {
  if (a.year !== b.year) return a.year < b.year ? -1 : 1
  if (a.month !== b.month) return a.month < b.month ? -1 : 1
  if (a.day !== b.day) return a.day < b.day ? -1 : 1
  return 0
}

function inGregorianRange(year, month, day) {
  var value = { year: year, month: month, day: day }
  return compareParts(value, MIN_GREGORIAN) >= 0 && compareParts(value, MAX_GREGORIAN) <= 0
}

function gregorianToRjd(year, month, day) {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS) + UNIX_EPOCH_RJD
}

function rjdToGregorian(rjd) {
  var date = new Date((rjd - UNIX_EPOCH_RJD) * DAY_MS)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: date.getUTCDay()
  }
}

function upperBound(values, target) {
  var low = 0
  var high = values.length
  while (low < high) {
    var middle = Math.floor((low + high) / 2)
    if (values[middle] <= target) low = middle + 1
    else high = middle
  }
  return low
}

function gregorianToHijri(year, month, day) {
  if (!inGregorianRange(year, month, day))
    return { valid: false, error: "Gregorian date is outside the supported range" }

  var rjd = gregorianToRjd(year, month, day)
  var starts = monthStarts()
  var index = upperBound(starts, rjd) - 1
  var elapsedMonths = index + HIJRI_OFFSET
  var elapsedYears = Math.floor(elapsedMonths / 12)
  return {
    valid: true,
    year: elapsedYears + 1,
    month: elapsedMonths - elapsedYears * 12 + 1,
    day: rjd - starts[index] + 1,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  }
}

function hijriMonthIndex(year, month) {
  return ((year - 1) * 12 + month - 1) - HIJRI_OFFSET
}

function hijriMonthLength(year, month) {
  var index = hijriMonthIndex(year, month)
  var starts = monthStarts()
  if (index < 0 || index + 1 >= starts.length) return 0
  return starts[index + 1] - starts[index]
}

function hijriYearLength(year) {
  var total = 0
  for (var month = 1; month <= 12; month++) total += hijriMonthLength(year, month)
  return total
}

function hijriDayOfYear(parts) {
  if (!parts || !parts.valid) return 0
  var total = parts.day
  for (var month = 1; month < parts.month; month++) total += hijriMonthLength(parts.year, month)
  return total
}

function hijriYearProgress(parts) {
  var length = parts && parts.valid ? hijriYearLength(parts.year) : 0
  return length > 0 ? hijriDayOfYear(parts) / length : 0
}

function hijriToGregorian(year, month, day) {
  if (year < MIN_HIJRI_YEAR || year > MAX_HIJRI_YEAR || month < 1 || month > 12)
    return { valid: false, error: "Hijri date is outside the supported range" }
  var index = hijriMonthIndex(year, month)
  var length = hijriMonthLength(year, month)
  if (length === 0 || day < 1 || day > length)
    return { valid: false, error: "Invalid Hijri day" }
  var result = rjdToGregorian(monthStarts()[index] + day - 1)
  result.valid = true
  return result
}

function clampOffset(value) {
  var parsed = Math.round(Number(value))
  if (!isFinite(parsed)) return 0
  return Math.max(-2, Math.min(2, parsed))
}

function adjustedLocalParts(date, offset) {
  var shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate() + clampOffset(offset))
  return { year: shifted.getFullYear(), month: shifted.getMonth() + 1, day: shifted.getDate() }
}

function hijriForDate(date, offset) {
  var parts = adjustedLocalParts(date, offset)
  var hijri = gregorianToHijri(parts.year, parts.month, parts.day)
  // A local adjustment changes the Hijri label assigned to this civil day;
  // it does not turn Sunday into Monday. Keep the actual local weekday.
  if (hijri.valid) hijri.weekday = date.getDay()
  return hijri
}

function gregorianForDate(date) {
  return {
    valid: true,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    weekday: date.getDay()
  }
}

function gregorianForAdjustedHijri(year, month, day, offset) {
  var base = hijriToGregorian(year, month, day)
  if (!base.valid) return base
  var result = rjdToGregorian(gregorianToRjd(base.year, base.month, base.day) - clampOffset(offset))
  result.valid = true
  return result
}

function normalizeLanguage(setting, localeName) {
  var value = String(setting || "Auto")
  if (value === "العربية" || value === "Arabic") return "ar"
  if (value === "Türkçe" || value === "Turkish") return "tr"
  if (value === "বাংলা" || value === "Bengali") return "bn"
  if (value === "English") return "en"
  var locale = String(localeName || "").toLowerCase()
  if (locale.indexOf("ar") === 0) return "ar"
  if (locale.indexOf("tr") === 0) return "tr"
  if (locale.indexOf("bn") === 0) return "bn"
  return "en"
}

function normalizeEnum(value, allowed, fallback) {
  var candidate = String(value === undefined || value === null ? "" : value)
  return allowed.indexOf(candidate) >= 0 ? candidate : fallback
}

function normalizeNumerals(value) {
  return normalizeEnum(value, ["Native", "Latin"], "Native")
}

function normalizeFormat(value) {
  return normalizeEnum(value, ["Full", "Compact", "Numeric", "Month and day"], "Full")
}

function normalizeMarkerMode(value) {
  return normalizeEnum(value, ["Major dates", "Major + traditional", "Off"], "Major dates")
}

function normalizeBarMarker(value) {
  return normalizeEnum(value, ["Off", "Dot", "Name"], "Off")
}

function normalizePanelPosition(value) {
  return normalizeEnum(value, ["Anchored", "Centered"], "Anchored")
}

function localizeNumber(value, language, numeralSetting, minDigits) {
  var raw = String(Math.abs(Math.trunc(Number(value))))
  while (raw.length < (minDigits || 0)) raw = "0" + raw
  if (Number(value) < 0) raw = "-" + raw
  if (normalizeNumerals(numeralSetting) === "Latin") return raw
  var digits = NATIVE_DIGITS[language]
  if (!digits) return raw
  return raw.replace(/[0-9]/g, function(digit) { return digits.charAt(Number(digit)) })
}

function monthName(month, language, shortName) {
  var names = shortName ? SHORT_MONTHS[language] : MONTHS[language]
  if (!names) names = shortName ? SHORT_MONTHS.en : MONTHS.en
  return names[month - 1] || ""
}

function weekdayName(weekday, language) {
  var names = WEEKDAYS[language] || WEEKDAYS.en
  return names[weekday] || ""
}

function formatHijri(hijri, options) {
  if (!hijri || !hijri.valid) return "Hijri date unavailable"
  options = options || {}
  var language = options.language || "en"
  var numerals = options.numerals || "Native"
  var format = normalizeFormat(options.format)
  var day = localizeNumber(hijri.day, language, numerals)
  var month = localizeNumber(hijri.month, language, numerals, 2)
  var year = localizeNumber(hijri.year, language, numerals)
  var text

  if (options.vertical === true) {
    text = day + "\n" + monthName(hijri.month, language, true)
  } else if (format === "Numeric") {
    text = day + "/" + month + "/" + year
  } else if (format === "Month and day") {
    text = day + " " + monthName(hijri.month, language, false)
  } else if (format === "Compact") {
    text = day + " " + monthName(hijri.month, language, true) + " " + year
  } else {
    text = day + " " + monthName(hijri.month, language, false) + " " + year + " " + ERAS[language]
  }

  if (options.showWeekday === true && options.vertical !== true)
    text = weekdayName(hijri.weekday, language) + (language === "ar" ? "، " : ", ") + text
  return text
}

function formatGregorian(parts, language, numerals) {
  if (!parts || parts.valid === false) return ""
  var day = localizeNumber(parts.day, language, numerals)
  var year = localizeNumber(parts.year, language, numerals)
  var month = gregorianMonthName(parts.month, language, false)
  return day + " " + month + " " + year
}

function formatGregorianLong(parts, language, numerals) {
  if (!parts || parts.valid === false) return ""
  var separator = language === "ar" ? "، " : ", "
  return weekdayName(parts.weekday, language) + separator
    + formatGregorian(parts, language, numerals)
}

function gregorianMonthName(month, language, shortName) {
  var table = shortName ? SHORT_GREGORIAN_MONTHS : GREGORIAN_MONTHS
  var names = table[language] || table.en
  return names[month - 1] || ""
}

function normalizeWeekStart(setting, localeFirstDay) {
  var value = String(setting || "Auto")
  if (value === "Saturday") return 6
  if (value === "Sunday") return 0
  if (value === "Monday") return 1
  var fallback = Number(localeFirstDay)
  return fallback >= 0 && fallback <= 6 ? fallback : 0
}

function weekdayOrder(firstDay) {
  var result = []
  for (var i = 0; i < 7; i++) result.push((firstDay + i) % 7)
  return result
}

function stepHijriMonth(year, month, delta) {
  var absolute = year * 12 + month - 1 + delta
  return { year: Math.floor(absolute / 12), month: ((absolute % 12) + 12) % 12 + 1 }
}

function monthGrid(year, month, firstDay, offset, todayHijri) {
  var length = hijriMonthLength(year, month)
  if (length === 0) return []
  var firstGregorian = gregorianForAdjustedHijri(year, month, 1, offset)
  var leading = (firstGregorian.weekday - firstDay + 7) % 7
  var cells = []
  var i
  for (i = 0; i < leading; i++) cells.push({ inMonth: false })
  for (i = 1; i <= length; i++) {
    var gregorian = gregorianForAdjustedHijri(year, month, i, offset)
    cells.push({
      inMonth: true,
      day: i,
      gregorian: gregorian,
      today: todayHijri && todayHijri.valid && todayHijri.year === year && todayHijri.month === month && todayHijri.day === i
    })
  }
  while (cells.length % 7 !== 0) cells.push({ inMonth: false })
  return cells
}

function gregorianCellLabel(parts, language, numerals) {
  if (!parts || parts.valid === false) return ""
  var day = localizeNumber(parts.day, language, numerals)
  if (parts.day === 1) return day + " " + gregorianMonthName(parts.month, language, true)
  return day
}

function offsetLabel(offset, language, numerals) {
  var value = clampOffset(offset)
  if (value === 0) return ""
  var sign = value > 0 ? "+" : "−"
  var amount = localizeNumber(Math.abs(value), language, numerals)
  if (language === "ar") return "تعديل محلي " + sign + amount + " يوم"
  if (language === "tr") return "Yerel ayar " + sign + amount + " gün"
  if (language === "bn") return "স্থানীয় সমন্বয় " + sign + amount + " দিন"
  return "Local adjustment " + sign + amount + " day" + (Math.abs(value) === 1 ? "" : "s")
}

function todayLabel(language) {
  if (language === "ar") return "اليوم"
  if (language === "tr") return "Bugün"
  if (language === "bn") return "আজ"
  return "Today"
}

function observanceName(key, language) {
  var names = OBSERVANCE_NAMES[key]
  return names ? (names[language] || names.en) : key
}

function observancesFor(year, month, day, mode, language) {
  var selectedMode = normalizeMarkerMode(mode)
  if (selectedMode === "Off") return []
  var includeTraditional = selectedMode === "Major + traditional"
  var result = []
  for (var i = 0; i < FIXED_OBSERVANCES.length; i++) {
    var item = FIXED_OBSERVANCES[i]
    if (item.month !== month || item.day !== day) continue
    if (item.tier === "traditional" && !includeTraditional) continue
    result.push({
      key: item.key,
      tier: item.tier,
      name: observanceName(item.key, language)
    })
  }
  if (includeTraditional && (day === 13 || day === 14 || day === 15)) {
    result.push({ key: "whiteDays", tier: "traditional", name: observanceName("whiteDays", language) })
  }
  return result
}

function observanceSummary(items) {
  if (!items || items.length === 0) return ""
  var names = []
  for (var i = 0; i < items.length; i++) names.push(items[i].name)
  return names.join(" · ")
}

function formatBarText(dateText, items, markerMode, vertical) {
  var mode = normalizeBarMarker(markerMode)
  if (!items || items.length === 0 || mode === "Off") return dateText
  var marker = mode === "Name" && vertical !== true ? observanceSummary(items) : "•"
  return dateText + (vertical === true ? "\n" : "  ") + marker
}

function hasMajorObservance(items) {
  if (!items) return false
  for (var i = 0; i < items.length; i++) if (items[i].tier === "major") return true
  return false
}
