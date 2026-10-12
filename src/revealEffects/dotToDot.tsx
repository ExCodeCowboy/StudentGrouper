import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { clamp01, easeInCubic, easeOutBack, easeOutCubic, mix, progress, smooth } from './sceneMotion';
import {
  COVER_EXITS, DOT_BEATS, DRAW_ANGLE, GARDEN_DRAIN, HIT_PULSE, HIT_PULSE_MIN, DOT_TO_DOT_DURATION_MS, ROCKET_HILL_DRAIN, WHALE_SEA_DRAIN, aimFor, buildDotPlan, butterflyAlive,
  chunkDots, drainAway, floodRadius, insidePolygon, pencilAt, pencilExit, pictureIndexForPlay, popAway, rocketAlive, samplePath, sceneryExit, snapPop, trackStart, trainAlive, whaleAlive,
  type Dot, type DotPlan, type Pose, type Pt, type Puff,
} from './dotToDotTimeline';
import {
  BUTTERFLY_ANTENNAE, BUTTERFLY_BODY, BUTTERFLY_CLOUD, BUTTERFLY_GRASS, BUTTERFLY_LEAF, BUTTERFLY_LOWER_SPOTS, BUTTERFLY_ORIGIN, BUTTERFLY_OUTLINE, BUTTERFLY_SCALE, BUTTERFLY_SPOTS,
  BUTTERFLY_SUN, BUTTERFLY_TULIP, DOT_PICTURES, PAGE_HEIGHT, PAGE_WIDTH, ROCKET_DRIFTS, ROCKET_GROUND, ROCKET_HATCH, ROCKET_MOON, ROCKET_OUTLINE, ROCKET_PORTHOLE, ROCKET_STAR,
  ROCKET_STARS_LEFT, ROCKET_STARS_RIGHT, ROCKET_TREE, ROCKET_TREE_SMALL, TRAIN_BIRD, TRAIN_KITE, TRAIN_OUTLINE, TRAIN_PINE, TRAIN_SUN, TRAIN_TREE_CROWN, TRAIN_WHEELS, TRAIN_WINDOW,
  WHALE_CLOUD, WHALE_CREST, WHALE_FLIPPER, WHALE_GULL, WHALE_GULL_FAR, WHALE_LIGHTHOUSE, WHALE_MOUTH, WHALE_OUTLINE, WHALE_STRIPES, WHALE_SUN, WHALE_SWELL, WHALE_WATERLINE,
  crescentPath, joinPaths, starPath, wavePath, type PictureId,
} from './dotToDotPictures';
import { DOT_LABELS } from './dotToDotLabels';
import { useSceneTime } from './useSceneTime';
import type { RevealEffect } from './types';
import './dotToDot.css';

const INK = '#2f3150';
const TOMATO = '#ef5b3c';
const GOLD = '#f7b92f';
/** The finished picture starts moving (alive poses) this long after the snap; the pencil line has gone by then. */
const ALIVE_AT = DOT_BEATS.snap + .3;
const afterSnap = (seconds: number) => DOT_BEATS.snap + seconds;
/**
 * When each part of the (hidden) painted picture is mounted: one part at a time during the
 * calm chant, so no single frame builds the whole picture, and the snap never waits on it.
 */
const ART_MOUNT = { back: 1.1, character: 1.45, front: 1.8 } as const;
const toRad = (degrees: number) => degrees * Math.PI / 180;

const plans = new Map<PictureId, DotPlan>();
function planFor(index: number): DotPlan {
  const spec = DOT_PICTURES[index];
  let plan = plans.get(spec.id);
  if (!plan) { plan = buildDotPlan(spec, DOT_LABELS[spec.id]); plans.set(spec.id, plan); }
  return plan;
}
/**
 * Build the pages while the app is idle, one per idle moment, so no reveal waits for one: never
 * while a reveal is on screen (it would steal its frames), resuming after it ends.
 */
let scenesShowing = 0;
function warmPlans() {
  if (typeof window === 'undefined') return;
  const idle = (window as Window & { requestIdleCallback?: (callback: () => void) => number }).requestIdleCallback;
  const later = (callback: () => void) => { if (idle) idle.call(window, callback); else window.setTimeout(callback, 400); };
  later(function step() {
    if (scenesShowing > 0) return;
    const next = DOT_PICTURES.findIndex((spec) => !plans.has(spec.id));
    if (next < 0) return;
    const plan = planFor(next);
    piecesFor(plan); aimFor(plan);
    later(step);
  });
}
const pointsAttr = new WeakMap<DotPlan, string[]>();
function segmentPoints(plan: DotPlan) {
  let attr = pointsAttr.get(plan);
  if (!attr) { attr = plan.segments.map((s) => [...s.points, ...(s.closed ? [s.points[0]] : [])].map((p) => `${p.x},${p.y}`).join(' ')); pointsAttr.set(plan, attr); }
  return attr;
}
const poseTransform = ({ x, y, rotate, sx, sy, ox, oy }: Pose) => `translate(${x + ox} ${y + oy}) rotate(${rotate}) scale(${sx} ${sy}) translate(${-ox} ${-oy})`;
const REST: Pose = { x: 0, y: 0, rotate: 0, sx: 1, sy: 1, ox: 500, oy: 310 };
const sparkle = (r: number) => `M0 ${-r}Q${r * .18} ${-r * .18} ${r} 0Q${r * .18} ${r * .18} 0 ${r}Q${-r * .18} ${r * .18} ${-r} 0Q${-r * .18} ${-r * .18} 0 ${-r}Z`;
const ms = (seconds: number) => `${Math.round(seconds * 1000)}ms`;
/** The corners of a polyline path ("M x y L x y ..."). */
const corners = (d: string): Pt[] => Array.from(d.matchAll(/(-?\d*\.?\d+) (-?\d*\.?\d+)/g), (m) => ({ x: Number(m[1]), y: Number(m[2]) }));
const scaleAbout = (x: number, y: number, k: number) => `translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})`;

// ------------------------------------------------------------------ the numbered page

/**
 * The page in a few cheap pieces. Printed numbers come in runs that grey out together once the
 * pencil has passed (a class change on a run, not an animation per number). The hidden outline
 * dots sprout in runs of 6, each run added to the page only as its first dot shows.
 */
type PagePieces = {
  printed: Dot[][]; printedDoneAt: number[];
  ahead: Dot[][]; aheadAt: number[]; aheadDoneAt: number[];
  starts: ReadonlySet<number>;
};
const pieces = new WeakMap<DotPlan, PagePieces>();
function piecesFor(plan: DotPlan): PagePieces {
  let page = pieces.get(plan);
  if (!page) {
    const printed = chunkDots(plan.dots, (dot) => !dot.ahead, 10, .12);
    const ahead = chunkDots(plan.dots, (dot) => dot.ahead, 6);
    page = {
      printed, printedDoneAt: printed.map((run) => run[run.length - 1].hit),
      ahead, aheadAt: ahead.map((run) => run[0].appear), aheadDoneAt: ahead.map((run) => run[run.length - 1].hit),
      starts: new Set(plan.segments.map((segment) => segment.first)),
    };
    pieces.set(plan, page);
  }
  return page;
}
/** How many leading entries of an ascending list are at or before `time`. */
function countUpTo(times: readonly number[], time: number) {
  let n = 0;
  while (n < times.length && times[n] <= time) n++;
  return n;
}

/**
 * A run of printed dots: each dot pops and its number fades in at --appear (CSS, from mount; the
 * number is never scaled, which would re-lay its text out every frame); the run greys once reached.
 */
const PrintedRun = memo(function PrintedRun({ dots, done }: { dots: readonly Dot[]; done: boolean }) {
  return <g className={done ? 'is-done' : undefined}>{dots.map((dot) => <g key={dot.index} className="dtd-pop" style={{ '--appear': ms(dot.appear) } as CSSProperties}>
    <circle className="dtd-core dtd-pop-core" cx={dot.x} cy={dot.y} r="3.8" />
    <text x={dot.labelX} y={dot.labelY}>{dot.label}</text>
  </g>)}</g>;
});

const PrintedStars = memo(function PrintedStars({ plan }: { plan: DotPlan }) {
  return <>{plan.segments.map((segment, s) => {
    const dot = plan.dots[segment.first];
    return !dot.ahead && <path key={s} className="dtd-start dtd-pop-star" d={starPath(dot.x, dot.y, 12)} style={{ '--appear': ms(dot.appear) } as CSSProperties} />;
  })}</>;
});

/** The printed page never re-renders except when a run of numbers greys out (a few dozen times per play). */
const PrintedPage = memo(function PrintedPage({ plan, done }: { plan: DotPlan; done: number }) {
  const { printed } = piecesFor(plan);
  return <g className="dtd-dots"><PrintedStars plan={plan} />{printed.map((run, i) => <PrintedRun key={i} dots={run} done={i < done} />)}</g>;
});

/**
 * Scene-anchored Web Animations: timed from the stage's mount (like the page's CSS animations, so
 * a reveal-lab frame seeks them exactly), but only created when their element mounts, just before
 * they play. Nothing waits on the page for seconds, and nothing is re-rendered per frame for them.
 */
type Timed = { el: Element | null; keyframes: Keyframe[]; delay: number; duration: number };
function playAnchored(items: readonly Timed[], mountedAt: number) {
  const now = typeof document === 'undefined' ? null : document.timeline?.currentTime;
  const anchor = typeof now === 'number' ? now - mountedAt * 1000 : null;
  const playing: Animation[] = [];
  for (const { el, keyframes, delay, duration } of items) {
    if (!el || typeof el.animate !== 'function') continue;
    const animation = el.animate(keyframes, { delay: delay * 1000, duration: duration * 1000, fill: 'backwards' });
    if (anchor !== null) animation.startTime = anchor;
    playing.push(animation);
  }
  return () => playing.forEach((animation) => animation.cancel());
}
const BOUNCY = 'cubic-bezier(.3, 1.5, .55, 1)';
const FADE_IN: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
/** The sprouting dot: pops to 1.9x and settles. Its tomato ring flashes out. The start star pops like the printed ones. */
const SPROUT_POP: Keyframe[] = [{ opacity: 0, transform: 'scale(0)', easing: BOUNCY }, { opacity: 1, transform: 'scale(1.9)', offset: .55, easing: BOUNCY }, { opacity: 1, transform: 'scale(1)' }];
const SPROUT_RING: Keyframe[] = [{ opacity: 0, transform: 'scale(.4)', easing: 'ease-out' }, { opacity: 1, offset: .25, easing: 'ease-out' }, { opacity: 0, transform: 'scale(2.4)' }];
const STAR_POP: Keyframe[] = [{ opacity: 0, transform: 'scale(0)', easing: BOUNCY }, { opacity: 1, transform: 'scale(1.6)', offset: .6, easing: BOUNCY }, { opacity: 1, transform: 'scale(1)' }];
/** A racing blip: the reached dot swells tomato, turns ink and shrinks back as it fades. */
const BLIP: Keyframe[] = [
  { transform: 'scale(1)', fill: TOMATO, opacity: 1, easing: 'cubic-bezier(.33, 1, .68, 1)' },
  { transform: 'scale(2.5)', offset: .3, easing: 'ease-in-out' },
  { fill: TOMATO, offset: .349 }, { fill: INK, offset: .35 },
  { opacity: 1, offset: .45, easing: 'ease-in-out' },
  { transform: 'scale(1.35)', fill: INK, opacity: 0 },
];

