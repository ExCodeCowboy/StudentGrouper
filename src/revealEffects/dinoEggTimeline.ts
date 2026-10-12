/**
 * Dino egg hatch: the whole choreography as data (no DOM, no CSS imports), so
 * tests can read the story. The stage's hero is a tree of pivot layers; each
 * layer's track is a list of keyed poses compiled once into CSS @keyframes.
 * Units: x/y in hero units (u, CSS var --u), r in degrees, xvw in vw, t in s.
 */
export const DINO_DURATION_MS = 7400;

/** The stage focal point (fractions of the viewport): the hero egg's middle, later the baby's face. */
export const DINO_FOCUS = { x: .5, y: .46 } as const;

/** The hero unit: `--u: clamp(.7px, min(.165vh, .125vw), 1.75px)`. */
export const DINO_UNIT = { vh: .165, vw: .125, min: .7, max: 1.75 } as const;
export const dinoUnit = (width: number, height: number) =>
  Math.min(DINO_UNIT.max, Math.max(DINO_UNIT.min, Math.min(height * DINO_UNIT.vh / 100, width * DINO_UNIT.vw / 100)));

/**
 * Rig pivots in u relative to the nest centre (which sits at 50vw, `nestY` of
 * the viewport height), y pointing down. Parents are listed in the stage tree.
 */
export const DINO_RIG = {
  nestY: .58,
  eggRock: [0, 20], eggTop: [0, -112], crack: [78, -110],
  babyX: [8, 26], hat: [0, -128], footNear: [26, -10], footFar: [-24, -10],
  dust: [34, 26], peep: [112, -126], boom: [196, -6], landDust: [0, 114],
  /** The shell chips start along the open seam. */
  chipY: -96,
  /** Eye pairs: the peeking eyes (egg-rock local) and the baby's eyes (body local), each ± eyeGap apart. */
  peekEyes: [26, -131], peekEyeGap: 14, babyEyes: [23, -95], babyEyeGap: 17,
  /**
   * Where the hop lands (baby-x + baby-y): down on the floor well in front of the nest, so in the
   * usual one-row layouts its blind moment happens below the freshly revealed names.
   */
  groundY: 140, hopX: 280,
  /** Visual extents used for bounds checks (u): the shell rises 88 above its rim; the tail reaches 140 behind the feet. */
  shellTop: -88, eggHeight: 200, babyLeft: -140,
} as const;

/** Card covers: every time is on the shared reveal clock (ms). */
export const DINO_COVER = {
  settleStagger: 300, settleDuration: 380,
  rockStart: 700, rockStagger: 400, rockEnd: 1850,
  crackAt: 2000,
  stompAt: 4800, joltDuration: 260,
  /** ts = stompAt + distance * rippleSpan: the gold ring reaches the card as it cracks. */
  rippleSpan: 700,
  /**
   * One egg's hatch, from ts: gap opens, eyes +180, happy +440, the head pops +480 as the top is tossed
   * away (topDuration; gone by +800), a little bounce +760, a duck into the shell +1000, sink +1060..+1480,
   * hidden +1500. Pop, bounce and duck are one keyframe run (dino-hatch, popAt..duckAt + duckDuration).
   */
  eyesAt: 180, happyAt: 440, popAt: 480, popDuration: 260, topDuration: 800,
  bounceAt: 760, bounceDuration: 240, duckAt: 1000, duckDuration: 140,
  sinkAt: 1060, sinkDuration: 420, local: 1500,
} as const;
/** The baby's pop, bounce and duck as one animation (ms): one transform animation per element keeps it on the compositor. */
export const DINO_HATCH_MS = DINO_COVER.duckAt + DINO_COVER.duckDuration - DINO_COVER.popAt;

/**
 * Story beats (s) the sound track lines up with; tests check the tracks hit them.
 * Sound cues in the recipe: knocks 2.44/2.61, POP 2.925-2.932, hat tik 3.205, peep 4.04,
 * BOOM 4.79-4.81, hop swish 6.16, landing 6.495, hat fwip 6.575, steps 6.855/6.955/7.045, pip-pip 7.13.
 */
export const DINO_BEATS = {
  heroLands: .54, crack: 2, wobbleRight: 2.53, wobbleLeft: 2.71, lidLifts: 2.72, peek: 2.74, pop: 2.95, hatLands: 3.22,
  breathStart: 3.4, roar: 3.9, peep: 4.05, stomp: 4.8, hopOff: 6.2, hopLands: 6.52, exitStart: 6.78, exitEnd: 7.4,
} as const;
/** How far the scurry carries the baby by the end (vw on top of the hop): off the right edge on every screen by ~7.28 s. */
export const DINO_EXIT_VW = 64;
/** The blind scurry: one foot lifts every 0.1 s from the exit start; each lands 0.1 s after it lifts (s). */
export const DINO_STEPS = { first: 6.78, every: .1, count: 6 } as const;
export const dinoFootfalls = () => Array.from({ length: DINO_STEPS.count }, (_, index) => Number((DINO_STEPS.first + (index + 1) * DINO_STEPS.every).toFixed(3)));

/**
 * Where the hero stands while the card eggs hatch, in hero units around the nest centre
 * (50vw, nestY): the baby with its hat and raised arms, the nest and the half shell.
 */
export const DINO_HERO_BOX = { left: -125, right: 115, top: -240, bottom: 58 } as const;
/** Eggs hidden more than this much (fraction of the egg's box) behind the hero move aside. */
export const DINO_OCCLUSION_LIMIT = .25;

/** Inline custom properties for every cover: dinoEgg.css reads its timing from these. */
export function dinoCoverVars(): Record<string, string> {
  const C = DINO_COVER;
  const ms = (value: number) => `${value}ms`;
  return {
    '--dino-settle': ms(C.settleDuration), '--dino-settle-stagger': ms(C.settleStagger),
    '--dino-rock-start': ms(C.rockStart), '--dino-rock-stagger': ms(C.rockStagger), '--dino-rock-span': ms(C.rockEnd - C.rockStart),
    '--dino-crack': ms(C.crackAt), '--dino-stomp': ms(C.stompAt), '--dino-jolt': ms(C.joltDuration), '--dino-ripple': ms(C.rippleSpan),
    '--dino-eyes': ms(C.eyesAt), '--dino-happy': ms(C.happyAt), '--dino-pop': ms(C.popAt), '--dino-hatch-dur': ms(DINO_HATCH_MS),
    '--dino-top-dur': ms(C.topDuration),
    '--dino-sink': ms(C.sinkAt), '--dino-sink-dur': ms(C.sinkDuration), '--dino-local': ms(C.local),
  };
}
/**
 * Room above a card egg (fraction of its height) for the baby's pop and bounce: at the top of the
 * bounce its head rises .18 and stretches .06 egg heights above the egg box (dino-hatch), so a short
 * card never clips it flat.
 */
export const DINO_HEADROOM = .24;

/** 0 at the focal point, 1 at half the viewport diagonal or beyond. */
export function dinoReach(width: number, height: number) { return Math.hypot(width, height) / 2; }
export function dinoDistance(centerX: number, centerY: number, width: number, height: number) {
  const reach = dinoReach(width, height);
  if (!(reach > 0) || !Number.isFinite(centerX) || !Number.isFinite(centerY)) return .5;
  return Math.min(1, Math.max(0, Math.hypot(centerX - width * DINO_FOCUS.x, centerY - height * DINO_FOCUS.y) / reach));
}

