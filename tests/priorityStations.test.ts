import assert from 'node:assert/strict';
import { test } from 'node:test';
import highsLoader from 'highs';
import { optimizePlanningBlock } from '../src/planner/optimizer';
import { choicesFromClassroom, compareScores, createBlockProblem, scoreChoices, validChoices, SCORE } from '../src/planner/problem';
import { fillOpenSpots } from '../src/rotations';
import { updateBlockStation } from '../src/planningBlocks';
import { createBackupFile, normalizeAppData, readBackup } from '../src/storage';
import { createSampleData } from '../src/sample';
import { assignment, blankSession, classroomFor, groupSet, stations, student } from './fixtures';

const engine = highsLoader();
function fixture(groups: number, activities: number, rounds: number, dates = 1) {
  const set = groupSet(groups);
  set.groups.forEach((group, index) => { group.studentIds = [`child-${index}`]; });
  const plans = stations(activities).map((station) => ({ ...station, trackingId: station.id }));
  const days = Array.from({ length: dates }, (_, index) => {
    const day = blankSession(set, plans, rounds, `day-${index}`);
    day.date = `2026-09-0${7 + index}`;
    if (dates > 1) day.blockId = 'block';
    return day;
  });
  const classroom = classroomFor(set, plans, days);
  classroom.students = set.groups.map((group) => student(group.studentIds[0]));
  return { classroom, set, days, key: dates > 1 ? 'block' : days[0].id };
}

void test('priority Math Games reaches all five groups early across two days with teacher pins', async () => {
  const { classroom, set, days, key } = fixture(5, 6, 2, 2);
  for (const day of days) {
    day.plannedStations[0].activityName = 'Teacher Table';
    day.plannedStations[0].dailyPinGroupIds = set.groups.slice(0, 2).map((group) => group.id);
    day.plannedStations[1].activityName = 'Fun Games';
    const math = day.plannedStations[5];
    math.activityName = 'Math Games';
    math.priority = true;
    math.groupCapacity = 2;
    math.visitRule = 'once-per-block';
  }
  const result = optimizePlanningBlock(await engine, classroom, key);
  assert.equal(result.status, 'optimal', result.detail);
  assert.equal(result.after[SCORE.pinned], 0);
  assert.equal(result.after[SCORE.empty], 0);
  assert.equal(result.after[SCORE.priorityMissing], 0);
  const rounds = result.classroom.sessions.flatMap((day) => day.rounds);
  const mathVisits = rounds.map((round) => round.assignments.filter((item) => item.stationId === 'station-6'));
  assert.deepEqual(mathVisits.map((visits) => visits.length), [2, 2, 1, 0]);
  assert.deepEqual(mathVisits.flat().map((item) => item.groupId).sort(), set.groups.map((group) => group.id).sort());
  for (const day of result.classroom.sessions) {
    for (const group of set.groups.slice(0, 2)) {
      assert.equal(day.rounds.flatMap((round) => round.assignments).filter((item) => item.groupId === group.id && item.stationId === 'station-1').length, 1);
    }
  }
});

void test('single-day priority reserves the only available round for a group locked with the teacher later', async () => {
  const { classroom, set, days: [day], key } = fixture(2, 3, 2);
  day.plannedStations[2].priority = true;
  day.plannedStations[0].dailyPinGroupIds = [set.groups[0].id];
  const teacher = assignment(set.groups[0].id, 'station-1', true);
  day.rounds[0].assignments = [assignment(set.groups[0].id, 'station-2'), assignment(set.groups[1].id, 'station-3')];
  day.rounds[1].assignments = [teacher, assignment(set.groups[1].id, 'station-2')];
  const result = optimizePlanningBlock(await engine, classroom, key);
  assert.equal(result.status, 'optimal', result.detail);
  assert.equal(result.after[SCORE.priorityMissing], 0);
  const built = result.classroom.sessions[0];
  assert.equal(built.rounds[0].assignments.find((item) => item.groupId === set.groups[0].id)?.stationId, 'station-3');
  assert.equal(built.rounds[1].assignments.find((item) => item.groupId === set.groups[1].id)?.stationId, 'station-3');
  assert.deepEqual(built.rounds[1].assignments.find((item) => item.groupId === set.groups[0].id), teacher);
});

