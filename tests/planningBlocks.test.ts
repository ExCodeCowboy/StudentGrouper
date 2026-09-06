import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addBlockStation,
  blockDates,
  blockPlanIssue,
  createPlanningBlock,
  draftPlanningBlock,
  removeBlockStation,
  updateBlockStation,
} from '../src/planningBlocks';
import {
  fillOpenSpots,
  moveGroupToStation,
  moveStationToGroup,
  scheduleIssues,
  snapshotPlannedHistory,
  toggleRoundCompleted,
} from '../src/rotations';
import { readBackup, createBackupFile, normalizeAppData } from '../src/storage';
import {
  assignment,
  blankSession,
  classroomFor,
  groupSet,
  stations,
  student,
} from './fixtures';

function fixture() {
  const set = groupSet(5);
  set.groups.forEach((group, index) => {
    group.studentIds = [`learner-${index}`];
  });
  const plans = stations(6);
  plans[0].activityName = 'Teacher';
  plans[0].dailyPinGroupIds = [set.groups[0].id];
  plans[1].activityName = 'Packet';
  plans[1].visitRule = 'once-per-block';
  plans[5].activityName = 'Makeup at desks';
  plans[5].visitRule = 'repeatable';
  plans[5].groupCapacity = 5;
  const template = blankSession(set, plans, 3);
  template.date = '2026-09-07';
  const classroom = classroomFor(set, plans, [template]);
  classroom.students = set.groups.map((group) => student(group.studentIds[0]));
  const created = createPlanningBlock(classroom, template, {
    name: 'Monday and Tuesday',
    startDate: '2026-09-07',
    endDate: '2026-09-08',
    roundCount: 3,
  });
  const blockId = created.planningBlocks![0].id;
  return {
    set,
    template,
    classroom,
    blockId,
    built: draftPlanningBlock(created, blockId),
  };
}

void test('two-day block places five groups with a daily teacher pin, a once-only packet, and shared makeup', () => {
  const { set, built } = fixture();
  assert.equal(built.sessions.length, 2);
  for (const day of built.sessions) {
    assert.deepEqual(scheduleIssues(built, day, set), []);
    for (const round of day.rounds) {
      assert.equal(round.assignments.length, 5);
      assert.equal(
        new Set(round.assignments.map((item) => item.groupId)).size,
        5,
      );
    }
    const pin = day.rounds.flatMap((round) => round.assignments).find(
      (item) => item.groupId === set.groups[0].id && item.pinned,
    )!;
    assert.equal(
      day.plannedStations.find((plan) => plan.id === pin.stationId)!
        .activityName,
      'Teacher',
    );
    assert.equal(pin.pinned, true);
  }
  for (const group of set.groups) {
    const packets = built.sessions.flatMap((day) =>
      day.rounds.flatMap((round) =>
        round.assignments.filter(
          (item) =>
            item.groupId === group.id &&
            day.plannedStations.find((plan) => plan.id === item.stationId)
              ?.activityName === 'Packet',
        ),
      ),
    );
    assert.equal(packets.length, 1);
  }
});

function coverageFixture(packetCapacity: number, roundCount = 1) {
  const set = groupSet(5);
  set.groups.forEach((group, index) => {
    group.studentIds = [`learner-${index}`];
  });
  const plans = stations(2);
  plans[0].activityName = 'Makeup';
  plans[0].visitRule = 'repeatable';
  plans[0].groupCapacity = 5;
  plans[1].activityName = 'Packet';
  plans[1].visitRule = 'once-per-block';
  plans[1].groupCapacity = packetCapacity;
  const template = blankSession(set, plans, roundCount);
  const classroom = classroomFor(set, plans, [template]);
  classroom.students = set.groups.map((group) => student(group.studentIds[0]));
  const built = createPlanningBlock(classroom, template, {
    name: 'Packet coverage',
    startDate: '2026-09-07',
    endDate: '2026-09-08',
    roundCount,
  });
  return { built, set, blockId: built.planningBlocks![0].id };
}

