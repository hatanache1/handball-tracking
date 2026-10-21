import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalZone, FRAME_TOLERANCE_M } from '../js/goal.js';

test('inside the goal', () => {
  assert.equal(goalZone(1.5, 1), 'innen');
  assert.equal(goalZone(0.5, 0.5), 'innen');
  assert.equal(goalZone(1.5, 0), 'innen'); // floor is no frame
});

test('on the frame: posts and crossbar', () => {
  assert.equal(goalZone(0, 1), 'rahmen');
  assert.equal(goalZone(3, 1), 'rahmen');
  assert.equal(goalZone(1.5, 2), 'rahmen');
  assert.equal(goalZone(0, 2), 'rahmen'); // corner
  assert.equal(goalZone(3, 2), 'rahmen');
  assert.equal(goalZone(-0.05, 1), 'rahmen'); // slightly outside, still the post
  assert.equal(goalZone(1.5, 2.05), 'rahmen');
});

test('tolerance band edges are frame, just beyond is not', () => {
  const t = FRAME_TOLERANCE_M;
  assert.equal(goalZone(t, 1), 'rahmen');
  assert.equal(goalZone(3 - t, 1), 'rahmen');
  assert.equal(goalZone(1.5, 2 - t), 'rahmen');
  assert.equal(goalZone(t + 0.01, 1), 'innen');
  assert.equal(goalZone(3 - t - 0.01, 1), 'innen');
  assert.equal(goalZone(1.5, 2 - t - 0.01), 'innen');
  assert.equal(goalZone(-t - 0.01, 1), 'aussen');
  assert.equal(goalZone(1.5, 2 + t + 0.01), 'aussen');
});

test('outside the goal', () => {
  assert.equal(goalZone(-1, 1), 'aussen');
  assert.equal(goalZone(4, 1), 'aussen');
  assert.equal(goalZone(1.5, 3), 'aussen');
  assert.equal(goalZone(1.5, -0.01), 'aussen'); // below the floor
  assert.equal(goalZone(0, -0.5), 'aussen'); // post does not reach below the floor
});
