/**
 * Saturn V · Moon landing: every beat, camera and pose on one scene clock.
 *
 * Pure numbers, no React, so the tests can pin the story. The world is a
 * 1600 × 900 viewBox; `moonFit` maps it onto any viewport so the action band
 * (world y 90–800) always sits between the app header and the footer controls.
 * Times are seconds (T) from the start of the reveal.
 */
import { clamp01, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, keyframes, mix, progress, smooth } from './sceneMotion';

export const MOON_DURATION_MS = 9700;

/** The story beats, strictly in order (seconds). */
export const MOON_BEATS = {
  count3: .15, count2: .75, count1: 1.35, liftoff: 1.95, whipStart: 2.62, whipEnd: 3.30, sep1: 3.62, sep2: 4.26,
  glintCut: 4.80, dive: 5.30, hover: 5.95, scoot: 6.20, contact: 7.05, climb: 7.22, step: 7.60, hopStart: 7.92,
  hopLand: 8.36, plant: 8.44, flagGlint: 8.64, irisStart: 8.90, hold: 9.28, snap: 9.40, closed: 9.48, popEnd: 9.69,
} as const;
const B = MOON_BEATS;

/**
 * CSS overlays (keyframes mounted at T = 0 so the lab can seek them).
 * `moon.css` mirrors these numbers; the tests read both.
 */
export const MOON_OVERLAY_MS = {
  count: { delays: [150, 750, 1350], duration: 600 },
  beams: { delay: 1250, duration: 360 },
  liftoff: { delay: 1950, duration: 1050 },
  glint: { delay: 4670, duration: 260 },
  shooting: { delays: [3150, 5500], duration: 520 },
  flagGlint: { delay: 8640, duration: 420 },
  flagStars: { delay: 8660, duration: 450 },
  /** The POP: the burst swallows the last of the closing window, then stars, sparkles and a shock ring fly out. */
  popBurst: { delay: 9460, duration: 225 },
  popStars: { delay: 9465, duration: 225 },
  popSparks: { delay: 9470, duration: 215 },
  popRing: { delay: 9475, duration: 205 },
  twinkle: { duration: 320 },
} as const;

// ------------------------------------------------------------------ fit
export const MOON_WORLD_W = 1600;
export const MOON_WORLD_H = 900;
/** App chrome that sits above the stage (measured ≈ 66 px header and 67 px footer, plus margin). */
export const MOON_HEADER_PX = 70;
export const MOON_FOOTER_PX = 70;
/** World rows that must stay between the header and the footer. */
export const MOON_BAND_TOP = 90;
export const MOON_BAND_BOTTOM = 800;

export type MoonFit = { w: number; h: number; k: number; ox: number; oy: number };
/**
 * One fit for every layer. At 16:10, 16:9 and 4:3 it is plain "slice"; on very
 * wide or very short screens it shrinks so the action band clears the chrome
 * (the art extends well past x 0–1600, so wider views need no new art).
 */
export function moonFit(w: number, h: number): MoonFit {
  const kSlice = Math.max(w / MOON_WORLD_W, h / MOON_WORLD_H);
  const kBand = (h - MOON_HEADER_PX - MOON_FOOTER_PX) / (MOON_BAND_BOTTOM - MOON_BAND_TOP);
  const k = kBand > 0 ? Math.min(kSlice, kBand) : kSlice;
  const ox = (w - MOON_WORLD_W * k) / 2;
  const oy = k === kSlice ? (h - MOON_WORLD_H * k) / 2 : MOON_HEADER_PX - MOON_BAND_TOP * k;
  return { w, h, k, ox, oy };
}
export const moonToScreen = (fit: MoonFit, x: number, y: number) => ({ x: fit.ox + x * fit.k, y: fit.oy + y * fit.k });
/** viewBox for a full-screen SVG layer drawn in world units. */
export const moonViewBox = ({ w, h, k, ox, oy }: MoonFit) => `${r2(-ox / k)} ${r2(-oy / k)} ${r2(w / k)} ${r2(h / k)}`;

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Trapezoidal ease: gentle start and stop, peak speed only 4/3 of the average. */
const trapezoid = (u: number) => {
  const x = clamp01(u), a = .25, v = 1 / (1 - a);
  if (x < a) return v * x * x / (2 * a);
  if (x > 1 - a) return 1 - v * (1 - x) * (1 - x) / (2 * a);
  return v * (x - a / 2);
};

// ------------------------------------------------------------------ launch camera
export const LIFT = B.liftoff;
/** Deck top = engine-bell exit plane. */
export const PAD_Y = 744;
/** Rig origin (world): push-in, pull-back and shake all pivot here. */
export const RIG_ORIGIN = { x: 740, y: 790 } as const;
/** Rocket art: local nose tip (the escape tower's point), after the baked .925 × .98 slimming. */
export const ROCKET_NOSE_LOCAL = -624 * .98;
export const ROCKET_SX = .925;
export const ROCKET_SY = .98;

export const moonAltitude = (T: number) => { const u = Math.max(0, T - LIFT); return 46 * u + 150 * u * u; };
/** The rocket may climb about 80 units on screen, then the ground falls away instead. */
export const FOLLOW_C = 80;
export const moonFollow = (T: number) => { const a = moonAltitude(T); return a - FOLLOW_C * (1 - Math.exp(-a / FOLLOW_C)); };
/** Pad-layer drop in world units (follow camera, then the whip up through the clouds). */
export const moonGroundDrop = (T: number) => moonFollow(T) + 1150 * easeInOutCubic(progress(T, B.whipStart, B.whipEnd));
/** Countdown push-in, pull back at release, settle during the whip. */
export const moonRigScale = (T: number) => keyframes(T, [[0, 1], [LIFT, 1.03], [B.whipStart, .92], [B.whipEnd, 1]]);
const SHAKE_KEYS = [[.70, 0], [.80, .8], [1.30, .8], [1.45, 2.5], [1.90, 3], [2.00, 8], [2.60, 4.5], [3.40, 0]] as const;
export const moonShakeAmp = (T: number) => (T <= .70 || T >= 3.40 ? 0 : keyframes(T, SHAKE_KEYS));
/** Camera shake in world units (applied as a compositor transform on the rig). */
export function moonShake(T: number) {
  const a = moonShakeAmp(T);
  if (a === 0) return { x: 0, y: 0 };
  return {
    x: a * (.6 * Math.sin(2 * Math.PI * 13 * T) + .4 * Math.sin(2 * Math.PI * 21 * T + 1.3)),
    y: a * (.6 * Math.sin(2 * Math.PI * 17 * T + .5) + .4 * Math.sin(2 * Math.PI * 9 * T + 2.1)),
  };
}
/** Screen position of a world point on the launch rig (push-in and shake included). */
export function moonRigToScreen(fit: MoonFit, T: number, x: number, y: number) {
  const s = moonRigScale(T);
  const shake = moonShake(T);
  const o = moonToScreen(fit, RIG_ORIGIN.x, RIG_ORIGIN.y);
  return { x: o.x + (x - RIG_ORIGIN.x) * fit.k * s + shake.x * fit.k, y: o.y + (y - RIG_ORIGIN.y) * fit.k * s + shake.y * fit.k };
}

const climbY = (T: number) => PAD_Y - FOLLOW_C * (1 - Math.exp(-moonAltitude(T) / FOLLOW_C));
/**
 * Sparkle-cut target (world): the S-IVB flies onto the little Moon's face and
 * the glint peaks there, so the story reads "fly into the Moon, sparkle, we're there".
 */
