import QtQuick
import Quickshell
import qs.Commons
import qs.Ui
import "../lib/Model.js" as Model

Panel {
  id: root
  moduleName: "io.github.randazraik.hijri-date"
  ipcTarget: "io.github.randazraik.hijri-date"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  property date today: new Date()
  property string mode: "calendar"
  readonly property var barIdentity: hostWidget || root
  readonly property var settingDefaults: hostWidget ? hostWidget.settingDefaults : Model.settingsDefaults()
  readonly property int calendarRevision: hostWidget && "calendarRevision" in hostWidget
    ? hostWidget.calendarRevision : Model.CALENDAR_REVISION
  readonly property int minHijriYear: {
    root.calendarRevision
    return Model.MIN_HIJRI_YEAR
  }
  readonly property int maxHijriYear: {
    root.calendarRevision
    return Model.MAX_HIJRI_YEAR
  }

  readonly property string language: hostWidget ? hostWidget.language
    : Model.normalizeLanguage(setting("language", settingDefaults.language), Qt.locale().name)
  readonly property string numerals: hostWidget ? hostWidget.numerals
    : Model.normalizeNumerals(setting("numerals", settingDefaults.numerals))
  readonly property int dayOffset: hostWidget ? hostWidget.dayOffset
    : Model.clampOffset(setting("dayOffset", settingDefaults.dayOffset))
  readonly property string configuredFont: hostWidget ? hostWidget.configuredFont
    : String(setting("fontFamily", settingDefaults.fontFamily))
  readonly property int firstDay: Model.normalizeWeekStart(
    setting("weekStart", settingDefaults.weekStart), Qt.locale().firstDayOfWeek)
  readonly property string markerMode: hostWidget ? hostWidget.markerMode
    : Model.normalizeMarkerMode(setting("markers", settingDefaults.markers))
  readonly property bool centerPanel: Model.normalizePanelPosition(
    setting("panelPosition", settingDefaults.panelPosition)) === "Centered"
  readonly property var todayHijri: {
    root.calendarRevision
    return Model.hijriForDate(today, dayOffset)
  }
  readonly property var todayGregorian: Model.gregorianForDate(today)
  readonly property var weekdays: Model.weekdayOrder(firstDay)
  readonly property var cells: {
    root.calendarRevision
    return Model.monthGrid(viewYear, viewMonth, firstDay, dayOffset, todayHijri)
  }
  readonly property real yearDone: Model.hijriYearProgress(todayHijri)
  readonly property int yearDonePercent: Math.round(yearDone * 100)

  property int viewYear: todayHijri.valid ? todayHijri.year : 1448
  property int viewMonth: todayHijri.valid ? todayHijri.month : 1
  property int selectedYear: todayHijri.valid ? todayHijri.year : 1448
  property int selectedMonth: todayHijri.valid ? todayHijri.month : 1
  property int selectedDay: todayHijri.valid ? todayHijri.day : 1
  property int selectedRjd: todayGregorian.valid
    ? Model.gregorianToRjd(todayGregorian.year, todayGregorian.month, todayGregorian.day) : 0

  readonly property var selectedGregorian: {
    root.calendarRevision
    return Model.gregorianForAdjustedHijri(
      selectedYear, selectedMonth, selectedDay, dayOffset)
  }
  readonly property var selectedHijri: ({
    valid: selectedGregorian.valid === true,
    year: selectedYear,
    month: selectedMonth,
    day: selectedDay,
    weekday: selectedGregorian.weekday
  })
  readonly property var selectedObservances: Model.observancesFor(
    selectedYear, selectedMonth, selectedDay, markerMode, language)
  readonly property string selectedHijriText: Model.formatHijri(selectedHijri, {
    language: language,
    numerals: numerals,
    format: "Full",
    showWeekday: true
  })
  readonly property bool viewingToday: todayHijri.valid
    && viewYear === todayHijri.year && viewMonth === todayHijri.month
  readonly property bool canGoBack: viewYear > minHijriYear || viewMonth > 1
  readonly property bool canGoForward: viewYear < maxHijriYear || viewMonth < 12
  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property color accentColor: Color.accent
  readonly property color mutedForeground: Util.alpha(contentForeground, 0.72)
  readonly property color faintForeground: Util.alpha(contentForeground, 0.50)
  readonly property color dividerColor: Util.alpha(contentForeground, 0.20)
  readonly property string contentFont: configuredFont !== ""
    ? configuredFont : (bar ? bar.fontFamily : Style.font.family)

  readonly property int cellWidth: Style.space(70)
  readonly property int cellHeight: Style.space(52)
  readonly property int cellSpacing: Style.space(2)
  readonly property int gridWidth: cellWidth * 7 + cellSpacing * 6

  function refresh() {
    today = new Date()
    goToToday()
  }

  function goToToday() {
    if (!todayHijri.valid) return
    viewYear = todayHijri.year
    viewMonth = todayHijri.month
    selectDay(todayHijri.day)
  }

  function selectDay(day) {
    selectedYear = viewYear
    selectedMonth = viewMonth
    selectedDay = day
    var gregorian = Model.gregorianForAdjustedHijri(
      selectedYear, selectedMonth, selectedDay, dayOffset)
    selectedRjd = gregorian.valid
      ? Model.gregorianToRjd(gregorian.year, gregorian.month, gregorian.day) : 0
  }

  function selectCivilDay(rjd) {
    var adjusted = Model.rjdToGregorian(rjd + dayOffset)
    var hijri = Model.gregorianToHijri(adjusted.year, adjusted.month, adjusted.day)
    if (!hijri.valid) {
      goToToday()
      return
    }
    viewYear = hijri.year
    viewMonth = hijri.month
    selectedYear = hijri.year
    selectedMonth = hijri.month
    selectedDay = hijri.day
    selectedRjd = rjd
  }

  function moveMonth(delta) {
    var next = Model.stepHijriMonth(viewYear, viewMonth, delta)
    if (next.year < minHijriYear || next.year > maxHijriYear) return
    viewYear = next.year
    viewMonth = next.month
    selectDay(1)
  }

  function moveYear(delta) {
    moveMonth(delta * 12)
  }

  function copySelectedHijri() {
    var value = selectedHijriText
    if (!value) return
    Quickshell.clipboardText = value
  }

  function open() {
    mode = "calendar"
    refresh()
    root.controller.show()
  }

  function openCalendar() {
    mode = "calendar"
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function openSettings() {
    if (mode === "settings") return
    mode = "settings"
    Qt.callLater(function() { settingsPane.focusFirst() })
  }

  function close() {
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  onCalendarRevisionChanged: Qt.callLater(function() {
    if (!root.opened) root.goToToday()
    else if (root.selectedRjd > 0) root.selectCivilDay(root.selectedRjd)
    else root.goToToday()
  })
  onDayOffsetChanged: Qt.callLater(function() {
    if (root.selectedRjd > 0) root.selectCivilDay(root.selectedRjd)
  })

  SystemClock {
    id: clock
    precision: SystemClock.Minutes
    onDateChanged: {
      if (date.getFullYear() === root.today.getFullYear()
          && date.getMonth() === root.today.getMonth()
          && date.getDate() === root.today.getDate()) return
      var followToday = root.viewingToday
      root.today = date
      if (followToday) root.goToToday()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: root.centerPanel
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(root.gridWidth + panel.padding * 2 + Style.space(18))
    contentHeight: root.mode === "calendar"
      ? panel.fittedContentHeight(contentColumn.implicitHeight)
      : panel.cappedContentHeight(Style.space(680))

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      blocked: root.mode === "settings"
      onMoveRequested: function(dx, dy) {
        if (dx !== 0) root.moveMonth(dx)
        if (dy !== 0) root.moveYear(dy)
      }
      onActivateRequested: root.copySelectedHijri()
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(text) {
        if (text === "s" || text === "S") root.openSettings()
        else if (text === "[" || text === "h") root.moveMonth(-1)
        else if (text === "]" || text === "l") root.moveMonth(1)
        else if (text === "{" || text === "k") root.moveYear(-1)
        else if (text === "}" || text === "j") root.moveYear(1)
        else if (text === "t" || text === "T") root.goToToday()
        else if (text === "c" || text === "C") root.copySelectedHijri()
      }

      Flickable {
        visible: root.mode === "calendar"
        anchors.fill: parent
        contentWidth: contentColumn.width
        contentHeight: contentColumn.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        interactive: contentHeight > height || contentWidth > width

        Column {
          id: contentColumn
          width: Math.max(keyCatcher.width, root.gridWidth)
          spacing: Style.space(12)

          Item {
            width: parent.width
            height: heroContent.implicitHeight

            Column {
              id: heroContent
              width: parent.width
              spacing: Style.space(4)

              Row {
                anchors.horizontalCenter: parent.horizontalCenter
                spacing: Style.space(10)

                Text {
                  anchors.verticalCenter: parent.verticalCenter
                  text: "󰃭"
                  color: root.contentForeground
                  font.family: Style.font.family
                  font.pixelSize: Math.round(Style.font.displayLarge * 1.45)
                }

                Text {
                  anchors.verticalCenter: parent.verticalCenter
                  text: Model.formatHijri(root.todayHijri, {
                    language: root.language,
                    numerals: root.numerals,
                    format: "Month and day"
                  })
                  color: root.contentForeground
                  font.family: root.contentFont
                  font.pixelSize: Math.round(Style.font.displayLarge * 1.55)
                  font.bold: true
                }
              }

              Text {
                width: parent.width
                text: Model.formatGregorianLong(root.todayGregorian, root.language, root.numerals)
                color: root.mutedForeground
                font.family: root.contentFont
                font.pixelSize: Style.font.subtitle
                horizontalAlignment: Text.AlignHCenter
              }
            }

            PanelActionButton {
              anchors.top: parent.top
              anchors.right: parent.right
              size: Style.space(34)
              iconText: "󰒓"
              tooltipText: Model.settingText("settings", root.language)
              foreground: root.mutedForeground
              hoverColor: root.accentColor
              fontFamily: Style.font.family
              onClicked: root.openSettings()
            }
          }

          Row {
            anchors.horizontalCenter: parent.horizontalCenter
            width: root.gridWidth
            spacing: Style.space(10)

            Text {
              width: Style.space(68)
              anchors.verticalCenter: parent.verticalCenter
              text: Model.localizeNumber(root.todayHijri.year, root.language, root.numerals)
                + " " + Model.ERAS[root.language]
              color: root.mutedForeground
              font.family: root.contentFont
              font.pixelSize: Style.font.bodySmall
              font.bold: true
              horizontalAlignment: Text.AlignLeft
            }

            Item {
              width: parent.width - Style.space(146)
              height: Style.space(8)
              anchors.verticalCenter: parent.verticalCenter

              Rectangle {
                anchors.fill: parent
                radius: height / 2
                color: root.dividerColor
              }

              Rectangle {
                width: Math.max(height, parent.width * root.yearDone)
                height: parent.height
                radius: height / 2
                color: root.contentForeground
              }
            }

            Text {
              width: Style.space(58)
              anchors.verticalCenter: parent.verticalCenter
              text: Model.localizeNumber(root.yearDonePercent, root.language, root.numerals) + "%"
              color: root.contentForeground
              font.family: root.contentFont
              font.pixelSize: Style.font.bodySmall
              horizontalAlignment: Text.AlignRight
            }
          }

          PanelSeparator {
            foreground: root.contentForeground
            strength: 0.20
          }

          Item {
            width: parent.width
            height: Style.space(36)

            PanelActionButton {
              anchors.left: parent.left
              anchors.verticalCenter: parent.verticalCenter
              iconText: "󰅁"
              tooltipText: "Previous month"
              foreground: root.contentForeground
              fontFamily: Style.font.family
              size: Style.space(30)
              enabled: root.canGoBack
              onClicked: root.moveMonth(-1)
            }

            Row {
              anchors.centerIn: parent
              spacing: Style.space(8)

              Text {
                anchors.verticalCenter: parent.verticalCenter
                text: Model.monthName(root.viewMonth, root.language, false) + " "
                  + Model.localizeNumber(root.viewYear, root.language, root.numerals)
                color: root.contentForeground
                font.family: root.contentFont
                font.pixelSize: Style.font.heading
                font.bold: true
              }

              Button {
                visible: !root.viewingToday
                anchors.verticalCenter: parent.verticalCenter
                text: Model.todayLabel(root.language)
                iconText: "󰃭"
                tooltipText: Model.todayLabel(root.language)
                foreground: root.contentForeground
                fontFamily: root.contentFont
                fontSize: Style.font.bodySmall
                iconSize: Style.font.iconSmall
                bordered: true
                horizontalPadding: Style.space(7)
                verticalPadding: Style.space(3)
                onClicked: root.goToToday()
              }
            }

            PanelActionButton {
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              iconText: "󰅂"
              tooltipText: "Next month"
              foreground: root.contentForeground
              fontFamily: Style.font.family
              size: Style.space(30)
              enabled: root.canGoForward
              onClicked: root.moveMonth(1)
            }
          }

          Grid {
            id: calendarGrid
            width: root.gridWidth
            anchors.horizontalCenter: parent.horizontalCenter
            columns: 7
            columnSpacing: root.cellSpacing
            rowSpacing: root.cellSpacing

            Repeater {
              model: root.weekdays

              Text {
                required property int modelData
                width: root.cellWidth
                height: Style.space(24)
                text: Model.weekdayName(modelData, root.language)
                color: root.mutedForeground
                font.family: root.contentFont
                font.pixelSize: Style.font.bodySmall
                fontSizeMode: Text.Fit
                minimumPixelSize: Style.font.caption
                font.bold: true
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
              }
            }

            Repeater {
              model: root.cells

              Rectangle {
                id: dateCell
                required property var modelData
                readonly property bool selected: modelData.inMonth
                  && root.selectedYear === root.viewYear
                  && root.selectedMonth === root.viewMonth
                  && root.selectedDay === modelData.day
                readonly property var observances: modelData.inMonth
                  ? Model.observancesFor(root.viewYear, root.viewMonth, modelData.day,
                    root.markerMode, root.language)
                  : []
                readonly property bool majorObservance: Model.hasMajorObservance(observances)

                width: root.cellWidth
                height: root.cellHeight
                radius: Style.cornerRadius
                color: selected
                  ? Util.alpha(root.accentColor, 0.16)
                  : cellHover.hovered
                    ? Util.alpha(root.contentForeground, 0.08)
                    : modelData.today
                      ? Util.alpha(root.contentForeground, 0.07)
                      : "transparent"
                border.width: selected || modelData.today ? Style.spacing.hairline : 0
                border.color: selected ? root.accentColor : root.mutedForeground

                Rectangle {
                  visible: dateCell.observances.length > 0
                  anchors.top: parent.top
                  anchors.right: parent.right
                  anchors.margins: Style.space(6)
                  width: Style.space(6)
                  height: width
                  radius: width / 2
                  color: dateCell.majorObservance ? root.accentColor : root.mutedForeground
                }

                Column {
                  anchors.centerIn: parent
                  spacing: Style.space(1)

                  Text {
                    width: root.cellWidth
                    text: dateCell.modelData.inMonth
                      ? Model.localizeNumber(dateCell.modelData.day, root.language, root.numerals)
                      : ""
                    color: root.contentForeground
                    font.family: root.contentFont
                    font.pixelSize: Style.font.title
                    font.bold: dateCell.selected || dateCell.modelData.today === true
                    horizontalAlignment: Text.AlignHCenter
                  }

                  Text {
                    width: root.cellWidth
                    text: dateCell.modelData.inMonth
                      ? Model.gregorianCellLabel(dateCell.modelData.gregorian,
                          root.language, root.numerals)
                      : ""
                    color: root.mutedForeground
                    font.family: root.contentFont
                    font.pixelSize: Style.font.bodySmall
                    horizontalAlignment: Text.AlignHCenter
                  }
                }

                HoverHandler {
                  id: cellHover
                  enabled: dateCell.modelData.inMonth === true
                  cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
                }

                TapHandler {
                  enabled: dateCell.modelData.inMonth === true
                  onTapped: root.selectDay(dateCell.modelData.day)
                }
              }
            }
          }

          Text {
            visible: root.selectedObservances.length > 0
            anchors.horizontalCenter: parent.horizontalCenter
            width: root.gridWidth
            text: Model.observanceSummary(root.selectedObservances)
            color: Model.hasMajorObservance(root.selectedObservances)
              ? root.accentColor : root.contentForeground
            font.family: root.contentFont
            font.pixelSize: Style.font.body
            font.bold: true
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
          }

          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            visible: text !== ""
            text: Model.offsetLabel(root.dayOffset, root.language, root.numerals)
            color: root.faintForeground
            font.family: root.contentFont
            font.pixelSize: Style.font.caption
          }
        }
      }

      SettingsPane {
        id: settingsPane
        visible: root.mode === "settings"
        anchors.fill: parent
        bar: root.bar
        settings: root.settings
        defaults: Model.settingsDefaults()
        fields: Model.settingsFields(root.language)
        title: Model.settingText("settings", root.language)
        applyLabel: Model.settingText("apply", root.language)
        resetLabel: Model.settingText("reset", root.language)
        showBackButton: true
        backTooltip: Model.settingText("calendar", root.language)
        fontFamily: root.contentFont
        foreground: root.contentForeground
        accent: root.accentColor
        rightToLeft: root.language === "ar"
        numberFormatter: function(value) {
          var localized = Model.localizeNumber(Math.abs(value), root.language, root.numerals)
          if (value > 0) return "+" + localized
          if (value < 0) return "−" + localized
          return localized
        }
        onApplyRequested: function(values) {
          if (root.hostWidget) root.hostWidget.saveSettings(values)
        }
        onBackRequested: root.openCalendar()
        onCloseRequested: root.close()
      }
    }
  }
}
