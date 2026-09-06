import type {
  Classroom,
  PlannedStation,
  PlanningBlock,
  RotationSession,
} from './model';
import { makeId } from './model';
import { fillOpenSpots } from './rotations';

export type NewBlockPlan = {
  name: string;
  startDate: string;
  endDate: string;
  roundCount: number;
};

export function blockDates(start: string, end: string): string[] {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    end < start
  )
    return [];
  const date = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(last.getTime()) ||
    date.toISOString().slice(0, 10) !== start ||
    last.toISOString().slice(0, 10) !== end
  )
    return [];
  const dates: string[] = [];
  for (let i = 0; i < 31 && Number.isFinite(date.getTime()); i++) {
    const value = date.toISOString().slice(0, 10);
    if (value > end) return dates;
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) dates.push(value);
    if (value === end) return dates;
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return [];
}

export function blockPlanIssue(classroom: Classroom, plan: NewBlockPlan) {
  if (!plan.name.trim()) return 'Give this block a name.';
  if (!blockDates(plan.startDate, plan.endDate).length)
    return 'Choose a block of up to 31 calendar days containing at least one school day.';
  if (
    !Number.isInteger(plan.roundCount) ||
    plan.roundCount < 1 ||
    plan.roundCount > 8
  )
    return 'Choose between 1 and 8 rounds per day.';
  if (
    classroom.planningBlocks?.some(
      (block) =>
        block.startDate <= plan.endDate && block.endDate >= plan.startDate,
    )
  ) {
    return 'These dates already belong to a block. Choose dates after it to start fresh.';
  }
  return '';
}

export function createPlanningBlock(
  classroom: Classroom,
  template: RotationSession,
  plan: NewBlockPlan,
): Classroom {
  if (blockPlanIssue(classroom, plan)) return classroom;
  const block: PlanningBlock = {
    id: makeId('block'),
    name: plan.name.trim(),
    startDate: plan.startDate,
    endDate: plan.endDate,
  };
  const identities = new Map<string, string>();
  const identitiesByName = new Map<string, string>();
  const linkStation = (station: PlannedStation): PlannedStation => {
    // Names are used once when bringing existing days into a block. Subsequent
    // renames and copied days retain a stable identity.
    const name = station.activityName.trim().toLocaleLowerCase();
    const existing = station.trackingId
      ? identities.get(station.trackingId)
      : identitiesByName.get(name);
    const trackingId = existing ?? makeId('activity');
    if (station.trackingId) identities.set(station.trackingId, trackingId);
    if (!identitiesByName.has(name)) identitiesByName.set(name, trackingId);
    return { ...station, trackingId };
  };
  const linkedTemplate = template.plannedStations.map(linkStation);
  const included = classroom.sessions.filter(
    (session) => session.date >= plan.startDate && session.date <= plan.endDate,
  );
  const sessions = classroom.sessions.map((session) =>
    included.includes(session)
      ? {
          ...session,
          blockId: block.id,
          plannedStations: session.plannedStations.map(linkStation),
          ignoredIssueIds: [],
        }
      : session,
  );
  const addedIds = new Set<string>();
  for (const date of blockDates(plan.startDate, plan.endDate)) {
    if (sessions.some((session) => session.date === date)) continue;
    const id = makeId('session');
    addedIds.add(id);
    sessions.push({
      id,
      blockId: block.id,
      date,
      label: date,
      createdAt: new Date().toISOString(),
      groupSetId: template.groupSetId,
      plannedStations: linkedTemplate.map((station) => ({
        ...station,
        id: makeId('station'),
      })),
      rounds: Array.from({ length: plan.roundCount }, () => ({
        id: makeId('round'),
        completed: false,
        assignments: [],
      })),
    });
  }
  let next = {
    ...classroom,
    sessions,
    planningBlocks: [...(classroom.planningBlocks ?? []), block],
  };
  for (const session of sessions
    .filter((item) => addedIds.has(item.id))
    .sort((a, b) => a.date.localeCompare(b.date))) {
    const set = classroom.groupSets.find(
      (item) => item.id === session.groupSetId,
    );
    if (!set) continue;
    const filled = fillOpenSpots(next, session, set);
    next = {
      ...next,
      sessions: next.sessions.map((item) =>
        item.id === session.id ? filled : item,
      ),
    };
  }
  return {
    ...next,
    activeSessionId: next.sessions
      .filter((item) => item.blockId === block.id)
      .sort((a, b) => a.date.localeCompare(b.date))[0].id,
  };
}

