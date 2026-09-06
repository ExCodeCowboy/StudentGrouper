import assert from 'node:assert/strict';
import { test } from 'node:test';
import highsLoader from 'highs';
import { optimizePlanningBlock } from '../src/planner/optimizer';
import {
  plannerInputKey,
  startBlockPlanner,
  type PlannerWorker,
} from '../src/planner/client';
import {
  choicesFromClassroom,
  compareScores,
  createBlockProblem,
  greedyChoices,
  scoreChoices,
  validChoices,
} from '../src/planner/problem';
import {
  assignment,
  blankSession,
  classroomFor,
  groupSet,
  stations,
} from './fixtures';

const engine = highsLoader();
function smallBlock(groups = 2, activities = 3, rounds = 1) {
  const set = groupSet(groups);
  set.groups.forEach((group, index) => {
    group.studentIds = [`learner-${index}`];
  });
  const plans = stations(activities).map((station) => ({
    ...station,
    trackingId: station.id,
  }));
  const days = ['2026-09-07', '2026-09-08'].map((date) => {
    const day = blankSession(set, plans, rounds, date);
    day.blockId = 'block';
    day.date = date;
    return day;
  });
  return { set, plans, days, classroom: classroomFor(set, plans, days) };
}

void test('whole-block solver reserves a scarce Monday opportunity to avoid a Tuesday gap', async () => {
  const { classroom, days, set } = smallBlock(2, 2);
  for (const day of days) day.plannedStations[0].visitRule = 'once-per-block';
  days[1].rounds[0].assignments = [
    assignment(set.groups[1].id, days[1].plannedStations[1].id, true),
  ];
  const problem = createBlockProblem(classroom, 'block');
  const greedy = scoreChoices(problem, greedyChoices(problem));
  assert.equal(
    greedy[1],
    1,
    'this fixture must expose the chronological planner’s dead end',
  );
  const result = optimizePlanningBlock(await engine, classroom, 'block');
  assert.equal(result.status, 'optimal', result.detail);
  assert.equal(result.after[1], 0);
  assert.equal(result.after[4], 0);
  assert.deepEqual(
    result.classroom.sessions[1].rounds[0].assignments.find(
      (item) => item.groupId === set.groups[1].id,
    ),
    days[1].rounds[0].assignments[0],
  );
  assert.equal(
    result.classroom.sessions[0].rounds[0].assignments.find(
      (item) => item.groupId === set.groups[1].id,
    )!.stationId,
    days[0].plannedStations[0].id,
  );
});

void test('whole-block priorities match exhaustive enumeration on small schedules', async () => {
  for (const [groups, activities, rounds, shared] of [
    [2, 3, 1, 0],
    [2, 3, 1, 1],
    [2, 2, 2, 1],
    [1, 1, 2, 1],
  ]) {
    const { classroom, days } = smallBlock(groups, activities, rounds);
    for (const day of days) {
      if (activities === 3) day.plannedStations[1].visitRule = 'once-per-block';
      day.plannedStations.at(-1)!.visitRule = 'repeatable';
      day.plannedStations.at(-1)!.groupCapacity = shared ? 2 : 1;
    }
    const problem = createBlockProblem(classroom, 'block');
    let optimal = scoreChoices(problem, Array(problem.slots.length).fill(-1));
    const choices = Array<number>(problem.slots.length).fill(-1);
    const enumerate = (slot: number) => {
      if (slot === choices.length) {
        if (!validChoices(problem, choices)) return;
        const score = scoreChoices(problem, choices);
        if (compareScores(score, optimal) < 0) optimal = score;
        return;
      }
      for (
        let value = -1;
        value < problem.slots[slot].choices.length;
        value++
      ) {
        choices[slot] = value;
        enumerate(slot + 1);
      }
    };
    enumerate(0);
    const result = optimizePlanningBlock(await engine, classroom, 'block');
    assert.equal(result.status, 'optimal', result.detail);
    assert.deepEqual(result.after, optimal);
  }
});

