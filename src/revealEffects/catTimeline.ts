/**
 * "Kitten & yarn" choreography: pure, deterministic functions of (seconds,
 * layout). No React, CSS or DOM, so tests import it directly and the Stage
 * samples it once into Web Animations (see cat.tsx).
 *
 * Story (8.5 s): a ball of yarn rolls in and a round ginger kitten trots in
 * after it. The ball gives a little hop, her ears perk and she looks at it,
 * tilts her head ("?"), drops into a play bow (chest down, bottom up) and
 * wiggles her bottom (with a quick glance at the class), then bunny-hops onto
 * it. She lands in a soft, happy tangle that rolls under the cards; each
 * card's dangling yarn tail stretches down into a strand and the knitted
 * covers unravel from the top. The tangle rolls on to a spot with no names
 * above it, wobbles, and she pops up out of it: the ball rolls aside and
 * shrinks to a little leftover ball by her paw, and a striped beanie pops out
 * of the ball, flies up and plops onto her head a little askew. One ear
 * wiggle straightens it. She looks at the class, gives a slow happy blink with
 * two hearts and opens her sparkly eyes again. Then the little ball rolls off
 * toward the nearest edge of the screen and she bounds after it in two happy
 * hops (solid the whole time, never a see-through fade). The stage is empty
 * BEAT.clear seconds before the reveal ends.
 *
 * Units: art units ("a"); the sitting kitten is ~300 a tall with her beanie.
 * k = px per art unit. Poses are per rig node (see catArt.tsx), relative to the
 * node's pivot, in art units / degrees. Root nodes are placed at px / k.
 *
 * Expression changes and actor swaps are hard cuts (catCuts): the baker
 * samples both sides of each cut, so an eye is either fully open or a closed
 * arc, never a half-lid. At both actor swaps the new actor's head starts
 * exactly where the old one's was, at (almost) the same size.
 */
import { clamp01, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, keyframes, mix, progress, smooth } from './sceneMotion';

export const CAT_DURATION_MS = 8500;
const END = CAT_DURATION_MS / 1000;
/** Just before a cut (the baker samples both sides of every cut this far apart). */
export const CUT_EPSILON = 1e-4;

/** Story beats in seconds (the finale beats depend on the layout: see FinaleTimes). */
export const BEAT = {
  ballIn: [0.15, 0.98],
  /** She trots in with her feet on the floor (face and paws arrive together), then one small hop. */
  trot: [0.3, 0.92],
  hop: [0.94, 1.28],
  /** The resting ball gives a little hop and rock: the visible reason her ears perk. */
  nudge: [1.2, 1.38],
  notice: 1.4,
  tilt: [1.66, 2.1],
  /** Into the play bow: chest down, bottom up, tail high. */
  crouch: [2.1, 2.26],
  /** The bottom wiggle: the rump bobs about the shoulders (about 3 Hz) while the tail swishes against it. */
  wiggle: [2.26, 2.78],
  /** A quick glance at the class during the wiggle ("watch this!"). */
  glance: [2.42, 2.56],
  /** A round bunny-hop: she lands in the ball at the tumble. */
  pounce: [2.78, 3.12],
  tumble: 3.12,
  roll: [3.24, 4.86],
  /** One happy hind-paw kick while she rolls. */
  kick: 4.08,
  /** Earliest pop (later when the tangle rolls on to a spot further right). */
  pop: 5.18,
  /** The bound after the little ball takes this long... */
  exit: 0.76,
  /** ...and ends this long before the reveal does, so a slow start or a late stop timer never cuts her off mid-bound. */
  clear: 0.4,
  end: END,
} as const;

/**
 * The bound away, relative to its start: the little ball sets off (ballRoll), she watches it and crouches, then two hops
 * (the first covers `share` of the way) carry her off the nearest edge of the screen. Ends at BEAT.exit.
 */
export const EXIT = { crouch: [.06, .21], hops: [[.21, .47], [.47, .76]], heights: [34, 46], share: .42, ballRoll: [.04, .44] } as const;
/** When the exit starts (unless no clear spot was found: see FinaleTimes). */
export const EXIT_AT = END - BEAT.clear - BEAT.exit;

/** Finale beats, relative to the pop. The beanie flies out of the ball (peaking at hatUp) and plops on at hat. */
export const FIN = { happy: .26, land: .32, hatUp: .18, hat: .4, wiggle: .64, look: .9, blink: 1.22, blinkLen: .56 } as const;

export type FinaleTimes = {
  pop: number; happy: number; land: number; hat: number; wiggle: number; look: number;
  blink0: number; blink1: number; lean: readonly [number, number, number, number]; hearts: readonly [number, number];
  /** When the bound away starts. */
  exit: number;
};

function finaleTimes(pop: number, short: boolean): FinaleTimes {
  // A late pop (long roll to a far spot) shortens the look before the blink so the content look after it still holds.
  const squeeze = Math.max(0, Math.min(.2, pop + FIN.blink + FIN.blinkLen + .4 - EXIT_AT));
  const blink0 = pop + FIN.blink - squeeze;
  const blink1 = blink0 + FIN.blinkLen;
  return {
    pop, happy: pop + FIN.happy, land: pop + FIN.land, hat: pop + FIN.hat, wiggle: pop + FIN.wiggle,
    look: Math.min(pop + FIN.look, blink0 - .3), blink0, blink1,
    lean: short ? [blink0 + .04, blink0 + .24, blink0 + .28, blink0 + .46] : [blink0 + .04, blink0 + .26, blink1 - .2, blink1 - .04],
    hearts: [blink0 + .1, blink0 + .3],
    exit: short ? Math.min(EXIT_AT, blink0 + .5) : EXIT_AT,
  };
}

/**
 * Knitted card covers. Each card starts unravelling when the rolling tangle is
 * LEAD viewport widths short of the card's centre, clamped to [t0, t0 + span].
 * Must match cat.css: calc(3.38s + clamp(0, (var(--reveal-center-x) - .43) * 3, 1.08) * 1s), 700 ms.
 */
export const COVER = {
  t0: 3.38,
  x0: 0.43,
  secondsPerWidth: 3,
  span: 1.08,
  /** The card's yarn tail stretches down into a strand this long before the pull. */
  grab: 0.22,
  /** Top-to-bottom unravel time. */
  pull: 0.7,
  /** After its cover is gone, the strand reels back into the ball within this long (it never fades). */
  release: 0.24,
  /** Where the tangle starts rolling (fraction of the viewport width). */
  lead: 0.13,
  /** The yarn tail hanging from each cover's top cuff (px): width = clamp(min, 12% of the cover, max), its pom-pom at 1.7 x width. Mirrors cat.css. */
  tail: [26, 0.12, 48, 1.7],
  /** When the tails give a little twitch (her ears perk at the same moment). Mirrors cat.css. */
  twitch: 1.4,
} as const;

export const coverStart = (centerX01: number) => COVER.t0 + Math.max(0, Math.min(COVER.span, (clamp01(centerX01) - COVER.x0) * COVER.secondsPerWidth));
/** Fraction (0..1) of a cover already unravelled at time t (linear, as the CSS window slides). */
export const coverUnravel = (time: number, start: number) => progress(time, start, start + COVER.pull);
export const LAST_COVER_GONE = COVER.t0 + COVER.span + COVER.pull;

/** Ball/tangle size (art units). */
export const BALL_R = 30;
export const TANGLE_R = 88;
export const TANGLE_GROWTH = 0.14;
const SWELL = 0.06;
/** The little ball left by her paw (art units, at finale size 1). */
export const LEFTOVER_R = 22;
/** How far the little ball rests from her (art units, at finale size 1). */
const LEFTOVER_X = 128;
/** On dense tables (4+ rows, or cells under 60 px) the whole story plays at this size, so she never hides a row of cells. */
export const DENSE_SCALE = .65;

/* ------------------------------ rig pivots ------------------------------ */

/** Pivots shared with the art (catArt.tsx), so the head can be tracked across actor swaps and the paws planted. */
export const PIVOT = {
  sideBody: [-52, -52], sideNeck: [42, -98], sideHead: [60, -150], sideQ: [198, -296],
  sideLegs: { 's.legNF': [42, -52], 's.legFF': [24, -52], 's.legNB': [-44, -50], 's.legFB': [-62, -50] },
  tangleHead: [2, -86],
  sitNeck: [0, -106], sitHead: [0, -160],
} as const;
/** Leg length from the hip pivot to the bottom of the paw (art units). */
export const LEG_LENGTH = 52;
type LegId = keyof typeof PIVOT.sideLegs;
const LEG_IDS = Object.keys(PIVOT.sideLegs) as LegId[];
/** The legs' resting splay (degrees), so the near and far paws don't stack. */
const LEG_SPLAY: Record<LegId, number> = { 's.legNF': 0, 's.legFF': 4, 's.legNB': 0, 's.legFB': -3 };

type Chain = readonly (readonly [string, number, number])[];
export const SIDE_CHAIN: Chain = [['s', 0, 0], ['s.body', PIVOT.sideBody[0], PIVOT.sideBody[1]], ['s.neck', PIVOT.sideNeck[0], PIVOT.sideNeck[1]], ['s.head', PIVOT.sideHead[0], PIVOT.sideHead[1]]];
export const TANGLE_CHAIN: Chain = [['g', 0, 0], ['g.head', PIVOT.tangleHead[0], PIVOT.tangleHead[1]]];
export const SIT_CHAIN: Chain = [['c', 0, 0], ['c.neck', PIVOT.sitNeck[0], PIVOT.sitNeck[1]], ['c.head', PIVOT.sitHead[0], PIVOT.sitHead[1]]];

/**
 * Silhouette rims: cream outlines drawn behind a whole rig (catArt.tsx) that
 * follow their source nodes exactly (the Stage gives them the same baked
 * keyframes), so the ginger kitten reads on a ginger cover.
 */
export const RIM_FOLLOWS: Readonly<Record<string, string>> = {
  's.rn': 's.neck', 's.rh': 's.head', 's.rh.earL': 's.head.earL', 's.rh.earR': 's.head.earR',
  'g.rh': 'g.head', 'g.rh.earL': 'g.head.earL', 'g.rh.earR': 'g.head.earR',
};

export type PartPose = { x?: number; y?: number; r?: number; sx?: number; sy?: number; o?: number };
export type ScenePose = Record<string, PartPose>;
export type Frame = { x: number; y: number; s: number };

/**
 * Where the last node of a chain has its pivot (art units, stage coordinates)
 * and its overall scale. Mirrors the CSS: each node sits at (pivot - parent
 * pivot) and applies translate(x, y) rotate(r) scale(sx, sy) about its pivot.
 */
