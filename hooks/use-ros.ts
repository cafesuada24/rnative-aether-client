'use client'

import { useRef, useState } from "react";

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

  const disconnect = () => {
    if (rosRef.current != null) {
      rosRef.current.close();
      cmdVelRef.current = null;
      rosRef.current = null;
    }
    if (connected) {
      setConnected(false);
    }
  }

  const connect = (url: string) => {
    if (connected) {
      disconnect();
    }

    const ros = new ROSLIB.Ros({
      url: url,
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

    setConnected(true);
  }

  const sendVelocity = (vel: IJoyCommand) => {
    if (cmdVelRef.current == null) {
      console.warn('Publishing on a closed connection')
      return;
    }
    const joy = new ROSLIB.Message({
      axes: [-vel.y, vel.x, 0.0, 0.0],
      buttons: [],
    });

    cmdVelRef.current.publish(joy);
  };

  return { ros: rosRef.current, sendVelocity, connected, connect, disconnect };

}

