import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveRevealEffect, revealEffects } from '../src/revealEffects/registry';

void test('each registered reveal is selectable and completes within its brief presentation window', () => {
  assert.equal(new Set(revealEffects.map((effect) => effect.id)).size, revealEffects.length);
  for (const effect of revealEffects) {
    assert.equal(resolveRevealEffect(effect.id), effect);
    assert.ok(effect.durationMs > 0 && effect.durationMs <= (effect.id === 'fairy' ? 3200 : 3000));
    assert.equal(typeof effect.Stage, 'function');
    assert.equal(typeof effect.Cover, 'function');
  }
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
