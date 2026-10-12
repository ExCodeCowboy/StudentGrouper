/**
 * Dino egg hatch. Every card becomes a speckled egg in a straw nest; a big
 * lavender egg on the stage hatches a baby dino that tries a mighty roar
 * (out comes a peep), then stomps: a gold ring rolls out and every egg cracks
 * as it passes, each with its own baby peeking out.
 *
 * Stage: one memoized tree of pivot layers holding static SVG, animated only
 * by keyframes compiled once from dinoEggTimeline.ts (no per-frame JS).
 * Cover: pure CSS, driven by the reveal custom properties.
 */
import { memo, useId, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { measureRevealCovers } from './revealTargets';
import type { RevealEffect } from './types';
import { DINO_CHIPS, DINO_DURATION_MS, DINO_DUST, DINO_RIG, DINO_STAGE_CSS, dinoCoverVars, dinoDistance, dinoEggPlacement, dinoReach } from './dinoEggTimeline';
import './dinoEgg.css';

const u = (value: number) => `calc(var(--u) * ${value})`;
type Box = readonly [number, number, number, number];

/** A pivot-origin layer: its 0×0 box sits at `at` (parent units); art is drawn around the pivot. */
function Layer({ name, at = [0, 0], box, art, children }: { name: string; at?: readonly [number, number]; box?: Box; art?: ReactNode; children?: ReactNode }) {
  return <div className={`dino-l dino-${name}`} style={{ left: u(at[0]), top: u(at[1]) }}>
    {art && box && <svg viewBox={box.join(' ')} style={{ left: u(box[0]), top: u(box[1]), width: u(box[2]), height: u(box[3]) }} aria-hidden="true" focusable="false">{art}</svg>}
    {children}
  </div>;
}

// ---- Colours ----
const INK = '#5a4336';        // egg + nest outline
const MINT_INK = '#2f4f45';   // baby outline
const EYE = '#2a2130';
const MOUTH = '#3a2830';
const at = (pair: readonly number[]) => [pair[0], pair[1]] as const;

// ---- Egg (egg-rock local: base at 0,0, top at 0,-200; seam around y -112) ----
const EGG = 'M0 -200C48 -200 78 -140 78 -88C78 -34 46 0 0 0C-46 0 -78 -34 -78 -88C-78 -140 -48 -200 0 -200Z';
const ZIG: [number, number][] = [[-80, -110], [-62, -121], [-47, -104], [-32, -121], [-17, -104], [-2, -121], [13, -104], [28, -121], [43, -104], [58, -121], [80, -110]];
/** The broken rim's stroke; its ends stop at the egg's outline (x ±77 at the seam) so a tilted lid never shows a stub. */
const zigPath = (dy: number) => `M${ZIG.map(([x, y]) => `${Math.max(-77, Math.min(77, x))} ${y + dy}`).join(' L')}`;
const TOP_CLIP = `M-90 -215 L90 -215 L90 -110 L${[...ZIG].reverse().map(([x, y]) => `${x} ${y}`).join(' L')} L-90 -110Z`;
const BOTTOM_CLIP = `M-90 10 L90 10 L90 -110 L${[...ZIG].reverse().map(([x, y]) => `${x} ${y - 1.5}`).join(' L')} L-90 -110Z`;
const LEMON_SPOTS: [number, number, number, number][] = [[-40, -150, 7, 5], [22, -176, 5, 4], [48, -134, 8, 6], [-58, -122, 6, 5], [8, -140, 4, 3], [-22, -62, 9, 7], [42, -54, 7, 5], [-50, -34, 5, 4], [14, -24, 4, 3], [56, -92, 5, 4], [-60, -80, 5, 4]];
const CORAL_SPOTS: [number, number, number, number][] = [[-14, -182, 4, 3], [58, -76, 5, 4], [-30, -128, 5, 4], [30, -94, 4, 3], [-56, -58, 4, 3], [0, -40, 5, 4], [-36, -170, 3, 3], [34, -160, 3, 3]];

function EggArt({ id }: { id: string }) {
  return <g>
    <path d={EGG} fill={`url(#${id}-shell)`} />
    <g fill="#ffcf5c">{LEMON_SPOTS.map(([x, y, rx, ry], i) => <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(${i * 37} ${x} ${y})`} />)}</g>
    <g fill="#ff9f80">{CORAL_SPOTS.map(([x, y, rx, ry], i) => <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(${i * 53} ${x} ${y})`} />)}</g>
    {/* Form shade on the right, bounce light along the lower left, a soft highlight top-left. */}
    <g clipPath={`url(#${id}-egg)`}><path d={EGG_SHADE} fillRule="evenodd" fill="#8d74c4" opacity=".22" /></g>
    <path d="M-66 -52C-62 -28 -44 -10 -18 -5" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".45" />
    <ellipse cx="-34" cy="-150" rx="14" ry="26" fill="#fff" opacity=".6" transform="rotate(-24 -34 -150)" />
    <ellipse cx="-16" cy="-176" rx="5" ry="7" fill="#fff" opacity=".7" transform="rotate(-24 -16 -176)" />
    <path d={EGG} fill="none" stroke={INK} strokeWidth="4" />
  </g>;
}
const Rim = ({ dy }: { dy: number }) => <path d={zigPath(dy)} fill="none" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />;
/** The lower half shell, front view (egg-rock local), with its broken zigzag edge. */
const BottomShell = ({ id }: { id: string }) => <g clipPath={`url(#${id}-bottom)`}><EggArt id={id} /></g>;

