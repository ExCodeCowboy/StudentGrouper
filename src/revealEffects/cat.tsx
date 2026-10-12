import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { BAKE_FPS, useBakedTracks, type BakedClock, type BakedTrack } from './bakedTimeline';
import { CatDefs, DRIFT_ART, DUST_ART, HEART_ART, POP_POM_ART, Rig, SHADOW_ART, poseTransform, sideKittenRig, sittingKittenRig, tangleRig, twinkleArt, yarnBallRig, type Hold, type RigNode } from './catArt';
import { ALL_PARTS, BALL_R, CAT_DURATION_MS, COVER_POMS, DRIFT, PART, RIM_FOLLOWS, STRAND_BASE, STRAND_SEGMENTS, TRAIL_START, catLayout, catSampleTimes, catScene, strandsOf, strandThickness, type CatLayout, type ScenePose, type TextRect } from './catTimeline';
import type { RevealEffect } from './types';
import './cat.css';

const FALLBACK_COLORS = ['#f6c453', '#7fb8d8', '#97c77d', '#c99ad8', '#ef9a8a', '#6cc3b2'];

function parseColor(color: string) {
  const hex = color.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  const rgb = hex
    ? (hex.length === 3 ? hex.split('').map((c) => parseInt(c + c, 16)) : [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)))
    : color.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i)?.slice(1, 4).map(Number);
  return rgb && rgb.every((value) => Number.isFinite(value)) ? rgb : null;
}
const mixColor = (color: string, toward: readonly number[], amount: number) => {
  const rgb = parseColor(color);
  return rgb ? `rgb(${rgb.map((value, i) => Math.round(value * (1 - amount) + toward[i] * amount)).join(', ')})` : color;
};

/** The yarn strand's shade: the team colour mixed 28% toward warm brown, so it reads on white and on its own knit. */
export const yarnShade = (color: string) => mixColor(color, [107, 45, 26], .28);
/** A candy-soft pastel tint of a team colour (the beanie stripes). */
export const pastel = (color: string) => mixColor(color, [255, 250, 246], .38);
/** A strand's opaque light line and its dark outline (like the yarn loops on the ball), baked from the team colour. */
const strandLight = (color: string) => mixColor(yarnShade(color), [255, 250, 246], .5);
const strandRim = (color: string) => mixColor(color, [74, 30, 22], .58);

/**
 * Where the names are: every visible line of text between the header and the
 * footer (outside the reveal layer), so the kitten can finish somewhere she
 * hides none of them. One read-only pass at mount.
 */
function measureTexts(top: number, bottom: number, width: number): TextRect[] {
  const root = document.querySelector('.student-show') ?? document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const rects: TextRect[] = [];
  for (let node = walker.nextNode(); node && rects.length < 600; node = walker.nextNode()) {
    if (!node.nodeValue?.trim()) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest('.reveal-effects-layer, .reveal-cover, .student-show-controls, .student-show-top, .sr-only, script, style')) continue;
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width > 2 && rect.height > 2 && rect.bottom > top && rect.top < bottom && rect.right > 0 && rect.left < width) rects.push({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
    }
  }
  return rects;
}

/**
 * Viewport, header, footer, the cards on screen with their team colours, and
 * where the names are, measured in one read-only pass (RevealCover already
 * wrote the cover variables in the same commit), so the Stage lays out and
 * bakes once. Also the reveal's clock: this commit is the one the teacher's
 * click rendered, when the reveal's stop timer and its sound start.
 */
