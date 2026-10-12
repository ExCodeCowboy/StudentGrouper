/**
 * Hard dot-to-dot: choreography, geometry and numbering. Pure: no DOM, CSS or React,
 * so tests can import it. Every picture shares the same beat times (and so one sound).
 *
 * The guessing game: the page that appears first holds only detail and scenery dots. The
 * outline is numbered last and its dots appear just ahead of the pencil (AHEAD_WINDOW dots at
 * a time), so the picture only becomes recognisable in the last stretch before the snap.
 */
import { clamp01, easeInCubic, easeOutBack, easeOutCubic, fadeWindow, keyframes, mix, progress, seededRandom, smooth } from './sceneMotion';

export const DOT_TO_DOT_DURATION_MS = 8000;
/** The page every picture is drawn on (matches PAGE_WIDTH x PAGE_HEIGHT in dotToDotPictures). */
const PAGE_W = 1000;
const PAGE_H = 620;

/** Beat times in seconds from mount. Identical for every picture. */
export const DOT_BEATS = {
  washIn: 0, washFull: .3,
  bannerIn: .08,
  dotsIn: .1, dotsFull: .8,
  pencilIn: .45, firstHit: 1.0,
  /** Slow chant: the first moves are read aloud ("2! 4! 6! 8! 10!"). */
  slowEnd: 2.35,
  /**
   * Whoosh through the details and scenery, hopping between them, then the big lift: the pencil
   * flies to the outline's star while its dots sprout. The lift starts between liftEarliest and
   * liftLatest (per picture, see balanceLift) and takes LIFT_SECONDS.
   */
  liftEarliest: 3.65, liftLatest: 4.45,
  /** The outline races round, easing off as it nears the part that gives it away. */
  suspense: 5.4,
  snap: 6.0,
  fillEnd: 6.45,
  alive: 6.4,
  coversOut: 6.75,
  coversGone: 7.85,
  /** Everything has gone by coversGone: a short safety fade, then the end (no dead air after the names are clear). */
  stageOut: 7.88,
  end: 8.0,
} as const;

/** The come-alive choreography is authored against a snap at 5.6 s; this shifts it onto DOT_BEATS.snap. */
export const ALIVE_SHIFT = DOT_BEATS.snap - 5.6;
const aliveTime = (time: number) => time - ALIVE_SHIFT;

/**
 * How each picture clears the sheets (ms from mount). A sheet leaves at start + stagger x spread,
 * where stagger is its left-to-right order (0..1) or its distance from the centre column (0..1).
 */
export const COVER_EXITS = {
  whale: { start: 7000, spread: 280, duration: 560, stagger: 'order' },
  train: { start: 6720, spread: 440, duration: 680, stagger: 'order' },
  rocket: { start: 6820, spread: 300, duration: 700, stagger: 'radial' },
  butterfly: { start: 6820, spread: 180, duration: 840, stagger: 'radial' },
} as const;

/**
 * The scenery leaves with the sheets under it, never after: each piece pops away as the sheets at
 * its place on the page start to leave (the same left-to-right or centre-out stagger), sky pieces
 * a beat early and ground pieces a beat late, and is gone before the names under it show.
 */
export const SCENERY_EXIT = { pop: .24, skyLead: .04, groundLag: .04 } as const;
export function sceneryLeavesAt(id: keyof typeof COVER_EXITS, x: number, ground = false) {
  const exit = COVER_EXITS[id];
  const stagger = exit.stagger === 'order' ? clamp01(x / 1000) : clamp01(Math.abs(x - 500) / 500);
  return (exit.start + stagger * exit.spread) / 1000 + (ground ? SCENERY_EXIT.groundLag : -SCENERY_EXIT.skyLead);
}
/** Real times: the ground bands (snowy hill, garden lawn) drain away once nothing stands on them. */
export const ROCKET_HILL_DRAIN = { start: 7.16, end: 7.4 } as const;
export const GARDEN_DRAIN = { start: 7.1, end: 7.34 } as const;
/**
 * The train's track rolls up behind it as it leaves (page x of the track's left end, real time):
 * never under the wheels, and gone from each card's spot as that card's sheet leaves.
 */
export function trackStart(time: number) {
  const behindTrain = TRAIN_REAR_WHEEL - 24 + trainX(time);
  const withSheets = (time - (COVER_EXITS.train.start / 1000 + .25)) / (COVER_EXITS.train.spread / 1000) * 1000;
  return time < ALIVE_SHIFT + 6.3 ? -700 : Math.max(-700, Math.min(behindTrain, withSheets));
}
/** A piece of scenery's exit progress (0 = in place, 1 = gone). */
export const sceneryExit = (time: number, id: keyof typeof COVER_EXITS, x: number, ground = false) => {
  const at = sceneryLeavesAt(id, x, ground);
  return progress(time, at, at + SCENERY_EXIT.pop);
};
/** A pop exit: a little swell, then it shrinks to nothing (a scale, never a see-through ghost). */
export const popAway = (q: number) => q <= 0 ? 1 : q >= 1 ? 0 : q < .28 ? 1 + .14 * easeOutCubic(q / .28) : 1.14 * (1 - easeInCubic((q - .28) / .72));
/** Ground bands (sea, grass, snow, rails) drain down out of the frame: a tiny lift, then down (page units). */
export const drainAway = (q: number, depth = 340) => q <= 0 ? 0 : -10 * Math.sin(clamp01(q / .3) * Math.PI) + depth * easeInCubic(clamp01(q));

/** Intervals (s) of the first moves, slow enough to chant along. */
export const SLOW_INTERVALS = [.38, .35, .32, .30] as const;
/** The last draw moves slow down, then the pencil hovers and snaps the outline closed. */
export const SUSPENSE_INTERVALS = [.1, .2, .3] as const;
/** Lift-the-pencil hops between detail strokes get quicker as the pencil warms up. */
export const HOP_SECONDS = .13;
const HOP_DECAY = .78;
export const HOP_MIN = .07;
/** Page units per second: the fastest a lifted pencil travels between strokes, on average (its peak is 1.25x: see hopEase). */
export const HOP_SPEED = 4000;
const RAMP_START = .15;
const RAMP_RATIO = .5;
/** Outline speed runs from fast to slower (multipliers of its solved cruise speed). */
const OUTLINE_FAST = 1.35;
const OUTLINE_SLOW = .7;
/** How many outline dots are showing ahead of the pencil. */
export const AHEAD_WINDOW = 9;
/** A reached dot pulses red for up to HIT_PULSE s (the chant), down to HIT_PULSE_MIN s at full speed. */
export const HIT_PULSE = .52;
export const HIT_PULSE_MIN = .15;
export const LIFT_SECONDS = .3;
/** An outline dot is always showing at least this long before the pencil reaches it. */
const AHEAD_LEAD = .16;

