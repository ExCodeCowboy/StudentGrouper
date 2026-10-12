import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { BAKE_FPS, useBakedTracks, type BakedTrack } from './bakedTimeline';
import { measureRevealCovers } from './revealTargets';
import type { RevealEffect } from './types';
import {
  CLICK_TICK, CRAB_BUBBLE_DROPS, CRAB_WALL_PX, CREST, FLOAT_HEAD_SCALE, GLINT_SPOTS, LAP_BODY, LOOP_COUNTS, OTTER_ARMS, OTTER_POSES, SPLASH_MIST, STREAKS, TUBE_FLASH, WAVE_BODY, WAVE_DURATION_MS,
  WAVE_LIP, WAVE_ORIGIN, WAVE_TUBE, WAVE_VIEWBOX, cheerShoulder, crabBubble, crabFx, crabPlan, crabTracks, crabWall, hasMist, outlinePath, splashDrops, waveCoverVars, waveFx, waveLayout,
  waveSplashes, waveTracks, type ArmCurve, type Box, type CardRect, type CrabPlan, type CrabTrackName, type LoopKind, type OtterPose, type SplashSpec, type WaveLayout, type WaveTrackName,
} from './waveMotion';
import './wave.css';

// Ocean wave · Otter surf. A tongue of surf and a floating otter say hello, the
// sea draws back, a big curl stands up and an otter surfs it across the screen:
// a dolphin tail-five, a peek from the dark tube, a cheering exit, and a crab
// peeking over the footer. Covers are warm sand the wave washes clean.
// Choreography lives in waveMotion.ts and is baked into Web Animations at
// mount (bakedTimeline.ts), so playback needs no per-frame React work.

const VIEWBOX = `${WAVE_VIEWBOX.x} ${WAVE_VIEWBOX.y} ${WAVE_VIEWBOX.width} ${WAVE_VIEWBOX.height}`;
const BODY_PATH = outlinePath(WAVE_BODY);
const TUBE_PATH = outlinePath(WAVE_TUBE);
const LIP_PATH = outlinePath(WAVE_LIP);
const LAP_PATH = outlinePath(LAP_BODY);
const FOAM = '#fbffff';
const FOAM_SHADE = '#bfe8ee';

type Puff = readonly [number, number, number];

/** A foam mass: overlapping puffs joined by a round-capped ribbon, so it reads as one soft shape. */
function Puffs({ puffs, fill, dx = 0, dy = 0, opacity }: { puffs: readonly Puff[]; fill: string; dx?: number; dy?: number; opacity?: number }) {
  const ribbon = puffs.map(([x, y], index) => `${index ? 'L' : 'M'}${x + dx} ${y + dy}`).join('');
  const width = Math.min(...puffs.map((puff) => puff[2])) * 1.5;
  return <g fill={fill} opacity={opacity}>
    {puffs.length > 1 && <path d={ribbon} fill="none" stroke={fill} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />}
    {puffs.map(([x, y, r], index) => <circle key={index} cx={x + dx} cy={y + dy} r={r} />)}
  </g>;
}
function Foam({ puffs, shade = FOAM_SHADE, offset = [4, 9], holes = [] }: { puffs: readonly Puff[]; shade?: string; offset?: readonly [number, number]; holes?: readonly Puff[] }) {
  return <g>
    <Puffs puffs={puffs} fill={shade} dx={offset[0]} dy={offset[1]} />
    <Puffs puffs={puffs} fill={FOAM} />
    {holes.length > 0 && <g fill="none" stroke="#cdeff3" strokeWidth="3">{holes.map(([x, y, r], index) => <circle key={index} cx={x} cy={y} r={r} />)}</g>}
  </g>;
}

// ---------------------------------------------------------------------------
// The wave (all layers share one viewBox: 1000 units = 1 S, crest at (0, 190)).

const WaveBody = memo(function WaveBody() {
  return <svg className="wave-svg" viewBox={VIEWBOX} aria-hidden="true">
    <defs>
      <linearGradient id="wave-g-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#35bcd4" /><stop offset=".3" stopColor="#239ec1" /><stop offset=".7" stopColor="#1b82a8" /><stop offset="1" stopColor="#156a8f" />
      </linearGradient>
      <linearGradient id="wave-g-face" x1="0" y1="0" x2=".35" y2="1">
        <stop offset="0" stopColor="#7ae3ea" /><stop offset=".35" stopColor="#45c3d8" /><stop offset="1" stopColor="#2393b8" />
      </linearGradient>
      <radialGradient id="wave-g-tube" cx=".6" cy=".5" r=".62">
        <stop offset="0" stopColor="#0c4460" /><stop offset=".55" stopColor="#12618a" /><stop offset="1" stopColor="#2590b6" />
      </radialGradient>
      <linearGradient id="wave-g-shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#0d5475" stopOpacity=".5" /><stop offset="1" stopColor="#0d5475" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="wave-g-glow" cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#8cebf0" stopOpacity=".75" /><stop offset="1" stopColor="#8cebf0" stopOpacity="0" />
      </radialGradient>
    </defs>
    <path d={BODY_PATH} fill="url(#wave-g-body)" />
    {/* Volume: the back turns away from the light; sunlight glows through the thin crest. */}
    <path d="M-380 1040C-368 890-300 660-200 470C-150 372-110 316-70 270C-130 420-190 650-170 1040Z" fill="url(#wave-g-shade)" />
    <ellipse cx="-40" cy="330" rx="150" ry="120" fill="url(#wave-g-glow)" />
    <path d="M-352 980C-336 840-276 650-184 486C-130 388-72 280-14 222" fill="none" stroke="#9fe9ef" strokeWidth="11" strokeLinecap="round" opacity=".6" />
    {/* Lace foam patterns riding on the back. */}
    <g fill="none" stroke="#e6fbfd" strokeWidth="4" strokeLinecap="round" opacity=".22">
      <path d="M-226 560a18 12 0 0 1 34-8a14 10 0 0 1 28 4a16 12 0 0 1 30-10a12 9 0 0 1 24 2" />
      <path d="M-300 800a18 12 0 0 1 34-8a14 10 0 0 1 28 4a16 12 0 0 1 30-10a12 9 0 0 1 24 2a16 12 0 0 1 30-4" />
    </g>
    <g fill="none" stroke="#dff9fb" strokeLinecap="round">
      <path d="M-236 790C-206 690-166 610-116 540" strokeWidth="6" opacity=".35" /><path d="M-160 900C-140 820-108 750-66 690" strokeWidth="5" opacity=".3" />
      <path d="M-70 780C-50 720-20 670 20 630" strokeWidth="5" opacity=".25" />
    </g>
    {/* The lit face below the barrel, with its bright surface edge. */}
    <path d="M146 562C206 612 252 662 300 740C340 810 400 900 470 1040H340C316 900 262 770 196 660C172 622 150 596 146 562Z" fill="url(#wave-g-face)" />
    <path d="M152 568C210 616 254 666 300 740C340 810 400 900 466 1040" fill="none" stroke="#caf7f9" strokeWidth="7" strokeLinecap="round" opacity=".95" />
    <g fill="none" stroke="#e2fbfc" strokeLinecap="round" opacity=".75"><path d="M200 648C232 688 262 730 288 782" strokeWidth="6" /><path d="M240 728C266 768 292 822 312 876" strokeWidth="5" /></g>
    {/* The hollow barrel: teal, never black, with a swirl of light inside. */}
    <path d={TUBE_PATH} fill="url(#wave-g-tube)" />
    <path d="M236 336C196 300 124 306 94 366C74 410 82 468 116 506" fill="none" stroke="#74d9e4" strokeWidth="9" strokeLinecap="round" opacity=".45" />
    <path d="M206 392C184 372 150 384 142 414C136 440 150 462 170 468" fill="none" stroke="#3ba9c8" strokeWidth="6" strokeLinecap="round" opacity=".55" />
    <path d="M58 470C80 530 128 566 180 564" fill="none" stroke="#45bfd6" strokeWidth="7" strokeLinecap="round" opacity=".55" />
    {/* Bubbles (true circles). */}
    <g fill="none" stroke="#e9fdff" strokeWidth="5" opacity=".7">
      <circle cx="-190" cy="740" r="12" /><circle cx="-110" cy="660" r="8" /><circle cx="40" cy="720" r="16" /><circle cx="-40" cy="880" r="10" /><circle cx="120" cy="840" r="9" /><circle cx="-250" cy="920" r="7" />
    </g>
    {/* Whitewater spilling down the back of the crest, and a skirt at the foot. */}
    <Foam puffs={[[-36, 214, 30], [-76, 250, 27], [-110, 298, 23], [-138, 346, 18], [-160, 392, 13], [-176, 432, 9]]} holes={[[-70, 244, 6], [-116, 300, 5]]} />
    <Foam puffs={[[252, 1000, 20], [300, 990, 26], [350, 1000, 30], [400, 1004, 28], [450, 1010, 30]]} />
  </svg>;
});