/**
 * Where a card's egg sits (mirrors the size/position rules in dinoEgg.css), in viewport px:
 * the ripple is timed from the egg, not the card centre (a lone card's egg sits at 20% of it).
 */
export type CardRect = { left: number; top: number; width: number; height: number };
/** A stage override for one egg (what --dino-egg-x / --dino-nest-y / --dino-egg-h say); fields left out use the CSS defaults. */
export type EggPlace = { xFraction?: number; nestY?: number; eggHeight?: number };
export function dinoEggCenter(card: CardRect, count: number, viewportHeight: number, place: EggPlace = {}) {
  const eggH = place.eggHeight ?? Math.min(card.height * .66, card.width * .8, viewportHeight * .24);
  // The egg top sits DINO_HEADROOM egg heights below the card top (or lower), the nest rim inside the card.
  const nestY = place.nestY ?? Math.max(card.height * .42, Math.min(eggH * (.89 + DINO_HEADROOM), card.height - eggH * .17));
  const eggX = place.xFraction ?? .5 - Math.min(1, Math.max(0, 2 - count)) * .3;
  return { x: card.left + card.width * eggX, y: card.top + nestY - eggH * .39, eggHeight: eggH, eggWidth: eggH * .78 };
}

/** The hero's screen rectangle (px) while the card eggs hatch. */
export function dinoHeroRect(width: number, height: number) {
  const u = dinoUnit(width, height);
  const x = width / 2; const y = height * DINO_RIG.nestY;
  return { left: x + DINO_HERO_BOX.left * u, right: x + DINO_HERO_BOX.right * u, top: y + DINO_HERO_BOX.top * u, bottom: y + DINO_HERO_BOX.bottom * u };
}

/** How much of an egg's box (0..1) the hero hides. */
export function dinoOcclusion(egg: { x: number; y: number; eggWidth: number; eggHeight: number }, hero: ReturnType<typeof dinoHeroRect>) {
  const w = Math.max(0, Math.min(egg.x + egg.eggWidth / 2, hero.right) - Math.max(egg.x - egg.eggWidth / 2, hero.left));
  const h = Math.max(0, Math.min(egg.y + egg.eggHeight / 2, hero.bottom) - Math.max(egg.y - egg.eggHeight / 2, hero.top));
  return egg.eggWidth > 0 && egg.eggHeight > 0 ? (w * h) / (egg.eggWidth * egg.eggHeight) : 0;
}

/**
 * Where a card's egg goes so the hero never hides its hatch: its usual spot; else the side of
 * the card the hero hides least (ties go to the side farther from the screen centre); else, on
 * a card too narrow for that, a smaller egg tucked into the card below (or above) the hero.
 * Every field but `egg` is null when the CSS default applies.
 */
export function dinoEggPlacement(card: CardRect, count: number, width: number, height: number) {
  const base = dinoEggCenter(card, count, height);
  const stay = { xFraction: null, nestY: null, eggHeight: null, egg: base };
  if (!(card.width > 0) || !(card.height > 0)) return stay;
  const hero = dinoHeroRect(width, height);
  const hidden = dinoOcclusion(base, hero);
  if (hidden <= DINO_OCCLUSION_LIMIT) return stay;
  // 1. Slide along the card, keeping the whole egg (plus a little straw) on it.
  const inset = Math.min(.5, Math.max(.18, (base.eggWidth / 2 + 6) / card.width));
  const towardLeft = card.left + card.width / 2 < width / 2;
  const sides = (towardLeft ? [inset, 1 - inset] : [1 - inset, inset]).map((xFraction) => {
    const egg = dinoEggCenter(card, count, height, { xFraction });
    return { xFraction, nestY: null, eggHeight: null, egg, hidden: dinoOcclusion(egg, hero) };
  });
  const side = sides[1].hidden < sides[0].hidden - .02 ? sides[1] : sides[0];
  if (side.hidden <= DINO_OCCLUSION_LIMIT) return side;
  // 2. Tuck it under (or over) the hero: the egg plus its nest rim spans 1.04 egg heights. Under the hero,
  //    the top of a bounce may dip behind the hero's nest (depth); over it, the card top needs headroom.
  const pad = 6;
  const rooms: [number, number, number][] = [
    [card.top + card.height - hero.bottom - 2 * pad, hero.bottom + pad, 0],
    [hero.top - card.top - 2 * pad, card.top + pad, DINO_HEADROOM],
  ];
  for (const [room, top, headroom] of rooms) {
    const eggHeight = Math.min(base.eggHeight, room / (1.04 + headroom));
    if (eggHeight >= Math.max(36, base.eggHeight * .5)) {
      const nestY = top + eggHeight * headroom - card.top + eggHeight * .89;
      return { xFraction: null, nestY, eggHeight, egg: dinoEggCenter(card, count, height, { nestY, eggHeight }) };
    }
  }
  return side.hidden < hidden ? side : stay;
}

/** Every cover beat for one card (mirrors dinoEgg.css), in ms on the shared clock. */
export function dinoCoverSchedule(order: number, distance: number) {
  const o = Math.min(1, Math.max(0, order));
  const d = Math.min(1, Math.max(0, distance));
  const C = DINO_COVER;
  const settleStart = o * C.settleStagger;
  const rockStart = C.rockStart + o * C.rockStagger;
  const rockDuration = C.rockEnd - C.rockStart - o * C.rockStagger;
  const ts = C.stompAt + d * C.rippleSpan;
  return {
    settleStart, settleEnd: settleStart + C.settleDuration,
    rockStart, rockEnd: rockStart + rockDuration, rockDuration,
    crackAt: C.crackAt, joltStart: C.stompAt, joltEnd: C.stompAt + C.joltDuration,
    ts, eyesAt: ts + C.eyesAt, happyAt: ts + C.happyAt, popAt: ts + C.popAt, popEnd: ts + C.popAt + C.popDuration,
    bounceAt: ts + C.bounceAt, bounceEnd: ts + C.bounceAt + C.bounceDuration, duckAt: ts + C.duckAt, duckEnd: ts + C.duckAt + C.duckDuration,
    sinkStart: ts + C.sinkAt, sinkEnd: ts + C.sinkAt + C.sinkDuration, hiddenAt: ts + C.local,
  };
}

/** The ring's radius as a fraction of the reach at time t (ms): linear over the ripple span. */
export function dinoRingRadius(ms: number) { return Math.min(1, Math.max(0, (ms - DINO_COVER.stompAt) / DINO_COVER.rippleSpan)); }

export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'back' | 'hold' | 'accel';
export type Key = { t: number; x?: number; y?: number; xvw?: number; r?: number; sx?: number; sy?: number; o?: number; e?: Ease };
export type Track = { layer: string; keys: Key[] };
export type Pose = { x: number; y: number; xvw: number; r: number; sx: number; sy: number; o: number };
export type ResolvedKey = Pose & { t: number; e: Ease };

