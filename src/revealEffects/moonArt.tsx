import { memo } from 'react';
import { mix, clamp01 } from './sceneMotion';
import { MOON_ARMS, MOON_CLOUD_CIRCLES, MOON_DAY_CLOUDS, PAD_Y, ROCKET_SX, ROCKET_SY, moonArmRetract } from './moonTimeline';
import { attr, useFrame, useNodes } from './moonFrame';

/*
 * Saturn V · Moon landing, launch and space art (storybook style): one ink for
 * every outline, flat cel shading lit from the right (the sunrise), and
 * gradients only for skies, glows and light. Everything here is static and
 * memoized; the scene moves it with transforms.
 */

export const INK = '#23264d';
export const WHITE = '#fffaf0';
export const BLACK = '#262a45';
const TOWER = '#e2552d';
const TOWER_LIT = '#ff8a52';
const TOWER_DARK = '#b13c22';

export const r1 = (n: number) => Math.round(n * 10) / 10;
export const r2 = (n: number) => Math.round(n * 100) / 100;
export const circlePath = (circles: readonly (readonly number[])[], grow = 0, dx = 0, dy = 0, k = 1) =>
  circles.map(([x, y, r]) => { const rr = r * k + grow; return `M${r1(x + dx - rr)} ${r1(y + dy)}a${r1(rr)} ${r1(rr)} 0 1 0 ${r1(rr * 2)} 0a${r1(rr)} ${r1(rr)} 0 1 0 ${r1(-rr * 2)} 0Z`; }).join('');
type Sec = readonly [top: number, bottom: number, wt: number, wb: number];
const secPoly = ([top, bottom, wt, wb]: Sec, f0: number, f1: number) => {
  const xt = (f: number) => r1(-wt + 2 * wt * f);
  const xb = (f: number) => r1(-wb + 2 * wb * f);
  return `M${xt(f0)} ${top}L${xt(f1)} ${top}L${xb(f1)} ${bottom}L${xb(f0)} ${bottom}Z`;
};
/** Cel shading for a cylinder or cone: cool shade on the left, gloss, warm sunrise rim. */
function Shade({ s }: { s: Sec }) {
  return <g>
    <path d={secPoly(s, 0, .36)} fill="#3a3f95" opacity=".15" />
    <path d={secPoly(s, 0, .13)} fill="#3a3f95" opacity=".16" />
    <path d={secPoly(s, .6, .7)} fill="#ffffff" opacity=".5" />
    <path d={secPoly(s, .88, 1)} fill="#ff9d5c" opacity=".24" />
  </g>;
}
export const SPARKLE = 'M0-10C1-3 3-1 10 0C3 1 1 3 0 10C-1 3-3 1-10 0C-3-1-1-3 0-10Z';
/** Five-point star, unit radius. */
const STAR5_POINTS = [[0, -1], [.2245, -.309], [.9511, -.309], [.3633, .118], [.5878, .809], [0, .382], [-.5878, .809], [-.3633, .118], [-.9511, -.309], [-.2245, -.309]] as const;
export const STAR5 = 'M0-1 .2245-.309.9511-.309.3633.118.5878.809 0 .382-.5878.809-.3633.118-.9511-.309-.2245-.309Z';
/** A star at (x, y) with radius r, as path data (many stars merge into one path). */
export const starD = (x: number, y: number, r: number) => `M${STAR5_POINTS.map(([px, py]) => `${r2(x + px * r)} ${r2(y + py * r)}`).join('L')}Z`;
/** An ellipse as path data (many ellipses merge into one path). */
export const ellipseD = (cx: number, cy: number, rx: number, ry: number) => `M${r1(cx - rx)} ${r1(cy)}a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(2 * rx)} 0a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(-2 * rx)} 0Z`;

// ---------------------------------------------------------------- stars
const STARS = (() => {
  let seed = 0x5354524b;
  const rand = () => { seed = (seed + 0x6d2b79f5) >>> 0; let v = Math.imul(seed ^ (seed >>> 15), 1 | seed); v ^= v + Math.imul(v ^ (v >>> 7), 61 | v); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; };
  // 90 across the world plus 24 beyond its sides for ultra-wide screens.
  return Array.from({ length: 114 }, (_, i) => {
    const x = i < 90 ? rand() * 1600 : (i % 2 ? -320 + rand() * 320 : 1600 + rand() * 320);
    return { x, y: 60 + rand() * 780, r: .9 + rand() ** 3 * 2.6, o: .45 + rand() * .55, warm: rand() < .3 };
  });
})();
/** Stars merged into one path per color and brightness (a dozen elements instead of 114). */
const STAR_PATHS = (() => {
  const groups = new Map<string, string>();
  for (const s of STARS) {
    const key = `${s.warm ? '#ffe7a6' : '#f4f1ff'}|${r1(s.o)}`;
    groups.set(key, (groups.get(key) ?? '') + ellipseD(s.x, s.y, s.r, s.r));
  }
  return [...groups].map(([key, d]) => { const [fill, opacity] = key.split('|'); return { fill, opacity, d }; });
})();
export const StarsArt = memo(function StarsArt({ viewBox }: { viewBox: string }) {
  return <svg viewBox={viewBox} preserveAspectRatio="none">
    {STAR_PATHS.map(({ fill, opacity, d }) => <path key={fill + opacity} d={d} fill={fill} opacity={opacity} />)}
  </svg>;
});
const TWINKLES = [[7, 14, 1.2, 0], [18, 30, .8, .5], [31, 12, 1, 1.1], [46, 22, .7, .3], [62, 11, 1.1, .9], [83, 18, .9, .2], [92, 36, .8, 1.3], [12, 52, .9, .7], [74, 44, .7, 1.6], [55, 60, .8, .4], [88, 64, 1, 1], [26, 74, .7, 1.4], [40, 40, .6, .8], [68, 80, .8, .15]] as const;
function Twinkle({ x, y, s, d, gold }: { x: number; y: number; s: number; d: number; gold: boolean }) {
  return <i className="moon-twinkle" style={{ left: `${x}%`, top: `${y}%`, width: `${26 * s}px`, height: `${26 * s}px`, margin: `${-13 * s}px 0 0 ${-13 * s}px`, animationDelay: `${d}s` }}>
    <svg viewBox="-12 -12 24 24"><path d={SPARKLE} fill={gold ? '#ffe07a' : '#fff6d8'} /></svg>
  </i>;
}
export const Twinkles = memo(function Twinkles() {
  return <>{TWINKLES.map(([x, y, s, d], i) => <Twinkle key={i} x={x} y={y} s={s} d={d} gold={i % 3 === 0} />)}</>;
});
export const DawnTwinkles = memo(function DawnTwinkles() {
  return <><Twinkle x={9} y={16} s={1} d={.3} gold={false} /><Twinkle x={87} y={14} s={.8} d={.9} gold={false} /><Twinkle x={30} y={11} s={.6} d={1.4} gold /></>;
});

