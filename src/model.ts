export type SkillLevel = 1 | 2 | 3;
export type Gender = 'Girl' | 'Boy' | '';
export type RelationshipKind = 'together' | 'apart';
export type PrimaryAttribute = 'reading' | 'math' | 'writing';
export type GroupingMode = 'mixed' | 'similar';
export type SecondaryGoal = 'none' | 'mix-gender' | 'share-language';

export type Student = {
  id: string;
  name: string;
  language: string;
  gender: Gender;
  reading: SkillLevel;
  math: SkillLevel;
  writing: SkillLevel;
  absent: boolean;
};

export type Relationship = {
  id: string;
  studentAId: string;
  studentBId: string;
  kind: RelationshipKind;
};

export type Group = {
  id: string;
  name: string;
  color: string;
  symbol: string;
  imageDataUrl?: string;
  studentIds: string[];
  lockedStudentIds: string[];
};

export type GroupRecipe = {
  groupCount: number;
  primaryAttribute: PrimaryAttribute;
  mode: GroupingMode;
  secondaryGoal: SecondaryGoal;
};

export type GroupSet = {
  id: string;
  name: string;
  recipe: GroupRecipe;
  groups: Group[];
};

export type StationIconKey =
  | 'teacher'
  | 'reading'
  | 'writing'
  | 'math'
  | 'computer'
  | 'art'
  | 'listening'
  | 'word-work'
  | 'independent'
  | 'partners'
  | 'science'
  | 'music'
  | 'puzzles'
  | 'blocks'
  | 'cutting'
  | 'movement'
  | 'library'
  | 'fine-motor'
  | 'nature'
  | 'snack';

export type Location = {
  id: string;
  name: string;
  archived?: boolean;
};

export type PlannedStation = {
  id: string;
  activityName: string;
  locationId: string;
  iconKey: StationIconKey;
  imageDataUrl?: string;
};

export type RotationAssignment = {
  groupId: string;
  stationId: string;
  locked: boolean;
  studentIds?: string[];
  activityName?: string;
  locationId?: string;
};

export type RotationRound = {
  id: string;
  assignments: RotationAssignment[];
  completed: boolean;
};

export type RotationSession = {
  id: string;
  label: string;
  createdAt: string;
  date: string;
  groupSetId: string;
  plannedStations: PlannedStation[];
  rounds: RotationRound[];
  ignoredIssueIds?: string[];
};

export type Classroom = {
  id: string;
  name: string;
  students: Student[];
  relationships: Relationship[];
  groupSets: GroupSet[];
  activeGroupSetId: string;
  locations: Location[];
  sessions: RotationSession[];
  activeSessionId: string;
};

export type AppData = {
  schemaVersion: 1;
  classrooms: Classroom[];
  activeClassroomId: string;
};

export type ScheduleIssue = {
  id: string;
  severity: 'attention' | 'notice';
  message: string;
  roundId?: string;
  roundIds?: string[];
  groupId?: string;
  stationId?: string;
  locationId?: string;
};

export const levelLabel = (value: SkillLevel) =>
  value === 1 ? 'Low' : value === 2 ? 'Medium' : 'High';

export const makeId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID()}`;
