import { clamp01, easeInOutCubic, easeOutBack, easeOutCubic, keyframes, mix, progress, smooth, type Point } from './sceneMotion';

/**
 * Fairy dust: the whole performance as pure, deterministic functions of time
 * and the measured card layout. Units are seconds and CSS pixels. The fairy
 * art uses viewBox (-165 -200 330 330) with its origin at the waist; `unit`
 * converts art units to pixels.
 */
export const FAIRY_DURATION_MS = 5340;

/** Story beats, in seconds. */
export const FAIRY = {
  glint: [0.02, 0.27],
  entrance: [0.15, 0.75],
  armRaise: [0.78, 0.85],
  /** "One", "two": the wand pumps; the third pulse fizzles. */
  pulses: [0.85, 1.19],
  fizzle: 1.53,
  /** She lifts the grey wand up beside her face and peers at it: the pose is up by 1.70 and held (with a "huh?" bob) to 1.96. */
  look: [1.62, 1.96],
  shake: [1.96, 2.14],
  bling: 2.2,
  anticipation: [2.32, 2.38],
  sweepT0: 2.38,
  sweepSpan: 1.3,
  ripple: 0.3,
  arriveMin: 3.78,
  arriveMax: 3.9,
  land: 3.94,
  crossed: [3.92, 4.16],
  giggle: [4.16, 4.7],
  takeoff: 4.66,
  wave: [4.7, 4.98],
  /** A little squat just before she zooms off (she faces right throughout, so there is no turn). */
  unflip: [4.98, 5.04],
  /** She zooms off from the end of the unflip and is on screen until about 5.28, so the reveal has no empty tail. */
  exitEnd: 5.3,
  sceneFade: [5.3, 5.34],
  glitterEnd: 5.3,
  /** Every cover element finishes within this long after its tap. */
  coverTail: 1.4,
  /** The "?" tile twists away (0.25 s) well before its bud sprouts, so no card ever shows a flower in a box. */
  questionStart: 0.45,
  questionMs: 250,
  sproutStart: 0.62,
  sproutSpread: 0.15,
  /** The covers' global anticipation keyframes run over this window. */
  budHop: [0.8, 2.44],
  /** After a tap she springs back (recoil) and holds before travelling on. */
  recoil: 0.12,
  hold: 0.15,
  /** The ribbon reels in (tail first) as she lands for the count, and again as she zooms off (from this time until exitEnd). */
  landReel: [0.75, 0.98],
  exitReel: 5.12,
  headerPx: 72,
  footerPx: 80,
} as const;

/** An arm pose: the arm about the shoulder and the wand about the hand (relative to the arm), degrees, + is clockwise/down. */
export type ArmPose = { arm: number; wrist: number };
/** A tap pose also leans the whole body (degrees). */
export type TapPose = ArmPose & { lean: number };

export const POSES = {
  /** The count: the wand held up and out, the star in clear air above-right of her bun. */
  count: { arm: -10, wrist: 2 },
  /** Each count pump thrusts the star up a little further. */
  pump: { arm: -14, wrist: 4 },
  /** The fizzle: the wand droops. */
  droop: { arm: 66, wrist: 4 },
  /** Looking at the wand: hand at her hip, the wand held upright so the grey star sits beside her face at eye height. */
  look: { arm: 80, wrist: -99 },
  /** The shake: the wand out in front. */
  shake: { arm: 18, wrist: -12 },
  /** BLING: the wand thrust up, the star in clear air above-right of her bun. */
  bling: { arm: -14, wrist: 2 },
  /** Between taps. */
  rest: { arm: 10, wrist: 0 },
  /** The usual tap: a flick out to the side. */
  sideTap: { arm: 38, wrist: 0, lean: 6 },
  /** Near the screen edge: a lean-in tap with the wand pointing down at the bud. */
  downTap: { arm: 56, wrist: 80, lean: 20 },
} as const;

/** Art anchors in viewBox units (origin at the waist). */
export const ART = {
  shoulder: { x: 15, y: -16 },
  /** The wand hand (the wrist pivot). */
  hand: { x: 47, y: -42 },
  star: { x: 101, y: -122 },
  nose: { x: 0, y: -60 },
  /** The tip of her nose, where the hero butterfly's abdomen rests. */
  perch: { x: 0, y: -58 },
  /** Her crossed pupils (the 'crossed' face): the perched butterfly's wings must miss them. */
  crossedPupils: [{ x: -11, y: -67 }, { x: 11, y: -67 }],
  pupilRadius: 4.5,
  neck: { x: 0, y: -30 },
  bbox: { left: -150, right: 158, top: -165, bottom: 112 },
  /** Convex silhouettes (grown by the outline width): her body without the wand, and the left wing (the right one is its mirror). */
  bodyHull: [[-62, 69], [-57, -72], [-54, -96], [-53, -102], [-50, -111], [-24, -154], [-20, -160], [-14, -164], [-7, -167], [0, -168], [7, -167], [14, -164], [20, -160],
    [24, -154], [48, -115], [51, -106], [54, -96], [57, -72], [62, 69], [41, 103], [35, 110], [-24, 115], [-35, 114]] as readonly (readonly [number, number])[],
  wingHull: [[-151, -91], [-149, -99], [-145, -105], [-137, -111], [-132, -113], [-127, -115], [-121, -115], [-115, -115], [-109, -114], [-102, -113], [-96, -111],
    [-89, -108], [-82, -105], [-76, -101], [-69, -97], [-62, -92], [-55, -87], [-49, -81], [-42, -75], [-36, -68], [-30, -61], [-25, -54], [-19, -46], [-14, -39],
    [-10, -30], [-6, -22], [-3, -14], [-3, 7], [-7, 14], [-10, 20], [-14, 26], [-18, 32], [-23, 37], [-27, 43], [-32, 48], [-36, 52], [-41, 57], [-46, 61], [-51, 64],
    [-56, 67], [-60, 70], [-65, 72], [-74, 75], [-82, 77], [-89, 76], [-95, 73], [-99, 67], [-149, -83]] as readonly (readonly [number, number])[],
} as const;

export type FairyRect = { left: number; top: number; width: number; height: number };
/** The card band the timing is measured against (viewport px). Fixed once the covers are set up. */
export type FairyBand = { left: number; right: number; top: number; bottom: number };
export type FairyCoverTiming = { bandX: number; focusDy: number; tint: number; dense: boolean };
export type FairyColumn = { x: number; bandX: number; tap: number };
/** Waist position (and pose) the fairy reaches at time `t` so the wand star lands on the column; `d` is how far the pose leans in (0 side flick, 1 down tap). */
export type FairyTap = TapPose & { t: number; x: number; y: number; d: number };
export type FairyLayout = {
  W: number; unit: number; vw: number; vh: number; band: FairyBand;
  columns: FairyColumn[]; covers: FairyCoverTiming[];
  tapY: number; hover: Point; peek: Point; arrive: number; taps: FairyTap[]; hopCeil: number;
  /** The peek spot is lowered below a narrow last card's names (she then zooms off right first, up second). */
  lowered: boolean;
};
export type FairyFace = 'happy' | 'look' | 'focus' | 'surprised' | 'effort' | 'delighted' | 'crossed' | 'wink';
export type FairyWings = 'flutter' | 'fizzled' | 'giggling';
export type FairyStarState = { scale: number; spin: number; grey: boolean; glow: number };
/** The actor transform. `spread` scales the wings about her spine (they tuck in for the lean-in tap). */
export type FairyBody = { x: number; y: number; rotate: number; flip: number; scale: number; sx: number; sy: number; spread: number };
export type FairyPose = FairyBody & ArmPose & { head: number; skirt: number; face: FairyFace; wings: FairyWings; star: FairyStarState };

export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const TAU = Math.PI * 2;
const rotatePoint = (p: Point, degrees: number): Point => {
  const a = degrees * Math.PI / 180;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
};
/** 0 before `start`, eases up to 1 at `peak`, back to 0 by `end`. */
export const bump = (t: number, start: number, peak: number, end: number) => (t < peak ? smooth(progress(t, start, peak)) : 1 - smooth(progress(t, peak, end)));
/** 1 inside [start, end], eased in and out over `edge` seconds. */
const window01 = (t: number, start: number, end: number, edge: number) => smooth(progress(t, start, start + edge)) * (1 - smooth(progress(t, end - edge, end)));
const mixPose = (a: ArmPose, b: ArmPose, u: number): ArmPose => ({ arm: mix(a.arm, b.arm, u), wrist: mix(a.wrist, b.wrist, u) });
/** Keyframed arm poses (smoothstep between neighbours). */
function poseKeys(t: number, keys: readonly (readonly [number, ArmPose])[]): ArmPose {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return mixPose(keys[i - 1][1], keys[i][1], smooth(progress(t, keys[i - 1][0], keys[i][0])));
  return keys[keys.length - 1][1];
}

export function fairySize(vw: number, vh: number) { return clamp(0.36 * Math.min(vw, vh), 200, 420); }