function groupsVisiting(
  classroom: ReturnType<typeof classroomFor>,
  blockId: string,
  activityName: string,
) {
  return classroom.sessions
    .filter((day) => day.blockId === blockId)
    .flatMap((day) =>
      day.rounds.flatMap((round) =>
        round.assignments
          .filter(
            (item) =>
              day.plannedStations.find((plan) => plan.id === item.stationId)
                ?.activityName === activityName,
          )
          .map((item) => item.groupId),
      ),
    );
}

void test('September 7–8 setup with a locked teacher round does not repeat Word Work before covering stations', () => {
  const set = groupSet(4);
  let learner = 0;
  set.groups.forEach((group, index) => {
    group.studentIds = Array.from(
      { length: [8, 4, 6, 6][index] },
      () => `learner-${learner++}`,
    );
  });
  const plans = stations(5);
  plans[0].activityName = 'Teacher Table';
  plans[0].dailyPinGroupIds = [set.groups[0].id];
  plans[1].activityName = 'Reading';
  plans[1].visitRule = 'once-per-block';
  plans[2].activityName = 'Writing';
  plans[2].visitRule = 'once-per-block';
  plans[3].activityName = 'Word Work';
  plans[3].visitRule = 'repeatable';
  plans[3].groupCapacity = 5;
  plans[4].activityName = '';
  plans[4].visitRule = 'once-per-block';
  const template = blankSession(set, plans, 3);
  const classroom = classroomFor(set, plans, [template]);
  classroom.students = set.groups.flatMap((group) =>
    group.studentIds.map((id) => student(id)),
  );
  const created = createPlanningBlock(classroom, template, {
    name: 'Two-day classroom check',
    startDate: '2026-09-07',
    endDate: '2026-09-08',
    roundCount: 3,
  });
  const blockId = created.planningBlocks![0].id;
  // Keep this original regression's fixed teacher appointment; flexible daily
  // pins are tested separately and do not dictate a round.
  for (const day of created.sessions) day.rounds[1].assignments = [
    assignment(set.groups[0].id, day.plannedStations[0].id, true),
  ];
  const built = draftPlanningBlock(created, blockId);
  const days = built.sessions.filter((day) => day.blockId === blockId);
  for (const group of set.groups) {
    const routes = days.map((day) =>
      day.rounds.map((round) => {
        const assigned = round.assignments.find(
          (item) => item.groupId === group.id,
        )!;
        return day.plannedStations.find(
          (plan) => plan.id === assigned.stationId,
        )!.activityName;
      }),
    );
    assert.ok(
      routes.every(
        (route) => route.filter((name) => name === 'Word Work').length <= 2,
      ),
      `${group.name}: ${JSON.stringify(routes)}`,
    );
    assert.equal(routes.flat().filter((name) => name === 'Reading').length, 1);
    assert.equal(routes.flat().filter((name) => name === 'Writing').length, 1);
    assert.equal(new Set(routes.flat()).size, 4);
    const seen = new Set<string>();
    for (const activity of routes.flat()) {
      if (activity === 'Word Work' && seen.has(activity)) {
        assert.equal(
          seen.size,
          4,
          `${group.name} must cover every named station before repeating Word Work`,
        );
      }
      seen.add(activity);
    }
  }
  assert.equal(groupsVisiting(built, blockId, 'Teacher Table').length, 6);
  assert.ok(
    days.every((day) =>
      day.rounds[1].assignments.some(
        (item) => item.groupId === set.groups[0].id && item.locked,
      ),
    ),
  );
  assert.ok(
    scheduleIssues(built, days[0], set).some((issue) =>
      issue.id.startsWith('unnamed-station-'),
    ),
    'the unnamed fifth station must be explained instead of silently skipped',
  );
  const withFifthStation = draftPlanningBlock(
    updateBlockStation(built, days[0].id, days[0].plannedStations[4].id, {
      activityName: 'Carpet activity',
    }),
    blockId,
  );
  for (const group of set.groups) {
    const seen = new Set<string>();
    for (const day of withFifthStation.sessions.filter(
      (day) => day.blockId === blockId,
    )) {
      for (const round of day.rounds) {
        const placed = round.assignments.find(
          (item) => item.groupId === group.id,
        )!;
        const activity = day.plannedStations.find(
          (plan) => plan.id === placed.stationId,
        )!.activityName;
        if (activity === 'Word Work' && seen.has(activity)) {
          assert.equal(
            seen.size,
            5,
            `${group.name} must visit the fifth station before repeating Word Work`,
          );
        }
        seen.add(activity);
      }
    }
    assert.equal(seen.size, 5, `${group.name} should cover all five stations`);
  }
});

