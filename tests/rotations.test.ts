import assert from 'node:assert/strict';
import { describe as nodeDescribe, test as nodeTest } from 'node:test';
import type { RotationSession } from '../src/model';
import {
  addFilledRound,
  fillOpenSpots,
  moveGroupToStation,
  moveStationToGroup,
  rebuildUnlocked,
  removeRound,
  scheduleIssues,
  toggleAssignmentLock,
  toggleRoundCompleted,
  unlockAllAssignments,
} from '../src/rotations';
import {
  assignment,
  blankSession,
  classroomFor,
  groupSet,
  sampleClassroom,
  student,
  stations,
} from './fixtures';

function describe(name: string, body: () => void) {
  void nodeDescribe(name, body);
}

function test(name: string, body: () => void) {
  void nodeTest(name, body);
}

function assignmentFor(session: RotationSession, roundIndex: number, groupId: string) {
  return session.rounds[roundIndex].assignments.find((item) => item.groupId === groupId);
}

function assertValidRound(
  session: RotationSession,
  roundIndex: number,
  expectedAssignments: number,
) {
  const assignments = session.rounds[roundIndex].assignments;
  assert.equal(assignments.length, expectedAssignments);
  assert.equal(new Set(assignments.map((item) => item.groupId)).size, assignments.length);
  assert.equal(new Set(assignments.map((item) => item.stationId)).size, assignments.length);
}

function historyThatCompetesWithCleanRotations(
  set: ReturnType<typeof groupSet>,
  stationList: ReturnType<typeof stations>,
) {
  return Array.from({ length: 20 }, (_, historyIndex) => {
    const past = blankSession(set, stationList, 1, `past-session-${historyIndex}`);
    const shift = 3 + (historyIndex % 4);
    past.rounds[0].completed = true;
    past.rounds[0].assignments = set.groups.map((group, groupIndex) =>
      assignment(group.id, stationList[(groupIndex + shift) % stationList.length].id),
    );
    return past;
  });
}

describe('learner rotation history', () => {
  test('completing a round snapshots the present learners and reopening removes the snapshot', () => {
    const set = groupSet(2);
    set.groups[0].studentIds = ['student-1', 'student-absent'];
    set.groups[1].studentIds = ['student-2'];
    const pupils = [
      student('student-1'),
      student('student-2'),
      student('student-absent', { absent: true }),
    ];
    const stationList = stations(2);
    const session = blankSession(set, stationList, 1);
    session.rounds[0].assignments = [
      assignment(set.groups[0].id, stationList[0].id),
      assignment(set.groups[1].id, stationList[1].id),
    ];
    const original = structuredClone(session);

    const completed = toggleRoundCompleted(session, session.rounds[0].id, set, pupils);
    const reopened = toggleRoundCompleted(completed, session.rounds[0].id, set, pupils);

    assert.deepEqual(session, original, 'the open round is not mutated');
    assert.equal(completed.rounds[0].completed, true);
    assert.deepEqual(
      assignmentFor(completed, 0, set.groups[0].id)?.studentIds,
      ['student-1'],
    );
    assert.deepEqual(
      assignmentFor(completed, 0, set.groups[1].id)?.studentIds,
      ['student-2'],
    );
    assert.equal(
      assignmentFor(completed, 0, set.groups[0].id)?.activityName,
      stationList[0].activityName,
    );
    assert.equal(
      assignmentFor(completed, 0, set.groups[0].id)?.locationId,
      stationList[0].locationId,
    );
    assert.equal(reopened.rounds[0].completed, false);
    assert.ok(reopened.rounds[0].assignments.every((item) => item.studentIds === undefined));
    assert.ok(reopened.rounds[0].assignments.every((item) => item.activityName === undefined));
  });

  test('activity-name history follows learners across regrouping, station IDs, and locations', () => {
    const first = groupSet(2);
    first.groups[0].studentIds = ['student-1'];
    first.groups[1].studentIds = ['student-2'];
    const second = groupSet(2, { id: 'new-arrangement', name: 'New Arrangement' });
    second.groups = second.groups.map((group, index) => ({
      ...group,
      id: `new-group-${index + 1}`,
      studentIds: [`student-${index + 1}`],
    }));
    const pupils = [student('student-1'), student('student-2')];
    const pastStations = stations(3);
    const past = blankSession(first, pastStations, 1, 'past-session');
    past.rounds[0].assignments = [
      assignment(first.groups[0].id, pastStations[0].id),
      assignment(first.groups[1].id, pastStations[1].id),
    ];
    const completedPast = toggleRoundCompleted(
      past,
      past.rounds[0].id,
      first,
      pupils,
    );
    completedPast.plannedStations[0].activityName = 'Renamed after completion';
    first.groups[0].studentIds = ['student-2'];
    first.groups[1].studentIds = ['student-1'];
    const currentStations = stations(3).map((station, index) => ({
      ...station,
      id: `new-station-${index + 1}`,
      locationId: `location-${((index + 1) % 3) + 1}`,
    }));
    const current = blankSession(second, currentStations, 1, 'current-session');
    const classroom = classroomFor(first, currentStations, [completedPast, current], current.id);
    classroom.groupSets.push(second);
    classroom.students = pupils;

    const filled = fillOpenSpots(classroom, current, second);

    const studentOneStation = currentStations.find(
      (station) => station.id === assignmentFor(filled, 0, second.groups[0].id)?.stationId,
    );
    const studentTwoStation = currentStations.find(
      (station) => station.id === assignmentFor(filled, 0, second.groups[1].id)?.stationId,
    );
    assert.notEqual(studentOneStation?.activityName, pastStations[0].activityName);
    assert.notEqual(studentTwoStation?.activityName, pastStations[1].activityName);
    assertValidRound(filled, 0, 2);
  });
});

