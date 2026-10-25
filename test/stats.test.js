import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_SHOTS, CLOSE_GAME_MARGIN, LOCATION_ZONES, GOAL_CELLS,
  collectShots, forGoalkeeper, ratio, byHalf, bySituation, byScoreState, byLocationZone, byGoalCell, special, locationZone, goalCell,
} from '../js/stats.js';

let n = 0;
const shot = (fields = {}) => ({ id: `s${n++}`, type: 'shot', half: 1, gameTimeSec: 0, wallClock: '2026-10-21T12:00:00.000Z', ...fields });
const ownGoal = () => ({ id: `g${n++}`, type: 'ownGoal', half: 1, gameTimeSec: 0, wallClock: '2026-10-21T12:00:00.000Z' });
const game = (events, id = 'game1') => ({ schemaVersion: 1, id, startedAt: '2026-10-21T12:00:00.000Z', opponent: 'X', venue: 'heim', startGoalkeeperId: 'k1', events });
const results = (...rs) => rs.map((result) => shot({ result }));

test('standard ratio: vorbei and pfosten count as saves', () => {
  const r = ratio(results('tor', 'gehalten', 'vorbei', 'pfosten'));
  assert.deepEqual([r.hits, r.total, r.rate], [3, 4, 0.75]);
});

test('hard ratio: only gehalten counts, vorbei and pfosten are left out of the total', () => {
  const r = ratio(results('tor', 'gehalten', 'vorbei', 'pfosten'), 'hard');
  assert.deepEqual([r.hits, r.total, r.rate], [1, 2, 0.5]);
});

test('no counted shots: rate is null, not NaN', () => {
  assert.equal(ratio([]).rate, null);
  assert.equal(ratio(results('vorbei'), 'hard').rate, null);
});

test('lowSample flips exactly at MIN_SHOTS', () => {
  const many = (count) => results(...Array(count).fill('gehalten'));
  assert.equal(ratio(many(MIN_SHOTS - 1)).lowSample, true);
  assert.equal(ratio(many(MIN_SHOTS)).lowSample, false);
});

test('shots without result are not counted anywhere', () => {
  const shots = [shot({ situation: 'kreis' }), shot({ situation: 'kreis', result: 'tor' })];
  assert.equal(ratio(shots).total, 1);
  assert.equal(bySituation(shots).kreis.total, 1);
});

test('shots missing the grouping field are left out of that grouping only', () => {
  const shots = [shot({ result: 'tor' }), shot({ result: 'gehalten', situation: 'aussen', location: { x: 0, y: 10 }, target: { x: 1.5, y: 1 } })];
  assert.equal(ratio(shots).total, 2);
  assert.equal(bySituation(shots).aussen.total, 1);
  assert.equal(byLocationZone(shots)['fern-mitte'].total, 1);
  assert.equal(byGoalCell(shots)['1-1'].total, 1);
  assert.equal(Object.values(byLocationZone(shots)).reduce((a, r) => a + r.total, 0), 1);
});

test('groupings contain every key, even when empty', () => {
  assert.equal(Object.keys(bySituation([])).length, 6);
  assert.equal(Object.keys(byLocationZone([])).length, LOCATION_ZONES.length);
  assert.equal(Object.keys(byGoalCell([])).length, GOAL_CELLS.length);
  assert.deepEqual(Object.keys(byHalf([])), ['1', '2']);
});

test('byHalf splits by half', () => {
  const h = byHalf([shot({ half: 1, result: 'tor' }), shot({ half: 2, result: 'gehalten' }), shot({ half: 2, result: 'tor' })]);
  assert.deepEqual([h[1].hits, h[1].total, h[2].hits, h[2].total], [0, 1, 1, 2]);
});

