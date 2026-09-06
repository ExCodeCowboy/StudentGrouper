import type {
  Classroom,
  PlannedStation,
  RotationAssignment,
  RotationSession,
} from '../model';
import { cloneData } from '../platform';
import {
  markDailyPinPlacements,
  assignmentActivityKey,
  assignmentStudentIds,
  fillOpenSpots,
  planKey,
  stationCapacity,
} from '../rotations';

export type Choice = { station: PlannedStation; key: string };
export type Slot = {
  index: number;
  time: number;
  groupId: string;
  learners: string[];
  choices: Choice[];
  originalStationId?: string;
};
export type FixedVisit = {
  assignment: RotationAssignment;
  key: string;
  learners: string[];
};
export type TimeSlot = {
  day: RotationSession;
  roundIndex: number;
  choices: Choice[];
  fixed: FixedVisit[];
  slots: Slot[];
  missingFixed: number;
  groupCount: number;
};
export type LearnerProfile = {
  weight: number;
  learners: string[];
  eligible: string[];
  slots: number[][];
  fixed: string[][];
};
export type DailyRequirement = {
  groupId: string;
  key: string;
  times: number[];
  pinned?: boolean;
};
export type BlockProblem = {
  source: Classroom;
  prepared: Classroom;
  blockId: string;
  times: TimeSlot[];
  slots: Slot[];
  learners: LearnerProfile[];
  onceOnly: Set<string>;
  priorityActivities: Set<string>;
  dailyLimits: DailyRequirement[];
  dailyRequired: DailyRequirement[];
};

const studentKeys = (ids: string[], fallback: string) =>
  ids.length
    ? [...new Set(ids)].map((id) => `student:${id}`)
    : [`group:${fallback}`];

