import assert from 'node:assert/strict';
import { test } from 'node:test';
import { studentDisplayGroups, studentDisplayRotations } from '../src/studentDisplay';
import { assignment, blankSession, classroomFor, groupSet, stations, student } from './fixtures';

void test('student presentation only receives names and group visuals, never teacher attributes or locks', () => {
  const set = groupSet(2);
  set.name = 'Private ability arrangement';
  set.groups[0].studentIds = ['a', 'b'];
  set.groups[0].lockedStudentIds = ['a'];
  set.groups[0].imageDataUrl = 'data:image/png;base64,test';
  const roster = [student('a', { name: 'Avery', reading: 1, language: 'Private language' }), student('b', { name: 'Riley', reading: 3 })];
  const before = JSON.stringify({ set, roster });
  const display = studentDisplayGroups(set, roster);
  assert.equal(display.length, 1);
  assert.equal(display[0].imageDataUrl, set.groups[0].imageDataUrl);
  assert.deepEqual(display[0].students, [{ id: 'a', name: 'Avery' }, { id: 'b', name: 'Riley' }]);
  assert.deepEqual(Object.keys(display[0]).sort(), ['id', 'name', 'color', 'symbol', 'imageDataUrl', 'students'].sort());
  assert.ok(!JSON.stringify(display).includes('Private'));
  assert.equal(JSON.stringify({ set, roster }), before);
});

void test('daily student view uses the day’s arrangement and includes every group sharing a station', () => {
  const set = groupSet(3);
  set.name = 'Private reading levels';
  set.groups.forEach((group, index) => { group.studentIds = [`s${index}`]; });
  const places = stations(2);
  places[0].groupCapacity = 2;
  places[0].dailyPinGroupIds = [set.groups[0].id];
  const session = blankSession(set, places, 2);
  session.label = 'Private teacher note';
  session.rounds[0].assignments = set.groups.map((group, index) => assignment(group.id, places[index === 2 ? 1 : 0].id, true));
  const classroom = classroomFor(set, places, [session]);
  classroom.students = [student('s0'), student('s1'), student('s2'), student('unassigned')];
  classroom.groupSets.push(groupSet(1, { id: 'other' }));
  classroom.activeGroupSetId = 'other';
  const before = JSON.stringify(classroom);
  const display = studentDisplayRotations(classroom, session);
  assert.equal(display.rounds[0].entries.length, 3);
  assert.deepEqual(display.rounds[0].entries.map((entry) => entry.station?.id), ['station-1', 'station-1', 'station-2']);
  assert.equal(display.rounds[0].entries[0].location, 'Location 1');
  assert.ok(display.rounds[1].entries.every((entry) => entry.station === null));
  for (const privateField of ['Private', 'locked', 'reading', 'dailyPin', 'groupCapacity', 'unassigned']) assert.ok(!JSON.stringify(display).includes(privateField));
  assert.equal(JSON.stringify(classroom), before);
});

void test('completed round presentation honors historical students, activities and locations', () => {
  const set = groupSet(2);
  set.groups[0].studentIds = ['now'];
  set.groups[1].studentIds = ['past', 'now'];
  const places = stations(1);
  const session = blankSession(set, places, 2);
  session.rounds[0].completed = true;
  session.rounds[0].assignments = [{
    ...assignment(set.groups[0].id, 'removed-station'), studentIds: ['past'], activityName: 'Original activity', locationId: 'location-1',
  }];
  const classroom = classroomFor(set, places, [session]);
  classroom.students = [student('past', { absent: true }), student('now')];
  const display = studentDisplayRotations(classroom, session);
  assert.deepEqual(display.rounds[0].entries[0].group.students, [{ id: 'past', name: 'past' }]);
  assert.equal(display.rounds[0].entries[0].station?.activityName, 'Original activity');
  assert.equal(display.rounds[0].entries[0].location, 'Location 1');
  assert.deepEqual(display.rounds[1].entries.flatMap((entry) => entry.group.students.map((item) => item.id)), ['now']);
});

void test('daily display shows unresolved placements without inventing a destination', () => {
  const set = groupSet(2);
  set.groups[0].studentIds = ['a', 'missing', 'a'];
  set.groups[1].studentIds = ['away'];
  const session = blankSession(set, stations(1), 1);
  session.rounds[0].assignments = [assignment(set.groups[0].id, 'unknown')];
  const classroom = classroomFor(set, stations(1), [session]);
  classroom.students = [student('a'), student('away', { absent: true })];
  const display = studentDisplayRotations(classroom, session);
  assert.equal(display.groups.length, 1);
  assert.equal(display.rounds[0].entries[0].station, null);
  assert.deepEqual(display.rounds[0].entries[0].group.students, [{ id: 'a', name: 'a' }]);
});

void test('current group membership cannot steal a learner from a completed round snapshot', () => {
  const set = groupSet(2);
  set.groups[0].studentIds = ['a'];
  set.groups[1].studentIds = [];
  const session = blankSession(set, stations(1), 1);
  session.rounds[0].completed = true;
  session.rounds[0].assignments = [{ ...assignment(set.groups[1].id, 'station-1'), studentIds: ['a'] }];
  const classroom = classroomFor(set, stations(1), [session]);
  classroom.students = [student('a')];
  const display = studentDisplayRotations(classroom, session);
  assert.equal(display.rounds[0].entries.length, 1);
  assert.equal(display.rounds[0].entries[0].group.id, set.groups[1].id);
});

void test('student presentation omits away, missing, unassigned, and duplicate memberships', () => {
  const set = groupSet(3);
  set.groups[0].studentIds = ['a', 'away', 'missing', 'a'];
  set.groups[1].studentIds = ['a', 'b'];
  set.groups[2].studentIds = ['away'];
  const display = studentDisplayGroups(set, [student('a'), student('b'), student('away', { absent: true }), student('unassigned')]);
  assert.equal(display.length, 2);
  assert.deepEqual(display.map((group) => group.students.map((item) => item.id)), [['a'], ['b']]);
  assert.deepEqual(studentDisplayGroups(set, []), []);
});
