'use client'

import { useEffect, useState } from "react";

import ROSLIB from 'roslib';

export interface IJoyCommand {
  x: number;
  y: number;
  yaw: number;
};

export default function useROS() {
  const [ros, setRos] = useState<ROSLIB.Ros | null>(null);
  const [cmd_vel, set_cmd_vel] = useState<ROSLIB.Topic>(null);


  useEffect(() => {
    const ros_ = new ROSLIB.Ros({
      url: 'ws://10.80.98.38:9090',
    });
    setRos(ros_);

    ros_.on('connection', function() {
      console.log('Connected to websocket server');
    });

    ros_.on('close', function() {
      console.log('Connection closed.');
    })

    const cmd_vel_ = new ROSLIB.Topic({
      ros: ros_,
      name: '/joy',
      messageType: 'sensor_msgs/Joy',
    });

    set_cmd_vel(cmd_vel_);
  }, []);

  const sendVelocity = (vel: IJoyCommand) => {
     const joy = new ROSLIB.Message({
      axes: [-vel.y, vel.x, 0.0, 0.0],
      buttons: [],
    });

    cmd_vel.publish(joy);
  };

  return { sendVelocity };

}

