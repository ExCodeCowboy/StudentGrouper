/**
 * Black-hole whoosh: choreography constants and pure math (no React, no CSS),
 * so tests can check the timing contracts without a DOM.
 *
 * blackHole.css uses these beats as literal millisecond delays, and each
 * keyframe line carries its absolute time in a comment; the tests in
 * tests/reveal-black-hole.test.ts keep the stylesheet and this table in step.
 */
import { seededRandom } from './sceneMotion';

export const BLACK_HOLE_DURATION_MS = 5300;

/** The portal's focal point as a fraction of the viewport (the same point as --reveal-target-x/y). */
export const BLACK_HOLE_FOCUS = { x: .5, y: .46 } as const;

/** Beat times in seconds from mount. Covers and stage mount in the same commit. */
export const BLACK_HOLE_BEATS = {
  /** A tiny violet-white spark twinkles where the portal will open. */
  spark: .08,
  /** The small, hungry portal irises open with a twist (a "?" right under it hops out of the way). */
  bloom: .30,
  /** Every "?" tile starts leaning toward the hole (the paper itself stays put). */
  lean: .45,
  /**
   * A "?" right under the portal, startled by the spark (squash at .14, leap at .20), has dropped out of the way
   * (a 190 ms fall) and lands, squashing, below it; one small bounce follows (settled by .61).
   */
  hopLand: .42,
  /** The "?" tiles start stretching toward the hole like taffy, lit gold by the portal. */
  stretch: .70,
  /** Full stretch; the tiles strain ("almost!") until the boing. */
  maxStretch: 1.30,
  /** BOING: the tiles snap back and the portal flinches. */
  boing: 1.44,
  /** The annoyed portal puffs up and spins faster; the tiles fall into the dusk. */
  powerUp: 1.56,
  /**
   * A "?" that hopped out from under the portal is slurped up into it, straight after the BOING squash:
   * it lifts off stretching toward the hole with a taffy trail (drawn over the glow and the pulse), reaches
   * the rim at 1.66 and slides under it by 1.70; the portal gulps (1.68 to 1.86, peak 1.72).
   */
  slurp: 1.50,
  /** Tear seams and paper creases glow in along the strip edges; full dusk; the stage hands the tiles back. */
  seams: 1.70,
  /** The whole sheet steps away, exposing the identical strips underneath. */
  swap: 1.78,
  /** The first strip (nearest the hole) peels off. */
  eat: 1.84,
  /** Every strip has been swallowed; the big last gulp. */
  lastBite: 3.40,
  /** Two surprised eyes pop open ("oh! I'm full!"). */
  eyes: 3.44,
  /** A small surprised "o" mouth. */
  surprised: 3.47,
  /** The pupils dart left and hold... */
  glanceLeft: 3.56,
  /** ...then dart right and hold. */
  glanceRight: 3.73,
  /** The eyes squeeze to > < while the cheeks puff and the lips press shut (holding in the burp). */
  squeeze: 3.85,
  /** BURP: mouth "O", burp ring, sparkles, crumbs; the lights come up. */
  burp: 4.20,
  /** Big happy ^ ^ eyes, an open grin and a blush, at full size as the burp ring clears. */
  happy: 4.34,
  /** The contented portal deflates. */
  deflate: 4.70,
  /** A gold twinkle marks where it was. */
  twinkle: 4.92,
  /** The portal has winked out. */
  gone: 5.00,
  /**
   * The twinkle and its mini sparkles have popped out: nothing is left on screen (no scene-wide fade, which
   * would make the whole stage one offscreen surface). Well before the end, so a slow first frame never cuts it.
   */
  clear: 5.16,
  end: BLACK_HOLE_DURATION_MS / 1000,
} as const;

