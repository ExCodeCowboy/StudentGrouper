/**
 * "Ocean wave · Otter surf" choreography: pure, deterministic functions of
 * (time in seconds, viewport width W, height H). No React, no CSS, no DOM, so
 * tests import it directly and the Stage bakes it into Web Animations.
 *
 * Units. S = art unit in px = min(H, 0.8 W): the viewport height on every
 * landscape screen, capped so the wave stays narrow on tall windows.
 * Wave-local coordinates: x in S from the crest (right = forward), y in S up
 * from the bottom of the wave box, which sits on the viewport bottom (+ riseY).
 * Art coordinates ("box units"): the wave SVG viewBox is -560..490 x 0..1000,
 * 1000 units = 1 S, y down, crest at (0, 190).
 */
import { clamp01, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, keyframes, mix, progress, smooth } from './sceneMotion';

export const WAVE_DURATION_MS = 4900;
/** The wash line (where sand covers are erased) is at the left viewport edge at this time (s)... */
export const WASH_START = 1.0;
/** ...and crosses the viewport at constant speed in this long (s). Covers use the same two numbers. */
export const WASH_CROSS = 2.3;
/** Every card is uncovered by then; lace fades shortly after. */
export const ALL_WASHED_AT = WASH_START + WASH_CROSS;
/** Covers' trailing foam lace fades over this long after the band leaves a card (ms). */
export const LACE_FADE_MS = 420;
/** The covers' foam band starts moving this long before the wave reaches a card (ms), already at wave speed. */
export const WASH_LEAD_MS = 300;
/** The wash line rides this far (S) ahead of the crest: under the lip and inside the dark tube. */
export const WASH_AHEAD_OF_CREST = 0.12;
/** Wave art box in S. The crest sits `crestFromLeft` from the box's left edge. */
export const WAVE_BOX = { width: 1.05, height: 1, crestFromLeft: 0.56 } as const;
/** SVG viewBox of every wave-local layer and the crest (lip pivot) inside it. */
export const WAVE_VIEWBOX = { x: -560, y: 0, width: 1050, height: 1000 } as const;
export const CREST = { x: 0, y: 190 } as const;
/**
 * The wave grows about this point (wave-local S, on the bottom edge a little ahead of its foot):
 * while it rears up, its foot even draws back a touch (anticipation), then it charges.
 */
export const WAVE_ANCHOR = { x: 0.72, y: 0 } as const;
/** Darkest point of the tube, where the otter hides (wave-local S). */
export const TUBE_EYE = { x: 0.18, y: 0.557 } as const;
/** The tease lap's front reaches this far (S) from the left edge; its box is LAP_WIDTH x LAP_HEIGHT S. */
export const LAP_REACH = 0.44;
export const LAP_HEIGHT = 0.46;
export const LAP_WIDTH = 0.9;
/** Footer controls the crab hides behind; the header the actors must stay under. */
export const CRAB_WALL_PX = 78;
export const HEADER_SAFE_PX = 72;

export const artUnit = (width: number, height: number) => Math.min(height, 0.8 * width);
export const washX = (time: number, width: number) => (width * (time - WASH_START)) / WASH_CROSS;
export const crestX = (time: number, width: number, s: number) => washX(time, width) - WASH_AHEAD_OF_CREST * s;
/** Wave travel speed in S per second on this viewport. */
export const waveSpeed = (width: number, height: number) => width / WASH_CROSS / artUnit(width, height);
/** A card whose left edge is at viewport fraction `left` is first washed at this time (s). */
export const coverHitTime = (left: number) => WASH_START + WASH_CROSS * left;

/** How far (in vw) the wash line travels in `ms`. */
export const vwFor = (ms: number) => Math.round((ms / 1000 / WASH_CROSS) * 100 * 1e4) / 1e4;

/**
 * Mirror of the cover CSS: when a card's wipe (and its foam band) animate, from the measured, clamped
 * `--reveal-left` / `--reveal-center-x`. Times in s; `end` is the viewport fraction where the wipe stops.
 */
export function coverWindow(left: number, centerX: number) {
  const k = Math.min(1, left * 1000);
  const end = Math.min(1, left + 2 * Math.max(0.01, centerX - left) + (1 - k) * 2);
  const hit = WASH_START + left * WASH_CROSS;
  const run = Math.max(0.004, end - left) * WASH_CROSS;
  const laceAt = WASH_START + end * WASH_CROSS;
  return { hit, run, end, laceAt, washFrom: hit - WASH_LEAD_MS / 1000, washUntil: hit + run + LACE_FADE_MS / 1000, laceGone: laceAt + LACE_FADE_MS / 1000 };
}

// ---------------------------------------------------------------------------
// Outlines (cubic segment lists). The SVG paths and the test polygons come
// from the same lists, so geometric checks track the art.

type Pt = readonly [number, number];
export type CubicOutline = { start: Pt; curves: readonly (readonly [Pt, Pt, Pt])[] };

/** Back, crest, roof over the barrel, barrel front, underside, face. Closed along the bottom. */
export const WAVE_BODY: CubicOutline = {
  start: [-380, 1040],
  curves: [
    [[-368, 890], [-300, 660], [-200, 470]],
    [[-140, 350], [-70, 220], [0, 190]],
    [[100, 166], [214, 196], [276, 262]],
    [[326, 316], [340, 396], [318, 452]],
    [[296, 500], [222, 540], [146, 562]],
    [[206, 612], [252, 662], [300, 740]],
    [[340, 810], [400, 900], [470, 1040]],
  ],
};
/** The hollow barrel under the lip (drawn over the body). */
export const WAVE_TUBE: CubicOutline = {
  start: [282, 440],
  curves: [
    [[284, 356], [230, 282], [150, 284]],
    [[72, 288], [36, 372], [50, 452]],
    [[64, 530], [120, 574], [178, 568]],
    [[236, 560], [280, 510], [282, 440]],
  ],
};
/** The curling lip, a separate layer that pitches about the crest. */
export const WAVE_LIP: CubicOutline = {
  start: [-40, 206],
  curves: [
    [[40, 168], [150, 156], [236, 192]],
    [[318, 228], [364, 316], [354, 404]],
    [[348, 462], [316, 508], [270, 526]],
    [[254, 532], [238, 532], [226, 528]],
    [[252, 514], [280, 486], [290, 450]],
    [[300, 412], [292, 340], [250, 300]],
    [[210, 264], [120, 248], [40, 256]],
    [[10, 260], [-14, 270], [-20, 280]],
  ],
};

/**
 * Tease lap (viewBox -900..0 x 0..460, front at x = 0): a tongue of surf. The top slopes from 0.4 S
 * at the back (where the otter floats), drops and thins to a sheet, and ends in one rounded, rolling
 * lobe about 0.19 S tall.
 */
export const LAP_BODY: CubicOutline = {
  start: [-900, 460],
  curves: [
    [[-900, 300], [-900, 120], [-900, 40]],
    [[-700, 40], [-560, 48], [-440, 62]],
    [[-350, 72], [-270, 92], [-220, 118]],
    [[-180, 140], [-168, 190], [-140, 236]],
    [[-120, 268], [-104, 290], [-86, 292]],
    [[-70, 294], [-64, 272], [-44, 268]],
    [[-20, 264], [-4, 288], [2, 320]],
    [[8, 360], [2, 420], [6, 460]],
  ],
};
/** The lobe's leading edge (the last three segments of LAP_BODY): where the tide line sits. */
export const LAP_FRONT: CubicOutline = { start: [-86, 292], curves: LAP_BODY.curves.slice(5) };

export function outlinePath(outline: CubicOutline, close = true) {
  const f = (p: Pt) => `${p[0]} ${p[1]}`;
  return `M${f(outline.start)}${outline.curves.map(([a, b, c]) => `C${f(a)} ${f(b)} ${f(c)}`).join('')}${close ? 'Z' : ''}`;
}

