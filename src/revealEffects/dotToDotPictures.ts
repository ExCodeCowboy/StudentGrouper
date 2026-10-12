/**
 * The hard dot-to-dot pages. Each picture is authored as smooth strokes in a 1000 x 620 page;
 * the dots are sampled from the same paths, so the numbered page, the pencil line and the
 * coloured picture always agree.
 *
 * It must be a real guessing game (owner directive): the page that appears first is a busy
 * jumble of ambiguous details and scenery (stripes, rings, a lighthouse, kites, trees, clouds...)
 * spread over the whole sheet. The outline, which gives the picture away, is numbered last and
 * its dots only appear a few at a time just ahead of the pencil, with the most telling part
 * (flukes, smokestack, nose cone, upper wings) saved for the final stretch before the snap.
 */
import type { PictureSpec } from './dotToDotTimeline';

export const PAGE_WIDTH = 1000;
export const PAGE_HEIGHT = 620;

const f = (value: number) => Math.round(value * 10) / 10;

/** A circle as four cubic arcs, starting at 12 o'clock and running clockwise. */
export function circlePath(cx: number, cy: number, r: number) {
  const k = r * .5523;
  return `M${f(cx)} ${f(cy - r)}C${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)}C${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)}C${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)}C${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)}Z`;
}

/** A circular arc as cubic pieces (no M). Degrees, SVG convention: 0 = right, 90 = down, increasing clockwise. */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const pieces = Math.max(1, Math.ceil(Math.abs(to - from) / 90));
  const step = (to - from) / pieces * Math.PI / 180;
  const k = 4 / 3 * Math.tan(step / 4) * r;
  let d = '';
  for (let i = 0; i < pieces; i++) {
    const a = from * Math.PI / 180 + step * i; const b = a + step;
    d += `C${f(cx + r * Math.cos(a) - k * Math.sin(a))} ${f(cy + r * Math.sin(a) + k * Math.cos(a))} ${f(cx + r * Math.cos(b) + k * Math.sin(b))} ${f(cy + r * Math.sin(b) - k * Math.cos(b))} ${f(cx + r * Math.cos(b))} ${f(cy + r * Math.sin(b))}`;
  }
  return d;
}

/** A five-point star, top point first, clockwise. */
export function starPath(cx: number, cy: number, r: number, turn = 0) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = (turn - 90 + i * 36) * Math.PI / 180;
    const radius = i % 2 ? r * .46 : r;
    return `${f(cx + Math.cos(a) * radius)} ${f(cy + Math.sin(a) * radius)}`;
  });
  return `M${points[0]}L${points.slice(1).join('L')}Z`;
}

/** Wave humps (no M) from the current point at x0 to x1 (quadratic humps alternating up and down). */
function waveHumps(x0: number, x1: number, y: number, amp: number, halfWaves: number) {
  const w = (x1 - x0) / halfWaves;
  let d = '';
  for (let i = 0; i < halfWaves; i++) d += `Q${f(x0 + w * (i + .5))} ${f(y + (i % 2 ? amp : -amp) * 2)} ${f(x0 + w * (i + 1))} ${f(y)}`;
  return d;
}

/** A gentle wave line from x0 to x1 (either direction). */
export function wavePath(x0: number, x1: number, y: number, amp: number, halfWaves: number) {
  return `M${f(x0)} ${f(y)}${waveHumps(x0, x1, y, amp, halfWaves)}`;
}

/** One continuous stroke from several open pieces: each piece after the first drops its M (it must start where the last ended). */
export const joinPaths = (...parts: string[]) => parts.map((part, i) => i ? part.replace(/^M[^A-Za-z]*/, '') : part).join('');

/** A puffy cloud: flat bottom, a row of round bumps on top (tallest in the middle). Starts bottom left. */
export function cloudPath(cx: number, cy: number, w: number, h: number, bumps: number) {
  const x0 = cx - w / 2; const base = cy + h / 2;
  let d = `M${f(x0)} ${f(base)}`;
  for (let i = 0; i < bumps; i++) {
    const a = x0 + w * i / bumps; const b = x0 + w * (i + 1) / bumps;
    const lift = h * (.55 + .45 * Math.sin((i + .5) / bumps * Math.PI));
    d += `C${f(a - 6)} ${f(base - lift * 1.25)} ${f(b + 6)} ${f(base - lift * 1.25)} ${f(b)} ${f(base - (i === bumps - 1 ? 0 : lift * .35))}`;
  }
  return `${d}Z`;
}