// ---------------------------------------------------------------- puffs (defined once, instanced with <use>)
export const PUFF_SHAPES = [
  [[0, 0, 44], [-38, 12, 30], [38, 10, 32], [0, 20, 36], [-16, -30, 30], [18, -26, 28]],
  [[0, 0, 40], [-34, 8, 34], [34, 16, 28], [4, 22, 30], [-6, -34, 30], [26, -18, 24]],
  [[0, 0, 42], [-30, -12, 28], [32, -4, 34], [-14, 20, 30], [4, -36, 26], [34, -30, 18]],
] as const;
function PuffDefs({ prefix, edge, shade, base, light }: { prefix: string; edge: string; shade: string; base: string; light: string }) {
  return <>{PUFF_SHAPES.map((shape, i) => <g key={i} id={`${prefix}${i}`}>
    <path d={circlePath(shape, 5)} fill={edge} />
    <path d={circlePath(shape)} fill={shade} />
    <path d={circlePath(shape, 0, 4, -6, .84)} fill={base} />
    <path d={circlePath(shape.slice(4), 0, 7, -9, .36)} fill={light} />
  </g>)}</>;
}

/** Gradients and puff shapes for the per-frame world SVG. */
export const MoonDefs = memo(function MoonDefs() {
  return <defs>
    <radialGradient id="mn-glow"><stop stopColor="#fff2b0" stopOpacity=".75" /><stop offset=".5" stopColor="#ffc15a" stopOpacity=".35" /><stop offset="1" stopColor="#ff9a3a" stopOpacity="0" /></radialGradient>
    <linearGradient id="mn-underglow" x2="0" y2="1"><stop stopColor="#ffb35c" stopOpacity="0" /><stop offset=".6" stopColor="#ffb35c" stopOpacity=".28" /><stop offset="1" stopColor="#ffd98a" stopOpacity=".6" /></linearGradient>
    <radialGradient id="mn-lmglow"><stop stopColor="#fff2c8" stopOpacity=".75" /><stop offset="1" stopColor="#ffd08a" stopOpacity="0" /></radialGradient>
    <radialGradient id="mn-sunflare"><stop stopColor="#ffffff" stopOpacity=".9" /><stop offset=".25" stopColor="#fff6d8" stopOpacity=".45" /><stop offset=".6" stopColor="#c9d8ff" stopOpacity=".14" /><stop offset="1" stopColor="#c9d8ff" stopOpacity="0" /></radialGradient>
    <radialGradient id="mn-flash"><stop stopColor="#ffffff" stopOpacity=".95" /><stop offset=".4" stopColor="#fff3c4" stopOpacity=".6" /><stop offset="1" stopColor="#ffd98a" stopOpacity="0" /></radialGradient>
    <radialGradient id="mn-hotsmoke"><stop stopColor="#ff9d3a" stopOpacity=".55" /><stop offset=".6" stopColor="#ffb35c" stopOpacity=".25" /><stop offset="1" stopColor="#ffb35c" stopOpacity="0" /></radialGradient>
    <PuffDefs prefix="mn-smoke" edge="#8f82ad" shade="#d5c6dc" base="#fbf6ef" light="#ffffff" />
    <PuffDefs prefix="mn-warm" edge="#b0708a" shade="#ffc09a" base="#fff0dc" light="#ffffff" />
    <PuffDefs prefix="mn-dust" edge="#8a806f" shade="#b9ae9b" base="#e6decf" light="#f6f1e6" />
  </defs>;
});
/** Globe gradients (Earth and Moon), used by several layers. */
export const GlobeDefs = memo(function GlobeDefs() {
  return <defs>
    <radialGradient id="mn-atmo"><stop offset=".8" stopColor="#8fdcff" stopOpacity=".7" /><stop offset=".87" stopColor="#8fdcff" stopOpacity=".3" /><stop offset="1" stopColor="#8fdcff" stopOpacity="0" /></radialGradient>
    <linearGradient id="mn-earth-night" x1="0" x2="1"><stop stopColor="#0b1a5a" stopOpacity=".72" /><stop offset=".42" stopColor="#0b1a5a" stopOpacity=".05" /><stop offset="1" stopColor="#0b1a5a" stopOpacity="0" /></linearGradient>
    <linearGradient id="mn-moon-night" x1="0" x2="1"><stop stopColor="#2b2350" stopOpacity=".55" /><stop offset=".4" stopColor="#2b2350" stopOpacity=".05" /><stop offset="1" stopColor="#2b2350" stopOpacity="0" /></linearGradient>
    <clipPath id="mn-earth-clip"><circle r="100" /></clipPath>
    <clipPath id="mn-globe-clip"><circle r="100" /></clipPath>
  </defs>;
});

// ---------------------------------------------------------------- Saturn V (local: engine exit plane at 0, up is -y)
const S1: Sec = [-222, -22, 40, 40];
const S2: Sec = [-360, -222, 40, 40];
const S3_TAPER: Sec = [-376, -360, 28, 40];
const S3_BODY: Sec = [-458, -376, 28, 28];
const S3_SLA: Sec = [-506, -464, 20, 28];
const S3_SM: Sec = [-530, -506, 20, 20];
const S3_CM: Sec = [-556, -530, 7, 20];

