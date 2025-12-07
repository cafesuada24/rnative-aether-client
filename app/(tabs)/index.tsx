// index.tsx
import { StyleSheet, View, Text, TouchableOpacity, Alert, Modal, TextInput, LogBox } from "react-native"
import { useEffect, useState, useCallback } from "react"
import * as ScreenOrientation from "expo-screen-orientation"
import { GestureHandlerRootView, ScrollView } from "react-native-gesture-handler"
import { StatusBar } from "expo-status-bar"
import { IReactNativeJoystickEvent, JoyStick } from "@/components/joystick"
import { WebView } from "react-native-webview"
import { RobotMode, useROS } from "@/context/ROSContext"
import MapViewer from "@/components/map-viewer"
import { useRootNavigationState, useRouter } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as ROSLIB from "roslib"

type TabType = "status" | "log" | "progress" | "chat" | "waypoints" | "managemap" | "setmode"
type DisplayMode = "camera" | "map"

interface Waypoint {
  id: string
  name: string
  coordinate: { x: number; y: number }
}

interface ChatSrvResponse {
  response: string
}

interface MapMeta {
  id: string
  name: string
}

const SELECTED_SERVICE_KEY = "@selected_service"
const MAX_LOGS = 200

const TAB_OPTIONS: { value: TabType; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "log", label: "Log" },
  { value: "progress", label: "Progress" },
  { value: "chat", label: "Chat" },
  { value: "waypoints", label: "Waypoints" },
  { value: "setmode", label: "Set robot mode" },
  { value: "managemap", label: "Map" },
]

const NAV_STATUS_LABELS: Record<number, string> = {
  0: "Not navigating",
  1: "Accepted",
  2: "Executing",
  3: "Cancelling",
  4: "Success",
  5: "Cancelled",
  6: "Aborted",
}

// type LogLevel = "info" | "success" | "warning" | "error"

enum LogLevel {
  Info,
  Success,
  Warning,
  Error,
}

// const getLogLevel = (message: string): LogLevel => {
//   const lower = message.toLowerCase()
//   if (lower.includes("error") || lower.includes("fail")) return "error"
//   if (lower.includes("success") || lower.includes("connected") || lower.includes("loaded") || lower.includes("saved")) {
//     return "success"
//   }
//   if (lower.includes("warning") || lower.includes("warn") || lower.includes("disconnected")) return "warning"
//   return "info"
// }

