// Squishy bounce choreography: one table of beats drives the buddy's CSS
// keyframes, the pillows' hit/splat patterns and the premixed sound cue sheet,
// so all three stay in sync. Pure module: no DOM, React or CSS imports.

export const SQUISHY_DURATION_MS = 7300;
/** Duration in seconds; every key time below is in seconds from the click. */
export const DURATION = SQUISHY_DURATION_MS / 1000;

/** Six fixed landings. The WAV is premixed, so landing times never depend on layout. */
export const LANDINGS = [0.95, 1.35, 1.75, 2.15, 2.55, 2.95] as const;
export const HOP = 0.40;           // landing to landing
export const SINK = 0.10;          // pillow bottoms out; the buddy kicks off
export const DEEP_SINK = 0.12;     // the last landing loads the super jump
export const PEEK = 0.10;          // starts rising behind the footer
export const PEEKED = 0.30;
export const ENTRY = 0.55;         // anticipation crouch, then the entry sproing
export const TAKEOFF = LANDINGS[5] + DEEP_SINK; // 3.07
export const APEX = 3.42;
export const UH_OH = 3.48;
export const DROP = 3.90;
export const SPLAT = 4.08;
export const SPLAT_SPREAD = 0.30;  // centre-outward squash wave
export const HOLD = 0.76;          // squash -> launch, per pillow
/** Launch -> gone, per pillow: a quick rocket, so a lifting pillow clears its card's names about as soon as its bed has popped. */
export const FLY = 0.48;
/** The bed pops on the BOING itself (a quick puff, then it pops away into its centre), so no bare, pale bed is left behind a launched pillow. */
export const BED_POOF_DELAY = HOLD;// after that pillow's splat
export const BED_POOF = 0.14;
export const TOSS = SPLAT + HOLD;  // 4.84: the centre pillow launches and flips the pancake
/** The pancake pops up a little (TOSS_POP x B) for TOSS_UP seconds, then tumbles down beside the rising pillow. */
export const TOSS_UP = 0.14;
export const TOSS_POP = 0.3;
/** The flip starts a beat after the BOING, once the rising pillow's face is clear above the pancake. */
export const FLIP_DELAY = 0.1;
export const FLOOR = 5.45;
export const INFLATE = 5.58;
export const UNFLAT = 5.62;        // pancake face -> squeezed "puffing up" face, just after the reinflate starts
export const RELIEVED = 5.80;      // -> relieved face, once the body is round enough to read it
export const DIZZY = 4.22;         // stars circle the stunned pancake until the toss
export const ROUND = 6.10;
export const WINK = 6.58;
export const WINK_END = 6.88;
export const DUCK = 6.95;
export const GONE = 7.18;
/** Echo squishes (other rows, skipped columns) start at most this late after their landing. */
export const HIT_ECHO_CAP = 0.35;
/** Safety net: covers that never received a plan fade out here. */
export const SAFETY_FADE_AT = 6.5;
export const SAFETY_FADE = 0.3;

/** Last moment a card is still (partly) covered by its bed. */
export const REVEALED_BY = SPLAT + SPLAT_SPREAD + BED_POOF_DELAY + BED_POOF; // 5.28
/** Last moment any pillow is on screen. */
export const COVERS_GONE = SPLAT + SPLAT_SPREAD + HOLD + FLY; // 5.62

/** The premixed sound's quiet windows (the uh-oh hang and the charged hold). */
export const SILENT_WINDOWS = [[3.47, 3.86], [4.47, 4.80]] as const;
/** Visual beats the sound recipe is aligned to (seconds). */
export const SOUND_BEATS = {
  entry: ENTRY, landings: LANDINGS, superJump: TAKEOFF, dropWhoosh: DROP, splat: SPLAT, boing: TOSS - 0.04, plop: FLOOR, wink: WINK, duck: DUCK,
} as const;