export function chainFrame(pose: ScenePose, chain: Chain): Frame {
  let a = 1; let b = 0; let c = 0; let d = 1; let e = 0; let f = 0;
  let px = 0; let py = 0;
  for (const [id, x, y] of chain) {
    const p = pose[id];
    const r = (p?.r ?? 0) * Math.PI / 180; const sx = p?.sx ?? 1; const sy = p?.sy ?? 1;
    const cos = Math.cos(r); const sin = Math.sin(r);
    const la = cos * sx; const lb = sin * sx; const lc = -sin * sy; const ld = cos * sy;
    const tx = x - px + (p?.x ?? 0); const ty = y - py + (p?.y ?? 0);
    [a, b, c, d, e, f] = [a * la + c * lb, b * la + d * lb, a * lc + c * ld, b * lc + d * ld, a * tx + c * ty + e, b * tx + d * ty + f];
    px = x; py = y;
  }
  return { x: e, y: f, s: Math.sqrt(Math.abs(a * d - b * c)) };
}

/* -------------------------------- layout -------------------------------- */

export type TextRect = { x: number; y: number; w: number; h: number };
export type CatCard = { x: number; top: number; height: number; width: number; color: string; start: number };
export type CatLayout = {
  W: number; H: number; k: number;
  /** The bottom of the app header (px): nothing of hers rises above it. */
  top: number;
  /** Ground line in px (just above the footer controls). */
  floor: number;
  /** Everything below this line (the footer bar's top edge) is hidden. */
  clip: number;
  /** A dense table: the whole story plays at DENSE_SCALE (already in k). */
  dense: boolean;
  /** Where the kitten stops (px), where the ball rests, where the covers' roll ends. */
  catX: number; ballX: number; endX: number;
  /** Tangle size factor (1, or smaller so her ears pass under a big name such as the picker's), and the size allowed at her spot. */
  gs: number; gsEnd: number;
  /** When the tangle may grow to her finale size (once it is clear of any big name). */
  grow: number;
  /** Finale: where she sits (px), her size, which side the hearts float to and the little ball rests on, and whether she leaves early (no free spot). */
  spotX: number; fs: number; heartSide: 1 | -1; ballSide: 1 | -1; short: boolean;
  /** Which way she bounds off at the end (the nearer screen edge), and how far she travels (px). */
  exitDir: 1 | -1; exitSpan: number;
  /** Which of the four twinkles around her finale spot are clear of the names, the header and the footer. */
  twinkles: readonly boolean[];
  /** Names she would hide at the finale spot (sum of covered fractions): 0 is a clean spot. */
  hidden: number;
  /** How far the tangle rolls on past the covers' roll to reach the spot (viewport widths; negative: it stops short), how long the onward roll takes, and when it arrives. */
  shift: number; onward: number; arrive: number;
  fin: FinaleTimes;
  cards: CatCard[];
  texts: readonly TextRect[];
};

type Box = readonly [number, number, number, number];
/** The sitting kitten's footprint relative to her feet (art units): head + beanie, body + wrapped tail. */
const SIT_BOXES: readonly Box[] = [[-98, -300, 196, 208], [-98, -112, 196, 116]];
/** Where the hearts float (right side; mirrored for the left). */
const HEART_BOX: Box = [46, -404, 124, 182];
/** The little leftover ball by her paw (right side; mirrored). */
const BALL_BOX: Box = [100, -52, 66, 52];
/** What the pop adds around where she sits: her head is higher for about 0.3 s, and the beanie flies out of the ball beside her cheek, up past her ear and over. */
const POP_BOXES: readonly Box[] = [[-84, -404, 196, 112], [96, -330, 96, 160]];
/** The tangle wobbling on her spot just before the pop (finale units: it is about 7% bigger than she will be): tail and ball, head and ears. */
const TANGLE_BOXES: readonly Box[] = [[-180, -232, 300, 232], [-112, -362, 224, 136]];
/** Her finale sizes, most preferred first (a smaller one is the fallback where names leave no room): on open screens, on crowded grids (3+ rows), and on dense tables (already smaller all story long). */
export const FINALE_SIZES = { roomy: [1, .8, .65], crowded: [.8, .65, .55], dense: [1, .85] } as const;
/** How far the tangle may roll on past the covers (right) or stop short (left) to reach a clear spot (viewport widths). */
export const SPOT_RANGE = [-0.14, 0.2] as const;
/** Twinkles around her finale spot (finale units from her feet): x, y, star radius. Mirrored in catArt.tsx. */
export const TWINKLES: readonly (readonly [number, number, number])[] = [[-150, -190, 12], [150, -230, 10], [-118, -300, 9], [168, -120, 8]];

export function coveredNames(texts: readonly TextRect[], x: number, y: number, w: number, h: number) {
  let sum = 0;
  for (const r of texts) {
    const ox = Math.min(r.x + r.w + 3, x + w) - Math.max(r.x - 3, x);
    const oy = Math.min(r.y + r.h + 3, y + h) - Math.max(r.y - 3, y);
    if (ox > 0 && oy > 0) sum += Math.min(1, (ox * oy) / ((r.w + 6) * (r.h + 6)));
  }
  return sum;
}

function footprint(texts: readonly TextRect[], x: number, floor: number, s: number, boxes: readonly Box[], mirror = 1) {
  let sum = 0;
  for (const [bx, by, bw, bh] of boxes) {
    const left = mirror > 0 ? bx : -(bx + bw);
    sum += coveredNames(texts, x + left * s, floor + by * s, bw * s, bh * s);
  }
  return sum;
}

/**
 * Pick where she pops out and sits: the spot within a short roll of the covers' end that hides the fewest names, counting
 * the pop moment as much as the rest, the tangle wobbling there just before it, and (less) the roll there and her bound
 * away from it. A smaller size is the fallback where names leave no room. The little ball prefers the side she will bound
 * off to (she chases it).
 */
export function placeFinale(W: number, k: number, floor: number, endX: number, texts: readonly TextRect[], sizes: readonly number[] = FINALE_SIZES.roomy) {
  let best = { cost: Infinity, x: endX, fs: 1, side: 1 as 1 | -1, ballSide: 1 as 1 | -1, hidden: 0 };
  for (const [step, fs] of sizes.entries()) {
    const s = k * fs;
    const lo = Math.max(120 * s, endX + SPOT_RANGE[0] * W);
    const hi = Math.min(W - 120 * s, endX + SPOT_RANGE[1] * W);
    // Where the covers' roll ends first (no extra roll needed), then a fine sweep either side.
    const xs = lo < hi ? [Math.max(lo, Math.min(hi, endX)), ...Array.from({ length: 61 }, (_, i) => mix(lo, hi, i / 60))] : [Math.max(0, Math.min(W, endX))];
    for (const x of xs) {
      const body = footprint(texts, x, floor, s, SIT_BOXES);
      // The pop moment counts as much as the rest (her ear and the flying beanie would brush a name), but only the resting spot counts as "hidden".
      // (The beanie only flashes past her ear, so that part counts half.)
      const popping = footprint(texts, x, floor, s, [POP_BOXES[0]]) + .5 * footprint(texts, x, floor, s, [POP_BOXES[1]]);
      const dir = x >= W / 2 ? 1 : -1;
      const passing = .4 * footprint(texts, x, floor, s, TANGLE_BOXES)
        + .12 * [.25, .5, .75].reduce((sum, u) => sum + footprint(texts, mix(endX, x, u), floor, s, TANGLE_BOXES), 0) / 3
        + .1 * [.35, .7].reduce((sum, u) => sum + footprint(texts, mix(x, dir > 0 ? W : 0, u), floor, s, SIT_BOXES), 0) / 2;
      for (const side of [1, -1] as const) {
        if (side > 0 ? x + (HEART_BOX[0] + HEART_BOX[2]) * s > W : x - (HEART_BOX[0] + HEART_BOX[2]) * s < 0) continue;
        const hearts = footprint(texts, x, floor, s, [HEART_BOX], side);
        for (const ballSide of [dir, -dir] as (1 | -1)[]) {
          if (ballSide > 0 ? x + (BALL_BOX[0] + BALL_BOX[2]) * s > W : x - (BALL_BOX[0] + BALL_BOX[2]) * s < 0) continue;
          const hidden = body + .6 * hearts + .5 * footprint(texts, x, floor, s, [BALL_BOX], ballSide);
          const cost = hidden + popping + passing + .6 * Math.abs(x - endX) / W + .2 * step + (side < 0 ? .02 : 0) + (ballSide !== dir ? .15 : 0) + (ballSide === side ? .01 : 0);
          if (cost < best.cost) best = { cost, x, fs, side, ballSide, hidden };
        }
      }
    }
  }
  return best;
}

/** Height of the tangle with her head and ears at full size (art units). */
const TANGLE_HEIGHT = (TANGLE_R + -PIVOT.tangleHead[1]) * (1 + TANGLE_GROWTH) * (1 + SWELL) + 112;

/** Shrink the tangle when that lets her ears pass under the big names (the picker); leave it when names fill the screen anyway. */
export function tangleFit(texts: readonly TextRect[], floor: number, k: number, x0: number, x1: number) {
  const height = TANGLE_HEIGHT * k;
  // Only the big lines count (the names, or the picker's one big name), not captions under them.
  const big = Math.max(22, .5 * texts.reduce((max, r) => Math.max(max, r.h), 0));
  let bottom = -Infinity;
  for (const r of texts) if (r.h >= big && r.x + r.w > x0 && r.x < x1 && r.y + r.h > floor - height) bottom = Math.max(bottom, r.y + r.h);
  if (bottom === -Infinity) return 1;
  // Leave room for the rolling bumps and her head bob.
  const need = (floor - bottom - 10) / (height + 18 * k);
  return need >= .56 ? Math.min(1, need) : 1;
}

/** Distance rolled (viewport widths) at time t for the covers' roll: ramp up, cruise at the cover-schedule speed, ramp down. */
export function rollDistance(time: number) {
  const [t0, t1] = BEAT.roll;
  const v = 1 / COVER.secondsPerWidth;
  const up = 0.28; const down = 0.4;
  const t = Math.min(time, t1);
  if (t <= t0) return 0;
  if (t < t0 + up) return v * (t - t0) ** 2 / (2 * up);
  const a = v * up / 2;
  if (t < t1 - down) return a + v * (t - t0 - up);
  const b = a + v * (t1 - down - t0 - up);
  return b + v * (down / 2 - (t1 - t) ** 2 / (2 * down));
}
const ROLL_W = rollDistance(Infinity);
/** The sitting kitten's head starts at this fraction of the tangled head's size as she pops out. */
const POP_SCALE = .93;
/** An onward roll to a spot further right starts where the covers' roll would start slowing down. */
const ONWARD_START = BEAT.roll[1] - .4;

