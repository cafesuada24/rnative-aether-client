"use client"

import { View, StyleSheet, Text } from "react-native"
import { WebView } from "react-native-webview"
import { useEffect, useRef } from "react"

export default function MapViewer() {
  const webViewRef = useRef<WebView>(null)

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />

<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/easeljs@1/lib/easeljs.min.js"></script>
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/eventemitter2@6/lib/eventemitter2.min.js"></script>
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/roslib@1/build/roslib.min.js"></script>
<script type="text/javascript" src="http://static.robotwebtools.org/ros2djs/current/ros2d.min.js"></script>

<script>
  /**
   * Setup all visualization elements when the page is loaded.
   */
  function init() {
    // Connect to ROS.
    var ros = new ROSLIB.Ros({
      url : 'ws://192.168.1.7:9090'
    });

    // Create the main viewer.
    var viewer = new ROS2D.Viewer({
      divID : 'map',
      width : 640,
      height : 480
    });

    // Setup the map client.
    var gridClient = new ROS2D.OccupancyGridClient({
      ros : ros,
      rootObject : viewer.scene,
      topic: '/global_costmap/static_layer',
    });
    // Scale the canvas to fit to the map
    gridClient.on('change', function() {
      viewer.scaleToDimensions(gridClient.currentGrid.width, gridClient.currentGrid.height);
      viewer.shift(gridClient.currentGrid.pose.position.x, gridClient.currentGrid.pose.position.y);
    });
  }
</script>
</head>

<body onload="init()">
  <div id="map"></div>
</body>
</html>
  `

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: htmlContent }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  webview: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  statusOverlay: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 8,
    borderRadius: 6,
    zIndex: 1000,
  },
  statusText: {
    color: "#9ca3af",
    fontSize: 12,
  },
})
