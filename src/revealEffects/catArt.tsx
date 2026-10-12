import { memo, type CSSProperties, type ReactNode } from 'react';
import { PIVOT, TWINKLES, type PartPose, type ScenePose } from './catTimeline';

/* ------------------------------------------------------------------------ *
 * The kitten ("Clementine"): original storybook-style SVG art.
 * Soft warm-brown ink, ginger fur with cream muzzle/chest/socks, pink inner
 * ears, big glossy green eyes set low and wide, tiny nose and mouth.
 *
 * Every construction is a tree of rig nodes. A node is an HTML <div> anchored
 * at its pivot (zero-size, transform-origin 0 0) holding one static <svg>, so
 * the Stage animates only transforms/opacity (baked Web Animations) and never
 * repaints the art. Pivots and art are authored in one coordinate system per
 * construction (art units; y down; ground at y = 0). Pivots the timeline
 * needs (to track the head across actor swaps) come from PIVOT.
 * ------------------------------------------------------------------------ */

export type Box = readonly [number, number, number, number];
export type RigNode = {
  id: string;
  pivot: readonly [number, number];
  art?: { box: Box; el: ReactNode };
  behind?: RigNode[];
  children?: RigNode[];
  className?: string;
};

const r2 = (value: number) => Math.round(value * 100) / 100;
export function poseTransform(p: PartPose | undefined, k: number) {
  return `translate(${r2((p?.x ?? 0) * k)}px, ${r2((p?.y ?? 0) * k)}px) rotate(${r2(p?.r ?? 0)}deg) scale(${r2(p?.sx ?? 1) || .001}, ${r2(p?.sy ?? 1) || .001})`;
}

export type Hold = (id: string) => (element: Element | null) => void;

function NodeView({ node, parent, k, pose, hold }: { node: RigNode; parent: readonly [number, number]; k: number; pose?: ScenePose; hold?: Hold }) {
  const p = pose?.[node.id];
  const style: CSSProperties = { left: (node.pivot[0] - parent[0]) * k, top: (node.pivot[1] - parent[1]) * k, transform: poseTransform(p, k), opacity: p?.o ?? 1 };
  const box = node.art?.box;
  return <div ref={hold?.(node.id)} className={`cat-node${node.className ? ` ${node.className}` : ''}`} style={style}>
    {node.behind?.map((child) => <NodeView key={child.id} node={child} parent={node.pivot} k={k} pose={pose} hold={hold} />)}
    {node.art && box && <svg className="cat-art" viewBox={box.join(' ')} style={{ left: (box[0] - node.pivot[0]) * k, top: (box[1] - node.pivot[1]) * k, width: box[2] * k, height: box[3] * k }} aria-hidden="true">{node.art.el}</svg>}
    {node.children?.map((child) => <NodeView key={child.id} node={child} parent={node.pivot} k={k} pose={pose} hold={hold} />)}
  </div>;
}

/** Renders a rig tree. `pose` sets static transforms (model sheet, first paint); `hold` registers nodes for baking. */
export const Rig = memo(function Rig({ node, k, pose, hold, at = [0, 0] }: { node: RigNode; k: number; pose?: ScenePose; hold?: Hold; at?: readonly [number, number] }) {
  return <NodeView node={node} parent={at} k={k} pose={pose} hold={hold} />;
});

/* ------------------------------ palette ------------------------------ */

export const PALETTE = {
  ink: '#8a4020', inkDark: '#5e2710', rim: '#ffe9b8',
  fur: '#f7a25a', furLight: '#ffd39a', furShade: '#e4843f', stripe: '#d9702f',
  cream: '#fff6e6', creamShade: '#efd6b6',
  earPink: '#f2a3a6', nose: '#e47a86', blush: '#ff8a80',
  iris: '#b9d65a', irisDark: '#5f922e', irisRim: '#4f7424', pupil: '#2a150b', eyeRim: '#43200f', mouth: '#6b2d1a',
  yarn: '#f08aa6', yarnLight: '#ffc5d3', yarnDark: '#c95478', yarnInk: '#8f3452', heart: '#f2687a',
} as const;

const INK = 'url(#kc-ink)';