export type Pt = { x: number; y: number };
export type DotRole = 'detail' | 'scenery' | 'outline';
export type Region = { x0: number; y0: number; x1: number; y1: number };
export type SegmentSpec = {
  d: string; spacing: number; closed?: boolean; role: DotRole;
  /** 'ahead': hidden until the pencil comes near (the outline). Default: printed on the page from the start. */
  reveal?: 'ahead';
  /** With reveal 'ahead': the fraction of the stroke (from its star) that is printed on the page anyway. */
  printed?: number;
  /** Open segments: which side labels prefer (1 = left of travel). */
  side?: 1 | -1;
};
export type PictureSpec = {
  id: string; name: string;
  /** Shown when the picture is finished: "It's a whale!" */
  answer: string;
  step: 2 | 5;
  /** Where the give-away part of the outline is (flukes, smokestack, nose cone, upper wings). */
  key: Region;
  segments: readonly SegmentSpec[];
};

// ---------------------------------------------------------------- path sampling

type Command = { type: string; values: number[] };

function parsePath(d: string): Command[] {
  const tokens = d.match(/[MLHVCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const commands: Command[] = [];
  for (const token of tokens) {
    if (/^[A-Z]$/i.test(token)) commands.push({ type: token.toUpperCase(), values: [] });
    else commands[commands.length - 1].values.push(Number(token));
  }
  return commands;
}

const distance = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function curvePoints(from: Pt, command: Command): ((t: number) => Pt)[] {
  const v = command.values;
  const pieces: ((t: number) => Pt)[] = [];
  let start = from;
  const size = { L: 2, H: 1, V: 1, C: 6, Q: 4 }[command.type as 'L'] ?? 2;
  for (let i = 0; i + size <= v.length; i += size) {
    const p0 = start;
    let fn: (t: number) => Pt;
    if (command.type === 'L') { const p1 = { x: v[i], y: v[i + 1] }; fn = (t) => ({ x: mix(p0.x, p1.x, t), y: mix(p0.y, p1.y, t) }); }
    else if (command.type === 'H') { const p1 = { x: v[i], y: p0.y }; fn = (t) => ({ x: mix(p0.x, p1.x, t), y: p0.y }); }
    else if (command.type === 'V') { const p1 = { x: p0.x, y: v[i] }; fn = (t) => ({ x: p0.x, y: mix(p0.y, p1.y, t) }); }
    else if (command.type === 'Q') {
      const c = { x: v[i], y: v[i + 1] }; const p1 = { x: v[i + 2], y: v[i + 3] };
      fn = (t) => ({ x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * c.x + t * t * p1.x, y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * c.y + t * t * p1.y });
    } else {
      const c1 = { x: v[i], y: v[i + 1] }; const c2 = { x: v[i + 2], y: v[i + 3] }; const p1 = { x: v[i + 4], y: v[i + 5] };
      fn = (t) => { const u = 1 - t; return { x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x, y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y }; };
    }
    pieces.push(fn);
    start = fn(1);
  }
  return pieces;
}

/** Evenly spaced dots along each drawing command; every command's end point (a corner) is a dot. */
export function samplePath(d: string, spacing: number, closed = false): Pt[] {
  const commands = parsePath(d);
  const points: Pt[] = [];
  let current: Pt = { x: 0, y: 0 };
  let first: Pt = current;
  const addPiece = (fn: (t: number) => Pt, includeEnd: boolean) => {
    const steps = 64;
    const table: { t: number; length: number; point: Pt }[] = [{ t: 0, length: 0, point: fn(0) }];
    for (let i = 1; i <= steps; i++) { const point = fn(i / steps); table.push({ t: i / steps, length: table[i - 1].length + distance(table[i - 1].point, point), point }); }
    const total = table[steps].length;
    const count = Math.max(1, Math.round(total / spacing));
    for (let i = 1; i <= count; i++) {
      if (i === count && !includeEnd) break;
      const target = total * i / count;
      let j = 1;
      while (j < steps && table[j].length < target) j++;
      const a = table[j - 1]; const b = table[j];
      const t = mix(a.t, b.t, (target - a.length) / Math.max(1e-9, b.length - a.length));
      points.push(fn(t));
    }
    current = fn(1);
  };
  for (const command of commands) {
    if (command.type === 'M') { current = { x: command.values[0], y: command.values[1] }; first = current; points.push(current); continue; }
    if (command.type === 'Z') { if (distance(current, first) > spacing * .35) addPiece((t) => ({ x: mix(current.x, first.x, t), y: mix(current.y, first.y, t) }), false); continue; }
    for (const piece of curvePoints(current, command)) addPiece(piece, true);
  }
  if (closed && points.length > 2 && distance(points[points.length - 1], points[0]) < spacing * .35) points.pop();
  return points.map(({ x, y }) => ({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }));
}

// ---------------------------------------------------------------- numbering

/** Skip counting by 2s or 5s: never 67, never "6, 7", never a run through "5, 6, 7". */
export const dotLabel = (index: number, step: number) => step * (index + 1);

export function labelsAreClassroomSafe(labels: readonly number[]): boolean {
  return labels.every((label, i) => {
    const next = labels[i + 1];
    const after = labels[i + 2];
    const counts = (a: number, b: number) => b === a + 1;
    return !String(label).includes('67') &&
      !(label % 10 === 6 && next !== undefined && counts(label, next)) &&
      !(label % 10 === 5 && next !== undefined && after !== undefined && counts(label, next) && counts(next, after));
  });
}

// ---------------------------------------------------------------- label placement

export type Dot = Pt & {
  index: number; segment: number; label: number; labelX: number; labelY: number;
  /** Seconds from mount when the dot pops onto the page, and when the pencil first reaches it. */
  appear: number; hit: number;
  /** How long its hit pulse lasts: shorter when the pencil is racing, so red numbers don't pile up. */
  pulse: number;
  role: DotRole;
  /** Hidden until the pencil comes near. */
  ahead: boolean;
};
export type Segment = { points: Pt[]; closed: boolean; first: number; /** cumulative length at each point, plus the closing length for closed segments */ lengths: number[]; total: number };
export type MovePhase = 'slow' | 'whoosh' | 'lift' | 'outline' | 'suspense' | 'close';
export type Move = { kind: 'draw' | 'hop'; from: number; to: number; segment: number; /** length along the segment where this draw starts */ along: number; /** drawn length, or the distance flown for a hop */ length: number; start: number; end: number; phase: MovePhase };
export type DotPlan = {
  spec: PictureSpec; dots: Dot[]; segments: Segment[]; moves: Move[];
  /** Page units per second: the details whoosh, and the outline's average. */
  cruiseSpeed: number; outlineSpeed: number;
  /** When the big lift to the outline starts (s). */
  lift: number;
  snapPoint: Pt;
};

const LABEL_FONT = 13;
const labelBox = (label: number, cx: number, cy: number) => { const w = String(label).length * LABEL_FONT * .56 + 2; const h = LABEL_FONT * .78; return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 }; };
type Box = ReturnType<typeof labelBox>;
const boxesOverlap = (a: Box, b: Box, pad: number) => a.x0 - pad < b.x1 && b.x0 - pad < a.x1 && a.y0 - pad < b.y1 && b.y0 - pad < a.y1;

function segmentBoxDistance(a: Pt, b: Pt, box: Box) {
  const inside = (p: Pt) => p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1;
  if (inside(a) || inside(b)) return 0;
  // Sample along the segment: labels are tiny, so this is exact enough and cheap.
  let best = Infinity;
  const steps = Math.max(2, Math.ceil(distance(a, b) / 4));
  for (let i = 0; i <= steps; i++) {
    const p = { x: mix(a.x, b.x, i / steps), y: mix(a.y, b.y, i / steps) };
    const dx = Math.max(box.x0 - p.x, 0, p.x - box.x1); const dy = Math.max(box.y0 - p.y, 0, p.y - box.y1);
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

export function insidePolygon(p: Pt, polygon: readonly Pt[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]; const b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function placeLabels(dots: Dot[], segments: Segment[], specs: readonly SegmentSpec[]) {
  // Every drawn line, with its bounding box so far-away lines are skipped cheaply.
  const lines: { a: Pt; b: Pt; x0: number; x1: number; y0: number; y1: number }[] = [];
  const addLine = (a: Pt, b: Pt) => lines.push({ a, b, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) });
  for (const segment of segments) {
    for (let i = 1; i < segment.points.length; i++) addLine(segment.points[i - 1], segment.points[i]);
    if (segment.closed) addLine(segment.points[segment.points.length - 1], segment.points[0]);
  }
  const REACH = 60;
  const placed: Box[] = [];
  const angles = [0, 28, -28, 55, -55, 85, -85, 125, -125, 180];
  for (const dot of dots) {
    const segment = segments[dot.segment];
    const local = dot.index - segment.first;
    const n = segment.points.length;
    const prev = segment.points[local > 0 ? local - 1 : segment.closed ? n - 1 : local];
    const next = segment.points[local < n - 1 ? local + 1 : segment.closed ? 0 : local];
    const tx = next.x - prev.x; const ty = next.y - prev.y; const tl = Math.max(1e-9, Math.hypot(tx, ty));
    let nx = ty / tl; let ny = -tx / tl;
    if (segment.closed) { if (insidePolygon({ x: dot.x + nx * 6, y: dot.y + ny * 6 }, segment.points)) { nx = -nx; ny = -ny; } }
    else if ((specs[dot.segment].side ?? 1) < 0) { nx = -nx; ny = -ny; }
    // Only what is near this dot can touch its label.
    const nearDots = dots.filter((other) => Math.abs(other.x - dot.x) < REACH && Math.abs(other.y - dot.y) < REACH);
    const nearLines = lines.filter((line) => line.x0 < dot.x + REACH && line.x1 > dot.x - REACH && line.y0 < dot.y + REACH && line.y1 > dot.y - REACH);
    const nearPlaced = placed.filter((box) => box.x0 < dot.x + REACH && box.x1 > dot.x - REACH && box.y0 < dot.y + REACH && box.y1 > dot.y - REACH);
    let best = { score: Infinity, x: dot.x + nx * 15, y: dot.y + ny * 15, box: labelBox(dot.label, dot.x + nx * 15, dot.y + ny * 15) };
    for (const reach of [14, 19]) for (const degrees of angles) {
      const r = degrees * Math.PI / 180;
      const dx = nx * Math.cos(r) - ny * Math.sin(r); const dy = nx * Math.sin(r) + ny * Math.cos(r);
      const halfW = String(dot.label).length * LABEL_FONT * .28;
      const cx = dot.x + dx * (reach + Math.abs(dx) * (halfW - 4)); const cy = dot.y + dy * reach;
      const box = labelBox(dot.label, cx, cy);
      let score = Math.abs(degrees) * .5 + (reach - 14) * 3;
      for (const other of nearPlaced) if (boxesOverlap(box, other, 1.5)) score += 900;
      for (const other of nearDots) {
        const ox = Math.max(box.x0 - other.x, 0, other.x - box.x1); const oy = Math.max(box.y0 - other.y, 0, other.y - box.y1);
        if (Math.hypot(ox, oy) < 4.5) score += other === dot ? 400 : 500;
      }
      for (const line of nearLines) {
        if (line.x0 > box.x1 + 6 || line.x1 < box.x0 - 6 || line.y0 > box.y1 + 6 || line.y1 < box.y0 - 6) continue;
        const gap = segmentBoxDistance(line.a, line.b, box);
        if (gap < 1.5) score += 260; else if (gap < 6) score += (6 - gap) * 12;
      }
      if (score < best.score) best = { score, x: cx, y: cy, box };
    }
    placed.push(best.box);
    dot.labelX = Math.round(best.x * 10) / 10;
    dot.labelY = Math.round(best.y * 10) / 10;
  }
}

/** Label positions as one compact string ("x,y x,y ..."), for baking into dotToDotLabels.ts. */
export const labelsToString = (dots: readonly Dot[]) => dots.map((dot) => `${dot.labelX},${dot.labelY}`).join(' ');

// ---------------------------------------------------------------- schedule

/** A hop gets quicker each time, but never flies faster than HOP_SPEED (so it never teleports). */
const hopDuration = (k: number, length: number) => Math.max(HOP_MIN, HOP_SECONDS * HOP_DECAY ** k, length / HOP_SPEED);

/** Details: ramp moves shrink geometrically, then the pencil cruises; hops get quicker each time. */
function detailDurations(moves: readonly Move[], speed: number) {
  let hops = 0;
  return moves.map((move, j) => move.kind === 'hop' ? hopDuration(hops++, move.length) : Math.max(RAMP_START * RAMP_RATIO ** j, move.length / speed));
}
/** Outline: starts fast, eases off towards the give-away part at the end. */
function outlineDurations(moves: readonly Move[], speed: number) {
  const last = Math.max(1, moves.length - 1);
  return moves.map((move, j) => move.kind === 'hop' ? hopDuration(0, move.length) : move.length / (speed * mix(OUTLINE_FAST, OUTLINE_SLOW, smooth(j / last))));
}
type Durations = (moves: readonly Move[], speed: number) => number[];
/** The speed at which the moves exactly fill the window. */
function solveSpeed(moves: readonly Move[], window: number, durations: Durations) {
  const total = (speed: number) => durations(moves, speed).reduce((sum, d) => sum + d, 0);
  let lo = 50; let hi = 100000;
  for (let i = 0; i < 40; i++) { const speed = (lo + hi) / 2; if (total(speed) > window) lo = speed; else hi = speed; }
  return hi;
}
/**
 * When the big lift starts, per picture: the moment that gives the details whoosh and the outline
 * race the same speed. Pictures with a long outline (the butterfly) lift earlier.
 */
function balanceLift(details: readonly Move[], outline: readonly Move[]) {
  let lo: number = DOT_BEATS.liftEarliest; let hi: number = DOT_BEATS.liftLatest;
  for (let i = 0; i < 24; i++) {
    const lift = (lo + hi) / 2;
    const whoosh = solveSpeed(details, lift - DOT_BEATS.slowEnd, detailDurations);
    const race = solveSpeed(outline, DOT_BEATS.suspense - lift - LIFT_SECONDS, outlineDurations);
    if (whoosh > race) lo = lift; else hi = lift;
  }
  return Math.round((lo + hi) / 2 * 1000) / 1000;
}
/** Solves the speed that fills the window, then lays the moves back to back from `start`. */
function layOut(moves: Move[], start: number, end: number, durations: Durations, phase: MovePhase) {
  const hi = solveSpeed(moves, end - start, durations);
  const list = durations(moves, hi);
  // Absorb the solver's last sliver so the window ends exactly on its beat.
  const scale = (end - start) / Math.max(1e-9, list.reduce((sum, d) => sum + d, 0));
  let time = start;
  moves.forEach((move, j) => { move.phase = phase; move.start = time; time += list[j] * scale; move.end = time; });
  if (moves.length) moves[moves.length - 1].end = end;
  return hi;
}

/**
 * Samples, numbers and schedules a page. `bakedLabels` (from labelsToString) skips the label
 * placement, the one slow step; stale bakes (a different dot count) are ignored.
 */
export function buildDotPlan(spec: PictureSpec, bakedLabels?: string): DotPlan {
  const segments: Segment[] = [];
  const dots: Dot[] = [];
  spec.segments.forEach((segmentSpec, s) => {
    const points = samplePath(segmentSpec.d, segmentSpec.spacing, segmentSpec.closed);
    const lengths = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
    const total = lengths[lengths.length - 1] + (segmentSpec.closed ? distance(points[points.length - 1], points[0]) : 0);
    segments.push({ points, closed: !!segmentSpec.closed, first: dots.length, lengths, total });
    const printed = segmentSpec.reveal === 'ahead' ? Math.round((segmentSpec.printed ?? 0) * points.length) : points.length;
    points.forEach((point, k) => dots.push({ ...point, index: dots.length, segment: s, label: dotLabel(dots.length, spec.step), labelX: point.x, labelY: point.y, appear: 0, hit: 0, pulse: HIT_PULSE, role: segmentSpec.role, ahead: k >= printed }));
  });

  const moves: Move[] = [];
  segments.forEach((segment, s) => {
    const n = segment.points.length;
    for (let i = 1; i < n; i++) moves.push({ kind: 'draw', from: segment.first + i - 1, to: segment.first + i, segment: s, along: segment.lengths[i - 1], length: segment.lengths[i] - segment.lengths[i - 1], start: 0, end: 0, phase: 'whoosh' });
    if (segment.closed) moves.push({ kind: 'draw', from: segment.first + n - 1, to: segment.first, segment: s, along: segment.lengths[n - 1], length: segment.total - segment.lengths[n - 1], start: 0, end: 0, phase: 'whoosh' });
    const from = segment.first + (segment.closed ? 0 : n - 1);
    if (s < segments.length - 1) moves.push({ kind: 'hop', from, to: segments[s + 1].first, segment: s + 1, along: 0, length: distance(dots[from], dots[segments[s + 1].first]), start: 0, end: 0, phase: 'whoosh' });
  });

  // slow chant | details whoosh | big lift to the outline | outline race | suspense + snap
  let big = moves.length - 1;
  while (big > 0 && moves[big].kind !== 'hop') big--;
  const slow = moves.slice(0, SLOW_INTERVALS.length);
  const details = moves.slice(SLOW_INTERVALS.length, big);
  const outline = moves.slice(big + 1, moves.length - SUSPENSE_INTERVALS.length);
  const suspense = moves.slice(moves.length - SUSPENSE_INTERVALS.length);

  let time: number = DOT_BEATS.firstHit;
  slow.forEach((move, i) => { move.phase = 'slow'; move.start = time; time += SLOW_INTERVALS[i]; move.end = time; });
  const lift = balanceLift(details, outline);
  const cruiseSpeed = layOut(details, DOT_BEATS.slowEnd, lift, detailDurations, 'whoosh');
  Object.assign(moves[big], { phase: 'lift', start: lift, end: lift + LIFT_SECONDS });
  const outlineSpeed = layOut(outline, lift + LIFT_SECONDS, DOT_BEATS.suspense, outlineDurations, 'outline');
  time = DOT_BEATS.suspense;
  suspense.forEach((move, i) => { move.phase = i === suspense.length - 1 ? 'close' : 'suspense'; move.start = time; time += SUSPENSE_INTERVALS[i]; move.end = time; });

  // A dot is "hit" the first time the pencil arrives, whether drawing or hopping to a new start star.
  dots[0].hit = DOT_BEATS.firstHit;
  for (const move of moves) if (dots[move.to].hit === 0) dots[move.to].hit = move.end;
  dots.forEach((dot, i) => { if (i < dots.length - 1) dot.pulse = Math.max(HIT_PULSE_MIN, Math.min(HIT_PULSE, (dots[i + 1].hit - dot.hit) * 2.4)); });

  // The printed page: a seeded sprinkle, so the order the dots appear in gives nothing away.
  const random = seededRandom(dots.length * 7919 + spec.step);
  for (const dot of dots) dot.appear = mix(DOT_BEATS.dotsIn, DOT_BEATS.dotsFull - .16, random());
  // Hidden dots sprout AHEAD_WINDOW at a time just ahead of the pencil, starting as it lifts off.
  for (const move of moves) {
    const segment = segments[dots[move.to].segment];
    if (move.kind !== 'hop' || !segment.points.some((_, k) => dots[segment.first + k].ahead)) continue;
    segment.points.forEach((_, k) => {
      const dot = dots[segment.first + k];
      if (!dot.ahead) return;
      const ref = k >= AHEAD_WINDOW ? dots[segment.first + k - AHEAD_WINDOW].hit : move.start + .06 + k * .03;
      dot.appear = Math.max(move.start + .06, Math.min(ref, dot.hit - AHEAD_LEAD));
    });
  }

  const baked = bakedLabels?.split(' ');
  if (baked && baked.length === dots.length) baked.forEach((pair, i) => { const [x, y] = pair.split(','); dots[i].labelX = Number(x); dots[i].labelY = Number(y); });
  else placeLabels(dots, segments, spec.segments);
  const last = segments[segments.length - 1];
  return { spec, dots, segments, moves, cruiseSpeed, outlineSpeed, lift, snapPoint: last.points[0] };
}

/** Dots in a region (the give-away part of the outline). */
export const inRegion = (p: Pt, r: Region) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;

/**
 * Runs of consecutive dots on one stroke, for drawing the page in a few cheap pieces: a run ends
 * at the end of its stroke, after `maxSize` dots, or when its last dot is reached more than
 * `maxSeconds` after its first (so a run of numbers greys out at most that late, and the chanted
 * numbers, reached slowly, each get their own run).
 */
export function chunkDots(dots: readonly Dot[], pick: (dot: Dot) => boolean, maxSize: number, maxSeconds = Infinity): Dot[][] {
  const chunks: Dot[][] = [];
  let current: Dot[] = [];
  for (const dot of dots) {
    if (!pick(dot)) continue;
    const head = current[0];
    const tail = current[current.length - 1];
    if (head && (dot.segment !== head.segment || dot.index !== tail.index + 1 || current.length >= maxSize || dot.hit - head.hit > maxSeconds)) { chunks.push(current); current = []; }
    current.push(dot);
  }
  if (current.length) chunks.push(current);
  return chunks;
}

// ---------------------------------------------------------------- the pencil

export type PencilState = {
  x: number; y: number;
  /** 0 = touching the paper, 1 = fully lifted (hop arc peak / hovering). */
  lift: number;
  /** Drawn length per segment. */
  drawn: number[];
  /** The last dot reached (-1 before the first tap). */
  reached: number;
  /** Units per second along the line, for speed lines and lean. */
  speed: number;
  heading: number;
  phase: 'enter' | MovePhase | 'done';
};

function pointAlong(segment: Segment, along: number): Pt {
  const { points, lengths, closed } = segment;
  const n = points.length;
  if (along <= 0) return points[0];
  for (let i = 1; i < n; i++) if (along <= lengths[i]) { const a = points[i - 1]; const b = points[i]; const t = (along - lengths[i - 1]) / Math.max(1e-9, lengths[i] - lengths[i - 1]); return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) }; }
  if (closed) { const a = points[n - 1]; const b = points[0]; const t = clamp01((along - lengths[n - 1]) / Math.max(1e-9, segment.total - lengths[n - 1])); return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) }; }
  return points[n - 1];
}