void test('block planning rewards each group visiting only-once stations ahead of optional activities', () => {
  const { built, set, blockId } = coverageFixture(3);
  for (const result of [built, draftPlanningBlock(built, blockId)]) {
    const visitors = groupsVisiting(result, blockId, 'Packet');
    assert.deepEqual(
      [...visitors].sort(),
      set.groups.map((group) => group.id).sort(),
    );
    const days = result.sessions.filter((day) => day.blockId === blockId);
    assert.equal(
      days[0].rounds[0].assignments.filter(
        (item) => item.stationId === days[0].plannedStations[1].id,
      ).length,
      3,
    );
    assert.ok(days.every((day) => day.rounds[0].assignments.length === 5));
  }
});

void test('limited once-only capacity reaches as many different groups as possible without repeats', () => {
  const { built, blockId } = coverageFixture(1);
  const visitors = groupsVisiting(built, blockId, 'Packet');
  assert.equal(visitors.length, 2);
  assert.equal(new Set(visitors).size, 2);
  assert.ok(
    built.sessions
      .filter((day) => day.blockId === blockId)
      .every((day) =>
        day.rounds.every((round) => round.assignments.length === 5),
      ),
  );
});

void test('coverage uses completed visits and future locks while prioritizing groups still needing the packet', () => {
  const { built, set, blockId } = coverageFixture(3, 2);
  const days = built.sessions.filter((day) => day.blockId === blockId);
  days.forEach((day) =>
    day.rounds.forEach((round) => {
      round.assignments = [];
    }),
  );
  days[0].rounds[0].assignments = [
    assignment(set.groups[0].id, days[0].plannedStations[1].id),
  ];
  days[0].rounds[0].completed = true;
  days[0].rounds[0].assignments[0].studentIds = [...set.groups[0].studentIds];
  const completed = structuredClone(days[0].rounds[0]);
  const reserved = assignment(
    set.groups[1].id,
    days[1].plannedStations[1].id,
    true,
  );
  days[1].rounds[1].assignments = [reserved];
  const rebuilt = draftPlanningBlock(built, blockId);
  assert.deepEqual(
    groupsVisiting(rebuilt, blockId, 'Packet').sort(),
    set.groups.map((group) => group.id).sort(),
  );
  assert.deepEqual(
    rebuilt.sessions.find((day) => day.id === days[0].id)!.rounds[0],
    completed,
  );
  assert.deepEqual(
    rebuilt.sessions
      .find((day) => day.id === days[1].id)!
      .rounds[1].assignments.find((item) => item.groupId === reserved.groupId),
    reserved,
  );
});