/** Art-space position of the wand star for an arm pose. */
export function starLocal(arm: number, wrist = 0): Point {
  const { shoulder: S, hand: H, star: T } = ART;
  const h = rotatePoint({ x: H.x - S.x, y: H.y - S.y }, arm);
  const w = rotatePoint({ x: T.x - H.x, y: T.y - H.y }, arm + wrist);
  return { x: S.x + h.x + w.x, y: S.y + h.y + w.y };
}

/** Art point to screen, given the actor transform (waist, rotation, flip, scale, squash). */
export function toScreen(body: FairyBody, p: Point, unit: number): Point {
  const r = rotatePoint({ x: p.x * body.flip * body.scale * body.sx * unit, y: p.y * body.scale * body.sy * unit }, body.rotate);
  return { x: body.x + r.x, y: body.y + r.y };
}

/** Her silhouette (art units) with the wings spread by `spread` (1 = open; they tuck in for a dive). */
export function silhouette(spread = 1): Point[] {
  const pts = ART.bodyHull.map(([x, y]) => ({ x, y }));
  for (const [x, y] of ART.wingHull) pts.push({ x: x * spread, y }, { x: -x * spread, y });
  return pts;
}
const OPEN = silhouette(1);
/** Extent (px, relative to the waist) of her silhouette rotated by `degrees` (upright, facing right). */
function hullExtent(unit: number, degrees: number, spread = 1) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const p of spread === 1 ? OPEN : silhouette(spread)) {
    const r = rotatePoint({ x: p.x * unit, y: p.y * unit }, degrees);
    left = Math.min(left, r.x); right = Math.max(right, r.x); top = Math.min(top, r.y); bottom = Math.max(bottom, r.y);
  }
  return { left, right, top, bottom };
}
/** Vertical extent over a range of rotations. */
function verticalExtent(unit: number, degrees: number) {
  let top = 0, bottom = 0;
  for (let angle = -degrees; angle <= degrees + 1e-9; angle += degrees / 4 || 1) {
    const e = hullExtent(unit, angle);
    top = Math.min(top, e.top); bottom = Math.max(bottom, e.bottom);
  }
  return { top, bottom };
}

/** Per-cover tap time: the column sweep plus a small ripple away from the tap row. */
export function coverTap(bandX: number, focusDy: number) {
  return FAIRY.sweepT0 + FAIRY.sweepSpan * clamp01(bandX) + FAIRY.ripple * clamp(focusDy, 0, 0.5);
}

/** The tap pose between the side flick (d = 0) and the lean-in down tap (d = 1). */
export function tapPose(d: number): TapPose {
  const a = POSES.sideTap, b = POSES.downTap;
  return { arm: mix(a.arm, b.arm, d), wrist: mix(a.wrist, b.wrist, d), lean: mix(a.lean, b.lean, d) };
}
/** How far the wings tuck in for a lean-in tap. */
export const WING_TUCK = 0.35;
/** At the peek spot her wings relax to this spread, so the whole silhouette fits inside the right edge. */
export const PERCH_SPREAD = 0.7;
const tapSpread = (d: number) => 1 - WING_TUCK * d;
/** After a tap she leans back this far (less after a lean-in tap, which springs straight up). */
const recoilLean = (d: number) => mix(10, 3, d);
/**
 * ...and pulls back from the bloom (px, + is back towards the left). After a lean-in tap she is above the bloom,
 * over the card's names, so she springs forwards instead, on towards the next card.
 */
const recoilPull = (d: number, vw: number) => vw * (0.035 * (1 - d) - 0.03 * d);
/** Waist-to-star offset (art units) in a tap pose, lean included. */
function tapOffset(p: TapPose): Point { return rotatePoint(starLocal(p.arm, p.wrist), p.lean); }

/** The on-screen card band, from the rects (all of them when none is on screen). */
export function fairyBand(rects: readonly FairyRect[], vw: number, vh: number): FairyBand {
  const onScreen = rects.filter((r) => r.width > 0 && r.height > 0 && r.left + r.width > 0 && r.left < vw && r.top + r.height > 0 && r.top < vh);
  const basis = onScreen.length ? onScreen : rects.filter((r) => r.width > 0 && r.height > 0);
  if (!basis.length) return { left: 0, right: vw, top: vh * 0.2, bottom: vh * 0.8 };
  return {
    left: Math.min(...basis.map((r) => r.left)), right: Math.max(...basis.map((r) => r.left + r.width)),
    top: Math.min(...basis.map((r) => r.top)), bottom: Math.max(...basis.map((r) => r.top + r.height)),
  };
}

/**
 * Layout from measured cover rects (viewport px), computed once at mount and on
 * resize. Returns the per-cover timing inputs (written once as CSS custom
 * properties) and the columns the fairy visits. Pass `fixedBand` to time late
 * covers against the band the first ones were set up with.
 */
export function fairyLayout(rects: readonly FairyRect[], vw: number, vh: number, fixedBand?: FairyBand): FairyLayout {
  const W = fairySize(vw, vh);
  const unit = W / 330;
  const cx = (r: FairyRect) => r.left + r.width / 2;
  const cy = (r: FairyRect) => r.top + r.height / 2;
  const onScreen = rects.filter((r) => r.width > 0 && r.height > 0 && r.left + r.width > 0 && r.left < vw && r.top + r.height > 0 && r.top < vh);
  const band = fixedBand ?? fairyBand(rects, vw, vh);
  const bandX = (x: number) => (band.right - band.left < 1 ? 0.5 : clamp01((x - band.left) / (band.right - band.left)));

  // The tap row, clamped so the whole fairy stays between the header and the footer controls in the side-tap pose.
  const side = tapOffset(POSES.sideTap);
  const tapExtent = verticalExtent(unit, POSES.sideTap.lean + 4);
  const tapWaistMin = FAIRY.headerPx - tapExtent.top + 4;
  const tapWaistMax = vh - FAIRY.footerPx - tapExtent.bottom - 4;
  const tapY = clamp(clamp((band.top + band.bottom) / 2, 0.34 * vh, 0.58 * vh), tapWaistMin + side.y * unit, Math.max(tapWaistMin, tapWaistMax) + side.y * unit);
  // Hops, recoils and arcs rise above the tap waists; the waist never goes above this line (the header stays clear with a 16 degree lean).
  const hopCeil = FAIRY.headerPx - verticalExtent(unit, 16).top + 2;

  const covers = rects.map((r) => ({ bandX: bandX(cx(r)), focusDy: Math.min(0.5, Math.abs(cy(r) - tapY) / vh), tint: 0, dense: rects.length > 20 }));
  const order = rects.map((_, i) => i).sort((a, b) => cx(rects[a]) - cx(rects[b]) || rects[a].top - rects[b].top);
  order.forEach((index, rank) => { covers[index].tint = rank % 4; });

  // Columns: on-screen centres within 12 px share one tap.
  const centres = onScreen.map(cx).sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const x of centres) {
    const last = groups[groups.length - 1];
    if (last && x - last[last.length - 1] <= 12) last.push(x); else groups.push([x]);
  }
  let columns: FairyColumn[] = groups.map((g) => {
    const x = g.reduce((s, v) => s + v, 0) / g.length;
    const b = bandX(x);
    return { x, bandX: b, tap: FAIRY.sweepT0 + FAIRY.sweepSpan * b };
  });
  if (!columns.length) columns = [1 / 6, 1 / 2, 5 / 6].map((b) => ({ x: mix(0.1, 0.9, b) * vw, bandX: b, tap: FAIRY.sweepT0 + FAIRY.sweepSpan * b }));

  const hoverExtent = verticalExtent(unit, 8);
  const hoverMin = FAIRY.headerPx - hoverExtent.top + 0.03 * vh;
  const hoverMax = vh - FAIRY.footerPx - hoverExtent.bottom - 0.03 * vh;
  // She hovers over the first (still covered) column, not over a table's team names.
  const hover = { x: Math.min(Math.max(0.12 * vw, 0.5 * W + 8, band.left + 0.3 * W), 0.45 * vw), y: clamp(0.47 * vh, hoverMin, Math.max(hoverMin, hoverMax)) };
  // The peek spot: just inside the right edge with her wings relaxed, still facing right, so her wand, the giggle
  // and the wave all play on the screen-edge side, away from the names (which sit at the left of each card).
  // (The giggle rocks her about 5 degrees and squashes her about 4%, so allow for both.)
  let reach = 0, bottom = 0;
  for (const degrees of [-6, -3, 0, 3, 6]) {
    const a = degrees * Math.PI / 180;
    for (const p of silhouette(PERCH_SPREAD)) {
      reach = Math.max(reach, (p.x * Math.cos(a) - p.y * Math.sin(a)) * unit);
      bottom = Math.max(bottom, (p.x * Math.sin(a) + p.y * Math.cos(a)) * unit);
    }
  }
  const peek = { x: vw - reach - 3, y: clamp(0.4 * vh, hoverMin, Math.max(hoverMin, hoverMax - 0.02 * vh)) };
  // Where the last card is too narrow for her to fit beside its names (the left 75% of the card: 9 to 11 letter
  // names are 150-190 px wide), and it is a tall single-row card, she peeks from as low as she safely can, below
  // the names, where a team card is empty: her feet stay just above the footer through the landing squash and
  // the bob, and through the squat (down 2% of the height) before the zoom.
  const lastCards = columns.length && onScreen.length ? onScreen.filter((r) => Math.abs(cx(r) - columns[columns.length - 1].x) <= 12) : [];
  const card = lastCards.length === 1 ? lastCards[0] : null;
  let lowered = false;
  if (card && peek.x - reach < card.left + 0.75 * card.width - 0.02 * W && card.height >= 0.55 * vh) {
    const y = Math.max(hoverMin, vh - FAIRY.footerPx - 0.01 * vh - Math.max(1.03 * bottom + 0.006 * vh, 0.94 * bottom + 0.02 * vh));
    lowered = y > peek.y;
    peek.y = Math.max(peek.y, y);
  }
  const lastTap = columns[columns.length - 1].tap;
  // (The hop over the last bloom down to a lowered peek spot is longer, so it takes a little longer.)
  const arrive = clamp(lastTap + 0.3 + (lowered ? 0.08 : 0), FAIRY.arriveMin, FAIRY.arriveMax);

  // Each tap: the side flick, unless that would put her wing past the left edge (or, for the first
  // tap, send her backwards from the hover spot); then lean in and point the wand down instead.
  const minLeft = 0.02 * W;
  const taps = columns.map((c, i): FairyTap => {
    const at = (d: number) => {
      const pose = tapPose(d);
      const off = tapOffset(pose);
      const x = c.x - off.x * unit, y = tapY - off.y * unit;
      // The recoil leans back a little from the tap pose, so check both leans.
      const back = recoilLean(d);
      const left = Math.min(hullExtent(unit, pose.lean, tapSpread(d)).left, hullExtent(unit, pose.lean - back, tapSpread(d)).left - Math.max(0, recoilPull(d, vw)));
      return { pose, x, y, left: x + left, top: y + hullExtent(unit, pose.lean - back).top };
    };
    const ok = (d: number) => {
      const p = at(d);
      return p.left >= minLeft && (i > 0 || p.x >= hover.x - 0.03 * vw) && p.top >= FAIRY.headerPx;
    };
    let d = 0;
    if (!ok(0)) {
      let lo = 0, hi = 1;
      for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
      d = hi;
    }
    const p = at(d);
    return { t: c.tap, x: p.x, y: p.y, d, ...p.pose };
  });
  return { W, unit, vw, vh, band, columns, covers, tapY, hover, peek, arrive, taps, hopCeil, lowered };
}