export type Ease = 'lin' | 'out' | 'in' | 'io' | 'soft' | 'snap' | 'launch' | 'step';
type Bezier = readonly [number, number, number, number];
/** launch: a short ease-in that reaches full speed and holds it (a sprung pillow zooming off, not a slow lift-off). */
const BEZIER: Record<Exclude<Ease, 'lin' | 'step'>, Bezier> = {
  out: [.25, .46, .45, .94], in: [.55, .085, .68, .53], io: [.45, 0, .55, 1], soft: [.22, .61, .36, 1], snap: [.2, .9, .3, 1], launch: [.4, .1, .7, .7],
};
export const EASE: Record<Ease, string> = {
  lin: 'linear', step: 'step-end',
  ...Object.fromEntries(Object.entries(BEZIER).map(([name, points]) => [name, `cubic-bezier(${points.map((v) => String(v).replace(/^0./, '.')).join(',')})`])) as Record<keyof typeof BEZIER, string>,
};
/** The eased progress (0-1) of an easing at time fraction x, as the browser computes it (so the planner can predict a pose). */
export function easeAt(ease: Ease, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (ease === 'lin') return x;
  if (ease === 'step') return x >= 1 ? 1 : 0;
  const [x1, y1, x2, y2] = BEZIER[ease];
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let low = 0; let high = 1;
  for (let k = 0; k < 40; k++) { const mid = (low + high) / 2; if (at(x1, x2, mid) < x) low = mid; else high = mid; }
  return at(y1, y2, (low + high) / 2);
}
/** A pillow squashes with this easing on every hit, and rises back with the other; the buddy's feet use the same. */
export const HIT_SQUASH_EASE: Ease = 'snap';
export const HIT_RISE_EASE: Ease = 'soft';
/** [time in seconds, CSS value, easing towards the next key]. */
export type Key = readonly [time: number, value: string, ease?: Ease];

const round = (value: number, digits = 4) => +value.toFixed(digits);

export function keyframesCss(name: string, keys: readonly Key[], duration: number, property: string) {
  const body = keys.map(([time, value, ease]) =>
    `${round(time / duration * 100)}%{${property}:${value};${ease ? `animation-timing-function:${EASE[ease]}` : ''}}`).join('');
  return `@keyframes ${name}{${body}}`;
}

/** Splat hold: jiggle, then a trembling "charge" (offsets added to ssx/ssy). */
export const SPLAT_TREMBLE = { j: [-.05, .06], t1: [.02, -.015], t2: [.005, -.01], t3: [.025, -.025], t4: [.01, -.02], t5: [.035, -.035] } as const;
export type HoldKey = 'ss' | keyof typeof SPLAT_TREMBLE;
/** Every pillow's splat: squash (snap) to ss by 0.10 s, then these keys (io) until the BOING at HOLD. The buddy's Y rides the same keys. */
export const SPLAT_HOLD: readonly (readonly [time: number, key: HoldKey])[] = [[0.10, 'ss'], [0.16, 'j'], [0.24, 'ss'], [0.40, 't1'], [0.48, 't2'], [0.56, 't3'], [0.64, 't4'], [HOLD, 't5']];
export const SPLAT_SQUASH_EASE: Ease = 'snap';
export const SPLAT_HOLD_EASE: Ease = 'io';
/** The buddy's Y variable for a hold key: --sqb-ysplat (ss), --sqb-ysj, --sqb-yst1..5. */
export const holdVar = (key: HoldKey) => key === 'ss' ? 'ysplat' : `ys${key}`;

// ---------- Buddy tracks: feet position = translate; body = scale about the feet ----------
const tx = (name: string) => `translateX(var(--sqb-${name}))`;
const ty = (name: string) => `translateY(var(--sqb-${name}))`;
const sc = (x: number, y: number) => `scale(${x},${y})`;
const rot = (deg: number) => `rotate(${deg}deg)`;
/** The pancake flip: a whole turn in the direction of travel (+-360deg, planned). */
export const FLIP = 'rotate(var(--sqb-flip))';

export const BUDDY_X: readonly Key[] = (() => {
  const keys: Key[] = [[0, tx('xpeek')], [ENTRY, tx('xpeek'), 'lin'], [LANDINGS[0], tx('x1')]];
  for (let k = 1; k < 6; k++) keys.push([LANDINGS[k - 1] + SINK, tx(`x${k}`), 'lin'], [LANDINGS[k], tx(`x${k + 1}`)]);
  // The pancake toss carries it sideways to its resting spot on the footer (clear of every label there).
  keys.push([TAKEOFF, tx('x6'), 'io'], [APEX, tx('xm')], [TOSS, tx('xm'), 'out'], [FLOOR, tx('xrest')], [DURATION, tx('xrest')]);
  return keys;
})();

