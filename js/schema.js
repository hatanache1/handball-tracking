export const SCHEMA_VERSION = 1;
export const HALF_LENGTH_SEC = 30 * 60;

export const EVENT_TYPES = ['shot', 'ownGoal', 'goalkeeperSwitch'];
export const SITUATIONS = ['rueckraum', 'aussen', 'durchbruch', 'kreis', 'einlaeufer', 'siebenmeter'];
export const RESULTS = ['tor', 'gehalten', 'vorbei', 'pfosten'];
export const VENUES = ['heim', 'auswaerts'];

export function newGame({ opponent, venue, startGoalkeeperId }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    opponent,
    venue,
    startGoalkeeperId,
    events: [],
  };
}

// Both timestamps are mandatory: later merging with video and several recorders needs them.
// `fields` carries the type-specific data (shot details, goalkeeper switch target, ...).
export function newEvent(type, half, gameTimeSec, fields = {}) {
  return {
    ...fields,
    id: crypto.randomUUID(),
    type,
    half,
    gameTimeSec,
    wallClock: new Date().toISOString(),
  };
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isPoint = (p) => p !== null && typeof p === 'object' && isNum(p.x) && isNum(p.y);

// Returns a list of error strings; empty list means valid.
// Shot fields are optional on purpose (incomplete shots are allowed), but if present they must be well-formed.
export function validateGame(game) {
  const errors = [];
  if (!game || typeof game !== 'object') return ['game is not an object'];
  if (game.schemaVersion !== SCHEMA_VERSION) errors.push('schemaVersion');
  for (const key of ['id', 'startedAt', 'opponent', 'startGoalkeeperId']) {
    if (typeof game[key] !== 'string' || game[key] === '') errors.push(key);
  }
  if (!VENUES.includes(game.venue)) errors.push('venue');
  if (!Array.isArray(game.events)) return [...errors, 'events'];

  game.events.forEach((e, i) => {
    const bad = (field) => errors.push(`events[${i}].${field}`);
    if (!e || typeof e !== 'object') return bad('');
    if (typeof e.id !== 'string' || e.id === '') bad('id');
    if (!EVENT_TYPES.includes(e.type)) bad('type');
    if (e.half !== 1 && e.half !== 2) bad('half');
    if (!isNum(e.gameTimeSec)) bad('gameTimeSec');
    if (typeof e.wallClock !== 'string' || Number.isNaN(Date.parse(e.wallClock))) bad('wallClock');
    if (e.type !== 'shot') return;

    if (e.goalkeeperId !== undefined && typeof e.goalkeeperId !== 'string') bad('goalkeeperId');
    if (e.location !== undefined && !isPoint(e.location)) bad('location');
    if (e.target !== undefined && !isPoint(e.target)) bad('target');
    if (e.situation !== undefined && !SITUATIONS.includes(e.situation)) bad('situation');
    if (e.result !== undefined && !RESULTS.includes(e.result)) bad('result');
    for (const flag of ['fastBreak', 'rebound']) {
      if (e[flag] !== undefined && typeof e[flag] !== 'boolean') bad(flag);
    }
    if (e.shooterNumber !== undefined && !Number.isInteger(e.shooterNumber)) bad('shooterNumber');
    if (e.tags !== undefined && !(Array.isArray(e.tags) && e.tags.every((t) => typeof t === 'string'))) bad('tags');
    if (e.note !== undefined && typeof e.note !== 'string') bad('note');
  });
  return errors;
}
