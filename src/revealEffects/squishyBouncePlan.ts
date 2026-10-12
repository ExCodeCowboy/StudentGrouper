// Squishy bounce layout planner: card rectangles in, CSS custom properties out.
// Pure (no DOM): the Stage measures once, plans once and writes the variables.
import { seededRandom } from './sceneMotion';
import { BED_POOF_DELAY, BOING_LIFT, BOING_STRETCH, DEEP_REBOUND, PANCAKE, PANCAKE_HIT, HIT_ECHO_CAP, HIT_PATTERNS, HIT_WIGGLE, LANDINGS, RECOVER, SPLAT, SPLAT_SPREAD, SPLAT_TREMBLE, BREATH, BREATHE_MIN_HEIGHT, TOSS_POP, Z_LAG, Z_STAGGER, Z_START, holdVar, type HitPattern } from './squishyBounceTimeline';

export type Box = { left: number; top: number; width: number; height: number };
/** A card rectangle; `view` is the client area of its scroll container, when it has one. */
export type Rect = Box & { view?: Box };
export type Viewport = { width: number; height: number };

export const HEADER_SAFE = 72;    // app header bottom (~66) + margin
export const FOOTER_HEIGHT = 64;  // the footer bar; its top edge is the floor
export const TONES = 6;
/** The pillow's resting insets (fractions of the card height); must match squishyBounce.css. */
export const PILLOW_INSET_TOP = .04;
export const PILLOW_INSET_BOTTOM = .025;
/** The pillow's border width (px); its face is positioned inside that border. */
export const PILLOW_BORDER = 3;
/** The buddy's feet press this far into the pillow's rim. */
export const RIM_SINK = 2;
/** When the rim has to move down to the landing line, the pillow still keeps this much of its card. */
export const MIN_PILLOW = .26;
/** Regular hops rise this share of the room between the landing line and the super-jump apex. */
export const HOP_ROOM = .5;
/** On the footer, the buddy sits this deep (in B) when a card row runs under it. */
export const FLOOR_TUCK = .1;
/** When every full-height spot on the footer would cover a label, it stays at peek depth (dome and eyes). */
export const PEEK_TUCK = .3;
/** The toss aims this far (in B) to one side of the splat, so the pancake tumbles beside the rising pillow. */
export const TOSS_SIDE = .9;
/** Clearance (px) kept around the resting buddy. */
export const REST_PAD = 6;
/** A splat-squashed cushion keeps at least this many px (its pre-stretched wide eyes stay readable), and always squashes to at most SPLAT_MAX_Y. */
export const SPLAT_MIN_PX = 34;
export const SPLAT_MAX_Y = .8;
/** A pillow face is at most this share of its cushion's height wide (its frame is half as tall). */
export const FACE_OF_CUSHION = 1.1;
/** Cards shorter than this (in B) pop like popcorn: wider drift, more spin, varied flights and a little launch jitter. */
export const POPCORN_HEIGHT = 1.2;
const ROW_TOLERANCE = 4;

export type CoverPlan = {
  /** CSS custom properties (already formatted) written once to the cover. */
  vars: Record<string, string>;
  tone: number; row: number; column: number; hits: HitPattern; hitAt: number; splatAt: number; role: 'hop' | 'echo' | 'far';
  sy: number; sx: number; ssy: number; ssx: number; fly: number; drift: number; spin: number; face: number; faceY: number; breathe: boolean;
  /** The pillow's top (its rim) and bottom, px from the card's top. */
  pillowTop: number; pillowBottom: number; lowered: boolean;
};
/** One landing: x, its hop-row column, how far the rim sinks under the feet, and `y`, the rim the feet actually touch down on
 * (the resting rim on a pillow's first hit; on a later hit the pillow is still held part-way down, at its p key). */