export function draftPlanningBlock(
  classroom: Classroom,
  blockId: string,
): Classroom {
  // Clear the entire editable block first, so tomorrow's old draft does not
  // consume today's once-only activities. Completed rounds and locks remain.
  let next = {
    ...classroom,
    sessions: classroom.sessions.map((session) =>
      session.blockId !== blockId
        ? session
        : {
            ...session,
            ignoredIssueIds: [],
            rounds: session.rounds.map((round) =>
              round.completed
                ? round
                : {
                    ...round,
                    assignments: round.assignments.filter(
                      (assignment) => assignment.locked && !assignment.pinned,
                    ),
                  },
            ),
          },
    ),
  };
  const sessions = next.sessions
    .filter((item) => item.blockId === blockId)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const session of sessions) {
    const set = next.groupSets.find((item) => item.id === session.groupSetId);
    if (!set) continue;
    const filled = fillOpenSpots(next, session, set);
    next = {
      ...next,
      sessions: next.sessions.map((item) =>
        item.id === session.id ? filled : item,
      ),
    };
  }
  return next;
}

export function updateBlockStation(
  classroom: Classroom,
  sessionId: string,
  stationId: string,
  patch: Partial<PlannedStation>,
): Classroom {
  const session = classroom.sessions.find((item) => item.id === sessionId);
  const station = session?.plannedStations.find(
    (item) => item.id === stationId,
  );
  if (!session || !station) return classroom;
  return {
    ...classroom,
    sessions: classroom.sessions.map((item) => {
      const shared = Boolean(
        session.blockId &&
        item.blockId === session.blockId &&
        station.trackingId,
      );
      if (item.id !== sessionId && !shared) return item;
      return {
        ...item,
        ignoredIssueIds: [],
        plannedStations: item.plannedStations.map((plan) =>
          (
            shared
              ? plan.trackingId === station.trackingId
              : plan.id === stationId
          )
            ? { ...plan, ...patch, id: plan.id, trackingId: plan.trackingId }
            : plan,
        ),
      };
    }),
  };
}

export function addBlockStation(
  classroom: Classroom,
  sessionId: string,
): Classroom {
  const session = classroom.sessions.find((item) => item.id === sessionId);
  if (!session) return classroom;
  const used = new Set(
    session.plannedStations.map((station) => station.locationId),
  );
  const location =
    classroom.locations.find((item) => !item.archived && !used.has(item.id)) ??
    classroom.locations.find((item) => !item.archived);
  const trackingId = session.blockId ? makeId('activity') : undefined;
  return {
    ...classroom,
    sessions: classroom.sessions.map((item) =>
      item.id === sessionId ||
      (session.blockId && item.blockId === session.blockId)
        ? {
            ...item,
            ignoredIssueIds: [],
            plannedStations: [
              ...item.plannedStations,
              {
                id: makeId('station'),
                trackingId,
                activityName: '',
                locationId: location?.id ?? '',
                iconKey: 'independent',
              },
            ],
          }
        : item,
    ),
  };
}

export function stationHasCompletedWork(
  classroom: Classroom,
  session: RotationSession,
  station: PlannedStation,
) {
  return classroom.sessions.some((day) => {
    if (
      day.id !== session.id &&
      (!session.blockId ||
        day.blockId !== session.blockId ||
        !station.trackingId)
    )
      return false;
    const ids = day.plannedStations
      .filter((plan) =>
        session.blockId && station.trackingId
          ? plan.trackingId === station.trackingId
          : plan.id === station.id,
      )
      .map((plan) => plan.id);
    return day.rounds.some(
      (round) =>
        round.completed &&
        round.assignments.some((item) => ids.includes(item.stationId)),
    );
  });
}

export function removeBlockStation(
  classroom: Classroom,
  sessionId: string,
  stationId: string,
): Classroom {
  const session = classroom.sessions.find((item) => item.id === sessionId);
  const station = session?.plannedStations.find(
    (item) => item.id === stationId,
  );
  if (
    !session ||
    !station ||
    stationHasCompletedWork(classroom, session, station)
  )
    return classroom;
  return {
    ...classroom,
    sessions: classroom.sessions.map((day) => {
      if (
        day.id !== sessionId &&
        (!session.blockId ||
          day.blockId !== session.blockId ||
          !station.trackingId)
      )
        return day;
      const ids = day.plannedStations
        .filter((plan) =>
          session.blockId && station.trackingId
            ? plan.trackingId === station.trackingId
            : plan.id === stationId,
        )
        .map((plan) => plan.id);
      return {
        ...day,
        ignoredIssueIds: [],
        plannedStations: day.plannedStations.filter(
          (plan) => !ids.includes(plan.id),
        ),
        rounds: day.rounds.map((round) =>
          round.completed
            ? round
            : {
                ...round,
                assignments: round.assignments.filter(
                  (item) => !ids.includes(item.stationId),
                ),
              },
        ),
      };
    }),
  };
}
