import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eligiblePickerStudents, pickStudent } from '../src/studentPicker';
import { student } from './fixtures';

void test('student picker includes all present students without needing a group or planned day', () => {
  const roster = [student('assigned'), student('away', { absent: true }), student('unassigned')];
  assert.deepEqual(eligiblePickerStudents(roster), [
    { id: 'assigned', name: 'assigned' },
    { id: 'unassigned', name: 'unassigned' },
  ]);
});

void test('student picker handles an empty or entirely absent roster without drawing', () => {
  const unexpectedDraw = () => { throw new Error('An empty pool must not draw.'); };
  assert.deepEqual(eligiblePickerStudents([]), []);
  const absentPool = eligiblePickerStudents([student('away', { absent: true })]);
  assert.deepEqual(absentPool, []);
  assert.equal(pickStudent([], unexpectedDraw), null);
  assert.equal(pickStudent(absentPool, unexpectedDraw), null);
});

void test('student picker exposes only names and identities, leaving roster data untouched', () => {
  const roster = Object.freeze([
    Object.freeze(student('a', { name: 'Avery', reading: 1, language: 'Private language', gender: 'Girl' })),
    Object.freeze(student('b', { name: 'Blair', math: 3, writing: 1 })),
  ]);
  const before = JSON.stringify(roster);
  const pool = eligiblePickerStudents(roster);
  assert.deepEqual(pool, [{ id: 'a', name: 'Avery' }, { id: 'b', name: 'Blair' }]);
  assert.notEqual(pool[0], roster[0]);
  assert.equal(JSON.stringify(roster), before);
});

void test('duplicate roster identities get one chance while matching names remain separate students', () => {
  const pool = eligiblePickerStudents([
    student('a', { name: 'Alex' }),
    student('a', { name: 'Alex duplicate' }),
    student('b', { name: 'Alex' }),
  ]);
  assert.deepEqual(pool, [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Alex' }]);
  assert.equal(pickStudent(pool, () => 0)?.id, 'a');
  assert.equal(pickStudent(pool, () => 0.5)?.id, 'b');
});

void test('a single present student is selectable across the random range', () => {
  const pool = eligiblePickerStudents([student('only')]);
  for (const roll of [0, 0.5, 1 - Number.EPSILON]) {
    assert.deepEqual(pickStudent(pool, () => roll), { id: 'only', name: 'only' });
  }
});

void test('every student receives an equal interval of the random range including its boundaries', () => {
  const pool = eligiblePickerStudents(['a', 'b', 'c', 'd'].map((id) => student(id)));
  const rolls = [0, 0.25 - Number.EPSILON, 0.25, 0.5 - Number.EPSILON, 0.5, 0.75 - Number.EPSILON, 0.75, 1 - Number.EPSILON];
  assert.deepEqual(rolls.map((roll) => pickStudent(pool, () => roll)?.id), ['a', 'a', 'b', 'b', 'c', 'c', 'd', 'd']);
});

void test('repeat picks are independent and never shuffle or remove students from the pool', () => {
  const pool = Object.freeze(eligiblePickerStudents([student('a'), student('b'), student('c')]).map((pupil) => Object.freeze(pupil)));
  const before = JSON.stringify(pool);
  assert.equal(pickStudent(pool, () => 0.4)?.id, 'b');
  assert.equal(pickStudent(pool, () => 0.4)?.id, 'b');
  assert.equal(pickStudent(pool, () => 0.9)?.id, 'c');
  assert.equal(JSON.stringify(pool), before);
});