void test('a missing block visit beats avoiding a same-day repeat for another group', () => {
  const set = groupSet(3);
  set.groups.forEach((group, index) => {
    group.studentIds = [`learner-${index}`];
  });
  for (const repeatable of [false, true]) {
    const plans = stations(3).map((plan) => ({ ...plan, trackingId: plan.id }));
    if (repeatable) plans[1].visitRule = 'repeatable';
    const first = blankSession(set, plans, 2, 'first-day');
    first.date = '2026-09-07';
    first.blockId = 'coverage-block';
    first.rounds[0].assignments = [
      assignment(set.groups[0].id, plans[0].id),
      assignment(set.groups[1].id, plans[1].id),
    ];
    first.rounds[1].assignments = [assignment(set.groups[1].id, plans[2].id)];
    const second = blankSession(set, plans, 2, 'second-day');
    second.date = '2026-09-08';
    second.blockId = first.blockId;
    second.rounds[0].assignments = [
      assignment(set.groups[0].id, plans[2].id, true),
      assignment(set.groups[1].id, plans[0].id, true),
      assignment(set.groups[2].id, plans[1].id, true),
    ];
    second.rounds[1].assignments = [
      assignment(set.groups[2].id, plans[2].id, true),
    ];
    const classroom = classroomFor(set, plans, [first, second]);
    const filled = fillOpenSpots(classroom, second, set);
    assert.equal(
      filled.rounds[1].assignments.find(
        (item) => item.groupId === set.groups[0].id,
      )!.stationId,
      plans[1].id,
      'the first group gets its missing activity rather than revisiting yesterday’s activity',
    );
    assert.deepEqual(filled.rounds[0], second.rounds[0]);
  }
});

void test('a station not yet visited beats repeated Word Work even when it is booked for a later round', () => {
  const set = groupSet(1);
  set.groups[0].studentIds = ['learner'];
  const plans = stations(2).map((plan) => ({ ...plan, trackingId: plan.id }));
  plans[0].activityName = 'Word Work';
  plans[0].visitRule = 'repeatable';
  plans[1].activityName = 'Reading';
  const first = blankSession(set, plans, 1, 'monday');
  first.date = '2026-09-07';
  first.blockId = 'coverage-block';
  first.rounds[0].assignments = [assignment(set.groups[0].id, plans[0].id)];
  const second = blankSession(set, plans, 2, 'tuesday');
  second.date = '2026-09-08';
  second.blockId = first.blockId;
  second.rounds[1].assignments = [
    assignment(set.groups[0].id, plans[1].id, true),
  ];
  const filled = fillOpenSpots(
    classroomFor(set, plans, [first, second]),
    second,
    set,
  );
  assert.equal(filled.rounds[0].assignments[0].stationId, plans[1].id);
  assert.deepEqual(
    filled.rounds[1],
    second.rounds[1],
    'the later manual booking remains locked',
  );
});

void test('students still needing a station get priority over Word Work after joining a group that visited it', () => {
  for (const visitRule of ['rotate', 'repeatable'] as const) {
    const set = groupSet(1);
    set.groups[0].studentIds = ['returning-learner', 'new-learner'];
    const plans = stations(2).map((plan) => ({ ...plan, trackingId: plan.id }));
    plans[0].activityName = 'Word Work';
    plans[0].visitRule = 'repeatable';
    plans[1].activityName = 'Reading';
    plans[1].visitRule = visitRule;
    const first = blankSession(set, plans, 4, 'monday');
    first.date = '2026-09-07';
    first.blockId = 'coverage-block';
    first.rounds.forEach((round, index) => {
      round.completed = true;
      round.assignments = [
        {
          ...assignment(set.groups[0].id, plans[index === 3 ? 0 : 1].id),
          studentIds:
            index === 3 ? [...set.groups[0].studentIds] : ['returning-learner'],
        },
      ];
    });
    const second = blankSession(set, plans, 1, 'tuesday');
    second.date = '2026-09-08';
    second.blockId = first.blockId;
    const filled = fillOpenSpots(
      classroomFor(set, plans, [first, second]),
      second,
      set,
    );
    assert.equal(
      filled.rounds[0].assignments[0].stationId,
      plans[1].id,
      visitRule,
    );
    assert.deepEqual(first.rounds[0].assignments[0].studentIds, [
      'returning-learner',
    ]);
  }
});