// ---- Baby (body local: feet centre on the ground at 0,0; body top at -160) ----
const BODY = 'M-4 -160C40 -160 64 -136 70 -112C84 -110 94 -96 90 -80C87 -67 77 -61 72 -59C70 -22 42 0 -4 0C-52 0 -78 -32 -78 -80C-78 -128 -50 -160 -4 -160Z';
/** Shift an absolute-command path (M/C/L/Z only) by (dx, dy). */
const shiftPath = (d: string, dx: number, dy: number) => {
  let index = 0;
  return d.replace(/-?\d*\.?\d+/g, (value) => String(Number(value) + (index++ % 2 ? dy : dx)));
};
/**
 * Cel shading without SVG masks (masks force offscreen layers): inside a clip of the shape,
 * fill everything except the shape nudged toward (or away from) the light.
 */
const crescent = (d: string, dx: number, dy: number) => `M-300 -400H300V200H-300Z${shiftPath(d, dx, dy)}`;
const SPIKES = ['M-54 -144Q-88 -158 -70 -118', 'M-71 -116Q-104 -114 -79 -90', 'M-78 -86Q-107 -76 -79 -58', 'M-77 -54Q-101 -42 -72 -28'];
const EGG_SHADE = crescent(EGG, -12, -9);
const BODY_SHADE = crescent(BODY, -11, -12);
const BODY_RIM = crescent(BODY, 5, 6);

