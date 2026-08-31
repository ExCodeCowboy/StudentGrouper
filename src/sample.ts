import type {
  AppData,
  Group,
  Location,
  SkillLevel,
  Student,
} from './model';

const groupLooks = [
  ['Blue Stars', '#3778b8', '★'],
  ['Green Circles', '#4c916a', '●'],
  ['Golden Moons', '#c58a24', '☾'],
  ['Coral Hearts', '#cf6d64', '♥'],
  ['Purple Squares', '#8066a7', '■'],
  ['Orange Triangles', '#d47735', '▲'],
  ['Teal Diamonds', '#278c8a', '◆'],
  ['Rose Flowers', '#b85d80', '✿'],
] as const;

export function createGroupShells(count: number): Group[] {
  return Array.from({ length: count }, (_, index) => {
    const [name, color, symbol] = groupLooks[index % groupLooks.length];
    return {
      id: `group-${index + 1}`,
      name,
      color,
      symbol,
      studentIds: [],
      lockedStudentIds: [],
    };
  });
}

const studentSeed = [
  ['Ava', 'English', 'Girl', 3, 2, 3],
  ['Eli', 'English', 'Boy', 2, 3, 2],
  ['Maya', 'Spanish', 'Girl', 1, 2, 2],
  ['Noah', 'English', 'Boy', 2, 1, 2],
  ['Sofia', 'Spanish', 'Girl', 3, 3, 3],
  ['Liam', 'English', 'Boy', 1, 2, 1],
  ['Emma', 'English', 'Girl', 3, 2, 3],
  ['Mateo', 'Spanish', 'Boy', 2, 3, 2],
  ['Zoe', 'English', 'Girl', 2, 2, 2],
  ['Leo', 'Spanish', 'Boy', 3, 3, 2],
  ['Mila', 'English', 'Girl', 2, 1, 2],
  ['Jack', 'English', 'Boy', 1, 2, 1],
  ['Layla', 'Arabic', 'Girl', 3, 2, 3],
  ['Owen', 'English', 'Boy', 2, 3, 2],
  ['Nora', 'English', 'Girl', 3, 2, 3],
  ['Henry', 'English', 'Boy', 1, 1, 2],
  ['Isla', 'English', 'Girl', 2, 2, 3],
  ['Lucas', 'Spanish', 'Boy', 2, 3, 2],
  ['Aria', 'English', 'Girl', 1, 2, 2],
  ['Theo', 'English', 'Boy', 2, 2, 1],
  ['Mia', 'Spanish', 'Girl', 3, 3, 3],
  ['Ezra', 'English', 'Boy', 1, 1, 2],
  ['Lily', 'English', 'Girl', 2, 2, 3],
  ['Kai', 'Japanese', 'Boy', 3, 3, 2],
] as const;

function createStudents(): Student[] {
  return studentSeed.map(([name, language, gender, reading, math, writing], index) => ({
    id: `student-${index + 1}`,
    name,
    language,
    gender,
    reading: reading as SkillLevel,
    math: math as SkillLevel,
    writing: writing as SkillLevel,
    absent: false,
  }));
}

function createLocations(): Location[] {
  return [
    ['location-short-table', 'Short Table'],
    ['location-seatwork', 'Seatwork Area'],
    ['location-teacher-desk', "Teacher's Desk"],
    ['location-whiteboard', 'Whiteboard Table'],
    ['location-carpet', 'Carpet'],
    ['location-computers', 'Computer Area'],
    ['location-listening', 'Listening Corner'],
    ['location-art', 'Art Table'],
  ].map(([id, name]) => ({ id, name }));
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createSampleData(): AppData {
  const students = createStudents();
  const groups = createGroupShells(5);
  const locations = createLocations();
  const plannedStations = [
    { id: 'plan-teacher', activityName: 'Teacher Time', locationId: 'location-short-table', iconKey: 'teacher' as const },
    { id: 'plan-reading', activityName: 'Independent Reading', locationId: 'location-carpet', iconKey: 'reading' as const },
    { id: 'plan-writing', activityName: 'Writing Practice', locationId: 'location-seatwork', iconKey: 'writing' as const },
    { id: 'plan-math', activityName: 'Math Games', locationId: 'location-whiteboard', iconKey: 'math' as const },
    { id: 'plan-computer', activityName: 'Computer Practice', locationId: 'location-computers', iconKey: 'computer' as const },
  ];
  students.forEach((student, index) => {
    groups[index % groups.length].studentIds.push(student.id);
  });
  groups[0].lockedStudentIds.push('student-2');

  const assignments = groups.map((group, index) => ({
    groupId: group.id,
    stationId: plannedStations[index].id,
    locked: index === 0,
  }));

  return {
    schemaVersion: 1,
    activeClassroomId: 'class-1',
    classrooms: [
      {
        id: 'class-1',
        name: 'Sample First Grade',
        students,
        relationships: [
          {
            id: 'relation-1',
            studentAId: 'student-6',
            studentBId: 'student-8',
            kind: 'apart',
          },
        ],
        groupSets: [
          {
            id: 'groups-centers',
            name: 'Center Groups',
            recipe: {
              groupCount: 5,
              primaryAttribute: 'reading',
              mode: 'mixed',
              secondaryGoal: 'mix-gender',
            },
            groups,
          },
        ],
        activeGroupSetId: 'groups-centers',
        locations,
        sessions: [
          {
            id: 'session-today',
            label: 'Today',
            createdAt: new Date().toISOString(),
            date: localDateValue(),
            groupSetId: 'groups-centers',
            plannedStations,
            rounds: [
              { id: 'round-1', assignments, completed: false },
              {
                id: 'round-2',
                completed: false,
                assignments: groups.map((group, index) => ({
                  groupId: group.id,
                  stationId: plannedStations[(index + 1) % plannedStations.length].id,
                  locked: false,
                })),
              },
              {
                id: 'round-3',
                completed: false,
                assignments: groups.map((group, index) => ({
                  groupId: group.id,
                  stationId: plannedStations[(index + 2) % plannedStations.length].id,
                  locked: false,
                })),
              },
            ],
          },
        ],
        activeSessionId: 'session-today',
      },
    ],
  };
}
