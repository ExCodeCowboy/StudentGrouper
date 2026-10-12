import { seededRandom } from './sceneMotion';

/**
 * Confetti party choreography (storyboard: work/design/confetti.md, revised
 * after the director's review).
 *
 * Pure numbers and strings only: no CSS or React imports, so tests can pin the
 * contracts. The stage and covers are CSS-animated. Every beat table below is
 * also written into confetti.css by the `*KeyframesCss()` generators here, and
 * the tests check the CSS still contains exactly that text.
 */

/**
 * 4.3 s: the last gold star drops out behind the footer by about 4.22 s, then the stage's safety fade
 * (STAGE_FADE) runs over an already empty screen, so the picker's "Pick again" lockout ends with the motion.
 */
export const CONFETTI_DURATION_MS = 4300;
/** The drumroll's final "DUM": poppers fire, lights snap on, the pop wave starts. */
export const CONFETTI_BURST_MS = 1850;
/** Every track (jets, streamers, stars, glints) has ended by now. */
export const CONFETTI_CLEAR_MS = 4280;
/**
 * The stage root's safety fade (share of the reveal): nothing is in view by its start (the tests check every
 * piece, ribbon and star), so it never shows a see-through ghost; it only guarantees a clean last frame.
 */
export const STAGE_FADE = [.985, .995] as const;
/** Pip's too-early "pop" gag (0.72-1.42 s, staged in the spotlight). One flag, plus its matching sound cue. */
export const PIP_FALSE_START = true;

/** Animation lengths that hold the beat tables below. */
export const POPPER_TIMELINE_MS = 2280;
/** Face swaps, glances, lids, blush and tuft all finish by 1.97 s (the happy face is on from 1.93 s, in the recoil squash). */
export const FACE_TIMELINE_MS = 2000;
export const SPOT_TIMELINE_MS = 2000;
export const TREMBLE_START_MS = 300;
export const TREMBLE_STEP_MS = 50;
export const TREMBLE_MS = CONFETTI_BURST_MS - TREMBLE_START_MS;
export const TREMBLE_ORDER_SPREAD_MS = 50;

/**
 * Story beats (seconds). The spotlight catches Pip, Pip goes off too early with a little "pop", then the spot swings straight
 * over to Pop (one eased move) and holds there while Pop blinks, side-eyes and shakes its head.
 */
export const BEATS = {
  spotOnPip: .72, crouch: .78, puff: .88, freezeEnd: 1.02, tuftLands: 1.10, spotLeavesPip: 1.18,
  spotOnPop: 1.34, sideEye: 1.38, popShake: [1.38, 1.62], spotLeavesPop: 1.58, squeeze: 1.60, happy: 1.93, sinkStart: 2.05, sinkEnd: 2.28,
} as const;

/** Covers pop like balloons in a wave from both screen edges toward the centre. */
export const COVER_POP_LEAD_MS = 30;
export const COVER_POP_SPREAD_MS = 360;
/**
 * The cover inflates a little more, then vanishes in one cut (a balloon skin, never a see-through frame): swelling
 * to POP_SKIN[0] of the pop, held fully opaque, then gone at POP_SKIN[1] (step-end).
 */
export const COVER_POP_MS = 120;
export const POP_SKIN = [.3, .38] as const;
export const COVER_RING_MS = 460;
/** The paper bits fly out solid and only drop out over the last BURST_FADE_FROM.. of the burst (still moving). */
export const COVER_BURST_MS = 420;
export const BURST_FADE_FROM = .78;
/** The last cover flourish (the burst sprite) ends this long after the pop. */
export const COVER_FX_MS = Math.max(COVER_RING_MS, COVER_BURST_MS);

export type Tone = readonly [front: string, shade: string];
/** Sunflower, coral, sky, violet, mint, tangerine: a front face and its folded shade. */
export const CONFETTI_PALETTE: readonly Tone[] = [
  ['#FFC83D', '#E59B12'], ['#FF6F7D', '#D94A5C'], ['#4FB3F2', '#2D86C9'],
  ['#9B7BEA', '#7152C4'], ['#3FC9A5', '#22997A'], ['#FF9448', '#D96B1F'],
];

export const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : .5));

/** TS mirror of the cover's CSS `--cf-pop` (|cx - .5| written as max() in CSS). */
export function coverPopMs(centerX: number) {
  const distance = Math.abs(clamp01(centerX) - .5);
  return CONFETTI_BURST_MS + COVER_POP_LEAD_MS + (.5 - distance) * COVER_POP_SPREAD_MS;
}

/* ------------------------------------------------------------------ */
/* Layout helpers (px), mirrored by CSS custom properties              */
/* ------------------------------------------------------------------ */

/** `--pp: min(30vmin, 24vw, 300px)`: popper height. */
export const popperHeightPx = (width: number, height: number) => Math.min(.3 * Math.min(width, height), .24 * width, 300);
export const POPPER_BOTTOM_PX = 34;
export const POPPER_ANGLE_DEG = 38;
/**
 * Pop turns up out of its 38-degree lean while it winds up and fires from 28 degrees, so its
 * fountain goes up and OUT (toward its own screen edge, the empty right side of the right-hand
 * card: team names and station labels are left-aligned).
 */
export const POP_AIM_DEG = 28;
/** The rim's centre sits .77 of the popper's height above the cone tip (the pivot, .3 pp in from the box side). */
const RIM_PP = .77;
/** Share of the popper's height from the box's outer side / from its bottom to the rim at a lean (degrees). */
export const mouthShares = (deg: number) => ({ side: round(.3 + RIM_PP * Math.sin(deg * Math.PI / 180), 4), up: round(RIM_PP * Math.cos(deg * Math.PI / 180), 4) });
/** Pop's firing mouth (CSS: right: calc(4vw + pp * .6615); bottom: calc(34px + pp * .68)). */
export const POP_MOUTH = { side: .6615, up: .68 } as const;
/**
 * Mouth (emitter) point: `left` is measured from the popper's OWN screen edge (the left edge for
 * Pip, side 1; the right edge for Pop, side -1), `bottom` from the viewport's bottom.
 */
export function popperMouthPx(width: number, height: number, side: 1 | -1 = 1) {
  const pp = popperHeightPx(width, height);
  return side > 0 ? { left: .04 * width + pp * .768, bottom: POPPER_BOTTOM_PX + pp * .6 } : { left: .04 * width + pp * POP_MOUTH.side, bottom: POPPER_BOTTOM_PX + pp * POP_MOUTH.up };
}
/** Screen x (px) of a popper's mouth. */
export const mouthX = (width: number, height: number, side: 1 | -1) => (side > 0 ? popperMouthPx(width, height, 1).left : width - popperMouthPx(width, height, -1).left);
/** Everything on the stage below this line is hidden behind the footer (clip wrapper). */
export const FOOTER_CLIP_PX = 60;

/**
 * Centre stage kept clear for the names: half its width (px) around the middle
 * of the scroll box (the 15 px scrollbar gutter moves the middle 7.5 px left).
 * 184 px is half of 40% of the 920 px picker card.
 */
export const CENTRE_HALF_PX = 184;
export const CENTRE_GUTTER_PX = 8;
/** Largest drawn radius of a jet piece plus its sway (vmin). */
export const JET_MARGIN_VMIN = 6;
/**
 * `--cf-reach`: how far (px) a jet may carry paper inward from its popper's mouth,
 * so both fountains frame the centre stage instead of meeting over it.
 * CSS: max(5vmin, min(30vw, 46vw - 192px - pp * .768 - 6vmin)).
 */
