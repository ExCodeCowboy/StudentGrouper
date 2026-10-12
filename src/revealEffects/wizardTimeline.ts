/**
 * Wizard owl · Magic letters: the whole choreography as pure math.
 *
 * The Stage, every card cover and the tests read these same numbers, so the
 * owl is overhead when each letter launches, the wand touches the stubborn
 * seal exactly at the boop, and every cover is gone before the reveal ends.
 * No DOM, CSS or React imports: tests import this module directly.
 */
import { clamp01, easeInCubic, easeOutBack, easeOutCubic, mix, progress, seededRandom, smooth } from './sceneMotion';

export const WIZARD_DURATION_MS = 7200;
/** The app header (~66 px) and footer controls (~67 px) sit above the Stage. */
export const WIZARD_HEADER_SAFE = 70;
export const WIZARD_FOOTER_SAFE = 80;

const B_SWIRL_START = 2.96;
const B_SWIRL_END = 3.98;
/** Swirl parameter rate (du/dτ) at the start and end of the swirl: a brisk entry and a brake into the wind-up. */
const SWIRL_RATE_IN = 1.2;
const SWIRL_RATE_OUT = 0.45;

/** Swirl parameter reached by time t (a monotonic cubic Hermite in τ). */
export function swirlParam(time: number) {
  const tau = Math.max(0, Math.min(1, (time - B_SWIRL_START) / (B_SWIRL_END - B_SWIRL_START)));
  const t2 = tau * tau, t3 = t2 * tau;
  return SWIRL_RATE_IN * (t3 - 2 * t2 + tau) + (-2 * t3 + 3 * t2) + SWIRL_RATE_OUT * (t3 - t2);
}

/** Swirl parameter speed du/dt (per second). */
export function swirlParamRate(time: number) {
  const tau = Math.max(0, Math.min(1, (time - B_SWIRL_START) / (B_SWIRL_END - B_SWIRL_START)));
  return (SWIRL_RATE_IN * (3 * tau * tau - 4 * tau + 1) + (-6 * tau * tau + 6 * tau) + SWIRL_RATE_OUT * (3 * tau * tau - 2 * tau)) / (B_SWIRL_END - B_SWIRL_START);
}

/** When the owl tops a swirl curl (the chant words pop there). Layout-independent. */
function curlTime(u: number) {
  let lo = B_SWIRL_START, hi = B_SWIRL_END;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (swirlParam(mid) < u) lo = mid; else hi = mid; }
  return Math.round((lo + hi) / 2 * 1000) / 1000;
}

/** Story beats, in seconds. They do not depend on the layout, so the sound track can sync to them. */
export const WIZARD_BEATS = {
  /** Nightfall: the night curtain wipes down from 0.05; each card's "?" swells and spins away (0.10–0.40), then night irises open from the card centre (0.34–0.64). */
  nightIn: 0.05, qSpin: 0.1, irisStart: 0.34, owlIn: 0.62, nightFull: 0.64,
  passStart: 0.7, passEnd: 1.95,
  launchLead: 0.05, flight: 0.38,
  uTurn: 2.18, glideStart: 2.42, glideEnd: 2.72,
  swirlStart: B_SWIRL_START, swirlEnd: B_SWIRL_END,
  /** The chant: "Arcanum…" and "…stellae…" pop as the owl tops each loop, and leave together at 4.10. */
  chant1: curlTime(1 / 4.5), chant2: curlTime(3 / 4.5), wandOut: 3.7, chantOut: 4.1,
  /**
   * Tap at T; the owl hovers there watching the star squash (4.34) and burst (4.42), then the
   * shockwave knocks it back to the perch G (4.44–4.62), so the poof (4.68) has a cause.
   * "APERIO!" pops with the star (4.20) and leaves at 4.62.
   */
  tap: 4.15, starIn: 4.2, starSquash: 4.34, burst: 4.42, perchStart: 4.44, spellOut: 4.62, perch: 4.62,
  popBase: 4.62, popSpreadX: 0.26, popSpreadY: 0.12,
  /** Lights on: the gutter candles are snuffed (5.00), then the night curtain rises (5.10–5.30) as the last blooms peak. */
  poof: 4.68, hatLands: 5.02, fizz: 4.9, giggle: 5.12, candlesOut: 5, veilOut: 5.1, veilGone: 5.3,
  /**
   * The stubborn letter refuses without a word: a little gold padlock pops onto its seal (4.96), its shackle
   * clicks shut (5.02) and the envelope shakes "no" (4.90–5.35). At the boop the shackle springs open and the
   * padlock pops away (6.00–6.16) while the owl's command "Aperi!" holds long enough to read (5.97–6.60).
   */
  lockOn: 4.96, lockShut: 5.02, lockOff: 6.16,
  look: 5.4, hop: 5.48, dip: 5.9, boop: 6, commandIn: 5.97, commandOut: 6.6, recoil: 6.12, wink: 6.1,
  exit: 6.28, exitEnd: 6.98, lastLetter: 7.05,
} as const;
const B = WIZARD_BEATS;

/**
 * The gutter night is never a half-transparent wash: it comes in as an opaque curtain wiping down
 * from the top (0.05–0.43 s) and, for "lights on", rises back up from the bottom (5.10–5.30 s).
 * Both are pure transforms (a clip box and its counter-moving content). Easings match wizard.css.
 */
export const VEIL_WIPE = { in: B.nightIn, inEnd: 0.43, out: B.veilOut, outEnd: B.veilGone } as const;
/** How far down (fraction of the screen height) the night curtain has come at time t. */
export function veilWipeAt(time: number) {
  return VEIL_IN_EASE(clamp01((time - VEIL_WIPE.in) / (VEIL_WIPE.inEnd - VEIL_WIPE.in)));
}
/** When the falling night reaches height y (viewport px): candles and twinkles appear only once it is dark behind them. */
export function veilArrival(y: number, H: number) {
  const target = clamp01(y / Math.max(1, H));
  let lo: number = VEIL_WIPE.in, hi: number = VEIL_WIPE.inEnd;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (veilWipeAt(mid) < target) lo = mid; else hi = mid; }
  return hi;
}
const PASS_FROM = -0.12;
const PASS_TO = 0.97;
const DEG = Math.PI / 180;

export type Point = { x: number; y: number };
export type WizardViewport = { width: number; height: number };
/** A floating candle (x, y is its wick); `in` is when it pops up, once the night is behind it, and `out` when it is snuffed (early if it hovers over a card that pops). */
export type CandleSlot = { x: number; y: number; in: number; out: number };
export type WizardRect = { left: number; top: number; width: number; height: number; radius?: number };

// ---------------------------------------------------------------------------
// Time-keyed cubic Hermite (C1 in time). Interior keys without `v` use a
// central difference; endpoints without `v` are at rest.
export type HermiteKey = { t: number; x: number; y: number; v?: Point };

export function hermitePath(time: number, keys: readonly HermiteKey[]): Point {
  const n = keys.length;
  if (time <= keys[0].t) return { x: keys[0].x, y: keys[0].y };
  for (let i = 1; i < n; i++) {
    if (time > keys[i].t) continue;
    const a = keys[i - 1], b = keys[i];
    const va = keyVelocity(keys, i - 1), vb = keyVelocity(keys, i);
    const h = b.t - a.t, s = (time - a.t) / h;
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    return { x: h00 * a.x + h10 * h * va.x + h01 * b.x + h11 * h * vb.x, y: h00 * a.y + h10 * h * va.y + h01 * b.y + h11 * h * vb.y };
  }
  return { x: keys[n - 1].x, y: keys[n - 1].y };
}

function keyVelocity(keys: readonly HermiteKey[], i: number): Point {
  const key = keys[i];
  if (key.v) return key.v;
  if (i === 0 || i === keys.length - 1) return { x: 0, y: 0 };
  const a = keys[i - 1], b = keys[i + 1];
  return { x: (b.x - a.x) / (b.t - a.t), y: (b.y - a.y) / (b.t - a.t) };
}

// ---------------------------------------------------------------------------
// Owl rig, in art units: the body is 100 units wide with its centre at (0,0).

export const OWL_RIG = {
  shoulder: { x: 40, y: -5 },
  /** Hand position in wing-local units (right wing; the left wing is mirrored). */
  hand: { x: 62, y: 8 },
  wandLength: 58,
  satchel: { x: 32, y: 30 },
  hatPivot: { x: 0, y: -56 },
  hatTip: -114,
  feet: 61,
  /** Free wing reach (shoulder + wing length), used to keep the flapping wing on screen. */
  wingReach: 124,
} as const;

/** For the tap the owl holds its wand in the wing nearest the gold star (its left, the viewer's left). */
export const WAND_WING = -1 as const;
/** Wand angles (body frame, degrees, as held in the left wing) at the boop, and that wing's angle. */
export const BOOP_WING = -15;
export const BOOP_ANGLE_ABOVE = 80;
export const BOOP_ANGLE_SIDE = 162;
/** Reaching up from below (up and out, past the shoulder): for seals over the empty lower half of tall cards. */
export const BOOP_ANGLE_BELOW = 245;

/** A hand's position in body units. side = -1 is the viewer's left wing. */
export function owlHand(side: -1 | 1, wing: number): Point {
  const c = Math.cos(wing * DEG), s = Math.sin(wing * DEG);
  const lx = OWL_RIG.hand.x * c - OWL_RIG.hand.y * s;
  const ly = OWL_RIG.hand.x * s + OWL_RIG.hand.y * c;
  return { x: side * (OWL_RIG.shoulder.x + lx), y: OWL_RIG.shoulder.y + ly };
}

/**
 * Wand tip in body units for a wing angle and wand angle. Angles are given as if the
 * wand were in the left wing; in the right wing (side = 1) the whole wand is mirrored.
 */
export function wandTipLocal(wing: number, angle: number, length = 1, side: -1 | 1 = WAND_WING): Point {
  const hand = owlHand(side, wing);
  return { x: hand.x - side * OWL_RIG.wandLength * length * Math.cos(angle * DEG), y: hand.y + OWL_RIG.wandLength * length * Math.sin(angle * DEG) };
}

/** Wand-tip offset from the owl centre at the boop (left wing), in units of S. The right wing mirrors x. */
export const BOOP_TIP_ABOVE = scalePoint(wandTipLocal(BOOP_WING, BOOP_ANGLE_ABOVE), 0.01);
export const BOOP_TIP_SIDE = scalePoint(wandTipLocal(BOOP_WING, BOOP_ANGLE_SIDE), 0.01);
export const BOOP_TIP_BELOW = scalePoint(wandTipLocal(BOOP_WING, BOOP_ANGLE_BELOW), 0.01);
const BOOP_POSES = {
  above: { tip: BOOP_TIP_ABOVE, angle: BOOP_ANGLE_ABOVE, bias: 0 },
  below: { tip: BOOP_TIP_BELOW, angle: BOOP_ANGLE_BELOW, bias: 0.08 },
  side: { tip: BOOP_TIP_SIDE, angle: BOOP_ANGLE_SIDE, bias: 0.15 },
} as const;

function scalePoint(point: Point, factor: number): Point { return { x: point.x * factor, y: point.y * factor }; }

// ---------------------------------------------------------------------------
// Layout

export type WizardCard = {
  /** Left-to-right order (by centre x, then top), matching --reveal-index. */
  index: number;
  /** Position of this rect in the caller's input array. */
  source: number;
  left: number; top: number; width: number; height: number; radius: number;
  centerX: number; centerY: number;
  /** Centre as viewport fractions (the same values as --reveal-center-x/y). */
  cx: number; cy: number;
  /** Fraction of the card inside the band between the header and the footer. */
  visible: number;
  /** The envelope is on screen: it gets a Stage flight, a spark and a letter. */
  shown: boolean;
  envW: number; envH: number; seal: number;
  sealX: number; sealY: number;
  pass: number; launch: number; land: number;
  /** When the spark arrives: the pop, or the fizzle on the stubborn card. */
  spark: number;
  fizz: number; pop: number;
  stuck: boolean; boost: number;
};

export type BoopPose = 'above' | 'below' | 'side';
/** How the owl reaches a seal: its centre, the pose, which wing holds the wand, and how much revealed text it hides. */
export type BoopPlan = { owl: Point; pose: BoopPose; side: -1 | 1; angle: number; clamped: boolean; cost: number };
export type WizardBoop = BoopPlan & { card: number; seal: Point };