export const BUDDY_Y: readonly Key[] = (() => {
  const keys: Key[] = [[0, ty('yhide')], [PEEK, ty('yhide'), 'out'], [PEEKED, ty('ypeek')], [ENTRY, ty('ypeek'), 'out'], [0.80, ty('yentry'), 'in'], [LANDINGS[0], ty('yl1'), HIT_SQUASH_EASE]];
  // Every touchdown meets the rim where it is at that moment (--sqb-yl1..6: lower on a pillow's later hits), then rides it down to ys.
  for (let k = 0; k < 5; k++) {
    const land = LANDINGS[k];
    keys.push([land + SINK, ty(`ys${k + 1}`), 'out'], [land + SINK + (HOP - SINK) / 2, ty('yhop'), 'in'], [LANDINGS[k + 1], ty(`yl${k + 2}`), HIT_SQUASH_EASE]);
  }
  // The belly-flop rides the centre pillow's rim: same key times and easings as its splat squash and trembling hold.
  // The deep load: down with the pillow, then a little way back up with its rebound before the super jump.
  keys.push([LANDINGS[5] + SINK, ty('ys6'), HIT_RISE_EASE], [TAKEOFF, ty('ys6to'), 'out'], [APEX, ty('yapex'), 'io'], [3.66, ty('yfloat'), 'io'], [DROP, ty('yapex'), 'in'], [SPLAT, ty('yland'), SPLAT_SQUASH_EASE]);
  for (const [time, key] of SPLAT_HOLD) keys.push([SPLAT + time, ty(holdVar(key)), time === HOLD ? 'out' : SPLAT_HOLD_EASE]);
  keys.push([TOSS + TOSS_UP, ty('ytoss'), 'in'], [FLOOR, ty('yfloor')],
    [INFLATE, ty('yfloor'), 'io'], [ROUND, ty('yrest')], [6.25, ty('yrest'), 'out'], [6.33, ty('ywob'), 'in'], [6.41, ty('yrest')], [DUCK, ty('yrest'), 'in'], [GONE, ty('yduck')], [DURATION, ty('yduck')]);
  return keys;
})();

/** The belly-flop shape (x, y scale about the feet) and its impact peak. */
export const PANCAKE = [2.2, .38] as const;
/** The uh-oh "take": the buddy pops a little bigger so the look at the class reads from the back of the room. */
export const TAKE = 1.12;
export const PANCAKE_HIT = [2.45, .3] as const;

/**
 * Squash and stretch about the feet. Volume is roughly kept (x * y near 1) except in the pancake.
 * The falling stretch holds until the very frame the feet touch (a step), so the body never squashes against thin air.
 */