/** A run of hidden outline dots, added as its first dot shows: each number fades in, its dot pops, a tomato ring flashes. */
const SproutRun = memo(function SproutRun({ dots, starts, done, time }: { dots: readonly Dot[]; starts: ReadonlySet<number>; done: boolean; time: number }) {
  const [mountedAt] = useState(time);
  const box = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    const group = box.current;
    if (!group) return;
    const items: Timed[] = [];
    dots.forEach((dot, i) => {
      const item = group.children[i];
      if (!item) return;
      items.push({ el: item, keyframes: FADE_IN, delay: dot.appear, duration: .16 });
      items.push({ el: item.querySelector('.dtd-sprout'), keyframes: SPROUT_RING, delay: dot.appear, duration: .42 });
      items.push({ el: item.querySelector('.dtd-core'), keyframes: SPROUT_POP, delay: dot.appear, duration: .28 });
      items.push({ el: item.querySelector('.dtd-start'), keyframes: STAR_POP, delay: dot.appear, duration: .3 });
    });
    return playAnchored(items, mountedAt);
  }, [dots, mountedAt]);
  return <g ref={box} className={done ? 'is-done' : undefined}>{dots.map((dot) => <g key={dot.index}>
    {starts.has(dot.index) && <path className="dtd-start dtd-grow" d={starPath(dot.x, dot.y, 12)} />}
    <circle className="dtd-sprout dtd-grow" cx={dot.x} cy={dot.y} r="9" />
    <circle className="dtd-core dtd-grow" cx={dot.x} cy={dot.y} r="3.8" />
    <text x={dot.labelX} y={dot.labelY}>{dot.label}</text>
  </g>)}</g>;
}, (a, b) => a.dots === b.dots && a.done === b.done && a.starts === b.starts);

/** The hidden dots: nothing until the pencil comes near; each run joins the page as its first dot sprouts. */
function Sprouts({ plan, sprouted, done, time }: { plan: DotPlan; sprouted: number; done: number; time: number }) {
  const { ahead, starts } = piecesFor(plan);
  return <g className="dtd-dots">{ahead.slice(0, sprouted).map((run, i) => <SproutRun key={i} dots={run} starts={starts} done={i < done} time={time} />)}</g>;
}

const PAGE_BOX = `0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`;
/**
 * The numbered page: printed dots (static, CSS pop-in) and the outline's dots sprouting ahead of
 * the pencil. Re-rendered only when a run of numbers greys out or a run of dots sprouts.
 */
const DotsPage = memo(function DotsPage({ plan, done, sprouted, sproutsDone, fade, time }: { plan: DotPlan; done: number; sprouted: number; sproutsDone: number; fade: number; time: number }) {
  return <svg className="dtd-page dtd-layer" viewBox={PAGE_BOX} preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ opacity: fade, display: fade <= 0 ? 'none' : undefined }}>
    <PrintedPage plan={plan} done={done} />
    <Sprouts plan={plan} sprouted={sprouted} done={sproutsDone} time={time} />
  </svg>;
}, (a, b) => a.plan === b.plan && a.done === b.done && a.sprouted === b.sprouted && a.sproutsDone === b.sproutsDone && a.fade === b.fade);

/** A racing blip (scene-anchored, so it costs nothing per frame). */
const Blip = memo(function Blip({ dot, time }: { dot: Dot; time: number }) {
  const [mountedAt] = useState(time);
  const circle = useRef<SVGCircleElement>(null);
  useLayoutEffect(() => playAnchored([{ el: circle.current, keyframes: BLIP, delay: dot.hit, duration: dot.pulse }], mountedAt), [dot, mountedAt]);
  return <circle ref={circle} className="dtd-blip dtd-grow" cx={dot.x} cy={dot.y} r="3.8" />;
}, (a, b) => a.dot === b.dot);

/** A dot reached while the class reads along (the chant, the suspense): it swells tomato-red and its number jumps. */
function ReadPulse({ dot, time }: { dot: Dot; time: number }) {
  const p = (time - dot.hit) / dot.pulse;
  const jump = mix(1.3, 1.9, clamp01((dot.pulse - HIT_PULSE_MIN) / (HIT_PULSE - HIT_PULSE_MIN)));
  const r = 3.8 * (p < .3 ? mix(1, 2.5, easeOutCubic(p / .3)) : mix(2.5, 1.35, smooth((p - .3) / .7)));
  const scale = p < .22 ? mix(1, jump, easeOutCubic(p / .22)) : mix(jump, 1, smooth((p - .22) / .78));
  return <g opacity={1 - smooth(progress(p, .45, 1))}>
    <circle cx={dot.x} cy={dot.y} r={r} fill={p < .35 ? TOMATO : INK} />
    <text x={dot.labelX} y={dot.labelY} transform={scaleAbout(dot.labelX, dot.labelY, scale)}>{dot.label}</text>
  </g>;
}

/** The dot being reached swells: a read-along pulse with its number while slow, a plain blip while racing (the big number carries the count, and red numbers would pile up). */
function HitPulses({ plan, time }: { plan: DotPlan; time: number }) {
  const live = plan.dots.filter((dot) => time >= dot.hit && time < dot.hit + dot.pulse);
  return <g className="dtd-pulses">{live.map((dot) => dot.pulse >= .2 ? <ReadPulse key={dot.index} dot={dot} time={time} /> : <Blip key={dot.index} dot={dot} time={time} />)}</g>;
}

/** Strokes already finished: redrawn only when another one finishes. */
const DrawnLines = memo(function DrawnLines({ plan, count }: { plan: DotPlan; count: number }) {
  const attr = segmentPoints(plan);
  return <g>{attr.slice(0, count).map((points, s) => <polyline key={s} points={points} />)}</g>;
});
function PencilLines({ plan, drawn, glow }: { plan: DotPlan; drawn: number[]; glow: number }) {
  const attr = segmentPoints(plan);
  let finished = 0;
  while (finished < drawn.length && drawn[finished] >= plan.segments[finished].total - .01) finished++;
  const active = finished < drawn.length && drawn[finished] > 0 ? finished : -1;
  const total = active >= 0 ? plan.segments[active].total : 0;
  return <g className="dtd-lines">
    <g>{glow > .02 && active >= 0 && <polyline className="dtd-trail" points={attr[active]} opacity={glow}
      strokeDasharray={`${Math.min(170, drawn[active])} ${total * 3}`} strokeDashoffset={-Math.max(0, drawn[active] - 170)} />}</g>
    <DrawnLines plan={plan} count={finished} />
    <g>{active >= 0 && <polyline points={attr[active]} strokeDasharray={`${total + 2} ${total + 2}`} strokeDashoffset={total - drawn[active]} />}</g>
  </g>;
}

// ------------------------------------------------------------------ the pencil and the big number (HTML, moved by transforms only)

/** Page units to screen pixels inside the page box: the same "meet" fit as the page SVGs' viewBox. */
type Frame = { s: number; ox: number; oy: number };
function useFrame(ref: RefObject<HTMLDivElement | null>) {
  const [frame, setFrame] = useState<Frame | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const box = ref.current?.getBoundingClientRect();
      if (!box || box.width <= 0 || box.height <= 0) return;
      const s = Math.min(box.width / PAGE_WIDTH, box.height / PAGE_HEIGHT);
      const next = { s, ox: (box.width - PAGE_WIDTH * s) / 2, oy: (box.height - PAGE_HEIGHT * s) / 2 };
      setFrame((old) => old && Math.abs(old.s - next.s) < 1e-4 && Math.abs(old.ox - next.ox) < .25 && Math.abs(old.oy - next.oy) < .25 ? old : next);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [ref]);
  return frame;
}
const px = (value: number) => `${Math.round(value * 10) / 10}px`;

const PENCIL_OUTLINE = 'M0 0L40 -13H206Q214 -13 214 -5V5Q214 13 206 13H40Z';
const PencilArt = memo(function PencilArt() {
  return <g strokeLinejoin="round">
    <path d="M40 -13H172V13H40Z" fill="#ffc933" />
    <path d="M40 -13H172V-4.5H40Z" fill="#ffe27f" />
    <path d="M40 4.5H172V13H40Z" fill="#e9a114" />
    <path d="M58 -8.8H150" stroke="#fff3c4" strokeWidth="2.4" strokeLinecap="round" opacity=".8" />
    <path d="M172 -13H195V13H172Z" fill="#c9ced6" />
    <path d="M178 -13V13M184 -13V13M190 -13V13" stroke="#8e97a3" strokeWidth="2" />
    <path d="M195 -13H206Q214 -13 214 -5V5Q214 13 206 13H195Z" fill="#f48aa1" />
    <path d="M198 -9H207" stroke="#ffc2cf" strokeWidth="3" strokeLinecap="round" />
    <path d="M0 0L40 -13Q35 -8.7 40 -4.3Q35 0 40 4.3Q35 8.7 40 13Z" fill="#f4d19f" />
    <path d="M0 0L13 -4.2Q11 0 13 4.2Z" fill="#3b3d55" />
    <path d={PENCIL_OUTLINE} fill="none" stroke="#3a2f3f" strokeWidth="3" />
  </g>;
});