export function catLayout(W: number, H: number, footerTop?: number, cards: readonly Omit<CatCard, 'start'>[] = [], texts: readonly TextRect[] = [], top = 0): CatLayout {
  const width = Math.max(1, W);
  const height = Math.max(1, H);
  const rows = new Set(cards.map((card) => Math.round(card.top / 24))).size;
  const shortest = cards.reduce((min, card) => Math.min(min, card.height), Infinity);
  const dense = rows >= 4 || shortest < 60;
  const k = Math.max(.5, Math.min(1.55, Math.min(width / 1280, height / 800))) * (rows >= 3 ? .82 : rows === 2 ? .9 : 1) * (dense ? DENSE_SCALE : 1);
  const floor = Math.min(height - 12 * k, footerTop ?? height - 80) - 8 * k;
  const clip = footerTop !== undefined && footerTop > floor ? Math.min(height, footerTop) : height;
  const ballX = (COVER.x0 - COVER.lead) * width;
  const catX = Math.max(ballX - 232 * k, 150 * k);
  const endX = ballX + ROLL_W * width;
  const gs = tangleFit(texts, floor, k, ballX - 120 * k, endX + 140 * k);
  const spot = placeFinale(width, k, floor, endX, texts, dense ? FINALE_SIZES.dense : rows >= 3 ? FINALE_SIZES.crowded : FINALE_SIZES.roomy);
  const gsEnd = Math.max(gs, tangleFit(texts, floor, k, spot.x - 140 * k, spot.x + 140 * k));
  const shift = (spot.x - endX) / width;
  // The onward roll never goes faster than about 0.45 W/s, even while the covers' roll is still slowing down.
  const onward = shift > 0 ? Math.max(.4, shift / .26) : 0;
  const arrive = shift > 0 ? ONWARD_START + onward : BEAT.roll[1];
  const short = spot.hidden > .5;
  const exitDir: 1 | -1 = spot.x >= width / 2 ? 1 : -1;
  const s = spot.fs * k;
  // Each twinkle is left out where it would sit on a name, above the header or behind the footer.
  const twinkles = TWINKLES.map(([x, y, r]) => {
    const cx = spot.x + x * s; const cy = floor + y * s; const half = (r * 1.15 + 3) * s;
    return cy - half > top + 4 && cy + half < clip && cx - half > 0 && cx + half < width && coveredNames(texts, cx - half, cy - half, 2 * half, 2 * half) === 0;
  });
  const L: CatLayout = {
    W: width, H: height, k, top, floor, clip, dense, catX, ballX, endX, gs, gsEnd, grow: ONWARD_START,
    spotX: spot.x, fs: spot.fs, heartSide: spot.side, ballSide: spot.ballSide, short, hidden: spot.hidden,
    exitDir, exitSpan: (exitDir > 0 ? width - spot.x : spot.x) + 120 * s, twinkles,
    shift, onward, arrive, fin: finaleTimes(arrive > BEAT.roll[1] ? Math.max(BEAT.pop, arrive + .32) : BEAT.pop, short),
    cards: cards.map((card) => ({ ...card, start: coverStart(card.x / width) })),
    texts,
  };
  // Where the tangle had to stay small under a big name (the picker), it grows to her finale size once it has rolled clear.
  if (gsEnd > gs + .01) {
    const reach = (TANGLE_R * (1 + TANGLE_GROWTH) + 40) * k;
    for (let t = BEAT.roll[0]; t < L.fin.pop - .3; t += .02) {
      const x = tangleX(t, L);
      if (tangleFit(texts, floor, k, x - reach, x + reach) >= gsEnd - .01) { L.grow = Math.max(ONWARD_START, t); break; }
      L.grow = L.fin.pop - .3;
    }
  }
  return L;
}

/* --------------------------------- tangle --------------------------------- */

/** Tangle centre x (px): the covers' roll, then on to the finale spot (or a slower roll that stops short of it). */
export function tangleX(time: number, L: Pick<CatLayout, 'ballX' | 'W' | 'shift' | 'onward'>) {
  const base = rollDistance(time);
  if (L.shift <= 0) return L.ballX + base * (1 + L.shift / ROLL_W) * L.W;
  return L.ballX + (base + L.shift * smooth(progress(time, ONWARD_START, ONWARD_START + L.onward))) * L.W;
}

const pulse = (time: number, start: number, length: number) => { const u = progress(time, start, start + length); return u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0; };

/**
 * The drawn tangle at time t: centre (px), ball radius, its uniform scale RS
 * (size factor x yarn wound in x swell before the pop), the landing grow-in
 * (bsc), squash q, roll spin.
 */
export function tangleShape(time: number, L: CatLayout) {
  const tum = BEAT.tumble;
  // Size: full as she lands (her head keeps its size across the swap), then the fitted size (under a big name), then, once the
  // last covers are going (and it is clear of any big name), the size she will sit at, so she pops out at her finale size instead
  // of jumping or shrinking afterwards.
  const fitted = mix(1, L.gs, smooth(progress(time, tum, tum + .4)));
  const growEnd = Math.max(L.grow + .25, BEAT.roll[1], L.fin.pop - .3);
  const sf = mix(fitted, Math.min(L.gsEnd, L.fs / POP_SCALE), smooth(progress(time, L.grow, Math.min(growEnd, L.fin.pop - .05))));
  const done = L.cards.length ? L.cards.reduce((sum, card) => sum + coverUnravel(time, card.start), 0) / L.cards.length : progress(time, COVER.t0, LAST_COVER_GONE);
  const RS = sf * (1 + TANGLE_GROWTH * done) * (1 + SWELL * easeInCubic(progress(time, L.fin.pop - .22, L.fin.pop)));
  const bsc = mix(.78, 1, easeOutBack(progress(time, tum, tum + .32), 1.6));
  // Landing: 10% wider and shorter on impact, easing back over 0.16 s. A smaller one when it rolls to a stop.
  const q = .1 * (1 - smooth(progress(time, tum, tum + .16))) + .06 * pulse(time, L.arrive - .05, .22);
  const x = tangleX(time, L);
  // Two soft bumps while it rolls under the cards.
  const rollU = progress(time, BEAT.roll[0] + .25, BEAT.roll[1] - .3);
  const bump = (rollU > 0 && rollU < 1 ? Math.abs(Math.sin(rollU * Math.PI * 3)) * 10 * (1 - rollU * .5) : 0) * sf;
  const units = TANGLE_R * RS * bsc;
  const cy = L.floor - (units * (1 - q) + bump) * L.k;
  const spin = ((x - L.ballX) / L.k) / (TANGLE_R * RS) * 180 / Math.PI;
  return { x, cy, RS, bsc, q, sf, bump, done, spin, units, R: units * L.k };
}

/** Tangle centre in px and its radius (art units) at time t. */
export function tangleAt(time: number, L: CatLayout) {
  const S = tangleShape(time, L);
  return { x: S.x, y: S.cy, r: S.units, done: S.done };
}

/** Where a card's unravel edge is (px) at time t. */
export function coverEdge(time: number, card: CatCard) {
  return { x: card.x, y: card.top + card.height * coverUnravel(time, card.start) };
}

/** Where a card's yarn tail ends (its little pom-pom, px): the strand grows out of it. */
export function looseEndTip(card: Pick<CatCard, 'x' | 'top' | 'width'>) {
  const [min, share, max, tip] = COVER.tail;
  return { x: card.x, y: card.top + Math.max(min, Math.min(max, card.width * share)) * tip };
}

/* --------------------------------- faces --------------------------------- */

export type Eyes = 'open' | 'closed' | 'happy';
/** Closed tiny "w", closed smile, small "o". There is no open-mouth shape at all. */
export type Mouth = 'w' | 'smile' | 'o';
export const MOUTHS: readonly Mouth[] = ['w', 'smile', 'o'];
export type Face = {
  eyes: Eyes; mouth: Mouth;
  /** Open-eye pop scale (1 = normal): only used for the soft "boing" as the eyes swap open, never below .85. */
  pop?: number;
  /** Surprised-cute: rounder, taller eyes. */
  wide?: number;
  /** Where she looks (-1..1 each way): moves the pupils and their highlights as far as the iris allows. */
  lookX?: number; lookY?: number;
  /** Pupil size (1 = normal; bigger reads as delighted). */
  pupil?: number;
  /** Extra star glints in the eyes. */
  sparkle?: number;
  /** +1 perked, -1 relaxed. */
  ears?: number;
  /** Blush strength (1 normal, up to 1.4 for the slow blink). */
  blush?: number;
};

/** Iris half-size and pupil size (art units, see catArt.tsx EyeBase/PupilArt): the pupil may travel only as far as stays inside the iris. */
const IRIS = { rx: 21, top: -20, bottom: 28 } as const;
const PUPIL = { rx: 12.5, ry: 16.5, cy: 6 } as const;
export function pupilOffset(f: Face) {
  const size = (f.pupil ?? 1) * (1 - (f.wide ?? 0) * .1);
  const lx = Math.max(-1, Math.min(1, f.lookX ?? 0)); const ly = Math.max(-1, Math.min(1, f.lookY ?? 0));
  const roomX = Math.max(0, IRIS.rx - .5 - PUPIL.rx * size);
  const roomDown = Math.max(0, IRIS.bottom - 1 - PUPIL.cy - PUPIL.ry * size);
  const roomUp = Math.max(0, PUPIL.cy - IRIS.top - 1 - PUPIL.ry * size);
  return { x: lx * roomX, y: ly >= 0 ? ly * roomDown : ly * roomUp, size };
}

export function applyFace(out: ScenePose, p: string, f: Face) {
  const wide = f.wide ?? 0;
  const pop = f.pop ?? 1;
  out[`${p}.eyes`] = { sx: (1 + wide * .05) * (1 + (1 - pop) * .45), sy: (1 + wide * .09) * pop, o: f.eyes === 'open' ? 1 : 0 };
  const { x, y, size } = pupilOffset(f);
  out[`${p}.pupilL`] = { x, y, sx: size, sy: size };
  out[`${p}.pupilR`] = { x, y, sx: size, sy: size };
  out[`${p}.spark`] = { x, y, o: f.sparkle ?? 0 };
  out[`${p}.closed`] = { o: f.eyes === 'closed' ? 1 : 0 };
  out[`${p}.happy`] = { o: f.eyes === 'happy' ? 1 : 0 };
  for (const mouth of MOUTHS) out[`${p}.m_${mouth}`] = { o: f.mouth === mouth ? 1 : 0 };
  const perk = f.ears ?? 0;
  out[`${p}.earL`] = { r: perk * 6, sy: 1 + Math.max(0, perk) * .06 };
  out[`${p}.earR`] = { r: -perk * 6, sy: 1 + Math.max(0, perk) * .06 };
  const blush = f.blush ?? .75;
  const extra = Math.max(0, blush - 1);
  out[`${p}.blush`] = { o: Math.min(1, blush), sx: 1 + extra * .5, sy: 1 + extra * .35 };
}

const fadeIn = (t: number, start: number, length: number) => smooth(progress(t, start, start + length));

/* ------------------------------ side kitten ------------------------------ */

/** The bunny-hop pounce, keyed on its progress 0..1: tucked, round, never a flat "flying" plank. */
const POUNCE = {
  body: [[0, 20], [.15, -12], [.5, -3], [.85, 6], [1, 8]],
  front: [[0, -34], [.15, -48], [.4, -64], [.8, -58], [1, -54]],
  frontLen: [[0, .56], [.15, .92], [.35, .7], [1, .7]],
  hind: [[0, 0], [.12, 26], [.32, -6], [.6, -16], [1, -12]],
  hindLen: [[0, 1.1], [.12, 1.06], [.32, .74], [1, .72]],
  neck: [[0, -11], [.2, -5], [1, 0]],
  tail: [[0, -20], [.5, 4], [1, 14]],
  /** Take-off stretch (+), then round in the air. */
  stretch: [[0, 0], [.1, 1], [.3, .2], [.55, -.15], [.8, 0], [1, 0]],
} as const;
const last = (keys: readonly (readonly [number, number])[]) => keys[keys.length - 1][1];
/** Her head's offset from her feet in the landing pose (art units). */
const LAND_OFFSET = chainFrame({ 's.body': { r: last(POUNCE.body) }, 's.neck': { r: last(POUNCE.neck) } }, SIDE_CHAIN);
/** Where her head lands, relative to the ball (art units): just above it, at about her standing height. */
const LAND_HEAD = { dx: 6, lift: 138 } as const;