export type WizardLayout = {
  W: number; H: number; m: number; S: number;
  safeTop: number; safeBottom: number; lane: number;
  R: number; Yc: number; span: number; x0: number;
  star: { x: number; y: number; r: number };
  cards: WizardCard[];
  /** Index (left-to-right) of the stubborn card, or -1 when no card is visible. */
  stuck: number;
  boop: WizardBoop | null;
  swirl: SwirlTable;
  path: {
    passSpeed: number;
    glide: HermiteKey[];
    windUp: HermiteKey[];
    /** Where the owl taps (just past the last loop), and the perch the shockwave knocks it to for the poof and giggle. */
    T: Point;
    /** Horizontal direction of the knock-back (away from the star). */
    knockSide: -1 | 1;
    G: Point;
    hop: HermiteKey[];
    pre: Point; O: Point; recoil: Point;
    exit: HermiteKey[];
    exitSide: -1 | 1;
    /** Wand angle (body frame) that points from the hand at T to the gold star. */
    aim: number;
    /** Horizontal direction from G to the stubborn card (for the look and the lean). */
    lookSide: -1 | 1;
  };
  candles: { width: number; slots: CandleSlot[] };
  twinkles: { x: number; y: number; size: number; delay: number; in: number }[];
  /**
   * Where each spoken word pops: the chant over the loop tops, "APERIO!" over the star, and the command
   * "Aperi!" (as big as "APERIO!", held 5.97–6.60) near the stubborn seal, clear of names and the owl.
   */
  words: { chant1: Point; chant2: Point; spell: Point; size: number; bigSize: number; command: Point | null; commandRot: number };
  /** The stubborn letter's padlock (null when there is no stubborn letter on screen). */
  lock: LockPlan | null;
};

/**
 * The padlock on the stubborn seal. It hangs off the envelope's shake pivot (the envelope's 50% 60%
 * point, where .wz-chant turns), so it shakes "no" with the envelope; `dy` puts its body on the seal.
 * `size` is the body width in px (the shackle adds 0.55 of that above it).
 */
export type LockPlan = { x: number; y: number; dy: number; size: number };

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

// ---------------------------------------------------------------------------
// Staging: keep the owl off the words the children are reading.

export type Box = { l: number; r: number; t: number; b: number };
export type Zone = { box: Box; w: number };
const overlapArea = (a: Box, b: Box) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
const overlaps = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const boxAround = (p: Point, halfW: number, halfH: number): Box => ({ l: p.x - halfW, r: p.x + halfW, t: p.y - halfH, b: p.y + halfH });

type CardShape = Pick<WizardCard, 'index' | 'left' | 'top' | 'width' | 'height' | 'visible'>;

/**
 * Where the words the children read are. A card's team header and names run down its top-left
 * (a header and about six name rows: 0.26 m wide, 0.4 m tall), so that region counts fully and
 * the rest of the card a little. On the Today table (wide cells in a grid) the team names sit in
 * a column left of the first round and the round titles in a row above the first cell row.
 */
export function readingZones(cards: readonly CardShape[], m: number, except: number): Zone[] {
  const zones: Zone[] = [];
  for (const card of cards) {
    if (card.index === except || card.visible <= 0) continue;
    zones.push({ box: namesBox(card, m), w: 1 });
    zones.push({ box: { l: card.left, r: card.left + card.width, t: card.top, b: card.top + card.height }, w: 0.2 });
  }
  return [...zones, ...tableZones(cards, except)];
}

/** Where a card's team header and names are (its top-left: a header and about six name rows). */
export function namesBox(card: Pick<CardShape, 'left' | 'top' | 'width' | 'height'>, m: number): Box {
  return { l: card.left, r: card.left + Math.min(card.width, 0.26 * m), t: card.top, b: card.top + Math.min(card.height, Math.max(0.4 * m, 0.3 * card.height)) };
}

/** The words that belong to the whole screen rather than one card: a lone card's centred name, the Today table's team column and round titles. */
export function tableZones(cards: readonly CardShape[], except: number): Zone[] {
  const zones: Zone[] = [];
  const shown = cards.filter((card) => card.visible > 0);
  // A lone big card (the student picker, or one group) may centre its words: count its middle too.
  if (shown.length === 1 && shown[0].index !== except) {
    const card = shown[0];
    zones.push({ box: { l: card.left + 0.2 * card.width, r: card.left + 0.8 * card.width, t: card.top + 0.2 * card.height, b: card.top + 0.8 * card.height }, w: 1 });
  }
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
  const cellW = median(shown.map((card) => card.width)), cellH = median(shown.map((card) => card.height));
  if (shown.length >= 4 && cellH > 0 && cellW / cellH > 1.9) {
    const left = Math.min(...shown.map((card) => card.left)), right = Math.max(...shown.map((card) => card.left + card.width));
    const top = Math.min(...shown.map((card) => card.top)), bottom = Math.max(...shown.map((card) => card.top + card.height));
    zones.push({ box: { l: Math.max(0, left - 1.1 * cellW), r: left, t: top, b: bottom }, w: 1 });
    zones.push({ box: { l: Math.max(0, left - 1.1 * cellW), r: right, t: top - 0.7 * cellH, b: top }, w: 0.5 });
  }
  return zones;
}

/** The middle of a card's team header and name column (its top-left, see readingZones). */
export function namesCenter(card: Pick<CardShape, 'left' | 'top' | 'width' | 'height'>, m: number): Point {
  const box = namesBox(card, m);
  return { x: (box.l + box.r) / 2, y: (box.t + box.b) / 2 };
}

/** The owl's silhouette as boxes in viewport px: body, hat and the spread wing(s) on the given sides. */
export function owlBoxes(p: Point, S: number, wings: readonly (-1 | 1)[]): Box[] {
  const boxes: Box[] = [
    { l: p.x - 0.55 * S, r: p.x + 0.55 * S, t: p.y - 0.65 * S, b: p.y + 0.65 * S },
    { l: p.x - 0.4 * S, r: p.x + 0.35 * S, t: p.y - 1.15 * S, b: p.y - 0.65 * S },
  ];
  for (const side of wings) boxes.push({ l: side < 0 ? p.x - 1.24 * S : p.x + 0.55 * S, r: side < 0 ? p.x - 0.55 * S : p.x + 1.24 * S, t: p.y - 0.6 * S, b: p.y + 0.4 * S });
  return boxes;
}

/** How much of the zones the boxes hide (weighted, in units of S²). */
export function hiddenCost(boxes: readonly Box[], zones: readonly Zone[], S: number) {
  let cost = 0;
  for (const box of boxes) for (const zone of zones) cost += overlapArea(box, zone.box) * zone.w;
  return cost / (S * S);
}

export function envelopeSize(width: number, height: number, viewportWidth: number) {
  const envW = Math.max(24, Math.min(0.84 * width, 1.24 * height, clamp(0.36 * viewportWidth, 300, 640)));
  const envH = envW / 1.55;
  return { envW, envH, seal: 0.4 * envH };
}

/** When the owl passes directly over a card's centre (cx = centre x as a viewport fraction). */
export function passTime(cx: number) {
  return B.passStart + (B.passEnd - B.passStart) * (cx - PASS_FROM) / (PASS_TO - PASS_FROM);
}

/** Centre-out ripple from the gold star: 4.62 s in the middle to 5.00 s at the corners. */
export function popTime(cx: number, cy: number) {
  return B.popBase + B.popSpreadX * Math.min(1, 2 * Math.abs(cx - 0.5)) + B.popSpreadY * Math.min(1, 2 * Math.abs(cy - 0.44));
}

export function visibleFraction(rect: WizardRect, W: number, H: number) {
  const x = Math.max(0, Math.min(rect.left + rect.width, W) - Math.max(rect.left, 0));
  const y = Math.max(0, Math.min(rect.top + rect.height, H - WIZARD_FOOTER_SAFE) - Math.max(rect.top, WIZARD_HEADER_SAFE));
  return rect.width > 0 && rect.height > 0 ? (x * y) / (rect.width * rect.height) : 0;
}

type Metrics = { W: number; H: number; S: number; safeTop: number; safeBottom: number };

/**
 * Every clean way the owl can touch this seal with its wand: from above or beside, with the
 * wand in either wing (the owl hovers on the far side from that wing). Only poses that keep the
 * owl in the safe band, its free wing on screen and its body clear of the edge count. Sorted by
 * how much revealed text the body, hat and free wing would hide (`zones`), preferring the
 * classic above/left-wing pose on ties.
 */
export function boopOptions(seal: Point, metrics: Metrics, zones: readonly Zone[] = []): BoopPlan[] {
  const { W, S, safeTop, safeBottom } = metrics;
  const options: BoopPlan[] = [];
  for (const pose of ['above', 'below', 'side'] as const) {
    for (const side of [-1, 1] as const) {
      const { tip, angle, bias } = BOOP_POSES[pose];
      const owl = { x: seal.x + side * tip.x * S, y: seal.y - tip.y * S };
      if (owl.y < safeTop || owl.y > safeBottom) continue;
      const freeWing = owl.x - side * 1.1 * S, bodyEdge = owl.x + side * 0.6 * S;
      if (freeWing < 0 || freeWing > W || bodyEdge < 0.02 * W || bodyEdge > 0.98 * W) continue;
      const cost = hiddenCost(owlBoxes(owl, S, [side < 0 ? 1 : -1]), zones, S) + bias + (side > 0 ? 0.03 : 0);
      options.push({ owl, pose, side, angle, clamped: false, cost });
    }
  }
  return options.sort((a, b) => a.cost - b.cost);
}

/** The best boop pose for a seal; if nothing reaches cleanly, the left-wing pose clamped into the safe band (a spark hops the gap). */
export function boopFor(seal: Point, metrics: Metrics, zones: readonly Zone[] = []): BoopPlan {
  const best = boopOptions(seal, metrics, zones)[0];
  if (best) return best;
  const { S, safeTop, safeBottom } = metrics;
  let owl = { x: seal.x - BOOP_TIP_ABOVE.x * S, y: seal.y - BOOP_TIP_ABOVE.y * S };
  let pose: BoopPose = 'above';
  if (owl.y < safeTop) { owl = { x: seal.x - BOOP_TIP_SIDE.x * S, y: seal.y - BOOP_TIP_SIDE.y * S }; pose = 'side'; }
  const clamped = owl.y < safeTop || owl.y > safeBottom;
  if (clamped) owl = { x: owl.x, y: clamp(owl.y, safeTop, safeBottom) };
  return { owl, pose, side: -1, angle: pose === 'above' ? BOOP_ANGLE_ABOVE : BOOP_ANGLE_SIDE, clamped, cost: Number.POSITIVE_INFINITY };
}

/** The owl can hover beside this seal (from either side) with its whole body and free wing on screen. */
export function boopable(seal: Point, metrics: Metrics) {
  return boopOptions(seal, metrics).length > 0;
}

type StuckCandidate = CardShape & Pick<WizardCard, 'centerX' | 'centerY' | 'sealX' | 'sealY'>;

/**
 * The stubborn card: well visible and boopable. Among those, the one whose best boop pose
 * hides the least of the other (already revealed) cards' words, leaning towards the rightmost
 * column (the owl finishes its spell on the right), a short hop from the tap point T and the
 * row nearest mid-screen; ties go to the lowest index. -1 when nothing is visible.
 */
export function pickStuck(cards: readonly StuckCandidate[], metrics: Metrics & { m: number; T?: Point }) {
  let pool = cards.filter((card) => card.visible >= 0.7 && boopable({ x: card.sealX, y: card.sealY }, metrics));
  const reachable = pool.length > 0;
  if (!pool.length) pool = cards.filter((card) => card.visible >= 0.7);
  if (!pool.length) pool = cards.filter((card) => card.visible > 0).sort((a, b) => b.visible - a.visible).slice(0, 1);
  if (!pool.length) return -1;
  const maxX = Math.max(...pool.map((card) => card.centerX));
  // Every card's names count, the stubborn card's own too: they appear the moment it is booped.
  const zones = readingZones(cards, metrics.m, -1);
  let best = -1, bestScore = Number.POSITIVE_INFINITY;
  for (const card of [...pool].sort((a, b) => a.index - b.index)) {
    const boop = reachable ? boopOptions({ x: card.sealX, y: card.sealY }, metrics, zones)[0] : null;
    const hop = boop && metrics.T ? Math.hypot(boop.owl.x - metrics.T.x, boop.owl.y - metrics.T.y) / metrics.W : 0;
    const score = (boop?.cost ?? 0) + 0.5 * hop + 1.2 * (maxX - card.centerX) / metrics.W + 0.4 * Math.abs(card.centerY - 0.5 * metrics.H) / metrics.H;
    if (score < bestScore - 1e-9) { best = card.index; bestScore = score; }
  }
  return best;
}

/**
 * Where the owl perches for the poof and the giggle (4.62–5.48 s), while every other card
 * opens: the spot right of the star, within a short drift of the tap point T, that hides the
 * least of the revealed cards' words, the stubborn envelope (its padlock and head-shake must
 * show), the gold star and "APERIO!". Over the still-dark stubborn card or a gutter is ideal.
 */