describe('fillOpenSpots', () => {
  test('fills every group once per round and avoids repeats while stations remain', () => {
    const set = groupSet(5);
    const stationList = stations(5);
    const session = blankSession(set, stationList, 3);
    const classroom = classroomFor(set, stationList, [session]);

    const filled = fillOpenSpots(classroom, session, set);

    filled.rounds.forEach((_, index) => assertValidRound(filled, index, 5));
    for (const group of set.groups) {
      const route = filled.rounds.map(
        (round) => round.assignments.find((item) => item.groupId === group.id)!.stationId,
      );
      assert.equal(new Set(route).size, route.length);
    }
  });

  test('preserves every existing valid placement, whether locked or unlocked', () => {
    const set = groupSet(3);
    const stationList = stations(3);
    const session = blankSession(set, stationList, 1);
    session.rounds[0].assignments = [
      assignment(set.groups[0].id, stationList[2].id, false),
      assignment(set.groups[1].id, stationList[0].id, true),
    ];
    const original = structuredClone(session);
    const classroom = classroomFor(set, stationList, [session]);

    const filled = fillOpenSpots(classroom, session, set);

    assert.deepEqual(session, original, 'the original session is not mutated');
    assert.deepEqual(
      assignmentFor(filled, 0, set.groups[0].id),
      assignment(set.groups[0].id, stationList[2].id, false),
    );
    assert.deepEqual(
      assignmentFor(filled, 0, set.groups[1].id),
      assignment(set.groups[1].id, stationList[0].id, true),
    );
    assertValidRound(filled, 0, 3);
  });

  test('never changes a completed round, even when it is partial', () => {
    const set = groupSet(3);
    const stationList = stations(3);
    const session = blankSession(set, stationList, 2);
    session.rounds[0] = {
      ...session.rounds[0],
      completed: true,
      assignments: [assignment(set.groups[0].id, stationList[0].id)],
    };
    const completedRound = structuredClone(session.rounds[0]);
    const classroom = classroomFor(set, stationList, [session]);

    const filled = fillOpenSpots(classroom, session, set);

    assert.deepEqual(filled.rounds[0], completedRound);
    assertValidRound(filled, 1, 3);
  });

  test('uses each available station once when there are fewer stations than groups', () => {
    const set = groupSet(5);
    const stationList = stations(3);
    const session = blankSession(set, stationList, 1);
    const classroom = classroomFor(set, stationList, [session]);

    const filled = fillOpenSpots(classroom, session, set);

    assertValidRound(filled, 0, 3);
    assert.ok(
      filled.rounds[0].assignments.every((item) =>
        stationList.some((station) => station.id === item.stationId)),
    );
  });

  test('drops stale assignments before filling valid groups and stations', () => {
    const set = groupSet(2);
    const stationList = stations(2);
    const session = blankSession(set, stationList, 1);
    session.rounds[0].assignments = [
      assignment('missing-group', stationList[0].id, true),
      assignment(set.groups[0].id, 'missing-station', true),
    ];
    const classroom = classroomFor(set, stationList, [session]);

    const filled = fillOpenSpots(classroom, session, set);

    assertValidRound(filled, 0, 2);
    assert.ok(filled.rounds[0].assignments.every((item) => item.groupId !== 'missing-group'));
    assert.ok(filled.rounds[0].assignments.every((item) => item.stationId !== 'missing-station'));
  });

  test('prefers stations a group has not visited on completed prior days', () => {
    const set = groupSet(2);
    const stationList = stations(3);
    const past = blankSession(set, stationList, 1, 'past-session');
    past.rounds[0].completed = true;
    past.rounds[0].assignments = [
      assignment(set.groups[0].id, stationList[0].id),
      assignment(set.groups[1].id, stationList[1].id),
    ];
    const current = blankSession(set, stationList, 1);
    const classroom = classroomFor(set, stationList, [past, current]);

    const filled = fillOpenSpots(classroom, current, set);

    assert.notEqual(assignmentFor(filled, 0, set.groups[0].id)?.stationId, stationList[0].id);
    assert.notEqual(assignmentFor(filled, 0, set.groups[1].id)?.stationId, stationList[1].id);
    assertValidRound(filled, 0, 2);
  });

  test('uses planned rounds from an earlier date as provisional history', () => {
    const set = groupSet(2);
    const stationList = stations(3);
    const plannedEarlierDay = blankSession(set, stationList, 1, 'planned-earlier-day');
    plannedEarlierDay.date = '2026-08-29';
    plannedEarlierDay.rounds[0].assignments = [
      assignment(set.groups[0].id, stationList[0].id),
      assignment(set.groups[1].id, stationList[1].id),
    ];
    const current = blankSession(set, stationList, 1);
    const classroom = classroomFor(set, stationList, [plannedEarlierDay, current]);

    const filled = fillOpenSpots(classroom, current, set);

    assert.notEqual(assignmentFor(filled, 0, set.groups[0].id)?.stationId, stationList[0].id);
    assert.notEqual(assignmentFor(filled, 0, set.groups[1].id)?.stationId, stationList[1].id);
    assertValidRound(filled, 0, 2);
  });

  test('uses completed rounds on the current day when filling later rounds', () => {
    const set = groupSet(3);
    const stationList = stations(3);
    const session = blankSession(set, stationList, 2);
    session.rounds[0].completed = true;
    session.rounds[0].assignments = set.groups.map((group, index) =>
      assignment(group.id, stationList[index].id),
    );
    const classroom = classroomFor(set, stationList, [session]);

    const filled = fillOpenSpots(classroom, session, set);

    for (const group of set.groups) {
      assert.notEqual(
        assignmentFor(filled, 1, group.id)?.stationId,
        assignmentFor(filled, 0, group.id)?.stationId,
      );
    }
  });

  test('is deterministic for the same partial schedule', () => {
    const set = groupSet(4);
    const stationList = stations(5);
    const session = blankSession(set, stationList, 3);
    session.rounds[1].assignments = [assignment(set.groups[2].id, stationList[4].id, true)];
    const classroom = classroomFor(set, stationList, [session]);

    assert.deepEqual(
      fillOpenSpots(classroom, session, set),
      fillOpenSpots(classroom, session, set),
    );
  });

  test('maintains core slotting invariants from two through eight groups', () => {
    for (let count = 2; count <= 8; count += 1) {
      const set = groupSet(count);
      const stationList = stations(count);
      const roundCount = Math.min(4, count);
      const session = blankSession(set, stationList, roundCount, `session-${count}`);
      const classroom = classroomFor(set, stationList, [session]);
      const filled = fillOpenSpots(classroom, session, set);

      filled.rounds.forEach((_, index) => assertValidRound(filled, index, count));
      for (const group of set.groups) {
        const route = filled.rounds.map(
          (round) => round.assignments.find((item) => item.groupId === group.id)!.stationId,
        );
        assert.equal(new Set(route).size, route.length, `${count}-group route repeats too soon`);
      }
    }
  });

  test('avoids same-day repeats in a 7-group, 7-station, 4-round schedule despite heavy prior history', () => {
    const set = groupSet(7);
    const stationList = stations(7);
    const current = blankSession(set, stationList, 4, 'current-session');
    const history = historyThatCompetesWithCleanRotations(set, stationList);
    const classroom = classroomFor(set, stationList, [...history, current], current.id);

    const filled = fillOpenSpots(classroom, current, set);
    const withFilled = classroomFor(set, stationList, [...history, filled], filled.id);

    filled.rounds.forEach((_, index) => assertValidRound(filled, index, 7));
    for (const group of set.groups) {
      const route = filled.rounds.map(
        (round) => round.assignments.find((item) => item.groupId === group.id)!.stationId,
      );
      assert.equal(new Set(route).size, 4, `${group.id} repeated a station on the same day`);
    }
    assert.deepEqual(scheduleIssues(withFilled, filled, set), []);
  });
});

