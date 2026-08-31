import type {
  Classroom,
  GroupSet,
  RotationAssignment,
  RotationRound,
  RotationSession,
  ScheduleIssue,
  Student,
} from './model';
import { makeId } from './model';
import { cloneData } from './platform';

function stationForAssignment(
  session: RotationSession,
  assignment: RotationAssignment,
) {
  return session.plannedStations.find((item) => item.id === assignment.stationId);
}

function activityHistoryKey(name: string) {
  return name.trim().toLocaleLowerCase();
}

function assignmentActivityKey(
  session: RotationSession,
  assignment: RotationAssignment,
  completed: boolean,
) {
  const name = completed && assignment.activityName
    ? assignment.activityName
    : stationForAssignment(session, assignment)?.activityName ?? '';
  return activityHistoryKey(name);
}

function historicalSessions(classroom: Classroom, activeSession: RotationSession) {
  return classroom.sessions
    .filter((session) =>
      session.id !== activeSession.id && session.date <= activeSession.date)
    .sort((left, right) =>
      left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt));
}

function roundContributesToHistory(
  sourceSession: RotationSession,
  round: RotationRound,
  activeSession: RotationSession,
) {
  return round.completed || sourceSession.date < activeSession.date;
}

function visitCounts(classroom: Classroom, activeSession: RotationSession) {
  const counts = new Map<string, number>();
  for (const session of historicalSessions(classroom, activeSession)) {
    for (const round of session.rounds) {
      if (!roundContributesToHistory(session, round, activeSession)) continue;
      for (const assignment of round.assignments) {
        const activityKey = assignmentActivityKey(session, assignment, round.completed);
        if (!activityKey) continue;
        const key = `${assignment.groupId}:${activityKey}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function assignmentStudentIds(
  classroom: Classroom,
  session: RotationSession,
  assignment: RotationAssignment,
  completed: boolean,
) {
  if (completed && assignment.studentIds) return assignment.studentIds;
  const groupSet = classroom.groupSets.find((item) => item.id === session.groupSetId);
  return groupSet?.groups.find((group) => group.id === assignment.groupId)?.studentIds ?? [];
}

function learnerVisitCounts(classroom: Classroom, activeSession: RotationSession) {
  const counts = new Map<string, number>();
  for (const session of historicalSessions(classroom, activeSession)) {
    for (const round of session.rounds) {
      if (!roundContributesToHistory(session, round, activeSession)) continue;
      for (const assignment of round.assignments) {
        const activityKey = assignmentActivityKey(session, assignment, round.completed);
        if (!activityKey) continue;
        for (const studentId of assignmentStudentIds(
          classroom,
          session,
          assignment,
          round.completed,
        )) {
          const key = `${studentId}:${activityKey}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }
  }
  return counts;
}

function sameDayGroupVisitCounts(session: RotationSession) {
  const counts = new Map<string, number>();
  for (const round of session.rounds) {
    for (const assignment of round.assignments) {
      const activityKey = assignmentActivityKey(
        session,
        assignment,
        round.completed,
      );
      if (!activityKey) continue;
      const key = `${assignment.groupId}:${activityKey}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function lastActivitiesForLearners(classroom: Classroom, activeSession: RotationSession) {
  const activities = new Map<string, string>();
  for (const session of historicalSessions(classroom, activeSession)) {
    for (const round of session.rounds) {
      if (!roundContributesToHistory(session, round, activeSession)) continue;
      for (const assignment of round.assignments) {
        const activityKey = assignmentActivityKey(session, assignment, round.completed);
        if (!activityKey) continue;
        for (const studentId of assignmentStudentIds(
          classroom,
          session,
          assignment,
          round.completed,
        )) {
          activities.set(studentId, activityKey);
        }
      }
    }
  }
  return activities;
}

function lastActivityForGroup(
  classroom: Classroom,
  activeSession: RotationSession,
  groupId: string,
) {
  const historical = historicalSessions(classroom, activeSession)
    .flatMap((session) => session.rounds
      .filter((round) => roundContributesToHistory(session, round, activeSession))
      .flatMap((round) => round.assignments.map((assignment) => ({
        assignment,
        activityKey: assignmentActivityKey(session, assignment, round.completed),
      }))))
    .filter(({ assignment, activityKey }) => assignment.groupId === groupId && activityKey);
  return historical.at(-1)?.activityKey;
}

function fillRound(
  classroom: Classroom,
  session: RotationSession,
  groupSet: GroupSet,
  round: RotationRound,
) {
  const activePlans = session.plannedStations.filter(
    (plan) => plan.activityName.trim() &&
      classroom.locations.some((location) => location.id === plan.locationId),
  );
  const activePlanIds = activePlans.map((plan) => plan.id);
  const groupIds = groupSet.groups.map((group) => group.id);
  const validExisting = round.assignments.filter(
    (assignment) =>
      groupIds.includes(assignment.groupId) &&
      activePlanIds.includes(assignment.stationId),
  );
  const usedGroups = new Set(validExisting.map((assignment) => assignment.groupId));
  const usedActivities = new Set(validExisting.map((assignment) => assignment.stationId));
  const availableActivities = activePlanIds.filter((id) => !usedActivities.has(id));
  const missingGroups = groupIds.filter((id) => !usedGroups.has(id));
  const sameDayCounts = sameDayGroupVisitCounts(session);
  const groupCounts = visitCounts(classroom, session);
  const learnerCounts = learnerVisitCounts(classroom, session);
  const lastLearnerActivities = lastActivitiesForLearners(classroom, session);
  const learnerIdsByGroup = new Map(
    groupSet.groups.map((group) => [group.id, group.studentIds]),
  );
  const assignments = [...validExisting];
  const groupsToPlace = missingGroups.slice(0, availableActivities.length);
  const activityOrder = new Map(activePlanIds.map((id, index) => [id, index]));
  let bestSameDayRepeats = Number.POSITIVE_INFINITY;
  let bestHistoryScore = Number.POSITIVE_INFINITY;
  let best: RotationAssignment[] = [];

  const search = (
    groupIndex: number,
    activitiesLeft: string[],
    chosen: RotationAssignment[],
    sameDayRepeats: number,
    historyScore: number,
  ) => {
    if (
      sameDayRepeats > bestSameDayRepeats ||
      (sameDayRepeats === bestSameDayRepeats && historyScore >= bestHistoryScore)
    ) return;
    if (groupIndex >= groupsToPlace.length) {
      bestSameDayRepeats = sameDayRepeats;
      bestHistoryScore = historyScore;
      best = chosen;
      return;
    }
    const groupId = groupsToPlace[groupIndex];
    const previous = lastActivityForGroup(classroom, session, groupId);
    const learnerIds = learnerIdsByGroup.get(groupId) ?? [];
    const ranked = activitiesLeft
      .map((id) => {
        const plan = activePlans.find((item) => item.id === id)!;
        const activityKey = activityHistoryKey(plan.activityName);
        return {
        id,
        activityKey,
        sameDayRepeats: sameDayCounts.get(`${groupId}:${activityKey}`) ?? 0,
        historyScore: (
          learnerIds.length > 0
            ? learnerIds.reduce(
                (total, studentId) =>
                  total +
                  (learnerCounts.get(`${studentId}:${activityKey}`) ?? 0) * 100 +
                  (lastLearnerActivities.get(studentId) === activityKey ? 20 : 0),
                0,
              )
            : (groupCounts.get(`${groupId}:${activityKey}`) ?? 0) * 100 +
              (activityKey === previous ? 20 : 0)
        ) + (activityOrder.get(id) ?? 0) * 0.001,
      };})
      .sort(
        (left, right) =>
          left.sameDayRepeats - right.sameDayRepeats ||
          left.historyScore - right.historyScore ||
          left.id.localeCompare(right.id),
      );
    for (const candidate of ranked) {
      search(
        groupIndex + 1,
        activitiesLeft.filter((id) => id !== candidate.id),
        [...chosen, { groupId, stationId: candidate.id, locked: false }],
        sameDayRepeats + candidate.sameDayRepeats,
        historyScore + candidate.historyScore,
      );
    }
  };

  search(0, availableActivities, [], 0, 0);
  assignments.push(...best);
  return { ...round, assignments };
}

export function fillOpenSpots(
  classroom: Classroom,
  session: RotationSession,
  groupSet: GroupSet,
): RotationSession {
  const working = cloneData(session);
  for (let index = 0; index < working.rounds.length; index += 1) {
    const round = working.rounds[index];
    if (round.completed) continue;
    const workingClassroom = {
      ...classroom,
      sessions: classroom.sessions.map((item) => item.id === working.id ? working : item),
    };
    working.rounds[index] = fillRound(
      workingClassroom,
      working,
      groupSet,
      round,
    );
  }
  return working;
}

export function addFilledRound(
  classroom: Classroom,
  session: RotationSession,
  groupSet: GroupSet,
): RotationSession {
  const next: RotationSession = {
    ...session,
    rounds: [
      ...session.rounds,
      { id: makeId('round'), assignments: [], completed: false },
    ],
  };
  const lastIndex = next.rounds.length - 1;
  next.rounds[lastIndex] = fillRound(
    { ...classroom, sessions: classroom.sessions.map((item) => item.id === session.id ? next : item) },
    next,
    groupSet,
    next.rounds[lastIndex],
  );
  return next;
}

export function removeRound(
  session: RotationSession,
  roundId: string,
): RotationSession {
  const round = session.rounds.find((item) => item.id === roundId);
  if (!round || round.completed) return session;
  return {
    ...session,
    rounds: session.rounds.filter((item) => item.id !== roundId),
  };
}

export function rebuildUnlocked(
  classroom: Classroom,
  session: RotationSession,
  groupSet: GroupSet,
): RotationSession {
  const cleared = {
    ...session,
    rounds: session.rounds.map((round) =>
      round.completed
        ? round
        : { ...round, assignments: round.assignments.filter((assignment) => assignment.locked) },
    ),
  };
  return fillOpenSpots(classroom, cleared, groupSet);
}

export function unlockAllAssignments(session: RotationSession): RotationSession {
  let changed = false;
  const rounds = session.rounds.map((round) => {
    if (round.completed) return round;
    const assignments = round.assignments.map((assignment) => {
      if (!assignment.locked) return assignment;
      changed = true;
      return { ...assignment, locked: false };
    });
    return assignments.some((assignment, index) => assignment !== round.assignments[index])
      ? { ...round, assignments }
      : round;
  });
  return changed ? { ...session, rounds } : session;
}

export function moveGroupToStation(
  session: RotationSession,
  roundId: string,
  groupId: string,
  stationId: string,
): { session: RotationSession; issue?: string } {
  const round = session.rounds.find((item) => item.id === roundId);
  if (!round || round.completed) return { session };
  const moving = round.assignments.find((assignment) => assignment.groupId === groupId);
  const displaced = round.assignments.find((assignment) => assignment.stationId === stationId);
  if (displaced?.locked && displaced.groupId !== groupId) {
    return {
      session,
      issue: 'That placement is locked. Unlock it or move that group directly.',
    };
  }
  const oldActivity = moving?.stationId;
  const assignments = round.assignments
    .filter((assignment) => assignment.groupId !== groupId && assignment.groupId !== displaced?.groupId)
    .concat({ groupId, stationId, locked: true } as RotationAssignment);
  if (displaced && displaced.groupId !== groupId && oldActivity) {
    assignments.push({ ...displaced, stationId: oldActivity, locked: false });
  }
  return {
    session: {
      ...session,
      rounds: session.rounds.map((item) =>
        item.id === roundId ? { ...item, assignments } : item,
      ),
    },
  };
}

export function moveStationToGroup(
  session: RotationSession,
  roundId: string,
  groupId: string,
  stationId: string,
): { session: RotationSession; issue?: string } {
  const round = session.rounds.find((item) => item.id === roundId);
  if (!round || round.completed) return { session };
  const target = round.assignments.find((assignment) => assignment.groupId === groupId);
  const source = round.assignments.find((assignment) => assignment.stationId === stationId);
  if (target?.locked && source?.groupId !== groupId) {
    return {
      session,
      issue: 'That placement is locked. Unlock it or move that assignment directly.',
    };
  }
  const oldActivity = target?.stationId;
  const assignments = round.assignments
    .filter((assignment) => assignment.groupId !== groupId && assignment.groupId !== source?.groupId)
    .concat({ groupId, stationId, locked: true } as RotationAssignment);
  if (source && source.groupId !== groupId && oldActivity) {
    assignments.push({ ...source, stationId: oldActivity, locked: false });
  }
  return {
    session: {
      ...session,
      rounds: session.rounds.map((item) =>
        item.id === roundId ? { ...item, assignments } : item,
      ),
    },
  };
}

export function toggleAssignmentLock(
  session: RotationSession,
  roundId: string,
  groupId: string,
): RotationSession {
  return {
    ...session,
    rounds: session.rounds.map((round) =>
      round.id === roundId
        ? {
            ...round,
            assignments: round.assignments.map((assignment) =>
              assignment.groupId === groupId
                ? { ...assignment, locked: !assignment.locked }
                : assignment,
            ),
          }
        : round,
    ),
  };
}

export function toggleRoundCompleted(
  session: RotationSession,
  roundId: string,
  groupSet: GroupSet,
  students: Student[],
): RotationSession {
  const presentStudentIds = new Set(
    students.filter((student) => !student.absent).map((student) => student.id),
  );
  return {
    ...session,
    rounds: session.rounds.map((round) => {
      if (round.id !== roundId) return round;
      const completing = !round.completed;
      return {
        ...round,
        completed: completing,
        assignments: round.assignments.map((assignment) => {
          if (!completing) {
            const reopened = { ...assignment };
            delete reopened.studentIds;
            delete reopened.activityName;
            delete reopened.locationId;
            return reopened;
          }
          const group = groupSet.groups.find((item) => item.id === assignment.groupId);
          const station = session.plannedStations.find(
            (item) => item.id === assignment.stationId,
          );
          return {
            ...assignment,
            studentIds: group?.studentIds.filter((id) => presentStudentIds.has(id)) ?? [],
            activityName: station?.activityName ?? '',
            locationId: station?.locationId,
          };
        }),
      };
    }),
  };
}

export function scheduleIssues(
  classroom: Classroom,
  session: RotationSession,
  groupSet: GroupSet,
): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  const knownGroupIds = new Set(groupSet.groups.map((group) => group.id));
  const knownLocationIds = new Set(classroom.locations.map((location) => location.id));
  const validPlans = session.plannedStations.filter(
    (plan) => plan.activityName.trim() && knownLocationIds.has(plan.locationId),
  );
  const validPlanIds = new Set(validPlans.map((plan) => plan.id));
  if (validPlans.length < groupSet.groups.length) {
    issues.push({
      id: 'station-capacity',
      severity: 'attention',
      message: `${groupSet.groups.length} groups need places, but only ${validPlans.length} activities have locations.`,
    });
  }
  const missingLocationCount = session.plannedStations.filter(
    (plan) => !knownLocationIds.has(plan.locationId),
  ).length;
  if (missingLocationCount > 0) {
    issues.push({
      id: 'missing-locations',
      severity: 'attention',
      message: `${missingLocationCount} ${missingLocationCount === 1 ? 'activity needs' : 'activities need'} a location.`,
    });
  }
  const usedLocationIds = session.plannedStations
    .map((plan) => plan.locationId)
    .filter((locationId) => knownLocationIds.has(locationId));
  const duplicateLocationId = usedLocationIds.find(
    (locationId, index) => usedLocationIds.indexOf(locationId) !== index,
  );
  if (duplicateLocationId) {
    const location = classroom.locations.find((item) => item.id === duplicateLocationId);
    issues.push({
      id: `duplicate-location-${duplicateLocationId}`,
      severity: 'attention',
      message: `${location?.name ?? 'A location'} is assigned to more than one activity at the same time.`,
    });
  }
  const activityKeys = session.plannedStations
    .map((station) => activityHistoryKey(station.activityName))
    .filter(Boolean);
  const duplicateActivityKey = activityKeys.find(
    (activityKey, index) => activityKeys.indexOf(activityKey) !== index,
  );
  if (duplicateActivityKey) {
    const station = session.plannedStations.find(
      (item) => activityHistoryKey(item.activityName) === duplicateActivityKey,
    );
    issues.push({
      id: `duplicate-activity-${duplicateActivityKey}`,
      severity: 'attention',
      message: `${station?.activityName ?? 'An activity'} is used for more than one station. Use a distinct name if they should count separately.`,
    });
  }
  for (const [index, round] of session.rounds.entries()) {
    const assignedKnownGroupIds = new Set(
      round.assignments
        .map((assignment) => assignment.groupId)
        .filter((groupId) => knownGroupIds.has(groupId)),
    );
    const missing = groupSet.groups.length - assignedKnownGroupIds.size;
    if (missing > 0) {
      issues.push({
        id: `missing-${round.id}`,
        severity: 'attention',
        roundId: round.id,
        message: `${missing} ${missing === 1 ? 'group has' : 'groups have'} no station in Round ${index + 1}.`,
      });
    }
    const groupIds = round.assignments.map((assignment) => assignment.groupId);
    if (new Set(groupIds).size !== groupIds.length) {
      issues.push({
        id: `duplicate-${round.id}`,
        severity: 'attention',
        roundId: round.id,
        message: `A group is assigned twice in Round ${index + 1}.`,
      });
    }
    const stationIds = round.assignments.map((assignment) => assignment.stationId);
    if (new Set(stationIds).size !== stationIds.length) {
      issues.push({
        id: `duplicate-station-${round.id}`,
        severity: 'attention',
        roundId: round.id,
        message: `Two groups are assigned to the same activity in Round ${index + 1}.`,
      });
    }
    if (round.assignments.some((assignment) => !knownGroupIds.has(assignment.groupId))) {
      issues.push({
        id: `unknown-group-${round.id}`,
        severity: 'attention',
        roundId: round.id,
        message: `Round ${index + 1} includes a group that no longer exists.`,
      });
    }
    if (round.assignments.some(
      (assignment) => !validPlanIds.has(assignment.stationId),
    )) {
      issues.push({
        id: `inactive-station-${round.id}`,
        severity: 'attention',
        roundId: round.id,
        message: `Round ${index + 1} includes an activity that is not planned today.`,
      });
    }
  }

  for (const group of groupSet.groups) {
    const activityRounds = new Map<string, { name: string; roundIds: string[] }>();
    session.rounds.forEach((round) => {
      const assignment = round.assignments.find((item) => item.groupId === group.id);
      if (assignment) {
        const activityKey = assignmentActivityKey(session, assignment, round.completed);
        const station = stationForAssignment(session, assignment);
        if (!activityKey) return;
        const previous = activityRounds.get(activityKey);
        activityRounds.set(activityKey, {
          name: previous?.name ?? station?.activityName ?? assignment.activityName ?? 'An activity',
          roundIds: [...(previous?.roundIds ?? []), round.id],
        });
      }
    });
    for (const [activityKey, { name, roundIds }] of activityRounds) {
      if (roundIds.length < 2) continue;
      const roundNumbers = roundIds.map(
        (roundId) => session.rounds.findIndex((round) => round.id === roundId) + 1,
      );
      issues.push({
        id: `repeat-${group.id}-${activityKey}`,
        severity: 'notice',
        message: `${group.name} repeats ${name} in Rounds ${roundNumbers.join(', ')}.`,
        roundIds,
        groupId: group.id,
      });
    }
  }
  return issues;
}
