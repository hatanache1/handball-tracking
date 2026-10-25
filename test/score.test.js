import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score, scoreSeries } from '../js/score.js';
import { newClock, clockSec, isRunning, toggle, adjust, switchHalf, firstHalfOver, tap } from '../js/clock.js';

test('score counts conceded goals and own goals, ignoring everything else', () => {
  const events = [
    { type: 'shot', result: 'tor' },
    { type: 'shot', result: 'gehalten' },
    { type: 'shot', result: 'vorbei' },
    { type: 'shot' }, // open shot
    { type: 'ownGoal' },
    { type: 'ownGoal' },
    { type: 'goalkeeperSwitch', goalkeeperId: 'a' },
  ];
  assert.deepEqual(score(events), { own: 2, against: 1 });
});

test('score of an empty game is 0:0', () => {
  assert.deepEqual(score([]), { own: 0, against: 0 });
});

test('clock counts only while running and survives a "reload" (plain data)', () => {
  let c = toggle(newClock('g'), 1000);
  c = JSON.parse(JSON.stringify(c));
  assert.equal(clockSec(c, 11000), 10);
  c = toggle(c, 11000);
  assert.equal(clockSec(c, 99000), 10); // stopped
});

test('adjust moves the clock, never below 0, and keeps the running state', () => {
  assert.equal(clockSec(adjust(newClock('g'), -10, 0), 0), 0);
  const running = adjust(toggle(newClock('g'), 0), 60, 5000);
  assert.equal(clockSec(running, 8000), 68);
});

test('clock halts at 30:00 in the 1st half and at 60:00 in the 2nd, running or dragged', () => {
  const running = adjust(toggle(newClock('g'), 0), 29 * 60 + 50, 0);
  assert.equal(clockSec(running, 5000), 29 * 60 + 55);
  assert.equal(clockSec(running, 60000), 1800); // ran into the limit
  assert.equal(isRunning(running, 60000), false);
  assert.equal(clockSec(adjust(newClock('g'), 99999, 0), 0), 1800); // dragging up never passes it
  const second = switchHalf(newClock('g'));
  assert.equal(clockSec(adjust(second, 99999, 0), 0), 3600);
});

test('toggle does not start a clock that sits at its limit', () => {
  const atLimit = adjust(newClock('g'), 1800, 0);
  assert.equal(isRunning(toggle(atLimit, 1000), 1000), false);
  const wasRunning = toggle(adjust(toggle(newClock('g'), 0), 1790, 0), 20000); // ran past 30:00, then tapped
  assert.equal(wasRunning.startedAt, null);
  assert.equal(clockSec(wasRunning, 99000), 1800);
});

test('digits of the clock: minutes and seconds move by 60 and 1, seconds carry into minutes', () => {
  const c = adjust(adjust(newClock('g'), 60, 0), 59, 0);
  assert.equal(clockSec(c, 0), 119);
  assert.equal(clockSec(adjust(c, 1, 0), 0), 120); // 01:59 -> 02:00
  assert.equal(clockSec(adjust(c, -60, 0), 0), 59);
});

test('tap starts and stops; at 30:00 it starts the 2nd half instead', () => {
  let c = tap(newClock('g'), 0);
  assert.equal(isRunning(c, 0), true);
  c = tap(c, 5000);
  assert.equal(isRunning(c, 5000), false);
  const end = adjust(newClock('g'), 1800, 0);
  assert.equal(firstHalfOver(end, 0), true);
  const second = tap(end, 7000);
  assert.equal(second.half, 2);
  assert.equal(isRunning(second, 7000), true);
  assert.equal(clockSec(second, 12000), 1805);
  assert.equal(firstHalfOver(second, 12000), false);
});

test('switchHalf stops the clock at the half boundary', () => {
  const c = switchHalf(toggle(newClock('g'), 0));
  assert.equal(c.half, 2);
  assert.equal(clockSec(c, 5000), 1800);
  assert.equal(switchHalf(c).half, 1);
});

test('scoreSeries makes step points per goal, ordered by game time', () => {
  const events = [
    { type: 'shot', result: 'tor', half: 2, gameTimeSec: 2400 },
    { type: 'ownGoal', half: 1, gameTimeSec: 600 },
    { type: 'shot', result: 'gehalten', half: 1, gameTimeSec: 700 },
  ];
  const s = scoreSeries(events);
  assert.deepEqual(s.own, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 1 }, { x: 40, y: 1 }]);
  assert.deepEqual(s.against, [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 1 }, { x: 40, y: 1 }]);
  assert.equal(s.lastX, 40);
});
