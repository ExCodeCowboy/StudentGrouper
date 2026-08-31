import assert from 'node:assert/strict';
import { describe as nodeDescribe, test as nodeTest } from 'node:test';
import { changeSessionGroupSet, deleteGroupSet, resetGroupSet } from '../src/groupSets';
import { fillOpenSpots } from '../src/rotations';
import { blankSession, classroomFor, groupSet, stations } from './fixtures';

function describe(name: string, body: () => void) {
  void nodeDescribe(name, body);
}

function test(name: string, body: () => void) {
  void nodeTest(name, body);
}

function secondGroupSet(count: number) {
  const set = groupSet(count, { id: 'second-groups', name: 'Reading Groups' });
  set.groups = set.groups.map((group, index) => ({
    ...group,
    id: `reading-group-${index + 1}`,
  }));
  return set;
}

describe('saved group arrangement state', () => {
  test('resetGroupSet clears placements and locks without changing the saved recipe or group identity', () => {
    const set = groupSet(2);
    set.groups[0].studentIds = ['student-1', 'student-2'];
    set.groups[0].lockedStudentIds = ['student-1'];
    set.groups[1].studentIds = ['student-3'];
    const original = structuredClone(set);

    const reset = resetGroupSet(set);

    assert.deepEqual(set, original, 'the saved arrangement is not mutated');
    assert.deepEqual(reset.groups.flatMap((group) => group.studentIds), []);
    assert.deepEqual(reset.groups.flatMap((group) => group.lockedStudentIds), []);
    assert.deepEqual(
      reset.groups.map(({ id, name, color, symbol }) => ({ id, name, color, symbol })),
      original.groups.map(({ id, name, color, symbol }) => ({ id, name, color, symbol })),
    );
    assert.deepEqual(reset.recipe, original.recipe);
  });

  test('changeSessionGroupSet rebuilds that day with only the selected arrangement', () => {
    const first = groupSet(3);
    const second = secondGroupSet(2);
    const stationList = stations(3);
    const session = blankSession(first, stationList, 2);
    const classroom = classroomFor(first, stationList, [session]);
    classroom.groupSets.push(second);
    const filled = fillOpenSpots(classroom, session, first);
    filled.rounds[0].completed = true;
    filled.rounds[0].assignments[0].locked = true;
    classroom.sessions = [filled];
    const original = structuredClone(classroom);

    const changed = changeSessionGroupSet(classroom, filled.id, second.id);
    const changedSession = changed.sessions[0];
    const selectedGroupIds = new Set(second.groups.map((group) => group.id));

    assert.deepEqual(classroom, original, 'the prior day is not mutated');
    assert.equal(changedSession.groupSetId, second.id);
    assert.ok(changedSession.rounds.every((round) => !round.completed));
    assert.ok(changedSession.rounds.every((round) => round.assignments.length === 2));
    assert.ok(changedSession.rounds.flatMap((round) => round.assignments)
      .every((assignment) => selectedGroupIds.has(assignment.groupId)));
    assert.ok(changedSession.rounds.flatMap((round) => round.assignments)
      .every((assignment) => !assignment.locked));
  });

  test('changeSessionGroupSet ignores the current arrangement and unknown IDs', () => {
    const set = groupSet(2);
    const stationList = stations(2);
    const session = blankSession(set, stationList, 1);
    const classroom = classroomFor(set, stationList, [session]);

    assert.equal(changeSessionGroupSet(classroom, session.id, set.id), classroom);
    assert.equal(changeSessionGroupSet(classroom, session.id, 'missing-groups'), classroom);
    assert.equal(changeSessionGroupSet(classroom, 'missing-session', set.id), classroom);
  });

  test('deleteGroupSet refuses to remove the final saved arrangement', () => {
    const set = groupSet(2);
    const classroom = classroomFor(set, stations(2), []);

    assert.equal(deleteGroupSet(classroom, set.id), classroom);
  });

  test('deleteGroupSet selects a replacement and safely rebuilds days that used it', () => {
    const first = groupSet(3);
    const second = secondGroupSet(2);
    const stationList = stations(3);
    const affected = blankSession(first, stationList, 2, 'affected-session');
    const unaffected = blankSession(second, stationList, 1, 'unaffected-session');
    const classroom = classroomFor(first, stationList, [affected, unaffected], affected.id);
    classroom.groupSets.push(second);
    classroom.sessions[0] = fillOpenSpots(classroom, affected, first);
    classroom.sessions[1] = fillOpenSpots(classroom, unaffected, second);
    classroom.sessions[1].rounds[0].completed = true;
    const untouchedDay = structuredClone(classroom.sessions[1]);
    const original = structuredClone(classroom);

    const deleted = deleteGroupSet(classroom, first.id);
    const rebuiltDay = deleted.sessions.find((session) => session.id === affected.id)!;
    const replacementGroupIds = new Set(second.groups.map((group) => group.id));

    assert.deepEqual(classroom, original, 'the prior classroom is not mutated');
    assert.deepEqual(deleted.groupSets.map((set) => set.id), [second.id]);
    assert.equal(deleted.activeGroupSetId, second.id);
    assert.equal(rebuiltDay.groupSetId, second.id);
    assert.ok(rebuiltDay.rounds.every((round) => !round.completed));
    assert.ok(rebuiltDay.rounds.flatMap((round) => round.assignments)
      .every((assignment) => replacementGroupIds.has(assignment.groupId)));
    assert.deepEqual(
      deleted.sessions.find((session) => session.id === unaffected.id),
      untouchedDay,
    );
  });
});