function FlagDecal({ x, y, w }: { x: number; y: number; w: number }) {
  const h = w * 10 / 19;
  const stripe = h / 13;
  return <g>
    <rect x={x} y={y} width={w} height={h} fill={WHITE} />
    {Array.from({ length: 7 }, (_, i) => <rect key={i} x={x} y={r1(y + i * 2 * stripe)} width={w} height={r1(stripe)} fill="#d6333f" />)}
    <rect x={x} y={y} width={r1(w * .4)} height={r1(stripe * 7)} fill="#27407e" />
    {[0, 1, 2].map((row) => [0, 1, 2].map((col) => <circle key={`${row}${col}`} cx={r1(x + w * .4 * (col + .5) / 3)} cy={r1(y + stripe * 7 * (row + .5) / 3)} r=".7" fill="#fff" />))}
    <rect x={x} y={y} width={w} height={h} fill="none" stroke={INK} strokeWidth="1.4" />
  </g>;
}
function Bell({ x, top, hw0, hw1, h }: { x: number; top: number; hw0: number; hw1: number; h: number }) {
  return <g>
    <path d={`M${x - hw0} ${top}L${x + hw0} ${top}L${x + hw1} ${top + h}Q${x} ${top + h + 4} ${x - hw1} ${top + h}Z`} fill="#474c70" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    <path d={`M${r1(x + hw0 * .2)} ${top + 2}L${r1(x + hw0 * .7)} ${top + 2}L${r1(x + hw1 * .75)} ${top + h - 1}L${r1(x + hw1 * .25)} ${top + h}Z`} fill="#9097c2" opacity=".75" />
  </g>;
}
/** The slimming (8.3:1) is baked in with one static scale around each stage's art. */
const SLIM = `scale(${ROCKET_SX} ${ROCKET_SY})`;
export const StageOneArt = memo(function StageOneArt() {
  return <g strokeLinejoin="round" strokeLinecap="round" transform={SLIM}>
    <Bell x={-26} top={-18} hw0={8} hw1={14} h={18} />
    <Bell x={26} top={-18} hw0={8} hw1={14} h={18} />
    <Bell x={0} top={-18} hw0={8} hw1={14} h={18} />
    <path d="M-44-24H44V-16H-44Z" fill="#3a3e5e" stroke={INK} strokeWidth="3" />
    {[-1, 1].map((s) => <path key={s} d={`M${s * 45}-74L${s * 72}-32L${s * 72}-8L${s * 47}-16Z`} fill={s < 0 ? '#dfe1ee' : WHITE} stroke={INK} strokeWidth="3.5" />)}
    <path d="M-40-222H40V-22H-40Z" fill={WHITE} />
    <path d="M-40-74h20v52h-20ZM0-74h20v52H0Z" fill={BLACK} />
    <path d="M-20-222H0v22h-20ZM20-222h20v22H20Z" fill={BLACK} />
    <path d="M-40-128H40M-40-124H40" stroke={INK} strokeWidth="1.6" opacity=".28" />
    <FlagDecal x={-15} y={-194} w={30} />
    <g fill={BLACK} fontFamily="'Arial Black', 'Segoe UI Black', system-ui, sans-serif" fontWeight="900" fontSize="25" textAnchor="middle">
      <text x="0" y="-143">U</text><text x="0" y="-114">S</text><text x="0" y="-85">A</text>
    </g>
    <Shade s={S1} />
    {[-1, 1].map((s) => <path key={s} d={`M${s * 40}-90Q${s * 53}-64 ${s * 52}-22H${s * 40}Z`} fill={s < 0 ? '#d6d9ea' : WHITE} stroke={INK} strokeWidth="3.5" />)}
    <path d="M37-218V-26" stroke="#ffd9a0" strokeWidth="2.6" opacity=".9" />
    <path d="M-40-90V-222H40V-90M-40-22H40" fill="none" stroke={INK} strokeWidth="3.5" />
  </g>;
});
export const StageTwoArt = memo(function StageTwoArt() {
  return <g strokeLinejoin="round" strokeLinecap="round" transform={SLIM}>
    <Bell x={-20} top={-224} hw0={5} hw1={9} h={16} />
    <Bell x={20} top={-224} hw0={5} hw1={9} h={16} />
    <Bell x={0} top={-224} hw0={5} hw1={9} h={16} />
    <path d="M-40-360H40V-222H-40Z" fill={WHITE} />
    <path d="M-40-244H40" stroke={INK} strokeWidth="2" opacity=".35" />
    <path d="M-40-352H40V-334H-40Z" fill={BLACK} />
    <path d="M-26-352h8v18h-8ZM-4-352h8v18h-8ZM18-352h8v18h-8Z" fill={WHITE} />
    <path d="M-40-300H40" stroke={INK} strokeWidth="1.4" opacity=".22" />
    <Shade s={S2} />
    <path d="M37-356V-226" stroke="#ffd9a0" strokeWidth="2.6" opacity=".9" />
    <path d="M-40-360H40V-222H-40Z" fill="none" stroke={INK} strokeWidth="3.5" />
  </g>;
});
export const StageThreeArt = memo(function StageThreeArt() {
  return <g strokeLinejoin="round" strokeLinecap="round" transform={SLIM}>
    <Bell x={0} top={-362} hw0={6} hw1={11} h={16} />
    <path d={secPoly(S3_TAPER, 0, 1)} fill={WHITE} /><Shade s={S3_TAPER} />
    <path d="M-28-458H28V-376H-28Z" fill={WHITE} />
    <path d="M-28-394H28V-376H-28Z" fill={BLACK} />
    <path d="M-28-430H28" stroke={INK} strokeWidth="1.4" opacity=".22" />
    <Shade s={S3_BODY} />
    <path d="M-28-464H28V-458H-28Z" fill="#d9deea" />
    <path d={secPoly(S3_SLA, 0, 1)} fill={WHITE} />
    <path d="M-10-506-13-464M10-506 13-464" stroke={INK} strokeWidth="1.2" opacity=".25" />
    <Shade s={S3_SLA} />
    <path d="M-20-530H20V-506H-20Z" fill="#eef1f8" />
    <path d="M-8-530V-506M6-530V-506" stroke="#b9c1d6" strokeWidth="2" />
    <Shade s={S3_SM} />
    <path d={secPoly(S3_CM, 0, 1)} fill={WHITE} /><Shade s={S3_CM} />
    {[-1, 1].map((s) => <path key={s} d={`M${s * 28} -395h${s * 6}q${s * 2} 0 ${s * 2} 3v8q0 3 ${-s * 2} 3h${-s * 6}Z`} fill={BLACK} stroke={INK} strokeWidth="2" />)}
    <path d="M25-456V-380M18-528V-508" stroke="#ffd9a0" strokeWidth="2.4" opacity=".9" />
    <path d="M-40-360-28-376V-464L-20-506V-530L-7-556H7L20-530V-506L28-464V-376L40-360" fill="none" stroke={INK} strokeWidth="3.5" />
    <path d="M-28-464H28M-28-458H28M-20-506H20M-20-530H20" stroke={INK} strokeWidth="2" fill="none" />
  </g>;
});
export const EscapeTowerArt = memo(function EscapeTowerArt() {
  return <g strokeLinejoin="round" strokeLinecap="round" transform={SLIM}>
    <path d="M-9-556-4-586H4L9-556" fill="none" stroke={INK} strokeWidth="5" />
    <path d="M-9-556-4-586H4L9-556M-8-560 3-584M8-560-3-584M-6-571H6" fill="none" stroke="#ff7a4a" strokeWidth="2.2" />
    <path d="M-7-590h14l-2 4H-5Z" fill={BLACK} stroke={INK} strokeWidth="2" />
    <path d="M-6-610H6V-590H-6Z" fill={WHITE} stroke={INK} strokeWidth="3" />
    <path d="M-6-600H6" stroke="#d6333f" strokeWidth="3" />
    <path d="M-6-610 0-624 6-610Z" fill={WHITE} stroke={INK} strokeWidth="3" />
    <path d="M-6-610H-2V-590H-6Z" fill="#3a3f95" opacity=".15" />
  </g>;
});
export function plumePath(w: number, L: number) {
  return `M${-w} 0C${r1(-w * 1.35)} ${r1(L * .2)} ${r1(-w * 1.12)} ${r1(L * .52)} ${r1(-w * .46)} ${r1(L * .78)}C${r1(-w * .26)} ${r1(L * .88)} ${r1(-w * .08)} ${r1(L * .96)} 0 ${L}C${r1(w * .08)} ${r1(L * .96)} ${r1(w * .26)} ${r1(L * .88)} ${r1(w * .46)} ${r1(L * .78)}C${r1(w * 1.12)} ${r1(L * .52)} ${r1(w * 1.35)} ${r1(L * .2)} ${w} 0Z`;
}
/** Static flame drawing, 300 units long and 40 wide at the nozzles; only its scale changes. */
export const PlumeArt = memo(function PlumeArt() {
  return <g>
    <ellipse cx="0" cy="120" rx="120" ry="210" fill="url(#mn-glow)" />
    <path d={plumePath(40, 300)} fill="#ff6a2a" stroke="#e8461c" strokeWidth="3" />
    <path d={plumePath(31, 238)} fill="#ffa630" />
    <path d={plumePath(23, 172)} fill="#ffe06a" />
    <path d={plumePath(14, 92)} fill="#fffbe2" />
    <path d="M-22 150c-10 30-4 60 6 78 2-26 0-54-6-78ZM22 150c10 30 4 60-6 78-2-26 0-54 6-78Z" fill="#ffc24a" opacity=".85" />
  </g>;
});
export const SmallPlumeArt = memo(function SmallPlumeArt() {
  return <g>
    <ellipse cx="0" cy="70" rx="70" ry="120" fill="url(#mn-glow)" />
    <path d={plumePath(26, 170)} fill="#ff8a3a" stroke="#ee5a22" strokeWidth="2.5" />
    <path d={plumePath(19, 130)} fill="#ffc04a" />
    <path d={plumePath(12, 84)} fill="#fff2a8" />
    <path d={plumePath(7, 44)} fill="#ffffff" />
  </g>;
});

