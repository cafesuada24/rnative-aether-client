"use client"

import { StyleSheet, View, Text, TouchableOpacity, Alert, Modal, TextInput } from "react-native"
import { useEffect, useState } from "react"
import * as ScreenOrientation from "expo-screen-orientation"
import { GestureHandlerRootView, ScrollView } from "react-native-gesture-handler"
import { StatusBar } from "expo-status-bar"
import { IReactNativeJoystickEvent, JoyStick } from "@/components/joystick";
import { WebView } from "react-native-webview";
import useROS from "@/hooks/use-ros";
import MapViewer from "@/components/map-viewer"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useRouter } from "expo-router"

type TabType = "status" | "log" | "progress" | "chat" | "waypoints"
type DisplayMode = "camera" | "map"
interface Waypoint {
  id: string
  name: string
  coordinate: { x: number, y: number }
}
interface ChatSrvResponse {
  response: string
}
const SELECTED_SERVICE_KEY = "@selected_service"

export default function HomeScreen() {
  const router = useRouter();
  const ros = useROS();
  const [activeTab, setActiveTab] = useState<TabType>("status")
  const [displayMode, setDisplayMode] = useState<DisplayMode>("camera")
  const [logs, setLogs] = useState<string[]>([])
  const [serviceUrl, setServiceUrl] = useState<string | null>(null)
  const [serviceHost, setServiceHost] = useState<string | null>(null);
  const [dropdownVisible, setDropdownVisible] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ text: string; sender: "user" | "bot" }[]>([
    { text: "Hello! How can I assist you?", sender: "bot" },
  ])
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
  ])

  const addLog = (logMsg: string) => {
    setLogs(l => [...l, logMsg])
  }

  useEffect(() => {
    const getWaypointsSrvCallback = (response: { waypoints: Waypoint[] }) => {
      for (let i = 0; i < response.waypoints.length; ++i) {
        response.waypoints[i].id = i.toString();
      }
      setWaypoints(response.waypoints)
    }
    const getWaypointsSrvFailedCallback = (error: string) => {
      addLog(`Err: ${error}`)
    }
    ros.getWaypoints?.callService(null, getWaypointsSrvCallback, getWaypointsSrvFailedCallback)
  }, [ros.getWaypoints])

  const handleJoyMove = (data: IReactNativeJoystickEvent) => {
    ros.sendVelocity({ y: data.normalized.x, x: data.normalized.y, yaw: data.angle.radian });
    console.log(data);
  };
  const [chatInput, setChatInput] = useState("")

  const checkConnection = async () => {
    try {
      const stored = await AsyncStorage.getItem(SELECTED_SERVICE_KEY)
      if (stored) {
        const { url, host } = JSON.parse(stored)
        setServiceUrl(url)
        setServiceHost(host)
        ros.connect(url)
        setLogs((prev) => [...prev, `Connecting to ${url}...`])
      } else {
        router.replace("./connect")
      }
    } catch (error) {
      console.log("[Err] Error checking connection:", error)
      router.replace("./connect")
    }
  }
  async function lockOrientation() {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
  }

  async function unlockOrientation() {
    await ScreenOrientation.unlockAsync()
  }

  useEffect(() => {
    checkConnection()
  }, [])

  useEffect(() => {
    if (ros.connected) {
      setLogs((prev) => [...prev, "Connected to ROS", "Camera stream active"])
    } else {
      setLogs((prev) => [...prev, "Disconnected to ROS"])
    }
  }, [ros.connected])


  useEffect(() => {
    lockOrientation()
    return () => {
      unlockOrientation()
    }
  }, [])

  const handleJoyStart = (data: IReactNativeJoystickEvent) => {
    console.log(data);
  };

  const handleJoyStop = (data: IReactNativeJoystickEvent) => {
    ros.sendVelocity({ x: 0.0, y: 0.0, yaw: 0.0 });
    console.log(data);
  };

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

  const chatSrvReponseCallback = (response: ChatSrvResponse) => {
    setChatMessages((prev) => {
      const modified = [...prev]
      modified[modified.length - 1].text = response.response;
      return modified
    })
  }
  const chatSrvReponseFailedCallback = (error: string) => {
    setChatMessages((prev) => [...prev, { text: `An error occured while processing your request, ${error}`, sender: "bot" }])
  }
  const handleSendMessage = () => {
    if (chatInput.trim()) {
      setChatMessages((prev) => [...prev, { text: chatInput, sender: "user" }])
      // Simulate bot response

      setTimeout(() => {
        ros.chatService?.callService({ 'prompt': chatInput }, chatSrvReponseCallback, chatSrvReponseFailedCallback)
        setChatMessages((prev) => [...prev, { text: "I received your message. Processing...", sender: "bot" }])
      }, 500)
      setChatInput("")
    }
  }

  const tabOptions: { value: TabType; label: string }[] = [
    { value: "status", label: "Status" },
    { value: "log", label: "Log" },
    { value: "progress", label: "Progress" },
    { value: "chat", label: "Chat" },
    { value: "waypoints", label: "Waypoints" },
  ]

  const statusStr = {
    0: 'Not navigating',
    1: 'Accepted',
    2: 'Executing',
    3: 'Cancelling',
    4: 'Success',
    5: 'Cancelled',
    6: 'Aborted',
  }
  const renderTabContent = () => {
    switch (activeTab) {
      case "status":
        return (
          <View style={styles.tabContent}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Connection</Text>
              <Text style={[styles.statusValue, { color: ros.connected ? "#10b981" : "#ef4444" }]}>
                {ros.connected ? "Connected" : "Disconnected"}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Battery</Text>
              <Text style={styles.statusValue}>85%</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Signal</Text>
              <Text style={styles.statusValue}>Good</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Speed</Text>
              <Text style={styles.statusValue}>2.5 m/s</Text>
            </View>
          </View>
        )
      case "log":
        return (
          <ScrollView style={styles.logContainer}>
            {logs.map((log, index) => (
              <View key={index} style={styles.logItem}>
                <Text style={styles.logText}>{log}</Text>
              </View>
            ))}
          </ScrollView>
        )
      case "progress":
        return (
          <View style={styles.tabContent}>
            <View style={styles.progressItem}>
              <Text style={styles.statusLabel}>Distance</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: "65%" }]} />
              </View>
              <Text style={styles.progressText}>{(ros.navFeedback?.distance_remaining_meter ?? 0).toFixed(2)} m</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>ETA</Text>
              <Text style={styles.statusValue}>{ros.navFeedback?.ETA ?? 0} sec</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={styles.statusValue}>{statusStr[ros.navStatus]}</Text>
            </View>
          </View>
        )
      case "chat":
        return (
          <View style={styles.chatContainer}>
            <ScrollView style={styles.chatMessages}>
              {chatMessages.map((msg, index) => (
                <View
                  key={index}
                  style={[styles.chatBubble, msg.sender === "user" ? styles.chatBubbleUser : styles.chatBubbleBot]}
                >
                  <Text style={styles.chatText}>{msg.text}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.chatInputContainer}>
              <TextInput
                style={styles.chatInput}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Type a message..."
                placeholderTextColor="#666"
                onSubmitEditing={handleSendMessage}
              />
              <TouchableOpacity style={styles.chatSendButton} onPress={handleSendMessage}>
                <Text style={styles.chatSendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      case "waypoints":
        return (
          <ScrollView style={styles.waypointsContainer}>
            {waypoints.map((waypoint) => (
              <View key={waypoint.id} style={styles.waypointItem}>
                <View style={styles.waypointInfo}>
                  <Text style={styles.waypointName}>{waypoint.name}</Text>
                  <Text style={styles.waypointCoords}>
                    ({waypoint.coordinate.x.toFixed(1)}, {waypoint.coordinate.y.toFixed(1)})
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )
    }
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar hidden />
      {/* Top Left - Image Stream / Map Display */}
      <View style={styles.displayContainer}>
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setDisplayMode(displayMode === "camera" ? "map" : "camera")}
        >
          <Text style={styles.toggleButtonText}>{displayMode === "camera" ? "Show Map" : "Show Camera"}</Text>
        </TouchableOpacity>

        {displayMode === "camera" ? (
          <WebView
            source={{ uri: `http://${serviceHost}:8080/stream?topic=/camera/image_raw` }}
            allowsInlineMediaPlayback={true}
            style={styles.webview}
          />
        ) : (
          <MapViewer />
        )}
      </View>

      {/* Top Right - Status Panel */}

      <View style={styles.statusPanel}>
        <TouchableOpacity style={styles.dropdown} onPress={() => setDropdownVisible(true)}>
          <Text style={styles.dropdownText}>
            {tabOptions.find((opt) => opt.value === activeTab)?.label || "Select"}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>

        <Modal
          visible={dropdownVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDropdownVisible(false)}
        >
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setDropdownVisible(false)}>
            <View style={styles.dropdownMenu}>
              {tabOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.dropdownItem, activeTab === option.value && styles.dropdownItemActive]}
                  onPress={() => {
                    setActiveTab(option.value)
                    setDropdownVisible(false)
                  }}
                >
                  <Text style={[styles.dropdownItemText, activeTab === option.value && styles.dropdownItemTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
        {renderTabContent()}
      </View>

      {/* Bottom Right - Joystick */}
      <View style={styles.joystickContainer}>
        <JoyStick color="#06b6d4" radius={75} onMove={handleJoyMove} onStop={handleJoyStop} onStart={handleJoyStart} />
      </View>

      {/* Disconnect Button */}
      <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
        <Text style={styles.buttonText}>Disconnect</Text>
      </TouchableOpacity>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  displayContainer: {
    position: "absolute",
    top: 20,
    left: 20,
    width: "60%",
    height: "70%",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#333",
  },
  webview: {
    flex: 1,
  },
  toggleButton: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 10,
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  toggleButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  statusPanel: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    borderRadius: 12,
    padding: 16,
    minWidth: 280,
    maxHeight: "80%",
    gap: 12,
  },
  dropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(50, 50, 50, 0.8)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dropdownText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  dropdownArrow: {
    color: "#999",
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownMenu: {
    backgroundColor: "rgba(30, 30, 30, 0.95)",
    borderRadius: 12,
    minWidth: 200,
    padding: 8,
    borderWidth: 1,
    borderColor: "#333",
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  dropdownItemActive: {
    backgroundColor: "#06b6d4",
  },
  dropdownItemText: {
    color: "#999",
    fontSize: 14,
    fontWeight: "600",
  },
  dropdownItemTextActive: {
    color: "#fff",
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
    backgroundColor: "rgba(50, 50, 50, 0.8)",
    borderRadius: 6,
  },
  statusLabel: {
    color: "#999",
    fontSize: 12,
    fontWeight: "600",
  },
  statusValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  logContainer: {
    maxHeight: 200,
  },
  logItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(50, 50, 50, 0.8)",
    borderRadius: 6,
    marginBottom: 4,
  },
  logText: {
    color: "#d1d5db",
    fontSize: 11,
    fontFamily: "monospace",
  },
  progressItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(50, 50, 50, 0.8)",
    borderRadius: 6,
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
    color: "#fff",
    fontSize: 11,
    marginTop: 4,
  },
  chatContainer: {
    height: 300,
    gap: 8,
  },
  chatMessages: {
    flex: 1,
  },
  chatBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: "80%",
  },
  chatBubbleUser: {
    backgroundColor: "#06b6d4",
    alignSelf: "flex-end",
  },
  chatBubbleBot: {
    backgroundColor: "rgba(50, 50, 50, 0.8)",
    alignSelf: "flex-start",
  },
  chatText: {
    color: "#fff",
    fontSize: 13,
  },
  chatInputContainer: {
    flexDirection: "row",
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: "rgba(50, 50, 50, 0.8)",
    color: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    fontSize: 13,
  },
  chatSendButton: {
    backgroundColor: "#06b6d4",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: "center",
  },
  chatSendButtonText: {
    color: "#fff",
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
    backgroundColor: "rgba(50, 50, 50, 0.8)",
    borderRadius: 6,
    marginBottom: 6,
  },
  waypointInfo: {
    flex: 1,
  },
  waypointName: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  waypointCoords: {
    color: "#999",
    fontSize: 11,
  },
  waypointStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  waypointStatusCompleted: {
    backgroundColor: "#10b981",
  },
  waypointStatusActive: {
    backgroundColor: "#06b6d4",
  },
  waypointStatusPending: {
    backgroundColor: "#6b7280",
  },
  waypointStatusText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  actionButton: {
    backgroundColor: "#ff3b30",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  joystickContainer: {
    position: "absolute",
    bottom: 40,
    right: 40,
  },
  disconnectButton: {
    position: "absolute",
    bottom: 40,
    left: 40,
    backgroundColor: "#6b7280",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
})