describe('adding and rebuilding rounds', () => {
  test('addFilledRound appends one complete round without changing prior rounds', () => {
    const classroom = sampleClassroom();
    const set = classroom.groupSets[0];
    const session = classroom.sessions[0];
    const priorRounds = structuredClone(session.rounds);

    const added = addFilledRound(classroom, session, set);

    assert.equal(added.rounds.length, priorRounds.length + 1);
    assert.deepEqual(added.rounds.slice(0, -1), priorRounds);
    assertValidRound(added, added.rounds.length - 1, set.groups.length);
    for (const group of set.groups) {
      const route = added.rounds.map(
        (round) => round.assignments.find((item) => item.groupId === group.id)!.stationId,
      );
      assert.equal(new Set(route).size, route.length);
    }
  });

  test('removeRound deletes only the chosen open round and leaves the others intact', () => {
    const set = groupSet(3);
    const stationList = stations(3);
    const session = blankSession(set, stationList, 3);
    const original = structuredClone(session);

    const removed = removeRound(session, session.rounds[1].id);

    assert.deepEqual(session, original, 'the prior schedule is not mutated');
    assert.deepEqual(removed.rounds, [original.rounds[0], original.rounds[2]]);
  });

  test('removeRound protects completed and unknown rounds', () => {
    const set = groupSet(2);
    const session = blankSession(set, stations(2), 2);
    session.rounds[0].completed = true;

    assert.equal(removeRound(session, session.rounds[0].id), session);
    assert.equal(removeRound(session, 'missing-round'), session);
  });

  test('rebuildUnlocked preserves completed rounds and locked choices, then refills the rest', () => {
    const set = groupSet(3);
    const stationList = stations(3);
    const session = blankSession(set, stationList, 2);
    session.rounds[0].completed = true;
    session.rounds[0].assignments = set.groups.map((group, index) =>
      assignment(group.id, stationList[index].id),
    );
    session.rounds[1].assignments = [
      assignment(set.groups[0].id, stationList[1].id, true),
      assignment(set.groups[1].id, stationList[0].id, false),
      assignment(set.groups[2].id, stationList[2].id, false),
    ];
    const original = structuredClone(session);
    const classroom = classroomFor(set, stationList, [session]);

    const rebuilt = rebuildUnlocked(classroom, session, set);

    assert.deepEqual(session, original, 'the prior schedule is not mutated');
    assert.deepEqual(rebuilt.rounds[0], original.rounds[0]);
    assert.deepEqual(
      assignmentFor(rebuilt, 1, set.groups[0].id),
      assignment(set.groups[0].id, stationList[1].id, true),
    );
    assertValidRound(rebuilt, 1, 3);
  });

  test('rebuildUnlocked leaves a fully locked open round unchanged', () => {
    const set = groupSet(3);
    const stationList = stations(3);
    const session = blankSession(set, stationList, 1);
    session.rounds[0].assignments = set.groups.map((group, index) =>
      assignment(group.id, stationList[index].id, true),
    );
    const classroom = classroomFor(set, stationList, [session]);

    assert.deepEqual(rebuildUnlocked(classroom, session, set), session);
  });

  test('rebuildUnlocked repairs an unlocked repeating schedule when a clean route exists', () => {
    const set = groupSet(3);
    const stationList = stations(3);
    const session = blankSession(set, stationList, 3);
    session.rounds.forEach((round) => {
      round.assignments = set.groups.map((group, index) =>
        assignment(group.id, stationList[index].id),
      );
    });
    const classroom = classroomFor(set, stationList, [session]);

    const rebuilt = rebuildUnlocked(classroom, session, set);
    const withRebuilt = classroomFor(set, stationList, [rebuilt]);

    assert.deepEqual(scheduleIssues(withRebuilt, rebuilt, set), []);
  });

  test('rebuildUnlocked gives five groups their missed planned activities first on the next day', () => {
    const set = groupSet(5);
    set.groups.forEach((group, index) => {
      group.studentIds = [`student-${index + 1}`];
    });
    const pupils = set.groups.map((_, index) => student(`student-${index + 1}`));
    const stationList = stations(5);
    const dayOne = blankSession(set, stationList, 3, 'day-one');
    dayOne.date = '2026-08-29';
    const plannedDayOne = fillOpenSpots(
      classroomFor(set, stationList, [dayOne]),
      dayOne,
      set,
    );

    const dayTwo = blankSession(set, stationList, 3, 'day-two');
    dayTwo.date = '2026-08-30';
    dayTwo.rounds = dayTwo.rounds.map((round, roundIndex) => ({
      ...round,
      assignments: plannedDayOne.rounds[roundIndex].assignments.map((item) =>
        assignment(item.groupId, item.stationId)),
    }));
    const classroom = classroomFor(
      set,
      stationList,
      [plannedDayOne, dayTwo],
      dayTwo.id,
    );
    classroom.students = pupils;

    const optimized = rebuildUnlocked(classroom, dayTwo, set);

    optimized.rounds.forEach((_, index) => assertValidRound(optimized, index, 5));
    for (const group of set.groups) {
      const visitedOnDayOne = new Set(plannedDayOne.rounds.map((round) =>
        round.assignments.find((item) => item.groupId === group.id)!.stationId));
      const missedOnDayOne = new Set(stationList
        .map((station) => station.id)
        .filter((stationId) => !visitedOnDayOne.has(stationId)));
      const firstTwoOnDayTwo = new Set(optimized.rounds.slice(0, 2).map((round) =>
        round.assignments.find((item) => item.groupId === group.id)!.stationId));

      assert.deepEqual(firstTwoOnDayTwo, missedOnDayOne);
    }
  });

  test('rebuildUnlocked fixes a 7-by-7 four-round repeat even when history favors the repeat', () => {
    const set = groupSet(7);
    const stationList = stations(7);
    const current = blankSession(set, stationList, 4, 'current-session');
    current.rounds.forEach((round) => {
      round.assignments = set.groups.map((group, index) =>
        assignment(group.id, stationList[index].id),
      );
    });
    const history = historyThatCompetesWithCleanRotations(set, stationList);
    const classroom = classroomFor(set, stationList, [...history, current], current.id);

    const rebuilt = rebuildUnlocked(classroom, current, set);
    const withRebuilt = classroomFor(set, stationList, [...history, rebuilt], rebuilt.id);

    assert.deepEqual(scheduleIssues(withRebuilt, rebuilt, set), []);
  });

  test('unlockAllAssignments unlocks editable rounds without changing completed history', () => {
    const set = groupSet(2);
    const session = blankSession(set, stations(2), 2);
    session.rounds.forEach((round) => {
      round.assignments = set.groups.map((group, index) =>
        assignment(group.id, `station-${index + 1}`, true),
      );
    });
    session.rounds[0].completed = true;
    const original = structuredClone(session);

    const unlocked = unlockAllAssignments(session);

    assert.deepEqual(session, original, 'the prior schedule is not mutated');
    assert.ok(unlocked.rounds[0].assignments.every((item) => item.locked));
    assert.ok(unlocked.rounds[1].assignments.every((item) => !item.locked));
  });
});

