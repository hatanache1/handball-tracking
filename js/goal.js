// Goal coordinate system, in meters, seen from the shooter (front view):
//   origin (0, 0) = floor at the inner edge of the left post, x grows to the right (0..3), y grows up (0..2).
// Points outside 0..3 / 0..2 are valid pins (shot went wide or over).
export const GOAL_WIDTH_M = 3;
export const GOAL_HEIGHT_M = 2;

// Half the width of the "frame" band around the posts and crossbar (post is ~8 cm, plus finger inaccuracy).
// Tune after the first games.
export const FRAME_TOLERANCE_M = 0.1;

// Guards against float noise like |2.9 - 3| = 0.10000000000000009 at the band edge.
const EPS = 1e-9;
const T = FRAME_TOLERANCE_M + EPS;

// Returns 'innen' | 'rahmen' | 'aussen'. The floor is no frame: y < 0 is outside, y = 0 is still inside.
export function goalZone(x, y) {
  const onPost = Math.min(Math.abs(x), Math.abs(x - GOAL_WIDTH_M)) <= T && y >= 0 && y <= GOAL_HEIGHT_M + T;
  const onBar = Math.abs(y - GOAL_HEIGHT_M) <= T && x >= -T && x <= GOAL_WIDTH_M + T;
  if (onPost || onBar) return 'rahmen';
  return x > 0 && x < GOAL_WIDTH_M && y >= 0 && y < GOAL_HEIGHT_M ? 'innen' : 'aussen';
}