export const BUDDY_BODY: readonly Key[] = (() => {
  const keys: Key[] = [[0, sc(1, 1)], [PEEKED, sc(1, 1), 'io'], [0.345, sc(1.07, .93), 'io'], [0.39, sc(1, 1), 'io'], [0.435, sc(1.07, .93), 'io'], [0.48, sc(1, 1), 'out'],
    [ENTRY, sc(1.2, .78), 'snap'], [0.62, sc(.8, 1.25), 'out'], [0.80, sc(1, 1), 'in']];
  for (let k = 0; k < 5; k++) {
    const land = LANDINGS[k];
    keys.push([land - 0.03, sc(.88, 1.14), 'step'], [land, sc(1.32, .7), 'soft'], [land + SINK, sc(1.2, .8), 'snap'], [land + SINK + 0.07, sc(.85, 1.2), 'out'], [land + SINK + 0.15, sc(1, 1), 'in']);
  }
  keys.push([LANDINGS[5] - 0.03, sc(.88, 1.14), 'step'], [LANDINGS[5], sc(1.35, .66), 'soft'], [TAKEOFF, sc(1.5, .56), 'snap'], [TAKEOFF + 0.08, sc(.72, 1.38), 'out'], [APEX, sc(1, 1), 'io'], [UH_OH - 0.01, sc(1, 1), 'snap'], [UH_OH + 0.06, sc(TAKE * 1.03, TAKE * 1.03), 'io'],
    [3.60, sc(TAKE * .97, TAKE * 1.04), 'io'], [3.68, sc(TAKE * 1.04, TAKE * .96), 'io'], [3.78, sc(TAKE, TAKE)], [DROP, sc(TAKE, TAKE), 'in'], [SPLAT - 0.02, sc(.8, 1.25), 'step'],
    [SPLAT, sc(2.2, .36), 'out'], [SPLAT + 0.04, sc(PANCAKE_HIT[0], PANCAKE_HIT[1]), 'io'], [SPLAT + 0.12, sc(PANCAKE[0], PANCAKE[1])], [TOSS, sc(PANCAKE[0], PANCAKE[1]), 'io'], [TOSS + 0.10, sc(PANCAKE[0] * .94, PANCAKE[1] * 1.08), 'io'],
    [FLOOR - 0.05, sc(PANCAKE[0], PANCAKE[1]), 'step'], [FLOOR, sc(PANCAKE_HIT[0], PANCAKE_HIT[1] * .96), 'io'], [FLOOR + 0.07, sc(PANCAKE[0], PANCAKE[1])],
    [INFLATE, sc(PANCAKE[0], PANCAKE[1]), 'soft'], [ROUND, sc(1.1, .9), 'io'], [6.22, sc(.93, 1.08), 'io'], [6.34, sc(1.05, .96), 'io'], [6.46, sc(.98, 1.02), 'io'], [6.55, sc(1, 1)],
    [6.60, sc(1, 1), 'io'], [6.66, sc(1.05, .95), 'io'], [6.74, sc(1, 1)], [DUCK, sc(1, 1), 'io'], [7.0, sc(1.15, .86), 'snap'], [7.08, sc(.9, 1.12), 'out'], [GONE, sc(1, 1)], [DURATION, sc(1, 1)]);
  return keys;
})();

/** Lean into each hop (travel is left to right), then the pancake flip. */
export const BUDDY_SPIN: readonly Key[] = (() => {
  const keys: Key[] = [[0, rot(0)], [ENTRY, rot(0), 'out'], [0.66, rot(6), 'io'], [LANDINGS[0] - 0.04, rot(-4), 'out'], [LANDINGS[0], rot(0)]];
  for (let k = 0; k < 5; k++) {
    const land = LANDINGS[k];
    keys.push([land + SINK, rot(0), 'out'], [land + SINK + 0.08, rot(7), 'io'], [LANDINGS[k + 1] - 0.04, rot(-4), 'out'], [LANDINGS[k + 1], rot(0)]);
  }
  keys.push([TAKEOFF, rot(0), 'io'], [TAKEOFF + 0.12, rot(-5), 'io'], [APEX, rot(0)], [TOSS + FLIP_DELAY, rot(0), 'io'], [FLOOR - 0.05, FLIP], [DURATION, FLIP]);
  return keys;
})();

export type BuddyFace = 'happy' | 'sly' | 'whee' | 'squint' | 'ready' | 'uhoh' | 'fall' | 'pancake' | 'relieved' | 'wink';
/** The eyes squeeze shut a frame before each touchdown (bracing for it), so the contact frame always shows the landing face. */
export const FACE_LEAD = 0.02;
/** Face intervals [start, end) in seconds. Faces swap with step-end opacity; exactly one is visible. */
export const BUDDY_FACES: Record<BuddyFace, readonly (readonly [number, number])[]> = {
  happy: [[0, PEEKED], [ROUND, WINK], [WINK_END, DURATION]],
  sly: [[PEEKED, ENTRY]],
  whee: [[ENTRY, LANDINGS[0] - FACE_LEAD], ...LANDINGS.slice(0, 5).map((land, k) => [land + SINK, LANDINGS[k + 1] - FACE_LEAD] as const), [TAKEOFF, UH_OH]],
  squint: [...LANDINGS.slice(0, 5).map((land) => [land - FACE_LEAD, land + SINK] as const), [UNFLAT, RELIEVED]],
  ready: [[LANDINGS[5] - FACE_LEAD, TAKEOFF]],
  uhoh: [[UH_OH, DROP]],
  fall: [[DROP, SPLAT]],
  pancake: [[SPLAT, UNFLAT]],
  relieved: [[RELIEVED, ROUND]],
  wink: [[WINK, WINK_END]],
};
/** Extra art layers with their own visibility windows (speed lines, sweat). */
export const BUDDY_EXTRAS: Record<'rise' | 'fall' | 'dizzy', readonly (readonly [number, number])[]> = {
  rise: [[TAKEOFF + 0.02, TAKEOFF + 0.24]],
  fall: [[DROP + 0.05, SPLAT]],
  dizzy: [[DIZZY, TOSS]],
};