test('special: 7m, fast break and rebound are separate subsets', () => {
  const s = special([
    shot({ situation: 'siebenmeter', result: 'tor' }),
    shot({ fastBreak: true, result: 'gehalten' }),
    shot({ rebound: true, result: 'tor' }),
    shot({ rebound: false, result: 'tor' }),
  ]);
  assert.deepEqual([s.siebenmeter.total, s.gegenstoss.total, s.nachwurf.total], [1, 1, 1]);
  assert.equal(s.gegenstoss.hits, 1);
});

test('location zone: distance and side edges', () => {
  assert.equal(locationZone({ x: 0, y: 2 }), 'nah-mitte');
  assert.equal(locationZone({ x: 0, y: 7 }), 'mittel-mitte');
  assert.equal(locationZone({ x: 0, y: 9 }), 'fern-mitte');
  assert.equal(locationZone({ x: -4, y: 1 }), 'nah-links');
  assert.equal(locationZone({ x: 4, y: 1 }), 'nah-rechts');
  assert.ok(LOCATION_ZONES.includes(locationZone({ x: 12, y: 15 })));
});

test('goal cell: 3x3 inside the goal, frame and outside have none', () => {
  assert.equal(goalCell({ x: 0.5, y: 0.3 }), '0-0');
  assert.equal(goalCell({ x: 2.7, y: 1.7 }), '2-2');
  assert.equal(goalCell({ x: 1.5, y: 1 }), '1-1');
  assert.equal(goalCell({ x: 0.05, y: 1 }), undefined);
  assert.equal(goalCell({ x: 4, y: 1 }), undefined);
});

test('collectShots: score state uses only events before the shot, shot itself is excluded', () => {
  const g = game([
    shot({ result: 'tor' }), // 0:0 -> knapp
    shot({ result: 'tor' }), // 0:1 -> knapp
    shot({ result: 'tor' }), // 0:2 -> knapp (margin edge)
    shot({ result: 'gehalten' }), // 0:3 -> rueckstand
    ownGoal(), ownGoal(), ownGoal(), ownGoal(), ownGoal(), ownGoal(),
    shot({ result: 'gehalten' }), // 6:3 -> fuehrung
  ]);
  assert.equal(CLOSE_GAME_MARGIN, 2);
  assert.deepEqual(collectShots(g).map((s) => s.scoreState), ['knapp', 'knapp', 'knapp', 'rueckstand', 'fuehrung']);
});

test('byScoreState groups by lead at the time of the shot', () => {
  const g = game([shot({ result: 'tor' }), shot({ result: 'tor' }), shot({ result: 'tor' }), shot({ result: 'gehalten' })]);
  const s = byScoreState(collectShots(g));
  assert.deepEqual([s.knapp.total, s.rueckstand.total, s.fuehrung.total], [3, 1, 0]);
});

test('goalkeeper: own id wins, else the keeper by switch events, else the start keeper', () => {
  const sw = { id: 'sw', type: 'goalkeeperSwitch', half: 1, gameTimeSec: 0, wallClock: '2026-10-21T12:00:00.000Z', goalkeeperId: 'k2' };
  const g = game([shot({ result: 'tor' }), sw, shot({ result: 'tor' }), shot({ result: 'tor', goalkeeperId: 'k3' })]);
  const shots = collectShots(g);
  assert.deepEqual(shots.map((s) => s.goalkeeperId), ['k1', 'k2', 'k3']);
  assert.equal(forGoalkeeper(shots, 'k2').length, 1);
});

test('a list of games (season) works like a single game', () => {
  const shots = collectShots([game([shot({ result: 'tor' })], 'a'), game([shot({ result: 'gehalten' })], 'b')]);
  assert.deepEqual(shots.map((s) => s.gameId), ['a', 'b']);
  assert.equal(ratio(shots).total, 2);
});

test('an empty game and a shot with no optional fields do not break anything', () => {
  assert.deepEqual(collectShots(game([])), []);
  const [s] = collectShots(game([shot()]));
  assert.equal(ratio([s]).total, 0);
  assert.equal(special([s]).siebenmeter.total, 0);
});