/** A hop eases in and out, but only halfway: a smoothstep peaks at 1.5x its average speed, this at 1.25x. */
const hopEase = (raw: number) => .5 * raw + .5 * smooth(raw);

/** Eased progress within one move: hands pause on each dot while slow, glide while fast. */
function moveProgress(move: Move, time: number) {
  const raw = progress(time, move.start, move.end);
  if (move.kind === 'hop') return hopEase(raw);
  if (move.phase === 'slow') return smooth(progress(raw, .2, 1));
  if (move.phase === 'suspense') return smooth(progress(raw, .08, 1));
  // The last stroke: creep 55% of the way, hover, then zip home.
  if (move.phase === 'close') return raw < .62 ? .55 * smooth(raw / .62) : .55 + .45 * (progress(raw, .78, 1) ** 2);
  return raw;
}

export function pencilAt(plan: DotPlan, time: number): PencilState {
  const { moves, segments, dots } = plan;
  const drawn = segments.map(() => 0);
  const start = dots[0];
  if (time < DOT_BEATS.firstHit) {
    // Swoop in from the lower right while lifted, hover, rise a little (anticipation), then TAP.
    const arrive = easeOutBack(progress(time, DOT_BEATS.pencilIn, DOT_BEATS.firstHit - .19), 1.1);
    const x = mix(start.x + 560, start.x, arrive);
    const y = mix(start.y + 430, start.y, arrive);
    const hover = DOT_BEATS.firstHit - .15; const rise = DOT_BEATS.firstHit - .08;
    const lift = time < hover ? 1 : time < rise ? 1 + .3 * smooth(progress(time, hover, rise)) : 1.3 * (1 - progress(time, rise, DOT_BEATS.firstHit) ** 2);
    return { x, y, lift, drawn, reached: -1, speed: 0, heading: 0, phase: 'enter' };
  }
  let reached = 0;
  for (const move of moves) {
    if (time >= move.end) {
      if (move.kind === 'draw') drawn[move.segment] = Math.max(drawn[move.segment], move.along + move.length);
      reached = Math.max(reached, move.to);
      continue;
    }
    if (time < move.start) break;
    const p = moveProgress(move, time);
    const from = dots[move.from]; const to = dots[move.to];
    const heading = Math.atan2(to.y - from.y, to.x - from.x);
    if (move.kind === 'hop') {
      const hopLength = distance(from, to);
      const height = move.phase === 'lift' ? 1.6 : .6 + Math.min(.7, hopLength / 450);
      return { x: mix(from.x, to.x, p), y: mix(from.y, to.y, p), lift: Math.sin(clamp01(p) * Math.PI) * height, drawn, reached, speed: hopLength / (move.end - move.start), heading, phase: move.phase };
    }
    const along = move.along + move.length * p;
    drawn[move.segment] = along;
    const point = pointAlong(segments[move.segment], along);
    const hover = move.phase === 'close' ? Math.sin(progress(progress(time, move.start, move.end), .5, .8) * Math.PI) * .45 : 0;
    return { x: point.x, y: point.y, lift: hover, drawn, reached, speed: move.length / (move.end - move.start), heading, phase: move.phase };
  }
  return { x: plan.snapPoint.x, y: plan.snapPoint.y, lift: 0, drawn: segments.map((segment) => segment.total), reached: dots.length - 1, speed: 0, heading: 0, phase: 'done' };
}