/** A crescent moon opening to the right, starting at its top horn. */
export function crescentPath(cx: number, cy: number, r: number) {
  return `M${f(cx + r * .35)} ${f(cy - r * .94)}C${f(cx - r * .9)} ${f(cy - r * 1.05)} ${f(cx - r * 1.25)} ${f(cy + r * .9)} ${f(cx + r * .35)} ${f(cy + r * .94)}C${f(cx - r * .45)} ${f(cy + r * .55)} ${f(cx - r * .45)} ${f(cy - r * .55)} ${f(cx + r * .35)} ${f(cy - r * .94)}Z`;
}

/** A segmented, caterpillar-like body: bumps down the right side, round tail, bumps up the left. */
export function bumpyBodyPath(cx: number, top: number, bottom: number, half: number, bumps: number) {
  const h = (bottom - top) / bumps;
  let d = `M${f(cx)} ${f(top)}C${f(cx + half)} ${f(top)} ${f(cx + half * 1.1)} ${f(top + h * .3)} ${f(cx + half)} ${f(top + h * .5)}`;
  for (let i = 0; i < bumps; i++) {
    const y0 = top + h * (i + .5); const y1 = Math.min(bottom - h * .5, y0 + h);
    if (i < bumps - 1) d += `C${f(cx + half * 1.55)} ${f(y0 + h * .15)} ${f(cx + half * 1.55)} ${f(y1 - h * .15)} ${f(cx + half)} ${f(y1)}`;
  }
  d += `C${f(cx + half * 1.1)} ${f(bottom - h * .1)} ${f(cx + half * .5)} ${f(bottom)} ${f(cx)} ${f(bottom)}C${f(cx - half * .5)} ${f(bottom)} ${f(cx - half * 1.1)} ${f(bottom - h * .1)} ${f(cx - half)} ${f(bottom - h * .5)}`;
  for (let i = bumps - 1; i > 0; i--) {
    const y0 = top + h * (i + .5); const y1 = y0 - h;
    d += `C${f(cx - half * 1.55)} ${f(y0 - h * .15)} ${f(cx - half * 1.55)} ${f(y1 + h * .15)} ${f(cx - half)} ${f(y1)}`;
  }
  return `${d}C${f(cx - half * 1.1)} ${f(top + h * .3)} ${f(cx - half)} ${f(top)} ${f(cx)} ${f(top)}Z`;
}

/** Maps every point of an absolute M/L/C/Q/Z path (no H/V/A). */
export function mapPath(d: string, fn: (x: number, y: number) => readonly [number, number]) {
  return d.replace(/(-?\d*\.?\d+)[ ,](-?\d*\.?\d+)/g, (_, x: string, y: string) => { const [px, py] = fn(Number(x), Number(y)); return `${f(px)} ${f(py)}`; });
}

// ------------------------------------------------------------------ whale, facing left

/** Starts (and snaps shut) under the tail: belly, chin, head, back, and the flukes last. */
export const WHALE_OUTLINE = 'M872 282C838 352 770 420 660 466C540 520 380 546 276 520C178 496 116 430 118 344C120 250 186 190 290 176C420 150 570 196 660 280C700 314 772 300 814 238C796 208 770 184 730 162C786 138 838 150 858 190C882 148 922 122 970 116C950 176 912 236 872 282Z';
/** Throat stripes as one ribbon: out along the top stripe, round the hook, back along the lower one. */
export const WHALE_STRIPES = 'M204 446C270 470 346 478 424 468C452 465 462 486 440 492C356 510 280 506 226 484';
export const WHALE_MOUTH = 'M136 390C200 430 300 440 372 402Q394 390 396 368';
export const WHALE_FLIPPER = 'M486 404C500 452 540 486 600 486C590 446 562 420 524 404Z';
export const WHALE_SUN = { cx: 86, cy: 84, r: 46 } as const;
export const WHALE_GULL = 'M140 142Q168 110 196 138Q224 110 252 142';
export const WHALE_GULL_FAR = 'M654 64Q688 32 722 60Q756 32 790 64';
export const WHALE_CLOUD = cloudPath(438, 60, 240, 48, 4);
/** A lighthouse on a rock at the right edge (drawn down its right side first), ending on the swell line. */
export const WHALE_LIGHTHOUSE = 'M976 592C978 570 972 556 960 548L948 384C948 352 912 352 912 384L900 548C888 556 874 568 862 584';
/** The swell line under the whale (the sea's surface is painted higher, across its belly). */
export const WHALE_SWELL = wavePath(862, 118, 584, 7, 6);
/** A breaking wave at the left edge. */
export const WHALE_CREST = 'M118 584C78 578 44 548 40 500Q38 470 62 462';
/** Painted only: the sea's surface, where the finished whale floats (it hides the belly and swallows the dive). */
export const WHALE_WATERLINE = 512;