/** Shallow backwash lace trailing behind the wave. */
const WaveBackwash = memo(function WaveBackwash() {
  return <svg className="wave-svg" viewBox={VIEWBOX} aria-hidden="true">
    <path d="M-372 1040C-384 960-420 910-470 890C-510 874-540 880-560 890V1040Z" fill="#7fd8e2" opacity=".6" />
    <Foam puffs={[[-372, 936, 16], [-408, 906, 14], [-446, 896, 15], [-486, 900, 12], [-522, 904, 10], [-556, 908, 9]]} offset={[2, 6]} />
    <g fill="none" stroke="#ffffff" strokeWidth="5" opacity=".75"><circle cx="-420" cy="960" r="10" /><circle cx="-480" cy="975" r="8" /><circle cx="-380" cy="990" r="7" /></g>
  </svg>;
});

/** The curling lip; pitches about the crest. */
const WaveLip = memo(function WaveLip() {
  return <svg className="wave-svg" viewBox={VIEWBOX} aria-hidden="true">
    <defs>
      <linearGradient id="wave-g-lip" x1="0" y1="0" x2=".8" y2="1">
        <stop offset="0" stopColor="#8ae4eb" /><stop offset=".45" stopColor="#4ec7d9" /><stop offset="1" stopColor="#2ba2c3" />
      </linearGradient>
    </defs>
    <path d={LIP_PATH} fill="url(#wave-g-lip)" />
    <path d="M263 478C292 454 302 412 293 370C281 318 238 278 180 264C112 248 40 254-20 280" fill="none" stroke="#1b7ea3" strokeWidth="10" strokeLinecap="round" opacity=".45" />
    <path d="M20 186C90 168 170 166 236 194C318 230 362 316 352 404C347 450 330 486 300 508" fill="none" stroke="#d4f8f9" strokeWidth="9" strokeLinecap="round" opacity=".9" />
    <path d="M80 216C146 208 204 226 248 266" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" opacity=".45" />
    <Foam puffs={[[-30, 204, 32], [14, 186, 34], [62, 175, 34], [112, 168, 32], [160, 172, 28], [204, 184, 24], [244, 204, 20], [280, 232, 16], [308, 264, 12]]}
      holes={[[40, 180, 7], [118, 166, 6], [196, 184, 5]]} />
    <g fill={FOAM}><circle cx="334" cy="306" r="11" /><circle cx="348" cy="346" r="9" /><circle cx="354" cy="386" r="7" /><circle cx="350" cy="424" r="6" /><ellipse cx="290" cy="536" rx="5" ry="8" /><ellipse cx="270" cy="550" rx="3.5" ry="6" /></g>
  </svg>;
});