/**
 * Where the pencil and the big number go during the suspense: away from the give-away part (the
 * flukes, the smokestack...), so the class sees it appear. Fixed per page: the pencil is held at
 * whichever angle covers the fewest outline dots while it creeps to the final dot, and the number
 * sits off the picture (never on the shape the class is trying to guess) and off the pencil.
 */
export type Aim = { angle: number; roll: number; /** where the big number sits, relative to the pencil tip */ callout: Pt };
/** The pencil's usual drawing angle (degrees) and its length (page units). */
export const DRAW_ANGLE = -52;
export const PENCIL_LENGTH = 214;
/** When the aim is checked: the suspense strokes and the hover before the snap. */
export const AIM_TIMES = [DOT_BEATS.suspense + .05, DOT_BEATS.suspense + .3, DOT_BEATS.snap - .12] as const;
const toRad = (degrees: number) => degrees * Math.PI / 180;
const aims = new WeakMap<DotPlan, Aim>();
export function aimFor(plan: DotPlan): Aim {
  let aim = aims.get(plan);
  if (aim) return aim;
  const k = plan.spec.key;
  const key = { x: (k.x0 + k.x1) / 2, y: (k.y0 + k.y1) / 2 };
  const outline = plan.dots.filter((dot) => dot.role === 'outline');
  const shape = plan.segments[plan.segments.length - 1].points;
  const picture = plan.dots.filter((dot) => dot.role !== 'scenery');
  const spots = AIM_TIMES.map((t) => pencilAt(plan, t));
  const away = Math.atan2(spots[0].y - key.y, spots[0].x - key.x) * 180 / Math.PI;
  const covered = (angle: number) => {
    const dx = Math.cos(toRad(angle)); const dy = Math.sin(toRad(angle));
    let count = 0;
    for (const at of spots) {
      for (const dot of outline) {
        const along = (dot.x - at.x) * dx + (dot.y - at.y) * dy;
        if (along < 8 || along > PENCIL_LENGTH) continue;
        if (Math.abs((dot.x - at.x) * dy - (dot.y - at.y) * dx) < 30) count += inRegion(dot, k) ? 3 : 1;
      }
      // Lying over the give-away part hides it even where it has no dots (the middle of a wing).
      for (let along = 40; along <= PENCIL_LENGTH; along += 30) if (inRegion({ x: at.x + dx * along, y: at.y + dy * along }, k)) count += 1;
    }
    return count;
  };
  // Prefer the usual drawing angle, then pointing up; never lying across the give-away part.
  const options = [DRAW_ANGLE, away - 80, away - 55, away - 30, away + 30, away + 55, away + 80]
    .map((angle, i) => ({ angle, score: covered(angle) + (i ? .5 : 0) + Math.max(0, Math.sin(toRad(angle))) }))
    .sort((a, b) => a.score - b.score);
  let angle = options[0].angle;
  while (angle - DRAW_ANGLE > 180) angle -= 360;
  while (angle - DRAW_ANGLE < -180) angle += 360;
  // The big number: beside the tip, off the picture's shape and its detail dots, off the pencil and the page edge.
  const px = Math.cos(toRad(angle)); const py = Math.sin(toRad(angle));
  const ring = (rx: number, ry: number, cost: number) => Array.from({ length: 8 }, (_, i) => ({ offset: { x: Math.cos(i * Math.PI / 4) * rx, y: Math.sin(i * Math.PI / 4) * ry }, cost }));
  const callout = [...ring(100, 80, 0), ...ring(150, 115, 2)].map(({ offset, cost }) => {
    let score = cost;
    for (const at of spots) {
      const c = { x: at.x + offset.x, y: at.y + offset.y };
      if (c.x < 60 || c.x > PAGE_W - 60 || c.y < 50 || c.y > PAGE_H - 30) score += 4;
      // How much of the number's box lies on the picture's shape (sampled on a 5 x 3 grid).
      for (let gx = -2; gx <= 2; gx++) for (let gy = -1; gy <= 1; gy++) if (insidePolygon({ x: c.x + gx * 24, y: c.y + gy * 22 }, shape)) score += 1.5;
      for (const dot of picture) if (Math.abs(dot.x - c.x) < 55 && Math.abs(dot.y - c.y) < 34) score += inRegion(dot, k) ? 3 : 1;
      const along = (c.x - at.x) * px + (c.y - at.y) * py;
      if (along > -20 && along < PENCIL_LENGTH + 20 && Math.abs((c.x - at.x) * py - (c.y - at.y) * px) < 60) score += 8;
    }
    return { offset, score };
  }).sort((a, b) => a.score - b.score)[0].offset;
  aim = { angle, roll: Math.cos(toRad(angle)) < 0 ? -1 : 1, callout };
  aims.set(plan, aim);
  return aim;
}