void test('September 7–8 whole-block planning spreads shared work without sacrificing coverage or the locked teacher round', async () => {
  const { classroom, days, set } = smallBlock(4, 5, 3);
  let learner = 0;
  set.groups.forEach((group, index) => {
    group.studentIds = Array.from(
      { length: [8, 4, 6, 6][index] },
      () => `child-${learner++}`,
    );
  });
  for (const day of days) {
    day.plannedStations[0].activityName = 'Teacher Table';
    day.plannedStations[0].dailyPinGroupIds = [set.groups[0].id];
    day.plannedStations[1].activityName = 'Reading';
    day.plannedStations[1].visitRule = 'once-per-block';
    day.plannedStations[2].activityName = 'Writing';
    day.plannedStations[2].visitRule = 'once-per-block';
    day.plannedStations[3].activityName = 'Word Work';
    day.plannedStations[3].visitRule = 'repeatable';
    day.plannedStations[3].groupCapacity = 5;
    day.plannedStations[4].activityName = '';
    day.rounds[1].assignments = [assignment(set.groups[0].id, day.plannedStations[0].id, true)];
  }
  const problem = createBlockProblem(classroom, 'block');
  const greedy = scoreChoices(problem, greedyChoices(problem));
  assert.ok(greedy[7] > 0);
  const result = optimizePlanningBlock(await engine, classroom, 'block', {
    timeLimitMs: 15_000,
  });
  assert.equal(
    result.status,
    'optimal',
    `${result.detail} ${JSON.stringify(result.after)}`,
  );
  assert.ok(compareScores(result.after, greedy) < 0);
  assert.equal(result.after[1], 0);
  assert.equal(result.after[4], 0);
  assert.ok(
    result.after[7] < greedy[7],
    'the full block must improve consecutive repeats',
  );
  assert.equal(
    result.after[7],
    10,
    'first-visit priority and six teacher slots force two consecutive repeats, assigned to groups totaling ten learners',
  );
  assert.ok(
    validChoices(problem, choicesFromClassroom(problem, result.classroom)),
  );
  for (const day of result.classroom.sessions)
    assert.ok(
      day.rounds[1].assignments.some(
        (item) => item.groupId === set.groups[0].id && item.locked && item.stationId === day.plannedStations[0].id,
      ),
    );
  const again = optimizePlanningBlock(await engine, result.classroom, 'block', {
    timeLimitMs: 15_000,
  });
  assert.deepEqual(
    again.classroom,
    result.classroom,
    'an already optimal plan should remain stable',
  );
});

void test('zero search budget returns a validated incumbent without claiming optimality', async () => {
  const { classroom } = smallBlock();
  const result = optimizePlanningBlock(await engine, classroom, 'block', {
    timeLimitMs: 0,
  });
  assert.equal(result.status, 'limited');
  const problem = createBlockProblem(classroom, 'block');
  assert.ok(
    validChoices(problem, choicesFromClassroom(problem, result.classroom)),
  );
});