// ------------------------------------------------------------------ steam train, facing right

export const TRAIN_WHEELS = [{ cx: 300, cy: 500, r: 58 }, { cx: 460, cy: 500, r: 58 }, { cx: 640, cy: 516, r: 42 }] as const;
export const TRAIN_WINDOW = 'M186 206H300V278H186Z';
export const TRAIN_SUN = { cx: 104, cy: 70, r: 44 } as const;
/** A kite, a sun, two trees: the wheels are no longer the only circles, and nothing says "railway". */
export const TRAIN_KITE = 'M470 24L528 94L470 172L412 94Z';
export const TRAIN_BIRD = 'M800 72Q830 42 860 68Q890 42 920 72';
export const TRAIN_TREE_CROWN = { cx: 922, cy: 250, r: 54 } as const;
/** A lollipop tree: up the trunk, then round the crown, stopping just short of where it began. */
export const TRAIN_TREE = (() => {
  const { cx, cy, r } = TRAIN_TREE_CROWN;
  return `M${cx} 562V${cy + r}${arcPath(cx, cy, r, 90, 435)}`;
})();
export const TRAIN_PINE = 'M72 300L110 382H94L120 472H84V562H60V472H24L50 382H34Z';
/** Starts (and snaps shut) at the back of the cab: along the bottom, cow-catcher, smokestack, dome, cab roof. */
export const TRAIN_OUTLINE = 'M150 430H716V558H856L790 430H742C790 430 782 262 742 262H678L672 198L694 140H594L618 198L612 262H520C520 212 440 212 440 262H330V176H352V156Q240 128 128 156V176H150Z';

// ------------------------------------------------------------------ rocket, nose up

/**
 * A snowy night, not outer space: a moon, a star, snowflakes and pine trees beside two stacked
 * circles read as "a snowman!" (or an owl, a house...). Nothing on the page says "space" until the fins appear.
 */
export const ROCKET_PORTHOLE = { cx: 500, cy: 282, r: 50 } as const;
export const ROCKET_HATCH = { cx: 500, cy: 408, r: 30 } as const;
export const ROCKET_STAR = { cx: 850, cy: 176, r: 50, turn: 10 } as const;
export const ROCKET_MOON = { cx: 168, cy: 120, r: 62 } as const;
/** Two little constellations: a dot-to-dot in the sky (each corner becomes a twinkling star). */
export const ROCKET_STARS_LEFT = 'M330 140L280 190L318 250L266 298L198 286L150 330';
export const ROCKET_STARS_RIGHT = 'M660 60L720 100L680 160L736 206L700 270L752 318';
/** A two-tier pine, top first, clockwise; the trunk stands in the snow. */
export const ROCKET_TREE = 'M868 360L914 440H894L940 526H880V574H856V526H796L842 440H822Z';
export const ROCKET_TREE_SMALL = 'M120 392L156 460H140L172 530H130V574H110V530H68L100 460H84Z';
/** Snow drifts along the bottom, between the trees and under the rocket. */
export const ROCKET_DRIFTS = 'M214 600Q262 572 310 598Q362 574 414 598Q470 580 526 600Q584 576 640 598Q694 574 748 598';
/** Painted only (never dotted): the snowy hill the rocket stands on, rolling away under the footer. */
export const ROCKET_GROUND = 'M-700 878A2333 2333 0 0 1 1700 878';
/** Starts (and snaps shut) on the left shoulder: down the side, fins and nozzle, up the right, the nose last. */
export const ROCKET_OUTLINE = 'M388 292V356C336 378 296 428 288 490L284 552L388 500H444L430 540H570L556 500H612L716 552L712 490C704 428 664 378 612 356V292C610 190 566 104 500 50C434 104 390 190 388 292Z';

// ------------------------------------------------------------------ butterfly, face on

/**
 * The butterfly is drawn at BUTTERFLY_SCALE about BUTTERFLY_ORIGIN, leaving a garden round it.
 * Its art (and these constants) are authored full size; `butterflyPoint` maps onto the page.
 */