export function faceAt(time: number): BuddyFace | undefined {
  return (Object.keys(BUDDY_FACES) as BuddyFace[]).find((face) => BUDDY_FACES[face].some(([start, end]) => time >= start && time < end || time === DURATION && end === DURATION));
}

function visibilityKeys(intervals: readonly (readonly [number, number])[]): Key[] {
  const keys: Key[] = [[0, intervals.some(([start]) => start === 0) ? '1' : '0', 'step']];
  for (const [start, end] of intervals) { if (start > 0) keys.push([start, '1', 'step']); if (end < DURATION) keys.push([end, '0', 'step']); }
  keys.sort((a, b) => a[0] - b[0]);
  keys.push([DURATION, keys[keys.length - 1][1], 'step']);
  return keys;
}

/** Contact shadow on the pillow: grounded = 1, hop apex = .5, uh-oh = .4, "incoming!" = 1.1. */
export const SHADOW: readonly Key[] = (() => {
  const s = (scale: number, opacity: number) => `scale(${scale}); opacity:${opacity}`;
  const keys: Key[] = [[0, s(.3, 0)], [0.74, s(.3, 0), 'in'], [LANDINGS[0], s(1, 1)]];
  for (let k = 0; k < 5; k++) keys.push([LANDINGS[k] + SINK, s(1, 1), 'out'], [LANDINGS[k] + SINK + (HOP - SINK) / 2, s(.5, .55), 'in'], [LANDINGS[k + 1], s(1, 1)]);
  keys.push([TAKEOFF, s(1, 1), 'out'], [APEX, s(.4, .45)], [DROP, s(.42, .5), 'in'], [SPLAT - 0.01, s(1.05, 1), 'step'], [SPLAT, s(1.1, 0)], [DURATION, s(1.1, 0)]);
  return keys;
})();
export const SHADOW_Y: readonly Key[] = (() => {
  // The shadow lies on the rim under the buddy: on each touchdown rim, down with the sink, then over to the next touchdown rim.
  const keys: Key[] = [[0, ty('yl1')]];
  for (let k = 0; k < 6; k++) keys.push([LANDINGS[k], ty(`yl${k + 1}`), 'snap'], [LANDINGS[k] + SINK, ty(`ys${k + 1}`), 'soft'], [LANDINGS[k] + 0.34, ty(k < 5 ? `yl${k + 2}` : 'yland')]);
  keys.push([DURATION, ty('yland')]);
  return keys;
})();

// ---------- Pillow patterns (durations per pattern, delays per cover) ----------
export const HIT_PATTERNS = [1, 2, 3, 6] as const;
export type HitPattern = typeof HIT_PATTERNS[number];
/** Recovered fractions for the partial keys (1 - (1 - s)(1 - f)). */
export const RECOVER = { p: .72, g: .55, h: .80, i: .92 } as const;
/** After its last hit a pillow rises to the g key in this long. */
export const RECOVER_TO_G = 0.16;
/** How much of its dip the last pillow has won back when the buddy takes off for the super jump (it rides that rebound). */
export const DEEP_REBOUND = RECOVER.g * easeAt(HIT_RISE_EASE, (DEEP_SINK - SINK) / RECOVER_TO_G);
/** The tickled giggle wiggle after the last hit (degrees; the planner damps it for wide pillows). */
export const HIT_WIGGLE = [-1.6, 1.2, -.5] as const;
export const hitDuration = (m: number) => HOP * (m - 1) + SINK + 0.8;

