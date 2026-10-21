import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyFlow, addStep, undo, cancel, shotFields, isComplete, parkable, flowFromShot, withFlow } from '../js/shotflow.js';

const build = (...steps) => steps.reduce(addStep, emptyFlow());

test('undo removes exactly the last tap, in reverse order; target and result are one tap', () => {
  let flow = build({ location: { x: 0, y: 10 }, situation: 'rueckraum' }, { target: { x: 1, y: 1 }, result: 'tor' }, { shooterNumber: 7 });
  flow = undo(flow);
  assert.deepEqual(shotFields(flow), { location: { x: 0, y: 10 }, situation: 'rueckraum', target: { x: 1, y: 1 }, result: 'tor' });
  flow = undo(flow);
  assert.deepEqual(shotFields(flow), { location: { x: 0, y: 10 }, situation: 'rueckraum' });
  flow = undo(flow);
  assert.deepEqual(shotFields(flow), {});
});

test('undo after the result: the saved shot loses target and result but keeps the rest', () => {
  const saved = { id: 'a', type: 'shot', half: 1, gameTimeSec: 5, wallClock: 'w', goalkeeperId: 'g', location: { x: 0, y: 10 }, situation: 'rueckraum', target: { x: 1, y: 1 }, result: 'tor', shooterNumber: 7 };
  const flow = build({ location: saved.location, situation: saved.situation }, { target: saved.target, result: 'tor' }, { shooterNumber: 7 });
  const { target, result, shooterNumber, ...open } = saved;
  assert.deepEqual(withFlow(saved, undo(undo(flow))), open);
});

test('undoing back to the rebound flag alone leaves nothing worth saving', () => {
  const flow = build({ rebound: true }, { location: { x: 0, y: 10 } });
  assert.equal(parkable(undo(flow)), null);
});

test('undo on an empty flow stays empty', () => {
  assert.deepEqual(undo(emptyFlow()).steps, []);
});

test('undo does not change the old flow', () => {
  const flow = build({ result: 'tor' });
  undo(flow);
  assert.equal(flow.steps.length, 1);
});

test('a new location tap replaces the old one and clears the situation; undo restores them', () => {
  let flow = build({ location: { x: 0, y: 10 }, situation: 'rueckraum' }, { location: { x: 1, y: 3 }, situation: undefined });
  assert.deepEqual(shotFields(flow), { location: { x: 1, y: 3 } });
  flow = undo(flow);
  assert.deepEqual(shotFields(flow), { location: { x: 0, y: 10 }, situation: 'rueckraum' });
});

test('cancel discards the half-captured shot', () => {
  const flow = cancel(build({ location: { x: 0, y: 10 } }, { target: { x: 1, y: 1 } }));
  assert.deepEqual(shotFields(flow), {});
  assert.equal(flow.steps.length, 0);
});

test('a shot is complete only with a result', () => {
  assert.equal(isComplete(build({ target: { x: 1, y: 1 } })), false);
  assert.equal(isComplete(build({ target: { x: 1, y: 1 } }, { result: 'gehalten' })), true);
  assert.equal(isComplete(build({ target: { x: -1, y: 1 }, result: 'vorbei' })), true);
});

test('parkable returns the fields so far, but not for an empty flow or the rebound flag alone', () => {
  assert.equal(parkable(emptyFlow()), null);
  assert.equal(parkable(build({ rebound: true })), null);
  assert.deepEqual(parkable(build({ rebound: true }, { location: { x: 0, y: 10 } })), { rebound: true, location: { x: 0, y: 10 } });
});

test('editing a saved shot: undo returns to the saved state, meta stays, cleared fields disappear', () => {
  const shot = { id: 'a', type: 'shot', half: 1, gameTimeSec: 5, wallClock: 'w', goalkeeperId: 'g', result: 'tor', note: 'x' };
  let flow = addStep(flowFromShot(shot), { result: 'gehalten', note: undefined });
  assert.deepEqual(withFlow(shot, flow), { id: 'a', type: 'shot', half: 1, gameTimeSec: 5, wallClock: 'w', goalkeeperId: 'g', result: 'gehalten' });
  assert.deepEqual(withFlow(shot, undo(flow)), shot);
});
