import { memo, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ARM_LEAD_MS, BALLOON_DURATION_MS, BUNCH, EYE_SIZE, FEATHER_VANE, FOOTER_PX, HEADER_PX, HEART, HOG_SCALE, INHALE_ARM_MS, PAINT_END_MS, PALETTE, PAW, QUILLS, RING_ARM_MS, SETTLE_ARM_MS, SQUASH_Y,
  ahMouth, airAngle, balloonPose, rotateAbout, bunchPopTimes, burstPoints, isDense, cardConfetti, coverClearAt, coverFocus, coverLayout, exitSamples, focalFor, hangSamples, knotPoint, paperShards, pawPoint, popArmMs, popAt, provisionalScene, quillOuter, rigTransform, ringMaxRadius, sceneFor,
  type BalloonColor, type BalloonPose, type ConfettiPiece, type CoverBalloon, type CoverBunch, type CoverFocus, type CoverLayout, type Focal, type MouthState, type Rect, type Scene, type Viewport,
} from './balloonsTimeline';
import { useRevealTargets, type RevealTarget } from './revealTargets';
import type { RevealEffect } from './types';
import './balloons.css';

const INK = '#4a2c38';
const MOUTH = '#6b3a3f';
const SKIN = '#eab58f';
const SKIN_LINE = '#d3946e';
const STRING = '#8d7f75';
type Vars = CSSProperties & Record<`--${string}`, string | number>;
const RIG_VIEWBOX = '-260 -400 520 560';
/** A rig-unit point as a vmin offset inside the 52 x 56 vmin rig box. */
const box = (x: number, y: number) => [(x + 260) / 10, (y + 400) / 10] as const;
const PAW_BOX = box(PAW.x, PAW.y);
const BELLY_BOX = box(0, SQUASH_Y * HOG_SCALE);
const HEART_BOX = box(HEART.x, HEART.y);
const vm = (value: number) => `${value.toFixed(2)}vmin`;
/** Rotate about the paw (in vmin, for a layer whose transform-origin is the rig box's top left). */
const aboutPaw = (degrees: number) => `translate(${vm(PAW_BOX[0])}, ${vm(PAW_BOX[1])}) rotate(${degrees.toFixed(2)}deg) translate(${vm(-PAW_BOX[0])}, ${vm(-PAW_BOX[1])})`;

// ---------------------------------------------------------------------------
// Balloon art (shared by the hedgehog's bunch and the cards). Local units, body centre at 0,0.

const ROUND_BODY = 'M0 -57C28 -57 46 -35 46 -7C46 23 24 47 4 55L0 57L-4 55C-24 47 -46 23 -46 -7C-46 -35 -28 -57 0 -57Z';
const HEART_BODY = 'M0 42C-30 20 -46 2 -46 -18C-46 -34 -34 -44 -20 -44C-10 -44 -3 -38 0 -30C3 -38 10 -44 20 -44C34 -44 46 -34 46 -18C46 2 30 20 0 42Z';
const STAR_POINTS = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 21 : 44; pts.push(`${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`); }
  return `M${pts.join('L')}Z`;
})();
const STAR_SEAMS = [0, 2, 4, 6, 8].map((i) => { const a = -Math.PI / 2 + i * Math.PI / 5; return `M0 0L${(38 * Math.cos(a)).toFixed(1)} ${(38 * Math.sin(a)).toFixed(1)}`; }).join('');
/** A question mark as a path (no font), about 88 units tall, centred on 0,0. */
const QUESTION_HOOK = 'M-21 -14C-21 -29 -10 -37 1 -37C14 -37 22 -28 22 -17C22 -6 14 -1 7 3C2 6 0 10 0 17';

/** Art-unit box around the body centre for each kind: [minX, minY, width, height, unitsPerWidth]. */
const ART_BOX = { round: [-60, -70, 120, 142, 92], heart: [-56, -54, 112, 108, 92], star: [-58, -58, 116, 112, 100] } as const;

function QuestionMark({ outline }: { outline: string }) {
  return <g strokeLinecap="round" fill="none">
    <path d={QUESTION_HOOK} stroke={outline} strokeWidth={21} strokeLinejoin="round" />
    <circle cy={35} r={12} fill={outline} />
    <path d={QUESTION_HOOK} stroke="#fff" strokeWidth={14} strokeLinejoin="round" />
    <circle cy={35} r={8.5} fill="#fff" />
  </g>;
}

function BalloonArt({ kind, color, question = false, sticker = false }: { kind: 'round' | 'heart' | 'star'; color: BalloonColor; question?: boolean; sticker?: boolean }) {
  const [base, shade] = PALETTE[color];
  if (kind === 'heart') {
    return <g>
      {sticker && <path d={HEART_BODY} fill="#fff" stroke="#fff" strokeWidth={13} strokeLinejoin="round" />}
      <path d="M-4 41L4 41L2 48L-2 48Z" fill={shade} />
      <path d={HEART_BODY} fill={base} stroke={shade} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M0 42C30 20 46 2 46 -18C46 -26 43 -33 38 -37C42 -20 34 2 0 42Z" fill={shade} opacity={.42} />
      <path d="M-34 -20C-34 -30 -26 -37 -17 -36" stroke="#fff" strokeWidth={6} fill="none" strokeLinecap="round" opacity={.8} />
      <circle cx={-34} cy={-7} r={3} fill="#fff" opacity={.7} />
    </g>;
  }
  if (kind === 'star') {
    return <g>
      {sticker && <path d={STAR_POINTS} fill="#fff" stroke="#fff" strokeWidth={22} strokeLinejoin="round" />}
      <path d="M-4 42L4 42L2 48L-2 48Z" fill={shade} />
      <path d={STAR_POINTS} fill={shade} stroke={shade} strokeWidth={12} strokeLinejoin="round" />
      <path d={STAR_POINTS} fill={base} stroke={base} strokeWidth={6.5} strokeLinejoin="round" />
      <path d="M0 4L14 -2L40 -10L20 12L26 40L4 24Z" fill={shade} opacity={.28} />
      <path d={STAR_SEAMS} stroke="#fff6c2" strokeWidth={2} opacity={.85} />
      <path d="M-20 -13L-9 -19" stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={.85} />
      <circle cx={-26} cy={-4} r={2.6} fill="#fff" opacity={.8} />
    </g>;
  }
  return <g>
    {sticker && <path d={ROUND_BODY} fill="#fff" stroke="#fff" strokeWidth={13} strokeLinejoin="round" />}
    <path d="M-6 56L6 56L4 64L-4 64Z" fill={shade} />
    <path d={ROUND_BODY} fill={base} stroke={shade} strokeWidth={2.5} />
    <path d="M0 57C24 47 46 23 46 -7C46 -21 41 -33 33 -42C38 -27 38 -3 28 19C20 35 10 45 0 57Z" fill={shade} opacity={.45} />
    <ellipse cx={-10} cy={-24} rx={30} ry={26} fill="#fff" opacity={.13} />
    <ellipse cx={-19} cy={-28} rx={10} ry={18} transform="rotate(28 -19 -28)" fill="#fff" opacity={.62} />
    <circle cx={-26} cy={-3} r={4} fill="#fff" opacity={.55} />
    {question && <g transform="translate(1 -5) scale(.64)"><QuestionMark outline={shade} /></g>}
  </g>;
}

/** A balloon as its own small SVG, positioned so its body centre sits on the parent's origin. */
function BalloonSvg({ balloon, tail = false }: { balloon: CoverBalloon; tail?: boolean }) {
  const [minX, minY, w, box, unit] = ART_BOX[balloon.kind];
  const scale = balloon.width / unit;
  // Day-table balloons carry their own string (straight down to the cell edge), so it inflates and pops with them.
  const knot = { x: (balloon.knot.x - balloon.centre.x) / scale, y: (balloon.knot.y - balloon.centre.y) / scale };
  const anchor = { x: (balloon.anchor.x - balloon.centre.x) / scale, y: (balloon.anchor.y - balloon.centre.y) / scale };
  const h = tail ? Math.max(box, anchor.y + 4 - minY) : box;
  return <svg className="bp-art" width={w * scale} height={h * scale} viewBox={`${minX} ${minY} ${w} ${h}`} style={{ left: minX * scale, top: minY * scale }}>
    {tail && <path d={`M${knot.x.toFixed(1)} ${knot.y.toFixed(1)}Q${(knot.x - 4).toFixed(1)} ${((knot.y + anchor.y) / 2).toFixed(1)} ${anchor.x.toFixed(1)} ${anchor.y.toFixed(1)}`} stroke={STRING} strokeWidth={1.6 / scale} fill="none" strokeLinecap="round" />}
    <g transform={balloon.rot ? `rotate(${balloon.rot})` : undefined}><BalloonArt kind={balloon.kind} color={balloon.color} question={balloon.hero} /></g>
  </svg>;
}

const BURST_OUTER = burstPoints(12, .6);
const BURST_INNER = burstPoints(10, .62);
const BURST_LINES = Array.from({ length: 8 }, (_, i) => { const a = (i * 45 + 22.5) * Math.PI / 180; return `M${(1.14 * Math.cos(a)).toFixed(3)} ${(1.14 * Math.sin(a)).toFixed(3)}L${(1.4 * Math.cos(a)).toFixed(3)} ${(1.4 * Math.sin(a)).toFixed(3)}`; }).join('');
const BURST_SCRAPS = [[.98, -.5, 30], [-1.02, -.3, -40], [.3, 1.08, 70], [-.62, .92, -15]] as const;

