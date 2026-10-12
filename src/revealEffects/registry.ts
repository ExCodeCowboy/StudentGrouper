import { moonEffect } from './moon';
import { blackHoleEffect } from './blackHole';
import { pixelQuestEffect } from './pixelQuest';
import { blockMineEffect } from './blockMine';
import { dotToDotEffect } from './dotToDot';
import { dinoEggEffect } from './dinoEgg';
import { wizardEffect } from './wizard';
import { squishyBounceEffect } from './squishyBounce';
import { catEffect } from './cat';
import { balloonEffect } from './balloons';
import { fairyEffect } from './fairy';
import { waveEffect } from './wave';
import { confettiEffect } from './confetti';
import type { RevealEffect } from './types';

// Add/remove one entry here to change the menu, random pool, and both screens.
export const revealEffects: readonly RevealEffect[] = [
  moonEffect, blackHoleEffect, pixelQuestEffect, blockMineEffect, dotToDotEffect, dinoEggEffect, wizardEffect,
  squishyBounceEffect, catEffect, balloonEffect, fairyEffect, waveEffect, confettiEffect,
];

export function resolveRevealEffect(selection: string, previousId?: string, random = Math.random): RevealEffect | null {
  if (selection === 'none' || revealEffects.length === 0) return null;
  if (selection !== 'surprise') return revealEffects.find((effect) => effect.id === selection) ?? null;
  const alternatives = revealEffects.filter((effect) => effect.id !== previousId);
  const pool = alternatives.length ? alternatives : revealEffects;
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
}