export const DINO_EASINGS: Record<Ease, string> = {
  linear: 'linear', in: 'cubic-bezier(.55,0,1,.45)', out: 'cubic-bezier(0,.55,.45,1)',
  inOut: 'cubic-bezier(.65,0,.35,1)', back: 'cubic-bezier(.34,1.56,.64,1)', hold: 'steps(1,end)',
  /** A steady speed-up from standing (about t squared): the scurry off stage. */
  accel: 'cubic-bezier(.33,0,.67,.33)',
};
const BEZIERS: Partial<Record<Ease, [number, number, number, number]>> = {
  in: [.55, 0, 1, .45], out: [0, .55, .45, 1], inOut: [.65, 0, .35, 1], back: [.34, 1.56, .64, 1], accel: [.33, 0, .67, .33],
};

const REST: Pose = { x: 0, y: 0, xvw: 0, r: 0, sx: 1, sy: 1, o: 1 };
const POSE_FIELDS = ['x', 'y', 'xvw', 'r', 'sx', 'sy', 'o'] as const;

/** Keys inherit everything they do not change from the previous key. */
export function resolvePoses(keys: readonly Key[]): ResolvedKey[] {
  let pose: Pose = { ...REST };
  return keys.map((key) => {
    const next = { ...pose };
    for (const field of POSE_FIELDS) if (key[field] !== undefined) next[field] = key[field] as number;
    pose = next;
    return { ...pose, t: key.t, e: key.e ?? 'inOut' };
  });
}

/** Both ends pinned: a keyframe list without 0%/100% falls back to the element's own style. */
export function pinnedPoses(keys: readonly Key[], durationMs = DINO_DURATION_MS): ResolvedKey[] {
  const poses = resolvePoses(keys);
  if (poses[0].t > 0) poses.unshift({ ...poses[0], t: 0, e: 'hold' });
  const last = poses[poses.length - 1];
  if (last.t * 1000 < durationMs) poses.push({ ...last, t: durationMs / 1000 });
  return poses;
}

/** CSS cubic-bezier timing function, solved for x by Newton + bisection. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const ax = 3 * x1 - 3 * x2 + 1; const bx = 3 * x2 - 6 * x1; const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1; const by = 3 * y2 - 6 * y1; const cy = 3 * y1;
  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sampleY = (s: number) => ((ay * s + by) * s + cy) * s;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let s = x;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(s) - x;
      const slope = (3 * ax * s + 2 * bx) * s + cx;
      if (Math.abs(error) < 1e-7) return sampleY(s);
      if (Math.abs(slope) < 1e-6) break;
      s -= error / slope;
    }
    let lo = 0; let hi = 1; s = x;
    for (let i = 0; i < 40; i++) { const value = sampleX(s); if (Math.abs(value - x) < 1e-7) break; if (value < x) lo = s; else hi = s; s = (lo + hi) / 2; }
    return sampleY(s);
  };
}
const easeFns: Record<Ease, (p: number) => number> = {
  linear: (p) => p, hold: (p) => (p >= 1 ? 1 : 0),
  in: cubicBezier(...BEZIERS.in!), out: cubicBezier(...BEZIERS.out!), inOut: cubicBezier(...BEZIERS.inOut!), back: cubicBezier(...BEZIERS.back!),
  accel: cubicBezier(...BEZIERS.accel!),
};

/** The pose a layer shows at time t (s), exactly as the compiled keyframes interpolate it. */
export function samplePoses(poses: readonly ResolvedKey[], t: number): Pose {
  if (t <= poses[0].t) return pick(poses[0]);
  for (let i = 0; i < poses.length - 1; i++) {
    const a = poses[i]; const b = poses[i + 1];
    if (t < b.t) {
      const span = b.t - a.t;
      const eased = span > 0 ? easeFns[a.e]((t - a.t) / span) : 1;
      const pose = { ...REST };
      for (const field of POSE_FIELDS) pose[field] = a[field] + (b[field] - a[field]) * eased;
      return pose;
    }
  }
  return pick(poses[poses.length - 1]);
}
const pick = (pose: ResolvedKey): Pose => ({ x: pose.x, y: pose.y, xvw: pose.xvw, r: pose.r, sx: pose.sx, sy: pose.sy, o: pose.o });

const n = (value: number) => Number(value.toFixed(3));
/** Which transform parts a track ever uses: the others are left out of every keyframe (less to resolve and interpolate). */
type Parts = { vw: boolean; move: boolean; turn: boolean; size: boolean; fade: boolean };
const partsOf = (poses: readonly Pose[]): Parts => ({
  vw: poses.some((pose) => pose.xvw !== 0), move: poses.some((pose) => pose.x !== 0 || pose.y !== 0), turn: poses.some((pose) => pose.r !== 0),
  size: poses.some((pose) => pose.sx !== 1 || pose.sy !== 1), fade: poses.some((pose) => pose.o !== 1),
});
function transform(pose: Pose, parts: Parts) {
  const list = [
    parts.vw ? `translateX(${n(pose.xvw)}vw)` : '', parts.move ? `translate(calc(var(--u) * ${n(pose.x)}), calc(var(--u) * ${n(pose.y)}))` : '',
    parts.turn ? `rotate(${n(pose.r)}deg)` : '', parts.size ? `scale(${n(pose.sx)}, ${n(pose.sy)})` : '',
  ].filter(Boolean).join(' ');
  return list || 'none';
}

const samePose = (a: Pose, b: Pose) => POSE_FIELDS.every((field) => a[field] === b[field]);
/**
 * The stretch of a track where its layer actually moves (s). Its keyframes run only there (a delay, then
 * fill both on either side), so a layer at rest is never restyled frame by frame: before the window the
 * backwards fill shows the same first pose, after it the forwards fill holds the last one.
 */
export function activeWindow(keys: readonly Key[], durationMs = DINO_DURATION_MS) {
  const poses = pinnedPoses(keys, durationMs);
  let first = -1; let last = -1;
  for (let i = 1; i < poses.length; i++) if (!samePose(poses[i - 1], poses[i])) { if (first < 0) first = i - 1; last = i; }
  if (first < 0) return { start: 0, end: .001, poses: [{ ...poses[0], t: 0 }, { ...poses[0], t: .001 }] };
  // A held first pose only jumps at the next key: start the window 1 ms before that jump.
  const start = poses[first].e === 'hold' ? Math.max(poses[first].t, poses[first + 1].t - .001) : poses[first].t;
  const windowPoses: ResolvedKey[] = [{ ...poses[first], t: start }, ...poses.slice(first + 1, last + 1)];
  // End on 1 ms of the final pose held still: a live animation that finishes exactly at its end can evaluate a
  // closing steps() jump from the left (Chrome shows the pose before the jump), so the last change never sits at 100%.
  const end = Math.min(durationMs / 1000, poses[last].t + .001);
  if (end > poses[last].t) {
    windowPoses[windowPoses.length - 1] = { ...windowPoses[windowPoses.length - 1], e: 'linear' };
    windowPoses.push({ ...poses[last], t: end, e: 'linear' });
  }
  return { start, end, poses: windowPoses };
}