function catmull(p0: Point, p1: Point, p2: Point, p3: Point, u: number): Point {
  const u2 = u * u, u3 = u2 * u;
  const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}

function entrancePoint(t: number, L: FairyLayout): Point {
  const { vw, vh, W, hover: H } = L;
  const knots: [number, Point][] = [
    [0.15, { x: -0.6 * W, y: 0.74 * vh }],
    [0.3, { x: 0.05 * vw, y: 0.62 * vh }],
    [0.42, { x: H.x + 0.1 * vw, y: H.y - 0.02 * vh }],
    [0.52, { x: H.x + 0.05 * vw, y: H.y - 0.14 * vh }],
    [0.62, { x: H.x - 0.05 * vw, y: H.y - 0.07 * vh }],
    [0.75, { x: H.x, y: H.y }],
  ];
  let i = 1;
  while (i < knots.length - 1 && t > knots[i][0]) i++;
  const a = knots[i - 1], b = knots[i];
  const p0 = knots[Math.max(0, i - 2)][1], p3 = knots[Math.min(knots.length - 1, i + 1)][1];
  return catmull(p0, a[1], b[1], p3, progress(t, a[0], b[0]));
}

/** Squash (sy < 1) or stretch (sy > 1) with a rough area-preserving width. */
const squash = (sy: number) => ({ sx: 2 - sy, sy });
/** A wand pump: rises into each count pulse and settles after it. */
const pulseBump = (t: number, at: number) => bump(t, at - 0.05, at + 0.01, at + 0.12);
/** Recoil after a tap at `from`: springs up over FAIRY.recoil, then eases away by `to`. */
const recoilEnv = (t: number, from: number, to: number) => easeOutCubic(progress(t, from, from + FAIRY.recoil)) * (1 - smooth(progress(t, from + FAIRY.recoil, to)));

/** The hover performance at H: landing dip, bob, and the acting of the count gag. */
function hoverBody(t: number, L: FairyLayout) {
  const { vh, hover: H } = L;
  const [p1, p2] = FAIRY.pulses;
  const fz = FAIRY.fizzle, bl = FAIRY.bling;
  const env = smooth(progress(t, 0.75, 0.95)) * (1 - smooth(progress(t, bl + 0.04, FAIRY.anticipation[0])));
  const bob = Math.sin(TAU * 1.6 * (t - 0.75)) * 0.006 * vh * env;
  const dip = 0.014 * vh * Math.sin(Math.PI * progress(t, 0.75, 1.02));
  // The look's "huh?": a little bob mid-hold as she turns the grey wand over.
  const huh = bump(t, FAIRY.look[0] + 0.15, FAIRY.look[0] + 0.21, FAIRY.look[0] + 0.3);
  const acting = -0.006 * vh * pulseBump(t, p1) - 0.007 * vh * pulseBump(t, p2)
    + 0.014 * vh * bump(t, fz, fz + 0.09, fz + 0.31) - 0.008 * vh * huh - 0.022 * vh * bump(t, bl - 0.02, bl + 0.03, bl + 0.14);
  const sway = 2 * Math.sin(TAU * 0.8 * (t - 0.75)) * env;
  const [s0, s1] = FAIRY.shake;
  const shake = 2.5 * Math.sin(TAU * 14 * (t - s0)) * Math.sin(Math.PI * progress(t, s0, s1));
  const rotate = keyframes(t, [[0.75, -4], [0.9, 0]]) + sway + 4 * bump(t, fz, fz + 0.09, fz + 0.29) + shake - 5 * bump(t, bl - 0.02, bl + 0.03, bl + 0.14);
  const sy = keyframes(t, [[0.75, 1], [0.8, 0.93], [0.9, 1.03], [1.0, 1]]) + 0.03 * pulseBump(t, p1) + 0.04 * pulseBump(t, p2)
    - 0.05 * bump(t, fz, fz + 0.07, fz + 0.29) + 0.09 * bump(t, bl - 0.01, bl + 0.03, bl + 0.14);
  return { x: H.x, y: H.y + dip + bob + acting, rotate, ...squash(sy) };
}

/** How far the waist may rise above both ends of a hop (header room), split between the hop arc and the recoil. */
function riseRoom(L: FairyLayout, ya: number, yb: number) { return Math.max(0, Math.min(ya, yb) - L.hopCeil); }

