import assert from 'node:assert/strict';
import { test } from 'node:test';
import highsLoader from 'highs';
import { optimizePlanningBlock } from '../src/planner/optimizer';
import { choicesFromClassroom, compareScores, createBlockProblem, scoreChoices, validChoices } from '../src/planner/problem';
import { addFilledRound, fillOpenSpots, scheduleIssues, snapshotPlannedHistory } from '../src/rotations';
import { updateBlockStation } from '../src/planningBlocks';
import { createBackupFile, normalizeAppData, readBackup } from '../src/storage';
import { assignment, blankSession, classroomFor, groupSet, stations, student } from './fixtures';

const engine = highsLoader();
function fixture(groups = 3, rounds = 3, dates = 2) {
  const set = groupSet(groups);
  set.groups.forEach((group, index) => { group.studentIds = [`child-${index}`]; });
  const plans = stations(3).map((station) => ({ ...station, trackingId: station.id }));
  plans[0].activityName = 'Teacher';
  const days = Array.from({ length: dates }, (_, index) => {
    const day = blankSession(set, plans, rounds, `day-${index}`);
    day.date = `2026-09-0${7 + index}`;
    day.blockId = 'block';
    day.plannedStations[0].dailyPinGroupIds = set.groups.map((group) => group.id);
    day.plannedStations[2].groupCapacity = groups;
    return day;
  });
  const classroom = classroomFor(set, plans, days);
  classroom.students = set.groups.map((group) => student(group.studentIds[0]));
  return { classroom, set, days };
}

void test('multiple daily pins get one visit each and share rounds only within station capacity', async () => {
  for (const capacity of [1, 2]) {
    const { classroom, set, days } = fixture(3, capacity === 1 ? 3 : 2);
    for (const day of days) day.plannedStations[0].groupCapacity = capacity;
    const result = optimizePlanningBlock(await engine, classroom, 'block');
    assert.equal(result.status, 'optimal', result.detail);
    assert.equal(result.after[0], 0);
    assert.equal(result.after[1], 0);
    for (const day of result.classroom.sessions) {
      for (const group of set.groups) {
        const visits = day.rounds.flatMap((round) => round.assignments).filter((item) => item.groupId === group.id && item.stationId === day.plannedStations[0].id);
        assert.equal(visits.length, 1);
        assert.equal(visits[0].pinned, true);
      }
      for (const round of day.rounds)
        assert.ok(round.assignments.filter((item) => item.stationId === day.plannedStations[0].id).length <= capacity);
      assert.ok(!scheduleIssues(result.classroom, day, set).some((issue) => issue.id.startsWith('pin-')));
    }
  }
});

void test('a single-day planner chooses the scarce free round for a pinned group and matches exhaustive search', async () => {
  const { classroom, set, days: [day] } = fixture(2, 2, 1);
  day.blockId = undefined;
  day.rounds[1].assignments = [assignment(set.groups[1].id, day.plannedStations[2].id, true)];
  const retained = structuredClone(day.rounds[1].assignments[0]);
  const problem = createBlockProblem(classroom, day.id);
  const choices = Array<number>(problem.slots.length).fill(-1);
  let best = scoreChoices(problem, choices);
  const enumerate = (index: number) => {
    if (index === choices.length) {
      if (validChoices(problem, choices)) {
        const score = scoreChoices(problem, choices);
        if (compareScores(score, best) < 0) best = score;
      }
      return;
    }
    for (let choice = -1; choice < problem.slots[index].choices.length; choice++) { choices[index] = choice; enumerate(index + 1); }
  };
  enumerate(0);
  const result = optimizePlanningBlock(await engine, classroom, day.id);
  assert.equal(result.status, 'optimal', result.detail);
  assert.deepEqual(result.after, best);
  assert.equal(result.after[0], 0);
  const planned = result.classroom.sessions[0];
  assert.equal(planned.blockId, undefined);
  assert.ok(planned.rounds[0].assignments.some((item) => item.groupId === set.groups[1].id && item.pinned));
  assert.ok(planned.rounds[1].assignments.some((item) => item.groupId === set.groups[0].id && item.pinned));
  assert.deepEqual(planned.rounds[1].assignments.find((item) => item.groupId === set.groups[1].id), retained);
});

void test('completed and manual visits fulfill pins without being moved, duplicated, or relabeled', async () => {
  const { classroom, set, days: [day] } = fixture(2, 3, 1);
  day.rounds[0].completed = true;
  day.rounds[0].assignments = [{ ...assignment(set.groups[0].id, day.plannedStations[0].id), studentIds: ['child-0'], activityName: 'Teacher' }];
  day.rounds[1].assignments = [assignment(set.groups[1].id, day.plannedStations[0].id, true)];
  const completed = structuredClone(day.rounds[0]);
  const manual = structuredClone(day.rounds[1].assignments[0]);
  const result = optimizePlanningBlock(await engine, classroom, 'block');
  assert.equal(result.after[0], 0);
  const planned = result.classroom.sessions[0];
  assert.deepEqual(planned.rounds[0], completed);
  assert.deepEqual(planned.rounds[1].assignments.find((item) => item.groupId === set.groups[1].id), manual);
  assert.equal(planned.rounds.flatMap((round) => round.assignments).filter((item) => item.stationId === day.plannedStations[0].id).length, 2);
});

