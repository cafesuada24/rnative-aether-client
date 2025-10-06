"use client"

import { useState, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as ServiceDiscovery from "@inthepocket/react-native-service-discovery"

export interface RobotService {
  id: string
  name: string
  url: string
  host: string
  port: number
  lastConnected?: number
}

const STORAGE_KEY = "@robot_services"
const ROS_SERVICE_TYPES = ["foxglove"]

export function useServiceDiscovery() {
  const [services, setServices] = useState<RobotService[]>([])
  const [discovering, setDiscovering] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load saved services from storage
  useEffect(() => {
    loadServices()
  }, [])

  const loadServices = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY)
      if (stored) {
        setServices(JSON.parse(stored))
      }
    } catch (error) {
      console.log("[v0] Error loading services:", error)
    } finally {
      setLoading(false)
    }
  }

  const saveServices = async (newServices: RobotService[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newServices))
      setServices(newServices)
    } catch (error) {
      console.log("[v0] Error saving services:", error)
    }
  }

  const discoverServices = async () => {
    setDiscovering(true)
    const discovered: RobotService[] = []

    const foundListener = ServiceDiscovery.addEventListener('serviceFound', (service) => {
      console.log('Service found:', service);
      const host = service.hostName || service.addresses[0]
      const port = service.port || 9090
      const url = `ws://${host}:${port}`

      discovered.push({
        id: `${host}:${port}`,
        name: service.name || `Robot (${host})`,
        url,
        host,
        port,
      })

      setServices(discovered)
    });

    const lostListener = ServiceDiscovery.addEventListener('serviceLost', (service) => {
      console.log('Service lost:', service);
    });

    try {
      // Try each ROS service type
      for (const serviceType of ROS_SERVICE_TYPES) {
        await ServiceDiscovery.startSearch(serviceType);
        await new Promise(resolve => setTimeout(resolve, 5000))
        await ServiceDiscovery.stopSearch(serviceType);
      }
    } catch (error) {
      console.log("[v0] Error discovering services:", error)
    } finally {
      setDiscovering(false)
      foundListener.remove();
      lostListener.remove();
    }
  }


  // Add a service manually
  const addService = async (name: string, url: string) => {
    // Parse URL to extract host and port
    const match = url.match(/ws:\/\/([^:]+):(\d+)/)
    const host = match?.[1]
    const port = match?.[2] ? Number.parseInt(match[2]) : 9090

    const newService: RobotService = {
      id: url,
      name,
      url,
      host,
      port,
    }
    await saveServices([...services, newService])
  }

  // Remove a service
  const removeService = async (id: string) => {
    await saveServices(services.filter((s) => s.id !== id))
  }

  // Update last connected time
  const updateLastConnected = async (id: string) => {
    const updated = services.map((s) => (s.id === id ? { ...s, lastConnected: Date.now() } : s))
    await saveServices(updated)
  }

  return {
    services,
    discovering,
    loading,
    discoverServices,
    addService,
    removeService,
    updateLastConnected,
  }
}