/** Waist position, rotation, flip, scale and squash at time t. */
export function fairyBody(t: number, L: FairyLayout): FairyBody {
  const { vw, vh, W, hover: H, peek: P, arrive, taps } = L;
  const [a0, a1] = FAIRY.anticipation;
  const [u0, u1] = FAIRY.unflip;
  // Anticipation: lean back and squat in place, then hop on to the first tap.
  const first = { t: a1, x: H.x, y: H.y + 0.012 * vh, lean: -8, d: 0 };
  const last = taps[taps.length - 1];
  let x: number, y: number, rotate = 0, sx = 1, sy = 1;
  if (t < FAIRY.entrance[0]) {
    ({ x, y } = { x: -0.6 * W, y: 0.74 * vh }); rotate = -25; sy = 1.06; sx = 0.94;
  } else if (t < FAIRY.entrance[1]) {
    ({ x, y } = entrancePoint(t, L));
    rotate = keyframes(t, [[0.15, -25], [0.42, -8], [0.52, -20], [0.62, 12], [0.75, -4]]);
    ({ sx, sy } = squash(keyframes(t, [[0.15, 1.06], [0.4, 1], [0.75, 1]])));
  } else if (t < a0) {
    ({ x, y, rotate, sx, sy } = hoverBody(t, L));
  } else if (t < first.t) {
    const from = hoverBody(a0, L);
    const u = smooth(progress(t, a0, first.t));
    x = mix(from.x, first.x, u); y = mix(from.y, first.y, u); rotate = mix(from.rotate, first.lean, u);
    ({ sx, sy } = squash(mix(from.sy, 0.94, u)));
  } else if (t < last.t) {
    const knots = [first, ...taps];
    let i = 1;
    while (t > knots[i].t) i++;
    const a = knots[i - 1], b = knots[i];
    const gap = b.t - a.t;
    // After a tap: recoil and hold, then travel. The first hop springs straight out of the anticipation.
    const hold = i === 1 ? 0 : Math.min(FAIRY.hold, 0.45 * gap) * (1 - 0.5 * taps[i - 2].d);
    const u = progress(t, a.t + hold, b.t);
    const su = smooth(u);
    const rec = i === 1 ? 0 : recoilEnv(t, a.t, b.t);
    const room = riseRoom(L, a.y, b.y);
    let hop = 0.05 * vh * clamp(gap / 0.3, 0.4, 1), lift = i === 1 ? 0 : 0.04 * vh * (1 - 0.6 * taps[i - 2].d);
    if (hop + lift > room) { const k = room / (hop + lift); hop *= k; lift *= k; }
    const dir = Math.abs(b.x - a.x) < 1 ? 0 : Math.sign(b.x - a.x);
    x = mix(a.x, b.x, su) - (i === 1 ? 0 : recoilPull(taps[i - 2].d, vw)) * rec;
    y = mix(a.y, b.y, su) - hop * Math.sin(Math.PI * u) - lift * rec;
    rotate = mix(a.lean, b.lean, su) + 8 * Math.sin(Math.PI * u) * (i === 1 ? 1 : dir) - (i === 1 ? 0 : recoilLean(taps[i - 2].d)) * rec;
    // A stretch as she springs off the tap; it has settled by the next tap, where the star must land exactly.
    const springUp = i === 1 ? 0 : 0.05 * Math.sin(Math.PI * progress(t, a.t, a.t + Math.min(0.22, gap)));
    ({ sx, sy } = squash((i === 1 ? mix(0.94, 1, smooth(u)) : 1) + 0.05 * Math.sin(Math.PI * u) + springUp));
  } else if (t < arrive) {
    // Spring back from the last bloom, hold, then arc up over it to the peek spot.
    const hold = clamp(arrive - last.t - 0.3, FAIRY.hold, 0.3);
    const u = progress(t, last.t + hold, arrive);
    const su = smooth(u);
    const rec = recoilEnv(t, last.t, arrive);
    const room = riseRoom(L, last.y, P.y);
    // A peek spot lower down (below a narrow card's names) is reached by hopping over the bloom and only then
    // dropping down beside it.
    const lower = P.y > last.y;
    const base = lower ? last.y : mix(last.y, P.y, 0.5);
    let arc = Math.max(0.03 * vh, base - (L.tapY - 0.13 * vh)), lift = 0.04 * vh;
    if (arc + lift > room) { const k = room / (arc + lift); arc *= k; lift *= k; }
    // Rise first, then glide across: the arc peaks early, so she is high as she passes over the bloom.
    const [x0, x1] = lower ? [0.05, 0.6] : [0.12, 1];
    const xu = smooth(progress(u, x0, x1));
    x = mix(last.x, P.x, xu) - recoilPull(last.d, vw) * rec;
    if (lower) {
      // She hops over the bloom (the top of the hop is where x reaches its column, at uc), then floats down beside it.
      const c = clamp01((L.columns[L.columns.length - 1].x - last.x) / Math.max(1, P.x - last.x));
      const up = clamp(x0 + (x1 - x0) * (0.5 - Math.sin(Math.asin(1 - 2 * c) / 3)), 0.2, 0.8);
      y = (u < up ? last.y - arc * Math.sin(0.5 * Math.PI * u / up) : mix(last.y - arc, P.y, smooth(progress(u, up, 1)))) - lift * rec;
    } else {
      y = mix(last.y, P.y, su) - arc * Math.sin(Math.PI * u ** 0.8) - lift * rec;
    }
    rotate = mix(last.lean, 0, su) + 6 * Math.sin(Math.PI * u) - recoilLean(last.d) * rec;
    ({ sx, sy } = squash(1 + 0.04 * Math.sin(Math.PI * u) + 0.05 * Math.sin(Math.PI * progress(t, last.t, last.t + 0.22))));
  } else if (t < u0) {
    const [g0, g1] = FAIRY.giggle;
    const env = smooth(progress(t, arrive, arrive + 0.2)) * (1 - smooth(progress(t, u0 - 0.08, u0)));
    const bob = Math.sin(TAU * 1.6 * (t - arrive)) * 0.006 * vh * env;
    const g = window01(t, g0, g1, 0.06);
    const bounce = Math.abs(Math.sin(Math.PI * 4.4 * (t - g0)));
    const inGiggle = t >= g0 && t < g1;
    // The butterfly lands: a tiny startled rise, then she holds still, cross-eyed.
    const startle = -0.008 * vh * bump(t, FAIRY.land - 0.02, FAIRY.land + 0.05, FAIRY.land + 0.2);
    x = P.x;
    y = P.y + bob + startle - (inGiggle ? bounce * 0.013 * vh * (1 - 0.4 * progress(t, g0, g1)) : 0);
    rotate = 5 * Math.sin(TAU * 2.2 * (t - g0)) * g;
    ({ sx, sy } = squash(1 - 0.04 * (1 - bounce) * g + 0.03 * bump(t, FAIRY.land - 0.02, FAIRY.land + 0.05, FAIRY.land + 0.2)));
  } else if (t < u1) {
    // A little squat before the zoom.
    const u = progress(t, u0, u1);
    x = P.x; y = P.y + 0.02 * vh * smooth(u); rotate = -6 * u;
    ({ sx, sy } = squash(1 - 0.06 * smooth(u)));
  } else {
    // An accelerating zoom up and off the top-right corner; she clears the right edge only just before exitEnd.
    // From a lowered spot (below the last card's names) she leaves right first and rises second, so the zoom
    // never cuts back up across the names.
    const u = progress(t, u1, FAIRY.exitEnd);
    x = L.lowered ? mix(P.x, vw + 0.4 * W, u) : mix(P.x, vw + 0.45 * W, u * u);
    y = mix(P.y + 0.02 * vh, 0.08 * vh, L.lowered ? u * u : u);
    rotate = mix(-6, -25, u);
    ({ sx, sy } = squash(keyframes(t, [[u1, 0.94], [u1 + 0.05, 1.1], [u1 + 0.18, 1.02]])));
  }
  // She faces right throughout: at the peek spot her wand stays on the screen-edge side, away from the names.
  const flip = 1;
  const scale = t < 0.42 ? mix(0.8, 1, smooth(progress(t, 0.15, 0.42)))
    : t < u1 ? 1 : mix(1, 0.65, smooth(progress(t, u1, FAIRY.exitEnd)));
  // Wings tuck in for a lean-in tap and open again as she springs back. At the peek spot they relax
  // (so the far wing stays on screen) and open again as she zooms away.
  let tuck = 0;
  for (const k of taps) if (k.d > 0) tuck = Math.max(tuck, k.d * (t < k.t ? smooth(progress(t, k.t - 0.18, k.t)) : 1 - smooth(progress(t, k.t + 0.04, k.t + 0.3))));
  const perch = smooth(progress(t, arrive - 0.16, arrive)) * (1 - smooth(progress(t, u1, u1 + 0.12)));
  return { x, y, rotate, flip, scale, sx, sy, spread: Math.min(1 - WING_TUCK * tuck, 1 - (1 - PERCH_SPREAD) * perch) };
}

const wandWobble = (t: number): ArmPose => ({ arm: 6 * Math.sin(TAU * 2 * t), wrist: 0 });