void test('impossible daily pins report the maximum feasible visits without breaking once-only rules or capacity', async () => {
  for (const onceOnly of [false, true]) {
    const { classroom, set, days } = fixture(3, 2);
    if (onceOnly) for (const day of days) day.plannedStations[0].visitRule = 'once-per-block';
    const result = optimizePlanningBlock(await engine, classroom, 'block');
    assert.equal(result.status, 'optimal', result.detail);
    assert.equal(result.after[0], onceOnly ? 3 : 2);
    assert.equal(result.after[1], 0);
    const problem = createBlockProblem(classroom, 'block');
    assert.ok(validChoices(problem, choicesFromClassroom(problem, result.classroom)));
    assert.equal(result.classroom.sessions.flatMap((day) => scheduleIssues(result.classroom, day, set)).filter((issue) => issue.id.startsWith('pin-')).length, onceOnly ? 3 : 2);
  }
});

void test('removing pins releases generated locks and preserves unrelated manual choices', async () => {
  const { classroom, set } = fixture(2, 2, 1);
  const first = optimizePlanningBlock(await engine, classroom, 'block').classroom;
  const day = first.sessions[0];
  const manual = day.rounds.flatMap((round) => round.assignments).find((item) => !item.pinned)!;
  manual.locked = true;
  const retained = structuredClone(manual);
  const cleared = updateBlockStation(first, day.id, day.plannedStations[0].id, { dailyPinGroupIds: [] });
  const result = optimizePlanningBlock(await engine, cleared, 'block');
  const assignments = result.classroom.sessions[0].rounds.flatMap((round) => round.assignments);
  assert.ok(assignments.every((item) => !item.pinned));
  assert.ok(assignments.some((item) => JSON.stringify(item) === JSON.stringify(retained)));
  assert.ok(!scheduleIssues(result.classroom, result.classroom.sessions[0], set).some((issue) => issue.id.startsWith('pin-')));
});

void test('daily drafts pin several groups and adding a round never duplicates their visits', () => {
  const { classroom, set, days: [day] } = fixture(3, 3, 1);
  const filled = fillOpenSpots(classroom, day, set);
  assert.equal(filled.rounds.flatMap((round) => round.assignments).filter((item) => item.pinned).length, 3);
  const added = addFilledRound(classroom, filled, set);
  assert.deepEqual(added.rounds.slice(0, 3), filled.rounds);
  assert.ok(added.rounds[3].assignments.every((item) => item.stationId !== day.plannedStations[0].id));
});

void test('old round pins migrate to selected groups and backup round trips preserve pins and snapshots', async () => {
  const { classroom, days: [day], set } = fixture(3, 2, 1);
  day.rounds[0].completed = true;
  day.rounds[0].assignments = [{ ...assignment(set.groups[0].id, day.plannedStations[0].id, true), pinned: true, studentIds: ['child-0'], activityName: 'Original teacher station', locationId: day.plannedStations[0].locationId, trackingId: day.plannedStations[0].trackingId }];
  day.plannedStations[0].dailyPinGroupIds = undefined;
  Object.assign(day.plannedStations[0], { dailyPin: { groupId: set.groups[0].id, roundIndex: 1 } });
  const data = { schemaVersion: 1 as const, classrooms: [snapshotPlannedHistory(classroom)], activeClassroomId: classroom.id };
  const normalized = normalizeAppData(data);
  const planned = normalized.classrooms[0].sessions[0];
  assert.deepEqual(planned.plannedStations[0].dailyPinGroupIds, [set.groups[0].id]);
  assert.ok(!('dailyPin' in planned.plannedStations[0]));
  assert.deepEqual(planned.rounds[0], data.classrooms[0].sessions[0].rounds[0]);
  planned.plannedStations[0].dailyPinGroupIds = [set.groups[0].id, set.groups[1].id];
  const restored = await readBackup({ text: async () => createBackupFile(normalized).contents });
  assert.deepEqual(restored, normalized);
  Object.assign(day.plannedStations[0], { dailyPinGroupIds: [] });
  assert.deepEqual(normalizeAppData({ ...data, classrooms: [classroom] }).classrooms[0].sessions[0].plannedStations[0].dailyPinGroupIds, [], 'cleared pins must not be restored from a legacy field');
  Object.assign(day.plannedStations[0], { dailyPinGroupIds: [set.groups[0].id, set.groups[0].id, null, 4, '', 'retired-group'] });
  const clean = normalizeAppData({ ...data, classrooms: [classroom] });
  assert.deepEqual(clean.classrooms[0].sessions[0].plannedStations[0].dailyPinGroupIds, [set.groups[0].id, 'retired-group']);
  assert.ok(scheduleIssues(clean.classrooms[0], clean.classrooms[0].sessions[0], set).some((issue) => issue.groupId === 'retired-group'));
});
