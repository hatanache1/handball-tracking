// Pure helpers for the event list in the side drawer (no DOM, no storage).
const RESULTS = { tor: 'Tor', gehalten: 'Gehalten', vorbei: 'Vorbei', pfosten: 'Pfosten' };
const SITUATIONS = { rueckraum: 'Rückraum', aussen: 'Außen', durchbruch: 'Durchbruch', kreis: 'Kreis', einlaeufer: 'Einläufer', siebenmeter: '7m' };

// One line for a shot, e.g. "Gehalten · Rückraum · #7"; used for the confirmation, the previous-shot card and the list.
export function describe({ result, situation, fastBreak, shooterNumber }) {
  return [RESULTS[result] ?? 'offen', SITUATIONS[situation] ?? (fastBreak ? 'Gegenstoß' : null), shooterNumber ? `#${shooterNumber}` : null]
    .filter(Boolean).join(' · ');
}

// "2. HZ 34:12": the clock of the 2nd half counts on from 30:00.
export function timeLabel({ half, gameTimeSec }) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${half}. HZ ${pad(Math.floor(gameTimeSec / 60))}:${pad(gameTimeSec % 60)}`;
}

// Shots and own goals, newest first; open shots (no result) on top so they are not forgotten.
export function listedEvents(events) {
  const listed = events.filter((e) => e.type === 'shot' || e.type === 'ownGoal').reverse();
  const open = (e) => e.type === 'shot' && e.result === undefined;
  return [...listed.filter(open), ...listed.filter((e) => !open(e))];
}

export const removeEvent = (events, id) => events.filter((e) => e.id !== id);