/** Cartoon pop: a bold jagged star in the balloon's colour with a white flash, speed ticks and rubber scraps. */
function BurstSvg({ radius, color }: { radius: number; color: BalloonColor }) {
  const [base, shade] = PALETTE[color];
  const box = 1.6;
  return <svg width={radius * box * 2} height={radius * box * 2} viewBox={`${-box} ${-box} ${box * 2} ${box * 2}`} style={{ left: -radius * box, top: -radius * box }}>
    <path d={BURST_LINES} stroke={shade} strokeWidth={.13} strokeLinecap="round" />
    <path d={BURST_OUTER} fill={base} stroke="#fff" strokeWidth={.14} strokeLinejoin="round" paintOrder="stroke" />
    <path d={BURST_OUTER} fill="none" stroke={shade} strokeWidth={.05} strokeLinejoin="round" />
    <path d={BURST_INNER} transform="scale(.62) rotate(14)" fill="#fffbe8" />
    <circle r={.16} fill="#fff" />
    {BURST_SCRAPS.map(([x, y, r]) => <path key={r} d="M-.2 0Q0 -.15 .2 0Q0 .07 -.2 0Z" transform={`translate(${x} ${y}) rotate(${r})`} fill={base} stroke={shade} strokeWidth={.035} />)}
  </svg>;
}

// ---------------------------------------------------------------------------
// The party hedgehog (hog units, face centre 0,0; scaled by 1.3 into the rig).

