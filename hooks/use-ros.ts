'use client'

import { useRef, useState } from "react";

import * as ROSLIB from '@tier4/roslibjs-foxglove';

export interface IJoyCommand {
  x: number;
  y: number;
  yaw: number;
};

export interface INavFeedback {
  nav_time_sec: number;
  ETA: number;
  distance_remaining_meter: number;
}

type NavStatusType = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export default function useROS() {
  const rosRef = useRef<ROSLIB.Ros | null>(null);
  const cmdVelRef = useRef<ROSLIB.Topic | null>(null);
  const chatServiceRef = useRef<ROSLIB.Service | null>(null);
  const getWaypointsServiceRef = useRef<ROSLIB.Service | null>(null);
  const navActionFeedbackSubRef = useRef<ROSLIB.Topic | null>(null);
  const navActionStatusSubRef = useRef<ROSLIB.Topic | null>(null);
  const [navFeedback, setNavFeedback] = useState<INavFeedback | null>(null);
  const [navStatus, setNavStatus] = useState<NavStatusType>(0)
  const [connected, setConnected] = useState<boolean>(false);

  const disconnect = () => {
    if (rosRef.current != null) {
      cmdVelRef.current = null;
      chatServiceRef.current = null;
      getWaypointsServiceRef.current = null;
      navActionStatusSubRef.current?.unsubscribe()
      navActionStatusSubRef.current = null;
      navActionFeedbackSubRef.current?.unsubscribe();
      navActionFeedbackSubRef.current = null;
      rosRef.current.close();
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
      console.log("Error connecting to ROS websocket server: ", error)
    })

    const cmdVel = new ROSLIB.Topic({
      ros: ros,
      name: '/joy',
      messageType: 'sensor_msgs/Joy',
    });

    const navActionFeedbackTopic = new ROSLIB.Topic({
      ros: ros,
      name: '/navigate_to_pose/_action/feedback',
      messageType: 'nav2_msgs/action/NavigateToPose_FeedbackMessage',
    })

    navActionFeedbackTopic.subscribe((msg: any) => {
      console.log('Received feedback:', msg)

      setNavFeedback({
        nav_time_sec: msg.navigation_time.sec,
        distance_remaining_meter: msg.distance_remaining,
        ETA: msg.estimated_time_remaining.sec,
      })
    })

    const navActionStatusTopic = new ROSLIB.Topic({
      ros: ros,
      name: '/navigate_to_pose/_action/status',
      messageType: 'action_msgs/msg/GoalStatusArray',
    })

    navActionStatusTopic.subscribe((msg: any) => {
      console.log('Received status:', msg)

      if (msg.status_list.length === 0) {
        setNavStatus(0)
        return
      }
      setNavStatus(msg.status_list[msg.status_list.length - 1].status)
    })

    const chatService = new ROSLIB.Service({
      ros: ros,
      name: '/prompt',
      serviceType: 'aether_interfaces/LLMPrompt',
    })


    const getWaypointsService = new ROSLIB.Service({
      ros: ros,
      name: '/get_waypoints',
      serviceType: 'aether_interfaces/GetWaypoints',
    })

    rosRef.current = ros
    cmdVelRef.current = cmdVel
    chatServiceRef.current = chatService
    getWaypointsServiceRef.current = getWaypointsService;
    navActionFeedbackSubRef.current = navActionFeedbackTopic
    navActionStatusSubRef.current = navActionStatusTopic

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

  return {
    ros: rosRef.current,
    sendVelocity,
    connected,
    connect,
    disconnect,
    getWaypoints: getWaypointsServiceRef.current,
    chatService: chatServiceRef.current,
    navStatus,
    navFeedback,
  };

}

