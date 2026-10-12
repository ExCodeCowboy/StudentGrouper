/**
 * Balloon pop party: every beat time, track and layout rule in one pure module
 * (no DOM, CSS or React) so the Stage, the Covers and the tests agree.
 *
 * Units: the hedgehog rig is drawn in "u" (1u = 0.1vmin) with the hedgehog's
 * face centre at (0, 0); the hedgehog art itself is drawn in "hog" units and
 * scaled by HOG_SCALE. Cover layout is in CSS pixels of the card. Screen
 * placement goes through a Scene: the viewport, the focal point the hedgehog
 * sneezes from, and the rig's size on that screen.
 */
import { clamp01, easeOutCubic, fadeWindow, mix, progress, seededRandom, smooth } from './sceneMotion';

export const BALLOON_DURATION_MS = 5300;

/** Master timeline (seconds). */
export const BT = {
  inflateAt: .10, inflateStagger: .30, inflateDur: .42, sideLag: .06, questionOut: .06,
  hopDelay: .28, hopDur: .52,
  riseStart: .15, riseEnd: 1.55,
  blink1: .90,
  nearMissStart: 1.36, nearMissKiss: 1.68, nearMissRelease: 1.76, nearMissEnd: 2.08,
  featherStart: 1.90, featherLand: 2.40,
  ah1: 2.62, ah1Peak: 2.86, ah1Release: 2.96, ah2Peak: 3.20, ah2Release: 3.28, ah3Peak: 3.54,
  sneezeAt: 3.62,
  popStart: 3.66, popSpread: .50, popSquash: .08, popLag: .045, popDur: .14,
  burstDur: .17, shardDelay: .03, shardDur: .32, qflyDur: .34, stringDrop: .30,
  /** Blown to his hang spot (clear of every name), a glance at his balloons, then a wave and a giggle while he hangs there. */
  recoilEnd: 4.00,
  lookUpStart: 3.96, lookUpEnd: 4.10,
  waveStart: 4.12, giggleStart: 4.20,
  /** Anticipation: a little dip, then the balloons whisk him off (ease-in, so he lingers over empty space and crosses the cards fast). */
  dipStart: 4.30, exitStart: 4.40, giggleEnd: 4.44, exitEnd: 4.88,
  confettiMin: .95, confettiJitter: .15,
  duration: 5.3,
} as const;

/**
 * Exit rise: a strong ease-in, so he lingers (shrinking into the distance) over the empty spot he hung in and
 * then zips up across the names in a blink; still fast when he leaves the top of the screen.
 */
export const EXIT_EASE_POWER = 3.2;
export const exitEase = (value: number) => clamp01(value) ** EXIT_EASE_POWER;
/** Sideways drift on the way out leads the rise, so he is already over his clear lane when he crosses the names. */
export const exitDriftEase = (value: number) => smooth(clamp01(value) / .72);
/** Floating away into the distance: his size at the end of the exit (times his hang size), and how that shrink runs. */
export const EXIT_SCALE = .6;
export const exitShrinkEase = (value: number) => smooth(clamp01(value) / .8);

/** The rig is off the top of every screen when the exit ends; the painter (and the per-frame script) stops just after (ms). */
export const PAINT_END_MS = Math.round((BT.exitEnd + .04) * 1000);
/**
 * Late animations (the inhale, the pops, the torn paper, the ring, the confetti) are not created until this long
 * before they first move (ms): a waiting animation is a compositor layer, and hundreds of them would make every
 * frame of the build-up expensive.
 */
export const ARM_LEAD_MS = 200;
/**
 * When every card has filled and hopped, so their finished early animations can be removed (ms): the last hop (the
 * rightmost card, a twin card's second bunch) ends at 1.35 s.
 */
export const SETTLE_ARM_MS = 1400;
/** When every card's inhale animations are created (ms). */
export const INHALE_ARM_MS = Math.round(BT.ah1 * 1000) - ARM_LEAD_MS;
/** When a card's pop animations are created, for its first pop at `popMs` (its balloons squash from popMs - popSquash). */
export const popArmMs = (popMs: number) => popMs - Math.round(BT.popSquash * 1000) - ARM_LEAD_MS;
/** When the sneeze ring is created (ms). */
export const RING_ARM_MS = Math.round(BT.popStart * 1000) - ARM_LEAD_MS;

/** The inhale pulls on the balloons (never the paper), in seconds; CSS keyframe stops are (t - ah1) / (sneezeAt - ah1). */
export const PULL_STOPS = [
  { t: BT.ah1, f: 0, max: 0, lean: 0 },
  { t: BT.ah1Peak, f: .020, max: 5, lean: 5 },
  { t: BT.ah1Release, f: .008, max: 5, lean: 2 },
  { t: BT.ah2Peak, f: .040, max: 9, lean: 9 },
  { t: BT.ah2Release, f: .025, max: 9, lean: 5 },
  { t: BT.ah3Peak, f: .070, max: 13, lean: 14 },
  { t: BT.sneezeAt, f: .070, max: 13, lean: 14 },
] as const;
export const PULL_FINAL = PULL_STOPS[PULL_STOPS.length - 1];

/** Keyframe stop (0..1) of a beat inside the 1 s inhale animation. */
export const pullStop = (time: number) => (time - BT.ah1) / (BT.sneezeAt - BT.ah1);

/** A card pops when the sneeze ring reaches it: d = 0 at the hedgehog's face, 1 at the farthest screen corner. */
export const popAt = (distance: number) => BT.popStart + BT.popSpread * clamp01(distance);

// ---------------------------------------------------------------------------
// Tracks

export type Keys = readonly (readonly [number, number])[];

function tangent(keys: Keys, k: number) {
  if (k === 0 || k === keys.length - 1) return 0;
  const h0 = keys[k][0] - keys[k - 1][0];
  const h1 = keys[k + 1][0] - keys[k][0];
  const d0 = (keys[k][1] - keys[k - 1][1]) / h0;
  const d1 = (keys[k + 1][1] - keys[k][1]) / h1;
  if (d0 * d1 <= 0) return 0;
  const w1 = 2 * h1 + h0;
  const w2 = h1 + 2 * h0;
  return (w1 + w2) / (w1 / d0 + w2 / d1);
}

/**
 * Monotone cubic (PCHIP) through [time, value] keys. Unlike smoothstep keys it
 * keeps velocity through a key, so a float or a follow-through never stutters;
 * turning points (overshoots, holds) still come to rest, and it never
 * overshoots a key on its own.
 */
export function spline(time: number, keys: Keys): number {
  const last = keys.length - 1;
  if (time <= keys[0][0]) return keys[0][1];
  if (time >= keys[last][0]) return keys[last][1];
  let i = 1;
  while (time > keys[i][0]) i++;
  const [x0, y0] = keys[i - 1];
  const [x1, y1] = keys[i];
  const h = x1 - x0;
  const s = (time - x0) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * h * tangent(keys, i - 1) + (3 * s2 - 2 * s3) * y1 + (s3 - s2) * h * tangent(keys, i);
}

const TAU = Math.PI * 2;
const pulse = (time: number, start: number, length: number) => time >= start && time < start + length;
/** Size (1 to 0) of a piece that leaves by shrinking: it holds its size at first, then is gone quickly. */
export const shrinkAway = (value: number) => 1 - clamp01(value) ** 2;
/** When the sneeze clouds, the sparkles and the blown-away feather have shrunk to nothing (s). */
export const PUFF_GONE = 4.04;
export const SPARKLES_GONE = 4.08;
export const FEATHER_GONE = 3.98;

// ---------------------------------------------------------------------------
// Rig geometry (u, face centre at 0,0)

export const HOG_SCALE = 1.3;
/** The raised paw that holds the strings, in hog units and in rig units. */
export const PAW_HOG = { x: 62, y: -64 } as const;
export const PAW = { x: PAW_HOG.x * HOG_SCALE, y: PAW_HOG.y * HOG_SCALE } as const;
/** Squash, stretch and lean-back pivot (hog units): the belly, so the face barely moves. */
export const SQUASH_Y = 40;
/** Centre and half-size of the nose (hog units, before the head moves); the feather's quill rests against its left side. */
export const NOSE_HOG = { x: 0, y: 11, rx: 7.5, ry: 5.8 } as const;
/**
 * Back quill layer: 7 spikes over 160..380 degrees around (0, 8). Spike 1 (the
 * left one, 27 degrees above level) is longer: it is the prickle the heart
 * balloon lands on.
 */
export const QUILLS = { inner: 60, outer: 86, count: 7, from: 160, to: 380, cy: 8, long: 1, longOuter: 104 } as const;
export const EYE_HOG = { x: 20, y: -4 } as const;

export type BunchBalloon = { id: string; kind: 'round' | 'star' | 'heart'; color: BalloonColor; x: number; y: number; width: number; rot: number; knot: number };
export const BUNCH: readonly BunchBalloon[] = [
  { id: 'red', kind: 'round', color: 'red', x: -26, y: -262, width: 96, rot: -8, knot: 67 },
  { id: 'star', kind: 'star', color: 'yellow', x: 46, y: -294, width: 120, rot: 2, knot: 57 },
  { id: 'blue', kind: 'round', color: 'blue', x: 116, y: -252, width: 96, rot: 10, knot: 67 },
];
export const HEART = { x: -88, y: -200, width: 92, rot: -14, tip: 42, knot: 48 } as const;

