// Pure state machine for the shot being captured (no DOM, no storage).
// Every tap is one step on the undo stack; the shot is rebuilt from the steps, so undo = drop the last step.
// A step is a partial set of shot fields, e.g. { location, situation } or { target, result }.
// Later tickets only add steps with other fields (fastBreak, shooterNumber, tags, note, rebound) to the same stack.
// A field set to undefined in a later step clears the earlier value (e.g. a new location tap clears the situation).

export const emptyFlow = () => ({ steps: [] });

export const addStep = (flow, fields) => ({ steps: [...flow.steps, fields] });

export const undo = (flow) => ({ steps: flow.steps.slice(0, -1) });

// Discards the half-captured shot.
export const cancel = emptyFlow;

// The shot fields so far, ready to be passed to newEvent('shot', ...).
export function shotFields(flow) {
  const merged = Object.assign({}, ...flow.steps);
  return Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined));
}

// A shot is finished once it has a result; everything else stays optional.
export const isComplete = (flow) => shotFields(flow).result !== undefined;

// The fields worth saving as an open shot (Nachwurf, switching to another shot), or null.
// The rebound flag alone is not enough: that would only be an empty shot.
export function parkable(flow) {
  const fields = shotFields(flow);
  const { rebound, ...rest } = fields;
  return Object.keys(rest).length ? fields : null;
}

// Editing a saved shot: its fields become the first step, later taps are further steps (undo stops at that first step).
const META = ['id', 'type', 'half', 'gameTimeSec', 'wallClock', 'goalkeeperId'];
export const flowFromShot = (shot) => ({ steps: [Object.fromEntries(Object.entries(shot).filter(([key]) => !META.includes(key)))] });

// The saved shot with its fields replaced by the flow's; the event meta (id, times, keeper) stays.
export const withFlow = (shot, flow) => ({
  ...Object.fromEntries(META.filter((key) => shot[key] !== undefined).map((key) => [key, shot[key]])),
  ...shotFields(flow),
});