/** Back quills: spikes alternate inner/outer radii; `outer(spike)` lets one prickle stand out. */
function quillPath(inner: number, outer: (spike: number) => number, n: number, from: number, to: number, cy: number) {
  const pts: string[] = [];
  for (let i = 0; i <= n * 2; i++) {
    const a = (from + (to - from) * i / (n * 2)) * Math.PI / 180;
    const r = i % 2 ? outer((i - 1) / 2) : inner;
    pts.push(`${(r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M0 ${cy}L${pts.join('L')}Z`;
}
const BACK_QUILLS = quillPath(QUILLS.inner, quillOuter, QUILLS.count, QUILLS.from, QUILLS.to, QUILLS.cy);
const FRONT_QUILLS = quillPath(52, () => 72, 7, 170, 370, 8);
const QUILL_SHINE = Array.from({ length: 7 }, (_, j) => {
  const a = (170 + 200 * (2 * j + 1) / 14) * Math.PI / 180;
  const b = a - .09;
  return `M${(50 * Math.cos(b)).toFixed(1)} ${(8 + 50 * Math.sin(b)).toFixed(1)}L${(64 * Math.cos(a - .03)).toFixed(1)} ${(8 + 64 * Math.sin(a - .03)).toFixed(1)}`;
}).join('');
/** A highlight down the long prickle, so the one the heart lands on reads as a proper spike. */
const LONG_QUILL_SHINE = (() => {
  const a = (QUILLS.from + (QUILLS.to - QUILLS.from) * (2 * QUILLS.long + 1) / (QUILLS.count * 2)) * Math.PI / 180;
  const at = (r: number, da = 0) => `${(r * Math.cos(a + da)).toFixed(1)} ${(QUILLS.cy + r * Math.sin(a + da)).toFixed(1)}`;
  return `M${at(70, -.05)}L${at(QUILLS.longOuter - 12, -.01)}`;
})();
const FACE = 'M-56 10C-58 -30 -30 -48 0 -48C30 -48 58 -30 56 10C54 48 30 72 0 72C-30 72 -54 48 -56 10Z';
const RIGHT_ARM = 'M46 34Q66 -6 62 -60';
const SHOULDER = { x: -45, y: 36 } as const;

const QuillSticker = memo(function QuillSticker() {
  return <path d={BACK_QUILLS} fill="#fff" stroke="#fff" strokeWidth={17} strokeLinejoin="round" />;
});

const QuillArt = memo(function QuillArt() {
  return <>
    <path d={BACK_QUILLS} fill="#7b4f36" stroke="#6a4230" strokeWidth={9} strokeLinejoin="round" />
    <path d={FRONT_QUILLS} fill="#9c6a4a" stroke="#9c6a4a" strokeWidth={7} strokeLinejoin="round" />
    <path d={QUILL_SHINE} stroke="#bd8b64" strokeWidth={3.2} strokeLinecap="round" opacity={.8} />
    <path d={LONG_QUILL_SHINE} stroke="#c89670" strokeWidth={3.4} strokeLinecap="round" opacity={.85} />
  </>;
});

const StaticStickers = memo(function StaticStickers() {
  return <g fill="#fff" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
    <path d={RIGHT_ARM} fill="none" strokeWidth={27} />
    <circle cx={62} cy={-64} r={16} strokeWidth={0} />
    <path d={FACE} strokeWidth={17} />
  </g>;
});

const FaceArt = memo(function FaceArt({ clipId }: { clipId: string }) {
  return <>
    {[-1, 1].map((side) => <g key={side}>
      <ellipse cx={side * 40} cy={-42} rx={12.5} ry={11.5} fill={SKIN} stroke={SKIN_LINE} strokeWidth={1.4} />
      <ellipse cx={side * 40} cy={-41} rx={6.2} ry={5.6} fill="#ffb8c1" />
    </g>)}
    <clipPath id={clipId}><path d={FACE} /></clipPath>
    <path d={FACE} fill="#ffe4c4" />
    <g clipPath={`url(#${clipId})`}>
      <ellipse cx={34} cy={46} rx={50} ry={52} fill="#f5c79c" opacity={.5} />
      <ellipse cx={0} cy={50} rx={30} ry={21} fill="#fff4e4" />
      <ellipse cx={-26} cy={-26} rx={24} ry={13} transform="rotate(-24 -26 -26)" fill="#fff" opacity={.42} />
    </g>
    <path d={FACE} fill="none" stroke="#d9a37e" strokeWidth={2} />
  </>;
});

const Hat = memo(function Hat() {
  return <g strokeLinejoin="round">
    <path d="M-14 -54L20 -60L12 -118Z" fill="#fff" stroke="#fff" strokeWidth={9} />
    <circle cx={12} cy={-120} r={11} fill="#fff" />
    <path d="M-14 -54L20 -60L12 -118Z" fill="#2bb3a3" stroke="#1f8f83" strokeWidth={2.5} />
    <path d="M4 -56L20 -60L12 -118Z" fill="#1f8f83" opacity={.35} />
    <path d="M-7 -69L18 -73M-1 -88L15 -91M5 -105L13 -106" stroke="#ffd23f" strokeWidth={6.5} strokeLinecap="round" />
    <circle cx={12} cy={-120} r={8} fill="#ff8fc8" stroke="#e2629f" strokeWidth={2} />
    <circle cx={9.5} cy={-122.5} r={2.4} fill="#fff" opacity={.8} />
  </g>;
});

const RightArm = memo(function RightArm() {
  return <g strokeLinecap="round" fill="none">
    <path d={RIGHT_ARM} stroke={SKIN_LINE} strokeWidth={18} />
    <path d={RIGHT_ARM} stroke={SKIN} strokeWidth={15} />
    <circle cx={62} cy={-64} r={10.5} fill={SKIN} stroke={SKIN_LINE} strokeWidth={1.6} />
    <path d="M55 -66Q59 -63 63 -66M56 -60Q60 -57 64 -60" stroke={SKIN_LINE} strokeWidth={1.6} />
  </g>;
});

const FEATHER_BARBS = 'M1 -14L-7 -21M2 -24L-9 -33M3 -35L-8 -45M4 -47L-6 -58M6 -60L-2 -70M3 -19L12 -27M4 -31L14 -40M6 -44L14 -52M7 -57L13 -66';
const SNEEZE_SPARKLES = [200, 250, 290, 340, 20, 160].map((angle, i) => ({ angle: angle * Math.PI / 180, r: 112 + (i % 2) * 24, color: ['#ffd23f', '#ff8fc8', '#3fa3f0'][i % 3] }));
const SPARKLE = 'M0 -13L4 -4L13 0L4 4L0 13L-4 4L-13 0L-4 -4Z';
const MOUTHS: readonly MouthState[] = ['smile', 'o', 'ah', 'laugh', 'grin', 'wobble'];
const SIDES = [-1, 1] as const;

/** The sneeze clouds (rig units around his elbow, and their size). */
const PUFF_CLOUDS = [{ x: -94, y: 40, k: 1.2 }, { x: 96, y: 46, k: 1.1 }, { x: -40, y: 98, k: .8 }] as const;
const cloudTransform = (index: number, size: number) => {
  const { x, y, k } = PUFF_CLOUDS[index];
  return `translate(${x} ${y}) scale(${(k * size).toFixed(3)})`;
};

/** A sneeze cloud; the painter shrinks each one about its own middle as the puff clears. */
function Cloud({ index, refTo }: { index: number; refTo: Ref }) {
  return <g ref={refTo(`cloud${index}`)} transform={cloudTransform(index, 1)}>
    <g fill="#fff" stroke="#cfc8e8" strokeWidth={4}><circle cx={-16} cy={4} r={16} /><circle cx={0} cy={-6} r={19} /><circle cx={17} cy={4} r={15} /><circle cx={0} cy={10} r={14} /></g>
    <g fill="#fff"><circle cx={-16} cy={4} r={14} /><circle cx={0} cy={-6} r={17} /><circle cx={17} cy={4} r={13} /><circle cx={0} cy={10} r={12} /></g>
    <ellipse cx={-6} cy={-12} rx={9} ry={5} fill="#f1eefc" />
  </g>;
}

const BunchBalloons = memo(function BunchBalloons() {
  return <>{BUNCH.map((balloon) => <g key={balloon.id} transform={`translate(${balloon.x} ${balloon.y}) rotate(${balloon.rot}) scale(${balloon.width / (balloon.kind === 'star' ? 100 : 92)})`}>
    <BalloonArt kind={balloon.kind} color={balloon.color} sticker />
  </g>)}</>;
});

/** Rig geometry written by the painter is snapped to half units: small drifts only repaint when they show. */
const half = (value: number) => (Math.round(value * 2) / 2).toFixed(1);

/**
 * The strings in the bunch's own frame (before the bunch's rotation). They live in their own thin layer that
 * turns with the bunch, so they only need redrawing when the paw moves relative to it (swing, squash, lean) or
 * the heart floats off, and the balloon art itself is never redrawn.
 */
function stringsPath(pose: BalloonPose) {
  const paw = rotateAbout(pawPoint(pose), PAW, -pose.bunchRot);
  const flat = { ...pose, bunchRot: 0 };
  const curve = (knot: { x: number; y: number }, sag: number) => {
    const mx = (paw.x + knot.x) / 2;
    const my = (paw.y + knot.y) / 2;
    return `M${half(paw.x)} ${half(paw.y)}Q${half(mx + 9 + sag)} ${half(my + 7 + sag * .6)} ${half(knot.x)} ${half(knot.y)}`;
  };
  const heartKnot = knotPoint({ x: HEART.x, y: HEART.y, knot: HEART.knot, rot: HEART.rot }, flat, pose.heartDx, pose.heartDy, pose.heartRot);
  const slack = Math.max(0, Math.hypot(HEART.x - PAW.x, HEART.y + HEART.knot - PAW.y) - Math.hypot(heartKnot.x - paw.x, heartKnot.y - paw.y));
  return BUNCH.map((balloon) => curve(knotPoint(balloon, flat), 0)).join('') + curve(heartKnot, slack * .5);
}

/** A worried or surprised brow (hog units): `worry` raises the inner end, `lift` raises the whole brow. */
function browPath(side: -1 | 1, lift: number, worry: number) {
  const inner = { x: side * 10, y: -23 - lift - 8 * worry };
  const outer = { x: side * 30, y: -20 - lift + 4.5 * worry };
  const control = { x: side * 20, y: -28 - lift - 3 * worry };
  return `M${inner.x} ${inner.y.toFixed(1)}Q${control.x} ${control.y.toFixed(1)} ${outer.x} ${outer.y.toFixed(1)}`;
}

type Ref = (name: string) => (node: Element | null) => void;

/** CSS transforms of the rig's vmin layers for one pose (the same on every screen). Nothing in the rig fades. */
function layerStyles(pose: BalloonPose) {
  const f = (value: number, digits = 2) => value.toFixed(digits);
  const tip = vm(HEART.tip / 10);
  const [featherX, featherY] = box(pose.featherX, pose.featherY);
  return {
    bunch: aboutPaw(pose.bunchRot),
    // The heart swings with the bunch, turns about its centre and dents about its tip (along its own axis).
    heart: `${aboutPaw(pose.bunchRot)} translate(${vm(HEART_BOX[0] + pose.heartDx / 10)}, ${vm(HEART_BOX[1] + pose.heartDy / 10)}) rotate(${f(pose.heartRot + HEART.rot)}deg) translate(0, ${tip}) scale(${f(pose.heartSx, 3)}, ${f(pose.heartSy, 3)}) translate(0, -${tip}) rotate(${-HEART.rot}deg) translate(${vm(-HEART_BOX[0])}, ${vm(-HEART_BOX[1])})`,
    // Body: squash and lean about the belly, bob, then the pendulum swing about the paw (as hogToRig).
    body: `${aboutPaw(pose.swing)} translate(${vm(BELLY_BOX[0])}, ${vm(BELLY_BOX[1] + pose.bodyY * HOG_SCALE / 10)}) rotate(${f(pose.tilt)}deg) scale(${f(pose.sx, 4)}, ${f(pose.sy, 4)}) translate(${vm(-BELLY_BOX[0])}, ${vm(-BELLY_BOX[1])})`,
    // Drawn mirrored; it pops in and shrinks away by its size.
    feather: `translate(${vm(featherX)}, ${vm(featherY)}) rotate(${f(pose.featherRot, 1)}deg) scale(${f(-pose.featherSize, 3)}, ${f(pose.featherSize, 3)})`,
  };
}

/** Keyframes are sampled at 60 per second: every frame of the scene clock, interpolated linearly by the browser. */
const LAYER_SAMPLES = Math.round(BALLOON_DURATION_MS / 1000 * 60);
/** The strings ride with the bunch (same track) in a thin layer of their own, drawn behind the balloons. */
const LAYERS = ['strings', 'bunch', 'heart', 'body', 'feather'] as const;
type LayerName = (typeof LAYERS)[number];

let poseTrack: BalloonPose[] | null = null;
/** The pose at every keyframe sample (pure, so worked out once per page). */
const posesAtSamples = () => poseTrack ??= Array.from({ length: LAYER_SAMPLES + 1 }, (_, i) => balloonPose(i / LAYER_SAMPLES * BALLOON_DURATION_MS / 1000));

let layerTrackCache: Record<LayerName, Keyframe[]> | null = null;
/** The vmin layers' keyframes do not depend on the screen: built once per page and reused by every reveal. */
function layerTracks(): Record<LayerName, Keyframe[]> {
  if (!layerTrackCache) {
    const bunch: Keyframe[] = [];
    const heart: Keyframe[] = [];
    const body: Keyframe[] = [];
    const feather: Keyframe[] = [];
    posesAtSamples().forEach((pose, i) => {
      const styles = layerStyles(pose);
      const offset = i / LAYER_SAMPLES;
      bunch.push({ offset, transform: styles.bunch });
      heart.push({ offset, transform: styles.heart });
      body.push({ offset, transform: styles.body });
      feather.push({ offset, transform: styles.feather });
    });
    layerTrackCache = { strings: bunch, bunch, heart, body, feather };
  }
  return layerTrackCache;
}

/** The rig's own track (the only one that depends on the screen). */
const rigTrack = (scene: Scene): Keyframe[] => posesAtSamples().map((pose, i) => ({ offset: i / LAYER_SAMPLES, transform: rigTransform(pose, scene) }));

/** Work the tracks out while the page is idle, so the first reveal's first frame stays light. */
export function warmBalloonTracks() {
  layerTracks();
  hangSamples();
  exitSamples();
}
if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') window.requestIdleCallback(warmBalloonTracks, { timeout: 4000 });

const LAYER_TIMING: KeyframeAnimationOptions = { duration: BALLOON_DURATION_MS, fill: 'both' };

/**
 * The rig's layers are driven by Web Animations built from the pose track, so the browser moves them without
 * any per-frame script or style writes (and without re-layerizing the page).
 */
function animateLayers(nodes: Map<string, Element>, scene: Scene) {
  const tracks = layerTracks();
  const rigNode = nodes.get('rig') as HTMLElement | undefined;
  return {
    rig: rigNode?.animate(rigTrack(scene), LAYER_TIMING),
    layers: LAYERS.map((name) => (nodes.get(name) as HTMLElement | undefined)?.animate(tracks[name], LAYER_TIMING)),
  };
}

/**
 * The rig's track alone, rebuilt for a new scene (the hang spot found after the first frame, or a new screen size;
 * the other layers are in vmin and keep their animations). It keeps the old animation's start time, so it stays on
 * exactly the same clock as the covers; a paused (review) clock stays paused at the same time.
 */
function replaceRigAnimation(old: Animation, node: HTMLElement, scene: Scene) {
  const start = old.startTime;
  const time = Number(old.currentTime ?? 0);
  const paused = old.playState === 'paused';
  old.cancel();
  const animation = node.animate(rigTrack(scene), LAYER_TIMING);
  if (paused) { animation.pause(); animation.currentTime = time; } else if (typeof start === 'number') animation.startTime = start;
  else animation.currentTime = time;
  return animation;
}

/**
 * Writes the hedgehog's SVG features for one pose (eyes, mouth, brows, arm, feet, quills,
 * hat, strings, sneeze puff). Values are rounded and cached, so a held pose writes nothing.
 */
class RigPainter {
  private readonly written = new Map<string, string>();
  constructor(private readonly nodes: Map<string, Element>) {}

  private set(name: string, key: string, value: string, write: (node: Element) => void) {
    const id = `${name}|${key}`;
    if (this.written.get(id) === value) return;
    const node = this.nodes.get(name);
    if (!node) return;
    this.written.set(id, value);
    write(node);
  }
  attr(name: string, attribute: string, value: string) { this.set(name, attribute, value, (node) => node.setAttribute(attribute, value)); }
  show(name: string, visible: boolean) { this.attr(name, 'display', visible ? 'inline' : 'none'); }

  paint(pose: BalloonPose) {
    const f = (value: number, digits = 2) => value.toFixed(digits);
    /** Snap to a step so slow drifts and small jitters only repaint when the change is visible. */
    const q = (value: number, step: number) => f(Math.round(value / step) * step, 2);
    this.attr('stringPath', 'd', stringsPath(pose));
    const quills = `translate(0 8) scale(${q(pose.quills, .01)}) translate(0 -8)`;
    this.attr('quillSticker', 'transform', quills);
    this.attr('quills', 'transform', quills);
    const wave = `rotate(${half(pose.armWave)} ${SHOULDER.x} ${SHOULDER.y})`;
    const arm = `M${SHOULDER.x} ${SHOULDER.y}Q${half(pose.armCx)} ${half(pose.armCy)} ${half(pose.armEx)} ${half(pose.armEy)}`;
    for (const name of ['armSticker', 'arm']) this.attr(name, 'transform', wave);
    for (const name of ['armStickerPath', 'armLine', 'armFill']) this.attr(name, 'd', arm);
    for (const name of ['armStickerPaw', 'armPaw']) { this.attr(name, 'cx', half(pose.armEx)); this.attr(name, 'cy', half(pose.armEy)); }
    const open = pose.eyes === 'open' || pose.eyes === 'half' || pose.eyes === 'cross';
    const lidded = pose.eyes === 'half' && pose.lid > 0;
    for (const side of SIDES) {
      const foot = `rotate(${q(side < 0 ? -12 + pose.kick : 14 - pose.kick, 1.5)} ${side * 22} 74)`;
      this.attr(`footSticker${side}`, 'transform', foot);
      this.attr(`foot${side}`, 'transform', foot);
      this.attr(`cheek${side}`, 'rx', q(9 * pose.cheeks, .5));
      this.attr(`cheek${side}`, 'ry', q(6 * pose.cheeks, .5));
      this.show(`eyeOpen${side}`, open);
      this.show(`eyeHappy${side}`, pose.eyes === 'happy');
      this.show(`eyeClosed${side}`, pose.eyes === 'closed');
      this.show(`eyeSqueeze${side}`, pose.eyes === 'squeeze');
      if (open) {
        const cross = pose.eyes === 'cross';
        // Cross-eyed: both pupils on the feather at the left of his nose.
        const px = Number(q(cross ? (side < 0 ? 2.4 : -3.8) : Math.max(-3.8, Math.min(3.8, pose.lookX)), .5));
        const py = Number(q(cross ? 2.8 : Math.max(-4.4, Math.min(3.8, pose.lookY)), .5));
        this.attr(`eyeOpen${side}`, 'transform', `translate(${side * 20} -4) scale(${f(pose.eyeScale)})`);
        this.attr(`pupil${side}`, 'transform', `translate(${f(px, 1)} ${f(py, 1)})`);
        this.show(`lid${side}`, lidded);
        if (lidded) {
          // Heavy upper lids droop lower on every "ah" (their edge rounds over the eyeball) while the cheeks push up from below.
          const lid = Math.round(pose.lid * 40) / 40;
          const upper = -12.5 + 17 * lid;
          const lower = 12.5 - 4.5 * lid;
          this.attr(`lidFill${side}`, 'd', `M-13 -16H13V${f(upper - 5, 1)}Q0 ${f(upper + 5, 1)} -13 ${f(upper - 5, 1)}ZM-13 16H13V${f(lower - 2, 1)}Q0 ${f(lower + 4, 1)} -13 ${f(lower - 2, 1)}Z`);
          this.attr(`lidLine${side}`, 'd', `M-12 ${f(upper - 5, 1)}Q0 ${f(upper + 5.4, 1)} 12 ${f(upper - 5, 1)}`);
          this.attr(`lidLow${side}`, 'd', `M-9 ${f(lower - 1.5, 1)}Q0 ${f(lower + 3.6, 1)} 9 ${f(lower - 1.5, 1)}`);
        }
      }
      this.attr(`brow${side}`, 'd', browPath(side, Math.round(pose.browLift * 2) / 2, Math.round(pose.browWorry * 20) / 20));
    }
    this.show('brows', pose.brows > .01);
    this.attr('brows', 'opacity', f(pose.brows, 2));
    this.attr('features', 'transform', `translate(0 ${f(-pose.head, 1)})`);
    const nose = Math.round(pose.nose * 50) / 50;
    this.attr('nose', 'transform', `translate(${q(pose.noseX, .5)} ${f(11 * (1 - nose), 2)}) scale(${f(nose, 2)})`);
    const flare = Math.min(1, Math.max(0, (pose.nose - 1) / .12));
    this.show('flare', flare > .02);
    this.attr('flare', 'opacity', q(flare, .1));
    for (const mouth of MOUTHS) this.show(`mouth-${mouth}`, pose.mouth === mouth);
    if (pose.mouth === 'ah') {
      const { rx, ry, cy } = ahMouth(pose.mouthOpen);
      this.attr('ahOuter', 'rx', f(rx, 1)); this.attr('ahOuter', 'ry', f(ry, 1)); this.attr('ahOuter', 'cy', f(cy, 1));
      this.attr('ahTongue', 'rx', f(rx * .66, 1)); this.attr('ahTongue', 'ry', f(ry * .34, 1)); this.attr('ahTongue', 'cy', f(cy + ry * .56, 1));
    }
    this.attr('hat', 'transform', `translate(0 ${f(-pose.hatLift, 1)}) rotate(${f(pose.hatRot, 1)} 3 -86)`);
    // The sneeze clouds spread from his elbow while each one shrinks to nothing: a puff, never a see-through ghost.
    this.show('puff', pose.puffSize > 0);
    if (pose.puffSize > 0) {
      this.attr('puff', 'transform', `translate(0 30) scale(${f(pose.puffScale, 3)}) translate(0 -30)`);
      const size = Math.round(pose.puffSize * 50) / 50;
      PUFF_CLOUDS.forEach((_, i) => this.attr(`cloud${i}`, 'transform', cloudTransform(i, size)));
    }
    // Sparkles fly out and twinkle away by shrinking.
    this.show('sparkles', pose.sparkleSize > 0);
    if (pose.sparkleSize > 0) {
      const size = f(Math.round(pose.sparkleSize * 50) / 50, 2);
      SNEEZE_SPARKLES.forEach(({ angle, r }, i) => {
        const d = r + pose.sparkleR;
        this.attr(`sparkle${i}`, 'transform', `translate(${f(d * Math.cos(angle), 1)} ${f(20 + d * Math.sin(angle), 1)}) scale(${size})`);
      });
    }
  }
}

/** The hedgehog's face: every expression is drawn once and switched on by the painter. */
function Face({ refTo }: { refTo: Ref }) {
  return <g ref={refTo('features')}>
    {SIDES.map((side) => <ellipse key={side} ref={refTo(`cheek${side}`)} cx={side * 34} cy={15} rx={9} ry={6} fill="#ff9fae" opacity={.8} />)}
    {SIDES.map((side) => <g key={side}>
      <g ref={refTo(`eyeOpen${side}`)} transform={`translate(${side * 20} -4)`}>
        <ellipse rx={EYE_SIZE.rx} ry={EYE_SIZE.ry} fill="#fff" stroke={INK} strokeWidth={1.7} />
        <g ref={refTo(`pupil${side}`)}>
          <ellipse rx={7.6} ry={9.6} fill="#2a1f2b" />
          <ellipse cy={3} rx={5.2} ry={5} fill="#4d3548" opacity={.9} />
          <circle cx={2.6} cy={-3.8} r={2.9} fill="#fff" />
          <circle cx={-2.6} cy={3.6} r={1.4} fill="#fff" />
        </g>
        <g ref={refTo(`lid${side}`)} display="none">
          <path ref={refTo(`lidFill${side}`)} fill="#ffe4c4" />
          <path ref={refTo(`lidLine${side}`)} stroke={INK} strokeWidth={2.8} fill="none" strokeLinecap="round" />
          <path ref={refTo(`lidLow${side}`)} stroke={INK} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={.7} />
        </g>
      </g>
      <path ref={refTo(`eyeHappy${side}`)} display="none" d={`M${side * 20 - 9} -2Q${side * 20} -14 ${side * 20 + 9} -2`} stroke={INK} strokeWidth={4.2} fill="none" strokeLinecap="round" />
      <path ref={refTo(`eyeClosed${side}`)} display="none" d={`M${side * 20 - 9} -4Q${side * 20} 4 ${side * 20 + 9} -4`} stroke={INK} strokeWidth={3.6} fill="none" strokeLinecap="round" />
      <path ref={refTo(`eyeSqueeze${side}`)} display="none" d={`M${side * 20 + side * 9} -12L${side * 20 - side * 7} -4L${side * 20 + side * 9} 4`} stroke={INK} strokeWidth={4.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>)}
    <g ref={refTo('brows')} display="none" stroke={INK} strokeWidth={4.2} fill="none" strokeLinecap="round">
      {SIDES.map((side) => <path key={side} ref={refTo(`brow${side}`)} />)}
    </g>
    <ellipse cx={0} cy={14} rx={15} ry={10} fill="#fff0dc" />
    <path ref={refTo('mouth-smile')} d="M-8 21Q-4 26 0 22Q4 26 8 21" stroke={MOUTH} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <ellipse ref={refTo('mouth-o')} display="none" cx={0} cy={26} rx={4.5} ry={5.5} fill={MOUTH} />
    <g ref={refTo('mouth-ah')} display="none"><ellipse ref={refTo('ahOuter')} cx={0} cy={26} rx={6} ry={6} fill={MOUTH} /><ellipse ref={refTo('ahTongue')} cx={0} cy={30} rx={4} ry={2} fill="#ff8fa0" /></g>
    <g ref={refTo('mouth-laugh')} display="none"><path d="M-11 21Q0 39 11 21Q0 25 -11 21Z" fill={MOUTH} /><path d="M-6 30Q0 34 6 30" stroke="#ff8fa0" strokeWidth={4} strokeLinecap="round" /></g>
    <g ref={refTo('mouth-grin')} display="none"><path d="M-9 21Q0 33 9 21Q0 24 -9 21Z" fill={MOUTH} /><path d="M-4 27.5Q0 30 4 27.5" stroke="#ff8fa0" strokeWidth={3} strokeLinecap="round" /></g>
    <path ref={refTo('mouth-wobble')} display="none" d="M-9 24Q-6 20.5 -3 24T3 24T9 24" stroke={MOUTH} strokeWidth={2.6} fill="none" strokeLinecap="round" />
    <g ref={refTo('nose')}>
      <path ref={refTo('flare')} display="none" d="M-10.5 7.5Q-13 11 -10.5 14.5M10.5 7.5Q13 11 10.5 14.5" stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <ellipse cx={0} cy={11} rx={7.5} ry={5.8} fill={INK} />
      <ellipse cx={-2.4} cy={9} rx={2} ry={1.5} fill="#fff" />
    </g>
  </g>;
}

function Foot({ side, sticker, refTo }: { side: -1 | 1; sticker?: boolean; refTo: Ref }) {
  const x = side * 22;
  return <g ref={refTo(`${sticker ? 'footSticker' : 'foot'}${side}`)}>
    {sticker ? <ellipse cx={x} cy={80} rx={14} ry={10} fill="#fff" stroke="#fff" strokeWidth={16} /> : <>
      <ellipse cx={x} cy={80} rx={14} ry={10} fill={SKIN} stroke={SKIN_LINE} strokeWidth={1.4} />
      {[-4, 2, 8].map((dx, i) => <circle key={dx} cx={x + side * dx - side * 2} cy={i === 1 ? 76 : 78} r={2.5} fill="#ffb8c1" />)}
    </>}
  </g>;
}

/** Named SVG/HTML nodes of the rig, registered by callback refs (one callback per name). */
function rigNodes() {
  const nodes = new Map<string, Element>();
  const callbacks = new Map<string, (node: Element | null) => void>();
  const refTo: Ref = (name) => {
    let callback = callbacks.get(name);
    if (!callback) {
      callback = (node) => { if (node) nodes.set(name, node); else nodes.delete(name); };
      callbacks.set(name, callback);
    }
    return callback;
  };
  return { nodes, refTo };
}

/**
 * True from `frames` animation frames after mount. The pop pieces (bursts, the flying "?", torn paper and
 * confetti) are only seen from 3.6 s, so they are added after the reveal's first frame: that frame (which
 * starts the show against the sound) stays light. They are added without animations (those are only created
 * when the rig's clock arms them, see revealArmer), so they cost no compositor layers while they wait.
 * Where the rig cannot arm them (no Web Animations), everything is created at once and plain CSS runs it.
 */
const LATE_FRAMES = 3;
function useAfterFirstFrame(frames: number) {
  const [ready, setReady] = useState(() => !lazySupported());
  useLayoutEffect(() => (ready ? undefined : afterFrames(frames, () => setReady(true))), [ready, frames]);
  return ready;
}

/** Calls `done` after `frames` animation frames; returns the cancel. */
function afterFrames(frames: number, done: () => void) {
  let id = 0;
  const wait = (left: number) => { id = requestAnimationFrame(() => (left > 1 ? wait(left - 1) : done())); };
  wait(frames);
  return () => cancelAnimationFrame(id);
}

/** The rig's clock can arm late animations (and put them on its own start time) only with Web Animations. */
const lazySupported = () => typeof document !== 'undefined' && typeof Element !== 'undefined'
  && typeof Element.prototype.animate === 'function' && typeof Element.prototype.getAnimations === 'function';

/** The CSS animations each arming creates (only these are moved onto the rig's clock). */
const INHALE_ANIMATIONS: ReadonlySet<string> = new Set(['bp-pull', 'bp-lean', 'bp-air']);
const POP_ANIMATIONS: ReadonlySet<string> = new Set(['bp-out', 'bp-pop', 'bp-burst', 'bp-qfly', 'bp-drop', 'bp-shard', 'bp-paper-puff']);
const LIVE_ANIMATIONS: ReadonlySet<string> = new Set(['bp-ring', 'bp-confetti']);
/**
 * A card's pops when its own pop time is unknown: the CSS default for --bp-pop (the ring halfway out), so the
 * paper always tears even if a card could not be measured.
 */
export const DEFAULT_POP_MS = Math.round(popAt(.5) * 1000);
/**
 * Moments (reveal ms) when the armer looks for covers and confetti groups to arm: they are all mounted within the
 * first few frames, so a few looks are plenty (a resize adds one on the next frame).
 */
export const ARM_SCANS = [0, 1000, 2400, 3300] as const;

type Arming = { node: HTMLElement; attribute: string; variable: string | null; names: ReadonlySet<string> | null; when: () => number; at: number };

/**
 * Arms the reveal's late animations on the rig's clock. Each cover is armed four times: once its balloons have filled
 * (data-settled) the finished early animations are removed, its inhale (data-inhale) and its pops (data-pop) are
 * created 200 ms before they first move, and once every piece has gone the whole cover is taken away (data-done).
 * The stage's ring and each card's confetti are armed the same way (data-live, from their data-arm-at).
 * The arm times are known in advance and already sit in CSS variables that the delays subtract
 * (--bp-ti, --bp-tp, --bp-t0), so arming only sets an attribute: just the gated pieces are restyled, and the new
 * animations start when they should on any engine (at worst a frame late); then each one gets the rig's start time
 * plus its arm time, which makes it exact. A paused clock (a frozen review frame) arms with the variables at 0, so
 * every delay counts from the reveal's start, and leaves the seeking to the reviewer. Nothing is ever paused,
 * played or seeked here. (Exported for its unit test.)
 */
export function revealArmer() {
  let pending: Arming[] = [];
  const found = new WeakSet<Element>();
  const placed = new WeakSet<Animation>();
  const scans: number[] = [...ARM_SCANS];
  let rescanDue = false;
  const add = (node: HTMLElement, attribute: string, variable: string | null, names: ReadonlySet<string> | null, when: () => number) => {
    if (!node.hasAttribute(attribute)) pending.push({ node, attribute, variable, names, when, at: when() });
  };
  const collect = () => {
    for (const cover of Array.from(document.querySelectorAll<HTMLElement>('.bp-cover[data-lazy]'))) {
      if (found.has(cover)) continue;
      found.add(cover);
      const popMs = () => Number(cover.dataset.popAt) || DEFAULT_POP_MS;
      add(cover, 'data-settled', null, null, () => SETTLE_ARM_MS);
      add(cover, 'data-inhale', '--bp-ti', INHALE_ANIMATIONS, () => INHALE_ARM_MS);
      add(cover, 'data-pop', '--bp-tp', POP_ANIMATIONS, () => popArmMs(popMs()));
      add(cover, 'data-done', null, null, () => Number(cover.dataset.clearAt) || Math.round(coverClearAt(popMs() / 1000) * 1000));
    }
    for (const node of Array.from(document.querySelectorAll<HTMLElement>('.bp-stage[data-lazy] [data-arm-at]'))) {
      if (found.has(node)) continue;
      found.add(node);
      add(node, 'data-live', '--bp-t0', LIVE_ANIMATIONS, () => Number(node.dataset.armAt) || 0);
    }
    // Arm times are read again on every look (a resize can move a card's pops).
    for (const item of pending) item.at = item.when();
  };
  const tick = (elapsed: number, rigStart: number | null, frozen: boolean) => {
    // A frozen review frame looks every frame: pieces mounting a frame or two late must be armed before it is seeked.
    let look = rescanDue || frozen;
    rescanDue = false;
    while (scans.length && elapsed >= scans[0]) { scans.shift(); look = true; }
    if (look) collect();
    if (!pending.length) return;
    const armed: Arming[] = [];
    pending = pending.filter((item) => {
      if (!(item.at <= elapsed)) return true;
      if (!item.node.hasAttribute(item.attribute)) {
        // A review frame is seeked from the reveal's start, so there the delays must count from 0.
        if (frozen && item.variable) item.node.style.setProperty(item.variable, '0ms');
        item.node.setAttribute(item.attribute, '');
        armed.push(item);
      }
      return false;
    });
    if (frozen || rigStart === null) return;
    // The first look flushes style once, creating every animation armed this frame; each joins the rig's clock.
    for (const item of armed) {
      if (!item.names) continue;
      for (const animation of item.node.getAnimations({ subtree: true })) {
        if (placed.has(animation)) continue;
        const name = (animation as Animation & { animationName?: string }).animationName;
        if (!name || !item.names.has(name)) continue;
        placed.add(animation);
        animation.startTime = rigStart + item.at;
      }
    }
  };
  return { tick, rescan: () => { rescanDue = true; } };
}

/**
 * If no stage arms a card (it always should), the card arms itself this long after it mounts, so its names are
 * never left covered (its pops then happen at once, a little late).
 */
export const SELF_ARM_MS = Math.round(popAt(1) * 1000) + 600;
function selfArm(cover: HTMLElement, elapsed: number) {
  for (const [attribute, variable] of [['data-inhale', '--bp-ti'], ['data-pop', '--bp-tp']] as const) {
    if (cover.hasAttribute(attribute)) continue;
    cover.style.setProperty(variable, `${Math.round(elapsed)}ms`);
    cover.setAttribute(attribute, '');
  }
}

/** The cards' early animations, which start with the reveal itself. */
const EARLY_ANIMATIONS: ReadonlySet<string> = new Set(['bp-inflate', 'bp-hop', 'bp-q-out', 'bp-grow', 'bp-bow-in', 'bp-sway', 'bp-bob']);
/** The most of the opening (ms) that joining the click's clock may skip (the reveal sound gives up after 250 ms). */
export const MAX_START_SKIP_MS = 1000;

/**
 * Puts the reveal on the clock of the click that started it, which is the clock the reveal sound plays from: the
 * rig, its layers and every card's early animations start at `origin` (document timeline ms) instead of at the first
 * painted frame, which on a slow machine can come a few hundred milliseconds later (the pictures then catch up with
 * the sound by skipping that much of the opening hold, rather than trailing it all the way). Late animations follow,
 * since they are armed on the rig's start time. Done only where the engine lists a card's child animations, so the
 * cards and the rig can never part. Returns whether it did. (Exported for its unit test.)
 */
export function startOnClock(origin: number, rigAnimations: readonly (Animation | undefined)[]) {
  const covers = Array.from(document.querySelectorAll<HTMLElement>('.bp-cover'));
  const early: Animation[] = [];
  let deep = covers.length === 0;
  for (const cover of covers) {
    for (const animation of cover.getAnimations({ subtree: true })) {
      if ((animation.effect as KeyframeEffect | null)?.target !== cover) deep = true;
      const name = (animation as Animation & { animationName?: string }).animationName;
      if (name && EARLY_ANIMATIONS.has(name)) early.push(animation);
    }
  }
  if (!deep) return false;
  for (const animation of [...rigAnimations, ...early]) if (animation) animation.startTime = origin;
  return true;
}

/**
 * Plays the rig: Web Animations move its layers, and one animation-frame loop updates the SVG
 * features and arms the late animations. `rescale` rebuilds the screen-size-dependent track.
 *
 * The loop reads its time from the rig's own Web Animation, not from its own clock, so his face,
 * arm, hat, strings and puffs stay in step with his body, the feather, the ring and the pops.
 * Given the click's time (`origin`), the first frame puts the rig and the cards on it (startOnClock);
 * otherwise they all begin on the first painted frame. Once he is off the top of the screen the loop
 * stops: the rest (confetti) runs without script. (Exported for its unit test.)
 */
export function playRig(nodes: Map<string, Element>, scene: Scene, origin: number | null = null) {
  const painter = new RigPainter(nodes);
  const animations = animateLayers(nodes, scene);
  let rig = animations.rig;
  // Only for a browser without Web Animations (the layers then stay put, but the face still acts).
  const started = performance.now();
  let frame = 0;
  const arm = lazySupported() ? revealArmer() : null;
  let onClock = origin === null;
  const tick = (now: number) => {
    if (!onClock && rig) {
      onClock = true;
      // The first frame: join the clock of the click (the sound's), unless this is a paused review frame; never
      // skipping more than MAX_START_SKIP_MS of the opening, whatever held the first frame up.
      const timeline = document.timeline?.currentTime;
      const start = typeof timeline === 'number' ? Math.max(origin!, timeline - MAX_START_SKIP_MS) : origin!;
      if (rig.playState !== 'paused' && lazySupported()) startOnClock(start, [rig, ...animations.layers]);
    }
    const current = rig ? rig.currentTime : now - started;
    const elapsed = Math.max(0, Math.min(BALLOON_DURATION_MS, current == null ? 0 : Number(current)));
    painter.paint(balloonPose(elapsed / 1000));
    if (arm && rig) {
      const start = rig.startTime;
      arm.tick(elapsed, typeof start === 'number' ? start : null, rig.playState === 'paused');
    }
    if (elapsed >= PAINT_END_MS || rig?.playState === 'finished') return;
    frame = requestAnimationFrame(tick);
  };
  painter.paint(balloonPose(0));
  frame = requestAnimationFrame(tick);
  return {
    rescale(next: Scene) {
      const node = nodes.get('rig') as HTMLElement | undefined;
      // Covers re-measure on a resize: look for new arm times on the next frame.
      arm?.rescan();
      if (node && rig) rig = replaceRigAnimation(rig, node, next);
    },
    stop() {
      cancelAnimationFrame(frame);
      rig?.cancel();
      for (const animation of animations.layers) animation?.cancel();
    },
  };
}

/** The hedgehog's body art, drawn once inside the swing and squash layers. */
const HogArt = memo(function HogArt({ refTo }: { refTo: Ref }) {
  const clipId = `bp${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-face`;
  return <svg viewBox={RIG_VIEWBOX}><g transform={`scale(${HOG_SCALE})`}>
    <g ref={refTo('armSticker')}><path ref={refTo('armStickerPath')} stroke="#fff" strokeWidth={27} strokeLinecap="round" fill="none" /><circle ref={refTo('armStickerPaw')} r={16} fill="#fff" /></g>
    <StaticStickers />
    <Foot side={-1} sticker refTo={refTo} /><Foot side={1} sticker refTo={refTo} />
    <g ref={refTo('quillSticker')}><QuillSticker /></g>
    <Foot side={-1} refTo={refTo} /><Foot side={1} refTo={refTo} />
    <g ref={refTo('quills')}><QuillArt /></g>
    <FaceArt clipId={clipId} />
    <Face refTo={refTo} />
    <g ref={refTo('hat')}><Hat /></g>
    <RightArm />
    <g ref={refTo('arm')} strokeLinecap="round" fill="none">
      <path ref={refTo('armLine')} stroke={SKIN_LINE} strokeWidth={18} />
      <path ref={refTo('armFill')} stroke={SKIN} strokeWidth={15} />
      <circle ref={refTo('armPaw')} r={9.5} fill={SKIN} stroke={SKIN_LINE} strokeWidth={1.5} />
    </g>
  </g></svg>;
});

/** Everything drawn in the rig. Rendered once; RigPainter moves it. */
const HedgehogRig = memo(function HedgehogRig({ scene, nodes, refTo, origin }: { scene: Scene; nodes: Map<string, Element>; refTo: Ref; origin: number | null }) {
  const player = useRef<ReturnType<typeof playRig> | null>(null);
  const firstScene = useRef(scene);
  useLayoutEffect(() => {
    const playing = playRig(nodes, firstScene.current, origin);
    player.current = playing;
    return () => { playing.stop(); player.current = null; };
  }, [nodes, origin]);
  useLayoutEffect(() => { if (scene !== firstScene.current) player.current?.rescale(scene); }, [scene]);
  return <div className="bp-rig" ref={refTo('rig')}>
    {/* The strings redraw as the paw moves, so they have a thin layer of their own; the balloon art is drawn once. */}
    <div className="bp-layer" ref={refTo('strings')}>
      <svg viewBox={RIG_VIEWBOX}><path ref={refTo('stringPath')} stroke={STRING} strokeWidth={3} fill="none" strokeLinecap="round" /></svg>
    </div>
    <div className="bp-layer" ref={refTo('bunch')}>
      <svg viewBox={RIG_VIEWBOX}><BunchBalloons /></svg>
    </div>
    <div className="bp-layer" ref={refTo('body')}>
      <HogArt refTo={refTo} />
    </div>
    {/* The heart swings with the bunch but is drawn in front of him, so it visibly sits on the prickle. */}
    <div className="bp-layer" ref={refTo('heart')}>
      <svg viewBox={RIG_VIEWBOX}><g transform={`translate(${HEART.x} ${HEART.y}) rotate(${HEART.rot}) scale(${HEART.width / 92})`}><BalloonArt kind="heart" color="pink" sticker /></g></svg>
    </div>
    <div className="bp-feather" ref={refTo('feather')}>
      <svg viewBox="-30 -100 60 112">
        <path d={FEATHER_VANE} fill="#fff" stroke="#fff" strokeWidth={8} strokeLinejoin="round" />
        <path d="M1 6L0 -2" stroke="#fff" strokeWidth={8} strokeLinecap="round" />
        <path d={FEATHER_VANE} fill="#ff8fc8" stroke="#e2629f" strokeWidth={2} strokeLinejoin="round" />
        <path d="M2 -10C1 -34 4 -62 9 -88C12 -70 12 -48 10 -30C9 -22 6 -14 2 -10Z" fill="#ffc0df" opacity={.8} />
        <path d={FEATHER_BARBS} stroke="#fff" strokeWidth={1.7} strokeLinecap="round" opacity={.7} />
        <path d="M1 6C2 -20 4 -56 9 -90" stroke="#c94a88" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      </svg>
    </div>
    <svg viewBox={RIG_VIEWBOX}>
      <g ref={refTo('puff')} display="none">{PUFF_CLOUDS.map((_, i) => <Cloud key={i} index={i} refTo={refTo} />)}</g>
      <g ref={refTo('sparkles')} display="none">
        {SNEEZE_SPARKLES.map(({ color }, i) => <path key={i} ref={refTo(`sparkle${i}`)} d={SPARKLE} fill={color} stroke="#fff" strokeWidth={3} paintOrder="stroke" />)}
      </g>
    </svg>
  </div>;
});

// ---------------------------------------------------------------------------
// Stage: the rig paints itself; the ring and the confetti are placed once and run on CSS.

function Confetto({ piece }: { piece: ConfettiPiece }) {
  const [base] = PALETTE[piece.color];
  const style: Vars = {
    left: piece.x, top: piece.y, color: base,
    '--bx': `${piece.bx.toFixed(1)}px`, '--by': `${piece.by.toFixed(1)}px`, '--fall': `${piece.fall.toFixed(1)}px`,
    '--sway': `${piece.sway.toFixed(1)}px`, '--spin': `${piece.spin.toFixed(0)}deg`, '--tilt': `${piece.tilt.toFixed(0)}deg`,
    // The delay counts from when the rig's clock armed this card's confetti (--bp-t0; 0 when it runs on plain CSS).
    animationDelay: `calc(${piece.delayMs}ms - var(--bp-t0, 0ms))`, animationDuration: `${piece.durationMs}ms`,
  };
  return <i className={`bp-confetto is-${piece.kind}`} style={style}>
    {piece.kind === 'sparkle' && <svg viewBox="-14 -14 28 28"><path d={SPARKLE} fill="currentColor" stroke="#fff" strokeWidth={3} paintOrder="stroke" /></svg>}
    {piece.kind === 'streamer' && <svg viewBox="-2 -8 44 16"><path d="M1 0q5 -7 10 0t10 0t10 0t10 0" stroke="currentColor" strokeWidth={4.2} fill="none" strokeLinecap="round" /></svg>}
  </i>;
}

/** The ring element is drawn at a third of its final size and scaled up 3x, so its layer is cheap to rasterize at the payoff. */
const RING_DRAW = 1 / 3;
/** Wind streaks riding on the sneeze ring's bright band: [start angle, span (degrees), radius (100 = the ring's edge)]. */
const RING_STREAKS = [[6, 12, 91], [67, 14, 89.5], [128, 11, 91.5], [187, 13, 90], [248, 12, 91], [309, 14, 89]] as const;

/** A thin crescent along a circle (viewBox units): pointed at both ends, `width` thick in the middle. */
function crescent(radius: number, from: number, span: number, width: number) {
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const s = i / 12;
    const a = (from + span * s) * Math.PI / 180;
    const half = width * Math.sin(Math.PI * s) / 2;
    outer.push(`${((radius + half) * Math.cos(a)).toFixed(2)} ${((radius + half) * Math.sin(a)).toFixed(2)}`);
    inner.unshift(`${((radius - half) * Math.cos(a)).toFixed(2)} ${((radius - half) * Math.sin(a)).toFixed(2)}`);
  }
  return `M${outer.join('L')}L${inner.join('L')}Z`;
}

/**
 * Tapered motion lines on the shockwave's bright band: at most 6 px (blue) with a 2.5 px white core on screen when
 * the ring is full size, so about 3-4 px while it sweeps across the cards.
 */
function ringStreaks(radius: number) {
  const unit = 100 / Math.max(1, radius);
  return {
    edge: RING_STREAKS.map(([from, span, r]) => crescent(r, from, span, 6 * unit)).join(''),
    core: RING_STREAKS.map(([from, span, r]) => crescent(r, from + span * .15, span * .7, 2.5 * unit)).join(''),
  };
}

/**
 * The sneeze ring and every card's confetti. They depend only on the focal point (not the hang spot), and they are
 * armed by the rig's clock: the ring at RING_ARM_MS, each card's confetti 200 ms before that card first pops.
 */
const BurstLayer = memo(function BurstLayer({ targets, focal }: { targets: RevealTarget[]; focal: Focal }) {
  const radius = ringMaxRadius(focal);
  const drawn = radius * RING_DRAW;
  const streaks = ringStreaks(radius);
  // The confetti comes after the covers' own pop pieces, so the work is spread over a few frames.
  const late = useAfterFirstFrame(LATE_FRAMES + 1);
  const cards = late ? targets.map((target) => ({ target, pieces: cardConfetti(target, targets.length, focal) })) : [];
  // Where the rig's clock arms them, their delays count from their arm time (--bp-t0).
  const armedAt = (ms: number): Vars => (lazySupported() ? { '--bp-t0': `${ms}ms` } : {});
  return <>
    <div className="bp-ring" data-arm-at={RING_ARM_MS} style={{ left: focal.fx, top: focal.fy, width: drawn * 2, height: drawn * 2, marginLeft: -drawn, marginTop: -drawn, ...armedAt(RING_ARM_MS) }}>
      <svg viewBox="-100 -100 200 200">
        <path d={streaks.edge} fill="#72bbef" opacity={.9} />
        <path d={streaks.core} fill="#fff" />
      </svg>
    </div>
    {cards.map(({ target, pieces }) => {
      if (!pieces.length) return null;
      const armAt = Math.min(...pieces.map((piece) => piece.delayMs)) - ARM_LEAD_MS;
      return <div key={target.index} className="bp-bits" data-arm-at={armAt} style={armedAt(armAt)}>
        {pieces.map((piece) => <Confetto key={piece.key} piece={piece} />)}
      </div>;
    })}
  </>;
});

/** Every balloon cover's rectangle, in the shared left-to-right order (one read pass). */
function readCovers() {
  const covers = Array.from(document.querySelectorAll<HTMLElement>('.bp-cover'));
  const rects = covers.map((cover) => cover.getBoundingClientRect());
  const order = covers.map((_, index) => index).sort((a, b) =>
    (rects[a].left + rects[a].width / 2) - (rects[b].left + rects[b].width / 2) || rects[a].top - rects[b].top);
  return { covers, rects, order };
}

/**
 * Every piece of text on screen that is not under a cover (names, titles, station labels, table headings),
 * read once: the hedgehog hangs where none of it is covered. Text behind the header or the footer
 * controls (drawn above the stage) cannot be covered, so it is skipped.
 */
function readTexts(viewport: Viewport): Rect[] {
  const texts: Rect[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue?.trim()) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest('.reveal-cover, .bp-cover, .bp-stage, script, style')) continue;
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width < 1 || rect.height < 1 || rect.bottom <= HEADER_PX || rect.top >= viewport.height - FOOTER_PX || rect.right <= 0 || rect.left >= viewport.width) continue;
      texts.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    }
  }
  return texts;
}