/** Sprites are drawn a little larger than they show, so the pops scale them down, never up (crisp). */
const PENCIL_RES = 1.12;
const CALLOUT_RES = 1.6;
/** A small SVG whose (0, 0) sits on its box's origin, drawn at `k` pixels per page unit. */
function Sprite({ k, box: [x, y, w, h], children }: { k: number; box: readonly [number, number, number, number]; children: ReactNode }) {
  return <svg className="dtd-sprite" viewBox={`${x} ${y} ${w} ${h}`} width={w * k} height={h * k} style={{ left: x * k, top: y * k }} aria-hidden="true">{children}</svg>;
}
const PENCIL_BOX = [-4, -17, 222, 34] as const;
const PencilSprite = memo(function PencilSprite({ k }: { k: number }) { return <Sprite k={k} box={PENCIL_BOX}><PencilArt /></Sprite>; });
const ShadowSprite = memo(function ShadowSprite({ k }: { k: number }) { return <Sprite k={k} box={PENCIL_BOX}><path d={PENCIL_OUTLINE} fill={INK} /></Sprite>; });
const CalloutSprite = memo(function CalloutSprite({ k, label }: { k: number; label: number }) { return <Sprite k={k} box={[-125, -50, 250, 100]}><text className="dtd-callout">{label}</text></Sprite>; });

/** `roll` mirrors the pencil across its length (1 = normal, -1 = rolled over), so it can point left with its shine on top. */
function Pencil({ frame, x, y, lift, angle, press, spin, roll }: { frame: Frame; x: number; y: number; lift: number; angle: number; press: number; spin: number; roll: number }) {
  const { s, ox, oy } = frame;
  const grow = (1 + lift * .08) / PENCIL_RES;
  const shadow = .12 * (1 - Math.min(1, lift) * .85);
  return <>
    <div className="dtd-sprite-box" style={{ transform: `translate(${px(ox + (x + 10 + lift * 30) * s)}, ${px(oy + (y + 12 + lift * 26) * s)}) rotate(${angle - 4 + spin}deg) scale(${1 / PENCIL_RES}, ${roll / PENCIL_RES})`, opacity: shadow }}><ShadowSprite k={s * PENCIL_RES} /></div>
    <div className="dtd-sprite-box" style={{ transform: `translate(${px(ox + x * s)}, ${px(oy + (y - lift * 46) * s)}) rotate(${angle + spin}deg) scale(${press * grow}, ${roll * grow})` }}><PencilSprite k={s * PENCIL_RES} /></div>
  </>;
}

// ------------------------------------------------------------------ shared scenery

type Drawing = {
  pose: Pose;
  /** Scenery behind the picture (not posed). */
  back?: ReactNode;
  /** Posed with the picture, behind it (spout, flame), and the picture itself. */
  behind?: ReactNode; character: ReactNode;
  /** Not posed, in front of everything (steam, the sea the whale dives into). */
  front?: ReactNode;
};

/**
 * A piece of scenery that pops away (a little swell, then it shrinks to nothing) about (x, y) as
 * the sheets under it leave: never a see-through ghost. `q` is its exit progress.
 */
function Pop({ q, x, y, children }: { q: number; x: number; y: number; children: ReactNode }) {
  const k = popAway(q);
  if (k <= .005) return null;
  return <g transform={k === 1 ? undefined : scaleAbout(x, y, k)}>{children}</g>;
}
/** A ground band (sea, lawn, snowy hill, rails) drains down out of the frame. */
function Drain({ q, depth, children }: { q: number; depth: number; children: ReactNode }) {
  if (q >= 1) return null;
  const y = drainAway(q, depth);
  return <g transform={y ? `translate(0 ${y})` : undefined}>{children}</g>;
}

function Eye({ x, y, open, look = 0, r = 15 }: { x: number; y: number; open: number; look?: number; r?: number }) {
  if (open < .02) return null;
  return <g transform={`translate(${x} ${y}) scale(1 ${Math.max(.06, open)})`}>
    <ellipse rx={r} ry={r * 1.12} fill="#fff" stroke={INK} strokeWidth="3.5" />
    <circle cx={r * .18} cy={r * .12 - look * r * .3} r={r * .6} fill={INK} />
    <circle cx={-r * .08} cy={-r * .28 - look * r * .3} r={r * .22} fill="#fff" />
  </g>;
}

const Sun = memo(function Sun({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = toRad(i * 36 + 18);
    return `M${cx + Math.cos(a) * (r + 9)} ${cy + Math.sin(a) * (r + 9)}L${cx + Math.cos(a) * (r + 20)} ${cy + Math.sin(a) * (r + 20)}`;
  }).join('');
  return <g strokeLinecap="round">
    <path d={rays} stroke="#f7b92f" strokeWidth="7" />
    <circle cx={cx} cy={cy} r={r} fill="#ffd166" stroke={INK} strokeWidth="5.5" />
    <circle cx={cx + r * .18} cy={cy + r * .2} r={r * .62} fill="#ffe08a" />
    <circle cx={cx - r * .34} cy={cy - r * .34} r={r * .2} fill="#fff4c8" />
  </g>;
});

const SkyCloud = memo(function SkyCloud({ d }: { d: string }) {
  return <g strokeLinejoin="round"><path d={d} fill="#fff" stroke={INK} strokeWidth="5.5" /><path d={d} fill="#e6eef8" transform="translate(0 10) scale(1 .6)" style={{ transformOrigin: 'center', transformBox: 'fill-box' }} opacity=".5" /></g>;
});

/** A gull (or the train's bird): flaps off (dx, dy), right out of the picture, when startled. */
function Gull({ d, fly, dx, dy }: { d: string; fly: number; dx: number; dy: number }) {
  if (fly >= 1) return null;
  const points = corners(d);
  const cx = (points[0].x + points[points.length - 1].x) / 2; const cy = Math.min(...points.map((p) => p.y));
  const flap = fly > 0 ? 1 - .55 * Math.abs(Math.sin(fly * 22)) : 1;
  return <g transform={`translate(${fly * dx} ${fly * dy}) translate(${cx} ${cy}) scale(1 ${flap}) translate(${-cx} ${-cy})`}>
    <path d={d} fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
  </g>;
}

// Whale -------------------------------------------------------------

const WhaleBody = memo(function WhaleBody({ id }: { id: string }) {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <defs><clipPath id={`${id}-whale`}><path d={WHALE_OUTLINE} /></clipPath></defs>
    <path d={WHALE_OUTLINE} fill="#4d9de6" />
    <g clipPath={`url(#${id}-whale)`}>
      <path d="M700 60H1010V330C940 300 880 270 800 250Z" fill="#3f8bd6" />
      <path d="M86 370C170 452 330 470 470 470C620 470 760 424 890 292L910 650H80Z" fill="#d4ecfc" />
      <ellipse cx="380" cy="214" rx="120" ry="24" transform="rotate(-5 380 214)" fill="#fff" opacity=".32" />
      <circle cx="600" cy="250" r="9" fill="#3f8bd6" /><circle cx="640" cy="276" r="6" fill="#3f8bd6" /><circle cx="572" cy="228" r="5" fill="#3f8bd6" />
    </g>
    <path d={WHALE_STRIPES} fill="none" stroke="#a9d3f1" strokeWidth="12" />
    <path d={WHALE_STRIPES} fill="none" stroke={INK} strokeWidth="4.5" />
    <path d={WHALE_FLIPPER} fill="#3a82cc" stroke={INK} strokeWidth="6" />
    <path d={WHALE_OUTLINE} fill="none" stroke={INK} strokeWidth="6.5" />
    <path d={WHALE_MOUTH} fill="none" stroke={INK} strokeWidth="6" />
  </g>;
});

const LIGHTHOUSE_SHAPE = `${WHALE_LIGHTHOUSE}Z`;
const WAVE_CURL = `M2 ${WHALE_WATERLINE + 2}C14 500 26 474 50 464C66 458 82 462 86 474C74 468 62 474 61 485C60 497 74 507 98 ${WHALE_WATERLINE + 2}Z`;
/** The sea the finished whale floats in (in front of its belly), with the swell, a breaking wave and the lighthouse. */
const Sea = memo(function Sea({ id }: { id: string }) {
  const surface = wavePath(-700, 1700, WHALE_WATERLINE, 3.5, 30);
  return <g strokeLinejoin="round" strokeLinecap="round">
    <defs><clipPath id={`${id}-lighthouse`}><path d={LIGHTHOUSE_SHAPE} /></clipPath></defs>
    <path d={`${surface}V1500H-700Z`} fill="#bfe6fa" />
    <path d={`M-700 ${WHALE_WATERLINE + 20}H1700`} stroke="#d8f1fd" strokeWidth="16" />
    <path d={joinPaths(WHALE_SWELL, WHALE_CREST)} fill="none" stroke="#86c9ee" strokeWidth="6" />
    <path d="M200 548H310M430 556H540M650 546H760M150 606H260M560 612H690" stroke="#fff" strokeWidth="4" opacity=".75" />
    <path d={surface} fill="none" stroke={INK} strokeWidth="5.5" />
    {/* a wave curling over at the left edge, throwing spray */}
    <path d={WAVE_CURL} fill="#9fd8f5" stroke={INK} strokeWidth="5" />
    <path d="M22 490C30 478 40 470 54 466C66 463 76 466 80 471" fill="none" stroke="#fff" strokeWidth="5" />
    {[{ x: 96, y: 460, r: 6 }, { x: 106, y: 476, r: 4.5 }, { x: 86, y: 448, r: 4 }].map(({ x, y, r }) => <circle key={x} cx={x} cy={y} r={r} fill="#fff" stroke={INK} strokeWidth="2.5" />)}
    {/* the lighthouse on its rock */}
    <path d={LIGHTHOUSE_SHAPE} fill="#fdf8ef" />
    <g clipPath={`url(#${id}-lighthouse)`}>
      <path d="M880 330H1000V386H880ZM880 426H1000V458H880ZM880 490H1000V522H880Z" fill="#e8474c" />
      <path d="M906 390H954V414H906Z" fill="#ffd166" />
      <path d="M936 330H1000V548H936Z" fill="#000" opacity=".08" />
      <path d="M850 546H1000V600H850Z" fill="#8a8a9a" />
      <path d="M850 546H1000V556H850Z" fill="#6f7182" />
    </g>
    <path d="M908 390H952M908 414H952M930 390V414M904 548H958" fill="none" stroke={INK} strokeWidth="4" />
    <path d={LIGHTHOUSE_SHAPE} fill="none" stroke={INK} strokeWidth="5.5" />
    <path d={`M876 ${WHALE_WATERLINE + 2}Q888 ${WHALE_WATERLINE - 6} 900 ${WHALE_WATERLINE + 2}M960 ${WHALE_WATERLINE + 2}Q972 ${WHALE_WATERLINE - 6} 984 ${WHALE_WATERLINE + 2}`} fill="none" stroke="#fff" strokeWidth="5" />
  </g>;
});