/** After the snap the pencil springs up, twirls once and flies off to the upper right. */
export function pencilExit(time: number) {
  const p = progress(time, DOT_BEATS.snap + .04, DOT_BEATS.snap + .44);
  return { dx: 1000 * p * p, dy: -760 * p * p, spin: 360 * smooth(progress(time, DOT_BEATS.snap + .04, DOT_BEATS.snap + .4)), lift: smooth(progress(time, DOT_BEATS.snap, DOT_BEATS.snap + .12)) };
}

// ---------------------------------------------------------------- the finished picture comes alive

export type Pose = { x: number; y: number; rotate: number; sx: number; sy: number; ox: number; oy: number };
export type Puff = { x: number; y: number; r: number; opacity: number };

/** The snap: a quick satisfied scale-pop of the whole drawing about the page centre. */
export const snapPop = (time: number) => 1 + .05 * Math.sin(progress(time, DOT_BEATS.snap, DOT_BEATS.snap + .3) * Math.PI);
/** Colour floods out of the final dot. Radius in page units. */
export const floodRadius = (time: number) => 1250 * easeOutCubic(progress(time, DOT_BEATS.snap + .02, DOT_BEATS.fillEnd));
/** Eyes open just after the colour arrives, with one blink. Takes shifted (alive) time. */
const eyeOpenAt = (t: number, blinkAt: number) => easeOutBack(progress(t, 5.9, 6.06), 2) * (1 - .92 * Math.sin(progress(t, blinkAt, blinkAt + .12) * Math.PI));