/** Paper ribbons per cover. */
export const BLACK_HOLE_STRIPS = 6;
/** Paper ribbons per cover when many covers are revealed at once (the Today table). */
export const BLACK_HOLE_DENSE_STRIPS = 4;
/** More covers than this (the Today table) use BLACK_HOLE_DENSE_STRIPS. */
export const BLACK_HOLE_DENSE_COVERS = 12;
/** Paper ribbons per small cell of a very large Today table. */
export const BLACK_HOLE_CROWDED_STRIPS = 3;
/** More covers than this use BLACK_HOLE_CROWDED_STRIPS. */
export const BLACK_HOLE_CROWDED_COVERS = 24;
/** Seconds between the nearest and the farthest card peeling off. */
export const BLACK_HOLE_CARD_SPREAD = .30;
/** Seconds between neighbouring strips of one card. */
export const BLACK_HOLE_STRIP_STEP = .035;
/** Seconds each strip spirals before it is swallowed. */
export const BLACK_HOLE_FLIGHT = 1.08;
/**
 * The strips (hidden under the intact sheet until the rip) are added this long after mount, signalled
 * by a CSS animation ending (no timers), rather than in the first frame: by then every running
 * animation is composited, so the main-thread work of styling them cannot stall anything on screen.
 */
export const BLACK_HOLE_STRIP_MOUNT_MS = 500;
/** The last cover adds its strips by this time; covers are spread out (nearest first) so each frame does a little. */
export const BLACK_HOLE_STRIP_MOUNT_LAST_MS = 1200;
/** At most this long between two covers adding their strips. */
export const BLACK_HOLE_STRIP_MOUNT_STEP_MS = 40;

/**
 * When each cover adds its strips (ms from mount), from the covers' distance ranks (0 nearest .. 1 farthest).
 * The nearest cover adds them in the first frame (0): a handful of elements, and it pays the one-time cost
 * of the first strip layers while nothing is moving yet; the rest follow from BLACK_HOLE_STRIP_MOUNT_MS.
 */
export function blackHoleStripMountTimes(distances: readonly number[]) {
  const order = distances.map((distance, index) => ({ distance, index })).sort((a, b) => a.distance - b.distance || a.index - b.index);
  const step = Math.min(BLACK_HOLE_STRIP_MOUNT_STEP_MS, (BLACK_HOLE_STRIP_MOUNT_LAST_MS - BLACK_HOLE_STRIP_MOUNT_MS) / Math.max(1, distances.length - 2));
  const times: number[] = Array.from({ length: distances.length }, () => 0);
  order.forEach(({ index }, rank) => { times[index] = rank === 0 ? 0 : Math.round(BLACK_HOLE_STRIP_MOUNT_MS + (rank - 1) * step); });
  return times;
}

