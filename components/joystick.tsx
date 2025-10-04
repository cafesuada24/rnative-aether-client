import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { calcDistance, degreesToRadians, findCoord, calcAngle, roundFloat } from "@/utils/math";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { IReactNativeJoystickProps } from "@/types/types";

export const JoyStick = ({ onStart, onMove, onStop, color = "#000000", radius = 150, style, ...props }: IReactNativeJoystickProps) => {
  const wrapperRadius = radius;
  const nippleRadius = wrapperRadius / 3;

  const [x, setX] = useState(wrapperRadius - nippleRadius);
  const [y, setY] = useState(wrapperRadius - nippleRadius);

  const handlePanActive = useCallback(
    (event: {x: number; y : number; translationX: number; translationY: number}) => {
      const fingerX = event.x;
      const fingerY = Platform.OS === 'web' ? (wrapperRadius * 2 - event.y) : event.y;
      const center = { x: wrapperRadius, y: wrapperRadius };
      const fingerCoord = { x: fingerX, y: fingerY };

      let coordinates = {
        x: fingerX - nippleRadius,
        y: fingerY - nippleRadius,
      };


      const angle = calcAngle(fingerCoord, center);

      let dist = calcDistance(center, fingerCoord);

      const magnitude = Math.min(dist, wrapperRadius) / wrapperRadius;
      const angleRad = degreesToRadians(angle);
      

      dist = Math.min(dist, wrapperRadius);
      if (dist === wrapperRadius) {
        coordinates = findCoord(center, dist, angle);
        coordinates = {
          x: coordinates.x - nippleRadius,
          y: coordinates.y - nippleRadius,
        };
      }
      setX(coordinates.x);
      setY(coordinates.y);

      onMove &&
        onMove({
          position: coordinates,
          angle: {
            radian: angleRad,
            degree: angle,
          },
          normalized: {
            x: roundFloat(magnitude * Math.cos(angleRad), 2),
            y: roundFloat(magnitude * Math.sin(angleRad), 2),
          },
          force: magnitude,
          type: "move",
        });
    },
    [nippleRadius, wrapperRadius, onMove]
  );


  const handleTouchEnd = () => {
    setX(wrapperRadius - nippleRadius);
    setY(wrapperRadius - nippleRadius);
    onStop &&
      onStop({
        force: 0,
        position: {
          x: 0,
          y: 0,
        },
        normalized: {
          x: 0,
          y: 0,
        },
        angle: {
          radian: 0,
          degree: 0,
        },
        type: "stop",
      });
  };

  const handleTouchStart = () => {
    onStart &&
      onStart({
        force: 0,
        position: {
          x: 0,
          y: 0,
        },
        normalized: {
          x: 0,
          y: 0,
        },
        angle: {
          radian: 0,
          degree: 0,
        },
        type: "start",
      });
  };

  const panGesture = Gesture.Pan().onStart(handleTouchStart).onUpdate(handlePanActive).onEnd(handleTouchEnd).runOnJS(true);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          width: 2 * radius,
          height: 2 * radius,
          borderRadius: radius,
          backgroundColor: `${color}55`,
          transform: [{ rotateX: "180deg" }],
          ...(style && typeof style === "object" ? style : {}),
        },
        nipple: {
          height: 2 * nippleRadius,
          width: 2 * nippleRadius,
          borderRadius: nippleRadius,
          backgroundColor: `${color}bb`,
          position: "absolute",
          transform: [
            {
              translateX: x,
            },
            { translateY: y },
          ],
        },
      }),
    [radius, color, nippleRadius, x, y, style]
  );

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.wrapper} {...props}>
        <View pointerEvents="none" style={styles.nipple}></View>
      </View>
    </GestureDetector>
  );
};

export type { IReactNativeJoystickEvent, IReactNativeJoystickProps } from "@/types/types";
