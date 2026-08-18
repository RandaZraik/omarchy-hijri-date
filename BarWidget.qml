import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "lib/Model.js" as Model
import "state" as State

BarWidget {
  id: root
  moduleName: "io.github.randazraik.hijri-date"

  property date displayDate: clock.date
  readonly property int calendarRevision: calendarUpdater.activeRevision
  readonly property var settingDefaults: Model.settingsDefaults()

  readonly property string language: Model.normalizeLanguage(setting("language", settingDefaults.language), Qt.locale().name)
  readonly property string numerals: Model.normalizeNumerals(setting("numerals", settingDefaults.numerals))
  readonly property string configuredFormat: Model.normalizeFormat(setting("format", settingDefaults.format))
  readonly property bool showWeekday: setting("showWeekday", settingDefaults.showWeekday) === true
  readonly property int dayOffset: Model.clampOffset(setting("dayOffset", settingDefaults.dayOffset))
  readonly property string configuredFont: String(setting("fontFamily", settingDefaults.fontFamily))
  readonly property string markerMode: Model.normalizeMarkerMode(setting("markers", settingDefaults.markers))
  readonly property string barMarkerMode: Model.normalizeBarMarker(setting("barMarker", settingDefaults.barMarker))
  readonly property bool automaticUpdates: setting("autoUpdate", settingDefaults.autoUpdate) === true
  readonly property var todayHijri: {
    root.calendarRevision
    return Model.hijriForDate(displayDate, dayOffset)
  }
  readonly property var todayObservances: Model.observancesFor(
    todayHijri.year, todayHijri.month, todayHijri.day, markerMode, language)
  readonly property string dateText: Model.formatHijri(todayHijri, {
    language: language,
    numerals: numerals,
    format: configuredFormat,
    showWeekday: showWeekday,
    vertical: vertical
  })
  readonly property string displayText: Model.formatBarText(
    dateText, todayObservances, barMarkerMode, vertical)
  readonly property var verticalLines: displayText.split("\n")
  readonly property var formatRing: ["Full", "Compact", "Numeric", "Month and day"]

  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false
  readonly property real openPanelIndicatorWidth: button.labelWidth
  readonly property real openPanelIndicatorHeight: Math.max(Style.space(10), Math.round(Style.bar.iconSlot * 0.55))

  function refresh() {
    displayDate = new Date()
    if (panelLoader.item && panelLoader.item.refresh) panelLoader.item.refresh()
  }

  function open() {
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function togglePanel() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  function saveSettings(values) {
    var entry = { id: root.moduleName }
    for (var existing in root.settings) if (existing !== "id") entry[existing] = root.settings[existing]
    for (var key in values) entry[key] = values[key]
    root.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
  }

  function cycleFormat() {
    var current = formatRing.indexOf(configuredFormat)
    saveSettings({ format: formatRing[(current + 1 + formatRing.length) % formatRing.length] })
  }

  function tooltip() {
    var full = Model.formatHijri(todayHijri, {
      language: language,
      numerals: numerals,
      format: "Full",
      showWeekday: true
    })
    var adjustment = Model.offsetLabel(dayOffset, language, numerals)
    var occasions = Model.observanceSummary(todayObservances)
    return full
      + (occasions === "" ? "" : "\n" + occasions)
      + (adjustment === "" ? "" : "\n" + adjustment)
  }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

  State.CalendarUpdater {
    id: calendarUpdater
    automaticUpdates: root.automaticUpdates
  }

  SystemClock {
    id: clock
    precision: SystemClock.Minutes
    onDateChanged: {
      if (date.getFullYear() === root.displayDate.getFullYear()
          && date.getMonth() === root.displayDate.getMonth()
          && date.getDate() === root.displayDate.getDate()) return
      root.displayDate = date
    }
  }

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("ui/Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  IpcHandler {
    target: "io.github.randazraik.hijri-date"

    function refresh(): void { root.broadcast("refresh") }
    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.togglePanel() }
    function cycleFormat(): void { root.cycleFormat() }
    function checkUpdates(): void { calendarUpdater.checkNow(true) }
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.vertical ? "" : root.displayText
    labelVisible: !root.vertical
    hasVisualContent: root.vertical ? root.verticalLines.length > 0 : text !== ""
    fixedHeight: root.vertical ? root.verticalLines.length * Style.bar.iconSlot : -1
    horizontalMargin: 8.75
    verticalPadding: 8.75
    fontFamily: root.configuredFont !== "" ? root.configuredFont : (root.bar ? root.bar.fontFamily : Style.font.family)
    tooltipText: root.tooltip()

    onPressed: function(buttonCode) {
      if (buttonCode === Qt.RightButton) root.cycleFormat()
      else root.togglePanel()
    }

    Column {
      visible: root.vertical
      anchors.fill: parent

      Repeater {
        model: root.verticalLines

        OpticalGlyph {
          required property string modelData
          width: button.width
          height: Style.bar.iconSlot
          text: modelData
          fontFamily: button.fontFamily
          fontSize: modelData.length > 5 ? button.fontSize * 0.82 : button.fontSize
          color: button.foreground
        }
      }
    }
  }
}