export type Point = { x: number; y: number };
export const rotateAbout = (point: Point, pivot: Point, degrees: number): Point => {
  const a = degrees * Math.PI / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
};

/** Outer radius of each back spike (hog units). */
export const quillOuter = (spike: number) => spike === QUILLS.long ? QUILLS.longOuter : QUILLS.outer;

export function quillTips(scale = 1): Point[] {
  const tips: Point[] = [];
  for (let spike = 0; spike < QUILLS.count; spike++) {
    const a = (QUILLS.from + (QUILLS.to - QUILLS.from) * (2 * spike + 1) / (QUILLS.count * 2)) * Math.PI / 180;
    const r = quillOuter(spike) * scale;
    tips.push({ x: r * Math.cos(a), y: QUILLS.cy + r * Math.sin(a) });
  }
  return tips;
}

// ---------------------------------------------------------------------------
// The pose at a moment

export type EyeState = 'open' | 'half' | 'cross' | 'happy' | 'squeeze' | 'closed';
export type MouthState = 'smile' | 'o' | 'ah' | 'laugh' | 'wobble' | 'grin';

export type BalloonPose = {
  /**
   * Rig placement: rise 1 = parked below the screen, 0 = at the focal point; lift (vmin, up); recoil 0..1 of the
   * way to the scene's hang spot (blown clear of the names, with a little overshoot); exit 0..1 of the rise off
   * the top; drift 0..1 of the scene's sideways exit drift.
   */
  rise: number; lift: number; recoil: number; exit: number; driftX: number;
  /**
   * Rotation (degrees, clockwise when the scene's side is +1) and size of the whole rig about the face; shrink
   * 0..1 blends to the scene's hang size (blown away from us); exitLean 0..1 of the lean into the exit drift.
   */
  rigRot: number; rigScale: number; shrink: number; exitLean: number;
  /** Body pendulum about the paw, and the balloon bunch about the paw (degrees). */
  swing: number; bunchRot: number;
  heartDx: number; heartDy: number; heartRot: number; heartSx: number; heartSy: number;
  /** Body squash/stretch and lean (degrees, + leans back to his left) about the belly. */
  bodyY: number; sx: number; sy: number; tilt: number; quills: number;
  head: number; noseX: number; nose: number; cheeks: number;
  /** Brows: how much they show (0..1), how high (hog units) and how worried (inner ends up, 0..1). */
  brows: number; browLift: number; browWorry: number;
  eyes: EyeState; lookX: number; lookY: number; eyeScale: number; lid: number;
  mouth: MouthState; mouthOpen: number;
  /** Left arm, a quadratic from the shoulder (hog units), plus a wave about the shoulder. */
  armCx: number; armCy: number; armEx: number; armEy: number; armWave: number;
  kick: number;
  hatLift: number; hatRot: number;
  /** The feather's place, turn and size (it pops in and shrinks away: nothing in the rig ever fades). */
  featherX: number; featherY: number; featherRot: number; featherSize: number;
  /** Sneeze clouds: how far they have spread from his elbow, and each cloud's own size (they shrink away, never fade). */
  puffScale: number; puffSize: number;
  /** Sneeze sparkles: how far they have flown, and their size (they twinkle out by shrinking). */
  sparkleR: number; sparkleSize: number;
};

const RISE_KEYS: Keys = [[BT.riseStart, 1], [.55, .6], [.95, .19], [1.30, -.035], [BT.riseEnd, 0]];
/**
 * Lift (vmin, up): rears up a little more on each "ah", snaps down on CHOO; later a small dip
 * (anticipation) before the balloons take him.
 */
const LIFT_KEYS: Keys = [
  [BT.ah1, 0], [BT.ah1Peak, 1], [BT.ah1Release, .55], [BT.ah2Peak, 2], [BT.ah2Release, 1.4], [BT.ah3Peak, 3], [3.585, 3.2],
  [BT.sneezeAt, 0], [3.655, -.9], [3.73, 0],
  [BT.dipStart, 0], [4.38, -2.2], [4.44, -1.3], [4.52, 0],
];
/** Recoil (0..1 of the way to the scene's hang spot): the blast throws him there, a small overshoot, then he settles. */
const RECOIL_KEYS: Keys = [[3.645, 0], [3.72, .13], [3.85, .68], [BT.recoilEnd, 1], [4.08, 1.035], [4.18, .99], [4.26, 1]];
const SWING_KEYS: Keys = [[BT.riseStart, 7], [.78, -5], [1.3, 2], [1.62, 0]];
/** He flinches away from the prickled heart (negative swings the body to the right). */
const FLINCH_KEYS: Keys = [[BT.nearMissRelease, 0], [1.81, -6], [1.92, 2], [2.04, 0]];
const BLOWN_SWING_KEYS: Keys = [[BT.sneezeAt, 0], [3.72, -9], [3.95, 4], [4.20, -1.5], [4.40, 0]];
const BUNCH_KEYS: Keys = [[BT.riseStart, -8], [.8, 6], [1.3, -2.5], [1.62, 0]];
const WHIP_KEYS: Keys = [[BT.sneezeAt, 0], [3.70, 7], [3.95, -4], [4.20, 2], [4.50, 0]];
/** Blown back: a whip forward on CHOO, then a tumble back that eases out; he rocks back a little in the dip. */
const RIG_ROT_KEYS: Keys = [[BT.sneezeAt, 0], [3.68, -4], [3.86, 9], [BT.recoilEnd, 5], [4.2, 3], [BT.dipStart, 3], [4.39, 5], [4.5, 2]];

/** Where the heart balloon's tip kisses the long quill (heart offsets, u, from its place in the bunch). */
export const KISS = { dx: -52.0, dy: 104.6, rot: -14 } as const;
const HEART_DX: Keys = [[BT.nearMissStart, 0], [1.62, KISS.dx + 3], [BT.nearMissKiss, KISS.dx], [BT.nearMissRelease, KISS.dx], [1.84, -8], [1.93, 4], [BT.nearMissEnd, 0]];
const HEART_DY: Keys = [[BT.nearMissStart, 0], [1.62, KISS.dy - 8], [BT.nearMissKiss, KISS.dy], [BT.nearMissRelease, KISS.dy], [1.84, 18], [1.92, -16], [2.01, 4], [BT.nearMissEnd, 0]];
const HEART_ROT: Keys = [[BT.nearMissStart, 0], [1.62, KISS.rot + 1], [BT.nearMissKiss, KISS.rot], [BT.nearMissRelease, KISS.rot], [1.84, 5], [1.95, -3], [BT.nearMissEnd, 0]];

const TILT_KEYS: Keys = [
  [BT.ah1, 0], [BT.ah1Peak, 4], [BT.ah1Release, 2.5], [BT.ah2Peak, 7], [BT.ah2Release, 5.5], [BT.ah3Peak, 10], [3.585, 10.5],
  [BT.sneezeAt, -2], [3.66, -7], [3.80, 1], [3.95, 0],
];
const HEAD_KEYS: Keys = [[BT.ah1, 0], [BT.ah1Peak, 3], [BT.ah1Release, 2], [BT.ah2Peak, 5], [BT.ah2Release, 4], [BT.ah3Peak, 8], [3.585, 8], [3.64, -4], [3.80, 0]];
const SY_KEYS: Keys = [
  [BT.nearMissRelease, 1], [1.80, .95], [1.86, 1.03], [1.95, 1],
  [BT.ah1, 1], [BT.ah1Peak, 1.05], [BT.ah1Release, 1.03], [BT.ah2Peak, 1.10], [BT.ah2Release, 1.07], [BT.ah3Peak, 1.16], [3.585, 1.17],
  [3.635, .85], [3.72, 1.05], [3.85, .97], [4.0, 1],
  [BT.dipStart, 1], [4.38, .92], [4.47, 1.07], [4.6, 1],
];
const QUILL_KEYS: Keys = [
  [BT.nearMissRelease, 1], [1.80, 1.13], [1.86, 1.11], [1.96, 1],
  [3.28, 1], [BT.ah3Peak, 1.05], [BT.sneezeAt, 1.05], [3.67, 1.24], [3.80, 1.16], [4.30, 1.12], [4.60, 1],
];
const NOSE_KEYS: Keys = [[BT.ah1, 1], [BT.ah1Peak, 1.12], [BT.ah1Release, 1.07], [BT.ah2Peak, 1.22], [BT.ah2Release, 1.16], [BT.ah3Peak, 1.32], [BT.sneezeAt, 1.32], [3.67, 1]];
const HAT_LIFT: Keys = [[BT.sneezeAt, 0], [3.80, 50], [3.92, 51], [4.06, 0], [4.12, 3], [4.18, 0]];
const LID_KEYS: Keys = [[BT.ah1, .08], [BT.ah1Peak, .3], [BT.ah1Release, .22], [BT.ah2Peak, .46], [BT.ah2Release, .38], [BT.ah3Peak, .64]];
const MOUTH_KEYS: Keys = [[BT.ah1, .1], [BT.ah1Peak, .4], [BT.ah1Release, .28], [BT.ah2Peak, .68], [BT.ah2Release, .55], [BT.ah3Peak, 1], [BT.sneezeAt, 1]];
const BROW_LIFT: Keys = [
  [1.30, 0], [1.46, 2], [BT.nearMissKiss, 2.5], [1.71, 7], [1.80, 6], [1.90, 0],
  [2.36, 0], [2.48, 1], [BT.ah1, 1], [BT.ah1Peak, 3], [BT.ah1Release, 2.4], [BT.ah2Peak, 5], [BT.ah2Release, 4.2], [BT.ah3Peak, 7.5], [3.58, 7.5], [3.62, 3],
  [BT.lookUpStart, 3], [4.02, 5], [BT.lookUpEnd, 4], [4.18, 0],
];
const BROW_WORRY: Keys = [
  [1.30, 0], [1.46, .7], [BT.nearMissKiss, .7], [1.71, .15], [1.80, .15], [1.90, 0],
  [2.36, 0], [2.48, .35], [BT.ah1, .45], [BT.ah1Peak, .75], [BT.ah2Peak, .9], [BT.ah3Peak, 1], [3.62, 1],
];
const BROW_SHOW: Keys = [[1.30, 0], [1.44, 1], [1.84, 1], [1.90, 0], [2.36, 0], [2.46, 1], [3.60, 1], [3.63, 0], [BT.lookUpStart, 0], [4.0, 1], [4.12, 1], [4.18, 0]];
const FEATHER_FROM = { x: -236, y: -318 } as const;
/** The feather pops into being as it starts to drift (size 0 to 1, a small overshoot). */
const FEATHER_POP_KEYS: Keys = [[BT.featherStart, 0], [BT.featherStart + .09, 1.12], [BT.featherStart + .16, 1]];
/**
 * The landed feather (drawn mirrored) lies out to the side from his nose, a little
 * downhill, under the left eye and above the mouth, so the whole face stays readable.
 */