/** Spray thrown up off the pitching lip (it also hides where the covers' foam passes above the crest). */
const WaveCrown = memo(function WaveCrown() {
  return <svg className="wave-svg" viewBox={VIEWBOX} aria-hidden="true">
    <defs>
      <radialGradient id="wave-g-mist" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ffffff" stopOpacity=".55" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="104" cy="104" rx="150" ry="96" fill="url(#wave-g-mist)" />
    <Puffs puffs={[[20, 160, 24], [64, 146, 30], [112, 138, 32], [160, 146, 28], [204, 164, 22]]} fill={FOAM_SHADE} dx={3} dy={8} />
    <Puffs puffs={[[20, 160, 24], [64, 146, 30], [112, 138, 32], [160, 146, 28], [204, 164, 22]]} fill={FOAM} />
    <Puffs puffs={[[52, 108, 20], [96, 94, 24], [138, 98, 20], [178, 116, 15]]} fill={FOAM} opacity={.85} />
    <Puffs puffs={[[82, 60, 14], [118, 52, 16], [150, 64, 11]]} fill={FOAM} opacity={.62} />
    <g fill={FOAM}><circle cx="102" cy="22" r="8" opacity=".4" /><circle cx="140" cy="26" r="6" opacity=".4" /><circle cx="40" cy="74" r="7" opacity=".55" /><circle cx="206" cy="92" r="7" opacity=".6" /><circle cx="226" cy="124" r="5" opacity=".7" /></g>
    <g fill="none" stroke="#d2f1f4" strokeWidth="3"><circle cx="96" cy="140" r="7" /><circle cx="150" cy="150" r="5" /><circle cx="110" cy="98" r="5" /></g>
  </svg>;
});

/** A few sun glints twinkling on the water (small HTML layers: compositor-only loops). */
function Glints({ layout, hold }: { layout: WaveLayout; hold: Hold }) {
  return <>{GLINT_SPOTS.map(([x, y, size], index) => {
    const at = layout.local(x, y);
    return <i key={index} ref={hold(`loop-glint-${index}`)} className="wave-glint" style={{ left: at.left, top: at.top, width: size * layout.s, height: size * layout.s }} />;
  })}</>;
}


// ---------------------------------------------------------------------------
// Sea otter (surfing: viewBox 0 0 200 240, board centre at (100, 214)).

type Palette = { fur: string; furDark: string; furMid: string; furShade: string; furLight: string; belly: string; face: string; muzzle: string; ink: string; blush: string; whisker: string; outline: string; nose: string; mouth: string; tongue: string };
const OTTER: Palette = { fur: '#7d5034', furDark: '#56341f', furMid: '#6a4229', furShade: '#63402a', furLight: '#9a6a46', belly: '#a77852', face: '#f1dcbc', muzzle: '#fbf0dc', ink: '#23170f', blush: '#f2a7a0', whisker: '#8b6a50', outline: '#3a2314', nose: '#2f211a', mouth: '#3b2a22', tongue: '#e46f6c' };
const DARK = '#0e4863';
const SILHOUETTE: Palette = { fur: DARK, furDark: DARK, furMid: DARK, furShade: DARK, furLight: DARK, belly: DARK, face: DARK, muzzle: DARK, ink: DARK, blush: DARK, whisker: DARK, outline: DARK, nose: DARK, mouth: DARK, tongue: DARK };

function OtterHead({ c, squint = false, grin = false }: { c: Palette; squint?: boolean; grin?: boolean }) {
  return <g>
    <circle cx="95" cy="44" r="9.5" fill={c.furMid} stroke={c.outline} strokeWidth="3" /><circle cx="95" cy="45" r="4.5" fill={c.furDark} />
    <circle cx="147" cy="42" r="9" fill={c.furMid} stroke={c.outline} strokeWidth="3" /><circle cx="147" cy="43" r="4.2" fill={c.furDark} />
    <circle cx="121" cy="70" r="37" fill={c.fur} stroke={c.outline} strokeWidth="3" />
    <path d="M140 42C152 50 158 62 157 76" fill="none" stroke={c.furLight} strokeWidth="4" strokeLinecap="round" />
    {/* The pale face mask is the sea-otter cue. */}
    <path d="M92 78C92 58 106 50 124 50C144 50 156 60 156 78C156 96 142 106 124 106C106 106 92 96 92 78Z" fill={c.face} />
    {squint
      ? <g fill="none" stroke={c.ink} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M106 63 116 68 106 73" /><path d="M143 62 133 67 143 72" /></g>
      : <g>
        <ellipse cx="112" cy="67" rx="6.2" ry="7.6" fill={c.ink} /><ellipse cx="137" cy="66" rx="6.2" ry="7.6" fill={c.ink} />
        <circle cx="114.4" cy="63.8" r="2.5" fill="#fff" /><circle cx="139.4" cy="62.8" r="2.5" fill="#fff" /><circle cx="110.4" cy="70" r="1.1" fill="#fff" /><circle cx="135.4" cy="69" r="1.1" fill="#fff" />
      </g>}
    <ellipse cx="102" cy="84" rx="6.5" ry="4.2" fill={c.blush} opacity=".6" /><ellipse cx="149" cy="82" rx="6" ry="4" fill={c.blush} opacity=".6" />
    <circle cx="119" cy="87.5" r="9.5" fill={c.muzzle} /><circle cx="133" cy="87.5" r="9.5" fill={c.muzzle} />
    <g fill={c.whisker}><circle cx="114" cy="87" r="1" /><circle cx="118" cy="91" r="1" /><circle cx="137" cy="87" r="1" /><circle cx="134" cy="91" r="1" /></g>
    <path d="M118 77Q126 72 134 77Q132 84 126 85.5Q120 84 118 77Z" fill={c.nose} />
    <ellipse cx="123.5" cy="76.6" rx="2.6" ry="1.2" fill="#fff" opacity=".55" />
    {grin
      ? <g><path d="M118.5 91Q126 107 133.5 91Z" fill="#7d302b" /><path d="M121.5 98Q126 104 130.5 98Q126 95.5 121.5 98Z" fill={c.tongue} /></g>
      : <path d="M120 92Q123 96 126 91.5Q129 96 132 92" fill="none" stroke={c.mouth} strokeWidth="2.2" strokeLinecap="round" />}
    <g stroke={c.whisker} strokeWidth="1.8" strokeLinecap="round"><path d="M143 86 164 81" /><path d="M143 90 165 92" /><path d="M109 86 88 82" /><path d="M109 90 87 92" /></g>
  </g>;
}

type Arm = { d: string; paw: readonly [number, number] };
type Pose = { near: Arm; far: Arm; crouch: number; squint?: boolean; grin?: boolean };
const armPath = ({ from, ctrl, to, paw }: ArmCurve): Arm => ({ d: `M${from[0]} ${from[1]}Q${ctrl[0]} ${ctrl[1]} ${to[0]} ${to[1]}`, paw });
/** Arm drawings per pose (geometry in waveMotion.ts OTTER_ARMS, so tests can check the staging). */
const ARMS = Object.fromEntries(OTTER_POSES.map((pose) => {
  const { near, far, ...rest } = OTTER_ARMS[pose];
  return [pose, { ...rest, near: armPath(near), far: armPath(far) }];
})) as Record<OtterPose, Pose>;
const origin = ([x, y]: readonly [number, number]) => `${(x / 200) * 100}% ${(y / 240) * 100}%`;

function Limb({ d, paw, c, front }: Arm & { c: Palette; front: boolean }) {
  return <g>
    <path d={d} fill="none" stroke={c.outline} strokeWidth="21" strokeLinecap="round" />
    <path d={d} fill="none" stroke={front ? c.fur : c.furMid} strokeWidth="15" strokeLinecap="round" />
    <circle cx={paw[0]} cy={paw[1]} r="8.6" fill={c.furDark} stroke={c.outline} strokeWidth="3" />
  </g>;
}

/**
 * The surfing otter in one pose. `part` splits it into stacked layers so the cheering arms can pump
 * about their shoulders: 'far' (the far arm, behind), 'body' (everything else) and 'near' (in front).
 */
function OtterFigure({ pose, c, part = 'all' }: { pose: OtterPose; c: Palette; part?: 'all' | 'far' | 'body' | 'near' }) {
  const arm = ARMS[pose];
  const k = arm.crouch;
  if (part === 'far' || part === 'near') {
    return <svg className="wave-svg" viewBox="0 0 200 240" aria-hidden="true" overflow="visible">
      <g strokeLinecap="round" strokeLinejoin="round" transform={`translate(0 ${k})`}>{part === 'far' ? <Limb {...arm.far} c={c} front={false} /> : <Limb {...arm.near} c={c} front />}</g>
    </svg>;
  }
  const arms = part === 'all';
  return <svg className="wave-svg" viewBox="0 0 200 240" aria-hidden="true" overflow="visible">
    <g strokeLinecap="round" strokeLinejoin="round">
      {/* Surfboard with fin and a sunny stripe. */}
      <path d="M44 222 36 239 62 222Z" fill={c === OTTER ? '#2f5d73' : DARK} stroke={c.outline} strokeWidth="2.5" />
      <path d="M10 214Q12 202 40 202L176 204Q199 207 194 215Q188 224 160 224L40 224Q12 224 10 214Z" fill={c === OTTER ? '#ff7a59' : DARK} stroke={c === OTTER ? '#a8412a' : DARK} strokeWidth="3" />
      <path d="M28 213H184" stroke={c === OTTER ? '#ffd166' : DARK} strokeWidth="4.5" />
      <path d="M44 206H168" stroke={c === OTTER ? '#ffb39a' : DARK} strokeWidth="2.4" />
      {/* Far arm, thick tapering tail, bent legs and dark webbed feet. */}
      {arms && <g transform={`translate(0 ${k})`}><Limb {...arm.far} c={c} front={false} /></g>}
      <path d={`M80 ${170 + k * .6}C62 176 40 188 18 202C30 209 54 206 76 196C86 190 90 180 80 ${170 + k * .6}Z`} fill={c.furMid} stroke={c.outline} strokeWidth="3" />
      <g fill="none" strokeLinecap="round">
        <path d={`M88 ${176 + k * .5}Q${74 - k * .4} ${190 + k * .2} 72 201M116 ${178 + k * .5}Q${132 + k * .4} ${188 + k * .2} 130 201`} stroke={c.outline} strokeWidth="23" />
        <path d={`M88 ${176 + k * .5}Q${74 - k * .4} ${190 + k * .2} 72 201M116 ${178 + k * .5}Q${132 + k * .4} ${188 + k * .2} 130 201`} stroke={c.fur} strokeWidth="17" />
      </g>
      <path d="M56 203C58 194 86 194 88 203C84 207 60 207 56 203Z" fill={c.furDark} stroke={c.outline} strokeWidth="2.5" />
      <path d="M116 203C118 194 146 194 148 203C144 207 120 207 116 203Z" fill={c.furDark} stroke={c.outline} strokeWidth="2.5" />
      <g transform={`translate(0 ${k})`}>
        {/* Chubby bean body, shaded away from the light, lighter belly. */}
        <path d="M70 170C62 138 80 102 110 96C140 90 156 114 150 142C146 170 124 192 98 190C84 190 74 182 70 170Z" fill={c.fur} stroke={c.outline} strokeWidth="3" />
        <path d="M74 166C68 140 80 112 100 102C88 120 84 148 94 178C84 177 78 173 74 166Z" fill={c.furShade} />
        <path d="M146 122C150 142 144 164 128 180" fill="none" stroke={c.furLight} strokeWidth="4" />
        <path d="M92 180C84 158 92 126 112 120C130 118 138 136 134 156C130 174 114 184 98 184Z" fill={c.belly} />
        <g transform="translate(121 64) scale(1.18) translate(-121 -70)"><OtterHead c={c} squint={arm.squint} grin={arm.grin} /></g>
        {arms && <Limb {...arm.near} c={c} front />}
      </g>
    </g>
  </svg>;
}

const SurfOtterPose = memo(function SurfOtterPose({ pose }: { pose: OtterPose }) { return <OtterFigure pose={pose} c={OTTER} />; });
const SurfOtterPart = memo(function SurfOtterPart({ pose, part }: { pose: OtterPose; part: 'far' | 'body' | 'near' }) { return <OtterFigure pose={pose} c={OTTER} part={part} />; });
/** The cheer, as three layers: the arms pump about their shoulders (baked tracks cheerFar / cheerNear). */
function CheerOtter({ hold }: { hold: Hold }) {
  return <>
    <div ref={hold('cheerFar')} className="wave-layer" style={{ transformOrigin: origin(cheerShoulder('far')) }}><SurfOtterPart pose="cheer" part="far" /></div>
    <div className="wave-layer"><SurfOtterPart pose="cheer" part="body" /></div>
    <div ref={hold('cheerNear')} className="wave-layer" style={{ transformOrigin: origin(cheerShoulder('near')) }}><SurfOtterPart pose="cheer" part="near" /></div>
  </>;
}
const SurfOtterShadow = memo(function SurfOtterShadow() { return <OtterFigure pose="tuck" c={SILHOUETTE} />; });

/** Otter floating on its back with a clam, waving hello (the tease). viewBox 0 0 260 150; head circle at (217, 62). */
const FloatingOtter = memo(function FloatingOtter() {
  const c = OTTER;
  return <svg className="wave-svg" viewBox="0 0 260 150" aria-hidden="true" overflow="visible">
    <g strokeLinecap="round" strokeLinejoin="round" stroke={c.outline} strokeWidth="3">
      <path d="M46 100C28 104 12 98 2 86C8 106 26 118 50 114Z" fill={c.furMid} />
      {/* Webbed hind feet up out of the water, toes spread (never fins or ears). */}
      <path d="M60 86C54 72 50 58 50 47C49 39 55 35 60 39C62 33 69 32 71 38C75 34 81 37 80 44C79 58 76 72 70 86Z" fill={c.furDark} />
      <path d="M88 84C83 70 80 57 81 47C81 39 87 35 92 39C95 33 102 33 104 39C108 35 114 38 113 45C111 60 104 72 97 84Z" fill={c.furDark} />
      <path d="M60.5 39.5 62 50M71 38.5 69.5 50M92.5 39.5 93.5 50M104 39.5 102 50" fill="none" stroke={c.furMid} strokeWidth="2.2" />
      <path d="M38 100C38 72 92 64 144 68C182 70 204 82 204 100C204 116 178 126 136 126C88 126 38 122 38 100Z" fill={c.fur} />
      {/* A big, lighter tummy facing up (it reads from the back of the room). */}
      <path d="M62 90C84 70 156 66 192 82C178 98 108 102 62 94Z" fill={c.belly} stroke="none" />
      <path d="M86 80C112 72 150 71 176 78" fill="none" stroke="#c4946a" strokeWidth="5" />
      <path d="M44 108C70 120 150 124 196 108" fill="none" stroke={c.furShade} strokeWidth="5" />
      {/* A big pink clam hugged to the tummy (ribs and a white shine) and held by a paw; the other paw waves. */}
      <path d="M104 82Q125 46 150 82Q127 93 104 82Z" fill="#fbd0da" stroke="#c9718b" strokeWidth="3" />
      <path d="M127 57V86M118 62 114 83M136 62 140 83" fill="none" stroke="#e08ea5" strokeWidth="2.2" />
      <path d="M113 72Q118 61 126 57" fill="none" stroke="#ffffff" strokeWidth="3.2" opacity=".85" />
      <circle cx="104" cy="83" r="8.5" fill={c.furDark} />
      {/* A big head with an open, happy grin: it is saying hello. */}
      <g transform={`translate(217 62) scale(${FLOAT_HEAD_SCALE}) translate(-121 -70)`}><OtterHead c={c} grin /></g>
    </g>
  </svg>;
});
/**
 * The floating otter's waving arm (same frame), rotated about its shoulder (156, 86) by CSS. The
 * shoulder sits on the tummy, left of the head, so even the widest swing stays clear of the face.
 */
const FloatingArm = memo(function FloatingArm() {
  const c = OTTER;
  return <svg className="wave-svg" viewBox="0 0 260 150" aria-hidden="true" overflow="visible">
    <g strokeLinecap="round">
      <path d="M156 86Q148 58 152 31" fill="none" stroke={c.outline} strokeWidth="21" />
      <path d="M156 86Q148 58 152 31" fill="none" stroke={c.fur} strokeWidth="15" />
      <circle cx="152" cy="25" r="10" fill={c.furDark} stroke={c.outline} strokeWidth="3" />
    </g>
  </svg>;
});

/** Friendly chubby dolphin, facing right. viewBox 0 0 240 120, body centre (125, 62). */
const Dolphin = memo(function Dolphin() {
  return <svg className="wave-svg" viewBox="0 0 240 120" aria-hidden="true" overflow="visible">
    <g strokeLinecap="round" strokeLinejoin="round" stroke="#2f5877" strokeWidth="3">
      <path d="M34 60C24 50 14 40 4 34C16 34 30 42 38 54C30 66 20 78 10 88C24 84 34 76 40 66Z" fill="#5f93b8" />
      <path d="M112 30C112 14 126 4 142 2C136 12 136 22 144 28Z" fill="#5f93b8" />
      <path d="M26 62C46 42 96 24 146 24C188 24 214 38 220 54C232 56 240 60 238 64C234 70 222 71 214 71C198 88 160 97 118 95C78 93 48 80 26 62Z" fill="#86b7d6" />
      <path d="M72 80C110 97 180 95 214 71C180 79 120 81 72 80Z" fill="#eef6fa" stroke="none" />
      <path d="M60 48C100 33 150 29 196 37" fill="none" stroke="#b9dcee" strokeWidth="7" />
      <path d="M150 80C154 96 146 107 132 113C134 99 136 89 138 80Z" fill="#5f93b8" />
      <g stroke="none"><circle cx="192" cy="50" r="8" fill="#1c2b36" /><circle cx="195" cy="47" r="3" fill="#fff" /><circle cx="189.5" cy="53.5" r="1.3" fill="#fff" />
        <ellipse cx="182" cy="64" rx="7" ry="5" fill="#f7b6c0" opacity=".65" /><ellipse cx="202" cy="38" rx="10" ry="4.5" fill="#fff" opacity=".35" /></g>
      <path d="M216 67Q206 77 190 69" fill="none" stroke="#3f6682" strokeWidth="3" />
    </g>
  </svg>;
});

/** The otter hiding in the dark tube: a rim-lit head with ears, so the eyes clearly belong to it. viewBox 0 0 65 50. */
const TunnelHead = memo(function TunnelHead() {
  return <svg className="wave-svg" viewBox="0 0 65 50" aria-hidden="true" overflow="visible">
    <g fill="#093650" stroke="#46bfd8" strokeWidth="1.8">
      <circle cx="16" cy="11" r="6.2" /><circle cx="49" cy="11" r="6.2" />
      <path d="M7 29C7 15 18.5 7 32.5 7C46.5 7 58 15 58 29C58 42 46.5 49.5 32.5 49.5C18.5 49.5 7 42 7 29Z" />
    </g>
    <path d="M17 13C23 9 32 8 41 9" fill="none" stroke="#7fdbe8" strokeWidth="1.8" strokeLinecap="round" opacity=".75" />
    <ellipse cx="32.5" cy="42" rx="4" ry="2.4" fill="#1d5b76" />
  </svg>;
});
/** Two big friendly eye whites (they blink; the pupils are their own layer). Same frame as the head. */
const TunnelEyeWhites = memo(function TunnelEyeWhites() {
  return <svg className="wave-svg" viewBox="0 0 65 50" aria-hidden="true" overflow="visible">
    <g fill="#ffffff"><ellipse cx="23.5" cy="27" rx="7.4" ry="9.2" /><ellipse cx="41.5" cy="27" rx="7.4" ry="9.2" /></g>
  </svg>;
});
const TunnelPupils = memo(function TunnelPupils() {
  return <svg className="wave-svg" viewBox="0 0 65 50" aria-hidden="true" overflow="visible">
    <g fill="#0c3f58"><circle cx="23.5" cy="27.5" r="4.1" /><circle cx="41.5" cy="27.5" r="4.1" /></g>
    <g fill="#ffffff"><circle cx="24.9" cy="25.9" r="1.4" /><circle cx="42.9" cy="25.9" r="1.4" /></g>
  </svg>;
});

/** Tease lap: a tongue of surf, front at x = 0, thinning to a sheet and one rolling lobe. viewBox -900 0 900 460. */
const LapArt = memo(function LapArt() {
  return <svg className="wave-svg" viewBox="-900 0 900 460" aria-hidden="true">
    <defs>
      <linearGradient id="wave-g-lap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#86e1e8" /><stop offset=".5" stopColor="#52c6d7" /><stop offset="1" stopColor="#33a6c4" /></linearGradient>
      <linearGradient id="wave-g-lap-lobe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a4eef1" /><stop offset="1" stopColor="#56c8d9" /></linearGradient>
    </defs>
    {/* A deeper layer behind the tongue gives it thickness. */}
    <path d={LAP_PATH} transform="translate(-24 22)" fill="#2f9fbd" opacity=".5" />
    <path d={LAP_PATH} fill="url(#wave-g-lap)" opacity=".95" />
    {/* Sun on the sloping top, the thin sheet, and the lit, rolling lobe. */}
    <path d="M-900 40C-700 40-560 48-440 62C-350 72-270 92-220 118C-280 104-360 92-440 88C-600 80-760 78-900 82Z" fill="#b2f0f3" opacity=".7" />
    <path d="M-86 292C-70 294-64 272-44 268C-20 264-4 288 2 320C8 360 2 420 6 460H-24C-18 420-16 370-26 334C-36 304-56 294-86 292Z" fill="url(#wave-g-lap-lobe)" opacity=".85" />
    <g fill="none" stroke="#c4f3f6" strokeWidth="5" strokeLinecap="round" opacity=".55"><path d="M-760 190C-660 180-560 182-470 192" /><path d="M-600 290C-500 280-400 284-310 294" /><path d="M-820 370C-720 362-640 364-560 372" /><path d="M-250 390C-200 384-160 386-120 394" /></g>
    {/* A thin foam trail along the top... */}
    <Puffs puffs={[[-640, 44, 5], [-580, 47, 6], [-520, 52, 5], [-460, 59, 6], [-400, 67, 5], [-340, 76, 6], [-280, 92, 5], [-226, 116, 6], [-186, 146, 6], [-166, 186, 6], [-146, 226, 6], [-122, 266, 7], [-96, 288, 7]]} fill={FOAM} opacity={.9} />
    {/* ...rolling over the lobe as a curling foam lip. */}
    <Foam puffs={[[-72, 284, 11], [-52, 270, 15], [-28, 266, 16], [-8, 278, 14], [4, 298, 11], [9, 318, 8]]} offset={[-5, 7]} holes={[[-40, 266, 5]]} />
    <g fill={FOAM}><circle cx="16" cy="300" r="4.5" /><circle cx="20" cy="286" r="3" /><circle cx="4" cy="452" r="7" /><circle cx="-14" cy="456" r="6" /></g>
    <g fill="none" stroke="#ffffff" strokeWidth="4" opacity=".7"><circle cx="-60" cy="380" r="8" /><circle cx="-190" cy="330" r="11" /><circle cx="-30" cy="420" r="6" /><circle cx="-320" cy="220" r="8" /></g>
  </svg>;
});

/** Translucent water line in front of the floating otter's back (same frame as LapArt). */
const LapSurface = memo(function LapSurface() {
  return <svg className="wave-svg" viewBox="-900 0 900 460" aria-hidden="true">
    <path d="M-452 58C-380 64-300 80-240 100C-218 108-200 118-186 128L-180 158C-200 146-226 134-256 126C-320 110-390 96-452 90Z" fill="#6fd6e0" opacity=".8" />
    <path d="M-430 62C-404 62-376 66-350 72M-310 80C-286 86-262 94-242 102M-218 112C-204 120-194 126-186 132" fill="none" stroke="#e9fcfd" strokeWidth="5" strokeLinecap="round" />
  </svg>;
});

/** Shore crab, as stacked layers sharing one 160 x 120 frame; only the top ~84 rows ever show above the footer. */
const CRAB_EDGE = '#b8431f';
const CRAB_SHELL = '#f26b3a';
const CrabLegs = memo(function CrabLegs() {
  const legs = <g fill="none" stroke={CRAB_EDGE} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"><path d="M44 80 24 92 18 108" /><path d="M48 88 30 102 28 114" /><path d="M54 94 42 108 42 116" /></g>;
  return <svg className="wave-svg" viewBox="0 0 160 120" aria-hidden="true" overflow="visible">{legs}<g transform="translate(160 0) scale(-1 1)">{legs}</g></svg>;
});
/** A claw tucked in close to the shell (the crab stays narrow enough to fit beside names). */
const CrabClaw = memo(function CrabClaw() {
  return <svg className="wave-svg" viewBox="0 0 160 120" aria-hidden="true" overflow="visible">
    <g strokeLinecap="round" strokeLinejoin="round" transform="translate(10 0)">
      <path d="M40 74Q26 62 22 46" fill="none" stroke={CRAB_EDGE} strokeWidth="12" />
      <path d="M40 74Q26 62 22 46" fill="none" stroke={CRAB_SHELL} strokeWidth="7" />
      <path d="M6 42C2 26 14 14 28 20C32 30 28 42 18 46C12 48 8 46 6 42Z" fill={CRAB_SHELL} stroke={CRAB_EDGE} strokeWidth="2.6" />
      <path d="M10 36C10 28 16 22 22 22" fill="none" stroke="#ff9a6a" strokeWidth="3" />
    </g>
  </svg>;
});
const CrabPincer = memo(function CrabPincer() {
  return <svg className="wave-svg" viewBox="0 0 160 120" aria-hidden="true" overflow="visible">
    <path d="M34 20C40 8 52 10 50 22C46 23 41 25 37 27Z" fill={CRAB_SHELL} stroke={CRAB_EDGE} strokeWidth="2.6" strokeLinejoin="round" />
  </svg>;
});
const CrabBody = memo(function CrabBody() {
  return <svg className="wave-svg" viewBox="0 0 160 120" aria-hidden="true" overflow="visible">
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M28 76C28 50 52 40 80 40C108 40 132 50 132 76C132 94 110 104 80 104C50 104 28 94 28 76Z" fill={CRAB_SHELL} stroke={CRAB_EDGE} strokeWidth="3" />
      <path d="M36 88C52 100 108 100 124 88C112 104 48 104 36 88Z" fill="#cf4d25" opacity=".55" />
      <path d="M46 58Q60 48 78 48" fill="none" stroke="#ff9a6a" strokeWidth="5" />
      <circle cx="60" cy="66" r="3" fill="#ffa37a" /><circle cx="102" cy="64" r="3.5" fill="#ffa37a" /><circle cx="86" cy="56" r="2.5" fill="#ffa37a" />
      <path d="M70 78Q80 87 90 78" fill="none" stroke="#7a2412" strokeWidth="2.8" />
      <ellipse cx="55" cy="78" rx="5.5" ry="4" fill="#ffb0a0" opacity=".65" /><ellipse cx="105" cy="78" rx="5.5" ry="4" fill="#ffb0a0" opacity=".65" />
    </g>
  </svg>;
});
/** One eye stalk with its big eye white (base at (66, 46) or (94, 46)); it swings about its base. */
const CrabStalk = memo(function CrabStalk({ side }: { side: 1 | -1 }) {
  const base = 80 - 14 * side;
  const eye = 80 - 18 * side;
  return <svg className="wave-svg" viewBox="0 0 160 120" aria-hidden="true" overflow="visible">
    <g strokeLinecap="round">
      <path d={`M${base} 48 ${eye} 24`} stroke={CRAB_EDGE} strokeWidth="7" /><path d={`M${base} 48 ${eye} 24`} stroke={CRAB_SHELL} strokeWidth="3.5" />
      <circle cx={eye} cy="19" r="11.5" fill="#fff" stroke={CRAB_EDGE} strokeWidth="2.4" />
    </g>
  </svg>;
});
const CrabPupil = memo(function CrabPupil({ side }: { side: 1 | -1 }) {
  const eye = 80 - 18 * side;
  return <svg className="wave-svg" viewBox="0 0 160 120" aria-hidden="true" overflow="visible">
    <circle cx={eye} cy="20" r="5.2" fill="#1d1d1d" /><circle cx={eye + 1.8} cy="18" r="1.8" fill="#fff" />
  </svg>;
});
/** A three-stroke "click!" tick just above the pincer: saturated gold with a thick dark outline, so it reads on the cream page. */
const CrabTick = memo(function CrabTick() {
  return <svg className="wave-svg" viewBox="0 0 160 120" aria-hidden="true" overflow="visible">
    <g fill="none" strokeLinecap="round"><path d={CLICK_TICK.lines} stroke={CLICK_TICK.edge} strokeWidth={CLICK_TICK.outline} /><path d={CLICK_TICK.lines} stroke={CLICK_TICK.fill} strokeWidth={CLICK_TICK.core} /></g>
  </svg>;
});
/** Claw lifts and turns about its shoulder (52, 74); the top pincer snaps about its hinge (36, 26); the tick pops at the pincer. */
function CrabClawLayer({ hold, claw, pincer, tick }: { hold: Hold; claw: CrabTrackName; pincer: CrabTrackName; tick: string }) {
  return <div ref={hold(claw)} className="wave-layer" style={{ transformOrigin: '32.5% 61.67%' }}>
    <CrabClaw />
    <div ref={hold(pincer)} className="wave-layer" style={{ transformOrigin: '22.5% 21.67%' }}><CrabPincer /></div>
    <div ref={hold(tick)} className="wave-layer wave-tick" style={{ transformOrigin: `${(CLICK_TICK.origin[0] / 160) * 100}% ${(CLICK_TICK.origin[1] / 120) * 100}%` }}><CrabTick /></div>
  </div>;
}
function CrabStalkLayer({ hold, side, stalk, pupil }: { hold: Hold; side: 1 | -1; stalk: CrabTrackName; pupil: CrabTrackName }) {
  return <div ref={hold(stalk)} className="wave-layer" style={{ transformOrigin: `${((80 - 14 * side) / 160) * 100}% 40%` }}>
    <CrabStalk side={side} />
    <div ref={hold(pupil)} className="wave-layer"><CrabPupil side={side} /></div>
  </div>;
}
function CrabArt({ hold }: { hold: Hold }) {
  return <>
    <div className="wave-layer"><CrabLegs /></div>
    <CrabClawLayer hold={hold} claw="crabClawL" pincer="crabPincerL" tick="crab-tick-L" />
    <div className="wave-layer wave-mirror"><CrabClawLayer hold={hold} claw="crabClawR" pincer="crabPincerR" tick="crab-tick-R" /></div>
    <div className="wave-layer"><CrabBody /></div>
    {/* Eyes on top: the claws never hide them. */}
    <CrabStalkLayer hold={hold} side={1} stalk="crabStalkL" pupil="crabPupilL" />
    <CrabStalkLayer hold={hold} side={-1} stalk="crabStalkR" pupil="crabPupilR" />
  </>;
}

// ---------------------------------------------------------------------------
// One-shot splashes and looping spray (Web Animations, Stage only).

function Splash({ spec, hold }: { spec: SplashSpec; hold: Hold }) {
  const { id, x, y, size, kind } = spec;
  return <div className={`wave-splash is-${kind}`} style={{ left: x, top: y, '--size': `${size}px` } as CSSProperties}>
    {hasMist(kind) && SPLASH_MIST.map(([dx, dy, scale], index) => <b key={index} ref={hold(`${id}-mist-${index}`)} style={{ '--px': `${dx * size}px`, '--py': `${dy * size}px`, '--ps': `${scale * size}px` } as CSSProperties} />)}
    {spec.ring && <u ref={hold(`${id}-ring`)} />}
    {splashDrops(spec).map((drop, index) => <i key={index} ref={hold(`${id}-drop-${index}`)} style={{ '--d': `${drop.diameter}px` } as CSSProperties} />)}
  </div>;
}

function LoopDrops({ kind, className, hold }: { kind: LoopKind; className: string; hold: Hold }) {
  return <div className={className}>{Array.from({ length: LOOP_COUNTS[kind] }, (_, index) => <i key={index} ref={hold(`loop-${kind}-${index}`)} />)}</div>;
}

// ---------------------------------------------------------------------------
// Stage

type Hold = (name: string) => (element: Element | null) => void;

/** Client rectangles of the visible text under `root` (skipping what `skip` rejects), in viewport px. */
function textBoxes(root: Node, skip: (node: Node) => boolean): Box[] {
  const boxes: Box[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (node) => (node.nodeValue?.trim() && !skip(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    range.selectNodeContents(node);
    for (const box of Array.from(range.getClientRects())) {
      if (box.width > 0 && box.height > 0 && box.right > 0 && box.left < window.innerWidth && box.bottom > 0 && box.top < window.innerHeight) boxes.push({ left: box.left, top: box.top, width: box.width, height: box.height });
    }
  }
  return boxes;
}

/**
 * One read of what the crab must never cover: the text and icon rectangles of every card holding a
 * wave cover, plus any other text on the page (the Today table's team names, headings), in viewport
 * px. Runs once the first frame is on screen, and on resize; never per frame.
 */
function measureWaveCards(): CardRect[] {
  const cards: CardRect[] = [];
  const covers = document.querySelectorAll<HTMLElement>('.reveal-cover[data-reveal-effect="wave"]');
  covers.forEach((cover) => {
    const rect = cover.getBoundingClientRect();
    if (rect.right <= 0 || rect.left >= window.innerWidth || rect.bottom <= 0 || rect.top >= window.innerHeight) return;
    const card = cover.parentElement;
    const names: Box[] = card ? textBoxes(card, (node) => cover.contains(node)) : [];
    card?.querySelectorAll('svg, img').forEach((icon) => {
      if (cover.contains(icon)) return;
      const box = icon.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) names.push({ left: box.left, top: box.top, width: box.width, height: box.height });
    });
    cards.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, names });
  });
  // Text outside the cards (never the covers' "?", the Stage or the footer the crab hides behind), as one extra, measured "card".
  const page = textBoxes(document.body, (node) => !!node.parentElement?.closest('.reveal-cover, .wave-stage, .student-show-controls'));
  if (cards.length > 0 && page.length > 0) cards.push({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, names: page });
  return cards;
}

