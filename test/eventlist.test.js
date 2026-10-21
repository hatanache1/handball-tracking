import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe, timeLabel, listedEvents, removeEvent } from '../js/eventlist.js';

const events = [
  { id: 'a', type: 'shot', result: 'tor' },
  { id: 'b', type: 'shot' }, // open
  { id: 'c', type: 'goalkeeperSwitch', goalkeeperId: 'k' },
  { id: 'd', type: 'ownGoal' },
  { id: 'e', type: 'shot', result: 'gehalten' },
  { id: 'f', type: 'shot', situation: 'kreis' }, // open
];

test('list shows shots and own goals only, open shots first, newest first', () => {
  assert.deepEqual(listedEvents(events).map((e) => e.id), ['f', 'b', 'e', 'd', 'a']);
});

test('removeEvent drops exactly one event and keeps the others in order', () => {
  assert.deepEqual(removeEvent(events, 'd').map((e) => e.id), ['a', 'b', 'c', 'e', 'f']);
  assert.equal(removeEvent(events, 'unknown').length, events.length);
  assert.equal(events.length, 6); // input untouched
});

test('describe and timeLabel', () => {
  assert.equal(describe({ result: 'gehalten', situation: 'rueckraum', shooterNumber: 7 }), 'Gehalten · Rückraum · #7');
  assert.equal(describe({ fastBreak: true }), 'offen · Gegenstoß');
  assert.equal(timeLabel({ half: 2, gameTimeSec: 34 * 60 + 12 }), '2. HZ 34:12');
  assert.equal(timeLabel({ half: 1, gameTimeSec: 65 }), '1. HZ 01:05');
});
