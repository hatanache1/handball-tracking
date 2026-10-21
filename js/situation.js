// Pitch coordinates (meters, half court 20 x 20 m): origin = middle of the goal on the goal line,
// x = sideways (positive to the right when looking from the court at the goal),
// y = distance from the goal line into the court (0..20).

// The 7 m penalty is not derived from a tap: its location is fixed to the 7 m spot,
// 7 m in front of the goal middle in the coordinate system above.
export const SEVEN_METER_LOCATION = { x: 0, y: 7 };

// A 7 m can only be thrown from the 7 m spot: a long press within this radius (meters) offers it, elsewhere it is a fast break.
// Tune after the first games.
export const SEVEN_METER_ZONE_RADIUS_M = 2;

export function inSevenMeterZone({ x, y }) {
  return Math.hypot(x - SEVEN_METER_LOCATION.x, y - SEVEN_METER_LOCATION.y) <= SEVEN_METER_ZONE_RADIUS_M;
}

export const RUECKRAUM_MIN_DISTANCE_M = 9;
// Angle between the line to the goal middle and the goal-line normal; at or above this the shot is from the wing.
export const AUSSEN_MIN_ANGLE_DEG = 60;

// Returns 'rueckraum' | 'aussen', or null when the close range needs the follow-up question
// (durchbruch / kreis / einlaeufer), because the position alone cannot tell them apart.
export function deriveSituation({ x, y }) {
  if (Math.hypot(x, y) >= RUECKRAUM_MIN_DISTANCE_M) return 'rueckraum';
  const angleDeg = (Math.atan2(Math.abs(x), y) * 180) / Math.PI;
  return angleDeg >= AUSSEN_MIN_ANGLE_DEG ? 'aussen' : null;
}