export function createBlockProblem(
  source: Classroom,
  blockId: string,
  preserveSessionIds: string[] = [],
): BlockProblem {
  const preserved = new Set(preserveSessionIds);
  const prepared = cloneData(source);
  const days = prepared.sessions
    .filter((day) => day.blockId === blockId || (!day.blockId && day.id === blockId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const times: TimeSlot[] = [];
  const slots: Slot[] = [];
  const onceOnly = new Set<string>();
  const priorityActivities = new Set<string>();
  const dailyLimits: DailyRequirement[] = [];
  const dailyRequired: DailyRequirement[] = [];
  const eligible = new Map<string, Set<string>>();
  for (const day of days) {
    const set = prepared.groupSets.find((item) => item.id === day.groupSetId);
    if (!set) continue;
    const choices = day.plannedStations
      .filter(
        (station) =>
          station.activityName.trim() &&
          prepared.locations.some(
            (location) => location.id === station.locationId,
          ),
      )
      .map((station) => ({ station, key: planKey(day, station) }));
    for (const { station, key } of choices) {
      if (station.visitRule === 'once-per-block') onceOnly.add(key);
      if (station.priority) priorityActivities.add(key);
    }
    const original = source.sessions.find((item) => item.id === day.id)!;
    if (!preserved.has(day.id)) {
      day.ignoredIssueIds = [];
      for (const round of day.rounds)
        if (!round.completed) {
          round.assignments = round.assignments.filter(
            (item) => item.locked && !item.pinned,
          );
        }
    }
    const dayTimes: number[] = [];
    for (const [roundIndex, round] of day.rounds.entries()) {
      const time = times.length;
      dayTimes.push(time);
      const fixed = round.assignments.map((assignment) => ({
        assignment,
        key: assignmentActivityKey(day, assignment, round.completed),
        learners: studentKeys(
          assignmentStudentIds(prepared, day, assignment, round.completed),
          `${day.groupSetId}:${assignment.groupId}`,
        ),
      }));
      const fixedGroups = new Set(
        fixed.map((visit) => visit.assignment.groupId),
      );
      const frozen = round.completed || preserved.has(day.id);
      const timeSlots: Slot[] = [];
      for (const group of set.groups) {
        const keys =
          frozen || fixedGroups.has(group.id)
            ? [
                ...new Set(
                  fixed
                    .filter((visit) => visit.assignment.groupId === group.id)
                    .flatMap((visit) => visit.learners),
                ),
              ]
            : studentKeys(group.studentIds, `${set.id}:${group.id}`);
        for (const learner of keys) {
          const activities = eligible.get(learner) ?? new Set<string>();
          for (const choice of choices) activities.add(choice.key);
          eligible.set(learner, activities);
        }
        if (frozen || fixedGroups.has(group.id)) continue;
        const slot: Slot = {
          index: slots.length,
          time,
          groupId: group.id,
          learners: keys,
          choices,
          originalStationId: original.rounds[roundIndex]?.assignments.find(
            (item) => item.groupId === group.id,
          )?.stationId,
        };
        slots.push(slot);
        timeSlots.push(slot);
      }
      // Old snapshots can contain a learner who is no longer in the arrangement.
      for (const visit of fixed)
        for (const learner of visit.learners) {
          const activities = eligible.get(learner) ?? new Set<string>();
          if (visit.key) activities.add(visit.key);
          eligible.set(learner, activities);
        }
      times.push({
        day,
        roundIndex,
        choices,
        fixed,
        slots: timeSlots,
        groupCount: set.groups.length,
        missingFixed: frozen
          ? set.groups.filter((group) => !fixedGroups.has(group.id)).length
          : 0,
      });
    }
    for (const { station, key } of choices) {
      for (const group of set.groups) {
        const pinned = station.dailyPinGroupIds?.includes(group.id) ?? false;
        const requirement = { groupId: group.id, key, times: dayTimes, pinned };
        if (station.visitRule === 'daily' || pinned) dailyLimits.push(requirement);
        if (
          pinned || (station.visitRule === 'daily' && (station.dailyGroupIds === undefined ||
          station.dailyGroupIds.includes(group.id)))
        )
          dailyRequired.push(requirement);
      }
    }
  }
  const profiles = new Map<string, LearnerProfile>();
  for (const [learner, activities] of eligible) {
    const profile: LearnerProfile = {
      weight: 1,
      learners: [learner],
      eligible: [...activities].sort(),
      slots: times.map((time) =>
        time.slots
          .filter((slot) => slot.learners.includes(learner))
          .map((slot) => slot.index),
      ),
      fixed: times.map((time) =>
        time.fixed
          .filter((visit) => visit.learners.includes(learner) && visit.key)
          .map((visit) => visit.key)
          .sort(),
      ),
    };
    const signature = JSON.stringify([
      profile.eligible,
      profile.slots,
      profile.fixed,
    ]);
    const existing = profiles.get(signature);
    if (existing) {
      existing.weight++;
      existing.learners.push(learner);
    } else profiles.set(signature, profile);
  }
  return {
    source,
    prepared,
    blockId,
    times,
    slots,
    learners: [...profiles.values()],
    onceOnly,
    priorityActivities,
    dailyLimits,
    dailyRequired,
  };
}

export function visitsFor(
  problem: BlockProblem,
  learner: LearnerProfile,
  choices: number[],
) {
  return problem.times.map((_, time) => [
    ...learner.fixed[time],
    ...learner.slots[time].flatMap((slot) => {
      const choice = problem.slots[slot].choices[choices[slot]];
      return choice ? [choice.key] : [];
    }),
  ]);
}

function groupVisits(
  problem: BlockProblem,
  requirement: DailyRequirement,
  choices: number[],
) {
  return requirement.times.reduce(
    (count, time) =>
      count +
      problem.times[time].fixed.filter(
        (visit) =>
          visit.assignment.groupId === requirement.groupId &&
          visit.key === requirement.key,
      ).length +
      problem.times[time].slots.filter(
        (slot) =>
          slot.groupId === requirement.groupId &&
          slot.choices[choices[slot.index]]?.key === requirement.key,
      ).length,
    0,
  );
}

// This validator and score work from actual assignments, independently of LP
// auxiliaries. Retained conflicts consume all capacity; they never authorize
// additional automatic violations.
export function validChoices(
  problem: BlockProblem,
  choices: number[],
): boolean {
  if (
    choices.length !== problem.slots.length ||
    choices.some(
      (choice, index) =>
        !Number.isInteger(choice) ||
        choice < -1 ||
        choice >= problem.slots[index].choices.length,
    )
  )
    return false;
  for (const time of problem.times)
    for (const { station } of time.choices) {
      const fixed = time.fixed.filter(
        (visit) => visit.assignment.stationId === station.id,
      ).length;
      const added = time.slots.filter(
        (slot) => slot.choices[choices[slot.index]]?.station.id === station.id,
      ).length;
      if (
        added > Math.max(0, stationCapacity(station, time.groupCount) - fixed)
      )
        return false;
    }
  for (const learner of problem.learners) {
    const visits = visitsFor(problem, learner, choices);
    for (const [time, activities] of visits.entries()) {
      if (activities.length > Math.max(1, learner.fixed[time].length))
        return false;
    }
    for (const key of problem.onceOnly) {
      const fixed = learner.fixed
        .flat()
        .filter((activity) => activity === key).length;
      if (
        visits.flat().filter((activity) => activity === key).length >
        Math.max(1, fixed)
      )
        return false;
    }
  }
  for (const requirement of problem.dailyLimits) {
    const fixed = groupVisits(
      problem,
      requirement,
      Array(problem.slots.length).fill(-1),
    );
    if (groupVisits(problem, requirement, choices) > Math.max(1, fixed))
      return false;
  }
  return true;
}

export const SCORE_LABELS = [
  'Pinned daily visits missing',
  'Empty places',
  'Required daily visits missing',
  'Most priority activities missing for one learner',
  'Priority learner visits missing',
  'Most activities missing for one learner',
  'Learner visits missing',
  'Once-only visits missing',
  'Waiting for first priority visits',
  'Repeats before coverage',
  'Consecutive repeats',
  'Same-day repeat pairs',
  'Block repeat pairs',
  'Changed placements',
] as const;
export const SCORE = {
  pinned: 0, empty: 1, daily: 2,
  priorityWorst: 3, priorityMissing: 4,
  worstMissing: 5, missing: 6, onceMissing: 7,
  priorityDelay: 8, prematureRepeats: 9, consecutive: 10,
  dayRepeatPairs: 11, blockRepeatPairs: 12, changes: 13,
} as const;
export type PlannerScore = number[];
export function scoreChoices(
  problem: BlockProblem,
  choices: number[],
): PlannerScore {
  const score = Array<number>(SCORE_LABELS.length).fill(0);
  score[SCORE.empty] =
    choices.filter((choice) => choice < 0).length +
    problem.times.reduce((sum, time) => sum + time.missingFixed, 0);
  for (const requirement of problem.dailyRequired)
    if (groupVisits(problem, requirement, choices) === 0)
      score[requirement.pinned ? SCORE.pinned : SCORE.daily]++;
  for (const learner of problem.learners) {
    const counts = new Map<string, number>();
    const daily = new Map<string, number>();
    const visits = visitsFor(problem, learner, choices);
    for (const [time, activities] of visits.entries()) {
      const missing = learner.eligible.filter((key) => !counts.has(key)).length;
      const first = new Set(activities.filter((key) => !counts.has(key))).size;
      score[SCORE.prematureRepeats] += (activities.length - first) * missing * learner.weight;
      // Count only participating rounds where this activity is offered, after
      // this round's visit. A visit now removes the current and future wait.
      if (learner.slots[time].length || learner.fixed[time].length) {
        score[SCORE.priorityDelay] += learner.eligible.filter((key) =>
          problem.priorityActivities.has(key) && !counts.has(key) && !activities.includes(key) &&
          problem.times[time].choices.some((choice) => choice.key === key),
        ).length * learner.weight;
      }
      if (
        time > 0 &&
        problem.times[time - 1].day.id === problem.times[time].day.id
      ) {
        score[SCORE.consecutive] +=
          activities.reduce(
            (sum, key) =>
              sum +
              visits[time - 1].filter((previous) => previous === key).length,
            0,
          ) * learner.weight;
      }
      for (const key of activities) {
        const dayKey = `${problem.times[time].day.id}:${key}`;
        score[SCORE.dayRepeatPairs] += (daily.get(dayKey) ?? 0) * learner.weight;
        score[SCORE.blockRepeatPairs] += (counts.get(key) ?? 0) * learner.weight;
        daily.set(dayKey, (daily.get(dayKey) ?? 0) + 1);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const missing = learner.eligible.filter((key) => !counts.has(key));
    const priorityMissing = missing.filter((key) => problem.priorityActivities.has(key)).length;
    score[SCORE.priorityWorst] = Math.max(score[SCORE.priorityWorst], priorityMissing);
    score[SCORE.priorityMissing] += priorityMissing * learner.weight;
    score[SCORE.worstMissing] = Math.max(score[SCORE.worstMissing], missing.length);
    score[SCORE.missing] += missing.length * learner.weight;
    score[SCORE.onceMissing] +=
      missing.filter((key) => problem.onceOnly.has(key)).length *
      learner.weight;
  }
  score[SCORE.changes] = problem.slots.filter(
    (slot) =>
      slot.choices[choices[slot.index]]?.station.id !== slot.originalStationId,
  ).length;
  return score;
}

export function compareScores(a: PlannerScore, b: PlannerScore) {
  for (let index = 0; index < a.length; index++)
    if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

export function choicesFromClassroom(
  problem: BlockProblem,
  classroom: Classroom,
) {
  return problem.slots.map((slot) => {
    const time = problem.times[slot.time];
    const assignment = classroom.sessions
      .find((day) => day.id === time.day.id)
      ?.rounds[time.roundIndex].assignments.find(
        (item) => item.groupId === slot.groupId,
      );
    return slot.choices.findIndex(
      (choice) => choice.station.id === assignment?.stationId,
    );
  });
}

export function classroomFromChoices(
  problem: BlockProblem,
  choices: number[],
): Classroom {
  const next = cloneData(problem.prepared);
  for (const slot of problem.slots) {
    const choice = slot.choices[choices[slot.index]];
    if (!choice) continue;
    const time = problem.times[slot.time];
    const day = next.sessions.find((item) => item.id === time.day.id)!;
    day.rounds[time.roundIndex].assignments.push({
      groupId: slot.groupId,
      stationId: choice.station.id,
      locked: false,
    });
  }
  for (const dayId of new Set(problem.slots.map((slot) => problem.times[slot.time].day.id)))
    markDailyPinPlacements(next.sessions.find((day) => day.id === dayId)!);
  return next;
}

export function greedyChoices(problem: BlockProblem) {
  let next = cloneData(problem.prepared);
  for (const dayId of new Set(
    problem.slots.map((slot) => problem.times[slot.time].day.id),
  )) {
    const day = next.sessions.find((item) => item.id === dayId)!;
    const set = next.groupSets.find((item) => item.id === day.groupSetId)!;
    const filled = fillOpenSpots(next, day, set);
    next = {
      ...next,
      sessions: next.sessions.map((item) =>
        item.id === dayId ? filled : item,
      ),
    };
  }
  return choicesFromClassroom(problem, next);
}