export const FEATHER_REST_ROT = -98;
const FEATHER_DRIFT_ROT = -40;
/** The feather's vane in its own units (rig u): the quill base at 0,0, the tip up at (9, -92). Drawn mirrored. */
export const FEATHER_VANE = 'M0 0C-4 -14 -12 -30 -10 -48C-8 -66 2 -80 9 -92C14 -78 18 -62 15 -44C13 -32 17 -26 13 -18C9 -10 5 -6 0 0Z';
/** Eye whites (hog units, before the eye scale) and the open "ah" mouth, as drawn by the face. */
export const EYE_SIZE = { rx: 10.5, ry: 12.5 } as const;
export function ahMouth(open: number) {
  const rx = 5 + 7 * open;
  const ry = 5 + 10.5 * open;
  return { rx, ry, cy: 21 + ry * .62 };
}
/**
 * Exit: the balloons carry his face from the hang spot to this far (vmin at his hang size, before the exit
 * shrink) above the top of the screen, so his feet are just off the top at the end of the exit.
 */
export const EXIT_MARGIN_VMIN = 24;
/** Lean (degrees) into a strong exit drift. */
export const EXIT_LEAN = 9;
/** How far above the top (px) the face ends the exit, for a focal point and hang size. */
export const exitMarginPx = (focal: Focal, hangScale: number) => EXIT_MARGIN_VMIN * EXIT_SCALE * vminOf(focal) * focal.scale * hangScale;

const ARM_DOWN = { cx: -58, cy: 52, ex: -52, ey: 66 } as const;
const ARM_ELBOW = { cx: -12, cy: 30, ex: 24, ey: 8 } as const;
/** The waving arm reaches up and out to his left, clear of his face, and swings outwards about the shoulder. */
const ARM_WAVE = { cx: -84, cy: 6, ex: -86, ey: -40 } as const;
const ARM_STARTLE = { cx: -72, cy: 30, ex: -42, ey: 12 } as const;
/** Wave: degrees about the shoulder (negative swings the paw outwards), and waves per second. */
export const WAVE = { bias: -9, swing: 17, hz: 4.4 } as const;

type BodyPose = Pick<BalloonPose, 'sx' | 'sy' | 'bodyY' | 'swing' | 'tilt'>;

/** Map a hog-space point through the squash, the lean, the hog scale and the pendulum swing to rig units (as the CSS layers do). */
export function hogToRig(point: Point, pose: BodyPose): Point {
  const squashed = { x: point.x * pose.sx, y: SQUASH_Y + (point.y - SQUASH_Y) * pose.sy };
  const leaned = rotateAbout(squashed, { x: 0, y: SQUASH_Y }, pose.tilt);
  return rotateAbout({ x: leaned.x * HOG_SCALE, y: (leaned.y + pose.bodyY) * HOG_SCALE }, PAW, pose.swing);
}

/** Where the strings meet the raised paw right now (rig units). */
export const pawPoint = (pose: BalloonPose) => hogToRig(PAW_HOG, pose);

/** The left side of the nose, where the feather's quill rests (rig units). */
export function noseAnchor(pose: BalloonPose): Point {
  return hogToRig({ x: NOSE_HOG.x + pose.noseX - NOSE_HOG.rx * pose.nose + 1.5, y: NOSE_HOG.y + 1 - pose.head }, pose);
}

/** The heart balloon's tip (its lowest point, above the knot) in rig units; the dent squashes about it. */
export function heartTip(pose: Pick<BalloonPose, 'heartDx' | 'heartDy' | 'heartRot' | 'bunchRot'>): Point {
  const centre = { x: HEART.x + pose.heartDx, y: HEART.y + pose.heartDy };
  const tip = rotateAbout({ x: centre.x, y: centre.y + HEART.tip }, centre, HEART.rot + pose.heartRot);
  return rotateAbout(tip, PAW, pose.bunchRot);
}

/** Back quill tips in rig units. */
export const quillTipsRig = (pose: BalloonPose) => quillTips(pose.quills).map((tip) => hogToRig(tip, pose));

/** A balloon knot (rig units), after the bunch rotation. */
export function knotPoint(balloon: { x: number; y: number; knot: number; rot: number }, pose: BalloonPose, dx = 0, dy = 0, extraRot = 0): Point {
  const centre = { x: balloon.x + dx, y: balloon.y + dy };
  return rotateAbout(rotateAbout({ x: centre.x, y: centre.y + balloon.knot }, centre, balloon.rot + extraRot), PAW, pose.bunchRot);
}