void test('five groups cover all six stations before repeating across two days', () => {
  const set = groupSet(5);
  set.groups.forEach((group, index) => {
    group.studentIds = [`learner-${index}`];
  });
  const plans = stations(6);
  plans[0].visitRule = 'repeatable';
  plans[0].groupCapacity = 5;
  const template = blankSession(set, plans, 3);
  const classroom = classroomFor(set, plans, [template]);
  const built = createPlanningBlock(classroom, template, {
    name: 'Every station',
    startDate: '2026-09-07',
    endDate: '2026-09-08',
    roundCount: 3,
  });
  const days = built.sessions.filter((day) => day.blockId);
  for (const group of set.groups) {
    const visits = days.flatMap((day) =>
      day.rounds.flatMap((round) =>
        round.assignments
          .filter((item) => item.groupId === group.id)
          .map(
            (item) =>
              day.plannedStations.find((plan) => plan.id === item.stationId)!
                .trackingId,
          ),
      ),
    );
    assert.equal(visits.length, 6);
    assert.equal(new Set(visits).size, 6);
  }
});

void test('daily requirements stay ahead of optional block coverage', () => {
  const set = groupSet(2);
  const plans = stations(2);
  plans[0].visitRule = 'daily';
  plans[0].groupCapacity = 2;
  plans[1].visitRule = 'once-per-block';
  const first = blankSession(set, plans, 1, 'first');
  first.date = '2026-09-07';
  first.blockId = 'daily-block';
  first.rounds[0].assignments = set.groups.map((group) =>
    assignment(group.id, plans[0].id),
  );
  const second = blankSession(set, plans, 1, 'second');
  second.date = '2026-09-08';
  second.blockId = first.blockId;
  const filled = fillOpenSpots(
    classroomFor(set, plans, [first, second]),
    second,
    set,
  );
  assert.ok(
    filled.rounds[0].assignments.every(
      (item) => item.stationId === plans[0].id,
    ),
  );
});

void test('new block resets tracking without clearing the previous block', () => {
  const { set, built } = fixture();
  const original = structuredClone(built.sessions);
  const next = createPlanningBlock(built, built.sessions[1], {
    name: 'Next block',
    startDate: '2026-09-09',
    endDate: '2026-09-10',
    roundCount: 3,
  });
  assert.deepEqual(next.sessions.slice(0, 2), original);
  const newDays = next.sessions.slice(2);
  assert.ok(
    newDays[0].plannedStations[1].trackingId !==
      original[0].plannedStations[1].trackingId,
  );
  for (const group of set.groups) {
    assert.equal(
      newDays.flatMap((day) =>
        day.rounds.flatMap((round) =>
          round.assignments.filter(
            (item) =>
              item.groupId === group.id &&
              item.stationId === day.plannedStations[1].id,
          ),
        ),
      ).length,
      1,
    );
  }
});

void test('station rename retains block tracking and rules across both days', () => {
  const { built, set, blockId } = fixture();
  const first = built.sessions[0];
  const packet = first.plannedStations[1];
  const renamed = updateBlockStation(built, first.id, packet.id, {
    activityName: 'New packet label',
  });
  for (const day of renamed.sessions) {
    assert.equal(day.plannedStations[1].activityName, 'New packet label');
    assert.equal(day.plannedStations[1].trackingId, packet.trackingId);
  }
  const rebuilt = draftPlanningBlock(renamed, blockId);
  for (const day of rebuilt.sessions)
    assert.deepEqual(scheduleIssues(rebuilt, day, set), []);
});

void test('shared station fills every group, permits repeats, and has no capacity caution', () => {
  const set = groupSet(5);
  const plans = stations(1);
  plans[0].groupCapacity = 5;
  plans[0].visitRule = 'repeatable';
  const day = blankSession(set, plans, 3);
  const classroom = classroomFor(set, plans, [day]);
  const filled = fillOpenSpots(classroom, day, set);
  for (const round of filled.rounds) assert.equal(round.assignments.length, 5);
  assert.deepEqual(scheduleIssues(classroom, filled, set), []);
});