/**
 * A smooth path through [time, value] keys (Catmull-Rom style tangents, flat at both ends), so a
 * motion keeps its speed through the keys instead of easing to a stop at each one.
 */
export function spline(time: number, keys: readonly (readonly [number, number])[]): number {
  if (time <= keys[0][0]) return keys[0][1];
  const last = keys.length - 1;
  if (time >= keys[last][0]) return keys[last][1];
  let i = 0;
  while (keys[i + 1][0] < time) i++;
  const [t0, p0] = keys[i]; const [t1, p1] = keys[i + 1];
  const slope = (j: number) => j <= 0 || j >= last ? 0 : (keys[j + 1][1] - keys[j - 1][1]) / (keys[j + 1][0] - keys[j - 1][0]);
  const h = t1 - t0; const u = (time - t0) / h;
  const u2 = u * u; const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * slope(i) + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * slope(i + 1);
}

/**
 * The whale's exit, in authored (alive) time: it settles, spouts, winds up (rears back), then dives
 * nose first behind the sea; the flukes flick up last and slip under. `entry` is when the nose
 * hits the water (its sheets wash away from then), `flukesUnder` the second splash. The tail holds
 * its tilt and slips under fast, so the lone back lobe (it reads as a shark fin) shows for under
 * two frames, and the second splash is already rising round it.
 */