describe('manual rotation moves', () => {
  function simpleSession() {
    const set = groupSet(3);
    const stationList = stations(4);
    const session = blankSession(set, stationList, 1);
    session.rounds[0].assignments = set.groups.map((group, index) =>
      assignment(group.id, stationList[index].id),
    );
    return { set, stationList, session };
  }

  test('moving a group onto an occupied station swaps the displaced group and locks the drag', () => {
    const { set, stationList, session } = simpleSession();
    const original = structuredClone(session);

    const result = moveGroupToStation(
      session,
      session.rounds[0].id,
      set.groups[0].id,
      stationList[1].id,
    );

    assert.deepEqual(session, original, 'the prior schedule is not mutated');
    assert.deepEqual(
      assignmentFor(result.session, 0, set.groups[0].id),
      assignment(set.groups[0].id, stationList[1].id, true),
    );
    assert.deepEqual(
      assignmentFor(result.session, 0, set.groups[1].id),
      assignment(set.groups[1].id, stationList[0].id, false),
    );
    assert.deepEqual(
      assignmentFor(result.session, 0, set.groups[2].id),
      assignment(set.groups[2].id, stationList[2].id, false),
    );
    assertValidRound(result.session, 0, 3);
  });

  test('moving a group to an empty station leaves its old station empty', () => {
    const { set, stationList, session } = simpleSession();

    const result = moveGroupToStation(
      session,
      session.rounds[0].id,
      set.groups[0].id,
      stationList[3].id,
    );

    assert.equal(result.session.rounds[0].assignments.length, 3);
    assert.equal(assignmentFor(result.session, 0, set.groups[0].id)?.stationId, stationList[3].id);
    assert.ok(!result.session.rounds[0].assignments.some((item) => item.stationId === stationList[0].id));
  });

  test('a locked station occupant blocks a group move without changing the session', () => {
    const { set, stationList, session } = simpleSession();
    session.rounds[0].assignments[1].locked = true;

    const result = moveGroupToStation(
      session,
      session.rounds[0].id,
      set.groups[0].id,
      stationList[1].id,
    );

    assert.ok(result.issue);
    assert.equal(result.session, session);
  });

  test('dropping a group on its current station locks it without duplicating it', () => {
    const { set, stationList, session } = simpleSession();

    const result = moveGroupToStation(
      session,
      session.rounds[0].id,
      set.groups[0].id,
      stationList[0].id,
    );

    assertValidRound(result.session, 0, 3);
    assert.equal(assignmentFor(result.session, 0, set.groups[0].id)?.locked, true);
  });

  test('completed and unknown rounds ignore group moves', () => {
    const { set, stationList, session } = simpleSession();
    session.rounds[0].completed = true;

    assert.equal(
      moveGroupToStation(session, session.rounds[0].id, set.groups[0].id, stationList[1].id).session,
      session,
    );
    assert.equal(
      moveGroupToStation(session, 'missing-round', set.groups[0].id, stationList[1].id).session,
      session,
    );
  });

  test('moving a station onto a group performs the symmetric swap and locks the target', () => {
    const { set, stationList, session } = simpleSession();

    const result = moveStationToGroup(
      session,
      session.rounds[0].id,
      set.groups[0].id,
      stationList[1].id,
    );

    assert.deepEqual(
      assignmentFor(result.session, 0, set.groups[0].id),
      assignment(set.groups[0].id, stationList[1].id, true),
    );
    assert.deepEqual(
      assignmentFor(result.session, 0, set.groups[1].id),
      assignment(set.groups[1].id, stationList[0].id, false),
    );
    assertValidRound(result.session, 0, 3);
  });

  test('moving an unused station onto a group returns the prior station to the unused pool', () => {
    const { set, stationList, session } = simpleSession();

    const result = moveStationToGroup(
      session,
      session.rounds[0].id,
      set.groups[0].id,
      stationList[3].id,
    );

    assert.equal(result.session.rounds[0].assignments.length, 3);
    assert.deepEqual(
      assignmentFor(result.session, 0, set.groups[0].id),
      assignment(set.groups[0].id, stationList[3].id, true),
    );
    assert.ok(
      !result.session.rounds[0].assignments.some(
        (item) => item.stationId === stationList[0].id,
      ),
      'the replaced station becomes unused',
    );
    assertValidRound(result.session, 0, 3);
  });

  test('a locked target group blocks a station move', () => {
    const { set, stationList, session } = simpleSession();
    session.rounds[0].assignments[0].locked = true;

    const result = moveStationToGroup(
      session,
      session.rounds[0].id,
      set.groups[0].id,
      stationList[1].id,
    );

    assert.ok(result.issue);
    assert.equal(result.session, session);
  });

  test('dropping a station on its current group locks it without duplicating it', () => {
    const { set, stationList, session } = simpleSession();

    const result = moveStationToGroup(
      session,
      session.rounds[0].id,
      set.groups[0].id,
      stationList[0].id,
    );

    assertValidRound(result.session, 0, 3);
    assert.equal(assignmentFor(result.session, 0, set.groups[0].id)?.locked, true);
  });

  test('toggleAssignmentLock changes only the selected assignment and can undo itself', () => {
    const { set, session } = simpleSession();

    const locked = toggleAssignmentLock(session, session.rounds[0].id, set.groups[1].id);
    const unlocked = toggleAssignmentLock(locked, session.rounds[0].id, set.groups[1].id);

    assert.equal(assignmentFor(locked, 0, set.groups[1].id)?.locked, true);
    assert.equal(assignmentFor(locked, 0, set.groups[0].id)?.locked, false);
    assert.deepEqual(unlocked, session);
  });
});

