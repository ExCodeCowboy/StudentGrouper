import assert from 'node:assert/strict';
import { test as nodeTest } from 'node:test';
import { deleteClassroom, renameClassroom } from '../src/classrooms';
import { createSampleData } from '../src/sample';

function test(name: string, body: () => void) {
  void nodeTest(name, body);
}

function twoClasses() {
  const data = createSampleData();
  const second = structuredClone(data.classrooms[0]);
  second.id = 'second-class';
  second.name = 'Second Class';
  data.classrooms.push(second);
  return data;
}

test('renameClassroom trims and changes only the selected class name', () => {
  const data = twoClasses();
  const original = structuredClone(data);

  const renamed = renameClassroom(data, 'second-class', '  Room 12  ');

  assert.deepEqual(data, original, 'the source data is not mutated');
  assert.equal(renamed.classrooms[0].name, original.classrooms[0].name);
  assert.equal(renamed.classrooms[1].name, 'Room 12');
  assert.equal(renamed.activeClassroomId, original.activeClassroomId);
});

test('renameClassroom ignores a blank name or unknown class', () => {
  const data = createSampleData();

  assert.equal(renameClassroom(data, data.activeClassroomId, '   '), data);
  assert.equal(renameClassroom(data, 'missing-class', 'New Name'), data);
});

test('deleteClassroom removes a non-active class without changing the selection', () => {
  const data = twoClasses();

  const deleted = deleteClassroom(data, 'second-class');

  assert.equal(deleted.classrooms.length, 1);
  assert.equal(deleted.activeClassroomId, data.activeClassroomId);
});

test('deleteClassroom selects a remaining class when the active class is removed', () => {
  const data = twoClasses();
  data.activeClassroomId = 'second-class';
  const original = structuredClone(data);

  const deleted = deleteClassroom(data, 'second-class');

  assert.deepEqual(data, original, 'the source data is not mutated');
  assert.equal(deleted.classrooms.length, 1);
  assert.equal(deleted.activeClassroomId, deleted.classrooms[0].id);
});

test('deleteClassroom keeps the final class and ignores unknown IDs', () => {
  const data = createSampleData();

  assert.equal(deleteClassroom(data, data.activeClassroomId), data);
  assert.equal(deleteClassroom(data, 'missing-class'), data);
});
