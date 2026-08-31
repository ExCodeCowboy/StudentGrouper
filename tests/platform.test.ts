import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneData, randomUuid } from '../src/platform';

void test('cloneData creates an independent copy of app-shaped data', () => {
  const original = {
    classrooms: [{ id: 'class-1', students: [{ id: 'student-1', name: 'Ava' }] }],
  };
  const copy = cloneData(original);

  copy.classrooms[0].students[0].name = 'Changed';

  assert.equal(original.classrooms[0].students[0].name, 'Ava');
  assert.notEqual(copy, original);
});

void test('randomUuid returns a standard version 4 identifier', () => {
  assert.match(
    randomUuid(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});
