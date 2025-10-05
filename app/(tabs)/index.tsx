"use client"

import { StyleSheet, View, Text, TouchableOpacity } from "react-native"
import { useEffect, useState } from "react"
import * as ScreenOrientation from "expo-screen-orientation"
import { GestureHandlerRootView, ScrollView } from "react-native-gesture-handler"
import { StatusBar } from "expo-status-bar"
import { IReactNativeJoystickEvent, JoyStick } from "@/components/joystick";
import { WebView } from "react-native-webview";
import useROS from "@/hooks/use-ros";
import Constants from "expo-constants"
import MapViewer from "@/components/map-viewer"

type TabType = "status" | "log" | "progress"
type DisplayMode = "camera" | "map"

export default function HomeScreen() {
  const ros = useROS();

  const [activeTab, setActiveTab] = useState<TabType>("status")
  const [displayMode, setDisplayMode] = useState<DisplayMode>("camera")
  const [logs, setLogs] = useState<string[]>(["System initialized", "Connected to ROS", "Camera stream active"])

  async function lockOrientation() {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
  }

  async function unlockOrientation() {
    await ScreenOrientation.unlockAsync()
  }

  useEffect(() => {
    lockOrientation()
    return () => {
      unlockOrientation()
    }
  }, [])

  const handleJoyMove = (data: IReactNativeJoystickEvent) => {
    ros.sendVelocity({ y: data.normalized.x, x: data.normalized.y, yaw: data.angle.radian });
    console.log(data);
  };

  const handleJoyStart = (data: IReactNativeJoystickEvent) => {
    console.log(data);
  };

  const handleJoyStop = (data: IReactNativeJoystickEvent) => {
    ros.sendVelocity({ x: 0.0, y: 0.0, yaw: 0.0 });
    console.log(data);
  };
  const renderTabContent = () => {
    switch (activeTab) {
      case "status":
        return (
          <View style={styles.tabContent}>
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
              <Text style={styles.progressText}>6.5 / 10.0 m</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Waypoints</Text>
              <Text style={styles.statusValue}>3 / 5</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>ETA</Text>
              <Text style={styles.statusValue}>2:30 min</Text>
            </View>
          </View>
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
            source={{ uri: Constants.expoConfig?.extra?.imageStreamSourceUri || "http://localhost:8080/stream" }}
            allowsInlineMediaPlayback={true}
            style={styles.webview}
          />
        ) : (
          <MapViewer /> 
        )}
      </View>

      {/* Top Right - Status Panel */}
      <View style={styles.statusPanel}>
        <View style={styles.tabNavigation}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "status" && styles.tabButtonActive]}
            onPress={() => setActiveTab("status")}
          >
            <Text style={[styles.tabButtonText, activeTab === "status" && styles.tabButtonTextActive]}>Status</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "log" && styles.tabButtonActive]}
            onPress={() => setActiveTab("log")}
          >
            <Text style={[styles.tabButtonText, activeTab === "log" && styles.tabButtonTextActive]}>Log</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "progress" && styles.tabButtonActive]}
            onPress={() => setActiveTab("progress")}
          >
            <Text style={[styles.tabButtonText, activeTab === "progress" && styles.tabButtonTextActive]}>Progress</Text>
          </TouchableOpacity>
        </View>

        {renderTabContent()}

        {/* Emergency Stop Button */}
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.buttonText}>Emergency Stop</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Right - Joystick */}
      <View style={styles.joystickContainer}>
        <JoyStick color="#06b6d4" radius={75} onMove={handleJoyMove} onStop={handleJoyStop} onStart={handleJoyStart} />
      </View>
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
    gap: 12,
  },
  tabNavigation: {
    flexDirection: "row",
    backgroundColor: "rgba(50, 50, 50, 0.5)",
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "#06b6d4",
  },
  tabButtonText: {
    color: "#999",
    fontSize: 12,
    fontWeight: "600",
  },
  tabButtonTextActive: {
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
})