/**
 * The wall the crab hides behind: the top edge of the footer controls (they sit above the Stage), so
 * its body is cut exactly where the footer starts. With no footer it peeks up from the bottom edge.
 */
function measureCrabWall(height: number) {
  const footer = document.querySelector('.student-show-controls');
  if (!footer) return height;
  const top = footer.getBoundingClientRect().top;
  return top > height * 0.5 && top <= height ? top : height - CRAB_WALL_PX;
}

const viewport = () => ({ width: Math.max(1, window.innerWidth), height: Math.max(1, window.innerHeight) });
/** Where the crab peeks on this screen (measured card content and footer). */
const measureCrab = (width: number, height: number) => crabPlan(measureWaveCards(), width, height, measureCrabWall(height));

/** Runs `callback` in a task after the next frame has been presented, so its work never delays that frame. */
function afterNextPaint(callback: () => void) {
  let timer = 0;
  const frame = requestAnimationFrame(() => { timer = window.setTimeout(callback, 0); });
  return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
}

const TEASE_TRACKS: readonly WaveTrackName[] = ['lap', 'float'];

function WaveStage() {
  const [{ width, height }, setSize] = useState(viewport);
  // Everything but the tease mounts once the first frame is on screen, with the crab's measured spot.
  const [plan, setPlan] = useState<CrabPlan | null>(null);
  useEffect(() => {
    const stop = afterNextPaint(() => { const size = viewport(); setSize(size); setPlan(measureCrab(size.width, size.height)); });
    const resize = () => {
      // Re-measure the covers (their wash timing depends on where the cards are), then the Stage and the crab's spot.
      measureRevealCovers();
      const size = viewport();
      setSize(size);
      setPlan((current) => (current ? measureCrab(size.width, size.height) : current));
    };
    window.addEventListener('resize', resize);
    return () => { stop(); window.removeEventListener('resize', resize); };
  }, []);
  const layout = waveLayout(width, height);
  // Actors register through callback refs; the baked tracks look them up once the layout effect runs.
  const nodes = useRef(new Map<string, Element>());
  const hold = useCallback((name: string) => (element: Element | null) => {
    if (element) nodes.current.set(name, element);
    else nodes.current.delete(name);
  }, []);
  const clock = useRef<Animation | null>(null);
  // First frame: only the tease (the lap and the floating otter) mounts and bakes with the reveal. The
  // covers were measured by their own mount, so the Stage adds no forced style or layout work here.
  const bakeTease = useCallback((): BakedTrack[] => {
    const tracks = waveTracks(width, height, BAKE_FPS);
    return TEASE_TRACKS.map((name) => ({ target: nodes.current.get(name), sample: tracks[name] }));
  }, [width, height]);
  useBakedTracks(bakeTease, WAVE_DURATION_MS, BAKE_FPS, clock);
  // Then the wave, surfer, dolphin, splashes and crab mount and join the same clock. The wave only starts
  // to rise at 0.58 s, so nothing visible waits for this, and the start never slips against the sound.
  const bakeScene = useCallback((): BakedTrack[] => {
    if (!plan) return [];
    const tracks = waveTracks(width, height, BAKE_FPS);
    const crab = crabTracks(width, height, plan);
    const fx = { ...waveFx(width, height), ...crabFx(width, height, plan) };
    return [
      ...(Object.keys(tracks) as WaveTrackName[]).filter((name) => !TEASE_TRACKS.includes(name)).map((name) => ({ target: nodes.current.get(name), sample: tracks[name] })),
      ...(Object.keys(crab) as CrabTrackName[]).map((name) => ({ target: nodes.current.get(name), sample: crab[name] })),
      ...Object.entries(fx).map(([name, effect]) => ({ target: nodes.current.get(name), keyframes: effect.keyframes, timing: effect.timing })),
    ];
  }, [width, height, plan]);
  useBakedTracks(bakeScene, WAVE_DURATION_MS, BAKE_FPS, clock);

  return <div className="wave-stage" style={{ '--s': `${layout.s}px` } as CSSProperties}>
    <div ref={hold('lap')} className="wave-actor" style={{ width: layout.lap.width, height: layout.lap.height }}>
      <LapArt />
      <div ref={hold('float')} className="wave-float" style={{ left: layout.floater.left, top: layout.floater.top, width: layout.floater.width, height: layout.floater.height, transformOrigin: '52% 72%' }}>
        <FloatingOtter />
        <div className="wave-layer wave-float-arm"><FloatingArm /></div>
      </div>
      <div className="wave-layer"><LapSurface /></div>
    </div>
    {plan && <WaveScene layout={layout} plan={plan} hold={hold} />}
  </div>;
}