export function jetReachPx(width: number, height: number) {
  const vmin = Math.min(width, height) / 100;
  const pp = popperHeightPx(width, height);
  const room = width * .5 - CENTRE_GUTTER_PX - CENTRE_HALF_PX - (.04 * width + pp * .768) - JET_MARGIN_VMIN * vmin;
  return Math.max(5 * vmin, Math.min(.3 * width, room));
}
/** How far (px) Pip's paper may fly outward, toward the left screen edge: min(10vw, 1vw + pp * .768 - 3vmin). */
export function jetReachOutPx(width: number, height: number) {
  const vmin = Math.min(width, height) / 100;
  return Math.min(.1 * width, .01 * width + popperHeightPx(width, height) * .768 - 3 * vmin);
}
/** How far (px) Pop's paper flies outward, toward the right screen edge: min(16vw, mouth-to-edge - 4vmin). */
export function popReachOutPx(width: number, height: number) {
  const vmin = Math.min(width, height) / 100;
  return Math.min(.16 * width, popperMouthPx(width, height, -1).left - 4 * vmin);
}
/**
 * Horizontal offset (px, + = inward) of a jet piece's landing point from its mouth. Pip (side 1)
 * fans both ways; Pop (side -1) only ever fires outward.
 */
export const jetDxPx = (reach: number, width: number, height: number, side: 1 | -1 = 1) => (reach >= 0
  ? reach * jetReachPx(width, height)
  : reach * (side > 0 ? jetReachOutPx(width, height) : popReachOutPx(width, height)));
/** Streamers never unfurl closer than this to the top of the viewport (px). */
export const STREAMER_CEILING_PX = 90;

/*
 * The Today table fills the screen with left-aligned labels in every row, so there both fountains land in a lane
 * of blank paper instead of fanning out: Pip's between the end of the team names and the first round's content,
 * Pop's between the end of the text in the last visible round column and that column's right edge. The stage
 * measures the rows' text once at mount. Streamers stay home on Today: they would hang over the labels.
 */
/** Screen px over the table rows that are on screen: team-name text end, first round's content left, last visible round's text end and right edge. */
export type TableEdges = { teamTextRight: number; roundLeft: number; lastTextRight: number; lastRight: number };
/** A landing lane: [from, to] as screen-x offsets (px, + = rightward) from the popper's mouth. */
export type JetLane = readonly [from: number, to: number];
/** Each lane keeps this far (px) off the text on either side, and is never narrower than TABLE_LANE_MIN_PX. */
export const TABLE_LANE_PAD_PX = 14;
export const TABLE_LANE_MIN_PX = 28;
/** Pop's lane may run this far (px) past the table's right edge (the blank page margin). */
export const TABLE_LANE_OVERHANG_PX = 8;
/** In a lane the paper flutters less (share of its sway), so it stays in its lane. */
export const TABLE_SWAY_SCALE = .25;
/**
 * Both landing lanes for a Today table, clamped to how far each fountain may reach (Pop's always lands right of
 * its mouth). null when the edges are unusable (no table, or not laid out).
 */
export function tableLanes(edges: TableEdges | null, width: number, height: number): { left: JetLane; right: JetLane } | null {
  if (!edges || !Object.values(edges).every((value) => Number.isFinite(value) && value > 0)) return null;
  if (!(edges.roundLeft > edges.teamTextRight - 40) || !(edges.lastRight > edges.roundLeft) || !(edges.lastRight > edges.lastTextRight - 40)) return null;
  const lane = (from: number, to: number, side: 1 | -1, min: number, max: number): JetLane => {
    let [low, high] = [from + TABLE_LANE_PAD_PX, to - TABLE_LANE_PAD_PX];
    if (high - low < TABLE_LANE_MIN_PX) [low, high] = [(from + to - TABLE_LANE_MIN_PX) / 2, (from + to + TABLE_LANE_MIN_PX) / 2];
    const mouth = mouthX(width, height, side);
    const fit = (x: number) => round(Math.max(min, Math.min(max, x - mouth)), 1);
    return [fit(low), fit(high)];
  };
  const out = popReachOutPx(width, height);
  return {
    left: lane(edges.teamTextRight, edges.roundLeft, 1, -jetReachOutPx(width, height), jetReachPx(width, height)),
    right: lane(edges.lastTextRight, Math.min(width, edges.lastRight + TABLE_LANE_OVERHANG_PX + TABLE_LANE_PAD_PX), -1, .25 * out, out),
  };
}

/* ------------------------------------------------------------------ */
/* Flight paths: one drag + gravity arc shared by every piece via CSS. */
/* ------------------------------------------------------------------ */

/** Stops (fraction of the flight) and the horizontal progress X at each stop. */
export const FLIGHT_STOPS = [0, .04, .08, .13, .18, .24, .32, .42, .54, .68, .84, 1] as const;
export const FLIGHT_X = [0, .101, .195, .304, .403, .51, .634, .757, .867, .948, .991, 1] as const;
/** In a Today lane the paper reaches its column by the top of its arc, then falls straight down it. */
export const FLIGHT_X_LANE = [0, .2, .38, .56, .72, .85, .93, .98, 1, 1, 1, 1] as const;
/** Rise progress U up to the apex (stop .24), then fall progress G after it. */
export const FLIGHT_RISE = [0, .306, .556, .79, .938, 1] as const;
export const FLIGHT_FALL = [0, .048, .143, .285, .478, .726, 1] as const;
/** Sway sign on each falling stop (paper flutter drift). */
export const FLIGHT_SWAY = [0, 1, -1, 1, -1, 1, 0] as const;

/** Position of a jet piece (dx in any unit, rise/drop in vh; up is negative) at a stop index. */
export function flightStop(piece: { dx: number; rise: number; drop: number }, stop: number) {
  const x = piece.dx * FLIGHT_X[stop];
  const y = stop <= 5 ? 0 - piece.rise * FLIGHT_RISE[stop] : piece.drop * FLIGHT_FALL[stop - 5] - piece.rise;
  return { x, y };
}

export type JetPiece = {
  kind: 'rect' | 'dot' | 'star';
  /** Share of `--cf-reach` (inward, > 0) or of `--cf-reach-out` (outward, < 0), for either side. */
  reach: number; rise: number; drop: number; delay: number; duration: number;
  tone: Tone; flipMs: number; turns: number; ax: number; ay: number; rz: number; scale: number; sway: number;
};

/** Pip's shares: a fan leaning inward, over the empty right half of the left-hand card. */
export const JET_REACH_RANGE = [-.75, 1] as const;
/** Pop's shares (all outward): up and out over the empty right side of the right-hand card, never back over its names. */
export const POP_JET_REACH_RANGE = [-1, -.25] as const;
export const JET_RISE_RANGE = [24, 60] as const;
export const JET_DROP_BELOW_MOUTH_VH = 34;
export const JET_COUNT = 36;
export const JET_FLIGHT_MS = [1950, 2500] as const;

/**
 * One popper's confetti fountain. side 1 = Pip (left, leaning right), -1 = Pop.
 * Both fountains drift right, away from the left-aligned names: Pip's fans inward
 * over the empty right half of the left card, Pop's goes up and out over the
 * empty right side of the right card. Both keep clear of the centre stage.
 */
