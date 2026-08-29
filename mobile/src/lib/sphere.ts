export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Unit-sphere position for a lat/lng pair, degrees in, radians internally. */
export function latLngToVec3(lat: number, lng: number): Vec3 {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  return {
    x: Math.cos(phi) * Math.sin(lambda),
    y: Math.sin(phi),
    z: Math.cos(phi) * Math.cos(lambda),
  };
}

/** Rotate around the vertical (yaw) axis then the horizontal (pitch) axis. */
export function rotateVec3(v: Vec3, yaw: number, pitch: number): Vec3 {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const x1 = v.x * cosY + v.z * sinY;
  const z1 = -v.x * sinY + v.z * cosY;

  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const y2 = v.y * cosP - z1 * sinP;
  const z2 = v.y * sinP + z1 * cosP;

  return { x: x1, y: y2, z: z2 };
}

/** Orthographic projection onto a 2D canvas centered at (cx, cy). z is kept
 * for depth-based culling/shading (positive = facing the viewer). */
export function project(v: Vec3, radius: number, cx: number, cy: number) {
  return { x: cx + v.x * radius, y: cy - v.y * radius, z: v.z };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