const viewportNow = () => ({ width: Math.max(1, window.innerWidth), height: Math.max(1, window.innerHeight) });
const sameScene = (a: Scene, b: Scene) => a.width === b.width && a.height === b.height && a.fx === b.fx && a.fy === b.fy && a.scale === b.scale
  && a.hangX === b.hangX && a.hangY === b.hangY && a.hangScale === b.hangScale && a.side === b.side && a.exitRise === b.exitRise && a.exitDrift === b.exitDrift;

/** Frames after mount before the hang spot is searched for (it is only used from the sneeze at 3.6 s). */
export const HANG_SEARCH_FRAMES = 2;

/**
 * The scene for this screen (focal point, hang spot and rig size), from the same covers the cards measure. The first
 * frame gets the focal point with a provisional hang straight up; reading every text on screen and searching for the
 * spot that keeps them all readable waits a couple of frames, so the reveal's first frame stays light.
 */
function useBalloonScene(): Scene | null {
  const [scene, setScene] = useState<Scene | null>(null);
  useLayoutEffect(() => {
    const update = (full: boolean) => {
      const viewport = viewportNow();
      const rects = readCovers().rects;
      const next = full ? sceneFor(viewport, rects, readTexts(viewport)) : provisionalScene(viewport, rects);
      setScene((current) => current && sameScene(current, next) ? current : next);
    };
    const search = () => update(true);
    update(false);
    const cancel = afterFrames(HANG_SEARCH_FRAMES, search);
    window.addEventListener('resize', search);
    return () => { cancel(); window.removeEventListener('resize', search); };
  }, []);
  return scene;
}