export function confettiJet(side: 1 | -1, seed: number, count = JET_COUNT): JetPiece[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const kind = index % 9 === 4 ? 'star' : index % 5 === 2 ? 'dot' : 'rect';
    const lift = random();
    const rise = round(JET_RISE_RANGE[0] + lift * (JET_RISE_RANGE[1] - JET_RISE_RANGE[0]));
    // Higher pieces fan out wider, like the top of a fountain.
    const share = random();
    const spread = JET_REACH_RANGE[0] + share * (JET_REACH_RANGE[1] - JET_REACH_RANGE[0]);
    const [popNear, popFar] = [POP_JET_REACH_RANGE[1], POP_JET_REACH_RANGE[0]];
    const reach = side > 0
      ? round(Math.max(JET_REACH_RANGE[0], Math.min(1, spread * (.7 + .3 * lift))))
      : round(popNear + (popFar - popNear) * share * (.7 + .3 * lift));
    const delay = Math.round(random() * 90);
    const duration = Math.round(Math.min(CONFETTI_CLEAR_MS - CONFETTI_BURST_MS - delay, JET_FLIGHT_MS[0] + random() * (JET_FLIGHT_MS[1] - JET_FLIGHT_MS[0])));
    const axis = random() * Math.PI * 2;
    const flipMs = Math.round(420 + random() * 520);
    return {
      kind, delay, duration, rise, flipMs, reach,
      /** Whole flips over the flight: the flip rides the flight's keyframe track. */
      turns: round(duration / flipMs),
      drop: round(rise + JET_DROP_BELOW_MOUTH_VH),
      tone: CONFETTI_PALETTE[index % CONFETTI_PALETTE.length],
      ax: round(Math.cos(axis)), ay: round(Math.sin(axis)),
      rz: Math.round(random() * 360),
      scale: round(kind === 'rect' && index % 6 === 0 ? 1.5 : .95 + random() * .35),
      // Pop's inner pieces flutter less, so the drift never carries them back left over the names.
      sway: round((1.2 + random() * 1.8) * (random() < .5 ? -1 : 1) * (side > 0 ? 1 : Math.min(1, Math.abs(reach) * 1.6))),
    };
  });
}

/** Screen-x landing offset (px) of a jet piece inside a Today lane: the same share of the lane as of its fountain's range. */
export function laneDxPx(piece: JetPiece, side: 1 | -1, lane: JetLane) {
  const [low, high] = side > 0 ? [JET_REACH_RANGE[0], JET_REACH_RANGE[1]] : [POP_JET_REACH_RANGE[1], POP_JET_REACH_RANGE[0]];
  const share = Math.max(0, Math.min(1, (piece.reach - low) / (high - low)));
  return lane[0] + share * (lane[1] - lane[0]);
}

/**
 * Streamer flight: a fast climb (to the apex at .256, about 0.47 s), a slow drape as the coil swings to hang, then
 * a gathering fall that carries the whole ribbon down behind the footer. It stays solid: no see-through fade.
 */
export const STREAMER_STOPS = [0, .064, .128, .192, .256, .4, .56, .76, 1] as const;
export const STREAMER_X = [0, .3, .62, .85, .96, 1, 1, 1, 1] as const;
export const STREAMER_Y = [0, -.55, -.86, -.97, -1] as const;
/** Share of the drop (apex to behind the footer) at the apex and each later stop: it hangs, then falls faster and faster. */
export const STREAMER_FALL = [0, .06, .2, .5, 1] as const;
/** Sway sign on the drape stops, and the sway itself (vmin; Pip's is mirrored: -1.5vmin). */
export const STREAMER_SWAY = [0, 1, -1, 1, -.5] as const;
export const STREAMER_SWAY_VMIN = 1.5;
/** At the end of its fall a ribbon's anchor (its top end once it hangs) is this far below the footer clip line. */
export const STREAMER_EXIT_VMIN = 5;
/** Opacity holds until this share of the flight (by then the ribbon is behind the footer), then drops to 0. */
export const STREAMER_FADE_FROM = .985;
/** Unfurl track (linear between stops): [stop, share of the spin, scaleX, scaleY]. */
export const UNFURL_STOPS = [[0, 0, .12, .5], [.048, .03, .62, .82], [.096, .1, 1, 1], [.16, .26, 1, 1], [.256, .5, 1, 1], [.36, .74, 1, 1], [.48, .9, 1, 1], [.64, .97, 1, 1], [1, 1, 1, 1]] as const;
/** How far (share of its length) a coil may still reach above its anchor at the apex: the rise cap keeps that below the ceiling. */
export const STREAMER_CAP_LEN = .35;

export type Streamer = {
  /**
   * Where the ribbon's anchor ends up (vw): 'mouth' = offset from the popper's mouth (negative = outward),
   * 'edge' = distance from the popper's own screen edge.
   */
  anchor: 'mouth' | 'edge'; x: number; rise: number; delay: number; duration: number; tone: Tone; a0: number; spin: number; length: number;
};
/** Pip's ribbons rise straight above it (the empty right side of the left card; team names are left-aligned). */
export const STREAMER_MOUTH_RANGE = [-5, -1] as const;
/** Pop's ribbons fly out to the upper right corner (again the empty right side of a card). */
export const STREAMER_EDGE_RANGE = [2.5, 10.5] as const;
export const STREAMER_LENGTH_RANGE = [18, 24] as const;

/**
 * Curly ribbons: 3 per side. They shoot steeply up (Pip) or up and out (Pop),
 * unfurl high near the top corners, then swing clockwise (rightward, the way
 * the team names are NOT: they are left-aligned) to hang and drape, then fall
 * away behind the footer about 1.8-2.0 s after the pop.
 */
export const STREAMER_FLIGHT_MS = [1725, 1925] as const;
export function confettiStreamers(side: 1 | -1, seed: number, count = 3): Streamer[] {
  const random = seededRandom(seed);
  const [low, high] = side > 0 ? STREAMER_MOUTH_RANGE : STREAMER_EDGE_RANGE;
  return Array.from({ length: count }, (_, index) => {
    const x = round(low + .8 + index / Math.max(1, count - 1) * (high - low - 1.6) + (random() - .5) * 1.6);
    const rise = round(52 + random() * 12);
    const delay = Math.round(index * 30 + random() * 25);
    const duration = Math.round(STREAMER_FLIGHT_MS[0] + random() * (STREAMER_FLIGHT_MS[1] - STREAMER_FLIGHT_MS[0]));
    const length = round(STREAMER_LENGTH_RANGE[0] + random() * (STREAMER_LENGTH_RANGE[1] - STREAMER_LENGTH_RANGE[0]));
    // Both leave pointing up-right and swing clockwise to hang down.
    const a0 = -(55 + random() * 20);
    const hang = 95 + (random() - .5) * 30;
    const spin = hang - a0;
    return { anchor: side > 0 ? 'mouth' : 'edge', x, rise, delay, duration, tone: CONFETTI_PALETTE[(index * 2 + (side > 0 ? 1 : 0)) % CONFETTI_PALETTE.length], a0: round(a0), spin: round(spin), length };
  });
}

export type ShowerStar = { x: number; size: number; delay: number; duration: number; spin: number; sway: number; swayMs: number; tier: 0 | 1 | 2 };
/** The first stars drop out from under the header as the poppers finish ducking away. */
export const SHOWER_START_MS = CONFETTI_BURST_MS + 450;
export const SHOWER_SPREAD_MS = 600;
export const SHOWER_TIER_SIZE = [2.8, 4.2, 6.2] as const;
/** Fall times for the STAR_FALL_VH drop (about 62, 71 and 83 vh/s: nearer stars fall faster). */
export const SHOWER_TIER_MS = [1680, 1470, 1260] as const;
export const SHOWER_JITTER_MS = 125;

/** Gold star shower on the trumpet's held note: three parallax tiers (far, mid, near). */
export function starShower(seed = 29, count = 24): ShowerStar[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const tier = (index < count / 3 ? 0 : index < count * 2 / 3 ? 1 : 2) as 0 | 1 | 2;
    const delay = Math.round(SHOWER_START_MS + index / Math.max(1, count - 1) * SHOWER_SPREAD_MS + random() * 40);
    const duration = Math.round(Math.min(CONFETTI_CLEAR_MS - delay, SHOWER_TIER_MS[tier] + random() * SHOWER_JITTER_MS));
    return {
      tier, delay, duration,
      x: round(4 + ((index * .618034 + .12) % 1) * 92), size: round(SHOWER_TIER_SIZE[tier] + random() * .8),
      spin: Math.round((120 + random() * 120) * (index % 2 ? 1 : -1)),
      sway: round((1 + random() * 2) * (random() < .5 ? -1 : 1)),
      swayMs: Math.round(700 + random() * 400),
    };
  });
}