export const WHALE_DIVE = { spout: 6.1, windUp: 6.38, dive: 6.5, entry: 6.62, flukesUnder: 6.99, gone: 7.22 } as const;
const WHALE_X = [[6.38, 0], [6.5, 30], [6.62, -20], [6.78, -90], [6.96, -170], [7.22, -260]] as const;
const WHALE_Y = [[6.38, 0], [6.5, -14], [6.62, 50], [6.78, 170], [6.96, 430], [7.06, 820], [7.22, 1400]] as const;
const WHALE_TURN = [[6.38, 0], [6.5, 8], [6.64, -22], [6.78, -32], [6.87, -38], [6.94, -32], [7.1, -30]] as const;
/** Real time (s from mount) when the nose hits the water. */
export const WHALE_ENTRY = WHALE_DIVE.entry + ALIVE_SHIFT;
/** Real time: the sea (with the lighthouse) is all that stays until the flukes are under, then it drains away. */
export const WHALE_SEA_DRAIN = { start: WHALE_DIVE.flukesUnder + ALIVE_SHIFT, end: WHALE_DIVE.flukesUnder + ALIVE_SHIFT + .22 } as const;

export function whaleAlive(time: number) {
  const t = aliveTime(time);
  const sy = keyframes(t, [[5.95, 1], [6.06, .92], [6.16, 1.07], [6.28, .98], [6.38, 1], [6.5, .93], [6.6, 1.05], [6.72, 1]]);
  const sx = keyframes(t, [[5.95, 1], [6.06, 1.05], [6.16, .96], [6.28, 1.01], [6.38, 1], [6.5, 1.05], [6.6, .97], [6.72, 1]]);
  const spout = keyframes(t, [[6.1, 0], [6.2, 1.12], [6.28, 1], [6.42, 1], [6.55, 0]]);
  return {
    pose: { x: spline(t, WHALE_X), y: spline(t, WHALE_Y), rotate: spline(t, WHALE_TURN), sx, sy, ox: 520, oy: 330 },
    eye: eyeOpenAt(t, 6.3), spout, spray: progress(t, 6.12, 6.85),
    /** Two splashes on the waterline: the nose going in, then the flukes (a beat early, so its spray hides the last lobe going under). */
    splash: progress(t, WHALE_DIVE.entry - .02, WHALE_DIVE.entry + .36), flukeSplash: progress(t, WHALE_DIVE.flukesUnder - .07, WHALE_DIVE.flukesUnder + .34),
    gull: easeInCubic(progress(t, 6.12, 6.95)),
  };
}