void test('priority brings the first visit forward without preferring repeats, for any activity name', async () => {
  for (const name of ['Math Games', 'Puzzle Garden']) {
    const { classroom, days: [day], key } = fixture(1, 3, 3);
    day.plannedStations[2].priority = true;
    day.plannedStations[2].visitRule = 'repeatable';
    day.plannedStations[2].activityName = name;
    const result = optimizePlanningBlock(await engine, classroom, key);
    assert.equal(result.status, 'optimal', result.detail);
    const route = result.classroom.sessions[0].rounds.map((round) => round.assignments[0].stationId);
    assert.equal(route[0], 'station-3');
    assert.equal(new Set(route).size, 3);
    assert.equal(result.after[SCORE.priorityDelay], 0);
    assert.equal(result.after[SCORE.missing], 0);
    const draft = fillOpenSpots(classroom, day, classroom.groupSets[0]);
    assert.equal(draft.rounds[0].assignments[0].stationId, 'station-3');
    assert.equal(new Set(draft.rounds.map((round) => round.assignments[0].stationId)).size, 3);
  }
});

void test('priority first visits follow children after regrouping and preserve completed snapshots', async () => {
  const { classroom, set, days, key } = fixture(2, 3, 1, 2);
  for (const day of days) day.plannedStations[2].priority = true;
  days[0].rounds[0].completed = true;
  days[0].rounds[0].assignments = [
    { ...assignment(set.groups[0].id, 'station-3'), studentIds: ['child-0'] },
    { ...assignment(set.groups[1].id, 'station-1'), studentIds: ['child-1'] },
  ];
  const completed = structuredClone(days[0].rounds[0]);
  set.groups[0].studentIds = ['child-1'];
  set.groups[1].studentIds = ['child-0'];
  const result = optimizePlanningBlock(await engine, classroom, key);
  assert.equal(result.status, 'optimal', result.detail);
  assert.equal(result.after[SCORE.priorityMissing], 0);
  assert.deepEqual(result.classroom.sessions[0].rounds[0], completed);
  assert.equal(result.classroom.sessions[1].rounds[0].assignments.find((item) => item.groupId === set.groups[0].id)?.stationId, 'station-3');
});

void test('priority objectives agree with exhaustive schedules, including impossible coverage and multiple priorities', async () => {
  for (const rounds of [1, 2]) {
    const { classroom, days: [day], key } = fixture(3, 3, rounds);
    day.plannedStations[1].priority = true;
    day.plannedStations[2].priority = true;
    const problem = createBlockProblem(classroom, key);
    const choices = Array<number>(problem.slots.length).fill(-1);
    let best = scoreChoices(problem, choices);
    const enumerate = (slot: number) => {
      if (slot === choices.length) {
        if (!validChoices(problem, choices)) return;
        const score = scoreChoices(problem, choices);
        if (compareScores(score, best) < 0) best = score;
        return;
      }
      for (let choice = -1; choice < problem.slots[slot].choices.length; choice++) {
        choices[slot] = choice;
        enumerate(slot + 1);
      }
    };
    enumerate(0);
    const result = optimizePlanningBlock(await engine, classroom, key);
    assert.equal(result.status, 'optimal', result.detail);
    assert.deepEqual(result.after, best);
    assert.ok(validChoices(problem, choicesFromClassroom(problem, result.classroom)));
    assert.equal(result.after[SCORE.empty], 0);
    assert.ok(result.after[SCORE.priorityMissing] > 0, 'capacity cannot cover both priorities for all three children');
  }
});

void test('priority settings share across a block and survive backups; older and malformed values stay off', async () => {
  const data = normalizeAppData(createSampleData());
  const classroom = data.classrooms[0];
  const day = classroom.sessions[0];
  day.blockId = 'priority-test';
  day.plannedStations[0].trackingId = 'linked-activity';
  const nextDay = structuredClone(day);
  nextDay.id = 'next-day';
  nextDay.date = '2026-09-08';
  nextDay.plannedStations[0].id = 'next-station';
  classroom.sessions.push(nextDay);
  data.classrooms[0] = updateBlockStation(classroom, day.id, day.plannedStations[0].id, { priority: true });
  const restored = await readBackup({ text: async () => createBackupFile(data).contents });
  for (const session of restored.classrooms[0].sessions.filter((item) => item.blockId === 'priority-test')) {
    assert.equal(session.plannedStations[0].priority, true);
  }
  const turnedOff = updateBlockStation(restored.classrooms[0], day.id, day.plannedStations[0].id, { priority: false });
  assert.ok(turnedOff.sessions.filter((item) => item.blockId === 'priority-test').every((session) => !session.plannedStations[0].priority));
  const malformed = JSON.parse(JSON.stringify(data));
  malformed.classrooms[0].sessions[0].plannedStations[0].priority = 'true';
  assert.equal(normalizeAppData(malformed).classrooms[0].sessions[0].plannedStations[0].priority, undefined);
  assert.ok(normalizeAppData(createSampleData()).classrooms[0].sessions.flatMap((session) => session.plannedStations).every((station) => !station.priority));
});