/** m hits HOP apart: squash in SINK, slow ease-out rise; later hits catch the pillow at 72%. */
export function hitKeys(m: number): Key[] {
  const duration = hitDuration(m);
  const s = (name: string, turn = '0deg') => `scale(var(--sq-${name}x),var(--sq-${name}y)) rotate(${turn})`;
  const keys: Key[] = [[0, 'scale(1,1) rotate(0deg)', HIT_SQUASH_EASE]];
  for (let j = 0; j < m; j++) {
    const t = HOP * j;
    if (j > 0) keys.push([t, s('p'), HIT_SQUASH_EASE]);
    keys.push([t + SINK, s('s'), HIT_RISE_EASE]);
    if (j < m - 1) keys.push([t + HOP - 0.001, s('p')]);
    else keys.push([t + SINK + RECOVER_TO_G, s('g', 'var(--sq-r1)'), 'io'], [t + SINK + 0.30, s('h', 'var(--sq-r2)'), 'io'], [t + SINK + 0.46, s('i', 'var(--sq-r3)'), 'soft'], [duration, 'scale(1,1) rotate(0deg)']);
  }
  return keys;
}

/** Hit face strip frames: 0 sleepy, 1 squish, 2 awake (translateY in whole frames). */
export function faceHitKeys(m: number): Key[] {
  const keys: Key[] = [[0, 'translateY(0%)', 'step']];
  for (let j = 0; j < m; j++) keys.push([HOP * j + 0.001, 'translateY(-100%)', 'step'], [HOP * j + 0.24, 'translateY(-200%)', 'step']);
  keys.push([hitDuration(m), 'translateY(-200%)', 'step']);
  return keys;
}

export const SPLAT_DURATION = HOLD + FLY;
/** The BOING pose, 0.08 s after the hold: stretched (x, y about the pillow's bottom) and lifted by this share of the flight. */
export const BOING_STRETCH = [.84, 1.3] as const;
export const BOING_LIFT = .05;
/** The rocket flight after the BOING stretch. */
export const FLY_EASE: Ease = 'launch';
const splatScale = (name: string) => `translate(0px,0px) rotate(0deg) scale(var(--sq-${name}x),var(--sq-${name}y))`;
/** Per pillow: squash, jiggle, tremble (charge), BOING stretch, rocket up and away. */
export const SPLAT_KEYS: readonly Key[] = [
  [0, 'translate(0px,0px) rotate(0deg) scale(1,1); opacity:1', SPLAT_SQUASH_EASE],
  ...SPLAT_HOLD.map(([time, key]): Key => [time, splatScale(key), time === HOLD ? 'snap' : SPLAT_HOLD_EASE]),
  // The BOING kicks each pillow up (and, for popcorn cells, sideways with a tilt) before it rockets away.
  [HOLD + 0.08, `translate(var(--sq-drift0),var(--sq-fly0)) rotate(var(--sq-spin0)) scale(${BOING_STRETCH[0]},${BOING_STRETCH[1]})`, FLY_EASE],
  [HOLD + FLY - 0.05, 'translate(var(--sq-drift),var(--sq-fly)) rotate(var(--sq-spin)) scale(.92,1.14); opacity:1'],
  [HOLD + FLY, 'translate(var(--sq-drift),var(--sq-fly)) rotate(var(--sq-spin)) scale(.92,1.14); opacity:0'],
];
/** Splat face strip: 0 = hit strip, 1 squish, 2 wide-eyed, 3 joy. */
export const FACE_SPLAT_KEYS: readonly Key[] = [[0, 'translateY(0%)', 'step'], [0.001, 'translateY(-100%)', 'step'], [0.30, 'translateY(-200%)', 'step'], [HOLD, 'translateY(-300%)', 'step'], [SPLAT_DURATION, 'translateY(-300%)', 'step']];

