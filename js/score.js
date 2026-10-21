// Score derived from the events: "own" = goals for us, "against" = goals the goalkeepers conceded.
export function score(events) {
  return {
    own: events.filter((e) => e.type === 'ownGoal').length,
    against: events.filter((e) => e.type === 'shot' && e.result === 'tor').length,
  };
}