/** Wand arm pose: the arm about the shoulder and the wand about the hand (degrees, + is down). */
export function fairyArmPose(t: number, L: FairyLayout): ArmPose {
  const { taps, arrive } = L;
  const [p1, p2] = FAIRY.pulses;
  const fz = FAIRY.fizzle, bl = FAIRY.bling;
  const [l0] = FAIRY.look;
  const [s0, s1] = FAIRY.shake;
  const [a0, a1] = FAIRY.anticipation;
  const { count, pump, droop, look, shake, bling, rest } = POSES;
  if (t < FAIRY.armRaise[0]) return wandWobble(t);
  if (t < fz - 0.02) {
    const base = mixPose(wandWobble(FAIRY.armRaise[0]), count, smooth(progress(t, FAIRY.armRaise[0], FAIRY.armRaise[1])));
    const k = 0.8 * pulseBump(t, p1) + pulseBump(t, p2);
    return { arm: base.arm + (pump.arm - count.arm) * k, wrist: base.wrist + (pump.wrist - count.wrist) * k };
  }
  if (t < s0) {
    // Droop, a little bounce, then she brings the wand up beside her face and peers at it. Mid-hold she
    // turns it over ("huh?"), then holds it still for a beat before the swing into the shake.
    const settle = { arm: droop.arm - 6, wrist: droop.wrist + 6 };
    const peer = { arm: look.arm - 4, wrist: look.wrist + 3 };
    const turn = { arm: look.arm - 3, wrist: look.wrist - 9 };
    return poseKeys(t, [[fz - 0.02, count], [fz + 0.06, droop], [l0, settle], [l0 + 0.09, look], [l0 + 0.15, look], [l0 + 0.21, turn], [l0 + 0.28, peer], [s0, peer]]);
  }
  if (t < s1) {
    // Swing the wand out in front, then shake it hard.
    const peer = { arm: look.arm - 4, wrist: look.wrist + 3 };
    const base = mixPose(peer, shake, smooth(progress(t, s0, s0 + 0.07)));
    const w = Math.sin(TAU * 14 * (t - s0 - 0.03)) * Math.sin(Math.PI * progress(t, s0 + 0.03, s1));
    return { arm: base.arm + 12 * w, wrist: base.wrist + 14 * w };
  }
  if (t < a1) return poseKeys(t, [[s1, shake], [bl - 0.01, bling], [a0, { arm: bling.arm + 3, wrist: bling.wrist }], [a1, rest]]);
  const lastTap = taps[taps.length - 1].t;
  if (t < lastTap + 0.16) {
    // Each tap: a small wind-up, a flick into the tap pose, and back. The windows shrink when taps
    // are close, so nothing from a neighbouring tap moves the star at a tap. Overlapping flicks blend.
    let arm = 0, wrist = 0, weight = 0, windUp = 0;
    taps.forEach((k, i) => {
      const before = i ? k.t - taps[i - 1].t : k.t - a1, after = i < taps.length - 1 ? taps[i + 1].t - k.t : 1;
      const rise = Math.min(0.1, before), fall = Math.min(0.16, after), wind = Math.min(0.2, before);
      const f = t < k.t ? smooth(progress(t, k.t - rise, k.t)) : 1 - smooth(progress(t, k.t, k.t + fall));
      arm += (k.arm - rest.arm) * f; wrist += (k.wrist - rest.wrist) * f; weight += f;
      windUp = Math.max(windUp, bump(t, k.t - wind, k.t - wind / 2, k.t));
    });
    const n = Math.max(1, weight);
    return { arm: rest.arm + arm / n - 10 * windUp, wrist: rest.wrist + wrist / n };
  }
  // At the peek spot the wand is held a little higher, so the star stays inside the right edge through the giggle and the wave.
  const [g0, g1] = FAIRY.giggle;
  if (t < g0) return poseKeys(t, [[lastTap + 0.16, rest], [arrive, { arm: -14, wrist: 0 }]]);
  if (t < g1) return { arm: -14 + 6 * Math.sin(TAU * 4.4 * (t - g0)), wrist: 0 };
  const [w0, w1] = FAIRY.wave;
  if (t < w1) return { arm: mix(-14, -18, smooth(progress(t, w0, w0 + 0.06))) + 18 * Math.sin(TAU * 5 * (t - w0)) * Math.sin(Math.PI * progress(t, w0, w1)), wrist: 0 };
  return { arm: keyframes(t, [[w1, -18], [FAIRY.unflip[1], -24]]), wrist: 0 };
}
/** The arm angle alone (degrees about the shoulder). */
export function fairyArm(t: number, L: FairyLayout): number { return fairyArmPose(t, L).arm; }

export function fairyFace(t: number): FairyFace {
  if (t < FAIRY.armRaise[0]) return 'happy';
  if (t < FAIRY.fizzle) return 'focus';
  if (t < FAIRY.look[0] + 0.06) return 'surprised';
  if (t < FAIRY.shake[0]) return 'look';
  if (t < FAIRY.bling - 0.04) return 'effort';
  if (t < FAIRY.bling + 0.28) return 'delighted';
  if (t < FAIRY.crossed[0]) return 'happy';
  if (t < FAIRY.crossed[1]) return 'crossed';
  if (t < FAIRY.giggle[1]) return 'delighted';
  if (t < FAIRY.unflip[1]) return 'wink';
  return 'happy';
}

export function fairyWings(t: number): FairyWings {
  if (t >= FAIRY.fizzle && t < FAIRY.bling) return 'fizzled';
  if (t >= FAIRY.giggle[0] && t < FAIRY.giggle[1]) return 'giggling';
  return 'flutter';
}

/** The BLING star's peak scale. */
export const BLING_SCALE = 2.2;
/** While she peers at it, the dead grey star pops up to this size, so the class can see what she is puzzled about. */
export const LOOK_STAR_SCALE = 1.4;
/** How far the grey star has popped up for the look (0 to about 1.1; it overshoots a little), and back down before the shake. */
export function lookStarPop(t: number) {
  const [l0] = FAIRY.look, s0 = FAIRY.shake[0];
  if (t < l0 + 0.06 || t >= s0 + 0.03) return 0;
  return easeOutBack(progress(t, l0 + 0.06, l0 + 0.18), 1.6) * (1 - smooth(progress(t, s0 - 0.07, s0 + 0.03)));
}

export function fairyStar(t: number, L: FairyLayout): FairyStarState {
  const [p1, p2] = FAIRY.pulses;
  const fz = FAIRY.fizzle, b = FAIRY.bling;
  const grey = t >= fz && t < b;
  let scale = 1 + 0.35 * bump(t, p1 - 0.05, p1 + 0.01, p1 + 0.17) + 0.5 * bump(t, p2 - 0.05, p2 + 0.01, p2 + 0.18);
  if (grey) scale = keyframes(t, [[fz, 1.12], [fz + 0.05, 0.72], [fz + 0.14, 0.8]]) + (LOOK_STAR_SCALE - 0.8) * lookStarPop(t);
  if (t >= b) scale = t < b + 0.08 ? mix(0.8, BLING_SCALE, easeOutBack(progress(t, b, b + 0.08), 1.2)) : mix(BLING_SCALE, 1, easeOutCubic(progress(t, b + 0.08, b + 0.38)));
  let tapSpin = 0;
  if (t >= b + 0.38) {
    let pop = 0;
    for (const k of L.taps) { pop = Math.max(pop, bump(t, k.t - 0.06, k.t, k.t + 0.2)); tapSpin += 72 * easeOutCubic(progress(t, k.t - 0.04, k.t + 0.22)); }
    scale = 1 + 0.5 * pop;
  }
  const spin = 144 * easeOutCubic(progress(t, b, b + 0.45)) + tapSpin + 36 * bump(t, p1 - 0.05, p1 + 0.01, p1 + 0.17) - 36 * bump(t, p2 - 0.05, p2 + 0.01, p2 + 0.18);
  return { scale, spin, grey, glow: grey ? 0 : 1 + 0.6 * bump(t, b, b + 0.06, b + 0.5) };
}

/** Local head tilt: acting beats plus a little follow-through against body rotation. */
export function fairyHead(t: number, L: FairyLayout, body = fairyBody(t, L)): number {
  const [g0, g1] = FAIRY.giggle;
  const [l0, l1] = FAIRY.look;
  const fz = FAIRY.fizzle;
  const giggle = 6 * Math.sin(TAU * 2.2 * (t - g0) + 1) * window01(t, g0, g1, 0.1);
  // Count: a slight tilt towards the star. Look: about 10 degrees towards the wand, held, with a
  // double-take ("huh?") mid-hold.
  const count = 4 * window01(t, FAIRY.armRaise[0], fz, 0.08);
  const hold = smooth(progress(t, l0, l0 + 0.09)) * (1 - smooth(progress(t, l1 - 0.04, l1 + 0.06)));
  const look = 11 * hold + 7 * bump(t, l0 + 0.15, l0 + 0.2, l0 + 0.29) - 5 * bump(t, fz, fz + 0.05, fz + 0.15) - 5 * bump(t, FAIRY.crossed[0] - 0.06, FAIRY.crossed[0] + 0.06, FAIRY.crossed[1]);
  const lagging = fairyBody(t - 0.08, L).rotate;
  const follow = clamp(-0.45 * (body.rotate - lagging), -6, 6);
  return count + look + giggle + follow * body.flip;
}

/** Skirt and legs trail behind horizontal motion (local degrees about the waist). */
export function fairySkirt(t: number, L: FairyLayout, body = fairyBody(t, L)): number {
  const a = fairyBody(t - 0.07, L), b = fairyBody(t - 0.02, L);
  const vx = (b.x - a.x) / 0.05 / L.vw;
  const idle = 2.5 * Math.sin(TAU * 1.1 * t);
  return clamp(9 * vx, -14, 14) * body.flip + idle;
}

export function fairyPose(t: number, L: FairyLayout): FairyPose {
  const body = fairyBody(t, L);
  return { ...body, ...fairyArmPose(t, L), head: fairyHead(t, L, body), skirt: fairySkirt(t, L, body), face: fairyFace(t), wings: fairyWings(t), star: fairyStar(t, L) };
}

/** Screen position of the wand star's centre. */
export function fairyStarPoint(t: number, L: FairyLayout): Point {
  const p = fairyArmPose(t, L);
  return toScreen(fairyBody(t, L), starLocal(p.arm, p.wrist), L.unit);
}