/**
 * Pip's early little "pop": a fan of bits (30-70 degrees up-right) that pop out, top out after 12% of
 * the move, then tumble and fall past the mouth to 20-26vmin below it (behind the footer line).
 */
export const PUFF_AT_MS = 880;
export const PUFF_MS = 620;
/** The top of the arc, as a share of the move. */
export const PUFF_APEX = .12;
/** Opacity holds until this share (below the footer line by then), then fades out. */
export const PUFF_FADE_FROM = .96;
const PUFF_DISTANCE = [9, 17, 12, 20, 10.5, 15, 19, 13] as const;
export function falseStartPuff(count = 8) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (30 + index / Math.max(1, count - 1) * 40) * Math.PI / 180;
    const distance = PUFF_DISTANCE[index % PUFF_DISTANCE.length];
    const axis = (index * 2.4 + .7) % (Math.PI * 2);
    return {
      /** vmin: out along the fan to the apex, then down to `drop` below the mouth. */
      dx: round(Math.cos(angle) * distance), rise: round(Math.sin(angle) * distance), drop: round(20 + (index % 4) * 2),
      delay: Math.round(((index * 3) % 8) * 9), spin: (index % 2 ? 1 : -1) * (200 + index * 25), scale: round(.75 + ((index * 7) % 5) * .12),
      /** A paper flip like the jets': axis and whole turns over the move. */
      ax: round(Math.cos(axis)), ay: round(Math.sin(axis)), turns: round(1.5 + (index % 3) * .5, 1),
      tone: CONFETTI_PALETTE[(index + 1) % CONFETTI_PALETTE.length],
    };
  });
}
/** The little "pop" starburst (a mini POP! badge) next to Pip's mouth. */
export const PIP_BADGE_MS = 400;

/** Twinkle glints scattered while the stars fall: glint k flashes at GLINT_START_MS + k * GLINT_STEP_MS (peak 45% in). */
export const GLINT_START_MS = CONFETTI_BURST_MS + 470;
export const GLINT_STEP_MS = 195;
export function showerGlints(count = 8) {
  return Array.from({ length: count }, (_, index) => {
    const random = seededRandom(41 + index);
    return { x: round(8 + random() * 84), y: round(14 + random() * 56), delay: GLINT_START_MS + index * GLINT_STEP_MS, size: round(4 + random() * 2) };
  });
}
export const GLINT_MS = 480;

/**
 * POP! badges: in with an overshoot, a short hold, then they shrink away to nothing while drifting out (solid all the
 * way, no see-through fade), all over by 2.17 s. Both sit right of their popper's mid-line (BADGE_SHIFT_VMIN): team
 * names and labels are left-aligned, so the badges lean over the empty right side of the corner cards.
 */
export const BADGE_DELAY_MS = 20;
export const BADGE_MS = 300;
export const BADGE_SHIFT_VMIN = 7;
export const MUZZLE_MS = 340;
export const HIT_MS = 90;
export const FLASH_MS = 320;

/* ------------------------------------------------------------------ */
/* Geometry                                                           */
/* ------------------------------------------------------------------ */

export const CURL_BOX = { width: 181, height: 40 } as const;

/**
 * A curly paper streamer drawn as a coil spring seen from the side: a helix
 * projected obliquely and fitted into a `box` (181 x 40 by default). The near
 * half of every turn is the `front` strand (drawn on top in the face tone); the
 * far half is the `back` strand (drawn first, thinner, in the shade tone).
 */
export function curlStrands(turns = 2.6, sway = 2.3, steps = 24, pad = 5, box: { width: number; height: number } = CURL_BOX) {
  const total = turns * Math.PI * 2;
  const count = Math.round(turns * steps);
  const raw = Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count * total;
    return { x: t + sway * Math.sin(t), y: Math.cos(t), near: Math.sin(t) >= 0 };
  });
  const minX = Math.min(...raw.map((p) => p.x));
  const maxX = Math.max(...raw.map((p) => p.x));
  const sx = (box.width - pad * 2) / (maxX - minX);
  const sy = (box.height - pad * 2) / 2;
  const strands = { back: [] as string[], front: [] as string[] };
  let run: string[] = [];
  let runNear: boolean | null = null;
  const flush = () => { if (run.length > 1 && runNear !== null) strands[runNear ? 'front' : 'back'].push(`M${run.join('L')}`); };
  for (const point of raw) {
    const text = `${round(pad + (point.x - minX) * sx, 1)} ${round(box.height / 2 + point.y * sy, 1)}`;
    if (runNear === null || point.near === runNear) { run.push(text); runNear = point.near; continue; }
    run.push(text);
    flush();
    run = [text];
    runNear = point.near;
  }
  flush();
  return { back: strands.back.join(''), front: strands.front.join('') };
}

/** Pip's tuft: a mini coil (same two-strand look as the streamers) in a 36 x 18 box. */
export const TUFT_BOX = { width: 36, height: 18 } as const;
export const tuftStrands = () => curlStrands(1.6, 2.1, 20, 3, TUFT_BOX);