function Spout({ height, spray }: { height: number; spray: number }) {
  if (height <= .01 && (spray <= 0 || spray >= 1)) return null;
  const h = 150 * height;
  const drops = Array.from({ length: 10 }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const p = clamp01((spray - (i % 5) * .05) / .75);
    const vx = side * (60 + (i % 5) * 34);
    return { x: 290 + vx * p, y: 176 - 160 + (i % 3) * 14 - 140 * p + 440 * p * p, r: 9 - (i % 3) * 2, o: p > 0 && p < 1 ? 1 - p ** 3 : 0 };
  });
  return <g strokeLinejoin="round" strokeLinecap="round">
    {h > 2 && <g transform="translate(290 172)">
      <path d={`M-16 6C-10 ${-h * .45} -22 ${-h * .8} -9 ${-h}H9C22 ${-h * .8} 10 ${-h * .45} 16 6Z`} fill="#9bdcfa" stroke={INK} strokeWidth="5" />
      <path d={`M-4 ${-h + 4}C-36 ${-h - 34} -66 ${-h - 8} -68 ${-h + 30 * height}`} fill="none" stroke={INK} strokeWidth="24" />
      <path d={`M4 ${-h + 4}C36 ${-h - 34} 66 ${-h - 8} 68 ${-h + 30 * height}`} fill="none" stroke={INK} strokeWidth="24" />
      <path d={`M-4 ${-h + 4}C-36 ${-h - 34} -66 ${-h - 8} -68 ${-h + 30 * height}`} fill="none" stroke="#9bdcfa" strokeWidth="14" />
      <path d={`M4 ${-h + 4}C36 ${-h - 34} 66 ${-h - 8} 68 ${-h + 30 * height}`} fill="none" stroke="#9bdcfa" strokeWidth="14" />
      <path d={`M-2 ${-h * .2}V${-h * .8}`} stroke="#e4f6ff" strokeWidth="4" />
    </g>}
    {drops.map((drop, i) => drop.o > 0 && <path key={i} d={`M${drop.x} ${drop.y - drop.r * 1.5}Q${drop.x + drop.r} ${drop.y} ${drop.x} ${drop.y + drop.r}Q${drop.x - drop.r} ${drop.y} ${drop.x} ${drop.y - drop.r * 1.5}Z`} fill="#9bdcfa" stroke={INK} strokeWidth="3" opacity={drop.o} />)}
  </g>;
}

/** A crown of drops thrown up from the waterline, where the whale goes in. */
function Splash({ x, p, size = 1 }: { x: number; p: number; size?: number }) {
  if (p <= 0 || p >= 1) return null;
  const y0 = WHALE_WATERLINE;
  return <g strokeLinejoin="round">
    <ellipse cx={x} cy={y0 + 4} rx={(40 + 110 * easeOutCubic(p)) * size} ry={(8 + 12 * easeOutCubic(p)) * size} fill="none" stroke="#fff" strokeWidth={7 * (1 - p)} />
    {Array.from({ length: 9 }, (_, i) => {
      const side = (i - 4) / 4;
      const dx = x + (side * 50 + side * 130 * p) * size; const dy = y0 - Math.sin(p * Math.PI) * (80 + (i % 3) * 36 - Math.abs(side) * 30) * size;
      const r = (12 - Math.abs(side) * 4) * size;
      return <path key={i} d={`M${dx} ${dy - r * 1.5}Q${dx + r} ${dy} ${dx} ${dy + r}Q${dx - r} ${dy} ${dx} ${dy - r * 1.5}Z`} fill="#9bdcfa" stroke={INK} strokeWidth="3" opacity={1 - p ** 2} />;
    })}
  </g>;
}

const WHALE_CLOUD_AT = { x: 438, y: 60 } as const;
function whaleDrawing(time: number, id: string): Drawing {
  const alive = time >= ALIVE_AT ? whaleAlive(time) : null;
  const eye = alive?.eye ?? 0;
  const fly = alive?.gull ?? 0;
  const sky = (x: number) => sceneryExit(time, 'whale', x);
  return {
    pose: alive?.pose ?? REST,
    back: <>
      <Pop q={sky(WHALE_SUN.cx)} x={WHALE_SUN.cx} y={WHALE_SUN.cy}><Sun cx={WHALE_SUN.cx} cy={WHALE_SUN.cy} r={WHALE_SUN.r} /></Pop>
      <Pop q={sky(WHALE_CLOUD_AT.x)} x={WHALE_CLOUD_AT.x} y={WHALE_CLOUD_AT.y}><SkyCloud d={WHALE_CLOUD} /></Pop>
      <Gull d={WHALE_GULL} fly={fly} dx={-420} dy={-390} /><Gull d={WHALE_GULL_FAR} fly={fly} dx={680} dy={-480} />
    </>,
    behind: alive && <Spout height={alive.spout} spray={alive.spray} />,
    character: <>
      <WhaleBody id={id} />
      <ellipse cx="192" cy="352" rx="22" ry="12" fill="#ff8fb0" opacity={.75 * clamp01(eye)} />
      <Eye x={232} y={300} open={eye} />
    </>,
    // The sea (and its lighthouse) stays until the flukes are under, then drains away with its splashes.
    front: <Drain q={progress(time, WHALE_SEA_DRAIN.start, WHALE_SEA_DRAIN.end)} depth={440}>
      <Sea id={id} /><Splash x={140} p={alive?.splash ?? 0} /><Splash x={560} p={alive?.flukeSplash ?? 0} size={1.2} />
    </Drain>,
  };
}

// Train -------------------------------------------------------------

const COW_CATCHER = 'M716 430V558H856L790 430Z';
const TrainBody = memo(function TrainBody({ id }: { id: string }) {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <defs>
      <clipPath id={`${id}-train`}><path d={TRAIN_OUTLINE} /></clipPath>
      <clipPath id={`${id}-catcher`}><path d={COW_CATCHER} /></clipPath>
    </defs>
    <path d={TRAIN_OUTLINE} fill="#e8474c" />
    <g clipPath={`url(#${id}-train)`}>
      <path d="M100 100H332V440H100Z" fill="#2f6fb0" />
      <path d="M100 100H360V176H100Z" fill="#22384f" />
      <path d="M580 100H710V262H580Z" fill="#3a3f58" />
      <path d="M600 186H690V200H600Z" fill={GOLD} />
      <path d="M430 196H530V262H430Z" fill={GOLD} />
      <path d="M396 262H410V430H396ZM596 262H610V430H596Z" fill={GOLD} />
      <path d="M742 250H800V440H742Z" fill="#3a3f58" />
      <path d="M140 410H760V440H140Z" fill="#3a3f58" />
      <path d="M700 430H900V600H700Z" fill={GOLD} />
      <path d="M340 272H736V290H340Z" fill="#fff" opacity=".28" />
      <path d="M160 190H320V200H160Z" fill="#fff" opacity=".18" />
    </g>
    <path d="M744 452L832 548M770 440L858 540M742 490L800 556" stroke="#b77b12" strokeWidth="5" opacity=".7" clipPath={`url(#${id}-catcher)`} />
    <path d={TRAIN_WINDOW} fill="#ffe29a" stroke={INK} strokeWidth="6" />
    <path d="M186 242H300" stroke="#e7b24b" strokeWidth="4" />
    <path d={TRAIN_OUTLINE} fill="none" stroke={INK} strokeWidth="6.5" />
    <path d="M330 262V410M128 176H352M150 410H742M742 262V430" fill="none" stroke={INK} strokeWidth="4.5" />
  </g>;
});

function Wheel({ cx, cy, r, turn }: { cx: number; cy: number; r: number; turn: number }) {
  return <g transform={`translate(${cx} ${cy}) rotate(${turn})`}>
    <circle r={r} fill={INK} />
    <circle r={r * .76} fill={GOLD} stroke={INK} strokeWidth="4" />
    <path d={Array.from({ length: 4 }, (_, i) => { const a = i * Math.PI / 4; return `M${Math.cos(a) * r * .74} ${Math.sin(a) * r * .74}L${-Math.cos(a) * r * .74} ${-Math.sin(a) * r * .74}`; }).join('')} stroke={INK} strokeWidth="5" />
    <circle r={r * .2} fill="#c9ced6" stroke={INK} strokeWidth="4" />
  </g>;
}

/** Circles as one path (overlaps merge: same winding). */
const circles = (list: readonly { x: number; y: number; r: number }[]) => list.map(({ x, y, r }) => `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0`).join('');
/** Puffs merge into one cloud bank: every outline first, then every fill on top (three paths, however many puffs). */
function CloudBank({ puffs }: { puffs: readonly Puff[] }) {
  const lobes = puffs.filter((puff) => puff.opacity > .01 && puff.r > .5).flatMap(({ x, y, r }) => [
    { x, y, r }, { x: x - r * .72, y: y + r * .28, r: r * .64 }, { x: x + r * .74, y: y + r * .22, r: r * .6 },
  ]);
  if (!lobes.length) return null;
  return <g>
    <path d={circles(lobes.map(({ x, y, r }) => ({ x, y, r: r + 3.5 })))} fill="#b9b09e" />
    <path d={circles(lobes)} fill="#fffdf8" />
    <path d={circles(lobes.filter((_, i) => i % 3 === 0).map(({ x, y, r }) => ({ x: x + r * .12, y: y + r * .3, r: r * .62 })))} fill="#ece6d9" />
  </g>;
}

/** The track, from page x `from` to beyond the right edge (the sleepers stay put as it rolls up behind the train). */
const Rails = memo(function Rails({ from }: { from: number }) {
  return <g>
    <path d={`M${from} 566H1700`} stroke="#8a6a4a" strokeWidth="12" strokeDasharray="14 22" strokeDashoffset={(from + 700) % 36} />
    <path d={`M${from} 560H1700`} stroke="#6b7384" strokeWidth="6" strokeLinecap="round" />
  </g>;
});

const KITE_TAIL = 'M470 172C452 186 486 196 468 214';
const KITE_AT = { x: 470, y: 98 } as const;
const Kite = memo(function Kite() {
  const [top, right, bottom, left] = corners(TRAIN_KITE);
  const bows = [{ x: 461, y: 188 }, { x: 474, y: 206 }];
  return <g strokeLinejoin="round" strokeLinecap="round">
    <path d={KITE_TAIL} fill="none" stroke={INK} strokeWidth="3" />
    {bows.map(({ x, y }) => <path key={y} d={`M${x} ${y}L${x - 12} ${y - 7}V${y + 7}ZM${x} ${y}L${x + 12} ${y - 7}V${y + 7}Z`} fill={TOMATO} stroke={INK} strokeWidth="2.5" />)}
    <path d={`M${top.x} ${top.y}L${right.x} ${right.y}L${top.x} ${right.y}ZM${bottom.x} ${bottom.y}L${left.x} ${left.y}L${top.x} ${left.y}Z`} fill={TOMATO} />
    <path d={`M${top.x} ${top.y}L${left.x} ${left.y}L${top.x} ${left.y}ZM${bottom.x} ${bottom.y}L${right.x} ${right.y}L${top.x} ${right.y}Z`} fill="#ffd166" />
    <path d={`M${top.x} ${top.y}V${bottom.y}M${left.x} ${left.y}H${right.x}`} stroke="#b77b12" strokeWidth="3.5" />
    <path d={TRAIN_KITE} fill="none" stroke={INK} strokeWidth="5.5" />
  </g>;
});

