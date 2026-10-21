// Game clock as plain data { gameId, half, baseSec, startedAt }. While running, startedAt (ms since epoch) is set,
// so a page reload simply keeps counting and no timer state needs to be saved.
import { HALF_LENGTH_SEC } from './schema.js';

export const newClock = (gameId) => ({ gameId, half: 1, baseSec: 0, startedAt: null });

// The clock never goes past the end of its half: 30:00 in the 1st, 60:00 in the 2nd (the 2nd half counts on from 30:00).
export const limitSec = (c) => c.half * HALF_LENGTH_SEC;

const rawSec = (c, t) => c.baseSec + (c.startedAt === null ? 0 : (t - c.startedAt) / 1000);

export const clockSec = (c, t = Date.now()) => Math.floor(Math.min(limitSec(c), rawSec(c, t)));

// A clock that reached its limit counts as stopped, even though startedAt is still set.
export const isRunning = (c, t = Date.now()) => c.startedAt !== null && rawSec(c, t) < limitSec(c);

export const toggle = (c, t = Date.now()) => {
  const sec = clockSec(c, t);
  if (isRunning(c, t)) return { ...c, baseSec: sec, startedAt: null };
  return { ...c, baseSec: sec, startedAt: sec < limitSec(c) ? t : null }; // at the limit there is nothing to start
};

// Moving the clock never goes below 0 or above the half's limit and keeps it running if it was running.
export const adjust = (c, deltaSec, t = Date.now()) => {
  const next = Math.min(limitSec(c), Math.max(0, clockSec(c, t) + deltaSec));
  return { ...c, baseSec: next, startedAt: isRunning(c, t) && next < limitSec(c) ? t : null };
};

// Toggles the half and stops the clock at the half boundary; going back is a correction for a mis-tap.
export const switchHalf = (c) => ({ ...c, half: c.half === 1 ? 2 : 1, baseSec: HALF_LENGTH_SEC, startedAt: null });

// After the 1st half the clock shows "2. HZ ▶" instead of the time.
export const firstHalfOver = (c, t = Date.now()) => c.half === 1 && clockSec(c, t) >= limitSec(c);

// One tap on the clock: start/stop, or at the end of the 1st half start the 2nd one.
export const tap = (c, t = Date.now()) => (firstHalfOver(c, t) ? toggle(switchHalf(c), t) : toggle(c, t));