export const MOON_GLINT_WORLD = { x: 1110, y: 430 } as const;
/** Glint box (world units; it peaks at ×1.25): its star arms reach past the little Moon's rim at the cut. */
export const MOON_GLINT_SIZE = 270;
/** Middle of the S-IVB and CSM (rocket-local y, after the baked slimming): the part that flies into the glint. */
export const ROCKET_SIVB_MID_LOCAL = -440 * ROCKET_SY;
const CUT_ROT = 64;
const CUT_S = .32;
/** Rocket pose at the cut: the S-IVB's middle sits on the glint. */
const CUT_POSE = {
  x: MOON_GLINT_WORLD.x + CUT_S * ROCKET_SIVB_MID_LOCAL * Math.sin(CUT_ROT * Math.PI / 180),
  y: MOON_GLINT_WORLD.y - CUT_S * ROCKET_SIVB_MID_LOCAL * Math.cos(CUT_ROT * Math.PI / 180),
};
/** Saturn V pose (world; x, y at the engine-exit plane; degrees; uniform scale). */
export function moonRocketPose(T: number) {
  const tremble = T < LIFT ? .9 * Math.sin(2 * Math.PI * 29 * T) * progress(T, 1.40, LIFT) : 0;
  const y = T <= B.whipStart ? climbY(T) + tremble : keyframes(T, [[B.whipStart, climbY(B.whipStart)], [3.30, 666], [3.85, 671], [4.36, 650], [B.glintCut, CUT_POSE.y]]);
  const x = keyframes(T, [[B.whipStart, 740], [3.30, 680], [3.85, 590], [4.36, 620], [B.glintCut, CUT_POSE.x]]);
  const rot = keyframes(T, [[2.75, 0], [3.35, 16], [3.85, 44], [4.40, 50], [B.glintCut, CUT_ROT]]);
  const s = keyframes(T, [[B.whipStart, 1], [3.30, .94], [3.85, .92], [4.36, .86], [B.glintCut, CUT_S]]);
  return { x: x + tremble * .4, y, rot, s };
}

/** Everything that changes inside the Saturn V per frame. Burns are plume scales (0 = off). */
export function moonStagePoses(T: number) {
  const ignition = smooth(progress(T, 1.30, 1.90));
  const flicker = 1 + Math.sin(T * 47) * .06 + Math.sin(T * 83) * .04;
  const sep1 = progress(T, B.sep1, 4.45);
  const sep2 = progress(T, B.sep2, 4.80);
  const tower = progress(T, 3.98, 4.45);
  const s1Burn = T < 3.60 ? ignition * mix(1, 1.3, smooth(progress(T, LIFT, 2.60))) * mix(1, 1.45, smooth(progress(T, 2.70, 3.35))) * (1 - smooth(progress(T, 3.45, 3.60))) : 0;
  const s2Burn = T > 3.72 && T < 4.28 ? smooth(progress(T, 3.72, 3.86)) * (1 - smooth(progress(T, 4.20, 4.28))) : 0;
  const s3Burn = T > 4.36 ? smooth(progress(T, 4.36, 4.48)) : 0;
  const seed = T < 1.35 ? smooth(progress(T, .75, 1.30)) * (.16 + .06 * Math.sin(T * 88)) : 0;
  // Spent stages tumble away and recede into the distance: they shrink to nothing, never fade.
  const shrink = (s: number) => 1 - smooth(progress(s, .2, 1));
  return {
    flicker, s1Burn, s2Burn, s3Burn, seed,
    /** Hot underglow on the S-IC skirt while the first stage burns. */
    underglow: s1Burn > 0 ? Math.min(1, s1Burn) * (T < 2.9 ? 1 : .6) : 0,
    stage1: sep1 < 1 ? { x: -36 * sep1 * sep1, y: 300 * sep1 * sep1 + 120 * sep1, rot: -40 * sep1 * sep1, s: shrink(sep1), pivot: -120 } : null,
    stage2: sep2 < 1 ? { x: -20 * sep2 * sep2, y: 200 * sep2 * sep2 + 30 * sep2, rot: -24 * sep2 * sep2, s: shrink(sep2), pivot: -290 } : null,
    tower: tower < 1 ? { x: 70 * tower * tower, y: -190 * tower, rot: 30 * tower, s: 1 - smooth(progress(tower, .35, 1)), flame: tower > 0 } : null,
    /** Smoke-ring POPs at the joints (0–1 while showing, else null). */
    ring1: T > B.sep1 && T < 4.25 ? progress(T, B.sep1, 4.25) : null,
    ring2: T > B.sep2 && T < 4.62 ? progress(T, B.sep2, 4.62) : null,
  };
}

export const MOON_ARMS = [[-84, 50, 0], [-206, 50, 0], [-316, 50, 0], [-418, 62, 0], [-520, 70, 0], [-546, 78, 1]] as const;
/** Swing-arm retraction, quantized so the memoized arms re-render at most 50 times. */
export const moonArmRetract = (T: number) => Math.round(smooth(progress(T, 1.42, LIFT)) * 50) / 50;
/**
 * The warm wash is a full-frame layer on the rig, which zooms out to 0.92 at
 * the whip: it is overscanned by this share of the frame on the left, right
 * and bottom (moon.css mirrors it) so no untinted strip shows at the edges.
 */
export const MOON_WASH_OVERSCAN = .12;
/** Pad glow and warm wash: light, so it may fade. */
export const moonPadGlow = (T: number) => (T < 1.40 || T > 3.10 ? 0 : smooth(progress(T, 1.40, 1.70)) * (1 - smooth(progress(T, 2.50, 3.10))) * (1 + .08 * Math.sin(2 * Math.PI * 11 * T)));
/** Trench fire: two sideways flames on "1", out by 2.75. */
export function moonTrenchFire(T: number) {
  const a = smooth(progress(T, 1.36, 1.62)) * (1 - smooth(progress(T, 2.25, 2.75)));
  return a > 0 ? { a, fl: 1 + .08 * Math.sin(T * 71) } : null;
}
/** Deck flash and lens streak at release. */
export function moonDeckFlash(T: number) {
  const u = progress(T, 1.93, 2.40);
  if (u <= 0 || u >= 1) return null;
  return { f: Math.sin(Math.PI * Math.min(1, u * 1.6)) * (1 - u * .4), e: easeOutCubic(u) };
}
export const moonSkies = (T: number) => ({
  dawn: 1 - smooth(progress(T, 2.66, 3.05)),
  blue: 1 - smooth(progress(T, 2.95, 3.40)),
  stars: smooth(progress(T, 2.90, 3.35)),
});
/** Cloud outline: circles [x, y, r] for a 200-unit-wide cloud. */
export const MOON_CLOUD_CIRCLES = [[-60, 0, 34], [-22, -18, 44], [26, -26, 50], [66, -4, 34], [0, 4, 38], [-86, 10, 22], [92, 10, 22]] as const;
/** Day clouds in the pad layer [x, y, width] (world) — gone below the frame before the layer unmounts. */
export const MOON_DAY_CLOUDS = [[420, -200, 420], [1180, -360, 520], [700, -450, 380]] as const;
export const MOON_PAD_UNMOUNT = 3.45;