const LollipopTree = memo(function LollipopTree() {
  const { cx, cy, r } = TRAIN_TREE_CROWN;
  return <g strokeLinejoin="round" strokeLinecap="round">
    <path d={`M${cx - 8} ${cy + r - 6}V562H${cx + 8}V${cy + r - 6}Z`} fill="#8a6a4a" stroke={INK} strokeWidth="5" />
    <circle cx={cx} cy={cy} r={r} fill="#62b85a" />
    <path d={`M${cx + r * .2} ${cy - r * .98}A${r} ${r} 0 0 1 ${cx + r * .2} ${cy + r * .98}A${r * 1.1} ${r * 1.1} 0 0 0 ${cx + r * .2} ${cy - r * .98}Z`} fill="#4c9f4b" />
    <circle cx={cx - r * .35} cy={cy - r * .32} r={r * .22} fill="#8fd47f" />
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={INK} strokeWidth="5.5" />
  </g>;
});

const TrainPine = memo(function TrainPine({ id }: { id: string }) {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <defs><clipPath id={`${id}-pine`}><path d={TRAIN_PINE} /></clipPath></defs>
    <path d={TRAIN_PINE} fill="#3f9a52" />
    <g clipPath={`url(#${id}-pine)`}>
      <path d="M72 280L140 560H72Z" fill="#2f7d43" />
      <path d="M50 472H100V570H50Z" fill="#8a6a4a" />
    </g>
    <path d={TRAIN_PINE} fill="none" stroke={INK} strokeWidth="5.5" />
  </g>;
});

/** A sunny day in the country: the sun, a kite, a lollipop tree and a pine (the train's page gave nothing away). */
function trainDrawing(time: number, id: string): Drawing {
  const alive = time >= ALIVE_AT ? trainAlive(time) : null;
  const roll = alive?.roll ?? 0;
  const [rear, front, pilot] = TRAIN_WHEELS;
  const angle = roll / rear.r;
  const pin = (w: { cx: number; cy: number; r: number }) => ({ x: w.cx + Math.cos(angle) * w.r * .5, y: w.cy + Math.sin(angle) * w.r * .5 });
  const a = pin(rear); const b = pin(front);
  const sky = (x: number) => sceneryExit(time, 'train', x);
  const ground = (x: number) => sceneryExit(time, 'train', x, true);
  return {
    pose: alive?.pose ?? REST,
    back: <>
      <Pop q={sky(TRAIN_SUN.cx)} x={TRAIN_SUN.cx} y={TRAIN_SUN.cy}><Sun cx={TRAIN_SUN.cx} cy={TRAIN_SUN.cy} r={TRAIN_SUN.r} /></Pop>
      <Pop q={sky(KITE_AT.x)} x={KITE_AT.x} y={KITE_AT.y}><Kite /></Pop>
      <Pop q={ground(TRAIN_TREE_CROWN.cx)} x={TRAIN_TREE_CROWN.cx} y={562}><LollipopTree /></Pop>
      <Pop q={ground(72)} x={72} y={562}><TrainPine id={id} /></Pop>
      <Gull d={TRAIN_BIRD} fly={alive ? easeInCubic(progress(time, ALIVE_AT, ALIVE_AT + .9)) : 0} dx={600} dy={-400} />
      {trackStart(time) < 1690 && <Rails from={Math.round(trackStart(time))} />}
    </>,
    character: <>
      <circle cx="768" cy="300" r="46" fill="#fff3b0" opacity={.55 * (alive?.lamp ?? 0)} />
      <TrainBody id={id} />
      <circle cx="768" cy="300" r="15" fill={alive?.lamp ? '#fff7cc' : '#e9e4d2'} stroke={INK} strokeWidth="4" />
      {[rear, front].map((w, i) => <Wheel key={i} cx={w.cx} cy={w.cy} r={w.r} turn={angle * 57.3} />)}
      <Wheel cx={pilot.cx} cy={pilot.cy} r={pilot.r} turn={roll / pilot.r * 57.3} />
      <path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke={INK} strokeWidth="15" strokeLinecap="round" />
      <path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke="#d5d9df" strokeWidth="7" strokeLinecap="round" />
    </>,
    front: alive && <CloudBank puffs={alive.puffs} />,
  };
}

// Rocket ------------------------------------------------------------

const RocketBody = memo(function RocketBody({ id }: { id: string }) {
  const { cx, cy, r } = ROCKET_PORTHOLE;
  const hatch = ROCKET_HATCH;
  return <g strokeLinejoin="round" strokeLinecap="round">
    <defs><clipPath id={`${id}-rocket`}><path d={ROCKET_OUTLINE} /></clipPath></defs>
    <path d={ROCKET_OUTLINE} fill="#f7f3ea" />
    <g clipPath={`url(#${id}-rocket)`}>
      <path d="M370 30H630V206Q500 234 370 206Z" fill="#e8474c" />
      <path d="M612 340L740 480V600H612ZM388 340L260 480V600H388Z" fill="#e8474c" />
      <path d="M420 500H580V560H420Z" fill="#7a8190" />
      <path d="M572 150C590 200 598 260 598 300V500H620V150Z" fill="#e2dccf" />
      <path d="M384 460H616V480H384Z" fill="#3a86d4" />
      <path d="M414 236V420" stroke="#fff" strokeWidth="12" opacity=".85" />
      <path d="M606 380L700 500M394 380L300 500" stroke="#b8323a" strokeWidth="10" opacity=".45" />
    </g>
    <path d="M401 205Q500 236 599 205" fill="none" stroke={INK} strokeWidth="5" />
    <path d="M612 356V500M388 356V500M444 500H556" fill="none" stroke={INK} strokeWidth="5" />
    {[430, 470, 530, 570].map((x) => <circle key={x} cx={x} cy={x === 430 || x === 570 ? 218 : 226} r="4" fill={INK} />)}
    <circle cx={cx} cy={cy} r={r + 5} fill="#c3cad3" stroke={INK} strokeWidth="5" />
    <circle cx={cx} cy={cy} r={r - 6} fill="#1f3a5f" stroke={INK} strokeWidth="4" />
    <path d={`M${cx - 26} ${cy - 14}Q${cx - 20} ${cy - 30} ${cx - 2} ${cy - 34}`} fill="none" stroke="#8fc4ef" strokeWidth="6" />
    <circle cx={hatch.cx} cy={hatch.cy} r={hatch.r + 4} fill="#c3cad3" stroke={INK} strokeWidth="5" />
    <circle cx={hatch.cx} cy={hatch.cy} r={hatch.r - 7} fill="#ffd166" stroke={INK} strokeWidth="4" />
    <path d={`M${hatch.cx - 12} ${hatch.cy - 6}Q${hatch.cx - 8} ${hatch.cy - 16} ${hatch.cx + 2} ${hatch.cy - 17}`} fill="none" stroke="#fff6d0" strokeWidth="4" />
    <path d={ROCKET_OUTLINE} fill="none" stroke={INK} strokeWidth="6.5" />
  </g>;
});

function Flame({ size }: { size: number }) {
  if (size <= .01) return null;
  const h = 170 * size;
  return <g transform="translate(500 534)" strokeLinejoin="round">
    <path d={`M-58 0C-60 ${h * .4} -22 ${h * .7} 0 ${h}C22 ${h * .7} 60 ${h * .4} 58 0Z`} fill="#ff8a1f" stroke={INK} strokeWidth="5" />
    <path d={`M-38 0C-38 ${h * .35} -14 ${h * .56} 0 ${h * .74}C14 ${h * .56} 38 ${h * .35} 38 0Z`} fill="#ffd166" />
    <path d={`M-18 0C-18 ${h * .25} -6 ${h * .38} 0 ${h * .5}C6 ${h * .38} 18 ${h * .25} 18 0Z`} fill="#fff6d0" />
  </g>;
}

/** A snow-capped two-tier pine: apex (x, y), the first tier's ledge (half width `hw`), the base and the trunk's foot, and its snow mound. */
type PineShape = { d: string; x: number; y: number; ledge: number; hw: number; base: number; trunk: number; mound: string };
const PINES: readonly PineShape[] = [
  { d: ROCKET_TREE, x: 868, y: 360, ledge: 440, hw: 46, base: 526, trunk: 574, mound: 'M834 574Q860 556 886 574Z' },
  { d: ROCKET_TREE_SMALL, x: 120, y: 392, ledge: 460, hw: 36, base: 530, trunk: 574, mound: 'M94 574Q120 558 146 574Z' },
];
const SnowPine = memo(function SnowPine({ id, pine }: { id: string; pine: PineShape }) {
  const { d, x, y, ledge, hw, base, trunk, mound } = pine;
  const capY = y + (ledge - y) * .5; const cw = hw * .5;
  const scallops = (y0: number, from: number, to: number, n: number) => { let path = ''; const w = (to - from) / n; for (let i = 0; i < n; i++) path += `Q${from + w * (i + .5)} ${y0 + 11} ${from + w * (i + 1)} ${y0}`; return path; };
  return <g strokeLinejoin="round" strokeLinecap="round">
    <defs><clipPath id={id}><path d={d} /></clipPath></defs>
    <path d={d} fill="#3f9a52" />
    <g clipPath={`url(#${id})`}>
      <path d={`M${x} ${y - 20}L${x + 220} ${base + 40}H${x}Z`} fill="#2f7d43" />
      <path d={`M${x - 14} ${base - 1}H${x + 14}V${trunk + 10}H${x - 14}Z`} fill="#8a6a4a" />
      <path d={`M${x} ${y - 4}L${x + cw} ${capY}${scallops(capY, x + cw, x - cw, 3)}Z`} fill="#fff" />
      <path d={`M${x - hw * 2} ${ledge - 2}H${x + hw * 2}V${ledge + 8}${scallops(ledge + 8, x + hw * 2, x - hw * 2, 8)}Z`} fill="#fff" />
    </g>
    <path d={d} fill="none" stroke={INK} strokeWidth="5.5" />
    <path d={mound} fill="#fff" stroke={INK} strokeWidth="4" />
  </g>;
});