void test('manual moves into a shared station preserve all existing occupants in either view', () => {
  const set = groupSet(3);
  const plans = stations(3);
  plans[0].groupCapacity = 3;
  const day = blankSession(set, plans, 1);
  day.rounds[0].assignments = set.groups.map((group, index) =>
    assignment(group.id, plans[index].id),
  );
  const moved = moveGroupToStation(
    day,
    day.rounds[0].id,
    set.groups[1].id,
    plans[0].id,
  ).session;
  const movedAgain = moveStationToGroup(
    moved,
    day.rounds[0].id,
    set.groups[2].id,
    plans[0].id,
  ).session;
  assert.equal(movedAgain.rounds[0].assignments.length, 3);
  assert.ok(
    movedAgain.rounds[0].assignments.every(
      (item) => item.stationId === plans[0].id,
    ),
  );
});

void test('shared station swaps when full and protects locked occupants', () => {
  const set = groupSet(3);
  const plans = stations(2);
  plans[0].groupCapacity = 2;
  const day = blankSession(set, plans, 1);
  day.rounds[0].assignments = [
    assignment(set.groups[0].id, plans[0].id, true),
    assignment(set.groups[1].id, plans[0].id),
    assignment(set.groups[2].id, plans[1].id),
  ];
  const result = moveGroupToStation(
    day,
    day.rounds[0].id,
    set.groups[2].id,
    plans[0].id,
  );
  assert.equal(result.issue, undefined);
  assert.equal(
    result.session.rounds[0].assignments.find(
      (item) => item.groupId === set.groups[0].id,
    )!.stationId,
    plans[0].id,
  );
  assert.equal(
    result.session.rounds[0].assignments.find(
      (item) => item.groupId === set.groups[1].id,
    )!.stationId,
    plans[1].id,
  );
});

void test('once-only rules leave a visible gap rather than automatically repeating', () => {
  const set = groupSet(2);
  const plans = stations(2).map((plan) => ({
    ...plan,
    visitRule: 'once-per-block' as const,
  }));
  const day = blankSession(set, plans, 3);
  const classroom = classroomFor(set, plans, [day]);
  const filled = fillOpenSpots(classroom, day, set);
  assert.equal(filled.rounds[2].assignments.length, 0);
  assert.ok(
    scheduleIssues(classroom, filled, set).some(
      (item) => item.id === `missing-${day.rounds[2].id}`,
    ),
  );
});

void test('once-only block rules follow learners after regrouping even when day one was not completed', () => {
  const { built, set } = fixture();
  const saved = snapshotPlannedHistory(built);
  const first = saved.sessions[0];
  const visited = first.rounds.flatMap((round) =>
    round.assignments
      .filter((item) => item.stationId === first.plannedStations[1].id)
      .flatMap((item) => item.studentIds!),
  );
  const changed = structuredClone(set);
  changed.groups.reverse();
  changed.groups.forEach((group, index) => {
    group.studentIds = [set.groups[index].studentIds[0]];
  });
  const second = {
    ...saved.sessions[1],
    rounds: saved.sessions[1].rounds.map((round) => ({
      ...round,
      assignments: [],
    })),
    plannedStations: saved.sessions[1].plannedStations.map((plan) => ({
      ...plan,
      dailyPinGroupIds: undefined,
    })),
  };
  const current = { ...saved, groupSets: [changed], sessions: [first, second] };
  const filled = fillOpenSpots(current, second, changed);
  for (const round of filled.rounds)
    for (const item of round.assignments) {
      if (item.stationId !== second.plannedStations[1].id) continue;
      assert.ok(
        !visited.includes(
          changed.groups.find((group) => group.id === item.groupId)!
            .studentIds[0],
        ),
      );
    }
});

void test('planned learner snapshots survive changes to a saved group arrangement outside blocks', () => {
  const set = groupSet(2);
  set.groups[0].studentIds = ['a'];
  set.groups[1].studentIds = ['b'];
  const plans = stations(2);
  const first = blankSession(set, plans, 1, 'first');
  first.date = '2026-09-07';
  first.rounds[0].assignments = [
    assignment(set.groups[0].id, plans[0].id),
    assignment(set.groups[1].id, plans[1].id),
  ];
  const saved = snapshotPlannedHistory(classroomFor(set, plans, [first]));
  set.groups[0].studentIds = ['b'];
  set.groups[1].studentIds = ['a'];
  const second = blankSession(set, plans, 1, 'second');
  second.date = '2026-09-08';
  saved.sessions.push(second);
  const filled = fillOpenSpots(saved, second, set);
  assert.equal(
    filled.rounds[0].assignments.find(
      (item) => item.groupId === set.groups[0].id,
    )!.stationId,
    plans[0].id,
  );
});

