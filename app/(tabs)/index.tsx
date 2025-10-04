"use client"

import { StyleSheet, View, Text, TouchableOpacity } from "react-native"
import { useEffect } from "react"
import * as ScreenOrientation from "expo-screen-orientation"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { StatusBar } from "expo-status-bar"
import { IReactNativeJoystickEvent, JoyStick } from "@/components/joystick";
import { WebView } from "react-native-webview";
import useROS from "@/hooks/use-ros";

export default function HomeScreen() {
  const ros = useROS();

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

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar hidden />

      {/* Top Left - Image Stream */}
      <View style={styles.imageStreamContainer}>
        <WebView source={{ uri: "http://10.80.98.38:8080/stream?topic=/camera/image_raw" }} allowsInlineMediaPlayback={true} />
      </View>

      {/* Top Right - Status Panel */}
      <View style={styles.statusPanel}>
        <View style={styles.statusTabs}>
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
  imageStreamContainer: {
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
  statusPanel: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    borderRadius: 12,
    padding: 16,
    minWidth: 200,
    gap: 12,
  },
  statusTabs: {
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