export function perchPoint(T: Point, layout: Pick<WizardLayout, 'W' | 'H' | 'm' | 'S' | 'cards' | 'star' | 'safeTop' | 'safeBottom'> & { stuck: number; spell: Box; pre?: Point }): Point {
  const { W, H, m, S, star } = layout;
  const zones = readingZones(layout.cards, m, layout.stuck);
  const stuckCard = layout.cards.find((card) => card.index === layout.stuck);
  if (stuckCard) zones.push({ box: boxAround({ x: stuckCard.centerX, y: stuckCard.centerY }, stuckCard.envW / 2 + 4, stuckCard.envH / 2 + 4), w: 1.5 });
  zones.push({ box: layout.spell, w: 1 }, { box: boxAround(star, 1.15 * star.r, 1.15 * star.r), w: 2 });
  const reach = Math.max(2.4 * S, 0.22 * W);
  const cost = (p: Point) => hiddenCost(owlBoxes(p, S, [-1, 1]), zones, S) + 0.06 * Math.hypot(p.x - T.x, p.y - T.y) / S + (p.x + 1.2 * S > W ? 0.3 : 0);
  const atT = cost(T);
  const candidates: { p: Point; c: number }[] = [{ p: T, c: atT }];
  const xMin = star.x + 1.15 * star.r + 0.6 * S, xMax = W - 0.6 * S;
  const yMin = WIZARD_HEADER_SAFE + 1.7 * S, yMax = H - WIZARD_FOOTER_SAFE - 0.78 * S - 0.016 * H;
  for (let x = xMin; x <= xMax; x += 0.01 * W) {
    for (let y = yMin; y <= yMax; y += 0.01 * H) {
      if (Math.hypot(x - T.x, y - T.y) > reach) continue;
      const c = cost({ x, y });
      // Never a perch that hides more than staying at the tap point would.
      if (c <= atT + 1e-9) candidates.push({ p: { x, y }, c });
    }
  }
  candidates.sort((a, b) => a.c - b.c);
  if (!layout.pre) return candidates[0].p;
  // The hop from here to the stubborn seal (5.48–5.90) crosses the open cards too: of the best few perches, take the
  // one whose perch and hop together hide the least.
  const pre = layout.pre;
  const open = readingZones(layout.cards, m, layout.stuck);
  let best = candidates[0].p, bestCost = Number.POSITIVE_INFINITY;
  for (const { p, c } of candidates.slice(0, 40)) {
    const total = c + bestHop(hoverPoint(B.hop, p, H), pre, layout, open).cost;
    if (total < bestCost - 1e-9) { best = p; bestCost = total; }
  }
  return best;
}

/**
 * The hop from the perch to just short of the stubborn seal (5.48–5.90): over the top in an arc
 * (the classic), straight across, or swooping low, whichever crosses the fewest open names. Its
 * middle key stays inside the safe band, so the owl never touches the header or the footer.
 */
export function bestHop(from: Point, to: Point, metrics: Pick<WizardLayout, 'H' | 'S' | 'safeTop' | 'safeBottom'>, open: readonly Zone[]) {
  const { H, S, safeTop, safeBottom } = metrics;
  const midX = (from.x + to.x) / 2;
  const band = (y: number) => clamp(y, safeTop + 0.01 * H, Math.max(safeTop + 0.01 * H, safeBottom - 0.01 * H));
  const variants = [
    { y: band(Math.min(from.y, to.y) - 0.05 * H), bias: 0 },
    { y: band((from.y + to.y) / 2), bias: 0.05 },
    { y: band(Math.max(from.y, to.y) + 0.05 * H), bias: 0.08 },
  ];
  let best: { keys: HermiteKey[]; cost: number } | null = null;
  for (const variant of variants) {
    const keys: HermiteKey[] = [{ t: B.hop, ...from }, { t: (B.hop + B.dip) / 2, x: midX, y: variant.y }, { t: B.dip, ...to }];
    let cost = variant.bias;
    for (let i = 1; i <= 8; i++) cost += hiddenCost(owlBoxes(hermitePath(B.hop + (B.dip - B.hop) * i / 9, keys), S, [-1, 1]), open, S) * 0.05;
    if (!best || cost < best.cost - 1e-9) best = { keys, cost };
  }
  return best!;
}

/**
 * The owl's incantation. Real Latin, read aloud like a proper spell ("secret of the
 * star… I open!", then "Open!" to the stubborn letter) — the class dislikes baby talk.
 * The stubborn letter answers without words (a padlock and a head-shake "no").
 */
export const WIZARD_WORDS = { chant1: 'Arcanum…', chant2: '…stellae…', spell: 'APERIO!', command: 'Aperi!' } as const;

/** A word's box (it is drawn bold and rounded: about 0.66 em per character). */
export function wordBox(p: Point, size: number, chars: number, pad = 0): Box {
  return boxAround(p, size * chars * 0.33 + pad, size * 0.7 + pad);
}

/**
 * Nudge a chant word off the envelopes: first straight up (never above the header), then
 * sideways. Where envelopes leave no gap (a full grid of big cards), it goes wherever it
 * overlaps them least, preferring higher (it is drawn above them, with a dark outline).
 */
export function clearOfEnvelopes(spot: Point, size: number, chars: number, envelopes: readonly Box[], W: number): Point {
  const covered = (p: Point) => envelopes.reduce((sum, env) => sum + overlapArea(wordBox(p, size, chars), env), 0);
  if (!covered(spot)) return spot;
  const minY = WIZARD_HEADER_SAFE + 0.75 * size;
  for (let y = spot.y; y >= minY; y -= 2) if (!covered({ x: spot.x, y })) return { x: spot.x, y };
  let best = spot, bestArea = covered(spot);
  for (let dx = 0.02 * W; dx <= 0.16 * W + 1e-9; dx += 0.02 * W) {
    for (const side of [-1, 1]) {
      const p = { x: spot.x + side * dx, y: spot.y };
      if (p.x < 0.08 * W || p.x > 0.92 * W) continue;
      if (!covered(p)) return p;
    }
  }
  for (let y = spot.y; y >= minY - 1e-9; y -= 2) {
    const area = covered({ x: spot.x, y });
    if (area < bestArea - 1e-6) { best = { x: spot.x, y }; bestArea = area; }
  }
  return best;
}

// Swirl: a prolate cycloid, x = xs + k(θ - π) - R sin θ, y = Yc - R cos θ, for θ from π to 5.5π.
// The owl enters at the bottom of an arc heading right (upright), flips over the top
// of two curls ("Arcanum…", "…stellae…") and ends on the right side heading up. Time
// runs evenly in θ, so it slows over each curl top like a real loop and whooshes
// along the bottoms; the owl's rotation follows the path tangent.
const THETA_FROM = Math.PI;
const THETA_SPAN = 4.5 * Math.PI;
const SWIRL_SAMPLES = 720;
/** Swirl parameter (fraction of θ) at the top of each curl. */
export const SWIRL_CURLS = [1 / 4.5, 3 / 4.5] as const;

type SwirlTable = { x: Float64Array; y: Float64Array; rot: Float64Array; s: Float64Array; length: number; k: number; xs: number };

function buildSwirl(xs: number, k: number, R: number, Yc: number): SwirlTable {
  const n = SWIRL_SAMPLES + 1;
  const x = new Float64Array(n), y = new Float64Array(n), rot = new Float64Array(n), s = new Float64Array(n);
  let length = 0;
  for (let i = 0; i < n; i++) {
    const th = THETA_FROM + THETA_SPAN * i / SWIRL_SAMPLES;
    x[i] = xs + k * (th - THETA_FROM) - R * Math.sin(th);
    y[i] = Yc - R * Math.cos(th);
    const heading = Math.atan2(R * Math.sin(th), k - R * Math.cos(th)) / DEG;
    // Unwrap so the rotation turns continuously through every curl.
    rot[i] = i ? rot[i - 1] + ((heading - rot[i - 1]) % 360 + 540) % 360 - 180 : heading;
    if (i) length += Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
    s[i] = length;
  }
  return { x, y, rot, s, length, k, xs };
}

function sampleAt(u: number) {
  const f = clamp01(u) * SWIRL_SAMPLES;
  const i = Math.min(SWIRL_SAMPLES - 1, Math.floor(f));
  return { i, k: f - i };
}

/** A point on the swirl at parameter u (0..1, even in θ). */
export function swirlAt(layout: Pick<WizardLayout, 'swirl'>, u: number): Point {
  const t = layout.swirl, { i, k } = sampleAt(u);
  return { x: mix(t.x[i], t.x[i + 1], k), y: mix(t.y[i], t.y[i + 1], k) };
}

/** The owl's rotation (degrees, unwrapped) at swirl parameter u: it follows the path tangent. */
export function swirlRot(layout: Pick<WizardLayout, 'swirl'>, u: number): number {
  const t = layout.swirl, { i, k } = sampleAt(u);
  return mix(t.rot[i], t.rot[i + 1], k);
}

/** Arc-length fraction of the swirl drawn at parameter u: the trail's head is exactly at the owl. */
export function swirlArcFraction(layout: Pick<WizardLayout, 'swirl'>, u: number): number {
  const t = layout.swirl, { i, k } = sampleAt(u);
  return mix(t.s[i], t.s[i + 1], k) / t.length;
}

/** A point at arc-length fraction `arc` (for the trail's evenly spaced polyline). */
export function swirlAtArc(layout: Pick<WizardLayout, 'swirl'>, arc: number): Point {
  const t = layout.swirl;
  const target = clamp01(arc) * t.length;
  let lo = 0, hi = SWIRL_SAMPLES;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t.s[mid] < target) lo = mid; else hi = mid; }
  const span = t.s[hi] - t.s[lo];
  const k = span > 1e-9 ? clamp01((target - t.s[lo]) / span) : 0;
  return { x: mix(t.x[lo], t.x[hi], k), y: mix(t.y[lo], t.y[hi], k) };
}

/** Polyline through the swirl at even arc spacing: the trail's static path. */
export function swirlPolyline(layout: Pick<WizardLayout, 'swirl'>, samples = 180): Point[] {
  return Array.from({ length: samples + 1 }, (_, i) => swirlAtArc(layout, i / samples));
}