/** The document timeline's time now (the clock animations start on), or null where there is none. */
const revealOrigin = () => {
  const time = typeof document !== 'undefined' ? document.timeline?.currentTime : null;
  return typeof time === 'number' ? time : null;
};

const ANIMATION_EVENTS = ['animationstart', 'animationend', 'animationiteration', 'animationcancel'] as const;
/**
 * Hundreds of the reveal's CSS animations start and end; nothing listens to them, so while it plays they stop at
 * the window instead of each running through the app's event system (React's root listener).
 */
function useQuietAnimationEvents() {
  useLayoutEffect(() => {
    const quiet = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.bp-stage, .bp-cover')) event.stopImmediatePropagation();
    };
    for (const type of ANIMATION_EVENTS) window.addEventListener(type, quiet, true);
    return () => { for (const type of ANIMATION_EVENTS) window.removeEventListener(type, quiet, true); };
  }, []);
}

function BalloonStage() {
  const targets = useRevealTargets();
  const scene = useBalloonScene();
  useQuietAnimationEvents();
  // The ring and the confetti only need the focal point: they are not rebuilt when the hang spot arrives.
  const { width, height, fx, fy, scale } = scene ?? { width: 0, height: 0, fx: 0, fy: 0, scale: 0 };
  const focal = useMemo<Focal | null>(() => (width > 0 ? { width, height, fx, fy, scale } : null), [width, height, fx, fy, scale]);
  // One registry of named nodes for the rig.
  const [{ nodes, refTo }] = useState(rigNodes);
  // When the reveal started (the click), on the clock its animations use: the sound plays from this moment.
  const [origin] = useState(revealOrigin);
  return <div className="bp-stage" data-lazy={lazySupported() ? '' : undefined}>
    {focal && <BurstLayer targets={targets} focal={focal} />}
    {scene && <HedgehogRig scene={scene} nodes={nodes} refTo={refTo} origin={origin} />}
  </div>;
}

