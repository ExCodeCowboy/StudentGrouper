import type {
  Classroom,
  GroupSet,
  Location,
  PlannedStation,
  RotationAssignment,
  RotationSession,
  SkillLevel,
  Student,
} from '../src/model';
import { createGroupShells, createSampleData } from '../src/sample';

export function sampleClassroom() {
  return structuredClone(createSampleData().classrooms[0]);
}

export function student(
  id: string,
  options: Partial<Omit<Student, 'id' | 'name'>> & { name?: string } = {},
): Student {
  return {
    id,
    name: options.name ?? id,
    language: options.language ?? 'English',
    gender: options.gender ?? '',
    reading: options.reading ?? 2,
    math: options.math ?? 2,
    writing: options.writing ?? 2,
    absent: options.absent ?? false,
  };
}

export function studentsWithLevels(levels: SkillLevel[]) {
  return levels.map((level, index) =>
    student(`student-${index + 1}`, {
      name: String.fromCharCode(65 + index),
      reading: level,
      math: level,
      writing: level,
    }),
  );
}

export function groupSet(count: number, overrides: Partial<GroupSet> = {}): GroupSet {
  return {
    id: 'test-groups',
    name: 'Test Groups',
    recipe: {
      groupCount: count,
      primaryAttribute: 'reading',
      mode: 'mixed',
      secondaryGoal: 'none',
    },
    groups: createGroupShells(count),
    ...overrides,
  };
}

export function stations(count: number): PlannedStation[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `station-${index + 1}`,
    activityName: `Activity ${index + 1}`,
    locationId: `location-${index + 1}`,
    iconKey: 'independent',
  }));
}

export function locations(count: number): Location[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `location-${index + 1}`,
    name: `Location ${index + 1}`,
  }));
}

export function blankSession(
  set: GroupSet,
  stationList: PlannedStation[],
  roundCount: number,
  id = 'active-session',
): RotationSession {
  return {
    id,
    label: 'Test Day',
    createdAt: '2026-08-30T00:00:00.000Z',
    date: '2026-08-30',
    groupSetId: set.id,
    plannedStations: structuredClone(stationList),
    rounds: Array.from({ length: roundCount }, (_, index) => ({
      id: `round-${index + 1}`,
      assignments: [],
      completed: false,
    })),
  };
}

export function classroomFor(
  set: GroupSet,
  stationList: PlannedStation[],
  sessions: RotationSession[],
  activeSessionId = sessions.at(-1)?.id ?? '',
): Classroom {
  return {
    id: 'test-classroom',
    name: 'Test Classroom',
    students: [],
    relationships: [],
    groupSets: [set],
    activeGroupSetId: set.id,
    locations: locations(stationList.length),
    sessions,
    activeSessionId,
  };
}

export function assignment(
  groupId: string,
  stationId: string,
  locked = false,
): RotationAssignment {
  return { groupId, stationId, locked };
}