// ---------- One-shot FX on the stage ----------
const ms = (seconds: number) => `${Math.round(seconds * 1000)}ms`;
/** Landing impact strokes pop at the feet and are gone by L + IMPACT. */
export const IMPACT = 0.15;
export const STAR = 0.34;
/** The shock ring reaches each card as it squashes: radius = ring * (t - SPLAT) / SPLAT_SPREAD, drawn from SHOCK_FROM of it. */
export const SHOCK = SPLAT_SPREAD;
export const SHOCK_FROM = 0.12;
/** A second, thinner ring trails the first so the squash reads as a wave. */
export const SHOCK_ECHO = 0.06;
export const DROPS = 0.56;
export const SPARKLE_AT = 6.60;
export const SPARKLE = 0.25;
/** Dizzy stars: an ellipse orbit made of two alternating sines a quarter cycle apart. */
export const ORBIT_HALF = 0.28;
export const ORBITERS = 3;
/** Sleepy "z Z" puffs over each pillow before the first landing (the second one lags by Z_LAG). */
export const Z_START = 0.05;
export const Z_STAGGER = 0.05;
export const Z_LAG = 0.12;
export const Z_DURATION = 0.62;
/** Sleepy breathing: half-cycles of BREATH, an even count per pillow (planned) so it settles on the rest pose exactly when that pillow is first hit. */
export const BREATH = 1.3;
/** Covers shorter than this skip breathing (a 1.5 px swell on a Today cell is invisible). */
export const BREATHE_MIN_HEIGHT = 100;

/**
 * Every choreography rule and keyframe for the effect. It is committed as a
 * generated block inside squishyBounce.css (static CSS: nothing is inserted at
 * reveal time) and a test keeps the two identical.
 */
