import type { Classroom, Group, GroupSet, PlannedStation, RotationSession, Student } from './model';

export type DisplayGroup = Pick<Group, 'id' | 'name' | 'color' | 'symbol' | 'imageDataUrl'> & {
  students: Pick<Student, 'id' | 'name'>[];
};

// Pass only presentation fields into the student screen. Teacher notes, levels,
// locks, and arrangement names (which may describe ability) stay in the editor.
export function studentDisplayGroups(groupSet: GroupSet, students: Student[]): DisplayGroup[] {
  const present = new Map(students.filter((student) => !student.absent).map((student) => [student.id, student]));
  const seen = new Set<string>();
  return groupSet.groups.map((group) => ({
    id: group.id,
    name: group.name,
    color: group.color,
    symbol: group.symbol,
    imageDataUrl: group.imageDataUrl,
    students: group.studentIds.flatMap((id) => {
      const student = present.get(id);
      if (!student || seen.has(id)) return [];
      seen.add(id);
      return [{ id: student.id, name: student.name }];
    }),
  })).filter((group) => group.students.length > 0);
}

type DisplayTeam = Omit<DisplayGroup, 'students'>;
export type DisplayRotation = {
  group: DisplayGroup;
  station: PlannedStation | null;
  location: string;
};
export type DisplayRotationDay = {
  date: string;
  groups: DisplayTeam[];
  rounds: { id: string; completed: boolean; entries: DisplayRotation[] }[];
};

// Build a separate presentation model: no levels, relationships, rules, locks,
// private arrangement labels, or planner diagnostics enter the student screen.
export function studentDisplayRotations(classroom: Classroom, session: RotationSession): DisplayRotationDay {
  const set = classroom.groupSets.find((item) => item.id === session.groupSetId);
  if (!set) return { date: session.date, groups: [], rounds: [] };
  const roster = new Map(classroom.students.map((student) => [student.id, student]));
  const rounds = session.rounds.map((round) => {
    const seen = new Set<string>();
    const historicalOwners = new Map<string, string>();
    if (round.completed) for (const assignment of round.assignments) {
      for (const id of assignment.studentIds ?? []) if (!historicalOwners.has(id)) historicalOwners.set(id, assignment.groupId);
    }
    return {
      id: round.id,
      completed: round.completed,
      entries: set.groups.flatMap((group): DisplayRotation[] => {
        const assignment = round.assignments.find((item) => item.groupId === group.id);
        const source = session.plannedStations.find((item) => item.id === assignment?.stationId);
        const ids = round.completed && assignment?.studentIds ? assignment.studentIds : group.studentIds;
        const students = ids.flatMap((id) => {
          const student = roster.get(id);
          const historicalOwner = historicalOwners.get(id);
          if (!student || (!round.completed && student.absent) || seen.has(id) || (historicalOwner && historicalOwner !== group.id)) return [];
          seen.add(id);
          return [{ id, name: student.name }];
        });
        if (!students.length) return [];
        const activityName = round.completed ? assignment?.activityName ?? source?.activityName : source?.activityName;
        const locationId = round.completed ? assignment?.locationId ?? source?.locationId : source?.locationId;
        const station: PlannedStation | null = assignment && activityName?.trim() ? {
          id: assignment.stationId,
          activityName,
          locationId: locationId ?? '',
          iconKey: source?.iconKey ?? 'independent',
          imageDataUrl: source?.imageDataUrl,
        } : null;
        return [{
          group: { id: group.id, name: group.name, color: group.color, symbol: group.symbol, imageDataUrl: group.imageDataUrl, students },
          station,
          location: station ? classroom.locations.find((item) => item.id === locationId)?.name ?? '' : '',
        }];
      }),
    };
  });
  const visibleIds = new Set(rounds.flatMap((round) => round.entries.map((entry) => entry.group.id)));
  return {
    date: session.date,
    groups: set.groups.filter((group) => visibleIds.has(group.id)).map((group) => ({ id: group.id, name: group.name, color: group.color, symbol: group.symbol, imageDataUrl: group.imageDataUrl })),
    rounds,
  };
}
