import assert from 'node:assert/strict';
import { describe as nodeDescribe, test as nodeTest } from 'node:test';
import {
  calendarMonth,
  shiftCalendarMonth,
  shiftSchoolDay,
} from '../src/dateNavigation';

function describe(name: string, body: () => void) {
  void nodeDescribe(name, body);
}

function test(name: string, body: () => void) {
  void nodeTest(name, body);
}

describe('schedule date navigation', () => {
  test('moves between weekdays one school day at a time', () => {
    assert.equal(shiftSchoolDay('2026-08-31', 1), '2026-09-01');
    assert.equal(shiftSchoolDay('2026-09-01', -1), '2026-08-31');
  });

  test('skips Saturday and Sunday in either direction', () => {
    assert.equal(shiftSchoolDay('2026-08-28', 1), '2026-08-31');
    assert.equal(shiftSchoolDay('2026-08-31', -1), '2026-08-28');
  });

  test('moves calendar months across year boundaries', () => {
    assert.equal(shiftCalendarMonth('2026-12', 1), '2027-01');
    assert.equal(shiftCalendarMonth('2026-01', -1), '2025-12');
  });

  test('builds the correct dated cells for a leap-year month', () => {
    const month = calendarMonth('2028-02');
    assert.equal(month.dates.length, 29);
    assert.equal(month.dates[0], '2028-02-01');
    assert.equal(month.dates.at(-1), '2028-02-29');
    assert.equal(month.leadingBlanks, 2);
  });
});