// ------------------------------------------------------------------ puffs (smoke and dust never fade: they grow, move and shrink)
type Puff = { birth: number; x0: number; y0: number; vx: number; vy: number; size: number; grow: number; shape: number; rate: number };
export type MoonPuff = { id: number; x: number; y: number; s: number; shape: number; flip: number; warm: boolean };
const PAD_PUFFS: readonly Puff[] = (() => {
  const out: Puff[] = [];
  // Trench jets: out from under both ends of the mobile launcher, along the ground.
  for (let i = 0; i < 16; i++) { const side = i % 2 ? 1 : -1; out.push({ birth: 1.38 + (i >> 1) * .085, x0: 740 + side * 190, y0: 802, vx: side * (230 + (i * 37) % 110), vy: -(24 + (i * 53) % 60), size: .5 + ((i * 29) % 30) / 100, grow: 1.5, shape: i % 3, rate: 1.4 }); }
  // Base bank: where the plume hits the deck, billowing both ways.
  for (let i = 0; i < 14; i++) { const side = i % 2 ? 1 : -1; out.push({ birth: 1.55 + (i >> 1) * .1, x0: 740 + side * (40 + (i * 13) % 30), y0: 786, vx: side * (150 + (i * 41) % 140), vy: -(14 + (i * 23) % 56), size: .55 + ((i * 17) % 30) / 100, grow: 1.4, shape: (i + 1) % 3, rate: 1.7 }); }
  // The plume plunges into these, right under the engines.
  for (let i = 0; i < 5; i++) { const side = i % 2 ? 1 : -1; out.push({ birth: 1.5 + i * .09, x0: 740 + side * (i * 10), y0: 816 + (i % 3) * 5, vx: side * (40 + i * 16), vy: -(2 + i * 2), size: .6 + (i % 2) * .1, grow: 1.1, shape: i % 3, rate: 1.9 }); }
  // Steam column trailing up around the plume after release.
  for (let i = 0; i < 6; i++) { const side = i % 2 ? 1 : -1; out.push({ birth: 2.1 + i * .08, x0: 740 + side * 90, y0: 760, vx: side * (70 + i * 10), vy: -(90 + i * 22), size: .42 + i * .03, grow: 1.2, shape: i % 3, rate: 1.3 }); }
  return out;
})();
export const MOON_PAD_PUFF_COUNT = PAD_PUFFS.length;
/**
 * Fire-lit (warm) or plain smoke, fixed for each puff's whole life so no puff
 * ever changes colour on screen: the ones that stay near the plume (judged
 * halfway through their billow) are warm, the ones that roll out wide are cool.
 */
const PAD_WARM: readonly boolean[] = PAD_PUFFS.map((p) => Math.hypot(p.x0 + .5 * p.vx - 740, (p.y0 + .5 * p.vy - 764) * 1.6) < 190);
/** Pad smoke in pad-layer world coordinates, back to front. */
export function moonPadPuffs(T: number): MoonPuff[] {
  if (T < 1.38 || T >= MOON_PAD_UNMOUNT) return [];
  const items: MoonPuff[] = [];
  PAD_PUFFS.forEach((p, id) => {
    const age = T - p.birth;
    if (age <= 0) return;
    const e = 1 - Math.exp(-age * p.rate);
    const x = p.x0 + p.vx * e;
    const y = p.y0 + p.vy * e;
    const s = p.size * (.3 + p.grow * e);
    items.push({ id, x, y, s, shape: p.shape, flip: p.vx < 0 ? -1 : 1, warm: PAD_WARM[id] });
  });
  return items.sort((a, b) => a.y + a.s * 30 - (b.y + b.s * 30));
}
/** LOX vent wisps before ignition: they swell and shrink away each 1.4 s cycle. */
export const MOON_VENTS = [[-300, 0], [-420, .35], [-300, .7], [-420, 1.05]] as const;
export function moonVentWisps(T: number) {
  if (T > 2.1) return [];
  return MOON_VENTS.flatMap(([ly, d], i) => {
    if (T < d) return [];
    const age = ((T + 1.4 - d) % 1.4) / 1.4;
    const side = i % 2 ? 1 : -1;
    const s = .1 + .22 * Math.sin(Math.PI * Math.min(1, age * 1.15));
    return [{ id: i, x: 740 + side * (37 + age * 70), y: PAD_Y + ly * .98 - age * 24, s, shape: i % 3, flip: side }];
  });
}

const DUST: readonly Puff[] = Array.from({ length: 24 }, (_, i) => {
  const side = i % 2 ? 1 : -1;
  return { birth: 6.62 + (i >> 1) * .026, x0: side * (24 + (i * 7) % 20), y0: 744 + ((i * 5) % 3) * 5, vx: side * (230 + (i * 41) % 240), vy: -((i * 13) % 26), size: .62 + ((i * 23) % 40) / 100, grow: 1.35, shape: i % 3, rate: 2.1 };
});
export const MOON_DUST_SETTLE = [.36, .74] as const;
/** Landing dust: no air on the Moon, so it flies out flat and fast, then settles (shrinks). */
export function moonDust(T: number, cx: number) {
  if (T < 6.6 || T > 7.75) return [];
  const items: { id: number; x: number; y: number; s: number; age: number; shape: number; flip: number }[] = [];
  DUST.forEach((p, id) => {
    const age = T - p.birth;
    if (age <= 0) return;
    const e = 1 - Math.exp(-age * p.rate);
    const settle = 1 - smooth(progress(age, MOON_DUST_SETTLE[0], MOON_DUST_SETTLE[1]));
    if (settle <= 0) return;
    items.push({ id, x: cx + p.x0 + p.vx * e, y: p.y0 + p.vy * e + 10 * (1 - settle), s: p.size * (.35 + p.grow * e) * settle, age, shape: p.shape, flip: p.vx < 0 ? -1 : 1 });
  });
  return items.sort((a, b) => a.y - b.y);
}
/** Pale streaks that shoot out with the dust. */
export function moonDustStreaks(T: number, cx: number) {
  if (T < 6.62 || T > 7.5) return [];
  return [-1, 1].flatMap((s) => [0, 1, 2, 3].flatMap((j) => {
    const e = smooth(progress(T, 6.62 + j * .06, 7.25 + j * .05));
    if (e >= 1) return [];
    return [{ id: `${s}${j}`, x: cx + s * (70 + e * 280 + j * 12), y: 744 + j * 6, len: s * (50 + 50 * (1 - e)) * (1 - e) }];
  }));
}

// ------------------------------------------------------------------ space
/** The Sun in space (world): low at the right, the key light. */
export const MOON_SUN = { x: 1470, y: 640 } as const;
/** The Sun's disc blooms in (scale 0 → 1, easeOutBack) over this window (s). */
export const MOON_SUN_BLOOM = [3.05, 3.35] as const;
/** The little Moon ahead: it drifts down into the rocket's path and swells as we close in (world; the globe art is r 100). */
export const MOON_SMALL_PATH = { from: { x: 1340, y: 190, s: .36 }, to: { x: 1120, y: 450, s: 1.1 } } as const;
export function moonSpace(T: number) {
  const u = progress(T, 3.3, B.glintCut);
  const { from, to } = MOON_SMALL_PATH;
  const drift = smooth(u);
  return {
    earth: { x: keyframes(T, [[3.0, 300], [4.35, 300], [4.8, 240]]), y: keyframes(T, [[3.0, 1300], [3.8, 830], [4.35, 816], [4.8, 880]]), s: keyframes(T, [[3.0, 3.2], [4.35, 3.0], [4.8, 2.0]]) },
    moonSmall: { x: mix(from.x, to.x, drift), y: mix(from.y, to.y, drift), s: from.s * (to.s / from.s) ** (u ** 1.6), show: smooth(progress(T, 3.25, 3.6)) },
    /** The Sun's light (glow, rays, streak) may fade in… */
    flare: smooth(progress(T, 3.0, 3.4)),
    /** …but its disc is solid: it blooms in at full strength, scaling up about its centre. */
    sunCore: Math.max(0, easeOutBack(progress(T, MOON_SUN_BLOOM[0], MOON_SUN_BLOOM[1]))),
  };
}
/** Lunar orbit globe and the dive to the horizon (radius ×40 in log space). */
export function moonGlobe(T: number) {
  const dive = easeInOutCubic(progress(T, B.dive, 5.9));
  const r = 640 * Math.exp(dive * Math.log(40));
  const top = mix(560, 380, dive);
  return { dive, r, cx: mix(1020, 800, dive), cy: top + r, top };
}
/**
 * The dive swap: nothing solid fades. Before it, the globe's maria and craters
 * rush out past its rim with the zoom (and the terminator shading, which is
 * light, lifts), leaving a plain disc; on the swap frame the far and near
 * ground, clipped to the same growing circle, replace it outright, and the
 * boulder pile pops up from its base as an object.
 */