void test('daily pin conflicts report a caution and preserve the teacher manual lock', () => {
  const { built, set, blockId } = fixture();
  const first = built.sessions[0];
  for (const round of first.rounds) round.assignments = [
    assignment(set.groups[0].id, first.plannedStations[2].id, true),
  ];
  const rebuilt = draftPlanningBlock(built, blockId);
  assert.equal(
    rebuilt.sessions[0].rounds[1].assignments.find(
      (item) => item.groupId === set.groups[0].id,
    )!.stationId,
    first.plannedStations[2].id,
  );
  assert.ok(
    scheduleIssues(rebuilt, rebuilt.sessions[0], set).some((issue) =>
      issue.id.startsWith('pin-'),
    ),
  );
});

void test('changing or removing daily pins replaces only generated pins on rebuild', () => {
  const { built, set, blockId } = fixture();
  const first = built.sessions[0];
  const changed = updateBlockStation(
    built,
    first.id,
    first.plannedStations[0].id,
    { dailyPinGroupIds: [set.groups[1].id] },
  );
  const rebuilt = draftPlanningBlock(changed, blockId);
  for (const day of rebuilt.sessions) {
    assert.equal(
      day.rounds
        .flatMap((round) => round.assignments)
        .filter((item) => item.pinned).length,
      1,
    );
    assert.ok(
      day.rounds.flatMap((round) => round.assignments).some(
        (item) => item.pinned && item.groupId === set.groups[1].id,
      ),
    );
  }
  const removed = draftPlanningBlock(
    updateBlockStation(rebuilt, first.id, first.plannedStations[0].id, {
      dailyPinGroupIds: undefined,
    }),
    blockId,
  );
  assert.ok(
    removed.sessions.every((day) =>
      day.rounds.every((round) =>
        round.assignments.every((item) => !item.pinned),
      ),
    ),
  );
});

void test('block optimization preserves completed snapshots and future locked choices', () => {
  const { built, set, blockId } = fixture();
  built.sessions[0] = toggleRoundCompleted(
    built.sessions[0],
    built.sessions[0].rounds[0].id,
    set,
    built.students,
  );
  const completed = structuredClone(built.sessions[0].rounds[0]);
  const future = built.sessions[1].rounds[0].assignments[0];
  future.locked = true;
  const rebuilt = draftPlanningBlock(built, blockId);
  assert.deepEqual(rebuilt.sessions[0].rounds[0], completed);
  assert.deepEqual(
    rebuilt.sessions[1].rounds[0].assignments.find(
      (item) => item.groupId === future.groupId,
    ),
    future,
  );
});

void test('only-once violation caused by a manual placement is visible across dates', () => {
  const { built, set } = fixture();
  const first = built.sessions[0];
  const groupId = first.rounds
    .flatMap((round) => round.assignments)
    .find((item) => item.stationId === first.plannedStations[1].id)!.groupId;
  const second = built.sessions[1];
  second.rounds[0].assignments = [
    assignment(groupId, second.plannedStations[1].id, true),
  ];
  assert.ok(
    scheduleIssues(built, second, set).some((issue) =>
      issue.id.startsWith('block-repeat-'),
    ),
  );
});

void test('daily visits can target selected groups and report impossible all-group requests', () => {
  const set = groupSet(5);
  const plans = stations(5);
  plans[0].visitRule = 'daily';
  plans[0].dailyGroupIds = [set.groups[4].id];
  const day = blankSession(set, plans, 1);
  const classroom = classroomFor(set, plans, [day]);
  const filled = fillOpenSpots(classroom, day, set);
  assert.ok(
    filled.rounds[0].assignments.some(
      (item) =>
        item.groupId === set.groups[4].id && item.stationId === plans[0].id,
    ),
  );
  filled.plannedStations[0].dailyGroupIds = undefined;
  assert.equal(
    scheduleIssues(classroom, filled, set).filter((issue) =>
      issue.id.startsWith('daily-'),
    ).length,
    4,
  );
});

