import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../js/schema.js';
import { saveGame, loadGame, listGames } from '../js/storage.js';

// In-memory stand-in for a FileSystemDirectoryHandle (only the parts storage.js uses).
function fakeDir() {
  const files = new Map();
  return {
    files,
    async getFileHandle(name, { create } = {}) {
      if (!files.has(name) && !create) throw new Error('NotFound');
      return {
        kind: 'file',
        async getFile() { return { text: async () => files.get(name) }; },
        async createWritable() { return { write: async (t) => files.set(name, t), close: async () => {} }; },
      };
    },
    async *entries() {
      for (const name of files.keys()) yield [name, await this.getFileHandle(name)];
    },
  };
}

test('save, load and list round-trip; broken files are skipped', async () => {
  const dir = fakeDir();
  const g = newGame({ opponent: 'A', venue: 'heim', startGoalkeeperId: 'gk1' });
  await saveGame(dir, g);
  assert.deepEqual(await loadGame(dir, g.id), g);

  dir.files.set('kaputt.json', '{nope');
  dir.files.set('saison-einstellungen.json', '{}');
  const { games, skipped } = await listGames(dir);
  assert.deepEqual(games, [g]);
  assert.deepEqual(skipped, ['kaputt.json']);
});