export type Landing = { x: number; column: number; sink: number; y: number };
/** Where the buddy rests on the footer after the plop, and how deep it tucks (in B). */
export type RestPose = { x: number; tuck: number; pose: 'rest' | 'peek'; overlap: number };
export type SquishyPlan = {
  size: number; hop: number; hopEffective: number; yLand: number; yMin: number; landings: Landing[]; pattern: number[];
  /** Set when the rims were moved down to the landing line (tall cards): the pillow top as a share of the card height. */
  lowered: number | null;
  hopRow: number[]; xMid: number; yApex: number; ySplat: number; yFloor: number; xRest: number; yRest: number; ring: number; rest: RestPose;
  /** The centre pillow the belly-flop rides: its index, bottom edge (viewport px) and the rim-to-bottom span under the feet. */
  centre: number; centreBottom: number; centreSpan: number;
  /** The ridden pillow's face bottom (viewport px) once it has BOINGed up; the tossed pancake stays below it. */
  faceUp: number;
  stageVars: Record<string, string>; covers: CoverPlan[];
};

export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const px = (value: number) => `${Math.round(value * 10) / 10}px`;
const num = (value: number) => `${Math.round(value * 1000) / 1000}`;
const msVar = (seconds: number) => `${Math.round(seconds * 1000)}ms`;

/**
 * Buddy size B and its regular hop height: clamp(60, 13 vmin, 140) px when the
 * cards are tall enough for a bigger hero (taller than 3B), else clamp(60, 11 vmin, 120).
 */
export function buddySize(viewport: Viewport, cardHeight = 0) {
  const vmin = Math.min(viewport.width, viewport.height);
  const big = Math.round(clamp(vmin * .13, 60, 140));
  const size = cardHeight > 3 * big ? big : Math.round(clamp(vmin * .11, 60, 120));
  return { size, hop: clamp(size * .7, 40, 84) };
}

/** The least a lowered pillow keeps of a card of this height. */
export const minPillow = (height: number) => Math.max(height * MIN_PILLOW, Math.min(height * .6, 48));

/** Distinct row tops (4 px tolerance), top to bottom. */
export function rowTops(rects: readonly Rect[]): number[] {
  const tops: number[] = [];
  for (const rect of [...rects].sort((a, b) => a.top - b.top)) if (!tops.some((top) => Math.abs(top - rect.top) < ROW_TOLERANCE)) tops.push(rect.top);
  return tops;
}

/** Six stepping stones in column-index space; nearest column centre, ties toward the middle. */
export function landingColumns(columns: number): number[] {
  const count = LANDINGS.length;
  return LANDINGS.map((_, k) => {
    const s = (k + .5) / count * columns - .5;
    const lower = Math.floor(s + 1e-9);
    const upper = Math.ceil(s - 1e-9);
    if (lower === upper || Math.abs(s - lower - .5) > 1e-9) return clamp(Math.round(s), 0, columns - 1);
    const middle = (columns - 1) / 2;
    return clamp(Math.abs(lower - middle) < Math.abs(upper - middle) ? lower : upper, 0, columns - 1);
  });
}

/** Horizontal landing spot inside a card (fraction of its width) for the j-th of m landings. */
export function landingFraction(j: number, m: number): number {
  if (m <= 1) return .5;
  const spread = m === 2 ? .46 : m === 3 ? .62 : .76;
  return .5 + (j / (m - 1) - .5) * spread;
}

const hitPattern = (count: number): HitPattern => (HIT_PATTERNS as readonly number[]).includes(count) ? count as HitPattern : count > 3 ? 6 : count < 1 ? 1 : count as HitPattern;

const intersect = (a: Box, b: Box): Box => {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  return { left, top, width: Math.max(0, Math.min(a.left + a.width, b.left + b.width) - left), height: Math.max(0, Math.min(a.top + a.height, b.top + b.height) - top) };
};

/** Share of a card that the class can actually see (inside its scroller, between the header and the footer). */
export function shownFraction(rect: Rect, viewport: Viewport): number {
  const area = rect.width * rect.height;
  if (area <= 0) return 0;
  const stage = { left: 0, top: HEADER_SAFE, width: viewport.width, height: viewport.height - FOOTER_HEIGHT - HEADER_SAFE };
  const seen = intersect(intersect(rect, rect.view ?? rect), stage);
  return seen.width * seen.height / area;
}

/**
 * Covers are position: fixed, so they escape a scrolling table. A cover cut by
 * its scroller gets a clip polygon on the cut sides only (the open sides reach
 * far out, so pillows can still fly away); one scrolled fully out is hidden.
 */