/** A point on her head (art units), carried by the head tilt, to screen. */
function headPoint(t: number, L: FairyLayout, p: Point): Point {
  const body = fairyBody(t, L);
  const head = fairyHead(t, L, body);
  const r = rotatePoint({ x: p.x - ART.neck.x, y: p.y - ART.neck.y }, head);
  return toScreen(body, { x: ART.neck.x + r.x, y: ART.neck.y + r.y }, L.unit);
}
/** Screen position of the tip of her nose (where the hero butterfly perches). */
export function fairyNose(t: number, L: FairyLayout): Point { return headPoint(t, L, ART.perch); }
/** Screen angle of her head (degrees): the body rotation plus the head tilt, mirrored when she faces left. */
export function fairyHeadAngle(t: number, L: FairyLayout): number {
  const body = fairyBody(t, L);
  return body.rotate + fairyHead(t, L, body) * Math.sign(body.flip || 1);
}

/** Screen-space bounds of her silhouette (body and wings; rotation, flip, scale and squash applied). */
export function fairyBounds(t: number, L: FairyLayout) {
  const body = fairyBody(t, L);
  const pts = silhouette(body.spread).map((p) => toScreen(body, p, L.unit));
  return { left: Math.min(...pts.map((p) => p.x)), right: Math.max(...pts.map((p) => p.x)), top: Math.min(...pts.map((p) => p.y)), bottom: Math.max(...pts.map((p) => p.y)) };
}

/**
 * The butterfly art (left half, seen from the front): quadratic outlines [start, control, mid, control, end],
 * in butterfly units (100 across the open wings). The cover butterflies, the flying hero and the perched hero share it.
 */
export const BFLY_FORE = [[-3, -4], [-30, -40], [-46, -26], [-50, -6], [-4, 2]] as const;
export const BFLY_HIND = [[-3, 2], [-36, 8], [-30, 28], [-16, 36], [-3, 8]] as const;
export const BFLY_SPOTS = { fore: { x: -30, y: -20, r: 6 }, hind: { x: -20, y: 18, r: 4 }, shine: { x: -38, y: -28, r: 2.5 } } as const;
type Quad = readonly (readonly [number, number])[];
export const quadPath = (q: Quad) => `M${q[0].join(' ')}Q${q[1].join(' ')} ${q[2].join(' ')}Q${q[3].join(' ')} ${q[4].join(' ')}Z`;
/** A butterfly wing outline sampled as a polygon (butterfly units). */
export function quadPolygon(q: Quad, steps = 16): Point[] {
  const at = (a: readonly number[], c: readonly number[], b: readonly number[], u: number) => ({ x: (1 - u) ** 2 * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0], y: (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1] });
  const out: Point[] = [];
  for (let i = 0; i < steps; i++) out.push(at(q[0], q[1], q[2], i / steps));
  for (let i = 0; i <= steps; i++) out.push(at(q[2], q[3], q[4], i / steps));
  return out;
}

/**
 * The perched hero butterfly: front-on on the tip of her nose, wings raised in a V over her forehead and
 * bangs, so both crossed pupils stay in view. Fairy art units about the perch point; the wings pivot at
 * the thorax (`rootY` above the perch), `scale` fairy units per butterfly unit.
 */
export const PERCH = { rootY: -20, scale: 0.9, fore: 32, hind: 64, flex: 10, hz: 1.3, rise: 0.14, landRise: 0.8 } as const;
/** The flying hero is HERO_FLY_W x W across at size 1; perched, it is this size (the same butterfly units as the perch). */
export const HERO_FLY_W = 0.2;
export const HERO_PERCH_SIZE = PERCH.scale * 100 / 330 / HERO_FLY_W;
/** The perched wings' rotations (degrees, raising each wing): they rise from flat as it lands, then slowly open and close. */
export function perchWings(t: number) {
  // It lands with its wings already half raised (they flap too fast to see the change), so they never lie flat over her eyes.
  const rise = mix(PERCH.landRise, 1, easeOutBack(progress(t, FAIRY.land, FAIRY.land + PERCH.rise), 1.2));
  const flex = PERCH.flex * Math.sin(TAU * PERCH.hz * (t - FAIRY.land - PERCH.rise)) * smooth(progress(t, FAIRY.land + 0.08, FAIRY.land + 0.3));
  return { fore: PERCH.fore * rise + flex, hind: PERCH.hind * rise + flex };
}
/** The perched butterfly's left wings (forewing, hindwing) in fairy art units, for the pose at time t. */
export function perchedWingPolygons(t: number): Point[][] {
  const { fore, hind } = perchWings(t);
  const place = (q: Quad, degrees: number) => quadPolygon(q).map((p) => {
    const r = rotatePoint({ x: p.x * PERCH.scale, y: p.y * PERCH.scale }, degrees);
    return { x: ART.perch.x + r.x, y: ART.perch.y + PERCH.rootY + r.y };
  });
  return [place(BFLY_FORE, fore), place(BFLY_HIND, hind)];
}

/** Screen position of the perched butterfly's wing root (its thorax), where the flying butterfly homes in. */
export function heroPerchRoot(t: number, L: FairyLayout): Point { return headPoint(t, L, { x: ART.perch.x, y: ART.perch.y + PERCH.rootY }); }

export type HeroButterfly = { x: number; y: number; perched: boolean; opacity: number; tilt: number; scale: number; size: number; fore: number; hind: number };
/**
 * The hero butterfly rises from the last bloom, flies to her nose (growing to its perched size), lands with a
 * pop and raises its wings, then flutters away. Flying, (x, y) is its body centre; perched, the perch point.
 */
export function heroButterfly(t: number, L: FairyLayout): HeroButterfly | null {
  const lastCol = L.columns[L.columns.length - 1];
  const spawnT = L.taps[L.taps.length - 1].t + 0.08;
  if (t < spawnT) return null;
  const vmin = Math.min(L.vw, L.vh);
  const spawn = { x: lastCol.x, y: L.tapY - 0.05 * L.vh };
  if (t < FAIRY.land) {
    const u = progress(t, spawnT, FAIRY.land);
    const n = heroPerchRoot(t, L);
    const e = easeInOutCubic(u);
    const settle = smooth(progress(t, FAIRY.land - 0.35, FAIRY.land));
    return {
      x: mix(spawn.x, n.x, e) + 0.05 * vmin * Math.sin(TAU * 1.5 * u) * (1 - u),
      y: mix(spawn.y, n.y, e) - 0.08 * vmin * Math.sin(Math.PI * u),
      perched: false, opacity: smooth(progress(t, spawnT, spawnT + 0.1)),
      tilt: 16 * Math.sin(TAU * 1.5 * u) * (1 - u) + fairyHeadAngle(t, L) * settle,
      scale: mix(0.5, 1, smooth(progress(t, spawnT, spawnT + 0.2))) * (1 + 0.12 * smooth(progress(t, FAIRY.land - 0.1, FAIRY.land))),
      size: mix(1, HERO_PERCH_SIZE, settle), fore: 0, hind: 0,
    };
  }
  if (t < FAIRY.takeoff) {
    return {
      ...fairyNose(t, L), perched: true, opacity: 1, tilt: fairyHeadAngle(t, L), size: HERO_PERCH_SIZE, ...perchWings(t),
      scale: keyframes(t, [[FAIRY.land, 1.12], [FAIRY.land + 0.07, 0.94], [FAIRY.land + 0.15, 1]]),
    };
  }
  // It flutters away towards the screen edge (out first, up second, so it never crosses the last card's names,
  // which are to her left) and dwindles to nothing (a shrink, never a see-through fade) well before she zooms off.
  const n = heroPerchRoot(FAIRY.takeoff, L);
  const gone = FAIRY.takeoff + HERO_AWAY_S;
  const u = progress(t, FAIRY.takeoff, gone);
  const lift = smooth(progress(t, FAIRY.takeoff, FAIRY.takeoff + 0.15));
  return {
    x: n.x + 0.1 * L.vw * easeOutCubic(u) + 0.03 * vmin * Math.sin(TAU * 2 * u), y: n.y - 0.3 * L.vh * u * u, perched: false,
    opacity: 1, tilt: mix(fairyHeadAngle(FAIRY.takeoff, L), 18, lift), scale: 1 - smooth(progress(t, gone - 0.24, gone)),
    size: mix(HERO_PERCH_SIZE, 1, smooth(progress(t, FAIRY.takeoff, FAIRY.takeoff + 0.3))), fore: 0, hind: 0,
  };
}
/** After it takes off, the hero butterfly is gone (shrunk to nothing) this many seconds later. */
export const HERO_AWAY_S = 0.5;

/** A ribbon sample: centre, outer half-width (the edge), fill half-width, age (s) and arc-length fraction from the head. */
export type RibbonPoint = Point & { half: number; fill: number; age: number; u: number };
/** The ribbon trails this many seconds of the star's path, sampled this often. */
export const RIBBON_SPAN = 0.5;
export const RIBBON_STEP = 0.011;

/**
 * After each tap the ribbon regrows from where the star stops springing back and heads on (the far end of
 * the recoil): the star's furthest point back along the direction of travel, within 0.25 s of the tap, and never
 * before the recoil's spring is over. Before that there is no ribbon, so the recoil (up and back over the card
 * that has just bloomed, or straight up out of a lean-in tap) is never traced as a hook.
 * Pure, and cached per layout.
 */