/**
 * The play bow: hips raised on straight hind legs, the body tipped forward so her bottom sits well above her shoulders,
 * forelegs folded with the paws forward on the floor, chin low. The wiggle rocks the body about the shoulders (the head
 * stays put while the bottom bobs) with the tail swishing against it.
 */
const BOW = { lift: 15, body: 27, front: 36, neck: -16, head: -5, tail: -26, wiggle: 6.5, cycles: 1.75, swish: 24, squash: .06 } as const;
/** The body-local point the wiggle rocks about (her shoulders, under her head). */
const SHOULDER = [40, -96] as const;

type Pt = { x: number; y: number };
/** A body-local point of the side kitten in root space (art units, feet at the origin) with the body rotated r degrees about its pivot. */
function onBody(p: readonly [number, number], r: number): Pt {
  const a = r * Math.PI / 180; const [px, py] = PIVOT.sideBody; const dx = p[0] - px; const dy = p[1] - py;
  return { x: px + dx * Math.cos(a) - dy * Math.sin(a), y: py + dx * Math.sin(a) + dy * Math.cos(a) };
}
/** A leg's paw at rest (root space): straight down from its hip, with its splay. */
const restPaw = (leg: LegId): Pt => {
  const [x, y] = PIVOT.sideLegs[leg]; const a = LEG_SPLAY[leg] * Math.PI / 180;
  return { x: x - LEG_LENGTH * Math.sin(a), y: y + LEG_LENGTH * Math.cos(a) };
};
/** Leg rotation (relative to the body) and length that put its paw on `paw` (root space). */
function plant(leg: LegId, bodyR: number, paw: Pt) {
  const hip = onBody(PIVOT.sideLegs[leg], bodyR);
  const vx = paw.x - hip.x; const vy = paw.y - hip.y;
  return { r: Math.atan2(-vx, vy) * 180 / Math.PI - bodyR, sy: Math.hypot(vx, vy) / LEG_LENGTH };
}

type SidePose = { x: number; y: number; body: number; legs: Record<LegId, { r: number; sy: number }>; neck: number; neckY: number; head: number; tail: number };
const mixSide = (a: SidePose, b: SidePose, u: number): SidePose => ({
  x: mix(a.x, b.x, u), y: mix(a.y, b.y, u), body: mix(a.body, b.body, u), neck: mix(a.neck, b.neck, u), neckY: mix(a.neckY, b.neckY, u), head: mix(a.head, b.head, u), tail: mix(a.tail, b.tail, u),
  legs: Object.fromEntries(LEG_IDS.map((id) => [id, { r: mix(a.legs[id].r, b.legs[id].r, u), sy: mix(a.legs[id].sy, b.legs[id].sy, u) }])) as SidePose['legs'],
});

/** The play bow and bottom wiggle at time t (c: how far into the bow), standing at x0 (art units) on the floor y0. */
function bowPose(time: number, c: number, x0: number, y0: number, baseTail: number): SidePose & { wiggling: number; wig: number } {
  const w = progress(time, BEAT.wiggle[0], BEAT.wiggle[1]);
  const wiggling = smooth(progress(w, 0, .14)) * (1 - smooth(progress(w, .78, 1)));
  const phase = w * Math.PI * 2 * BOW.cycles;
  const wig = Math.sin(phase) * wiggling;
  const base = BOW.body * c; const body = base + BOW.wiggle * wig;
  // Rock about the shoulders: shift the root so they stay where the bow put them.
  const s0 = onBody(SHOULDER, base); const s1 = onBody(SHOULDER, body);
  const x = x0 + s0.x - s1.x; const y = y0 - BOW.lift * c + s0.y - s1.y;
  // Paws stay planted on the floor (the forepaws reach forward into the bow), whatever the body does.
  const legs = Object.fromEntries(LEG_IDS.map((id) => {
    const rest = restPaw(id);
    const paw = { x: x0 + rest.x + (id === 's.legNF' || id === 's.legFF' ? BOW.front * c : 0) - x, y: y0 + rest.y - y };
    return [id, plant(id, body, paw)];
  })) as SidePose['legs'];
  // The neck takes the wiggle back out, so her head holds still while her bottom bobs.
  return {
    x, y, body, legs, neck: BOW.neck * c - BOW.wiggle * wig, neckY: 3 * c, head: BOW.head * c, wiggling, wig,
    tail: mix(baseTail, BOW.tail, c) - BOW.swish * Math.sin(phase + .5) * wiggling,
  };
}

/** The side-view kitten: trot in, hop, notice, tilt, play bow, wiggle, bunny-hop. Parked at the landing pose once she is a tangle. */
function sideKitten(t: number, L: CatLayout, out: ScenePose) {
  const shown = t < BEAT.tumble ? 1 : 0;
  const time = Math.min(t, BEAT.tumble - CUT_EPSILON);
  const { k } = L;
  const startX = -180 * k;
  const trotTo = mix(startX, L.catX, .72);
  let x = startX; let lift = 0; let sx = 1; let sy = 1;
  let nf = 0; let ff = 0; let nb = 0; let fb = 0; let bodyR = 0; let headBob = 0;

  // Trot in after the ball: diagonal leg pairs, a soft bob, feet on the floor. She comes on screen at her
  // quickest and slows into the hop, so the moment where only her face has arrived is brief.
  const trot = progress(time, BEAT.trot[0], BEAT.trot[1]);
  x = mix(startX, trotTo, 1 - (1 - trot) ** 1.45);
  if (trot > 0 && trot < 1) {
    const phase = (time - BEAT.trot[0]) * Math.PI * 2 * 3.3;
    const amp = smooth(progress(trot, 0, .1)) * (1 - smooth(progress(trot, .8, 1)));
    const swing = Math.sin(phase) * 22 * amp;
    nf = swing; fb = swing * .9; ff = -swing * .9; nb = -swing;
    lift = 5 * Math.abs(Math.sin(phase)) * amp;
    bodyR = -1.5 * Math.sin(phase * 2) * amp;
    headBob = 2.5 * Math.sin(phase * 2 + .8) * amp;
  }
  // One small hop to where she stops.
  const hop = progress(time, BEAT.hop[0], BEAT.hop[1]);
  if (hop > 0) {
    x = mix(trotTo, L.catX, smooth(hop) * .35 + hop * .65);
    if (hop < 1) {
      const air = Math.sin(Math.PI * hop);
      lift = air * 22;
      nf = ff = -24 * air; nb = fb = 22 * air; bodyR = mix(-6, 5, hop) * air;
      sy = 1 + .05 * air * (1 - hop); sx = 1 - .03 * air * (1 - hop);
    }
  }
  // Anticipation squash before the hop and a soft landing squash after.
  const squash = Math.max(pulse(time, BEAT.hop[0] - .09, .09) * .07, pulse(time, BEAT.hop[1], .18) * .13);
  sy *= 1 - squash; sx *= 1 + squash * .7;

  // She watches the ball the whole time (it is below and to her right): pupils and highlights shifted toward it.
  const face: Face = { eyes: 'open', mouth: 'w', lookX: .8, lookY: .5, pupil: 1, ears: 0 };
  if (time >= BEAT.hop[1]) { face.lookX = .9; face.lookY = .8; }
  let neckR = 0; const headR = 0; let tailR = mix(-4, 4, .5 + .5 * Math.sin(time * 3.2));
  let headDy = headBob;

  // Notice: ears perk, eyes go round, a tiny jolt.
  const notice = progress(time, BEAT.notice, BEAT.notice + .12);
  if (time >= BEAT.notice) {
    face.ears = smooth(notice);
    const jolt = pulse(time, BEAT.notice, .2);
    lift += jolt * 6; sy *= 1 + jolt * .04;
    if (time < BEAT.tilt[0]) Object.assign(face, { wide: smooth(notice), mouth: 'o', lookX: 1, lookY: 1, pupil: 1.05 });
    tailR = mix(tailR, -10, smooth(notice));
  }
  // Curious head tilt toward the yarn: a gentle 12 degree roll pivoting at the neck, the chin stays up.
  const tilt = smooth(progress(time, BEAT.tilt[0], BEAT.tilt[0] + .22)) * (1 - smooth(progress(time, BEAT.crouch[0], BEAT.crouch[0] + .14)));
  if (time >= BEAT.tilt[0]) {
    neckR = 12 * tilt + 1.2 * Math.sin((time - BEAT.tilt[0]) * 4) * tilt;
    headDy += -3 * tilt;
    Object.assign(face, { wide: 0, mouth: 'w', lookX: 1, lookY: 1, pupil: 1.08, ears: 1 });
  }
  let pose: SidePose = {
    x: x / k, y: (L.floor - lift * k) / k, body: bodyR, neck: neckR, neckY: headDy, head: headR, tail: tailR,
    legs: { 's.legNF': { r: nf, sy: 1 }, 's.legFF': { r: ff + LEG_SPLAY['s.legFF'], sy: 1 }, 's.legNB': { r: nb, sy: 1 }, 's.legFB': { r: fb + LEG_SPLAY['s.legFB'], sy: 1 } },
  };
  // Play bow, bottom up, then the wiggle (a small squash going into it).
  let wiggling = 0; let wig = 0;
  if (time >= BEAT.crouch[0]) {
    const c = smooth(progress(time, BEAT.crouch[0], BEAT.crouch[1]));
    const bow = bowPose(time, c, x / k, L.floor / k, tailR);
    wiggling = bow.wiggling; wig = bow.wig;
    pose = { ...bow, neck: pose.neck + bow.neck, neckY: pose.neckY + bow.neckY };
    const dip = pulse(time, BEAT.crouch[0], BEAT.crouch[1] - BEAT.crouch[0]) * BOW.squash;
    sy *= 1 - dip; sx *= 1 + dip * .7;
    Object.assign(face, { eyes: 'open', mouth: 'smile', pupil: 1.15, sparkle: c, lookX: 1, lookY: 1, ears: 1, blush: 1 });
    // "Watch this!": one quick glance at the class in the middle of the wiggle.
    if (time >= BEAT.glance[0] && time < BEAT.glance[1]) Object.assign(face, { lookX: -.1, lookY: -.2, pupil: 1.22 });
  }
  // Bunny-hop: a round arc out of the bow into the ball; her head lands just above it.
  if (time >= BEAT.pounce[0]) {
    const pu = progress(time, BEAT.pounce[0], BEAT.pounce[1]);
    const st = keyframes(pu, POUNCE.stretch);
    sx = 1 - .05 * st; sy = 1 + .07 * st;
    const landX = (L.ballX + LAND_HEAD.dx * k) / k - LAND_OFFSET.x;
    const landY = (L.floor - LAND_HEAD.lift * k) / k - LAND_OFFSET.y;
    const front = keyframes(pu, POUNCE.front); const hind = keyframes(pu, POUNCE.hind);
    const frontLen = keyframes(pu, POUNCE.frontLen); const hindLen = keyframes(pu, POUNCE.hindLen);
    const leap: SidePose = {
      x: mix(L.catX / k, landX, .3 * smooth(pu) + .7 * pu), y: mix(L.floor / k, landY, pu) - 58 * Math.sin(Math.PI * pu),
      body: keyframes(pu, POUNCE.body), neck: keyframes(pu, POUNCE.neck), neckY: 0, head: 0, tail: keyframes(pu, POUNCE.tail),
      legs: { 's.legNF': { r: front, sy: frontLen }, 's.legFF': { r: front * .9, sy: frontLen }, 's.legNB': { r: hind, sy: hindLen }, 's.legFB': { r: hind * .9, sy: hindLen } },
    };
    // Spring out of the bow pose (no jump at take-off). Along the floor she simply follows the leap (it starts where she stands).
    pose = { ...mixSide(pose, leap, smooth(progress(pu, 0, .3))), x: leap.x };
    Object.assign(face, { eyes: 'open', mouth: 'o', pupil: 1.1, sparkle: 1, lookX: .5, lookY: 1, ears: 1, blush: 1, wide: 0 });
  }
  out.s = { x: pose.x, y: pose.y, sx, sy, o: shown };
  out['s.body'] = { r: pose.body };
  for (const id of LEG_IDS) out[id] = { r: pose.legs[id].r, sy: pose.legs[id].sy };
  out['s.wig'] = { o: wiggling * (.55 + .45 * Math.abs(wig)), x: -3 * wig };
  out['s.tail'] = { r: pose.tail };
  out['s.neck'] = { r: pose.neck, y: pose.neckY };
  out['s.head'] = { r: pose.head };
  applyFace(out, 's.head', face);
  // The ear-perk sparkles pop in and then shrink away (never a see-through fade).
  const perk = progress(time, BEAT.notice, BEAT.notice + .56);
  const perkPop = Math.max(.001, (.7 + .3 * easeOutBack(progress(time, BEAT.notice, BEAT.notice + .2), 2)) * (1 - smooth(progress(time, BEAT.notice + .4, BEAT.notice + .56))));
  out['s.head.perk'] = { o: perk > 0 && perk < 1 ? fadeIn(time, BEAT.notice, .08) : 0, sx: perkPop, sy: perkPop };
  // The "?" pops in clear above her raised ear with a small bounce, bobs gently, and goes when she bows.
  const q = progress(time, BEAT.tilt[0] + .06, BEAT.crouch[0] + .04);
  const qPop = Math.max(.001, easeOutBack(progress(q, 0, .22), 2.4) * (1 - smooth(progress(q, .8, 1))));
  out['s.q'] = { o: q > 0 && q < 1 ? 1 : 0, sx: qPop, sy: qPop, r: 4 * Math.sin(q * 5), y: -5 * Math.sin(q * 8) };
  return { x: pose.x * k, lift: L.floor / k - pose.y, shown };
}