// ---------------------------------------------------------------- the pad (static layer)
function Palm({ x, y, s, flip = 1 }: { x: number; y: number; s: number; flip?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${s * flip} ${s})`}>
    <path d="M0 0Q8-46-6-92" fill="none" stroke={INK} strokeWidth="12" strokeLinecap="round" />
    <path d="M0 0Q8-46-6-92" fill="none" stroke="#a8743f" strokeWidth="7" strokeLinecap="round" />
    <path d="M1-20h6M2-40h6M1-60h6" stroke="#7b4f2a" strokeWidth="2" />
    <g fill="#2f8a4f" stroke={INK} strokeWidth="3" strokeLinejoin="round">
      <path d="M-6-92Q-40-110-66-84Q-36-96-8-88Z" /><path d="M-6-92Q-30-128-4-138Q-18-112-2-94Z" />
      <path d="M-6-92Q24-122 54-104Q20-104-2-90Z" /><path d="M-6-92Q30-92 46-62Q18-84-4-88Z" />
      <path d="M-6-92Q-46-86-52-52Q-30-80-8-88Z" />
    </g>
    <circle cx="-4" cy="-90" r="5" fill="#7b4f2a" stroke={INK} strokeWidth="2" />
  </g>;
}
const CLOUD = MOON_CLOUD_CIRCLES;
/** Dawn clouds are underlit by the low sun: gold underside, pink body, violet crown. */
function Cloud({ x, y, w, tone = 'dawn' }: { x: number; y: number; w: number; tone?: 'dawn' | 'day' }) {
  if (tone === 'dawn') return <g transform={`translate(${x} ${y}) scale(${r2(w / 200)})`}>
    <path d={circlePath(CLOUD, 3)} fill="#ffd79a" />
    <path d={circlePath(CLOUD, 0, -5, -6, .9)} fill="#f4a9c0" />
    <path d={circlePath(CLOUD.slice(1, 4), 0, -10, -14, .66)} fill="#a98fd6" />
  </g>;
  return <g transform={`translate(${x} ${y}) scale(${r2(w / 200)})`}>
    <path d={circlePath(CLOUD)} fill="#b9cdf2" />
    <path d={circlePath(CLOUD, 0, 4, -9, .84)} fill="#f6f9ff" />
    <path d={circlePath(CLOUD.slice(1, 3), 0, 10, -17, .4)} fill="#ffffff" opacity=".85" />
  </g>;
}
const PadArt = memo(function PadArt() {
  return <g>
    <defs>
      <radialGradient id="mn-sun"><stop stopColor="#fff8d2" /><stop offset=".55" stopColor="#ffe08a" stopOpacity=".55" /><stop offset="1" stopColor="#ffb86a" stopOpacity="0" /></radialGradient>
      <linearGradient id="mn-beam" x1="0" y1="1" x2="0" y2="0"><stop stopColor="#fff6d8" stopOpacity=".55" /><stop offset=".55" stopColor="#fff6d8" stopOpacity=".16" /><stop offset="1" stopColor="#fff6d8" stopOpacity="0" /></linearGradient>
    </defs>
    {/* high clouds that streak past during the whip */}
    {MOON_DAY_CLOUDS.map(([x, y, w]) => <Cloud key={x} x={x} y={y} w={w} tone="day" />)}
    {/* sunrise over the Atlantic */}
    <circle cx="1300" cy="640" r="250" fill="url(#mn-sun)" />
    <circle cx="1300" cy="640" r="74" fill="#fff1b8" stroke="#ffd36a" strokeWidth="6" />
    <Cloud x={300} y={250} w={250} /><Cloud x={1160} y={178} w={190} /><Cloud x={1480} y={430} w={170} /><Cloud x={120} y={520} w={200} />
    <Cloud x={-160} y={330} w={180} /><Cloud x={1790} y={300} w={200} />
    <g fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1130 520q8-9 15 0q7-9 15 0" /><path d="M1172 494q6-7 12 0q6-7 12 0" /><path d="M1204 536q5-6 10 0q5-6 10 0" /></g>
    <path d="M-400 640H2000V700H-400Z" fill="#3b8ed0" />
    <path d="M-400 640H2000" stroke="#8fd0ff" strokeWidth="3" />
    <g stroke="#bfe8ff" strokeWidth="3" strokeLinecap="round" opacity=".8"><path d="M40 656h50M210 668h36M420 652h60M880 664h44M1030 654h30M1520 668h50M-120 664h60M1720 658h54M-300 668h40" /></g>
    <g stroke="#fff0b0" strokeWidth="5" strokeLinecap="round"><path d="M1262 652h76M1276 664h48M1286 676h28M1250 688h96" /></g>
    <path d="M-400 690Q200 676 800 684T2000 682V710H-400Z" fill="#f4d596" />
    <path d="M-400 700Q300 690 800 698T2000 696V1100H-400Z" fill="#4f9c5f" />
    <path d="M-400 760Q400 742 800 752T2000 748V1100H-400Z" fill="#47925a" />
    <path d="M-400 700Q300 690 800 698T2000 696" fill="none" stroke="#2f6e47" strokeWidth="3" />
    <g fill="#2f7a4a" stroke={INK} strokeWidth="2.5">
      {[[-220, 702, 22], [60, 700, 26], [110, 704, 18], [340, 700, 22], [388, 703, 14], [1110, 702, 20], [1170, 704, 26], [1420, 700, 18], [1560, 704, 24], [1800, 702, 22]].map(([x, y, r]) => <path key={x} d={`M${x - r} ${y + 4}Q${x - r} ${y - r * .9} ${x} ${y - r * .9}Q${x + r} ${y - r * .9} ${x + r} ${y + 4}Z`} />)}
    </g>
    <g fill="#5fb36b">{[[60, 700, 26], [340, 700, 22], [1170, 704, 26], [1560, 704, 24]].map(([x, y, r]) => <ellipse key={x} cx={x + r * .25} cy={y - r * .55} rx={r * .45} ry={r * .2} />)}</g>
    <Palm x={150} y={712} s={1.1} /><Palm x={240} y={716} s={.82} flip={-1} /><Palm x={1400} y={716} s={1} flip={-1} /><Palm x={1486} y={712} s={1.2} />
    <Palm x={-120} y={714} s={.95} flip={-1} /><Palm x={1720} y={714} s={1.05} />
    {/* hardstand: a low berm that ends above the footer band; below it is one grass fill */}
    <path d="M400 812 470 786H1010L1080 812Z" fill="#e6d6b6" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    <path d="M400 812 470 786H520L470 812Z" fill="#c8b48f" />
    <path d="M1080 812 1010 786H980L1030 812Z" fill="#f4e6c8" />
    <path d="M-400 812H2000V1100H-400Z" fill="#47925a" />
    <path d="M-400 812H2000" stroke="#2f6e47" strokeWidth="3" />
    <g fill="#5d647c" stroke={INK} strokeWidth="3">{[520, 610, 870, 960].map((x) => <path key={x} d={`M${x} 788h24v22h-24Z`} />)}</g>
    <path d="M470 744H1010V790H470Z" fill="#8e97ad" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
    <path d="M472 746H1008V755H472Z" fill="#c1c8da" />
    <path d="M472 776H1008V788H472Z" fill="#6b7389" />
    <path d="M472 746H500V788H472Z" fill="#3a3f95" opacity=".16" />
    <path d="M994 746H1008V788H994Z" fill="#ff9d5c" opacity=".24" />
    <g fill="#d6dbe8" opacity=".7">{[500, 560, 800, 900, 960].map((x) => <rect key={x} x={x} y="762" width="22" height="8" rx="2" />)}</g>
    <g fill="#5d647c" stroke={INK} strokeWidth="2.5">{[676, 790].map((x) => <path key={x} d={`M${x} 744v-12h14v12Z`} />)}</g>
    {/* long dawn shadows of the tower and rocket, falling left over the berm */}
    <path d="M560 790H650L250 812H60Z" fill={INK} opacity=".18" />
    <path d="M704 790H776L520 812H400Z" fill={INK} opacity=".14" />
    {/* xenon floodlights raking the rocket before dawn; CSS fades them as the engines light */}
    <g className="moon-beams">
      <path d="M484 744H500L724 168 648 150Z" fill="url(#mn-beam)" />
      <path d="M992 744H1008L852 196 772 168Z" fill="url(#mn-beam)" />
      <path d="M1170 812H1184L980 150 900 126Z" fill="url(#mn-beam)" opacity=".6" />
    </g>
    {/* launch umbilical tower, standing on the launcher deck */}
    <g strokeLinejoin="round" transform="translate(0 24)">
      <path d="M560 720V150H650V720Z" fill="none" stroke={INK} strokeWidth="4" />
      <g stroke={TOWER_DARK} strokeWidth="4" strokeLinecap="round">
        <path d={Array.from({ length: 15 }, (_, i) => { const y = 150 + i * 38; return `M572 ${y}L638 ${y + 38}M638 ${y}L572 ${y + 38}`; }).join('')} />
      </g>
      <path d={Array.from({ length: 16 }, (_, i) => { const y = 150 + i * 38; return `M558 ${y - 3}H652V${y + 3}H558Z`; }).join('')} fill={TOWER} stroke={INK} strokeWidth="2" />
      <path d="M558 150H572V720H558Z" fill={TOWER_DARK} stroke={INK} strokeWidth="3" />
      <path d="M638 150H652V720H638Z" fill={TOWER} stroke={INK} strokeWidth="3" />
      <path d="M646 152H650V718H646Z" fill={TOWER_LIT} />
      <path d="M596 150V124H614V150Z" fill={TOWER} stroke={INK} strokeWidth="3" />
      <path d="M534 112H708V126H534Z" fill={TOWER} stroke={INK} strokeWidth="3" />
      <path d="M540 112 560 126M560 112 580 126M580 112 600 126M620 112 640 126M640 112 660 126M660 112 680 126M680 112 700 126" stroke={TOWER_DARK} strokeWidth="2" />
      <path d="M700 126V166" stroke={INK} strokeWidth="2" /><path d="M694 166h12l-3 8h-6Z" fill={BLACK} stroke={INK} strokeWidth="2" />
      <path d="M605 112V82" stroke={INK} strokeWidth="3" />
    </g>
  </g>;
});
/** Swing arms retract toward the tower as the engines light (written per frame). */
function TowerArms() {
  const { nodes: arms, bind: bindarms } = useNodes();
  useFrame((T) => {
    const retract = moonArmRetract(T);
    MOON_ARMS.forEach((_, i) => attr(arms[i], 'transform', `translate(650 0) scale(${r2(mix(1, .22, clamp01(retract * 1.25 - i * .05)))} 1)`));
  });
  return <g strokeLinejoin="round">
    {MOON_ARMS.map(([ly, reach, crew], i) => {
      const y = PAD_Y + ly * .98;
      return <g key={i} ref={bindarms(i)} transform="translate(650 0)">
        <path d={`M0 ${y - 6}H${reach}V${y + 6}H0Z`} fill={TOWER} stroke={INK} strokeWidth="2.5" />
        <path d={`M4 ${y - 6}L${reach * .33} ${y + 6}M${reach * .33} ${y - 6}L${reach * .66} ${y + 6}M${reach * .66} ${y - 6}L${reach - 4} ${y + 6}`} stroke={TOWER_DARK} strokeWidth="2" />
        {crew ? <g><path d={`M${reach - 28} ${y - 24}H${reach}V${y + 6}H${reach - 28}Z`} fill="#f4f1ea" stroke={INK} strokeWidth="2.5" /><path d={`M${reach - 22} ${y - 18}h10v8h-10Z`} fill="#35518f" stroke={INK} strokeWidth="1.6" /><path d={`M${reach - 28} ${y - 24}H${reach}`} stroke="#d6333f" strokeWidth="3" /></g> : null}
      </g>;
    })}
  </g>;
}
const PAD_ART = <PadArt />;
const TOWER_ARMS = <TowerArms />;
/** The whole launch pad: one SVG on its own compositor layer, translated as the ground falls away. */
export const PadLayerArt = memo(function PadLayerArt({ viewBox }: { viewBox: string }) {
  return <svg viewBox={viewBox} preserveAspectRatio="none">{PAD_ART}{TOWER_ARMS}</svg>;
});
const FRONDS = ['M-6-92Q-40-110-66-84Q-36-96-8-88Z', 'M-6-92Q-30-128-4-138Q-18-112-2-94Z', 'M-6-92Q24-122 54-104Q20-104-2-90Z', 'M-6-92Q30-92 46-62Q18-84-4-88Z', 'M-6-92Q-46-86-52-52Q-30-80-8-88Z'];
/** Foreground palm silhouettes in front of the smoke; warm rim on the sunlit right edges. */
export const ForegroundPalmsArt = memo(function ForegroundPalmsArt({ viewBox }: { viewBox: string }) {
  return <svg viewBox={viewBox} preserveAspectRatio="none">{([[150, 940, 2.5], [1460, 950, 2.7]] as const).map(([x, y, sc]) => <g key={x} transform={`translate(${x} ${y}) scale(${sc})`}>
    <path d="M0 0Q8-46-6-92" fill="none" stroke={INK} strokeWidth="6.5" strokeLinecap="round" />
    <path d="M0 0Q8-46-6-92" fill="none" stroke="#3b3674" strokeWidth="4" strokeLinecap="round" />
    <path d="M3-6Q9-46-3-88" fill="none" stroke="#ff9d5c" strokeWidth="1" opacity=".55" />
    <g fill="#2f2c68" stroke={INK} strokeWidth="1.4" strokeLinejoin="round">{FRONDS.map((d) => <path key={d} d={d} />)}</g>
    <path d="M-6-92Q24-122 54-104M-6-92Q30-92 46-62" fill="none" stroke="#ff9d5c" strokeWidth=".9" opacity=".6" />
  </g>)}</svg>;
});

// ---------------------------------------------------------------- Earth, Sun and Moon globes (unit radius 100)
// Stylized Americas (Florida pointing at the launch), Greenland and the bulge of Africa at the lit limb.
const CONTINENTS = 'M-96-52C-80-72-50-84-20-80C-4-78 8-70 2-60C-6-50-16-46-14-36C-12-26-22-20-24-12C-22-4-24 4-27 10C-31 6-32 0-36-4C-42-8-50-6-52 2C-50 10-44 16-40 22C-36 26-32 28-30 32L-34 35C-40 31-48 25-56 17C-66 7-74-5-82-16C-90-28-98-38-96-52ZM6-92C16-98 34-96 38-88C40-80 30-72 20-70C10-70 2-80 6-92ZM-30 35C-20 29-6 31 6 37C20 43 34 49 34 59C32 69 22 73 16 81C10 89 4 97-2 100C-8 93-12 81-16 71C-20 61-28 53-32 45C-34 41-34 37-30 35ZM64-24C74-30 90-28 98-18C104-6 102 8 96 20C92 32 84 42 78 50C74 40 72 30 66 22C60 14 56 4 58-6C60-14 60-20 64-24Z';
const NS = { vectorEffect: 'non-scaling-stroke' } as const;
/** Earth; the continents and clouds drift by CSS animation (seekable in the lab). */
export const EarthArt = memo(function EarthArt() {
  return <g>
    <circle r="124" fill="url(#mn-atmo)" />
    <circle r="100" fill="#2f86e0" />
    <g clipPath="url(#mn-earth-clip)">
      <g className="moon-spin">
        {[-400, 0, 400].map((x) => <g key={x} transform={`translate(${x} 0)`}>
          <path d={CONTINENTS} fill="#7cc85a" stroke="#3f8a45" strokeWidth="2.5" strokeLinejoin="round" {...NS} />
          <path d="M-70-30C-60-36-48-32-46-24C-50-18-62-18-70-30ZM72-8C80-12 90-8 92 0C86 6 76 4 72-8Z" fill="#e6c46a" />
        </g>)}
      </g>
      <g className="moon-spin is-clouds" fill="none" stroke="#ffffff" strokeLinecap="round" opacity=".95">
        {[-400, 0, 400].map((x) => <path key={x} transform={`translate(${x} 0)`} d="M-170-40Q-140-54-110-44M-40-78Q-10-90 24-80M-60 50Q-30 40 0 52M60 80Q90 70 120 82M110-10Q140-22 170-12M-150 20Q-130 12-110 20M-10 14Q14 4 36 16" strokeWidth="5.5" />)}
      </g>
      <circle r="100" fill="url(#mn-earth-night)" />
      <path d="M60-80A100 100 0 0 1 60 80A92 92 0 0 0 60-80Z" fill="#bfefff" opacity=".35" />
      <ellipse cx="46" cy="-34" rx="20" ry="12" fill="#ffffff" opacity=".22" transform="rotate(-30 46 -34)" />
    </g>
    <circle r="104" fill="none" stroke="#8fdcff" strokeWidth="5" opacity=".55" {...NS} />
    <circle r="100" fill="none" stroke={INK} strokeWidth="3.5" {...NS} />
  </g>;
});
/**
 * The Sun in space, low at the right (key light from the right), in two parts:
 * its light (corona, long rays and lens streak), which may fade in, and its
 * solid disc, which blooms in at full strength (so it never reads as a grey ghost).
 */
export const SunLightArt = memo(function SunLightArt() {
  return <g>
    <circle r="200" fill="url(#mn-sunflare)" />
    <ellipse rx="460" ry="3.5" fill="#fff6d8" opacity=".55" />
    <path d="M0-160C6-22 22-6 160 0C22 6 6 22 0 160C-6 22-22 6-160 0C-22-6-6-22 0-160Z" fill="#fffbe8" opacity=".75" />
    <path d="M0-80C4-12 12-4 80 0C12 4 4 12 0 80C-4 12-12 4-80 0C-12-4-4-12 0-80Z" fill="#ffffff" opacity=".55" transform="rotate(45)" />
  </g>;
});
export const SunCoreArt = memo(function SunCoreArt() {
  return <circle r="36" fill="#fffbe8" stroke="#ffe7a6" strokeWidth="5" />;
});
/** Globe craters [x, y, r] (unit radius 100). */
export const MOON_GLOBE_CRATERS = [[-40, -30, 16], [30, -54, 10], [46, 10, 20], [-10, 40, 12], [-62, 18, 9], [12, -10, 7], [60, 52, 8], [-30, 70, 7], [-20, -84, 9], [22, -88, 6], [58, -72, 8], [-58, -66, 7], [4, -70, 5], [-78, -40, 6], [82, -40, 7], [40, -80, 4]] as const;
/** Maria and craters of the Moon globe (the dive pushes these out past the rim). */
export const MoonGlobeDecals = memo(function MoonGlobeDecals() {
  return <g>
    <path d="M-60-40C-40-60 0-60 10-40C20-20-10-10-30-12C-50-14-70-24-60-40ZM20 20C40 10 70 20 70 40C68 58 40 60 28 50C18 42 10 30 20 20ZM-10-92C8-98 34-92 36-82C30-74 6-76-4-80Z" fill="#c4baa9" />
    {/* 16 craters as four merged layers: bowl, floor, sunlit rim, outline */}
    <path d={MOON_GLOBE_CRATERS.map(([x, y, r]) => ellipseD(x, y, r, r)).join('')} fill="#b1a796" />
    <path d={MOON_GLOBE_CRATERS.map(([x, y, r]) => ellipseD(x - r * .2, y + r * .15, r * .8, r * .8)).join('')} fill="#cfc6b6" />
    <path d={MOON_GLOBE_CRATERS.map(([x, y, r]) => `M${x - r} ${y}A${r} ${r} 0 0 1 ${x + r} ${y}`).join('')} fill="none" stroke="#f3ede0" strokeWidth="2.5" {...NS} />
    <path d={MOON_GLOBE_CRATERS.map(([x, y, r]) => ellipseD(x, y, r, r)).join('')} fill="none" stroke="#8d8373" strokeWidth="1.5" opacity=".6" {...NS} />
  </g>;
});
/** The globe's rim line. */
export const MoonGlobeRim = memo(function MoonGlobeRim() {
  return <circle r="100" fill="none" stroke={INK} strokeWidth="3.5" {...NS} />;
});
export const MoonGlobeArt = memo(function MoonGlobeArt() {
  return <g>
    <circle r="100" fill="#ddd5c6" />
    <MoonGlobeDecals />
    <circle r="100" fill="url(#mn-moon-night)" />
    <MoonGlobeRim />
  </g>;
});

// ---------------------------------------------------------------- overlays (CSS keyframes; props change only on resize)
const DIGITS = ['M20 30Q48 4 76 22Q94 42 72 62Q60 70 44 70M44 70Q66 70 78 84Q94 108 70 124Q46 140 16 116', 'M22 42Q28 12 58 12Q86 14 84 42Q82 62 60 82L20 126H86', 'M30 34 58 12V128M30 128H84'];
/** The countdown shows exactly these numerals, in this order. */
export const MOON_COUNTDOWN_DIGITS = [3, 2, 1] as const;
export const Countdown = memo(function Countdown() {
  return <>{DIGITS.map((d, i) => <div key={i} className={`moon-count is-${MOON_COUNTDOWN_DIGITS[i]}`} data-digit={MOON_COUNTDOWN_DIGITS[i]}>
    <svg viewBox="-40 -34 180 210">
      <circle cx="52" cy="70" r="92" fill="#191d52" opacity=".55" />
      <circle cx="52" cy="70" r="92" fill="none" stroke="#ffffff" strokeOpacity=".22" strokeWidth="11" />
      <circle className="moon-dial" cx="52" cy="70" r="92" fill="none" stroke="#ffcf5a" strokeWidth="11" strokeLinecap="round" transform="rotate(-90 52 70)" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} stroke="#10143a" strokeWidth="46" transform="translate(0 6)" />
        <path d={d} stroke={INK} strokeWidth="46" />
        <path d={d} stroke="#ffb13b" strokeWidth="30" />
        <path d={d} stroke="#fff4d6" strokeWidth="30" transform="translate(-2 -3)" />
        <path d={d} stroke="#ffffff" strokeWidth="7" transform="translate(-6 -8)" opacity=".85" />
      </g>
    </svg>
  </div>)}</>;
});
export const Liftoff = memo(function Liftoff() {
  return <div className="moon-liftoff"><div className="moon-liftoff-jolt">
    <svg viewBox="-90 -10 740 190">
      <defs><clipPath id="mn-top-half"><rect x="-90" y="-10" width="740" height="88" /></clipPath></defs>
      <g fontFamily="'Arial Black', 'Segoe UI Black', system-ui, sans-serif" fontWeight="900" fontSize="118" textAnchor="middle" letterSpacing="3">
        <text x="280" y="136" fill="#10143a" stroke="#10143a" strokeWidth="26" strokeLinejoin="round" transform="translate(0 7)">LIFTOFF!</text>
        <text x="280" y="136" fill="#ff8a2a" stroke={INK} strokeWidth="24" strokeLinejoin="round" paintOrder="stroke">LIFTOFF!</text>
        <text x="280" y="130" fill="#ffd23f">LIFTOFF!</text>
        <text x="280" y="126" fill="#fff4b8" opacity=".55" clipPath="url(#mn-top-half)">LIFTOFF!</text>
      </g>
    </svg>
  </div></div>;
});
export const GLINT_PATH = 'M0-46C4-12 12-4 46 0C12 4 4 12 0 46C-4 12-12 4-46 0C-12-4-4-12 0-46Z';
/** A comic burst: `n` points alternating through the `outer` radii, valleys at `inner` (degrees of turn in `turn`). */
export const burstD = (n: number, outer: readonly number[], inner: number, turn = 0) => {
  let d = '';
  for (let i = 0; i < 2 * n; i++) {
    const a = (turn - 90 + i * 180 / n) * Math.PI / 180;
    const R = i % 2 ? inner : outer[(i / 2) % outer.length];
    d += `${i ? 'L' : 'M'}${r1(Math.cos(a) * R)} ${r1(Math.sin(a) * R)}`;
  }
  return `${d}Z`;
};
/** The final POP's burst (viewBox −100…100): gold with an ink outline, a pale inner burst and a white heart. */
export const PopBurstArt = memo(function PopBurstArt() {
  return <svg viewBox="-100 -100 200 200">
    <path d={burstD(12, [96, 80], 60)} fill="#ffd23f" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
    <path d={burstD(12, [60, 50], 38, 15)} fill="#fff4b8" />
    <path d="M0-30C3-8 8-3 30 0C8 3 3 8 0 30C-3 8-8 3-30 0C-8-3-3-8 0-30Z" fill="#ffffff" />
  </svg>;
});

/**
 * Hoisted elements: created once, so a per-frame render neither re-creates
 * them nor compares their props (React skips identical elements outright).
 */
export const MOON_ART = {
  stageOne: <StageOneArt />, stageTwo: <StageTwoArt />, stageThree: <StageThreeArt />, tower: <EscapeTowerArt />,
  plume: <PlumeArt />, smallPlume: <SmallPlumeArt />, earth: <EarthArt />, sunLight: <SunLightArt />, sunCore: <SunCoreArt />, moonGlobe: <MoonGlobeArt />,
  moonDecals: <MoonGlobeDecals />, moonRim: <MoonGlobeRim />,
  defs: <><MoonDefs /><GlobeDefs /></>, countdown: <Countdown />, liftoff: <Liftoff />, twinkles: <Twinkles />, dawnTwinkles: <DawnTwinkles />,
  popBurst: <PopBurstArt />,
} as const;