const Moon = memo(function Moon() {
  const moon = ROCKET_MOON;
  return <g strokeLinejoin="round" strokeLinecap="round">
    <path d={crescentPath(moon.cx, moon.cy, moon.r)} fill="#ffe08a" stroke={INK} strokeWidth="6" />
    <circle cx={moon.cx - 26} cy={moon.cy - 16} r="6.5" fill="#f3c957" /><circle cx={moon.cx - 34} cy={moon.cy + 24} r="4.5" fill="#f3c957" />
  </g>;
});

/** The snowy hill the rocket stands on (painted only, never dotted), with its drifts. */
const SnowHill = memo(function SnowHill() {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <path d={`${ROCKET_GROUND}V900H-700Z`} fill="#eef6fe" />
    <path d={ROCKET_GROUND} fill="none" stroke="#cfe2f4" strokeWidth="18" transform="translate(0 12)" />
    <path d={ROCKET_GROUND} fill="none" stroke={INK} strokeWidth="5.5" />
    <path d={ROCKET_DRIFTS} fill="none" stroke="#fff" strokeWidth="7" transform="translate(0 -5)" />
    <path d={ROCKET_DRIFTS} fill="none" stroke="#c3daf0" strokeWidth="5" />
  </g>;
});

const STARS_LEFT = corners(ROCKET_STARS_LEFT);
const STARS_RIGHT = corners(ROCKET_STARS_RIGHT);
const centreX = (points: readonly Pt[]) => points.reduce((sum, p) => sum + p.x, 0) / points.length;
const TWINKLES = [{ x: 952, y: 330, r: 9 }, { x: 48, y: 246, r: 9 }, { x: 612, y: 30, r: 8 }] as const;
/** The star, two little constellations and a few twinkles: each pops away as the sheets under it leave. */
function NightStars({ time, alive }: { time: number; alive: boolean }) {
  const star = ROCKET_STAR;
  const exit = (x: number) => sceneryExit(time, 'rocket', x);
  const twinkle = (i: number) => alive ? 1 + .22 * Math.sin(time * 11 + i * 1.7) : 1;
  const lines = [ROCKET_STARS_LEFT, ROCKET_STARS_RIGHT].map((d, i) => ({ d, show: 1 - smooth(clamp01(exit(centreX(i ? STARS_RIGHT : STARS_LEFT)) * 3)) }));
  const bigStar = popAway(exit(star.cx)) * (alive ? 1 + .1 * Math.sin(time * 14) : 1);
  return <g strokeLinejoin="round" strokeLinecap="round">
    {lines.map(({ d, show }) => show > .01 && <path key={d} d={d} fill="none" stroke="#9aa7c7" strokeWidth="3.5" strokeDasharray="1 9" opacity={show < 1 ? show : undefined} />)}
    {[...STARS_LEFT, ...STARS_RIGHT].map(({ x, y }, i) => {
      const s = popAway(exit(x)) * twinkle(i);
      return s > .01 && <path key={i} d={sparkle(i % 3 ? 10 : 13)} fill={i % 4 ? '#ffd166' : '#fff6d0'} stroke={INK} strokeWidth="2.5" transform={`translate(${x} ${y}) scale(${s})`} />;
    })}
    {bigStar > .01 && <g transform={scaleAbout(star.cx, star.cy, bigStar)}>
      <path d={starPath(star.cx, star.cy, star.r, star.turn)} fill="#ffd166" stroke={INK} strokeWidth="6" />
      <path d={starPath(star.cx, star.cy, star.r * .45, star.turn)} fill="#fff1b8" />
    </g>}
    {TWINKLES.map(({ x, y, r }, i) => {
      const s = popAway(exit(x)) * twinkle(i + 3);
      return s > .01 && <path key={`t${i}`} d={sparkle(r)} fill="#ffd166" stroke={INK} strokeWidth="2.5" transform={`translate(${x} ${y}) scale(${s})`} />;
    })}
  </g>;
}

/** A snowy night: the moon, the hill the rocket stands on with two pines, and the stars. */
function rocketDrawing(time: number, id: string): Drawing {
  const alive = time >= ALIVE_AT ? rocketAlive(time) : null;
  const eye = alive?.eye ?? 0;
  const { cx, cy } = ROCKET_PORTHOLE;
  const ground = (x: number) => sceneryExit(time, 'rocket', x, true);
  return {
    pose: alive?.pose ?? REST,
    back: <>
      <Pop q={sceneryExit(time, 'rocket', ROCKET_MOON.cx)} x={ROCKET_MOON.cx} y={ROCKET_MOON.cy}><Moon /></Pop>
      <Drain q={progress(time, ROCKET_HILL_DRAIN.start, ROCKET_HILL_DRAIN.end)} depth={360}>
        <SnowHill />
        {PINES.map((pine, i) => <Pop key={i} q={ground(pine.x)} x={pine.x} y={pine.trunk}><SnowPine id={`${id}-pine${i}`} pine={pine} /></Pop>)}
      </Drain>
      <NightStars time={time} alive={!!alive} />
    </>,
    behind: alive && <Flame size={alive.flame} />,
    character: <>
      <RocketBody id={id} />
      {eye > .01 && <g><Eye x={cx - 17} y={cy + 4} open={eye} look={alive?.look ?? 0} r={13} /><Eye x={cx + 17} y={cy + 4} open={eye} look={alive?.look ?? 0} r={13} /></g>}
    </>,
    front: alive && <CloudBank puffs={alive.puffs} />,
  };
}

// Butterfly ---------------------------------------------------------

/** The butterfly's art is authored full size; this places it on the page (BUTTERFLY_SCALE about BUTTERFLY_ORIGIN). */
const BUTTERFLY_PLACE = `translate(${BUTTERFLY_ORIGIN.x} ${BUTTERFLY_ORIGIN.y}) scale(${BUTTERFLY_SCALE}) translate(${-BUTTERFLY_ORIGIN.x} ${-BUTTERFLY_ORIGIN.y})`;

function insetDots(points: readonly Pt[], amount: number): Pt[] {
  return points.map((point, i) => {
    const prev = points[(i - 1 + points.length) % points.length]; const next = points[(i + 1) % points.length];
    const tx = next.x - prev.x; const ty = next.y - prev.y; const length = Math.hypot(tx, ty) || 1;
    let nx = -ty / length; let ny = tx / length;
    if (!insidePolygon({ x: point.x + nx * 4, y: point.y + ny * 4 }, points)) { nx = -nx; ny = -ny; }
    return { x: point.x + nx * amount, y: point.y + ny * amount };
  });
}

const ButterflyWings = memo(function ButterflyWings({ id }: { id: string }) {
  // Polka dots along the wing border (full-size art coordinates).
  const polka = useMemo(() => insetDots(samplePath(BUTTERFLY_OUTLINE, 52, true), 15).filter((p) => Math.abs(p.x - 500) > 60), []);
  return <g strokeLinejoin="round" strokeLinecap="round">
    <defs>
      <clipPath id={`${id}-wings`}><path d={BUTTERFLY_OUTLINE} /></clipPath>
      <radialGradient id={`${id}-wing-glow`} cx="500" cy="300" r="380" gradientUnits="userSpaceOnUse"><stop offset=".08" stopColor="#ffe08a" /><stop offset=".55" stopColor="#ff8fc0" /><stop offset="1" stopColor="#f66aa9" /></radialGradient>
    </defs>
    <path d={BUTTERFLY_OUTLINE} fill={`url(#${id}-wing-glow)`} />
    <g clipPath={`url(#${id}-wings)`}>
      <path d={BUTTERFLY_OUTLINE} fill="none" stroke="#7a4fd6" strokeWidth="56" />
      <path d="M520 190C600 150 700 120 790 110M520 240C620 230 720 230 820 200M520 330C620 360 700 400 760 440M520 400C570 450 600 490 630 530M480 190C400 150 300 120 210 110M480 240C380 230 280 230 180 200M480 330C380 360 300 400 240 440M480 400C430 450 400 490 370 530" fill="none" stroke="#e45b9b" strokeWidth="5" opacity=".6" />
      {polka.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="6" fill="#fff6fb" />)}
    </g>
    {BUTTERFLY_SPOTS.map(({ cx, cy, r }) => <circle key={cx} cx={cx} cy={cy} r={r} fill="#ffd166" stroke={INK} strokeWidth="6" />)}
    {BUTTERFLY_SPOTS.map(({ cx, cy, r }) => <circle key={`i${cx}`} cx={cx} cy={cy} r={r * .45} fill="#7a4fd6" />)}
    {BUTTERFLY_LOWER_SPOTS.map(({ cx, cy, r }) => <circle key={cx} cx={cx} cy={cy} r={r} fill="#7a4fd6" stroke={INK} strokeWidth="5" />)}
    {BUTTERFLY_LOWER_SPOTS.map(({ cx, cy, r }) => <circle key={`i${cx}`} cx={cx - r * .25} cy={cy - r * .25} r={r * .28} fill="#c7b2f5" />)}
    <path d={BUTTERFLY_OUTLINE} fill="none" stroke={INK} strokeWidth="6.5" />
  </g>;
});

const ButterflyBody = memo(function ButterflyBody() {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <path d={BUTTERFLY_BODY} fill="#46336b" stroke={INK} strokeWidth="5" />
    <path d="M494 236Q500 224 506 236" fill="none" stroke="#8a72c4" strokeWidth="4" />
    <circle cx="500" cy="150" r="31" fill="#46336b" stroke={INK} strokeWidth="5.5" />
  </g>;
});

function Antennae({ grow, wobble }: { grow: number; wobble: number }) {
  if (grow <= .01) return null;
  return <g strokeLinejoin="round" strokeLinecap="round">
    {BUTTERFLY_ANTENNAE.map((d, i) => {
      const baseX = i ? 482 : 518;
      return <g key={d} transform={`translate(${baseX} 112) rotate(${(i ? -1 : 1) * wobble}) scale(${grow}) translate(${-baseX} -112)`}>
        <path d={d} fill="none" stroke={INK} strokeWidth="6" />
        <circle cx={i ? 404 : 596} cy="78" r="10" fill="#7a4fd6" stroke={INK} strokeWidth="4" />
      </g>;
    })}
  </g>;
}