/** Faceted five-point star: ten triangles (alternating light/dark) and an outline. */
export function starGeometry(cx: number, cy: number, outer: number, inner: number) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 ? inner : outer;
    return [round(cx + Math.cos(angle) * radius, 1), round(cy + Math.sin(angle) * radius, 1)] as const;
  });
  const outline = `M${points.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
  const facets = points.map(([x, y], i) => {
    const [nx, ny] = points[(i + 1) % 10];
    return { d: `M${cx} ${cy}L${x} ${y}L${nx} ${ny}Z`, light: i % 2 === 0 };
  });
  return { outline, facets };
}

/** A comic zigzag burst (`spikes` points) in a 160 x 100 box: the POP! and little "pop" badges. */
export function popBurstPoints(spikes = 14, inner = 31, outer = 48) {
  return Array.from({ length: spikes * 2 }, (_, i) => {
    const angle = i * Math.PI / spikes;
    const radius = i % 2 ? inner : outer;
    return `${round(80 + Math.cos(angle) * radius * 1.55, 1)} ${round(50 + Math.sin(angle) * radius, 1)}`;
  }).join(' ');
}

/**
 * Paper bits for each cover's single burst sprite: positions in % of the sprite
 * (a square of --burst-size), sizes in vmin so they match the stage paper on any
 * card (CSS caps them at 3.4% of the sprite per vmin, for small Today cells).
 * The layout is deliberately irregular (angles, radii, sizes), so the per-card
 * rotation in CSS makes every card's burst look different. Each bit is two-tone
 * (a folded shade corner), like the jet paper.
 */
export const COVER_BITS = 13;
/** Bit sizes (vmin): the largest is no bigger than the largest stage paper. */
export const COVER_BIT_WIDTH = [1.4, 2.1] as const;
export const COVER_BIT_ASPECT = [1.3, 1.5] as const;
/** CSS cap: one vmin of bit size is at most this share (%) of the sprite. */
export const COVER_BIT_CAP_PCT = 3.4;
/** `--burst-size`: min(card's short side * .96, 50vmin). */
export const BURST_MAX_VMIN = 50;
export function coverBurstBits(count = COVER_BITS) {
  const random = seededRandom(83);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count * 360 + (random() - .5) * 22) * Math.PI / 180;
    const radius = 8 + Math.sqrt(random()) * 33;
    const width = round(COVER_BIT_WIDTH[0] + random() * (COVER_BIT_WIDTH[1] - COVER_BIT_WIDTH[0]));
    const height = round(width * (COVER_BIT_ASPECT[0] + random() * (COVER_BIT_ASPECT[1] - COVER_BIT_ASPECT[0])));
    const tone = i % 5 === 3 ? ['#FFF2C9', '#E8D49A'] as const : CONFETTI_PALETTE[(i * 2 + 1) % CONFETTI_PALETTE.length];
    return { x: round(50 + Math.cos(angle) * radius, 1), y: round(50 + Math.sin(angle) * radius, 1), width, height, rotate: Math.round(random() * 180), tone };
  });
}
/** Two sparkles ride the same sprite (the old separate glint node is folded in): % position, vmin size. */
export const COVER_SPARKLES = [{ x: 78, y: 22, size: 4.2 }, { x: 24, y: 70, size: 3 }] as const;

/**
 * The picker is one wide card with the picked name in its middle, so there the
 * sprite is the whole card and the same bits sit around the name instead: in the
 * outer side strips and the two top corners (positions in % of the card). The
 * sprite grows from PICKER_BURST.from to .to (plus a small drop) around the
 * card's centre, so even the first frame keeps every bit off the name and off the
 * "A moment to shine" caption above it.
 */
export const PICKER_BURST = { from: .66, to: 1.04, dropPct: 4 } as const;
/** The picker's name area: the centre 40% of the card's width, from 30% to 92% of its height. */
export const PICKER_NAME_BOX = { left: 30, right: 70, top: 30, bottom: 92 } as const;
/**
 * The caption and the star badge above the name: the centre third of the card from 5% down to the name area
 * (measured: the caption sits at 41-59% of the card's width, 9-14% of its height at 1280 x 800).
 */
export const PICKER_CAPTION_BOX = { left: 34, right: 66, top: 5, bottom: 30 } as const;
/** Top-corner bits sit at most this far in from the card's side (%): even the burst's smallest first frame keeps them clear of the caption. */
export const PICKER_TOP_CORNER_MAX = 21.5;
export function pickerBurstBits(count = COVER_BITS) {
  const random = seededRandom(131);
  const top = Math.max(1, count - 10);
  const side = Math.floor((count - top) / 2);
  return Array.from({ length: count }, (_, i) => {
    if (i < side * 2) {
      const row = i % side;
      const left = i < side;
      const x = 4.5 + ((row * .618 + (left ? .1 : .45)) % 1) * 10 + (random() - .5) * 1.5;
      return { x: round(left ? x : 100 - x, 1), y: round(16 + row / Math.max(1, side - 1) * 66 + (random() - .5) * 8, 1) };
    }
    // The rest go to the two top corners, alternating left and right, outside the caption's span.
    const k = i - side * 2;
    const j = Math.floor(k / 2);
    const x = Math.min(PICKER_TOP_CORNER_MAX, 16.5 + (j % 2) * 4.2 + (random() - .5) * .8);
    return { x: round(k % 2 ? 100 - x : x, 1), y: round(4 + ((j * .618 + (k % 2 ? .55 : .15)) % 1) * 6, 1) };
  });
}
export const PICKER_SPARKLES = [{ x: 9, y: 24 }, { x: 91, y: 72 }] as const;

/* ------------------------------------------------------------------ */
/* Beat tables mirrored by confetti.css                               */
/* ------------------------------------------------------------------ */

/** Percent of an animation at a beat time (seconds), as written in the CSS. */
export const keyPercent = (seconds: number, animationMs: number) => round(seconds * 1000 / animationMs * 100);

type Stop = { percent: number; body: string };
/** One @keyframes block. Stops keep their order; the last one is repeated at 100% when needed. */
export function keyframesCss(name: string, stops: Stop[]) {
  const list = [...stops];
  const last = list.at(-1);
  if (last && last.percent < 100) list.push({ percent: 100, body: last.body.replace(/ animation-timing-function: [^;]+;/, '') });
  return `@keyframes ${name} {\n${list.map((stop) => `  ${stop.percent}% { ${stop.body} }`).join('\n')}\n}`;
}
const ease = (value?: string) => value ? ` animation-timing-function: ${value};` : '';

/** The veil is one big layer; its spotlight centre sits at viewport (50%, 46%) before translation. */
export const SPOT_HOME = { x: 50, y: 46 } as const;
export const VEIL = { left: -38, top: -36, width: 176, height: 150 } as const;
export const VEIL_ORIGIN = { x: round((SPOT_HOME.x - VEIL.left) / VEIL.width * 100, 3), y: round((SPOT_HOME.y - VEIL.top) / VEIL.height * 100, 3) } as const;

export type SpotKey = { t: number; x: number; y: number; scale: number; opacity: number; ease?: string };
/**
 * Spotlight: search, catch Pip, then one eased swing straight over to Pop (the fake-out), a
 * 0.24 s hold while Pop acts it out, a whip back to the centre, focus, bloom.
 */
export const SPOT_KEYS: readonly SpotKey[] = [
  { t: 0, x: 14, y: 40, scale: 1, opacity: 0 },
  { t: .05, x: 14, y: 40, scale: 1, opacity: 0, ease: 'ease-out' },
  { t: .32, x: 24, y: 44, scale: 1, opacity: 1, ease: 'ease-in-out' },
  { t: .58, x: 44, y: 50, scale: 1, opacity: 1, ease: 'cubic-bezier(.5, 0, .2, 1)' },
  { t: .72, x: 18, y: 76, scale: 1, opacity: 1, ease: 'ease-in-out' },
  { t: .8, x: 19, y: 75, scale: 1, opacity: 1, ease: 'linear' },
  { t: 1.18, x: 19, y: 75, scale: 1, opacity: 1, ease: 'cubic-bezier(.55, 0, .25, 1)' },
  { t: 1.34, x: 81, y: 72, scale: 1, opacity: 1, ease: 'linear' },
  { t: 1.58, x: 81, y: 72, scale: 1, opacity: 1, ease: 'cubic-bezier(.6, 0, .3, 1)' },
  { t: 1.7, x: 48.5, y: 47, scale: 1, opacity: 1, ease: 'ease-out' },
  { t: 1.72, x: 50, y: 46, scale: 1, opacity: 1, ease: 'ease-in-out' },
  { t: 1.81, x: 50, y: 46, scale: .8, opacity: 1, ease: 'linear' },
  { t: 1.85, x: 50, y: 46, scale: .8, opacity: 1, ease: 'ease-out' },
  { t: 1.97, x: 50, y: 46, scale: 1.8, opacity: 0 },
];

/** The beam hangs from the pool toward a source above the header (aimed for a 16:10 screen). */
export const BEAM_SOURCE = { x: 50, y: -14 } as const;
export const BEAM_ASPECT = 1.6;
export const beamAngle = (x: number, y: number) => round(Math.atan2((BEAM_SOURCE.x - x) * BEAM_ASPECT, y - BEAM_SOURCE.y) * 180 / Math.PI, 1);

export function spotKeyframesCss() {
  return keyframesCss('cf-spot', SPOT_KEYS.map((key) => ({
    percent: keyPercent(key.t, SPOT_TIMELINE_MS),
    body: `transform: translate(${round(key.x - SPOT_HOME.x)}vw, ${round(key.y - SPOT_HOME.y)}vh) scale(${key.scale}); opacity: ${key.opacity};${ease(key.ease)}`,
  })));
}
export function beamKeyframesCss() {
  return keyframesCss('cf-beam', SPOT_KEYS.map((key) => ({ percent: keyPercent(key.t, SPOT_TIMELINE_MS), body: `transform: rotate(${beamAngle(key.x, key.y)}deg);${ease(key.ease)}` })));
}

export type PopperKey = { t: number; r: number; ty: number; sx: number; sy: number; ease?: string };
const RISE = 'cubic-bezier(.34, 1.45, .64, 1)';
const INTO_POP = 'cubic-bezier(.6, 0, 1, .6)';
/** Ducks away with a quicker start than a plain ease-in, so the corner cards clear about 0.15 s into the sink. */
const SINK = 'cubic-bezier(.45, 0, .85, .45)';
const k = (t: number, r: number, ty: number, sx: number, sy: number, easing?: string): PopperKey => ({ t, r, ty, sx, sy, ease: easing });

/** Pip: rise, bob, startle as the spotlight lands, crouch-and-hold, the little "pop", freeze, tuft, sheepish tilt, squeeze, POP. */
export const PIP_KEYS: readonly PopperKey[] = [
  k(0, 38, 118, 1, 1, RISE), k(.05, 38, 118, 1, 1, RISE),
  k(.4, 38, 0, 1, 1, 'ease-in-out'), k(.46, 38, 0, 1.04, .95, 'ease-in-out'), k(.52, 38, -1.5, .98, 1.03, 'ease-in-out'), k(.58, 38, 0, 1, 1, 'ease-in-out'),
  k(.64, 36, -1, .97, 1.04, 'ease-in-out'), k(.7, 38, 0, 1.02, .98, 'ease-in-out'),
  k(.78, 38, 0, 1.1, .85, 'linear'), k(.82, 38.8, 0, 1.1, .85, 'linear'), k(.85, 37.2, 0, 1.11, .84, 'ease-in'), k(.88, 38, 0, 1.1, .85, 'ease-out'),
  k(.93, 39, -3, .9, 1.15, 'linear'), k(1.02, 39, -3, .91, 1.14, 'ease-in-out'), k(1.1, 38, 0, 1, 1, 'ease-out'),
  k(1.14, 37, .5, 1.05, .94, 'ease-in-out'), k(1.26, 30, 0, 1, 1, 'ease-in-out'), k(1.42, 31, 0, 1, 1, 'ease-in-out'), k(1.54, 38, 0, 1, 1, 'linear'),
  k(1.58, 40, 0, 1.03, .94), k(1.62, 36, 0, 1.05, .91), k(1.66, 40.5, 0, 1.07, .88), k(1.7, 35.5, 0, 1.09, .85), k(1.74, 40.5, 0, 1.11, .82), k(1.79, 36, 0, 1.13, .8, INTO_POP),
  k(1.85, 38, 7, .88, 1.24, 'ease-out'), k(1.93, 33, 4, 1.06, .92, 'ease-in-out'), k(2, 40, -1.5, .97, 1.05, 'ease-out'),
  k(2.05, 38, 0, 1, 1, SINK), k(2.28, 38, 118, 1, 1),
];
/**
 * Pop: rise, bob, a flinch at Pip's little "pop", a startled stretch as the spotlight lands (1.34), then
 * the "not me" head-shake (+-7 degrees, 1.38-1.62) in the light. It winds up while turning from its
 * 38-degree lean to aim at 28 degrees, and fires up and out from there. The kick then rocks it back
 * upright (toward its screen edge, off the right-hand card's left-aligned names) before it ducks away.
 */
const AIM = -POP_AIM_DEG;
/** Pop's lean once the kick has rocked it back (degrees; Pip keeps its 38: upright would lean it over the names). */
export const POP_KICK_DEG = -14;
export const POP_KEYS: readonly PopperKey[] = [
  k(0, -38, 118, 1, 1, RISE), k(.05, -38, 118, 1, 1, RISE),
  k(.4, -38, 0, 1, 1, 'ease-in-out'), k(.5, -38, 0, 1.04, .95, 'ease-in-out'), k(.56, -38, -1.5, .98, 1.03, 'ease-in-out'), k(.62, -38, 0, 1, 1, 'ease-in-out'),
  k(.9, -38, 0, 1, 1, 'ease-out'), k(.94, -35, -2, .96, 1.05, 'ease-in-out'), k(1.02, -38, 0, 1, 1, 'ease-in-out'),
  k(1.31, -38, 0, 1, 1, 'ease-out'), k(1.35, -37, -2.5, .95, 1.06, 'ease-in-out'), k(1.38, -38, 0, 1, 1, 'ease-in-out'),
  k(1.44, -45, 0, 1, 1, 'ease-in-out'), k(1.5, -31, 0, 1, 1, 'ease-in-out'), k(1.56, -44, 0, 1, 1, 'ease-in-out'), k(1.62, -37, 0, 1, 1, 'linear'),
  k(1.65, -33, 0, 1.04, .93), k(1.69, -35, 0, 1.07, .88), k(1.72, -30, 0, 1.09, .85), k(1.76, -32.5, 0, 1.11, .82), k(1.79, AIM - 1, 0, 1.13, .8, INTO_POP),
  k(1.85, AIM, 7, .88, 1.24, 'ease-out'), k(1.93, AIM + 5, 4, 1.06, .92, 'ease-in-out'), k(2, POP_KICK_DEG - 2, -1.5, .97, 1.05, 'ease-out'),
  k(2.05, POP_KICK_DEG, 0, 1, 1, SINK), k(2.28, POP_KICK_DEG, 118, 1, 1),
];
export function popperKeyframesCss(name: 'cf-pip' | 'cf-pop') {
  return keyframesCss(name, (name === 'cf-pip' ? PIP_KEYS : POP_KEYS).map((key) => ({
    percent: keyPercent(key.t, POPPER_TIMELINE_MS),
    // Rise, hops and the duck move straight up and down on screen (translate before the lean), so a duck never slides
    // sideways over the corner card's names.
    body: `transform: translateY(${key.ty}%) rotate(${key.r}deg) scale(${key.sx}, ${key.sy});${ease(key.ease)}`,
  })));
}

/** Discrete face swaps (step-end opacity): [seconds, opacity] from 0 s. */
export const FACE_STEPS = {
  'pp-eyes-open-l': [[0, 1], [.44, 0], [.49, 1], [1.1, 0], [1.15, 1], [1.6, 0]],
  'pp-blink-l': [[0, 0], [.44, 1], [.49, 0], [1.1, 1], [1.15, 0]],
  'pp-eyes-open-r': [[0, 1], [.6, 0], [.65, 1], [1.34, 0], [1.38, 1], [1.6, 0]],
  'pp-blink-r': [[0, 0], [.6, 1], [.65, 0], [1.34, 1], [1.38, 0]],
  'pp-lids-r': [[0, 0], [1.38, 1], [1.6, 0]],
  'pp-squint': [[0, 0], [1.6, 1], [1.93, 0]],
  'pp-after': [[0, 0], [1.93, 1]],
  'pp-smile-l': [[0, 1], [.72, 0], [1.12, 1], [1.6, 0]],
  'pp-mm-l': [[0, 0], [.72, 1], [.88, 0]],
  'pp-o-l': [[0, 0], [.88, 1], [1.12, 0]],
  'pp-blush-lines-l': [[0, 0], [1.14, 1], [1.6, 0]],
  'pp-smile-r': [[0, 1], [1.38, 0]],
  'pp-hmm-r': [[0, 0], [1.38, 1], [1.6, 0]],
} as const satisfies Record<string, readonly (readonly [number, number])[]>;
/** Eased glances: [seconds, x, y] in the popper's own art units (Pop's art is mirrored). */
export const LOOK_KEYS = {
  'pp-look-l': [[0, 0, 0], [.32, -1.5, -3.5], [.58, 1.5, -3.5], [.68, 0, 1.5], [1.1, 0, 1.5], [1.16, 0, -4.5], [1.46, 0, -4.5], [1.56, 2, 0]],
  'pp-look-r': [[0, 0, 0], [.32, 3, -2], [.58, 2, -1], [.7, 4.5, 1.5], [1.6, 4.5, 1.5], [1.66, 2, 0]],
} as const satisfies Record<string, readonly (readonly [number, number, number])[]>;
export const BLUSH_KEYS = [[0, .65], [1.14, .65], [1.24, 1], [1.6, 1], [1.93, .75]] as const;

export function faceKeyframesCss() {
  const steps = Object.entries(FACE_STEPS).map(([name, list]) => keyframesCss(name, list.map(([t, opacity]) => ({ percent: keyPercent(t, FACE_TIMELINE_MS), body: `opacity: ${opacity};` }))));
  const looks = Object.entries(LOOK_KEYS).map(([name, list]) => keyframesCss(name, list.map(([t, x, y]) => ({ percent: keyPercent(t, FACE_TIMELINE_MS), body: `transform: translate(${x}px, ${y}px);` }))));
  const blush = keyframesCss('pp-blush', BLUSH_KEYS.map(([t, opacity]) => ({ percent: keyPercent(t, FACE_TIMELINE_MS), body: `opacity: ${opacity};` })));
  return [...steps, ...looks, blush].join('\n');
}

/** Pip's tuft (art units): pops out with the puff, arcs up, lands on the rim with a springy squash, blasted off at the POP. */
export const TUFT_KEYS = [
  { t: 0, x: 0, y: 30, r: 0, sx: .3, sy: .3, o: 0 },
  { t: .88, x: 0, y: 30, r: 0, sx: .3, sy: .3, o: 0, ease: 'ease-out' },
  { t: .885, x: 0, y: 29, r: -4, sx: .34, sy: .34, o: 1, ease: 'ease-out' },
  { t: .98, x: -6, y: -30, r: -70, sx: 1, sy: 1, o: 1, ease: 'ease-in' },
  { t: 1.1, x: 0, y: 0, r: 0, sx: 1, sy: 1, o: 1, ease: 'ease-out' },
  { t: 1.14, x: 0, y: 2, r: 0, sx: 1.35, sy: .55, o: 1, ease: 'ease-in-out' },
  { t: 1.19, x: 0, y: -1, r: 0, sx: .86, sy: 1.18, o: 1, ease: 'ease-in-out' },
  { t: 1.24, x: 0, y: 0, r: 0, sx: 1.06, sy: .94, o: 1, ease: 'ease-in-out' },
  { t: 1.3, x: 0, y: 0, r: 0, sx: 1, sy: 1, o: 1, ease: 'linear' },
  { t: 1.85, x: 0, y: 0, r: 0, sx: 1, sy: 1, o: 1, ease: 'ease-out' },
  { t: 1.97, x: 16, y: -80, r: 140, sx: 1, sy: 1, o: 0 },
] as const;
export function tuftKeyframesCss() {
  return keyframesCss('pp-tuft', TUFT_KEYS.map((key) => ({
    percent: keyPercent(key.t, FACE_TIMELINE_MS),
    body: `transform: translate(${key.x}px, ${key.y}px) rotate(${key.r}deg) scale(${key.sx}, ${key.sy}); opacity: ${key.o};${ease('ease' in key ? key.ease : undefined)}`,
  })));
}

/** Tremble: one stop every 50 ms, growing jitter, then the inhale that freezes inflated at the hit. */
export function trembleStops() {
  const last = Math.round(TREMBLE_MS / TREMBLE_STEP_MS);
  return Array.from({ length: last + 1 }, (_, i) => {
    const p = i / last;
    if (i === 0) return { percent: 0, x: 0, y: 0, rotate: 0, scale: 1 };
    if (i === last) return { percent: 100, x: 0, y: 0, rotate: 0, scale: 1.035 };
    const amplitude = .5 + 3.5 * p ** 1.5;
    const sign = i % 2 ? 1 : -1;
    return {
      percent: round(p * 100),
      x: round(sign * amplitude),
      y: round([0, -1, .6, -.4][i % 4] * amplitude / 2),
      rotate: round(-sign * (.15 + .85 * p ** 1.5)),
      scale: p >= .88 ? round(1 + .035 * (p - .88) / .12, 4) : 1,
    };
  });
}
export function trembleKeyframesCss() {
  return keyframesCss('cf-tremble', trembleStops().map((stop) => ({ percent: stop.percent, body: `transform: translate(${stop.x}px, ${stop.y}px) rotate(${stop.rotate}deg) scale(${stop.scale});` })));
}

/** Every generated block, in the order it appears in confetti.css. */
export function generatedCss() {
  return {
    spot: `${spotKeyframesCss()}\n${beamKeyframesCss()}`,
    poppers: `${popperKeyframesCss('cf-pip')}\n${popperKeyframesCss('cf-pop')}`,
    faces: `${faceKeyframesCss()}\n${tuftKeyframesCss()}`,
    tremble: trembleKeyframesCss(),
    stars: starShowerCss(),
  };
}

/* ------------------------------------------------------------------ */
/* Web Animations keyframes (px) for the per-piece tracks              */
/* ------------------------------------------------------------------ */
/*
 * Jets, streamers, stars and the puff each have their own path. Written as CSS
 * keyframes those paths need var(), and Chromium then recalculates style for
 * every such element on every frame (measured: about 1 s of main-thread style
 * work per playback with 48 cards). Static px keyframes built once at mount run
 * on the compositor instead. These builders are pure, so the tests check the
 * exact paths the browser plays.
 */

export type Frame = { offset: number; transform?: string; opacity?: number; easing?: string };
export type Timing = { duration: number; delay: number; iterations?: number; direction?: 'alternate'; easing: string; fill: 'both' };
export type Track = { frames: Frame[]; timing: Timing };
const px = (value: number) => `${round(value, 1)}px`;
/** Value of a piecewise-linear track at share p. */
export function sampleTrack(stops: readonly number[], values: readonly number[], p: number) {
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i]) return values[i - 1] + (values[i] - values[i - 1]) * (p - stops[i - 1]) / (stops[i] - stops[i - 1]);
  }
  return values.at(-1) ?? 0;
}
const withStops = (stops: readonly number[], extra: readonly number[]) => [...new Set([...stops, ...extra])].sort((a, b) => a - b);

/** A jet piece fades in over the first 1.5% and holds until 94% of its flight (below the footer by then). */
export const JET_FADE = [.015, .94] as const;
/**
 * Position (px from its mouth; up is negative) of a jet piece at share p of its flight. side 1 = Pip. With a table
 * lane (Today) the piece lands inside the lane instead, at the same share of it, and flutters less.
 */
export function jetPoint(piece: JetPiece, side: 1 | -1, width: number, height: number, p: number, lane?: JetLane | null) {
  const vmin = Math.min(width, height) / 100;
  const dx = lane ? laneDxPx(piece, side, lane) : side * jetDxPx(piece.reach, width, height, side);
  const sway = piece.sway * vmin * (lane ? TABLE_SWAY_SCALE : 1);
  const path = { dx, rise: piece.rise * height / 100, drop: piece.drop * height / 100 };
  const xs = FLIGHT_STOPS.map((_, i) => (lane ? dx * FLIGHT_X_LANE[i] : flightStop(path, i).x) + (FLIGHT_SWAY[i - 5] ?? 0) * sway);
  const ys = FLIGHT_STOPS.map((_, i) => flightStop(path, i).y);
  return { x: sampleTrack(FLIGHT_STOPS, xs, p), y: sampleTrack(FLIGHT_STOPS, ys, p) };
}
export function jetTrack(piece: JetPiece, side: 1 | -1, width: number, height: number, lane?: JetLane | null): Track {
  return {
    frames: withStops(FLIGHT_STOPS, JET_FADE).map((offset) => {
      const at = jetPoint(piece, side, width, height, offset, lane);
      return {
        offset, opacity: offset === 0 || offset === 1 ? 0 : 1,
        transform: `translate3d(${px(at.x)}, ${px(at.y)}, 0px) rotate(${piece.rz}deg) rotate3d(${piece.ax}, ${piece.ay}, .35, ${round(piece.turns * offset * 360, 1)}deg)`,
      };
    }),
    timing: { duration: piece.duration, delay: CONFETTI_BURST_MS + piece.delay, easing: 'linear', fill: 'both' },
  };
}

/** Streamer opacity: in over 2%, held to STREAMER_FADE_FROM, out by the end. */
export const STREAMER_FADE_IN = .02;
export type StreamerPose = { x: number; y: number; angle: number; length: number; scaleX: number; scaleY: number; opacity: number };
/** A streamer's ribbon at share p of its flight: anchor (px from its mouth), angle (deg), full length (px), stretch and opacity. */
export function streamerPose(streamer: Streamer, side: 1 | -1, width: number, height: number, p: number): StreamerPose {
  const vmin = Math.min(width, height) / 100;
  const mouth = popperMouthPx(width, height, side);
  const length = streamer.length * vmin;
  const dx = streamer.anchor === 'mouth' ? side * streamer.x * width / 100 : side * (streamer.x * width / 100 - mouth.left);
  const r = Math.min(streamer.rise * height / 100, height - mouth.bottom - STREAMER_CEILING_PX - length * STREAMER_CAP_LEN);
  const sway = -side * STREAMER_SWAY_VMIN * vmin;
  const xs = STREAMER_X.map((x, i) => dx * x + (i > 4 ? STREAMER_SWAY[i - 4] * sway : 0));
  // From the apex the anchor falls until it is STREAMER_EXIT_VMIN below the footer clip line: the ribbon has left the screen.
  const drop = mouth.bottom + r - FOOTER_CLIP_PX + STREAMER_EXIT_VMIN * vmin;
  const ys = STREAMER_STOPS.map((_, i) => (i <= 4 ? r * STREAMER_Y[i] : -r + drop * STREAMER_FALL[i - 4]));
  const unfurl = UNFURL_STOPS.map((stop) => stop[0]);
  return {
    x: sampleTrack(STREAMER_STOPS, xs, p), y: sampleTrack(STREAMER_STOPS, ys, p), length,
    angle: streamer.a0 + streamer.spin * sampleTrack(unfurl, UNFURL_STOPS.map((stop) => stop[1]), p),
    scaleX: sampleTrack(unfurl, UNFURL_STOPS.map((stop) => stop[2]), p), scaleY: sampleTrack(unfurl, UNFURL_STOPS.map((stop) => stop[3]), p),
    opacity: sampleTrack([0, STREAMER_FADE_IN, STREAMER_FADE_FROM, 1], [0, 1, 1, 0], p),
  };
}
/** Two tracks: the flight on the streamer node and the unfurl (turn + stretch) on its ribbon. */
export function streamerTracks(streamer: Streamer, side: 1 | -1, width: number, height: number): { flight: Track; unfurl: Track } {
  const timing: Timing = { duration: streamer.duration, delay: CONFETTI_BURST_MS + streamer.delay, easing: 'linear', fill: 'both' };
  const pose = (p: number) => streamerPose(streamer, side, width, height, p);
  return {
    flight: { timing, frames: withStops(STREAMER_STOPS, [STREAMER_FADE_IN, STREAMER_FADE_FROM]).map((offset) => ({ offset, opacity: pose(offset).opacity, transform: `translate3d(${px(pose(offset).x)}, ${px(pose(offset).y)}, 0px)` })) },
    unfurl: { timing, frames: UNFURL_STOPS.map(([offset]) => ({ offset, transform: `rotate(${round(pose(offset).angle, 1)}deg) scale(${pose(offset).scaleX}, ${pose(offset).scaleY})` })) },
  };
}

/**
 * Star shower: a linear fall with spin and a twinkle, inside an eased side-to-side sway. 104vh takes a star from
 * under the header line to just past the footer line (the stage clip), so each fall ends as its star leaves.
 */
export const STAR_FALL_VH = 104;
/** Star elements start this far (vh) above the shower's clip line (the header's bottom edge). */
export const STAR_START_VH = 9;
/**
 * The shower needs nothing measured, so unlike the jets it is static CSS (generated into confetti.css by
 * starShowerCss): per star a sway block in vw and a fall block in vh, with no var(), so nothing is restyled per
 * frame; one rule per star carries its timing. CSS animations start with the stage itself: no script at mount.
 */
export function starFallStops(star: ShowerStar) {
  const at = (share: number, scale: number, opacity: number) => ({
    percent: round(share * 100, 2),
    body: `transform: translate3d(0, ${round(STAR_FALL_VH * share, 3)}vh, 0) rotate(${round(star.spin * share, 1)}deg) scale(${scale}); opacity: ${opacity};`,
  });
  // Fades in over the first half percent (still hidden under the header), then twinkles as it falls.
  return [at(0, .88, 0), at(.005, .8896, 1), ...Array.from({ length: 8 }, (_, i) => at((i + 1) / 8, (i + 1) % 2 ? 1.12 : .88, 1))];
}
export function starShowerCss(stars: readonly ShowerStar[] = starShower()) {
  return stars.map((star, i) => [
    `.cf-star.is-s${i} { animation: cf-sway-${i} ${star.swayMs}ms ${star.delay}ms ease-in-out ${Math.ceil(star.duration / star.swayMs)} alternate both; }`,
    `.cf-star.is-s${i} > .cf-star-fall { animation: cf-fall-${i} ${star.duration}ms ${star.delay}ms linear both; }`,
    keyframesCss(`cf-sway-${i}`, [{ percent: 0, body: `transform: translateX(${round(-star.sway, 2)}vw);` }, { percent: 100, body: `transform: translateX(${star.sway}vw);` }]),
    keyframesCss(`cf-fall-${i}`, starFallStops(star)),
  ].join('\n')).join('\n');
}

export type PuffPiece = ReturnType<typeof falseStartPuff>[number];
/** Stops of the puff's move track (linear between them, so the flip turns at an even rate). */
export const PUFF_STOPS = [0, .03, .06, .09, .12, .2, .3, .4, .5, .6, .7, .8, .9, PUFF_FADE_FROM, 1] as const;
/**
 * Position (px from the mouth; up is negative) of a puff bit at share p of its move: out along the
 * fan, decelerating to the apex at PUFF_APEX, then a gravity fall (quadratic) with a slow outward drift.
 */
export function puffPoint(piece: PuffPiece, width: number, height: number, p: number) {
  const vmin = Math.min(width, height) / 100;
  const [dx, rise, drop] = [piece.dx * vmin, piece.rise * vmin, piece.drop * vmin];
  if (p <= PUFF_APEX) {
    const out = 1 - (1 - p / PUFF_APEX) ** 2;
    return { x: dx * out, y: -rise * out };
  }
  const fall = (p - PUFF_APEX) / (1 - PUFF_APEX);
  return { x: dx * (1 + .3 * fall), y: -rise + (rise + drop) * fall * fall };
}
/** Pip's early puff as two tracks: the move (with tumble and paper flip) and the fade. */
export function puffTracks(piece: PuffPiece, width: number, height: number): { move: Track; fade: Track } {
  const timing: Timing = { duration: PUFF_MS, delay: PUFF_AT_MS + piece.delay, easing: 'linear', fill: 'both' };
  return {
    move: { timing, frames: PUFF_STOPS.map((offset) => {
      const at = puffPoint(piece, width, height, offset);
      return { offset, transform: `translate3d(${px(at.x)}, ${px(at.y)}, 0px) rotate(${round(piece.spin * offset, 1)}deg) rotate3d(${piece.ax}, ${piece.ay}, .35, ${round(piece.turns * 360 * offset, 1)}deg)` };
    }) },
    fade: { timing, frames: [{ offset: 0, opacity: 0 }, { offset: .03, opacity: 1 }, { offset: PUFF_FADE_FROM, opacity: 1 }, { offset: 1, opacity: 0 }] },
  };
}