const TRAIN_PUFFS = [6.04, 6.26, 6.4, 6.52, 6.62, 6.71, 6.79, 6.86, 6.93, 7.0, 7.06] as const;
/** Authored time by which the train's steam and the rocket's smoke have all shrunk away. */
const STEAM_GONE = 7.3;
const SMOKE_GONE = 6.86;
/** A puff of steam is gone this long after the sheet under the spot it left the funnel starts to leave (s). */
const STEAM_AFTER_SHEET = .15;
/** A puff keeps its size, then shrinks to nothing over the last part of its life. */
const puffShrink = (life: number) => 1 - easeInCubic(progress(life, .5, 1));
function trainXAt(t: number) {
  const back = keyframes(t, [[5.95, 0], [6.18, -24], [6.3, -18]]);
  return back + 1550 * progress(t, 6.3, 7.3) ** 2.1;
}
export const trainX = (time: number) => trainXAt(aliveTime(time));
/** Page x of the left edge of the train's rear wheel (TRAIN_WHEELS[0] in dotToDotPictures) before it moves. */
const TRAIN_REAR_WHEEL = 242;
export function trainAlive(time: number) {
  const t = aliveTime(time);
  const x = trainXAt(t);
  const rotate = keyframes(t, [[5.95, 0], [6.18, -2.2], [6.34, 1.6], [6.52, 0]]);
  const y = -Math.abs(Math.sin(t * 26)) * 3.5 * smooth(progress(t, 6.3, 6.5));
  // Wheels roll with the ground distance, plus a spin-up "slip" as it lurches.
  const roll = x + 140 * smooth(progress(t, 6.2, 6.45));
  // Each puff billows, then shrinks away (never a see-through ghost). A puff is gone soon after the
  // sheet under it starts to leave, so steam never sits on a freshly revealed name: the puffs
  // chuffed out as the train races off are quick little ones.
  const puffs: Puff[] = TRAIN_PUFFS.filter((at) => t >= at).map((at, i) => {
    const age = t - at;
    const x0 = 644 + trainXAt(at);
    const end = Math.min(at + .8, STEAM_GONE, Math.max(at + .25, sceneryLeavesAt('train', x0) - ALIVE_SHIFT + STEAM_AFTER_SHEET));
    const life = progress(t, at, end);
    return { x: x0 - age * (70 + i * 6), y: 126 - age * (150 + (i % 3) * 30) - (i === 0 ? age * 60 : 0), r: ((i === 0 ? 30 : 18) + 44 * easeOutCubic(progress(age, 0, .8))) * puffShrink(life), opacity: life < 1 ? 1 : 0 };
  });
  return { pose: { x, y, rotate, sx: 1, sy: 1, ox: 300, oy: 560 }, roll, lamp: smooth(progress(t, 5.95, 6.1)), puffs };
}

export function rocketAlive(time: number) {
  const t = aliveTime(time);
  const rumble = fadeWindow(t, 5.95, 6.08, 6.34, 6.44);
  const sy = keyframes(t, [[6.0, 1], [6.3, .93], [6.42, 1.13], [6.7, 1.06]]);
  const sx = keyframes(t, [[6.0, 1], [6.3, 1.05], [6.42, .92], [6.7, .96]]);
  const lift = easeInCubic(progress(t, 6.36, 7.3));
  const flame = keyframes(t, [[6.08, 0], [6.3, .45], [6.42, 1.15], [6.55, 1]]) * (1 + .13 * Math.sin(t * 71) + .07 * Math.cos(t * 43));
  const puffs: Puff[] = Array.from({ length: 16 }, (_, i) => {
    const at = 6.14 + (i % 8) * .05;
    const side = i % 2 ? 1 : -1;
    const life = progress(t, at, at + .85);
    const reach = 90 + (i % 8) * 46;
    const shrink = puffShrink(progress(t, at, at + Math.max(.3, Math.min(.85, SMOKE_GONE - at))));
    return { x: 500 + side * (26 + reach * easeOutCubic(life)), y: 574 - Math.sin(life * Math.PI) * (10 + (i % 4) * 9), r: (22 + (i % 5) * 7) * (.35 + easeOutCubic(life)) * shrink, opacity: t < at || shrink <= 0 ? 0 : 1 };
  });
  return { pose: { x: Math.sin(t * 95) * 3.2 * rumble, y: -1500 * lift, rotate: 0, sx, sy, ox: 500, oy: 540 }, flame, puffs, look: smooth(progress(t, 6.18, 6.34)), eye: eyeOpenAt(t, 6.14) };
}

export function butterflyAlive(time: number) {
  const t = aliveTime(time);
  let flap = 1;
  if (t >= 5.95 && t < 6.3) flap = mix(1, .18, smooth(progress(t, 5.95, 6.3)));
  else if (t >= 6.3 && t < 6.42) flap = mix(.18, 1.06, easeOutCubic(progress(t, 6.3, 6.42)));
  else if (t >= 6.42) flap = .2 + .86 * Math.abs(Math.cos((t - 6.42) * Math.PI * 3.4));
  const rise = progress(t, 6.45, 7.55);
  const sway = Math.sin((t - 6.45) * 6.5) * smooth(progress(t, 6.45, 6.7));
  const dip = keyframes(t, [[5.95, 0], [6.28, 14], [6.42, -18]]);
  // The feelers were never dotted (they would give it away): they spring out, boing, as it wakes.
  const antennae = easeOutBack(progress(t, 5.92, 6.16), 3.2);
  const wobble = Math.sin((t - 5.92) * 28) * 12 * (1 - smooth(progress(t, 5.92, 6.5)));
  return { pose: { x: sway * 34 + 430 * rise ** 1.6, y: dip - 1150 * rise ** 1.7, rotate: sway * 8 + rise * 12, sx: 1, sy: 1, ox: 500, oy: 300 }, flap, eye: eyeOpenAt(t, 6.2), sparkle: rise, antennae, wobble };
}

// ---------------------------------------------------------------- rotation between plays

let lastPickAt = -Infinity;
let shown = -1;
let bag: number[] = [];
/**
 * One picture per play, so it stays a surprise over months: a shuffle bag shows every picture
 * once per cycle, never the same one twice in a row, and the order is seeded by the wall clock,
 * so a page reload does not always start on the same picture (the class would learn it).
 * The cover and stage mount in the same commit, so calls within a second share a pick.
 */
export function pictureIndexForPlay(count: number, now: number, seed: number = Date.now()): number {
  if (now - lastPickAt > 1000 || shown < 0) {
    if (!bag.length) {
      const random = seededRandom(seed);
      bag = Array.from({ length: count }, (_, i) => i);
      for (let i = count - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (count > 1 && bag[0] === shown) [bag[0], bag[count - 1]] = [bag[count - 1], bag[0]];
    }
    shown = bag.shift()!;
  }
  lastPickAt = now;
  return shown;
}
