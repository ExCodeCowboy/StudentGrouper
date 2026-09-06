import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ensurePairStarters } from '../src/pairStarters';
import { generateGroups, moveStudent } from '../src/grouping';
import { resetGroupSet } from '../src/groupSets';
import { studentDisplayGroups } from '../src/studentDisplay';
import { createBackupFile, normalizeAppData, readBackup } from '../src/storage';
import { createSampleData } from '../src/sample';
import { groupSet, student } from './fixtures';

function pairs() {
  const set = groupSet(3);
  set.recipe.sizeMode = 'pairs';
  set.groups[0].studentIds = ['a', 'b'];
  set.groups[1].studentIds = ['c', 'd', 'e'];
  set.groups[0].lockedStudentIds = ['a'];
  return set;
}
const roster = ['a', 'b', 'c', 'd', 'e'].map((id) => student(id));

void test('making pairs chooses one present starter per pair or trio for every grouping method', () => {
  for (const mode of ['mixed', 'similar', 'random'] as const) {
    const set = pairs();
    set.recipe.mode = mode;
    const result = generateGroups([...roster, student('away', { absent: true })], [], set, () => .8);
    assert.deepEqual(result.groups.map((group) => group.studentIds.length).sort((left, right) => left - right), [2, 3]);
    for (const group of result.groups) {
      assert.ok(group.starterStudentId && group.studentIds.includes(group.starterStudentId));
      assert.notEqual(group.starterStudentId, 'away');
    }
    assert.ok(result.groups[0].studentIds.includes('a'), 'choosing a starter does not change locks');
    assert.deepEqual(result.groups[0].lockedStudentIds, ['a']);
  }
  assert.ok(generateGroups([], [], pairs()).groups.every((group) => !group.starterStudentId));
});

void test('starter draws can select every member and remain stable through normal updates and reveals', () => {
  const set = pairs();
  const original = structuredClone(set);
  for (const [draw, expected] of [[0, 'c'], [.5, 'd'], [.99, 'e']] as const) {
    assert.equal(ensurePairStarters(set, roster, () => draw).groups[1].starterStudentId, expected);
  }
  const chosen = ensurePairStarters(set, roster, () => .99);
  assert.deepEqual(chosen.groups.map((group) => group.starterStudentId), ['b', 'e', undefined]);
  assert.equal(ensurePairStarters(chosen, roster, () => { throw new Error('A valid starter should not be drawn again'); }), chosen);
  const beforePresentation = structuredClone(chosen);
  studentDisplayGroups(chosen, roster);
  assert.deepEqual(chosen, beforePresentation, 'presenting pairs preserves the saved selection');
  assert.deepEqual(set, original, 'choosing a starter never mutates the previous arrangement');
  assert.deepEqual(chosen.groups.map((group) => group.studentIds), set.groups.map((group) => group.studentIds));
});

void test('making pairs again redraws starters even when all partner placements are locked', () => {
  const set = pairs();
  set.groups = set.groups.slice(0, 2);
  set.groups.forEach((group) => { group.lockedStudentIds = [...group.studentIds]; });
  const first = generateGroups(roster, [], set, () => 0);
  const second = generateGroups(roster, [], first, () => .99);
  assert.deepEqual(second.groups.map((group) => group.studentIds), first.groups.map((group) => group.studentIds));
  assert.deepEqual(first.groups.map((group) => group.starterStudentId), ['a', 'c']);
  assert.deepEqual(second.groups.map((group) => group.starterStudentId), ['b', 'e']);
});

void test('attendance and membership edits repair only invalid starters; reset and count mode clear them', () => {
  const chosen = ensurePairStarters(pairs(), roster, () => .99);
  const attendance = roster.map((pupil) => pupil.id === 'b' ? { ...pupil, absent: true } : pupil);
  const withAbsence = ensurePairStarters(chosen, attendance, () => 0);
  assert.equal(withAbsence.groups[0].starterStudentId, 'a');
  assert.equal(withAbsence.groups[1], chosen.groups[1], 'unaffected pair keeps its starter');
  const removed = ensurePairStarters(chosen, roster.filter((pupil) => pupil.id !== 'b'), () => 0);
  assert.equal(removed.groups[0].starterStudentId, 'a');
  const moved = ensurePairStarters(moveStudent(chosen, 'b', chosen.groups[1].id), roster, () => 0);
  assert.deepEqual(moved.groups.map((group) => group.starterStudentId), ['a', 'e', undefined]);
  const nobodyHere = ensurePairStarters(chosen, [], () => 0);
  assert.ok(nobodyHere.groups.every((group) => group.starterStudentId === undefined));
  assert.ok(resetGroupSet(chosen).groups.every((group) => group.starterStudentId === undefined));
  const countMode = ensurePairStarters({ ...chosen, recipe: { ...chosen.recipe, sizeMode: 'count' } }, roster);
  assert.ok(countMode.groups.every((group) => group.starterStudentId === undefined));
});

void test('starter selections survive backups and old pairs gain starters without regrouping', async () => {
  const data = createSampleData();
  const classroom = data.classrooms[0];
  const set = classroom.groupSets[0];
  set.recipe.sizeMode = 'pairs';
  classroom.groupSets[0] = generateGroups(classroom.students, classroom.relationships, set, () => .75);
  const backup = await readBackup({ text: async () => createBackupFile(data).contents });
  assert.deepEqual(backup.classrooms[0].groupSets, JSON.parse(JSON.stringify(data.classrooms[0].groupSets)));
  for (const group of data.classrooms[0].groupSets[0].groups) delete group.starterStudentId;
  const legacy = await readBackup({ text: async () => createBackupFile(data).contents });
  const restored = legacy.classrooms[0].groupSets[0];
  assert.ok(restored.groups.every((group) => group.starterStudentId && group.studentIds.includes(group.starterStudentId)));
  assert.deepEqual(restored.groups.map((group) => group.studentIds), data.classrooms[0].groupSets[0].groups.map((group) => group.studentIds));
  assert.deepEqual(normalizeAppData(legacy).classrooms[0].groupSets, legacy.classrooms[0].groupSets);
  restored.groups[0].starterStudentId = 'not-in-this-pair';
  const repaired = normalizeAppData(legacy).classrooms[0].groupSets[0].groups[0];
  assert.ok(repaired.studentIds.includes(repaired.starterStudentId!));
});

void test('student view exposes only a visible pair member as starter and leaves ordinary groups unchanged', () => {
  const chosen = ensurePairStarters(pairs(), roster, () => .99);
  const display = studentDisplayGroups(chosen, roster);
  assert.deepEqual(display.map((group) => group.starterStudentId), ['b', 'e']);
  assert.ok(!JSON.stringify(display).includes('locked'));
  assert.equal(studentDisplayGroups(chosen, roster.filter((pupil) => pupil.id !== 'b'))[0].starterStudentId, undefined);
  assert.equal(studentDisplayGroups(chosen, roster.map((pupil) => pupil.id === 'b' ? { ...pupil, absent: true } : pupil))[0].starterStudentId, undefined);
  const countMode = { ...chosen, recipe: { ...chosen.recipe, sizeMode: 'count' as const } };
  assert.ok(studentDisplayGroups(countMode, roster).every((group) => group.starterStudentId === undefined));
});
