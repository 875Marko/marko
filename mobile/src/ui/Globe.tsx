import React, { useEffect, useReducer, useRef } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { theme } from '@/src/theme';
import { LAND_DOTS } from '@/src/data/landDots';
import { clamp, latLngToVec3, project, rotateVec3 } from '@/src/lib/sphere';

export interface GlobeMarker {
  id: string;
  lat: number;
  lng: number;
}

interface GlobeProps {
  size: number;
  mine: GlobeMarker[];
  friends: GlobeMarker[];
  onMarkerPress?: (id: string, source: 'mine' | 'friends') => void;
}

const AUTO_ROTATE_STEP = 0.006;
const AUTO_ROTATE_INTERVAL_MS = 50;

export function Globe({ size, mine, friends, onMarkerPress }: GlobeProps) {
  const yaw = useRef(0.5);
  const pitch = useRef(-0.3);
  const dragging = useRef(false);
  const dragStart = useRef({ yaw: 0, pitch: 0 });
  const [, forceRender] = useReducer((c: number) => c + 1, 0);

  useEffect(() => {
    const id = setInterval(() => {
      if (!dragging.current) {
        yaw.current += AUTO_ROTATE_STEP;
        forceRender();
      }
    }, AUTO_ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragging.current = true;
        dragStart.current = { yaw: yaw.current, pitch: pitch.current };
      },
      onPanResponderMove: (_evt, gesture) => {
        yaw.current = dragStart.current.yaw + gesture.dx * 0.006;
        pitch.current = clamp(dragStart.current.pitch - gesture.dy * 0.006, -1.3, 1.3);
        forceRender();
      },
      onPanResponderRelease: () => {
        dragging.current = false;
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
      },
    })
  ).current;

  const radius = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;

  const projectedLand = LAND_DOTS
    .map(([lat, lng]) => project(rotateVec3(latLngToVec3(lat, lng), yaw.current, pitch.current), radius, cx, cy))
    .filter((p) => p.z > 0.04);

  const projectMarkers = (markers: GlobeMarker[], source: 'mine' | 'friends') =>
    markers
      .map((m) => ({
        marker: m,
        p: project(rotateVec3(latLngToVec3(m.lat, m.lng), yaw.current, pitch.current), radius, cx, cy),
      }))
      .filter((m) => m.p.z > 0.02)
      .map(({ marker, p }) => ({ marker, p, source }));

  const friendPins = projectMarkers(friends, 'friends');
  const minePins = projectMarkers(mine, 'mine');

  return (
    <View style={{ width: size, height: size }} {...panResponder.panHandlers}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="globeShade" cx="35%" cy="30%" r="75%">
            <Stop offset="0%" stopColor={theme.color.surfaceRaised} stopOpacity={1} />
            <Stop offset="100%" stopColor={theme.color.surface} stopOpacity={1} />
          </RadialGradient>
        </Defs>

        <Circle cx={cx} cy={cy} r={radius} fill="url(#globeShade)" stroke={theme.color.border} strokeWidth={1} />

        {projectedLand.map((p, idx) => (
          <Circle key={`land-${idx}`} cx={p.x} cy={p.y} r={1.3} fill={theme.color.success} opacity={0.3 + p.z * 0.5} />
        ))}

        {friendPins.map(({ marker, p }) => (
          <Circle
            key={`friend-${marker.id}`}
            cx={p.x}
            cy={p.y}
            r={4 + p.z * 1.5}
            fill={theme.color.rarity.rare}
            stroke={theme.color.surface}
            strokeWidth={1.5}
            opacity={0.55 + p.z * 0.45}
            onPress={() => onMarkerPress?.(marker.id, 'friends')}
          />
        ))}

        {minePins.map(({ marker, p }) => (
          <Circle
            key={`mine-${marker.id}`}
            cx={p.x}
            cy={p.y}
            r={4.5 + p.z * 1.5}
            fill={theme.color.brand}
            stroke={theme.color.surface}
            strokeWidth={1.5}
            opacity={0.65 + p.z * 0.35}
            onPress={() => onMarkerPress?.(marker.id, 'mine')}
          />
        ))}
      </Svg>
    </View>
  );
}