function Defs({ id }: { id: string }) {
  return <defs>
    <radialGradient id={`${id}-shell`} cx=".36" cy=".3" r=".85"><stop offset="0" stopColor="#fdfbff" /><stop offset=".55" stopColor="#ece4ff" /><stop offset="1" stopColor="#c6b4ec" /></radialGradient>
    <radialGradient id={`${id}-mint`} cx=".36" cy=".26" r=".9"><stop offset="0" stopColor="#b6f2d6" /><stop offset=".5" stopColor="#8fddb9" /><stop offset="1" stopColor="#62c29c" /></radialGradient>
    <linearGradient id={`${id}-spike`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ddd0ff" /><stop offset="1" stopColor="#b09bef" /></linearGradient>
    <linearGradient id={`${id}-nest`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c48a48" /><stop offset="1" stopColor="#95602c" /></linearGradient>
    <linearGradient id={`${id}-hole`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a2a36" stopOpacity=".85" /><stop offset=".6" stopColor="#3a2a36" stopOpacity=".6" /><stop offset="1" stopColor="#3a2a36" stopOpacity="0" /></linearGradient>
    <radialGradient id={`${id}-glow`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff3c4" stopOpacity=".95" /><stop offset=".55" stopColor="#ffe08a" stopOpacity=".45" /><stop offset="1" stopColor="#ffd66b" stopOpacity="0" /></radialGradient>
    <radialGradient id={`${id}-contact`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#5a3a1c" stopOpacity=".34" /><stop offset=".6" stopColor="#5a3a1c" stopOpacity=".16" /><stop offset="1" stopColor="#5a3a1c" stopOpacity="0" /></radialGradient>
    <clipPath id={`${id}-top`}><path d={TOP_CLIP} /></clipPath>
    <clipPath id={`${id}-bottom`}><path d={BOTTOM_CLIP} /></clipPath>
    <clipPath id={`${id}-egg`}><path d={EGG} /></clipPath>
    <clipPath id={`${id}-body`}><path d={BODY} /></clipPath>
    {/* Angry lids: a V that is low between the eyes and high at their outer corners. */}
    <clipPath id={`${id}-lid`}><path d="M-44 -20.4L0 6 44 -20.4V30H-44Z" /></clipPath>
  </defs>;
}

/** The egg's top shell, drawn around its rim pivot (egg-rock 0,-112). Also the hat. */
function ShellTop({ id, rim = false }: { id: string; rim?: boolean }) {
  return <g transform="translate(0 112)">
    <g clipPath={`url(#${id}-top)`}><EggArt id={id} /></g>
    {rim && <Rim dy={0} />}
  </g>;
}

function BodyArt({ id }: { id: string }) {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <g fill={`url(#${id}-spike)`} stroke="#7f68c9" strokeWidth="3.5">{SPIKES.map((d) => <path key={d} d={`${d}Z`} />)}</g>
    <path d={BODY} fill={`url(#${id}-mint)`} />
    <ellipse cx="18" cy="-34" rx="39" ry="29" fill="#effbe2" />
    <path d="M-12 -44Q16 -36 45 -46M-16 -28Q16 -20 49 -30M-10 -12Q16 -6 41 -14" fill="none" stroke="#cfe8bd" strokeWidth="3" />
    <g clipPath={`url(#${id}-body)`}>
      <path d={BODY_SHADE} fillRule="evenodd" fill="#2c8a67" opacity=".28" />
      <path d={BODY_RIM} fillRule="evenodd" fill="#e9fff5" opacity=".55" />
    </g>
    <path d={BODY} fill="none" stroke={MINT_INK} strokeWidth="4.5" />
    {/* Snout: nostrils and a glint. */}
    <circle cx="84" cy="-92" r="2.3" fill={MINT_INK} /><circle cx="76" cy="-94" r="2" fill={MINT_INK} />
    <ellipse cx="78" cy="-103" rx="6" ry="2.6" fill="#fff" opacity=".5" transform="rotate(-10 78 -103)" />
    <ellipse cx="-40" cy="-118" rx="9" ry="16" fill="#fff" opacity=".28" transform="rotate(28 -40 -118)" />
  </g>;
}

/** A stubby arm hanging from its shoulder pivot, with three little claws (they point up when it roars). */
const Arm = ({ far = false }: { far?: boolean }) => <g transform={far ? 'scale(-.85 .85)' : undefined} strokeLinejoin="round" strokeLinecap="round">
  <g fill="#fff4e2" stroke={MINT_INK} strokeWidth="1.8"><path d="M-5 24L-2.5 33 1 25Z" /><path d="M2.5 27L6 36 9 27Z" /><path d="M10 24L15 32.5 15.5 21Z" /></g>
  <path d="M-7 -4C-12 12 -5 27 5 29C14 31 19 22 15 12C12 3 5 -4 -7 -4Z" fill={far ? '#6fcaa4' : '#8fddb9'} stroke={MINT_INK} strokeWidth="4" />
  <path d="M2 24Q6 27 10 25" fill="none" stroke={MINT_INK} strokeWidth="2.2" opacity=".6" />
</g>;
const Foot = ({ far = false }: { far?: boolean }) => <g stroke={MINT_INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
  <path d="M-19 6C-19 -7 -8 -11 4 -11C17 -11 26 -4 26 6C26 12 19 16 4 16C-11 16 -19 12 -19 6Z" fill={far ? '#6fcaa4' : '#8fddb9'} />
  <path d="M-13 11Q4 18 21 11" fill="none" stroke="#f6d9b8" strokeWidth="4.5" />
  <g fill="#fff4e2" strokeWidth="2"><circle cx="24" cy="4" r="3.2" /><circle cx="19" cy="-5" r="3" /><circle cx="11" cy="-9" r="2.8" /></g>
</g>;

/** One dust cloud (four merged arcs over a soft round base), about 40 x 20 u around its centre. */
const CLOUD = 'M-20 6A5.5 5.5 0 0 1 -17 -3A9 9 0 0 1 -1 -9A9.5 9.5 0 0 1 17 -3A5.5 5.5 0 0 1 20 6Q0 10 -20 6Z';
/** Pale dust clouds with a light outline and a soft highlight: [x, y, scale]; mirrored when `flip`. */
const Puffs = ({ clouds, flip = false }: { clouds: [number, number, number][]; flip?: boolean }) => <g transform={flip ? 'scale(-1 1)' : undefined}>
  {clouds.map(([x, y, scale]) => <g key={`${x},${y}`} transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d={CLOUD} fill="#f6e7c8" stroke="#c9a06a" strokeWidth={2.5 / scale} strokeLinejoin="round" />
    <path d="M-12 -2Q-8 -6.5 -2 -5.5" fill="none" stroke="#fffaf0" strokeWidth={2.6 / scale} strokeLinecap="round" opacity=".9" />
  </g>)}
</g>;
const PUFF_BOX: Box = [-34, -22, 68, 36];

/** Stomp rays around the foot; the baby is drawn over them, so only the rays clear of it show. */
const IMPACT_RAYS = 'M46 -8L84 -18M40 -30L64 -58M54 10L90 14M-104 -8L-142 -18M-98 -30L-122 -58M-110 10L-146 14';
/** Roar wind: three short strokes fanning out from the open mouth. */
const ROAR_LINES = 'M8 -30Q26 -42 46 -38M14 -4Q34 -8 56 -4M8 22Q26 32 44 34';

const star = (points: number, outer: number, inner: number, squash = 1) => Array.from({ length: points * 2 }, (_, i) => {
  const a = i * Math.PI / points; const r = i % 2 ? inner : outer;
  return `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r * squash).toFixed(1)}`;
}).join('') + 'Z';
const BOOM_STAR = star(14, 78 * 1.12, 50 * 1.12, .78 / 1.12);
const FLASH_STAR = star(12, 112, 58);
/** Shell shards: convex, with the egg's curved outer surface on one side and straight broken edges. */
const CHIP_SHAPES = ['M-11 -4Q-2 -12 10 -8L8 7Q-2 10 -9 5Z', 'M-10 -8Q2 -12 10 -2L3 9L-9 4Z', 'M-11 2Q-8 -10 4 -10L11 -1L2 9L-7 8Z'];
/** A thin sheen lens just inside each shard's curved edge (inset, so it never pokes past the outline), and a spot. */
const CHIP_SHEENS = ['M-7 -3.4Q-1 -8.4 6.5 -5.4Q-.5 -5.6 -7 -3.4Z', 'M-5.5 -6Q2.5 -8.5 6.5 -2.5Q1.5 -5.5 -5.5 -6Z', 'M-7.5 .5Q-5.5 -6 2.5 -6.5Q-3.5 -4.5 -7.5 .5Z'];
const CHIP_SPOTS: [number, number][] = [[3, 2.5], [-3, 2], [2, 2.5]];

/** The roar: a big, taller-than-wide mouth with a row of tiny teeth, the tongue low (anchored at the peep's "o"). */
const MOUTH_TOP = (x: number) => { const s = (x / 26 + 1) / 2; return -10 * (1 - s) ** 2 - 36 * s * (1 - s) - 10 * s * s; };
const RoarMouth = () => <g strokeLinejoin="round">
  <path d="M-26 -10Q0 -18 26 -10C30 12 20 44 0 46C-20 44 -30 12 -26 -10Z" fill={MOUTH} stroke={MINT_INK} strokeWidth="3.5" />
  <ellipse cx="0" cy="12" rx="15" ry="17" fill="#1f1218" opacity=".6" />
  <path d="M-15 40Q-14 26 0 26Q14 26 15 40Q8 45 0 45Q-8 45 -15 40Z" fill="#ff8f9a" />
  <path d="M0 29V37" stroke="#e5566f" strokeWidth="2" strokeLinecap="round" />
  <g fill="#fff" stroke={MINT_INK} strokeWidth="1.2">{[-17, -6, 6, 17].map((x) => {
    const y = MOUTH_TOP(x) + 1;
    return <path key={x} d={`M${x - 4.4} ${y.toFixed(1)}L${x} ${(y + 8.5).toFixed(1)}L${x + 4.4} ${y.toFixed(1)}Z`} />;
  })}</g>
</g>;

const NestBackArt = ({ id }: { id: string }) => <g strokeLinecap="round">
  <ellipse cx="0" cy="38" rx="182" ry="24" fill={`url(#${id}-contact)`} />
  <ellipse cx="0" cy="4" rx="150" ry="38" fill={`url(#${id}-nest)`} stroke="#6f4520" strokeWidth="4" />
  <ellipse cx="0" cy="-1" rx="122" ry="22" fill="#5e3b1c" />
  <ellipse cx="0" cy="4" rx="96" ry="13" fill="#3e2510" opacity=".55" />
  <path d="M-140 -8Q-80 -40 0 -38Q80 -40 140 -8M-120 -22Q-40 -34 40 -30M-60 -34Q30 -42 118 -20" fill="none" stroke="#d6a45f" strokeWidth="4" />
  <path d="M-100 -30Q-20 -26 60 -36M-30 -40Q60 -34 128 -14" fill="none" stroke="#7d4f25" strokeWidth="2.5" opacity=".7" />
</g>;
const NestFrontArt = ({ id }: { id: string }) => <g strokeLinecap="round" strokeLinejoin="round">
  <path d="M-156 -6L-180 -18M150 6L178 -6M-122 40L-140 58M112 42L128 60" stroke="#8a5a2b" strokeWidth="6" />
  <path d="M-150 2C-150 30 -80 48 0 48C80 48 150 30 150 2C120 22 70 30 0 30C-70 30 -120 22 -150 2Z" fill={`url(#${id}-nest)`} stroke="#6f4520" strokeWidth="4" />
  <path d="M-130 20Q-100 36 -60 38M-90 42Q-40 30 10 44M-20 34Q40 46 100 34M60 44Q110 32 140 16M-146 10Q-120 30 -96 26" fill="none" stroke="#e2b46e" strokeWidth="4" />
  <path d="M-116 30Q-80 44 -30 40M20 40Q80 42 124 26" fill="none" stroke="#7d4f25" strokeWidth="3" />
  <ellipse cx="-146" cy="14" rx="14" ry="7" fill="#8fcf7a" stroke="#4f8a44" strokeWidth="2.5" transform="rotate(-28 -146 14)" />
  <ellipse cx="140" cy="22" rx="12" ry="6" fill="#8fcf7a" stroke="#4f8a44" strokeWidth="2.5" transform="rotate(24 140 22)" />
</g>;
const NEST_BACK_BOX: Box = [-190, -50, 380, 110];
const NEST_FRONT_BOX: Box = [-185, -20, 370, 90];
const BOTTOM_BOX: Box = [-90, -130, 180, 140];

/** The hero: every part is a static SVG on its own pivot layer (see storyboard §3.1). */
const DinoRig = memo(function DinoRig() {
  const id = `dino${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return <div className="dino-rig">
    <svg className="dino-defs" width="0" height="0" aria-hidden="true" focusable="false"><Defs id={id} /></svg>
    <Layer name="quake">
      {/* Nest, egg and half shell: one opacity group, so their fades never show through each other. */}
      <Layer name="nest-group">
        <Layer name="nest-back" box={NEST_BACK_BOX} art={<NestBackArt id={id} />} />
        <Layer name="egg-rock" at={at(DINO_RIG.eggRock)}>
          <Layer name="pop-flash" at={[0, -112]} box={[-120, -120, 240, 240]} art={<g>
            <circle r="96" fill={`url(#${id}-glow)`} />
            <path d={FLASH_STAR} fill="#fff8de" stroke="#ffd66b" strokeWidth="5" strokeLinejoin="round" />
          </g>} />
          <Layer name="egg-bottom-back" box={[-80, -130, 160, 40]} art={<ellipse cx="0" cy="-112" rx="72" ry="11" fill="#b3a0da" />} />
          {/* Inside the egg: the baby's face in shadow, seen through the gap under the lifted lid. */}
          <Layer name="peek" box={[-82, -182, 164, 92]} art={<g clipPath={`url(#${id}-egg)`}>
            <rect x="-82" y="-182" width="164" height="92" fill="#86d9b4" />
            <circle cx="62" cy="-110" r="8" fill="#ff9fae" opacity=".7" />
            <rect x="-82" y="-182" width="164" height="62" fill={`url(#${id}-hole)`} />
          </g>}>
            <Layer name="peek-eyes" at={at(DINO_RIG.peekEyes)} box={[-26, -16, 52, 32]} art={<g>
              <ellipse cx="14" cy="0" rx="10.5" ry="12.5" fill={EYE} /><ellipse cx="-14" cy="0" rx="9" ry="11" fill={EYE} />
              <ellipse cx="14" cy="7" rx="6" ry="3.2" fill="#6d5c96" /><ellipse cx="-14" cy="6" rx="5" ry="2.8" fill="#6d5c96" />
              <circle cx="18" cy="-5" r="4.2" fill="#fff" /><circle cx="-10.5" cy="-4.5" r="3.4" fill="#fff" />
            </g>} />
          </Layer>
          <Layer name="egg-bottom-front" box={BOTTOM_BOX} art={<BottomShell id={id} />}>
            <Layer name="bottom-rim" box={[-90, -130, 180, 34]} art={<Rim dy={-1.5} />} />
          </Layer>
          <Layer name="egg-top" at={at(DINO_RIG.eggTop)} box={[-90, -100, 180, 120]} art={<ShellTop id={id} />}>
            <Layer name="top-rim" box={[-90, -16, 180, 32]} art={<g transform="translate(0 112)"><Rim dy={0} /></g>} />
          </Layer>
          <Layer name="crack" at={at(DINO_RIG.crack)} box={[-72, -16, 76, 32]} art={<g fill="none" strokeLinejoin="round" strokeLinecap="round">
            <path d="M-65 6L-50 -11-35 6-20 -11 0 0" stroke="#fff" strokeWidth="3" transform="translate(0 2.5)" />
            <path d="M-65 6L-50 -11-35 6-20 -11 0 0M-50 -11l-3 -9" stroke={INK} strokeWidth="3.5" />
          </g>} />
        </Layer>
        <Layer name="nest-front" box={NEST_FRONT_BOX} art={<NestFrontArt id={id} />} />
      </Layer>
      {/* Impact burst: behind the baby, so only the rays clear of its silhouette show. */}
      <Layer name="impact" at={at(DINO_RIG.dust)} box={[-150, -80, 300, 100]} art={<g strokeLinecap="round" fill="none">
        <path d={IMPACT_RAYS} stroke="#e9a13f" strokeWidth="9" />
        <path d={IMPACT_RAYS} stroke="#fffbea" strokeWidth="4.5" />
      </g>} />
      <Layer name="baby-x" at={at(DINO_RIG.babyX)}>
        <Layer name="baby-exit">
          <Layer name="shadow" box={[-70, -14, 140, 28]} art={<ellipse cx="0" cy="2" rx="60" ry="10" fill="#3c2a1e" opacity=".18" />} />
          {/* Landing dust puffs out on both sides of the feet (behind them, so they read as kicked-up dust). */}
          <Layer name="land-dust-l" at={[DINO_RIG.landDust[0] - 66, DINO_RIG.landDust[1] - 5]} box={PUFF_BOX} art={<Puffs flip clouds={[[0, 0, .95]]} />} />
          <Layer name="land-dust-r" at={[DINO_RIG.landDust[0] + 70, DINO_RIG.landDust[1] - 5]} box={PUFF_BOX} art={<Puffs clouds={[[0, 0, .95]]} />} />
          <Layer name="baby-y">
            <Layer name="foot-far" at={at(DINO_RIG.footFar)} box={[-24, -16, 52, 36]} art={<Foot far />} />
            <Layer name="baby-body">
              <Layer name="spring">
                <Layer name="tail" at={[-58, -22]} box={[-80, -70, 100, 100]} art={<g strokeLinejoin="round">
                  <path d="M6 -12C-22 -12 -46 -22 -58 -44C-62 -52 -54 -58 -48 -50C-38 -36 -18 -30 8 14Z" fill="#86d9b4" stroke={MINT_INK} strokeWidth="4" />
                  <path d="M-30 -24Q-40 -44 -22 -30M-46 -38Q-62 -54 -42 -46" fill="#c3b0f5" stroke="#7f68c9" strokeWidth="3" />
                </g>} />
                <Layer name="arm-far" at={[-46, -54]} box={[-24, -8, 32, 46]} art={<Arm far />} />
                <Layer name="body-art" box={[-112, -172, 212, 178]} art={<BodyArt id={id} />} />
                {/* The far arm raised for the roar, drawn in front so its claws show at the shoulder. */}
                <Layer name="arm-far-up" at={[-58, -60]} box={[-24, -8, 32, 46]} art={<Arm far />} />
                <Layer name="cheeks" at={[20, -68]} box={[-50, -14, 100, 28]} art={<g fill="#ff9fae" opacity=".8"><circle cx="38" cy="2" r="9" /><circle cx="-36" cy="-2" r="7.5" /></g>} />
                <Layer name="blush" at={[20, -68]} box={[-54, -16, 108, 32]} art={<g>
                  <ellipse cx="38" cy="2" rx="15" ry="8.5" fill="#ff7f96" opacity=".55" /><ellipse cx="-36" cy="-2" rx="11" ry="7" fill="#ff7f96" opacity=".55" />
                  <path d="M30 6l5-8M37 6l5-8M44 6l5-8" stroke="#e5566f" strokeWidth="2.4" strokeLinecap="round" />
                </g>} />
                <Layer name="eyes-open" at={at(DINO_RIG.babyEyes)} box={[-30, -18, 60, 36]} art={<g>
                  <ellipse cx="17" cy="1" rx="11" ry="13" fill={EYE} /><ellipse cx="-17" cy="-1" rx="9.5" ry="11.5" fill={EYE} />
                  <ellipse cx="17" cy="8.5" rx="6.5" ry="3.4" fill="#6d5c96" /><ellipse cx="-17" cy="5.5" rx="5.5" ry="3" fill="#6d5c96" />
                  <circle cx="21" cy="-4" r="4.4" fill="#fff" /><circle cx="13" cy="6" r="1.8" fill="#fff" /><circle cx="-14" cy="-5" r="3.6" fill="#fff" /><circle cx="-20" cy="3" r="1.5" fill="#fff" />
                </g>} />
                <Layer name="eyes-squeeze" at={at(DINO_RIG.babyEyes)} box={[-30, -12, 60, 24]} art={<path d="M-25 -6L-11 0-25 6M25 -6L11 0 25 6" fill="none" stroke={EYE} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />} />
                {/* Fierce roar eyes: the open eyes under angry slanted lids. */}
                <Layer name="eyes-fierce" at={at(DINO_RIG.babyEyes)} box={[-32, -18, 64, 34]} art={<g>
                  <g clipPath={`url(#${id}-lid)`}>
                    <ellipse cx="17" cy="1" rx="11" ry="13" fill={EYE} /><ellipse cx="-17" cy="-1" rx="9.5" ry="11.5" fill={EYE} />
                    <ellipse cx="17" cy="8.5" rx="6.5" ry="3.4" fill="#6d5c96" /><ellipse cx="-17" cy="5.5" rx="5.5" ry="3" fill="#6d5c96" />
                    <circle cx="20" cy="2" r="3.4" fill="#fff" /><circle cx="-14" cy="1" r="2.8" fill="#fff" />
                  </g>
                  <path d="M4 3.6L30 -12M-4 3.6L-29 -11.4" stroke={MINT_INK} strokeWidth="4.5" strokeLinecap="round" />
                </g>} />
                <Layer name="eyes-happy" at={at(DINO_RIG.babyEyes)} box={[-30, -12, 60, 20]} art={<path d="M7 3Q17 -10 27 3M-26 2Q-17 -9 -8 2" fill="none" stroke={EYE} strokeWidth="4.5" strokeLinecap="round" />} />
                <Layer name="brows" at={[23, -114]} box={[-34, -10, 68, 16]} art={<path d="M31 -6L10 2M-29 -6L-11 1" stroke={MINT_INK} strokeWidth="5" strokeLinecap="round" />} />
                <Layer name="mouth-smile" at={[31, -64]} box={[-14, -6, 28, 14]} art={<path d="M-10 -2Q0 8 10 -2" fill="none" stroke={MOUTH} strokeWidth="3.5" strokeLinecap="round" />} />
                <Layer name="mouth-puff" at={[31, -64]} box={[-10, -4, 20, 8]} art={<path d="M-5 0H5" stroke={MOUTH} strokeWidth="3.5" strokeLinecap="round" />} />
                <Layer name="mouth-roar" at={[31, -64]} box={[-32, -22, 64, 72]} art={<RoarMouth />} />
                <Layer name="roar-lines" at={[96, -72]} box={[0, -50, 64, 94]} art={<g fill="none" strokeLinecap="round">
                  <path d={ROAR_LINES} stroke="#e9a13f" strokeWidth="8" />
                  <path d={ROAR_LINES} stroke="#fffbea" strokeWidth="4" />
                </g>} />
                <Layer name="mouth-peep" at={[31, -64]} box={[-8, -8, 16, 16]} art={<g><ellipse cx="0" cy="1" rx="4.5" ry="5.5" fill={MOUTH} /><ellipse cx="0" cy="3" rx="2.5" ry="2" fill="#ff8f9a" /></g>} />
                <Layer name="mouth-shy" at={[31, -64]} box={[-10, -5, 20, 10]} art={<path d="M-7 1Q-3.5 -2 0 1Q3.5 4 7 1" fill="none" stroke={MOUTH} strokeWidth="3" strokeLinecap="round" />} />
                <Layer name="mouth-grit" at={[31, -64]} box={[-14, -6, 28, 12]} art={<path d="M-10 1Q-5 -3 0 1Q5 5 10 1" fill="none" stroke={MOUTH} strokeWidth="3.5" strokeLinecap="round" />} />
                <Layer name="mouth-grin" at={[31, -64]} box={[-16, -6, 32, 22]} art={<g><path d="M-12 -3Q0 16 13 -3Z" fill={MOUTH} stroke={MOUTH} strokeWidth="2" strokeLinejoin="round" /><ellipse cx="0" cy="6" rx="6" ry="3.2" fill="#ff8f9a" /></g>} />
                <Layer name="arm-near" at={[50, -50]} box={[-14, -8, 34, 46]} art={<Arm />} />
              </Layer>
              <Layer name="hat" at={at(DINO_RIG.hat)} box={[-90, -100, 180, 120]} art={<ShellTop id={id} rim />} />
            </Layer>
            <Layer name="foot-near" at={at(DINO_RIG.footNear)} box={[-24, -16, 56, 36]} art={<Foot />} />
          </Layer>
        </Layer>
      </Layer>
      {/* An exact copy of the half shell and the nest rim in front of the baby for the first 0.1 s of
          the pop, so it springs up out of the shell rather than appearing in front of it. */}
      <Layer name="lip-group">
        <Layer name="lip-rock" at={at(DINO_RIG.eggRock)}>
          <Layer name="lip-shell" box={BOTTOM_BOX} art={<g><BottomShell id={id} /><Rim dy={-1.5} /></g>} />
        </Layer>
        <Layer name="lip-nest" box={NEST_FRONT_BOX} art={<NestFrontArt id={id} />} />
      </Layer>
      {DINO_CHIPS.map(([x], index) => <Layer key={index} name={`chip-${index + 1}`} at={[x, DINO_RIG.chipY]} box={[-14, -14, 28, 28]} art={<g strokeLinejoin="round">
        <path d={CHIP_SHAPES[index % CHIP_SHAPES.length]} fill="#dccff7" stroke={INK} strokeWidth="2.4" />
        <path d={CHIP_SHEENS[index % CHIP_SHEENS.length]} fill="#fbf8ff" />
        <circle cx={CHIP_SPOTS[index % CHIP_SPOTS.length][0]} cy={CHIP_SPOTS[index % CHIP_SPOTS.length][1]} r="2.2" fill={index % 2 ? '#ff9f80' : '#ffcf5c'} />
      </g>} />)}
      {/* Stomp dust: the inner puff groups are a single cloud, the outer ones a cloud and a smaller one farther out. */}
      {DINO_DUST.map(({ layer, side, pos }, index) => <Layer key={layer} name={layer} at={pos} box={PUFF_BOX} art={<Puffs flip={side < 0} clouds={index % 2 ? [[-4, 0, 1], [19, 5, .6]] : [[0, 0, 1.2]]} />} />)}
      <Layer name="peep" at={at(DINO_RIG.peep)} box={[-50, -34, 100, 60]} art={<g>
        <path d="M-32 -22H30Q38 -22 38 -14V2Q38 10 30 10H-6L-22 22-16 10H-32Q-40 10 -40 2V-14Q-40 -22 -32 -22Z" fill="#fff" stroke="#5a4a52" strokeWidth="2.5" strokeLinejoin="round" />
        <text x="-1" y="-1" textAnchor="middle" fontSize="17" fontWeight="800" fill="#5a4a52" fontFamily="inherit">peep!</text>
      </g>} />
      <Layer name="boom" at={at(DINO_RIG.boom)} box={[-90, -70, 180, 140]} art={<g transform="rotate(-8)">
        <ellipse cx="0" cy="0" rx="96" ry="72" fill={`url(#${id}-glow)`} />
        <path d={BOOM_STAR} fill="#ffe07a" stroke="#e8894a" strokeWidth="4.5" strokeLinejoin="round" />
        <text x="0" y="12" textAnchor="middle" fontSize="34" fontWeight="900" fill="#e0523e" stroke="#fff6d8" strokeWidth="5" paintOrder="stroke" fontFamily="inherit" letterSpacing="1">BOOM!</text>
      </g>} />
    </Layer>
  </div>;
});

const COVER_SELECTOR = '.reveal-cover .dino-cover';

/**
 * Per card: where its egg sits (moved aside when the hero would hide it) and how far that egg
 * is from the focal point (0..1), so eggs crack as the ring passes them. Reads the positions
 * the shared measuring pass already wrote (no layout), then writes them all in one pass.
 */
function writeCoverPlacements(stage: HTMLElement | null, timing: boolean) {
  const width = Math.max(1, window.innerWidth); const height = Math.max(1, window.innerHeight);
  // Only the rings read --reach: setting it on the stage would restyle every rig layer.
  stage?.querySelectorAll<HTMLElement>('.dino-ring').forEach((ring) => ring.style.setProperty('--reach', `${dinoReach(width, height)}px`));
  const covers = Array.from(document.querySelectorAll<HTMLElement>(COVER_SELECTOR));
  const placements = covers.map((cover) => {
    const host = cover.parentElement as HTMLElement;
    const read = (name: string) => parseFloat(host.style.getPropertyValue(name));
    let left = read('--reveal-cover-left'); let top = read('--reveal-cover-top'); let w = read('--reveal-cover-width'); let h = read('--reveal-cover-height');
    if (![left, top, w, h].every(Number.isFinite)) ({ left, top, width: w, height: h } = host.getBoundingClientRect());
    const place = dinoEggPlacement({ left, top, width: w, height: h }, covers.length, width, height);
    return { ...place, distance: dinoDistance(place.egg.x, place.egg.y, width, height) };
  });
  const write = (cover: HTMLElement, name: string, value: string | null) => { if (value === null) cover.style.removeProperty(name); else cover.style.setProperty(name, value); };
  covers.forEach((cover, index) => {
    const { xFraction, nestY, eggHeight, distance } = placements[index];
    // Each egg's hatch time is committed on mount: rewriting it later would move running animations.
    if (timing) cover.style.setProperty('--dino-d', distance.toFixed(4));
    write(cover, '--dino-egg-x', xFraction === null ? null : `${(xFraction * 100).toFixed(2)}%`);
    write(cover, '--dino-nest-y', nestY === null ? null : `${nestY.toFixed(1)}px`);
    write(cover, '--dino-egg-h', eggHeight === null ? null : `${eggHeight.toFixed(1)}px`);
  });
}

function DinoStage() {
  const stage = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    installStageCss(); // no-op unless the sheet was removed since the module loaded
    writeCoverPlacements(stage.current, true);
    // On resize the cards move: re-run the shared measuring pass, then the placements (not the timing).
    const resize = () => { measureRevealCovers(); writeCoverPlacements(stage.current, false); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return <div ref={stage} className="dino-stage">
    <StageStatics />
  </div>;
}

/**
 * The compiled stage keyframes (about 90 KB) are parsed once when this module loads, not in the
 * reveal's first frame, so the show starts on time with its sound. The rules only match inside
 * .dino-stage; re-running the module (hot reload) replaces the sheet instead of adding another.
 */
const STAGE_STYLE_ID = 'dino-egg-stage-keyframes';
function installStageCss() {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(STAGE_STYLE_ID);
  if (existing) { if (existing.textContent !== DINO_STAGE_CSS) existing.textContent = DINO_STAGE_CSS; return; }
  const style = document.createElement('style');
  style.id = STAGE_STYLE_ID;
  style.textContent = DINO_STAGE_CSS;
  document.head.appendChild(style);
}
installStageCss();

const StageStatics = memo(function StageStatics() {
  return <>
    <i className="dino-spot" />
    <i className="dino-ring" />
    <i className="dino-ring dino-ring-echo" />
    <DinoRig />
  </>;
});

const COVER_TIMING = dinoCoverVars() as CSSProperties;

/** Every element runs at most one transform animation (drop-in, knock, jolt, sink: nested wrappers), so all stay on the compositor. */
function DinoCover() {
  return <div className="dino-cover" style={COVER_TIMING}>
    <div className="dino-pit">
      <div className="dino-sinker">
        <i className="dino-bed" />
        <div className="dino-egg"><div className="dino-rock"><div className="dino-jolt">
          <div className="dino-baby"><i className="dino-face" /><i className="dino-eyes" /><i className="dino-happy" /></div>
          <i className="dino-shell dino-shell-bottom" /><i className="dino-crack" />
        </div></div></div>
        <i className="dino-nest" />
      </div>
    </div>
    <div className="dino-egg dino-egg-top"><div className="dino-rock"><div className="dino-jolt">
      <i className="dino-shell dino-shell-top" />
      <i className="dino-chips" />
    </div></div></div>
  </div>;
}

export const dinoEggEffect: RevealEffect = {
  id: 'dino-egg', name: 'Dino egg hatch',
  description: 'Every card turns into a speckled egg. A baby dino hatches, tries a mighty roar, and its stomp cracks every egg open.',
  durationMs: DINO_DURATION_MS, sound: 'dino-egg', Stage: DinoStage, Cover: DinoCover,
};