/** The big wave with its surfer, the dolphin, the splashes and the peek-a-boo crab (mounted after the first frame). */
function WaveScene({ layout, plan, hold }: { layout: WaveLayout; plan: CrabPlan; hold: Hold }) {
  const { s, width, height } = layout;
  const splashes = waveSplashes(width, height);
  const bubble = crabBubble(width, height, plan);
  const at = (x: number, y: number) => layout.local(x, y);
  const box = (w: number, h: number, origin?: string): CSSProperties => ({ width: w, height: h, transformOrigin: origin });
  return <>
    <div ref={hold('wave')} className="wave-actor" style={box(layout.wave.width, layout.wave.height, WAVE_ORIGIN)}>
      <div ref={hold('dolphin')} className="wave-actor" style={box(layout.dolphin.width, layout.dolphin.height, '52.08% 51.67%')}><Dolphin /></div>
      <div ref={hold('backwash')} className="wave-layer"><WaveBackwash /></div>
      <div className="wave-layer"><WaveBody /></div>
      {STREAKS.map(({ from: [x, y] }, index) => <i key={index} ref={hold(`loop-streak-${index}`)} className="wave-streak" style={{ left: at(x, y).left, top: at(x, y).top }} />)}
      <Glints layout={layout} hold={hold} />
      {/* The peeking head pops up about its middle and winds up (squashes) toward its chin before the POP. */}
      <div ref={hold('eyes')} className="wave-actor" style={box(layout.eyes.width, layout.eyes.height, '50% 70%')}>
        <TunnelHead />
        <div ref={hold('blink')} className="wave-layer" style={{ transformOrigin: '50% 54%' }}>
          <TunnelEyeWhites />
          <div ref={hold('pupils')} className="wave-layer"><TunnelPupils /></div>
        </div>
      </div>
      {/* The POP lights up the whole tube for a moment (under the lip, behind the otter). */}
      <i ref={hold('tube-flash')} className="wave-tube-flash" style={{ left: at(TUBE_FLASH.x, TUBE_FLASH.y).left, top: at(TUBE_FLASH.x, TUBE_FLASH.y).top, '--size': `${TUBE_FLASH.size * s}px` } as CSSProperties} />
      <div ref={hold('lip')} className="wave-layer" style={{ transformOrigin: `${((CREST.x - WAVE_VIEWBOX.x) / WAVE_VIEWBOX.width) * 100}% ${(CREST.y / WAVE_VIEWBOX.height) * 100}%` }}>
        <WaveLip />
        <div ref={hold('crown')} className="wave-layer"><WaveCrown /><LoopDrops kind="crown" className="wave-crown-drops" hold={hold} /></div>
      </div>
      <div ref={hold('spray')} className="wave-crest-spray" style={{ left: at(-.03, .8).left, top: at(-.03, .8).top }}><LoopDrops kind="spray" className="wave-spray-drops" hold={hold} /></div>
      {/* Water and spit splashes burst from behind the surfer; the tail-five sparkle sits in front. */}
      {splashes.filter((spec) => !spec.front || spec.kind === 'spit').map((spec) => <Splash key={spec.id} spec={spec} hold={hold} />)}
      <div ref={hold('otter')} className="wave-actor" style={box(layout.otter.width, layout.otter.height, '50% 89.17%')}>
        <div ref={hold('boardSpray')} className="wave-board-spray"><LoopDrops kind="board" className="wave-board-drops" hold={hold} /></div>
        {OTTER_POSES.map((pose) => <div key={pose} ref={hold(`pose-${pose}`)} className="wave-layer">{pose === 'cheer' ? <CheerOtter hold={hold} /> : <SurfOtterPose pose={pose} />}</div>)}
        {/* Tunnel darkness: a pre-darkened silhouette cross-faded by opacity (no animated filter). */}
        <div ref={hold('otterShade')} className="wave-layer"><SurfOtterShadow /></div>
      </div>
      {splashes.filter((spec) => spec.kind === 'star').map((spec) => <Splash key={spec.id} spec={spec} hold={hold} />)}
    </div>
    {/* Everything below the footer's top edge is clipped, so the crab really hides behind it. */}
    <div className="wave-crab-clip" style={{ height: crabWall(plan, height) }}>
      <div ref={hold('crab')} className="wave-actor" style={box(layout.crab.width, layout.crab.height)}><CrabArt hold={hold} /></div>
      <div className="wave-bubble" style={{ left: bubble.x, top: bubble.y, '--size': `${bubble.size}px` } as CSSProperties}>
        <i ref={hold('crab-bubble')} />
        {Array.from({ length: CRAB_BUBBLE_DROPS }, (_, index) => <b key={index} ref={hold(`crab-drop-${index}`)} />)}
      </div>
    </div>
  </>;
}

// ---------------------------------------------------------------------------
// Cover: warm beach sand, washed clean by the wave in exact step with the Stage.

const COVER_VARS = waveCoverVars() as CSSProperties;

function WaveCover() {
  return <div className="wave-cover" style={COVER_VARS}>
    <div className="wave-sand-window"><div className="wave-sand"><div className="wave-wet-fade"><i className="wave-wet" /></div><span className="wave-q">?</span></div></div>
    <div className="wave-wash"><i className="wave-lace" /><i className="wave-damp" /><i className="wave-foam" /></div>
  </div>;
}

export const waveEffect: RevealEffect = {
  id: 'wave',
  name: 'Ocean wave · Otter surf',
  description: 'A sea otter surfs a curling wave that washes the sandy covers away, with a dolphin tail-five, a peek-a-boo from the tube and a crab that never covers names.',
  durationMs: WAVE_DURATION_MS,
  sound: 'wave',
  Stage: WaveStage,
  Cover: WaveCover,
};