export function coverClip(rect: Rect): `polygon(${string})` | 'hidden' | null {
  if (!rect.view) return null;
  const seen = intersect(rect, rect.view);
  if (seen.width < 1 || seen.height < 1) return 'hidden';
  const cut = { left: seen.left - rect.left, top: seen.top - rect.top, right: rect.left + rect.width - seen.left - seen.width, bottom: rect.top + rect.height - seen.top - seen.height };
  if (Math.max(cut.left, cut.top, cut.right, cut.bottom) < .5) return null;
  const far = 4000;
  const x0 = cut.left >= .5 ? cut.left : -far;
  const y0 = cut.top >= .5 ? cut.top : -far;
  const x1 = cut.right >= .5 ? rect.width - cut.right : rect.width + far;
  const y1 = cut.bottom >= .5 ? rect.height - cut.bottom : rect.height + far;
  const p = (value: number) => `${Math.round(value * 10) / 10}px`;
  return `polygon(${p(x0)} ${p(y0)}, ${p(x1)} ${p(y0)}, ${p(x1)} ${p(y1)}, ${p(x0)} ${p(y1)})`;
}

/** The buddy's box while it rests on the footer at x (its jiggle, wobble and a little padding included), px. */
export function restBox(x: number, size: number, yFloor: number, tuck: number): Box {
  const half = size * .55 + REST_PAD;
  const top = yFloor + tuck * size - size * 1.1 - 12 - REST_PAD;
  return { left: x - half, top, width: 2 * half, height: yFloor - top };
}

/** The screen band the Stage scans for labels: every rest box of any buddy size lies inside it. */
export function restBand(viewport: Viewport) {
  const yFloor = viewport.height - FOOTER_HEIGHT;
  const size = Math.max(buddySize(viewport, Infinity).size, buddySize(viewport, 0).size);
  return { top: restBox(0, size, yFloor, 0).top - 2, bottom: yFloor };
}

const overlapArea = (a: Box, b: Box) => { const s = intersect(a, b); return s.width * s.height; };

/** Free x positions (intervals of the box centre) in [low, high] where a rest box at this tuck touches no obstacle. */
export function freeRestSpans(obstacles: readonly Box[], size: number, yFloor: number, tuck: number, low: number, high: number): [number, number][] {
  const probe = restBox(0, size, yFloor, tuck);
  const half = probe.width / 2;
  const blocked = obstacles.filter((o) => o.width > 0 && o.height > 0 && o.top < yFloor && o.top + o.height > probe.top)
    .map((o): [number, number] => [o.left - half, o.left + o.width + half]).sort((a, b) => a[0] - b[0]);
  const free: [number, number][] = [];
  let cursor = low;
  for (const [start, end] of blocked) {
    if (start > cursor) free.push([cursor, Math.min(start, high)]);
    cursor = Math.max(cursor, end);
    if (cursor >= high) break;
  }
  if (cursor < high) free.push([cursor, high]);
  return free.filter(([start, end]) => end >= start);
}

/**
 * The resting spot on the footer: the clear spot nearest a point TOSS_SIDE x B to either side of the splat (right on ties).
 * No clear full-height spot: peek depth. Nothing clear even then: the peek spot that covers the least.
 */
export function planRest(obstacles: readonly Box[], size: number, yFloor: number, vw: number, xMid: number, cardsUnder: boolean): RestPose {
  const low = size * .6 + 12;
  const high = Math.max(low, vw - size * .6 - 12);
  const targets = [xMid + TOSS_SIDE * size, xMid - TOSS_SIDE * size].map((target) => clamp(target, low, high));
  const pick = (tuck: number) => {
    let best: { x: number; cost: number } | null = null;
    for (const target of targets) for (const [start, end] of freeRestSpans(obstacles, size, yFloor, tuck, low, high)) {
      const x = clamp(target, start, end);
      const cost = Math.abs(x - target);
      if (!best || cost < best.cost - 1e-6) best = { x, cost };
    }
    return best;
  };
  const tuck = cardsUnder ? FLOOR_TUCK : 0;
  const full = pick(tuck);
  if (full) return { x: full.x, tuck, pose: 'rest', overlap: 0 };
  const peek = pick(PEEK_TUCK);
  if (peek) return { x: peek.x, tuck: PEEK_TUCK, pose: 'peek', overlap: 0 };
  let best = { x: targets[0], overlap: Infinity, cost: Infinity };
  for (let x = low; x <= high + 1e-6; x += 4) {
    const box = restBox(x, size, yFloor, PEEK_TUCK);
    const overlap = obstacles.reduce((sum, o) => sum + overlapArea(box, o), 0);
    const cost = Math.min(...targets.map((target) => Math.abs(x - target)));
    if (overlap < best.overlap - 1e-6 || (Math.abs(overlap - best.overlap) <= 1e-6 && cost < best.cost)) best = { x, overlap, cost };
  }
  return { x: best.x, tuck: PEEK_TUCK, pose: 'peek', overlap: best.overlap };
}