export const MOON_DIVE_SWAP = 5.5;
export const MOON_PILE_POP = [MOON_DIVE_SWAP, 5.62] as const;
/** The globe disc shifts from its own fill to the far ground's, so the swap is a like-for-like switch. */
export const MOON_DISC_FILL = ['#ddd5c6', '#d4cbb9'] as const;
const mixHex = (a: string, b: string, u: number) => `#${[1, 3, 5].map((i) => Math.round(mix(parseInt(a.slice(i, i + 2), 16), parseInt(b.slice(i, i + 2), 16), clamp01(u))).toString(16).padStart(2, '0')).join('')}`;
/**
 * How far the globe decals are pushed out (×) by the swap. Gentle enough that
 * the biggest mare and craters are still sliding off the top of the frame on
 * the last globe frame, so the disc never goes blank before the ground arrives.
 */
export const MOON_DECAL_PUSH = 3;
export function moonDive(T: number) {
  const push = progress(T, B.dive, MOON_DIVE_SWAP) ** 2;
  const ground = T >= MOON_DIVE_SWAP;
  const u = smooth(progress(T, B.dive, MOON_DIVE_SWAP));
  return {
    /** Which layers show: each is simply on or off (no layer opacity). */
    globe: T >= B.glintCut && T < 5.95,
    far: ground,
    near: ground,
    /** Globe decals scale about the limb point (0, -100) as they rush out; null once gone. */
    decals: T < MOON_DIVE_SWAP ? 1 + (MOON_DECAL_PUSH - 1) * push : null,
    /** Terminator shading on the globe (light). */
    night: 1 - u,
    disc: mixHex(MOON_DISC_FILL[0], MOON_DISC_FILL[1], u),
    /** Boulder pile scale about its base (0 before the swap). */
    pile: ground ? mix(.6, 1, easeOutBack(progress(T, MOON_PILE_POP[0], MOON_PILE_POP[1]))) : 0,
  };
}
/**
 * The far ground's horizon is the arc the dive ends on (far-art coordinates:
 * the far layer is drawn at MOON_FAR_REST, 140 units below camera space), so
 * when the globe layer goes at 5.95 the horizon line does not change.
 */
export const MOON_HORIZON = (() => {
  const g = moonGlobe(6);
  return { cx: g.cx, cy: g.cy + 140, r: g.r };
})();
/** Horizon y (far-art coordinates) at x, `dr` units inside the arc. */
export const moonHorizonY = (x: number, dr = 0) => MOON_HORIZON.cy - Math.sqrt((MOON_HORIZON.r - dr) ** 2 - (x - MOON_HORIZON.cx) ** 2);
/** Base of the boulder pile (near-ground world): it pops up about this point. */
export const MOON_PILE_BASE = { x: 532, y: 748 } as const;
/** Sky Earth over the Moon (world): fixed, spun by CSS. */
export const MOON_SKY_EARTH = { x: 1310, y: 190, r: 62 } as const;

// ------------------------------------------------------------------ Moon cameras
export type MoonCam = { cx: number; cy: number; z: number };
export const moonNearCam = (T: number): MoonCam => ({
  cx: keyframes(T, [[5.3, 800], [5.9, 800], [7.1, 800], [7.9, 900], [8.45, 990]]),
  cy: keyframes(T, [[5.3, 450], [5.9, 575], [7.1, 575], [7.9, 625], [8.45, 655]]),
  z: keyframes(T, [[5.3, 1], [5.9, 1.25], [7.1, 1.25], [7.9, 1.45], [8.45, 1.6]]),
});
export const moonFarCam = (T: number): MoonCam => ({ cx: keyframes(T, [[7.1, 800], [8.45, 870]]), cy: keyframes(T, [[7.1, 590], [8.45, 562]]), z: keyframes(T, [[7.1, 1], [8.45, 1.1]]) });
export const MOON_FAR_REST: MoonCam = { cx: 800, cy: 590, z: 1 };
export const MOON_NEAR_FINAL: MoonCam = { cx: 990, cy: 655, z: 1.6 };
/** Camera space (viewBox units) of a world point. */
export const moonCamPoint = ({ cx, cy, z }: MoonCam, x: number, y: number) => ({ x: 800 + (x - cx) * z, y: 450 + (y - cy) * z });
export const moonCamTransform = ({ cx, cy, z }: MoonCam) => `translate(800 450) scale(${Math.round(z * 1000) / 1000}) translate(${r1(-cx)} ${r1(-cy)})`;
/** A layer drawn once at camera `drawn` and moved on the compositor to show camera `cam` (CSS px). */
export function moonCamLayer(fit: MoonFit, drawn: MoonCam, cam: MoonCam) {
  return {
    origin: `${r1(fit.ox + 800 * fit.k)}px ${r1(fit.oy + 450 * fit.k)}px`,
    transform: `translate3d(${r1((drawn.cx - cam.cx) * cam.z * fit.k)}px, ${r1((drawn.cy - cam.cy) * cam.z * fit.k)}px, 0) scale(${(cam.z / drawn.z).toFixed(4)})`,
  };
}
/** Near-ground perspective: lower on screen is closer and bigger (horizon y 520; LM ground 752 = 1). */
export const moonDepthScale = (gy: number) => (gy - 520) / 232;

