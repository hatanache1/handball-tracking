import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HALF_LENGTH_SEC, newGame, newEvent, validateGame } from '../js/schema.js';

const game = () => newGame({ opponent: 'Team A', venue: 'heim', startGoalkeeperId: 'gk1' });

test('new game is valid and half length is 30 min', () => {
  assert.deepEqual(validateGame(game()), []);
  assert.equal(HALF_LENGTH_SEC, 1800);
});

test('game missing required fields is invalid', () => {
  const g = game();
  delete g.opponent;
  g.venue = 'nowhere';
  assert.deepEqual(validateGame(g), ['opponent', 'venue']);
});

test('event gets id and both timestamps', () => {
  const e = newEvent('ownGoal', 1, 12);
  assert.ok(e.id && e.wallClock && e.gameTimeSec === 12);
});

test('shot with no optional fields is valid', () => {
  const g = game();
  g.events.push(newEvent('shot', 1, 0));
  assert.deepEqual(validateGame(g), []);
});

test('partially filled shot is valid, full shot is valid', () => {
  const g = game();
  g.events.push(newEvent('shot', 1, 5, { location: { x: 8, y: 3 } }));
  g.events.push(newEvent('shot', 2, 5, {
    goalkeeperId: 'gk1', location: { x: 6, y: 0 }, situation: 'kreis', fastBreak: false, rebound: true,
    target: { x: 1.5, y: 1 }, result: 'tor', shooterNumber: 7, tags: ['a'], note: 'x',
  }));
  assert.deepEqual(validateGame(g), []);
});

test('missing event timestamps or bad half are reported', () => {
  const g = game();
  const e = newEvent('goalkeeperSwitch', 1, 0);
  delete e.wallClock;
  e.half = 3;
  g.events.push(e);
  assert.deepEqual(validateGame(g), ['events[0].half', 'events[0].wallClock']);
});

test('malformed shot fields are reported', () => {
  const g = game();
  g.events.push(newEvent('shot', 1, 0, { result: 'treffer', location: { x: 'a', y: 1 } }));
  assert.deepEqual(validateGame(g), ['events[0].location', 'events[0].result']);
});
