import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptySettings, addItem, renameItem, removeItem,
  addGoalkeeper, renameGoalkeeper, removeGoalkeeper, activeGoalkeepers,
  saveSettings, loadSettings,
} from '../js/settings.js';

test('string lists: add, rename, remove, no duplicates or blanks', () => {
  let s = addItem(emptySettings(), 'opponents', ' Kiel ');
  s = addItem(s, 'opponents', 'Kiel');
  s = addItem(s, 'opponents', '  ');
  assert.deepEqual(s.opponents, ['Kiel']);
  s = renameItem(s, 'opponents', 0, 'Flensburg');
  assert.deepEqual(s.opponents, ['Flensburg']);
  assert.deepEqual(removeItem(s, 'opponents', 0).opponents, []);
});

test('goalkeeper id stays stable; removed goalkeeper stays resolvable', () => {
  let s = addGoalkeeper(emptySettings(), 'Anna');
  const { id } = s.goalkeepers[0];
  s = renameGoalkeeper(s, id, 'Anna B.');
  assert.equal(s.goalkeepers[0].id, id);
  assert.equal(s.goalkeepers[0].name, 'Anna B.');
  s = removeGoalkeeper(s, id);
  assert.equal(activeGoalkeepers(s).length, 0);
  assert.equal(s.goalkeepers.find((g) => g.id === id).name, 'Anna B.');
});

test('save and load round trip; missing file gives empty settings', async () => {
  const files = new Map();
  const dir = {
    async getFileHandle(name, { create } = {}) {
      if (!files.has(name) && !create) throw new Error('NotFound');
      return {
        getFile: async () => ({ text: async () => files.get(name) }),
        createWritable: async () => ({ write: async (t) => files.set(name, t), close: async () => {} }),
      };
    },
  };
  assert.deepEqual(await loadSettings(dir), emptySettings());
  const s = addItem(emptySettings(), 'chips', 'Abpraller');
  await saveSettings(dir, s);
  assert.deepEqual(await loadSettings(dir), s);
});