const TULIP_HEAD = `${BUTTERFLY_TULIP.slice(0, BUTTERFLY_TULIP.lastIndexOf('C'))}Z`;
const TULIP_STEM = `M928 450${BUTTERFLY_TULIP.slice(BUTTERFLY_TULIP.lastIndexOf('C'))}`;
const BUTTERFLY_CLOUD_AT = { x: 334, y: 46 } as const;
/** The lawn along the bottom (it drains away last). */
const Lawn = memo(function Lawn() {
  return <g strokeLinejoin="round">
    <path d="M-700 598H1700V1400H-700Z" fill="#b6e39a" />
    <path d="M-700 598H1700" stroke="#8cc56f" strokeWidth="5" />
    <path d={`${BUTTERFLY_GRASS}V640H918Z`} fill="#b6e39a" />
  </g>;
});
const GrassTufts = memo(function GrassTufts() {
  return <path d={BUTTERFLY_GRASS} fill="none" stroke={INK} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />;
});
const Tulip = memo(function Tulip() {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <path d={TULIP_STEM} fill="none" stroke={INK} strokeWidth="12" />
    <path d={TULIP_STEM} fill="none" stroke="#4f9f4c" strokeWidth="5" />
    <path d="M924 540C900 526 890 500 894 478C914 488 924 510 924 540Z" fill="#7cc86a" stroke={INK} strokeWidth="4.5" />
    <path d={TULIP_HEAD} fill="#ff6f91" />
    <path d="M914 392L932 362L950 392C946 420 940 440 930 450C920 440 914 420 914 392Z" fill="#e8476f" />
    <path d={TULIP_HEAD} fill="none" stroke={INK} strokeWidth="5.5" />
  </g>;
});
const Leaf = memo(function Leaf({ id }: { id: string }) {
  const leaf = `${BUTTERFLY_LEAF}Z`;
  return <g strokeLinejoin="round" strokeLinecap="round">
    <defs><clipPath id={`${id}-leaf`}><path d={leaf} /></clipPath></defs>
    <path d="M108 580Q106 590 104 600" fill="none" stroke={INK} strokeWidth="10" />
    <path d={leaf} fill="#7cc86a" />
    <g clipPath={`url(#${id}-leaf)`}><path d="M104 590C110 520 96 430 64 342L20 342V600Z" fill="#62b257" /></g>
    <path d="M104 584C110 520 96 430 66 350M104 520L130 496M100 470L126 440M92 420L112 394M100 500L76 470M94 446L72 414" fill="none" stroke="#3f8a45" strokeWidth="3.5" />
    <path d={leaf} fill="none" stroke={INK} strokeWidth="5.5" />
  </g>;
});

/** The garden (it was the misdirection): sun, cloud, lawn, a leaf and a tulip. */
function butterflyDrawing(time: number, id: string): Drawing {
  const alive = time >= ALIVE_AT ? butterflyAlive(time) : null;
  const eye = alive?.eye ?? 0;
  const flap = alive?.flap ?? 1;
  // A sparkle trail: each glint smaller than the one before; the trail shrinks away as the butterfly leaves the top, so none is left on the names.
  const glint = 1 - smooth(progress(time, 7.3, 7.5));
  const trail = alive && alive.sparkle > 0 && glint > 0 ? Array.from({ length: 6 }, (_, k) => ({ k, pose: butterflyAlive(time - (k + 1) * .065).pose })) : [];
  const sky = (x: number) => sceneryExit(time, 'butterfly', x);
  const ground = (x: number) => sceneryExit(time, 'butterfly', x, true);
  return {
    pose: alive?.pose ?? REST,
    back: <>
      <Pop q={sky(BUTTERFLY_SUN.cx)} x={BUTTERFLY_SUN.cx} y={BUTTERFLY_SUN.cy}><Sun cx={BUTTERFLY_SUN.cx} cy={BUTTERFLY_SUN.cy} r={BUTTERFLY_SUN.r} /></Pop>
      <Pop q={sky(BUTTERFLY_CLOUD_AT.x)} x={BUTTERFLY_CLOUD_AT.x} y={BUTTERFLY_CLOUD_AT.y}><SkyCloud d={BUTTERFLY_CLOUD} /></Pop>
      <Drain q={progress(time, GARDEN_DRAIN.start, GARDEN_DRAIN.end)} depth={300}>
        <Lawn />
        <Pop q={ground(926)} x={918} y={598}><Tulip /></Pop>
        <Pop q={ground(90)} x={104} y={598}><Leaf id={id} /></Pop>
        <GrassTufts />
      </Drain>
    </>,
    front: trail.length > 0 && <g>{trail.map(({ k, pose }) => <path key={k} d={sparkle(13 - k * 1.6)} fill={k % 2 ? '#ffd166' : '#fff'} stroke={INK} strokeWidth="2" transform={`translate(${500 + pose.x + (k % 2 ? 16 : -16)} ${400 + pose.y}) rotate(${k * 25}) scale(${glint})`} />)}</g>,
    character: <g transform={BUTTERFLY_PLACE}>
      <g transform={`translate(500 0) scale(${flap} 1) translate(-500 0)`}><ButterflyWings id={id} /></g>
      <Antennae grow={alive?.antennae ?? 0} wobble={alive?.wobble ?? 0} />
      <ButterflyBody />
      <g opacity={clamp01(eye * 3)}>
        <Eye x={489} y={146} open={eye} r={8} /><Eye x={511} y={146} open={eye} r={8} />
        <path d="M491 163Q500 171 509 163" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </g>,
  };
}

function drawingFor(id: PictureId, time: number, svgId: string): Drawing {
  if (id === 'train') return trainDrawing(time, svgId);
  if (id === 'rocket') return rocketDrawing(time, svgId);
  if (id === 'butterfly') return butterflyDrawing(time, svgId);
  return whaleDrawing(time, svgId);
}

// ------------------------------------------------------------------ scene

/**
 * The painted picture, behind the pencil line (`front`: in front of it). Built a part at a time while
 * the class chants (hidden), shown clipped to nothing from the suspense, flooded in at the snap.
 * Until it comes alive its props never change, so it never re-renders or repaints while the pencil draws.
 */
const PictureLayer = memo(function PictureLayer({ clipId, drawing, front, showBack, showCharacter, hidden, flood, snap }: {
  clipId: string; drawing: Drawing | null; front: boolean; showBack: boolean; showCharacter: boolean; hidden?: 'hidden'; flood: number | null; snap: Pt;
}) {
  const clip = flood === null ? undefined : `url(#${clipId})`;
  return <svg className="dtd-page dtd-layer" viewBox={PAGE_BOX} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    {flood !== null && <defs><clipPath id={clipId}><circle cx={snap.x} cy={snap.y} r={flood} /></clipPath></defs>}
    {front ? <g clipPath={clip} visibility={hidden}>{showBack && drawing?.front}</g> : <>
      <g clipPath={clip} visibility={hidden}>{showBack && drawing?.back}</g>
      {showCharacter && drawing && <g transform={poseTransform(drawing.pose)}>
        {drawing.behind}
        <g clipPath={clip} visibility={hidden}>{drawing.character}</g>
      </g>}
    </>}
  </svg>;
});

function SnapBurst({ time, at }: { time: number; at: Pt }) {
  const p = progress(time, DOT_BEATS.snap, afterSnap(.55));
  if (p <= 0 || p >= 1) return null;
  return <g transform={`translate(${at.x} ${at.y})`}>
    <circle r={16 + 130 * easeOutCubic(p)} fill="none" stroke="#ffcf4a" strokeWidth={14 * (1 - p)} />
    <circle r={10 + 80 * easeOutCubic(p)} fill="none" stroke={TOMATO} strokeWidth={5 * (1 - p)} />
    {Array.from({ length: 9 }, (_, i) => {
      const a = i / 9 * Math.PI * 2 - Math.PI / 2;
      const d = 30 + 150 * easeOutCubic(p);
      return <path key={i} d={sparkle(i % 2 ? 11 : 16)} fill={i % 3 ? '#ffcf4a' : '#fff'} stroke={INK} strokeWidth="2.5" transform={`translate(${Math.cos(a) * d} ${Math.sin(a) * d}) rotate(${p * 180}) scale(${1 - p * .8})`} />;
    })}
  </g>;
}

const HardStars = memo(function HardStars() { return <span className="dtd-hard">Hard{[0, 1, 2].map((i) => <svg key={i} viewBox="-10 -10 20 20" aria-hidden="true"><path d={starPath(0, 0, 9)} /></svg>)}</span>; });
const BannerPencil = memo(function BannerPencil() { return <svg viewBox="-4 -20 230 40" className="dtd-banner-pencil" aria-hidden="true"><g transform="rotate(-18)"><PencilArt /></g></svg>; });

/**
 * Connect the dots! (chant) -> What is it? (whoosh, guessing; the "?" nods, in CSS) -> It's a whale! (snap).
 * Gone before the first sheet leaves. Only its motion is worked out per frame: the card re-renders only while it moves.
 */
function Banner({ time, answer, step }: { time: number; answer: string; step: number }) {
  const done = time >= afterSnap(.06);
  const guessing = !done && time >= DOT_BEATS.slowEnd;
  const changedAt = done ? afterSnap(.06) : guessing ? DOT_BEATS.slowEnd : DOT_BEATS.bannerIn;
  const enter = easeOutBack(progress(time, DOT_BEATS.bannerIn, .5), 1.4);
  const swap = changedAt === DOT_BEATS.bannerIn ? 1 : easeOutBack(progress(time, changedAt, changedAt + .26), 2.2);
  const exit = smooth(progress(time, afterSnap(.75), afterSnap(1.1)));
  if (exit >= 1) return null;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return <BannerCard mode={done ? 'done' : guessing ? 'guess' : 'chant'} answer={answer} step={step}
    transform={`translate(${round((enter - 1) * 110)}%, ${round(-exit * 140)}%) scale(${round(mix(.6, 1, swap))})`} opacity={round(clamp01(enter * 2) * (1 - exit))} />;
}
const BannerCard = memo(function BannerCard({ mode, answer, step, transform, opacity }: { mode: 'chant' | 'guess' | 'done'; answer: string; step: number; transform: string; opacity: number }) {
  return <div className={`dtd-banner${mode === 'done' ? ' is-done' : mode === 'guess' ? ' is-guess' : ''}`} style={{ transform, opacity }}>
    <BannerPencil />
    {mode === 'done' ? <strong>It’s {answer}!</strong>
      : mode === 'guess' ? <><strong>What is it?</strong><span className="dtd-chip is-guess">?</span><HardStars /></>
        : <><strong>Connect the dots!</strong><span className="dtd-chip">Count by {step}s</span><HardStars /></>}
  </div>;
});

