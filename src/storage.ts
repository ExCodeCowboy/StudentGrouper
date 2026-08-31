import type {
  AppData,
  Classroom,
  Location,
  PlannedStation,
  RotationAssignment,
  RotationRound,
  RotationSession,
  StationIconKey,
} from './model';

export interface PersistencePort {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
}

const DATABASE_NAME = 'student-grouper';
const STORE_NAME = 'application';
const CURRENT_DATA_KEY = 'current';
const PREVIOUS_DATA_KEY = 'previous';

type LegacyStation = {
  id: string;
  name: string;
  iconKey: StationIconKey;
  imageDataUrl?: string;
  active: boolean;
};

type LegacyPlan = Partial<PlannedStation> & { stationId?: string; locationId: string };
type IntermediateActivity = { id: string; name: string; locationId: string };
type IntermediatePlan = { id: string; activityId: string; locationId: string };
type IntermediateLibraryActivity = {
  id: string;
  name: string;
  iconKey: StationIconKey;
  imageDataUrl?: string;
};

type StoredAssignment = Omit<RotationAssignment, 'stationId'> & {
  stationId?: string;
  activityId?: string;
  plannedActivityId?: string;
};

type StoredRound = Omit<RotationRound, 'assignments'> & {
  assignments: StoredAssignment[];
};

type StoredSession = Omit<RotationSession, 'date' | 'plannedStations' | 'rounds'> & {
  date?: string;
  plannedStations?: LegacyPlan[];
  activities?: IntermediateActivity[];
  plannedActivities?: IntermediatePlan[];
  stationIds?: string[];
  rounds: StoredRound[];
};

type StoredClassroom = Omit<Classroom, 'locations' | 'sessions'> & {
  activities?: IntermediateLibraryActivity[];
  locations?: Array<Partial<Location> & Pick<Location, 'id' | 'name'>>;
  stations?: LegacyStation[];
  sessions: StoredSession[];
};

const starterLocationNames = [
  'Short Table',
  'Seatwork Area',
  "Teacher's Desk",
  'Whiteboard Table',
  'Carpet',
  'Computer Area',
  'Listening Corner',
  'Art Table',
];

function migratedLocations(classroom: StoredClassroom): Location[] {
  const legacyStations = classroom.stations ?? [];
  if (classroom.locations?.length) {
    return classroom.locations.map((location) => ({
      id: location.id,
      name: location.name,
      archived: location.archived,
    }));
  }
  const count = Math.max(legacyStations.length, 5);
  return Array.from({ length: count }, (_, index) => ({
    id: `${classroom.id}-location-${index + 1}`,
    name: starterLocationNames[index] ?? `Location ${index + 1}`,
  }));
}

function migratedDate(session: StoredSession) {
  const savedDate = session.date ?? session.createdAt?.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(savedDate ?? '')
    ? savedDate!
    : new Date().toISOString().slice(0, 10);
}

function migratedPlannedStations(
  classroom: StoredClassroom,
  session: StoredSession,
  locations: Location[],
): PlannedStation[] {
  const legacyStations = classroom.stations ?? [];
  const stationsById = new Map(legacyStations.map((station) => [station.id, station]));
  const libraryById = new Map((classroom.activities ?? []).map((activity) => [activity.id, activity]));
  const knownLocationIds = new Set(locations.map((location) => location.id));
  if (session.plannedActivities?.length) {
    return session.plannedActivities.map((plan, index) => {
      const activity = libraryById.get(plan.activityId);
      return {
        id: plan.id,
        activityName: activity?.name ?? `Activity ${index + 1}`,
        locationId: knownLocationIds.has(plan.locationId)
          ? plan.locationId
          : locations[index % locations.length]?.id ?? '',
        iconKey: activity?.iconKey ?? 'independent',
        imageDataUrl: activity?.imageDataUrl,
      };
    });
  }
  if (session.activities?.length) {
    return session.activities.map((activity) => ({
      id: activity.id,
      activityName: activity.name,
      locationId: activity.locationId,
      iconKey: 'independent',
    }));
  }
  const legacyStationIds = session.stationIds ??
    legacyStations.filter((station) => station.active).map((station) => station.id);
  const savedPlans: LegacyPlan[] = session.plannedStations ?? legacyStationIds.map((stationId) => ({
    stationId,
    locationId: '',
  }));
  return savedPlans.map((plan, index) => {
    const sourceId = plan.id ?? plan.stationId ?? `activity-${index + 1}`;
    const legacyStation = stationsById.get(plan.stationId ?? sourceId);
    return {
      id: sourceId,
      activityName: plan.activityName ?? legacyStation?.name ?? `Activity ${index + 1}`,
      locationId: knownLocationIds.has(plan.locationId)
        ? plan.locationId
        : locations[index % locations.length]?.id ?? '',
      iconKey: plan.iconKey ?? legacyStation?.iconKey ?? 'independent',
      imageDataUrl: plan.imageDataUrl ?? legacyStation?.imageDataUrl,
    };
  });
}