export const BUTTERFLY_SCALE = .82;
export const BUTTERFLY_ORIGIN = { x: 500, y: 290 } as const;
export const butterflyPoint = (x: number, y: number) => [BUTTERFLY_ORIGIN.x + (x - BUTTERFLY_ORIGIN.x) * BUTTERFLY_SCALE, BUTTERFLY_ORIGIN.y + (y - BUTTERFLY_ORIGIN.y) * BUTTERFLY_SCALE] as const;
const onPage = (d: string) => mapPath(d, butterflyPoint);
const spotOnPage = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => { const [x, y] = butterflyPoint(cx, cy); return circlePath(x, y, r * BUTTERFLY_SCALE); };

/** Starts (and snaps shut) at the right wing's notch: lower wings first, the big upper wings last. */
export const BUTTERFLY_OUTLINE = 'M548 304C664 344 792 360 788 436C784 512 690 562 620 550C566 540 530 500 512 452C510 470 506 484 500 490C494 484 490 470 488 452C470 500 434 540 380 550C310 562 216 512 212 436C208 360 336 344 452 304C280 290 155 282 128 222C94 150 116 68 200 58C310 44 430 110 488 182C480 174 473 164 472 150C470 134 480 118 500 118C520 118 530 134 528 150C527 164 520 174 512 182C570 110 690 44 800 58C884 68 906 150 872 222C845 282 720 290 548 304Z';
export const BUTTERFLY_BODY = bumpyBodyPath(500, 204, 426, 15, 5);
/** Not dotted: the antennae spring out when the butterfly comes alive (curly feelers would give it away). */
export const BUTTERFLY_ANTENNAE = ['M596 78C616 60 604 26 574 30C548 34 532 76 518 108', 'M404 78C384 60 396 26 426 30C452 34 468 76 482 108'] as const;
/** Upper spots: left, right. Lower spots: left, right. */
export const BUTTERFLY_SPOTS = [{ cx: 214, cy: 122, r: 38 }, { cx: 786, cy: 122, r: 38 }] as const;
export const BUTTERFLY_LOWER_SPOTS = [{ cx: 318, cy: 452, r: 34 }, { cx: 682, cy: 452, r: 34 }] as const;
/** The garden round it (page coordinates, not scaled). */
export const BUTTERFLY_SUN = { cx: 100, cy: 96, r: 40 } as const;
export const BUTTERFLY_CLOUD = cloudPath(334, 46, 160, 44, 3);
/** A tulip, the grass and a leaf (where a caterpillar would sit): one long stroke along the bottom, right to left. */
export const BUTTERFLY_TULIP = 'M940 452C958 438 972 410 966 370L950 392L932 362L914 392L896 370C890 410 904 440 928 450C930 500 926 552 918 598';
export const BUTTERFLY_GRASS = 'M918 598H790L774 576L758 598H620L604 576L588 598H470L454 576L438 598H300L284 576L268 598H150L116 574';
export const BUTTERFLY_LEAF = 'M116 574C142 504 122 404 64 342C30 440 44 544 100 588';
export const BUTTERFLY_GARDEN = joinPaths(BUTTERFLY_TULIP, BUTTERFLY_GRASS, BUTTERFLY_LEAF);

export type PictureId = 'whale' | 'train' | 'rocket' | 'butterfly';