// ---------------------------------------------------------------------------
// Cover: measured once (batched for every card), then pure CSS.

type CoverState = { layout: CoverLayout; focus: CoverFocus; popMs: number[]; dense: boolean };
const coverStates = new WeakMap<Element, CoverState>();
let measuredForResize = -1;

function coverStateFor(rect: Rect, variant: number, dense: boolean, scene: Focal): CoverState {
  const focus = coverFocus(rect, scene);
  const layout = coverLayout(rect.width, rect.height, variant);
  return { layout, focus, popMs: bunchPopTimes(rect, layout, scene, focus).map((time) => Math.round(time * 1000)), dense };
}

/** One read pass over every balloon cover (ordered left to right like the shared measure), then state per cover. */
function measureBalloonCovers() {
  const { covers, rects, order } = readCovers();
  const scene = focalFor(viewportNow(), rects);
  const dense = isDense(covers.length);
  order.forEach((coverIndex, index) => coverStates.set(covers[coverIndex], coverStateFor(rects[coverIndex], index, dense, scene)));
}

function stringPath(balloon: CoverBalloon) {
  const dx = balloon.knot.x - balloon.anchor.x;
  const dy = balloon.knot.y - balloon.anchor.y;
  const bend = balloon.hero ? -.06 : balloon.knot.x < balloon.anchor.x ? .1 : -.1;
  return `M0 0Q${(dx / 2 - dy * bend).toFixed(1)} ${(dy / 2 + dx * bend).toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)}`;
}