/** Shared gradients, clip paths and patterns. Rendered once per page (a 0x0 svg). */
export const CatDefs = memo(function CatDefs() {
  return <svg className="cat-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
    <linearGradient id="kc-ink" x2="0" y2="1"><stop offset="0" stopColor="#b8642c" /><stop offset=".5" stopColor="#8a4020" /><stop offset="1" stopColor="#5e2710" /></linearGradient>
    <radialGradient id="kc-head" cx=".42" cy=".28" r=".85"><stop offset="0" stopColor="#ffdcaa" /><stop offset=".48" stopColor="#fbb068" /><stop offset=".86" stopColor="#f09048" /><stop offset="1" stopColor="#dd7738" /></radialGradient>
    <radialGradient id="kc-body" cx=".42" cy=".16" r=".95"><stop offset="0" stopColor="#ffcd8e" /><stop offset=".4" stopColor="#f9a75c" /><stop offset=".74" stopColor="#ec8942" /><stop offset="1" stopColor="#d26a2e" /></radialGradient>
    <linearGradient id="kc-ear" x2="0" y2="1"><stop offset="0" stopColor="#fbb46c" /><stop offset="1" stopColor="#ea8a44" /></linearGradient>
    <linearGradient id="kc-ear-in" x2="0" y2="1"><stop offset="0" stopColor="#ea8a92" /><stop offset="1" stopColor="#fcc9bf" /></linearGradient>
    <linearGradient id="kc-leg" x2="0" y2="1"><stop offset="0" stopColor="#f09450" /><stop offset=".6" stopColor="#f7a864" /><stop offset="1" stopColor="#ea8c4a" /></linearGradient>
    <linearGradient id="kc-leg-near" x2="0" y2="1"><stop offset="0" stopColor="#f09450" stopOpacity="0" /><stop offset=".3" stopColor="#f09450" /><stop offset=".62" stopColor="#f7a864" /><stop offset="1" stopColor="#ea8c4a" /></linearGradient>
    <linearGradient id="kc-far" x2="0" y2="1"><stop offset="0" stopColor="#cf6e34" /><stop offset="1" stopColor="#b9592b" /></linearGradient>
    <linearGradient id="kc-tail" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffbf7e" /><stop offset=".55" stopColor="#f39a50" /><stop offset="1" stopColor="#e07a38" /></linearGradient>
    <radialGradient id="kc-cream" cx=".45" cy=".3" r=".8"><stop offset="0" stopColor="#fffdf7" /><stop offset=".7" stopColor="#fdf0dd" /><stop offset="1" stopColor="#f0d6b6" /></radialGradient>
    <radialGradient id="kc-cream-soft"><stop offset="0" stopColor="#fff4e2" /><stop offset=".6" stopColor="#fde6c8" stopOpacity=".85" /><stop offset="1" stopColor="#fbd7ae" stopOpacity="0" /></radialGradient>
    <linearGradient id="kc-sock" x2="0" y2="1"><stop offset="0" stopColor="#fffaf0" /><stop offset="1" stopColor="#ecd3b6" /></linearGradient>
    <radialGradient id="kc-iris" cx=".5" cy=".7" r=".72"><stop offset="0" stopColor="#f6fbbe" /><stop offset=".42" stopColor="#bcd85e" /><stop offset="1" stopColor="#5a8c2c" /></radialGradient>
    <radialGradient id="kc-blush"><stop offset="0" stopColor="#ff8479" stopOpacity=".62" /><stop offset="1" stopColor="#ff8479" stopOpacity="0" /></radialGradient>
    <radialGradient id="kc-nose" cx=".45" cy=".3"><stop offset="0" stopColor="#ffd0cc" /><stop offset="1" stopColor="#df7481" /></radialGradient>
    <radialGradient id="kc-yarn" cx=".36" cy=".3" r=".85"><stop offset="0" stopColor="#ffc9d6" /><stop offset=".5" stopColor="#f38fab" /><stop offset="1" stopColor="#c9557a" /></radialGradient>
    <radialGradient id="kc-heart" cx=".35" cy=".3"><stop offset="0" stopColor="#ffc0c5" /><stop offset=".6" stopColor="#f3697c" /><stop offset="1" stopColor="#d24560" /></radialGradient>
    <radialGradient id="kc-shadow"><stop offset="0" stopColor="#6d3a1e" stopOpacity=".38" /><stop offset=".6" stopColor="#6d3a1e" stopOpacity=".17" /><stop offset="1" stopColor="#6d3a1e" stopOpacity="0" /></radialGradient>
    <linearGradient id="kc-hat" x2="0" y2="1"><stop offset="0" stopColor="#f7b0c3" /><stop offset=".6" stopColor="#f19bb2" /><stop offset="1" stopColor="#e489a5" /></linearGradient>
    <radialGradient id="kc-hat-light" cx=".42" cy=".05" r=".75"><stop offset="0" stopColor="#fff1de" stopOpacity=".5" /><stop offset="1" stopColor="#fff1de" stopOpacity="0" /></radialGradient>
    <radialGradient id="kc-pom" cx=".4" cy=".34" r=".8"><stop offset="0" stopColor="#fffaf2" /><stop offset=".55" stopColor="#fde8ee" /><stop offset="1" stopColor="#f2bfcd" /></radialGradient>
    <radialGradient id="kc-puff" cx=".42" cy=".38"><stop offset="0" stopColor="#fffdf8" /><stop offset=".7" stopColor="#fff0ee" /><stop offset="1" stopColor="#f9dcdc" /></radialGradient>
    <radialGradient id="kc-fluff" cx=".38" cy=".32" r=".8"><stop offset="0" stopColor="#ffe1e9" /><stop offset=".55" stopColor="#f9a9bf" /><stop offset="1" stopColor="#e57e9c" /></radialGradient>
    <clipPath id="kc-head-clip"><path d={HEAD_D} /></clipPath>
    <clipPath id="kc-body-side"><path d={BODY_SIDE} /></clipPath>
    <clipPath id="kc-body-sit"><path d={BODY_SIT} /></clipPath>
    <clipPath id="kc-ball"><circle r={88} /></clipPath>
    <clipPath id="kc-hat-dome"><path d={HAT_DOME} /></clipPath>
  </defs></svg>;
});

const at = (x: number, y: number, el: ReactNode, s = 1) => <g transform={`translate(${x} ${y})${s !== 1 ? ` scale(${s})` : ''}`}>{el}</g>;

/**
 * Silhouette rim: a cream outline 3.5 a wide outside the ink line, drawn behind the whole kitten (see the rim nodes below),
 * so a ginger kitten still reads against a ginger cover from the back of the room.
 */