function useCatLayout() {
  const [state, setState] = useState<{ layout: CatLayout; origin: number } | null>(null);
  useLayoutEffect(() => {
    const origin = performance.now();
    const update = () => {
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      const footer = document.querySelector('.student-show-controls')?.getBoundingClientRect().top;
      const header = document.querySelector('.student-show-top')?.getBoundingClientRect().bottom ?? 0;
      const footerTop = footer && footer > 0 ? footer : undefined;
      const covers = Array.from(document.querySelectorAll<HTMLElement>('.reveal-cover'))
        .map((cover) => ({ cover, rect: cover.getBoundingClientRect(), color: getComputedStyle(cover).getPropertyValue('--team-color').trim() }))
        .filter(({ rect }) => rect.right > 0 && rect.left < width && rect.bottom > 0 && rect.top < height)
        .sort((a, b) => (a.rect.left + a.rect.width / 2) - (b.rect.left + b.rect.width / 2) || a.rect.top - b.rect.top);
      const cards = covers.map(({ rect, color }, index) => ({ x: rect.left + rect.width / 2, top: rect.top, height: rect.height, width: rect.width, color: color || FALLBACK_COLORS[index % FALLBACK_COLORS.length] }));
      const texts = measureTexts(Math.max(0, header), footerTop ?? height, width);
      const layout = catLayout(width, height, footerTop, cards, texts, Math.max(0, header));
      // Covers with no strand of their own (upper rows) flick their yarn tail toward the ball as they start to unravel.
      const pulled = new Set(strandsOf(layout).map((card) => layout.cards.indexOf(card)));
      covers.forEach(({ cover }, index) => cover.querySelector('.cat-cover')?.toggleAttribute('data-loose', !pulled.has(index)));
      setState((current) => ({ layout, origin: current?.origin ?? origin }));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return state;
}

/** Collect every node id in a rig tree. */
function ids(node: RigNode, into: string[] = []) {
  into.push(node.id);
  node.behind?.forEach((child) => ids(child, into));
  node.children?.forEach((child) => ids(child, into));
  return into;
}

/** 30 samples per second (60 through the quick pop and the bound away) plus both sides of every expression/actor cut: linear playback between them is indistinguishable for this soft motion, and swaps are instant. */
const CAT_BAKE_FPS = 30;

/** How far a dropped keyframe may be from the straight line between its kept neighbours: px, px, degrees, scale, scale, opacity. */
const TOLERANCE = [.3, .3, .25, .003, .003, .01] as const;
const CHANNELS = TOLERANCE.length;
const transformOf = (v: Float64Array, i: number) => poseTransform({ x: v[i], y: v[i + 1], r: v[i + 2], sx: v[i + 3], sy: v[i + 4] }, 1);

/** The scene sampled once per layout and set of parts (each batch the Stage mounts only samples the parts it bakes). */
const samples = new WeakMap<CatLayout, Map<number, { times: number[]; poses: ScenePose[] }>>();
function sampled(layout: CatLayout, parts: number) {
  let byParts = samples.get(layout);
  if (!byParts) samples.set(layout, byParts = new Map());
  let found = byParts.get(parts);
  if (!found) {
    const times = catSampleTimes(CAT_BAKE_FPS, layout);
    byParts.set(parts, found = { times, poses: times.map((time) => catScene(time, layout, parts)) });
  }
  return found;
}

/**
 * Sample the whole scene once and split it into one keyframe list per node.
 * Playback is linear, so a sample that the straight line between its kept
 * neighbours already reproduces (within TOLERANCE, checked at the sample and
 * at a quarter, half and three quarters of the way back) is dropped: runs of identical values collapse to their ends
 * and steady motion keeps only a few keyframes. Cuts stay exact, because the
 * two sides of a cut never fit one line.
 */
export function bakeScene(layout: CatLayout, names: readonly string[], parts = ALL_PARTS) {
  const seconds = CAT_DURATION_MS / 1000;
  const { times, poses } = sampled(layout, parts);
  const count = times.length;
  const values = names.map(() => new Float64Array(count * CHANNELS));
  poses.forEach((pose, index) => {
    names.forEach((name, track) => {
      const p = pose[name]; const k = name.startsWith('str') ? 1 : layout.k; const v = values[track]; const at = index * CHANNELS;
      v[at] = (p?.x ?? 0) * k; v[at + 1] = (p?.y ?? 0) * k; v[at + 2] = p?.r ?? 0; v[at + 3] = p?.sx ?? 1; v[at + 4] = p?.sy ?? 1; v[at + 5] = p?.o ?? 1;
    });
  });
  return new Map(names.map((name, track) => {
    const v = values[track];
    // Keep each rotation continuous (a strand bar pointing left sits right on the -180/180 seam): playback interpolates
    // linearly, and a jump from 179 to -179 degrees would spin the bar the long way round between two samples.
    for (let i = 1; i < count; i++) {
      const at = i * CHANNELS + 2;
      while (v[at] - v[at - CHANNELS] > 180) v[at] -= 360;
      while (v[at] - v[at - CHANNELS] < -180) v[at] += 360;
    }
    // The channels this node ever changes: only those are checked, and only the properties that change are animated (an
    // eye or mouth only swaps opacity; most parts never fade), so there are fewer values for the browser to parse and
    // interpolate. A constant property stays as the node's first-paint inline style.
    const varies: number[] = [];
    for (let c = 0; c < CHANNELS; c++) for (let i = 1; i < count; i++) if (v[i * CHANNELS + c] !== v[c]) { varies.push(c); break; }
    const moves = varies.some((c) => c < 5); const fades = varies.includes(5);
    const off = (a: number, b: number, i: number) => {
      const u = (times[i] - times[a]) / Math.max(1e-9, times[b] - times[a]);
      for (const c of varies) if (Math.abs(v[i * CHANNELS + c] - (v[a * CHANNELS + c] + (v[b * CHANNELS + c] - v[a * CHANNELS + c]) * u)) > TOLERANCE[c]) return true;
      return false;
    };
    const kept = [0];
    if (varies.length) {
      for (let i = 1; i < count - 1; i++) {
        const a = kept[kept.length - 1];
        const mid = (a + i) >> 1;
        if (off(a, i + 1, i) || (mid > a && (off(a, i + 1, mid) || off(a, i + 1, (a + mid) >> 1) || off(a, i + 1, (mid + i) >> 1)))) kept.push(i);
      }
    }
    if (count > 1) kept.push(count - 1);
    return [name, kept.map((i): Keyframe => {
      const frame: Keyframe = { offset: Math.min(1, times[i] / seconds) };
      if (moves) frame.transform = transformOf(v, i * CHANNELS);
      if (fades) frame.opacity = String(Math.round(v[i * CHANNELS + 5] * 1000) / 1000);
      return frame;
    })];
  }));
}

/**
 * Each node animates only while it moves: its keyframes are trimmed to the
 * stretch between its first and last change and played with a delay (held
 * before and after by fill), so a hidden kitten's parts are not animations the
 * browser has to tick for the whole reveal. Null for a node that never moves.
 */
export function activeWindow(frames: readonly Keyframe[]) {
  const same = (a: Keyframe, b: Keyframe) => a.transform === b.transform && a.opacity === b.opacity;
  const first = frames.findIndex((frame) => !same(frame, frames[0]));
  if (first < 0) return null;
  let last = frames.length - 1;
  while (last > 0 && same(frames[last - 1], frames[frames.length - 1])) last--;
  const start = first - 1; const t0 = frames[start].offset as number; const t1 = frames[last].offset as number;
  const span = Math.max(1e-6, t1 - t0);
  return {
    keyframes: frames.slice(start, last + 1).map((frame) => ({ ...frame, offset: Math.min(1, Math.max(0, ((frame.offset as number) - t0) / span)) })),
    timing: { delay: t0 * CAT_DURATION_MS, duration: span * CAT_DURATION_MS, easing: 'linear' },
  };
}

const trailPath = (length: number) => `M0 -3C${length * .25} -9 ${length * .45} 1 ${length * .65} -4S${length - 14} -1 ${length} -6`;

/** Run `callback` once the next frame has been painted (so the work lands after it, not in it). */
function afterNextPaint(callback: () => void) {
  let timer = 0;
  const frame = requestAnimationFrame(() => { timer = window.setTimeout(callback, 0); });
  return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
}

const SIDE = sideKittenRig();
const TANGLE = tangleRig();
const SIT = sittingKittenRig();
const BALL = yarnBallRig(BALL_R);
const RIMS = new Set(Object.keys(RIM_FOLLOWS));
const actorNames = (rig: RigNode) => ids(rig).filter((id) => !RIMS.has(id));
const rimsOf = (rig: RigNode) => ids(rig).filter((id) => RIMS.has(id)).map((id) => [id, RIM_FOLLOWS[id]] as const);

/**
 * What each mount bakes. The first frame only mounts what plays first (the side-view kitten, her ball and the shadows);
 * the tangle, the strands and the finale mount after it, each once a frame has been painted, and join its clock.
 */
const GROUPS = {
  first: { parts: PART.side | PART.ball, names: [...actorNames(SIDE), ...actorNames(BALL), 'shadow', 'ballShadow', 'trail'], follow: rimsOf(SIDE) },
  tangle: { parts: PART.tangle, names: [...actorNames(TANGLE), 'poof1', 'shadow2'], follow: rimsOf(TANGLE) },
  finale: { parts: PART.sit | PART.pop, names: [...actorNames(SIT), 'lbShadow', 'twinkle', 'h1', 'h2', ...COVER_POMS.map((_, i) => `pp${i}`), ...DRIFT.map((_, i) => `pd${i}`)], follow: [] as (readonly [string, string])[] },
} as const;
const LAST_PHASE = 3;

type Nodes = RefObject<Map<string, Element>>;
type Group = { parts: number; names: readonly string[]; follow: readonly (readonly [string, string])[] };

/** Bake a group's tracks (and give each follower its source's keyframes) and play them on the shared clock. */
function useGroupTracks(layout: CatLayout, group: Group, nodes: Nodes, clock: BakedClock, origin?: number) {
  const bake = useCallback((): BakedTrack[] => {
    const tracks = bakeScene(layout, group.names, group.parts);
    const out: BakedTrack[] = [];
    // A node that never moves keeps its first-paint style (no animation at all).
    for (const name of group.names) {
      const win = activeWindow(tracks.get(name)!);
      if (win) out.push({ target: nodes.current.get(name), ...win });
    }
    for (const [follower, source] of group.follow) {
      const win = tracks.has(source) ? activeWindow(tracks.get(source)!) : null;
      if (win) out.push({ target: nodes.current.get(follower), ...win });
    }
    return out;
  }, [layout, group, nodes]);
  useBakedTracks(bake, CAT_DURATION_MS, BAKE_FPS, clock, origin);
}

function GroupTracks({ layout, group, nodes, clock, children }: { layout: CatLayout; group: Group; nodes: Nodes; clock: BakedClock; children: ReactNode }) {
  useGroupTracks(layout, group, nodes, clock);
  return <>{children}</>;
}

function CatStage() {
  const state = useCatLayout();
  return state ? <KittenScene layout={state.layout} origin={state.origin} /> : null;
}

function KittenScene({ layout, origin }: { layout: CatLayout; origin: number }) {
  const { k } = layout;
  // The tangle, the strands and the finale mount one at a time after the first frame.
  const [phase, setPhase] = useState(0);
  useEffect(() => (phase < LAST_PHASE ? afterNextPaint(() => setPhase(phase + 1)) : undefined), [phase]);
  const nodes = useRef(new Map<string, Element>());
  const hold = useCallback<Hold>((name) => (element) => {
    if (element) nodes.current.set(name, element);
    else nodes.current.delete(name);
  }, []);
  const clock = useRef<Animation | null>(null);
  // The Stage counts from the reveal's start (its stop timer and its sound started then): after a slow mount it skips ahead
  // instead of running late against them and being cut off at the end.
  useGroupTracks(layout, GROUPS.first, nodes, clock, origin);
  const strands = useMemo(() => strandsOf(layout), [layout]);
  const strandGroup = useMemo<Group>(() => {
    const names = strands.flatMap((_, j) => Array.from({ length: STRAND_SEGMENTS }, (__, i) => `str${j}.${i}`));
    return { parts: PART.strands, names, follow: names.map((name) => [`u${name}`, name] as const) };
  }, [strands]);
  // First paint (and the fallback where Web Animations are missing).
  const first = useMemo<ScenePose>(() => catScene(0, layout), [layout]);
  const colors = useMemo(() => {
    const unique = [...new Set(layout.cards.map((card) => card.color))];
    const list = [...unique, ...FALLBACK_COLORS].slice(0, 6);
    return Object.fromEntries(list.flatMap((color, index) => [[`--cat-c${index}`, color], [`--cat-p${index}`, pastel(color)]]));
  }, [layout]);
  const node = (name: string, className: string, content: ReactNode, pose = name) => <div key={name} ref={hold(name)} className={className} style={{ transform: poseTransform(first[pose], pose.startsWith('str') ? 1 : k), opacity: first[pose]?.o ?? 1 }}>{content}</div>;
  const svg = (box: readonly [number, number, number, number], el: ReactNode) => <svg className="cat-art" viewBox={box.join(' ')} style={{ left: box[0] * k, top: box[1] * k, width: box[2] * k, height: box[3] * k }} aria-hidden="true">{el}</svg>;
  const trailLength = (layout.ballX - TRAIL_START * k) / k;
  const thick = strandThickness(k);
  const bar = (width: number) => ({ width: STRAND_BASE, height: width, marginTop: -width / 2 });
  const strandStyle = (color: string) => ({ '--strand': yarnShade(color), '--strand-hi': strandLight(color), '--strand-rim': strandRim(color) }) as CSSProperties;
  // The stage stops at the footer bar's top edge.
  return <div className="cat-stage" style={{ ...colors, bottom: 'auto', height: layout.clip } as CSSProperties}>
    <CatDefs />
    {phase >= 2 && <GroupTracks layout={layout} group={strandGroup} nodes={nodes} clock={clock}>
      {/* Each strand's dark outline is a second chain of bars in a layer beneath all the bars, so the joints never show. */}
      {strands.map((card, j) => <div key={`u${j}`} style={strandStyle(card.color)}>{Array.from({ length: STRAND_SEGMENTS }, (__, i) => node(`ustr${j}.${i}`, 'cat-strand is-under', <i style={bar(thick + 4)} />, `str${j}.${i}`))}</div>)}
      {strands.map((card, j) => <div key={`s${j}`} style={strandStyle(card.color)}>{Array.from({ length: STRAND_SEGMENTS }, (_, i) => node(`str${j}.${i}`, 'cat-strand', <i style={bar(thick)} />))}</div>)}
    </GroupTracks>}
    {node('shadow', 'cat-node', svg([-130, -18, 260, 36], SHADOW_ART(118)))}
    {node('ballShadow', 'cat-node', svg([-44, -10, 88, 20], SHADOW_ART(38)))}
    {node('trail', 'cat-node', svg([0, -14, trailLength, 16], <g fill="none" strokeLinecap="round"><path d={trailPath(trailLength)} stroke="#fff6e6" strokeOpacity=".9" strokeWidth="6.4" /><path d={trailPath(trailLength)} stroke="#f08aa6" strokeWidth="3.8" /></g>))}
    <Rig node={BALL} k={k} pose={first} hold={hold} />
    <Rig node={SIDE} k={k} pose={first} hold={hold} />
    {phase >= 1 && <GroupTracks layout={layout} group={GROUPS.tangle} nodes={nodes} clock={clock}>
      {node('shadow2', 'cat-node', svg([-130, -18, 260, 36], SHADOW_ART(118)))}
      <Rig node={TANGLE} k={k} pose={first} hold={hold} />
      {node('poof1', 'cat-node', svg([-100, -28, 200, 40], DUST_ART))}
    </GroupTracks>}
    {phase >= 3 && <GroupTracks layout={layout} group={GROUPS.finale} nodes={nodes} clock={clock}>
      {node('lbShadow', 'cat-node', svg([-44, -10, 88, 20], SHADOW_ART(38)))}
      {node('twinkle', 'cat-node', svg([-190, -330, 380, 340], twinkleArt(layout.twinkles)))}
      <Rig node={SIT} k={k} pose={first} hold={hold} />
      {COVER_POMS.map((_, i) => node(`pp${i}`, 'cat-node', svg([-22, -22, 44, 44], POP_POM_ART)))}
      {DRIFT.map(({ kind }, i) => node(`pd${i}`, 'cat-node', svg([-15, -15, 30, 30], DRIFT_ART[kind])))}
      {node('h1', 'cat-node', svg([-28, -32, 56, 48], HEART_ART))}
      {node('h2', 'cat-node', svg([-28, -32, 56, 48], HEART_ART))}
    </GroupTracks>}
  </div>;
}

/** Knitted cover in the team colour. The window slides down while the knit counter-slides up, so rows vanish from the top in place (transforms only). */
function CatCover() {
  return <div className="cat-cover">
    <div className="cat-cover-window">
      <div className="cat-cover-knit">
        <svg className="cat-cover-heart" viewBox="0 0 70 60" aria-hidden="true">
          {HEART_STITCHES.map(([x, y]) => <path key={`${x}:${y}`} d={`M${x * 10 + 1} ${y * 10 + 1}C${x * 10 + 1} ${y * 10 + 7} ${x * 10 + 4} ${y * 10 + 9} ${x * 10 + 5} ${y * 10 + 10}C${x * 10 + 6} ${y * 10 + 9} ${x * 10 + 9} ${y * 10 + 7} ${x * 10 + 9} ${y * 10 + 1}C${x * 10 + 7} ${y * 10 + 2} ${x * 10 + 5} ${y * 10 + 5} ${x * 10 + 5} ${y * 10 + 6}C${x * 10 + 5} ${y * 10 + 5} ${x * 10 + 3} ${y * 10 + 2} ${x * 10 + 1} ${y * 10 + 1}Z`} />)}
        </svg>
      </div>
      <i className="cat-cover-edge" />
    </div>
    {/* The yarn tail: a soft strand in the team colour hanging from the top cuff, with a little pom-pom at its end (where the strand grows from). */}
    <svg className="cat-cover-end" viewBox="-16 -2 32 60" aria-hidden="true">
      <g className="u"><path d={YARN_TAIL} /><circle cx="0" cy="52" r="8.6" /></g>
      <path className="c" d={YARN_TAIL} />
      <path className="p" d={TAIL_POM} />
      <path className="s" d="M6.2 50.5A6.6 6.6 0 0 1-3.4 57.6A7.4 7.4 0 0 0 6.2 50.5Z" />
      <path className="h" d="M-.6 3C1.4 9-1.8 15-.8 21" />
      <ellipse className="h" cx="-2.4" cy="49.4" rx="2.6" ry="1.9" />
    </svg>
  </div>;
}

const YARN_TAIL = 'M0 0C3 9-3 17 0 26C3 35-2 40 0 45';
/** A small fluffy pom-pom (radius about 7) at (0, 52). */
const TAIL_POM = (() => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a0 = i / 10 * Math.PI * 2; const a1 = (i + 1) / 10 * Math.PI * 2; const am = (a0 + a1) / 2;
    const p = (a: number, r: number) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r + 52).toFixed(2)}`;
    d += `${i ? '' : `M${p(a0, 6.1)}`}Q${p(am, 8.1)} ${p(a1, 6.1)}`;
  }
  return `${d}Z`;
})();

/** A knitted pixel heart (7 x 6 stitches). */
const HEART_STITCHES: readonly (readonly [number, number])[] = [
  [1, 0], [2, 0], [4, 0], [5, 0],
  [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
  [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
  [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
  [2, 4], [3, 4], [4, 4],
  [3, 5],
];

export const catEffect: RevealEffect = {
  id: 'cat',
  name: 'Kitten & yarn',
  description: 'A cuddly ginger kitten hops onto a ball of yarn and rolls along in a happy tangle that unravels every knitted cover, then pops out in a striped beanie, gives the class a slow, happy blink and bounds off after her little ball of yarn.',
  durationMs: CAT_DURATION_MS,
  sound: 'cat',
  Stage: CatStage,
  Cover: CatCover,
};