function basePose(t: number): BalloonPose {
  const rise = t < BT.riseStart ? 1 : spline(t, RISE_KEYS);
  // Hover bob: settles before the countdown so every "ah" (and the sneeze) starts from the focal point.
  const hover = smooth(progress(t, .7, 1.5)) * (1 - smooth(progress(t, 2.42, BT.ah1)));
  const bob = .8 * Math.sin(TAU * t / 1.6) * hover;
  const exitP = progress(t, BT.exitStart, BT.exitEnd);
  const exit = exitEase(exitP);
  const shrink = smooth(progress(t, BT.sneezeAt, BT.recoilEnd));

  const giggle = fadeWindow(t, BT.giggleStart, BT.giggleStart + .05, BT.giggleEnd - .06, BT.giggleEnd);
  const jiggle = Math.sin(TAU * 7 * (t - BT.giggleStart));
  const tremble = t >= BT.ah3Peak && t < 3.585 ? Math.sin(TAU * 14 * t) : 0;
  // The yank: his body trails behind the balloons (swings back), then follows.
  const swing = spline(t, SWING_KEYS) + spline(t, FLINCH_KEYS) + spline(t, BLOWN_SWING_KEYS) + 3 * jiggle * giggle + tremble
    - 5 * smooth(progress(t, BT.exitStart, BT.exitStart + .3));
  const bunchRot = spline(t, BUNCH_KEYS) + 2.2 * Math.sin(TAU * (t - 2.1) / 1.9) * smooth(progress(t, 2.1, 2.6)) * (1 - smooth(progress(t, 3.3, 3.6)))
    + spline(t, WHIP_KEYS) - 3 * fadeWindow(t, BT.dipStart, 4.38, 4.4, 4.5) + 7 * smooth(progress(t, BT.exitStart - .05, BT.exitStart + .3));

  const quiver = t >= 1.58 && t < BT.nearMissKiss ? 1.2 * Math.sin(TAU * 14 * t) : 0;
  const dent = fadeWindow(t, BT.nearMissKiss, 1.71, 1.735, BT.nearMissRelease);
  const boing = fadeWindow(t, BT.nearMissRelease, 1.79, 1.82, 1.88);
  const sy = spline(t, SY_KEYS) + .03 * jiggle * giggle;
  const lid = t >= BT.ah1 && t < BT.sneezeAt ? spline(t, LID_KEYS) : 0;

  let eyes: EyeState = 'open';
  let mouth: MouthState = 'smile';
  let lookX = 0;
  let lookY = .8;
  let eyeScale = 1;
  if (t < BT.nearMissStart) {
    lookY = t < .7 ? -2.5 : .8;
    if (pulse(t, BT.blink1, .08)) eyes = 'closed';
  } else if (t < BT.nearMissKiss) { lookX = -3.6; lookY = -2.4; mouth = 'wobble'; }
  else if (t < 1.84) { lookX = -3.8; lookY = -1.8; eyeScale = mix(1, 1.35, smooth(progress(t, BT.nearMissKiss, 1.71))); mouth = 'o'; }
  else if (t < BT.nearMissEnd) { eyes = 'happy'; mouth = 'grin'; }
  else if (t < BT.featherLand) { lookX = NaN; } // resolved against the feather below
  else if (t < BT.ah1) { eyes = 'cross'; mouth = 'wobble'; }
  else if (t < 3.58) { eyes = 'half'; lookY = -2.2; lookX = -.6; eyeScale = 1.06; mouth = 'ah'; }
  else if (t < 3.78) { eyes = 'squeeze'; mouth = t < BT.sneezeAt ? 'ah' : 'o'; }
  else if (t < BT.lookUpStart) {
    // Dazed by his own sneeze.
    eyeScale = 1.1; mouth = 'wobble';
    lookX = 2.2 * Math.cos(TAU * 2.4 * t); lookY = 1.6 * Math.sin(TAU * 2.4 * t);
    if (pulse(t, 3.86, .06)) eyes = 'closed';
  } else if (t < BT.lookUpEnd) { lookY = -4.2; lookX = .8; eyeScale = 1.12; mouth = t < 4.03 ? 'o' : 'grin'; } // his balloons survived!
  else if (t < BT.giggleStart) { lookY = .6; lookX = -.4; eyeScale = 1.04; mouth = 'grin'; } // hello, class (the wave starts)
  else if (t < BT.giggleEnd) { eyes = 'happy'; mouth = 'laugh'; }
  else { mouth = 'laugh'; lookY = .5; if (pulse(t, 4.62, .07)) eyes = 'closed'; }

  const elbow = fadeWindow(t, 3.50, 3.58, 3.78, 3.86);
  const wave = smooth(progress(t, BT.waveStart - .08, BT.waveStart + .04));
  const startle = fadeWindow(t, BT.nearMissKiss - .02, 1.72, 1.8, 1.95);
  const blend = (key: 'cx' | 'cy' | 'ex' | 'ey') => mix(mix(mix(ARM_DOWN[key], ARM_STARTLE[key], startle), ARM_ELBOW[key], elbow), ARM_WAVE[key], wave);
  const armWave = (WAVE.bias + WAVE.swing * Math.sin(TAU * WAVE.hz * (t - BT.waveStart))) * wave;

  const paddle = fadeWindow(t, .15, .3, 1.2, 1.5) + fadeWindow(t, BT.exitStart, BT.exitStart + .12, 5.2, 5.3);
  const kick = 16 * Math.sin(TAU * 3.2 * t) * paddle + 12 * Math.sin(TAU * 7 * (t - BT.giggleStart) + 1) * giggle
    + 14 * fadeWindow(t, BT.sneezeAt, 3.68, 3.8, 4.0);

  const sneezed = t >= BT.sneezeAt;
  const noseX = (pulse(t, BT.featherLand, BT.ah1 - BT.featherLand) ? 1.6 * Math.sin(TAU * 12 * t) : 0) + (t >= BT.ah1 && t < BT.ah3Peak ? .8 * Math.sin(TAU * 16 * t) : 0);
  const puffGrow = easeOutCubic(progress(t, BT.sneezeAt, 3.85));

  return {
    rise, lift: bob + spline(t, LIFT_KEYS), recoil: t < 3.645 ? 0 : spline(t, RECOIL_KEYS), exit, driftX: exitDriftEase(exitP),
    rigRot: spline(t, RIG_ROT_KEYS), rigScale: mix(1, EXIT_SCALE, exitShrinkEase(exitP)), shrink, exitLean: smooth(exitP / .6),
    swing, bunchRot,
    heartDx: spline(t, HEART_DX), heartDy: spline(t, HEART_DY), heartRot: spline(t, HEART_ROT) + quiver,
    heartSx: 1 + .1 * dent - .04 * boing, heartSy: 1 - .15 * dent + .08 * boing,
    bodyY: 1.5 * jiggle * giggle, sx: 1 / Math.sqrt(sy), sy, tilt: spline(t, TILT_KEYS), quills: spline(t, QUILL_KEYS),
    head: spline(t, HEAD_KEYS), noseX, nose: spline(t, NOSE_KEYS), cheeks: 1 + .35 * fadeWindow(t, 3.28, BT.ah3Peak, BT.sneezeAt, 3.66) + .12 * giggle,
    brows: spline(t, BROW_SHOW), browLift: spline(t, BROW_LIFT), browWorry: spline(t, BROW_WORRY),
    eyes, lookX, lookY, eyeScale, lid, mouth, mouthOpen: spline(t, MOUTH_KEYS),
    armCx: blend('cx'), armCy: blend('cy'), armEx: blend('ex'), armEy: blend('ey'), armWave,
    kick,
    hatLift: spline(t, HAT_LIFT), hatRot: 360 * smooth(progress(t, BT.sneezeAt, 4.06)),
    featherX: 0, featherY: 0, featherRot: 0, featherSize: 0,
    // The clouds keep drifting apart while each one shrinks to nothing (a puff, never a see-through ghost).
    puffScale: sneezed ? mix(.55, 1.55, puffGrow) + .3 * smooth(progress(t, 3.82, PUFF_GONE)) : 0,
    puffSize: sneezed ? shrinkAway(progress(t, 3.80, PUFF_GONE)) : 0,
    sparkleR: sneezed ? 80 * easeOutCubic(progress(t, BT.sneezeAt, 3.95)) : 0,
    sparkleSize: sneezed ? shrinkAway(progress(t, 3.84, SPARKLES_GONE)) : 0,
  };
}

let landingAnchor: Point | null = null;
let sneezeAnchor: Point | null = null;

/** The complete pose (pure: depends only on t). */
export function balloonPose(t: number): BalloonPose {
  const pose = basePose(t);
  landingAnchor ??= noseAnchor(basePose(BT.featherLand));
  sneezeAnchor ??= noseAnchor(basePose(BT.sneezeAt));
  if (t < BT.featherStart) {
    pose.featherX = FEATHER_FROM.x; pose.featherY = FEATHER_FROM.y; pose.featherRot = FEATHER_DRIFT_ROT; pose.featherSize = 0;
  } else if (t < BT.featherLand) {
    const p = progress(t, BT.featherStart, BT.featherLand);
    const s = smooth(p);
    pose.featherX = mix(FEATHER_FROM.x, landingAnchor.x, s) + 38 * Math.sin(3 * Math.PI * p) * (1 - s);
    pose.featherY = mix(FEATHER_FROM.y, landingAnchor.y, s);
    pose.featherRot = mix(FEATHER_DRIFT_ROT, FEATHER_REST_ROT, s) + 30 * Math.sin(3 * Math.PI * p) * (1 - s);
    // It pops into being with a little overshoot (no fade-in).
    pose.featherSize = spline(t, FEATHER_POP_KEYS);
  } else if (t < BT.sneezeAt) {
    const nose = noseAnchor(pose);
    pose.featherX = nose.x; pose.featherY = nose.y;
    pose.featherRot = FEATHER_REST_ROT + pose.tilt + pose.swing + 4 * Math.sin(TAU * 5 * (t - BT.featherLand)) * (1 - smooth(progress(t, BT.featherLand, BT.ah1 + .3))) + (t >= BT.ah1 ? 3 * Math.sin(TAU * 9 * t) : 0);
    pose.featherSize = 1;
  } else {
    // Blown away, spinning, and shrinking into the distance.
    const e = easeOutCubic(progress(t, BT.sneezeAt, 4.0));
    pose.featherX = sneezeAnchor.x - 260 * e; pose.featherY = sneezeAnchor.y - 170 * e;
    pose.featherRot = FEATHER_REST_ROT - 540 * e; pose.featherSize = shrinkAway(progress(t, 3.70, FEATHER_GONE));
  }
  if (Number.isNaN(pose.lookX)) {
    // Eyes follow the drifting feather.
    const fx = pose.featherX / HOG_SCALE;
    const fy = pose.featherY / HOG_SCALE;
    const dx = fx - 0;
    const dy = fy - EYE_HOG.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    pose.lookX = 3.4 * dx / length;
    pose.lookY = 3.4 * dy / length;
  }
  return pose;
}

// ---------------------------------------------------------------------------
// Scene: where on the screen he sneezes from, where the blast leaves him hanging, and how big he is

export const FOCAL = { x: .5, y: .46 } as const;
/** Screens shorter than this (min side, px) get a smaller hedgehog, centred a little lower. */
export const SHORT_VIEWPORT = 720;
export const SHORT_FOCAL_Y = .5;
export const SHORT_SCALE = .85;
/** Screen chrome drawn above the stage (px). */
export const HEADER_PX = 70;
export const FOOTER_PX = 80;
/** Rig extents around the face (vmin at scale 1): the bunch top, the feet, and the left/right of the bunch. */
export const RIG_EXTENT = { top: 37, bottom: 14, left: 15, right: 18 } as const;

export type Viewport = { width: number; height: number };
export type Rect = { left: number; top: number; width: number; height: number };
/** The viewport plus the focal point (px) the hedgehog hovers and sneezes at, and his size there. */
export type Focal = Viewport & { fx: number; fy: number; scale: number };
/**
 * Where the sneeze leaves him hanging while he waves, clear of every name: the offset (px) from the focal
 * point, his size there (times the focal scale), the side he tumbles towards, how far (px) the balloons then
 * carry his face up and away, and his sideways drift on the way out (times the pose's drift, in vmin).
 */
export type Hang = { hangX: number; hangY: number; hangScale: number; side: 1 | -1; exitRise: number; exitDrift: number };
export type Scene = Focal & Hang;

const vminOf = (viewport: Viewport) => Math.min(viewport.width, viewport.height) / 100;

/**
 * An empty stretch at the end of an incomplete last row (for example three
 * cards over one on a small screen) that the hedgehog fits into: he hovers
 * there instead of over a card. Null when the cards fill their rows.
 */