/** Where the trailing floor strand starts (art units, off-screen left). */
export const TRAIL_START = -60;

/** The little yarn ball before the pounce (parked where it is swallowed by the tangle). */
function yarnBall(t: number, L: CatLayout, out: ScenePose) {
  const shown = t < BEAT.tumble ? 1 : 0;
  const time = Math.min(t, BEAT.tumble - CUT_EPSILON);
  const { k } = L;
  const [a, b] = BEAT.ballIn;
  const u = progress(time, a, b);
  const start = -60 * k;
  const x = mix(start, L.ballX, easeOutCubic(u));
  // Two bounces that fade as it slows.
  let bounce = u < 1 ? Math.abs(Math.sin(u * Math.PI * 2.2)) * 26 * (1 - u) ** 1.4 : 0;
  // The nudge: a little hop and rock just before she notices it (the visible trigger), and a wiggle while she wiggles.
  const nudge = progress(time, BEAT.nudge[0], BEAT.nudge[1]);
  bounce += nudge > 0 && nudge < 1 ? Math.sin(Math.PI * nudge) * 10 : 0;
  const wob = Math.sin(nudge * Math.PI * 2) * 14 * (1 - nudge) + Math.sin((time - BEAT.wiggle[0]) * 18) * 4 * (progress(time, BEAT.wiggle[0], BEAT.wiggle[0] + .06) - progress(time, BEAT.wiggle[1] - .16, BEAT.wiggle[1] - .06));
  const squash = pulse(time, BEAT.nudge[1], .12) * .12;
  const spin = ((x - start) / k) / BALL_R * 180 / Math.PI + wob;
  out.b = { x: x / k, y: (L.floor - (BALL_R * (1 - squash) + bounce) * k) / k, sx: 1 + squash * .8, sy: 1 - squash, o: shown };
  out['b.spin'] = { r: spin };
  // The strand it trails is laid on the floor behind it (anchored off-screen left, stretched to the ball).
  out.trail = { x: TRAIL_START, y: L.floor / k, sx: Math.max(.001, (x - TRAIL_START * k) / (L.ballX - TRAIL_START * k)), o: shown };
  return { x, shown };
}

/** Cached per layout: the side kitten's head as she lands (the tangle starts from it) and the tangle at the pop (the sitting kitten starts from it). */
const joins = new WeakMap<CatLayout, { land: Frame; pop: Frame; popBall: { x: number; y: number; s: number; spin: number }; wraps: number[] }>();
function joinsOf(L: CatLayout) {
  let found = joins.get(L);
  if (!found) {
    const side: ScenePose = {};
    sideKitten(BEAT.tumble - CUT_EPSILON, L, side);
    const land = chainFrame(side, SIDE_CHAIN);
    // Stored first so tangle() can read it while it computes the pop frame.
    found = { land: { x: land.x * L.k, y: land.y * L.k, s: land.s }, pop: { x: 0, y: 0, s: 1 }, popBall: { x: 0, y: 0, s: 1, spin: 0 }, wraps: [] };
    joins.set(L, found);
    const before = L.fin.pop - CUT_EPSILON;
    const tangled: ScenePose = {};
    tangle(before, L, tangled);
    const head = chainFrame(tangled, TANGLE_CHAIN);
    found.pop = { x: head.x * L.k, y: head.y * L.k, s: head.s };
    const S = tangleShape(before, L);
    found.popBall = { x: S.x, y: S.cy, s: S.RS, spin: tangled['g.ball']?.r ?? 0 };
    found.wraps = Array.from({ length: 6 }, (_, i) => tangled[`g.wrap${i}`]?.o ?? 0);
  }
  return found;
}

function tangle(t: number, L: CatLayout, out: ScenePose) {
  const tum = BEAT.tumble;
  const shown = t >= tum && t < L.fin.pop ? 1 : 0;
  const time = Math.min(Math.max(t, tum), L.fin.pop - CUT_EPSILON);
  const { k } = L;
  const S = tangleShape(time, L);
  // Wobble to a stop at her spot, puff up a little, then pop.
  const wob = progress(time, L.fin.pop - .36, L.fin.pop - .02);
  const wobble = wob > 0 && wob < 1 ? Math.sin(wob * Math.PI * 4) * (1 - wob * .4) : 0;
  out.g = { x: S.x / k, y: S.cy / k, sx: S.RS * (1 + S.q), sy: S.RS * (1 - S.q), r: wobble * 5, o: shown };
  out['g.core'] = { sx: S.bsc, sy: S.bsc };
  out['g.fore'] = { sx: S.bsc, sy: S.bsc };
  out['g.ball'] = { r: S.spin - 90 * (1 - easeOutCubic(progress(time, tum, tum + .4))) };
  // Wraps in the cards' colours appear as each cover finishes.
  for (let i = 0; i < 6; i++) {
    const card = L.cards[i];
    out[`g.wrap${i}`] = { o: card ? smooth(progress(time, card.start + COVER.pull * .3, card.start + COVER.pull)) : 0 };
  }
  const rolling = time > BEAT.roll[0] && time < L.arrive;
  const bat = (phase: number) => Math.max(0, Math.sin(time * 9 + phase)) * (rolling ? 1 : .3);
  out['g.pawL'] = { r: -14 * bat(0), y: -3 * bat(0) };
  out['g.pawR'] = { r: 14 * bat(2.2), y: -3 * bat(2.2) };
  // One happy kick of a hind paw (toe beans to the class) while she rolls.
  out['g.hind'] = { r: 8 * Math.sin(time * 7) + keyframes(progress(time, BEAT.kick, BEAT.kick + .5), [[0, 0], [.25, -34], [.55, 8], [1, 0]]) };
  out['g.tail'] = { r: 14 * Math.sin(time * 5.5) - 6 };
  // Her head starts exactly where (and as big as) it was when she landed, then settles on top of the ball.
  // It keeps the same size while the ball grows around her.
  const land = joinsOf(L).land;
  const S0 = tangleShape(tum, L);
  const restX = S0.x + PIVOT.tangleHead[0] * S0.RS * (1 + S0.q) * k;
  const restY = S0.cy + PIVOT.tangleHead[1] * S0.bsc * S0.RS * (1 - S0.q) * k;
  const dx = (land.x - restX) / (S0.RS * (1 + S0.q) * k); const dy = (land.y - restY) / (S0.RS * (1 - S0.q) * k);
  const settle = easeOutCubic(progress(time, tum, tum + .3));
  const hs = S.sf / S.RS;
  const rock = 6 * Math.sin((time - tum) * 4.2) * smooth(progress(time, tum, tum + .3));
  out['g.head'] = {
    x: dx * (1 - settle), y: PIVOT.tangleHead[1] * (S.bsc - 1) + dy * (1 - settle) - 3 * Math.abs(Math.sin(time * 4.2)) * settle,
    r: last(POUNCE.body) * (1 - settle) + rock + wobble * 4, sx: hs, sy: hs,
  };
  // Surprised-cute as she lands (the same face she pounced with), happily tangled "^^" while rolling, surprised-cute again just before the pop.
  const face: Face = { eyes: 'happy', mouth: 'smile', ears: .3, blush: 1.3 };
  if (time < tum + .3) Object.assign(face, { eyes: 'open', mouth: 'o', pupil: 1.1, sparkle: 1, lookX: .5, lookY: 1, ears: 1, blush: 1 });
  else if (time >= L.fin.pop - .36) Object.assign(face, { eyes: 'open', mouth: 'o', wide: .6, pupil: 1.15, sparkle: 1, lookX: 0, lookY: -.3, ears: 1, blush: 1 });
  applyFace(out, 'g.head', face);
  return { S, shown };
}

/**
 * Her bound away, e seconds after the exit starts: how far along the floor (px, toward the exit edge), lift (a),
 * squash and stretch, and lean (degrees, into the bound).
 */
