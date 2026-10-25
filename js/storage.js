import { validateGame } from './schema.js';
import { idbGet, idbSet, idbDelete } from './idb.js';

const FOLDER_KEY = 'folderHandle';
const DRAFT_KEY = 'currentGame';

// Errors carry a message that the UI can show to the user as-is.
function fail(message, cause) {
  return Object.assign(new Error(message), { cause });
}

// --- Folder ---

// Must be called from a user gesture (tap on a button).
export async function chooseFolder() {
  if (!window.showDirectoryPicker) throw fail('Dieser Browser kann keinen Ordner wählen. Bitte Edge oder Chrome benutzen.');
  let handle;
  try {
    handle = await showDirectoryPicker({ mode: 'readwrite' });
  } catch (err) {
    if (err.name === 'AbortError') return null; // user cancelled, not an error
    throw fail('Ordner konnte nicht geöffnet werden.', err);
  }
  await idbSet(FOLDER_KEY, handle);
  return handle;
}

// True if a folder was chosen before, even when the browser asks for its permission again.
export const hasFolder = async () => Boolean(await idbGet(FOLDER_KEY));

// Returns the remembered folder if permission is still granted, else null.
// Pass askPermission=true only from a user gesture; the browser refuses the prompt otherwise.
export async function restoreFolder(askPermission = false) {
  const handle = await idbGet(FOLDER_KEY);
  if (!handle) return null;
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return handle;
  if (askPermission && (await handle.requestPermission(opts)) === 'granted') return handle;
  return null;
}

// --- Game files (<id>.json) ---

export async function saveGame(dir, game) {
  try {
    const file = await dir.getFileHandle(`${game.id}.json`, { create: true });
    const w = await file.createWritable(); // writes to a temp file, swapped in on close: no half-written games
    await w.write(JSON.stringify(game, null, 2));
    await w.close();
  } catch (err) {
    throw fail('Spiel konnte nicht in den Ordner gespeichert werden (Ordner weg oder keine Berechtigung). Die Kopie im Browser bleibt erhalten.', err);
  }
}

async function readGame(fileHandle) {
  const game = JSON.parse(await (await fileHandle.getFile()).text());
  if (validateGame(game).length) throw new Error('invalid game');
  return game;
}

export async function loadGame(dir, id) {
  try {
    return await readGame(await dir.getFileHandle(`${id}.json`));
  } catch (err) {
    throw fail('Spiel konnte nicht geladen werden.', err);
  }
}

export async function deleteGame(dir, id) {
  try {
    await dir.removeEntry(`${id}.json`);
  } catch (err) {
    throw fail('Spiel konnte nicht gelöscht werden.', err);
  }
  // A running game is also deleted from the crash copy, otherwise the live view would write the file again.
  if ((await loadDraft())?.id === id) await clearDraft();
}

// Returns { games, skipped }; broken files are reported by name instead of hiding the rest.
export async function listGames(dir) {
  const games = [];
  const skipped = [];
  try {
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'file' || !name.endsWith('.json') || name === 'saison-einstellungen.json') continue;
      try {
        games.push(await readGame(handle));
      } catch {
        skipped.push(name);
      }
    }
  } catch (err) {
    throw fail('Ordner konnte nicht gelesen werden (Ordner weg oder keine Berechtigung).', err);
  }
  return { games, skipped };
}

// --- Crash copy of the running game in IndexedDB ---

export const saveDraft = (game) => idbSet(DRAFT_KEY, game);
export const loadDraft = () => idbGet(DRAFT_KEY);
export const clearDraft = () => idbDelete(DRAFT_KEY);