export function squishyKeyframesCss(): string {
  const D = ms(DURATION);
  const ready = '.sqb-stage[data-sq-ready]';
  const cover = '.sq-cover[data-sq-ready]';
  const faces = Object.keys(BUDDY_FACES) as BuddyFace[];
  const extras = Object.keys(BUDDY_EXTRAS) as (keyof typeof BUDDY_EXTRAS)[];
  const rules = [
    `${ready} .sqb-x{animation:sqb-x ${D} linear both}`,
    `${ready} .sqb-y{animation:sqb-y ${D} linear both}`,
    `${ready} .sqb-spin{animation:sqb-spin ${D} linear both}`,
    `${ready} .sqb-body{animation:sqb-body ${D} linear both}`,
    `${ready} .sqb-shadow-y{animation:sqb-shadow-y ${D} linear both}`,
    `${ready} .sqb-shadow{animation:sqb-shadow ${D} linear both}`,
    ...faces.map((face) => `${ready} .sqb-face-${face}{animation:sqb-face-${face} ${D} step-end both}`),
    ...extras.map((extra) => `${ready} .sqb-extra-${extra}{animation:sqb-extra-${extra} ${D} step-end both}`),
    // forwards only: before its landing an impact mark keeps its hidden base style.
    ...LANDINGS.map((land, k) => `${ready} .sqb-impact-${k + 1}{animation:sqb-impact ${ms(IMPACT)} ease-out ${ms(land)} forwards}`),
    `${ready} .sqb-shock{animation:sqb-shock ${ms(SHOCK * (1 - SHOCK_FROM))} linear ${ms(SPLAT + SHOCK * SHOCK_FROM)} both}`,
    `${ready} .sqb-shock-2{animation:sqb-shock ${ms(SHOCK * (1 - SHOCK_FROM))} linear ${ms(SPLAT + SHOCK * SHOCK_FROM + SHOCK_ECHO)} both}`,
    `${ready} .sqb-star{animation:sqb-star ${ms(STAR)} linear ${ms(SPLAT)} both}`,
    `${ready} .sqb-drop{animation:sqb-drop ${ms(DROPS)} cubic-bezier(.2,.7,.4,1) ${ms(SPLAT)} both}`,
    `${ready} .sqb-sparkle{animation:sqb-sparkle ${ms(SPARKLE)} linear ${ms(SPARKLE_AT)} both}`,
    ...Array.from({ length: ORBITERS }, (_, k) => {
      const start = DIZZY - (k * 2 * ORBIT_HALF) / ORBITERS;
      const iterations = Math.ceil((TOSS - start) / ORBIT_HALF) + 1;
      return `${ready} .sqb-orbit-${k + 1}{animation:sqb-orbit-x ${ms(ORBIT_HALF)} ease-in-out ${ms(start)} ${iterations} alternate both}\n`
        + `${ready} .sqb-orbit-${k + 1}>svg{animation:sqb-orbit-y ${ms(ORBIT_HALF)} ease-in-out ${ms(start - ORBIT_HALF / 2)} ${iterations + 1} alternate both}`;
    }),
    ...HIT_PATTERNS.map((m) => `${cover}[data-sq-hits="${m}"] .sq-hits{animation:sq-hits-${m} ${ms(hitDuration(m))} linear var(--sq-hit-at) both}`),
    ...HIT_PATTERNS.map((m) => `${cover}[data-sq-hits="${m}"] .sq-face-hits{animation:sq-face-hits-${m} ${ms(hitDuration(m))} step-end var(--sq-hit-at) both}`),
    `${cover} .sq-splat{animation:sq-splat ${ms(SPLAT_DURATION)} linear var(--sq-splat-at) both}`,
    `${cover} .sq-face-splat{animation:sq-face-splat ${ms(SPLAT_DURATION)} step-end var(--sq-splat-at) both}`,
    `${cover} .sq-bed{animation:sq-bed-poof ${ms(BED_POOF)} linear var(--sq-bed-at) both}`,
    `${cover}[data-sq-breathe] .sq-breathe{animation:sq-breathe ${ms(BREATH)} ease-in-out var(--sq-breathe-at) var(--sq-breaths) alternate both}`,
    `${cover} .sq-breathe::before{animation:sq-z ${ms(Z_DURATION)} ease-out var(--sq-z-at) both}`,
    `${cover} .sq-breathe::after{animation:sq-z ${ms(Z_DURATION)} ease-out var(--sq-z2-at) both}`,
    `.sq-cover:not([data-sq-ready]){animation:sq-safety-fade ${ms(SAFETY_FADE)} ease-in ${ms(SAFETY_FADE_AT)} both}`,
  ];
  const keyframes = [
    keyframesCss('sqb-x', BUDDY_X, DURATION, 'transform'),
    keyframesCss('sqb-y', BUDDY_Y, DURATION, 'transform'),
    keyframesCss('sqb-body', BUDDY_BODY, DURATION, 'transform'),
    keyframesCss('sqb-spin', BUDDY_SPIN, DURATION, 'transform'),
    keyframesCss('sqb-shadow-y', SHADOW_Y, DURATION, 'transform'),
    keyframesCss('sqb-shadow', SHADOW, DURATION, 'transform'),
    ...faces.map((face) => keyframesCss(`sqb-face-${face}`, visibilityKeys(BUDDY_FACES[face]), DURATION, 'opacity')),
    ...extras.map((extra) => keyframesCss(`sqb-extra-${extra}`, visibilityKeys(BUDDY_EXTRAS[extra]), DURATION, 'opacity')),
    ...HIT_PATTERNS.map((m) => keyframesCss(`sq-hits-${m}`, hitKeys(m), hitDuration(m), 'transform')),
    ...HIT_PATTERNS.map((m) => keyframesCss(`sq-face-hits-${m}`, faceHitKeys(m), hitDuration(m), 'transform')),
    keyframesCss('sq-splat', SPLAT_KEYS, SPLAT_DURATION, 'transform'),
    keyframesCss('sq-face-splat', FACE_SPLAT_KEYS, SPLAT_DURATION, 'transform'),
  ];
  return [...rules, ...keyframes].join('\n');
}

export const GENERATED_BEGIN = '/* BEGIN GENERATED: squishyKeyframesCss() in squishyBounceTimeline.ts. Do not edit by hand. */';
export const GENERATED_END = '/* END GENERATED */';

/** Replace (or append) the generated block in the effect's stylesheet text. */
export function withGeneratedBlock(css: string): string {
  const block = `${GENERATED_BEGIN}\n${squishyKeyframesCss()}\n${GENERATED_END}`;
  const start = css.indexOf(GENERATED_BEGIN);
  const end = css.indexOf(GENERATED_END);
  if (start < 0 || end < start) return `${css.trimEnd()}\n\n${block}\n`;
  return css.slice(0, start) + block + css.slice(end + GENERATED_END.length);
}