export function exitPose(e: number, L: Pick<CatLayout, 'exitDir' | 'exitSpan'>) {
  const dir = L.exitDir;
  const [c0] = EXIT.crouch; const [[a0, a1], [b0, b1]] = EXIT.hops;
  const u1 = progress(e, a0, a1); const u2 = progress(e, b0, b1);
  const glide = (u: number) => mix(u, smooth(u), .3);
  const dx = dir * L.exitSpan * (EXIT.share * glide(u1) + (1 - EXIT.share) * glide(u2));
  const arc = (u: number, h: number) => (u > 0 && u < 1 ? h * 4 * u * (1 - u) : 0);
  const lift = arc(u1, EXIT.heights[0]) + arc(u2, EXIT.heights[1]);
  // A deep crouch (14%), stretched take-offs, round in the air, a quick squash where she touches down between the hops.
  const stretch = keyframes(e, [[c0, 0], [.15, -.14], [a0, .1], [.31, 0], [.44, .03], [b0, -.1], [.5, .1], [.6, 0], [.74, .03]]);
  // She leans back a little in the crouch, then into the bound.
  const r = dir * keyframes(e, [[c0, 0], [.15, -4], [a0, 3], [.3, 11], [.45, 7], [b0, 4], [.56, 12]]);
  return { dx, lift, sx: 1 - stretch * .6, sy: 1 + stretch, r };
}

/**
 * The beanie's flight out of the ball (relative to where it sits on her head, head units): from the ball's edge beside her
 * cheek, bowed out past her ear (a quadratic curve through the middle point), to its peak well above her head.
 */
const HAT_FLIGHT = [[104, 112], [150, -26], [28, -80]] as const;

/** The sitting kitten with her beanie: pops up out of the tangle, delighted, content, slow blink, then bounds off after the little ball. */
function sittingKitten(t: number, L: CatLayout, out: ScenePose) {
  const F = L.fin; const P = F.pop; const { k } = L;
  const X = F.exit; const gone = X + BEAT.exit;
  const shown = t >= P && t < gone ? 1 : 0;
  const time = Math.min(Math.max(t, P), gone - CUT_EPSILON);
  const J = joinsOf(L);
  // Pop: her head starts where the tangled head was, at 93% of its size, and she springs up and drops softly onto the floor.
  const sc0 = POP_SCALE * J.pop.s;
  const u = progress(time, P, F.land);
  const sc = mix(sc0, L.fs, smooth(u));
  const lift0 = (L.floor - J.pop.y) / k + PIVOT.sitHead[1] * sc0;
  let lift = u < 1 ? mix(lift0, 0, u * u) + 16 * Math.sin(Math.PI * u) : 0;
  let x = mix(J.pop.x, L.spotX, smooth(u));
  const stretch = u < 1 ? Math.sin(Math.PI * u) * .07 : 0;
  const land = pulse(time, F.land, .2);
  const breathe = time > F.land + .2 && time < X ? Math.sin((time - F.land) * 5.2) * .012 : 0;
  let sx = sc * (1 - stretch * .6 + land * .1 - breathe * .5);
  let sy = sc * (1 + stretch - land * .13 + breathe);
  let r = 0;
  // Exit: she watches the little ball roll off, crouches, and bounds after it off the nearest edge.
  if (time >= X) {
    const ex = exitPose(time - X, L);
    x += ex.dx; lift = ex.lift; sx *= ex.sx; sy *= ex.sy; r = ex.r;
  }
  const y = L.floor - lift * k;
  out.c = { x: x / k, y: y / k, r, sx, sy, o: shown };
  // Head: a little happy wiggle after landing; the content lean only happens while the eyes are shut.
  const [l0, l1, l2, l3] = F.lean;
  const happyWiggle = time > F.land && time < F.look ? Math.sin((time - F.land) * 13) * 5 * (1 - progress(time, F.land, F.look)) : 0;
  const lean = 8 * L.heartSide * (smooth(progress(time, l0, l1)) - smooth(progress(time, l2, l3)));
  const blinkSquash = pulse(time, F.blink0, .16) * .035 + (L.short ? 0 : pulse(time, F.blink1, .18) * .03);
  out['c.neck'] = { r: 0, y: land * 4 };
  out['c.head'] = { r: happyWiggle + lean, sx: 1 + blinkSquash * .6, sy: 1 - blinkSquash };
  // The beanie pops out of the ball beside her cheek, flies up in an arc well above her head, and drops onto it a little
  // askew; one ear wiggle straightens it.
  const hatU = progress(time, P, F.hat);
  const up = FIN.hatUp / FIN.hat;
  if (time < F.hat) {
    // Up the outside of her right cheek and ear (a curve bowed away from her face), over the top, then down.
    const s = easeOutCubic(progress(hatU, 0, up)); const fall = progress(hatU, up, 1) ** 2;
    const curve = (a: number, b: number, c: number) => (1 - s) ** 2 * a + 2 * s * (1 - s) * b + s * s * c;
    const grow = easeOutBack(progress(hatU, 0, .36), 1.6);
    out['c.head.hat'] = {
      x: hatU < up ? curve(HAT_FLIGHT[0][0], HAT_FLIGHT[1][0], HAT_FLIGHT[2][0]) : mix(HAT_FLIGHT[2][0], 3, fall),
      y: hatU < up ? curve(HAT_FLIGHT[0][1], HAT_FLIGHT[1][1], HAT_FLIGHT[2][1]) : mix(HAT_FLIGHT[2][1], 0, fall),
      r: hatU < up ? mix(40, 16, s) : mix(16, -11, fall), sx: Math.max(.001, grow), sy: Math.max(.001, grow),
    };
  } else {
    const plop = pulse(time, F.hat, .18);
    const fix = easeOutBack(progress(time, F.wiggle + .08, F.wiggle + .36), 2);
    out['c.head.hat'] = { x: 3 * (1 - fix), y: 3 * plop, r: mix(-11, 0, fix), sx: 1 + .08 * plop, sy: 1 - .12 * plop };
  }
  const spring = (since: number) => since > 0 ? Math.exp(-since * 3.4) * Math.sin(since * 15) : 0;
  const pomBounce = spring(time - F.hat) + .7 * spring(time - (F.wiggle + .22)) + .6 * spring(time - (X + EXIT.hops[0][0])) + .6 * spring(time - (X + EXIT.hops[1][0]));
  out['c.head.pom'] = { r: 16 * pomBounce + 2 * Math.sin(time * 3), y: -2 * Math.abs(pomBounce) };
  // Faces: surprised-cute pop (the tangle's last face), delighted ^^, looks at the class, slow blink, sparkly content eyes,
  // spots the little ball rolling off (eyes on it), happy ^^ bounds.
  const face: Face = { eyes: 'open', mouth: 'o', wide: .6, pupil: 1.15, sparkle: 1, lookX: 0, lookY: -.3, ears: 1, blush: 1 };
  if (time >= X + EXIT.hops[0][0] || (time >= X && L.short)) Object.assign(face, { eyes: 'happy', mouth: 'smile', wide: 0, ears: 1, blush: 1.3 });
  else if (time >= X) Object.assign(face, { eyes: 'open', mouth: 'o', wide: .4, pupil: 1.2, sparkle: 1, lookX: L.exitDir, lookY: .7, ears: 1, blush: 1.15 });
  else if (time >= F.blink1 && !L.short) {
    // Eyes swap straight to fully open, sparkly, with a soft boing (never a narrowed lid in between).
    const boing = keyframes(progress(time, F.blink1, F.blink1 + .2), [[0, .88], [.45, 1.05], [1, 1]]);
    Object.assign(face, { eyes: 'open', mouth: 'w', wide: 0, pop: boing, pupil: 1.2, sparkle: 1, lookX: 0, lookY: .1, ears: mix(-.4, .15, smooth(progress(time, F.blink1, F.blink1 + .3))), blush: 1.15 });
  } else if (time >= F.blink0) Object.assign(face, { eyes: 'closed', mouth: 'smile', wide: 0, ears: mix(.3, -.4, smooth(progress(time, F.blink0, F.blink0 + .25))), blush: 1.4 });
  else if (time >= F.look) Object.assign(face, { eyes: 'open', mouth: 'smile', wide: 0, pupil: 1.2, sparkle: 1, lookX: 0, lookY: .1, ears: .3, blush: 1 });
  else if (time >= F.happy) Object.assign(face, { eyes: 'happy', mouth: 'smile', wide: 0, ears: .6, blush: 1.3 });
  applyFace(out, 'c.head', face);
  // The ear wiggle that straightens the beanie.
  out['c.head.earR'].r = (out['c.head.earR'].r ?? 0) + keyframes(progress(time, F.wiggle, F.wiggle + .4), [[0, 0], [.2, -16], [.45, 10], [.7, -5], [1, 0]]);

  // The little leftover ball: it is the tangle's ball at the pop (in front of her body, behind her head), rolls aside to her
  // paw while it shrinks; at the end it sets off toward the exit edge and she chases it. Stored relative to her.
  const B = J.popBall;
  const bu = easeOutCubic(progress(time, P, P + .42));
  const ws = mix(B.s, LEFTOVER_R / TANGLE_R * L.fs, bu);
  const restX = L.spotX + L.ballSide * LEFTOVER_X * L.fs * k;
  let bx = mix(B.x, restX, bu); let hopUp = 0; let unroll = Math.max(.001, easeOutCubic(progress(time, P + .22, P + .52)));
  // Ahead of her: it rolls off and she follows. Behind her: it sets off a little earlier and rolls past her paws first.
  const ahead = L.ballSide === L.exitDir;
  const [r0, r1] = ahead ? EXIT.ballRoll : [EXIT.ballRoll[0] - .2, EXIT.ballRoll[1]];
  const roll = progress(time - X, r0, r1);
  if (roll > 0) {
    const out0 = L.exitDir > 0 ? L.W + (LEFTOVER_R + 4) * L.fs * k : -(LEFTOVER_R + 4) * L.fs * k;
    bx = mix(restX, out0, ahead ? roll ** 1.35 : easeInOutCubic(roll));
    hopUp = 8 * L.fs * pulse(time - X, r0 - .02, .14);
    unroll = ahead ? unroll * (1 + .5 * roll) : unroll * Math.max(.001, 1 - smooth(progress(roll, 0, .3)));
  }
  const by = L.floor - (TANGLE_R * ws + hopUp) * k;
  const spin = B.spin + ((bx - B.x) / k) / (TANGLE_R * Math.max(ws, .2)) * 180 / Math.PI;
  // Undo her rotation and squash for the ball (a child of hers, so it sits between her body and her head): it stays round.
  const a = -r * Math.PI / 180; const dxw = bx / k - x / k; const dyw = by / k - y / k;
  out['c.lb'] = { x: (dxw * Math.cos(a) - dyw * Math.sin(a)) / sx, y: (dxw * Math.sin(a) + dyw * Math.cos(a)) / sy, sx: ws / sx, sy: ws / sy };
  out['c.lb.spin'] = { r: spin - r };
  for (let i = 0; i < 6; i++) out[`c.lb.wrap${i}`] = { o: J.wraps[i] ?? 0 };
  // Its loose end unrolls along the floor toward her paw once it is small (and trails behind it when it rolls off).
  out['c.lb.end'] = { r: -r, sx: unroll * L.ballSide };

  // Hearts float up beside her head on whichever side is clear of names (world nodes: they stay as she leaves), then pop away.
  const side = L.heartSide;
  const heart = (start: number, rise: number, px: number, py: number, size: number): PartPose => {
    const hu = progress(time, start, start + 1.05);
    const s = easeOutBack(progress(hu, 0, .28), 2.6) * (1 - .15 * hu) * (1 - smooth(progress(hu, .74, 1))) * L.fs * size;
    return { x: (L.spotX + side * px * L.fs * k) / k + side * 6 * Math.sin(hu * 6), y: (L.floor - py * L.fs * k) / k - rise * hu * L.fs, sx: Math.max(.001, s), sy: Math.max(.001, s), r: side * 8 * Math.sin(hu * 5), o: hu > 0 && hu < 1 ? 1 : 0 };
  };
  out.h1 = heart(F.hearts[0], 70, 88, 284, 1.55);
  out.h2 = heart(F.hearts[1], 56, 136, 244, .8);
  return { x, lift, shown, sc, ball: { x: bx, y: by, s: ws } };
}