const regrowCache = new WeakMap<FairyLayout, number[]>();
export function ribbonRegrowTimes(L: FairyLayout): number[] {
  let times = regrowCache.get(L);
  if (!times) {
    times = L.taps.map((k, i) => {
      const next = L.taps[i + 1];
      const end = Math.min(next ? next.t - 0.02 : L.arrive, k.t + 0.25);
      const dir = (next ? next.x : L.peek.x) >= k.x ? 1 : -1;
      const from = Math.min(end, k.t + FAIRY.recoil);
      let best = from, reach = Infinity;
      for (let s = from; s <= end + 1e-9; s += 0.005) {
        const x = fairyStarPoint(s, L).x * dir;
        if (x < reach - 1e-6) { reach = x; best = s; }
      }
      return best;
    });
    regrowCache.set(L, times);
  }
  return times;
}

/**
 * Where the ribbon starts afresh from the star: the entrance, the BLING, every tap and the squat before the
 * zoom. It never trails back past the latest one, so it never traces the shake, and a tap's recoil never folds
 * it back on itself or drags it across the names that have just been revealed (the old stretch is spent in the
 * tap burst; a new ribbon grows out of the star once she heads on, see ribbonRegrowTimes). The result can lie
 * after `t` (no ribbon yet).
 */
export function ribbonRestart(t: number, L: FairyLayout): number {
  let latest: number = FAIRY.entrance[0];
  for (const s of [FAIRY.bling, FAIRY.unflip[0]] as number[]) if (s <= t && s > latest) latest = s;
  const regrow = ribbonRegrowTimes(L);
  L.taps.forEach((k, i) => { if (k.t <= t && k.t >= latest) latest = Math.max(k.t, regrow[i]); });
  return latest;
}

/**
 * How many seconds of the star's path the ribbon may trail (0 = no ribbon). The full span while the magic is on;
 * it reels in, tail first, as she lands for the count (the count and the fizzle play without it), as she leaves
 * the last bloom (so it never sweeps over the last card's names on the way to the peek spot) and as she zooms off.
 * It never fades to a see-through ghost: it only gets shorter.
 */
export function ribbonSpan(t: number, L?: FairyLayout): number {
  if (t < FAIRY.entrance[0]) return 0;
  const reel = (from: number, to: number) => RIBBON_SPAN * (1 - smooth(progress(t, from, to)));
  if (t < FAIRY.bling) return reel(FAIRY.landReel[0], FAIRY.landReel[1]);
  if (t < FAIRY.unflip[0]) {
    const from = L ? L.taps[L.taps.length - 1].t + FAIRY.recoil : FAIRY.arriveMin - 0.18;
    return reel(from, L ? L.arrive : FAIRY.arriveMin);
  }
  return reel(FAIRY.exitReel, FAIRY.exitEnd);
}

/** The ribbon's opacity: fully on whenever it has any length (it reels in rather than fading). */
export function ribbonOpacity(t: number, L?: FairyLayout) { return ribbonSpan(t, L) > 1e-6 ? 1 : 0; }

/** Star positions on the ribbon's global sampling grid (and a few exact times), cached per layout: pure, so safe to reuse. */
const starCache = new WeakMap<FairyLayout, Map<number, Point>>();
function cachedStar(key: number, s: number, L: FairyLayout): Point {
  let cache = starCache.get(L);
  if (!cache) starCache.set(L, cache = new Map());
  let p = cache.get(key);
  if (!p) {
    if (cache.size > 4000) cache.clear();
    p = fairyStarPoint(s, L);
    cache.set(key, p);
  }
  return p;
}
/** The star on the ribbon grid (grid index i, time i x RIBBON_STEP). */
const gridStar = (i: number, L: FairyLayout) => cachedStar(i, i * RIBBON_STEP, L);

/**
 * Ribbon centreline (head first). It samples the star's path back in time (on a fixed grid, so the samples are
 * cached from frame to frame), but only as far as the latest restart and the current span; drops stacked samples
 * of a still star, rounds the polyline off (two rounds of corner cutting), and narrows wherever the path turns
 * tighter than the ribbon is wide, so the offset edges can never fold back into spikes.
 */