export const DOT_PICTURES: readonly (PictureSpec & { id: PictureId })[] = [
  {
    id: 'whale', name: 'Whale', answer: 'a whale', step: 2,
    // The flukes: the one part nobody can mistake.
    key: { x0: 690, y0: 100, x1: 990, y1: 262 },
    segments: [
      { d: WHALE_STRIPES, spacing: 28, role: 'detail', side: -1 },
      { d: WHALE_MOUTH, spacing: 26, role: 'detail', side: -1 },
      { d: WHALE_FLIPPER, spacing: 26, role: 'detail', closed: true },
      { d: joinPaths(WHALE_LIGHTHOUSE, WHALE_SWELL, WHALE_CREST), spacing: 27, role: 'scenery', side: -1 },
      { d: circlePath(WHALE_SUN.cx, WHALE_SUN.cy, WHALE_SUN.r), spacing: 20.6, role: 'scenery', closed: true },
      { d: WHALE_GULL, spacing: 24, role: 'scenery', side: 1 },
      { d: WHALE_CLOUD, spacing: 30, role: 'scenery', closed: true },
      { d: WHALE_GULL_FAR, spacing: 24, role: 'scenery', side: 1 },
      { d: WHALE_OUTLINE, spacing: 42, role: 'outline', closed: true, reveal: 'ahead', printed: .3 },
    ],
  },
  {
    id: 'train', name: 'Steam train', answer: 'a steam train', step: 2,
    // The smokestack.
    key: { x0: 580, y0: 120, x1: 710, y1: 215 },
    segments: [
      ...TRAIN_WHEELS.map(({ cx, cy, r }) => ({ d: circlePath(cx, cy, r), spacing: r > 50 ? 26 : 22, role: 'detail' as const, closed: true })),
      { d: TRAIN_TREE, spacing: 28, role: 'scenery', side: 1 },
      { d: TRAIN_BIRD, spacing: 24, role: 'scenery', side: 1 },
      { d: TRAIN_KITE, spacing: 30, role: 'scenery', closed: true },
      { d: TRAIN_WINDOW, spacing: 26, role: 'detail', closed: true },
      { d: circlePath(TRAIN_SUN.cx, TRAIN_SUN.cy, TRAIN_SUN.r), spacing: 19.8, role: 'scenery', closed: true },
      { d: TRAIN_PINE, spacing: 34, role: 'scenery', closed: true },
      { d: TRAIN_OUTLINE, spacing: 44, role: 'outline', closed: true, reveal: 'ahead' },
    ],
  },
  {
    id: 'rocket', name: 'Rocket', answer: 'a rocket', step: 5,
    // The nose cone.
    key: { x0: 400, y0: 30, x1: 600, y1: 200 },
    segments: [
      { d: circlePath(ROCKET_PORTHOLE.cx, ROCKET_PORTHOLE.cy, ROCKET_PORTHOLE.r), spacing: 26, role: 'detail', closed: true },
      { d: circlePath(ROCKET_HATCH.cx, ROCKET_HATCH.cy, ROCKET_HATCH.r), spacing: 15.7, role: 'detail', closed: true },
      { d: ROCKET_DRIFTS, spacing: 66, role: 'scenery', side: 1 },
      { d: ROCKET_TREE, spacing: 46, role: 'scenery', closed: true },
      { d: starPath(ROCKET_STAR.cx, ROCKET_STAR.cy, ROCKET_STAR.r, ROCKET_STAR.turn), spacing: 60, role: 'scenery', closed: true },
      { d: ROCKET_STARS_RIGHT, spacing: 80, role: 'scenery', side: 1 },
      { d: crescentPath(ROCKET_MOON.cx, ROCKET_MOON.cy, ROCKET_MOON.r), spacing: 30, role: 'scenery', closed: true },
      { d: ROCKET_STARS_LEFT, spacing: 80, role: 'scenery', side: 1 },
      { d: ROCKET_TREE_SMALL, spacing: 46, role: 'scenery', closed: true },
      { d: ROCKET_OUTLINE, spacing: 50, role: 'outline', closed: true, reveal: 'ahead' },
    ],
  },
  {
    id: 'butterfly', name: 'Butterfly', answer: 'a butterfly', step: 2,
    // The big upper wings.
    key: { x0: 100, y0: 40, x1: 900, y1: 262 },
    segments: [
      // The chant starts on the right-hand spot, so the pencil stays clear of the banner. The
      // printed page never shows the tell-tale layout (a body between two pairs of mirrored spots):
      // only the body and two diagonal spots are printed; their partners sprout just before the lift.
      { d: spotOnPage(BUTTERFLY_SPOTS[1]), spacing: 16, role: 'detail', closed: true },
      { d: BUTTERFLY_GARDEN, spacing: 28, role: 'scenery', side: -1 },
      { d: circlePath(BUTTERFLY_SUN.cx, BUTTERFLY_SUN.cy, BUTTERFLY_SUN.r), spacing: 15.7, role: 'scenery', closed: true },
      { d: BUTTERFLY_CLOUD, spacing: 30, role: 'scenery', closed: true },
      { d: spotOnPage(BUTTERFLY_LOWER_SPOTS[0]), spacing: 14.6, role: 'detail', closed: true },
      { d: onPage(BUTTERFLY_BODY), spacing: 22, role: 'detail', closed: true },
      { d: spotOnPage(BUTTERFLY_SPOTS[0]), spacing: 16, role: 'detail', closed: true, reveal: 'ahead' },
      { d: spotOnPage(BUTTERFLY_LOWER_SPOTS[1]), spacing: 14.6, role: 'detail', closed: true, reveal: 'ahead' },
      { d: onPage(BUTTERFLY_OUTLINE), spacing: 46, role: 'outline', closed: true, reveal: 'ahead' },
    ],
  },
];
