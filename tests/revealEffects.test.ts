import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveRevealEffect, revealEffects } from '../src/revealEffects/registry';
import { MOON_DURATION_MS } from '../src/revealEffects/moonTimeline';

/** Every reveal plays in under ten seconds, so the class is never kept waiting for the groups. */
const MAX_REVEAL_MS = 9800;

void test('each registered reveal is selectable and completes within its brief presentation window', () => {
  assert.deepEqual(revealEffects.map((effect) => effect.id), [
    'moon', 'black-hole', 'pixel-quest', 'block-mine', 'dot-to-dot', 'dino-egg', 'wizard', 'squishy-bounce', 'cat', 'balloons', 'fairy', 'wave', 'confetti',
  ]);
  for (const effect of revealEffects) {
    assert.equal(resolveRevealEffect(effect.id), effect);
    assert.ok(effect.durationMs > 0 && effect.durationMs <= MAX_REVEAL_MS, `${effect.id}: ${effect.durationMs} ms`);
    assert.equal(typeof effect.Stage, 'function');
    assert.equal(typeof effect.Cover, 'function');
  }
});

// The cat's own contract (duration, covers, poses) lives in tests/reveal-cat.test.ts.
void test('the illustrated stories finish within playback', () => {
  assert.equal(resolveRevealEffect('moon')?.durationMs, MOON_DURATION_MS);
});

void test('surprise reveals never immediately repeat and can reach every other registered effect', () => {
  for (const previous of revealEffects) {
    const choices = new Set(Array.from({ length: 100 }, (_, index) => resolveRevealEffect('surprise', previous.id, () => index / 100)?.id));
    assert.ok(!choices.has(previous.id));
    assert.deepEqual(choices, new Set(revealEffects.filter((effect) => effect.id !== previous.id).map((effect) => effect.id)));
  }
});

void test('off and removed effects resolve to no animation', () => {
  assert.equal(resolveRevealEffect('none'), null);
  assert.equal(resolveRevealEffect('removed-effect'), null);
});
