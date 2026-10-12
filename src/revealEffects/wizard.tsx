import { memo, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  WIZARD_BEATS as B, WIZARD_DURATION_MS, WIZARD_SKY, WIZARD_WORDS, CANDLE_DRIFT_DELAY, RAY_MS,
  WIZARD_COVER_VAR_NAMES, burstPlan, flightPlan, isDense, letterPlan, sparkPlan, wizardCoverVars, wizardLayout,
  type WizardLayout, type WizardRect,
} from './wizardTimeline';
import { trailWidth, wizardTracks, type TimedTrack, type WizardTrack } from './wizardTracks';
import type { RevealEffect } from './types';
import './wizard.css';

// ---------------------------------------------------------------------------
// Shared shapes

function starPath(cx: number, cy: number, r: number, inner = 0.5, rotation = -90) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (rotation + i * 36) * Math.PI / 180;
    const rr = i % 2 ? r * inner : r;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
}

function sparklePath(cx: number, cy: number, r: number, pinch = 0.2) {
  const q = r * pinch;
  return `M${cx} ${cy - r}Q${cx + q} ${cy - q} ${cx + r} ${cy}Q${cx + q} ${cy + q} ${cx} ${cy + r}Q${cx - q} ${cy + q} ${cx - r} ${cy}Q${cx - q} ${cy - q} ${cx} ${cy - r}Z`;
}