// ------------------------------------------------------------------ Lunar Module
const LM_KEYS = {
  x: [[4.8, 640], [5.3, 610], [5.95, 532], [6.2, 534], [6.68, 770], [6.78, 792], [7.05, 800]],
  y: [[4.8, 530], [5.3, 540], [5.95, 641], [6.2, 645], [6.46, 643], [6.78, 714], [7.05, 732]],
  s: [[4.8, .6], [5.3, .64], [5.95, .9], [6.2, .9], [6.62, .97], [6.75, .98], [7.05, 1]],
  r: [[4.8, -16], [5.3, -6], [5.95, -3], [6.2, 0], [6.62, 9], [6.75, -3], [7.05, 0]],
} as const;
/** LM pose in near-ground world units; rotation pivots about local (0, −150). */
const MOON_SCOOT = [B.scoot, 6.68] as const;
export function moonLanderPose(T: number) {
  const wobble = T > B.hover && T < B.scoot ? 3 * Math.sin(2 * Math.PI * (T - B.hover) / .125) * (1 - progress(T, B.hover, B.scoot)) : 0;
  // The scoot glides at an even speed (side thrusters), clear of the boulders, then descends.
  const x = T > MOON_SCOOT[0] && T < MOON_SCOOT[1] ? mix(534, 770, trapezoid(progress(T, MOON_SCOOT[0], MOON_SCOOT[1]))) : keyframes(T, LM_KEYS.x);
  return { x, y: keyframes(T, LM_KEYS.y) + wobble * .6, s: keyframes(T, LM_KEYS.s), r: keyframes(T, LM_KEYS.r) + wobble };
}
export const MOON_LM_PIVOT_Y = -150;
/** Pad centers in LM local units (ground under the LM center at y 0). */
export const MOON_LM_PADS = [[-54, 20], [150, 8], [-150, -8], [70, -18]] as const;
/** The boulder pile the Eagle nearly sets down on: [x, base y, width, height]. */
export const MOON_BOULDERS = [[472, 744, 64, 40], [530, 736, 88, 62], [594, 748, 56, 32]] as const;
/** Probe bend (0–1) and strut compression (world units), quantized for the memoized legs. */
export function moonLegs(T: number) {
  const probe = smooth(progress(T, 6.90, B.contact));
  const compress = T >= B.contact ? 7 * Math.sin(Math.PI * .5 * progress(T, B.contact, 7.14)) - 2.5 * smooth(progress(T, 7.14, 7.32)) : 0;
  return { probe: Math.round(probe * 20) / 20, compress: Math.round(compress * 10) / 10 };
}
export const moonLmThrust = (T: number) => (T > 5.25 && T < 7.06 ? smooth(progress(T, 5.25, 5.45)) * (1 - smooth(progress(T, 6.99, 7.06))) : 0);
export const moonLmFlameScale = (T: number) => ({ x: .92 + .08 * Math.sin(T * 50), y: moonLmThrust(T) * (1 + .08 * Math.sin(T * 61)) * mix(1, .6, smooth(progress(T, 6.6, 7.0))) });
/** Columbia (CSM) in LM space while undocking; null once it has left past the header. */
export function moonColumbia(T: number) {
  if (T < B.glintCut || T >= 5.95) return null;
  const u = smooth(progress(T, 5.0, 5.6));
  return { x: 4 - 150 * u, y: -290 - 300 * u, rot: 180 - 34 * u, s: 1.55 - .9 * smooth(progress(T, 5.2, 5.9)) };
}
/** Side-thruster puffs (LM local): they grow and shrink away. */
export const MOON_RCS = [[5.02, -100, -1], [6.22, -100, -1], [6.34, -100, -1], [6.68, 100, 1]] as const;
export function moonRcsPuffs(T: number) {
  return MOON_RCS.flatMap(([at, x, dir], id) => {
    const t = progress(T, at, at + .24);
    if (t <= 0 || t >= 1) return [];
    const e = easeOutCubic(t);
    return [{ id, x: x + dir * 40 * e, y: -221, s: (.08 + .22 * e) * (1 - smooth(progress(t, .6, 1))), dir }];
  });
}
export const moonHatch = (T: number) => smooth(progress(T, 7.08, 7.20));
/** LM long low-sun shadow placement. */
export function moonLmShadow(T: number) {
  const lm = moonLanderPose(T);
  const alt = 732 - lm.y;
  // A shadow is light, so it may fade: it comes in once the ground has replaced the globe.
  return { x: lm.x - 1.35 * alt, y: 732 + .1 * alt, s: lm.s, o: mix(.1, .5, smooth(progress(lm.y, 560, 732))) * smooth(progress(T, 5.55, 5.75)) };
}

// ------------------------------------------------------------------ astronaut and flag
/** Astronaut skeleton (local units; origin between the boots; helmet top at −107). */
export const ASTRO_SHOULDER_FRONT = 23;
export const ASTRO_SHOULDER_BACK = 20;
export const ASTRO_SHOULDER_Y = -68;
export const ASTRO_ARM = [17, 16] as const;
const deg = (a: number) => a * Math.PI / 180;
export type Vec = { x: number; y: number };
/** Two-segment arm from angles in degrees from straight down, positive toward +x. */
export function armFromAngles(sx: number, sy: number, a1: number, a2: number): [Vec, Vec, Vec] {
  const [l1, l2] = ASTRO_ARM;
  const e = { x: sx + Math.sin(deg(a1)) * l1, y: sy + Math.cos(deg(a1)) * l1 };
  return [{ x: sx, y: sy }, e, { x: e.x + Math.sin(deg(a2)) * l2, y: e.y + Math.cos(deg(a2)) * l2 }];
}
/** Two-segment arm reaching for a hand target (clamped to reach); the elbow bends out toward `side` (−1 left, 1 right). */
export function armToTarget(sx: number, sy: number, tx: number, ty: number, side: 1 | -1): [Vec, Vec, Vec] {
  const [l1, l2] = ASTRO_ARM;
  let dx = tx - sx, dy = ty - sy;
  let d = Math.hypot(dx, dy);
  const reach = (l1 + l2) * .995;
  if (d > reach) { dx *= reach / d; dy *= reach / d; d = reach; }
  d = Math.max(d, Math.abs(l1 - l2) + .5);
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const ux = dx / d, uy = dy / d;
  let across = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  // Of the two elbow solutions, prefer outward, then downward (a relaxed, natural bend).
  if ((-uy * across) * side + ux * across * .6 < 0) across = -across;
  const e = { x: sx + ux * along - uy * across, y: sy + uy * along + ux * across };
  return [{ x: sx, y: sy }, e, { x: sx + dx, y: sy + dy }];
}
/** Forearm direction in degrees from straight down (for the glove). */
export const forearmAngle = ([, e, h]: [Vec, Vec, Vec]) => Math.atan2(h.x - e.x, h.y - e.y) * 180 / Math.PI;

export const MOON_FLAG_W = 80;
export const MOON_FLAG_H = MOON_FLAG_W * 10 / 19;
export const FLAG_STRIPES = 13;
/** Pole length (flag-local units): telescoped while stowed and carried, full once planted. */
export const MOON_FLAG_POLE = 146;
export const MOON_FLAG_POLE_SHORT = 72;
/** Planted flag: pole foot on the near ground (world), depth-scaled. */
export const MOON_FLAG_SPOT = { x: 1095, gy: 846 } as const;
export const MOON_FLAG_SCALE = moonDepthScale(MOON_FLAG_SPOT.gy);
/** Where the glove grips the pole, measured up from the pole foot (flag-local units): below the furled roll. */
export const MOON_FLAG_GRIP = 34;
/** As the pole is pushed in, the glove slides up it to this grip. */
export const MOON_FLAG_GRIP_PLANTED = 46;
/** Stowed flag on the ladder's right handrail: grip point in LM local units (the LM rests at 800, 732). */
export const MOON_FLAG_RAIL = { x: -34, y: -60 } as const;
const PLANT_DROP = 28;
const GRAB = [7.46, 7.90] as const;
const SWING = [8.16, 8.42] as const;
const PLUNGE = [8.42, 8.56] as const;
export const MOON_FLAG_WINDOWS = { grab: GRAB, swing: SWING, plunge: PLUNGE, unfurl: [8.50, 8.70] } as const;

/** Star centers of a 50-star canton: 9 rows alternating 6 / 5 (flag-local units, canton at the top-left). */
export function flagStars(w = MOON_FLAG_W, h = MOON_FLAG_H): [number, number][] {
  const cw = w * .4, ch = h * 7 / 13;
  const out: [number, number][] = [];
  for (let row = 0; row < 9; row++) for (let col = 0; col < (row % 2 ? 5 : 6); col++) out.push([cw * (1 + col * 2 + (row % 2)) / 12, ch * (row + 1) / 10]);
  return out;
}

