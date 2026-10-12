/** Small, deterministic motion helpers shared by the illustrated reveals. */
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export const progress = (time: number, start: number, end: number) => clamp01((time - start) / (end - start));
export const smooth = (value: number) => { const x = clamp01(value); return x * x * (3 - 2 * x); };
export const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
export const fadeWindow = (time: number, start: number, full: number, out: number, end: number) => smooth(progress(time, start, full)) * (1 - smooth(progress(time, out, end)));

export type Point = { x: number; y: number };

/** A two-bone limb: its paw follows the ground, rather than rotating with the leg. */
export function kneeBetween(hip: Point, foot: Point, upper: number, lower: number, bend: number): Point {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  const distance = Math.max(.001, Math.hypot(dx, dy));
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const across = Math.sqrt(Math.max(0, upper * upper - along * along));
  return { x: hip.x + dx / distance * along + dy / distance * across * bend, y: hip.y + dy / distance * along - dx / distance * across * bend };
}

/** Keyframed value: [time, value] pairs, eased with smoothstep between neighbours. */
export function keyframes(time: number, keys: readonly (readonly [number, number])[]): number {
  if (time <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (time <= keys[i][0]) return mix(keys[i - 1][1], keys[i][1], smooth(progress(time, keys[i - 1][0], keys[i][0])));
  }
  return keys[keys.length - 1][1];
}

/** Overshoots slightly past 1 before settling: pops, landings, cartoon arrivals. */
export const easeOutBack = (value: number, overshoot = 1.7) => { const x = clamp01(value) - 1; return 1 + (overshoot + 1) * x * x * x + overshoot * x * x; };
export const easeInOutCubic = (value: number) => { const x = clamp01(value); return x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };
export const easeOutCubic = (value: number) => 1 - (1 - clamp01(value)) ** 3;
export const easeInCubic = (value: number) => clamp01(value) ** 3;

/** Deterministic pseudo-random sequence (mulberry32): the same art on every screen and frame. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
