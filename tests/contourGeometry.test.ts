import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trimContourLoops } from '../src/revealEffects/contourGeometry';
import type { Point } from '../src/revealEffects/sceneMotion';

const points = (...coordinates: [number, number][]): Point[] => coordinates.map(([x, y]) => ({ x, y }));

void test('the real foreleg offset keeps its endpoints and trims the inside elbow loop', () => {
  const input = points([344, 182], [319, 191], [297, 191], [307, 186], [326, 201], [340, 214]);
  const original = structuredClone(input);
  const output = trimContourLoops(input);
  assert.equal(output.length, 5);
  assert.deepEqual(output.slice(0, 2), input.slice(0, 2));
  assert.ok(Math.abs(output[2].x - 313 - 1 / 3) < 1e-10);
  assert.equal(output[2].y, 191);
  assert.deepEqual(output.slice(3), input.slice(4));
  assert.equal(output[0], input[0]);
  assert.equal(output.at(-1), input.at(-1));
  assert.deepEqual(input, original, 'input coordinates are never mutated');
});

void test('simple open contours, parallel segments, and degenerate inputs remain exact', () => {
  for (const input of [
    [], points([1, 2]), points([1, 2], [1, 2]),
    points([0, 0], [4, 0], [4, 4], [0, 4]),
    points([0, 0], [0, 0], [4, 0], [4, 4], [0, 4]),
    points([0, 0], [4, 1e-10], [4, 4], [0, 4 + 1e-10]),
    // Its implicit closing edge crosses the middle; the OPEN line does not.
    points([0, 0], [4, 0], [0, 4], [4, 4]),
  ]) {
    assert.deepEqual(trimContourLoops(input), input);
  }
});

void test('a crossing replaces only the traversed loop with the true intersection', () => {
  const input = points([0, 0], [4, 4], [0, 4], [4, 0], [6, 0]);
  assert.deepEqual(trimContourLoops(input), points([0, 0], [2, 2], [4, 0], [6, 0]));
  assert.deepEqual(trimContourLoops([...input].reverse()), points([6, 0], [4, 0], [2, 2], [0, 0]));
});

void test('multiple loops are removed completely and a second pass is inert', () => {
  const input = points([0, 0], [4, 4], [0, 4], [4, 0], [6, 0], [10, 4], [6, 4], [10, 0], [12, 0]);
  const output = trimContourLoops(input);
  assert.deepEqual(output, points([0, 0], [2, 2], [4, 0], [6, 0], [8, 2], [10, 0], [12, 0]));
  assert.deepEqual(trimContourLoops(output), output);
});

void test('nonadjacent endpoint touches and collinear retracing remove their enclosed excursion', () => {
  assert.deepEqual(trimContourLoops(points([0, 0], [4, 0], [4, 4], [2, 0], [6, 0])), points([0, 0], [2, 0], [6, 0]));
  assert.deepEqual(trimContourLoops(points([0, 0], [4, 0], [4, 3], [6, 0], [2, 0], [8, -2])), points([0, 0], [2, 0], [8, -2]));
  const closedExcursion = points([0, 0], [4, 0], [4, 4], [0, 0]);
  const output = trimContourLoops(closedExcursion);
  assert.deepEqual(output, points([0, 0], [0, 0]));
  assert.equal(output[0], closedExcursion[0]);
  assert.equal(output.at(-1), closedExcursion.at(-1));
});

void test('zero-length vertices near a crossing do not create nonfinite coordinates or prevent trimming', () => {
  const input = points([0, 0], [4, 4], [4, 4], [0, 4], [4, 0], [4, 0]);
  const output = trimContourLoops(input);
  assert.deepEqual(output, points([0, 0], [2, 2], [4, 0], [4, 0]));
  assert.ok(output.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)));
  assert.deepEqual(trimContourLoops(output), output);
});