/* --------------------------- pop-out particles --------------------------- */

/** Small yarn-pink puffs placed on the pop frame over what changes (paws, the yarn across her chin, hind paw and tail), in tangle units. */
export const COVER_POMS: readonly (readonly [number, number, number])[] = [[-46, -14, .8], [48, -12, .8], [0, -40, .86], [-70, 44, .82]];
/** How long the pop's puffs last (s). */
export const POM_LIFE = .22;
/** Tiny hearts and sparkles: start at the ball's lower sides (below her chin), drift out and gently down (angle deg, 0 = right, + = down). */
export const DRIFT: readonly { angle: number; travel: number; kind: 'spark' | 'heart'; size: number }[] = [
  { angle: 16, travel: 64, kind: 'spark', size: 1 }, { angle: 164, travel: 60, kind: 'spark', size: .9 },
  { angle: 38, travel: 52, kind: 'heart', size: 1 }, { angle: 142, travel: 56, kind: 'heart', size: .9 },
  { angle: 60, travel: 40, kind: 'spark', size: .75 }, { angle: 120, travel: 44, kind: 'spark', size: .7 },
];
/** Unscaled half-size of a drifting particle (art units). */
const DRIFT_R = 12;

/** Which drifting bits may fly (their whole path is clear of the names and above the footer), per layout. */
const driftClear = new WeakMap<CatLayout, boolean[]>();

function popParticles(t: number, L: CatLayout, out: ScenePose) {
  const P = L.fin.pop; const { k } = L;
  const B = joinsOf(L).popBall;
  let clearOf = driftClear.get(L);
  // They pop in on the swap frame, then shrink away to nothing within 0.22 s, drifting out and down (solid while they
  // shrink, never a see-through circle left floating over her as she springs up).
  const pu = progress(t, P, P + POM_LIFE);
  COVER_POMS.forEach(([dx, dy, size], i) => {
    const s = size * B.s * (1 - smooth(progress(pu, .12, 1))) + .001;
    out[`pp${i}`] = { x: B.x / k + dx * B.s + (dx < 0 ? -1 : 1) * 16 * pu, y: B.y / k + dy * B.s + 20 * pu, r: (dx < 0 ? -1 : 1) * 40 * pu, sx: s, sy: s, o: t >= P && t < P + POM_LIFE ? 1 : 0 };
  });
  const R = TANGLE_R * B.s;
  const path = (angle: number, travel: number) => {
    const a = angle * Math.PI / 180;
    return (v: number) => ({ x: B.x / k + Math.cos(a) * (R * .96 + travel * v), y: B.y / k + Math.sin(a) * (R * .96 + travel * v) + 16 * v * v });
  };
  if (!clearOf) {
    // Particles that would pass over a name (or dip behind the footer) are left out.
    clearOf = DRIFT.map(({ angle, travel, size }) => {
      const at = path(angle, travel); const r = DRIFT_R * size * L.fs * k;
      return Array.from({ length: 11 }, (_, i) => i / 10).every((v) => { const p = at(v); return coveredNames(L.texts, p.x * k - r, p.y * k - r, 2 * r, 2 * r) === 0 && p.y * k + r < L.clip; });
    });
    driftClear.set(L, clearOf);
  }
  DRIFT.forEach(({ angle, travel, size }, i) => {
    const at = path(angle, travel);
    const clear = clearOf[i];
    const u = progress(t, P + .04, P + .74);
    const p = at(easeOutCubic(u));
    // Pop in, drift, then shrink away to nothing (never a fade).
    const s = size * L.fs * easeOutBack(progress(u, 0, .25), 2) * (1 - .3 * u) * (1 - smooth(progress(u, .55, 1)));
    out[`pd${i}`] = { x: p.x, y: p.y, sx: Math.max(.001, s), sy: Math.max(.001, s), r: (i % 2 ? -1 : 1) * 30 * u, o: clear && u > 0 && u < 1 ? 1 : 0 };
  });
}

/* --------------------------------- strands --------------------------------- */

/** Each strand is a soft curve drawn as a chain of short bars (compositor transforms only); 12 keep the curve smooth. */
export const STRAND_SEGMENTS = 12;
/** Unscaled length (px) of one strand bar. */
export const STRAND_BASE = 48;
const MAX_STRANDS = 8;
export const strandThickness = (k: number) => Math.max(6, 7.5 * k);

/**
 * Which cards get a strand: one per column (its lowest card whose yarn tail is above the footer: the shortest strand, never
 * across names above, never diving behind the footer), left to right.
 */
export function strandCards(cards: readonly CatCard[], clip = Infinity): CatCard[] {
  const columns = new Map<number, CatCard>();
  for (const card of cards) {
    if (looseEndTip(card).y > clip - 6) continue;
    const key = Math.round(card.x / 12);
    const current = columns.get(key);
    if (!current || card.top > current.top) columns.set(key, card);
  }
  return [...columns.values()].sort((a, b) => a.x - b.x).slice(0, MAX_STRANDS);
}

/**
 * One strand at time t: sampled points of a soft sagging curve from the side
 * of the tangle to the card. It grows out of the card's yarn tail (anchored at
 * the tail's pom-pom from its first frame, lengthening down to the ball), then
 * pulls the unravel edge (the pull point follows the ball along the row), then
 * reels back into the ball, solid all the way (never a fade).
 */
export function strandAt(t: number, L: CatLayout, card: CatCard): { points: Pt[]; o: number; time: number; reach: number } {
  const g0 = card.start - COVER.grab; const p1 = card.start + COVER.pull; const r1 = p1 + COVER.release;
  const visible = t >= g0 && t < r1 && t >= BEAT.tumble && t < L.fin.pop;
  const time = Math.min(Math.max(t, g0), r1 - 1e-4);
  const { k } = L;
  const S = tangleShape(time, L);
  const side = card.x >= tangleX(card.start, L) ? 1 : -1;
  const a0 = (side > 0 ? -18 : 198) * Math.PI / 180;
  const P0 = { x: S.x + Math.cos(a0) * S.R * .9, y: S.cy + Math.sin(a0) * S.R * .9 };
  const u = coverUnravel(time, card.start);
  const half = card.width / 2;
  const follow = side > 0 ? Math.min(card.x + half - 12, Math.max(card.x, S.x + S.R * 1.15)) : card.x;
  const bottom = L.floor - 6 * k;
  const tip = looseEndTip(card);
  // Pull point: the tail's pom-pom, then the unravel edge.
  const settle = smooth(progress(time, card.start, card.start + .12));
  let end: Pt = { x: mix(tip.x, follow, settle), y: Math.min(mix(tip.y, card.top + card.height * u, settle), bottom) };
  const reach = easeOutCubic(progress(time, g0, card.start));
  const slack = (1 - reach) * .5;
  const rel = progress(time, p1, r1);
  if (rel > 0) {
    // Let go: the loose end is wound back into the ball, getting shorter all the way (never flopping onto the cards).
    const reel = mix(rel, smooth(rel), .5);
    end = { x: mix(end.x, P0.x, reel), y: mix(end.y, P0.y, reel) };
  }
  const dx = end.x - P0.x; const dy = end.y - P0.y;
  const length = Math.max(1e-3, Math.hypot(dx, dy));
  // Sag perpendicular to the chord, on the side gravity (and the outward side) pulls it.
  let nx = -dy / length; let ny = dx / length;
  if (nx * side * .6 + ny < 0) { nx = -nx; ny = -ny; }
  const sag = length * (.13 + .22 * slack);
  const wobble = Math.min(5 * k, length * .02);
  const Q = { x: (P0.x + end.x) / 2 + nx * sag * 2, y: (P0.y + end.y) / 2 + ny * sag * 2 };
  // While it grows, only the part nearest the card is drawn: the tail lengthens down toward the ball.
  const v0 = 1 - reach;
  const points: Pt[] = [];
  for (let i = 0; i <= STRAND_SEGMENTS; i++) {
    const v = mix(v0, 1, i / STRAND_SEGMENTS);
    const w = wobble * Math.sin(Math.PI * v) * Math.sin(Math.PI * 2 * (v - time * 1.2));
    points.push({
      x: (1 - v) ** 2 * P0.x + 2 * (1 - v) * v * Q.x + v * v * end.x + nx * w,
      y: (1 - v) ** 2 * P0.y + 2 * (1 - v) * v * Q.y + v * v * end.y + ny * w,
    });
  }
  return { points, o: visible && reach > 0 ? 1 : 0, time, reach };
}

/* ---------------------------------- scene ---------------------------------- */

/**
 * Off stage, an actor holds one parked pose (see catScene), so it is computed
 * once per layout and copied: the bake samples the scene about 300 times, and
 * most of the time two of the three kittens are parked.
 */
const parkedPoses = new WeakMap<CatLayout, Map<string, { pose: ScenePose; result: unknown }>>();
function parked<R>(L: CatLayout, key: string, out: ScenePose, compute: (into: ScenePose) => R): R {
  let cache = parkedPoses.get(L);
  if (!cache) parkedPoses.set(L, cache = new Map());
  let hit = cache.get(key);
  if (!hit) { const pose: ScenePose = {}; hit = { pose, result: compute(pose) }; cache.set(key, hit); }
  // Shared, not copied: a scene pose is read-only once catScene returns (only a live actor adjusts its own parts while it is computed).
  Object.assign(out, hit.pose);
  return hit.result as R;
}

const strandCache = new WeakMap<CatLayout, CatCard[]>();
/** strandCards for a layout, computed once. */
export function strandsOf(L: CatLayout) {
  let found = strandCache.get(L);
  if (!found) strandCache.set(L, found = strandCards(L.cards, L.clip));
  return found;
}

/**
 * The scene in parts, so each batch the Stage mounts only samples what it bakes (the first frame needs just the side-view
 * kitten and her ball). catScene(t, L) without parts is everything.
 */