export type AstroPose = {
  view: 'front' | 'back';
  left: [Vec, Vec, Vec];
  right: [Vec, Vec, Vec];
  legL: number; legR: number; sx: number; sy: number;
  /** The screen-left glove is open (waving). */
  openLeft: boolean;
};
/** Ground track: x, ground y and depth scale before any lift. */
function astroTrack(T: number) {
  const climb = progress(T, B.climb, B.step);
  const stepOff = smooth(progress(T, B.step, 7.82));
  const hop = progress(T, B.hopStart, B.hopLand);
  const hopE = easeInOutCubic(hop) * .35 + hop * .65;
  const x = T < B.step ? 800 + mix(-41, -51, climb) : T < B.hopStart ? mix(749, 800, stepOff) : mix(800, 1030, hopE);
  const gy = T < B.step ? mix(638, 766, climb) : T < B.hopStart ? mix(766, 778, stepOff) : mix(778, 850, hopE);
  const s = mix(1, moonDepthScale(gy), smooth(progress(T, 7.5, 7.82))) * moonAstroEmerge(T);
  return { x, gy, s, climb, hop };
}
/** He pops out of the hatch onto the porch (scaling up about his boots, with a little overshoot) rather than appearing. */
export const MOON_ASTRO_EMERGE = [B.climb - .04, B.climb + .1] as const;
export const moonAstroEmerge = (T: number) => (T >= MOON_ASTRO_EMERGE[1] ? 1 : mix(.45, 1, easeOutBack(progress(T, MOON_ASTRO_EMERGE[0], MOON_ASTRO_EMERGE[1]))));
/** The ladder's foot: while he climbs, his long low-sun shadow falls on the ground below, not in mid-air. */
export const MOON_LADDER_FOOT_GY = 766;
/** He turns from the ladder (back view) to face the class (front view). */
export const MOON_ASTRO_TURN = 7.72;
export const MOON_HOP_APEX = 84;
export const MOON_HOP_LANDING = { x: 1030, gy: 850 } as const;
/** Hop lift (local units, × depth scale in the world): a floaty arc with hang time. */
export const moonHopLift = (T: number) => (T >= B.hopStart && T < B.hopLand ? MOON_HOP_APEX * Math.sin(Math.PI * progress(T, B.hopStart, B.hopLand)) ** .8 : 0);
const moonRebound = (T: number) => (T > 8.42 && T < 8.56 ? 7 * Math.sin(Math.PI * progress(T, 8.42, 8.56)) : 0);
/** Squash and stretch of the whole figure (crouch, takeoff, landing, wave bob). */
function astroSquash(T: number) {
  const hop = progress(T, B.hopStart, B.hopLand);
  const crouch = T > 7.84 && T < 7.94 ? Math.sin(Math.PI * progress(T, 7.84, 7.94)) : 0;
  const land = T > 8.34 && T < 8.46 ? Math.sin(Math.PI * progress(T, 8.34, 8.46)) : 0;
  const waveIn = smooth(progress(T, 8.50, 8.66));
  const wave = T > 8.58 ? Math.sin(2 * Math.PI * 2.4 * (T - 8.58)) : 0;
  return {
    sx: 1 + .08 * crouch + .1 * land,
    sy: 1 - .12 * crouch - .14 * land + .08 * Math.sin(Math.PI * clamp01(hop / .18)) + .015 * wave * waveIn,
    wave, waveIn,
  };
}
/** Astronaut placement (world): feet at (x, y), uniform depth scale s, then squash sx/sy. */
function astroPlace(T: number) {
  const track = astroTrack(T);
  const y = track.gy - (moonHopLift(T) + moonRebound(T)) * track.s;
  return { ...track, y, ...astroSquash(T) };
}
/** Carrying glove (astronaut local): upright at the side for the walk, raised overhead for the leap. */
function carryHand(T: number): Vec {
  const up = T < B.hopStart ? 0 : smooth(Math.min(1, progress(T, B.hopStart, B.hopLand) * 3));
  return { x: mix(36, 31, up), y: mix(-44, -99, up) };
}
const toWorld = (p: ReturnType<typeof astroPlace>, v: Vec): Vec => ({ x: p.x + v.x * p.s * p.sx, y: p.y + v.y * p.s * p.sy });
/** Plant-ready grip (world): pole foot `drop` units above the spot. */
const plantGrip = (drop: number, grip = MOON_FLAG_GRIP): Vec => ({ x: MOON_FLAG_SPOT.x, y: MOON_FLAG_SPOT.gy - (drop + grip) * MOON_FLAG_SCALE });

/**
 * The flag follows one continuous path: stowed on the ladder rail, pulled off
 * into the glove, carried, raised overhead for the leap, swung out (the pole
 * telescopes to full length), plunged into the ground, then unfurled.
 */
export type MoonFlagState = {
  mode: 'stowed' | 'carried' | 'planted';
  /** Pole foot (world). */
  foot: Vec;
  /** Glove grip on the pole (world); meaningful while stowed or carried and during the plunge. */
  grip: Vec;
  s: number;
  /** Degrees; the stowed bundle leans with the rail. */
  tilt: number;
  pole: number;
  unfurl: number;
  ripple: number;
};
export function moonFlag(T: number): MoonFlagState {
  const rest = { tilt: 0, pole: MOON_FLAG_POLE_SHORT, unfurl: 0, ripple: 0 };
  const withFoot = (grip: Vec, s: number, tilt = 0) => ({ grip, s, foot: { x: grip.x - Math.sin(tilt * Math.PI / 180) * MOON_FLAG_GRIP * s, y: grip.y + Math.cos(tilt * Math.PI / 180) * MOON_FLAG_GRIP * s } });
  const rail: Vec = { x: 800 + MOON_FLAG_RAIL.x, y: 732 + MOON_FLAG_RAIL.y + 4.5 };
  if (T < GRAB[0]) return { mode: 'stowed', ...rest, ...withFoot(rail, 1, 5), tilt: 5 };
  if (T < PLUNGE[0]) {
    const place = astroPlace(T);
    const carried = toWorld(place, carryHand(T));
    if (T < GRAB[1]) {
      const u = trapezoid(progress(T, GRAB[0], GRAB[1]));
      const tilt = mix(5, 0, u);
      return { mode: 'carried', ...rest, ...withFoot({ x: mix(rail.x, carried.x, u), y: mix(rail.y, carried.y, u) }, mix(1, place.s, u), tilt), tilt };
    }
    if (T < SWING[0]) return { mode: 'carried', ...rest, ...withFoot(carried, place.s) };
    const u = smooth(progress(T, SWING[0], SWING[1]));
    const target = plantGrip(PLANT_DROP);
    return { mode: 'carried', ...rest, pole: mix(MOON_FLAG_POLE_SHORT, MOON_FLAG_POLE, u), ...withFoot({ x: mix(carried.x, target.x, u), y: mix(carried.y, target.y, u) }, mix(place.s, MOON_FLAG_SCALE, u)) };
  }
  const plunge = smooth(progress(T, PLUNGE[0], PLUNGE[1]));
  const drop = PLANT_DROP * (1 - plunge);
  const unfurl = T < 8.50 ? 0 : Math.max(.02, easeOutBack(progress(T, 8.50, 8.70), 1.6));
  const ripple = T > 8.66 ? 2 * Math.sin(2 * Math.PI * 3 * (T - 8.66)) * (1 - progress(T, 8.66, 9.3)) : 0;
  const foot = { x: MOON_FLAG_SPOT.x, y: MOON_FLAG_SPOT.gy - drop * MOON_FLAG_SCALE };
  return { mode: 'planted', tilt: 0, pole: MOON_FLAG_POLE, unfurl, ripple, s: MOON_FLAG_SCALE, foot, grip: plantGrip(drop, mix(MOON_FLAG_GRIP, MOON_FLAG_GRIP_PLANTED, plunge)) };
}