const FAST_PHASES = new Set(['whoosh', 'outline', 'lift']);

export function DotToDotScene({ time, picture }: { time: number; picture: number }) {
  const id = useId();
  useEffect(() => { scenesShowing++; return () => { scenesShowing--; warmPlans(); }; }, []);
  const frameBox = useRef<HTMLDivElement>(null);
  const frame = useFrame(frameBox);
  const plan = planFor(picture);
  const spec = DOT_PICTURES[picture];
  const page = piecesFor(plan);
  const pencil = pencilAt(plan, time);
  const before = pencilAt(plan, Math.max(0, time - .06));
  const vx = (pencil.x - before.x) / .06; const vy = (pencil.y - before.y) / .06;
  const speed = Math.hypot(vx, vy);
  const exit = pencilExit(time);
  const lastHit = pencil.reached >= 0 ? plan.dots[pencil.reached].hit : 0;
  const press = pencil.reached >= 0 ? 1 - .07 * Math.sin(clamp01((time - lastHit) / .14) * Math.PI) : 1;
  const flood = time >= DOT_BEATS.snap ? floodRadius(time) : 0;
  // The painted picture is built once, a part at a time while the class chants (hidden), so the snap
  // never waits on it; until it comes alive it is the same elements every frame (React skips it).
  const mounted = { back: time >= ART_MOUNT.back, character: time >= ART_MOUNT.character, front: time >= ART_MOUNT.front };
  const stillDrawing = useMemo(() => mounted.back ? drawingFor(spec.id, 0, id) : null, [spec.id, id, mounted.back]);
  const drawing = time >= ALIVE_AT ? drawingFor(spec.id, time, id) : stillDrawing;
  // Shown (but clipped to nothing) from the suspense on, so the snap frame is not the first time it is painted.
  const hidden = time >= DOT_BEATS.suspense ? undefined : 'hidden';
  // The pencil line has gone before the picture moves, so it never drifts off the painted outline.
  const lineFade = 1 - smooth(progress(time, afterSnap(.12), afterSnap(.3)));
  const dotsFade = 1 - smooth(progress(time, afterSnap(.02), afterSnap(.2)));
  const pop = snapPop(time);
  const snap = plan.snapPoint;
  const fast = FAST_PHASES.has(pencil.phase);
  const glow = fast && pencil.phase !== 'lift' ? clamp01((speed - 400) / 1400) : 0;
  const calloutLabel = pencil.reached >= 0 ? plan.dots[pencil.reached].label : 0;
  // Big while the class reads along; small while it races; one last big pop on the final number.
  const calloutSize = fast ? mix(1, .6, smooth(progress(time, DOT_BEATS.slowEnd, DOT_BEATS.slowEnd + .5))) : pencil.phase === 'suspense' || pencil.phase === 'close' ? mix(.6, 1, smooth(progress(time, DOT_BEATS.suspense, DOT_BEATS.suspense + .25))) : 1;
  const calloutPop = calloutSize * (1 + .5 * (1 - smooth(clamp01((time - lastHit) / .26)))) * (time >= DOT_BEATS.snap ? 1 + .35 * Math.sin(progress(time, DOT_BEATS.snap, afterSnap(.3)) * Math.PI) : 1);
  const calloutFade = pencil.phase === 'enter' ? 0 : 1 - smooth(progress(time, afterSnap(.14), afterSnap(.3)));
  // In the suspense the pencil and the number lean away from the give-away part (and the number off the picture), so everyone sees it arrive.
  const aim = aimFor(plan);
  const aiming = smooth(progress(time, DOT_BEATS.suspense - .3, DOT_BEATS.suspense));
  const calloutX = Math.min(PAGE_WIDTH - 50, Math.max(50, pencil.x + mix(-70, aim.callout.x, aiming)));
  const calloutY = Math.min(PAGE_HEIGHT - 20, Math.max(46, pencil.y + mix(-62 - pencil.lift * 46, aim.callout.y - pencil.lift * 30, aiming)));
  const pencilAngle = mix(DRAW_ANGLE + Math.max(-12, Math.min(12, vx / 160)) * (1 - aiming), aim.angle, aiming);
  const pencilRoll = mix(1, aim.roll, aiming);
  const back = { x: -vx / (speed || 1), y: -vy / (speed || 1) };
  const streak = clamp01((speed - 700) / 1600) * (time < DOT_BEATS.snap ? 1 : 0);
  const filling = time < DOT_BEATS.fillEnd ? flood : null;
  return <div className="dtd-scene" style={{ opacity: 1 - smooth(progress(time, DOT_BEATS.stageOut, DOT_BEATS.end - .02)) }}>
    <div className="dtd-wash" />
    <Banner time={time} answer={spec.answer} step={spec.step} />
    {/* The snap's pop scales these layers on the compositor (a CSS transform), never by re-drawing them. */}
    <div className="dtd-stack" style={pop !== 1 ? { transform: `scale(${pop})` } : undefined}>
      <PictureLayer clipId={`${id}-flood`} drawing={drawing} front={false} showBack={mounted.back} showCharacter={mounted.character} hidden={hidden} flood={filling} snap={snap} />
      {/* The pencil line: the only page layer that changes every frame while drawing. */}
      <svg className="dtd-page dtd-layer" viewBox={PAGE_BOX} preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={lineFade <= 0 ? { display: 'none' } : undefined}>
        {lineFade > 0 && <g opacity={lineFade < 1 ? lineFade : undefined}><PencilLines plan={plan} drawn={pencil.drawn} glow={glow} /></g>}
      </svg>
      <PictureLayer clipId={`${id}-flood-front`} drawing={drawing} front showBack={mounted.front} showCharacter={false} hidden={hidden} flood={filling} snap={snap} />
      <DotsPage plan={plan} done={countUpTo(page.printedDoneAt, time)} sprouted={countUpTo(page.aheadAt, time)} sproutsDone={countUpTo(page.aheadDoneAt, time)} fade={dotsFade} time={time} />
    </div>
    <svg className="dtd-page dtd-layer" viewBox={PAGE_BOX} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {/* Fixed children (each may be empty), so adding or removing a pulse never moves a whole layer's subtree. */}
      <g opacity={dotsFade < 1 ? dotsFade : undefined}>{dotsFade > 0 && <HitPulses plan={plan} time={time} />}</g>
      <g><SnapBurst time={time} at={snap} /></g>
      <g stroke={TOMATO} strokeWidth="3" strokeLinecap="round" opacity={streak > .02 ? streak * .7 : undefined}>
        {streak > .02 && [-1, 0, 1].map((k) => { const ox = -back.y * k * 17; const oy = back.x * k * 17; const skip = 30 + Math.abs(k) * 16; const reach = 40 + Math.min(110, speed * .04) * (k ? .6 : 1); return <path key={k} d={`M${pencil.x + back.x * skip + ox} ${pencil.y + back.y * skip + oy}l${back.x * reach} ${back.y * reach}`} />; })}
      </g>
    </svg>
    {/* The big number and the pencil: small sprites moved by transforms only (no page repaints). */}
    <div className="dtd-page dtd-frame" ref={frameBox}>
      {frame && calloutFade > .01 && calloutLabel > 0 && <div className="dtd-sprite-box" style={{ transform: `translate(${px(frame.ox + calloutX * frame.s)}, ${px(frame.oy + calloutY * frame.s)}) scale(${calloutPop / CALLOUT_RES})`, opacity: calloutFade < 1 ? calloutFade : undefined }}>
        <CalloutSprite k={frame.s * CALLOUT_RES} label={calloutLabel} />
      </div>}
      {frame && time < afterSnap(.46) && time >= DOT_BEATS.pencilIn && <Pencil frame={frame} x={pencil.x + exit.dx} y={pencil.y + exit.dy} lift={Math.max(pencil.lift, exit.lift * .8)} angle={pencilAngle} press={press} spin={exit.spin} roll={pencilRoll} />}
    </div>
  </div>;
}

// ------------------------------------------------------------------ effect

function useShowPicture(fixed?: number) {
  const [picture] = useState(() => fixed ?? pictureIndexForPlay(DOT_PICTURES.length, performance.now()));
  return picture;
}

function makeStage(fixed?: number) {
  return function DotToDotStage() {
    const picture = useShowPicture(fixed);
    return <DotToDotScene time={useSceneTime(DOT_TO_DOT_DURATION_MS)} picture={picture} />;
  };
}

/** Each card is a sheet torn from a hard activity book: dot grid, a faint dotted "?" to trace. */
function makeCover(fixed?: number) {
  return function DotToDotCover() {
    const picture = useShowPicture(fixed);
    const id = DOT_PICTURES[picture].id;
    const exit = COVER_EXITS[id];
    return <div className={`dtd-cover is-${id} by-${exit.stagger}`} style={{ '--dtd-exit-start': `${exit.start}ms`, '--dtd-exit-spread': `${exit.spread}ms`, '--dtd-exit-duration': `${exit.duration}ms` } as CSSProperties}>
      <div className="dtd-sheet">
        <svg className="dtd-sheet-question" viewBox="0 0 60 84" aria-hidden="true">
          <path d="M14 26C14 8 46 6 46 26C46 40 30 40 30 56V60" />
          <circle cx="30" cy="74" r="3.6" />
        </svg>
        <svg className="dtd-sheet-doodle" viewBox="0 0 40 40" aria-hidden="true"><path d={starPath(20, 20, 16, 8)} /></svg>
      </div>
    </div>;
  };
}

const makeEffect = (id: string, name: string, fixed?: number): RevealEffect => ({
  id, name, durationMs: DOT_TO_DOT_DURATION_MS, sound: 'dot-to-dot', Stage: makeStage(fixed), Cover: makeCover(fixed),
  description: 'A super-hard connect-the-dots page: count along by 2s or 5s, then guess what it is as the pencil races and the last dots appear. It colors in and comes alive.',
});

export const dotToDotEffect: RevealEffect = makeEffect('dot-to-dot', 'Hard dot-to-dot');

// Lab-only previews that pin one picture (the registry uses dotToDotEffect, which rotates).
export const dotToDotWhalePreview = makeEffect('dot-to-dot-whale', 'Dot-to-dot · whale (preview)', 0);
export const dotToDotTrainPreview = makeEffect('dot-to-dot-train', 'Dot-to-dot · train (preview)', 1);
export const dotToDotRocketPreview = makeEffect('dot-to-dot-rocket', 'Dot-to-dot · rocket (preview)', 2);
export const dotToDotButterflyPreview = makeEffect('dot-to-dot-butterfly', 'Dot-to-dot · butterfly (preview)', 3);

warmPlans();