/** Wax blob outline: a slightly lumpy circle, fixed so every seal matches. */
const SEAL_BLOB = (() => {
  const points = Array.from({ length: 40 }, (_, i) => {
    const a = i / 40 * Math.PI * 2;
    const r = 46 + 2.4 * Math.sin(5 * a + 0.6) + 1.4 * Math.sin(9 * a + 2) + (a > 1.7 && a < 2.3 ? 3.2 * Math.sin((a - 1.7) / 0.6 * Math.PI) : 0);
    return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${points.join('L')}Z`;
})();
const SEAL_BLOB_SHADOW = SEAL_BLOB.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x: string, y: string) => `${(+x + 1.5).toFixed(2)} ${(+y + 3).toFixed(2)}`);

// ---------------------------------------------------------------------------
// Static art as CSS background images. Every cover and every Stage flight shows the same envelope,
// seal, puff and burst: one shared stylesheet rule (ART_RULE, written by the Stage) draws them all,
// instead of a dozen SVG nodes per cover, so a 48-cell Today table builds and styles far less DOM.

/** An SVG document as a CSS url() (single-quoted attributes inside, so little needs escaping). */
function svgUrl(viewBox: string, content: string, stretch = false) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}'${stretch ? " preserveAspectRatio='none'" : ''}>${content}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Envelope body and flap (stretched to the envelope box, so the Stage flights and the covers match). */
const ENVELOPE_BODY_ART = svgUrl('0 0 155 100', [
  "<rect x='1' y='1' width='153' height='98' rx='5' fill='#f4e2b8' stroke='#c9a767' stroke-width='1.6'/>",
  "<path d='M2 4L2 96L70 57Z' fill='#efd9a7'/>",
  "<path d='M153 4L153 96L85 57Z' fill='#e8cf98'/>",
  "<path d='M2 99L153 99L91 51Q77.5 44 64 51Z' fill='#f7e7c2' stroke='#d9bf85' stroke-width='1.2' stroke-linejoin='round'/>",
  "<path d='M8 93L66 55' stroke='#fffaf0' stroke-width='1.4' stroke-linecap='round' stroke-opacity='.7'/>",
].join(''), true);
const ENVELOPE_FLAP_ART = svgUrl('0 0 155 100', [
  "<path d='M1 3L154 3L80 59Q77.5 62 75 59Z' fill='#cdb07a' fill-opacity='.55'/>",
  "<path d='M1 1L154 1L80.5 55.5Q77.5 58.5 74.5 55.5Z' fill='#f1dcab' stroke='#c9a767' stroke-width='1.4' stroke-linejoin='round'/>",
  "<path d='M10 5L72 49' stroke='#fffaf0' stroke-width='1.3' stroke-linecap='round' stroke-opacity='.75'/>",
].join(''), true);
/** The wax seal: a magenta blob with a pale star (drawn in a box 116/104 of the seal, see .wz-seal-art). */
const SEAL_ART = svgUrl('-58 -58 116 116', [
  `<path d='${SEAL_BLOB_SHADOW}' fill='#6d1a47' fill-opacity='.45'/>`,
  `<path d='${SEAL_BLOB}' fill='#bd3a7e' stroke='#7e1f53' stroke-width='3' stroke-linejoin='round'/>`,
  "<circle r='32' fill='#b3336f' stroke='#9a2a66' stroke-width='4'/>",
  `<path d='${starPath(1.2, 3.2, 22, 0.47)}' fill='#8a2459' fill-opacity='.55'/>`,
  `<path d='${starPath(0, 1.5, 22, 0.47)}' fill='#f7bcd8' stroke='#9a2a66' stroke-width='2.4' stroke-linejoin='round'/>`,
  "<path d='M-9.99 -30.31A11 5.5 -35 1 0 -28.01 -17.69A11 5.5 -35 1 0 -9.99 -30.31Z' fill='#e472a8' fill-opacity='.85'/>",
  "<circle cx='-25' cy='-17' r='2.6' fill='#ffe3f0' fill-opacity='.9'/>",
].join(''));

/** Sparkles around a ring (angles in degrees), merged into one path. */
function ringOfSparkles(angles: readonly number[], radius: number, size: number) {
  return angles.map((angle) => sparklePath(+(radius * Math.cos(angle * Math.PI / 180)).toFixed(2), +(radius * Math.sin(angle * Math.PI / 180)).toFixed(2), size)).join('');
}
function ringOfDots(angles: readonly number[], radius: number, r: number) {
  return angles.map((angle) => {
    const x = +(radius * Math.cos(angle * Math.PI / 180)).toFixed(2), y = +(radius * Math.sin(angle * Math.PI / 180)).toFixed(2);
    return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  }).join('');
}
/** The pop burst at each seal, and the little landing puff when an envelope lands. */
const BURST_ART = svgUrl('-100 -100 200 200', [
  "<circle r='60' fill='none' stroke='#ffe7a0' stroke-width='5'/>",
  `<path d='${ringOfSparkles([20, 140, 260], 72, 19)}' fill='#ffd35c'/>`,
  `<path d='${ringOfSparkles([80, 200, 320], 72, 15)}' fill='#f29bb8'/>`,
  `<path d='${ringOfDots([50, 110, 170, 230, 290, 350], 46, 4.5)}' fill='#fff4c9'/>`,
].join(''));
const PUFF_ART = svgUrl('-100 -100 200 200', [
  "<circle r='58' fill='none' stroke='#ffe7a0' stroke-width='4' stroke-opacity='.8'/>",
  `<path d='${ringOfSparkles([30, 120, 210, 300], 66, 12)}' fill='#ffd35c'/>`,
].join(''));
/** A seal spark: saturated gold with a pale core, so it reads as gold on the night (never grey). */
const SPARK_ART = svgUrl('-12 -12 24 24', [
  "<circle r='9' fill='#ffd35c' fill-opacity='.4'/>",
  `<path d='${sparklePath(0, 0, 11, 0.2)}' fill='#ffd35c' stroke='#e5a93a' stroke-width='1.2' stroke-linejoin='round'/>`,
  `<path d='${sparklePath(0, 0, 5, 0.25)}' fill='#fff6cf'/>`,
].join(''));

const SealFizz = memo(function SealFizz() {
  return <svg viewBox="-100 -100 200 200" aria-hidden="true">
    {[[-40, -28, 17], [-10, -48, 13], [26, -40, 16], [44, -8, 12], [-50, 6, 11], [14, -66, 9], [-28, -64, 8]].map(([x, y, r], i) =>
      <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? '#e6b3cb' : '#b9a7c9'} fillOpacity=".9" />)}
    <path d="M-8 -86q6-8 0-14M8 -80q7-8 1-15" fill="none" stroke="#b9a7c9" strokeWidth="4" strokeLinecap="round" />
  </svg>;
});

/** The whole closed envelope (body, flap and seal), laid out by the shared .wz-env-* classes. */
function ClosedEnvelope() {
  return <>
    <div className="wz-env-body" />
    <div className="wz-env-flap" />
    <div className="wz-seal"><div className="wz-seal-art" /></div>
  </>;
}

const LetterArt = memo(function LetterArt() {
  return <svg viewBox="0 0 146 100" aria-hidden="true">
    <rect x="1.5" y="1.5" width="143" height="97" rx="5" fill="#fff9ea" stroke="#d9c49a" strokeWidth="2" />
    <path d="M2 34H144M2 67H144" stroke="#eadbb8" strokeWidth="1.6" />
    <path d="M2 35.4H144" stroke="#fffdf6" strokeWidth="1" />
    <g fill="none" stroke="#9c8a6a" strokeWidth="3.4" strokeLinecap="round" strokeOpacity=".55">
      <path d="M16 22q6-5 12 0t12 0t12 0t12 0t12 0" />
      <path d="M16 50q6-5 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0" />
      <path d="M16 81q6-5 12 0t12 0t12 0t12 0" />
    </g>
    <path d={starPath(118, 20, 13, 0.5)} fill="#ffd35c" stroke="#e5a93a" strokeWidth="2" strokeLinejoin="round" />
    <path d="M86 84q6-9 12-2q6-9 12 0q-6 9-12 12q-6-3-12-10Z" fill="#f29bb8" fillOpacity=".85" />
  </svg>;
});

// ---------------------------------------------------------------------------
// Cover: one per card. Pure CSS from the per-cover custom properties the Stage writes.

/**
 * The veil's star field and night gradient as CSS layers, anchored to the viewport so the night is
 * seamless across cards. The star layers are one viewport in size; the gradient layer is three
 * viewports each way (flat beyond the screen), so a part-open iris (whose background scales with
 * it) never shows a seam where the viewport-sized tile ends.
 */
const SKY_GRADIENT = 'linear-gradient(#141840 0 33.333%, #23286a 51.667%, #36307c 66.667% 100%)';
const SKY_GRADIENT_POSITION = 'calc(var(--wz-sky-x) - 100vw) calc(var(--wz-sky-y) - 100vh)';
const SKY_BACKGROUND = [
  ...WIZARD_SKY.map((star) => `radial-gradient(circle at ${(star.x * 100).toFixed(2)}% ${(star.y * 100).toFixed(2)}%, rgba(255,246,216,${star.o.toFixed(2)}) 0 ${star.r.toFixed(2)}px, transparent ${(star.r + 0.8).toFixed(2)}px)`),
  SKY_GRADIENT,
].join(', ');
const SKY_SIZE = [...WIZARD_SKY.map(() => '100vw 100vh'), '300vw 300vh'].join(', ');
const SKY_POSITION = [...WIZARD_SKY.map(() => 'var(--wz-sky-x) var(--wz-sky-y)'), SKY_GRADIENT_POSITION].join(', ');

/**
 * Distant hills with a storybook village: a windmill, two cottages with warm windows, round
 * trees and pines. A generic silhouette at the foot of the night (deliberately no castle).
 * Drawn once in the Stage veil (JSX) and as the covers' shared background image (SKYLINE_ART).
 */
const SKYLINE_BAND = 0.24;
const SKYLINE_BOTTOM = 60;
const SAILS = [28, 118, 208, 298].map((angle) => {
  const at = (x: number, y: number) => {
    const a = angle * Math.PI / 180;
    return `${(1190 + x * Math.cos(a) - y * Math.sin(a)).toFixed(1)} ${(156 + x * Math.sin(a) + y * Math.cos(a)).toFixed(1)}`;
  };
  return `M${at(5, -2.5)}L${at(56, -7)}L${at(57, 8)}L${at(5, 3)}Z`;
}).join('');
type Shape = { d: string; fill: string; opacity?: number } | { circle: readonly [number, number, number]; fill: string; opacity?: number };
const SKYLINE_SHAPES: readonly Shape[] = [
  { d: 'M0 236C120 214 240 222 360 232S600 214 760 222S1010 206 1130 214S1400 226 1600 212V300H0Z', fill: '#2b2869' },
  { circle: [1190, 204, 18], fill: '#ffd98a', opacity: 0.12 },
  { circle: [1057, 204, 22], fill: '#ffd98a', opacity: 0.1 },
  { d: `M1176 226L1181 160H1199L1204 226ZM1177 162Q1190 140 1203 162Z${SAILS}M1034 222V194H1082V222ZM1028 196L1058 170L1088 196ZM1066 186V167H1075V194ZM1284 230V206H1320V230ZM1279 208L1302 188L1325 208ZM1099 206a13 13 0 1 1 26 0a13 13 0 1 1-26 0ZM1118 212a10 10 0 1 1 20 0a10 10 0 1 1-20 0ZM1338 214a12 12 0 1 1 24 0a12 12 0 1 1-24 0ZM1110 206h4v22h-4ZM1348 214h4v18h-4Z`, fill: '#1f1d55' },
  { d: 'M0 262C140 248 260 254 400 262S640 272 800 260S1080 248 1240 258S1460 272 1600 256V300H0Z', fill: '#1a1846' },
  { d: 'M118 262L132 222L146 262ZM140 264L156 214L172 264ZM1470 262L1484 226L1498 262ZM1492 262L1506 232L1520 262ZM1402 262L1414 230L1426 262ZM262 262V236L286 220L310 236V262Z', fill: '#141238' },
  { d: 'M0 282C200 272 420 286 640 280S1100 270 1320 280S1520 288 1600 278V300H0Z', fill: '#12102f' },
  { d: 'M1186 206a4 4 0 0 1 8 0v8h-8ZM1041 200h9v8h-9ZM1064 200h9v8h-9ZM1297 212h9v8h-9ZM281 242h8v9h-8Z', fill: '#ffd98a', opacity: 0.92 },
];
const SKYLINE_ART = svgUrl('0 0 1600 300', SKYLINE_SHAPES.map((shape) => {
  const opacity = shape.opacity === undefined ? '' : ` fill-opacity='${shape.opacity}'`;
  return 'd' in shape ? `<path d='${shape.d}' fill='${shape.fill}'${opacity}/>` : `<circle cx='${shape.circle[0]}' cy='${shape.circle[1]}' r='${shape.circle[2]}' fill='${shape.fill}'${opacity}/>`;
}).join(''));
const SkylineArt = memo(function SkylineArt() {
  return <g>{SKYLINE_SHAPES.map((shape, i) => ('d' in shape
    ? <path key={i} d={shape.d} fill={shape.fill} fillOpacity={shape.opacity} />
    : <circle key={i} cx={shape.circle[0]} cy={shape.circle[1]} r={shape.circle[2]} fill={shape.fill} fillOpacity={shape.opacity} />))}</g>;
});

/** The shared art rule: background images for the static art of every cover, flight and spark. */
const ART_RULE = [
  `.wz-env-body { background-image: ${ENVELOPE_BODY_ART}; }`,
  `.wz-env-flap { background-image: ${ENVELOPE_FLAP_ART}; }`,
  `.wz-seal-art { background-image: ${SEAL_ART}; }`,
  `.wz-burst { background-image: ${BURST_ART}; }`,
  `.wz-puff { background-image: ${PUFF_ART}; }`,
  `.wz-skyline { background-image: ${SKYLINE_ART}; }`,
  `.wizard-spark-star { background-image: ${SPARK_ART}; }`,
].join('');

/**
 * One per card. Each element carries a single CSS animation (nested wrappers for later beats).
 * Nightfall: the parchment "?" swells and spins away, then night irises open from the card centre
 * over the (still opaque) parchment, so the card never shows through and never goes grey. The
 * parchment sits inside the night group under the iris, so it leaves with the night at the pop
 * and needs no animation (and no compositor layer) of its own.
 * The reveal mirrors the nightfall: a solid cream bloom with a gold rim opens from the seal, the
 * night switches off in one step underneath it, and the bloom fades out over the revealed card.
 * Nothing translucent-dark ever sits over the card, so it never turns grey. All the art is CSS
 * background images (ART_RULE), so a cover is 21 plain elements.
 */
function WizardCover() {
  return <div className="wz-cover">
    <div className="wz-night">
      <div className="wz-paper"><b className="wz-q">?</b></div>
      <div className="wz-iris" />
      <div className="wz-skyline" />
    </div>
    <div className="wz-bloom" />
    <div className="wz-flash" />
    <div className="wz-env"><div className="wz-chant"><div className="wz-land">
      <div className="wz-shadow" />
      <div className="wz-env-body" />
      <div className="wz-env-flap" />
      <div className="wz-seal">
        <div className="wz-glow" />
        <div className="wz-seal-fizz"><div className="wz-seal-swell"><div className="wz-seal-art" /></div></div>
      </div>
    </div></div></div>
    <div className="wz-puff" />
    <div className="wz-burst" />
  </div>;
}

// ---------------------------------------------------------------------------
// Owl illustration, in owl units (body 100 units wide, centre at 0,0). Each moving part is its own
// element with its own SVG, so the Web Animations tracks move it on the compositor.

const OwlDefs = memo(function OwlDefs({ id }: { id: string }) {
  return <svg className="wizard-defs" width="0" height="0" aria-hidden="true"><defs>
    <radialGradient id={`${id}-halo`}><stop offset="0" stopColor="#ffd98a" stopOpacity=".34" /><stop offset=".6" stopColor="#ffd98a" stopOpacity=".12" /><stop offset="1" stopColor="#ffd98a" stopOpacity="0" /></radialGradient>
    <radialGradient id={`${id}-body`} cx=".38" cy=".3" r=".8"><stop offset="0" stopColor="#c07f4b" /><stop offset=".55" stopColor="#a86a3d" /><stop offset="1" stopColor="#8a532c" /></radialGradient>
    <radialGradient id={`${id}-belly`} cx=".45" cy=".3" r=".75"><stop offset="0" stopColor="#fbe8c4" /><stop offset="1" stopColor="#ecccA0" /></radialGradient>
    <linearGradient id={`${id}-wing`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9a6136" /><stop offset="1" stopColor="#7a4827" /></linearGradient>
    <linearGradient id={`${id}-hat`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7563d6" /><stop offset=".55" stopColor="#5a48b4" /><stop offset="1" stopColor="#40318f" /></linearGradient>
    <radialGradient id={`${id}-tip`}><stop offset="0" stopColor="#fff6cf" stopOpacity=".95" /><stop offset=".45" stopColor="#ffe08a" stopOpacity=".55" /><stop offset="1" stopColor="#ffe08a" stopOpacity="0" /></radialGradient>
  </defs></svg>;
});

const OWL_FLUFF = 'M0 -68.2Q15.2 -84.2 23.7 -63Q43.3 -71.3 43.8 -48.2Q64.9 -47.7 57.3 -26.1Q76.5 -16.7 62 0Q76.5 16.7 57.3 26.1Q64.9 47.7 43.8 48.2Q43.3 71.3 23.7 63Q15.2 84.2 0 68.2Q-15.2 84.2 -23.7 63Q-43.3 71.3 -43.8 48.2Q-64.9 47.7 -57.3 26.1Q-76.5 16.7 -62 0Q-76.5 -16.7 -57.3 -26.1Q-64.9 -47.7 -43.8 -48.2Q-43.3 -71.3 -23.7 -63Q-15.2 -84.2 0 -68.2Z';

type Box = readonly [number, number, number, number];

/** One rig part: an SVG drawn in owl units whose origin sits on this element's origin, k px per unit. */
function Part({ k, box, track, children }: { k: number; box: Box; track?: string; children?: ReactNode }) {
  const [x, y, w, h] = box;
  return <div className="wizard-part" data-track={track}>
    <svg viewBox={`${x} ${y} ${w} ${h}`} style={{ left: x * k, top: y * k, width: w * k, height: h * k }} aria-hidden="true">{children}</svg>
  </div>;
}

/** A moving group with no art of its own (its children are parts). */
function Group({ track, style, children }: { track?: string; style?: CSSProperties; children: ReactNode }) {
  return <div className="wizard-part" data-track={track} style={style}>{children}</div>;
}

const WingArt = ({ id }: { id: string }) => <>
  <path d="M0 -10C22 -26 58 -22 84 -7C77 -1 78 5 71 8C67 15 61 15 55 14C51 21 44 21 38 18C28 22 14 19 0 12Z" fill={`url(#${id}-wing)`} stroke="#5b3417" strokeWidth="2.5" strokeLinejoin="round" />
  <path d="M8 1C28 -3 50 -2 70 3M8 -4C26 -12 48 -12 66 -5" fill="none" stroke="#c08552" strokeWidth="3" strokeLinecap="round" />
</>;

const BodyArt = ({ id }: { id: string }) => <>
  <g stroke="#e0a04a" strokeWidth="4.5" strokeLinecap="round" fill="none"><path d="M-19 49q-2 8-6 10M-13 50v11M-7 49q2 8 6 10" /><path d="M7 49q-2 8-6 10M13 50v11M19 49q2 8 6 10" /></g>
  <path d="M0 -60C31 -60 50 -32 50 4C50 34 30 52 0 52C-30 52-50 34-50 4C-50 -32-31 -60 0 -60Z" fill={`url(#${id}-body)`} stroke="#5b3417" strokeWidth="3" />
  <path d="M-36 -38C-28 -51-14 -57 0 -57" fill="none" stroke="#e9b77a" strokeWidth="3.2" strokeLinecap="round" strokeOpacity=".75" />
  <path d="M44 20C40 36 26 47 8 50" fill="none" stroke="#6e3f1e" strokeWidth="3" strokeLinecap="round" strokeOpacity=".35" />
  <path d="M0 -6C22 -6 35 11 35 27C35 42 19 50 0 50C-19 50-35 42-35 27C-35 11-22 -6 0 -6Z" fill={`url(#${id}-belly)`} />
  <path d="M-19 9l4 4 4-4M-4 9l4 4 4-4M11 9l4 4 4-4M-25 22l4 4 4-4M-10 22l4 4 4-4M5 22l4 4 4-4M-16 35l4 4 4-4M-1 35l4 4 4-4" fill="none" stroke="#c9955e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  <path d="M-17 -48C-29 -48-40 -38-40 -24C-40 -9-29 0-17 0C-8 0-3 -5 0 -8C3 -5 8 0 17 0C29 0 40 -9 40 -24C40 -38 29 -48 17 -48C9 -48 3 -44 0 -40C-3 -44-9 -48-17 -48Z" fill="#e7bd86" />
  <path d="M-38 -16C-36 -4-27 1-17 1C-8 1-3 -4 0 -7C3 -4 8 1 17 1C27 1 36 -4 38 -16" fill="none" stroke="#c98f55" strokeWidth="2" strokeOpacity=".6" />
  <path d="M-37 -37Q-19 -52 0 -39Q19 -52 37 -37" fill="none" stroke="#7a4a26" strokeWidth="4.5" strokeLinecap="round" />
</>;

const SatchelArt = () => <>
  <path d="M-38 -18Q-4 6 28 26" fill="none" stroke="#7a4e2b" strokeWidth="4.5" strokeLinecap="round" />
  <path d="M21.43 13.45L38.17 10.5L39.73 19.36L22.99 22.31Z" fill="#fff4dc" stroke="#c9a767" strokeLinejoin="round" />
  <rect x="16" y="18" width="32" height="25" rx="6" fill="#ead3a2" stroke="#8b6a3e" strokeWidth="2" />
  <path d="M16 23Q32 36 48 23V21Q48 18 45 18H19Q16 18 16 21Z" fill="#ddbf86" stroke="#8b6a3e" strokeWidth="1.6" />
  <path d={starPath(32, 31, 5.5, 0.45)} fill="#bd3a7e" />
</>;

const HatArt = ({ id }: { id: string }) => <>
  <path d="M-27 -58C-21 -82-6 -104 12 -113C18 -110 26 -103 31 -97C20 -96 15 -87 27 -58Z" fill={`url(#${id}-hat)`} stroke="#2e2466" strokeWidth="2.5" strokeLinejoin="round" />
  <path d="M-20 -66C-15 -83-5 -97 8 -106" fill="none" stroke="#9c8cf0" strokeWidth="2.4" strokeLinecap="round" strokeOpacity=".6" />
  <path d="M-26 -64Q0 -58 26 -64L27 -57Q0 -51-27 -57Z" fill="#ffd35c" stroke="#b88a22" strokeWidth="1.2" />
  <ellipse cx="0" cy="-56" rx="39" ry="8" fill="#4b3c9e" stroke="#2e2466" strokeWidth="2.5" />
  <path d={starPath(-8.5, -79.5, 7, 0.45)} fill="#ffd35c" />
  <path d={starPath(7.5, -96.5, 5, 0.45)} fill="#ffd35c" />
  <circle cx="31" cy="-97" r="3.4" fill="#ffd35c" stroke="#b88a22" strokeWidth="1" />
</>;

const WandArt = () => <>
  <path d="M0 0H52" stroke="#4a2e17" strokeWidth="7.5" strokeLinecap="round" />
  <path d="M0 0H52" stroke="#6b4526" strokeWidth="5" strokeLinecap="round" />
  <path d="M6 -1.2H48" stroke="#9a6a40" strokeWidth="1.4" strokeLinecap="round" />
  <path d="M1 0H13" stroke="#f3e2bd" strokeWidth="7" strokeLinecap="round" />
  <path d="M58 -10Q60 -2 68 0Q60 2 58 10Q56 2 48 0Q56 -2 58 -10Z" fill="#fff1b0" stroke="#ffd35c" strokeWidth="2" strokeLinejoin="round" />
</>;

/** The whole owl rig as static DOM; every moving part names the track that animates it. */
const OwlRig = memo(function OwlRig({ S, id }: { S: number; id: string }) {
  const k = S / 100;
  return <Group track="owl">
    <Part k={k} box={[-100, -100, 200, 200]}><circle r="96" fill={`url(#${id}-halo)`} /></Part>
    <Part k={k} box={[-100, -104, 200, 200]} track="fluff"><path d={OWL_FLUFF} transform="translate(0 -4) scale(1.1)" fill={`url(#${id}-body)`} stroke="#5b3417" strokeWidth="3" strokeLinejoin="round" /></Part>
    <Part k={k} box={[-4, -30, 94, 56]} track="wingR"><WingArt id={id} /></Part>
    <Group track="body">
      <Part k={k} box={[-56, -66, 112, 132]}><BodyArt id={id} /></Part>
      <Part k={k} box={[-42, -22, 94, 70]} track="satchel"><SatchelArt /></Part>
      <Group track="eyes-open">
        <Part k={k} box={[-36, -44, 72, 40]}><circle cx="-17" cy="-24" r="16" fill="#3a2414" /><circle cx="-17" cy="-24" r="13.5" fill="#f6a623" /><circle cx="17" cy="-24" r="16" fill="#3a2414" /><circle cx="17" cy="-24" r="13.5" fill="#f6a623" /></Part>
        <Part k={k} box={[-28, -36, 56, 24]} track="pupils">
          <circle cx="-17" cy="-24" r="7.5" fill="#2a1a0f" /><circle cx="17" cy="-24" r="7.5" fill="#2a1a0f" />
          <circle cx="-20.5" cy="-28" r="3" fill="#fff" /><circle cx="13.5" cy="-28" r="3" fill="#fff" />
          <circle cx="-14" cy="-21" r="1.4" fill="#fff" /><circle cx="20" cy="-21" r="1.4" fill="#fff" />
        </Part>
      </Group>
      <Part k={k} box={[-36, -46, 72, 30]} track="eyes-lids"><path d="M-34 -28Q-17 -45 0 -28L0 -22Q-17 -32-34 -22ZM0 -28Q17 -45 34 -28L34 -22Q17 -32 0 -22Z" fill="#a86a3d" stroke="#5b3417" strokeWidth="1.5" strokeLinejoin="round" /></Part>
      <Part k={k} box={[-32, -38, 64, 20]} track="eyes-happy"><path d="M-28 -21Q-17 -34-6 -21M6 -21Q17 -34 28 -21" fill="none" stroke="#3a2414" strokeWidth="4.5" strokeLinecap="round" /></Part>
      <Part k={k} box={[-38, -46, 76, 42]} track="eyes-wide">
        <circle cx="-17" cy="-25" r="18.5" fill="#3a2414" /><circle cx="-17" cy="-25" r="16" fill="#fbe6b0" /><circle cx="-17" cy="-25" r="4.2" fill="#2a1a0f" /><circle cx="-21" cy="-30" r="2.4" fill="#fff" />
        <circle cx="17" cy="-25" r="18.5" fill="#3a2414" /><circle cx="17" cy="-25" r="16" fill="#fbe6b0" /><circle cx="17" cy="-25" r="4.2" fill="#2a1a0f" /><circle cx="13" cy="-30" r="2.4" fill="#fff" />
      </Part>
      <Part k={k} box={[-32, -42, 66, 36]} track="eyes-wink">
        <path d="M-28 -21Q-17 -34-6 -21" fill="none" stroke="#3a2414" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="17" cy="-24" r="16" fill="#3a2414" /><circle cx="17" cy="-24" r="13.5" fill="#f6a623" /><circle cx="15" cy="-24" r="7.5" fill="#2a1a0f" /><circle cx="11.5" cy="-28" r="3" fill="#fff" />
      </Part>
      <Part k={k} box={[-36, -42, 72, 36]} track="eyes-blink">
        <circle cx="-17" cy="-24" r="16" fill="#3a2414" /><circle cx="17" cy="-24" r="16" fill="#3a2414" />
        <circle cx="-17" cy="-24" r="14" fill="#b87842" /><circle cx="17" cy="-24" r="14" fill="#b87842" />
        <path d="M-29 -23Q-17 -17-5 -23M5 -23Q17 -17 29 -23" fill="none" stroke="#3a2414" strokeWidth="3.4" strokeLinecap="round" />
      </Part>
      <Part k={k} box={[-9, -17, 18, 24]}><path d="M0 -15L-6.5 -6Q0 5 6.5 -6Z" fill="#f2b544" stroke="#b97e2a" strokeWidth="1.6" strokeLinejoin="round" /></Part>
      <Part k={k} box={[-42, -14, 84, 12]} track="blush"><ellipse cx="-33" cy="-8" rx="7.5" ry="4.2" fill="#f29bb8" /><ellipse cx="33" cy="-8" rx="7.5" ry="4.2" fill="#f29bb8" /></Part>
    </Group>
    <Part k={k} box={[-4, -30, 94, 56]} track="wingL"><WingArt id={id} /></Part>
    <Group track="wand">
      <Group style={{ transform: `translate(${58 * k}px, 0px)` }}>
        <Part k={k} box={[-20, -20, 40, 40]} track="wandGlow"><circle r="20" fill={`url(#${id}-tip)`} /></Part>
      </Group>
      <Part k={k} box={[-6, -12, 76, 24]}><WandArt /></Part>
    </Group>
    <Part k={k} box={[-42, -118, 84, 72]} track="hat"><HatArt id={id} /></Part>
  </Group>;
});

// ---------------------------------------------------------------------------
// Actors: the owl, its trail, dust, feathers and sparks. Static DOM, animated by Web Animations
// keyframes precomputed from the pure choreography (no per-frame JavaScript at all).

const FEATHER_PATH = 'M0 -10C6 -6 7 4 0 10C-7 4-6 -6 0 -10Z';

type Segment = { left: number; top: number; width: number; height: number };
function TrailSeg({ i, segment, children }: { i: number; segment: Segment; children: ReactNode }) {
  return <svg data-track={`seg${i}`} className="wizard-trail-seg" style={{ left: segment.left, top: segment.top, width: segment.width, height: segment.height }} viewBox={`0 0 ${segment.width.toFixed(2)} ${segment.height.toFixed(2)}`} aria-hidden="true">{children}</svg>;
}

const Actors = memo(function Actors({ layout }: { layout: WizardLayout }) {
  const id = useId().replace(/:/g, '');
  const host = useRef<HTMLDivElement>(null);
  const mounted = useRef<number | null>(null);
  const tracks = useMemo(() => wizardTracks(layout), [layout]);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    // The owl rig runs for the whole story (fill 'both'); everything short-lived runs only in its live window
    // (fill 'none', invisible by its base style outside it), so its animation and layer end with it.
    const whole = (track: WizardTrack): TimedTrack => ({ frames: track, delay: 0, duration: WIZARD_DURATION_MS });
    const byName: Record<string, TimedTrack | null> = {
      owl: whole(tracks.owl.root), fluff: whole(tracks.owl.fluff), wingR: whole(tracks.owl.wingR), wingL: whole(tracks.owl.wingL), body: whole(tracks.owl.body), satchel: whole(tracks.owl.satchel),
      'eyes-open': whole(tracks.owl.eyes.open), 'eyes-lids': whole(tracks.owl.eyes.lids), 'eyes-happy': whole(tracks.owl.eyes.happy), 'eyes-wide': whole(tracks.owl.eyes.wide), 'eyes-wink': whole(tracks.owl.eyes.wink), 'eyes-blink': whole(tracks.owl.eyes.blink),
      pupils: whole(tracks.owl.pupils), blush: whole(tracks.owl.blush), wand: whole(tracks.owl.wand), wandGlow: whole(tracks.owl.wandGlow), hat: whole(tracks.owl.hat),
      trail: tracks.trail, zap: tracks.zap, hop: tracks.hop,
    };
    tracks.dust.forEach((track, i) => { byName[`dust${i}`] = track; });
    tracks.feathers.forEach((track, i) => { byName[`feather${i}`] = track; });
    tracks.segments.forEach((segment, i) => { byName[`seg${i}`] = segment.track; });
    tracks.glints.forEach((glint, i) => { byName[`glint${i}`] = glint.track; });
    // A re-layout (window resize) rebuilds the tracks mid-story: resume them at the story's current time.
    mounted.current ??= performance.now();
    const elapsed = performance.now() - mounted.current;
    const animations: Animation[] = [];
    element.querySelectorAll<HTMLElement>('[data-track]').forEach((node) => {
      const track = byName[node.dataset.track ?? ''];
      if (!track || typeof node.animate !== 'function') return;
      const whole = track.delay === 0 && track.duration === WIZARD_DURATION_MS;
      const animation = node.animate(track.frames as Keyframe[], { delay: track.delay, duration: track.duration, fill: whole ? 'both' : 'none' });
      if (elapsed > 50) animation.currentTime = Math.min(elapsed, WIZARD_DURATION_MS);
      animations.push(animation);
    });
    return () => animations.forEach((animation) => animation.cancel());
  }, [tracks]);
  const { S, star, m } = layout;
  const width = trailWidth(layout);
  const sparkle = (r: number, color = '#fff6cf', edge = '#ffd35c') => <svg viewBox={`${-r - 2} ${-r - 2} ${2 * r + 4} ${2 * r + 4}`} style={{ left: -r - 2, top: -r - 2, width: 2 * r + 4, height: 2 * r + 4 }} aria-hidden="true"><path d={sparklePath(0, 0, r, 0.22)} fill={color} stroke={edge} strokeWidth="1.3" strokeLinejoin="round" /></svg>;
  return <div ref={host} className="wizard-actors">
    <OwlDefs id={id} />
    <div className="wizard-trail" data-track="trail" style={{ transformOrigin: `${star.x}px ${star.y}px` }}>
      {/* Three passes, so no segment ever overdraws its neighbour at a joint: the translucent glow (butt-capped
          inside the ribbon, half-disc caps at its two ends) with an opaque ink outline, then every gold core, then
          every highlight. Opaque strokes overlap invisibly, so they are round-capped. */}
      {tracks.segments.map((segment, i) => <TrailSeg key={`u${i}`} i={i} segment={segment}>
        <path d={segment.d} fill="none" stroke="#ffc94d" strokeOpacity=".28" strokeWidth={width * 3} strokeLinejoin="round" />
        {segment.cap && <path d={segment.cap} fill="#ffc94d" fillOpacity=".28" />}
        <path d={segment.d} fill="none" stroke="#7a5424" strokeWidth={width + 4} strokeLinejoin="round" strokeLinecap="round" />
      </TrailSeg>)}
      {tracks.segments.map((segment, i) => <TrailSeg key={`c${i}`} i={i} segment={segment}>
        <path d={segment.d} fill="none" stroke="#ffdb70" strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" />
      </TrailSeg>)}
      {tracks.segments.map((segment, i) => <TrailSeg key={`h${i}`} i={i} segment={segment}>
        <path d={segment.d} fill="none" stroke="#fff5cc" strokeWidth={width * 0.35} strokeLinejoin="round" strokeLinecap="round" />
      </TrailSeg>)}
      {tracks.glints.map((glint, i) => <div key={i} className="wizard-glint" style={{ left: glint.x, top: glint.y }}><div className="wizard-part wz-off" data-track={`glint${i}`}>{sparkle(0.02 * m)}</div></div>)}
    </div>
    {tracks.dust.map((_, i) => <div key={i} className="wizard-part wz-off" data-track={`dust${i}`}>{sparkle(0.03 * S * (1 - (i + 1) / 8) + 1.5, '#ffe08a', '#ffe08a')}</div>)}
    {tracks.feathers.map((_, i) => <div key={i} className="wizard-part wz-off" data-track={`feather${i}`}>
      <svg viewBox="-8 -12 16 24" style={{ left: -0.056 * S, top: -0.084 * S, width: 0.112 * S, height: 0.168 * S }} aria-hidden="true"><path d={FEATHER_PATH} fill="#a86a3d" stroke="#5b3417" strokeWidth="1.5" /><path d="M0 -8V9" stroke="#e9b77a" strokeWidth="1.2" /></svg>
    </div>)}
    <OwlRig S={S} id={id} />
    <div className="wizard-part wz-off" data-track="zap">{sparkle(0.035 * m)}</div>
    {tracks.hop && <div className="wizard-part wz-off" data-track="hop">{sparkle(0.025 * m)}</div>}
  </div>;
});

// ---------------------------------------------------------------------------
// Static Stage layers: set up once per layout, then driven entirely by CSS.

type Vars = CSSProperties & Record<`--${string}`, string | number>;
const px = (value: number) => `${value.toFixed(1)}px`;

const Veil = memo(function Veil({ layout }: { layout: WizardLayout }) {
  const id = useId().replace(/:/g, '');
  const { W, H } = layout;
  return <div className="wizard-veil"><div className="wizard-veil-clip"><div className="wizard-veil-lift"><div className="wizard-veil-hold"><div className="wizard-veil-art">
    <svg width={W} height={H} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-night`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}><stop offset="0" stopColor="#141840" /><stop offset=".55" stopColor="#23286a" /><stop offset="1" stopColor="#36307c" /></linearGradient>
        <mask id={`${id}-holes`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect width={W} height={H} fill="#fff" />
          {layout.cards.map((card) => <rect key={card.index} x={card.left + 1} y={card.top + 1} width={Math.max(0, card.width - 2)} height={Math.max(0, card.height - 2)} rx={Math.max(0, card.radius - 1)} fill="#000" />)}
        </mask>
      </defs>
      <g mask={`url(#${id}-holes)`}>
        <rect width={W} height={H} fill={`url(#${id}-night)`} />
        {WIZARD_SKY.map((star, i) => <circle key={i} cx={(star.x * W).toFixed(1)} cy={(star.y * H).toFixed(1)} r={star.r} fill="#fff6d8" fillOpacity={star.o} />)}
        <svg x="0" y={H - SKYLINE_BOTTOM - SKYLINE_BAND * H} width={W} height={SKYLINE_BAND * H} viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice"><SkylineArt /></svg>
      </g>
    </svg>
  </div></div></div></div></div>;
});

const CandleArt = memo(function CandleArt() {
  return <svg viewBox="-17 -26 34 60" aria-hidden="true">
    <rect x="-5" y="-6" width="10" height="34" rx="2.5" fill="#fff3d6" />
    <rect x="1.2" y="-6" width="3.8" height="34" rx="1.9" fill="#e9d3a8" />
    <path d="M-5 -4q2.5 9 5 0q2 5 5 0V-6H-5Z" fill="#ffe7b0" />
    <path d="M-2.6 -6.4V-5" stroke="#5b4630" strokeWidth="1.2" strokeLinecap="round" />
  </svg>;
});

const FlameArt = memo(function FlameArt() {
  return <svg viewBox="-6 -15 12 16" aria-hidden="true">
    <path d="M0 -14C4.5 -8 4.2 -1 0 0C-4.2 -1-4.5 -8 0 -14Z" fill="#ffd35c" />
    <path d="M0 -8.5C2 -5.5 1.8 -1.5 0 -1C-1.8 -1.5-2 -5.5 0 -8.5Z" fill="#fff6cf" />
  </svg>;
});

const WispArt = memo(function WispArt() {
  return <svg viewBox="0 0 10 20" aria-hidden="true"><path d="M5 19C1 15 9 12 5 8S7 2 5 1" fill="none" stroke="#e6e0f4" strokeWidth="1.8" strokeLinecap="round" /></svg>;
});

/** Floating candles. They leave by being blown out: the flame snuffs (80 ms) and a wisp curls up, then the candle drifts up and fades. */
const Candles = memo(function Candles({ layout }: { layout: WizardLayout }) {
  const { width, slots } = layout.candles;
  return <>{slots.map((slot, i) => <div key={i} className="wizard-candle" style={{ left: px(slot.x), top: px(slot.y), '--candle-w': px(width), '--candle-in': `${Math.round(slot.in * 1000)}ms`, '--candle-out': `${Math.round(slot.out * 1000)}ms`, '--candle-drift': `${Math.round((slot.out + CANDLE_DRIFT_DELAY) * 1000)}ms`, '--candle-bob': `${2000 + i * 170}ms`, '--candle-flicker': `${260 + (i % 3) * 40}ms` } as Vars}>
    <div className="wizard-candle-out"><div className="wizard-candle-bob">
      <CandleArt />
      <div className="wizard-flame-out"><div className="wizard-candle-glow" /><div className="wizard-flame"><FlameArt /></div></div>
    </div></div>
    <div className="wizard-wisp"><WispArt /></div>
  </div>)}</>;
});

const Twinkles = memo(function Twinkles({ layout }: { layout: WizardLayout }) {
  return <>{layout.twinkles.map((spot, i) => <div key={i} className="wizard-twinkle" style={{ left: px(spot.x), top: px(spot.y), '--tw-size': px(spot.size * 2), '--tw-in': `${Math.round(spot.in * 1000)}ms`, '--tw-delay': `${spot.delay}ms` } as Vars}>
    <div className="wizard-twinkle-out"><svg viewBox="-10 -10 20 20" aria-hidden="true"><path d={sparklePath(0, 0, 10, 0.16)} fill="#fff6d8" /><circle r="2.2" fill="#fff" /></svg></div>
  </div>)}</>;
});

/**
 * A word pops in (overshoot) and pops out (a quick swell, then it shrinks away), never lingering
 * as a half-transparent ghost. Its SVG has a real box around the text (bold rounded glyphs run
 * about 0.72 em wide, plus the outline), so no engine has to rely on SVG-root overflow.
 */
function Word({ text, x, y, size, rotate, at, out, id }: { text: string; x: number; y: number; size: number; rotate: number; at: number; out: number; id: string }) {
  const stroke = size * 0.16;
  const width = Math.ceil(0.72 * size * text.length + 2 * stroke), height = Math.ceil(1.4 * size + 2 * stroke);
  return <div className="wizard-word" style={{ left: px(x), top: px(y), '--word-rot': `${rotate}deg`, '--word-in': `${Math.round(at * 1000)}ms`, '--word-out': `${Math.round(out * 1000)}ms` } as Vars}>
    <div className="wizard-word-art"><div className="wizard-word-out">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ left: -width / 2, top: -height / 2 }} aria-hidden="true">
        <text x={width / 2} y={height / 2} textAnchor="middle" dominantBaseline="central" fontSize={size} fill={`url(#${id}-gold)`} stroke="#1b1a4a" strokeWidth={stroke} strokeLinejoin="round" paintOrder="stroke">{text}</text>
      </svg>
    </div></div>
  </div>;
}

/** The owl's spell, word by word: "Arcanum…" "…stellae…" over the loop tops, "APERIO!" over the star, then "Aperi!" for the stubborn letter. */
const Words = memo(function Words({ layout }: { layout: WizardLayout }) {
  const id = useId().replace(/:/g, '');
  const { words } = layout;
  return <>
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs><linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3c4" /><stop offset="1" stopColor="#ffc94d" /></linearGradient></defs></svg>
    <Word id={id} text={WIZARD_WORDS.chant1} x={words.chant1.x} y={words.chant1.y} size={words.size} rotate={-6} at={B.chant1} out={B.chantOut} />
    <Word id={id} text={WIZARD_WORDS.chant2} x={words.chant2.x} y={words.chant2.y} size={words.size} rotate={6} at={B.chant2} out={B.chantOut} />
    <Word id={id} text={WIZARD_WORDS.spell} x={words.spell.x} y={words.spell.y} size={words.bigSize} rotate={0} at={B.starIn} out={B.spellOut} />
    {words.command && <Word id={id} text={WIZARD_WORDS.command} x={words.command.x} y={words.command.y} size={words.bigSize} rotate={words.commandRot} at={B.commandIn} out={B.commandOut} />}
  </>;
});

/**
 * The stubborn letter's answer, without a word: a little gold padlock pops onto its seal (4.96)
 * and its shackle clicks shut (5.02) while the envelope shakes "no" (the padlock hangs off the
 * same pivot and shakes with it). At the boop the shackle springs open and the padlock swells
 * and pops away, fully opaque (6.00–6.16). Drawn with its body centred on (0, 0), 100 units wide.
 */
const LOCK_VIEW = '-60 -106 120 160';
const LockShackle = memo(function LockShackle() {
  return <svg viewBox={LOCK_VIEW} aria-hidden="true">
    <path d="M-30 -30V-62A30 30 0 0 1 30 -62V-30" fill="none" stroke="#4f5370" strokeWidth="21" />
    <path d="M-30 -30V-62A30 30 0 0 1 30 -62V-30" fill="none" stroke="#d3d7ea" strokeWidth="12" />
    <path d="M-33 -40V-62A33 33 0 0 1 -14 -92" fill="none" stroke="#f7f8ff" strokeWidth="3.5" strokeLinecap="round" strokeOpacity=".85" />
  </svg>;
});
const LockBody = memo(function LockBody({ id }: { id: string }) {
  return <svg viewBox={LOCK_VIEW} aria-hidden="true">
    <defs><linearGradient id={`${id}-lock`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe9a3" /><stop offset=".55" stopColor="#ffd35c" /><stop offset="1" stopColor="#efa93a" /></linearGradient></defs>
    <rect x="-50" y="-34" width="100" height="80" rx="17" fill={`url(#${id}-lock)`} stroke="#7a4f17" strokeWidth="5" />
    <rect x="-38" y="-25" width="76" height="11" rx="5.5" fill="#fff6d0" fillOpacity=".8" />
    <path d="M0 -6a10 10 0 0 1 6 18l4 17h-20l4-17a10 10 0 0 1 6-18Z" fill="#5b3a12" />
  </svg>;
});
const Padlock = memo(function Padlock({ layout }: { layout: WizardLayout }) {
  const id = useId().replace(/:/g, '');
  const { lock } = layout;
  if (!lock) return null;
  return <div className="wizard-lock" style={{ left: px(lock.x), top: px(lock.y), '--lock-size': px(lock.size) } as Vars}>
    <div className="wizard-lock-shake"><div className="wizard-lock-at" style={{ transform: `translateY(${px(lock.dy)})` }}>
      <div className="wizard-lock-pop">
        <div className="wizard-lock-shackle"><LockShackle /></div>
        <LockBody id={id} />
      </div>
    </div></div>
  </div>;
});

/**
 * The star burst: the star pops in (4.20), gathers itself (squash and twist, glowing white-hot,
 * 4.34-4.42), then bursts: it flares to 1.4x and burns out under a white-hot core flash that
 * collapses to a point (it never fades as a big milky disc), while a gold shockwave ring races
 * out, thinning as it goes, and vanishes in 40 ms. The rays and star-confetti are separate.
 */
const GoldStar = memo(function GoldStar({ layout }: { layout: WizardLayout }) {
  const { x, y, r } = layout.star;
  return <div className="wizard-star" style={{ left: px(x), top: px(y), '--star-size': px(r * 2.3), '--ring-size': px(0.24 * layout.m) } as Vars}>
    <div className="wizard-star-flash" />
    <div className="wizard-star-ring">
      <svg viewBox="-60 -60 120 120" aria-hidden="true"><circle className="wz-ring-gold" r="50" /><circle className="wz-ring-core" r="50" /></svg>
    </div>
    <div className="wizard-star-art"><div className="wizard-star-burst">
      <svg viewBox="-115 -115 230 230" aria-hidden="true">
        <defs><linearGradient id="wz-star-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff0a0" /><stop offset=".5" stopColor="#ffe680" /><stop offset="1" stopColor="#ffc53d" /></linearGradient></defs>
        <path d={starPath(0, 6, 100, 0.52)} fill="#e8952c" fillOpacity=".5" />
        <path d={starPath(0, 0, 100, 0.52)} fill="url(#wz-star-fill)" stroke="#f2a93b" strokeWidth="10" strokeLinejoin="round" />
        <path d={starPath(0, 4, 58, 0.52)} fill="none" stroke="#fff6cf" strokeWidth="4" strokeLinejoin="round" strokeOpacity=".55" />
        <ellipse cx="-24" cy="-30" rx="16" ry="9" fill="#fff" fillOpacity=".6" transform="rotate(-30 -24 -30)" />
      </svg>
      <div className="wizard-star-hot">
        <svg viewBox="-115 -115 230 230" aria-hidden="true"><path d={starPath(0, 0, 104, 0.52)} fill="#fff6d8" stroke="#ffe9a8" strokeWidth="8" strokeLinejoin="round" /><path d={starPath(0, 2, 60, 0.52)} fill="#ffe7a0" fillOpacity=".7" /></svg>
      </div>
    </div></div>
    <div className="wizard-star-core" />
  </div>;
});

const RaySparkle = memo(function RaySparkle() {
  return <svg viewBox="-12 -12 24 24" aria-hidden="true"><path d={sparklePath(0, 0, 11.5, 0.22)} fill="#ffd35c" stroke="#e09a2e" strokeWidth="1.1" strokeLinejoin="round" /><path d={sparklePath(0, 0, 5.5, 0.25)} fill="#fff6cf" /></svg>;
});
const RayStar = memo(function RayStar() {
  return <svg viewBox="-12 -12 24 24" aria-hidden="true"><path d={starPath(0, 0, 11, 0.5)} fill="#ffd35c" stroke="#e09a2e" strokeWidth="1.3" strokeLinejoin="round" /><path d={starPath(0, 0.6, 5, 0.5)} fill="#fff6cf" /></svg>;
});

/** The burst's debris: ten fat gold rays and eight tumbling gold star-confetti pieces (transform and opacity only). */
const StarBurst = memo(function StarBurst({ layout }: { layout: WizardLayout }) {
  const { x, y } = layout.star;
  const { rays, confetti } = burstPlan(layout);
  return <>
    {rays.map((ray, i) => <div key={`ray${i}`} className="wizard-ray" style={{ left: px(x), top: px(y), transform: `rotate(${ray.angle}deg)`, '--ray-dur': `${RAY_MS}ms` } as Vars}>
      <div className="wizard-ray-go" style={{ transform: `translateX(${px(ray.reach)})` }}>
        <div className="wizard-ray-art" style={{ '--ray-size': px(ray.size) } as Vars}>{ray.star ? <RayStar /> : <RaySparkle />}</div>
      </div>
    </div>)}
    {confetti.map((piece, i) => <div key={`cf${i}`} className="wizard-confetti" style={{ left: px(x), top: px(y), '--cf-dur': `${piece.duration}ms` } as Vars}>
      <div className="wz-cf-go" style={{ transform: `translate(${px(piece.dx)}, ${px(-piece.up)})` }}><div className="wz-cf-fall" style={{ transform: `translateY(${px(piece.fall)})` }}>
        <div className={`wz-cf-art${piece.spin < 0 ? ' is-ccw' : ''}`} style={{ '--cf-size': px(piece.size) } as Vars}><RayStar /></div>
      </div></div>
    </div>)}
  </>;
});

/*
 * Per-element travel (flights, sparks, letters, rays, confetti) is written as each wrapper's own inline
 * transform, and shared var-free keyframes animate to it (wz-from-none) or away from it (wz-to-none) through
 * the implicit keyframe. No var() inside @keyframes, so WebKit and Blink resolve it identically.
 */
const Flights = memo(function Flights({ layout }: { layout: WizardLayout }) {
  return <>{flightPlan(layout).map((flight) => <div key={flight.index} className="wizard-flight" style={{ left: px(flight.x), top: px(flight.y), '--at': `${Math.round(flight.at)}ms`, '--wz-env-w': px(flight.w), '--wz-env-h': px(flight.h), '--wz-seal': px(0.4 * flight.h) } as Vars}>
    <div className="wizard-flight-x" style={{ transform: `translateX(${px(flight.fx)})` }}><div className="wizard-flight-y" style={{ transform: `translateY(${px(flight.fy)})` }}><div className="wizard-flight-art"><ClosedEnvelope /></div></div></div>
  </div>)}</>;
});

const Sparks = memo(function Sparks({ layout }: { layout: WizardLayout }) {
  const size = 0.028 * layout.m * 2;
  return <>{sparkPlan(layout).map((spark) => <div key={spark.index} className={`wizard-spark${spark.odd ? ' is-odd' : ''}`} style={{ left: px(spark.x), top: px(spark.y), '--spark-dur': `${Math.round(spark.duration)}ms`, '--spark-size': px(size), '--spark-angle': `${spark.angle.toFixed(1)}deg` } as Vars}>
    <div className="wizard-spark-x" style={{ transform: `translateX(${px(spark.tx)})` }}><div className="wizard-spark-y" style={{ transform: `translateY(${px(spark.ty)})` }}><div className="wizard-spark-art"><div className="wizard-spark-tail" /><div className="wizard-spark-star" /></div></div></div>
  </div>)}</>;
});

/** The stubborn seal's fizzle: a grey-pink puff where the spark arrives and nothing happens. */
const Fizzle = memo(function Fizzle({ layout }: { layout: WizardLayout }) {
  const card = layout.cards.find((candidate) => candidate.stuck && candidate.shown);
  if (!card) return null;
  return <div className="wizard-fizz" style={{ left: px(card.sealX), top: px(card.sealY), '--fizz-size': px(3.2 * card.seal), '--fizz-at': `${Math.round(card.fizz * 1000)}ms` } as Vars}><SealFizz /></div>;
});

/**
 * Each letter jumps out of its envelope, then leaves the way letterPlan picks: it sails away (or flutters down like a
 * leaf) with a sway against its travel, or twirls in place and pops. Either way it shrinks away while opaque.
 */
const Letters = memo(function Letters({ layout }: { layout: WizardLayout }) {
  return <>{letterPlan(layout).map((letter) => <div key={letter.index} className={`wizard-letter${letter.side < 0 ? ' is-left' : ''}${letter.stuck ? ' is-stuck' : ''}${letter.kind === 'pop' ? ' is-pop' : ''}`} style={{ left: px(letter.x), top: px(letter.y), '--a1': `${Math.round(letter.a1)}ms`, '--a2': `${Math.round(letter.a2)}ms`, '--go': `${Math.round(letter.go)}ms`, '--lw': px(letter.w), '--lh': px(letter.h) } as Vars}>
    <div className="wizard-letter-rise" style={{ transform: `translateY(${px(letter.rise)})` }}><div className="wizard-letter-go" style={{ transform: `translate(${px(letter.dx)}, ${px(letter.dy)})` }}>
      <div className="wizard-letter-flutter"><LetterArt /></div>
    </div></div>
  </div>)}</>;
});

/**
 * The night sky's star field for every cover's iris, as one stylesheet rule (parsed once, not per card), with the
 * shared art (ART_RULE). On a crowded
 * Today table the tiny irises get only the viewport-anchored night gradient (one layer instead of 35: the veil around
 * them carries the stars), so the night stays seamless for a fraction of the style and paint work.
 */
const SKY_RULE = `.reveal-cover[data-reveal-effect="wizard"]:not([data-wz-dense]) .wz-iris { background-image: ${SKY_BACKGROUND}; background-size: ${SKY_SIZE}; background-position: ${SKY_POSITION}; }`
  + `.reveal-cover[data-reveal-effect="wizard"][data-wz-dense] .wz-iris { background-image: ${SKY_GRADIENT}; background-size: 300vw 300vh; background-position: ${SKY_GRADIENT_POSITION}; }`
  + ART_RULE;

const StaticStage = memo(function StaticStage({ layout }: { layout: WizardLayout }) {
  return <>
    <style>{SKY_RULE}</style>
    <Veil layout={layout} />
    <Twinkles layout={layout} />
    <Candles layout={layout} />
    <Flights layout={layout} />
    <GoldStar layout={layout} />
    <StarBurst layout={layout} />
    <Sparks layout={layout} />
    <Fizzle layout={layout} />
    <Letters layout={layout} />
    <Padlock layout={layout} />
  </>;
});

/**
 * The whole Stage for one layout: static layers driven by CSS, the actors driven by Web
 * Animations, and the words on top of everything (so a wing never hides "…stellae…").
 * Exported so review tools can mount it for any layout (and seek it with document.getAnimations()).
 */
export function WizardScene({ layout }: { layout: WizardLayout }) {
  return <div className="wizard-scene">
    <StaticStage layout={layout} />
    <Actors layout={layout} />
    <Words layout={layout} />
  </div>;
}

/**
 * Measures this reveal's covers once (and after a resize settles), computes the whole
 * choreography, and writes each cover's timing and envelope size as custom
 * properties, so the covers stay pure CSS. Reads all rects before any write.
 */
const COVER_ATTRIBUTES = ['data-wz-on', 'data-wz-sky', 'data-wz-stuck', 'data-wz-dense'] as const;
const RESIZE_SETTLE_MS = 120;

function useWizardLayout() {
  const [layout, setLayout] = useState<WizardLayout | null>(null);
  useLayoutEffect(() => {
    let touched: HTMLElement[] = [];
    const update = () => {
      const covers = Array.from(document.querySelectorAll<HTMLElement>('.reveal-cover[data-reveal-effect="wizard"]'));
      touched = covers;
      const rects: WizardRect[] = covers.map((cover) => {
        const rect = cover.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, radius: parseFloat(getComputedStyle(cover).borderTopLeftRadius) || 0 };
      });
      const next = wizardLayout(rects, { width: window.innerWidth, height: window.innerHeight });
      const skyTop = next.H - SKYLINE_BOTTOM - SKYLINE_BAND * next.H;
      for (const card of next.cards) {
        const cover = covers[card.source];
        for (const [name, value] of Object.entries(wizardCoverVars(card))) cover.style.setProperty(name, value);
        cover.style.setProperty('--wz-flash', px(1.5 * Math.max(card.width, card.height)));
        // Only covers that reach the distant hills draw them (saves painting a hidden skyline 48 times).
        cover.toggleAttribute('data-wz-sky', card.top + card.height > skyTop && card.top < next.H - SKYLINE_BOTTOM + 10);
        cover.toggleAttribute('data-wz-stuck', card.stuck);
        // On a crowded Today table the tiny envelopes skip their purely decorative layers (see wizard.css).
        cover.toggleAttribute('data-wz-dense', isDense(next.cards));
        // Wakes the cover's layers and animations, all in this one write pass (see wizard.css).
        cover.toggleAttribute('data-wz-on', true);
      }
      setLayout(next);
    };
    update();
    // A resize rebuilds every track and restarts every animation: do it once the window stops changing
    // (a trailing 120 ms debounce), not on every event of a drag or a rotation.
    let pending: number | undefined;
    const onResize = () => { window.clearTimeout(pending); pending = window.setTimeout(update, RESIZE_SETTLE_MS); };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(pending);
      // Leave the covers as we found them (they normally unmount with the Stage anyway).
      for (const cover of touched) {
        for (const name of COVER_ATTRIBUTES) cover.removeAttribute(name);
        for (const name of [...Object.keys(WIZARD_COVER_VAR_NAMES), '--wz-flash']) cover.style.removeProperty(name);
      }
    };
  }, []);
  return layout;
}

function WizardStage() {
  const layout = useWizardLayout();
  return layout ? <WizardScene layout={layout} /> : null;
}

export const wizardEffect: RevealEffect = {
  id: 'wizard',
  name: 'Wizard owl · Magic letters',
  description: 'A little owl in a starry hat delivers sealed letters and casts an opening spell, though one stubborn letter needs a second command.',
  durationMs: WIZARD_DURATION_MS,
  sound: 'wizard',
  Stage: WizardStage,
  Cover: WizardCover,
};

