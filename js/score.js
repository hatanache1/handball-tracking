// Score derived from the events: "own" = goals for us, "against" = goals the goalkeepers conceded.
export function score(events) {
  return {
    own: events.filter((e) => e.type === 'ownGoal').length,
    against: events.filter((e) => e.type === 'shot' && e.result === 'tor').length,
  };
}

// Step-line points per side for the score chart: x = minutes of game time, one jump per goal.
// Events are ordered by half and time, because the capture order can differ after clock corrections.
export function scoreSeries(events) {
  const sorted = [...events].sort((a, b) => a.half - b.half || a.gameTimeSec - b.gameTimeSec);
  const own = [{ x: 0, y: 0 }];
  const against = [{ x: 0, y: 0 }];
  const done = [];
  let x = 0;
  for (const e of sorted) {
    const before = score(done);
    done.push(e);
    const after = score(done);
    x = Math.max(x, e.gameTimeSec / 60); // stays monotone even if a half-2 time is below an earlier one
    if (after.own !== before.own) own.push({ x, y: before.own }, { x, y: after.own });
    if (after.against !== before.against) against.push({ x, y: before.against }, { x, y: after.against });
  }
  // Both lines end at the last event so they have the same length.
  own.push({ x, y: own.at(-1).y });
  against.push({ x, y: against.at(-1).y });
  return { own, against, lastX: x };
}
