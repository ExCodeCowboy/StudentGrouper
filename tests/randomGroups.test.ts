import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateGroups, groupingCautions } from '../src/grouping';
import {
  fillOpenSpots,
  moveGroupToStation,
  scheduleIssues,
} from '../src/rotations';
import { minimumCostAssignment } from '../src/assignment';
import {
  groupSet,
  student,
  stations,
  blankSession,
  classroomFor,
  assignment,
} from './fixtures';
import type { Relationship } from '../src/model';

function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const roster = (count: number) =>
  Array.from({ length: count }, (_, index) => student(`learner-${index}`));
const members = (set: ReturnType<typeof groupSet>) =>
  set.groups.map((group) => [...group.studentIds].sort());

void test('pairs create twelve named groups for 24 learners and one trio for odd attendance', () => {
  const set = groupSet(5);
  set.recipe.sizeMode = 'pairs';
  const even = generateGroups(roster(24), [], set);
  assert.equal(even.groups.length, 12);
  assert.ok(even.groups.every((group) => group.studentIds.length === 2));
  assert.equal(new Set(even.groups.map((group) => group.name)).size, 12);
  const odd = generateGroups(roster(25), [], set);
  assert.equal(odd.groups.length, 12);
  assert.equal(
    odd.groups.filter((group) => group.studentIds.length === 3).length,
    1,
  );
  const absent = roster(25);
  absent[0].absent = true;
  assert.ok(
    generateGroups(absent, [], set).groups.every(
      (group) => group.studentIds.length === 2,
    ),
  );
});

void test('manual group counts above eight are honored for mixed and similar grouping', () => {
  for (const mode of ['mixed', 'similar'] as const) {
    const set = groupSet(16);
    set.recipe.mode = mode;
    const result = generateGroups(roster(32), [], set);
    assert.equal(result.groups.length, 16);
    assert.ok(result.groups.every((group) => group.studentIds.length === 2));
  }
});

void test('random grouping varies between seeds and is independent of skill levels', () => {
  const pupils = roster(24);
  const set = groupSet(12);
  set.recipe.mode = 'random';
  const first = generateGroups(pupils, [], set, seeded(11));
  const second = generateGroups(pupils, [], set, seeded(13));
  assert.notDeepEqual(members(first), members(second));
  pupils.forEach((pupil, index) => {
    pupil.reading = index % 2 ? 1 : 3;
  });
  assert.deepEqual(
    members(generateGroups(pupils, [], set, seeded(11))),
    members(first),
  );
  assert.equal(
    new Set(first.groups.flatMap((group) => group.studentIds)).size,
    24,
  );
});

void test('random pairs honor keep-apart constraints through reshuffles and preserve locks', () => {
  const pupils = roster(24);
  const set = groupSet(12);
  set.recipe.mode = 'random';
  set.groups[0].studentIds = ['learner-0'];
  set.groups[0].lockedStudentIds = ['learner-0'];
  const rules: Relationship[] = Array.from({ length: 12 }, (_, index) => ({
    id: `rule-${index}`,
    kind: 'apart',
    studentAId: `learner-${index}`,
    studentBId: `learner-${index + 12}`,
  }));
  for (let seed = 1; seed <= 20; seed++) {
    const result = generateGroups(pupils, rules, set, seeded(seed));
    assert.deepEqual(groupingCautions(result, pupils, rules), []);
    assert.ok(result.groups[0].studentIds.includes('learner-0'));
    assert.ok(result.groups.every((group) => group.studentIds.length === 2));
    assert.equal(
      new Set(result.groups.flatMap((group) => group.studentIds)).size,
      24,
    );
  }
});

void test('random pairs find the only compatible partners in a restrictive roster', () => {
  const pupils = roster(8);
  const set = groupSet(4);
  set.recipe.mode = 'random';
  const rules: Relationship[] = [];
  for (let a = 0; a < pupils.length; a++)
    for (let b = a + 1; b < pupils.length; b++) {
      if (Math.floor(a / 2) !== Math.floor(b / 2))
        rules.push({
          id: `${a}-${b}`,
          kind: 'apart',
          studentAId: pupils[a].id,
          studentBId: pupils[b].id,
        });
    }
  const result = generateGroups(pupils, rules, set, seeded(42));
  assert.equal(result.groups.flatMap((group) => group.studentIds).length, 8);
  assert.deepEqual(groupingCautions(result, pupils, rules), []);
});

void test('impossible random arrangements leave gaps instead of placing forbidden partners together', () => {
  const pupils = roster(4);
  const set = groupSet(2);
  set.recipe.mode = 'random';
  const rules: Relationship[] = [];
  for (let a = 0; a < 4; a++)
    for (let b = a + 1; b < 4; b++)
      rules.push({
        id: `${a}-${b}`,
        kind: 'apart',
        studentAId: pupils[a].id,
        studentBId: pupils[b].id,
      });
  const result = generateGroups(pupils, rules, set, seeded(3));
  assert.deepEqual(groupingCautions(result, pupils, rules), []);
  assert.equal(result.groups.flatMap((group) => group.studentIds).length, 2);
  set.groups[0].lockedStudentIds = [pupils[0].id, pupils[1].id];
  const locked = generateGroups(pupils, rules, set, seeded(3));
  assert.ok(groupingCautions(locked, pupils, rules).length > 0);
  assert.ok(locked.groups[0].studentIds.includes(pupils[0].id));
  assert.ok(locked.groups[0].studentIds.includes(pupils[1].id));
});

void test('rotation solver supports 24 groups and stations without repeating within the day', () => {
  const set = groupSet(24);
  const plans = stations(24);
  const day = blankSession(set, plans, 4);
  const classroom = classroomFor(set, plans, [day]);
  const built = fillOpenSpots(classroom, day, set);
  for (const round of built.rounds) {
    assert.equal(round.assignments.length, 24);
    assert.equal(
      new Set(round.assignments.map((item) => item.stationId)).size,
      24,
    );
  }
  assert.deepEqual(scheduleIssues(classroom, built, set), []);
});

void test('shared capacity above eight is respected by automatic and manual placement', () => {
  const set = groupSet(12);
  const plans = stations(2);
  plans[0].groupCapacity = 12;
  plans[0].visitRule = 'repeatable';
  const day = blankSession(set, plans, 1);
  const classroom = classroomFor(set, plans, [day]);
  const built = fillOpenSpots(classroom, day, set);
  assert.equal(built.rounds[0].assignments.length, 12);
  day.rounds[0].assignments = set.groups.map((group, index) =>
    assignment(group.id, plans[index === 11 ? 1 : 0].id),
  );
  const moved = moveGroupToStation(
    day,
    day.rounds[0].id,
    set.groups[11].id,
    plans[0].id,
  ).session;
  assert.equal(
    moved.rounds[0].assignments.filter((item) => item.stationId === plans[0].id)
      .length,
    12,
  );
});

void test('assignment solver maximizes filled places before preferences and honors forbidden edges', () => {
  assert.deepEqual(
    minimumCostAssignment(
      [
        [
          [0, -1, 0, 0],
          [0, 0, 1, 0],
        ],
        [[0, 0, 0, 0], null],
      ],
      [1, 1],
    ),
    [1, 0],
  );
  assert.deepEqual(minimumCostAssignment([[null], [[0, 0, 0, 0]]], [1]), [
    undefined,
    0,
  ]);
});