describe('scheduleIssues', () => {
  test('returns no issues for a complete non-repeating schedule', () => {
    const set = groupSet(3);
    const stationList = stations(3);
    const session = blankSession(set, stationList, 3);
    const classroom = classroomFor(set, stationList, [session]);
    const filled = fillOpenSpots(classroom, session, set);
    const withFilled = classroomFor(set, stationList, [filled]);

    assert.deepEqual(scheduleIssues(withFilled, filled, set), []);
  });

  test('reports insufficient unique active stations and missing group placements', () => {
    const set = groupSet(3);
    const stationList = stations(3);
    const session = blankSession(set, stationList, 1);
    session.plannedStations = stationList.slice(0, 2);
    const classroom = classroomFor(set, stationList, [session]);

    const issueIds = scheduleIssues(classroom, session, set).map((issue) => issue.id);

    assert.ok(issueIds.includes('station-capacity'));
    assert.ok(issueIds.includes(`missing-${session.rounds[0].id}`));
  });

  test('reports a duplicate group and the group that is consequently missing', () => {
    const set = groupSet(3);
    const stationList = stations(3);
    const session = blankSession(set, stationList, 1);
    session.rounds[0].assignments = [
      assignment(set.groups[0].id, stationList[0].id),
      assignment(set.groups[0].id, stationList[1].id),
      assignment(set.groups[1].id, stationList[2].id),
    ];
    const classroom = classroomFor(set, stationList, [session]);

    const issueIds = scheduleIssues(classroom, session, set).map((issue) => issue.id);

    assert.ok(issueIds.includes(`duplicate-${session.rounds[0].id}`));
    assert.ok(issueIds.includes(`missing-${session.rounds[0].id}`));
  });

  test('reports when two groups occupy the same station', () => {
    const set = groupSet(3);
    const stationList = stations(3);
    const session = blankSession(set, stationList, 1);
    session.rounds[0].assignments = [
      assignment(set.groups[0].id, stationList[0].id),
      assignment(set.groups[1].id, stationList[0].id),
      assignment(set.groups[2].id, stationList[1].id),
    ];
    const classroom = classroomFor(set, stationList, [session]);

    const issueIds = scheduleIssues(classroom, session, set).map((issue) => issue.id);

    assert.ok(issueIds.includes(`duplicate-station-${session.rounds[0].id}`));
  });

  test('reports duplicate locations and duplicate activity names during station setup', () => {
    const set = groupSet(2);
    const stationList = stations(2);
    stationList[1].locationId = stationList[0].locationId;
    stationList[1].activityName = stationList[0].activityName;
    const session = blankSession(set, stationList, 1);
    const classroom = classroomFor(set, stationList, [session]);

    const issueIds = scheduleIssues(classroom, session, set).map((issue) => issue.id);

    assert.ok(issueIds.includes(`duplicate-location-${stationList[0].locationId}`));
    assert.ok(issueIds.includes('duplicate-activity-activity 1'));
  });

  test('reports a same-day repeat using the group and activity names', () => {
    const set = groupSet(2);
    const stationList = stations(2);
    const session = blankSession(set, stationList, 2);
    session.rounds.forEach((round) => {
      round.assignments = [
        assignment(set.groups[0].id, stationList[0].id),
        assignment(set.groups[1].id, stationList[1].id),
      ];
    });
    const classroom = classroomFor(set, stationList, [session]);

    const issues = scheduleIssues(classroom, session, set);

    const repeat = issues.find(
      (issue) => issue.id === `repeat-${set.groups[0].id}-activity 1`,
    );
    assert.ok(repeat?.message.includes(set.groups[0].name));
    assert.ok(repeat?.message.includes(stationList[0].activityName));
    assert.deepEqual(repeat?.roundIds, session.rounds.map((round) => round.id));
    assert.equal(repeat?.groupId, set.groups[0].id);
  });

  test('reports assignments that reference a removed group or inactive station', () => {
    const set = groupSet(2);
    const stationList = stations(3);
    const session = blankSession(set, stationList.slice(0, 2), 1);
    session.rounds[0].assignments = [
      assignment('removed-group', stationList[0].id),
      assignment(set.groups[0].id, stationList[2].id),
    ];
    const classroom = classroomFor(set, stationList, [session]);

    const issueIds = scheduleIssues(classroom, session, set).map((issue) => issue.id);

    assert.ok(issueIds.includes(`unknown-group-${session.rounds[0].id}`));
    assert.ok(issueIds.includes(`inactive-station-${session.rounds[0].id}`));
  });
});
