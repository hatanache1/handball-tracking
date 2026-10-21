// Season settings: lists of opponents, goalkeepers and comment chips.
// Stored as saison-einstellungen.json in the game folder (storage.js skips this name when listing games).
export const SETTINGS_FILE = 'saison-einstellungen.json';

export function emptySettings() {
  return { opponents: [], goalkeepers: [], chips: [] };
}

// Goalkeepers are { id, name, removed? }. Removed ones stay in the list so old games can still resolve the id.
export function activeGoalkeepers(s) {
  return s.goalkeepers.filter((g) => !g.removed);
}

// --- Plain string lists (opponents, chips). Each function returns a new settings object. ---

export function addItem(s, list, name) {
  name = name.trim();
  if (!name || s[list].includes(name)) return s;
  return { ...s, [list]: [...s[list], name] };
}

export function renameItem(s, list, index, name) {
  name = name.trim();
  if (!name || s[list].includes(name)) return s;
  return { ...s, [list]: s[list].map((v, i) => (i === index ? name : v)) };
}

export function removeItem(s, list, index) {
  return { ...s, [list]: s[list].filter((_, i) => i !== index) };
}

// --- Goalkeepers: the id is created once and never changes ---

export function addGoalkeeper(s, name) {
  name = name.trim();
  if (!name) return s;
  return { ...s, goalkeepers: [...s.goalkeepers, { id: crypto.randomUUID(), name }] };
}

export function renameGoalkeeper(s, id, name) {
  name = name.trim();
  if (!name) return s;
  return { ...s, goalkeepers: s.goalkeepers.map((g) => (g.id === id ? { ...g, name } : g)) };
}

export function removeGoalkeeper(s, id) {
  return { ...s, goalkeepers: s.goalkeepers.map((g) => (g.id === id ? { ...g, removed: true } : g)) };
}

// --- File ---

// A missing file means empty settings. The view only saves after the user edits something,
// so a broken file is not overwritten just by opening the view.
export async function loadSettings(dir) {
  try {
    const file = await (await dir.getFileHandle(SETTINGS_FILE)).getFile();
    return { ...emptySettings(), ...JSON.parse(await file.text()) };
  } catch {
    return emptySettings();
  }
}

export async function saveSettings(dir, s) {
  const w = await (await dir.getFileHandle(SETTINGS_FILE, { create: true })).createWritable();
  await w.write(JSON.stringify(s, null, 2));
  await w.close();
}