export default function HomeScreen() {
  const router = useRouter()
  const ros = useROS()
  const rootNavigationState = useRootNavigationState()

  const [activeTab, setActiveTab] = useState<TabType>("status")
  const [displayMode, setDisplayMode] = useState<DisplayMode>("camera")
  const [logs, setLogs] = useState<{ msg: string, level: LogLevel }[]>([])
  const [dropdownVisible, setDropdownVisible] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<{ text: string; sender: "user" | "bot" }[]>([
    { text: "Hello! How can I assist you?", sender: "bot" },
  ])
  const [waypoints] = useState<Waypoint[]>([])

  const [maps, setMaps] = useState<MapMeta[]>([])
  const [editingMapId, setEditingMapId] = useState<string | null>(null)
  const [editingMapName, setEditingMapName] = useState("")
  const [newMapName, setNewMapName] = useState("")

  const [joystickVisible, setJoystickVisible] = useState(true)
  const [logPanelExpanded, setLogPanelExpanded] = useState(false)

  const isMappingMode = ros.robotMode === RobotMode.MAPPING
  const navigationReady = rootNavigationState?.key != null

  const addLog = useCallback((msg: string, level: LogLevel) => {
    setLogs(prev => {
      const next = [...prev, { msg, level }]
      return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next
    })
  }, [])

  // Redirect to connect screen when navigation is ready and ROS is not connected
  useEffect(() => {
    if (!navigationReady || ros.connected) return

    const timerId = setTimeout(() => {
      router.replace("./connect")
    }, 1000)

    return () => clearTimeout(timerId)
  }, [navigationReady, ros.connected, router])

  // Log connection status changes + fetch maps when connected
  useEffect(() => {
    if (!ros.connected) {
      addLog("Disconnected from ROS", LogLevel.Info)
      return
    }

    addLog("Connected to ROS", LogLevel.Success)

    if (!ros.getMapsService) {
      addLog("Map retrieval service is not available", LogLevel.Warning)
      return
    }

    ros.getMapsService.callService(
      new ROSLIB.ServiceRequest({}),
      (response: any) => {
        if (!response?.success) {
          addLog(response?.message ?? "Failed to retrieve maps", LogLevel.Error)
          return
        }

        addLog("Map retrieve success", LogLevel.Success)

        const fetchedMaps: MapMeta[] = []
        for (let i = 0; i < response.map_names.length; ++i) {
          fetchedMaps.push({ id: response.map_ids[i], name: response.map_names[i] })
        }
        setMaps(fetchedMaps)
      },
      (error: any) => {
        addLog(`Error retrieving maps: ${String(error)}`, LogLevel.Error)
      },
    )
  }, [ros.connected, ros.getMapsService, addLog])

  // Lock orientation to landscape for this screen
  useEffect(() => {
    const lock = async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
      } catch {
        // ignore orientation errors
      }
    }

    const unlock = async () => {
      try {
        await ScreenOrientation.unlockAsync()
      } catch {
        // ignore orientation errors
      }
    }

    lock()
    return () => {
      unlock()
    }
  }, [])

  const handleJoyMove = useCallback(
    (data: IReactNativeJoystickEvent) => {
      if (!ros.connected) return
      ros.sendVelocity({ y: data.normalized.x, x: data.normalized.y, yaw: data.angle.radian })
    },
    [ros],
  )

  const handleJoyStart = useCallback((data: IReactNativeJoystickEvent) => {
    // console.log("Joystick start:", data)
  }, [])

  const handleJoyStop = useCallback(
    (data: IReactNativeJoystickEvent) => {
      console.log("Joystick stop:", data)
      if (!ros.connected) return
      ros.sendVelocity({ x: 0.0, y: 0.0, yaw: 0.0 })
    },
    [ros],
  )

  const handleDisconnect = () => {
    Alert.alert("Disconnect", "Are you sure you want to disconnect?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          ros.disconnect()
          await AsyncStorage.removeItem(SELECTED_SERVICE_KEY)
          router.replace("./connect")
        },
      },
    ])
  }

  const updateLastBotMessage = (text: string) => {
    setChatMessages(prev => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].sender === "bot") {
          next[i] = { ...next[i], text }
          return next
        }
      }
      return [...next, { text, sender: "bot" }]
    })
  }

  const chatSrvReponseCallback = (response: ChatSrvResponse) => {
    updateLastBotMessage(response.response)
  }

  const chatSrvReponseFailedCallback = (error: string) => {
    updateLastBotMessage(`An error occurred while processing your request: ${error}`)
    addLog(`Chat service error: ${error}`, LogLevel.Error)
  }

  const handleSendMessage = () => {
    const trimmed = chatInput.trim()
    if (!trimmed) return

    setChatMessages(prev => [...prev, { text: trimmed, sender: "user" }])
    setChatInput("")

    if (!ros.chatService) {
      setChatMessages(prev => [
        ...prev,
        { text: "Chat service is not available right now.", sender: "bot" },
      ])
      addLog("Chat service is not available", LogLevel.Warning)
      return
    }

    setChatMessages(prev => [
      ...prev,
      { text: "I received your message. Processing...", sender: "bot" },
    ])

    ros.chatService.callService(
      { prompt: trimmed },
      chatSrvReponseCallback,
      chatSrvReponseFailedCallback,
    )
  }

  // ##################### Map management ############################
  const handleLoadMap = (mapId: string, mapName: string) => {
    if (!ros.connected || !ros.loadMapService) {
      addLog("Load map service is not available", LogLevel.Warning)
      return
    }

    const successHandle = (response: any) => {
      if (response?.success === true) {
        addLog(`Map '${mapName}' loaded`, LogLevel.Success)
      } else {
        addLog(response?.message ?? "Failed to load map", LogLevel.Error)
      }
    }

    ros.loadMapService.callService(
      new ROSLIB.ServiceRequest({ map_id: mapId }),
      successHandle,
      (error: any) => {
        addLog(`Error loading map: ${String(error)}`, LogLevel.Error)
      },
    )
  }

  const handleStartEditMap = (map: MapMeta) => {
    setEditingMapId(map.id)
    setEditingMapName(map.name)
  }

  const handleCancelEditMap = () => {
    setEditingMapId(null)
    setEditingMapName("")
  }

  const handleConfirmEditMap = async () => {
    if (!editingMapId) return
    const trimmed = editingMapName.trim()
    if (!trimmed) return

    // Optional: hook into a real ROS rename service if available
    if (ros.updateMapService) {
      ros.updateMapService.callService(
        new ROSLIB.ServiceRequest({ map_id: editingMapId, name: trimmed }),
        (response: any) => {
          if (response?.success) {
            setMaps(prev => prev.map(m => (m.id === editingMapId ? { ...m, name: trimmed } : m)))
            addLog("Map renamed successfully", LogLevel.Success)
          } else {
            addLog(response?.message ?? "Failed to rename map", LogLevel.Error)
          }
        },
        (error: any) => {
          addLog(`Error renaming map: ${String(error)}`, LogLevel.Error)
        },
      )
    } else {
      // Local-only rename as fallback
      setMaps(prev => prev.map(m => (m.id === editingMapId ? { ...m, name: trimmed } : m)))
      addLog("Map renamed (local only, no backend)", LogLevel.Warning)
    }

    setEditingMapId(null)
    setEditingMapName("")
  }

  const handleDeleteMap = (mapId: string) => {
    Alert.alert("Delete map", "Are you sure you want to delete this map?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (ros.deleteMapService) {
            ros.deleteMapService.callService(
              new ROSLIB.ServiceRequest({ map_id: mapId }),
              (response: any) => {
                if (response?.success) {
                  setMaps(prev => prev.filter(m => m.id !== mapId))
                  addLog("Map deleted", LogLevel.Success)
                } else {
                  addLog(response?.message ?? "Failed to delete map", LogLevel.Error)
                }
              },
              (error: any) => {
                addLog(`Error deleting map: ${String(error)}`, LogLevel.Error)
              },
            )
          } else {
            // Local-only delete fallback
            setMaps(prev => prev.filter(m => m.id !== mapId))
            addLog("Map deleted (local only, no backend)", LogLevel.Warning)
          }
        },
      },
    ])
  }

  const handleSaveMap = async () => {
    const trimmed = newMapName.trim()
    if (!trimmed) return

    if (!ros.connected || !ros.saveMapService) {
      addLog("Save map service is not available", LogLevel.Warning)
      return
    }

    const successHandle = (response: any) => {
      if (response?.success === true) {
        setMaps(prev => [...prev, { id: response.map_id, name: trimmed }])
        setNewMapName("")
        addLog("Map saved", LogLevel.Success)
      } else {
        addLog(response?.message ?? "Failed to save map", LogLevel.Error)
      }
    }

    ros.saveMapService.callService(
      new ROSLIB.ServiceRequest({ map_name: trimmed }),
      successHandle,
      (error: any) => {
        addLog(`Error saving map: ${String(error)}`, LogLevel.Error)
      },
    )
  }

  const handleChangeMode = async (mode: RobotMode) => {
    if (!ros.connected || !ros.changeRobotModeAct) {
      addLog("Change mode action is not available", LogLevel.Warning)
      return
    }

    // Depending on your ROS wrapper, you may need a different goal shape.
    // This assumes changeRobotModeAct expects a simple goal message.
    const goalMessage = {
      mode: {
        mode: mode === RobotMode.MAPPING ? 1 : 2
      }
    }


    try {
      ros.changeRobotModeAct.sendGoal(
        goalMessage,
        (result: any) => {
          if (result?.success) {
            addLog(
              `Robot mode changed to ${mode === RobotMode.MAPPING ? "Mapping" : "Localization"}`,
              LogLevel.Info
            )
          } else {
            addLog("Failed to change robot mode", LogLevel.Error)
          }
        },
        (feedback: any) => {
          if (feedback?.msg) {
            addLog(feedback.msg, LogLevel.Info)
          }
        },
      )
    } catch (e) {
      addLog(`Error sending mode change goal: ${String(e)}`, LogLevel.Error)
    }
  }
  // ################################################################

  const renderTabContent = () => {
    switch (activeTab) {
      case "status":
        return (
          <View style={styles.tabContent}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Connection</Text>
              <Text
                style={[
                  styles.statusValue,
                  { color: ros.connected ? "#10b981" : "#ef4444" },
                ]}
              >
                {ros.connected ? "Connected" : "Disconnected"}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Current mode</Text>
              <Text style={styles.statusValue}>
                {ros.robotMode === RobotMode.MAPPING
                  ? "Mapping"
                  : ros.robotMode === RobotMode.LOCALIZATION
                    ? "Localization"
                    : "None"}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Map</Text>
              <Text style={styles.statusValue}>
                {maps.length > 0 ? `${maps.length} maps available` : "None"}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Speed</Text>
              <Text style={styles.statusValue}>
                {(
                  Math.round((ros.odom?.twist.twist.linear.x ?? 0.0) * 100) / 100.0
                ).toPrecision(2)}{" "}
                m/s
              </Text>
            </View>
          </View>
        )

      case "log":
        return (
          <ScrollView style={styles.logContainer}>
            {logs.map((log, index) => {
              const level = log.level
              return (
                <View key={index} style={styles.logItem}>
                  <Text
                    style={[
                      styles.logText,
                      level === LogLevel.Error && styles.logTextError,
                      level === LogLevel.Warning && styles.logTextWarning,
                      level === LogLevel.Success && styles.logTextSuccess,
                    ]}
                  >
                    {log.msg}
                  </Text>
                </View>
              )
            })}
          </ScrollView>
        )

      case "progress":
        return (
          <View style={styles.tabContent}>
            <View style={styles.progressItem}>
              <Text style={styles.statusLabel}>Distance</Text>
              <View style={styles.progressBar}>
                {/* TODO: replace 65% with real progress when available */}
                <View style={[styles.progressFill, { width: "65%" }]} />
              </View>
              <Text style={styles.progressText}>
                {(ros.navFeedback?.distance_remaining_meter ?? 0).toFixed(2)} m
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>ETA</Text>
              <Text style={styles.statusValue}>{ros.navFeedback?.ETA ?? 0} sec</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={styles.statusValue}>
                {NAV_STATUS_LABELS[ros.navStatus ?? 0] ?? "Unknown"}
              </Text>
            </View>
          </View>
        )

      case "chat":
        return (
          <View style={styles.chatContainer}>
            <Text style={styles.chatTitle}>Assistant chat</Text>

            <ScrollView
              style={styles.chatMessages}
              contentContainerStyle={styles.chatMessagesContent}
              keyboardShouldPersistTaps="handled"
            >
              {chatMessages.map((msg, index) => (
                <View
                  key={index}
                  style={[
                    styles.chatRow,
                    msg.sender === "user"
                      ? styles.chatRowUser
                      : styles.chatRowBot,
                  ]}
                >
                  <View
                    style={[
                      styles.chatBubble,
                      msg.sender === "user"
                        ? styles.chatBubbleUser
                        : styles.chatBubbleBot,
                    ]}
                  >
                    <Text style={styles.chatText}>{msg.text}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.chatInputContainer}>
              <TextInput
                style={styles.chatInput}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Type a message..."
                placeholderTextColor="#6b7280"
                onSubmitEditing={handleSendMessage}
              />
              <TouchableOpacity
                style={styles.chatSendButton}
                onPress={handleSendMessage}
              >
                <Text style={styles.chatSendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      case "waypoints":
        return (
          <ScrollView style={styles.waypointsContainer}>
            {waypoints.map(waypoint => (
              <View key={waypoint.id} style={styles.waypointItem}>
                <View style={styles.waypointInfo}>
                  <Text style={styles.waypointName}>{waypoint.name}</Text>
                  <Text style={styles.waypointCoords}>
                    ({waypoint.coordinate.x.toFixed(1)},{" "}
                    {waypoint.coordinate.y.toFixed(1)})
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )

      case "managemap":
        return (
          <View style={styles.mapManageContainer}>
            {/* Top: map list */}
            <View style={styles.mapListContainer}>
              <ScrollView
                style={styles.mapListScroll}
                contentContainerStyle={styles.mapListContent}
                keyboardShouldPersistTaps="handled"
              >
                {maps.length === 0 ? (
                  <Text style={styles.mapEmptyText}>No maps saved yet.</Text>
                ) : (
                  maps.map(map => (
                    <View key={map.id} style={styles.mapItem}>
                      {editingMapId === map.id ? (
                        <>
                          <TextInput
                            style={styles.mapInput}
                            value={editingMapName}
                            onChangeText={setEditingMapName}
                            placeholder="Map name"
                            placeholderTextColor="#666"
                          />
                          <View style={styles.mapItemActions}>
                            <TouchableOpacity onPress={handleConfirmEditMap}>
                              <Text style={styles.mapActionText}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCancelEditMap}>
                              <Text style={styles.mapActionText}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      ) : (
                        <>
                          <Text style={styles.mapName}>{map.name}</Text>
                          <View style={styles.mapItemActions}>
                            <TouchableOpacity onPress={() => handleLoadMap(map.id)}>
                              <Text style={styles.mapActionText}>Load</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleStartEditMap(map)}>
                              <Text style={styles.mapActionText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteMap(map.id)}>
                              <Text
                                style={[
                                  styles.mapActionText,
                                  styles.mapActionTextDanger,
                                ]}
                              >
                                Delete
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Bottom: save map (only when in MAPPING mode) */}
            {isMappingMode && (
              <View style={styles.mapSaveContainer}>
                <Text style={styles.mapSaveLabel}>Save current map</Text>
                <View style={styles.mapSaveRow}>
                  <TextInput
                    style={styles.mapInput}
                    value={newMapName}
                    onChangeText={setNewMapName}
                    placeholder="Map name..."
                    placeholderTextColor="#666"
                  />
                  <TouchableOpacity
                    style={[
                      styles.mapSaveButton,
                      !newMapName.trim() && styles.mapSaveButtonDisabled,
                    ]}
                    onPress={handleSaveMap}
                    disabled={!newMapName.trim()}
                  >
                    <Text style={styles.mapSaveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )

      case "setmode":
        const currentMode = ros.robotMode
        const isMapping = currentMode === RobotMode.MAPPING
        const isLocalization = currentMode === RobotMode.LOCALIZATION

        return (
          <View style={styles.modeContainer}>
            <Text style={styles.modeTitle}>Robot mode</Text>
            <Text style={styles.modeHint}>
              Choose how the robot operates. Mapping creates a map. Localization uses an existing map.
            </Text>

            <View style={styles.modeButtonsRow}>
              <TouchableOpacity
                style={[styles.modeButton, isMapping && styles.modeButtonActive]}
                onPress={() => handleChangeMode(RobotMode.MAPPING)}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    isMapping && styles.modeButtonTextActive,
                  ]}
                >
                  Mapping
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeButton, isLocalization && styles.modeButtonActive]}
                onPress={() => handleChangeMode(RobotMode.LOCALIZATION)}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    isLocalization && styles.modeButtonTextActive,
                  ]}
                >
                  Localization
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )
    }
  }

  const currentTabLabel =
    TAB_OPTIONS.find(opt => opt.value === activeTab)?.label ?? "Select"

  const latestLog = logs[logs.length - 1]

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar hidden />

      {/* Top Left - Image Stream / Map Display */}
      <View style={styles.displayContainer}>
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() =>
            setDisplayMode(mode => (mode === "camera" ? "map" : "camera"))
          }
        >
          <Text style={styles.toggleButtonText}>
            {displayMode === "camera" ? "Show Map" : "Show Camera"}
          </Text>
        </TouchableOpacity>

        {displayMode === "camera" ? (
          <WebView
            source={{
              uri: `http://${ros.currentHost}:8080/stream?topic=/camera/image_raw`,
            }}
            allowsInlineMediaPlayback
            style={styles.webview}
          />
        ) : (
          <MapViewer />
        )}
      </View>

      {/* Top Right - Status / Detail Panel */}
      <View style={styles.statusPanel}>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setDropdownVisible(true)}
        >
          <Text style={styles.dropdownText}>{currentTabLabel}</Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>

        <Modal
          visible={dropdownVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDropdownVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setDropdownVisible(false)}
          >
            <View style={styles.dropdownMenu}>
              {TAB_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.dropdownItem,
                    activeTab === option.value && styles.dropdownItemActive,
                  ]}
                  onPress={() => {
                    setActiveTab(option.value)
                    setDropdownVisible(false)
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      activeTab === option.value &&
                      styles.dropdownItemTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {renderTabContent()}
      </View>

      {/* Bottom Right - Joystick (toggleable) */}
      {joystickVisible && (
        <View style={styles.joystickContainer}>
          <JoyStick
            color="#06b6d4"
            radius={75}
            onMove={handleJoyMove}
            onStop={handleJoyStop}
            onStart={handleJoyStart}
          />
        </View>
      )}

      <TouchableOpacity
        style={styles.joystickToggleButton}
        onPress={() => setJoystickVisible(v => !v)}
      >
        <Text style={styles.joystickToggleText}>
          {joystickVisible ? "Hide joystick" : "Show joystick"}
        </Text>
      </TouchableOpacity>

      {/* Disconnect Button */}
      <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
        <Text style={styles.buttonText}>Disconnect</Text>
      </TouchableOpacity>

      {/* Bottom Center - Log dock (always visible, toggleable body) */}
      <View
        style={[
          styles.logDockContainer,
          logPanelExpanded && styles.logDockExpanded,
        ]}
      >
        <TouchableOpacity
          style={styles.logDockHeader}
          onPress={() => setLogPanelExpanded(v => !v)}
        >
          <Text style={styles.logDockTitle}>Logs</Text>
          <Text style={styles.logDockToggle}>{logPanelExpanded ? "▾" : "▴"}</Text>
        </TouchableOpacity>

        {logs.length > 0 && (
          logPanelExpanded ? (
            <ScrollView style={styles.logDockBody}>
              {logs.slice(-20).map((log, index) => {
                const level = log.level
                return (
                  <Text
                    key={index}
                    style={[
                      styles.logDockLine,
                      level === LogLevel.Error && styles.logTextError,
                      level === LogLevel.Warning && styles.logTextWarning,
                      level === LogLevel.Success && styles.logTextSuccess,
                    ]}
                  >
                    • {log.msg}
                  </Text>
                )
              })}
            </ScrollView>
          ) : (
            <Text
              style={[
                styles.logDockLine,
                latestLog && styles.logText,
                latestLog && {
                  ...(latestLog.level === LogLevel.Error && styles.logTextError),
                  ...(latestLog.level === LogLevel.Warning && styles.logTextWarning),
                  ...(latestLog.level === LogLevel.Success && styles.logTextSuccess),
                },
              ]}
              numberOfLines={1}
            >
              {latestLog ? `• ${latestLog.msg}` : " "}
            </Text>
          )
        )}
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  displayContainer: {
    position: "absolute",
    top: 20,
    left: 20,
    width: "60%",
    height: "70%",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#1f2937",
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
  },
  toggleButton: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 10,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4b5563",
  },
  toggleButtonText: {
    color: "#f9fafb",
    fontSize: 12,
    fontWeight: "600",
  },
  statusPanel: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderRadius: 14,
    padding: 16,
    width: 300,
    maxWidth: 300,
    maxHeight: "80%",
    gap: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  dropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(31, 41, 55, 0.9)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  dropdownText: {
    color: "#f9fafb",
    fontSize: 14,
    fontWeight: "600",
  },
  dropdownArrow: {
    color: "#9ca3af",
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownMenu: {
    backgroundColor: "rgba(15, 23, 42, 0.98)",
    borderRadius: 12,
    minWidth: 220,
    padding: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  dropdownItemActive: {
    backgroundColor: "#06b6d4",
  },
  dropdownItemText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
  },
  dropdownItemTextActive: {
    color: "#ffffff",
  },
  tabContent: {
    gap: 8,
  },
  statusItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(31, 41, 55, 0.9)",
    borderRadius: 8,
  },
  statusLabel: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
  },
  statusValue: {
    color: "#f9fafb",
    fontSize: 14,
    fontWeight: "bold",
  },
  logContainer: {
    maxHeight: 220,
  },
  logItem: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(17, 24, 39, 0.9)",
    borderRadius: 6,
    marginBottom: 4,
  },
  logText: {
    color: "#e5e7eb",
    fontSize: 11,
    fontFamily: "monospace",
  },
  logTextError: {
    color: "#f97373",
  },
  logTextWarning: {
    color: "#fbbf24",
  },
  logTextSuccess: {
    color: "#34d399",
  },
  progressItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(31, 41, 55, 0.9)",
    borderRadius: 8,
    gap: 4,
  },
  progressBar: {
    width: "100%",
    height: 8,
    backgroundColor: "#374151",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#06b6d4",
    borderRadius: 4,
  },
  progressText: {
    color: "#f9fafb",
    fontSize: 11,
    marginTop: 4,
  },
  chatContainer: {
    maxHeight: 230,                 // smaller vertical footprint
    paddingTop: 4,
    gap: 8,
  },
  chatTitle: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  chatMessages: {
    flexGrow: 0,
    maxHeight: 150,
    borderRadius: 10,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  chatMessagesContent: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  chatRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  chatRowUser: {
    justifyContent: "flex-end",
  },
  chatRowBot: {
    justifyContent: "flex-start",
  },
  chatBubble: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    maxWidth: "80%",
  },
  chatBubbleUser: {
    backgroundColor: "#06b6d4",
  },
  chatBubbleBot: {
    backgroundColor: "rgba(31, 41, 55, 0.9)",
  },
  chatText: {
    color: "#ffffff",
    fontSize: 13,
  },
  chatInputContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
  },
  chatInput: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    color: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontSize: 13,
  },
  chatSendButton: {
    backgroundColor: "#06b6d4",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  chatSendButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  waypointsContainer: {
    maxHeight: 300,
  },
  waypointItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(31, 41, 55, 0.9)",
    borderRadius: 8,
    marginBottom: 6,
  },
  waypointInfo: {
    flex: 1,
  },
  waypointName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  waypointCoords: {
    color: "#9ca3af",
    fontSize: 11,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  joystickContainer: {
    position: "absolute",
    bottom: 90,
    right: 40,
  },
  joystickToggleButton: {
    position: "absolute",
    bottom: 20,
    right: 40,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4b5563",
  },
  joystickToggleText: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "600",
  },
  disconnectButton: {
    position: "absolute",
    bottom: 30,
    left: 40,
    backgroundColor: "#ef4444",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: "center",
  },
  mapManageContainer: {
    gap: 12,
  },
  mapListContainer: {
    height: 145,
    marginBottom: 8,
  },

  mapListScroll: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  mapListContent: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  mapEmptyText: {
    color: "#9ca3af",
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  mapItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(31, 41, 55, 0.9)",
    borderRadius: 8,
    marginBottom: 6,
  },
  mapName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  mapItemActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  mapActionText: {
    color: "#06b6d4",
    fontSize: 12,
    fontWeight: "600",
  },
  mapActionTextDanger: {
    color: "#f97316",
  },
  mapSaveContainer: {
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 8,
    gap: 8,
  },
  mapSaveLabel: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
  },
  mapSaveRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  mapInput: {
    flex: 1,
    backgroundColor: "rgba(31, 41, 55, 0.9)",
    color: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    fontSize: 13,
  },
  mapSaveButton: {
    backgroundColor: "#06b6d4",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  mapSaveButtonDisabled: {
    opacity: 0.5,
  },
  mapSaveButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  modeContainer: {
    gap: 12,
  },
  modeTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  modeHint: {
    color: "#9ca3af",
    fontSize: 12,
  },
  modeButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4b5563",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(31, 41, 55, 0.9)",
  },
  modeButtonActive: {
    borderColor: "#06b6d4",
    backgroundColor: "rgba(6, 182, 212, 0.2)",
  },
  modeButtonText: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "600",
  },
  modeButtonTextActive: {
    color: "#ffffff",
  },
  // Log dock (always visible)
  logDockContainer: {
    position: "absolute",
    bottom: 15,
    left: "25%",
    right: "25%",
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    overflow: "hidden",
  },
  logDockExpanded: {
    maxHeight: 180,
  },
  logDockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(15, 23, 42, 1)",
  },
  logDockTitle: {
    color: "#f9fafb",
    fontSize: 12,
    fontWeight: "600",
  },
  logDockToggle: {
    color: "#9ca3af",
    fontSize: 12,
  },
  logDockBody: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logDockLine: {
    color: "#e5e7eb",
    fontSize: 11,
    fontFamily: "monospace",
    marginBottom: 2,
  },
})
