import { blackHoleEffect } from './blackHole';
import { confettiEffect } from './confetti';
import { fairyEffect } from './fairy';
import { waveEffect } from './wave';
import { balloonEffect } from './balloons';
import { zipperEffect } from './zipper';
import { dragonEffect } from './dragon';
import type { RevealEffect } from './types';

// Add/remove one entry here to change the menu, random pool, and both screens.
export const revealEffects: readonly RevealEffect[] = [balloonEffect, zipperEffect, dragonEffect, blackHoleEffect, fairyEffect, waveEffect, confettiEffect];

export function resolveRevealEffect(selection: string, previousId?: string, random = Math.random): RevealEffect | null {
  if (selection === 'none' || revealEffects.length === 0) return null;
  if (selection !== 'surprise') return revealEffects.find((effect) => effect.id === selection) ?? null;
  const alternatives = revealEffects.filter((effect) => effect.id !== previousId);
  const pool = alternatives.length ? alternatives : revealEffects;
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
}