export function wizardLayout(rects: readonly WizardRect[], viewport: WizardViewport): WizardLayout {
  const W = Math.max(1, viewport.width), H = Math.max(1, viewport.height);
  const m = Math.min(W, H);
  const S = clamp(0.15 * m, 92, 170);
  const safeTop = WIZARD_HEADER_SAFE + 1.15 * S;
  const safeBottom = Math.max(safeTop, H - WIZARD_FOOTER_SAFE - 0.65 * S);
  const lane = Math.max(0.22 * H, safeTop) + 0.012 * H;
  // Loop radius: big enough that each curl reads as a loop-the-loop around the owl.
  const R = 0.13 * m;
  const Yc = clamp(0.44 * H, safeTop + R, Math.max(safeTop + R, safeBottom - R));
  // About 0.4 W wide, centred on the star; the curls stay true loops (R > 1.5 k) on very wide screens.
  const k = Math.min((0.42 * W - R) / THETA_SPAN, R / 2.2);
  const span = THETA_SPAN * k + R;
  const x0 = 0.5 * W - span / 2;
  const metrics: Metrics = { W, H, S, safeTop, safeBottom };

  const order = rects.map((_, i) => i).sort((a, b) =>
    (rects[a].left + rects[a].width / 2) - (rects[b].left + rects[b].width / 2) || rects[a].top - rects[b].top);
  const base = order.map((source, index) => {
    const rect = rects[source];
    const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
    const { envW, envH, seal } = envelopeSize(rect.width, rect.height, W);
    const sealY = centerY + 0.04 * envH;
    const visible = visibleFraction(rect, W, H);
    const envTop = Math.max(centerY - envH / 2, WIZARD_HEADER_SAFE), envBottom = Math.min(centerY + envH / 2, H - WIZARD_FOOTER_SAFE);
    const envLeft = Math.max(centerX - envW / 2, 0), envRight = Math.min(centerX + envW / 2, W);
    const shown = envBottom - envTop >= 0.3 * envH && envRight - envLeft >= 0.3 * envW;
    return { index, source, left: rect.left, top: rect.top, width: rect.width, height: rect.height, radius: rect.radius ?? 0, centerX, centerY, cx: clamp01(centerX / W), cy: clamp01(centerY / H), visible, shown, envW, envH, seal, sealX: centerX, sealY };
  });
  const swirl = buildSwirl(x0, k, R, Yc);
  const partial = { W, H, m, S, safeTop, safeBottom, lane, R, Yc, span, x0, swirl };
  const F = swirlAt(partial, 1);
  // Pull up out of the last loop to tap at T, then drift to the perch G that hides the fewest names.
  const T = { x: F.x + 0.01 * W, y: Math.max(F.y - 0.08 * H, WIZARD_HEADER_SAFE + 1.7 * S) };
  const stuck = pickStuck(base, { ...metrics, m, T });
  const cards: WizardCard[] = base.map((card) => {
    const isStuck = card.index === stuck;
    const pass = passTime(card.cx);
    const pop = isStuck ? B.boop : popTime(card.cx, card.cy);
    const fizz = isStuck ? B.fizz : pop;
    return { ...card, pass, launch: pass - B.launchLead, land: pass - B.launchLead + B.flight, spark: fizz, fizz, pop, stuck: isStuck, boost: isStuck ? 1.4 : 1 };
  });


  // Delivery pass, then the U-turn and glide back into the top of the swirl.
  const passSpeed = (PASS_TO - PASS_FROM) * W / (B.passEnd - B.passStart);
  const passEnd = passPoint(B.passEnd, W, H, lane);
  const bobV = 0.012 * H * 2 * Math.PI / 0.52 * Math.cos(2 * Math.PI * (B.passEnd - B.passStart) / 0.52);
  const d = 0.002;
  const velocityAt = (u: number, rate: number) => {
    const a = swirlAt(partial, Math.max(0, u - d)), b = swirlAt(partial, Math.min(1, u + d));
    const du = Math.min(1, u + d) - Math.max(0, u - d);
    return { x: (b.x - a.x) / du * rate, y: (b.y - a.y) / du * rate };
  };
  const s0 = swirlAt(partial, 0);
  const swirlStartV = velocityAt(0, swirlParamRate(B.swirlStart));
  const top = (y: number) => Math.max(safeTop + 0.02 * H, y);
  // Glide back left along the top band, then swoop down and hook right into the bottom of the swirl.
  const glide: HermiteKey[] = [
    { t: B.passEnd, ...passEnd, v: { x: passSpeed, y: bobV } },
    { t: B.uTurn, x: 1.04 * W, y: top(lane - 0.06 * H) },
    { t: B.glideStart, x: 0.84 * W, y: top(lane - 0.05 * H) },
    { t: B.glideEnd, x: Math.max(s0.x + 0.12 * W, 0.5 * W), y: top(lane) + 0.04 * H },
    { t: B.swirlStart, ...s0, v: swirlStartV },
  ];
  const endV = velocityAt(1, swirlParamRate(B.swirlEnd));
  const windUp: HermiteKey[] = [{ t: B.swirlEnd, ...F, v: endV }, { t: B.tap, ...T }];
  const wordSize = clamp(0.044 * m, 26, 56), bigSize = clamp(0.06 * m, 32, 76);
  const spell = { x: 0.5 * W, y: Math.max(WIZARD_HEADER_SAFE + 0.75 * bigSize, Yc - R - 0.085 * H) };
  const star = { x: 0.5 * W, y: Yc, r: 0.075 * m };
  // The boop: the pose that hides the fewest names, the stubborn card's own included (it opens at the boop).
  const stuckCard = cards.find((card) => card.stuck);
  const boopPlan = stuckCard ? boopFor({ x: stuckCard.sealX, y: stuckCard.sealY }, metrics, readingZones(cards, m, -1)) : null;
  const boop: WizardBoop | null = stuckCard && boopPlan ? { card: stuckCard.index, seal: { x: stuckCard.sealX, y: stuckCard.sealY }, ...boopPlan } : null;
  // The owl dips in toward the seal and recoils straight back from it, staying in the safe band.
  const toSeal = boop ? { x: boop.seal.x - boop.owl.x, y: boop.seal.y - boop.owl.y } : { x: -1, y: 1 };
  const toSealLength = Math.max(1, Math.hypot(toSeal.x, toSeal.y));
  const backFrom = (from: Point, amount: number) => ({ x: from.x - toSeal.x / toSealLength * amount * S, y: clamp(from.y - toSeal.y / toSealLength * amount * S, Math.min(safeTop, from.y), Math.max(safeBottom, from.y)) });
  // The perch also weighs the hop from it to the seal (when there is one).
  const spellBox = wordBox(spell, bigSize, WIZARD_WORDS.spell.length, 6);
  const G = perchPoint(T, { W, H, m, S, safeTop, safeBottom, cards, star, stuck, spell: spellBox, pre: boop ? backFrom(boop.owl, 0.13) : undefined });
  // The shockwave blows the owl away from the star: it tumbles with its head lagging behind.
  const knockSide: -1 | 1 = Math.abs(G.x - T.x) > 0.05 * S ? (G.x > T.x ? 1 : -1) : (T.x >= star.x ? 1 : -1);
  const O = boop ? boop.owl : { x: G.x - 0.04 * W, y: G.y + 0.02 * H };
  const back = (amount: number) => backFrom(O, amount);
  const pre = back(0.13);
  const hop = bestHop(hoverPoint(B.hop, G, H), pre, { H, S, safeTop, safeBottom }, readingZones(cards, m, stuck)).keys;
  // Recoil straight back from the seal and away from the stubborn card's name column (its names are appearing).
  let recoil = back(0.12);
  if (boop && stuckCard) {
    const names = namesCenter(stuckCard, m);
    const a = { x: O.x - boop.seal.x, y: O.y - boop.seal.y }, b = { x: O.x - names.x, y: O.y - names.y };
    const la = Math.max(1e-6, Math.hypot(a.x, a.y)), lb = Math.max(1e-6, Math.hypot(b.x, b.y));
    const u = { x: a.x / la + b.x / lb, y: a.y / la + b.y / lb }, lu = Math.hypot(u.x, u.y);
    if (lu > 1e-6) recoil = { x: O.x + u.x / lu * 0.16 * S, y: clamp(O.y + u.y / lu * 0.16 * S, Math.min(safeTop, O.y), Math.max(safeBottom, O.y)) };
  }
  const { exit, exitSide } = exitPath(recoil, { W, H, S, m, cards, stuck });
  const hand = owlHand(WAND_WING, BOOP_WING);
  const aim = Math.atan2(Yc - (T.y + hand.y * S / 100), 0.5 * W - (T.x + hand.x * S / 100)) / DEG;
  const lookSide: -1 | 1 = (boop ? boop.seal.x : 0.5 * W) < G.x ? -1 : 1;

  // Each chant word pops just above its curl, as the owl flips over the top, nudged off any envelope.
  const curl1 = swirlAt(partial, SWIRL_CURLS[0]), curl2 = swirlAt(partial, SWIRL_CURLS[1]);
  // High above each curl top, clear of the owl as it flips over (its feet reach ~0.62 S up).
  const wordY = Math.max(WIZARD_HEADER_SAFE + 0.75 * wordSize, Yc - R - 0.62 * S - 0.6 * wordSize - 6);
  const envelopes = cards.filter((card) => card.shown).map((card) => boxAround({ x: card.centerX, y: card.centerY }, card.envW / 2 + 6, card.envH / 2 + 6));
  const words: WizardLayout['words'] = {
    size: wordSize,
    bigSize,
    chant1: clearOfEnvelopes({ x: curl1.x - 0.35 * R - 0.01 * W, y: wordY }, wordSize, WIZARD_WORDS.chant1.length, envelopes, W),
    chant2: clearOfEnvelopes({ x: curl2.x + 0.35 * R + 0.01 * W, y: wordY }, wordSize, WIZARD_WORDS.chant2.length, envelopes, W),
    spell,
    command: null,
    commandRot: 0,
  };
  const layout: WizardLayout = {
    ...partial,
    star,
    cards, stuck, boop,
    path: { passSpeed, glide, windUp, T, knockSide, G, hop, pre, O, recoil, exit, exitSide, aim, lookSide },
    candles: { width: 0, slots: [] },
    twinkles: [],
    words,
    lock: stuckCard?.shown ? lockPlan(stuckCard, m) : null,
  };
  // The command needs the finished path: it keeps off the owl at the boop, the recoil and on its way out.
  const command = commandWordSpot(layout);
  if (command) { words.command = { x: command.x, y: command.y }; words.commandRot = command.rot; }
  layout.candles = candleSlots(layout);
  layout.twinkles = twinkleSpots(layout);
  return layout;
}

/** The stubborn seal's padlock: its body (about the seal's own size, never tiny) sits on the seal. */
export function lockPlan(card: Pick<WizardCard, 'centerX' | 'centerY' | 'envH' | 'sealY' | 'seal'>, m: number): LockPlan {
  const pivot = card.centerY + 0.1 * card.envH;
  return { x: card.centerX, y: pivot, dy: card.sealY - pivot, size: Math.max(0.95 * card.seal, 0.034 * m) };
}

/** The padlock's outline in viewport px (body and raised shackle), for keeping things off it. */
export function lockBox(lock: LockPlan, pad = 0): Box {
  const cy = lock.y + lock.dy;
  return { l: lock.x - 0.55 * lock.size - pad, r: lock.x + 0.55 * lock.size + pad, t: cy - 1.05 * lock.size - pad, b: cy + 0.45 * lock.size + pad };
}

/** The command word's box must fit on screen at this scale (it swells to 1.2x for 60 ms as it pops out; a sliver past the edge then is invisible). */
export const COMMAND_ROOM = 1.08;
/** The owl's positions the command word keeps clear of: at the boop and the recoil (fully), then on its way out (lightly: it may fly under the word). */
export const COMMAND_TIMES = [{ t: B.boop, w: 2 }, { t: B.recoil, w: 2 }, { t: B.exit, w: 1 }, { t: 6.45, w: 0.4 }, { t: B.commandOut, w: 0.4 }] as const;

/**
 * "Aperi!" (5.97–6.60 s), the owl's command to the stubborn letter, as big as "APERIO!". It goes
 * near the seal wherever it hides the fewest names (the stubborn card's own count three times
 * over: they appear right under it), keeps off the owl (at the boop, the recoil and on its way
 * out), the seal and its padlock popping away, stays on screen between the header and footer,
 * and over the cards (it never hangs off the edge of the Today table into the page margin).
 * It tilts a little away from the seal.
 */
export function commandWordSpot(layout: WizardLayout): { x: number; y: number; rot: number } | null {
  const { W, H, S, m, boop } = layout;
  const card = layout.cards.find((candidate) => candidate.stuck);
  if (!boop || !card) return null;
  const size = layout.words.bigSize, chars = WIZARD_WORDS.command.length;
  const zones: Zone[] = [...readingZones(layout.cards, m, -1), { box: namesBox(card, m), w: 2 }];
  for (const { t, w } of COMMAND_TIMES) {
    // Body and hat count fully; the wings (one of them holds the wand out to the seal) a little.
    const [body, hat, ...wings] = owlBoxes(owlCenter(t, layout), S * exitShrink(t), [-1, 1]);
    zones.push({ box: body, w }, { box: hat, w }, ...wings.map((box) => ({ box, w: 0.35 * w })));
  }
  if (layout.lock) zones.push({ box: lockBox(layout.lock, 4), w: 2 });
  zones.push({ box: boxAround(boop.seal, 0.7 * card.seal + 4, 0.7 * card.seal + 4), w: 2 });
  const shown = layout.cards.filter((candidate) => candidate.shown);
  const area = { l: Math.min(...shown.map((c) => c.left)) - 8, r: Math.max(...shown.map((c) => c.left + c.width)) + 8, t: Math.min(...shown.map((c) => c.top)) - 8, b: Math.max(...shown.map((c) => c.top + c.height)) + 8 };
  let best: Point | null = null, bestCost = Number.POSITIVE_INFINITY;
  for (let dx = -3.2 * S; dx <= 3.2 * S + 1e-9; dx += 0.08 * S) {
    for (let dy = -2.4 * S; dy <= 2.4 * S + 1e-9; dy += 0.08 * S) {
      const p = { x: boop.seal.x + dx, y: boop.seal.y + dy };
      // It stays on screen and clear of the header and footer, with a little room for its pop-out swell (1.2x, for 60 ms).
      const swell = wordBox(p, COMMAND_ROOM * size, chars);
      if (swell.l < 4 || swell.r > W - 4 || swell.t < WIZARD_HEADER_SAFE || swell.b > H - WIZARD_FOOTER_SAFE) continue;
      const box = wordBox(p, size, chars, 4);
      const boxArea = (box.r - box.l) * (box.b - box.t);
      const outside = boxArea - overlapArea(box, area);
      // Near the tap, so it reads as what the owl says to the seal.
      const cost = hiddenCost([box], zones, S) + 0.5 * outside / (S * S) + 0.2 * Math.hypot(dx, dy) / S;
      if (cost < bestCost - 1e-9) { best = p; bestCost = cost; }
    }
  }
  if (!best) {
    const halfW = size * chars * 0.33 + 4;
    best = { x: clamp(boop.seal.x, halfW + 6, W - halfW - 6), y: clamp(boop.seal.y - card.envH / 2 - 0.8 * size, WIZARD_HEADER_SAFE + 0.75 * size, H - WIZARD_FOOTER_SAFE - 0.75 * size) };
  }
  return { ...best, rot: best.x < boop.seal.x ? -5 : 5 };
}