export function normalizeAppData(saved: AppData): AppData {
  return {
    ...saved,
    classrooms: saved.classrooms.map((savedClassroom) => {
      const classroom = savedClassroom as unknown as StoredClassroom;
      const locations = migratedLocations(classroom);
      const presentStudentIds = new Set(
        classroom.students.filter((student) => !student.absent).map((student) => student.id),
      );
      return {
        ...classroom,
        locations,
        sessions: classroom.sessions.map((session) => {
          const groupSet = classroom.groupSets.find((item) => item.id === session.groupSetId);
          const plannedStations = migratedPlannedStations(classroom, session, locations);
          return {
            ...session,
            date: migratedDate(session),
            plannedStations,
            rounds: session.rounds.map((round) => ({
              ...round,
              assignments: round.assignments.map((assignment) => {
                const stationId = assignment.stationId ?? assignment.activityId ??
                  assignment.plannedActivityId ?? '';
                const station = plannedStations.find((item) => item.id === stationId);
                return {
                  groupId: assignment.groupId,
                  stationId,
                  locked: assignment.locked,
                  studentIds: round.completed
                    ? assignment.studentIds ??
                      groupSet?.groups
                        .find((group) => group.id === assignment.groupId)
                        ?.studentIds.filter((id) => presentStudentIds.has(id)) ??
                      []
                    : assignment.studentIds,
                  locationId: round.completed
                    ? assignment.locationId ?? station?.locationId
                    : assignment.locationId,
                  activityName: round.completed
                    ? assignment.activityName ?? station?.activityName
                    : assignment.activityName,
                };
              }),
            })),
          };
        }),
      };
    }),
  };
}

function hasAppDataShape(candidate: unknown): candidate is AppData {
  if (!candidate || typeof candidate !== 'object') return false;
  const saved = candidate as Partial<AppData>;
  if (
    saved.schemaVersion !== 1 ||
    !Array.isArray(saved.classrooms) ||
    saved.classrooms.length === 0 ||
    typeof saved.activeClassroomId !== 'string' ||
    !saved.classrooms.some((classroom) => classroom?.id === saved.activeClassroomId)
  ) return false;
  return saved.classrooms.every((classroom) =>
    classroom &&
    typeof classroom.id === 'string' &&
    typeof classroom.name === 'string' &&
    Array.isArray(classroom.students) &&
    Array.isArray(classroom.relationships) &&
    Array.isArray(classroom.groupSets) &&
    classroom.groupSets.length > 0 &&
    typeof classroom.activeGroupSetId === 'string' &&
    classroom.groupSets.some((groupSet) => groupSet?.id === classroom.activeGroupSetId) &&
    Array.isArray(classroom.sessions) &&
    classroom.sessions.length > 0 &&
    typeof classroom.activeSessionId === 'string' &&
    classroom.sessions.some((session) => session?.id === classroom.activeSessionId));
}

export function recoverSavedData(
  preferred: unknown,
  fallback: unknown,
): AppData | null {
  for (const candidate of [preferred, fallback]) {
    if (!hasAppDataShape(candidate)) continue;
    try {
      const normalized = normalizeAppData(candidate);
      if (hasAppDataShape(normalized)) return normalized;
    } catch {
      // Try the previous complete generation.
    }
  }
  return null;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

class IndexedDbPersistence implements PersistencePort {
  async load(): Promise<AppData | null> {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const currentRequest = store.get(CURRENT_DATA_KEY);
      const previousRequest = store.get(PREVIOUS_DATA_KEY);
      transaction.oncomplete = () => {
        database.close();
        resolve(recoverSavedData(currentRequest.result, previousRequest.result));
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    });
  }

  async save(data: AppData): Promise<void> {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const currentRequest = store.get(CURRENT_DATA_KEY);
      currentRequest.onsuccess = () => {
        if (currentRequest.result !== undefined) {
          store.put(currentRequest.result, PREVIOUS_DATA_KEY);
        }
        store.put(data, CURRENT_DATA_KEY);
      };
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const persistence: PersistencePort = new IndexedDbPersistence();

export function createBackupFile(data: AppData, date = new Date()) {
  return {
    filename: `student-grouper-backup-${date.toISOString().slice(0, 10)}.json`,
    contents: JSON.stringify(data, null, 2),
  };
}

export function exportBackup(data: AppData) {
  const backup = createBackupFile(data);
  const blob = new Blob([backup.contents], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = backup.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readBackup(file: Pick<File, 'text'>): Promise<AppData> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text()) as unknown;
  } catch {
    throw new Error('That backup file is not valid JSON.');
  }
  const restored = recoverSavedData(parsed, null);
  if (!restored) throw new Error('That file is not a Student Grouper backup.');
  return restored;
}

export async function normalizeUploadedImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
    throw new Error('Choose a GIF, JPG, or PNG image.');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const maximum = 512;
    const scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The image could not be prepared.');
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
