import assert from 'node:assert/strict';
import { test as nodeTest } from 'node:test';
import { createSampleData } from '../src/sample';
import {
  createBackupFile,
  normalizeAppData,
  readBackup,
  recoverSavedData,
} from '../src/storage';
import type { AppData, PlannedStation } from '../src/model';

function test(name: string, body: () => void | Promise<void>) {
  void nodeTest(name, body);
}

function textFile(contents: string) {
  return { text: async () => contents };
}

test('exported backup round-trips every current data field through import', async () => {
  const source = normalizeAppData(createSampleData());
  const classroom = source.classrooms[0];
  classroom.name = 'Mrs. Rivera’s First Grade';
  classroom.groupSets[0].groups[0].imageDataUrl = 'data:image/png;base64,group-picture';
  classroom.groupSets[0].groups[0].lockedStudentIds = [
    classroom.groupSets[0].groups[0].studentIds[0],
  ];
  classroom.sessions[0].plannedStations[0].imageDataUrl = 'data:image/png;base64,station-picture';
  classroom.sessions[0].ignoredIssueIds = ['repeat:group-1:reading'];
  const backup = createBackupFile(source, new Date('2026-09-14T12:00:00.000Z'));

  const restored = await readBackup(textFile(backup.contents));

  assert.equal(backup.filename, 'student-grouper-backup-2026-09-14.json');
  assert.equal(JSON.stringify(restored), JSON.stringify(source));
});

test('import accepts a valid Student Grouper backup', async () => {
  const source = createSampleData();
  const restored = await readBackup(textFile(JSON.stringify(source)));

  assert.equal(restored.schemaVersion, 1);
  assert.equal(restored.activeClassroomId, source.activeClassroomId);
  assert.equal(restored.classrooms[0].students.length, source.classrooms[0].students.length);
});

test('import rejects malformed JSON with a friendly message', async () => {
  await assert.rejects(
    readBackup(textFile('{ definitely not json }')),
    new Error('That backup file is not valid JSON.'),
  );
});

test('import rejects files with the wrong schema or no active class', async () => {
  await assert.rejects(
    readBackup(textFile(JSON.stringify({ schemaVersion: 2, classrooms: [], activeClassroomId: '' }))),
    new Error('That file is not a Student Grouper backup.'),
  );
  await assert.rejects(
    readBackup(textFile(JSON.stringify({
      schemaVersion: 1,
      classrooms: [{
        id: 'class-1',
        name: 'Class One',
        students: [],
        relationships: [],
        groupSets: [],
        sessions: [],
      }],
      activeClassroomId: 'missing-class',
    }))),
    new Error('That file is not a Student Grouper backup.'),
  );
});

test('local recovery prefers the newest valid generation', () => {
  const previous = createSampleData();
  previous.classrooms[0].name = 'Previous Name';
  const current = structuredClone(previous);
  current.classrooms[0].name = 'Current Name';

  const recovered = recoverSavedData(current, previous);

  assert.equal(recovered?.classrooms[0].name, 'Current Name');
});

test('local recovery falls back when the newest generation cannot load', () => {
  const previous = createSampleData();
  previous.classrooms[0].name = 'Recovered Class';
  const damagedCurrent = {
    schemaVersion: 1,
    classrooms: [],
    activeClassroomId: 'missing',
  };

  const recovered = recoverSavedData(damagedCurrent, previous);

  assert.equal(recovered?.classrooms[0].name, 'Recovered Class');
});

test('local recovery returns no data when both generations are invalid', () => {
  assert.equal(recoverSavedData({ broken: true }, null), null);
});

test('saved completed rounds gain a stable learner snapshot during migration', () => {
  const data = createSampleData();
  const classroom = data.classrooms[0];
  const session = classroom.sessions[0];
  const assignment = session.rounds[0].assignments[0];
  const group = classroom.groupSets[0].groups.find((item) => item.id === assignment.groupId)!;
  session.rounds[0].completed = true;
  classroom.students.find((student) => student.id === group.studentIds[0])!.absent = true;
  const expected = group.studentIds.slice(1);

  const normalized = normalizeAppData(data);
  const migrated = normalized.classrooms[0].sessions[0].rounds[0].assignments[0];

  assert.deepEqual(migrated.studentIds, expected);
  assert.equal(migrated.activityName, session.plannedStations[0].activityName);
  assert.equal(migrated.locationId, session.plannedStations[0].locationId);
  group.studentIds.reverse();
  assert.deepEqual(migrated.studentIds, expected, 'later edits cannot rewrite completed history');
});

test('legacy station data becomes dated daily stations with reusable locations', () => {
  const data = createSampleData();
  const classroom = data.classrooms[0];
  const session = classroom.sessions[0];
  const oldPlans = structuredClone(session.plannedStations);
  const rawClassroom = classroom as unknown as Record<string, unknown>;
  rawClassroom.stations = oldPlans.map((station: PlannedStation, index) => ({
    id: station.id,
    name: station.activityName,
    iconKey: station.iconKey,
    imageDataUrl: station.imageDataUrl,
    active: index < 5,
  }));
  delete rawClassroom.locations;
  const rawSession = session as unknown as Record<string, unknown>;
  rawSession.stationIds = oldPlans.map((station) => station.id);
  delete rawSession.date;
  delete rawSession.plannedStations;

  const normalized = normalizeAppData(data as AppData);
  const migratedClassroom = normalized.classrooms[0];
  const migratedSession = migratedClassroom.sessions[0];

  assert.ok(migratedClassroom.locations.length >= 5);
  assert.equal(migratedSession.date.length, 10);
  assert.deepEqual(
    migratedSession.plannedStations.map((station) => station.activityName),
    oldPlans.map((station) => station.activityName),
  );
  assert.ok(migratedSession.plannedStations.every((station) => station.locationId));
});