/**
 * The exit (6.28–6.98 s) just after the stubborn card opens: out through either top corner, low
 * and level out of either side over the empty lower halves of the cards, steeply up and away
 * over the header, or climbing almost straight up a column of empty card space (between two
 * cards' name columns), whichever hides the fewest names along the way (every card is open by then).
 * The owl stays opaque until it is off screen, so every moment on screen counts. The stubborn
 * card's names (the ones every child is waiting to read, just revealed) count three times over
 * until 6.60 s. Ties go to the nearer top corner.
 */
export const EXIT_STUCK_WEIGHT = 3;
export const EXIT_STUCK_UNTIL = 6.6;
export function exitPath(recoil: Point, o: { W: number; H: number; S: number; m: number; cards: readonly CardShape[]; stuck?: number }) {
  const { W, H, S, m } = o;
  const zones = readingZones(o.cards, m, -1);
  const stuckCard = o.cards.find((card) => card.index === o.stuck);
  const stuckNames = stuckCard ? readingZones([stuckCard], m, -1).slice(0, 1).map((zone) => ({ box: zone.box, w: EXIT_STUCK_WEIGHT - 1 })) : [];
  const low = clamp(recoil.y + 0.25 * H, recoil.y, H - WIZARD_FOOTER_SAFE - 0.8 * S);
  const nearer: -1 | 1 = recoil.x < 0.5 * W ? -1 : 1;
  let best: { exit: HermiteKey[]; exitSide: -1 | 1 } | null = null, bestCost = Number.POSITIVE_INFINITY;
  for (const route of ['high', 'low', 'steep', 'climb'] as const) {
    for (const side of [nearer, -nearer as -1 | 1]) {
      const exit: HermiteKey[] = route === 'high' ? [
        { t: B.exit, ...recoil },
        { t: 6.62, x: recoil.x + side * 0.1 * W, y: recoil.y - 0.12 * H },
        { t: B.exitEnd, x: side < 0 ? -0.16 * W : 1.16 * W, y: 0.02 * H, v: { x: side * 1.4 * W, y: -0.5 * H } },
      ] : route === 'low' ? [
        { t: B.exit, ...recoil },
        { t: 6.62, x: recoil.x + side * 0.12 * W, y: mix(recoil.y, low, 0.75) },
        { t: B.exitEnd, x: side < 0 ? -0.16 * W : 1.16 * W, y: low, v: { x: side * 1.4 * W, y: 0 } },
      ] : route === 'steep' ? [
        // Steeply up and away over the header, for a crowded screen where every other way crosses names.
        { t: B.exit, ...recoil },
        { t: 6.58, x: recoil.x + side * 0.05 * W, y: recoil.y - 0.28 * H },
        { t: B.exitEnd, x: recoil.x + side * 0.2 * W, y: -0.3 * H, v: { x: side * 0.5 * W, y: -1.6 * H } },
      ] : [
        // Almost straight up (a little lean), up a column of empty card space between the name columns.
        { t: B.exit, ...recoil },
        { t: 6.58, x: recoil.x + side * 0.015 * W, y: recoil.y - 0.28 * H },
        { t: B.exitEnd, x: recoil.x + side * 0.05 * W, y: -0.3 * H, v: { x: side * 0.12 * W, y: -1.6 * H } },
      ];
      let cost = (route === 'high' ? 0 : route === 'low' ? 0.2 : 0.3) + (side === nearer ? 0 : 0.1);
      for (let time = 6.3; time <= 6.9; time += 0.04) {
        const p = hermitePath(time, exit);
        const boxes = owlBoxes(p, S * exitShrink(time), [-1, 1]);
        cost += (hiddenCost(boxes, zones, S) + (time <= EXIT_STUCK_UNTIL ? hiddenCost(boxes, stuckNames, S) : 0)) * 0.1;
      }
      if (cost < bestCost - 1e-9) { best = { exit, exitSide: side }; bestCost = cost; }
    }
  }
  return best!;
}

/** The owl shrinks a little as it flies away (the rig's root scale during the exit). */
export function exitShrink(time: number) {
  return mix(1, 0.85, ramp(time, B.exit, B.exitEnd));
}

function passPoint(time: number, W: number, H: number, lane: number): Point {
  const x = W * (PASS_FROM + (PASS_TO - PASS_FROM) * (time - B.passStart) / (B.passEnd - B.passStart));
  return { x, y: lane + 0.012 * H * Math.sin(2 * Math.PI * (time - B.passStart) / 0.52) };
}

/** A gentle hover bob at the perch, starting at rest when the owl arrives. */
function hoverPoint(time: number, G: Point, H: number): Point {
  return { x: G.x, y: G.y + 0.008 * H * (1 - Math.cos(2 * Math.PI * Math.max(0, time - B.perch) / 0.9)) };
}

/**
 * The shockwave's knock-back (4.44–4.62): a hard ease-out from T to the perch G. If the perch is
 * (nearly) at T, the owl is still bumped away from the star and floats back.
 */
function knockBack(time: number, layout: WizardLayout): Point {
  const { S, star, path } = layout;
  const { T, G } = path;
  const s = progress(time, B.perchStart, B.perch);
  const k = 1 - (1 - s) * (1 - s);
  const away = { x: T.x - star.x, y: T.y - star.y }, length = Math.max(1e-6, Math.hypot(away.x, away.y));
  const bump = Math.max(0, 0.35 * S - Math.hypot(G.x - T.x, G.y - T.y)) * Math.sin(Math.PI * s);
  return { x: mix(T.x, G.x, k) + away.x / length * bump, y: mix(T.y, G.y, k) + away.y / length * bump };
}

/** The owl's centre (viewport px) at story time t. C1 everywhere except the knock-back and the boop impact. */
export function owlCenter(time: number, layout: WizardLayout): Point {
  const { W, H, lane, path } = layout;
  if (time <= B.passEnd) return passPoint(time, W, H, lane);
  if (time <= B.swirlStart) return hermitePath(time, path.glide);
  if (time <= B.swirlEnd) return swirlAt(layout, swirlParam(time));
  if (time <= B.tap) return hermitePath(time, path.windUp);
  // A small hover bob at the tap point while the star gathers itself (the eyes are on the star).
  if (time <= B.perchStart) return { x: path.T.x, y: path.T.y - 0.006 * H * (1 - Math.cos(2 * Math.PI * progress(time, B.tap, B.perchStart))) };
  if (time <= B.perch) return knockBack(time, layout);
  if (time <= B.hop) return hoverPoint(time, path.G, H);
  if (time <= B.dip) return hermitePath(time, path.hop);
  if (time <= B.boop) { const k = easeInCubic(progress(time, B.dip, B.boop)); return { x: mix(path.pre.x, path.O.x, k), y: mix(path.pre.y, path.O.y, k) }; }
  if (time <= B.recoil) { const k = easeOutCubic(progress(time, B.boop, B.recoil)); return { x: mix(path.O.x, path.recoil.x, k), y: mix(path.O.y, path.recoil.y, k) }; }
  if (time <= B.exit) return path.recoil;
  return hermitePath(time, path.exit);
}

// ---------------------------------------------------------------------------
// Pose: rotation, wings, face, wand and hat.

export type OwlEyes = 'open' | 'happy' | 'squint' | 'wide' | 'wink' | 'blink';

export type OwlPose = {
  x: number; y: number; opacity: number;
  /** Degrees, clockwise. */
  rot: number; scale: number; squashY: number;
  /** Startled puff: body scale, and the scale of the solid scalloped fluff behind the body (0 = hidden). */
  bodyScale: number; fluff: number;
  /** Wing angles in degrees: 0 spread, negative up, positive down, 72 folded. */
  wingL: number; wingR: number;
  eyes: OwlEyes; pupilX: number; pupilY: number; blush: number;
  /** Wand angle in the body frame (degrees, as if in the left wing), or null when put away. */
  wand: number | null; wandScale: number; wandGlow: number; wandFlash: number;
  /** The wing holding the wand: the left for the tap, either for the boop (the right mirrors the wand). */
  wandSide: -1 | 1;
  hatX: number; hatY: number; hatRot: number;
  /** Sparkle-dust trail strength (0..1). */
  dust: number;
};

const ramp = (time: number, start: number, end: number) => smooth(progress(time, start, end));
/** A wingbeat with a quicker downstroke than upstroke. */
function flap(time: number, period: number, center: number, amplitude: number) {
  const phase = 2 * Math.PI * time / period;
  return center + amplitude * Math.sin(phase + 0.42 * Math.sin(phase));
}
const BLINKS = [1.34, 2.6, 5.43] as const;
/** Fluff scale that sits wholly behind the body outline. */
export const FLUFF_HIDDEN = 0.62;

function passRot(time: number) { return 10 + 2.5 * Math.cos(2 * Math.PI * (time - B.passStart) / 0.52); }

/** Body rotation only (cheap): also used to lag the hat behind turns. */
export function owlRot(time: number, layout: WizardLayout): number {
  if (time <= B.passEnd) return passRot(time);
  if (time <= B.swirlStart) {
    const lean = mix(passRot(B.passEnd), -10, ramp(time, B.passEnd, 2.25));
    return mix(lean, 0, ramp(time, B.glideEnd, B.swirlStart));
  }
  if (time <= B.swirlEnd) return swirlRot(layout, swirlParam(time));
  // Wind-up: pull up out of the last curl, lean away from the star, then flick toward it (overshoot) and settle.
  if (time <= B.tap) { const end = swirlRot(layout, 1); return mix(end, 360 * Math.round(end / 360) + 12, easeOutCubic(progress(time, B.swirlEnd, 4.08))); }
  if (time <= 4.23) return mix(12, -10, easeOutBack(progress(time, B.tap, 4.23), 2.2));
  if (time <= B.perchStart) return mix(-10, 0, ramp(time, 4.23, 4.4));
  // Knock-back tumble: the head lags behind the blast (-25°), then rights itself with a small overshoot.
  if (time <= B.poof) {
    const tumble = -25 * layout.path.knockSide;
    if (time <= KNOCK_PEAK) return tumble * easeOutCubic(progress(time, B.perchStart, KNOCK_PEAK));
    // A damped spring back to upright (starts at rest, overshoots about 3°, settled by the poof).
    const tau = time - KNOCK_PEAK, w = 2 * Math.PI / 0.22, k = 20;
    return tumble * (Math.cos(w * tau) + k / w * Math.sin(w * tau)) * Math.exp(-k * tau) * (1 - ramp(time, 4.62, B.poof));
  }
  if (time <= B.look) return 0;
  const side = layout.path.lookSide;
  if (time <= B.hop) return 8 * side * ramp(time, B.look, B.hop);
  if (time <= B.dip) {
    // Lean along the hop, easing upright before the dip so the boop is square.
    const k = progress(time, B.hop, B.dip);
    const a = hermitePath(Math.max(B.hop, time - 0.02), layout.path.hop), b = hermitePath(Math.min(B.dip, time + 0.02), layout.path.hop);
    const vx = (b.x - a.x) / 0.04;
    const lean = clamp(vx / (0.9 * layout.W), -1, 1) * 14;
    return mix(8 * side, lean, ramp(k, 0, 0.25)) * (1 - ramp(time, 5.8, B.dip));
  }
  if (time <= B.exit) return 0;
  return layout.path.exitSide * 12 * ramp(time, B.exit, 6.45);
}

/** When the knock-back tumble peaks. */
const KNOCK_PEAK = 4.49;

function wandAngle(time: number, layout: WizardLayout): number | null {
  const { aim } = layout.path;
  const raised = -72;
  const flickEnd = aim - 360; // counter-clockwise over the top of the head
  if (time < B.wandOut) return null;
  if (time <= B.tap) return raised;
  if (time <= 4.23) return mix(raised, flickEnd, easeOutBack(progress(time, B.tap, 4.23), 1.3));
  if (time <= B.poof + 0.06) return mix(flickEnd, flickEnd - 30, ramp(time, 4.23, 4.6));
  if (time < 5.5) return null;
  const target = layout.boop?.angle ?? BOOP_ANGLE_ABOVE;
  if (time <= 5.85) return mix(115, target, ramp(time, 5.5, 5.85));
  if (time <= B.wink) return target;
  if (time <= 6.36) return target - 360 * ramp(time, B.wink, 6.3);
  return null;
}

function wandScale(time: number) {
  if (time < B.wandOut) return 0;
  if (time <= B.poof) return easeOutBack(progress(time, B.wandOut, 3.85));
  if (time < 5.5) return 1 - progress(time, B.poof, B.poof + 0.06);
  if (time <= B.exit) return easeOutBack(progress(time, 5.5, 5.62));
  return 1 - progress(time, B.exit, 6.36);
}

