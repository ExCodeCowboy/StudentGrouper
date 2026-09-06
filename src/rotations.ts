import type {
  Classroom,
  GroupSet,
  PlannedStation,
  RotationAssignment,
  RotationRound,
  RotationSession,
  ScheduleIssue,
  Student,
} from './model';
import { makeId } from './model';
import { cloneData } from './platform';
import { minimumCostAssignment } from './assignment';

function stationForAssignment(
  session: RotationSession,
  assignment: RotationAssignment,
) {
  return session.plannedStations.find(
    (item) => item.id === assignment.stationId,
  );
}

function activityHistoryKey(name: string) {
  return name.trim().toLocaleLowerCase();
}

export function assignmentActivityKey(
  session: RotationSession,
  assignment: RotationAssignment,
  completed: boolean,
) {
  if (session.blockId) {
    const trackingId =
      assignment.trackingId ??
      stationForAssignment(session, assignment)?.trackingId;
    if (trackingId) return trackingId;
  }
  const name =
    completed && assignment.activityName
      ? assignment.activityName
      : (stationForAssignment(session, assignment)?.activityName ?? '');
  return activityHistoryKey(name);
}

function historicalSessions(
  classroom: Classroom,
  activeSession: RotationSession,
) {
  return classroom.sessions
    .filter(
      (session) =>
        session.id !== activeSession.id &&
        session.date <= activeSession.date &&
        session.blockId === activeSession.blockId,
    )
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.createdAt.localeCompare(right.createdAt),
    );
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
  }
  return counts;
}

export function assignmentStudentIds(
  classroom: Classroom,
  session: RotationSession,
  assignment: RotationAssignment,
  _completed: boolean,
) {
  if (assignment.studentIds) return assignment.studentIds;
  const groupSet = classroom.groupSets.find(
    (item) => item.id === session.groupSetId,
  );
  return (
    groupSet?.groups.find((group) => group.id === assignment.groupId)
      ?.studentIds ?? []
  );
}

export function stationCapacity(
  station: PlannedStation,
  groupCount = Number.MAX_SAFE_INTEGER,
) {
  return Math.min(
    groupCount,
    Math.max(1, Math.floor(station.groupCapacity ?? 1)),
  );
}

export function planKey(session: RotationSession, station: PlannedStation) {
  return session.blockId && station.trackingId
    ? station.trackingId
    : activityHistoryKey(station.activityName);
}

// Freeze planned membership before a saved arrangement can be changed. Completion
// replaces it with the learners who were actually present.
export function snapshotPlannedHistory(classroom: Classroom): Classroom {
  return {
    ...classroom,
    sessions: classroom.sessions.map((session) => ({
      ...session,
      rounds: session.rounds.map((round) => ({
        ...round,
        assignments: round.assignments.map((assignment) => ({
          ...assignment,
          studentIds: assignment.studentIds ?? [
            ...assignmentStudentIds(
              classroom,
              session,
              assignment,
              round.completed,
            ),
          ],
        })),
      })),
    })),
  };
}

function blockActivityVisits(
  classroom: Classroom,
  session: RotationSession,
  beforeRoundIndex?: number,
) {
  const visits = new Map<
    string,
    { learners: Set<string>; groups: Set<string> }
  >();
  const sessions = [
    ...classroom.sessions.filter((saved) => saved.id !== session.id),
    session,
  ];
  for (const day of sessions) {
    if (
      session.blockId ? day.blockId !== session.blockId : day.id !== session.id
    )
      continue;
    if (beforeRoundIndex !== undefined && day.date > session.date) continue;
    const rounds =
      day.id === session.id && beforeRoundIndex !== undefined
        ? day.rounds.slice(0, beforeRoundIndex)
        : day.rounds;
    for (const round of rounds) {
      for (const assignment of round.assignments) {
        const key = assignmentActivityKey(day, assignment, round.completed);
        const entry = visits.get(key) ?? {
          learners: new Set<string>(),
          groups: new Set<string>(),
        };
        entry.groups.add(assignment.groupId);
        for (const id of assignmentStudentIds(
          classroom,
          day,
          assignment,
          round.completed,
        ))
          entry.learners.add(id);
        visits.set(key, entry);
      }
    }
  }
  return visits;
}

function hasBlockVisit(
  classroom: Classroom,
  session: RotationSession,
  groupSet: GroupSet,
  groupId: string,
  activityKey: string,
  visits = blockActivityVisits(classroom, session),
) {
  const learners =
    groupSet.groups.find((group) => group.id === groupId)?.studentIds ?? [];
  const entry = visits.get(activityKey);
  return Boolean(
    entry &&
    (learners.length > 0
      ? learners.some((id) => entry.learners.has(id))
      : entry.groups.has(groupId)),
  );
}

