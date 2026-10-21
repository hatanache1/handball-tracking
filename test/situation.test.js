import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSituation, inSevenMeterZone, RUECKRAUM_MIN_DISTANCE_M, AUSSEN_MIN_ANGLE_DEG, SEVEN_METER_LOCATION, SEVEN_METER_ZONE_RADIUS_M } from '../js/situation.js';

test('distance exactly at the limit is rueckraum, just below is not', () => {
  assert.equal(deriveSituation({ x: 0, y: RUECKRAUM_MIN_DISTANCE_M }), 'rueckraum');
  assert.equal(deriveSituation({ x: 0, y: 8.99 }), null);
});

test('far away wins over the wing angle', () => {
  assert.equal(deriveSituation({ x: 9.5, y: 1 }), 'rueckraum');
});

test('wing: angle at the limit is aussen, just below asks', () => {
  const r = 6;
  const at = (deg) => ({ x: r * Math.sin((deg * Math.PI) / 180), y: r * Math.cos((deg * Math.PI) / 180) });
  assert.equal(deriveSituation(at(AUSSEN_MIN_ANGLE_DEG + 0.5)), 'aussen');
  assert.equal(deriveSituation(at(AUSSEN_MIN_ANGLE_DEG - 0.5)), null);
});

test('wing is symmetric left and right', () => {
  assert.equal(deriveSituation({ x: -5, y: 1 }), 'aussen');
  assert.equal(deriveSituation({ x: 5, y: 1 }), 'aussen');
});

test('close range in front of the goal asks, including the goal-line middle', () => {
  assert.equal(deriveSituation({ x: 0, y: 3 }), null);
  assert.equal(deriveSituation({ x: 0, y: 0 }), null);
});

test('7 m zone: spot and inside count, exactly on the edge counts, outside does not', () => {
  const { x, y } = SEVEN_METER_LOCATION;
  assert.equal(inSevenMeterZone({ x, y }), true);
  assert.equal(inSevenMeterZone({ x: x + 1, y: y + 1 }), true);
  assert.equal(inSevenMeterZone({ x, y: y + SEVEN_METER_ZONE_RADIUS_M }), true);
  assert.equal(inSevenMeterZone({ x: x - SEVEN_METER_ZONE_RADIUS_M, y }), true);
  assert.equal(inSevenMeterZone({ x, y: y + SEVEN_METER_ZONE_RADIUS_M + 0.01 }), false);
  assert.equal(inSevenMeterZone({ x: 8, y: 15 }), false);
});