/** Everything the owl rig needs at time t. Pure and deterministic. */
export function owlPose(time: number, layout: WizardLayout): OwlPose {
  const { S } = layout;
  const center = owlCenter(time, layout);
  const rot = owlRot(time, layout);
  let y = center.y;
  let squashY = 1;
  let bodyScale = 1, fluff = 0;
  // The tap is always left-winged (the star is to the owl's left); the boop uses whichever wing hides the fewest names.
  const boopSide = layout.boop?.side ?? -1;
  const wandSide: -1 | 1 = time < B.giggle ? WAND_WING : boopSide;
  const holdFree = (hold: number, free: number): [number, number] => (boopSide < 0 ? [hold, free] : [free, hold]);

  // Wings. The wand wing is the viewer's left until the boop.
  const flying = flap(time, 0.26, -4, 38);
  let wingL = flying, wingR = flying;
  if (time > B.passEnd && time <= B.swirlStart) {
    const glide = ramp(time, 2.36, B.glideStart) * (1 - ramp(time, B.glideEnd, 2.8));
    wingL = wingR = mix(flying, -8, glide);
  } else if (time > B.swirlStart && time <= B.swirlEnd) {
    const u = swirlParam(time);
    const tuck = Math.max(...SWIRL_CURLS.map((c) => Math.exp(-(((u - c) / 0.075) ** 2))));
    wingL = wingR = mix(mix(flying, flap(time, 0.2, -6, 34), ramp(time, B.swirlStart, 3.04)), 58, tuck);
    wingL = mix(wingL, -15, ramp(time, B.wandOut, 3.85));
  } else if (time > B.swirlEnd && time <= B.poof) {
    const free = time <= B.tap ? mix(flap(time, 0.22, -2, 30), 70, ramp(time, B.swirlEnd, 4.05)) : mix(70, flap(time, 0.2, 10, 18), ramp(time, B.tap, 4.3));
    wingL = -15; wingR = free;
    // Knocked back: both wings flare up against the blast.
    if (time > B.perchStart) { const k = ramp(time, B.perchStart, 4.52); wingL = mix(-15, -46, k); wingR = mix(free, -52, k); }
  }
  if (time > B.poof && time <= B.giggle) { const k = ramp(time, B.poof, 4.73); wingL = mix(-46, -55, k); wingR = mix(-52, -55, k); }
  if (time > B.giggle && time <= B.hop) {
    const k = ramp(time, B.giggle, 5.2);
    const tuck = 72 + 5 * Math.sin(2 * Math.PI * (time - B.giggle) / 0.125) * (1 - progress(time, B.giggle, 5.45));
    wingL = mix(-55, tuck, k); wingR = wingL;
    if (time > B.look) [wingL, wingR] = holdFree(mix(tuck, 20, ramp(time, B.look, B.hop)), mix(tuck, flap(time, 0.2, 0, 34), ramp(time, B.look, B.hop)));
  }
  if (time > B.hop && time <= B.exit) [wingL, wingR] = holdFree(mix(20, BOOP_WING, ramp(time, B.hop, 5.6)), flap(time, 0.2, 0, 34));
  if (time > B.exit) { const free = flap(time, 0.22, -4, 38); [wingL, wingR] = holdFree(mix(BOOP_WING, free, ramp(time, B.exit, 6.4)), free); }

  // Squash and stretch.
  if (time > B.swirlEnd && time <= B.tap) squashY = mix(1, 0.93, ramp(time, B.swirlEnd, 4.06));
  else if (time > B.tap && time <= 4.32) squashY = time <= 4.19 ? mix(0.93, 1.08, ramp(time, B.tap, 4.19)) : mix(1.08, 1, ramp(time, 4.19, 4.32));
  // The blast squashes the owl as it is knocked back.
  else if (time > B.perchStart && time <= B.perch) squashY = time <= 4.48 ? mix(1, 0.88, ramp(time, B.perchStart, 4.48)) : mix(0.88, 1, ramp(time, 4.48, B.perch));
  if (time > B.hatLands && time <= B.giggle) squashY = 1 - 0.06 * Math.sin(Math.PI * progress(time, B.hatLands, B.giggle));
  if (time > 5.43 && time <= B.hop) squashY = mix(1, 0.92, ramp(time, 5.43, B.hop));
  else if (time > B.hop && time <= 5.75) squashY = time <= 5.58 ? mix(0.92, 1.06, ramp(time, B.hop, 5.58)) : mix(1.06, 1, ramp(time, 5.58, 5.75));
  if (time > B.boop && time <= 6.16) squashY = 1 - 0.1 * Math.sin(Math.PI * progress(time, B.boop, 6.16));

  // Startled fluffball: a solid scalloped fluff pops out from behind the body (0.62 is hidden behind it)
  // and later deflates back under it before a one-sample hide, so the silhouette never goes see-through.
  if (time > B.poof && time <= B.giggle) {
    bodyScale = time <= 4.96 ? mix(1, 1.2, easeOutBack(progress(time, B.poof, 4.76), 2.4)) : mix(1.2, 1, ramp(time, 4.96, B.giggle));
    if (time > 4.76 && time <= 4.96) bodyScale += 0.015 * Math.sin(2 * Math.PI * (time - 4.76) / 0.05);
    if (time <= 4.96) fluff = mix(FLUFF_HIDDEN, 1.2, easeOutBack(progress(time, B.poof, 4.76), 2)) + (time > 4.76 ? 0.015 * Math.sin(2 * Math.PI * (time - 4.76) / 0.05) : 0);
    else if (time <= 5.08) fluff = mix(1.2, FLUFF_HIDDEN, easeInCubic(progress(time, 4.96, 5.08)));
  }
  // Giggle bounces.
  if (time > B.giggle && time <= 5.45) {
    const k = progress(time, B.giggle, 5.45);
    y -= 0.03 * S * Math.abs(Math.sin(2 * Math.PI * 4 * (time - B.giggle))) * (1 - k);
  }

  // Face.
  let eyes: OwlEyes = 'open';
  let pupilX = 0, pupilY = 0, blush = 0;
  if (time <= B.passEnd) pupilX = 3;
  else if (time <= B.swirlStart) pupilX = -3;
  else if (time <= B.swirlEnd) eyes = 'happy';
  else if (time <= 4.3) eyes = 'squint';
  else if (time <= B.perchStart) {
    // Eyes on the star while it gathers itself.
    const dx = layout.star.x - center.x, dy = layout.star.y - center.y, dist = Math.max(1, Math.hypot(dx, dy));
    pupilX = 3.5 * dx / dist; pupilY = 3.5 * dy / dist;
  } else if (time <= B.poof) eyes = 'squint';
  else if (time <= B.giggle) eyes = 'wide';
  else if (time <= B.look) { eyes = 'happy'; blush = 0.75 * ramp(time, B.giggle, 5.2) * (1 - ramp(time, 5.34, B.look)); }
  else if (time <= B.wink) {
    const target = layout.boop ? layout.boop.seal : { x: layout.W / 2, y: layout.H / 2 };
    const dx = target.x - center.x, dy = target.y - center.y, dist = Math.max(1, Math.hypot(dx, dy));
    pupilX = 3.5 * dx / dist; pupilY = 3.5 * dy / dist;
  } else if (time <= B.exit) { eyes = 'wink'; blush = 0.75 * ramp(time, B.wink, 6.16) * (1 - ramp(time, 6.3, 6.4)); }
  else eyes = 'happy';
  if (eyes === 'open' && BLINKS.some((at) => time >= at && time <= at + 0.09)) eyes = 'blink';

  // Wand.
  const wand = wandAngle(time, layout);
  const wandGlow = time <= B.swirlEnd ? 0.6 : time <= B.tap ? mix(0.6, 1.4, ramp(time, B.swirlEnd, B.tap)) : time <= B.poof ? mix(1.4, 0.7, ramp(time, B.tap, 4.4)) : 0.8;
  const wandFlash = time >= B.tap && time <= 4.34 ? 1 - progress(time, B.tap, 4.34) : time >= 5.97 && time <= 6.14 ? 1 - progress(time, 5.97, 6.14) : 0;

  // Hat: base tilt, the poof launch, the boop bounce, the hat-tip, and a lag behind turns.
  let hatX = 0, hatY = 0;
  let hatRot = time < B.hatLands ? -8 : -18;
  // The blast already lifts the hat and tips it back; the poof then launches it.
  if (time > B.perchStart && time <= B.poof) {
    const k = easeOutCubic(progress(time, B.perchStart, 4.6));
    hatY = -12 * k; hatX = 2 * k; hatRot = mix(-8, 4, k);
  }
  if (time > B.poof && time <= B.hatLands) {
    const up = progress(time, B.poof, 4.86), down = progress(time, 4.86, B.hatLands);
    hatY = time <= 4.86 ? mix(-12, -48, easeOutCubic(up)) : mix(-48, 0, easeInCubic(down));
    hatX = mix(2, 6, up) - 4 * down;
    hatRot = time <= 4.86 ? mix(4, 24, easeOutCubic(up)) : mix(24, -18, easeInCubic(down));
  }
  if (time > B.boop && time <= B.recoil) hatY = -6 * Math.sin(Math.PI * progress(time, B.boop, B.recoil));
  if (time > B.wink && time <= 6.3) hatRot = -18 - 12 * Math.sin(Math.PI * progress(time, B.wink, 6.3));
  const turn = ((rot - owlRot(Math.max(0, time - 0.06), layout)) % 360 + 540) % 360 - 180;
  if (time < B.poof || time > 5.2) hatRot += clamp(-0.35 * turn, -14, 14);

  const dustIn = (a: number, b: number) => ramp(time, a, a + 0.08) * (1 - ramp(time, b - 0.1, b));
  const dust = Math.max(dustIn(B.passStart, B.swirlStart), dustIn(B.hop, B.dip), dustIn(B.exit, B.exitEnd));
  // Fully opaque the whole time it is on screen: every exit route ends wholly off screen at exitEnd,
  // so the owl flies out of frame and is only switched off once it is gone (never a see-through ghost).
  const opacity = time < B.owlIn || time >= B.exitEnd ? 0 : 1;
  const scale = exitShrink(time);
  return { x: center.x, y, opacity, rot, scale, squashY, bodyScale, fluff, wingL, wingR, eyes, pupilX, pupilY, blush, wand, wandScale: wandScale(time), wandGlow, wandFlash, wandSide, hatX, hatY, hatRot, dust };
}

/** Body-frame point to viewport px, through the rig's group transform. */
export function owlToWorld(pose: OwlPose, S: number, local: Point): Point {
  const k = S / 100 * pose.scale;
  const px = local.x * k, py = local.y * k * pose.squashY;
  const c = Math.cos(pose.rot * DEG), s = Math.sin(pose.rot * DEG);
  return { x: pose.x + px * c - py * s, y: pose.y + px * s + py * c };
}

/** The wand tip in viewport px, or null when the wand is put away. */
export function wandTip(pose: OwlPose, S: number): Point | null {
  if (pose.wand === null || pose.wandScale <= 0) return null;
  return owlToWorld(pose, S, wandTipLocal(pose.wandSide < 0 ? pose.wingL : pose.wingR, pose.wand, pose.wandScale, pose.wandSide));
}

/** The satchel mouth in viewport px: where each letter leaves from. */
export function satchelPoint(time: number, layout: WizardLayout): Point {
  return owlToWorld(owlPose(time, layout), layout.S, OWL_RIG.satchel);
}

// ---------------------------------------------------------------------------
// Per-card plans for the Stage's CSS elements (set once, then CSS runs them).

export type FlightPlan = { index: number; x: number; y: number; fx: number; fy: number; at: number; w: number; h: number };
export type SparkPlan = { index: number; x: number; y: number; tx: number; ty: number; delay: number; duration: number; odd: boolean; angle: number };
/**
 * A letter's jump (rise, at a1 ms) and its way out over `go` ms from a2: a sail by (dx, dy), `side` being its
 * horizontal direction, or (kind 'pop') a twirl in place that shrinks away.
 */
export type LetterPlan = { index: number; x: number; y: number; rise: number; dx: number; dy: number; a1: number; a2: number; go: number; w: number; h: number; ends: number; side: -1 | 1; stuck: boolean; kind: LetterKind };

export function flightPlan(layout: WizardLayout): FlightPlan[] {
  return layout.cards.filter((card) => card.shown).map((card) => {
    const from = satchelPoint(card.launch, layout);
    return { index: card.index, x: card.centerX, y: card.centerY, fx: from.x - card.centerX, fy: from.y - card.centerY, at: card.launch * 1000, w: card.envW, h: card.envH };
  });
}

export function sparkPlan(layout: WizardLayout): SparkPlan[] {
  const { star } = layout;
  return layout.cards.filter((card) => card.shown).map((card, i) => {
    const tx = card.sealX - star.x, ty = card.sealY - star.y;
    return { index: card.index, x: star.x, y: star.y, tx, ty, delay: B.burst * 1000, duration: (card.spark - B.burst) * 1000, odd: i % 2 === 1, angle: Math.atan2(ty, tx) / DEG };
  });
}

