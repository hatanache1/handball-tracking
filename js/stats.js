// Pure statistics on game files (no DOM). Usage: collectShots(game or games) -> filter -> group/ratio.
import { score } from './score.js';
import { SITUATIONS } from './schema.js';
import { goalZone, GOAL_WIDTH_M, GOAL_HEIGHT_M } from './goal.js';
import { RUECKRAUM_MIN_DISTANCE_M } from './situation.js';

// Below this many counted shots a value is shown greyed out.
export const MIN_SHOTS = 10;

// Goal difference (own - against) within +-this margin before the shot counts as "knapp".
// Tune after the first games.
export const CLOSE_GAME_MARGIN = 2;

// Location zones: distance from the goal middle (nah < first edge <= mittel < second edge <= fern) times side.
// Side uses the pitch x axis (js/situation.js): "links" = negative x, "rechts" = positive x.
export const LOCATION_ZONE_DISTANCE_EDGES_M = [6, RUECKRAUM_MIN_DISTANCE_M];
export const LOCATION_ZONE_SIDE_EDGE_M = 3;
export const LOCATION_ZONES = ['nah', 'mittel', 'fern'].flatMap((d) => ['links', 'mitte', 'rechts'].map((s) => `${d}-${s}`));

export const SCORE_STATES = ['fuehrung', 'knapp', 'rueckstand'];

// Goal grid cells are keyed "col-row": col 0..2 left to right, row 0..2 bottom to top (goal.js: y grows up).
const GOAL_GRID = 3;
export const GOAL_CELLS = [0, 1, 2].flatMap((row) => [0, 1, 2].map((col) => `${col}-${row}`));

function scoreState(diff) {
  if (Math.abs(diff) <= CLOSE_GAME_MARGIN) return 'knapp';
  return diff > 0 ? 'fuehrung' : 'rueckstand';
}

// Flattens one game or a list of games into shots, enriched with what the stats need:
// goalkeeperId (own value, else the keeper on court by the switch events), gameId, scoreState at the time of the shot.
// Events are read in stored order (= capture order), so the "score before the shot" is the score of the earlier events.
export function collectShots(games) {
  const shots = [];
  for (const game of [games].flat()) {
    let keeper = game.startGoalkeeperId;
    game.events.forEach((e, i) => {
      if (e.type === 'goalkeeperSwitch') keeper = e.goalkeeperId;
      if (e.type !== 'shot') return;
      const { own, against } = score(game.events.slice(0, i));
      shots.push({ ...e, goalkeeperId: e.goalkeeperId ?? keeper, gameId: game.id, scoreState: scoreState(own - against) });
    });
  }
  return shots;
}

export function forGoalkeeper(shots, goalkeeperId) {
  return shots.filter((s) => s.goalkeeperId === goalkeeperId);
}

// kind 'standard': saves (gehalten + vorbei + pfosten) / (saves + goals).
// kind 'hard': gehalten / (gehalten + goals), so vorbei and pfosten are not counted at all.
// Shots without result are never counted. Returns { hits, total, rate, lowSample }; rate is null for total 0.
export function ratio(shots, kind = 'standard') {
  const withResult = shots.filter((s) => s.result);
  const goals = withResult.filter((s) => s.result === 'tor').length;
  const hits = kind === 'hard' ? withResult.filter((s) => s.result === 'gehalten').length : withResult.length - goals;
  const total = kind === 'hard' ? hits + goals : withResult.length;
  return { hits, total, rate: total ? hits / total : null, lowSample: total < MIN_SHOTS };
}

// Ratio per key; shots whose keyOf is undefined (missing field) are left out. Every key in `keys` is present.
function group(shots, keys, keyOf, kind) {
  const buckets = Object.fromEntries(keys.map((k) => [k, []]));
  for (const s of shots) buckets[keyOf(s)]?.push(s);
  return Object.fromEntries(keys.map((k) => [k, ratio(buckets[k], kind)]));
}

export const byHalf = (shots, kind) => group(shots, [1, 2], (s) => s.half, kind);
export const bySituation = (shots, kind) => group(shots, SITUATIONS, (s) => s.situation, kind);
export const byScoreState = (shots, kind) => group(shots, SCORE_STATES, (s) => s.scoreState, kind);

export function locationZone({ x, y }) {
  const [near, far] = LOCATION_ZONE_DISTANCE_EDGES_M;
  const d = Math.hypot(x, y);
  const distance = d < near ? 'nah' : d < far ? 'mittel' : 'fern';
  const side = x < -LOCATION_ZONE_SIDE_EDGE_M ? 'links' : x > LOCATION_ZONE_SIDE_EDGE_M ? 'rechts' : 'mitte';
  return `${distance}-${side}`;
}
export const byLocationZone = (shots, kind) => group(shots, LOCATION_ZONES, (s) => s.location && locationZone(s.location), kind);

// Only targets inside the goal; frame hits and misses have no cell.
export function goalCell({ x, y }) {
  if (goalZone(x, y) !== 'innen') return undefined;
  const col = Math.min(GOAL_GRID - 1, Math.floor((x / GOAL_WIDTH_M) * GOAL_GRID));
  const row = Math.min(GOAL_GRID - 1, Math.floor((y / GOAL_HEIGHT_M) * GOAL_GRID));
  return `${col}-${row}`;
}
export const byGoalCell = (shots, kind) => group(shots, GOAL_CELLS, (s) => s.target && goalCell(s.target), kind);

// Subsets are independent flags, so a shot can be in several of them (e.g. a rebound that is also a fast break).
export function special(shots, kind) {
  return {
    siebenmeter: ratio(shots.filter((s) => s.situation === 'siebenmeter'), kind),
    gegenstoss: ratio(shots.filter((s) => s.fastBreak === true), kind),
    nachwurf: ratio(shots.filter((s) => s.rebound === true), kind),
  };
}