/** Points along an outline in its own art units. */
export function outlinePoints(outline: CubicOutline, stepsPerCurve = 12): [number, number][] {
  const points: [number, number][] = [];
  let from = outline.start;
  for (const [a, b, c] of outline.curves) {
    for (let step = 0; step < stepsPerCurve; step++) {
      const t = step / stepsPerCurve;
      const u = 1 - t;
      points.push([
        u * u * u * from[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * c[0],
        u * u * u * from[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * c[1],
      ]);
    }
    from = c;
  }
  points.push([from[0], from[1]]);
  return points;
}

/** Sample an outline into a polygon in art units / 1000 (S), y flipped up from `bottom`. */
export function outlinePolygon(outline: CubicOutline, stepsPerCurve = 12, bottom = 1000): [number, number][] {
  const points: [number, number][] = [];
  let from = outline.start;
  for (const [a, b, c] of outline.curves) {
    for (let step = 0; step < stepsPerCurve; step++) {
      const t = step / stepsPerCurve;
      const u = 1 - t;
      const x = u * u * u * from[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * c[0];
      const y = u * u * u * from[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * c[1];
      points.push([x / 1000, (bottom - y) / 1000]);
    }
    from = c;
  }
  return points;
}

/** Opaque water silhouette (body), wave-local S, y up. */
export const WAVE_SILHOUETTE = outlinePolygon(WAVE_BODY);
/** Tease lap silhouette in S: x from the lap front (<= 0), y up from the viewport bottom. */
export const LAP_SILHOUETTE = outlinePolygon(LAP_BODY, 12, 460);

export function insidePolygon(polygon: readonly (readonly [number, number])[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------
// The wet patch the tease lap leaves on the sand: the lap's own footprint at
// full reach, drawn once as a static SVG background inside every cover.

/** Wet sand: a cooler, darker sand tone; five stacked copies build up to about WET_TONE_OPACITY (~.34) in the core, so it reads across a room. */
export const WET_TONE = '#c99a5a';
export const WET_LAYER_OPACITY = 0.08;
export const WET_TONE_OPACITY = 1 - (1 - WET_LAYER_OPACITY) ** 5;
/** Tide-line foam dots (radius, art units: 1000 = 1 S) and the glossy line's width, sized to read on a projector. */
export const TIDE_DOT_R = [6, 8] as const;
export const WET_GLOSS_WIDTH = 10;
/** Points along the lobe's leading edge, about `spacing` art units apart. */
export function tideLine(spacing = 30): [number, number][] {
  const edge: [number, number][] = [];
  for (const point of outlinePoints(LAP_FRONT, 40)) {
    const last = edge[edge.length - 1];
    if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) >= spacing) edge.push(point);
  }
  return edge;
}

/** SVG for the wet patch, in the lap's art units, cropped to the on-screen part [-LAP_REACH S, 0]. */
export function wetPatchSvg() {
  const left = -LAP_REACH * 1000;
  const body = outlinePath(LAP_BODY);
  const front = outlinePath(LAP_FRONT, false);
  // A soft top edge: the footprint stacked a few times, each copy a little lower (no filters).
  const layers = [0, 9, 18, 27, 36].map((dy) => `<path d='${body}' transform='translate(0 ${dy})' fill='%23${WET_TONE.slice(1)}' fill-opacity='${WET_LAYER_OPACITY}'/>`).join('');
  // "The water was here": a glossy line just inside the lobe's edge, and a row of foam dots and bubbles along it.
  const gloss = `<path d='${front}' fill='none' stroke='%23fff6df' stroke-opacity='.6' stroke-width='${WET_GLOSS_WIDTH}' stroke-linecap='round' transform='translate(-16 10)'/>`;
  const r = (value: number) => Math.round(value * 10) / 10;
  const [small, big] = TIDE_DOT_R;
  const foam = tideLine().map(([x, y], index) => index % 3 === 2
    ? `<circle cx='${r(x - 2)}' cy='${r(y + 1)}' r='${big}' fill='none' stroke='%23ffffff' stroke-opacity='.85' stroke-width='3.4'/>`
    : `<circle cx='${r(x - 1)}' cy='${r(y + 2)}' r='${index % 3 ? small : big}' fill='%23ffffff' fill-opacity='.9'/>`).join('');
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${left} 0 ${-left} 460'>${layers}${gloss}${foam}</svg>`;
}

/** Timing and art handed to every cover as CSS custom properties (the one sync point between Stage and covers). */
export function waveCoverVars(): Record<string, string> {
  return {
    '--wave-wash-start': `${WASH_START * 1000}ms`,
    '--wave-wash-cross': `${WASH_CROSS * 1000}ms`,
    '--wave-lace-fade': `${LACE_FADE_MS}ms`,
    '--wave-wash-lead': `${WASH_LEAD_MS}ms`,
    // The same two durations as distances travelled by the wash line (100vw per WASH_CROSS).
    '--wave-wash-lead-vw': `${vwFor(WASH_LEAD_MS)}vw`,
    '--wave-lace-fade-vw': `${vwFor(LACE_FADE_MS)}vw`,
    '--wave-lap-reach': `${LAP_REACH}`,
    '--wave-lap-height': `${LAP_HEIGHT}`,
    '--wave-wet-art': `url("data:image/svg+xml,${wetPatchSvg().replace(/</g, '%3C').replace(/>/g, '%3E')}")`,
  };
}

// ---------------------------------------------------------------------------
// The big wave.

/**
 * The wave stands up in view: a small curl grows about WAVE_ANCHOR into the full wave (scale),
 * overshoots a touch and settles exactly as the wash line enters the screen.
 */
export function waveGrow(time: number) {
  if (time >= WASH_START) return 1;
  if (time < 0.94) return mix(0.2, 1.05, easeInOutCubic(progress(time, 0.58, 0.94)));
  return mix(1.05, 1, smooth(progress(time, 0.94, WASH_START)));
}
/** While small, it also rises out of the sea (S, + = pushed down below the viewport bottom). */
export const riseY = (time: number) => mix(0.22, 0, easeOutCubic(progress(time, 0.58, 0.86)));

/** Lip pitch about the crest (deg): unrolls and throws forward in view, then a small gulp and spit at the tunnel (never a "mouth"). */
export function lipAngle(time: number) {
  if (time < 1.4) return keyframes(time, [[0.62, -26], [0.96, 7], [1.08, 0]]);
  return keyframes(time, [[2.16, 0], [2.3, 6], [2.7, 8], [2.77, -7], [2.96, 0]]);
}

/** Face surface polyline (wave-local S, y up): bottom of the tube down to the foot. */
export const FACE: readonly Pt[] = [[0.14, 0.44], [0.26, 0.32], [0.36, 0.17], [0.46, 0.02]];
export function faceAt(y: number) {
  for (let i = 1; i < FACE.length; i++) {
    const [x0, y0] = FACE[i - 1];
    const [x1, y1] = FACE[i];
    if (y >= y1 || i === FACE.length - 1) {
      const amount = (y0 - y) / (y0 - y1);
      return { x: mix(x0, x1, i === FACE.length - 1 ? amount : clamp01(amount)), slope: (Math.atan2(y0 - y1, x1 - x0) * 180) / Math.PI };
    }
  }
  return { x: FACE[0][0], slope: 45 };
}

// ---------------------------------------------------------------------------
// Surfing otter (wave-local, board centre).

/**
 * Key poses plus three in-betweens, so limbs never snap between drawings: 'lower' (cheering arms
 * coming down), 'reach' (the high-five arm halfway up or down) and 'crouch' (the tuck's body, eyes
 * still open: the crouch leads the squint).
 */
export type OtterPose = 'ride' | 'five' | 'tuck' | 'cheer' | 'lower' | 'reach' | 'crouch';
export const OTTER_POSES: readonly OtterPose[] = ['ride', 'five', 'tuck', 'cheer', 'lower', 'reach', 'crouch'];
/** squash = vertical scale; sx = horizontal scale (defaults to a volume-keeping counter-stretch). */
export type OtterState = { x: number; y: number; angle: number; scale: number; squash: number; sx?: number; pose: OtterPose; opacity: number; brightness: number };
/** Otter art: 0.24 S wide, 1.2x as tall, board-centre anchor at (100, 214) of its 200 x 240 viewBox. */
export const OTTER_SIZE = { width: 0.24, aspect: 1.2, anchorX: 100 / 200, anchorY: 214 / 240 } as const;
/** The raised paw of the 'five' pose (otter art units), reaching up and away from the head. */
export const OTTER_FIVE_PAW = [178, 34] as const;
const RIDE_Y = 0.34;
const TUBE_MOUTH = { x: 0.25, y: 0.45 } as const;
/** Standing on the face: board centre just outside the surface, board tilted with it. */
export const onFace = (y: number) => { const face = faceAt(y); return { x: face.x + 0.012, y: y + 0.01, angle: Math.min(32, face.slope) }; };

/** `cheer` is when the otter lands on the wave's back after the POP (the landing squash starts there). */
export const OTTER_PHASES = { pop: 1.02, land: 1.22, five: 1.76, fiveEnd: 2.02, stall: 2.08, dive: 2.18, hidden: 2.3, spit: 2.72, cheer: 2.98 } as const;
/**
 * Has the clock reached `at`? Cut times can fall exactly on the 60 Hz bake grid (2.30 s is frame 138), where
 * `i * duration / count` lands a hair either side of the beat; the tolerance keeps every sample on one side.
 */
export const reached = (time: number, at: number) => time >= at - 1e-9;
/**
 * The otter never fades (no see-through ghost frames): it pops out of the face already solid, small and
 * stretched up (`from` scale, `stretch` relaxing over `relaxMs`), and leaves the ride by shrinking into the
 * dark tube as a solid silhouette (`dark` from..to, s) that is cut once it is tiny (`scale`).
 */
export const POP_UP = { from: 0.35, stretch: { x: 0.86, y: 1.18 }, relaxMs: 90 } as const;
export const DIVE = { scale: 0.22, dark: [2.2, 2.28] } as const;
/**
 * The ride-out (wave-local S). After the POP the otter hops up and back over the tube while the wave rolls
 * on beneath it, so on screen it holds near 0.8 W instead of being carried off the right edge. It lands on
 * the wave's back behind the crest (`x`, `y`, board tilt `angle`), cheers there in full view, drifting a
 * touch down the back (`drift`, S/s), and rides off with the wave. `hop` is the arc's height above its chord.
 */
export const RIDE_OUT = { x: -0.03, y: 0.45, hop: 0.1, angle: -5, drift: [-0.02, -0.05] } as const;
/**
 * Arm drawings per pose (otter art units, before the pose's crouch offset): a quadratic from the
 * shoulder through `ctrl` to `to`, and the paw centre. Kept here so tests can check the staging.
 */
export type ArmCurve = { from: Pt; ctrl: Pt; to: Pt; paw: Pt };
export type OtterDrawing = { near: ArmCurve; far: ArmCurve; crouch: number; squint?: boolean; grin?: boolean };
const RIDE_FAR: ArmCurve = { from: [100, 116], ctrl: [80, 110], to: [62, 100], paw: [58, 98] };
const TUCK_ARMS = { near: { from: [128, 122], ctrl: [144, 130], to: [154, 120], paw: [156, 118] }, far: { from: [100, 124], ctrl: [88, 132], to: [76, 126], paw: [72, 124] } } as const;
export const OTTER_ARMS: Record<OtterPose, OtterDrawing> = {
  ride: { near: { from: [130, 114], ctrl: [150, 112], to: [166, 100], paw: [168, 98] }, far: RIDE_FAR, crouch: 0 },
  // The high-five paw reaches up and out, clear of the head, so the contact reads on its own.
  five: { near: { from: [128, 110], ctrl: [158, 88], to: [OTTER_FIVE_PAW[0] - 3, OTTER_FIVE_PAW[1] + 6], paw: OTTER_FIVE_PAW }, far: RIDE_FAR, crouch: 0, grin: true },
  // In-between: the paw halfway up (or halfway back down) about its shoulder.
  reach: { near: { from: [129, 112], ctrl: [156, 100], to: [172, 70], paw: [174, 65] }, far: RIDE_FAR, crouch: 0, grin: true },
  // "Yay!": both arms up in a clear V, paws above the ears and outside the head, the grin unobstructed.
  cheer: { near: { from: [136, 112], ctrl: [184, 98], to: [184, 30], paw: [186, 24] }, far: { from: [98, 114], ctrl: [58, 96], to: [56, 30], paw: [54, 24] }, crouch: -2, grin: true },
  // In-between: the cheering arms on their way down to the ride pose.
  lower: { near: { from: [133, 113], ctrl: [170, 104], to: [178, 64], paw: [180, 59] }, far: { from: [99, 115], ctrl: [66, 102], to: [58, 64], paw: [56, 59] }, crouch: -1, grin: true },
  // The tuck's body with the eyes still open (the crouch leads the squint).
  crouch: { ...TUCK_ARMS, crouch: 12 },
  tuck: { ...TUCK_ARMS, crouch: 12, squint: true },
};
/** Head circle of the surfing otter (art units, after its 1.18x scale; crouch 0), its open grin (a quadratic closed by a straight top) and its ears' height. */
export const OTTER_HEAD = { x: 121, y: 64, r: 37 * 1.18, grin: { from: [118.1, 88.8], ctrl: [126.9, 107.7], to: [135.8, 88.8] }, earY: 31 } as const;
/** The cheering arms pump about their shoulders (the arm curves' start points, crouch included). */
export const cheerShoulder = (side: 'near' | 'far'): Pt => [OTTER_ARMS.cheer[side].from[0], OTTER_ARMS.cheer[side].from[1] + OTTER_ARMS.cheer.crouch];

/** In-between drawings (s): arms coming down after the pop-up, the paw going up and down, the crouch before the squint. */
export const OTTER_INBETWEENS = { lowered: 1.28, reachUp: 1.72, squint: 2.12 } as const;

/** Which drawing shows at a moment while riding (1.02-2.30). */
function ridePose(time: number): OtterPose {
  const P = OTTER_PHASES;
  const B = OTTER_INBETWEENS;
  if (time < P.land) return 'cheer';
  if (time < B.lowered) return 'lower';
  if (time < B.reachUp) return 'ride';
  if (time < P.five) return 'reach';
  if (time < P.fiveEnd) return 'five';
  if (time < P.stall) return 'reach';
  if (time < B.squint) return 'crouch';
  return 'tuck';
}

/** Cheering paw pump (deg about the shoulders, + = arms open wider): 180 ms swings while the cheer shows. */
export const PUMP_DEG = 10;
export const PUMP_HALF_MS = 180;
/** The ride-out pump settles by then (the otter is starting to leave the screen). */
export const PUMP_UNTIL = 3.6;
export function cheerPump(time: number) {
  const swing = (from: number) => Math.sin((Math.PI * (time - from)) / (PUMP_HALF_MS / 1000));
  if (time >= 1.04 && time <= OTTER_PHASES.land) return PUMP_DEG * swing(1.04) * (1 - smooth(progress(time, 1.16, OTTER_PHASES.land)));
  // Pumping through the hop, the landing and the cheer on the wave's back; the arms settle as it rides off.
  if (time >= 2.76) return PUMP_DEG * swing(2.76) * smooth(progress(time, 2.76, 2.82)) * (1 - smooth(progress(time, PUMP_UNTIL - 0.1, PUMP_UNTIL)));
  return 0;
}

/** The POP: stretched tall and thin along the burst (held for the first frames, relaxed by 90 ms)... */
export const SPIT_STRETCH = { x: 0.8, y: 1.25, holdMs: 30, relaxMs: 90 } as const;
/** ...and squashed wide on landing at OTTER_PHASES.cheer. */
export const SPIT_LANDING = { x: 1.15, y: 0.85 } as const;

export function surfOtter(time: number): OtterState {
  const base = { scale: 1, squash: 1, opacity: 1, brightness: 1 };
  const P = OTTER_PHASES;
  if (time < P.pop) return { ...onFace(RIDE_Y), ...base, scale: POP_UP.from, pose: 'cheer', opacity: 0 };
  if (time < P.land) {
    // Pops out of the face in a splash, already solid (small and stretched up, "sproing"), arcs up and lands on the board.
    const p = progress(time, P.pop, P.land);
    const rest = onFace(RIDE_Y);
    const burst = 1 - smooth(progress(time, P.pop + 0.02, P.pop + POP_UP.relaxMs / 1000));
    return {
      ...base, x: rest.x + 0.03 * (1 - p), y: rest.y - 0.08 * (1 - p) + 0.1 * Math.sin(Math.PI * p), angle: mix(-20, rest.angle, easeOutCubic(p)),
      scale: mix(POP_UP.from, 1, easeOutBack(progress(time, P.pop, 1.16), 2.2)),
      squash: 1 + 0.08 * Math.sin(Math.PI * p) + (POP_UP.stretch.y - 1) * burst, sx: 1 - 0.048 * Math.sin(Math.PI * p) + (POP_UP.stretch.x - 1) * burst,
      pose: 'cheer', opacity: 1,
    };
  }
  if (time < P.stall) {
    // One carve down and up the face, then the tail-five and a happy wobble.
    const carve = time < P.five ? 0.035 * Math.sin((2 * Math.PI * (time - P.land)) / 0.54 + Math.PI) : 0;
    const rest = onFace(RIDE_Y + carve);
    const land = 1 - 0.14 * Math.sin(Math.PI * progress(time, P.land, 1.34));
    const recoil = time >= 1.86 ? 5 * Math.sin((time - 1.86) * 31.4) * (1 - progress(time, 1.86, 2.06)) : 0;
    return { ...base, ...rest, angle: rest.angle + recoil, squash: land, pose: ridePose(time) };
  }
  if (!reached(time, P.hidden)) {
    // Carves up to the tube mouth, tucks, then zooms into the dark tunnel: it shrinks and darkens into a solid
    // silhouette of the tube's own deep teal, so it disappears into the dark instead of fading out.
    const rest = onFace(RIDE_Y);
    const up = smooth(progress(time, P.stall, P.dive));
    const dive = easeInCubic(progress(time, P.dive, P.hidden));
    return {
      ...base, x: mix(mix(rest.x, TUBE_MOUTH.x, up), TUBE_EYE.x, dive), y: mix(mix(rest.y, TUBE_MOUTH.y, up), TUBE_EYE.y - 0.05, dive), angle: mix(rest.angle, 0, up),
      scale: mix(1, DIVE.scale, dive), squash: mix(1, 0.9, up), pose: ridePose(time), opacity: 1, brightness: 1 - 0.75 * smooth(progress(time, DIVE.dark[0], DIVE.dark[1])),
    };
  }
  // Hidden: already in the cheer drawing (invisible) and still dark, so no cut ever shows a stale or half-shaded frame.
  if (time < P.spit) return { ...base, x: TUBE_EYE.x, y: TUBE_EYE.y - 0.05, angle: 0, scale: 0.3, pose: 'cheer', opacity: 0, brightness: 0.25 };
  // Spat out of the tunnel: bursts out bright and stretched toward the class, hops up and back (a ballistic
  // arc: steady sideways, rising then falling) while the wave rolls on beneath it, lands on the wave's back
  // with a squash, cheers there with its arms pumping and rides off with the wave.
  const out = progress(time, P.spit, P.cheer);
  const from = { x: TUBE_EYE.x, y: TUBE_EYE.y - 0.05 };
  const after = Math.max(0, time - P.cheer);
  const burst = 1 - smooth(progress(time, P.spit + SPIT_STRETCH.holdMs / 1000, P.spit + SPIT_STRETCH.relaxMs / 1000));
  const land = Math.sin(Math.PI * progress(time, P.cheer, P.cheer + 0.16));
  return {
    ...base,
    x: mix(from.x, RIDE_OUT.x, out) + RIDE_OUT.drift[0] * after,
    y: mix(from.y, RIDE_OUT.y, out) + 4 * RIDE_OUT.hop * out * (1 - out) + RIDE_OUT.drift[1] * after + 0.01 * Math.sin(after * 9),
    angle: mix(-18, RIDE_OUT.angle, easeOutCubic(out)) + 4 * Math.sin(after * 7),
    scale: out < 1 ? mix(0.3, 1, easeOutBack(progress(time, P.spit, P.spit + 0.14), 1.8)) : 1,
    squash: 1 + (SPIT_STRETCH.y - 1) * burst - (1 - SPIT_LANDING.y) * land, sx: 1 + (SPIT_STRETCH.x - 1) * burst + (SPIT_LANDING.x - 1) * land,
    pose: 'cheer', opacity: 1, brightness: 1,
  };
}

/**
 * The otter's art box on screen at a moment (viewport px): the four corners of its 0.24 S x 0.288 S box
 * after the track's rotate/scale about the board centre and the wave's own growth.
 */
export function otterBoxPx(time: number, width: number, height: number) {
  const s = artUnit(width, height);
  const o = surfOtter(time);
  const k = waveGrow(time);
  const board = waveToScreen(time, width, height, o.x, o.y);
  const w = OTTER_SIZE.width * s * k;
  const h = w * OTTER_SIZE.aspect;
  const sx = o.scale * otterScaleX(o);
  const sy = o.scale * o.squash;
  const a = (o.angle * Math.PI) / 180;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const dx = (u - OTTER_SIZE.anchorX) * w * sx;
    const dy = (v - OTTER_SIZE.anchorY) * h * sy;
    xs.push(board.x + dx * Math.cos(a) - dy * Math.sin(a));
    ys.push(board.y + dx * Math.sin(a) + dy * Math.cos(a));
  }
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}
/** Horizontal scale of the otter art at a moment. */
export const otterScaleX = (o: OtterState) => o.sx ?? 1 + (1 - o.squash) * 0.6;
/** Opacity of the dark silhouette over the otter (1 = a solid silhouette in the tube's own deep teal). */
export const otterShade = (o: OtterState) => clamp01((1 - o.brightness) / 0.75);

/** Is the board on the water (for the rooster-tail spray)? */
export const boardSpray = (time: number) => fadeBetween(time, 1.2, 1.28, 2.06, 2.14) + fadeBetween(time, OTTER_PHASES.cheer - 0.02, OTTER_PHASES.cheer + 0.06, 3.7, 3.8);
function fadeBetween(time: number, start: number, full: number, out: number, end: number) {
  return smooth(progress(time, start, full)) * (1 - smooth(progress(time, out, end)));
}

/**
 * The otter peeking out of the dark tunnel (a rim-lit head with big eyes). Each part holds long
 * enough to read across a room: the head pops up where the otter vanished (eyes still squeezed shut
 * from the tuck), the eyes pop open, a 100 ms blink, a glance at the class, a wind-up, then POP.
 * The head is solid the whole time: it appears and leaves with cuts (the POP flash covers the exit).
 */
export const TUNNEL = { in: 2.3, eyesOpen: 2.33, open: 2.36, blink: 2.52, closed: 2.55, reopen: 2.585, blinkEnd: 2.62, glanced: 2.65, out: 2.66, gone: 2.72 } as const;
/** Head scale as it pops up to size (from the shrunken otter's size, with an overshoot), and its wind-up squash before the POP. */
export const TUNNEL_POP = { from: 0.4, over: 1.1, peakAt: 2.35, settledAt: 2.4 } as const;
export const TUNNEL_WINDUP = { x: 1.12, y: 0.84 } as const;
export const tunnelEyes = (time: number) => {
  const grow = keyframes(time, [[TUNNEL.in, TUNNEL_POP.from], [TUNNEL_POP.peakAt, TUNNEL_POP.over], [TUNNEL_POP.settledAt, 1]]);
  const windup = smooth(progress(time, TUNNEL.out, TUNNEL.gone - 0.01));
  return {
    opacity: reached(time, TUNNEL.in) && !reached(time, TUNNEL.gone) ? 1 : 0,
    scaleX: grow * mix(1, TUNNEL_WINDUP.x, windup),
    scaleY: grow * mix(1, TUNNEL_WINDUP.y, windup),
    blink: keyframes(time, [[TUNNEL.in, 0.08], [TUNNEL.eyesOpen, 0.08], [TUNNEL.open, 1], [TUNNEL.blink, 1], [TUNNEL.closed, 0.08], [TUNNEL.reopen, 0.08], [TUNNEL.blinkEnd, 1]]),
    look: smooth(progress(time, TUNNEL.blinkEnd, TUNNEL.glanced)),
  };
};
/** Tunnel head box (S) and its pupils: looking at the exit, then straight at the class (art units of the 65 x 50 head). */
export const TUNNEL_HEAD = { width: 0.15, height: 0.115, eyeWidth: 14.8 } as const;
export const tunnelPupils = (look: number) => ({ x: mix(2.6, -1.1, look), y: mix(0.2, 1.4, look) });

// ---------------------------------------------------------------------------
// Dolphin tail-five: leaps out of the face below the otter, levels out beside
// its raised paw, flicks its tail into it and nose-dives back into the face.
// The path is designed on screen (S, relative to where the crest is at the
// contact), so the leap looks the same on every viewport; in wave-local terms
// the wave then catches the falling dolphin.

export const DOLPHIN = {
  start: 1.64, fiveAt: 1.86, end: 2.22,
  /** Past `end` it keeps diving at its final speed and is cut here, once its tail is under the water line and the footer (no fade). */
  gone: 2.27,
  /** Where the leap starts inside the face (wave-local, at the nominal wave speed) and where the fall ends (height). */
  fromX: 0.3, fromY: 0.1, bottom: 0.04,
  /** Body centre at the contact (wave-local S). */
  contact: [0.572, 0.488],
  /** Screen speed (S/s) along x at the top of the leap, and at the end of the fall (it drops back into the face). */
  apexSpeed: 0.28,
  endSpeed: -0.3,
  nominalSpeed: 0.7,
} as const;
/** After the tail-five the nose tips over into the dive over this long (a follow-through, not a snap). */
export const DOLPHIN_FLICK_MS = 120;
/** Dolphin art: 0.25 S long, half as tall; body centre at (125, 62) of 240 x 120; tail tip at (6, 40). */
export const DOLPHIN_SIZE = { width: 0.25, aspect: 0.5, anchorX: 125 / 240, anchorY: 62 / 120, tail: [6, 40] } as const;

/** On-screen offset (S, y up) from the contact point at `tau` seconds into the leap. */
function dolphinScreen(tau: number) {
  const { start, fiveAt, end, fromX, fromY, bottom, contact, apexSpeed, endSpeed, nominalSpeed } = DOLPHIN;
  const rise = fiveAt - start;
  const fall = end - fiveAt;
  if (tau <= rise) {
    // Launch: x decelerates from the launch speed to the apex speed, y rises ballistically to the top.
    const climbX = contact[0] - fromX + nominalSpeed * rise;
    const launch = (2 * climbX) / rise - apexSpeed;
    const brake = (launch - apexSpeed) / rise;
    const r = rise - tau;
    return { x: -(apexSpeed * r + 0.5 * brake * r * r), y: -(contact[1] - fromY) * (r / rise) ** 2 };
  }
  const r = tau - rise;
  return { x: apexSpeed * r + ((endSpeed - apexSpeed) * r * r) / (2 * fall), y: -(contact[1] - bottom) * (r / fall) ** 2 };
}

/**
 * Dolphin body centre (wave-local S) and nose angle. The wave-local path is the same on every
 * viewport (designed at the nominal wave speed), so it always leaves and re-enters the face and
 * meets the paw exactly; on screen it drifts a little with the viewport's wave speed.
 */
export function dolphin(time: number) {
  const total = DOLPHIN.end - DOLPHIN.start;
  const tau = Math.max(0, Math.min(total, time - DOLPHIN.start));
  const at = dolphinScreen(tau);
  // After the designed path it carries on at its final velocity (straight down into the sea, back into the face).
  const over = Math.max(0, Math.min(DOLPHIN.gone, time) - DOLPHIN.end);
  const fall = DOLPHIN.end - DOLPHIN.fiveAt;
  const x = DOLPHIN.contact[0] + at.x - DOLPHIN.nominalSpeed * (tau - (DOLPHIN.fiveAt - DOLPHIN.start)) + (DOLPHIN.endSpeed - DOLPHIN.nominalSpeed) * over;
  const y = DOLPHIN.contact[1] + at.y - ((2 * (DOLPHIN.contact[1] - DOLPHIN.bottom)) / fall) * over;
  // The nose follows the on-screen path (a short chord)...
  const pathAngle = (at: number) => {
    const a = dolphinScreen(Math.max(0, at - 0.05));
    const b = dolphinScreen(Math.min(total, at + 0.05));
    return (-Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  };
  // ...but after the tail-five it follows through into the nose-dive over DOLPHIN_FLICK_MS instead of
  // snapping over in two frames (the contact pose itself is unchanged).
  const five = DOLPHIN.fiveAt - DOLPHIN.start;
  const flick = (tau - five) / (DOLPHIN_FLICK_MS / 1000);
  const angle = flick > 0 && flick < 1 ? mix(pathAngle(five), pathAngle(tau), smooth(flick)) : pathAngle(tau);
  // Solid the whole time: it starts inside the water (behind the wave body) and is cut once it is hidden again.
  const visible = reached(time, DOLPHIN.start) && !reached(time, DOLPHIN.gone);
  return { x, y, angle, visible, opacity: visible ? 1 : 0 };
}
/** Tail tip in wave-local S (for the tail-five contact). */
export function dolphinTail(time: number) {
  const d = dolphin(time);
  const w = DOLPHIN_SIZE.width;
  const lx = ((DOLPHIN_SIZE.tail[0] - 125) / 240) * w;
  const ly = -((DOLPHIN_SIZE.tail[1] - 62) / 120) * w * DOLPHIN_SIZE.aspect;
  const a = (-d.angle * Math.PI) / 180;
  return { x: d.x + lx * Math.cos(a) - ly * Math.sin(a), y: d.y + lx * Math.sin(a) + ly * Math.cos(a) };
}
/** Otter "five" paw in wave-local S. */
export function otterPaw(time: number) {
  const o = surfOtter(time);
  const unit = OTTER_SIZE.width / 200;
  const lx = (OTTER_FIVE_PAW[0] - 100) * unit * o.scale;
  const ly = (214 - OTTER_FIVE_PAW[1]) * unit * o.scale;
  const a = (-o.angle * Math.PI) / 180;
  return { x: o.x + lx * Math.cos(a) - ly * Math.sin(a), y: o.y + lx * Math.sin(a) + ly * Math.cos(a) };
}

// ---------------------------------------------------------------------------
// The tease: a tongue of surf rushes in, "almost!", and draws back (px).

export function lapFront(time: number, width: number, s: number) {
  const reach = LAP_REACH * s;
  if (time < 0.52) return mix(-0.1 * width, reach, easeOutCubic(progress(time, 0.08, 0.52)));
  if (time < 0.64) return mix(reach, reach - 0.007 * width, progress(time, 0.52, 0.64));
  return mix(reach - 0.007 * width, -0.42 * width, easeInCubic(progress(time, 0.64, 0.92)));
}
export const lapVisible = (time: number) => time > 0.06 && time < 0.93;
/**
 * Floating otter box on the lap (S, from the lap box's top-left) and its resting tilt along the sloping water.
 * 1.15x the first build's size (0.253 S) and lifted 0.02 S, so its tummy, clam and waving paw ride above the
 * translucent surface line; nudged right so its tail is on screen at full reach.
 */
export const FLOATER = { left: 0.465, top: -0.04, width: 0.29, height: 0.29 * (150 / 260), tilt: 12 } as const;
/** The floating otter's head (260 x 150 frame): drawn 1.12x about its centre (217, 62), like the surfer's big head. */
export const FLOAT_HEAD_SCALE = 1.12;
export const FLOAT_HEAD = { x: 217, y: 62, r: 37 * FLOAT_HEAD_SCALE } as const;
/** Floating otter on the lap: bob (S), roll and the lazy spin as it is carried off (deg). */
export const floatOtter = (time: number) => ({
  bob: Math.sin(time * 10) * 0.008,
  angle: FLOATER.tilt + Math.sin(time * 7) * 4 - (time > 0.68 ? (time - 0.68) * 60 : 0),
});

// ---------------------------------------------------------------------------
// Peek-a-boo crab behind the footer, after the names are readable (px).

/** Crab art box: 0.18 S wide, 3:4; only the top 84 of its 120 rows ever show above the wall. */
export const CRAB_SIZE = { width: 0.18, aspect: 0.75, showRows: 84 / 120 } as const;
/** Horizontal extent of what shows (fractions of the crab box): everything, or only the eye stalks. */
export const CRAB_SPAN = { full: [12 / 160, 148 / 160], eyes: [38 / 160, 122 / 160] } as const;
/** Eyes-only peek: the rise is capped here so the claws and shell stay behind the wall. */
export const CRAB_EYES_ONLY = 0.5;
/** Last resort: only the tops of the eyes peek. */
export const CRAB_PEEK = 0.36;
/** With the claws hidden, the eyes hop up a little on each click instead (fraction of the crab box height). */
export const CRAB_CLICK_HOP = 0.1;
/** How far the crab's visible top rises above the wall (fraction of its box height) for a rise and cap. */
export const crabShows = (rise: number, cap: number, snap = 0) => CRAB_SIZE.showRows * rise + (cap < 1 ? CRAB_CLICK_HOP * snap : 0);
export const CRAB_TIMES = { up: 3.46, lookLeft: 3.78, lookRight: 4.02, lookBack: 4.26, clawsUp: 4.22, clicks: [4.34, 4.46], clawsDown: 4.5, duck: 4.55, down: 4.62 } as const;

/** A rectangle in viewport px. */
export type Box = { left: number; top: number; width: number; height: number };
/**
 * Card rectangles in viewport px (the Stage's measured reveal targets), with the rectangles of the
 * card's own content (names, labels, icons) when they were measured.
 */
export type CardRect = Box & { names?: readonly Box[] };
/** Where the crab peeks (`x`, px), how much of it may show (`cap`) and the footer's top edge it hides behind (`wall`, px from the viewport top). */
export type CrabPlan = { x: number; cap: number; wall?: number };
/** The wall the crab hides behind: the measured footer top, or CRAB_WALL_PX above the bottom when unmeasured. */
export const crabWall = (plan: CrabPlan, height: number) => plan.wall ?? height - CRAB_WALL_PX;

/** Unmeasured cards: the left part where their left-aligned names can reach (fraction of their width). */
export const CARD_TEXT_ZONE = 0.7;
/** Clearance (px) the crab keeps from any measured name. */
export const NAME_CLEARANCE = 8;

/**
 * Stretches of a horizontal band (viewport px, from `bandTop` down to `wall`) that the crab must not
 * cover: every measured name in the band (plus clearance), or for an unmeasured card the left 70 %
 * of it, whenever the card reaches into the band.
 */
export function blockedSpans(cards: readonly CardRect[], bandTop: number, wall: number): (readonly [number, number])[] {
  return cards.filter((card) => card.width > 0).flatMap((card) => {
    if (card.names && card.names.length > 0) {
      return card.names
        .filter((name) => name.width > 0 && name.top < wall && name.top + name.height > bandTop - NAME_CLEARANCE)
        .map((name) => [name.left - NAME_CLEARANCE, name.left + name.width + NAME_CLEARANCE] as const);
    }
    return card.top < wall && card.top + card.height > bandTop ? [[card.left - 2, card.left + CARD_TEXT_ZONE * card.width] as const] : [];
  }).sort((a, b) => a[0] - b[0]);
}

/**
 * Where the crab peeks: never over names. It goes into any stretch of the bottom band clear of the
 * cards' measured names (a gutter, or the empty bottom of a card), as close as possible to just
 * behind the passing wave; cards whose names were not measured keep their left 70 % clear. If the
 * full crab fits nowhere, only its eye stalks peek (rise capped), in the best gap available.
 */
export function crabPlan(cards: readonly CardRect[], width: number, height: number, wall = height - CRAB_WALL_PX): CrabPlan {
  const s = artUnit(width, height);
  const crabWidth = CRAB_SIZE.width * s;
  const crabHeight = crabWidth * CRAB_SIZE.aspect;
  // Just behind the passing wave (its back is 0.38 S behind the crest), so it never pops up over the water.
  const waveBack = crestX(CRAB_TIMES.up + 0.06, width, s) - 0.38 * s;
  const preferred = Math.max(0.5 * width, Math.min(0.8 * width, waveBack - 0.6 * crabWidth));
  /** Stretches of the bottom band clear of every card's name zone (behind the wave, or anywhere). */
  const gaps = (cap: number, behindWave: boolean) => {
    const domain: [number, number] = [0.3 * width, behindWave ? Math.min(width - 4, waveBack) : width - 4];
    const bandTop = wall - crabHeight * crabShows(1.06 * cap, cap, 1) - CLAW_REACH * crabHeight * (cap < 1 ? 0 : 1);
    const blocked = blockedSpans(cards, bandTop, wall);
    const free: [number, number][] = [];
    let cursor = domain[0];
    for (const [from, to] of blocked) {
      if (from > cursor) free.push([cursor, Math.min(from, domain[1])]);
      cursor = Math.max(cursor, to);
    }
    if (cursor < domain[1]) free.push([cursor, domain[1]]);
    return free.filter(([from, to]) => to > from);
  };
  const tryFit = (span: readonly [number, number], cap: number, behindWave: boolean) => {
    const before = (0.5 - span[0]) * crabWidth;
    const after = (span[1] - 0.5) * crabWidth;
    let best: number | undefined;
    for (const [from, to] of gaps(cap, behindWave)) {
      const lo = from + before;
      const hi = to - after;
      if (hi < lo) continue;
      const x = Math.max(lo, Math.min(hi, preferred));
      if (best === undefined || Math.abs(x - preferred) < Math.abs(best - preferred)) best = x;
    }
    return best;
  };
  // Best first: the whole crab behind the wave, then just its eyes there, then anywhere clear of names.
  const tiers = [[CRAB_SPAN.full, 1, true], [CRAB_SPAN.eyes, CRAB_EYES_ONLY, true], [CRAB_SPAN.full, 1, false], [CRAB_SPAN.eyes, CRAB_EYES_ONLY, false]] as const;
  for (const [span, cap, behind] of tiers) {
    const x = tryFit(span, cap, behind);
    if (x !== undefined) return { x, cap, wall };
  }
  // No gap is wide enough (a dense table): only the tops of the eyes peek, where they cover the least.
  // If even that would sit on a name, the crab stays hidden: names always win.
  const eyesLeft = (0.5 - CRAB_SPAN.eyes[0]) * crabWidth;
  const eyesRight = (CRAB_SPAN.eyes[1] - 0.5) * crabWidth;
  const merged: [number, number][] = [];
  for (const [from, to] of blockedSpans(cards, wall - crabHeight * crabShows(1.06 * CRAB_PEEK, CRAB_PEEK, 1), wall)) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  const lo = 0.3 * width + eyesLeft;
  const hi = width - 4 - eyesRight;
  const overlaps = (x: number) => merged.map(([from, to]) => Math.max(0, Math.min(to, x + eyesRight) - Math.max(from, x - eyesLeft)));
  // Rank by the most the eyes cover any one name zone, then by the total, then by closeness to the preferred spot.
  const cost = (x: number) => { const each = overlaps(x); return [Math.max(0, ...each), each.reduce((a, b) => a + b, 0), Math.abs(x - preferred)]; };
  const better = (a: number[], b: number[]) => a[0] < b[0] - 1e-6 || (Math.abs(a[0] - b[0]) <= 1e-6 && (a[1] < b[1] - 1e-6 || (Math.abs(a[1] - b[1]) <= 1e-6 && a[2] < b[2])));
  const gapCentres = merged.slice(1).map(([from], index) => (merged[index][1] + from) / 2);
  const candidates = [preferred, lo, hi, ...gapCentres, ...merged.flatMap(([from, to]) => [from - eyesRight, to + eyesLeft])].map((x) => Math.max(lo, Math.min(hi, x)));
  const best = candidates.reduce((a, b) => (better(cost(b), cost(a)) ? b : a));
  return { x: best, cap: cost(best)[0] <= CRAB_PEEK_OVERLAP * crabWidth ? CRAB_PEEK : 0, wall };
}
/** The last-resort peek may touch the edge of a name zone by at most this much (fraction of the crab width). */
export const CRAB_PEEK_OVERLAP = 0.12;

/** Rise above the wall (0 hidden, ~0.45 eyes only, 1 eyes + claws + top of the shell), before any cap. */
export const crabRise = (time: number) => keyframes(time, [[3.46, 0], [3.54, 0.52], [3.58, 0.45], [3.66, 1.05], [3.72, 1], [CRAB_TIMES.duck, 1], [4.575, 1.06], [CRAB_TIMES.down, 0]]);
/** A plan with cap 0 means there is nowhere to peek without covering a name: the crab stays hidden. */
export function crab(time: number, width: number, height: number, plan: CrabPlan) {
  return { x: plan.x, wall: crabWall(plan, height), rise: crabRise(time) * plan.cap, visible: plan.cap > 0 && time > CRAB_TIMES.up && time < CRAB_TIMES.down };
}
/** Eye stalks swing left (-1), hold, swing right (+1), hold, then look back at the class. */
export const crabLook = (time: number) => keyframes(time, [[CRAB_TIMES.lookLeft, 0], [3.84, -1], [CRAB_TIMES.lookRight, -1], [4.08, 1], [CRAB_TIMES.lookBack, 1], [4.3, 0]]);
export const CRAB_STALK_DEG = 18;
/** Pupil travel inside the eye whites (crab art units). */
export const CRAB_PUPIL_UNITS = 5;
/** Claws raised (0..1). */
export const crabClaws = (time: number) => keyframes(time, [[CRAB_TIMES.clawsUp, 0], [4.28, 1], [CRAB_TIMES.clawsDown, 1], [4.56, 0]]);
/** Claw snap (0 open, 1 closed) at each click. */
export const clawSnap = (time: number) => Math.max(0, ...CRAB_TIMES.clicks.map((click) => 1 - Math.abs(time - click) / 0.05));
/** The whole claw pumps up on each click (0..1): a quick lift into the click, back down within 90 ms. */
export const clawPump = (time: number) => Math.max(0, ...CRAB_TIMES.clicks.map((click) => keyframes(time, [[click - 0.04, 0], [click, 1], [click + 0.09, 0]])));
/** Claw motion (percent of the crab box / deg): raised beside the eyes, pumped on each click, squashed as it closes. */
export const CLAW_MOVE = { lift: 9, pump: 10, turn: 8, pumpTurn: -10, squash: 0.9 } as const;
/**
 * The "click!" tick at each pincer (crab art units, 160 x 120 frame): three gold strokes with a thick dark
 * outline so they read on the cream page, popping from their base at `origin`. `lines` is the SVG path;
 * `top` is the highest stroke end (before the outline's half-width).
 */
export const CLICK_TICK = { lines: 'M37 3 25.3-11.3M47 0V-16.9M57 3 68.7-11.3', top: -16.9, outline: 11, core: 6, origin: [47, 2], pop: 1.25, fill: '#ffb300', edge: '#7a2412' } as const;
/** The tick pops for this long at each click (the clicks are 120 ms apart). */
export const CLICK_TICK_MS = 110;
/**
 * A tick's [ms after its click, scale, opacity]: it appears solid and small, pops past full size, settles, holds,
 * then shrinks away whole (never a pale, see-through frame).
 */
export const TICK_KEYS: readonly (readonly [number, number, number])[] = [[-6, 0.3, 0], [-5, 0.45, 1], [12, CLICK_TICK.pop, 1], [50, 1, 1], [80, 1, 1], [CLICK_TICK_MS - 10, 0.15, 1], [CLICK_TICK_MS - 9, 0.15, 0]];
/** Transform of one claw layer at a moment (pure numbers, for the track and for the reach check). */
export function clawPose(time: number, eyesOnly: boolean) {
  const up = crabClaws(time);
  const pump = clawPump(time);
  const squash = 1 - (1 - CLAW_MOVE.squash) * clawSnap(time);
  return { lift: eyesOnly ? 40 : -CLAW_MOVE.lift * up - CLAW_MOVE.pump * pump, turn: CLAW_MOVE.turn * up + CLAW_MOVE.pumpTurn * pump, sx: 2 - squash, sy: squash };
}
/** The claw layer's transform-origin (its shoulder) in crab art units. */
export const CLAW_ORIGIN = [52, 74] as const;
/** How far (fraction of the crab box height) a raised, pumping claw and its popping click tick reach above the box top (checked by composing the real transforms in the tests). */
export const CLAW_REACH = 0.36;
// ---------------------------------------------------------------------------
// Secondary layers.

export const crownOpacity = (time: number) => fadeBetween(time, 0.74, 0.92, 3.55, 3.85);
export const sprayOpacity = (time: number) => fadeBetween(time, 0.95, 1.15, 3.55, 3.85);
export const laceOpacity = (time: number) => 1 - smooth(progress(time, 3.7, 4.2));
export type SplashKind = 'water' | 'star' | 'spit';
/** Splash one-shots (s) in wave-local S, so they travel with the wave. Stars and spray fan by `turn` (screen deg, -90 = up). */
export const SPLASHES: readonly { at: number; x: number; y: number; size: number; spread: number; turn: number; kind: SplashKind; ring?: boolean }[] = [
  { at: 1.02, x: 0.3, y: 0.27, size: 0.2, spread: 150, turn: -80, kind: 'water' },
  { at: 1.665, x: 0.36, y: 0.17, size: 0.14, spread: 150, turn: -60, kind: 'water' },
  { at: 1.86, x: 0.448, y: 0.482, size: 0.17, spread: 190, turn: -15, kind: 'star', ring: true },
  { at: 2.165, x: 0.37, y: 0.16, size: 0.14, spread: 150, turn: -90, kind: 'water' },
  { at: 2.72, x: 0.27, y: 0.5, size: 0.45, spread: 160, turn: -25, kind: 'spit', ring: true },
  { at: 2.74, x: 0.31, y: 0.46, size: 0.24, spread: 260, turn: -40, kind: 'spit' },
  // Splashdown on the wave's back as the hop lands (behind the surfer, so the cheer stays clear).
  { at: OTTER_PHASES.cheer, x: RIDE_OUT.x - 0.01, y: RIDE_OUT.y - 0.005, size: 0.13, spread: 170, turn: -90, kind: 'water' },
];
export const SPLASH_MS = 560;
/**
 * The POP's flash: a bright disc (white to aqua) filling the tube (wave-local S, diameter in S). It is at full
 * brightness from its first frame, so the peeking head's cut and the otter's first frame both happen under it.
 */
export const TUBE_FLASH = { at: 2.72, x: 0.165, y: 0.57, size: 0.3, ms: 130 } as const;
/** The crab's farewell bubble: swells for 180 ms, then pops into droplets. */
export const CRAB_BUBBLE_AT = 4.54;
export const CRAB_BUBBLE_SWELL_MS = 180;
export const CRAB_BUBBLE_MS = 300;

// ---------------------------------------------------------------------------
// Stage layout (px) and baked tracks. Each track is a pure function of time
// returning one Web Animations keyframe (transform / opacity only).

/** One baked keyframe. `easing: 'step-end'` holds the value until the next keyframe (pose swaps are clean cuts, never a cross-fade). */
export type WaveFrame = { transform?: string; opacity?: number; easing?: string };
export type WaveTrackName =
  | 'lap' | 'float' | 'wave' | 'lip' | 'backwash' | 'spray' | 'crown'
  | 'otter' | 'otterShade' | 'boardSpray' | `pose-${OtterPose}` | 'cheerNear' | 'cheerFar'
  | 'dolphin' | 'eyes' | 'blink' | 'pupils';
export type CrabTrackName = 'crab' | 'crabClawL' | 'crabClawR' | 'crabPincerL' | 'crabPincerR' | 'crabStalkL' | 'crabStalkR' | 'crabPupilL' | 'crabPupilR';

const px = (value: number) => `${Math.round(value * 10) / 10}px`;
const deg = (value: number) => `${Math.round(value * 100) / 100}deg`;
const num = (value: number) => Math.round(value * 1000) / 1000;
const pct = (value: number) => `${Math.round(value * 1000) / 1000}%`;

export function waveLayout(width: number, height: number) {
  const s = artUnit(width, height);
  const otter = { width: OTTER_SIZE.width * s, height: OTTER_SIZE.width * OTTER_SIZE.aspect * s };
  const dolphinBox = { width: DOLPHIN_SIZE.width * s, height: DOLPHIN_SIZE.width * DOLPHIN_SIZE.aspect * s };
  const crabBox = { width: CRAB_SIZE.width * s, height: CRAB_SIZE.width * CRAB_SIZE.aspect * s };
  const eyes = { width: TUNNEL_HEAD.width * s, height: TUNNEL_HEAD.height * s };
  const lap = { width: LAP_WIDTH * s, height: LAP_HEIGHT * s };
  const floater = { width: FLOATER.width * s, height: FLOATER.height * s, left: FLOATER.left * s, top: FLOATER.top * s };
  /** Wave-local S -> px inside the wave box. */
  const local = (x: number, y: number) => ({ left: (WAVE_BOX.crestFromLeft + x) * s, top: (1 - y) * s });
  return { s, width, height, otter, dolphin: dolphinBox, crab: crabBox, eyes, lap, floater, local, wave: { width: WAVE_BOX.width * s, height: WAVE_BOX.height * s } };
}
export type WaveLayout = ReturnType<typeof waveLayout>;
/** CSS transform-origin of the wave box: the growth anchor on its bottom edge. */
export const WAVE_ORIGIN = `${num(((WAVE_BOX.crestFromLeft + WAVE_ANCHOR.x) / WAVE_BOX.width) * 100)}% 100%`;

/** Wave-local point -> viewport px at a moment (includes the growth about the foot). */
export function waveToScreen(time: number, width: number, height: number, x: number, y: number) {
  const s = artUnit(width, height);
  const k = waveGrow(time);
  const anchorX = crestX(time, width, s) + WAVE_ANCHOR.x * s;
  return { x: anchorX + (x - WAVE_ANCHOR.x) * k * s, y: height + riseY(time) * s - y * k * s };
}

/** Top edge (px, viewport) of the otter's art box at a moment; used by the safe-zone tests. */
export const otterTopPx = (time: number, width: number, height: number) => otterBoxPx(time, width, height).top;

/**
 * Baked tracks play linearly between 60 Hz samples, so a jump in visibility would otherwise show one frame at
 * partial opacity (a see-through ghost). The sample before a cut holds its values until the next one instead.
 */
const cutEasing = (visible: (time: number) => boolean, time: number, frame: number): { easing?: string } =>
  (visible(time) !== visible(time + frame) ? { easing: 'step-end' } : {});

export function waveTracks(width: number, height: number, fps = 60): Record<WaveTrackName, (time: number) => WaveFrame> {
  const L = waveLayout(width, height);
  const { s } = L;
  const frame = 1 / fps;
  const otterShown = (time: number) => surfOtter(time).opacity > 0;
  const headShown = (time: number) => tunnelEyes(time).opacity > 0;
  const pose = (name: OtterPose) => (time: number): WaveFrame => ({ opacity: surfOtter(time).pose === name ? 1 : 0, easing: 'step-end' });
  return {
    lap: (time) => ({ transform: `translate(${px(lapFront(time, width, s) - LAP_WIDTH * s)}, ${px(height - LAP_HEIGHT * s)})`, opacity: lapVisible(time) ? 1 : 0 }),
    float: (time) => { const f = floatOtter(time); return { transform: `translateY(${px(f.bob * s)}) rotate(${deg(f.angle)})` }; },
    wave: (time) => ({ transform: `translate(${px(crestX(time, width, s) - WAVE_BOX.crestFromLeft * s)}, ${px(height - s + riseY(time) * s)}) scale(${num(waveGrow(time))})` }),
    lip: (time) => ({ transform: `rotate(${deg(lipAngle(time))})` }),
    backwash: (time) => ({ opacity: num(laceOpacity(time) * smooth(progress(time, 1.0, 1.3))) }),
    spray: (time) => ({ opacity: num(sprayOpacity(time)) }),
    crown: (time) => ({ opacity: num(crownOpacity(time)) }),
    otter: (time) => {
      const o = surfOtter(time);
      const at = L.local(o.x, o.y);
      return {
        transform: `translate(${px(at.left - L.otter.width * OTTER_SIZE.anchorX)}, ${px(at.top - L.otter.height * OTTER_SIZE.anchorY)}) rotate(${deg(o.angle)}) scale(${num(o.scale * otterScaleX(o))}, ${num(o.scale * o.squash)})`,
        opacity: num(o.opacity),
        ...cutEasing(otterShown, time, frame),
      };
    },
    // Darkness: a solid silhouette of the tube's deep teal laid over the otter as it zooms into the tunnel.
    otterShade: (time) => ({ opacity: num(otterShade(surfOtter(time))) }),
    boardSpray: (time) => ({ opacity: num(boardSpray(time)) }),
    'pose-ride': pose('ride'),
    'pose-five': pose('five'),
    'pose-tuck': pose('tuck'),
    'pose-cheer': pose('cheer'),
    'pose-lower': pose('lower'),
    'pose-reach': pose('reach'),
    'pose-crouch': pose('crouch'),
    // The cheering arms pump about their shoulders, mirrored (both open and close together).
    cheerNear: (time) => ({ transform: `rotate(${deg(cheerPump(time))})` }),
    cheerFar: (time) => ({ transform: `rotate(${deg(-cheerPump(time))})` }),
    dolphin: (time) => {
      const d = dolphin(time);
      const at = L.local(d.x, d.y);
      return {
        transform: `translate(${px(at.left - L.dolphin.width * DOLPHIN_SIZE.anchorX)}, ${px(at.top - L.dolphin.height * DOLPHIN_SIZE.anchorY)}) rotate(${deg(d.angle)})`,
        opacity: num(d.opacity),
        ...cutEasing((t) => dolphin(t).visible, time, frame),
      };
    },
    eyes: (time) => {
      const at = L.local(TUBE_EYE.x, TUBE_EYE.y);
      const head = tunnelEyes(time);
      return {
        transform: `translate(${px(at.left - L.eyes.width / 2)}, ${px(at.top - L.eyes.height / 2)}) scale(${num(head.scaleX)}, ${num(head.scaleY)})`,
        opacity: head.opacity,
        ...cutEasing(headShown, time, frame),
      };
    },
    blink: (time) => ({ transform: `scaleY(${num(tunnelEyes(time).blink)})` }),
    // Percent of the 65 x 50 head box.
    pupils: (time) => { const p = tunnelPupils(tunnelEyes(time).look); return { transform: `translate(${pct((p.x / 65) * 100)}, ${pct((p.y / 50) * 100)})` }; },
  };
}

export function crabTracks(width: number, height: number, plan: CrabPlan): Record<CrabTrackName, (time: number) => WaveFrame> {
  const L = waveLayout(width, height);
  const eyesOnly = plan.cap < 1;
  const stalk = (time: number) => ({ transform: `rotate(${deg(CRAB_STALK_DEG * crabLook(time))})` });
  // Percent of the 160-unit crab box.
  const pupil = (time: number) => ({ transform: `translateX(${pct(((crabLook(time) * CRAB_PUPIL_UNITS) / 160) * 100)})` });
  // Claws lift up beside the eyes (never across them) and pump on each click; an eyes-only peek keeps them down behind the wall.
  const claw = (time: number) => {
    const c = clawPose(time, eyesOnly);
    return { transform: `translateY(${pct(c.lift)}) rotate(${deg(c.turn)}) scale(${num(c.sx)}, ${num(c.sy)})` };
  };
  const pincer = (time: number) => ({ transform: `rotate(${deg(-30 * (1 - clawSnap(time)))})` });
  return {
    crab: (time) => {
      const c = crab(time, width, height, plan);
      const hiddenDrop = (1 - Math.min(1, c.rise)) * L.crab.height * 0.14;
      return { transform: `translate(${px(c.x - L.crab.width / 2)}, ${px(c.wall - L.crab.height * crabShows(c.rise, plan.cap, clawSnap(time)) + hiddenDrop)})`, opacity: c.visible ? 1 : 0 };
    },
    crabClawL: claw,
    crabClawR: claw,
    crabPincerL: pincer,
    crabPincerR: pincer,
    crabStalkL: stalk,
    crabStalkR: stalk,
    crabPupilL: pupil,
    crabPupilR: pupil,
  };
}

// ---------------------------------------------------------------------------
// Secondary effects as Web Animations with concrete pixel keyframes (no var()
// in keyframes, so they never trigger per-frame style work): looping spray,
// glints and face streaks, and the one-shot splash crowns.

export type FxFrame = { offset: number; transform: string; opacity: number };
export type Fx = { keyframes: FxFrame[]; timing: { duration: number; delay: number; iterations: number; easing: string } };

export const LOOP_COUNTS = { spray: 9, crown: 7, board: 6, glint: 4, streak: 2 } as const;
export type LoopKind = keyof typeof LOOP_COUNTS;
/** Sun glints: wave-local x, y, size (S) and phase (ms). */
export const GLINT_SPOTS = [[0.27, 0.29, 0.034, 0], [-0.1, 0.44, 0.026, 260], [0.07, 0.3, 0.022, 520], [-0.22, 0.22, 0.022, 140]] as const;
/**
 * Streaks sliding up the lit face (the water climbs the wave): each is STREAK_LENGTH S long, laid
 * along the face (STREAK_ANGLE, screen deg), its centre travelling `travel` S up from `from`
 * (wave-local S). Both ends stay inside the water the whole way, clear of the surface and the tube.
 */
export const STREAKS = [{ from: [0.335, 0.12], travel: 0.06 }, { from: [0.255, 0.27], travel: 0.055 }] as const;
export const STREAK_ANGLE = 52;
export const STREAK_LENGTH = 0.08;
/** Both ends of streak `index` when it has travelled `amount` (0..1) of its way (wave-local S, y up). */
export function streakEnds(index: number, amount: number): [[number, number], [number, number]] {
  const { from, travel } = STREAKS[index];
  const dx = Math.cos((STREAK_ANGLE * Math.PI) / 180);
  const dy = -Math.sin((STREAK_ANGLE * Math.PI) / 180);
  const cx = from[0] - dx * travel * amount;
  const cy = from[1] - dy * travel * amount;
  const h = STREAK_LENGTH / 2;
  return [[cx - dx * h, cy - dy * h], [cx + dx * h, cy + dy * h]];
}

const flight = (angle: number, distance: number, scale: number) => `rotate(${deg(angle)}) translateX(${px(distance)}) scale(${num(scale)})`;
/** A droplet thrown along `angle` (deg) for `travel` px: fades in by `appear`, shrinks to `end` scale. */
function throwFx(angle: number, travel: number, duration: number, delay: number, easing: string, appear: number, end: number): Fx {
  return {
    keyframes: [
      { offset: 0, transform: flight(angle, 0, 1), opacity: 0 },
      { offset: appear, transform: flight(angle, travel * appear, 1 + (end - 1) * appear), opacity: 1 },
      { offset: 1, transform: flight(angle, travel, end), opacity: 0 },
    ],
    timing: { duration, delay, iterations: Infinity, easing },
  };
}

export function loopFx(kind: LoopKind, index: number, s: number): Fx {
  switch (kind) {
    case 'spray': return throwFx(-172 + index * 9, s * (0.075 + index * 0.011), 620, -69 * index, 'linear', 0.12, 0.35);
    case 'crown': return throwFx(-150 + index * 15, s * (0.06 + index * 0.008), 700, -100 * index, 'cubic-bezier(.2, .6, .4, 1)', 0.15, 0.3);
    case 'board': return throwFx(-176 + index * 10, s * (0.05 + index * 0.007), 460, -77 * index, 'ease-out', 0.15, 0.3);
    case 'glint': {
      const at = (scale: number, turn: number) => `translate(-50%, -50%) scale(${num(scale)}) rotate(${deg(turn)})`;
      return {
        keyframes: [{ offset: 0, transform: at(0.2, 0), opacity: 0 }, { offset: 0.45, transform: at(1, 30), opacity: 1 }, { offset: 0.7, transform: at(0.64, 16.4), opacity: 0.2 }, { offset: 1, transform: at(0.2, 0), opacity: 0 }],
        timing: { duration: 1100, delay: GLINT_SPOTS[index % GLINT_SPOTS.length][3], iterations: Infinity, easing: 'ease-in-out' },
      };
    }
    case 'streak': {
      // The element is centred on `from` and laid along the face; it slides up the face along its own length.
      const travel = STREAKS[index % STREAKS.length].travel;
      const at = (offset: number) => `rotate(${STREAK_ANGLE}deg) translateX(${px(-s * travel * offset)})`;
      return {
        keyframes: [{ offset: 0, transform: at(0), opacity: 0 }, { offset: 0.25, transform: at(0.25), opacity: 0.85 }, { offset: 0.7, transform: at(0.7), opacity: 0.85 }, { offset: 1, transform: at(1), opacity: 0 }],
        timing: { duration: 520, delay: -260 * index, iterations: Infinity, easing: 'linear' },
      };
    }
  }
}

export type SplashSpec = { id: string; x: number; y: number; size: number; atMs: number; durationMs: number; spread: number; turn: number; kind: SplashKind; ring: boolean; front: boolean };
/** Every wave-local splash in Stage px (they travel inside the wave box). */
export function waveSplashes(width: number, height: number): SplashSpec[] {
  const L = waveLayout(width, height);
  return SPLASHES.map((splash, index) => {
    const at = L.local(splash.x, splash.y);
    return {
      id: `splash-${index}`, x: at.left, y: at.top, size: splash.size * L.s, atMs: Math.round(splash.at * 1000), durationMs: SPLASH_MS,
      spread: splash.spread, turn: splash.turn, kind: splash.kind, ring: splash.ring === true, front: splash.kind !== 'water',
    };
  });
}
/** Droplets of one splash: direction (deg), reach and fall (px), diameter (px). */
export function splashDrops(spec: Pick<SplashSpec, 'size' | 'spread' | 'turn' | 'kind'>) {
  if (spec.kind === 'spit') {
    // Two rings of crisp droplets: a tight inner ring of small ones and an outer ring of big ones thrown far.
    const perRing = SPIT_DROPS / 2;
    return Array.from({ length: SPIT_DROPS }, (_, index) => {
      const outer = index % 2 === 1;
      const k = Math.floor(index / 2);
      const angle = spec.turn - spec.spread / 2 + (spec.spread * (k + (outer ? 0.75 : 0.25))) / perRing;
      const reach = spec.size * (outer ? 0.62 + (k % 3) * 0.07 : 0.34 + (k % 2) * 0.06);
      const fall = spec.size * (outer ? 0.16 + (k % 2) * 0.05 : 0.07);
      return { angle, reach, fall, diameter: Math.max(3, spec.size * (outer ? 0.062 + (k % 3) * 0.01 : 0.036 + (k % 2) * 0.008)) };
    });
  }
  const count = spec.kind === 'star' ? 7 : 11;
  const full = spec.spread >= 360;
  return Array.from({ length: count }, (_, index) => {
    const angle = spec.turn - spec.spread / 2 + (spec.spread * (full ? index : index + 0.5)) / count;
    const reach = spec.size * (0.5 + ((index * 7) % 5) * 0.09);
    const fall = spec.size * (spec.kind === 'star' ? 0 : 0.12 + (index % 3) * 0.05);
    const drop = spec.kind === 'star' ? 0.1 + (index % 2) * 0.04 : spec.kind === 'spit' ? 0.055 + ((index * 3) % 4) * 0.012 : 0.05 + ((index * 3) % 4) * 0.014;
    return { angle, reach, fall, diameter: Math.max(3, spec.size * drop) };
  });
}
/** Droplets in each spit splash (two rings). */
export const SPIT_DROPS = 18;
/** Soft spray mist puffs (water splashes only: never over the dark tube or the high-five): offset x, y and diameter as fractions of the splash size. */
export const SPLASH_MIST = [[-0.12, 0.04, 0.55], [0.14, -0.02, 0.5], [0, -0.16, 0.45]] as const;
export const hasMist = (kind: SplashKind) => kind === 'water';

/** A droplet's (or sparkle's) scale at the very end of its flight: it shrinks away whole, never a pale fade. */
export const DROP_GONE_SCALE = 0.06;
export function splashDropFx(drop: ReturnType<typeof splashDrops>[number], spec: Pick<SplashSpec, 'atMs' | 'durationMs'>): Fx {
  // Out along the throw, then gravity pulls it down in screen space; it stretches in flight and rounds up as it falls.
  // It is solid from its first frame to its last and leaves by shrinking to nothing (crisp on a projector).
  const chain = (reach: number, fall: number, sx: number, sy: number) =>
    `rotate(${deg(drop.angle)}) translateX(${px(reach)}) rotate(${deg(-drop.angle)}) translateY(${px(fall)}) rotate(${deg(drop.angle)}) scale(${num(sx)}, ${num(sy)})`;
  return {
    keyframes: [
      { offset: 0, transform: chain(0, 0, 0.4, 0.4), opacity: 0 },
      { offset: 0.003, transform: chain(drop.reach * 0.004, 0, 0.41, 0.4), opacity: 1 },
      { offset: 0.1, transform: chain(drop.reach * 0.157, 0, 0.771, 0.5), opacity: 1 },
      { offset: 0.35, transform: chain(drop.reach * 0.55, 0, 1.7, 0.75), opacity: 1 },
      { offset: 0.7, transform: chain(drop.reach * 0.9, drop.fall * 0.35, 1, 1), opacity: 1 },
      { offset: 0.99, transform: chain(drop.reach, drop.fall, DROP_GONE_SCALE, DROP_GONE_SCALE), opacity: 1 },
      { offset: 1, transform: chain(drop.reach, drop.fall, DROP_GONE_SCALE, DROP_GONE_SCALE), opacity: 0 },
    ],
    timing: { duration: spec.durationMs, delay: spec.atMs, iterations: 1, easing: 'cubic-bezier(.2, .7, .4, 1)' },
  };
}
export function splashMistFx(spec: Pick<SplashSpec, 'atMs' | 'durationMs'>): Fx {
  return {
    keyframes: [{ offset: 0, transform: 'scale(0.3)', opacity: 0 }, { offset: 0.15, transform: 'scale(0.45)', opacity: 0.9 }, { offset: 1, transform: 'scale(1.3)', opacity: 0 }],
    timing: { duration: Math.round(spec.durationMs * 0.75), delay: spec.atMs, iterations: 1, easing: 'ease-out' },
  };
}
/** A quick ring flash: the tail-five contact, or the tube mouth at the spit. */
export function splashRingFx(spec: Pick<SplashSpec, 'atMs' | 'durationMs' | 'kind'>): Fx {
  if (spec.kind === 'spit') {
    // The POP's shock ring: snaps out crisp and solid, then is gone within a few frames (no pale ring left over the surfer).
    return {
      keyframes: [{ offset: 0, transform: 'scale(0.3)', opacity: 0 }, { offset: 0.03, transform: 'scale(0.36)', opacity: 1 }, { offset: 0.6, transform: 'scale(1.05)', opacity: 1 }, { offset: 1, transform: 'scale(1.3)', opacity: 0 }],
      timing: { duration: Math.round(spec.durationMs * 0.22), delay: spec.atMs, iterations: 1, easing: 'ease-out' },
    };
  }
  return {
    keyframes: [{ offset: 0, transform: 'scale(0.25)', opacity: 0 }, { offset: 0.12, transform: 'scale(0.4)', opacity: 1 }, { offset: 1, transform: 'scale(1.15)', opacity: 0 }],
    timing: { duration: Math.round(spec.durationMs * 0.45), delay: spec.atMs, iterations: 1, easing: 'ease-out' },
  };
}

/** The POP's flash filling the tube: full brightness on its very first frame, holds, then swells a touch and fades. */
export function tubeFlashFx(): Fx {
  return {
    keyframes: [
      { offset: 0, transform: 'scale(0.9)', opacity: 0 }, { offset: 0.005, transform: 'scale(0.92)', opacity: 1 }, { offset: 0.35, transform: 'scale(1)', opacity: 1 },
      { offset: 0.65, transform: 'scale(1.05)', opacity: 0.7 }, { offset: 1, transform: 'scale(1.1)', opacity: 0 },
    ],
    timing: { duration: TUBE_FLASH.ms, delay: Math.round(TUBE_FLASH.at * 1000), iterations: 1, easing: 'linear' },
  };
}

/** Every secondary effect keyed by the element name the Stage registers it under. */
export function waveFx(width: number, height: number): Record<string, Fx> {
  const { s } = waveLayout(width, height);
  const fx: Record<string, Fx> = { 'tube-flash': tubeFlashFx() };
  for (const kind of Object.keys(LOOP_COUNTS) as LoopKind[]) {
    for (let index = 0; index < LOOP_COUNTS[kind]; index++) fx[`loop-${kind}-${index}`] = loopFx(kind, index, s);
  }
  for (const spec of waveSplashes(width, height)) {
    splashDrops(spec).forEach((drop, index) => { fx[`${spec.id}-drop-${index}`] = splashDropFx(drop, spec); });
    if (hasMist(spec.kind)) SPLASH_MIST.forEach((_, index) => { fx[`${spec.id}-mist-${index}`] = splashMistFx(spec); });
    if (spec.ring) fx[`${spec.id}-ring`] = splashRingFx(spec);
  }
  return fx;
}

// ---------------------------------------------------------------------------
// The crab's bubble: an aqua ring that swells as it floats up, then pops into droplets.

export const CRAB_BUBBLE_DROPS = 7;
/** Bubble size (diameter, S), its rise while it swells (S) and the gap above the crab's top where it starts (S). */
export const CRAB_BUBBLE = { size: 0.06, rise: 0.045, gap: 0.03 } as const;
/**
 * The goodbye bubble starts just above the top of the crab (clear of its face) as the crab ducks,
 * floats up while it swells, then pops. Centre in viewport px.
 */
export function crabBubble(width: number, height: number, plan: CrabPlan) {
  const s = artUnit(width, height);
  const crabHeight = CRAB_SIZE.width * CRAB_SIZE.aspect * s;
  const top = crabWall(plan, height) - crabHeight * crabShows(plan.cap, plan.cap);
  return { x: plan.x + 0.008 * s, y: top - CRAB_BUBBLE.gap * s, size: CRAB_BUBBLE.size * s, rise: CRAB_BUBBLE.rise * s };
}
/** A click tick's pop (two of them, one per click), as one animation from just before the first click. */
function clickTickFx(): Fx {
  const [first, second] = CRAB_TIMES.clicks;
  const from = first + TICK_KEYS[0][0] / 1000;
  const span = second + TICK_KEYS[TICK_KEYS.length - 1][0] / 1000 - from;
  const o = (time: number) => (time - from) / span;
  const pop = (click: number): FxFrame[] => TICK_KEYS.map(([ms, scale, opacity]) => ({ offset: o(click + ms / 1000), transform: `scale(${scale})`, opacity }));
  const frames = [...pop(first), ...pop(second)];
  frames[0] = { ...frames[0], offset: 0 };
  frames[frames.length - 1] = { ...frames[frames.length - 1], offset: 1 };
  return { keyframes: frames, timing: { duration: Math.round(span * 1000), delay: Math.round(from * 1000), iterations: 1, easing: 'linear' } };
}
export function crabFx(width: number, height: number, plan: CrabPlan): Record<string, Fx> {
  // A hidden crab (nowhere to peek without covering a name) blows no bubble and clicks no ticks.
  if (plan.cap <= 0) return {};
  const bubble = crabBubble(width, height, plan);
  const swell = CRAB_BUBBLE_SWELL_MS / CRAB_BUBBLE_MS;
  const at = (rise: number, scale: number, sx = 1) => `translateY(${px(-bubble.rise * rise)}) scale(${num(scale * sx)}, ${num(scale / sx)})`;
  const fx: Record<string, Fx> = {
    'crab-tick-L': clickTickFx(),
    'crab-tick-R': clickTickFx(),
    'crab-bubble': {
      keyframes: [
        { offset: 0, transform: at(0, 0.2), opacity: 0 },
        { offset: 0.005, transform: at(0.01, 0.21), opacity: 1 },
        { offset: 0.12, transform: at(0.15, 0.45, 1.08), opacity: 1 },
        { offset: swell * 0.55, transform: at(0.6, 0.82, 0.95), opacity: 1 },
        { offset: swell, transform: at(1, 1, 1.04), opacity: 1 },
        { offset: swell + 0.08, transform: at(1.02, 1.35), opacity: 0 },
        { offset: 1, transform: at(1.02, 1.35), opacity: 0 },
      ],
      timing: { duration: CRAB_BUBBLE_MS, delay: CRAB_BUBBLE_AT * 1000, iterations: 1, easing: 'linear' },
    },
  };
  for (let index = 0; index < CRAB_BUBBLE_DROPS; index++) {
    const angle = -175 + (index * 170) / (CRAB_BUBBLE_DROPS - 1);
    const reach = bubble.size * (0.85 + (index % 2) * 0.3);
    const fly = (distance: number, scale: number) => `translateY(${px(-bubble.rise)}) rotate(${deg(angle)}) translateX(${px(distance)}) scale(${num(scale)})`;
    // Solid droplets fly out and shrink away whole (no pale ghosts left hanging over the page).
    fx[`crab-drop-${index}`] = {
      keyframes: [
        { offset: 0, transform: fly(bubble.size * 0.4, 0.6), opacity: 0 },
        { offset: 0.01, transform: fly(bubble.size * 0.41, 0.65), opacity: 1 },
        { offset: 0.15, transform: fly(bubble.size * 0.5, 1), opacity: 1 },
        { offset: 0.6, transform: fly(reach * 0.88, 0.8), opacity: 1 },
        { offset: 0.99, transform: fly(reach, DROP_GONE_SCALE), opacity: 1 },
        { offset: 1, transform: fly(reach, DROP_GONE_SCALE), opacity: 0 },
      ],
      timing: { duration: CRAB_BUBBLE_MS - CRAB_BUBBLE_SWELL_MS, delay: CRAB_BUBBLE_AT * 1000 + CRAB_BUBBLE_SWELL_MS, iterations: 1, easing: 'ease-out' },
    };
  }
  return fx;
}
