'use client'

import { useEffect, useRef, useState } from "react";
import Constants from 'expo-constants';

import * as ROSLIB from '@tier4/roslibjs-foxglove';

export interface IJoyCommand {
  x: number;
  y: number;
  yaw: number;
};

export default function useROS() {
  const rosRef = useRef<ROSLIB.Ros | null>(null);
  const cmdVelRef = useRef<ROSLIB.Topic | null>(null);
  const [connected, setConnected] = useState<boolean>(false);


  useEffect(() => {
    const wsConfig = Constants.expoConfig?.extra?.ws;
    if (wsConfig == null) {
      console.error("Missing websocket config")
      return;
    }
    const ros = new ROSLIB.Ros({
      url: `${wsConfig.protocol}://${wsConfig.url}`,
    });

    ros.on('connection', function() {
      setConnected(true);
      console.log('Connected to websocket server');
    });

    ros.on('close', function() {
      setConnected(false);
      console.log('Connection closed.');
    })

    ros.on("error", (error: any) => {
      setConnected(false);
      console.log("[v0] Error connecting to ROS websocket server: ", error)
    })

    const cmdVel = new ROSLIB.Topic({
      ros: ros,
      name: '/joy',
      messageType: 'sensor_msgs/Joy',
    });

    rosRef.current = ros
    cmdVelRef.current = cmdVel


    return () => {
      ros.close()
    }

  }, []);

  const sendVelocity = (vel: IJoyCommand) => {
    const joy = new ROSLIB.Message({
      axes: [-vel.y, vel.x, 0.0, 0.0],
      buttons: [],
    });

    cmdVelRef.current.publish(joy);
  };

  return { ros: rosRef.current, sendVelocity, connected };

}