export function emptySlot(rects: readonly Rect[], viewport: Viewport, scale: number): Point | null {
  if (rects.length < 2) return null;
  const sorted = [...rects].sort((a, b) => a.top - b.top || a.left - b.left);
  const rows: Rect[][] = [];
  for (const rect of sorted) {
    const row = rows.at(-1);
    if (row && Math.abs(row[0].top - rect.top) < 8) row.push(rect); else rows.push([rect]);
  }
  const last = rows.at(-1);
  if (!last || rows.length < 2 || last.length >= Math.max(...rows.map((row) => row.length))) return null;
  const v = vminOf(viewport) * scale;
  const right = Math.min(viewport.width, Math.max(...rects.map((rect) => rect.left + rect.width)));
  const lastRight = Math.max(...last.map((rect) => rect.left + rect.width));
  const top = Math.min(...last.map((rect) => rect.top));
  const floor = viewport.height - FOOTER_PX;
  if (right - lastRight < (RIG_EXTENT.left + RIG_EXTENT.right) * v) return null;
  if (floor - top < (RIG_EXTENT.bottom + 18) * v) return null;
  const x = (lastRight + right) / 2 - (RIG_EXTENT.right - RIG_EXTENT.left) / 2 * v;
  const y = Math.max(HEADER_PX + RIG_EXTENT.top * v * .8, Math.min(floor - RIG_EXTENT.bottom * v, (top + floor) / 2));
  return { x, y };
}

/** The focal point for a screen: centred, or in an empty slot beside an incomplete last row. */
export function focalFor(viewport: Viewport, rects: readonly Rect[] = []): Focal {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const short = Math.min(width, height) < SHORT_VIEWPORT;
  const scale = short ? SHORT_SCALE : 1;
  const slot = emptySlot(rects, { width, height }, scale);
  return { width, height, scale, fx: slot?.x ?? width * FOCAL.x, fy: slot?.y ?? height * (short ? SHORT_FOCAL_Y : FOCAL.y) };
}

/** Where he would like to hang: blown straight up this far (vmin). */
export const HANG_LIFT_VMIN = 14.6;
/** The blast always moves him at least this far (vmin), so the recoil reads even when the header keeps him low. */
export const HANG_MIN_BLOWN_VMIN = 5;
/** Hang sizes tried in turn (times the focal scale): he only shrinks further when nothing clear fits at the first. */
export const HANG_SCALES = [.9, .76, .64] as const;
/** From when he is most of the way to the hang spot until the exit is under way, every name stays readable (s). */
export const HANG_CHECK_FROM = 3.85;
export const HANG_CHECK_TO = BT.exitStart + .05;
/** Clearance kept around text (px). */
export const TEXT_MARGIN = 4;
/** Extra clearance (px) the search keeps, so the moments between its 50 ms samples stay clear too. */
const SEARCH_SLACK = 3;
/** The candidate grid for the hang spot (vmin around the focal point). */
const HANG_GRID = { step: 2, x: 38, up: 28, down: 46 } as const;

/** A circle of the rig's silhouette (rig units); bunch circles may tuck under the header, the body may not. */
export type RigCircle = { x: number; y: number; r: number; bunch: boolean };

/** The rig's silhouette as circles (rig units, sticker outlines included): balloons, heart, body, feet, free paw and hat. */
export function rigCircles(pose: BalloonPose): RigCircle[] {
  const circles: RigCircle[] = BUNCH.map((balloon) => ({ ...rotateAbout({ x: balloon.x, y: balloon.y }, PAW, pose.bunchRot), r: balloon.width * (balloon.kind === 'star' ? .47 : .56), bunch: true }));
  circles.push({ ...rotateAbout({ x: HEART.x + pose.heartDx, y: HEART.y + pose.heartDy }, PAW, pose.bunchRot), r: HEART.width * .54, bunch: true });
  const hog = (x: number, y: number, r: number) => circles.push({ ...hogToRig({ x, y }, pose), r: r * HOG_SCALE, bunch: false });
  hog(0, QUILLS.cy, QUILLS.outer * pose.quills + 5);
  for (const x of [-22, 22]) hog(x, 80, 17);
  hog(pose.armEx, pose.armEy, 15);
  hog(6, -90 - pose.hatLift, 30);
  return circles;
}

/** The rig's placement on screen for a pose: the face (px), its size, px per rig unit, and its rotation (degrees). */
export function rigPlacement(pose: BalloonPose, scene: Scene) {
  const v = vminOf(scene);
  const below = scene.height - scene.fy + RIG_EXTENT.top * v * scene.scale;
  const face = {
    x: scene.fx + pose.recoil * scene.hangX + scene.exitDrift * pose.driftX * v,
    y: scene.fy + pose.rise * below - pose.lift * v + pose.recoil * scene.hangY - pose.exit * scene.exitRise,
  };
  const scale = scene.scale * mix(1, scene.hangScale, pose.shrink) * pose.rigScale;
  // The balloons lead: the rig leans into the exit drift (none when he goes straight up).
  const lean = EXIT_LEAN * pose.exitLean * Math.max(-1, Math.min(1, scene.exitDrift / 8));
  return { face, scale, unit: v / 10 * scale, rot: scene.side * pose.rigRot + lean };
}

/** A hang for a focal point (the exit distance follows from the spot: his feet end just off the top). */
export function hangAt(focal: Focal, hangX: number, hangY: number, hangScale: number): Hang {
  const side = hangX < -1 ? -1 : 1;
  return { hangX, hangY, hangScale, side, exitRise: Math.max(0, focal.fy + hangY) + exitMarginPx(focal, hangScale), exitDrift: 0 };
}

/**
 * Sideways drifts (vmin) tried on the way out: the lane that crosses names for the shortest time wins (then the
 * one that covers least, then the straightest). He drifts into it while he is still low, then zips up.
 */
export const EXIT_DRIFTS = [0, 4, -4, 8, -8, 12, -12, 16, -16, 20, -20] as const;
/** Exit samples are this far apart (s) when a lane is chosen. */
export const EXIT_STEP = .02;
let exitSampleCache: HangSample[] | null = null;
/** Poses on the way out, every EXIT_STEP from the start of the exit. */
export function exitSamples(): HangSample[] {
  if (!exitSampleCache) {
    exitSampleCache = [];
    for (let t = BT.exitStart; t <= BT.exitEnd + 1e-9; t += EXIT_STEP) {
      const pose = balloonPose(t);
      exitSampleCache.push({ pose, circles: rigCircles(pose), hold: false });
    }
  }
  return exitSampleCache;
}

/**
 * How much text a scene's exit crosses (on-screen circles only): `time` (s) during which any part of him
 * overlaps a name, and the summed overlap (px) as a tie-break.
 */
export function exitCrossing(scene: Scene, texts: readonly Rect[], samples = exitSamples(), step = EXIT_STEP) {
  let time = 0;
  let area = 0;
  for (const { pose, circles } of samples) {
    let hit = 0;
    for (const { x, y, r } of screenCircles(pose, scene, circles)) {
      if (y + r < HEADER_PX) continue;
      for (const text of texts) {
        if (x + r < text.left - TEXT_MARGIN || x - r > text.left + text.width + TEXT_MARGIN || y + r < text.top - TEXT_MARGIN || y - r > text.top + text.height + TEXT_MARGIN) continue;
        hit += textOverlap(x, y, r, text);
      }
    }
    if (hit > 0) time += step;
    area += hit;
  }
  return { time, area };
}

/** How much text a scene's exit crosses: the summed overlap (px) of every on-screen sample. */
export const exitOverlap = (scene: Scene, texts: readonly Rect[]) => exitCrossing(scene, texts).area;

/** The hang with the exit lane that crosses names for the shortest time (then the least, then the straightest). */
function withExitDrift(focal: Focal, hang: Hang, texts: readonly Rect[]): Hang {
  const held = hangOverlap({ ...focal, ...hang }, texts);
  const v = vminOf(focal);
  let best = hang;
  let bestScore = Infinity;
  for (const drift of EXIT_DRIFTS) {
    const candidate = { ...hang, exitDrift: drift * hang.side };
    const scene = { ...focal, ...candidate };
    // He leaves through the top, not the side of the screen.
    const endX = focal.fx + hang.hangX + candidate.exitDrift * v;
    if (drift !== 0 && (endX < focal.width * .04 || endX > focal.width * .96)) continue;
    // The drift starts with the exit, so it must not spoil the end of the hang either.
    if (drift !== 0 && hangOverlap(scene, texts) > held + 1e-9) continue;
    const { time, area } = exitCrossing(scene, texts);
    const score = time * 1e5 + area + Math.abs(drift) * .5;
    if (score < bestScore - 1e-9) { best = candidate; bestScore = score; }
  }
  return best;
}

type HangSample = { pose: BalloonPose; circles: RigCircle[]; hold: boolean };
/** From here until the exit starts he is at his hang spot: then even his balloons stay clear of the header. */
export const HOLD_FROM = 3.95;
let hangSampleCache: HangSample[] | null = null;
/** Poses over the hang check, every 50 ms (they do not depend on the screen). */
export function hangSamples(): HangSample[] {
  if (!hangSampleCache) {
    hangSampleCache = [];
    for (let t = HANG_CHECK_FROM; t <= HANG_CHECK_TO + 1e-9; t += .05) {
      const pose = balloonPose(t);
      hangSampleCache.push({ pose, circles: rigCircles(pose), hold: t >= HOLD_FROM - 1e-9 && t <= BT.exitStart + 1e-9 });
    }
  }
  return hangSampleCache;
}

