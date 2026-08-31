import type { Classroom, GroupSet, RotationSession } from './model';
import { fillOpenSpots } from './rotations';

export function resetGroupSet(groupSet: GroupSet): GroupSet {
  return {
    ...groupSet,
    groups: groupSet.groups.map((group) => ({
      ...group,
      studentIds: [],
      lockedStudentIds: [],
    })),
  };
}

export function changeSessionGroupSet(
  classroom: Classroom,
  sessionId: string,
  groupSetId: string,
): Classroom {
  const selected = classroom.groupSets.find((groupSet) => groupSet.id === groupSetId);
  const session = classroom.sessions.find((item) => item.id === sessionId);
  if (!selected || !session || session.groupSetId === groupSetId) return classroom;

  const cleared: RotationSession = {
    ...session,
    groupSetId,
    rounds: session.rounds.map((round) => ({
      ...round,
      assignments: [],
      completed: false,
    })),
  };
  const withCleared = {
    ...classroom,
    sessions: classroom.sessions.map((item) => item.id === sessionId ? cleared : item),
  };
  const filled = fillOpenSpots(withCleared, cleared, selected);
  return {
    ...withCleared,
    sessions: withCleared.sessions.map((item) => item.id === sessionId ? filled : item),
  };
}

export function deleteGroupSet(classroom: Classroom, groupSetId: string): Classroom {
  if (classroom.groupSets.length <= 1) return classroom;
  const groupSet = classroom.groupSets.find((item) => item.id === groupSetId);
  if (!groupSet) return classroom;

  const remaining = classroom.groupSets.filter((item) => item.id !== groupSetId);
  const replacement = remaining[0];
  const affectedSessionIds = classroom.sessions
    .filter((session) => session.groupSetId === groupSetId)
    .map((session) => session.id);
  let next: Classroom = {
    ...classroom,
    groupSets: remaining,
    activeGroupSetId: classroom.activeGroupSetId === groupSetId
      ? replacement.id
      : classroom.activeGroupSetId,
  };
  for (const sessionId of affectedSessionIds) {
    next = changeSessionGroupSet(next, sessionId, replacement.id);
  }
  return next;
}