/** One `@keyframes dino-<layer>` per track (its active window only) plus its scoped animation rule. */
export function compileTracks(tracks: readonly Track[], durationMs = DINO_DURATION_MS, scope = '.dino-stage'): string {
  return tracks.map(({ layer, keys }) => {
    const { start, end, poses } = activeWindow(keys, durationMs);
    const span = end - start;
    const parts = partsOf(poses);
    const moves = parts.vw || parts.move || parts.turn || parts.size;
    const frames = poses.map((pose) => `${n((pose.t - start) / span * 100)}%{${moves ? `transform:${transform(pose, parts)};` : ''}${parts.fade ? `opacity:${n(pose.o)};` : ''}animation-timing-function:${DINO_EASINGS[pose.e]}}`).join('');
    return `@keyframes dino-${layer}{${frames}}${scope} .dino-${layer}{animation:dino-${layer} ${n(span * 1000)}ms linear ${n(start * 1000)}ms both}`;
  }).join('\n');
}

/** Alternating rotation keys (a wag or a waddle). */
function wag(from: number, to: number, period: number, amp: number, start = 1): Key[] {
  const keys: Key[] = [];
  let sign = start;
  for (let t = from; t < to - 1e-6; t += period / 2) { keys.push({ t: Number(t.toFixed(3)), r: amp * sign, e: 'inOut' }); sign = -sign; }
  return keys;
}

/** Foot lifts of the scurry, alternating near and far feet. */
const STEP_LIFTS = Array.from({ length: DINO_STEPS.count }, (_, index) => Number((DINO_STEPS.first + index * DINO_STEPS.every).toFixed(3)));
const WADDLE_NEAR = STEP_LIFTS.filter((_, index) => index % 2 === 0);
const WADDLE_FAR = STEP_LIFTS.filter((_, index) => index % 2 === 1);
/** baby-y on the floor after the hop (the floor is DINO_RIG.groundY, baby-y is relative to baby-x's pivot). */
const FLOOR = DINO_RIG.groundY - DINO_RIG.babyX[1];

/** The spotlight dim: fades in before the hero hatches, lifts with the stomp (s). */
export const DINO_SPOT = { inStart: 2.35, full: 2.6, outStart: 4.8, gone: 4.95 } as const;

/**
 * The hero egg: drops in last and heaviest, sits dead still through the wave, the double
 * wobble, then squashes while the lid is up and pops (the lip overlay replays these keys).
 */
const EGG_ROCK: Key[] = [
  { t: 0, y: -320, sx: .96, sy: 1.06, o: 0, e: 'hold' }, { t: .2, y: -320, o: 1, e: 'in' }, { t: .54, y: 0, sx: .96, sy: 1.06, e: 'out' },
  { t: .6, sx: 1.08, sy: .88, e: 'inOut' }, { t: .68, sx: .98, sy: 1.03 }, { t: .76, sx: 1, sy: 1 },
  { t: 2.45, r: 0, e: 'out' }, { t: 2.53, r: 8, e: 'inOut' }, { t: 2.62, r: 0, e: 'out' }, { t: 2.71, r: -8, e: 'inOut' }, { t: 2.8, r: 0 },
  { t: 2.84, sx: 1, sy: 1, e: 'out' }, { t: 2.93, sx: 1.07, sy: .9, e: 'linear' }, { t: 2.95, e: 'out' }, { t: 3.05, sx: 1, sy: 1 },
];
/** The half shell: squashed down as the baby springs off it, then it tips back and settles into the nest. */
const EGG_BOTTOM: Key[] = [
  { t: 0, e: 'hold' }, { t: 2.95, y: 0, r: 0, sx: 1, sy: 1, e: 'out' }, { t: 3.05, y: 6, r: -3, sx: 1.08, sy: .55, e: 'inOut' },
  { t: 3.18, y: 8, r: -12, sx: .97, sy: .88 }, { t: 3.32, y: 10, r: -6, sx: 1, sy: .82 }, { t: 3.46, y: 10, r: -8, sy: .85 },
];
/** When the lid hand-off happens: the flying top becomes the hat layer, which sits in front of the baby. */
export const DINO_HAND_OFF = 2.95;

/** Shell chips burst from the seam at the pop: start x (u), apex offset (x, y) at 3.07, end offset (x, y) at 3.34, spin (deg). */
export const DINO_CHIPS: readonly (readonly [number, number, number, number, number, number])[] = [
  [-62, -44, -60, -86, 40, -340], [-34, -30, -104, -52, -20, 300], [-8, -8, -128, -14, -46, -260],
  [20, 12, -122, 26, -40, 280], [48, 34, -96, 66, -6, -300], [72, 48, -52, 98, 44, 340],
];

/** The pop flash has twinkled away behind the baby (s). */
export const DINO_FLASH_OUT = 3.13;
/** The roar has been sucked back into the mouth (s), just before the mouth gulps. */
export const DINO_ROAR_LINES_OUT = 4.05;
/** The stomp rays reach their longest, then blink out within 30 ms (s). */
export const DINO_IMPACT_OUT = 4.97;
/** The roar mouth has shrunk into the peep's little "o" (s); the "o" takes over 5 ms later. */
export const DINO_ROAR_GULP = 4.11;
/** When the nest group starts to shrink away (s), as the baby is in the air above it; it is gone 0.305 s later. */
export const DINO_NEST_EXIT = 6.34;
/**
 * Stomp dust: one layer per puff group, pivoted at its own centre (rig units, relative to the nest
 * centre) so it can shrink away where it is. It starts `from` u back toward the foot and blooms outward.
 */
export const DINO_DUST = [
  { layer: 'dust-r', side: 1, at: 4.8, pos: [58, 38], from: 20 },
  { layer: 'dust-r2', side: 1, at: 4.825, pos: [94, 36], from: 44 },
  { layer: 'dust-l', side: -1, at: 4.8, pos: [-26, 38], from: 20 },
  { layer: 'dust-l2', side: -1, at: 4.825, pos: [-64, 36], from: 40 },
] as const;