export function fairyRibbon(t: number, L: FairyLayout): { opacity: number; pts: RibbonPoint[] } {
  const span = ribbonSpan(t, L);
  const opacity = span > 1e-6 ? 1 : 0;
  if (!opacity) return { opacity, pts: [] };
  const tail = Math.max(ribbonRestart(t, L), t - span);
  const trail = t - tail;
  if (trail < 0.004) return { opacity, pts: [] };
  const gap = 0.006 * L.W;
  let line: { x: number; y: number; age: number }[] = [];
  const add = (p: Point, age: number) => {
    const last = line[line.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= gap) line.push({ x: p.x, y: p.y, age });
  };
  add(fairyStarPoint(t, L), 0);
  for (let i = Math.floor(t / RIBBON_STEP - 1e-9); i * RIBBON_STEP > tail; i--) add(gridStar(i, L), t - i * RIBBON_STEP);
  // The exact tail, so a fresh ribbon starts right at the tap point.
  const tailPoint = cachedStar(-1 - Math.round(tail * 1e5), tail, L);
  const last = line[line.length - 1];
  if (line.length < 2 || Math.hypot(tailPoint.x - last.x, tailPoint.y - last.y) >= 0.3 * gap) line.push({ ...tailPoint, age: trail });
  else line[line.length - 1] = { ...tailPoint, age: trail };
  if (line.length < 2) return { opacity, pts: [] };
  // A short ribbon (just grown from a restart, or nearly reeled in) is thin too, never a blob.
  const grow = smooth(trail / 0.1);
  for (let round = 0; round < 2; round++) {
    const next = [line[0]];
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y, age: 0.75 * a.age + 0.25 * b.age });
      next.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y, age: 0.25 * a.age + 0.75 * b.age });
    }
    next.push(line[line.length - 1]);
    line = next;
  }
  const m = line.length;
  const cum = [0];
  for (let i = 1; i < m; i++) cum.push(cum[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y));
  const total = cum[m - 1];
  if (total < 1) return { opacity, pts: [] };
  // Width: tapers along the ribbon (and with age), with a slow twist; a thin darker edge runs round the fill.
  const s = L.W / 288;
  const fillRatio: number[] = [];
  const half = line.map((p, i) => {
    const f = Math.max(cum[i] / total, p.age / RIBBON_SPAN);
    const fill = (0.0375 * L.W * (1 - f) ** 0.8 * (0.45 + 0.55 * Math.abs(Math.cos(25 * p.age - 7 * t)))) * grow + 0.4;
    const edge = (1.5 * s * (1 - f) ** 0.5) * (0.4 + 0.6 * grow) + 0.25;
    fillRatio.push(fill / (fill + edge));
    return fill + edge;
  });
  // Never wider than the local turning radius...
  for (let i = 1; i < m - 1; i++) {
    const ax = line[i].x - line[i - 1].x, ay = line[i].y - line[i - 1].y, bx = line[i + 1].x - line[i].x, by = line[i + 1].y - line[i].y;
    const turn = Math.atan2(Math.abs(ax * by - ay * bx), ax * bx + ay * by);
    if (turn > 1e-3) half[i] = Math.min(half[i], 0.8 * Math.min(Math.hypot(ax, ay), Math.hypot(bx, by)) / (2 * Math.sin(turn / 2)));
  }
  // ...and pinched smoothly (the width changes by at most 0.6 px per px along the ribbon).
  for (let i = 1; i < m; i++) half[i] = Math.min(half[i], half[i - 1] + 0.6 * (cum[i] - cum[i - 1]));
  for (let i = m - 2; i >= 0; i--) half[i] = Math.min(half[i], half[i + 1] + 0.6 * (cum[i + 1] - cum[i]));
  const normals = line.map((_, i) => {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(m - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
  // Last guard: wherever an edge would still run backwards, pull that stretch in.
  for (let pass = 0; pass < 6; pass++) {
    let folded = false;
    for (let i = 0; i < m - 1; i++) {
      const dx = line[i + 1].x - line[i].x, dy = line[i + 1].y - line[i].y;
      const wx = normals[i + 1].x * half[i + 1] - normals[i].x * half[i], wy = normals[i + 1].y * half[i + 1] - normals[i].y * half[i];
      if (dx * dx + dy * dy - Math.abs(dx * wx + dy * wy) <= 0.05 * (dx * dx + dy * dy)) { half[i] *= 0.6; half[i + 1] *= 0.6; folded = true; }
    }
    if (!folded) break;
  }
  return { opacity, pts: line.map((p, i) => ({ x: p.x, y: p.y, age: p.age, u: cum[i] / total, half: half[i], fill: half[i] * fillRatio[i] })) };
}

/** Ribbon colours along its length (head 0 to tail 1): the fill, and the darker edge. */
const RIBBON_FILL: readonly (readonly [number, string])[] = [[0, '#ffd23f'], [0.3, '#ff9fcf'], [0.64, '#b995ff'], [1, '#cdeeff']];
const RIBBON_EDGE: readonly (readonly [number, string])[] = [[0, '#d99a14'], [0.3, '#e27ab4'], [0.64, '#9a74e0'], [1, '#bcd9f2']];
function paletteAt(stops: readonly (readonly [number, string])[], u: number) {
  let i = 1;
  while (i < stops.length - 1 && u > stops[i][0]) i++;
  const [u0, c0] = stops[i - 1], [u1, c1] = stops[i];
  const k = clamp01((u - u0) / (u1 - u0));
  const ch = (c: string, j: number) => Number.parseInt(c.slice(1 + 2 * j, 3 + 2 * j), 16);
  return `#${[0, 1, 2].map((j) => Math.round(mix(ch(c0, j), ch(c1, j), k)).toString(16).padStart(2, '0')).join('')}`;
}
export const ribbonFillColor = (u: number) => paletteAt(RIBBON_FILL, u);
export const ribbonEdgeColor = (u: number) => paletteAt(RIBBON_EDGE, u);

/**
 * A ribbon chunk: its edge and fill outlines, its index along the ribbon (0 at the head), and which way it runs
 * (head to tail) as a bounding-box diagonal, so its gradient can be a fixed one: chunk k always spans
 * k/RIBBON_CHUNKS..(k+1)/RIBBON_CHUNKS of the ribbon's length, so its colours never change.
 */
export type RibbonChunk = { edge: string; fill: string; k: number; dir: RibbonDir; u0: number; u1: number };
/** Bounding-box diagonal a chunk runs along, head to tail: e = towards +x, s = towards +y. */
export type RibbonDir = 'se' | 'sw' | 'ne' | 'nw';
export const RIBBON_DIRS: readonly RibbonDir[] = ['se', 'sw', 'ne', 'nw'];
export const RIBBON_CHUNKS = 6;
/**
 * The ribbon as opaque chunks along its length (drawn tail first, each overlapping the next by one sample so
 * no seam shows), each with its own short gradient, so colour follows the ribbon round loops and turns. The
 * edge outlines sit under the fills; a narrow highlight runs along the head.
 */
export function ribbonShape(pts: readonly RibbonPoint[]): { chunks: RibbonChunk[]; highlight: string } {
  if (pts.length < 2) return { chunks: [], highlight: '' };
  const m = pts.length;
  const normals = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(m - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
  const outline = (from: number, to: number, width: (i: number) => number) => {
    const left: string[] = [], right: string[] = [];
    for (let i = from; i <= to; i++) {
      const w = width(i), p = pts[i], nrm = normals[i];
      left.push(`${(p.x + nrm.x * w).toFixed(1)} ${(p.y + nrm.y * w).toFixed(1)}`);
      right.push(`${(p.x - nrm.x * w).toFixed(1)} ${(p.y - nrm.y * w).toFixed(1)}`);
    }
    return `M${left.join('L')}L${right.reverse().join('L')}Z`;
  };
  const bounds = [0];
  for (let k = 1; k < RIBBON_CHUNKS; k++) {
    let i = bounds[k - 1] + 1;
    while (i < m - 1 && pts[i].u < k / RIBBON_CHUNKS) i++;
    bounds.push(Math.min(i, m - 1));
  }
  bounds.push(m - 1);
  const chunks: RibbonChunk[] = [];
  for (let k = 0; k < RIBBON_CHUNKS; k++) {
    const a = Math.max(0, bounds[k] - (k ? 1 : 0)), b = bounds[k + 1];
    if (b <= a) continue;
    const dir = `${pts[b].y >= pts[a].y ? 's' : 'n'}${pts[b].x >= pts[a].x ? 'e' : 'w'}` as RibbonDir;
    chunks.push({ edge: outline(a, b, (i) => pts[i].half), fill: outline(a, b, (i) => pts[i].fill), k, dir, u0: pts[a].u, u1: pts[b].u });
  }
  let end = 0;
  while (end < m - 1 && pts[end + 1].u < 0.6) end++;
  const highlight = end >= 1 ? outline(0, end, (i) => pts[i].fill * 0.3 * (1 - pts[i].u / 0.6)) : '';
  return { chunks: chunks.reverse(), highlight };
}

function hash(n: number) {
  let s = (n * 0x9e3779b1) >>> 0;
  s ^= s >>> 15; s = Math.imul(s, 0x85ebca6b) >>> 0;
  s ^= s >>> 13; s = Math.imul(s, 0xc2b2ae35) >>> 0;
  s ^= s >>> 16;
  return (s >>> 0) / 4294967296;
}
export const GLITTER_COLORS = ['#ffd23f', '#ff8fc8', '#b995ff', '#7fe0ff', '#ffffff'] as const;
export type Glitter = { id: number; x: number; y: number; size: number; color: string; opacity: number; turn: number };
export const GLITTER_RATE = 30;
export const GLITTER_LIFE = 0.8;
const BLING_PIECES = 14;
const BLING_LIFE = 0.55;

/** Glitter per second: halved on a big table (over 20 cells), where the room is already busy. */
export const glitterRate = (L: FairyLayout) => (L.covers.length > 20 ? GLITTER_RATE / 2 : GLITTER_RATE);
/** Each glitter piece's birth point and launch velocity, cached per layout (pure, and reused by every frame it lives). */
const glitterCache = new WeakMap<FairyLayout, Map<number, { x: number; y: number; vx: number; vy: number } | null>>();
function glitterBirth(n: number, rate: number, L: FairyLayout) {
  let cache = glitterCache.get(L);
  if (!cache) glitterCache.set(L, cache = new Map());
  let birth = cache.get(n);
  if (birth === undefined) {
    const born = n / rate;
    const s = L.W / 288;
    // Emitted only while the ribbon is out (at least half its length).
    if (born < FAIRY.entrance[0] || ribbonSpan(born, L) < 0.5 * RIBBON_SPAN) birth = null;
    else {
      const a = fairyStarPoint(born, L), b = fairyStarPoint(born - 0.02, L);
      birth = { x: a.x, y: a.y, vx: -0.25 * (a.x - b.x) / 0.02 + (hash(n) - 0.5) * 80 * s, vy: -0.25 * (a.y - b.y) / 0.02 - 30 * s + (hash(n + 7) - 0.5) * 60 * s };
    }
    cache.set(n, birth);
  }
  return birth;
}

/**
 * Seeded glitter: a pure function of time, with no simulation state. Each piece twinkles, then shrinks away
 * (a pop, never a see-through fade), so the particles can be drawn batched by colour.
 */
export function fairyGlitter(t: number, L: FairyLayout): Glitter[] {
  const out: Glitter[] = [];
  const s = L.W / 288;
  const rate = glitterRate(L);
  for (let n = Math.floor((t - GLITTER_LIFE) * rate); n <= Math.floor(t * rate); n++) {
    const born = n / rate;
    const age = t - born;
    // Particles near the end live only until glitterEnd, so nothing outlasts the reveal.
    const span = Math.min(GLITTER_LIFE, FAIRY.glitterEnd - born);
    if (born < FAIRY.entrance[0] || age < 0 || span <= 0 || age >= span) continue;
    const birth = glitterBirth(n, rate, L);
    if (!birth) continue;
    const shrink = age < span * 0.55 ? 1 : 1 - smooth((age - span * 0.55) / (span * 0.45));
    out.push({
      id: n, x: birth.x + birth.vx * age, y: birth.y + birth.vy * age + 110 * s * age * age,
      size: (4 + 6 * hash(n + 3)) * s * (0.5 + 0.5 * Math.abs(Math.sin(14 * age + hash(n + 5) * 6))) * shrink,
      color: GLITTER_COLORS[Math.floor(hash(n + 11) * 5)], opacity: 1, turn: 90 * age + 360 * hash(n + 13),
    });
  }
  // The BLING burst: a ring of glitter thrown out from the re-lit star.
  const age = t - FAIRY.bling;
  if (age >= 0 && age < BLING_LIFE) {
    const c = fairyStarPoint(FAIRY.bling, L);
    for (let i = 0; i < BLING_PIECES; i++) {
      const angle = (i / BLING_PIECES) * TAU + hash(900 + i) * 0.3;
      const speed = (260 + 180 * hash(920 + i)) * s;
      const travel = speed * (1 - (1 - Math.min(1, age / BLING_LIFE)) ** 2) * 0.4;
      out.push({
        id: -1 - i, x: c.x + Math.cos(angle) * travel, y: c.y + Math.sin(angle) * travel + 90 * s * age * age,
        size: (6 + 5 * hash(940 + i)) * s * (1 - smooth(progress(age, 0.28, BLING_LIFE))), color: GLITTER_COLORS[i % 5], opacity: 1, turn: 200 * age + 45 * i,
      });
    }
  }
  return out;
}

/** When each column's burst plays: a short window after its tap. */
export const TAP_BURST_S = 0.32;
/** The BLING rays fade out by bling + this, the shockwave rings by bling + BLING_RING_S. */
export const BLING_RAYS_S = 0.26;
export const BLING_RING_S = 0.34;