/** A circle's overlap (px) with a text box grown by the margin: how far it reaches inside. */
export function textOverlap(x: number, y: number, r: number, text: Rect) {
  const nx = Math.max(text.left - TEXT_MARGIN, Math.min(x, text.left + text.width + TEXT_MARGIN));
  const ny = Math.max(text.top - TEXT_MARGIN, Math.min(y, text.top + text.height + TEXT_MARGIN));
  return Math.max(0, r - Math.hypot(x - nx, y - ny));
}

/** The rig's silhouette circles on screen (px) for a pose. */
export function screenCircles(pose: BalloonPose, scene: Scene, circles = rigCircles(pose)) {
  const { face, unit, rot } = rigPlacement(pose, scene);
  const cos = Math.cos(rot * Math.PI / 180);
  const sin = Math.sin(rot * Math.PI / 180);
  return circles.map((circle) => ({ x: face.x + (circle.x * cos - circle.y * sin) * unit, y: face.y + (circle.x * sin + circle.y * cos) * unit, r: circle.r * unit, bunch: circle.bunch }));
}

/** The highest (px) a circle may reach: the body always stays below the header; the balloons only while he holds (when asked). */
const ceilingFor = (bunch: boolean, hold: boolean, holdHeader: boolean) => bunch && !(holdHeader && hold) ? 0 : HEADER_PX + 4;

/**
 * How badly a scene's hang covers text or leaves the screen during the hang check (0 = every name stays
 * readable and his whole body is on screen). The balloons may tuck under the header, unless `holdHeader`:
 * then, while he holds still at the spot (HOLD_FROM until the exit), they must be in full view too.
 */
export function hangOverlap(scene: Scene, texts: readonly Rect[], samples = hangSamples(), holdHeader = false): number {
  const floor = scene.height - FOOTER_PX + 8;
  const all: { x: number; y: number; r: number }[] = [];
  let left = Infinity; let top = Infinity; let right = -Infinity; let bottom = -Infinity;
  let overlap = 0;
  for (const { pose, circles, hold } of samples) {
    for (const { x, y, r, bunch } of screenCircles(pose, scene, circles)) {
      overlap += Math.max(0, r - x) + Math.max(0, x + r - scene.width) + Math.max(0, y + r - floor) + Math.max(0, ceilingFor(bunch, hold, holdHeader) - (y - r));
      all.push({ x, y, r });
      left = Math.min(left, x - r); right = Math.max(right, x + r); top = Math.min(top, y - r); bottom = Math.max(bottom, y + r);
    }
  }
  for (const text of texts) {
    if (text.left - TEXT_MARGIN > right || text.left + text.width + TEXT_MARGIN < left || text.top - TEXT_MARGIN > bottom || text.top + text.height + TEXT_MARGIN < top) continue;
    for (const circle of all) overlap += textOverlap(circle.x, circle.y, circle.r, text);
  }
  return overlap;
}

/**
 * Where the blast leaves him: the nearest spot to "straight up" (then at smaller sizes) where, from 3.85 s
 * until the exit is under way, his whole rig keeps clear of every visible name and stays on screen; at each
 * size, a spot where his balloons are in full view (not under the header) while he waves wins over a nearer
 * one. When nothing is fully clear (a crowded screen), the spot that covers the least.
 */
export function hangFor(focal: Focal, texts: readonly Rect[]): Hang {
  const v = vminOf(focal);
  const preferred = { x: 0, y: -HANG_LIFT_VMIN * v };
  const grid = (step: number) => {
    const offsets: Point[] = [preferred];
    for (let gx = -HANG_GRID.x; gx <= HANG_GRID.x; gx += step) {
      for (let gy = -HANG_GRID.up; gy <= HANG_GRID.down; gy += step) offsets.push({ x: gx * v, y: gy * v });
    }
    return offsets.sort((a, b) => distance(a) - distance(b));
  };
  // Ties go to his right (the way he tumbles by default).
  const distance = (offset: Point) => Math.hypot(offset.x - preferred.x, offset.y - preferred.y) + (offset.x < 0 ? 1e-6 : 0);
  // First the nearest fully clear spot, largest size first (a candidate is dropped at its first overlap).
  const fine = grid(HANG_GRID.step).filter((offset) => Math.hypot(offset.x, offset.y) >= HANG_MIN_BLOWN_VMIN * v - 1e-9);
  for (const hangScale of HANG_SCALES) {
    for (const holdHeader of [true, false]) {
      const probe = hangProbe(focal, hangScale, texts, holdHeader);
      for (const offset of fine) if (probe(offset.x, offset.y, 0) === 0) return withExitDrift(focal, hangAt(focal, offset.x, offset.y, hangScale), texts);
    }
  }
  // A crowded screen: the spot (on a coarser grid) that covers the least, preferring nearer and larger.
  let best = hangAt(focal, preferred.x, preferred.y, HANG_SCALES[0]);
  let bestScore = Infinity;
  HANG_SCALES.forEach((hangScale, index) => {
    const probe = hangProbe(focal, hangScale, texts);
    for (const offset of grid(HANG_GRID.step * 2)) {
      const base = .02 * distance(offset) + 6 * index;
      if (base >= bestScore) continue;
      const score = base + probe(offset.x, offset.y, bestScore - base);
      if (score < bestScore) { bestScore = score; best = hangAt(focal, offset.x, offset.y, hangScale); }
    }
  });
  return withExitDrift(focal, best, texts);
}

/**
 * hangOverlap for many candidate spots at one hang size, fast: every circle's screen offset from the
 * spot is worked out once (a spot only moves them by recoil x offset, and the exit by a little more).
 * The returned probe stops counting once the overlap passes `limit`.
 */
function hangProbe(focal: Focal, hangScale: number, texts: readonly Rect[], holdHeader = false) {
  const floor = focal.height - FOOTER_PX + 8;
  const sides = ([1, -1] as const).map((side) => {
    const scene: Scene = { ...focal, hangX: 0, hangY: 0, hangScale, side, exitRise: 0, exitDrift: 0 };
    return hangSamples().map(({ pose, circles, hold }) => ({ recoil: pose.recoil, exit: pose.exit, hold, circles: screenCircles(pose, scene, circles) }));
  });
  const margin = exitMarginPx(focal, hangScale);
  return (hangX: number, hangY: number, limit: number) => {
    const samples = sides[hangX < -1 ? 1 : 0];
    const exitRise = Math.max(0, focal.fy + hangY) + margin;
    let overlap = 0;
    for (const { recoil, exit, hold, circles } of samples) {
      const dx = recoil * hangX;
      const dy = recoil * hangY - exit * exitRise;
      for (const circle of circles) {
        const x = circle.x + dx;
        const y = circle.y + dy;
        overlap += Math.max(0, circle.r - x) + Math.max(0, x + circle.r - focal.width) + Math.max(0, y + circle.r - floor) + Math.max(0, ceilingFor(circle.bunch, hold, holdHeader) - (y - circle.r));
        if (overlap > limit) return overlap;
        const r = circle.r + SEARCH_SLACK;
        for (const text of texts) {
          if (x + r < text.left - TEXT_MARGIN || x - r > text.left + text.width + TEXT_MARGIN || y + r < text.top - TEXT_MARGIN || y - r > text.top + text.height + TEXT_MARGIN) continue;
          overlap += textOverlap(x, y, r, text);
          if (overlap > limit) return overlap;
        }
      }
    }
    return overlap;
  };
}

/**
 * Where names probably are, for screens whose text could not be read: station labels at the left of a
 * day-table cell; on a team card, the title row and the name list down its left side.
 */
export function textZones(rects: readonly Rect[]): Rect[] {
  return rects.flatMap((rect) => coverShape(rect.width, rect.height) === 'strip'
    ? [{ left: rect.left, top: rect.top, width: rect.width * .55, height: rect.height }]
    : [{ left: rect.left, top: rect.top, width: rect.width * .8, height: Math.min(64, rect.height * .3) }, { left: rect.left, top: rect.top, width: rect.width * .5, height: Math.min(rect.height * .6, 440) }]);
}

/** The scene for a screen: its focal point, and a hang spot that keeps the given text (or likely name zones) readable. */
export function sceneFor(viewport: Viewport, rects: readonly Rect[] = [], texts?: readonly Rect[]): Scene {
  const focal = focalFor(viewport, rects);
  return { ...focal, ...hangFor(focal, texts ?? textZones(rects)) };
}

/**
 * The scene for the reveal's first frames: the real focal point with a hang straight up. The hang only matters from
 * the sneeze, so the search (which reads every text on screen) can follow a couple of frames later.
 */
export function provisionalScene(viewport: Viewport, rects: readonly Rect[] = []): Scene {
  const focal = focalFor(viewport, rects);
  return { ...focal, ...hangAt(focal, 0, -HANG_LIFT_VMIN * vminOf(focal), HANG_SCALES[0]) };
}

// ---------------------------------------------------------------------------
// Rig placement on screen

/** The face centre in viewport pixels. */
export const facePx = (pose: BalloonPose, scene: Scene): Point => rigPlacement(pose, scene).face;

/** Rig size on screen (the scene's size, the hang size and the pose's own). */
export const rigScaleOf = (pose: BalloonPose, scene: Scene) => rigPlacement(pose, scene).scale;