/** Stage layers, in the order of the storyboard's section 3. Times in seconds. */
export const DINO_TRACKS: readonly Track[] = [
  // The whole hero rig: one short shake as the stomp lands.
  { layer: 'quake', keys: [
    { t: 0, e: 'hold' }, { t: 4.8, x: 0, y: 0, e: 'out' }, { t: 4.83, x: -2, y: 5, e: 'inOut' }, { t: 4.88, x: 2, y: -3 }, { t: 4.93, x: -1, y: 1.5 }, { t: 4.99, x: 0, y: 0 },
  ] },
  // Nest, egg and half shell fade as one group, so the parts never show through each other.
  { layer: 'nest-group', keys: [
    // Pops in opaque and grows with an overshoot (a fade-in would look like a ghost on the projector).
    { t: 0, sx: .3, sy: .3, o: 0, e: 'hold' }, { t: .02, sx: .3, sy: .3, o: 1, e: 'back' }, { t: .24, sx: 1, sy: 1 },
    // Gone as one opaque piece: a little squash, then it shrinks away into the straw (never a see-through nest).
    { t: DINO_NEST_EXIT, y: 0, sx: 1, sy: 1, o: 1, e: 'out' }, { t: DINO_NEST_EXIT + .08, y: 3, sx: 1.05, sy: .92, e: 'in' },
    { t: DINO_NEST_EXIT + .3, y: 16, sx: .1, sy: .07, e: 'hold' }, { t: DINO_NEST_EXIT + .305, o: 0 },
  ] },
  // Twig nest: jolts on the stomp.
  ...['nest-back', 'nest-front'].map((layer): Track => ({ layer, keys: [
    { t: 0, e: 'hold' }, { t: 4.8, y: 0, e: 'out' }, { t: 4.85, y: 5, e: 'inOut' }, { t: 4.96, y: 0 },
  ] })),
  { layer: 'egg-rock', keys: EGG_ROCK },
  // A burst of light behind the opening as the lid pops; it twinkles out (spins and shrinks away
  // behind the baby) rather than fading, so no see-through outlined star is left hanging.
  { layer: 'pop-flash', keys: [
    { t: 0, o: 0, sx: .3, sy: .3, e: 'hold' }, { t: 2.95, o: 1, sx: .35, sy: .35, e: 'out' }, { t: 3.05, r: 0, sx: 1.1, sy: 1.1, e: 'in' },
    { t: DINO_FLASH_OUT, r: 24, sx: .1, sy: .1, e: 'hold' }, { t: DINO_FLASH_OUT + .005, o: 0 },
  ] },
  // The lid jiggles on each knock, then lifts (hinged on the left) so the baby can peek out.
  { layer: 'egg-top', keys: [
    { t: 0, e: 'hold' },
    { t: 2.445, y: 0, r: 0, e: 'out' }, { t: 2.475, y: -6, r: -2, e: 'in' }, { t: 2.51, y: 0, r: 0, e: 'hold' },
    { t: 2.615, y: 0, r: 0, e: 'out' }, { t: 2.645, y: -7, r: -3, e: 'in' }, { t: 2.68, y: 0, r: 0, e: 'hold' },
    { t: 2.72, y: 0, r: 0, e: 'back' }, { t: 2.8, y: -32, r: -8, e: 'inOut' }, { t: 2.93, y: -34, r: -9, e: 'hold' }, { t: DINO_HAND_OFF, o: 0 },
  ] },
  // The first knock cracks the seam all the way round: both broken edges get their zigzag rim.
  ...['top-rim', 'bottom-rim'].map((layer): Track => ({ layer, keys: [{ t: 0, o: 0, e: 'hold' }, { t: 2.445, o: 1 }] })),
  // The dark inside of the egg with the baby's face, seen through the gap.
  { layer: 'peek', keys: [{ t: 0, o: 0, e: 'hold' }, { t: 2.44, o: 1, e: 'hold' }, { t: DINO_HAND_OFF, o: 0 }] },
  { layer: 'peek-eyes', keys: [
    { t: 0, o: 0, sy: .1, e: 'hold' }, { t: 2.74, o: 1, sy: .1, e: 'back' }, { t: 2.78, sy: 1, x: 0, e: 'inOut' }, { t: 2.82, x: -3, e: 'inOut' },
    { t: 2.845, sy: 1, e: 'inOut' }, { t: 2.865, sy: .1, e: 'inOut' }, { t: 2.885, sy: 1, e: 'inOut' }, { t: 2.93, x: 3 },
  ] },
  { layer: 'crack', keys: [{ t: 0, o: 0, sx: .3, e: 'hold' }, { t: 2, o: 1, e: 'out' }, { t: 2.07, sx: 1, e: 'hold' }, { t: 2.445, o: 0 }] },
  ...['egg-bottom-back', 'egg-bottom-front'].map((layer): Track => ({ layer, keys: EGG_BOTTOM })),
  // For the first 0.1 s of the pop the half shell and the nest rim are drawn in front of the
  // baby (an exact copy), so it springs up out of the shell instead of appearing in front of it.
  { layer: 'lip-group', keys: [{ t: 0, o: 0, e: 'hold' }, { t: DINO_HAND_OFF, o: 1, e: 'hold' }, { t: 3.05, o: 0 }] },
  { layer: 'lip-rock', keys: EGG_ROCK },
  { layer: 'lip-shell', keys: EGG_BOTTOM },
  ...DINO_CHIPS.map(([, ax, ay, ex, ey, spin], index): Track => ({ layer: `chip-${index + 1}`, keys: [
    { t: 0, o: 0, sx: .5, sy: .5, e: 'hold' }, { t: DINO_HAND_OFF, o: 1, sx: .5, sy: .5, e: 'out' },
    { t: 3.07, x: ax, y: ay, r: spin * .45, sx: 1.25, sy: 1.25, e: 'in' }, { t: 3.3, x: ex, y: ey, r: spin, sx: .2, sy: .2, e: 'hold' }, { t: 3.305, o: 0 },
  ] })),
  // Where the baby is: in the nest's front rim, a hop down to the floor in front of it, the exit.
  { layer: 'baby-x', keys: [{ t: 0, e: 'hold' }, { t: DINO_BEATS.hopOff, x: 0, e: 'linear' }, { t: DINO_BEATS.hopLands, x: DINO_RIG.hopX }] },
  // The blind scurry: from standing it speeds up steadily and is off the right edge before the end.
  { layer: 'baby-exit', keys: [{ t: 0, e: 'hold' }, { t: DINO_BEATS.exitStart, xvw: 0, e: 'accel' }, { t: DINO_BEATS.exitEnd, xvw: DINO_EXIT_VW }] },
  { layer: 'baby-y', keys: [
    { t: 0, e: 'hold' }, { t: 5.06, y: 0, e: 'out' }, { t: 5.12, y: -16, e: 'in' }, { t: 5.18, y: 0, e: 'hold' },
    { t: 5.31, y: 0, e: 'out' }, { t: 5.37, y: -16, e: 'in' }, { t: 5.43, y: 0, e: 'hold' },
    { t: 5.56, y: 0, e: 'out' }, { t: 5.62, y: -16, e: 'in' }, { t: 5.68, y: 0, e: 'hold' },
    // The hop: a short rise off the rim, then a longer drop down to the floor.
    { t: DINO_BEATS.hopOff, y: 0, e: 'out' }, { t: 6.31, y: -50, e: 'in' }, { t: DINO_BEATS.hopLands, y: FLOOR, e: 'hold' },
    ...STEP_LIFTS.flatMap((t): Key[] => [{ t, y: FLOOR, e: 'out' }, { t: Number((t + .05).toFixed(3)), y: FLOOR - 4, e: 'in' }]),
    { t: Number((STEP_LIFTS[STEP_LIFTS.length - 1] + DINO_STEPS.every).toFixed(3)), y: FLOOR },
  ] },
  { layer: 'shadow', keys: [
    { t: 0, o: 0, e: 'hold' }, { t: 3.1, o: 1, e: 'hold' }, { t: DINO_BEATS.hopOff, y: 0, sx: 1, sy: 1, e: 'out' }, { t: 6.31, y: 40, sx: .6, sy: .6, e: 'in' },
    { t: DINO_BEATS.hopLands, y: FLOOR, sx: 1, sy: 1 },
  ] },
  // Body squash, the big breath, the roar (leaning back), the deflating peep, the stomp and the proud wiggle.
  { layer: 'baby-body', keys: [
    { t: 0, e: 'hold' }, { t: 3.22, e: 'out' }, { t: 3.26, sx: 1.05, sy: .93, e: 'inOut' }, { t: 3.36, sx: 1, sy: 1 },
    { t: 3.4, r: 0, e: 'inOut' }, { t: 3.84, sx: 1.14, sy: 1.08, r: -5, e: 'out' }, { t: 3.9, sx: 1.05, sy: 1.16, r: -10, e: 'linear' },
    { t: 3.935, r: -9 }, { t: 3.97, r: -10.8 }, { t: 4.005, r: -9.2 }, { t: 4.05, r: -10, e: 'out' },
    { t: 4.16, sx: .95, sy: .97, r: 0, e: 'inOut' }, { t: 4.24, sx: 1.01, sy: 1 }, { t: 4.3, sx: .97, sy: .96, r: 3, e: 'hold' },
    { t: 4.52, sx: .97, sy: .96, r: 3, e: 'inOut' }, { t: 4.68, x: -5, sx: .98, sy: 1.06, r: -8, e: 'in' }, { t: 4.8, x: -1, sx: 1, sy: 1.02, r: -2, e: 'out' },
    { t: 4.84, x: 0, sx: 1.13, sy: .85, r: 0, e: 'inOut' }, { t: 4.94, sx: .96, sy: 1.05 }, { t: 5.03, sx: 1, sy: 1 },
    ...[5.15, 5.4, 5.65].flatMap((t): Key[] => [
      { t, sx: 1, sy: 1, e: 'out' }, { t: Number((t + .04).toFixed(3)), sx: 1.07, sy: .93 }, { t: Number((t + .11).toFixed(3)), sx: 1, sy: 1, r: 0 },
    ]),
    { t: 6.02, r: 0, e: 'inOut' }, { t: 6.18, sx: 1.06, sy: .9, r: 6, e: 'out' }, { t: 6.26, sx: .93, sy: 1.1, r: 4, e: 'inOut' }, { t: 6.4, sx: 1, sy: 1, r: 8 },
    // Lands on the floor with a squash; the hat slips over its eyes; a blind look left and right; then it scurries off wobbling.
    { t: 6.52, sx: 1, sy: 1, r: 0, e: 'out' }, { t: 6.56, sx: 1.12, sy: .86, e: 'inOut' }, { t: 6.64, sx: 1, sy: 1 },
    { t: 6.7, r: -5 }, { t: 6.76, r: 4 },
    ...wag(6.82, DINO_BEATS.exitEnd, DINO_STEPS.every * 2, 7),
  ] },
  // Inside the egg the baby is squashed with its face in the gap; the pop stretches it up
  // and out of the shell (feet clear of the rim by 3.05), then it drops onto the nest rim.
  { layer: 'spring', keys: [
    { t: 0, y: -67, sx: .86, sy: .6, o: 0, e: 'hold' }, { t: DINO_HAND_OFF, y: -67, sx: .86, sy: .6, o: 1, e: 'out' },
    { t: 3.05, y: -72, sx: .92, sy: 1.14, e: 'in' }, { t: 3.14, y: 0, sx: 1.08, sy: .9, e: 'inOut' }, { t: 3.21, sx: .98, sy: 1.03 }, { t: 3.27, sx: 1, sy: 1 },
  ] },
  ...['foot-near', 'foot-far'].map((layer): Track => ({ layer, keys: [
    { t: 0, o: 0, e: 'hold' }, { t: 3.1, o: 1, e: 'hold' },
    ...(layer === 'foot-near' ? [
      // The stomp: the foot swings out beside the body (toes up), hangs, then slams.
      { t: 4.56, x: 0, y: 0, r: 0, e: 'out' as Ease }, { t: 4.7, x: 58, y: -38, r: -32, e: 'hold' as Ease }, { t: 4.74, x: 58, y: -38, r: -32, e: 'in' as Ease },
      { t: 4.8, x: 6, y: 0, r: 0, sx: 1, sy: 1, e: 'out' as Ease }, { t: 4.83, sx: 1.2, sy: .78 }, { t: 4.92, x: 0, sx: 1, sy: 1 },
    ] : []),
    { t: 6.26, y: 0, e: 'inOut' }, { t: 6.36, y: -8 }, { t: 6.5, y: 0, e: 'hold' },
    ...(layer === 'foot-near' ? WADDLE_NEAR : WADDLE_FAR).flatMap((t): Key[] => [
      { t, y: 0, e: 'out' }, { t: Number((t + DINO_STEPS.every / 2).toFixed(3)), y: -9, e: 'in' }, { t: Number((t + DINO_STEPS.every).toFixed(3)), y: 0, e: 'hold' },
    ]),
  ] })),
  { layer: 'tail', keys: [
    { t: 0, o: 0, e: 'hold' }, { t: 3.0, o: 1, r: 20, e: 'out' }, { t: 3.1, r: -14 }, { t: 3.25, r: 6 }, { t: 3.36, r: 0 },
    { t: 3.4, r: 0 }, { t: 3.9, r: -20, e: 'out' }, { t: 4.12, r: 0 }, { t: 4.3, r: 16, e: 'hold' }, { t: 4.52, r: 16, e: 'inOut' }, { t: 4.66, r: -8, e: 'out' },
    { t: 4.84, r: -26 }, { t: 5.0, r: 0, e: 'inOut' }, ...wag(5.04, 5.94, .18, 16), { t: 5.98, r: 0 }, { t: 6.2, r: 0 }, { t: 6.36, r: -18 }, { t: 6.56, r: 10 }, { t: 6.7, r: 0 },
    ...wag(6.8, DINO_BEATS.exitEnd, DINO_STEPS.every * 2, 10, -1),
  ] },
  // Arms: whee on the pop, pulled back on the breath, RAWR claws up and out, shy, the stomp punch, yay, the hop, blind waddle.
  { layer: 'arm-near', keys: [
    { t: 0, r: 10, e: 'hold' }, { t: 2.95, r: 10, e: 'out' }, { t: 3.1, r: -120, e: 'inOut' }, { t: 3.32, r: 10 },
    { t: 3.4, r: 10, x: 0, y: 0, sx: 1, sy: 1, e: 'inOut' }, { t: 3.84, r: 30, e: 'back' },
    { t: 3.92, r: -125, x: 22, y: -8, sx: 1.1, sy: 1.25, e: 'inOut' }, { t: 3.97, r: -131 }, { t: 4.02, r: -126, e: 'hold' },
    { t: 4.06, r: -126, e: 'inOut' }, { t: 4.18, r: 22, x: 0, y: 0, sx: 1, sy: 1 }, { t: 4.3, r: 40, e: 'hold' },
    { t: 4.52, r: 40, e: 'inOut' }, { t: 4.68, r: -95, e: 'hold' }, { t: 4.76, r: -95, e: 'in' }, { t: 4.84, r: -30, e: 'out' }, { t: 5.04, r: -130, e: 'hold' },
    { t: 5.8, r: -130, e: 'inOut' }, { t: 5.96, r: 10 }, { t: 6.22, r: -60 }, { t: 6.52, r: -20 }, { t: 6.64, r: -85, e: 'hold' },
  ] },
  // Behind the body; during the roar it swaps with arm-far-up, drawn in front so its claws show.
  { layer: 'arm-far', keys: [
    { t: 0, r: -10, e: 'hold' }, { t: 2.95, r: -10, e: 'out' }, { t: 3.1, r: 120, e: 'inOut' }, { t: 3.32, r: -10 },
    { t: 3.4, r: -10, e: 'inOut' }, { t: 3.84, r: -30, o: 1, e: 'hold' }, { t: 3.88, o: 0, e: 'hold' }, { t: 4.06, o: 0, r: 100, e: 'hold' }, { t: 4.08, o: 1, e: 'inOut' },
    { t: 4.18, r: -22 }, { t: 4.3, r: -40, e: 'hold' },
    { t: 4.52, r: -40, e: 'inOut' }, { t: 4.68, r: 95, e: 'hold' }, { t: 4.76, r: 95, e: 'in' }, { t: 4.84, r: 30, e: 'out' }, { t: 5.04, r: 130, e: 'hold' },
    { t: 5.8, r: 130, e: 'inOut' }, { t: 5.96, r: -10 }, { t: 6.22, r: 60 }, { t: 6.52, r: 20 }, { t: 6.64, r: 85, e: 'hold' },
  ] },
  { layer: 'arm-far-up', keys: [
    { t: 0, o: 0, r: 40, e: 'hold' }, { t: 3.88, o: 1, r: 40, e: 'out' }, { t: 3.93, r: 125, sx: 1.1, sy: 1.25, e: 'inOut' }, { t: 3.98, r: 131 }, { t: 4.03, r: 125, e: 'hold' }, { t: 4.08, o: 0 },
  ] },
  // Face: one layer per expression, switched with opacity.
  { layer: 'eyes-open', keys: [
    { t: 0, e: 'hold' }, { t: 3.3, sy: 1, e: 'inOut' }, { t: 3.34, sy: .1 }, { t: 3.38, sy: 1, o: 1, e: 'hold' }, { t: 3.42, o: 0, e: 'hold' },
    { t: 4.09, o: 1, x: 0, y: 0, sx: 1.15, sy: 1.15, e: 'out' }, { t: 4.18, sx: 1, sy: 1 }, { t: 4.22, sy: 1 }, { t: 4.26, sy: .1 }, { t: 4.3, sy: 1, x: -3, y: 3 }, { t: 4.4, sy: 1 }, { t: 4.43, sy: .1 }, { t: 4.47, sy: 1, e: 'hold' },
    { t: 4.52, x: 0, y: 0, e: 'hold' }, { t: 4.95, o: 0, e: 'hold' },
    // After the party it looks back at the hatched eggs, then at the class, blinks, and hops.
    { t: 5.8, o: 1, x: -4, y: 1, e: 'hold' }, { t: 5.9, e: 'inOut' }, { t: 6.02, x: 4, y: 0, e: 'inOut' }, { t: 6.08, sy: 1 }, { t: 6.11, sy: .1 }, { t: 6.14, sy: 1, e: 'hold' },
  ] },
  { layer: 'eyes-squeeze', keys: [{ t: 0, o: 0, e: 'hold' }, { t: 3.42, o: 1, e: 'hold' }, { t: 3.88, o: 0 }] },
  { layer: 'eyes-fierce', keys: [{ t: 0, o: 0, e: 'hold' }, { t: 3.88, o: 1, sx: 1.12, sy: 1.12, e: 'out' }, { t: 3.94, sx: 1, sy: 1, e: 'hold' }, { t: 4.09, o: 0 }] },
  { layer: 'eyes-happy', keys: [{ t: 0, o: 0, e: 'hold' }, { t: 4.95, o: 1, e: 'hold' }, { t: 5.8, o: 0 }] },
  { layer: 'brows', keys: [
    { t: 0, o: 0, e: 'hold' }, { t: 3.88, o: 1, y: -5, e: 'out' }, { t: 3.93, y: 0, e: 'hold' }, { t: 4.06, o: 0, e: 'hold' },
    { t: 4.52, o: 0, y: -6, e: 'out' }, { t: 4.6, o: 1, y: 0, e: 'hold' }, { t: 4.95, o: 0 },
  ] },
  { layer: 'cheeks', keys: [{ t: 0, e: 'hold' }, { t: 3.4, sx: 1, sy: 1, e: 'inOut' }, { t: 3.84, sx: 1.32, sy: 1.32, e: 'out' }, { t: 3.92, sx: 1, sy: 1 }] },
  { layer: 'blush', keys: [{ t: 0, o: 0, e: 'hold' }, { t: 4.16, o: 0, e: 'out' }, { t: 4.3, o: 1, e: 'hold' }, { t: 4.52, o: 1, e: 'inOut' }, { t: 4.62, o: 0 }] },
  { layer: 'mouth-smile', keys: [{ t: 0, e: 'hold' }, { t: 3.4, o: 0, e: 'hold' }, { t: 5.8, o: 1 }] },
  { layer: 'mouth-puff', keys: [{ t: 0, o: 0, e: 'hold' }, { t: 3.4, o: 1, e: 'hold' }, { t: 3.88, o: 0 }] },
  // The roar mouth collapses into the peep's little "o" exactly as the bubble pops.
  // It stays opaque while it gulps (a tiny overshoot, then a fast collapse) and cuts to the "o": never a see-through mouth.
  { layer: 'mouth-roar', keys: [
    { t: 0, o: 0, sx: .4, sy: .3, e: 'hold' }, { t: 3.88, o: 1, e: 'back' }, { t: 3.96, sx: 1, sy: 1, e: 'hold' },
    { t: 4.06, o: 1, sx: 1, sy: 1, e: 'out' }, { t: 4.075, sx: 1.08, sy: 1.08, e: 'in' }, { t: DINO_ROAR_GULP, sx: .2, sy: .2, e: 'hold' }, { t: DINO_ROAR_GULP + .005, o: 0 },
  ] },
  { layer: 'roar-lines', keys: [
    { t: 0, o: 0, sx: .5, sy: .5, e: 'hold' }, { t: 3.9, o: 1, x: 0, sx: .5, sy: .5, e: 'out' }, { t: 3.97, x: 6, sx: 1, sy: 1, e: 'inOut' },
    // ...then the roar is sucked straight back into the mouth (the gulp), never a fading ghost.
    { t: 4.01, x: 2, sx: .94, sy: .94, e: 'in' }, { t: DINO_ROAR_LINES_OUT, x: -4, sx: .1, sy: .1, e: 'hold' }, { t: DINO_ROAR_LINES_OUT + .005, o: 0 },
  ] },
  { layer: 'mouth-peep', keys: [{ t: 0, o: 0, e: 'hold' }, { t: DINO_ROAR_GULP + .005, o: 1, e: 'hold' }, { t: 4.24, o: 0 }] },
  { layer: 'mouth-shy', keys: [{ t: 0, o: 0, e: 'hold' }, { t: 4.24, o: 1, e: 'hold' }, { t: 4.52, o: 0 }] },
  { layer: 'mouth-grit', keys: [{ t: 0, o: 0, e: 'hold' }, { t: 4.52, o: 1, e: 'hold' }, { t: 4.95, o: 0 }] },
  { layer: 'mouth-grin', keys: [{ t: 0, o: 0, e: 'hold' }, { t: 4.95, o: 1, e: 'hold' }, { t: 5.8, o: 0 }] },
  // The shell: flies off from the lid's exact pose (in front of the baby), lands on the head at 3.22,
  // pops up on the roar, slips askew on the peep, snaps straight, hops on the stomp, slides over the eyes at 6.52.
  { layer: 'hat', keys: [
    { t: 0, o: 0, e: 'hold' }, { t: DINO_HAND_OFF, x: -8, y: -9.4, r: -9, sx: 1.07, sy: .9, o: 1, e: 'out' },
    { t: 3.07, x: -30, y: -140, r: 200, sx: 1, sy: 1, e: 'in' }, { t: 3.22, x: 0, y: 0, r: 352, e: 'out' },
    { t: 3.25, sx: 1.08, sy: .85, e: 'inOut' }, { t: 3.32, sx: 1, sy: 1 },
    { t: 3.4, y: 0, e: 'inOut' }, { t: 3.84, y: -12, e: 'out' }, { t: 3.92, y: -20, r: 348, e: 'inOut' }, { t: 4.05, y: -14, e: 'in' }, { t: 4.14, y: 2, r: 344, e: 'out' }, { t: 4.2, y: 0, e: 'hold' },
    { t: 4.52, r: 344, e: 'back' }, { t: 4.6, r: 360, e: 'hold' }, { t: 4.8, y: 0, e: 'out' }, { t: 4.86, y: -26, r: 356, e: 'in' }, { t: 4.98, y: 0, r: 360, e: 'hold' },
    { t: 6.52, y: 0, r: 360, e: 'in' }, { t: 6.64, y: 54, r: 364, e: 'out' }, { t: 6.71, y: 52, r: 360 },
  ] },
  // Effects.
  { layer: 'peep', keys: [
    { t: 0, o: 0, sx: 0, sy: 0, e: 'hold' }, { t: 4.06, o: 1, sx: 0, sy: 0, e: 'back' }, { t: 4.16, sx: 1, sy: 1, e: 'hold' },
    // Gone with a little pop as the baby gets determined: it puffs up, then shrinks away (never a see-through bubble).
    { t: 4.46, y: 0, sx: 1, sy: 1, e: 'out' }, { t: 4.54, y: -6, sx: 1.1, sy: 1.1, e: 'in' }, { t: 4.6, y: -8, sx: .08, sy: .08, e: 'hold' }, { t: 4.605, o: 0 },
  ] },
  { layer: 'boom', keys: [
    { t: 0, o: 0, sx: .2, sy: .2, e: 'hold' }, { t: 4.8, o: 1, sx: .2, sy: .2, e: 'back' }, { t: 4.92, sx: 1.08, sy: 1.08, e: 'inOut' }, { t: 5.0, sx: 1, sy: 1, e: 'hold' },
    { t: 5.14, sx: 1, sy: 1, e: 'out' }, { t: 5.2, sx: 1.08, sy: 1.08, e: 'in' }, { t: 5.3, sx: .06, sy: .06, e: 'hold' }, { t: 5.305, o: 0 },
  ] },
  // Rays shoot out, stay solid while they stretch, and blink out in two frames at full stretch.
  { layer: 'impact', keys: [
    { t: 0, o: 0, sx: .5, sy: .5, e: 'hold' }, { t: 4.8, o: 1, sx: .5, sy: .5, e: 'out' }, { t: 4.9, sx: 1, sy: 1, e: 'out' },
    { t: DINO_IMPACT_OUT, o: 1, sx: 1.16, sy: 1.16, e: 'linear' }, { t: DINO_IMPACT_OUT + .03, o: 0, sx: 1.2, sy: 1.2 },
  ] },
  // Stomp dust blooms out along the ground from the foot, inner puffs first, then pops away.
  ...DINO_DUST.map(({ layer, side, at: start, from }): Track => ({ layer, keys: [
    { t: 0, o: 0, x: -from * side, sx: .3, sy: .3, e: 'hold' }, { t: start, o: 1, x: -from * side, sx: .3, sy: .3, e: 'out' },
    { t: start + .14, x: 0, y: -2, sx: 1.06, sy: 1.06, e: 'inOut' }, { t: start + .26, x: 8 * side, y: -3, sx: 1, sy: 1, e: 'in' },
    { t: start + .36, x: 12 * side, y: -3, sx: .1, sy: .1, e: 'hold' }, { t: start + .365, o: 0 },
  ] })),
  // Two little clouds as it lands from the hop.
  ...([['land-dust-l', -1], ['land-dust-r', 1]] as const).map(([layer, side]): Track => ({ layer, keys: [
    { t: 0, o: 0, x: -18 * side, sx: .3, sy: .3, e: 'hold' }, { t: DINO_BEATS.hopLands, o: 1, x: -18 * side, sx: .3, sy: .3, e: 'out' },
    { t: 6.64, x: 0, sx: 1.05, sy: 1.05, e: 'inOut' }, { t: 6.74, x: 6 * side, sx: 1, sy: 1, e: 'in' }, { t: 6.83, x: 9 * side, sx: .1, sy: .1, e: 'hold' }, { t: 6.835, o: 0 },
  ] })),
];