function learnerVisitCounts(
  classroom: Classroom,
  activeSession: RotationSession,
) {
  const counts = new Map<string, number>();
  for (const session of historicalSessions(classroom, activeSession)) {
    for (const round of session.rounds) {
      if (!roundContributesToHistory(session, round, activeSession)) continue;
      for (const assignment of round.assignments) {
        const activityKey = assignmentActivityKey(
          session,
          assignment,
          round.completed,
        );
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

function lastActivitiesForLearners(
  classroom: Classroom,
  activeSession: RotationSession,
) {
  const activities = new Map<string, string>();
  for (const session of historicalSessions(classroom, activeSession)) {
    for (const round of session.rounds) {
      if (!roundContributesToHistory(session, round, activeSession)) continue;
      for (const assignment of round.assignments) {
        const activityKey = assignmentActivityKey(
          session,
          assignment,
          round.completed,
        );
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
    .flatMap((session) =>
      session.rounds
        .filter((round) =>
          roundContributesToHistory(session, round, activeSession),
        )
        .flatMap((round) =>
          round.assignments.map((assignment) => ({
            assignment,
            activityKey: assignmentActivityKey(
              session,
              assignment,
              round.completed,
            ),
          })),
        ),
    )
    .filter(
      ({ assignment, activityKey }) =>
        assignment.groupId === groupId && activityKey,
    );
  return historical.at(-1)?.activityKey;
}

function fillRound(
  classroom: Classroom,
  session: RotationSession,
  groupSet: GroupSet,
  round: RotationRound,
) {
  const activePlans = session.plannedStations.filter(
    (plan) =>
      plan.activityName.trim() &&
      classroom.locations.some((location) => location.id === plan.locationId),
  );
  const activePlanIds = activePlans.map((plan) => plan.id);
  const groupIds = groupSet.groups.map((group) => group.id);
  const validExisting = round.assignments.filter(
    (assignment) =>
      groupIds.includes(assignment.groupId) &&
      activePlanIds.includes(assignment.stationId),
  );
  const usedGroups = new Set(
    validExisting.map((assignment) => assignment.groupId),
  );
  const availableCapacity = activePlans.map((plan) =>
    Math.max(
      0,
      stationCapacity(plan, groupIds.length) -
        validExisting.filter((item) => item.stationId === plan.id).length,
    ),
  );
  const missingGroups = groupIds.filter((id) => !usedGroups.has(id));
  const sameDayCounts = sameDayGroupVisitCounts(session);
  // Future bookings reserve once-only activities, but only earlier rounds
  // count as visits when preferring a new station over a repeat.
  const blockVisits = blockActivityVisits(classroom, session);
  const earlierVisits = blockActivityVisits(
    classroom,
    session,
    session.rounds.findIndex((item) => item.id === round.id),
  );
  const groupCounts = visitCounts(classroom, session);
  const learnerCounts = learnerVisitCounts(classroom, session);
  const lastLearnerActivities = lastActivitiesForLearners(classroom, session);
  const learnerIdsByGroup = new Map(
    groupSet.groups.map((group) => [group.id, group.studentIds]),
  );
  const candidates = missingGroups.map((groupId) => {
    const previous = lastActivityForGroup(classroom, session, groupId);
    const learnerIds = learnerIdsByGroup.get(groupId) ?? [];
    return activePlans.map((plan, index) => {
      const activityKey = planKey(session, plan);
      const today = sameDayCounts.get(`${groupId}:${activityKey}`) ?? 0;
      const visitedInBlock = hasBlockVisit(
        classroom,
        session,
        groupSet,
        groupId,
        activityKey,
        blockVisits,
      );
      const earlier = earlierVisits.get(activityKey);
      const firstVisitCount =
        learnerIds.length > 0
          ? learnerIds.filter((id) => !earlier?.learners.has(id)).length
          : earlier?.groups.has(groupId)
            ? 0
            : 1;
      const dailyRequired =
        plan.visitRule === 'daily' &&
        (plan.dailyGroupIds === undefined ||
          plan.dailyGroupIds.includes(groupId));
      const dailyPinned = plan.dailyPinGroupIds?.includes(groupId) ?? false;
      return {
        index,
        allowed:
          !(plan.visitRule === 'once-per-block' && visitedInBlock) &&
          !((plan.visitRule === 'daily' || dailyPinned) && today > 0),
        score: [
          // One additional pin outweighs every possible gap in this round.
          // The whole-day/block search can then improve which round it uses.
          dailyPinned && today === 0 ? -(missingGroups.length + 1) : 0,
          dailyRequired && today === 0 ? -1 : 0,
          // First visits at ANY eligible station outrank repeats. Count each
          // learner: one prior visitor does not mean the whole group is done.
          session.blockId && firstVisitCount > 0 ? -1 : 0,
          session.blockId ? -firstVisitCount : 0,
          // Among equally useful first visits, favor the limited activities.
          plan.visitRule === 'once-per-block' && !visitedInBlock ? -1 : 0,
          // May repeat permits another visit; it should not make that repeat
          // preferable to an available station the group has not done today.
          today,
          (learnerIds.length > 0
            ? learnerIds.reduce(
                (total, studentId) =>
                  total +
                  (learnerCounts.get(`${studentId}:${activityKey}`) ?? 0) *
                    100 +
                  (lastLearnerActivities.get(studentId) === activityKey
                    ? 20
                    : 0),
                0,
              )
            : (groupCounts.get(`${groupId}:${activityKey}`) ?? 0) * 100 +
              (activityKey === previous ? 20 : 0)) +
            today * 100 +
            index * 0.001,
        ],
      };
    });
  });
  const chosen = minimumCostAssignment(
    candidates.map((row) =>
      row.map((candidate) =>
        candidate.allowed
          ? candidate.score.map((value, index) =>
              index === candidate.score.length - 1
                ? Math.round(value * 1000)
                : value,
            )
          : null,
      ),
    ),
    availableCapacity,
  );
  return {
    ...round,
    assignments: [
      ...validExisting,
      ...chosen.flatMap((stationIndex, groupIndex) =>
        stationIndex === undefined
          ? []
          : [
              {
                groupId: missingGroups[groupIndex],
                stationId: activePlans[stationIndex].id,
                locked: false,
              },
            ],
      ),
    ],
  };
}

export function fillOpenSpots(
  classroom: Classroom,
  session: RotationSession,
  groupSet: GroupSet,
): RotationSession {
  const working = cloneData(session);
  clearDailyPinPlacements(working);
  for (let index = 0; index < working.rounds.length; index += 1) {
    const round = working.rounds[index];
    if (round.completed) continue;
    const workingClassroom = {
      ...classroom,
      sessions: classroom.sessions.map((item) =>
        item.id === working.id ? working : item,
      ),
    };
    working.rounds[index] = fillRound(
      workingClassroom,
      working,
      groupSet,
      round,
    );
  }
  markDailyPinPlacements(working);
  return working;
}

export function clearDailyPinPlacements(session: RotationSession) {
  for (const round of session.rounds) {
    if (!round.completed)
      round.assignments = round.assignments.filter(
        (assignment) => !assignment.pinned,
      );
  }
}

// Generated pins protect a daily visit in the editor. Rebuilding releases their
// rounds so the planner can choose again; completed work and manual locks stay.
export function markDailyPinPlacements(session: RotationSession) {
  for (const round of session.rounds) {
    if (round.completed) continue;
    round.assignments = round.assignments.map((assignment) =>
      !assignment.locked && session.plannedStations.some((station) =>
        station.id === assignment.stationId && station.dailyPinGroupIds?.includes(assignment.groupId))
        ? { ...assignment, locked: true, pinned: true }
        : assignment,
    );
  }
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
    {
      ...classroom,
      sessions: classroom.sessions.map((item) =>
        item.id === session.id ? next : item,
      ),
    },
    next,
    groupSet,
    next.rounds[lastIndex],
  );
  // Only the new round is editable here; preserve earlier assignments exactly.
  const added = { ...next, rounds: [next.rounds[lastIndex]] };
  markDailyPinPlacements(added);
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
        : {
            ...round,
            assignments: round.assignments.filter(
              (assignment) => assignment.locked,
            ),
          },
    ),
  };
  return fillOpenSpots(classroom, cleared, groupSet);
}

export function unlockAllAssignments(
  session: RotationSession,
): RotationSession {
  let changed = false;
  const rounds = session.rounds.map((round) => {
    if (round.completed) return round;
    const assignments = round.assignments.map((assignment) => {
      if (!assignment.locked || assignment.pinned) return assignment;
      changed = true;
      return { ...assignment, locked: false };
    });
    return assignments.some(
      (assignment, index) => assignment !== round.assignments[index],
    )
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
  const moving = round.assignments.find(
    (assignment) => assignment.groupId === groupId,
  );
  if (moving?.pinned && moving.stationId !== stationId)
    return {
      session,
      issue: 'Change the daily pin in Stations before moving this group.',
    };
  const station = session.plannedStations.find((item) => item.id === stationId);
  if (!station) return { session };
  const occupants = round.assignments.filter(
    (assignment) =>
      assignment.stationId === stationId && assignment.groupId !== groupId,
  );
  const displaced =
    occupants.length >= stationCapacity(station)
      ? (occupants.find((assignment) => !assignment.locked) ?? occupants[0])
      : undefined;
  if (displaced?.locked && displaced.groupId !== groupId) {
    return {
      session,
      issue: 'That placement is locked. Unlock it or move that group directly.',
    };
  }
  const oldActivity = moving?.stationId;
  if (displaced && !oldActivity)
    return {
      session,
      issue:
        'That station is full. Move a group out first or allow more groups at this station.',
    };
  const assignments = round.assignments
    .filter(
      (assignment) =>
        assignment.groupId !== groupId &&
        assignment.groupId !== displaced?.groupId,
    )
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
  const target = round.assignments.find(
    (assignment) => assignment.groupId === groupId,
  );
  const station = session.plannedStations.find((item) => item.id === stationId);
  if (!station) return { session };
  const occupants = round.assignments.filter(
    (assignment) =>
      assignment.stationId === stationId && assignment.groupId !== groupId,
  );
  const source =
    occupants.length >= stationCapacity(station)
      ? (occupants.find((assignment) => !assignment.locked) ?? occupants[0])
      : undefined;
  if (source?.pinned || (stationCapacity(station) > 1 && source?.locked))
    return {
      session,
      issue:
        'That station is full and its placements are locked. Unlock a placement or change its daily pin first.',
    };
  if (target?.locked && target.stationId !== stationId) {
    return {
      session,
      issue:
        'That placement is locked. Unlock it or move that assignment directly.',
    };
  }
  const oldActivity = target?.stationId;
  const assignments = round.assignments
    .filter(
      (assignment) =>
        assignment.groupId !== groupId &&
        assignment.groupId !== source?.groupId,
    )
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
      round.id === roundId && !round.completed
        ? {
            ...round,
            assignments: round.assignments.map((assignment) =>
              assignment.groupId === groupId && !assignment.pinned
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
            delete reopened.trackingId;
            return reopened;
          }
          const group = groupSet.groups.find(
            (item) => item.id === assignment.groupId,
          );
          const station = session.plannedStations.find(
            (item) => item.id === assignment.stationId,
          );
          return {
            ...assignment,
            studentIds:
              group?.studentIds.filter((id) => presentStudentIds.has(id)) ?? [],
            activityName: station?.activityName ?? '',
            locationId: station?.locationId,
            trackingId: station?.trackingId,
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
  const knownLocationIds = new Set(
    classroom.locations.map((location) => location.id),
  );
  const validPlans = session.plannedStations.filter(
    (plan) => plan.activityName.trim() && knownLocationIds.has(plan.locationId),
  );
  const validPlanIds = new Set(validPlans.map((plan) => plan.id));
  for (const station of session.plannedStations.filter(
    (plan) => !plan.activityName.trim(),
  )) {
    const location = classroom.locations.find(
      (item) => item.id === station.locationId,
    );
    issues.push({
      id: `unnamed-station-${station.id}`,
      severity: 'attention',
      stationId: station.id,
      message: `The station${location ? ` at ${location.name}` : ''} needs an activity name before it can be scheduled.`,
    });
  }
  const capacity = validPlans.reduce(
    (total, plan) => total + stationCapacity(plan, groupSet.groups.length),
    0,
  );
  if (capacity < groupSet.groups.length) {
    issues.push({
      id: 'station-capacity',
      severity: 'attention',
      message: `${groupSet.groups.length} groups need places, but these stations have room for only ${capacity} groups.`,
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
    const location = classroom.locations.find(
      (item) => item.id === duplicateLocationId,
    );
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
    const stationIds = round.assignments.map(
      (assignment) => assignment.stationId,
    );
    if (
      validPlans.some(
        (plan) =>
          stationIds.filter((id) => id === plan.id).length >
          stationCapacity(plan, groupSet.groups.length),
      )
    ) {
      issues.push({
        id: `duplicate-station-${round.id}`,
        severity: 'attention',
        roundId: round.id,
        message: `A station has more groups than it allows in Round ${index + 1}.`,
      });
    }
    if (
      round.assignments.some(
        (assignment) => !knownGroupIds.has(assignment.groupId),
      )
    ) {
      issues.push({
        id: `unknown-group-${round.id}`,
        severity: 'attention',
        roundId: round.id,
        message: `Round ${index + 1} includes a group that no longer exists.`,
      });
    }
    if (
      round.assignments.some(
        (assignment) => !validPlanIds.has(assignment.stationId),
      )
    ) {
      issues.push({
        id: `inactive-station-${round.id}`,
        severity: 'attention',
        roundId: round.id,
        message: `Round ${index + 1} includes an activity that is not planned today.`,
      });
    }
  }

  for (const group of groupSet.groups) {
    const activityRounds = new Map<
      string,
      { name: string; roundIds: string[] }
    >();
    session.rounds.forEach((round) => {
      const assignment = round.assignments.find(
        (item) => item.groupId === group.id,
      );
      if (assignment) {
        const activityKey = assignmentActivityKey(
          session,
          assignment,
          round.completed,
        );
        const station = stationForAssignment(session, assignment);
        if (!activityKey) return;
        const previous = activityRounds.get(activityKey);
        activityRounds.set(activityKey, {
          name:
            previous?.name ??
            station?.activityName ??
            assignment.activityName ??
            'An activity',
          roundIds: [...(previous?.roundIds ?? []), round.id],
        });
      }
    });
    for (const [activityKey, { name, roundIds }] of activityRounds) {
      if (
        session.plannedStations.find(
          (plan) => planKey(session, plan) === activityKey,
        )?.visitRule === 'repeatable'
      )
        continue;
      if (roundIds.length < 2) continue;
      const roundNumbers = roundIds.map(
        (roundId) =>
          session.rounds.findIndex((round) => round.id === roundId) + 1,
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
  for (const station of validPlans) {
    const key = planKey(session, station);
    for (const groupId of new Set(station.dailyPinGroupIds ?? [])) {
      const group = groupSet.groups.find((item) => item.id === groupId);
      if (
        !group ||
        !session.rounds.some((round) => round.assignments.some(
          (item) => item.groupId === groupId && assignmentActivityKey(session, item, round.completed) === key,
        ))
      ) {
        issues.push({
          id: `pin-${station.id}-${groupId}`,
          severity: 'attention',
          stationId: station.id,
          groupId,
          message: group
            ? `${group.name} needs one pinned visit to ${station.activityName} today. Build / Optimize to choose a round. If it cannot fit, check locks, station capacity, visit rules, and the number of rounds.`
            : `The daily pin for ${station.activityName} uses a group from another arrangement. Choose a group for this day.`,
        });
      }
    }
    for (const group of groupSet.groups) {
      const assignedRounds = session.rounds.filter((round) =>
        round.assignments.some(
          (item) =>
            item.groupId === group.id &&
            assignmentActivityKey(session, item, round.completed) === key,
        ),
      );
      if (station.dailyPinGroupIds?.includes(group.id) && assignedRounds.length > 1) {
        issues.push({
          id: `pin-repeat-${station.id}-${group.id}`, severity: 'attention',
          stationId: station.id, groupId: group.id, roundIds: assignedRounds.map((round) => round.id),
          message: `${group.name} has more than one visit to ${station.activityName} today. The daily pin asks for one; manual and completed placements are being kept.`,
        });
      }
      if (
        station.visitRule === 'daily' &&
        (station.dailyGroupIds === undefined ||
          station.dailyGroupIds.includes(group.id)) &&
        !station.dailyPinGroupIds?.includes(group.id) &&
        assignedRounds.length === 0
      ) {
        issues.push({
          id: `daily-${station.id}-${group.id}`,
          severity: 'attention',
          stationId: station.id,
          groupId: group.id,
          message: `${group.name} still needs ${station.activityName} today. Check the available rounds and locked placements.`,
        });
      }
      if (station.visitRule !== 'once-per-block' || assignedRounds.length === 0)
        continue;
      const withoutGroup: RotationSession = {
        ...session,
        rounds: session.rounds.map((round) => ({
          ...round,
          assignments: round.assignments.filter(
            (assignment) => assignment.groupId !== group.id,
          ),
        })),
      };
      if (
        assignedRounds.length > 1 ||
        hasBlockVisit(classroom, withoutGroup, groupSet, group.id, key)
      ) {
        issues.push({
          id: `block-repeat-${station.id}-${group.id}`,
          severity: 'attention',
          stationId: station.id,
          groupId: group.id,
          roundIds: assignedRounds.map((round) => round.id),
          message: `${group.name} includes learners assigned to ${station.activityName} more than once in this block. A manual or completed placement is being kept.`,
        });
      }
    }
  }
  return issues;
}