const RIM = { color: PALETTE.cream, width: 3 + 7 } as const;
const rimShape = (d: string, key?: string) => <path key={key ?? d} d={d} fill={RIM.color} stroke={RIM.color} strokeWidth={RIM.width} strokeLinejoin="round" strokeLinecap="round" />;
const star = (x: number, y: number, s: number) => `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;

/** A strand of yarn: warm outline, pink core, a soft light line. */
const yarnStroke = (d: string, width = 6, core: string = PALETTE.yarn) => <g key={d} fill="none" strokeLinecap="round" strokeLinejoin="round">
  <path d={d} stroke={PALETTE.yarnInk} strokeWidth={width + 3.5} />
  <path d={d} stroke={core} strokeWidth={width} />
  <path d={d} stroke={PALETTE.yarnLight} strokeWidth={width * .3} strokeOpacity=".8" transform="translate(-.8 -1.2)" />
</g>;

/* ------------------------------- head ------------------------------- */

const HEAD_D = 'M0-66C48-66 86-38 88 6C89 28 78 45 58 54C40 62 22 64 0 64C-22 64-40 62-58 54C-78 45-89 28-88 6C-86-38-48-66 0-66Z';
const EYE_X = 34; const EYE_Y = 4; const EYE_RX = 21; const EYE_RY = 24;
/* Ears: a little shorter than a grown cat's, splayed slightly outward, with softly rounded tips (no sharp points on the head). */
const EAR_L = 'M-90-14C-96-47-94-76-86-93Q-79-106-66-99C-51-88-35-74-19-58Z';
const EAR_L_IN = 'M-80-30C-84-54-83-75-77-86Q-72-94-65-89C-55-81-45-71-34-60Z';
const mirror = (el: ReactNode) => <g transform="scale(-1 1)">{el}</g>;

const EAR_ART = <g>
  <path d={EAR_L} fill="url(#kc-ear)" />
  <path d={EAR_L_IN} fill="url(#kc-ear-in)" />
  <path d="M-87-30C-91-55-89-76-83-89" fill="none" stroke={PALETTE.rim} strokeWidth="3.5" strokeLinecap="round" opacity=".85" />
  <g fill="none" stroke="#fff4e2" strokeWidth="2.2" strokeLinecap="round"><path d="M-63-52q-6-10-5-21" /><path d="M-55-56q-3-9 1-18" /><path d="M-70-48q-8-7-9-16" /></g>
  <path d={EAR_L} fill="none" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
</g>;

/* Cheek fluff: two soft rounded scallops. */
const TUFT_L = 'M-82 14C-95 10-104 22-96 30C-104 36-100 49-87 47C-81 47-76 45-71 43Z';
const HEAD_ART = <g>
  <g fill="url(#kc-head)" stroke={INK} strokeWidth="2.6" strokeLinejoin="round"><path d={TUFT_L} />{mirror(<path d={TUFT_L} />)}</g>
  <path d={HEAD_D} fill="url(#kc-head)" />
  <g clipPath="url(#kc-head-clip)">
    {/* soft forehead "M" and cheek stripes */}
    <g fill={PALETTE.stripe} opacity=".5">
      <path d="M-4-67H4Q3-55 0-44Q-3-55-4-67Z" />
      <path d="M-26-63L-17-65Q-16-56-17-49Q-22-56-26-63Z" /><path d="M26-63L17-65Q16-56 17-49Q22-56 26-63Z" />
      <path d="M-90 0Q-77 1-68 6Q-77 9-90 9Z" /><path d="M-89 14Q-78 15-71 18Q-78 22-88 22Z" />
      <path d="M90 0Q77 1 68 6Q77 9 90 9Z" /><path d="M89 14Q78 15 71 18Q78 22 88 22Z" />
    </g>
    <ellipse cx="0" cy="74" rx="96" ry="30" fill="#b9541f" opacity=".13" />
    <path d="M-72-28C-58-52-30-62 0-62C26-62 48-54 62-40" fill="none" stroke={PALETTE.rim} strokeWidth="5" strokeLinecap="round" transform="translate(0 4)" opacity=".9" />
    {/* cream cheeks, muzzle and chin */}
    <path d="M-88 24Q-74 30-62 28Q-68 38-80 42M88 24Q74 30 62 28Q68 38 80 42" fill="#fff0dc" opacity=".9" />
    <path d="M-29 32C-29 19-14 17 0 23C14 17 29 19 29 32C29 45 17 55 0 56C-17 55-29 45-29 32Z" fill="url(#kc-cream)" />
  </g>
  <path d={HEAD_D} fill="none" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
  {/* nose */}
  <path d="M-7.5 21Q0 17.5 7.5 21Q6.5 27 0 29.5Q-6.5 27-7.5 21Z" fill="url(#kc-nose)" stroke="#a24a44" strokeWidth="1.5" strokeLinejoin="round" />
  <ellipse cx="-1.8" cy="21.4" rx="2.6" ry="1.3" fill="#fff" opacity=".8" />
  {/* whiskers: short, soft */}
  <g fill="none" stroke="#fff5e4" strokeWidth="2" strokeLinecap="round" opacity=".95">
    <path d="M-30 30Q-62 22-96 20" /><path d="M-30 37Q-62 38-94 45" />
    <path d="M30 30Q62 22 96 20" /><path d="M30 37Q62 38 94 45" />
  </g>
</g>;

const BLUSH_ART = <g><ellipse cx={-56} cy={28} rx={16} ry={9.5} fill="url(#kc-blush)" /><ellipse cx={56} cy={28} rx={16} ry={9.5} fill="url(#kc-blush)" /></g>;

/**
 * Eye: a thin iris-green rim below, a soft lash line on top that tapers toward
 * the corners (not an even dark ring), and a warm glow low in the iris.
 */
function EyeBase({ cx }: { cx: number }) {
  const rx = EYE_RX; const ry = EYE_RY; const y = EYE_Y;
  const lash = `M${cx - rx - .6} ${y}A${rx + .6} ${ry + .6} 0 0 1 ${cx + rx + .6} ${y}L${cx + rx + 2.2} ${y - 1.2}A${rx + 2.2} ${ry + 3.6} 0 0 0 ${cx - rx - 2.2} ${y - 1.2}Z`;
  return <g>
    <ellipse cx={cx} cy={y + .4} rx={rx + 1.4} ry={ry + 1.4} fill={PALETTE.irisRim} />
    <ellipse cx={cx} cy={y} rx={rx} ry={ry} fill="url(#kc-iris)" />
    <path d={`M${cx - rx} ${y - 4}Q${cx} ${y - ry - 8} ${cx + rx} ${y - 4}Q${cx} ${y - ry + 3} ${cx - rx} ${y - 4}Z`} fill="#2e5a1a" opacity=".2" />
    <ellipse cx={cx} cy={y + ry - 7} rx={rx - 7} ry={5} fill="#f6ffc8" opacity=".55" />
    <path d={lash} fill={PALETTE.eyeRim} stroke={PALETTE.eyeRim} strokeWidth="1" strokeLinejoin="round" />
  </g>;
}
function PupilArt({ cx }: { cx: number }) {
  return <g>
    <ellipse cx={cx} cy={EYE_Y + 2} rx={12.5} ry={16.5} fill={PALETTE.pupil} />
    <ellipse cx={cx - 7.5} cy={EYE_Y - 9} rx={8} ry={8.6} fill="#fff" />
    <circle cx={cx + 7.5} cy={EYE_Y + 11} r={3.6} fill="#fff" opacity=".92" />
  </g>;
}
const SPARK_ART = <path d={[star(-EYE_X + 9, EYE_Y - 12, 6), star(EYE_X + 9, EYE_Y - 12, 6), star(-EYE_X - 9, EYE_Y + 12, 3.4), star(EYE_X - 9, EYE_Y + 12, 3.4)].join('')} fill="#fff" />;

const CLOSED_ART = <g fill="none" stroke={PALETTE.eyeRim} strokeWidth="4.6" strokeLinecap="round">
  <path d={`M${-EYE_X - 19} ${EYE_Y + 3}Q${-EYE_X} ${EYE_Y + 16} ${-EYE_X + 19} ${EYE_Y + 3}`} />
  <path d={`M${EYE_X - 19} ${EYE_Y + 3}Q${EYE_X} ${EYE_Y + 16} ${EYE_X + 19} ${EYE_Y + 3}`} />
</g>;
const HAPPY_ART = <g fill="none" stroke={PALETTE.eyeRim} strokeWidth="5" strokeLinecap="round">
  <path d={`M${-EYE_X - 18} ${EYE_Y + 10}Q${-EYE_X} ${EYE_Y - 13} ${-EYE_X + 18} ${EYE_Y + 10}`} />
  <path d={`M${EYE_X - 18} ${EYE_Y + 10}Q${EYE_X} ${EYE_Y - 13} ${EYE_X + 18} ${EYE_Y + 10}`} />
</g>;

/** Only closed mouths and a small "o": no open grin, no teeth, no tongue. */
const MOUTH_ART = {
  w: <path d="M0 29.5V32M-9 32Q-4.5 38.5 0 32Q4.5 38.5 9 32" fill="none" stroke={PALETTE.mouth} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
  smile: <path d="M0 29.5V32M-11.5 30Q-5.5 40.5 0 32Q5.5 40.5 11.5 30" fill="none" stroke={PALETTE.mouth} strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />,
  o: <g><path d="M0 29.5V32.5" stroke={PALETTE.mouth} strokeWidth="2.4" strokeLinecap="round" /><ellipse cx="0" cy="38.6" rx="4.8" ry="5.6" fill="#a9474c" stroke={PALETTE.mouth} strokeWidth="1.5" /><ellipse cx="0" cy="41.2" rx="2.9" ry="1.9" fill="#f29aa6" /></g>,
} as const;

/* A little striped beanie knitted from the unravelled covers: candy-soft pastel tints of the team colours (--cat-p0..2). */
const HAT_DOME = 'M-62-42C-65-80-36-101 0-101C36-101 65-80 62-42Z';
const HAT_ART = <g>
  <path d={HAT_DOME} fill="url(#kc-hat)" />
  <g clipPath="url(#kc-hat-dome)">
    <rect x="-70" y="-64" width="140" height="9" style={{ fill: 'var(--cat-p0, #f9dca0)' }} />
    <rect x="-70" y="-79" width="140" height="8" style={{ fill: 'var(--cat-p1, #b9d8ea)' }} />
    <rect x="-70" y="-93" width="140" height="7" style={{ fill: 'var(--cat-p2, #c9e2bb)' }} />
    {/* matte knit: faint columns of little V stitches and soft ribs, lit warmly from above */}
    <g fill="none" stroke="#a24a66" strokeOpacity=".12" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {[-54, -36, -18, 0, 18, 36, 54].map((x) => [-50, -60, -70, -80, -90, -99].map((y) => <path key={`${x}${y}`} d={`M${x - 4} ${y - 3}l4 4 4-4`} />))}
    </g>
    <g stroke="#a24a66" strokeOpacity=".05" strokeWidth="3">{[-45, -27, -9, 9, 27, 45].map((x) => <path key={x} d={`M${x}-104V-40`} />)}</g>
    <path d={HAT_DOME} fill="url(#kc-hat-light)" />
  </g>
  <path d={HAT_DOME} fill="none" stroke="#9a4062" strokeWidth="2.6" strokeLinejoin="round" />
  {/* ribbed brim */}
  <path d="M-70-47Q0-66 70-47L71-30Q0-50-71-30Z" fill="#f8b4c6" stroke="#9a4062" strokeWidth="2.6" strokeLinejoin="round" />
  <g stroke="#d9728f" strokeWidth="2" strokeLinecap="round" opacity=".5">
    {[-60, -48, -36, -24, -12, 0, 12, 24, 36, 48, 60].map((x) => { const top = -47 - (1 - (x / 70) ** 2) * 9.5 + 2; return <path key={x} d={`M${x} ${top}v${13}`} />; })}
  </g>
</g>;
/** A fluffy pom-pom outline: n soft tufts of slightly varied size around (cx, cy). */
function pomPath(cx: number, cy: number, r: number, n = 18) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2; const a1 = (i + 1) / n * Math.PI * 2; const am = (a0 + a1) / 2;
    const p = (a: number, rr: number) => `${(Math.cos(a) * rr + cx).toFixed(1)} ${(Math.sin(a) * rr + cy).toFixed(1)}`;
    d += `${i ? '' : `M${p(a0, r * .77)}`}Q${p(am, r * (1 + (i % 3) * .046))} ${p(a1, r * .77)}`;
  }
  return `${d}Z`;
}
const POM_ART = <g>
  <path d={pomPath(0, -106, 26)} fill="url(#kc-pom)" stroke="#a24a66" strokeWidth="2.2" strokeLinejoin="round" />
  <g fill="none" stroke="#eea0b6" strokeWidth="1.8" strokeLinecap="round"><path d="M-10-112q4 4 1 9" /><path d="M3-117q4 5 1 10" /><path d="M10-102q-4 4-9 3" /><path d="M-6-98q-4-3-3-8" /><path d="M13-114q3 3 3 7" /></g>
</g>;

/** While tangled: a closed loop of yarn draped over her right ear, hanging down beside her cheek (never sticking up). */
const LOOP_DRAPE = 'M22-60C44-78 80-78 94-58C101-46 100-28 92-20C84-13 76-22 72-32C66-46 46-54 22-60Z';

/**
 * The head's silhouette rim (head, cheek fluff and ears), as its own small rig with the same pivots as headNode: drawn
 * behind the whole kitten and given the head's and ears' baked keyframes (RIM_FOLLOWS), so it moves exactly with them.
 */
export function headRimNode(id: string, center: readonly [number, number]): RigNode {
  const [cx, cy] = center;
  const o = (x: number, y: number) => [cx + x, cy + y] as const;
  const box = (x: number, y: number, w: number, h: number): Box => [cx + x, cy + y, w, h];
  const art = (el: ReactNode) => at(cx, cy, el);
  return {
    id, pivot: center,
    behind: [
      { id: `${id}.earL`, pivot: o(-52, -48), art: { box: box(-104, -124, 96, 124), el: art(rimShape(EAR_L)) } },
      { id: `${id}.earR`, pivot: o(52, -48), art: { box: box(8, -124, 96, 124), el: art(mirror(rimShape(EAR_L))) } },
    ],
    art: { box: box(-112, -76, 224, 148), el: art(<g>{rimShape(HEAD_D)}{rimShape(TUFT_L)}{mirror(rimShape(TUFT_L))}</g>) },
  };
}

export type HeadOptions = { hat?: boolean; loop?: boolean; perk?: boolean };
/** A head rig in its own coordinates (centre 0,0), placed at `center` of a construction. */
export function headNode(id: string, center: readonly [number, number], options: HeadOptions = {}): RigNode {
  const [cx, cy] = center;
  const o = (x: number, y: number) => [cx + x, cy + y] as const;
  const box = (x: number, y: number, w: number, h: number): Box => [cx + x, cy + y, w, h];
  const art = (el: ReactNode) => at(cx, cy, el);
  const children: RigNode[] = [
    { id: `${id}.blush`, pivot: o(0, 28), art: { box: box(-76, 16, 152, 24), el: art(BLUSH_ART) } },
    { id: `${id}.eyes`, pivot: o(0, EYE_Y), art: { box: box(-60, -26, 120, 60), el: art(<g><EyeBase cx={-EYE_X} /><EyeBase cx={EYE_X} /></g>) }, children: [
      { id: `${id}.pupilL`, pivot: o(-EYE_X, EYE_Y), art: { box: box(-EYE_X - 18, -16, 36, 42), el: art(<PupilArt cx={-EYE_X} />) } },
      { id: `${id}.pupilR`, pivot: o(EYE_X, EYE_Y), art: { box: box(EYE_X - 18, -16, 36, 42), el: art(<PupilArt cx={EYE_X} />) } },
      { id: `${id}.spark`, pivot: o(0, EYE_Y), art: { box: box(-50, -16, 100, 36), el: art(SPARK_ART) } },
    ] },
    { id: `${id}.closed`, pivot: o(0, EYE_Y), art: { box: box(-58, -6, 116, 30), el: art(CLOSED_ART) } },
    { id: `${id}.happy`, pivot: o(0, EYE_Y), art: { box: box(-58, -16, 116, 36), el: art(HAPPY_ART) } },
    ...(Object.keys(MOUTH_ART) as (keyof typeof MOUTH_ART)[]).map((mouth): RigNode => ({ id: `${id}.m_${mouth}`, pivot: o(0, 34), art: { box: box(-16, 26, 32, 24), el: art(MOUTH_ART[mouth]) } })),
  ];
  if (options.loop) children.push({ id: `${id}.loop`, pivot: o(60, -50), art: { box: box(8, -92, 106, 94), el: art(yarnStroke(LOOP_DRAPE, 6)) } });
  if (options.hat) children.push({ id: `${id}.hat`, pivot: o(0, -50), art: { box: box(-76, -118, 152, 94), el: art(HAT_ART) }, children: [
    { id: `${id}.pom`, pivot: o(0, -98), art: { box: box(-32, -137, 64, 64), el: art(POM_ART) } },
  ] });
  // Ear-perk: two warm sparkles by the ear tips, big enough to read from the back of the room (not startle lines).
  if (options.perk) children.push({ id: `${id}.perk`, pivot: o(0, -110), art: { box: box(-128, -158, 256, 62), el: art(<g fill="#ffe28f" stroke="#c98a3a" strokeWidth="2.4" strokeLinejoin="round"><path d={star(-106, -118, 15)} /><path d={star(106, -118, 15)} /><path d={star(-86, -142, 7.5)} /><path d={star(86, -142, 7.5)} /></g>) } });
  return {
    id,
    pivot: center,
    behind: [
      { id: `${id}.earL`, pivot: o(-52, -48), art: { box: box(-98, -118, 84, 112), el: art(EAR_ART) } },
      { id: `${id}.earR`, pivot: o(52, -48), art: { box: box(14, -118, 84, 112), el: art(mirror(EAR_ART)) } },
    ],
    art: { box: box(-100, -70, 200, 136), el: art(HEAD_ART) },
    children,
  };
}

/* ---------------------------- side kitten ---------------------------- */

const BODY_SIDE = 'M-32-120C0-122 34-113 54-99C72-86 74-58 60-45C46-33 12-31-20-33C-54-35-78-44-86-66C-92-90-76-118-32-120Z';
const BODY_SIDE_ART = <g>
  <path d={BODY_SIDE} fill="url(#kc-body)" />
  <g clipPath="url(#kc-body-side)">
    <ellipse cx="-64" cy="-80" rx="40" ry="38" fill="#ffbb7c" opacity=".35" />
    <g fill={PALETTE.stripe} opacity=".45">
      <path d="M26-118Q34-100 26-86Q40-100 42-116Z" /><path d="M-6-122Q2-100-8-82Q10-100 10-122Z" />
      <path d="M-40-122Q-30-100-40-84Q-22-100-24-122Z" /><path d="M-76-110Q-62-96-72-82Q-54-96-60-114Z" />
    </g>
    <ellipse cx="4" cy="-28" rx="70" ry="14" fill="#9b3f18" opacity=".22" />
    <ellipse cx="0" cy="-38" rx="54" ry="9" fill="url(#kc-cream-soft)" />
    <path d="M-94-70C-94-96-72-114-38-114C-4-116 30-110 52-98" fill="none" stroke={PALETTE.rim} strokeWidth="5" strokeLinecap="round" transform="translate(1 4)" opacity=".9" />
  </g>
  <path d={BODY_SIDE} fill="none" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
  <path d="M40-104C60-100 76-82 74-64C72-50 60-42 48-40C54-58 52-84 40-104Z" fill="url(#kc-cream)" stroke="#d9a47a" strokeWidth="1.6" strokeLinejoin="round" />
  <g fill="#f5a15a" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"><path d="M-86-86q-10-2-15 3q9 1 12 8" /></g>
</g>;

const LEG_D = 'M-15-10C-16 8-16 24-15 32C-21 37-21 50-8 52H14C24 51 23 38 16 32C16 22 16 6 15-10Z';
const LEG_LINE = 'M-15 2C-16 16-16 26-15 32C-21 37-21 50-8 52H14C24 51 23 38 16 32C16 24 16 14 15 2';
/** The leg's rim, only below her belly (a near leg is drawn over the body, where a rim would read as a seam). */
const LEG_RIM = 'M-15.6 22C-15.8 26-15.5 29-15 32C-21 37-21 50-8 52H14C24 51 23 38 16 32C16.3 29 16.3 26 16.2 22';
const SOCK_D = 'M-16 31C-21 37-21 50-8 52H14C24 51 23 38 16 31Q8 35 0 33Q-8 35-16 31Z';
const legArt = (far: boolean) => <g>
  <path d={far ? LEG_LINE : LEG_RIM} fill="none" stroke={RIM.color} strokeWidth={RIM.width} strokeLinecap="round" strokeLinejoin="round" />
  <path d={LEG_D} fill={far ? 'url(#kc-far)' : 'url(#kc-leg-near)'} />
  <path d={SOCK_D} fill={far ? '#e6ccae' : 'url(#kc-sock)'} />
  {!far && <path d="M-8 0q-3 12-1 24" fill="none" stroke={PALETTE.rim} strokeWidth="3" strokeLinecap="round" opacity=".6" />}
  <path d={LEG_LINE} fill="none" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />
  <path d="M3 52v-6M10 52v-6" stroke="#c09370" strokeWidth="2" strokeLinecap="round" />
</g>;

const tailStroke = (d: string, width = 22, rim = false) => <g fill="none" strokeLinecap="round" strokeLinejoin="round">
  {rim && <path d={d} stroke={RIM.color} strokeWidth={width + 5.5 + 7} />}
  <path d={d} stroke={PALETTE.inkDark} strokeOpacity=".85" strokeWidth={width + 5.5} />
  <path d={d} stroke="url(#kc-tail)" strokeWidth={width} />
  <path d={d} stroke={PALETTE.stripe} strokeOpacity=".55" strokeWidth={width} strokeDasharray="7 15" strokeDashoffset="4" />
  <path d={d} stroke={PALETTE.rim} strokeOpacity=".75" strokeWidth="3.4" transform={`translate(-3 -3)`} strokeDasharray="1 16 40 400" />
</g>;
const SIDE_TAIL = 'M-90-78C-124-84-140-116-130-146C-124-164-104-170-96-156';

/** The curious "?": big, cream-haloed warm-brown ink so it reads over any team colour from the back of the room. */
const Q_D = 'M-14-24C-14-42 15-44 15-25C15-11 0-9 0 9';
const Q_ART = <g strokeLinecap="round" strokeLinejoin="round">
  <path d={Q_D} fill="none" stroke="#fff6e6" strokeWidth="15" />
  <circle cx="0" cy="28" r="9.5" fill="#fff6e6" />
  <path d={Q_D} fill="none" stroke={PALETTE.ink} strokeWidth="8" />
  <circle cx="0" cy="28" r="5.6" fill={PALETTE.ink} />
</g>;

export function sideKittenRig(): RigNode {
  const leg = (id: keyof typeof PIVOT.sideLegs, far: boolean): RigNode => {
    const [x, y] = PIVOT.sideLegs[id];
    return { id, pivot: [x, y], art: { box: [x - 27, y - 14, 57, 74], el: at(x, y, legArt(far)) } };
  };
  const [qx, qy] = PIVOT.sideQ;
  return {
    id: 's', pivot: [0, 0],
    children: [{
      id: 's.body', pivot: PIVOT.sideBody,
      behind: [
        // The silhouette rim, behind everything else of hers: the body (static on it), then the head and ears (following them).
        { id: 's.rim', pivot: PIVOT.sideBody, art: { box: [-124, -134, 212, 116], el: <g>{rimShape(BODY_SIDE)}{rimShape('M-86-86q-10-2-15 3q9 1 12 8')}</g> } },
        { id: 's.rn', pivot: PIVOT.sideNeck, children: [headRimNode('s.rh', PIVOT.sideHead)] },
        { id: 's.tail', pivot: [-80, -78], art: { box: [-156, -192, 102, 136], el: <g transform="translate(10 0)">{tailStroke(SIDE_TAIL, 22, true)}</g> } },
        leg('s.legFB', true), leg('s.legFF', true),
      ],
      art: { box: [-116, -126, 196, 100], el: BODY_SIDE_ART },
      children: [
        leg('s.legNB', false), leg('s.legNF', false),
        { id: 's.wig', pivot: [-100, -92], art: { box: [-130, -130, 40, 70], el: <g fill="none" stroke="#d9975a" strokeWidth="3.6" strokeLinecap="round" opacity=".85"><path d="M-104-116q-10 16 0 32" /><path d="M-117-110q-8 11 0 22" /></g> } },
        { id: 's.neck', pivot: PIVOT.sideNeck, children: [headNode('s.head', PIVOT.sideHead, { perk: true })] },
      ],
    }, {
      id: 's.q', pivot: PIVOT.sideQ, art: { box: [qx - 28, qy - 52, 56, 94], el: at(qx, qy, Q_ART) },
    }],
  };
}

/* ------------------------------ yarn ball ------------------------------ */

const yarnLines = (r: number) => <g fill="none" strokeLinecap="round">
  {[-60, -25, 10, 45, 80, 120].map((a, i) => <ellipse key={a} rx={r * .98} ry={r * (.28 + (i % 3) * .1)} transform={`rotate(${a})`} stroke={i % 2 ? PALETTE.yarnLight : PALETTE.yarnDark} strokeOpacity={i % 2 ? .75 : .45} strokeWidth={r * .05} />)}
  <path d={`M${-r * .5} ${-r * .7}Q${-r * .1} ${-r * .1} ${r * .7} ${-r * .55}`} stroke={PALETTE.yarnLight} strokeWidth={r * .06} opacity=".8" />
</g>;

export function yarnBallRig(r: number): RigNode {
  return {
    id: 'b', pivot: [0, 0],
    children: [{
      id: 'b.spin', pivot: [0, 0], art: { box: [-r - 12, -r - 12, 2 * r + 24, 2 * r + 24], el: <g>
        <circle r={r} fill="url(#kc-yarn)" />
        <g clipPath="url(#kc-ball)" transform={`scale(${r / 88})`}>{yarnLines(88)}</g>
        <circle r={r} fill="none" stroke={PALETTE.yarnInk} strokeWidth="2.6" />
        <path d={`M${r * .6} ${-r * .8}q${r * .3} ${-r * .3} ${r * .5} ${-r * .05}`} fill="none" stroke={PALETTE.yarnInk} strokeWidth="5" strokeLinecap="round" />
        <path d={`M${r * .6} ${-r * .8}q${r * .3} ${-r * .3} ${r * .5} ${-r * .05}`} fill="none" stroke={PALETTE.yarn} strokeWidth="2.6" strokeLinecap="round" />
      </g> },
    }],
  };
}

/* ------------------------------- tangle ------------------------------- */

/** The big ball (radius 88) with loose loops that tumble with it. Also the leftover ball after the pop. */
const TANGLE_BALL = <g>
  <circle r="88" fill="url(#kc-yarn)" />
  <g clipPath="url(#kc-ball)">{yarnLines(88)}</g>
  <circle r="88" fill="none" stroke={PALETTE.yarnInk} strokeWidth="3" />
  <g fill="none" strokeLinecap="round">
    {['M60 60C84 70 100 96 80 104C64 110 60 90 72 80', 'M-86 30C-108 36-116 64-98 70C-84 74-80 58-90 50', 'M20-86C24-108 50-116 56-100C60-88 46-84 40-92'].map((d) => <g key={d}><path d={d} stroke={PALETTE.yarnInk} strokeWidth="8.5" /><path d={d} stroke={PALETTE.yarn} strokeWidth="5" /></g>)}
  </g>
</g>;
const WRAP_ANGLES = [-62, -18, 28, 70, 112, 150];
const wrapArt = (i: number) => <g transform={`rotate(${WRAP_ANGLES[i]})`} fill="none" strokeLinecap="round">
  <path d="M-86 6A87 30 0 0 0 86 6" stroke="#5a2a3a" strokeOpacity=".55" strokeWidth="11" />
  <path d="M-86 6A87 30 0 0 0 86 6" style={{ stroke: `var(--cat-c${i}, #f6c453)` }} strokeWidth="7.5" />
  <path d="M-70 14A87 30 0 0 0 40 30" stroke="#fff" strokeOpacity=".4" strokeWidth="2" />
</g>;
const wraps = (prefix: string) => WRAP_ANGLES.map((_, i): RigNode => ({ id: `${prefix}${i}`, pivot: [0, 0], art: { box: [-96, -96, 192, 192], el: wrapArt(i) } }));

/** A small front paw hugging the yarn, pink toe beans toward the class. */
const PAW_HUG = <g>
  <path d="M-14 6C-16-5-10-14 0-14C10-14 16-5 14 6C11 11-11 11-14 6Z" fill="url(#kc-sock)" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
  <g fill="#f5a4a7"><ellipse cx="0" cy="1.6" rx="6" ry="4.6" /><circle cx="-8" cy="-5" r="2.8" /><circle cx="-2.8" cy="-9" r="2.8" /><circle cx="2.8" cy="-9" r="2.8" /><circle cx="8" cy="-5" r="2.8" /></g>
</g>;
const HIND_PAW = <g>
  <path d="M-20-14C-26 2-18 22 0 24C18 22 26 2 20-14C12-26-12-26-20-14Z" fill="url(#kc-sock)" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
  <g fill="#f5a4a7" stroke="#c07072" strokeWidth="1.2">
    <ellipse cx="0" cy="8" rx="9.5" ry="7" /><circle cx="-12" cy="-4" r="4" /><circle cx="-4" cy="-10" r="4" /><circle cx="5" cy="-10" r="4" /><circle cx="13" cy="-4" r="4" />
  </g>
</g>;
const TANGLE_TAIL = 'M-84 18C-118 14-134-10-126-38C-122-52-104-58-98-44';

export function tangleRig(): RigNode {
  return {
    id: 'g', pivot: [0, 0],
    children: [
      // Ball, tail and hind paw grow in together as she lands (g.core); her head is separate so it keeps its size.
      // The head's silhouette rim, behind the ball and everything else (it follows the head).
      headRimNode('g.rh', PIVOT.tangleHead),
      { id: 'g.core', pivot: [0, 0], behind: [
        { id: 'g.tail', pivot: [-82, 18], art: { box: [-156, -82, 92, 120], el: tailStroke(TANGLE_TAIL, 20, true) } },
      ], children: [
        { id: 'g.ball', pivot: [0, 0], art: { box: [-126, -126, 252, 252], el: TANGLE_BALL }, children: wraps('g.wrap') },
        { id: 'g.hind', pivot: [-56, 60], art: { box: [-90, 30, 64, 64], el: at(-62, 64, <g transform="rotate(28)">{HIND_PAW}</g>) } },
      ] },
      headNode('g.head', PIVOT.tangleHead, { loop: true }),
      { id: 'g.fore', pivot: [0, 0], children: [
        // Yarn wound across the kitten's chin: she is inside the tangle.
        { id: 'g.front', pivot: [0, -30], art: { box: [-96, -62, 192, 64], el: <g>{['M-84-22C-40-44 30-48 86-24', 'M-76-8C-30-30 40-26 80-40', 'M-60-40C-20-20 30-18 72-10'].map((d, i) => yarnStroke(d, 6, i === 1 ? PALETTE.yarnLight : PALETTE.yarn))}</g> } },
        // Paws hug the front of the ball just below her chin (clear of the cheeks and blush).
        { id: 'g.pawL', pivot: [-46, -8], art: { box: [-70, -38, 48, 44], el: at(-46, -16, <g transform="rotate(-16)">{PAW_HUG}</g>) } },
        { id: 'g.pawR', pivot: [48, -6], art: { box: [24, -36, 48, 44], el: at(48, -14, <g transform="rotate(16)">{PAW_HUG}</g>) } },
      ] },
    ],
  };
}

/* ---------------------------- sitting kitten ---------------------------- */

/* Front view, sitting. Haunches about 10% narrower than her head, and her tail wraps around her front paws. */
const BODY_SIT = 'M-36-118C-61-110-74-82-74-52C-74-22-65-4-48 0H48C65-4 74-22 74-52C74-82 61-110 36-118Z';
const HAUNCH_L = 'M-79-4C-92-24-86-60-63-68C-45-74-32-56-34-34C-36-14-52 2-79-4Z';
const HIND_FOOT_L = 'M-88 0C-94-9-87-19-75-19C-63-19-56-11-58-2C-59 4-85 6-88 0Z';
const FRONT_LEG_L = 'M-35-70C-36-48-36-30-35-20C-42-14-42 0-29 0H-6C4 0 4-14-3-20C-2-30-2-48-3-70Z';
const FRONT_SOCK_L = 'M-36-21C-42-14-42 0-29 0H-6C4 0 4-14-2-21Q-10-16-19-18Q-28-16-36-21Z';
const BIB = 'M-36-114C-46-96-44-78-36-66Q-30-58-22-63Q-15-54-7-61Q0-53 7-61Q15-54 22-63Q30-58 36-66C44-78 46-96 36-114Z';
/** The tail comes out from under her right hind foot and curls around the front of her paws, tip turned up. */
const TAIL_WRAP = 'M76-12C60-4 34-3 12-6C-8-9-20-14-22-24C-23-31-17-35-12-31';
const side2 = (el: (sideSign: 1 | -1) => ReactNode) => [1, -1].map((s) => <g key={s} transform={`scale(${-s} 1)`}>{el(s as 1 | -1)}</g>);
const haunch = <g>
  <path d={HAUNCH_L} fill="url(#kc-body)" />
  <path d="M-85-38C-85-56-76-66-63-68" fill="none" stroke={PALETTE.rim} strokeWidth="4" strokeLinecap="round" opacity=".8" />
  <path d={HAUNCH_L} fill="none" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
</g>;
const hindFoot = <g>
  <path d={HIND_FOOT_L} fill="url(#kc-sock)" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
  <path d="M-80-1v-5M-73 0v-5" stroke="#c09370" strokeWidth="2" strokeLinecap="round" />
</g>;
const frontLeg = <g>
  <path d={FRONT_LEG_L} fill="url(#kc-leg)" />
  <path d={FRONT_SOCK_L} fill="url(#kc-sock)" />
  <path d="M-31-60q-2 16-1 30" fill="none" stroke={PALETTE.rim} strokeWidth="3" strokeLinecap="round" opacity=".6" />
  <path d="M-35-60C-36-44-36-30-35-20C-42-14-42 0-29 0H-6C4 0 4-14-3-20C-2-30-2-44-3-60" fill="none" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />
  <path d="M-24 0v-6M-15 0v-6" stroke="#c09370" strokeWidth="2" strokeLinecap="round" />
</g>;
const BODY_SIT_ART = <g>
  <path d={BODY_SIT} fill="url(#kc-body)" />
  <g clipPath="url(#kc-body-sit)">
    <g fill={PALETTE.stripe} opacity=".45"><path d="M-76-80Q-58-78-50-72Q-60-66-76-68Z" /><path d="M-76-54Q-60-52-54-46Q-62-42-76-44Z" /><path d="M76-80Q58-78 50-72Q60-66 76-68Z" /><path d="M76-54Q60-52 54-46Q62-42 76-44Z" /></g>
    <path d="M-66-66C-66-92-55-110-36-116" fill="none" stroke={PALETTE.rim} strokeWidth="5" strokeLinecap="round" opacity=".85" />
    <ellipse cx="0" cy="6" rx="86" ry="18" fill="#9b3f18" opacity=".18" />
  </g>
  <path d={BODY_SIT} fill="none" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
  {side2(() => haunch)}
  {hindFoot}
  {side2(() => frontLeg)}
  {/* the right hind foot is drawn over the tail's root, so the tail comes out from under it */}
  {tailStroke(TAIL_WRAP, 15)}
  <g transform="scale(-1 1)">{hindFoot}</g>
  <path d={BIB} fill="url(#kc-cream)" />
  {/* the bib's scalloped edge in a slightly deeper cream (no brown ink, so it never reads as a second mouth) */}
  <path d="M-36-66Q-30-58-22-63Q-15-54-7-61Q0-53 7-61Q15-54 22-63Q30-58 36-66" fill="none" stroke="#efcfae" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
</g>;

const HEART_D = 'M0 12C-20-2-24-16-15-23C-8-28-2-25 0-18C2-25 8-28 15-23C24-16 20-2 0 12Z';
export const HEART_ART = <g><path d={HEART_D} fill="url(#kc-heart)" stroke="#a8354e" strokeWidth="2" strokeLinejoin="round" /><ellipse cx="-9" cy="-16" rx="4" ry="2.6" transform="rotate(-35 -9 -16)" fill="#fff" opacity=".75" /></g>;

/** The loose end of the little leftover ball, lying on the floor toward her paw (ball units: radius 88, floor at y = 88). */
const LEFTOVER_END = 'M-40 84C-90 92-130 78-170 86C-200 92-226 80-250 88';

export function sittingKittenRig(): RigNode {
  return {
    id: 'c', pivot: [0, 0],
    art: { box: [-104, -124, 208, 132], el: BODY_SIT_ART },
    children: [
      // The leftover ball sits between her body and her head in depth: at the pop it hides her body while her head pops out on top.
      { id: 'c.lb', pivot: [0, 0], children: [
        { id: 'c.lb.end', pivot: [0, 0], art: { box: [-262, 66, 236, 34], el: yarnStroke(LEFTOVER_END, 13) } },
        { id: 'c.lb.spin', pivot: [0, 0], art: { box: [-126, -126, 252, 252], el: TANGLE_BALL }, children: wraps('c.lb.wrap') },
      ] },
      { id: 'c.neck', pivot: PIVOT.sitNeck, children: [headNode('c.head', PIVOT.sitHead, { hat: true })] },
    ],
  };
}

/* ------------------------------ effects ------------------------------ */

/** Three small, pale puffs where she lands in the yarn (ground contact at 0,0). */
export const DUST_ART = <g>{[[-84, -8, 9], [-66, -15, 7], [82, -10, 8]].map(([x, y, r]) => <circle key={x} cx={x} cy={y} r={r} fill="url(#kc-puff)" stroke="#f1cfcd" strokeWidth="1.4" />)}</g>;

/** A little puff of loose yarn fluff (radius about 18) for the pop: yarn pink with a curl of yarn in it, not a cotton ball. */
export const POP_POM_ART = <g>
  <path d={pomPath(0, 0, 18, 12)} fill="url(#kc-fluff)" stroke={PALETTE.yarnInk} strokeOpacity=".7" strokeWidth="1.8" strokeLinejoin="round" />
  <path d="M-8 4C-10-4-2-9 4-6C9-3 6 5 0 4C-4 3-3-2 1-2" fill="none" stroke={PALETTE.yarnLight} strokeWidth="2.6" strokeLinecap="round" />
</g>;
/** Drifting pop-out bits: a warm sparkle and a tiny pink heart (about 12 across). */
export const DRIFT_ART = {
  spark: <path d={star(0, 0, 12)} fill="#fff4c9" stroke="#e7b654" strokeWidth="1.8" strokeLinejoin="round" />,
  heart: <g transform="scale(.5)"><path d={HEART_D} transform="translate(0 6)" fill="#f7a3b6" stroke="#c9557a" strokeWidth="3" strokeLinejoin="round" /></g>,
} as const;

/** The twinkles around her finale spot (TWINKLES), leaving out any the layout found over a name. */
export const twinkleArt = (shown: readonly boolean[]) => <g fill="#fff4c9" stroke="#e7b654" strokeWidth="1.6" strokeLinejoin="round">
  {TWINKLES.map(([x, y, r], i) => shown[i] && <path key={i} className={`cat-twinkle is-${'abcd'[i]}`} d={star(x, y, r)} />)}
</g>;

export const SHADOW_ART = (rx: number) => <ellipse rx={rx} ry={Math.max(8, rx * .12)} fill="url(#kc-shadow)" />;
