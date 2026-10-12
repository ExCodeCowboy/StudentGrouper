import { useLayoutEffect, useState } from 'react';

/** A card being revealed, in viewport pixels. */
export type RevealTarget = { left: number; top: number; width: number; height: number; centerX: number; centerY: number; index: number; count: number };

const coverSelector = '.reveal-cover';

/**
 * Measure every mounted cover in one read pass, then write their positional
 * custom properties in one write pass. `index` orders cards by horizontal
 * center (then top), so a left-to-right sweep can time each card.
 */
export function measureRevealCovers(): RevealTarget[] {
  const covers = Array.from(document.querySelectorAll<HTMLElement>(coverSelector));
  const rects = covers.map((cover) => cover.getBoundingClientRect());
  const order = covers.map((_, index) => index).sort((a, b) =>
    (rects[a].left + rects[a].width / 2) - (rects[b].left + rects[b].width / 2) || rects[a].top - rects[b].top);
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const targets: RevealTarget[] = [];
  order.forEach((coverIndex, index) => {
    const rect = rects[coverIndex];
    const target = { left: rect.left, top: rect.top, width: rect.width, height: rect.height, centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2, index, count: covers.length };
    targets.push(target);
    const style = covers[coverIndex].style;
    style.setProperty('--reveal-cover-left', `${rect.left}px`);
    style.setProperty('--reveal-cover-top', `${rect.top}px`);
    style.setProperty('--reveal-cover-width', `${rect.width}px`);
    style.setProperty('--reveal-cover-height', `${rect.height}px`);
    style.setProperty('--reveal-target-x', `${width * .5 - target.centerX}px`);
    style.setProperty('--reveal-target-y', `${height * .46 - target.centerY}px`);
    style.setProperty('--reveal-left', `${clamp(rect.left / width)}`);
    style.setProperty('--reveal-center-x', `${clamp(target.centerX / width)}`);
    style.setProperty('--reveal-center-y', `${clamp(target.centerY / height)}`);
    style.setProperty('--reveal-index', `${index}`);
    style.setProperty('--reveal-count', `${covers.length}`);
    style.setProperty('--reveal-order', `${covers.length > 1 ? index / (covers.length - 1) : .5}`);
    covers[coverIndex].dataset.revealMeasured = 'true';
  });
  return targets;
}

/**
 * For full-screen stages that aim at the cards (a hero jumping beneath each
 * block, an owl visiting each envelope). Covers mount in the same commit and
 * earlier in the tree, so they are measurable when the stage lays out.
 * Returns only cards that intersect the viewport, left to right.
 */
export function useRevealTargets(): RevealTarget[] {
  const [targets, setTargets] = useState<RevealTarget[]>([]);
  useLayoutEffect(() => {
    const update = () => setTargets(measureRevealCovers().filter((target) =>
      target.left + target.width > 0 && target.left < window.innerWidth && target.top + target.height > 0 && target.top < window.innerHeight));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return targets;
}