void test('current Clay Time setup fills the Tuesday gap and covers all five stations', async () => {
  const { classroom, days, set } = smallBlock(4, 5, 3);
  set.groups.forEach((group, index) => {
    group.studentIds = Array.from(
      { length: 6 },
      (_, pupil) => `child-${index}-${pupil}`,
    );
  });
  const names = [
    'Teacher Table',
    'Reading',
    'Writing',
    'Word Work',
    'Clay Time',
  ];
  for (const day of days) {
    day.plannedStations.forEach((station, index) => {
      station.activityName = names[index];
      station.visitRule = index > 0 && index < 4 ? 'once-per-block' : 'rotate';
    });
    day.plannedStations[0].dailyPinGroupIds = [set.groups[0].id];
    day.plannedStations[4].groupCapacity = 2;
  }
  const routes = [
    [
      [0, 1, 2],
      [1, 2, 3],
      [2, 3, 0],
      [3, 0, 1],
    ],
    [
      [0, 3, 4],
      [4, 0, 4],
      [1, 4, -1],
      [2, 4, 0],
    ],
  ];
  days.forEach((day, date) =>
    day.rounds.forEach((round, time) => {
      round.assignments = set.groups.flatMap((group, index) =>
        routes[date][index][time] < 0
          ? []
          : [
              assignment(
                group.id,
                day.plannedStations[routes[date][index][time]].id,
              ),
            ],
      );
    }),
  );
  const result = optimizePlanningBlock(await engine, classroom, 'block');
  assert.equal(result.status, 'optimal', result.detail);
  assert.equal(result.before[1], 1);
  assert.equal(result.after[1], 0);
  assert.equal(result.after[4], 0);
  assert.equal(result.after[7], 0);
  const renamed = structuredClone(result.classroom);
  renamed.sessions.forEach((day) =>
    day.plannedStations.forEach((station, index) => {
      station.activityName = `Unrelated activity ${index}`;
    }),
  );
  const renamedResult = optimizePlanningBlock(await engine, renamed, 'block');
  assert.equal(renamedResult.status, 'optimal');
  assert.deepEqual(renamedResult.after.slice(0, 10), result.after.slice(0, 10));
  assert.deepEqual(
    renamedResult.classroom,
    renamed,
    'names cannot change scheduling preferences',
  );
});

void test('completed learner snapshots and future locks survive regrouping without new once-only violations', async () => {
  const { classroom, days, set } = smallBlock(2, 3, 2);
  set.groups[0].studentIds = ['a', 'b'];
  set.groups[1].studentIds = ['c'];
  days.forEach((day) => {
    day.plannedStations[0].visitRule = 'once-per-block';
  });
  days[0].rounds[0].completed = true;
  days[0].rounds[0].assignments = [
    {
      ...assignment(set.groups[0].id, days[0].plannedStations[0].id),
      studentIds: ['a'],
      activityName: 'Original packet name',
    },
  ];
  days[1].rounds[1].assignments = [
    assignment(set.groups[1].id, days[1].plannedStations[0].id, true),
  ];
  const completed = structuredClone(days[0].rounds[0]);
  const locked = structuredClone(days[1].rounds[1].assignments[0]);
  const result = optimizePlanningBlock(await engine, classroom, 'block');
  assert.equal(result.status, 'optimal', result.detail);
  assert.deepEqual(result.classroom.sessions[0].rounds[0], completed);
  assert.deepEqual(
    result.classroom.sessions[1].rounds[1].assignments.find(
      (item) => item.groupId === set.groups[1].id,
    ),
    locked,
  );
  const problem = createBlockProblem(classroom, 'block');
  assert.ok(
    validChoices(problem, choicesFromClassroom(problem, result.classroom)),
  );
  assert.ok(
    result.after[4] > 0,
    'learner b cannot repeat the packet with learner a',
  );
});

void test('impossible daily requirements and retained capacity conflicts remain explicit', async () => {
  const { classroom, days, set } = smallBlock(3, 2);
  days.forEach((day) => {
    day.plannedStations[0].visitRule = 'daily';
  });
  days[0].rounds[0].assignments = [
    assignment(set.groups[0].id, days[0].plannedStations[0].id, true),
    assignment(set.groups[1].id, days[0].plannedStations[0].id, true),
  ];
  const locked = structuredClone(days[0].rounds[0].assignments);
  const result = optimizePlanningBlock(await engine, classroom, 'block');
  assert.equal(result.status, 'optimal', result.detail);
  assert.ok(result.after[2] > 0);
  assert.equal(
    result.classroom.sessions[0].rounds[0].assignments.filter(
      (item) => item.stationId === days[0].plannedStations[0].id,
    ).length,
    2,
  );
  assert.deepEqual(
    result.classroom.sessions[0].rounds[0].assignments.filter(
      (item) => item.locked,
    ),
    locked,
  );
  assert.ok(
    validChoices(
      createBlockProblem(classroom, 'block'),
      choicesFromClassroom(
        createBlockProblem(classroom, 'block'),
        result.classroom,
      ),
    ),
  );
});