/**
 * Plans the whole reveal. `obstacles` are the labels (text, icons, badges) the Stage found in the footer band,
 * in viewport px: the buddy never rests on one after the reveal.
 */
export function planSquishyBounce(all: readonly Rect[], viewport: Viewport, obstacles: readonly Box[] = []): SquishyPlan {
  const vw = Math.max(1, viewport.width);
  const vh = Math.max(1, viewport.height);
  // Only cards the class can mostly see take part in choosing the hop row (a column half scrolled away never gets a landing).
  const visible = all.filter((r) => shownFraction(r, { width: vw, height: vh }) >= .5);
  const pool = visible.length ? visible : all.filter((r) => r.width > 0 && r.height > 0);
  const heights = pool.map((r) => r.height).sort((a, b) => a - b);
  const { size, hop } = buddySize({ width: vw, height: vh }, heights[Math.floor(heights.length / 2)] ?? 0);
  const yFloor = vh - FOOTER_HEIGHT;
  const yApex = HEADER_SAFE + 10 + size;
  const yMin = Math.max(vh * .36, yApex + hop * 1.8);
  const yMax = vh * .62;
  const tops = rowTops(pool);
  const inRow = (rect: Rect, top: number) => Math.abs(rect.top - top) < ROW_TOLERANCE;
  const yPreferred = Math.max(yMin, vh * .42);
  /**
   * The buddy always stands on a pillow's rim. When a row's resting rim hides
   * too close to the header (a single tall row, the top row of a grid), the
   * pillows move down so their rim meets the landing line: a plump cushion in
   * the lower part of the card, under an empty headboard.
   */
  const landOn = (top: number, height: number): { y: number; lowered: boolean } => {
    const natural = top + height * PILLOW_INSET_TOP + RIM_SINK;
    if (natural >= yMin - .5) return { y: natural, lowered: false };
    const deepest = top + height * (1 - PILLOW_INSET_BOTTOM) - minPillow(height) + RIM_SINK;
    const y = clamp(yPreferred, natural, Math.max(natural, deepest));
    return { y, lowered: y > natural + .5 };
  };

  // Hop row: landing line nearest 42% of the screen, inside [yMin, 62%], holding >= 60% of the widest row, preferably with resting pillows.
  const widths = tops.map((top) => pool.filter((r) => inRow(r, top)).length);
  const widest = Math.max(1, ...widths);
  let best = { top: NaN, y: yPreferred, lowered: false, score: Infinity };
  tops.forEach((top, index) => {
    const rect = pool.find((r) => inRow(r, top))!;
    const { y, lowered } = landOn(top, rect.height);
    const fits = y >= yMin - .5 && y <= yMax;
    const wideEnough = widths[index] >= Math.ceil(widest * .6);
    // A row whose pillows can stay at rest beats one whose pillows must move down.
    const score = Math.abs(y - vh * .42) + (lowered ? 1000 : 0) + (fits ? 0 : 5000) + (wideEnough ? 0 : 100000);
    if (score < best.score) best = { top, y, lowered, score };
  });
  const yLand = best.y;
  const hopRow = Number.isNaN(best.top) ? [] : pool.filter((r) => inRow(r, best.top)).sort((a, b) => a.left - b.left);
  const lowered = best.lowered && hopRow.length ? (yLand - RIM_SINK - best.top) / hopRow[0].height : null;
  /** Pillow box in card px: resting insets, or moved down to the landing line (the same share of every card, so the grid stays even). */
  const pillowOf = (r: Box) => {
    const bottom = r.height * (1 - PILLOW_INSET_BOTTOM);
    const top = lowered === null ? r.height * PILLOW_INSET_TOP : clamp(lowered * r.height, r.height * PILLOW_INSET_TOP, bottom - minPillow(r.height));
    return { top, bottom, height: Math.max(1, bottom - top) };
  };

  const C = Math.max(1, hopRow.length);
  const columnOf = landingColumns(C);
  const counts = Array.from({ length: C }, (_, c) => columnOf.filter((x) => x === c).length);
  const baseDip = clamp(vh * .13, 28, 120);
  const dipScale = (c: number) => (.85 + .3 * (C > 1 ? c / (C - 1) : 1)) * (c === C - 1 ? 1.25 : 1);
  /** Hop squash: a pixel dip, at most 45% of the pillow. Pillows squash about their own bottom edge. */
  const squashY = (pillow: number, c: number) => 1 - Math.min(.45, baseDip * dipScale(c) / Math.max(1, pillow));
  /** Splat squash: a big flatten, but a squashed cushion always keeps SPLAT_MIN_PX, so its wide-eyed hold face still reads. */
  const splatSquashY = (pillow: number) => Math.min(SPLAT_MAX_Y, Math.max(1 - Math.min(.64, vh * .4 / Math.max(1, pillow)), SPLAT_MIN_PX / Math.max(1, pillow)));

  const landings: Landing[] = columnOf.map((c, k) => {
    const rect = hopRow[c];
    if (!rect) return { x: vw * (k + .5) / LANDINGS.length, column: c, sink: 0, y: yLand };
    const j = columnOf.slice(0, k).filter((x) => x === c).length;
    const pillow = pillowOf(rect);
    const bottom = rect.top + pillow.bottom;
    const sy = squashY(pillow.height, c);
    // A later hit catches the pillow still held at its p key (the same rounded value the cover animates to), so the rim is lower.
    const py = Number(num(1 - (1 - sy) * (1 - RECOVER.p)));
    return { x: rect.left + rect.width * landingFraction(j, counts[c]), column: c, sink: (bottom - yLand) * (1 - sy), y: j === 0 ? yLand : bottom - (bottom - yLand) * py };
  });
  const centreOf = (r: Rect) => r.left + r.width / 2;
  const xMid = hopRow.length ? (centreOf(hopRow[0]) + centreOf(hopRow[C - 1])) / 2 : vw / 2;
  const hopEffective = Math.max(16, Math.min(hop, HOP_ROOM * (yLand - yApex)));

  // The belly-flop lands on the pillow nearest xMid and rides it down to ySplat.
  const centre = hopRow.length ? hopRow.reduce((a, b) => Math.abs(centreOf(a) - xMid) <= Math.abs(centreOf(b) - xMid) ? a : b) : undefined;
  const centrePillow = centre ? pillowOf(centre) : undefined;
  // Squashed about its bottom edge, the rim under the feet sits at bottom - span * scaleY; the buddy's Y rides it through the whole hold.
  const centreBottom = centre && centrePillow ? centre.top + centrePillow.bottom : yLand;
  const centreSpan = Math.max(0, centreBottom - yLand);
  const centreSsy = centrePillow ? splatSquashY(centrePillow.height) : 1;
  const rimAt = (scaleY: number) => centreBottom - centreSpan * scaleY;
  const ySplat = rimAt(centreSsy);
  // Centre-outward squash wave from the splat point (where the shock ring is drawn) to each card's nearest point.
  const distance = (r: Rect) => Math.hypot(Math.max(r.left - xMid, 0, xMid - r.left - r.width), 1.2 * Math.max(r.top - ySplat, 0, ySplat - r.top - r.height));
  // (At least 3B, so a single card still gets a visible ring.)
  const ring = Math.max(size * 3, ...pool.map(distance));
  /** Half the belly-flop's width at impact. */
  const pancakeHalf = PANCAKE_HIT[0] * size / 2;

  const allTops = rowTops(all);
  const hopRowIndex = Number.isNaN(best.top) ? 0 : allTops.findIndex((top) => Math.abs(top - best.top) < ROW_TOLERANCE);
  const pitch = C > 1 ? (hopRow[C - 1].left - hopRow[0].left) / (C - 1) : (hopRow[0]?.width ?? vw);
  // Pillow faces stay a supporting cast: never much bigger than the buddy.
  const faceCap = Math.min(Math.max(170, Math.min(vw, vh) * .2), size * 1.6);
  const rowOf = (r: Rect) => Math.max(0, allTops.findIndex((top) => Math.abs(top - r.top) < ROW_TOLERANCE));
  // Up to six cards: every bed gets its own colour, in reading order (a 3 + 1 or 3 x 2 grid never repeats one).
  // Bigger grids step two tones per row, so edge neighbours always differ.
  const readingRank = new Map(all.length <= TONES ? [...all.keys()].sort((a, b) => rowOf(all[a]) - rowOf(all[b]) || all[a].left - all[b].left).map((index, rank) => [index, rank]) : []);

  const covers = all.map((r, index): CoverPlan => {
    const random = seededRandom(0x5b0 + index * 7919);
    const cx = centreOf(r);
    const pillow = pillowOf(r);
    let column = hopRow.length ? hopRow.reduce((bestColumn, h, c) => Math.abs(centreOf(h) - cx) < Math.abs(centreOf(hopRow[bestColumn]) - cx) ? c : bestColumn, 0) : 0;
    const aligned = hopRow.length > 0 && Math.abs(centreOf(hopRow[column]) - cx) < pitch * .45;
    const row = rowOf(r);
    const rowDistance = Math.abs(row - hopRowIndex);
    let hits = hitPattern(counts[column] ?? 1);
    let first = columnOf.indexOf(column);
    let delay = 0; let amplitude = 1; let role: CoverPlan['role'] = 'hop';
    if (!aligned || first < 0) {
      // A column the buddy skips (7+ rounds) or an off-grid card: echo the nearest landing, delayed by distance.
      role = 'far'; hits = 1;
      const nearest = landings.reduce((a, landing, k) => Math.abs(landing.x - cx) < Math.abs(landings[a].x - cx) ? k : a, 0);
      first = nearest; column = landings[nearest].column; delay = Math.abs(landings[nearest].x - cx) / 1000; amplitude = .5;
    }
    if (rowDistance > 0) {
      if (role === 'hop') role = 'echo';
      delay += .07 * Math.min(rowDistance, 4);
      amplitude *= rowDistance === 1 ? .55 : rowDistance === 2 ? .35 : .22;
    }
    delay = Math.min(HIT_ECHO_CAP, delay);
    const width = Math.max(1, r.width);
    // Squash keeps some volume by bulging sideways, but never more than ~30 px per side.
    const sy = 1 - (1 - squashY(pillow.height, column)) * amplitude;
    const sx = 1 + Math.min((1 - sy) * .4, 60 / width);
    const recovered = (f: number) => [1 + (sx - 1) * (1 - f), 1 - (1 - sy) * (1 - f)];
    const ssy = splatSquashY(pillow.height);
    const ssx = 1 + Math.min((1 - ssy) * .35, 70 / width);
    const tremble = Math.min(1, 300 / width);
    const wiggle = Math.min(1, 320 / width);
    const hitAt = LANDINGS[first] + delay;
    // Short cells (a Today table) pop like popcorn: a checkerboard of drift directions, more spin, varied flights, a little launch jitter.
    const popcorn = r.height < POPCORN_HEIGHT * size;
    const near = distance(r) <= Math.max(size, ring * .1);
    const jitter = popcorn && !near ? (random() < .5 ? -1 : 1) * (.02 + .03 * random()) : 0;
    // The pillows under the pancake (the ridden one and, on an even row, its neighbour) squash exactly at SPLAT; the rest follow the ring outward.
    const underPancake = r === centre || (hopRow.includes(r) && r.left < xMid + pancakeHalf && r.left + r.width > xMid - pancakeHalf);
    const splatAt = underPancake ? SPLAT : clamp(SPLAT + SPLAT_SPREAD * Math.min(1, distance(r) / ring) + jitter, SPLAT, SPLAT + SPLAT_SPREAD);
    const sign = popcorn ? ((row + column) % 2 ? 1 : -1) : index % 2 ? 1 : -1;
    const fly = -Math.max(80, r.top + r.height * 1.4 + 80) * (popcorn ? 1 + .12 * (row % 3) + .12 * random() : 1);
    const drift = popcorn ? sign * (.2 + .25 * random()) * r.width : sign * (10 + index * 23 % 20);
    const spin = popcorn ? sign * (8 + 12 * random()) : sign * (5 + (index * 37 % 7));
    // Sleepy breathing settles on the rest pose exactly when this pillow is first hit (an even number of half-breaths ending at hitAt).
    const cycles = Math.max(1, Math.ceil(hitAt / (2 * BREATH) - 1e-9));
    const side = clamp(pillow.height * .075, 5, 20);
    // Short cushions (Today cells, lowered cushions) get a face as tall as fits (half its width), so the squashed hold faces still read.
    const face = Math.round(clamp(Math.min(r.width * .55, pillow.height * FACE_OF_CUSHION, 2 * (pillow.height - side - 8), faceCap), 32, Math.max(32, faceCap)) / 2) * 2;
    const eye = face * .17;
    // Face centred on the pillow's front (a little low on tall pillows), clear of the rim and the bottom band.
    const tall = pillow.height > r.width * .54;
    const faceY = clamp(pillow.top + pillow.height * (tall ? .567 : .513), pillow.top + face / 4 + 2, pillow.bottom - side - face / 4 - 2);
    const vars: Record<string, string> = {
      '--sq-hit-at': msVar(hitAt), '--sq-splat-at': msVar(splatAt), '--sq-bed-at': msVar(splatAt + BED_POOF_DELAY), '--sq-breathe-at': msVar(hitAt - 2 * BREATH * cycles), '--sq-breaths': String(2 * cycles), '--sq-z-at': msVar(Z_START + (index % 3) * Z_STAGGER), '--sq-z2-at': msVar(Z_START + (index % 3) * Z_STAGGER + Z_LAG),
      '--sq-sx': num(sx), '--sq-sy': num(sy),
    };
    for (const [key, f] of Object.entries(RECOVER)) { const [x, y] = recovered(f); vars[`--sq-${key}x`] = num(x); vars[`--sq-${key}y`] = num(y); }
    HIT_WIGGLE.forEach((deg, k) => { vars[`--sq-r${k + 1}`] = `${num(deg * wiggle)}deg`; });
    vars['--sq-ssx'] = num(ssx); vars['--sq-ssy'] = num(ssy);
    for (const [key, [dx, dy]] of Object.entries(SPLAT_TREMBLE)) { vars[`--sq-${key}x`] = num(ssx + dx * tremble); vars[`--sq-${key}y`] = num(ssy + dy); }
    Object.assign(vars, {
      '--sq-fly': px(fly), '--sq-fly0': px(fly * BOING_LIFT), '--sq-spin': `${num(spin)}deg`, '--sq-drift': px(drift),
      '--sq-spin0': `${num(popcorn ? spin * .7 : 0)}deg`, '--sq-drift0': px(popcorn ? drift * .4 : 0),
      '--sq-face': `${face}px`, '--sq-fh': `${face / 2}px`, '--sq-e': px(eye), '--sq-stroke': px(Math.max(2, eye * .22)),
      '--sq-radius': px(clamp(Math.min(r.width * .9, pillow.height) * .26, 16, 72)), '--sq-side': px(side),
      '--sq-bed-radius': px(clamp(Math.min(r.width, r.height) * .09, 12, 26)), '--sq-face-y': px(faceY - pillow.top - PILLOW_BORDER), '--sq-pillow-top': px(pillow.top),
      '--sq-appl': px(clamp(Math.min(r.width * .78, pillow.top - r.height * .07) * .34, 24, 84)),
    });
    const toneColumn = hopRow.length ? column : index;
    return {
      vars, tone: readingRank.get(index) ?? ((toneColumn + 2 * row) % TONES + TONES) % TONES, row, column, hits, hitAt, splatAt, role, sy, sx, ssy, ssx, fly, drift, spin, face, faceY, breathe: r.height >= BREATHE_MIN_HEIGHT,
      pillowTop: pillow.top, pillowBottom: pillow.bottom, lowered: lowered !== null && pillow.top > r.height * PILLOW_INSET_TOP + .5,
    };
  });

  // After the plop the buddy rests on the footer edge, clear of every label (the obstacles the Stage measured) and a little to one
  // side of the splat. It tucks a little lower when a card row runs under the footer, and to peek depth when no full spot is clear.
  const cardsUnder = all.some((r) => { const s = r.view ? intersect(r, r.view) : r; return s.width > 0 && s.top < yFloor - 4 && s.top + s.height > yFloor + 4; });
  const rest = planRest(obstacles, size, yFloor, vw, xMid, cardsUnder);
  const xRest = rest.x;
  const yRest = yFloor + rest.tuck * size;
  const yst5 = rimAt(centreSsy + SPLAT_TREMBLE.t5[1]);
  // The toss pops the pancake up a little, but never higher than keeps it below the ridden pillow's face once that
  // pillow has BOINGed up (on a short cushion it just slides off instead).
  const ridden = centre ? covers[all.indexOf(centre)] : undefined;
  const faceUp = centre && ridden ? centreBottom + ridden.fly * BOING_LIFT - (centreBottom - (centre.top + ridden.faceY + ridden.face / 4)) * BOING_STRETCH[1] : -Infinity;
  const pancakeHeight = size * PANCAKE[1] * 1.1;
  const yToss = Math.min(Math.max(Math.min(yst5, yFloor) - size * TOSS_POP, faceUp + pancakeHeight + 6), yFloor - pancakeHeight);
  const xPeek = Math.max(size * .7, landings[0].x - size * 1.3);
  const stageVars: Record<string, string> = {
    '--sqb-size': `${size}px`, '--sqb-xpeek': px(xPeek), '--sqb-xm': px(xMid), '--sqb-xrest': px(xRest),
    ...Object.fromEntries(landings.map((landing, k) => [`--sqb-x${k + 1}`, px(landing.x)])),
    ...Object.fromEntries(landings.map((landing, k) => [`--sqb-ys${k + 1}`, px(yLand + landing.sink)])),
    ...Object.fromEntries(landings.map((landing, k) => [`--sqb-yl${k + 1}`, px(landing.y)])),
    // Impact strokes start on the rim the feet touch and ride it down to the bottom of the sink.
    ...Object.fromEntries(landings.map((landing, k) => [`--sqb-d${k + 1}`, px(yLand + landing.sink - landing.y)])),
    '--sqb-ys6to': px(yLand + landings[5].sink * (1 - DEEP_REBOUND)),
    '--sqb-yhide': px(yFloor + size * 1.25), '--sqb-ypeek': px(yFloor + size * .1), '--sqb-yentry': px(Math.max(yApex, yLand - size * .9)),
    '--sqb-yland': px(yLand), '--sqb-yhop': px(yLand - hopEffective), '--sqb-yapex': px(yApex), '--sqb-yfloat': px(yApex - 5),
    '--sqb-ysplat': px(ySplat), '--sqb-ytoss': px(yToss), '--sqb-yfloor': px(yFloor), '--sqb-yrest': px(yRest), '--sqb-ywob': px(yRest - 12),
    '--sqb-yduck': px(yRest + size * 1.4 + 10), '--sqb-ring': px(ring), '--sqb-flip': `${xRest < xMid - .5 ? -360 : 360}deg`,
    ...Object.fromEntries(Object.entries(SPLAT_TREMBLE).map(([key, [, dy]]) => [`--sqb-${holdVar(key as keyof typeof SPLAT_TREMBLE)}`, px(rimAt(centreSsy + dy))])),
  };
  return {
    size, hop, hopEffective, yLand, yMin, landings, pattern: counts, lowered, hopRow: hopRow.map((r) => all.indexOf(r)), xMid, yApex, ySplat, yFloor, xRest, yRest, ring, rest,
    centre: centre ? all.indexOf(centre) : -1, centreBottom, centreSpan, faceUp, stageVars, covers,
  };
}

/** Cover variables that start animations; a resize never rewrites them, so nothing replays. */
export const TIMING_VARS: readonly string[] = ['--sq-hit-at', '--sq-splat-at', '--sq-bed-at', '--sq-breathe-at', '--sq-breaths', '--sq-z-at', '--sq-z2-at'];
/** Everything else (geometry and squash amounts) is safe to rewrite on resize, so pillows and the buddy's sinks stay in step. */
export const geometryVars = (vars: Record<string, string>) => Object.keys(vars).filter((name) => !TIMING_VARS.includes(name));

export function varsToCss(vars: Record<string, string>, only?: readonly string[]) {
  let css = '';
  for (const name of only ?? Object.keys(vars)) if (vars[name] !== undefined) css += `${name}:${vars[name]};`;
  return css;
}
