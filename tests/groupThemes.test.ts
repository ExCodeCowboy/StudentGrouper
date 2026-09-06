import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyGroupTheme, groupThemes } from '../src/groupThemes';
import { createGroupShells, createSampleData } from '../src/sample';
import { generateGroups } from '../src/grouping';
import { createBackupFile, readBackup } from '../src/storage';
import { groupSet, student } from './fixtures';

void test('all eight themes provide distinct names for large classes and pairs', () => {
  assert.equal(groupThemes.length, 8);
  for (const theme of groupThemes) {
    const groups = createGroupShells(40, theme.id);
    assert.equal(new Set(groups.map((group) => group.name)).size, 40);
    assert.ok(groups.every((group) => group.symbol && /^#[\da-f]{6}$/i.test(group.color)));
    assert.equal(new Set(groups.slice(0, 12).map((group) => group.symbol)).size, 12);
  }
  assert.equal(createGroupShells(1)[0].name, 'Blue Stars');
});

void test('applying a theme preserves identities, membership, locks and recipe without mutation', () => {
  const set = groupSet(3);
  set.groups[0].studentIds = ['a', 'b'];
  set.groups[0].lockedStudentIds = ['a'];
  set.groups[0].imageDataUrl = 'old picture';
  const before = structuredClone(set);
  const themed = applyGroupTheme(set, 'ocean');
  assert.deepEqual(set, before);
  assert.equal(themed.id, set.id);
  assert.equal(themed.name, set.name);
  assert.deepEqual(themed.recipe, set.recipe);
  assert.equal(themed.nameTheme, 'ocean');
  for (let index = 0; index < set.groups.length; index++) {
    assert.equal(themed.groups[index].id, set.groups[index].id);
    assert.deepEqual(themed.groups[index].studentIds, set.groups[index].studentIds);
    assert.deepEqual(themed.groups[index].lockedStudentIds, set.groups[index].lockedStudentIds);
    assert.equal(themed.groups[index].imageDataUrl, undefined);
  }
});

void test('regrouping keeps custom names and uses the chosen theme for added groups', () => {
  const set = applyGroupTheme(groupSet(2), 'garden');
  set.groups[0].name = 'Our special bees';
  set.groups[0].imageDataUrl = 'custom picture';
  set.recipe.groupCount = 12;
  const generated = generateGroups(Array.from({ length: 24 }, (_, index) => student(`s${index}`)), [], set);
  assert.equal(generated.groups.length, 12);
  assert.equal(generated.groups[0].name, 'Our special bees');
  assert.equal(generated.groups[0].imageDataUrl, 'custom picture');
  assert.equal(generated.groups[11].name, 'Cherry Cheerers');
  assert.equal(new Set(generated.groups.flatMap((group) => group.studentIds)).size, 24);
});

void test('themes survive backup round trips and preserve saved rotation references', async () => {
  for (const theme of groupThemes) {
    const data = createSampleData();
    const classroom = data.classrooms[0];
    const sessions = structuredClone(classroom.sessions);
    classroom.groupSets[0] = applyGroupTheme(classroom.groupSets[0], theme.id);
    const restored = await readBackup({ text: async () => createBackupFile(data).contents });
    assert.deepEqual(restored.classrooms[0].groupSets[0], JSON.parse(JSON.stringify(classroom.groupSets[0])));
    assert.deepEqual(JSON.parse(JSON.stringify(restored.classrooms[0].sessions)), JSON.parse(JSON.stringify(sessions)));
  }
});