void test('block date validation skips weekends, rejects overlap, and preserves existing days', () => {
  assert.deepEqual(blockDates('2026-09-04', '2026-09-07'), [
    '2026-09-04',
    '2026-09-07',
  ]);
  assert.deepEqual(blockDates('2026-09-08', '2026-09-07'), []);
  assert.deepEqual(blockDates('2026-09-01', '2026-11-01'), []);
  const { built, classroom, template } = fixture();
  assert.ok(
    blockPlanIssue(built, {
      name: 'Overlap',
      startDate: '2026-09-08',
      endDate: '2026-09-09',
      roundCount: 3,
    }),
  );
  template.rounds[0].assignments = [
    assignment(
      classroom.groupSets[0].groups[0].id,
      template.plannedStations[0].id,
      true,
    ),
  ];
  const created = createPlanningBlock(classroom, template, {
    name: 'Existing day',
    startDate: '2026-09-07',
    endDate: '2026-09-08',
    roundCount: 3,
  });
  assert.deepEqual(created.sessions[0].rounds, template.rounds);
});

void test('backup round-trip retains blocks, identities, station rules, pins, and planned history', async () => {
  const { built } = fixture();
  const source = normalizeAppData({
    schemaVersion: 1,
    activeClassroomId: built.id,
    classrooms: [snapshotPlannedHistory(built)],
  });
  const backup = createBackupFile(source);
  const restored = await readBackup({ text: async () => backup.contents });
  assert.deepEqual(restored, source);
});

void test('adding and removing stations applies to the whole block but protects completed work', () => {
  const { built, set } = fixture();
  const added = addBlockStation(built, built.sessions[0].id);
  const station = added.sessions[0].plannedStations.at(-1)!;
  assert.ok(station.trackingId);
  assert.equal(
    added.sessions[1].plannedStations.at(-1)!.trackingId,
    station.trackingId,
  );
  const removed = removeBlockStation(added, added.sessions[0].id, station.id);
  assert.ok(removed.sessions.every((day) => day.plannedStations.length === 6));
  const second = built.sessions[1];
  const completedStationId = second.rounds[0].assignments[0].stationId;
  const completedTrackingId = second.plannedStations.find(
    (plan) => plan.id === completedStationId,
  )!.trackingId;
  built.sessions[1] = toggleRoundCompleted(
    second,
    second.rounds[0].id,
    set,
    built.students,
  );
  const firstStation = built.sessions[0].plannedStations.find(
    (plan) => plan.trackingId === completedTrackingId,
  )!;
  assert.equal(
    removeBlockStation(built, built.sessions[0].id, firstStation.id),
    built,
  );
});

void test('adopting an existing unblocked day aligns identities with a previous-block template', () => {
  const { built, set } = fixture();
  const existing = blankSession(set, stations(6), 3, 'existing-future-day');
  existing.date = '2026-09-09';
  existing.plannedStations = built.sessions[1].plannedStations.map((plan) => ({
    ...plan,
    trackingId: undefined,
  }));
  built.sessions.push(existing);
  const next = createPlanningBlock(built, built.sessions[1], {
    name: 'Next',
    startDate: '2026-09-09',
    endDate: '2026-09-10',
    roundCount: 3,
  });
  assert.equal(
    next.sessions[2].plannedStations[1].trackingId,
    next.sessions[3].plannedStations[1].trackingId,
  );
});

void test('invalid calendar dates are rejected rather than rolled into another month', () => {
  assert.deepEqual(blockDates('2026-02-30', '2026-03-03'), []);
  assert.deepEqual(blockDates('2026-02-23', '2026-02-30'), []);
  assert.ok(blockDates('2026-09-01', '2026-10-01').length > 0);
});