void test('creating a block can preserve all existing days while optimizing new dates', async () => {
  const { classroom, days, set } = smallBlock(2, 3, 2);
  days[0].rounds[0].assignments = [
    assignment(set.groups[0].id, days[0].plannedStations[0].id),
  ];
  const existing = structuredClone(days[0]);
  const result = optimizePlanningBlock(await engine, classroom, 'block', {
    preserveSessionIds: [days[0].id],
  });
  assert.equal(result.status, 'optimal', result.detail);
  assert.deepEqual(result.classroom.sessions[0], existing);
});

void test('a large arrangement gets a bounded, checked result that is no worse than the chronological draft', async () => {
  const { classroom, days } = smallBlock(12, 6, 3);
  days.forEach((day) => {
    day.plannedStations[5].groupCapacity = 12;
    day.plannedStations[5].visitRule = 'repeatable';
  });
  const problem = createBlockProblem(classroom, 'block');
  const draft = scoreChoices(problem, greedyChoices(problem));
  const result = optimizePlanningBlock(await engine, classroom, 'block', {
    timeLimitMs: 200,
  });
  assert.notEqual(result.status, 'failed', result.detail);
  assert.ok(
    validChoices(problem, choicesFromClassroom(problem, result.classroom)),
  );
  assert.ok(compareScores(result.after, draft) <= 0);
});

void test('invalid solver output never replaces the checked incumbent', async () => {
  const { classroom } = smallBlock();
  const broken = {
    solve: () => ({
      Status: 'Optimal',
      ObjectiveValue: 0,
      Columns: {},
      Rows: [],
    }),
  } as Awaited<typeof engine>;
  const result = optimizePlanningBlock(broken, classroom, 'block');
  assert.equal(result.status, 'failed');
  const problem = createBlockProblem(classroom, 'block');
  assert.ok(
    validChoices(problem, choicesFromClassroom(problem, result.classroom)),
  );
});

void test('a time limit before the solver finds an incumbent keeps the draft and reports an unfinished search', async () => {
  const { classroom } = smallBlock();
  const timedOut = {
    solve: () => ({
      Status: 'Time limit reached',
      ObjectiveValue: NaN,
      Columns: {},
      Rows: [],
    }),
  } as Awaited<typeof engine>;
  const result = optimizePlanningBlock(timedOut, classroom, 'block');
  assert.equal(result.status, 'limited');
  const problem = createBlockProblem(classroom, 'block');
  assert.deepEqual(result.after, scoreChoices(problem, greedyChoices(problem)));
});

void test('canceling a worker terminates it and ignores any late result', async () => {
  const { classroom } = smallBlock();
  let terminated = 0;
  const worker: PlannerWorker = {
    onmessage: null,
    onerror: null,
    postMessage: () => {},
    terminate: () => {
      terminated++;
    },
  };
  const task = startBlockPlanner(
    { classroom, blockId: 'block' },
    () => {},
    () => worker,
  );
  const rejected = assert.rejects(task.promise, { name: 'AbortError' });
  task.cancel();
  await rejected;
  task.cancel();
  assert.equal(terminated, 1);
});

void test('result freshness permits date navigation but detects changed classroom input', () => {
  const { classroom } = smallBlock();
  const key = plannerInputKey(classroom);
  classroom.activeSessionId = 'different-day';
  assert.equal(plannerInputKey(classroom), key);
  classroom.sessions[0].plannedStations[0].groupCapacity = 2;
  assert.notEqual(plannerInputKey(classroom), key);
});