/** A strip's animation-delay when it is added `clock` ms into the reveal (negative once it should already be flying). */
export function blackHoleStripDelay(delayMs: number, clock: number) {
  return Math.round(delayMs - clock);
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Strips per cover for a reveal of `covers` covers. */
export function blackHoleStripCount(covers: number) {
  if (covers > BLACK_HOLE_CROWDED_COVERS) return BLACK_HOLE_CROWDED_STRIPS;
  return covers > BLACK_HOLE_DENSE_COVERS ? BLACK_HOLE_DENSE_STRIPS : BLACK_HOLE_STRIPS;
}

/** -1 for a card left of the hole, +1 right of it, easing through 0 for a card straddling it. */
export function blackHoleSide(centerX: number) {
  return clamp((centerX - BLACK_HOLE_FOCUS.x) * 12, -1, 1);
}

/** 0 for the strip nearest the hole, strips - 1 for the farthest ((strips - 1) / 2 for all strips of a centred card). */
export function blackHoleStripRank(slice: number, side: number, strips = BLACK_HOLE_STRIPS) {
  const middle = (strips - 1) / 2;
  return middle + (slice - middle) * side;
}

/**
 * When a strip peels off, in seconds. Mirrors the CSS:
 * --bh-card-delay = eat + distance * spread, --bh-strip-delay = card delay + rank * step.
 * `distance` is 0 for the nearest card and 1 for the farthest; `centerX` is the card
 * centre as a fraction of the viewport width.
 */
export function blackHoleStripStart(distance: number, centerX: number, slice: number, strips = BLACK_HOLE_STRIPS) {
  return BLACK_HOLE_BEATS.eat + clamp(distance, 0, 1) * BLACK_HOLE_CARD_SPREAD + blackHoleStripRank(slice, blackHoleSide(centerX), strips) * BLACK_HOLE_STRIP_STEP;
}

/** The last moment any strip is still visible. */
export const BLACK_HOLE_LAST_STRIP_END = BLACK_HOLE_BEATS.eat + BLACK_HOLE_CARD_SPREAD + (BLACK_HOLE_STRIPS - 1) * BLACK_HOLE_STRIP_STEP + BLACK_HOLE_FLIGHT;

/** The portal box size in px for a viewport (CSS: --bh-size = min(50vmin, 560px)). */
export function blackHoleSize(viewport: { width: number; height: number }) {
  return Math.min(.5 * Math.min(viewport.width, viewport.height), 560);
}

/** A card whose centre is this close to the focal point (as a fraction of the portal size) sits under the portal. */
export const BLACK_HOLE_CENTER_RADIUS = .2;

export type BlackHoleRect = { left: number; top: number; width: number; height: number };
export type BlackHoleCoverVars = {
  /** 0 for the card nearest the focal point, 1 for the farthest (0 when all are equally far). */
  distance: number;
  /** Direction from the card centre toward the focal point, in degrees (0 = the hole is to the right). */
  angle: number;
  /** Which side of the hole the card sits on (see blackHoleSide). */
  side: number;
  /**
   * The card sits right under the portal (the middle card of an odd row, or one big card), so its "?"
   * would be hidden behind the hole: its tug copy hops down out from under the portal instead
   * (see blackHoleTug), and its tile pulls straight up.
   */
  center: boolean;
  /** Paper ribbons for this cover (fewer when many covers are revealed at once). */
  strips: number;
};

/**
 * Per-cover pull variables, from on-screen cover rectangles. Pure, so it can be
 * tested; the Cover measures once at mount and renders the results as CSS vars.
 */
export function blackHoleCoverVars(rects: readonly BlackHoleRect[], viewport: { width: number; height: number }): BlackHoleCoverVars[] {
  const focusX = viewport.width * BLACK_HOLE_FOCUS.x;
  const focusY = viewport.height * BLACK_HOLE_FOCUS.y;
  const vectors = rects.map((rect) => ({ x: focusX - (rect.left + rect.width / 2), y: focusY - (rect.top + rect.height / 2) }));
  const distances = vectors.map((vector) => Math.hypot(vector.x, vector.y));
  const near = Math.min(...distances);
  const far = Math.max(...distances);
  const range = far - near;
  const centerRadius = blackHoleSize(viewport) * BLACK_HOLE_CENTER_RADIUS;
  const strips = blackHoleStripCount(rects.length);
  return rects.map((rect, index) => {
    const center = distances[index] < centerRadius;
    return {
      distance: range > 1 ? (distances[index] - near) / range : 0,
      angle: center ? -90 : Math.atan2(vectors[index].y, vectors[index].x) * 180 / Math.PI,
      side: blackHoleSide((rect.left + rect.width / 2) / Math.max(1, viewport.width)),
      center,
      strips,
    };
  });
}

/** Fraction of the portal size below the focal point where a "?" that sits under the portal lands after hopping out. */
export const BLACK_HOLE_HOP_REACH = .62;
/** A hopping "?" must land at least this far below the focal point (a fraction of the portal size) to clear the disk. */
export const BLACK_HOLE_HOP_MIN = .45;

/**
 * The dusk (.bh-dim): a radial gradient in a box between the app header and footer, deepest at the
 * portal. [offset, alpha] stops along the ellipse radius; blackHole.css uses the same numbers.
 */
export const BLACK_HOLE_DUSK = {
  top: 64, bottom: 66, rx: .78, ry: .46, cy: .455,
  stops: [[0, .46], [.38, .3], [.72, .1], [.96, 0]] as readonly (readonly [number, number])[],
} as const;

/** How much violet the full dusk lays over the point (x, y) in viewport px (0..1 alpha). */
export function blackHoleDuskAlpha(x: number, y: number, viewport: { width: number; height: number }) {
  const { top, bottom, rx, ry, cy, stops } = BLACK_HOLE_DUSK;
  const height = viewport.height - top - bottom;
  if (height <= 0 || y < top || y > viewport.height - bottom) return 0;
  const reach = Math.hypot((x - viewport.width / 2) / (viewport.width * rx), (y - top - height * cy) / (height * ry));
  for (let index = 1; index < stops.length; index++) {
    const [offset, alpha] = stops[index];
    if (reach <= offset) {
      const [before, from] = stops[index - 1];
      return from + (alpha - from) * (reach - before) / (offset - before);
    }
  }
  return 0;
}

export type BlackHoleTug = {
  /** Where the tile sits at rest (viewport px) and its size (the cover's --T). */
  x: number; y: number; size: number;
  /** Pull direction (deg, 0 = the hole is to the right). */
  angle: number;
  /** For a card under the portal: how far down (px) its "?" hops before the tug; 0 otherwise. */
  hop: number;
  /** From the tile at rest to the portal's centre (px): where a hopped "?" is slurped to. */
  inX: number; inY: number;
  /** Direction of the gold rim light across the tilted tile (a CSS linear-gradient angle, deg). */
  rimAngle: number;
  /** The dusk's alpha over the tile, so the copy can fade into it before handing back. */
  wash: number;
};

/**
 * Where the stage draws a card's stretching "?" tile, or null when it should not draw one: a card
 * right under the portal with no room below it to hop clear of the disk (its tile just stays put).
 * `question` is the cover's --reveal-question-size; `tilt` its --team-tilt in degrees.
 */
export function blackHoleTug(rect: BlackHoleRect, viewport: { width: number; height: number }, cover: Pick<BlackHoleCoverVars, 'angle' | 'center'>, question: number, tilt = 0): BlackHoleTug | null {
  const size = Math.min(question * 1.45, rect.height * .6);
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  let hop = 0;
  if (cover.center) {
    const portal = blackHoleSize(viewport);
    const focusY = viewport.height * BLACK_HOLE_FOCUS.y;
    const landing = Math.min(focusY + portal * BLACK_HOLE_HOP_REACH, rect.top + rect.height - size * .62);
    if (landing - focusY < portal * BLACK_HOLE_HOP_MIN) return null;
    hop = Math.max(0, landing - y);
  }
  const inX = viewport.width * BLACK_HOLE_FOCUS.x - x;
  const inY = viewport.height * BLACK_HOLE_FOCUS.y - y;
  return { x, y, size, angle: cover.angle, hop, inX, inY, rimAngle: cover.angle + 90 - tilt, wash: blackHoleDuskAlpha(x, y, viewport) };
}

/**
 * The slurp keys of bh-hop in blackHole.css, from the BOING squash on, as [ms, into, scaleY]: `into` is how far the
 * slurped "?" has gone along its path from the landing spot to the portal's centre, scaleY its vertical stretch.
 */
export const BLACK_HOLE_SLURP_KEYS: readonly (readonly [number, number, number])[] = [[1500, 0, 1], [1580, .1, 1.2], [1630, .3, 1.38], [1660, .46, 1.42]];
/** The trail's stuck end sits this far (a fraction of the tile) below the landing spot's centre: where the tile's bottom edge rested. */
export const BLACK_HOLE_TRAIL_ANCHOR = .45;
/** The trail art's length at scale 1, as a multiple of the tile size (CSS: width calc(var(--T) * 2)). */
export const BLACK_HOLE_TRAIL_LENGTH = 2;

/**
 * The slurped "?"'s taffy trail: its direction (deg, pointing from the tile back down its path) and, for each
 * slurp key after the first, the trail's scaleX that keeps its stuck end on the spot where the tile sat (the
 * trail rides inside the stretched hop, so its length is divided by the hop's scaleY). After the last key the
 * trail lets go and snaps up into the tile.
 */
export function blackHoleTrail(tug: Pick<BlackHoleTug, 'size' | 'hop' | 'inX' | 'inY'>) {
  const pathX = tug.inX;
  const pathY = tug.inY - tug.hop;
  const ratio = Math.hypot(pathX, pathY) / Math.max(1, tug.size);
  return {
    angle: Math.atan2(-pathY, -pathX) * 180 / Math.PI,
    scales: BLACK_HOLE_SLURP_KEYS.slice(1).map(([, into, scaleY]) => (into * ratio + BLACK_HOLE_TRAIL_ANCHOR) / (BLACK_HOLE_TRAIL_LENGTH * scaleY)),
  };
}

/** The opening spark's bright body reaches this far from its centre at its peak (a fraction of the portal size). */
export const BLACK_HOLE_SPARK_BODY = .11;
/** The spark never moves further than this above the focal point (a fraction of the portal size). */
export const BLACK_HOLE_SPARK_MAX_SHIFT = .2;

/**
 * How far (px, negative = up) the opening spark twinkles above the focal point when a "?" sits under the
 * portal, so its bright body peaks just above that tile instead of over the "?"'s face; 0 when the tile
 * is already clear. It sinks back to the focal point as it fades, into the opening portal.
 */
export function blackHoleSparkShift(tug: Pick<BlackHoleTug, 'y' | 'size'>, viewport: { width: number; height: number }) {
  const portal = blackHoleSize(viewport);
  const tileTop = tug.y - tug.size / 2;
  return clamp(tileTop - viewport.height * BLACK_HOLE_FOCUS.y - portal * BLACK_HOLE_SPARK_BODY, -portal * BLACK_HOLE_SPARK_MAX_SHIFT, 0);
}

export type BlackHoleStripLayout = {
  /** Strip box inside the cover, px (the width includes a 1 px overlap so no hairline shows between strips). */
  left: number; width: number;
  /** The portal, relative to the strip box: the pivot of the orbit (transform-origin). */
  originX: number; originY: number;
  /** Strip centre minus portal (--bh-vx/--bh-vy): the tumble pivots on the strip's own centre. */
  vx: number; vy: number;
  /** Signed offset of the strip from the cover's middle strip (--bh-k): outer strips twist more. */
  k: number;
  /** When this strip peels off (animation-delay), ms. */
  delayMs: number;
  /** Whether any of the "?" tile (with its star) or of each corner speck falls inside this strip; the rest is left out of its print. */
  tile: boolean;
  specks: readonly [boolean, boolean];
};

/**
 * The horizontal spans (px from the cover's left) of the print's pieces for a cover `width` wide with a
 * `tile` px "?" tile: the tile centred (its star overhangs the top-right corner), speck A at 13% from the
 * left, speck B at 13% from the right (each .22 x the tile), with a little slack for the team tilt.
 */
export function blackHolePrintSpans(width: number, tile: number) {
  const speck = tile * .22;
  return {
    tile: [width / 2 - tile * .62 - 3, width / 2 + tile * .8 + 3] as const,
    specks: [[width * .13 - 2, width * .13 + speck + 2], [width * .87 - speck - 2, width * .87 + 2]] as const,
  };
}

/**
 * Where one strip sits and pivots, and when it goes, for a cover measured at `rect`. Pure and
 * computed once per reveal, so the stylesheet needs no per-strip calc() chains (cheaper style).
 * With the cover's tile size, a strip leaves out the print pieces it cannot show (fewer elements to style).
 */
export function blackHoleStripLayout(rect: BlackHoleRect, viewport: { width: number; height: number }, cover: Pick<BlackHoleCoverVars, 'distance' | 'strips'>, slice: number, tile = Number.POSITIVE_INFINITY): BlackHoleStripLayout {
  const step = rect.width / cover.strips;
  const centerX = rect.left + rect.width / 2;
  const portalX = viewport.width * BLACK_HOLE_FOCUS.x - rect.left;
  const portalY = viewport.height * BLACK_HOLE_FOCUS.y - rect.top;
  const left = slice * step;
  const right = left + step + 1;
  const overlaps = ([from, to]: readonly [number, number]) => !Number.isFinite(tile) || (to > left && from < right);
  const spans = blackHolePrintSpans(rect.width, Number.isFinite(tile) ? tile : 0);
  return {
    left, width: step + 1,
    originX: portalX - left, originY: portalY,
    vx: left + step / 2 - portalX, vy: rect.height / 2 - portalY,
    k: slice - (cover.strips - 1) / 2,
    delayMs: Math.round(blackHoleStripStart(cover.distance, centerX / Math.max(1, viewport.width), slice, cover.strips) * 1000),
    tile: overlaps(spans.tile),
    specks: [overlaps(spans.specks[0]), overlaps(spans.specks[1])],
  };
}

// ---- Seeded particle tables (identical on every screen and build) --------------------------

export type BlackHoleStreak = { angle: number; radius: number; sweep: number; delayMs: number; durationMs: number; length: number; head: number; color: string };

const STREAK_COLORS = ['#ffd35c', '#ffffff', '#b89bff', '#ff9ed4', '#8fe3ff'];

/** Star streaks that spiral into the portal: a slow first wave, a dense feeding wave, a last flurry. */
export function buildBlackHoleStreaks(): BlackHoleStreak[] {
  const random = seededRandom(7);
  const list: BlackHoleStreak[] = [];
  const wave = (count: number, start: number, step: number, duration: [number, number], radius: [number, number], sweep: [number, number]) => {
    for (let index = 0; index < count; index++) list.push({
      angle: index * 360 / count + random() * 25,
      radius: radius[0] + random() * (radius[1] - radius[0]),
      sweep: sweep[0] + random() * (sweep[1] - sweep[0]),
      delayMs: start + index * step,
      durationMs: Math.round(duration[0] + random() * (duration[1] - duration[0])),
      length: Math.round(60 + random() * 60),
      head: Math.round(20 + random() * 10),
      color: STREAK_COLORS[list.length % STREAK_COLORS.length],
    });
  };
  wave(8, 500, 55, [1100, 1300], [58, 72], [150, 210]);
  wave(16, 1680, 58, [760, 820], [45, 65], [120, 170]);
  wave(6, 2560, 40, [620, 620], [40, 52], [110, 140]);
  return list;
}
export const BLACK_HOLE_STREAKS: readonly BlackHoleStreak[] = buildBlackHoleStreaks();

/**
 * Background stars as [x vmin, y vmin, big, gold], in a wide flat ellipse around the
 * portal, so they stay inside the dusk (which fades out toward the header and footer).
 */
export function buildBlackHoleStars(): (readonly [number, number, boolean, boolean])[] {
  const random = seededRandom(21);
  return Array.from({ length: 44 }, () => {
    const angle = random() * Math.PI * 2;
    const radius = 12 + random() * 50;
    return [Math.round(Math.cos(angle) * radius * 12.5) / 10, Math.round(Math.sin(angle) * radius * 5.6) / 10, random() < .25, random() < .3] as const;
  });
}
export const BLACK_HOLE_STARS: readonly (readonly [number, number, boolean, boolean])[] = buildBlackHoleStars();

export type BlackHoleScrap = { angle: number; sweep: number; delayMs: number; durationMs: number; spin: number; width: number; height: number; tile: boolean };

/**
 * Paper scraps drawn inside the disk (above the glow, under the core), so the
 * room sees bits of the torn covers whirl around the swirl and drop into the
 * black core while the real strips vanish under the glow. Sizes are fractions
 * of the hole size; they spiral from the disk rim to the core edge.
 */
export function buildBlackHoleScraps(): BlackHoleScrap[] {
  const random = seededRandom(57);
  return Array.from({ length: 16 }, (_, index) => {
    const tile = index % 3 === 1;
    const scrap = {
      angle: Math.round(index * 137.5 % 360),
      sweep: Math.round(200 + random() * 120),
      delayMs: Math.round(2100 + index * 52 + random() * 20),
      durationMs: Math.round(360 + random() * 80),
      spin: Math.round((random() < .5 ? -1 : 1) * (60 + random() * 120)),
      width: Math.round((3.2 + random() * 1.6) * 10) / 10,
      height: Math.round((7.5 + random() * 3.5) * 10) / 10,
    };
    // Every third scrap is a squarish gold bit of a "?" tile rather than plain paper.
    return { ...scrap, width: tile ? Math.round(scrap.height * 7.5) / 10 : scrap.width, tile };
  });
}
export const BLACK_HOLE_SCRAPS: readonly BlackHoleScrap[] = buildBlackHoleScraps();

export type BlackHoleSparkle = { angle: number; distance: number; spin: number; size: number; color: string; delayMs: number; durationMs: number };
const BURST_COLORS = ['#ffc21a', '#ff5fae', '#33c3f0', '#8a5cff', '#34d399', '#ff9f1c'];

/**
 * Sparkles burped out of the portal (distance in vmin). Delays are relative to the burst
 * start. They are born at the core rim and fly straight out, so they never cross the face.
 */
export function buildBlackHoleBurst(): BlackHoleSparkle[] {
  const random = seededRandom(33);
  return Array.from({ length: 22 }, (_, index) => ({
    angle: Math.round(index * 360 / 22 + random() * 10),
    distance: Math.round(20 + random() * 22),
    spin: Math.round((random() < .5 ? -1 : 1) * (90 + random() * 180)),
    size: Math.round(26 + random() * 20),
    color: BURST_COLORS[index % BURST_COLORS.length],
    delayMs: index % 3 * 25,
    durationMs: Math.round(480 + random() * 80),
  }));
}
export const BLACK_HOLE_BURST: readonly BlackHoleSparkle[] = buildBlackHoleBurst();
export const BLACK_HOLE_BURST_START_MS = 4210;
/** Sparkles are born this far from the portal centre (a fraction of the hole size): just past the core rim. */
export const BLACK_HOLE_BURST_BIRTH = .2;

/**
 * Paper crumbs spat out of the mouth with the burp: [dx vmin, dy vmin (down), spin deg].
 * They fan out sideways and downward from the mouth (never up across the eyes) and only
 * become visible once they are past the core rim.
 */
export const BLACK_HOLE_CRUMBS: readonly (readonly [number, number, number])[] = [[-27, 5, -380], [26, 8, 420], [-15, 19, 300], [16, 17, -460], [-5, 25, 520], [7, 24, -340]];
export const BLACK_HOLE_CRUMB_START_MS = 4220;
export const BLACK_HOLE_CRUMB_STEP_MS = 18;
export const BLACK_HOLE_CRUMB_DURATION_MS = 520;
/** Crumbs start at the mouth: this far below the portal centre (a fraction of the hole size). */
export const BLACK_HOLE_MOUTH_Y = .06;

/** The gold twinkle's little sparkles pop out diagonally when it peaks. */
export const BLACK_HOLE_TWINKLE_MS = 240;
export const BLACK_HOLE_MINI_START_MS = 4980;
export const BLACK_HOLE_MINI_DURATION_MS = 180;