export function moonAstronaut(T: number) {
  const place = astroPlace(T);
  const { x, y, gy, s, sx, sy, climb, hop, wave, waveIn } = place;
  const climbPhase = Math.sin(climb * Math.PI * 5);
  const hopArc = Math.sin(Math.PI * hop);
  const toLocal = (p: Vec): Vec => ({ x: (p.x - x) / (s * sx), y: (p.y - y) / (s * sy) });
  const flag = moonFlag(T);
  const holding = flag.mode === 'carried' || (flag.mode === 'planted' && T < PLUNGE[1]);
  let pose: AstroPose;
  if (T < MOON_ASTRO_TURN) {
    const sh = ASTRO_SHOULDER_BACK;
    // Hands on the ladder rails going down; the right glove then pulls the flag off the rail.
    const off = smooth(progress(T, B.step, MOON_ASTRO_TURN));
    const g = toLocal(flag.grip);
    pose = {
      view: 'back', openLeft: false,
      left: armFromAngles(-sh, ASTRO_SHOULDER_Y, mix(165 + climbPhase * 10, 30, off), mix(180, 12, off)),
      right: holding ? armToTarget(sh, ASTRO_SHOULDER_Y, g.x, g.y, 1) : armFromAngles(sh, ASTRO_SHOULDER_Y, -165 + climbPhase * 10, -180),
      legL: T < B.step ? Math.max(0, climbPhase) * 12 : 0, legR: T < B.step ? Math.max(0, -climbPhase) * 12 : 0, sx: 1, sy: 1,
    };
  } else {
    const sh = ASTRO_SHOULDER_FRONT;
    const left = T < 8.5
      ? armFromAngles(-sh, ASTRO_SHOULDER_Y, mix(-24, -150, hopArc), mix(-10, -168, hopArc))
      : armFromAngles(-sh, ASTRO_SHOULDER_Y, mix(-24, -142, waveIn) + wave * 6, mix(-10, -172, waveIn) + wave * 22);
    let right: [Vec, Vec, Vec];
    if (holding) {
      const g = toLocal(flag.grip);
      right = armToTarget(sh, ASTRO_SHOULDER_Y, g.x, g.y, 1);
    } else {
      // Let go of the planted pole and drop the arm to the side.
      const rel = smooth(progress(T, PLUNGE[1], 8.72));
      const g = toLocal(flag.grip);
      const held = armToTarget(sh, ASTRO_SHOULDER_Y, g.x, g.y, 1)[2];
      const side = armFromAngles(sh, ASTRO_SHOULDER_Y, 22, 6)[2];
      right = armToTarget(sh, ASTRO_SHOULDER_Y, mix(held.x, side.x, rel), mix(held.y, side.y, rel), 1);
    }
    pose = { view: 'front', openLeft: true, left, right, legL: T < 8.5 ? 7 * hopArc : 0, legR: T < 8.5 ? 10 * hopArc : 0, sx, sy };
  }
  // On the ladder his feet are above the ground: the shadow is cast on the ground (projected left by the
  // low sun) and, being light, comes in as he nears the foot of the ladder; it never floats at the porch.
  const above = T < B.step ? Math.max(0, MOON_LADDER_FOOT_GY - gy) : 0;
  const shadow = { x: x - 1.35 * above, y: (above > 0 ? MOON_LADDER_FOOT_GY : gy) + .1 * above, o: 1 - smooth(progress(above, 8, 48)) };
  return { x, gy, y, s, lift: moonHopLift(T), pose, wave, waveIn, holding, shadow };
}
export const MOON_FOOTPRINTS = [[756, 776, 7.68], [782, 781, 7.78], [804, 779, 7.9], [1014, 853, 8.37], [1046, 849, 8.40]] as const;
/** Hop dust: six grains at takeoff and six at landing, in low-gravity arcs that shrink. */
export function moonHopGrains(T: number) {
  const out: { id: number; x: number; y: number; s: number }[] = [];
  ([[B.hopStart, 800, 778], [B.hopLand, 1030, 850]] as const).forEach(([at, gx, gy], set) => {
    const u = progress(T, at, at + .6);
    if (u <= 0 || u >= 1) return;
    const ds = moonDepthScale(gy);
    for (let i = 0; i < 6; i++) {
      const dir = (i - 2.5) / 2.5;
      out.push({ id: set * 6 + i, x: gx + dir * 30 * u * ds, y: gy - 4 * 18 * u * (1 - u) * ds * (.6 + .4 * ((i * 7) % 3) / 2), s: (1 - u) * ds * (.8 + .1 * (i % 3)) });
    }
  });
  return out;
}

// ------------------------------------------------------------------ iris, twinkles, captions
/** Iris center (world, near ground under the final camera): the astronaut and the flag. */
export const MOON_IRIS_WORLD = { x: 1100, y: 742 } as const;
export const MOON_IRIS_HOLD = 250;
/** While it holds, the circle swells once by this share of its radius (9.28–9.40). */
export const MOON_IRIS_SWELL = .035;
/** Riding rim stars: radius as a share of min(W, H). */
export const MOON_RIM_STAR = .028;
/** How far the gold rim reaches past the iris radius (CSS px): its white outer stroke or a riding star, whichever is farther. */
export const moonIrisRimPad = (fit: MoonFit) => Math.max(6 + 5 * Math.max(.7, fit.k), MOON_RIM_STAR * Math.min(fit.w, fit.h) + 1);
export type MoonIris = { cx: number; cy: number; rH: number; R0: number; lift: number };
/**
 * The iris closes onto the astronaut and flag. The hold circle is as big as
 * that pair needs, so on most screens its lower rim would tuck under the
 * footer controls: instead the scene rises (`lift`, CSS px) as the iris
 * closes, a gentle tilt down onto him, just far enough that the whole ring,
 * swell and riding stars included, clears the footer without reaching the header.
 */
export function moonIris(fit: MoonFit): MoonIris {
  const p = moonCamPoint(MOON_NEAR_FINAL, MOON_IRIS_WORLD.x, MOON_IRIS_WORLD.y);
  const c = moonToScreen(fit, p.x, p.y);
  const rH = MOON_IRIS_HOLD * fit.k;
  const reach = (1 + MOON_IRIS_SWELL) * rH + moonIrisRimPad(fit);
  const lift = Math.max(0, Math.min(c.y + reach - (fit.h - MOON_FOOTER_PX), c.y - reach - MOON_HEADER_PX));
  const R0 = Math.max(Math.hypot(c.x, c.y), Math.hypot(fit.w - c.x, c.y), Math.hypot(c.x, fit.h - c.y), Math.hypot(fit.w - c.x, fit.h - c.y)) + 24;
  return { cx: c.x, cy: c.y, rH, R0, lift };
}
/** How far the scene (and the iris with it) has risen at T (CSS px): it rides the ring's own ease. */
export const moonIrisLift = (T: number, iris: Pick<MoonIris, 'lift'>) => (T <= B.irisStart ? 0 : iris.lift * easeOutCubic(progress(T, B.irisStart, B.hold)));
/** Iris center at T (CSS px). */
export const moonIrisCenter = (T: number, iris: MoonIris) => ({ x: iris.cx, y: iris.cy - moonIrisLift(T, iris) });
/** Iris radius in CSS px; null before the iris starts (no clip), 0 once closed. */
export function moonIrisRadius(T: number, iris: { rH: number; R0: number }): number | null {
  if (T < B.irisStart) return null;
  if (T < B.hold) return mix(iris.R0, iris.rH, easeOutCubic(progress(T, B.irisStart, B.hold)));
  if (T < B.snap) return iris.rH * (1 + MOON_IRIS_SWELL * Math.sin(Math.PI * progress(T, B.hold, B.snap)));
  if (T < B.closed) return iris.rH * (1 - easeInCubic(progress(T, B.snap, B.closed)));
  return 0;
}
export const moonSceneVisible = (T: number) => T < B.closed;

