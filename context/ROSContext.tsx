'use client'

import { createContext, useContext, useRef, useState } from "react";

import * as ROSLIB from "roslib"
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

export interface IOdom {
  twist: {
    twist: {
      linear: {
        x: number,
        y: number,
        z: number
      }
    }
  }
}

type NavStatusType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface ROSContextValue {
  ros: ROSLIB.Ros | null,
  sendVelocity: (vel: IJoyCommand) => void,
  connected: boolean,
  connect: (url: string, port: string) => void,
  disconnect: () => void,
  chatService: ROSLIB.Service,
  saveMapService: ROSLIB.Service,
  loadMapService: ROSLIB.Service,
  getMapsService: ROSLIB.Service,
  updateMapService: ROSLIB.Service,
  deleteMapService: ROSLIB.Service,
  navStatus: NavStatusType,
  navFeedback: INavFeedback | null,
  odom: IOdom | null,
  currentHost: string | null,
  currentPort: string | null,
  robotMode: RobotMode,
  changeRobotModeAct: ROSLIB.Action,
}

const ROSContext = createContext<ROSContextValue | null>(null)

export const useROS = () => {
  const context = useContext(ROSContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export enum RobotMode{
  NO_MODE,
  MAPPING,
  LOCALIZATION,
}
export const ROSProvider = ({ children }: { children: React.ReactNode }) => {
  const rosRef = useRef<ROSLIB.Ros | null>(null);
  const cmdVelRef = useRef<ROSLIB.Topic | null>(null);
  const chatServiceRef = useRef<ROSLIB.Service | null>(null);
  const getWaypointsServiceRef = useRef<ROSLIB.Service | null>(null);
  const navActionFeedbackSubRef = useRef<ROSLIB.Topic | null>(null);
  const navActionStatusSubRef = useRef<ROSLIB.Topic | null>(null);
  const odometryRef = useRef<ROSLIB.Topic | null>(null);
  const getMapsSrvRef = useRef<ROSLIB.Service | null>(null);
  const saveMapSrvRef = useRef<ROSLIB.Service | null>(null);
  const loadMapSrvRef = useRef<ROSLIB.Service | null>(null);
  const updateMapSrvRef = useRef<ROSLIB.Service | null>(null);
  const deleteMapSrvRef = useRef<ROSLIB.Service | null>(null);
  const changeRobotModeActRef = useRef<ROSLIB.Action | null>(null);

  const [robotMode, setRobotMode] = useState<RobotMode>(RobotMode.NO_MODE);
  const [navFeedback, setNavFeedback] = useState<INavFeedback | null>(null);
  const [navStatus, setNavStatus] = useState<NavStatusType>(0)
  const [connected, setConnected] = useState<boolean>(false);
  const [odom, setOdom] = useState<IOdom | null>(null);

  const [url, setURL] = useState<string | null>(null);
  const [port, setPort] = useState<string | null>(null);

  const disconnect = () => {
    if (rosRef.current != null) {
      cmdVelRef.current = null;
      chatServiceRef.current = null;
      getWaypointsServiceRef.current = null;
      navActionStatusSubRef.current?.unsubscribe()
      navActionStatusSubRef.current = null;
      navActionFeedbackSubRef.current?.unsubscribe();
      navActionFeedbackSubRef.current = null;
      changeRobotModeActRef.current = null
      odometryRef.current?.unsubscribe();
      odometryRef.current = null
      rosRef.current.close();
      rosRef.current = null;

      getMapsSrvRef.current = null;
      loadMapSrvRef.current = null;
      saveMapSrvRef.current = null;

      setNavStatus(0);
      setNavFeedback(null);
      setOdom(null);
    }
    setConnected(false);
  }

  const connect = (url: string, port: string) => {
    if (connected) {
      disconnect();
    }

    const ros = new ROSLIB.Ros({
      url: `ws://${url}:${port}`,
    });
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
        nav_time_sec: msg.feedback.navigation_time.sec,
        distance_remaining_meter: msg.feedback.distance_remaining,
        ETA: msg.feedback.estimated_time_remaining.sec,
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
      name: '/chat',
      serviceType: 'aether_interfaces/LLMPrompt',
    })


    const getWaypointsService = new ROSLIB.Service({
      ros: ros,
      name: '/get_waypoints',
      serviceType: 'aether_interfaces/GetWaypoints',
    })

    const odometryTopic = new ROSLIB.Topic({
      ros: ros,
      name: '/odometry/filtered',
      messageType: 'nav_msgs/msg/Odometry',
    })

    odometryTopic.subscribe((msg: any) => {
      setOdom(msg)
    })

    const getMapsService = new ROSLIB.Service({
      ros: ros,
      name: '/map_manager/get_maps',
      serviceType: 'aether_interfaces/GetMaps',
    })

    const saveMapService = new ROSLIB.Service({
      ros: ros,
      name: '/map_manager/save_map',
      serviceType: 'aether_interfaces/SaveMap',
    })

    const loadMapService = new ROSLIB.Service({
      ros: ros,
      name: '/map_manager/load_map',
      serviceType: 'aether_interfaces/LoadMap',
    })
    const updateMapService = new ROSLIB.Service({
      ros: ros,
      name: '/map_manager/update_map',
      serviceType: 'aether_interfaces/UpdateMap',
    })

    const deleteMapService = new ROSLIB.Service({
      ros: ros,
      name: '/map_manager/delete_map',
      serviceType: 'aether_interfaces/DeleteMap',
    })

    const robotModeSub = new ROSLIB.Topic({
      ros: ros,
      name: '/robot_mode/status_update',
      messageType: 'aether_interfaces/msg/RobotMode',
      qos: {
        durability: 'transient_local',
        reliability: 'reliable',
      },
    })

    robotModeSub.subscribe((msg: any) => {
      console.log("Mode received: " + msg.mode)
      if (msg.mode === 1) {
        setRobotMode(RobotMode.MAPPING)
      } else if (msg.mode === 2) {
        setRobotMode(RobotMode.LOCALIZATION)
      } else {
        setRobotMode(RobotMode.NO_MODE)
      }
    })

    const changeRobotModeAct = new ROSLIB.Action({
      ros: ros,
      name: '/robot_mode/change',
      actionType: 'aether_interfaces/ChangeRobotMode',
    })

    ros.on('connection', function() {
      setConnected(true);
      setPort(port);
      setURL(url)
      rosRef.current = ros
      cmdVelRef.current = cmdVel
      chatServiceRef.current = chatService
      getWaypointsServiceRef.current = getWaypointsService;
      navActionFeedbackSubRef.current = navActionFeedbackTopic
      navActionStatusSubRef.current = navActionStatusTopic
      odometryRef.current = odometryTopic;

      getMapsSrvRef.current = getMapsService;
      loadMapSrvRef.current = loadMapService;
      saveMapSrvRef.current = saveMapService;
      updateMapSrvRef.current = updateMapService;
      deleteMapSrvRef.current = deleteMapService;

      changeRobotModeActRef.current = changeRobotModeAct;

      setConnected(true);
      console.log('Connected to websocket server');
    });

    ros.on('close', function() {
      disconnect()
      console.log('Connection closed.');
    })

    ros.on("error", (error: any) => {
      disconnect()
      console.log(`Error connecting to ROS websocket server ${url}:${port}: `, error)
    })

  }

  const sendVelocity = (vel: IJoyCommand) => {
    if (cmdVelRef.current == null) {
      console.warn('Publishing on a closed connection')
      return;
    }

    cmdVelRef.current.publish({
      axes: [-vel.y, vel.x, 0.0, 0.0],
      buttons: [],
    })
  };

  const value = {
    ros: rosRef.current,
    sendVelocity,
    connected,
    connect,
    disconnect,
    // getWaypoints: getWaypointsServiceRef.current,
    chatService: chatServiceRef.current,
    saveMapService: saveMapSrvRef.current,
    loadMapService: loadMapSrvRef.current,
    getMapsService: getMapsSrvRef.current,
    updateMapService: updateMapSrvRef.current,
    deleteMapService: deleteMapSrvRef.current,
    navStatus,
    navFeedback,
    odom,
    currentHost: url,
    currentPort: port,
    robotMode,
    changeRobotModeAct: changeRobotModeActRef.current
  };

  return (
    <ROSContext.Provider value={value}>
      {children}
    </ROSContext.Provider>
  );

}

