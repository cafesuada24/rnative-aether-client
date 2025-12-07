"use client"

import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from "react-native"
import { useEffect, useState } from "react"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useServiceDiscovery } from "@/hooks/use-service-discovery"
import { useROS } from "@/context/ROSContext"

const SELECTED_SERVICE_KEY = "@selected_service"

export default function ConnectScreen() {
  const router = useRouter()
  const { services, discovering, loading, discoverServices, addService, removeService } = useServiceDiscovery()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newServiceName, setNewServiceName] = useState("")
  const [newServiceAddress, setNewServiceAddress] = useState("")
  const [newServicePort, setNewServicePort] = useState("8765");
  const ros = useROS()

  useEffect(() => {
    if (ros.connected) {
      router.replace("./")
    }
  }, [ros.connected, router])

  const handleConnect = async (serviceId: string, serviceHost: string, servicePort: string) => {
    try {
      // Save selected service
      // await AsyncStorage.setItem(SELECTED_SERVICE_KEY, JSON.stringify({ id: serviceId, url: serviceUrl, host: serviceHost }))
      ros.connect(serviceHost, servicePort)
      
      // Navigate to control screen
      // router.push("./")
    } catch (error) {
      Alert.alert("Error", `Failed to connect to service: ${error}`)
    }
  }

  const validateURL = () => {
    if (!newServiceName.trim() || !newServiceAddress.trim() || !newServicePort) {
      Alert.alert("Error", "All fields are required")
      return false
    }

    return true;
  }

  const resetForm = () => {
    setNewServiceAddress("")
    setNewServicePort("8765")
  }

  const handleAddService = async () => {

    if (!validateURL()) {
      return;
    }

    // const newServiceURL = `ws://${newServiceAddress}:${newServicePort}`

    await addService(newServiceName, newServiceAddress, newServicePort)
    setNewServiceName("")
    resetForm()
    setShowAddForm(false)
  }

  const handleRemoveService = (id: string) => {
    Alert.alert("Remove Service", "Are you sure you want to remove this service?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeService(id) },
    ])
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.title}>Connect to Robot</Text>
        <Text style={styles.subtitle}>Select a robot to control</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, discovering && styles.actionButtonDisabled]}
          onPress={discoverServices}
          disabled={discovering}
        >
          {discovering ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>Discover Robots</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButtonSecondary} onPress={() => setShowAddForm(!showAddForm)}>
          <Text style={styles.actionButtonTextSecondary}>{showAddForm ? "Cancel" : "Add Manually"}</Text>
        </TouchableOpacity>
      </View>

      {showAddForm && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="Robot Name"
            placeholderTextColor="#666"
            value={newServiceName}
            onChangeText={setNewServiceName}
          />
          <TextInput
            style={styles.input}
            placeholder="192.168.1.10"
            placeholderTextColor="#666"
            value={newServiceAddress}
            onChangeText={setNewServiceAddress}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="8765"
            placeholderTextColor="#666"
            value={newServicePort}
            onChangeText={setNewServicePort}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddService}>
            <Text style={styles.actionButtonText}>Add Service</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.serviceList} contentContainerStyle={styles.serviceListContent}>
        {services.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No robots found</Text>
            <Text style={styles.emptyStateSubtext}>Try discovering or adding a robot manually</Text>
          </View>
        ) : (
          services.map((service) => (
            <View key={service.id} style={styles.serviceCard}>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceUrl}>{service.host}:{service.port}</Text>
                {service.lastConnected && (
                  <Text style={styles.serviceLastConnected}>
                    Last connected: {new Date(service.lastConnected).toLocaleString()}
                  </Text>
                )}
              </View>
              <View style={styles.serviceActions}>
                <TouchableOpacity style={styles.connectButton} onPress={() => handleConnect(service.id, service.host, service.port)}>
                  <Text style={styles.connectButtonText}>Connect</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveService(service.id)}>
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 20,
  },
  header: {
    marginBottom: 24,
    marginTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#999",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#06b6d4",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonSecondary: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  actionButtonTextSecondary: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  addForm: {
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  input: {
    backgroundColor: "rgba(50, 50, 50, 0.8)",
    color: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: "#06b6d4",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  serviceList: {
    flex: 1,
  },
  serviceListContent: {
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: "#666",
    fontSize: 14,
  },
  serviceCard: {
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  serviceUrl: {
    color: "#999",
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 4,
  },
  serviceLastConnected: {
    color: "#666",
    fontSize: 11,
  },
  serviceActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  connectButton: {
    backgroundColor: "#06b6d4",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  connectButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  removeButton: {
    backgroundColor: "rgba(255, 59, 48, 0.2)",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonText: {
    color: "#ff3b30",
    fontSize: 24,
    fontWeight: "600",
  },
})