/** CSS cubic-bezier(x1, y1, x2, y2) as an easing function, to plan CSS-timed motion. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (t: number, a: number, b: number) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (at(mid, x1, x2) < x) lo = mid; else hi = mid; }
    return at((lo + hi) / 2, y1, y2);
  };
}

/** Letter sail durations (ms) and easings: they match .wizard-letter-go in wizard.css. */
export const LETTER_GO_MS = 750;
/**
 * On a crowded screen (more than 8 cards, or cards stacked in more than one row, so a sailing letter would cross
 * other cards' names) the letters are smaller (0.6 of the envelope) and leave faster.
 */
export const CROWDED_LETTER_GO_MS = 500;
export const CROWDED_CARDS = 8;
export const CROWDED_LETTER_SIZE = 0.6;
export const CROWDED_STUCK_LETTER_SIZE = 0.75;
export function crowdedLetters(cards: readonly Pick<WizardCard, 'shown' | 'top'>[]) {
  const shown = cards.filter((card) => card.shown);
  const rows = shown.reduce<number[]>((tops, card) => (tops.some((top) => Math.abs(top - card.top) < 8) ? tops : [...tops, card.top]), []);
  return shown.length > CROWDED_CARDS || rows.length > 1;
}
/**
 * A packed Today table (more than DENSE_CARDS cells): the little cells skip their decorative layers, and only the
 * stubborn letter jumps out (a letter from every one of 48 cells would just cover the station names).
 */
export const DENSE_CARDS = 20;
export const isDense = (cards: readonly unknown[]) => cards.length > DENSE_CARDS;
export const STUCK_LETTER_GO_MS = 600;
/** A letter that "pops" twirls in place over its own envelope and shrinks away (wz-letter-pop), in this long. */
export const LETTER_POP_MS = 440;
export const LETTER_EASE = cubicBezier(0.3, 0.15, 0.6, 1);
export const STUCK_LETTER_EASE = cubicBezier(0.2, 0.55, 0.4, 1);
/** The night curtain's easing (.wizard-veil-clip in wizard.css). */
const VEIL_IN_EASE = cubicBezier(0.4, 0, 0.2, 1);

/**
 * wz-letter-flutter: the letter stays fully opaque while it sails (a half-transparent letter over
 * the night or over names reads as a grey ghost), then pops away by shrinking to nothing from
 * LETTER_SHRINK (ease-in), with the opacity step only in the last 1.5% (when it is a speck).
 */
export const LETTER_SHRINK = 0.88;
export const LETTER_OFF = 0.985;
const LETTER_SHRINK_EASE = cubicBezier(0.55, 0, 1, 0.45);
/** wz-letter-pop: a little lift and twirl (to 45%), then it shrinks away from POP_SHRINK, opaque until LETTER_OFF. */
const POP_SHRINK = 0.62;

/** Opacity and scale of a letter at fraction k of its sail or pop (wz-letter-flutter, wz-letter-pop). */
export function letterFlutter(k: number, kind: LetterKind = 'sail') {
  const opacity = k < LETTER_OFF ? 1 : Math.max(0, (1 - k) / (1 - LETTER_OFF));
  if (kind === 'pop') {
    const scale = k <= 0.45 ? mix(1, 1.06, k / 0.45) : k <= POP_SHRINK ? mix(1.06, 1, (k - 0.45) / (POP_SHRINK - 0.45)) : 1 - LETTER_SHRINK_EASE(clamp01((k - POP_SHRINK) / (1 - POP_SHRINK)));
    return { opacity, scale };
  }
  const scale = k <= 0.3 ? 1 : k <= 0.55 ? mix(1, 0.9, (k - 0.3) / 0.25) : k <= 0.78 ? mix(0.9, 0.8, (k - 0.55) / 0.23)
    : k <= LETTER_SHRINK ? mix(0.8, 0.78, (k - 0.78) / (LETTER_SHRINK - 0.78)) : 0.78 * (1 - LETTER_SHRINK_EASE(clamp01((k - LETTER_SHRINK) / (1 - LETTER_SHRINK))));
  return { opacity, scale };
}

/** Where a letter box is at fraction k of its sail (or pop). */
export function letterBoxAt(letter: Pick<LetterPlan, 'x' | 'y' | 'rise' | 'dx' | 'dy' | 'w' | 'h' | 'stuck' | 'kind'>, k: number): Box {
  const e = (letter.stuck ? STUCK_LETTER_EASE : LETTER_EASE)(k), { scale } = letterFlutter(k, letter.kind);
  // The pop lifts the letter by 6% of its height at 45% (wz-letter-pop) and settles back by POP_SHRINK, as it starts to shrink.
  const lift = letter.kind === 'pop' ? -0.06 * letter.h * (k <= 0.45 ? smooth(k / 0.45) : 1 - smooth(clamp01((k - 0.45) / (POP_SHRINK - 0.45)))) : 0;
  return boxAround({ x: letter.x + letter.dx * e, y: letter.y + letter.rise + letter.dy * e + lift }, letter.w / 2 * scale, letter.h / 2 * scale);
}

/**
 * How much of the names the children are reading a box hides at story time t (S²): every card's
 * name column once it has opened (lightly while its bloom still covers it; the letter's own card
 * counts in full, it is the card its children are looking at), any card body a little, the Today
 * table's team column and round titles, and the stubborn card in full while it is still dark (its
 * padlock and head-shake are where every child is looking).
 */
function letterSceneCost(box: Box, time: number, layout: WizardLayout, table: readonly Zone[]): number {
  const { S, m } = layout;
  let cost = 0;
  for (const card of layout.cards) {
    if (card.visible <= 0) continue;
    const rect = { l: card.left, r: card.left + card.width, t: card.top, b: card.top + card.height };
    // Never across the dark stubborn card while it is still waiting for its command (not even a corner).
    if (card.stuck && time < B.boop) { if (overlaps(box, rect)) cost += LETTER_FORBIDDEN * S * S; continue; }
    const names = time < card.pop + 0.25 ? 0.3 : 1;
    cost += names * overlapArea(box, namesBox(card, m)) + 0.05 * overlapArea(box, rect);
  }
  for (const zone of table) cost += zone.w * overlapArea(box, zone.box);
  const underHeader = Math.max(0, Math.min(box.b, WIZARD_HEADER_SAFE) - box.t) * Math.max(0, Math.min(box.r, layout.W) - Math.max(box.l, 0));
  return (cost + 40 * underHeader) / (S * S);
}

export type LetterKind = 'sail' | 'pop';
/** Samples per route when planning a letter (fine enough that a corner of the dark stubborn card is never skipped). */
const LETTER_SAMPLES = 24;
/** A route that breaks a hard rule costs this much (it is taken only if every way does; the tests check none is). */
const LETTER_FORBIDDEN = 1e4;

/**
 * Each letter jumps out of its envelope (never higher than just above its card, so a top-row
 * letter never slides under the header), then leaves on whichever way hides the fewest names
 * for the least time: it flutters down like a leaf into the empty lower half of its own card
 * (tall cards), sails away up, diagonally or sideways, or, where every way crosses names (a
 * crowded screen), twirls in place and pops. Every card is open by then, its own included, and
 * while the stubborn card is still dark the others keep off it. The stubborn letter rises less
 * and leans towards the owl's exit side, so the names it was hiding read by 6.5 s. On a packed
 * Today table only the stubborn letter jumps out.
 */
export function letterPlan(layout: WizardLayout): LetterPlan[] {
  const { W, H } = layout;
  const crowded = crowdedLetters(layout.cards);
  const dense = isDense(layout.cards);
  const shown = layout.cards.filter((card) => card.shown && (card.stuck || !dense));
  const table = tableZones(layout.cards, -1);
  return shown.map((card) => {
    const stuck = card.stuck;
    // On a crowded screen the stubborn letter (the finale) stays a little bigger than the rest.
    const size = !crowded ? 1 : stuck ? CROWDED_STUCK_LETTER_SIZE : CROWDED_LETTER_SIZE;
    const w = 0.8 * size * card.envW, h = 0.85 * size * card.envH;
    // The rise overshoots about 10%: keep the letter's top at or below the card's top edge (less 8 px) and the header.
    const ceiling = Math.max(card.top - 8, WIZARD_HEADER_SAFE + 4);
    const rise = Math.min(0, Math.max((stuck ? -0.4 : -0.5) * card.envH, (ceiling - (card.centerY - h / 2)) / 1.1));
    const outward: -1 | 1 = card.centerX < 0.5 * W ? -1 : 1;
    const preferred: -1 | 1 = stuck ? layout.path.exitSide : outward;
    // Down like a leaf: as far as the footer allows (it has shrunk to nothing by then).
    const drop = Math.min(0.34 * H, H - WIZARD_FOOTER_SAFE - (card.centerY + rise) - 0.3 * h);
    const sail = stuck ? STUCK_LETTER_GO_MS : crowded ? CROWDED_LETTER_GO_MS : LETTER_GO_MS;
    const options: { dx: number; dy: number; bias: number; kind: LetterKind; go: number }[] = [
      { dx: 0.06 * W + 0.25 * card.width, dy: -(0.3 * H + 0.5 * card.height), bias: stuck ? 0.04 : 0, kind: 'sail', go: sail },
      { dx: 0.28 * W, dy: -0.22 * H, bias: 0.01, kind: 'sail', go: sail },
      { dx: 0.35 * W, dy: -0.12 * H, bias: stuck ? 0 : 0.02, kind: 'sail', go: sail },
      { dx: 0.36 * W, dy: 0, bias: 0.03, kind: 'sail', go: sail },
      { dx: 0.32 * W, dy: 0.12 * H, bias: 0.04, kind: 'sail', go: sail },
      ...(drop >= 0.15 * H ? [{ dx: 0.04 * W, dy: drop, bias: 0.02, kind: 'sail' as const, go: sail }] : []),
      { dx: 0, dy: 0, bias: 0.06, kind: 'pop', go: LETTER_POP_MS },
    ];
    const a1 = (card.pop + 0.06) * 1000, a2 = (card.pop + (stuck ? 0.22 : 0.3)) * 1000;
    let best: LetterPlan | null = null, bestCost = Number.POSITIVE_INFINITY;
    for (const side of [preferred, -preferred as -1 | 1]) {
      for (const option of options) {
        if (option.kind === 'pop' && side !== preferred) continue;
        const plan: LetterPlan = { index: card.index, x: card.centerX, y: card.centerY, rise, dx: side * option.dx, dy: option.dy, a1, a2, go: option.go, w, h, ends: a2 + option.go, side, stuck, kind: option.kind };
        // Time-weighted (S² · s): a quick pop over a name costs less than a long sail across several.
        let cost = option.bias + (side === preferred ? 0 : 0.02);
        for (let i = 1; i <= LETTER_SAMPLES; i++) {
          const k = (i - 0.5) / LETTER_SAMPLES, box = letterBoxAt(plan, k);
          cost += letterSceneCost(box, (a2 + k * option.go) / 1000, layout, table) * option.go / 1000 / LETTER_SAMPLES;
          // While it is still big (before it starts to shrink away) it never slides under the header.
          if (k <= 0.8 && box.t < WIZARD_HEADER_SAFE - 4 && box.r > 0 && box.l < W) cost += LETTER_FORBIDDEN;
        }
        if (cost < bestCost - 1e-9) { best = plan; bestCost = cost; }
      }
    }
    return best!;
  });
}

/** A candle is fully gone this long after its `out`: the flame snuffs, the candle zips up and shrinks away, the smoke wisp fades last. */
export const CANDLE_GONE = 0.52;
/** The candle's own exit starts this long after the flame is snuffed, and lasts CANDLE_EXIT (opaque until its last 50 ms). */
export const CANDLE_DRIFT_DELAY = 0.12;
export const CANDLE_EXIT = 0.16;

/**
 * The reveal of each card (seconds after its pop): a solid cream bloom with a gold rim opens
 * from the seal (full by +0.20), the night patch switches off underneath it in one step, and
 * the bloom fades out over the revealed card (+0.22 to +0.48). Cream over a white card never
 * reads as grey, unlike the night fading over it.
 */
export const BLOOM = { start: 0.02, full: 0.2, nightOff: 0.2, fadeFrom: 0.22, end: 0.48 } as const;
/** Every word pops out in this long (a swell, then it shrinks away): see wz-word-out. */
export const WORD_OUT_MS = 140;

export type RayPlan = { angle: number; reach: number; size: number; star: boolean; ends: number };
export type ConfettiPlan = { dx: number; up: number; fall: number; spin: number; size: number; duration: number; ends: number };