/**
 * Where the balloon's "?" hops as it spins off and shrinks away (times the balloon's width): up and to the right,
 * into the card's empty side, because names, titles and station labels always sit on the left.
 */
export const QFLY_RISE = .45;
export const QFLY_DX = .35;

function CoverBalloonView({ balloon, index, strip, flyAway, late }: { balloon: CoverBalloon; index: number; strip: boolean; flyAway: boolean; late: boolean }) {
  const { anchor, knot, centre } = balloon;
  const glyph = balloon.width * .62;
  const style: Vars = { left: anchor.x, top: anchor.y, '--i': index };
  return <div className={`bp-b${balloon.hero ? ' is-hero' : ''}`} style={style}>
    <div className="bp-b-lean">
      <div className="bp-b-bob">
        {/* The string grows in (on the svg) and later drops away (on its wrapper): one animation per element. */}
        {!strip && <div className="bp-strand"><svg className="bp-string" width="1" height="1"><path d={stringPath(balloon)} stroke={STRING} strokeWidth={2.2} fill="none" strokeLinecap="round" /></svg></div>}
        <div className="bp-b-inflate" style={{ left: knot.x - anchor.x, top: knot.y - anchor.y }}>
          <div className="bp-b-pop" style={{ left: centre.x - knot.x, top: centre.y - knot.y }}><BalloonSvg balloon={balloon} tail={strip} /></div>
        </div>
        {late && (balloon.hero || !strip) && <div className="bp-burst" style={{ left: centre.x - anchor.x, top: centre.y - anchor.y }}><BurstSvg radius={balloon.width * .55} color={balloon.color} /></div>}
        {late && balloon.hero && flyAway && <div className="bp-qfly" style={{ left: centre.x - anchor.x, top: centre.y - anchor.y, '--qx': `${(QFLY_DX * balloon.width).toFixed(1)}px`, '--qy': `${(-QFLY_RISE * balloon.width).toFixed(1)}px` } as Vars}>
          <svg width={glyph} height={glyph} viewBox="-48 -48 96 96" style={{ left: -glyph / 2, top: -glyph * .56 }}><QuestionMark outline={PALETTE[balloon.color][1]} /></svg>
        </div>}
      </div>
    </div>
  </div>;
}