/** CSS transform of the rig box (52 x 56 vmin at the viewport's top left, transform-origin on the face). */
export function rigTransform(pose: BalloonPose, scene: Scene): string {
  const v = vminOf(scene);
  const { face, scale, rot } = rigPlacement(pose, scene);
  return `translate(${(face.x - 26 * v).toFixed(2)}px, ${(face.y - 40 * v).toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
}

/** Outline samples of everything drawn in the rig (u), for bounds checks. */
export function rigHull(pose: BalloonPose): Point[] {
  const points: Point[] = [];
  const circle = (centre: Point, radius: number) => { for (let i = 0; i < 16; i++) points.push({ x: centre.x + radius * Math.cos(i * TAU / 16), y: centre.y + radius * Math.sin(i * TAU / 16) }); };
  for (const balloon of BUNCH) circle(rotateAbout({ x: balloon.x, y: balloon.y }, PAW, pose.bunchRot), balloon.width * .5 + 16);
  circle(rotateAbout({ x: HEART.x + pose.heartDx, y: HEART.y + pose.heartDy }, PAW, pose.bunchRot), HEART.width * .5 + 8);
  circle(hogToRig({ x: 0, y: QUILLS.cy }, pose), (QUILLS.outer * pose.quills + 12) * HOG_SCALE);
  for (const x of [-22, 22]) circle(hogToRig({ x, y: 80 }, pose), 22 * HOG_SCALE);
  circle(hogToRig({ x: pose.armEx, y: pose.armEy }, pose), 20 * HOG_SCALE);
  circle(hogToRig({ x: 12, y: -120 - pose.hatLift }, pose), 20 * HOG_SCALE);
  return points;
}

/** Bounding box of the rig art in viewport pixels. */
export function rigScreenBox(t: number, scene: Scene) {
  const pose = balloonPose(t);
  const { face, unit, rot } = rigPlacement(pose, scene);
  let left = Infinity; let top = Infinity; let right = -Infinity; let bottom = -Infinity;
  for (const point of rigHull(pose)) {
    const p = rotateAbout(point, { x: 0, y: 0 }, rot);
    const x = face.x + p.x * unit;
    const y = face.y + p.y * unit;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { left, top, right, bottom };
}

// ---------------------------------------------------------------------------
// Cards: focus, shape, layout

/** Distance used to normalise the pop ripple: the focal point to the farthest screen corner. */
export const ringMaxRadius = (scene: Focal) => Math.max(
  Math.hypot(scene.fx, scene.fy), Math.hypot(scene.width - scene.fx, scene.fy),
  Math.hypot(scene.fx, scene.height - scene.fy), Math.hypot(scene.width - scene.fx, scene.height - scene.fy),
);

/** Radius of the sneeze ring (px) at time t. */
export const ringRadius = (t: number, scene: Focal) => ringMaxRadius(scene) * clamp01((t - BT.popStart) / BT.popSpread);

export type CoverFocus = { distance: number; dx: number; dy: number; targetX: number; targetY: number };

/** Normalised distance (0 at the focal point, 1 at the farthest corner) and unit direction towards it. */
export function coverFocus(rect: Rect, scene: Focal): CoverFocus {
  const targetX = scene.fx - (rect.left + rect.width / 2);
  const targetY = scene.fy - (rect.top + rect.height / 2);
  const length = Math.hypot(targetX, targetY);
  return { distance: clamp01(length / Math.max(1, ringMaxRadius(scene))), dx: length < 1 ? 0 : targetX / length, dy: length < 1 ? 0 : targetY / length, targetX, targetY };
}

export type CoverShape = 'tall' | 'box' | 'strip';
export function coverShape(width: number, height: number): CoverShape {
  const aspect = width / Math.max(1, height);
  if (aspect >= 1.6 && height < 200) return 'strip';
  return aspect <= .7 ? 'tall' : 'box';
}

export type BalloonColor = 'red' | 'pink' | 'yellow' | 'blue' | 'green' | 'purple' | 'orange';
export const PALETTE: Record<BalloonColor, readonly [string, string]> = {
  red: ['#ff5a6e', '#d93a55'], pink: ['#ff8fc8', '#e2629f'], yellow: ['#ffd23f', '#e8a912'], blue: ['#3fa3f0', '#2a7fcc'],
  green: ['#37c07a', '#23965a'], purple: ['#9a6cff', '#7446e0'], orange: ['#ff9a3c', '#e0741c'],
};
export const CONFETTI_COLORS: readonly BalloonColor[] = ['red', 'yellow', 'blue', 'pink', 'green', 'orange', 'purple'];

type SideKind = 'heart' | 'star';
export const VARIANTS: readonly { hero: BalloonColor; left: readonly [SideKind, BalloonColor]; right: readonly [SideKind, BalloonColor] }[] = [
  { hero: 'red', left: ['heart', 'pink'], right: ['star', 'yellow'] },
  { hero: 'blue', left: ['star', 'yellow'], right: ['heart', 'pink'] },
  { hero: 'green', left: ['heart', 'red'], right: ['star', 'yellow'] },
  { hero: 'purple', left: ['star', 'yellow'], right: ['heart', 'pink'] },
];

/** Body extents as fractions of a balloon's width: top of body, knot bottom. */
export const BALLOON_SHAPE = {
  round: { top: .62, knot: .70, halfWidth: .5 },
  heart: { top: .48, knot: .52, halfWidth: .5 },
  star: { top: .5, knot: .48, halfWidth: .5 },
} as const;

export type CoverBalloon = {
  kind: 'round' | 'heart' | 'star'; color: BalloonColor; width: number; rot: number;
  centre: Point; knot: Point; anchor: Point; hero: boolean;
};

/** A hero balloon with its two little companions, tied to one bow (or, on strips, each to the bottom edge). */
export type CoverBunch = {
  bow: Point | null;
  /** Point the bunch leans about (the bow; strips lean each balloon about its own anchor). */
  leanOrigin: Point;
  /** Hero first, then the left and right companions. */
  balloons: CoverBalloon[];
};

export type CoverLayout = { shape: CoverShape; width: number; height: number; size: number; variant: number; bunches: CoverBunch[] };

export const HERO_Y: Record<CoverShape, number> = { tall: .44, box: .42, strip: .45 };
export const BOW_Y: Record<Exclude<CoverShape, 'strip'>, number> = { tall: .76, box: .84 };
/** A card this wide (a single team on a big screen) gets two bunches, so the hedgehog never hides them. */
export const TWIN_BUNCH_MIN_WIDTH = 900;
export const TWIN_BUNCH_X = [.26, .74] as const;

/** Size of the hero balloon (its body width) for a card, or for one half of a twin card. */
export function heroSize(width: number, height: number, shape = coverShape(width, height)) {
  if (shape === 'tall') return Math.min(width * .56, height * .30, 190);
  if (shape === 'box') return Math.min(width * .46, height * .40, 200);
  return Math.min(height * .63, width * .30, 120);
}

const knotOf = (kind: CoverBalloon['kind'], centre: Point, w: number, rot = 0) => rotateAbout({ x: centre.x, y: centre.y + BALLOON_SHAPE[kind].knot * w }, centre, rot);

function coverBunch(shape: CoverShape, cx: number, span: number, height: number, size: number, variant: number): CoverBunch {
  const scheme = VARIANTS[((variant % 4) + 4) % 4];
  const heroY = height * HERO_Y[shape];
  const strip = shape === 'strip';
  const sideWidth = size * (strip ? .58 : .5);
  const sideDx = strip ? Math.min(Math.max(.9 * size, .26 * span), .5 * span - .35 * size) : Math.max(0, Math.min(.58 * size, .5 * span - .25 * size - 12));
  const sideDy = size * (strip ? .1 : shape === 'tall' ? .44 : .36);
  const bow = strip ? null : { x: cx, y: height * BOW_Y[shape as 'tall' | 'box'] };
  const anchorFor = (x: number) => bow ?? { x, y: height };
  const side = (index: 0 | 1): CoverBalloon => {
    const [kind, color] = index === 0 ? scheme.left : scheme.right;
    const centre = { x: cx + (index === 0 ? -sideDx : sideDx), y: heroY + sideDy };
    const rot = index === 0 ? -10 : 10;
    return { kind, color, width: sideWidth, rot, centre, knot: knotOf(kind, centre, sideWidth, rot), anchor: anchorFor(centre.x), hero: false };
  };
  const heroCentre = { x: cx, y: heroY };
  const hero: CoverBalloon = { kind: 'round', color: scheme.hero, width: size, rot: 0, centre: heroCentre, knot: knotOf('round', heroCentre, size), anchor: anchorFor(cx), hero: true };
  return { bow, leanOrigin: bow ?? { x: cx, y: height }, balloons: [hero, side(0), side(1)] };
}

export function coverLayout(width: number, height: number, variant: number): CoverLayout {
  const shape = coverShape(width, height);
  const twin = shape !== 'strip' && width >= TWIN_BUNCH_MIN_WIDTH;
  const span = twin ? width / 2 : width;
  const size = heroSize(span, height, shape);
  const centres = twin ? TWIN_BUNCH_X.map((x) => width * x) : [width / 2];
  return { shape, width, height, size, variant, bunches: centres.map((cx, i) => coverBunch(shape, cx, span, height, size, variant + i)) };
}

/** Normalised distance (0..1) of a viewport point from the focal point. */
export const focusDistance = (x: number, y: number, scene: Focal) =>
  clamp01(Math.hypot(x - scene.fx, y - scene.fy) / Math.max(1, ringMaxRadius(scene)));

/** Pop time (s) of each bunch: the moment the sneeze ring reaches its hero balloon. */
export function bunchPopTimes(rect: Rect, layout: CoverLayout, scene: Focal, focus = coverFocus(rect, scene)): number[] {
  return layout.bunches.map((_, bunch) => {
    const hero = heroPopPoint(layout, focus, bunch);
    return popAt(focusDistance(rect.left + hero.x, rect.top + hero.y, scene));
  });
}

/** Pull (px) of a cover's balloon layer towards the hedgehog at a pull stop, clamped per axis as in balloons.css. */
export function pullOffset(focus: Pick<CoverFocus, 'targetX' | 'targetY'>, stop: { f: number; max: number } = PULL_FINAL): Point {
  const clampPx = (value: number) => Math.max(-stop.max, Math.min(stop.max, value * stop.f));
  return { x: clampPx(focus.targetX), y: clampPx(focus.targetY) };
}

/** Where a hero balloon is when it pops, in the cover's own px (after the pull and the lean). */
export function heroPopPoint(layout: CoverLayout, focus: CoverFocus, bunch = 0): Point {
  const { balloons, leanOrigin } = layout.bunches[bunch];
  const hero = balloons[0];
  const pull = pullOffset(focus);
  const leaned = rotateAbout(hero.centre, layout.shape === 'strip' ? hero.anchor : leanOrigin, focus.dx * PULL_FINAL.lean);
  return { x: leaned.x + pull.x, y: leaned.y + pull.y };
}

/** Direction (degrees, screen angle) from a card towards the hedgehog, for the inhale air streaks. */
export const airAngle = (focus: Pick<CoverFocus, 'dx' | 'dy'>) => Math.atan2(focus.dy, focus.dx) * 180 / Math.PI;

// ---------------------------------------------------------------------------
// Pop pieces

/** A torn paper tile: its box and jagged outline (cover px), and where it flies. */
export type Shard = { left: number; top: number; width: number; height: number; points: [number, number][]; tx: number; ty: number; rot: number };

/** Paper pieces are about this big (px), so every card, from a day-table cell to one huge team card, pops into small scraps. */
export const SHARD_SIZE = { width: 110, height: 160 } as const;
export const SHARD_MAX = { cols: 6, rows: 4 } as const;

/** Shard grid for a cover: [columns, rows] (day-table cells tear into three). */
export function shardGrid(layout: Pick<CoverLayout, 'shape' | 'width' | 'height'>): readonly [number, number] {
  if (layout.shape === 'strip') return [3, 1];
  const fit = (length: number, piece: number, most: number) => Math.max(2, Math.min(most, Math.round(length / piece)));
  return [fit(layout.width, SHARD_SIZE.width, SHARD_MAX.cols), fit(layout.height, SHARD_SIZE.height, SHARD_MAX.rows)];
}

/**
 * Paper tiles with jagged, slightly overlapping inner edges, and where each one
 * flies: outwards from the popping hero balloon, pushed away from the hedgehog,
 * and dropping a little under gravity. Travel scales with the piece's own size.
 */
export function paperShards(layout: CoverLayout, focus: Pick<CoverFocus, 'dx' | 'dy'>): Shard[] {
  const [cols, rows] = shardGrid(layout);
  const { width, height, size } = layout;
  const heroes = layout.bunches.map((bunch) => bunch.balloons[0].centre);
  const overlap = 5;
  const random = seededRandom(0xB411 + cols * 7 + rows + layout.variant * 131);
  const shards: Shard[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * width / cols - (col > 0 ? overlap : 0);
      const x1 = (col + 1) * width / cols + (col < cols - 1 ? overlap : 0);
      const y0 = row * height / rows - (row > 0 ? overlap : 0);
      const y1 = (row + 1) * height / rows + (row < rows - 1 ? overlap : 0);
      const w = x1 - x0;
      const h = y1 - y0;
      const pts: [number, number][] = [];
      const edge = (ax: number, ay: number, bx: number, by: number, jagged: boolean) => {
        const length = Math.hypot(bx - ax, by - ay);
        const steps = jagged ? Math.max(2, Math.round(length / 18)) : 1;
        for (let i = 0; i < steps; i++) {
          const s = i / steps;
          const nx = -(by - ay) / length;
          const ny = (bx - ax) / length;
          const push = jagged && i > 0 ? (i % 2 ? 1 : -1) * overlap * (.5 + random() * .5) : 0;
          pts.push([x0 + ax + (bx - ax) * s + nx * push, y0 + ay + (by - ay) * s + ny * push]);
        }
      };
      edge(0, 0, w, 0, row > 0);
      edge(w, 0, w, h, col < cols - 1);
      edge(w, h, 0, h, row < rows - 1);
      edge(0, h, 0, 0, col > 0);
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const hero = heroes.reduce((best, h) => Math.hypot(h.x - mx, h.y - my) < Math.hypot(best.x - mx, best.y - my) ? h : best);
      const ox = mx - hero.x;
      const oy = my - hero.y;
      const length = Math.max(1, Math.hypot(ox, oy));
      const piece = layout.shape === 'strip' ? size : Math.sqrt(w * h);
      const reach = (layout.shape === 'strip' ? .6 : .9) * piece * (.75 + random() * .5);
      shards.push({
        left: x0, top: y0, width: w, height: h, points: pts,
        tx: ox / length * reach - focus.dx * .3 * piece,
        ty: oy / length * reach - focus.dy * .3 * piece + .3 * piece,
        rot: (random() < .5 ? -1 : 1) * (28 + random() * 34),
      });
    }
  }
  return shards;
}

/** Jagged pop star, outer radius 1 (alternating long/short spikes). */
export function burstPoints(points = 12, inner = .58): string {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / points;
    const r = i % 2 ? inner : i % 4 === 0 ? 1 : .84;
    out.push(`${(r * Math.cos(a)).toFixed(3)} ${(r * Math.sin(a)).toFixed(3)}`);
  }
  return `M${out.join('L')}Z`;
}

// ---------------------------------------------------------------------------
// Stage confetti

export const CONFETTI_BUDGET = 120;
/** From this many covers (a long day table), each card keeps only its hero balloon and a simple paper pop. */
export const DENSE_COVERS = 19;
export const isDense = (count: number) => count >= DENSE_COVERS;
export const confettiPerCard = (count: number) => Math.max(isDense(count) ? 2 : 4, Math.min(30, Math.floor(CONFETTI_BUDGET / Math.max(1, count))));

export type ConfettiKind = 'streamer' | 'sparkle' | 'dot' | 'rect';
export type ConfettiPiece = { key: string; kind: ConfettiKind; color: BalloonColor; x: number; y: number; bx: number; by: number; fall: number; sway: number; spin: number; tilt: number; delayMs: number; durationMs: number };

export type ConfettiTarget = Rect & { index: number };

export function confettiKind(i: number): ConfettiKind {
  if (i % 7 === 0) return 'streamer';
  if (i % 5 === 1) return 'sparkle';
  if (i % 3 === 0) return 'dot';
  return 'rect';
}

/** Seeded confetti for one card, bursting from its hero balloon when it pops. */
export function cardConfetti(target: ConfettiTarget, count: number, scene: Focal): ConfettiPiece[] {
  const focus = coverFocus(target, scene);
  const layout = coverLayout(target.width, target.height, target.index);
  const origins = layout.bunches.map((_, bunch) => heroPopPoint(layout, focus, bunch));
  const pops = bunchPopTimes(target, layout, scene, focus);
  const burst = Math.max(50, Math.min(200, .55 * Math.min(target.width / origins.length, target.height)));
  const fall = scene.height * .24;
  const perCard = confettiPerCard(count);
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < perCard; i++) {
    const random = seededRandom(0xB411 + target.index * 97 + i);
    const angle = random() * TAU;
    const speed = .45 + random() * .55;
    const bunch = i % origins.length;
    const origin = origins[bunch];
    pieces.push({
      key: `${target.index}-${i}`,
      kind: confettiKind(i),
      color: CONFETTI_COLORS[(i + target.index) % CONFETTI_COLORS.length],
      x: target.left + origin.x, y: target.top + origin.y,
      bx: Math.cos(angle) * burst * speed - focus.dx * .35 * burst,
      by: Math.sin(angle) * burst * speed - focus.dy * .35 * burst,
      fall,
      sway: (random() < .5 ? -1 : 1) * .06 * burst * (1 + random()),
      spin: (random() < .5 ? -1 : 1) * (360 + random() * 540),
      tilt: random() * 360,
      delayMs: Math.round(pops[bunch] * 1000),
      durationMs: Math.round((BT.confettiMin + BT.confettiJitter * random()) * 1000),
    });
  }
  return pieces;
}

/** How long after its pop time a balloon cover's last piece is still visible (s). */
export const COVER_TAIL = Math.max(
  BT.shardDelay + BT.shardDur,
  BT.qflyDur,
  2 * BT.popLag + BT.burstDur,
  2 * BT.popLag + BT.stringDrop,
  -BT.popSquash + 2 * BT.popLag + BT.popDur * .58,
);
/** Last moment anything of a cover is visible (s), for a pop at `popTime`. */
export const coverClearAt = (popTime: number) => popTime + COVER_TAIL;