/**
 * The star burst ("APERIO!", 4.42 s): ten fat gold rays shoot out from the star and eight chunky
 * gold star-confetti pieces pop up and tumble down a little. Deterministic.
 */
export function burstPlan(layout: Pick<WizardLayout, 'm'>) {
  const { m } = layout;
  const at = B.burst * 1000;
  const rays: RayPlan[] = Array.from({ length: 10 }, (_, i) => ({ angle: i * 36 + 18, reach: (i % 2 ? 0.3 : 0.36) * m, size: (i % 2 ? 0.042 : 0.052) * m, star: i % 2 === 0, ends: at + RAY_MS }));
  const random = seededRandom(0x50505354);
  const confetti: ConfettiPlan[] = Array.from({ length: 8 }, (_, i) => {
    const angle = (-165 + i * (150 / 7) + (random() - 0.5) * 12) * DEG;
    const duration = 860 + Math.round(random() * 160);
    return {
      dx: Math.cos(angle) * (0.2 + 0.1 * random()) * m,
      up: (0.16 + 0.12 * Math.max(0, -Math.sin(angle)) + 0.04 * random()) * m,
      fall: (0.3 + 0.08 * random()) * m,
      spin: (i % 2 ? 1 : -1) * (200 + Math.round(random() * 160)),
      size: (0.03 + 0.012 * random()) * m,
      duration,
      ends: at + duration,
    };
  });
  return { rays, confetti };
}
export const RAY_MS = 440;

/** Diameter of a card's night iris: its circle clears the card's corners (and its rim glow) at full size. */
export function irisDiameter(width: number, height: number) {
  return 1.06 * Math.hypot(width, height) + 40;
}

/** The iris's easing (wz-iris in wizard.css): it opens from B.irisStart to B.nightFull. */
const IRIS_EASE = cubicBezier(0.3, 0.62, 0.35, 1);
/** When a card's opening night iris has covered the whole box (seconds). */
export function irisArrival(card: Pick<WizardCard, 'left' | 'top' | 'width' | 'height'>, box: Box) {
  const cx = card.left + card.width / 2, cy = card.top + card.height / 2;
  const reach = Math.max(...[[box.l, box.t], [box.r, box.t], [box.l, box.b], [box.r, box.b]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
  const target = Math.min(1, reach / (irisDiameter(card.width, card.height) / 2));
  let lo: number = B.irisStart, hi: number = B.nightFull;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (IRIS_EASE(progress(mid, B.irisStart, B.nightFull)) < target) lo = mid; else hi = mid; }
  return hi;
}

/**
 * Per-cover custom properties: the cover's whole CSS timeline hangs off these. They only feed
 * ordinary properties (delays, sizes, positions), never @keyframes, so every engine picks up
 * a change right away. The stubborn card is picked out by the data-wz-stuck attribute instead.
 */
export function wizardCoverVars(card: WizardCard): Record<`--${string}`, string> {
  const ms = (seconds: number) => `${Math.round(seconds * 1000)}ms`;
  const pxs = (value: number) => `${value.toFixed(2)}px`;
  const iris = irisDiameter(card.width, card.height);
  return {
    '--wz-land': ms(card.land),
    '--wz-pop': ms(card.pop),
    '--wz-fizz': ms(card.fizz),
    '--wz-env-w': pxs(card.envW),
    '--wz-env-h': pxs(card.envH),
    '--wz-seal': pxs(card.seal),
    '--wz-left': pxs(card.left),
    '--wz-top': pxs(card.top),
    '--wz-iris': pxs(iris),
    // The iris's star field is anchored to the viewport, so the night is seamless across cards and gutters.
    '--wz-sky-x': pxs(-(card.left + card.width / 2 - iris / 2)),
    '--wz-sky-y': pxs(-(card.top + card.height / 2 - iris / 2)),
  };
}

/** Every custom property wizardCoverVars writes (so the Stage can clean them up). */
export const WIZARD_COVER_VAR_NAMES = { '--wz-land': 1, '--wz-pop': 1, '--wz-fizz': 1, '--wz-env-w': 1, '--wz-env-h': 1, '--wz-seal': 1, '--wz-left': 1, '--wz-top': 1, '--wz-iris': 1, '--wz-sky-x': 1, '--wz-sky-y': 1 } as const;

/** The latest moment any cover or Stage element is still visible (seconds). */
export function wizardLastVisible(layout: WizardLayout) {
  const covers = layout.cards.map((card) => card.pop + 0.56);
  const letters = letterPlan(layout).map((letter) => letter.ends / 1000);
  const candles = layout.candles.slots.map((slot) => slot.out + CANDLE_GONE);
  const burst = burstPlan(layout);
  const debris = [...burst.rays.map((ray) => ray.ends), ...burst.confetti.map((piece) => piece.ends)].map((ms) => ms / 1000);
  return Math.max(B.exitEnd, B.veilGone, ...covers, ...letters, ...candles, ...debris);
}

// ---------------------------------------------------------------------------
// Set dressing: floating candles and twinkles in the empty night.

function keepOut(layout: Pick<WizardLayout, 'cards' | 'star' | 'words' | 'W'>, pad: number): Box[] {
  const boxes: Box[] = layout.cards.map((card) => ({ l: card.centerX - card.envW / 2 - pad, r: card.centerX + card.envW / 2 + pad, t: card.centerY - card.envH / 2 - pad, b: card.centerY + card.envH / 2 + pad }));
  const { star, words } = layout;
  boxes.push({ l: star.x - star.r - pad, r: star.x + star.r + pad, t: star.y - star.r - pad, b: star.y + star.r + pad });
  boxes.push(wordBox(words.chant1, words.size, WIZARD_WORDS.chant1.length, pad), wordBox(words.chant2, words.size, WIZARD_WORDS.chant2.length, pad), wordBox(words.spell, words.bigSize, WIZARD_WORDS.spell.length, pad));
  return boxes;
}

/** Candles pop up this long after the night reaches their base, each a little after the one before. */
export const CANDLE_IN_LAG = 0.03;
export const CANDLE_STAGGER = 0.045;
/** A candle's pop-up (wz-candle-in, scale from the wick with an overshoot), in seconds. */
export const CANDLE_IN = 0.3;

/** Up to six candles: card gutters first, then the Today table's team column, then open sky. */
export function candleSlots(layout: Pick<WizardLayout, 'W' | 'H' | 'm' | 'cards' | 'star' | 'words'>): { width: number; slots: CandleSlot[] } {
  const { W, H, m } = layout;
  const width = clamp(0.018 * m, 12, 22), height = 3.4 * width;
  const avoid = keepOut(layout, 10);
  const columns: { l: number; r: number }[] = [];
  for (const card of [...layout.cards].sort((a, b) => a.left - b.left)) {
    const column = columns.find((c) => Math.abs(c.l - card.left) < 8);
    if (column) column.r = Math.max(column.r, card.left + card.width); else columns.push({ l: card.left, r: card.left + card.width });
  }
  const candidates: Point[] = [];
  for (let i = 1; i < columns.length; i++) {
    const gl = columns[i - 1].r, gr = columns[i].l;
    if (gr - gl >= 10) candidates.push({ x: (gl + gr) / 2, y: 0.2 * H }, { x: (gl + gr) / 2, y: 0.6 * H });
  }
  if (columns.length && columns[0].l >= 0.06 * W) candidates.push({ x: columns[0].l - 16, y: 0.2 * H }, { x: columns[0].l - 16, y: 0.6 * H });
  for (const [fx, fy] of [[0.1, 0.18], [0.9, 0.18], [0.3, 0.15], [0.7, 0.15], [0.5, 0.14], [0.1, 0.66], [0.9, 0.66]] as const) candidates.push({ x: fx * W, y: fy * H });
  const slots: CandleSlot[] = [];
  for (const p of candidates) {
    const box = { l: p.x - width * 0.6, r: p.x + width * 0.6, t: p.y - height / 2 - width * 1.4, b: p.y + height / 2 };
    if (box.t < WIZARD_HEADER_SAFE || box.b > H - WIZARD_FOOTER_SAFE || box.l < 0 || box.r > W) continue;
    if (avoid.some((a) => overlaps(box, a))) continue;
    if (slots.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 6 * width)) continue;
    // A candle floating over a card leaves just before that card pops open; gutter candles lift with the veil.
    const under = layout.cards.filter((card) => overlaps(box, { l: card.left, r: card.left + card.width, t: card.top, b: card.top + card.height }));
    // It pops up (scaling from its wick) just after the night is behind all of it, one after another: the falling
    // curtain in a gutter, or the card's night iris where it floats over a card.
    const dark = Math.max(veilArrival(box.b, H), ...under.map((card) => irisArrival(card, box)));
    const appear = +(dark + CANDLE_IN_LAG + CANDLE_STAGGER * slots.length).toFixed(3);
    slots.push({ x: p.x, y: p.y, in: appear, out: under.length ? Math.min(B.candlesOut, Math.min(...under.map((card) => card.pop)) - 0.35) : B.candlesOut });
    if (slots.length === 6) break;
  }
  return { width, slots };
}

/** Twinkling four-point stars scattered through the night, clear of the envelopes and words. */
export function twinkleSpots(layout: Pick<WizardLayout, 'W' | 'H' | 'm' | 'cards' | 'star' | 'words'> & { candles?: { width: number; slots: Point[] } }) {
  const random = seededRandom(0x57495a41);
  const avoid = keepOut(layout, 14);
  const candleBoxes = (layout.candles?.slots ?? []).map((p) => ({ l: p.x - 30, r: p.x + 30, t: p.y - 60, b: p.y + 50 }));
  const spots: { x: number; y: number; size: number; delay: number; in: number }[] = [];
  const size = clamp(0.016 * layout.m, 9, 18);
  for (let attempt = 0; attempt < 240 && spots.length < 10; attempt++) {
    const x = 0.03 * layout.W + random() * 0.94 * layout.W;
    const y = WIZARD_HEADER_SAFE + 12 + random() * (layout.H - WIZARD_HEADER_SAFE - WIZARD_FOOTER_SAFE - 24);
    const s = size * (0.7 + 0.6 * random());
    const box = { l: x - s, r: x + s, t: y - s, b: y + s };
    if (avoid.some((a) => overlaps(box, a)) || candleBoxes.some((a) => overlaps(box, a))) continue;
    if (spots.some((q) => Math.hypot(q.x - x, q.y - y) < 0.12 * layout.m)) continue;
    spots.push({ x, y, size: s, delay: Math.round(random() * 900), in: +(veilArrival(y + s, layout.H) + 0.02 + 0.03 * spots.length).toFixed(3) });
  }
  return spots;
}

/** A fixed, viewport-anchored star field shared by the veil and every cover's night patch (fractions of W, H). */
export const WIZARD_SKY: readonly { x: number; y: number; r: number; o: number }[] = (() => {
  const random = seededRandom(0x534b5953);
  return Array.from({ length: 34 }, () => ({ x: random(), y: 0.08 + random() * 0.86, r: 0.8 + random() ** 2 * 1.3, o: 0.35 + random() * 0.55 }));
})();

/** Feathers shaken loose by the poof: offsets in units of S from the owl, and their fall. */
export const FEATHERS = [
  { dx: -0.72, dy: -0.28, spin: -25, phase: 0 },
  { dx: 0.7, dy: -0.18, spin: 22, phase: 1.3 },
  { dx: -0.6, dy: 0.2, spin: 18, phase: 2.4 },
  { dx: 0.64, dy: 0.12, spin: -20, phase: 3.7 },
] as const;

/** The feathers' live window (seconds). */
export const FEATHER_START = 4.7;
export const FEATHER_END = 5.7;

/**
 * A feather pops out of the poof (scaling up from nothing, with a little overshoot), drifts and
 * falls, then shrinks away: always opaque while it is there, never a fading brown smudge.
 */
export function featherAt(i: number, time: number, layout: WizardLayout) {
  const f = FEATHERS[i];
  const origin = layout.path.G;
  const k = progress(time, FEATHER_START, FEATHER_END);
  const fall = 0.22 * layout.H * k * k;
  const drift = 0.35 * layout.S * f.dx * easeOutCubic(progress(time, FEATHER_START, 4.95));
  const alive = time >= FEATHER_START && time < FEATHER_END;
  return {
    x: origin.x + f.dx * layout.S + drift + 0.03 * layout.W * Math.sin(2 * Math.PI * time / 0.9 + f.phase),
    y: origin.y + f.dy * layout.S + fall - 0.1 * layout.S * Math.sin(Math.PI * progress(time, FEATHER_START, 4.95)),
    rot: f.spin * Math.sin(2 * Math.PI * time / 0.9 + f.phase),
    scale: alive ? easeOutBack(progress(time, FEATHER_START, 4.8)) * (1 - easeInCubic(progress(time, 5.45, FEATHER_END))) : 0,
    opacity: alive ? 1 : 0,
  };
}
