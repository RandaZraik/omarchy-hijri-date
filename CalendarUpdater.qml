import QtQuick
import Quickshell
import Quickshell.Io
import "Model.js" as Model

// Downloads data only. Executable QML always comes from the installed plugin.
QtObject {
  id: root

  property bool automaticUpdates: true
  property int activeRevision: Model.CALENDAR_REVISION
  property var pendingRequest: null
  property var pendingCalendarData: null

  readonly property int maxPayloadBytes: 512 * 1024
  readonly property string remoteUrl:
    "https://raw.githubusercontent.com/RandaZraik/omarchy-hijri-date/master/calendar-data.json"
  readonly property string cachePath: Quickshell.statePath("hijri-date-calendar.json")

  function parsePayload(payload) {
    var raw = String(payload || "")
    if (raw.length === 0 || raw.length > maxPayloadBytes) {
      console.warn("Hijri Date: rejected empty or oversized calendar data")
      return null
    }

    var data
    try {
      data = JSON.parse(raw)
    } catch (error) {
      console.warn("Hijri Date: rejected malformed calendar JSON")
      return null
    }

    var checked = Model.validateCalendarData(data)
    if (!checked.valid) {
      console.warn("Hijri Date: rejected calendar data: " + checked.error)
      return null
    }
    return data
  }

  function applyCalendarData(data) {
    var result = Model.installCalendarData(data)
    if (!result.valid) {
      console.warn("Hijri Date: rejected calendar data: " + result.error)
      return false
    }

    activeRevision = Model.CALENDAR_REVISION
    if (!result.changed) {
      return true
    }

    console.info("Hijri Date: using calendar data revision " + result.revision)
    return true
  }

  function installPayload(payload, persist) {
    var data = parsePayload(payload)
    if (data === null) return false

    if (persist && data.revision > Model.CALENDAR_REVISION) {
      pendingCalendarData = data
      cacheFile.setText(JSON.stringify(data, null, 2) + "\n")
      return true
    }
    return applyCalendarData(data)
  }

  function finishRequest(request, abort) {
    if (!request || pendingRequest !== request) return false
    pendingRequest = null
    requestTimeout.stop()
    Model.finishCalendarUpdate()
    if (abort) request.abort()
    return true
  }

  function cancelRequest() {
    finishRequest(pendingRequest, true)
  }

  function checkNow(force) {
    var manual = force === true
    if ((!automaticUpdates && !manual) || pendingRequest || pendingCalendarData) return false
    if (!Model.claimCalendarUpdate(Date.now(), manual)) return false

    var request
    try {
      request = new XMLHttpRequest()
    } catch (error) {
      Model.finishCalendarUpdate()
      console.info("Hijri Date: using offline calendar data")
      return false
    }
    pendingRequest = request
    request.onreadystatechange = function() {
      if (pendingRequest !== request) return

      if (request.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
        var declaredLength = Number(request.getResponseHeader("Content-Length"))
        if (isFinite(declaredLength) && declaredLength > maxPayloadBytes) {
          finishRequest(request, true)
          console.warn("Hijri Date: rejected oversized calendar response")
        }
        return
      }
      if (request.readyState === XMLHttpRequest.LOADING
          && String(request.responseText || "").length > maxPayloadBytes) {
        finishRequest(request, true)
        console.warn("Hijri Date: rejected oversized calendar response")
        return
      }
      if (request.readyState !== XMLHttpRequest.DONE) return
      finishRequest(request, false)

      if (request.status !== 200) {
        console.info("Hijri Date: using offline calendar data (HTTP " + request.status + ")")
        return
      }
      installPayload(request.responseText, true)
    }

    try {
      request.open("GET", remoteUrl)
      request.send()
      requestTimeout.restart()
      return true
    } catch (error) {
      finishRequest(request, true)
      console.info("Hijri Date: using offline calendar data")
      return false
    }
  }

  property FileView cacheFile: FileView {
    path: root.cachePath
    atomicWrites: true
    watchChanges: true
    printErrors: false
    onLoaded: root.installPayload(text(), false)
    onSaved: {
      var data = root.pendingCalendarData
      root.pendingCalendarData = null
      if (data !== null) root.applyCalendarData(data)
    }
    onSaveFailed: function(error) {
      root.pendingCalendarData = null
      console.warn("Hijri Date: could not save calendar update; keeping offline data")
    }
    onFileChanged: reload()
  }

  property Timer initialCheck: Timer {
    interval: 1500
    running: root.automaticUpdates
    repeat: false
    onTriggered: root.checkNow(false)
  }

  property Timer dailyCheck: Timer {
    interval: Model.CALENDAR_CHECK_INTERVAL_MS + 5000
    running: root.automaticUpdates
    repeat: true
    onTriggered: root.checkNow(false)
  }

  property Timer requestTimeout: Timer {
    interval: 15000
    repeat: false
    onTriggered: {
      root.cancelRequest()
      console.info("Hijri Date: using offline calendar data (update check timed out)")
    }
  }

  onAutomaticUpdatesChanged: {
    if (automaticUpdates) initialCheck.restart()
    else cancelRequest()
  }

  Component.onDestruction: root.cancelRequest()
}