function Bow({ bunch, size }: { bunch: CoverBunch; size: number }) {
  if (!bunch.bow) return null;
  const [base, shade] = PALETTE[bunch.balloons[0].color];
  const scale = Math.max(.7, Math.min(1.3, size / 150));
  // The bow pops in (on the svg) and later drops away (on its wrapper).
  return <div className="bp-bow-drop" style={{ left: bunch.bow.x, top: bunch.bow.y }}>
    <svg className="bp-bow" width="1" height="1">
      <g transform={`scale(${scale.toFixed(3)})`}>
        <path d="M-3 3L-11 17M3 3L11 17" stroke={shade} strokeWidth={3} strokeLinecap="round" />
        <path d="M0 0C-14 -11 -23 -4 -21 4C-19 10 -8 8 0 0C8 8 19 10 21 4C23 -4 14 -11 0 0Z" fill={base} stroke={shade} strokeWidth={2} strokeLinejoin="round" />
        <path d="M-16 -2C-13 -5 -9 -4 -6 -1" stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={.7} />
        <circle r={4.5} fill={shade} />
      </g>
    </svg>
  </div>;
}

/**
 * Where the balloon's own "?" is (from the knot towards the balloon's centre) when the paper "?" has gone,
 * 60 ms into the inflate: about 62 % grown, so 38 % of the way from the centre back to the knot.
 */
const QUESTION_SUCK = .38;

/** Later bunches of a twin card inflate a beat after the first. */
const bunchInflate = (bunch: number) => `calc(${100 + bunch * 150}ms + var(--reveal-order, .5) * 300ms)`;

const CoverBalloons = memo(function CoverBalloons({ layout, popMs, dense, late }: { layout: CoverLayout; popMs: number[]; dense: boolean; late: boolean }) {
  const strip = layout.shape === 'strip';
  return <>{layout.bunches.map((bunch, b) => {
    const balloons = (dense ? [0] : [1, 2, 0]).map((index) => <CoverBalloonView key={index} balloon={bunch.balloons[index]} index={index} strip={strip} flyAway={!dense} late={late} />);
    return <div key={b} className={`bp-lean${strip ? '' : ' is-group'}`} style={{ transformOrigin: `${bunch.leanOrigin.x}px ${bunch.leanOrigin.y}px`, '--bp-pop': `${popMs[b]}ms`, ...(b > 0 ? { '--bp-in': bunchInflate(b) } : {}) } as Vars}>
      {strip ? balloons : <div className="bp-sway">{balloons}<Bow bunch={bunch} size={layout.size} /></div>}
    </div>;
  })}</>;
});

/** Three wind streaks per bunch that slide towards the hedgehog on each "ah" (painted on the paper, clipped to the card). */
const AirStreaks = memo(function AirStreaks({ layout, focus }: { layout: CoverLayout; focus: CoverFocus }) {
  const angle = airAngle(focus).toFixed(1);
  const size = layout.size;
  const length = size * .42;
  const streak = (y: number, x: number, k: number) => `M${(x - length * k).toFixed(1)} ${y.toFixed(1)}q${(length * k * .5).toFixed(1)} ${(-size * .05).toFixed(1)} ${(length * k).toFixed(1)} 0`;
  const d = [streak(-size * .74, size * .22, 1), streak(-size * .6, -size * .3, .55), streak(size * .72, size * .1, .85), streak(size * .58, -size * .42, .5)].join('');
  const width = Math.max(3, size * .036);
  return <div className="bp-air">{layout.bunches.map((bunch, b) => {
    const hero = bunch.balloons[0].centre;
    return <i key={b} style={{ left: hero.x, top: hero.y, transform: `rotate(${angle}deg)`, '--air': `${(size * .5).toFixed(1)}px` } as Vars}>
      <svg width="1" height="1">
        <path d={d} stroke="#8ec6f0" strokeWidth={width} fill="none" strokeLinecap="round" />
        <path d={d} stroke="#fff" strokeWidth={width * .4} fill="none" strokeLinecap="round" />
      </svg>
    </i>;
  })}</div>;
});

const PaperPattern = memo(function PaperPattern({ id }: { id: string }) {
  // Same tile as .bp-paper's dots (36 px, offset by the 2 px dashed border).
  return <svg className="bp-defs" width="0" height="0"><defs><pattern id={id} width="36" height="36" patternUnits="userSpaceOnUse">
    <rect width="36" height="36" fill="#fff4d8" />
    <circle cx="20" cy="20" r="3" fill="#ffb3c7" fillOpacity=".4" />
    <circle cx="32" cy="32" r="3" fill="#9fd3ff" fillOpacity=".4" />
    <circle cx="8" cy="8" r="3" fill="#ffe08a" fillOpacity=".53" />
  </pattern></defs></svg>;
});

const CoverShards = memo(function CoverShards({ layout, focus }: { layout: CoverLayout; focus: CoverFocus }) {
  const pattern = `bp${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-paper`;
  return <div className="bp-shards">
    <PaperPattern id={pattern} />
    {paperShards(layout, focus).map((shard, index) => <div key={index} className="bp-shard" style={{
      left: shard.left, top: shard.top, width: shard.width, height: shard.height,
      '--tx': `${shard.tx.toFixed(1)}px`, '--ty': `${shard.ty.toFixed(1)}px`, '--sr': `${shard.rot}deg`,
    } as Vars}>
      <svg width={shard.width} height={shard.height} viewBox={`${shard.left} ${shard.top} ${shard.width} ${shard.height}`}>
        <polygon points={shard.points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} fill={`url(#${pattern})`} stroke="#e6cc98" strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
    </div>)}
  </div>;
});

function BalloonCover() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<CoverState | null>(null);
  // Cards add their pop pieces over the first few frames (a third of them per frame).
  const late = useAfterFirstFrame(1 + (state?.layout.variant ?? 0) % LATE_FRAMES);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    if (!coverStates.has(element)) measureBalloonCovers();
    setState(coverStates.get(element) ?? null);
    const onResize = (event: Event) => {
      // The first cover to hear a resize re-measures them all (one read pass); the rest reuse it.
      if (event.timeStamp !== measuredForResize) { measuredForResize = event.timeStamp; measureBalloonCovers(); }
      setState(coverStates.get(element) ?? null);
    };
    window.addEventListener('resize', onResize);
    // The stage's clock arms this card; if it never does, the card arms itself (late) rather than stay covered.
    const mounted = performance.now();
    const fallback = lazySupported() ? window.setTimeout(() => selfArm(element, performance.now() - mounted), SELF_ARM_MS) : 0;
    return () => { window.removeEventListener('resize', onResize); window.clearTimeout(fallback); };
  }, []);
  const firstPop = state ? Math.min(...state.popMs) : undefined;
  const lazy = lazySupported();
  const style: Vars | undefined = state ? {
    '--bp-pop': `${firstPop}ms`, '--bp-fdx': state.focus.dx.toFixed(4),
    '--bp-tx': `${state.focus.targetX.toFixed(1)}px`, '--bp-ty': `${state.focus.targetY.toFixed(1)}px`,
    // When the stage's clock will arm this card's pops (their delays count from then).
    ...(lazy && firstPop !== undefined ? { '--bp-tp': `${popArmMs(firstPop)}ms` } : {}),
  } : undefined;
  const plain = !state || state.dense || state.layout.shape === 'strip';
  // Layer order matters: the paper and its "?" are never inside .bp-float, so the inhale only draws the balloons in.
  // data-pop-at and data-clear-at tell the stage's clock when to arm this card's pops and when it is all gone.
  return <div ref={ref} className="bp-cover" data-shape={state?.layout.shape} data-dense={state?.dense ? '' : undefined} data-lazy={lazy ? '' : undefined}
    data-pop-at={firstPop} data-clear-at={state ? Math.round(coverClearAt(Math.max(...state.popMs) / 1000) * 1000) : undefined} style={style}>
    <div className="bp-paper" />
    {state ? state.layout.bunches.map((bunch, b) => {
      // The "?" is sucked into the balloon: it slides to where the balloon's own "?" is while the balloon grows from its knot.
      const { centre, knot } = bunch.balloons[0];
      return <span key={b} className="bp-paper-q" style={{
        left: centre.x, top: centre.y, '--qx': `${((knot.x - centre.x) * QUESTION_SUCK).toFixed(1)}px`, '--qy': `${((knot.y - centre.y) * QUESTION_SUCK).toFixed(1)}px`,
        ...(b > 0 ? { '--bp-in': bunchInflate(b) } : {}),
      } as Vars}><b>?</b></span>;
    }) : <span className="bp-paper-q"><b>?</b></span>}
    {!plain && <AirStreaks layout={state.layout} focus={state.focus} />}
    <div className="bp-float">
      <div className="bp-hop">
        {state && <CoverBalloons layout={state.layout} popMs={state.popMs} dense={state.dense} late={late} />}
      </div>
    </div>
    {late && state && !state.dense && <CoverShards layout={state.layout} focus={state.focus} />}
  </div>;
}

export const balloonEffect: RevealEffect = {
  id: 'balloons',
  name: 'Balloon pop party',
  description: 'A party-hat hedgehog floats in with a bunch of balloons, gets tickled by a feather, and sneezes so big that every question-mark balloon pops into confetti.',
  durationMs: BALLOON_DURATION_MS,
  sound: 'balloons',
  Stage: BalloonStage,
  Cover: BalloonCover,
};
