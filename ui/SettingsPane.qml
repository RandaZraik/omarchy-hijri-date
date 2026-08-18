import QtQuick
import QtQuick.Controls
import qs.Commons
import qs.Ui

FocusScope {
  id: root

  property QtObject bar: null
  property var settings: ({})
  property var defaults: ({})
  property var fields: []
  property string title: "Settings"
  property string applyLabel: "Apply"
  property string resetLabel: "Reset"
  property bool showBackButton: false
  property string backTooltip: ""
  property string fontFamily: Style.font.family
  property color foreground: Color.foreground
  property color accent: Color.accent
  property bool rightToLeft: false
  property var numberFormatter: function(value) { return String(value) }

  property var savedValues: ({})
  property var draft: ({})
  property bool editorsActive: false

  readonly property bool dirty: JSON.stringify(draft) !== JSON.stringify(savedValues)
  readonly property var fieldGroups: groupFields(fields)

  signal applyRequested(var values)
  signal backRequested()
  signal closeRequested()

  function groupFields(values) {
    var groups = []
    var source = values || []
    for (var index = 0; index < source.length; index++) {
      var field = source[index]
      var last = groups.length > 0 ? groups[groups.length - 1] : null
      if (!last || last.title !== field.group) {
        last = { title: field.group, fields: [] }
        groups.push(last)
      }
      last.fields.push(field)
    }
    return groups
  }

  function mergedValues(source) {
    var result = Util.cloneJson(defaults || {})
    var current = source || {}
    for (var key in current) {
      if (key !== "id" && result[key] !== undefined) result[key] = current[key]
    }
    return result
  }

  function rebuildEditors() {
    editorsActive = false
    Qt.callLater(function() { root.editorsActive = true })
  }

  function deactivate() {
    editorsActive = false
  }

  function reload() {
    savedValues = mergedValues(settings)
    draft = Util.cloneJson(savedValues)
    rebuildEditors()
  }

  function valueFor(key) {
    return draft && draft[key] !== undefined ? draft[key] : defaults[key]
  }

  function setValue(key, value) {
    if (valueFor(key) === value) return
    var next = Util.cloneJson(draft)
    next[key] = value
    draft = next
  }

  function reset() {
    draft = Util.cloneJson(defaults || {})
    rebuildEditors()
  }

  function apply() {
    if (!dirty) return
    applyRequested(Util.cloneJson(draft))
  }

  function focusFirst() {
    if (!visible) return
    if (!editorsActive || groupRepeater.count === 0) {
      Qt.callLater(root.focusFirst)
      return
    }

    root.forceActiveFocus()
    var first = root.nextItemInFocusChain(true)
    if (first && first !== root) first.forceActiveFocus()
  }

  onSettingsChanged: if (visible) reload()
  onVisibleChanged: visible ? reload() : deactivate()
  Keys.onEscapePressed: root.closeRequested()

  LayoutMirroring.enabled: rightToLeft
  LayoutMirroring.childrenInherit: true

  Item {
    id: header
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.top: parent.top
    height: Style.space(54)

    Row {
      anchors.left: parent.left
      anchors.verticalCenter: parent.verticalCenter
      spacing: Style.space(7)

      PanelActionButton {
        visible: root.showBackButton
        focusable: true
        size: Style.space(32)
        iconText: "󰃭"
        tooltipText: root.backTooltip
        foreground: root.accent
        fontFamily: root.fontFamily
        onClicked: root.backRequested()
      }

      Rectangle {
        width: Style.space(3)
        height: Style.space(25)
        anchors.verticalCenter: parent.verticalCenter
        radius: width / 2
        color: root.accent
      }

      Text {
        anchors.verticalCenter: parent.verticalCenter
        text: root.title
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.heading
        font.bold: true
      }
    }

    Row {
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      spacing: Style.space(6)

      Button {
        height: Style.space(36)
        text: root.resetLabel
        foreground: root.foreground
        fontFamily: root.fontFamily
        bordered: true
        focusable: true
        enabled: root.dirty
        opacity: enabled ? 1 : 0.42
        horizontalPadding: Style.space(10)
        verticalPadding: Style.space(5)
        onClicked: root.reset()
      }

      Button {
        height: Style.space(36)
        text: root.applyLabel
        iconText: "󰄬"
        foreground: root.foreground
        accent: root.accent
        fontFamily: root.fontFamily
        selected: root.dirty
        bordered: true
        focusable: true
        enabled: root.dirty
        opacity: enabled ? 1 : 0.42
        horizontalPadding: Style.space(12)
        verticalPadding: Style.space(5)
        onClicked: root.apply()
      }
    }
  }

  PanelSeparator {
    id: headerSeparator
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.top: header.bottom
    foreground: root.foreground
    strength: 0.2
  }

  Flickable {
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.top: headerSeparator.bottom
    anchors.bottom: parent.bottom
    anchors.topMargin: Style.space(12)
    contentWidth: width
    contentHeight: form.implicitHeight + Style.space(12)
    clip: true
    boundsBehavior: Flickable.StopAtBounds
    interactive: contentHeight > height
    ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }

    Column {
      id: form
      width: parent.width
      spacing: Style.space(14)

      Repeater {
        id: groupRepeater

        model: root.visible && root.editorsActive ? root.fieldGroups : []

        delegate: Rectangle {
          id: groupCard
          required property var modelData
          required property int index
          width: form.width
          height: groupContent.implicitHeight + Style.space(24)
          radius: Style.cornerRadius
          color: Util.alpha(root.foreground, 0.028)
          border.width: 1
          border.color: Util.alpha(root.foreground, 0.16)

          Column {
            id: groupContent

            anchors.fill: parent
            anchors.margins: Style.space(12)
            spacing: Style.space(10)

            Item {
              width: parent.width
              height: Style.space(28)

              Rectangle {
                width: Style.space(3)
                height: Style.space(22)
                anchors.left: parent.left
                anchors.verticalCenter: parent.verticalCenter
                radius: width / 2
                color: Util.alpha(root.accent, 0.92)
              }

              Text {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.leftMargin: Style.space(12)
                anchors.verticalCenter: parent.verticalCenter
                text: groupCard.modelData.title
                color: root.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.subtitle
                font.bold: true
                horizontalAlignment: Text.AlignLeft
                elide: Text.ElideRight
              }
            }

            PanelSeparator {
              width: parent.width
              foreground: root.foreground
              strength: 0.16
            }

            Column {
              width: parent.width
              spacing: Style.space(10)

              Repeater {
                model: groupCard.modelData.fields

                delegate: Column {
                  id: fieldDelegate

                  required property var modelData
                  required property int index

                  width: parent.width
                  spacing: Style.space(10)

                  PanelSeparator {
                    visible: fieldDelegate.index > 0
                    width: parent.width
                    foreground: root.foreground
                    strength: 0.08
                  }

                  Loader {
                    width: parent.width
                    property var field: fieldDelegate.modelData
                    sourceComponent: field.type === "boolean" ? booleanEditor
                      : field.type === "integer" ? integerEditor
                      : field.type === "string" ? stringEditor
                      : enumEditor
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  Component {
    id: enumEditor

    Column {
      id: enumEditorRoot

      width: parent.width
      spacing: Style.space(5)
      readonly property var field: parent.field

      Column {
        width: parent.width
        spacing: Style.space(3)

        Text {
          width: parent.width
          text: enumEditorRoot.field.label
          color: root.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
          font.bold: true
          horizontalAlignment: Text.AlignLeft
        }

        Text {
          visible: text !== ""
          width: parent.width
          text: enumEditorRoot.field.description || ""
          color: Util.alpha(root.foreground, 0.62)
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          wrapMode: Text.WordWrap
          horizontalAlignment: Text.AlignLeft
        }
      }

      Dropdown {
        id: enumPicker

        width: parent.width
        showLabel: false
        value: root.valueFor(parent.field.key)
        options: parent.field.options || []
        rowHeight: Style.space(36)
        foreground: root.foreground
        accent: root.accent
        fontFamily: root.fontFamily
        onChanged: function(value) { root.setValue(parent.field.key, value) }
      }
    }
  }

  Component {
    id: booleanEditor

    Toggle {
      width: parent.width
      readonly property var field: parent.field
      label: field.label
      description: field.description || ""
      checked: root.valueFor(field.key) === true
      foreground: root.foreground
      accent: root.accent
      fontFamily: root.fontFamily
      onClicked: root.setValue(field.key, !checked)

    }
  }

  Component {
    id: integerEditor

    BorderSurface {
      id: numberEditor

      width: parent.width
      readonly property var field: parent.field
      readonly property bool useDiscreteChoices: field.maximum - field.minimum <= 8
      readonly property bool hasDescription: field.description !== undefined && field.description !== ""
      height: useDiscreteChoices
        ? fieldLabel.implicitHeight + fieldDescription.implicitHeight + choiceGroup.implicitHeight
          + Style.space(hasDescription ? 42 : 26)
        : Style.space(hasDescription ? 88 : 66)
      activeFocusOnTab: !useDiscreteChoices
      radius: Style.cornerRadius
      color: Util.alpha(root.foreground, 0.035)
      borderSpec: Border.controlSpec(activeFocus ? "focus" : "normal", root.foreground, root.accent)
      clip: true

      function stepBy(delta) {
        var next = Number(root.valueFor(field.key)) + delta * field.step
        root.setValue(field.key, Math.max(field.minimum, Math.min(field.maximum, next)))
      }

      Keys.onLeftPressed: stepBy(-1)
      Keys.onRightPressed: stepBy(1)
      Keys.onDownPressed: stepBy(-1)
      Keys.onUpPressed: stepBy(1)

      readonly property var discreteOptions: {
        var options = []
        for (var value = field.minimum; value <= field.maximum; value += field.step)
          options.push({
            value: String(value),
            label: value === 0 ? "—" : root.numberFormatter(value)
          })
        return options
      }

      Text {
        id: fieldLabel
        anchors.left: parent.left
        anchors.right: valueBadge.visible ? valueBadge.left : parent.right
        anchors.top: parent.top
        anchors.leftMargin: Style.space(12)
        anchors.rightMargin: Style.space(10)
        anchors.topMargin: Style.space(9)
        text: parent.field.label
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.body
        font.bold: true
        horizontalAlignment: Text.AlignLeft
        elide: Text.ElideRight
      }

      Text {
        id: fieldDescription
        visible: numberEditor.hasDescription
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: fieldLabel.bottom
        anchors.leftMargin: Style.space(12)
        anchors.rightMargin: Style.space(12)
        anchors.topMargin: Style.space(4)
        text: parent.field.description || ""
        color: Util.alpha(root.foreground, 0.62)
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        wrapMode: Text.WordWrap
        horizontalAlignment: Text.AlignLeft
      }

      Text {
        id: valueBadge
        visible: !numberEditor.useDiscreteChoices
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.rightMargin: Style.space(12)
        anchors.topMargin: Style.space(9)
        text: root.numberFormatter(root.valueFor(parent.field.key))
        color: root.accent
        font.family: root.fontFamily
        font.pixelSize: Style.font.body
        font.bold: true
      }

      ButtonGroup {
        id: choiceGroup

        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: Style.space(7)
        visible: parent.useDiscreteChoices
        options: parent.discreteOptions
        value: String(root.valueFor(parent.field.key))
        foreground: root.foreground
        accent: root.accent
        fontFamily: root.fontFamily
        LayoutMirroring.enabled: false
        LayoutMirroring.childrenInherit: true
        onChanged: function(value) { root.setValue(parent.field.key, Number(value)) }
      }

      PanelSlider {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.leftMargin: Style.space(13)
        anchors.rightMargin: Style.space(13)
        anchors.bottomMargin: Style.space(5)
        visible: !parent.useDiscreteChoices
        LayoutMirroring.enabled: false
        LayoutMirroring.childrenInherit: true
        bar: root.bar
        minimum: parent.field.minimum
        maximum: parent.field.maximum
        step: parent.field.step || 1
        integer: true
        tickCount: 0
        value: Number(root.valueFor(parent.field.key))
        onMoved: function(value) { root.setValue(parent.field.key, Math.round(value)) }
      }
    }
  }

  Component {
    id: stringEditor

    Column {
      id: stringEditorRoot

      width: parent.width
      spacing: Style.space(5)
      readonly property var field: parent.field

      Column {
        width: parent.width
        spacing: Style.space(3)

        Text {
          width: parent.width
          text: stringEditorRoot.field.label
          color: root.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
          font.bold: true
          horizontalAlignment: Text.AlignLeft
        }

        Text {
          visible: text !== ""
          width: parent.width
          text: stringEditorRoot.field.description || ""
          color: Util.alpha(root.foreground, 0.62)
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          wrapMode: Text.WordWrap
          horizontalAlignment: Text.AlignLeft
        }
      }

      TextField {
        id: stringInput

        width: parent.width
        text: String(root.valueFor(parent.field.key) || "")
        placeholderText: parent.field.placeholder || ""
        foreground: root.foreground
        accent: root.accent
        font.family: root.fontFamily
        onTextEdited: root.setValue(parent.field.key, text)
        onEditingFinished: root.setValue(parent.field.key, text.trim())
      }
    }
  }
}