export const PART = { side: 1, ball: 2, tangle: 4, sit: 8, pop: 16, strands: 32 } as const;
export const ALL_PARTS = 63;

/**
 * Everything on stage at time t. At most one kitten is shown (exactly one
 * until she has bounded off); the others are parked (hidden, holding still),
 * as are strands outside their pull.
 */
export function catScene(t: number, L: CatLayout, parts = ALL_PARTS): ScenePose {
  const out: ScenePose = {};
  const { k } = L;
  const P = L.fin.pop;
  const F = L.fin;
  const gone = F.exit + BEAT.exit;
  if (parts & PART.side) {
    const side = t >= BEAT.tumble ? parked(L, 'side', out, (into) => sideKitten(BEAT.tumble, L, into)) : sideKitten(t, L, out);
    for (const [rim, source] of Object.entries(RIM_FOLLOWS)) if (rim.startsWith('s.')) out[rim] = out[source];
    // Her soft shadow (lighter while she is in the air).
    out.shadow = { x: side.x / k, y: L.floor / k, sx: Math.max(.001, 1 - Math.min(.6, side.lift / 200)), sy: 1, o: side.shown };
  }
  if (parts & PART.ball) {
    const ball = t >= BEAT.tumble ? parked(L, 'ball', out, (into) => yarnBall(BEAT.tumble, L, into)) : yarnBall(t, L, out);
    out.ballShadow = { x: ball.x / k, y: L.floor / k, sx: 1, sy: 1, o: ball.shown };
  }
  if (parts & PART.tangle) {
    const { S, shown } = t < BEAT.tumble ? parked(L, 'tangle<', out, (into) => tangle(0, L, into))
      : t >= P ? parked(L, 'tangle>', out, (into) => tangle(P, L, into)) : tangle(t, L, out);
    for (const [rim, source] of Object.entries(RIM_FOLLOWS)) if (rim.startsWith('g.')) out[rim] = out[source];
    // Landing: three small, pale puffs that are gone within 0.22 s (a soft flump, not a crash cloud).
    const dust = progress(t, BEAT.tumble, BEAT.tumble + .22);
    out.poof1 = { x: L.ballX / k, y: L.floor / k, sx: .7 + .5 * easeOutCubic(dust), sy: .7 + .4 * easeOutCubic(dust), o: dust > 0 && dust < 1 ? .7 * (1 - smooth(dust)) : 0 };
    // One soft shadow under the tangle, then under her as she sits and bounds off (lighter while she is in the air).
    if (shown) out.shadow2 = { x: S.x / k, y: L.floor / k, sx: Math.max(.001, S.units / TANGLE_R * (1 - S.bump / 60) * 1.05), sy: 1, o: 1 };
    else {
      const sit = t < P || t >= gone ? null : sittingKitten(t, L, {});
      out.shadow2 = sit
        ? { x: sit.x / k, y: L.floor / k, sx: Math.max(.001, .95 * sit.sc * Math.max(.25, 1 - Math.max(0, sit.lift) / 90)), sy: sit.sc, o: 1 }
        : { x: (t < P ? L.ballX : L.W * 2) / k, y: L.floor / k, sx: .001, sy: .001, o: 0 };
    }
  }
  if (parts & PART.sit) {
    const sit = t < P ? parked(L, 'sit', out, (into) => sittingKitten(0, L, into))
      : t >= gone ? parked(L, 'sit>', out, (into) => sittingKitten(gone, L, into)) : sittingKitten(t, L, out);
    // The little ball's shadow (it fades in as the ball comes to rest; smaller while it hops).
    const lb = sit.ball;
    const hop = Math.max(0, (L.floor - lb.y) / k - TANGLE_R * lb.s);
    out.lbShadow = { x: lb.x / k, y: L.floor / k, sx: Math.max(.001, lb.s * TANGLE_R / BALL_R * (1 - hop / 30)), sy: Math.max(.001, .8 * (1 - hop / 30)), o: sit.shown ? smooth(progress(t, P + .25, P + .45)) : 0 };
    // Twinkles around her once she is sitting (only the ones clear of names): they pop in, and pop away as she sets off.
    const tw = L.fs * easeOutBack(progress(t, F.land - .1, F.land + .2), 1.8) * (1 - smooth(progress(t, F.exit, F.exit + .22)));
    out.twinkle = { x: L.spotX / k, y: L.floor / k, sx: Math.max(.001, tw), sy: Math.max(.001, tw), o: tw > .001 ? 1 : 0 };
  }
  if (parts & PART.pop) {
    if (t < P) parked(L, 'pop', out, (into) => popParticles(0, L, into));
    else if (t >= P + 1) parked(L, 'pop>', out, (into) => popParticles(P + 1, L, into));
    else popParticles(t, L, out);
  }
  if (parts & PART.strands) {
    // Soft strands from the tangle to each column's unravelling cover (parked before they grow and once they are gone).
    const thick = strandThickness(k);
    strandsOf(L).forEach((card, j) => {
      const write = (into: ScenePose, time: number) => {
        const { points, o } = strandAt(time, L, card);
        for (let i = 0; i < STRAND_SEGMENTS; i++) {
          const a = points[i]; const b = points[i + 1];
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          const ux = len > 1e-6 ? (b.x - a.x) / len : 1; const uy = len > 1e-6 ? (b.y - a.y) / len : 0;
          const ext = len > .5 ? thick * .5 : 0;
          into[`str${j}.${i}`] = { x: a.x - ux * ext, y: a.y - uy * ext, r: Math.atan2(uy, ux) * 180 / Math.PI, sx: Math.max(.001, (len + 2 * ext) / STRAND_BASE), o };
        }
      };
      if (t < card.start - COVER.grab) parked(L, `str${j}<`, out, (into) => write(into, -1));
      else if (t >= Math.min(P, card.start + COVER.pull + COVER.release)) parked(L, `str${j}>`, out, (into) => write(into, END + 1));
      else write(out, t);
    });
  }
  return out;
}

/** Every instant where an expression, pupil jump or actor swaps: a hard cut in the baked animation. */
export function catCuts(L: CatLayout): number[] {
  const F = L.fin;
  const cuts = [BEAT.notice, BEAT.tilt[0], BEAT.crouch[0], BEAT.glance[0], BEAT.glance[1], BEAT.pounce[0], BEAT.tumble, BEAT.tumble + .3, F.pop - .36, F.pop, F.happy, F.look, F.blink0, F.exit, F.exit + EXIT.hops[0][0], F.exit + BEAT.exit];
  if (!L.short) cuts.push(F.blink1);
  return cuts.sort((a, b) => a - b);
}

/**
 * Sample times for baking: an even grid (twice as dense through the quick pop and the bound away) plus both sides of
 * every hard cut, so playback swaps instantly instead of cross-fading or sliding between states.
 */
export function catSampleTimes(fps: number, L: CatLayout) {
  const count = Math.round(END * fps);
  const times = new Set<number>();
  const add = (time: number) => times.add(Math.round(time * 1e6) / 1e6);
  for (let i = 0; i <= count; i++) add(i * END / count);
  for (const [from, to] of [[L.fin.pop, L.fin.pop + .45], [L.fin.exit, L.fin.exit + BEAT.exit]]) for (let time = from; time < to; time += .5 / fps) add(time);
  for (const cut of catCuts(L)) { add(cut - CUT_EPSILON); add(cut); }
  return [...times].filter((time) => time >= 0 && time <= END).sort((a, b) => a - b);
}

/** Which kitten is on stage, her expression, open-eye scale and head (px) at time t: for tests and the storyboard. */
export function catExpression(t: number, L: CatLayout, pose = catScene(t, L)) {
  const actor = (pose.s?.o ?? 0) > 0 ? 'side' as const : (pose.g?.o ?? 0) > 0 ? 'tangle' as const : 'sit' as const;
  const p = actor === 'side' ? 's.head' : actor === 'tangle' ? 'g.head' : 'c.head';
  const eyes = (['open', 'closed', 'happy'] as const).find((e) => (pose[`${p}.${e === 'open' ? 'eyes' : e}`]?.o ?? 0) > .5) ?? 'open';
  const mouth = MOUTHS.find((m) => (pose[`${p}.m_${m}`]?.o ?? 0) > .5) ?? 'w';
  const head = chainFrame(pose, actor === 'side' ? SIDE_CHAIN : actor === 'tangle' ? TANGLE_CHAIN : SIT_CHAIN);
  return { actor, face: { eyes, mouth } as Face, eyeScale: pose[`${p}.eyes`]?.sy ?? 1, head: { x: head.x * L.k, y: head.y * L.k, s: head.s } };
}

/** The highest point of the kitten on stage (px), including her ears, the "?", the ear-perk sparkles, the beanie and the hearts. */
export function catTop(pose: ScenePose, L: CatLayout) {
  const { k } = L;
  let top = Infinity;
  const head = (chain: Chain, above: number) => { const h = chainFrame(pose, chain); top = Math.min(top, (h.y - above * h.s) * k); return h; };
  if (pose.s?.o) {
    head(SIDE_CHAIN, (pose['s.head.perk']?.o ?? 0) > 0 ? 156 : 112);
    const q = pose['s.q'];
    if (q?.o) top = Math.min(top, ((pose.s.y ?? 0) + (PIVOT.sideQ[1] + (q.y ?? 0) - 46 * (q.sy ?? 1)) * (pose.s.sy ?? 1)) * k);
  }
  if (pose.g?.o) head(TANGLE_CHAIN, 112);
  if (pose.c?.o) {
    const h = head(SIT_CHAIN, 120);
    // The beanie's pom-pom is 87 a above the hat's pivot (50 a above her head's centre).
    const hat = pose['c.head.hat'];
    top = Math.min(top, (h.y + (-50 + (hat?.y ?? 0) - 87 * (hat?.sy ?? 1)) * h.s) * k);
  }
  for (const id of ['h1', 'h2']) if (pose[id]?.o) top = Math.min(top, ((pose[id].y ?? 0) - 26 * (pose[id].sy ?? 1)) * k);
  return top;
}

/** The horizontal extent (px) of the sitting kitten and her little ball: for tests that she has really left the screen. */
export function sitExtent(pose: ScenePose, L: CatLayout) {
  const { k } = L;
  const c = pose.c ?? {}; const s = Math.max(c.sx ?? 1, c.sy ?? 1);
  const head = chainFrame(pose, SIT_CHAIN);
  const lb = pose['c.lb'] ?? {};
  const ballX = (c.x ?? 0) + ((lb.x ?? 0) * Math.cos((c.r ?? 0) * Math.PI / 180) - (lb.y ?? 0) * Math.sin((c.r ?? 0) * Math.PI / 180)) * (c.sx ?? 1);
  const ballR = TANGLE_R * (lb.sx ?? 1) * (c.sx ?? 1);
  return {
    left: Math.min(((c.x ?? 0) - 100 * s) * k, (head.x - 108 * head.s) * k, (ballX - ballR) * k),
    right: Math.max(((c.x ?? 0) + 100 * s) * k, (head.x + 108 * head.s) * k, (ballX + ballR) * k),
  };
}