/** Layers that must be invisible once the story ends (the baby itself leaves by walking off). */
export const DINO_TRANSIENT_LAYERS = [
  'nest-group', 'egg-top', 'peek', 'crack', 'pop-flash', 'lip-group', ...DINO_CHIPS.map((_, index) => `chip-${index + 1}`),
  'arm-far-up', 'roar-lines', 'peep', 'boom', 'impact', ...DINO_DUST.map(({ layer }) => layer), 'land-dust-l', 'land-dust-r',
] as const;
/** The nest group's parts never fade on their own (opacity is only ever 0 or 1), so the group composites once. */
export const DINO_NEST_GROUP_PARTS = ['nest-back', 'egg-rock', 'egg-bottom-back', 'egg-bottom-front', 'nest-front'] as const;

export function dinoTrack(layer: string) {
  const track = DINO_TRACKS.find((candidate) => candidate.layer === layer);
  if (!track) throw new Error(`No dino track "${layer}"`);
  return track;
}
export function dinoPoseAt(layer: string, t: number) { return samplePoses(pinnedPoses(dinoTrack(layer).keys), t); }


export const DINO_KEYFRAMES_CSS = compileTracks(DINO_TRACKS);

/** The echo ring trails the main ring (ms); it is decorative, cracks follow the main ring. */
export const DINO_RING_ECHO_MS = 110;
/** A spotlight time as a percentage of its own window (inStart..gone). */
const spotPct = (seconds: number) => `${n((seconds - DINO_SPOT.inStart) / (DINO_SPOT.gone - DINO_SPOT.inStart) * 100)}%`;
/** Everything the stage's <style> holds: the layer tracks plus the spotlight dim and the gold ring. */
export const DINO_STAGE_CSS = `${DINO_KEYFRAMES_CSS}
@keyframes dino-spot{0%{opacity:0}${spotPct(DINO_SPOT.full)},${spotPct(DINO_SPOT.outStart)}{opacity:1}100%{opacity:0}}
.dino-stage .dino-spot{animation:dino-spot ${n((DINO_SPOT.gone - DINO_SPOT.inStart) * 1000)}ms linear ${n(DINO_SPOT.inStart * 1000)}ms both}
@keyframes dino-ring{0%{opacity:.95;transform:scale(0)}75%{opacity:.8}100%{opacity:0;transform:scale(1)}}
.dino-stage .dino-ring{animation:dino-ring ${DINO_COVER.rippleSpan}ms ${DINO_COVER.stompAt}ms linear both}
.dino-stage .dino-ring-echo{animation-delay:${DINO_COVER.stompAt + DINO_RING_ECHO_MS}ms}`;