export type MoonTwinkleTarget = { left: number; top: number; width: number; height: number };
/**
 * Card twinkles: every team card sparkles at its top-right corner (the team
 * badge sits top-left), the moment the closing ring sweeps past that corner,
 * so the outer cards "switch on" first. A corner inside the final hold
 * circle (rare: tiny cards next to the astronaut) gets the POP instead.
 * `d` is the ring's radius as it passes the corner.
 */
export function moonTwinkleSchedule(targets: readonly MoonTwinkleTarget[], fit: MoonFit) {
  const iris = moonIris(fit);
  const final = moonIrisCenter(B.hold, iris);
  return targets.slice(0, 16).flatMap((t, index) => {
    const inset = Math.max(10, Math.min(.1 * Math.min(t.width, t.height), 26));
    const size = Math.max(18, Math.min(.2 * Math.min(t.width, t.height), 44));
    const x = t.left + t.width - inset, y = t.top + inset;
    if (Math.hypot(x - final.x, y - final.y) <= 1.04 * iris.rH) return [];
    // When the closing, rising ring reaches the corner (the ring shrinks far faster than it rises, so one crossing).
    const gap = (T: number) => { const c = moonIrisCenter(T, iris); return moonIrisRadius(T, iris)! - Math.hypot(x - c.x, y - c.y); };
    let lo: number = B.irisStart, hi: number = B.hold;
    for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (gap(mid) > 0) lo = mid; else hi = mid; }
    const start = Math.min(hi + .02, 9.30);
    return [{ index, d: moonIrisRadius(hi, iris)!, start, x, y, size }];
  }).sort((p, q) => q.d - p.d);
}

/**
 * The final POP, sized for a projector. Lengths are in units of `u`, 1% of the
 * screen's short side (like vmin): a comic burst 34 across, ten 8-unit stars
 * that fly 30 out, eight sparkles at half that and a shock ring 44 across.
 * Each star and sparkle flies only as far as the band between the header and
 * the footer allows in its direction, so none slides under the chrome. Every
 * piece ends at scale 0 (the ring thins to nothing) by MOON_BEATS.popEnd.
 */
export const MOON_POP = { burst: 34, burstPeak: 1.12, star: 8, starPeak: 1.15, starPeakAt: .74, reach: 30, ring: 44, ringPeak: 1.06, spark: 4.5, sparkPeak: 1.1, sparkPeakAt: .75, sparkReach: 15 } as const;
/** Gold, sky, coral, gold, white: saturated and ink-outlined, so they read on the cream cards. */
export const MOON_POP_COLORS = ['#ffd23f', '#6cc4ff', '#ff7a6b', '#ffd23f', '#fffaf0'] as const;
export function moonPopLayout(fit: MoonFit) {
  const iris = moonIris(fit);
  const x = iris.cx, y = iris.cy - iris.lift;
  const u = Math.min(fit.w, fit.h) / 100;
  const top = MOON_HEADER_PX, bottom = fit.h - MOON_FOOTER_PX;
  /** Distance from the POP to the band edge along `deg` (0 = right, 90 = down). */
  const clearance = (deg: number) => {
    const dx = Math.cos(deg * Math.PI / 180), dy = Math.sin(deg * Math.PI / 180);
    const tx = dx > 1e-9 ? (fit.w - x) / dx : dx < -1e-9 ? -x / dx : Infinity;
    const ty = dy > 1e-9 ? (bottom - y) / dy : dy < -1e-9 ? (top - y) / dy : Infinity;
    return Math.min(tx, ty);
  };
  const reach = (deg: number, max: number) => r1(Math.max(0, Math.min(max * u, clearance(deg) - u)));
  return {
    x: r1(x), y: r1(y), u: r2(u), clearance,
    stars: Array.from({ length: 10 }, (_, i) => { const a = -72 + 36 * i; return { a, d: reach(a, MOON_POP.reach), color: MOON_POP_COLORS[i % MOON_POP_COLORS.length] }; }),
    sparks: Array.from({ length: 8 }, (_, i) => { const a = 22.5 + 45 * i; return { a, d: reach(a, MOON_POP.sparkReach), color: i % 2 ? '#6cc4ff' : '#ffd23f' }; }),
  };
}

/**
 * Teacher-facing captions in real mission language (no baby talk): Armstrong
 * called "The Eagle has wings" at undocking, Houston gave "Go for landing",
 * and he took manual control to fly the Eagle past a boulder field.
 */
export const MOON_CAPTIONS = [
  [3.45, 4.75, 'NEXT STOP: THE MOON'],
  [4.75, 5.35, 'THE EAGLE HAS WINGS'],
  [5.35, 5.85, 'GO FOR LANDING'],
  [5.85, 6.30, 'BOULDER FIELD!'],
  [6.30, 6.95, 'TAKING MANUAL CONTROL'],
  [6.95, 7.60, 'THE EAGLE HAS LANDED'],
  [7.60, 7.90, 'ONE SMALL STEP…'],
  [7.90, 8.62, '…ONE GIANT LEAP!'],
] as const;
export const moonCaption = (T: number) => MOON_CAPTIONS.find(([from, to]) => T >= from && T < to)?.[2] ?? '';

/**
 * Everything after the launch set mounts hidden, one piece at a time, during
 * the countdown: the numerals and dial are compositor (CSS) animations, so a
 * busy main thread there is invisible. After 1.1 s nothing mounts or unmounts
 * again; the frame writers only show, hide and move what is already there.
 */
export const MOON_PREMOUNT = { space: .25, globe: .33, far: .41, near: .49, lander: .57, astroBack: .65, astroFront: .73, flag: .81, surface: .89, rim: .97 } as const;
export const MOON_PREMOUNT_DONE = 1.1;

/**
 * What is mounted at time T. The scene re-renders only when this changes
 * (the premount steps during the countdown); everything else is written per frame.
 */
export function moonStructureKey(T: number) {
  return String(Object.values(MOON_PREMOUNT).filter((at) => T >= at).length);
}

/**
 * Where the countdown numerals and LIFTOFF! sit: centered in the open sky
 * right of the rocket (computed from the fit, so it holds at every aspect),
 * with LIFTOFF! sized so its slam overshoot (×1.16) still fits.
 */
export const MOON_LIFTOFF_OVERSHOOT = 1.16;
/** The word (outline included) fills about this share of the LIFTOFF! box width. */
export const MOON_LIFTOFF_TEXT = .97;
export function moonLaunchOverlay(fit: MoonFit) {
  const rocketRight = moonRigToScreen(fit, LIFT, RIG_ORIGIN.x + 45, 400).x - moonShake(LIFT).x * fit.k;
  const left = rocketRight + 24;
  const right = fit.w - 16;
  return { x: (left + right) / 2, liftoffWidth: Math.max(160, Math.min(560, (right - left) / (MOON_LIFTOFF_TEXT * MOON_LIFTOFF_OVERSHOOT * 1.04))), left, right };
}
