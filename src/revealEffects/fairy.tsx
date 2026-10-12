import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { easeInCubic, easeOutBack, easeOutCubic, keyframes, progress, smooth, type Point } from './sceneMotion';
import {
  BFLY_FORE, BFLY_HIND, BFLY_SPOTS, BLING_RAYS_S, BLING_RING_S, FAIRY, FAIRY_DURATION_MS, HERO_FLY_W, LOOK_STAR_SCALE, PERCH, TAP_BURST_S, bump, fairyGlitter, fairyLayout, fairyPose, lookStarPop,
  RIBBON_CHUNKS, RIBBON_DIRS, fairyRibbon, fairyStarPoint, heroButterfly, quadPath, ribbonEdgeColor, ribbonFillColor, ribbonShape,
  type FairyBand, type FairyFace, type FairyLayout, type FairyRect,
} from './fairyMotion';
import { measureRevealCovers } from './revealTargets';
import type { RevealEffect } from './types';
import './fairy.css';

// ---------------------------------------------------------------------------
// Art. Every fairy layer is an SVG with the same viewBox, absolutely filling
// the actor box, so the layers register exactly. Origin = waist centre.
// ---------------------------------------------------------------------------

const VIEWBOX = '-165 -200 330 330';
const PLUM = '#3f2a5c';
const SKIN = '#c98b5e';
const SKIN_SHADE = '#b97a4f';
const HAIR = '#3a2230';
const WING_UP = 'M-6-14C-30-78-104-132-140-106C-166-86-132-30-8-4Z';
const WING_LO = 'M-6-2C-62 2-110 34-98 64C-84 92-30 56-6 6Z';
const WING_VEINS = 'M-12-14Q-70-64-126-98M-14-10Q-64-42-112-58M-12 2Q-52 22-86 56';
const STAR5 = 'M0-18 5.3-5.6 18.4-5.6 7.8 2.6 11.8 15.6 0 7.8-11.8 15.6-7.8 2.6-18.4-5.6-5.3-5.6Z';
const STAR4 = 'M0-10Q1.5-1.5 10 0Q1.5 1.5 0 10Q-1.5 1.5-10 0Q-1.5-1.5 0-10Z';
const BANGS = 'M-46-80C-48-116-20-126 0-124C22-126 48-114 46-80C38-96 26-100 18-93C10-104-4-104-11-95C-22-103-36-99-46-80Z';

const FairyLayer = ({ className, children }: { className?: string; children: ReactNode }) =>
  <svg className={`fairy-layer${className ? ` ${className}` : ''}`} viewBox={VIEWBOX} aria-hidden="true">{children}</svg>;

/** Shared gradients and clip paths, rendered once per scene. */
const FairyDefs = memo(function FairyDefs({ id }: { id: string }) {
  return <svg className="fairy-defs" width="0" height="0" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-wing-up`} x1="1" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#fff4fb" /><stop offset=".35" stopColor="#e6dcff" /><stop offset=".7" stopColor="#d4f2ff" /><stop offset="1" stopColor="#c8fff0" /></linearGradient>
      <linearGradient id={`${id}-wing-lo`} x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff0f8" /><stop offset=".6" stopColor="#ffd8ee" /><stop offset="1" stopColor="#ffc2e2" /></linearGradient>
      <radialGradient id={`${id}-glow`}><stop offset="0" stopColor="#fff8cf" stopOpacity=".95" /><stop offset=".45" stopColor="#ffe98a" stopOpacity=".55" /><stop offset="1" stopColor="#ffe98a" stopOpacity="0" /></radialGradient>
      <linearGradient id={`${id}-dress`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a468ec" /><stop offset="1" stopColor="#7a3cc8" /></linearGradient>
      <linearGradient id={`${id}-skirt`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b47ff5" /><stop offset="1" stopColor="#9657ea" /></linearGradient>
      <radialGradient id={`${id}-face`} cx=".38" cy=".32" r=".8"><stop offset="0" stopColor="#d89b6c" /><stop offset=".7" stopColor={SKIN} /><stop offset="1" stopColor="#bb7d51" /></radialGradient>
      <clipPath id={`${id}-wing-clip`}><path d={`${WING_UP}${WING_LO}`} /></clipPath>
      <clipPath id={`${id}-face-clip`}><circle cx="0" cy="-74" r="45" /></clipPath>
    </defs>
  </svg>;
});

const WingArt = memo(function WingArt({ id, mirrored }: { id: string; mirrored?: boolean }) {
  return <FairyLayer>
    <g transform={mirrored ? 'scale(-1 1)' : undefined}>
      <path d={WING_UP} fill={`url(#${id}-wing-up)`} stroke="#5f8fd6" strokeWidth="4" strokeLinejoin="round" />
      <path d={WING_LO} fill={`url(#${id}-wing-lo)`} stroke="#5f8fd6" strokeWidth="4" strokeLinejoin="round" />
      <g clipPath={`url(#${id}-wing-clip)`}>
        <path d="M-20-20C-50-60-90-96-124-104" fill="none" stroke="#ffffff" strokeWidth="14" strokeLinecap="round" opacity=".35" />
        <path d="M-24-2C-56 10-80 30-86 50" fill="none" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" opacity=".3" />
      </g>
      <path d={WING_VEINS} fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity=".9" />
      <g fill="#fff"><circle cx="-128" cy="-92" r="6" /><circle cx="-108" cy="-104" r="3.5" /><circle cx="-86" cy="58" r="5" /><circle cx="-72" cy="62" r="2.5" /></g>
    </g>
  </FairyLayer>;
});

/** A glint sweeping across the wing: an HTML band inside a wing-shaped mask, so only a composited transform animates. */
const WingGloss = () => <div className="fairy-wing-gloss"><i /></div>;

/** Legs, slippers and the tulip skirt: they trail behind her motion. */
const SkirtArt = memo(function SkirtArt({ id }: { id: string }) {
  return <FairyLayer>
    <g stroke={PLUM} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M-9 58Q-13 80-20 100M9 58Q14 78 24 94" fill="none" stroke={PLUM} strokeWidth="13" />
      <path d="M-9 58Q-13 80-20 100M9 58Q14 78 24 94" fill="none" stroke={SKIN_SHADE} strokeWidth="7.5" />
      <path d="M-30 101Q-26 92-16 96Q-6 102-14 108Q-26 112-34 106Q-38 100-30 101Z" fill="#ff6fae" />
      <path d="M16 93Q26 86 34 94Q40 102 30 106Q20 106 16 98Z" fill="#ff6fae" />
      <path d="M-8 8Q-60 22-56 64Q-30 62-12 40Z" fill="#ff8fc8" />
      <path d="M8 8Q60 22 56 64Q30 62 12 40Z" fill="#ff8fc8" />
      <path d="M-12 6Q-44 32-40 70Q-22 72-4 50Z" fill="#c79af7" />
      <path d="M12 6Q44 32 40 70Q22 72 4 50Z" fill="#c79af7" />
      <path d="M-14 4Q-30 42-18 72Q0 80 18 72Q30 42 14 4Z" fill={`url(#${id}-skirt)`} />
      <path d="M-6 30Q0 52 0 70M8 26Q14 46 12 66" fill="none" stroke="#e7d4ff" strokeWidth="2.5" />
      <path d="M-46 30Q-50 46-48 58M46 30Q50 46 48 58" fill="none" stroke="#ffd0e8" strokeWidth="2.5" />
    </g>
    <g fill="#fff" opacity=".85"><circle cx="-24" cy="104" r="2" /><circle cx="27" cy="97" r="2" /></g>
  </FairyLayer>;
});

/** Resting arm, neck, bodice and star belt. Static. */
const BodyArt = memo(function BodyArt({ id }: { id: string }) {
  return <FairyLayer>
    <g stroke={PLUM} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M-15-14Q-32 0-38 18" fill="none" stroke={PLUM} strokeWidth="13" />
      <path d="M-15-14Q-32 0-38 18" fill="none" stroke={SKIN} strokeWidth="7.5" />
      <circle cx="-38" cy="20" r="7" fill={SKIN} />
      <path d="M-7-36h14v12h-14Z" fill={SKIN_SHADE} stroke="none" />
      <path d="M-18-24Q-22-4-15 10H15Q22-4 18-24Q0-32-18-24Z" fill={`url(#${id}-dress)`} />
      <path d="M-12-20Q-15-6-11 4" fill="none" stroke="#c9a2f7" strokeWidth="2.5" />
      <path d={STAR5} transform="translate(0 2) scale(.42)" fill="#ffd23f" strokeWidth="5" />
    </g>
  </FairyLayer>;
});

/** The wand arm, rotated about the shoulder (15,-16). The wand and star ride a wrist layer about the hand (47,-42). */
const ArmArt = memo(function ArmArt() {
  return <FairyLayer>
    <g fill="none" strokeLinecap="round">
      <path d="M15-16Q34-22 46-40" stroke={PLUM} strokeWidth="13" />
      <path d="M15-16Q34-22 46-40" stroke={SKIN} strokeWidth="7.5" />
    </g>
  </FairyLayer>;
});
const WandArt = memo(function WandArt() {
  return <FairyLayer>
    <g strokeLinecap="round">
      <path d="M44-38 97-116" stroke={PLUM} strokeWidth="9" />
      <path d="M44-38 97-116" stroke="#8b5bd6" strokeWidth="5" />
      <path d="M44-38 97-116" stroke="#fff" strokeWidth="5" strokeDasharray="3 7" strokeLinecap="butt" />
    </g>
  </FairyLayer>;
});
const HandArt = memo(function HandArt() {
  return <FairyLayer><circle cx="47" cy="-42" r="8" fill={SKIN} stroke={PLUM} strokeWidth="3.5" /><path d="M42-45Q46-49 51-46" fill="none" stroke={SKIN_SHADE} strokeWidth="2" strokeLinecap="round" /></FairyLayer>;
});

/** The wand star, lit (gold, with its glow) and fizzled (a dull grey with a dark outline, so it reads from the back of the room). */
const StarArt = memo(function StarArt({ id }: { id: string }) {
  return <FairyLayer>
    <g data-part="star-gold">
      <circle cx="101" cy="-122" r="36" fill={`url(#${id}-glow)`} />
      <g transform="translate(101 -122) rotate(12)" strokeLinejoin="round">
        <path d={STAR5} transform="scale(1.2)" fill="#ffd23f" stroke="#c98a00" strokeWidth="3" />
        <path d={STAR5} transform="scale(.52)" fill="#fff7cc" />
        <circle cx="-5" cy="-7" r="2.6" fill="#fff" />
      </g>
    </g>
    <g data-part="star-grey" style={{ display: 'none' }}>
      <g transform="translate(101 -122) rotate(12)" strokeLinejoin="round">
        <path d={STAR5} transform="scale(1.2)" fill="#bcb2cb" stroke="#6f6485" strokeWidth="3.5" />
        <path d={STAR5} transform="scale(.52)" fill="#dfd9e8" />
      </g>
    </g>
  </FairyLayer>;
});

const eyes = (dx: number, dy: number) => <>
  <ellipse cx={-17 + dx} cy={-70 + dy} rx="7" ry="9.5" fill="#2b1d33" /><ellipse cx={17 + dx} cy={-70 + dy} rx="7" ry="9.5" fill="#2b1d33" />
  <circle cx={-14.5 + dx * 1.2} cy={-73.5 + dy} r="2.8" fill="#fff" /><circle cx={19.5 + dx * 1.2} cy={-73.5 + dy} r="2.8" fill="#fff" />
  <circle cx={-19 + dx} cy={-66 + dy} r="1.3" fill="#fff" opacity=".8" /><circle cx={15 + dx} cy={-66 + dy} r="1.3" fill="#fff" opacity=".8" />
</>;
const cheeks = (opacity: number, rx = 9, ry = 5.5) => <>
  <ellipse cx="-30" cy="-55" rx={rx} ry={ry} fill="#ff6f83" opacity={opacity} /><ellipse cx="30" cy="-55" rx={rx} ry={ry} fill="#ff6f83" opacity={opacity} />
</>;
const nose = <path d="M-2-60Q0-58 2-60" fill="none" stroke="#7a4a33" strokeWidth="2.5" strokeLinecap="round" />;
const smile = <path d="M-11-50Q0-39 11-50" fill="none" stroke="#6b2a3a" strokeWidth="3.5" strokeLinecap="round" />;

const FACES: Record<FairyFace, ReactNode> = {
  happy: <>{eyes(0, 0)}{cheeks(.5)}{nose}{smile}</>,
  // Peering at the grey wand: eyes turned to it, one brow up, a puzzled little mouth.
  look: <>
    <path d="M-26-88Q-17-92-8-88M8-93Q17-100 26-93" fill="none" stroke={HAIR} strokeWidth="3.5" strokeLinecap="round" />
    {eyes(6, -3)}{cheeks(.45)}{nose}<path d="M-6-48Q-2-51 2-48T10-48" fill="none" stroke="#6b2a3a" strokeWidth="3.5" strokeLinecap="round" />
  </>,
  // Counting: eyes on the star, raised up and to the right.
  focus: <>{eyes(5, -6)}{cheeks(.5)}{nose}<path d="M-7-50Q0-45 7-50" fill="none" stroke="#6b2a3a" strokeWidth="3.5" strokeLinecap="round" /></>,
  surprised: <>
    <path d="M-26-90Q-17-97-8-91M8-91Q17-97 26-90" fill="none" stroke={HAIR} strokeWidth="3.5" strokeLinecap="round" />
    <circle cx="-17" cy="-70" r="10" fill="#fff" stroke="#2b1d33" strokeWidth="2.5" /><circle cx="17" cy="-70" r="10" fill="#fff" stroke="#2b1d33" strokeWidth="2.5" />
    <circle cx="-15" cy="-68" r="4" fill="#2b1d33" /><circle cx="19" cy="-68" r="4" fill="#2b1d33" />
    {cheeks(.35)}{nose}
    <ellipse cx="0" cy="-47" rx="6" ry="7.5" fill="#8a2f45" stroke="#6b2a3a" strokeWidth="2.5" />
  </>,
  effort: <>
    <path d="M-27-82-9-75M27-82 9-75" stroke={HAIR} strokeWidth="3.5" strokeLinecap="round" />
    <path d="M-25-72-11-68-25-63M25-72 11-68 25-63" fill="none" stroke="#2b1d33" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    {cheeks(.75, 10, 6)}{nose}
    <path d="M-9-49Q0-52 9-49" fill="none" stroke="#6b2a3a" strokeWidth="3.5" strokeLinecap="round" />
  </>,
  delighted: <>
    <path d="M-25-68Q-17-78-9-68M9-68Q17-78 25-68" fill="none" stroke="#2b1d33" strokeWidth="4.5" strokeLinecap="round" />
    {cheeks(.65, 10, 6)}{nose}
    <path d="M-13-52Q0-30 13-52Z" fill="#8a2f45" stroke="#6b2a3a" strokeWidth="3" strokeLinejoin="round" />
    <path d="M-6-40Q0-36 6-40Q2-44 0-43Q-2-44-6-40Z" fill="#ff8c9c" />
  </>,
  crossed: <>
    <ellipse cx="-17" cy="-70" rx="8" ry="10" fill="#fff" stroke="#2b1d33" strokeWidth="2" /><ellipse cx="17" cy="-70" rx="8" ry="10" fill="#fff" stroke="#2b1d33" strokeWidth="2" />
    <circle cx="-11" cy="-67" r="4.5" fill="#2b1d33" /><circle cx="11" cy="-67" r="4.5" fill="#2b1d33" />
    {cheeks(.6)}{nose}
    <ellipse cx="0" cy="-47" rx="4.5" ry="4" fill="#8a2f45" stroke="#6b2a3a" strokeWidth="2.5" />
  </>,
  wink: <>
    <ellipse cx="-17" cy="-70" rx="7" ry="9.5" fill="#2b1d33" /><circle cx="-14.5" cy="-73.5" r="2.8" fill="#fff" />
    <path d="M9-69Q17-76 25-69" fill="none" stroke="#2b1d33" strokeWidth="4.5" strokeLinecap="round" />
    {cheeks(.55)}{nose}
    <path d="M-12-51Q0-37 12-51" fill="none" stroke="#6b2a3a" strokeWidth="3.5" strokeLinecap="round" />
  </>,
};

const FACE_NAMES = Object.keys(FACES) as FairyFace[];
/** Her head, with every face drawn once; the scene shows one at a time. */
const HeadArt = memo(function HeadArt({ id }: { id: string }) {
  return <FairyLayer>
    <g stroke={PLUM} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="0" cy="-138" r="27" fill={HAIR} />
      <path d="M-52-70C-60-124-18-142 0-140C18-142 60-124 52-70C46-48-46-48-52-70Z" fill={HAIR} />
      <ellipse cx="-47" cy="-70" rx="8" ry="11" fill={SKIN} /><ellipse cx="47" cy="-70" rx="8" ry="11" fill={SKIN} />
      <circle cx="0" cy="-74" r="45" fill={`url(#${id}-face)`} />
      <g clipPath={`url(#${id}-face-clip)`} stroke="none"><path d={BANGS} transform="translate(0 6)" fill="#9b5f38" opacity=".35" /></g>
      <path d={BANGS} fill={HAIR} />
      <path d="M-14-152Q-4-162 8-156M-20-138Q-12-146-2-142M-34-104Q-26-114-14-116" fill="none" stroke="#6b4658" strokeWidth="3" />
      <path d="M12-158Q18-156 20-150" fill="none" stroke="#7d5a6c" strokeWidth="3" />
      {/* The hair flower sits on her left, away from the wand hand, so it never merges with the star. */}
      <g stroke="#d9772f" strokeWidth="2"><circle cx="-30" cy="-120" r="8" fill="#ffcf4a" /><circle cx="-40" cy="-112" r="8" fill="#ffcf4a" /><circle cx="-36" cy="-100" r="8" fill="#ffcf4a" /><circle cx="-24" cy="-100" r="8" fill="#ffcf4a" /><circle cx="-20" cy="-112" r="8" fill="#ffcf4a" /><circle cx="-30" cy="-109" r="5.5" fill="#ff7e5f" /></g>
      <circle cx="-32" cy="-122" r="2.2" fill="#fff" stroke="none" opacity=".9" />
      <g stroke="none">{FACE_NAMES.map((face) => <g key={face} data-part={`face-${face}`} style={face === 'happy' ? undefined : { display: 'none' }}>{FACES[face]}</g>)}</g>
    </g>
  </FairyLayer>;
});

/** One half of a butterfly seen from the front (left half; the right half is mirrored by CSS). */
const FORE_D = quadPath(BFLY_FORE);
const HIND_D = quadPath(BFLY_HIND);
const { fore: FORE_SPOT, hind: HIND_SPOT, shine: SHINE } = BFLY_SPOTS;
const BUTTERFLY_HALF = <>
  <path className="bf-fore" d={FORE_D} />
  <path className="bf-hind" d={HIND_D} />
  <circle className="bf-spot" cx={FORE_SPOT.x} cy={FORE_SPOT.y} r={FORE_SPOT.r} /><circle className="bf-spot" cx={HIND_SPOT.x} cy={HIND_SPOT.y} r={HIND_SPOT.r} />
  <circle cx={SHINE.x} cy={SHINE.y} r={SHINE.r} fill="#fff" opacity=".8" />
</>;
const ButterflyParts = memo(function ButterflyParts() {
  return <>
    <span className="fairy-bfly-wing is-left"><svg viewBox="-50 -40 50 80" aria-hidden="true">{BUTTERFLY_HALF}</svg></span>
    <span className="fairy-bfly-wing is-right"><svg viewBox="-50 -40 50 80" aria-hidden="true">{BUTTERFLY_HALF}</svg></span>
    <svg className="fairy-bfly-body" viewBox="-50 -40 100 80" aria-hidden="true">
      <path d="M0-10V18" stroke={PLUM} strokeWidth="6" strokeLinecap="round" />
      <path d="M-1-11Q-8-24-12-28M1-11Q8-24 12-28" fill="none" stroke={PLUM} strokeWidth="2" strokeLinecap="round" />
      <circle cx="-12" cy="-28" r="2.2" fill={PLUM} /><circle cx="12" cy="-28" r="2.2" fill={PLUM} />
    </svg>
  </>;
});

/** The perched hero butterfly's box, in fairy art units about the perch point (the tip of her nose). */
export const PERCH_BOX = { x: -40, y: -72, w: 80, h: 76 } as const;
const PerchBody = memo(function PerchBody() {
  return <g transform={`scale(${PERCH.scale})`}>
    <path d="M0-12V22" stroke={PLUM} strokeWidth="7" strokeLinecap="round" />
    <circle cx="0" cy="-13" r="4.6" fill={PLUM} />
    <path d="M-1-15Q-7-27-12-31M1-15Q7-27 12-31" fill="none" stroke={PLUM} strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="-12" cy="-31" r="2.6" fill={PLUM} /><circle cx="12" cy="-31" r="2.6" fill={PLUM} />
    <path d="M-1-6V14" stroke="#7d5fa6" strokeWidth="1.8" strokeLinecap="round" />
  </g>;
});
const PerchWingArt = memo(function PerchWingArt({ hind }: { hind?: boolean }) {
  return hind ? <><path className="bf-hind" d={HIND_D} /><circle className="bf-spot" cx={HIND_SPOT.x} cy={HIND_SPOT.y} r={HIND_SPOT.r} /></>
    : <><path className="bf-fore" d={FORE_D} /><circle className="bf-spot" cx={FORE_SPOT.x} cy={FORE_SPOT.y} r={FORE_SPOT.r} /><circle cx={SHINE.x} cy={SHINE.y} r={SHINE.r} fill="#fff" opacity=".85" /></>;
});
/**
 * The hero butterfly perched front-on on the tip of her nose, its wings raised in a V over her forehead and
 * bangs (the same art as in flight), so she can go cross-eyed at it with both pupils in view. The wings rise
 * as it lands, then slowly open and close (the scene sets each wing group's rotation).
 */
const PerchedButterfly = memo(function PerchedButterfly() {
  const half = (side: string) => <>
    <g data-part={`perch-hind-${side}`} transform={`scale(${PERCH.scale})`}><PerchWingArt hind /></g>
    <g data-part={`perch-fore-${side}`} transform={`scale(${PERCH.scale})`}><PerchWingArt /></g>
  </>;
  return <svg className="fairy-hero-perch" data-part="hero-perch" viewBox={`${PERCH_BOX.x} ${PERCH_BOX.y} ${PERCH_BOX.w} ${PERCH_BOX.h}`} aria-hidden="true" style={{ display: 'none' }}>
    <g transform={`translate(0 ${PERCH.rootY})`}>
      {half('l')}
      <g transform="scale(-1 1)">{half('r')}</g>
      <PerchBody />
    </g>
  </svg>;
});

// ---------------------------------------------------------------------------
// Measurement: one read pass and one write pass over the fairy covers.
// ---------------------------------------------------------------------------

const COVER_SELECTOR = '.reveal-cover[data-reveal-effect="fairy"]';

/** A cover's rect, from the positional properties measureRevealCovers() already wrote (no forced layout). */
function coverRect(cover: HTMLElement): FairyRect {
  const read = (name: string) => Number.parseFloat(cover.style.getPropertyValue(name));
  const rect = { left: read('--reveal-cover-left'), top: read('--reveal-cover-top'), width: read('--reveal-cover-width'), height: read('--reveal-cover-height') };
  if (Object.values(rect).every(Number.isFinite)) return rect;
  const r = cover.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

const fairyCovers = () => Array.from(document.querySelectorAll<HTMLElement>(COVER_SELECTOR));

/** The band the set-up covers were timed against (stored on each of them), if any. */
function storedBand(covers: readonly HTMLElement[]): FairyBand | undefined {
  for (const cover of covers) {
    const v = cover.dataset.fairyBand?.split(',').map(Number);
    if (v && v.length === 4 && v.every(Number.isFinite)) return { left: v[0], right: v[1], top: v[2], bottom: v[3] };
  }
  return undefined;
}
const layoutOf = (covers: HTMLElement[], band: FairyBand | undefined) =>
  fairyLayout(covers.map(coverRect), Math.max(1, window.innerWidth), Math.max(1, window.innerHeight), band);

/** The Stage listens here, so a late cover or a resize re-reads the layout. */
const layoutListeners = new Set<() => void>();

/**
 * Measure the covers (the shared pass, when needed), compute the layout and
 * write each cover's timing inputs in one pass. The cover animations are gated
 * on data-fairy-tint, so they are created once, with their final timing.
 * Covers that mount later are timed against the stored band and only they are
 * written, so animations already running never jump. `refresh` (a resize)
 * re-measures everything.
 */
export function measureFairyLayout(refresh = false): FairyLayout {
  if (refresh || fairyCovers().some((cover) => !cover.dataset.revealMeasured)) measureRevealCovers();
  const covers = fairyCovers();
  const band = refresh ? undefined : storedBand(covers.filter((cover) => cover.dataset.fairyTint));
  const layout = layoutOf(covers, band);
  const bandValue = [layout.band.left, layout.band.right, layout.band.top, layout.band.bottom].map((v) => v.toFixed(1)).join(',');
  covers.forEach((cover, index) => {
    if (band && cover.dataset.fairyTint) return;
    const timing = layout.covers[index];
    cover.style.setProperty('--fairy-band-x', timing.bandX.toFixed(4));
    cover.style.setProperty('--fairy-focus-dy', timing.focusDy.toFixed(4));
    cover.dataset.fairyBand = bandValue;
    cover.dataset.fairyTint = String(timing.tint);
    if (timing.dense) cover.dataset.fairyDense = 'true'; else delete cover.dataset.fairyDense;
  });
  layoutListeners.forEach((listener) => listener());
  return layout;
}

/** The layout, measuring only if some cover has not been set up yet. */
function currentFairyLayout(): FairyLayout {
  const covers = fairyCovers();
  return covers.some((cover) => !cover.dataset.fairyTint) ? measureFairyLayout() : layoutOf(covers, storedBand(covers));
}

function useFairyLayout(): FairyLayout | null {
  const [layout, setLayout] = useState<FairyLayout | null>(null);
  useLayoutEffect(() => {
    // Measure before the first paint; re-read whenever covers are (re)set up.
    const update = (read: () => FairyLayout) => setLayout(read());
    update(currentFairyLayout);
    const reread = () => update(() => { const covers = fairyCovers(); return layoutOf(covers, storedBand(covers)); });
    const onResize = () => measureFairyLayout(true);
    layoutListeners.add(reread);
    window.addEventListener('resize', onResize);
    return () => { layoutListeners.delete(reread); window.removeEventListener('resize', onResize); };
  }, []);
  return layout;
}

// ---------------------------------------------------------------------------
// The scene. Its DOM is built once per layout (the art, and a fixed set of
// magic shapes); every frame the rig below only writes transforms, opacities
// and path data into it, so no React elements are made while it plays.
// ---------------------------------------------------------------------------

/** Chunky rounded digits drawn as strokes, so they look the same on every system. Box: 100 units tall. */
const DIGITS: Record<string, string> = {
  1: 'M-16-28 4-46V46M-18 46H24',
  2: 'M-26-22C-26-46 26-50 26-20C26 4-18 20-28 46H28',
  3: 'M-24-36C-8-52 26-46 24-20C22-4 6-2-4-2C10-2 28 6 26 26C24 50-12 52-28 36',
};
const DigitArt = ({ digit, grey = false }: { digit: string; grey?: boolean }) => <g data-part={`digit-${digit}`} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'none' }}>
  <path d={DIGITS[digit]} stroke={grey ? '#8f84a3' : '#b77900'} strokeWidth="30" />
  <path d={DIGITS[digit]} stroke={grey ? '#cfc6dc' : '#ffd23f'} strokeWidth="18" />
  {!grey && <path d={DIGITS[digit]} stroke="#fff6c4" strokeWidth="5" transform="translate(-3 -4)" opacity=".8" />}
</g>;

/** Sparkles are drawn batched: one path per colour, each 4-point star already placed in screen px. */
const SPARKLE_COLORS = ['#ffd23f', '#fff3b0', '#ff8fc8', '#b995ff', '#7fe0ff', '#ffffff'] as const;
const BURST_COLORS = ['#ffd23f', '#ff8fc8', '#b995ff', '#7fe0ff'] as const;
type Sparkle = { x: number; y: number; size: number; turn: number; color: string };
const STAR4_PTS = [[0, -10], [1.5, -1.5], [10, 0], [1.5, 1.5], [0, 10], [-1.5, 1.5], [-10, 0], [-1.5, -1.5]] as const;
/** A 4-point star (STAR4, 20 units across at size 20) placed at (x, y), `size` px from centre to tip, turned `turn` degrees. */
function star4(x: number, y: number, size: number, turn: number): string {
  const k = size / 10, a = turn * Math.PI / 180, c = Math.cos(a) * k, s = Math.sin(a) * k;
  const p = STAR4_PTS.map(([px, py]) => `${(x + px * c - py * s).toFixed(1)} ${(y + px * s + py * c).toFixed(1)}`);
  return `M${p[0]}Q${p[1]} ${p[2]}Q${p[3]} ${p[4]}Q${p[5]} ${p[6]}Q${p[7]} ${p[0]}Z`;
}
const SparkleBatch = ({ prefix }: { prefix: string }) => <g stroke="#fff" strokeWidth="1" strokeLinejoin="round">
  {SPARKLE_COLORS.map((color, i) => <path key={color} data-part={`${prefix}-${i}`} fill={color} style={{ display: 'none' }} />)}
</g>;

type Anchors = { pulses: Point[]; fizzle: Point; bling: Point; hover: Point };

/**
 * The ribbon's gradients, drawn once: chunk k always spans the same stretch of the ribbon (so the same colours),
 * and runs along one of four bounding-box diagonals, so each frame only swaps which one a chunk uses.
 */
const RibbonDefs = memo(function RibbonDefs({ id }: { id: string }) {
  const grads: ReactNode[] = [];
  for (let k = 0; k < RIBBON_CHUNKS; k++) {
    const u0 = k / RIBBON_CHUNKS, u1 = (k + 1) / RIBBON_CHUNKS;
    for (const dir of RIBBON_DIRS) {
      const axis = { x1: dir[1] === 'e' ? 0 : 1, x2: dir[1] === 'e' ? 1 : 0, y1: dir[0] === 's' ? 0 : 1, y2: dir[0] === 's' ? 1 : 0 };
      grads.push(<linearGradient key={`e${k}${dir}`} id={`${id}-re${k}${dir}`} {...axis}><stop offset="0" stopColor={ribbonEdgeColor(u0)} /><stop offset="1" stopColor={ribbonEdgeColor(u1)} /></linearGradient>);
      grads.push(<linearGradient key={`f${k}${dir}`} id={`${id}-rf${k}${dir}`} {...axis}><stop offset="0" stopColor={ribbonFillColor(u0)} /><stop offset="1" stopColor={ribbonFillColor(u1)} /></linearGradient>);
    }
  }
  return <defs>{grads}</defs>;
});

/** The ribbon: opaque chunks, tail first, each an edge outline under its fill; one group opacity for the whole ribbon. */
const RIBBON_ORDER = Array.from({ length: RIBBON_CHUNKS }, (_, i) => RIBBON_CHUNKS - 1 - i);
/** Behind the fairy: ribbon, BLING glow, rays, core sparkle, shockwave and glitter. */
const BackMagicDom = memo(function BackMagicDom({ id, vw, vh }: { id: string; vw: number; vh: number }) {
  const hidden = { display: 'none' };
  return <svg className="fairy-magic" width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} aria-hidden="true">
    <RibbonDefs id={id} />
    <g data-part="ribbon" style={hidden}>
      {RIBBON_ORDER.map((k) => <g key={k}><path data-part={`re${k}`} style={hidden} /><path data-part={`rf${k}`} style={hidden} /></g>)}
      <path data-part="rh" fill="#fffbe6" opacity=".9" style={hidden} />
    </g>
    <g data-part="rays" style={hidden}>
      <circle data-part="rays-glow" fill={`url(#${id}-glow)`} />
      <path data-part="rays-path" fill="#ffcf33" stroke="#fffbe6" strokeLinejoin="round" />
    </g>
    <path data-part="core" d={STAR4} fill="#fffbe6" style={hidden} />
    <circle data-part="ring-a" fill="none" stroke="#ffcf33" style={hidden} />
    <circle data-part="ring-b" fill="none" stroke="#ffffff" style={hidden} />
    <SparkleBatch prefix="glitter" />
  </svg>;
});

/** The puzzled beat's smoke wisp: a little grey curl that rises off the dead star (units: px at W = 288). */
const WispArt = () => <g data-part="wisp" style={{ display: 'none' }} strokeLinecap="round" fill="none">
  <path d="M0 0C-8-6-8-14 0-19S8-31 0-37" stroke="#7d7292" strokeWidth="6" />
  <path d="M0 0C-8-6-8-14 0-19S8-31 0-37" stroke="#e2dcea" strokeWidth="2.6" />
  <circle cx="2" cy="-43" r="6" fill="#e2dcea" stroke="#7d7292" strokeWidth="2" />
  <circle cx="-5" cy="-49" r="3.6" fill="#e2dcea" stroke="#7d7292" strokeWidth="1.8" />
</g>;

/** In front of the fairy: count rings and digits, the fizzle's "3", puff and wisp, tap rings, and every sparkle. */
const FrontMagicDom = memo(function FrontMagicDom({ vw, vh, columns }: { vw: number; vh: number; columns: number }) {
  const hidden = { display: 'none' };
  return <svg className="fairy-magic is-front" width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} aria-hidden="true">
    <circle data-part="pulse-ring-0" fill="none" stroke="#ffe27a" style={hidden} />
    <circle data-part="pulse-ring-1" fill="none" stroke="#ffe27a" style={hidden} />
    <DigitArt digit="1" /><DigitArt digit="2" /><DigitArt digit="3" grey />
    <g data-part="puff" fill="#e7e0ef" stroke="#b3a6c7" style={hidden}>
      <circle cx="-17" cy="0" r="20" /><circle cx="14" cy="-6" r="26" /><circle cx="-3" cy="-23" r="19" /><circle cx="-9" cy="-9" r="14" stroke="none" />
    </g>
    <WispArt />
    {Array.from({ length: columns }, (_, i) => <circle key={i} data-part={`tap-ring-${i}`} fill="none" stroke="#ffe68a" style={hidden} />)}
    <SparkleBatch prefix="spark" />
  </svg>;
});

const px = (value: number) => `${value.toFixed(2)}px`;
const f1 = (value: number) => value.toFixed(1);
const f3 = (value: number) => value.toFixed(3);

/**
 * Writes one frame into the scene's DOM. It keeps the last value it wrote for every attribute and style, so an
 * unchanged value is never written again (the art layers only move; their drawings are never touched).
 */
class FairyRig {
  private readonly parts = new Map<string, HTMLElement | SVGElement>();
  private readonly written = new Map<string, string>();
  private face: FairyFace | null = null;
  private grey: boolean | null = null;

  constructor(root: HTMLElement, private readonly L: FairyLayout, private readonly id: string, private readonly anchors: Anchors) {
    for (const el of root.querySelectorAll<HTMLElement | SVGElement>('[data-part]')) this.parts.set(el.dataset.part ?? '', el);
    this.parts.set('scene', root);
  }

  private attr(part: string, name: string, value: string) {
    const key = `${part}@${name}`;
    if (this.written.get(key) === value) return;
    this.written.set(key, value);
    this.parts.get(part)?.setAttribute(name, value);
  }
  private css(part: string, prop: string, value: string) {
    const key = `${part}:${prop}`;
    if (this.written.get(key) === value) return;
    this.written.set(key, value);
    this.parts.get(part)?.style.setProperty(prop, value);
  }
  private show(part: string, visible: boolean) { this.css(part, 'display', visible ? '' : 'none'); }
  /** A batch of sparkles, one path per colour. */
  private sparkles(prefix: string, list: readonly Sparkle[]) {
    SPARKLE_COLORS.forEach((color, i) => {
      let d = '';
      for (const s of list) if (s.color === color && s.size > 0.3) d += star4(s.x, s.y, s.size, s.turn);
      this.show(`${prefix}-${i}`, d !== '');
      if (d) this.attr(`${prefix}-${i}`, 'd', d);
    });
  }

  draw(t: number) {
    const { sceneFade: [f0, f1End], bling: b } = FAIRY;
    this.css('scene', 'opacity', f3(1 - smooth(progress(t, f0, f1End))));
    // Full-screen light: a soft violet vignette during the count, a warm flash on the BLING.
    const spot = 0.1 * smooth(progress(t, 0.8, 1.05)) * (1 - smooth(progress(t, b, b + 0.1)));
    const flash = 0.75 * (t < b ? 0 : 1 - smooth(progress(t, b + 0.02, b + 0.34)));
    this.show('spot', spot > 0.002);
    if (spot > 0.002) this.css('spot', 'opacity', f3(spot));
    this.show('flash', flash > 0.002);
    if (flash > 0.002) this.css('flash', 'opacity', f3(flash));
    this.drawBack(t);
    this.drawActor(t);
    this.drawHero(t);
    this.drawFront(t);
  }

  private drawActor(t: number) {
    const L = this.L;
    const pose = fairyPose(t, L);
    this.css('actor', 'transform', `translate3d(${px(pose.x)}, ${px(pose.y)}, 0) rotate(${pose.rotate.toFixed(2)}deg) scale(${(pose.flip * pose.scale * pose.sx).toFixed(4)}, ${(pose.scale * pose.sy).toFixed(4)})`);
    const b = FAIRY.bling;
    // Her glow lifts her off the covered cards while she performs the count; once she sets off over the revealed
    // names it dims to a faint halo, so it never washes out the names next to her.
    const glow = 0.7 - 0.44 * smooth(progress(t, FAIRY.anticipation[0], FAIRY.sweepT0 + 0.12));
    this.css('aura', 'opacity', f3((glow + 0.3 * bump(t, b, b + 0.06, b + 0.4)) * (pose.star.grey ? 0.3 : 1) * smooth(progress(t, 0.3, 0.6))));
    this.attr('wings', 'class', `fairy-wings is-${pose.wings}`);
    this.css('wings', 'transform', pose.spread < 1 ? `scaleX(${pose.spread.toFixed(3)})` : 'none');
    this.css('skirt', 'transform', `rotate(${pose.skirt.toFixed(2)}deg)`);
    this.css('head', 'transform', `rotate(${pose.head.toFixed(2)}deg)`);
    this.css('arm', 'transform', `rotate(${pose.arm.toFixed(2)}deg)`);
    this.css('wand', 'transform', `rotate(${pose.wrist.toFixed(2)}deg)`);
    this.css('star', 'transform', `rotate(${pose.star.spin.toFixed(1)}deg) scale(${pose.star.scale.toFixed(3)})`);
    if (pose.face !== this.face) {
      for (const face of FACE_NAMES) this.show(`face-${face}`, face === pose.face);
      this.face = pose.face;
    }
    if (pose.star.grey !== this.grey) {
      this.show('star-gold', !pose.star.grey);
      this.show('star-grey', pose.star.grey);
      this.grey = pose.star.grey;
    }
  }

  private drawHero(t: number) {
    const L = this.L, W = L.W;
    const hero = heroButterfly(t, L);
    const visible = !!hero && hero.opacity > 0 && hero.scale > 0.001;
    this.show('hero', visible);
    if (!hero || !visible) return;
    // Flying: centred on its body. Perched: the perch box, pinned (and popped and tilted) about the tip of her nose.
    const w = hero.perched ? PERCH_BOX.w / 330 * W : HERO_FLY_W * W * hero.size;
    const h = hero.perched ? PERCH_BOX.h / 330 * W : 0.8 * w;
    const ox = hero.perched ? -PERCH_BOX.x / PERCH_BOX.w : 0.5, oy = hero.perched ? -PERCH_BOX.y / PERCH_BOX.h : 0.5;
    this.css('hero', 'width', px(w));
    this.css('hero', 'height', px(h));
    this.css('hero', 'opacity', f3(hero.opacity));
    this.css('hero', 'transform-origin', `${(100 * ox).toFixed(2)}% ${(100 * oy).toFixed(2)}%`);
    this.css('hero', 'transform', `translate3d(${px(hero.x - w * ox)}, ${px(hero.y - h * oy)}, 0) rotate(${hero.tilt.toFixed(1)}deg) scale(${hero.scale.toFixed(3)})`);
    this.show('hero-fly', !hero.perched);
    this.show('hero-perch', hero.perched);
    if (hero.perched) {
      for (const side of ['l', 'r']) {
        this.attr(`perch-hind-${side}`, 'transform', `rotate(${hero.hind.toFixed(1)}) scale(${PERCH.scale})`);
        this.attr(`perch-fore-${side}`, 'transform', `rotate(${hero.fore.toFixed(1)}) scale(${PERCH.scale})`);
      }
    }
  }

  private drawBack(t: number) {
    const L = this.L, { vw, vh, W } = L, id = this.id;
    const s = W / 288;
    const b = FAIRY.bling;
    // The ribbon: tail-first chunks with fixed gradients.
    const ribbon = fairyRibbon(t, L);
    const on = ribbon.opacity > 0 && ribbon.pts.length >= 2;
    this.show('ribbon', on);
    if (on) {
      const { chunks, highlight } = ribbonShape(ribbon.pts);
      for (let k = 0; k < RIBBON_CHUNKS; k++) {
        const c = chunks.find((chunk) => chunk.k === k);
        this.show(`re${k}`, !!c);
        this.show(`rf${k}`, !!c);
        if (!c) continue;
        this.attr(`re${k}`, 'd', c.edge);
        this.attr(`re${k}`, 'fill', `url(#${id}-re${k}${c.dir})`);
        this.attr(`rf${k}`, 'd', c.fill);
        this.attr(`rf${k}`, 'fill', `url(#${id}-rf${k}${c.dir})`);
      }
      this.show('rh', !!highlight);
      if (highlight) this.attr('rh', 'd', highlight);
      this.attr('ribbon', 'opacity', f3(0.92 * ribbon.opacity));
    }
    // BLING: rays and glow ride the re-lit star; a bright core sparkle bursts behind it; the shockwave stays where it re-lit.
    const rays = t >= b && t < b + BLING_RAYS_S;
    this.show('rays', rays);
    const c = rays ? fairyStarPoint(t, L) : this.anchors.bling;
    if (rays) {
      const length = 0.8 * W * easeOutCubic(progress(t, b, b + 0.12));
      const half = 0.035 * W;
      let d = '';
      for (let i = 0; i < 8; i++) {
        const a = (i * 45 + 40 * (t - b)) * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
        const r = length * (i % 2 ? 0.72 : 1);
        const at = (x: number, y: number) => `${f1(c.x + x * cos - y * sin)} ${f1(c.y + x * sin + y * cos)}`;
        d += `M${at(-half, 0)}L${at(0, -r)}L${at(half, 0)}Z`;
      }
      this.attr('rays-path', 'd', d);
      this.attr('rays-path', 'stroke-width', f1(3 * s));
      this.attr('rays-path', 'opacity', f3(0.9 * (1 - smooth(progress(t, b + 0.14, b + BLING_RAYS_S)))));
      this.attr('rays-glow', 'cx', f1(c.x));
      this.attr('rays-glow', 'cy', f1(c.y));
      this.attr('rays-glow', 'r', f1(0.34 * W * easeOutCubic(progress(t, b, b + 0.1))));
      this.attr('rays-glow', 'opacity', f3(1 - smooth(progress(t, b + 0.08, b + BLING_RAYS_S))));
    }
    const core = t >= b && t < b + 0.22 ? progress(t, b, b + 0.22) : -1;
    this.show('core', core >= 0);
    // 'blingcore': behind the star, so the re-lit star itself reads saturated gold.
    if (core >= 0) {
      this.attr('core', 'transform', `translate(${f1(c.x)} ${f1(c.y)}) rotate(${(45 + 90 * core).toFixed(0)}) scale(${(0.03 * W * Math.sin(Math.PI * core)).toFixed(3)})`);
      this.attr('core', 'opacity', f3(1 - core * 0.4));
    }
    const rings = t >= b && t < b + BLING_RING_S;
    this.show('ring-a', rings);
    this.show('ring-b', rings);
    if (rings) {
      const o = this.anchors.bling, reach = Math.max(vw, vh);
      const ring = progress(t, b, b + BLING_RING_S), inner = progress(t, b + 0.04, b + BLING_RING_S);
      for (const [part, radius, width, opacity] of [
        ['ring-a', 0.55 * reach * easeOutCubic(ring), (10 - 8 * ring) * s, 0.8 * (1 - ring)],
        ['ring-b', 0.4 * reach * easeOutCubic(inner), 4 * s, 0.7 * (1 - inner)],
      ] as const) {
        this.attr(part, 'cx', f1(o.x)); this.attr(part, 'cy', f1(o.y)); this.attr(part, 'r', f1(radius));
        this.attr(part, 'stroke-width', f1(width)); this.attr(part, 'opacity', f3(opacity));
      }
    }
    this.sparkles('glitter', fairyGlitter(t, L));
  }

  private drawFront(t: number) {
    const L = this.L, { vw, vh, W } = L, a = this.anchors;
    const s = W / 288;
    const fz = FAIRY.fizzle;
    const sparks: Sparkle[] = [];
    // B0: a single gold glint twinkles where she will appear.
    if (t >= FAIRY.glint[0] && t < FAIRY.glint[1]) {
      const k = Math.sin(Math.PI * progress(t, FAIRY.glint[0], FAIRY.glint[1]));
      sparks.push({ x: 0.03 * vw, y: a.hover.y - 0.04 * vh, size: 26 * s * k, turn: 180 * t, color: '#ffd23f' });
    }
    // "One", "two": a digit pops above the pumping star with a ripple ring, floats up and pops away.
    FAIRY.pulses.forEach((start, index) => {
      const life = 0.4;
      const live = t >= start && t < start + life;
      this.show(`pulse-ring-${index}`, live);
      this.show(`digit-${index + 1}`, live);
      if (!live) return;
      const c = a.pulses[index];
      const p = progress(t, start, start + life);
      const ring = easeOutCubic(progress(t, start, start + 0.32));
      this.attr(`pulse-ring-${index}`, 'cx', f1(c.x)); this.attr(`pulse-ring-${index}`, 'cy', f1(c.y));
      this.attr(`pulse-ring-${index}`, 'r', f1((10 + (index ? 52 : 38) * ring) * s));
      this.attr(`pulse-ring-${index}`, 'stroke-width', f1((4.5 * (1 - p) + 1) * s));
      this.attr(`pulse-ring-${index}`, 'opacity', f3(1 - p));
      const size = 0.2 * W * easeOutBack(progress(t, start, start + 0.16), 2.4) * keyframes(t, [[start + 0.22, 1], [start + 0.28, 1.1], [start + life, 0]]);
      this.attr(`digit-${index + 1}`, 'transform', `translate(${f1(c.x + 0.02 * W)} ${f1(c.y - 0.25 * W - p * 0.06 * W)}) rotate(${index ? 6 : -6}) scale(${(size / 100).toFixed(3)})`);
    });
    // The third pulse fizzles: a droopy grey "3" tips over and shrinks away, a puff pops and shrinks as it rises.
    const three = t >= fz && t < fz + 0.33;
    this.show('digit-3', three);
    if (three) {
      const c = a.fizzle;
      const p = progress(t, fz, fz + 0.3);
      const size = 0.19 * W * easeOutBack(progress(t, fz, fz + 0.14), 1.8) * (1 - easeInCubic(progress(t, fz + 0.2, fz + 0.33)));
      const tip = 28 * easeOutBack(progress(t, fz + 0.07, fz + 0.24), 2);
      this.attr('digit-3', 'transform', `translate(${f1(c.x - 0.02 * W)} ${f1(c.y - 0.24 * W + p * 0.07 * W)}) rotate(${tip.toFixed(1)}) scale(${(size / 100).toFixed(3)})`);
    }
    const puffOn = t >= fz && t < fz + 0.34;
    this.show('puff', puffOn);
    if (puffOn) {
      const c = a.fizzle;
      const p = progress(t, fz, fz + 0.3);
      const puff = Math.min(1.1, easeOutBack(progress(t, fz, fz + 0.16), 2.2)) * (1 - easeInCubic(progress(t, fz + 0.16, fz + 0.34)));
      this.attr('puff', 'transform', `translate(${f1(c.x + 0.02 * W)} ${f1(c.y - 0.1 * W * p)}) scale(${(puff * s).toFixed(3)})`);
      this.attr('puff', 'stroke-width', f1(2.5 / Math.max(0.2, puff)));
    }
    // "Huh?": while she peers at the dead star, a little grey wisp curls up off it, then shrinks away before the shake.
    const pop = lookStarPop(t);
    const [l0] = FAIRY.look, s0 = FAIRY.shake[0];
    const wisp = t >= l0 + 0.1 && t < s0 ? Math.min(1, easeOutBack(progress(t, l0 + 0.1, l0 + 0.24), 1.4)) * (1 - easeInCubic(progress(t, s0 - 0.1, s0))) : 0;
    this.show('wisp', wisp > 0.01);
    if (wisp > 0.01) {
      const c = fairyStarPoint(t, L);
      const top = (18.4 * 1.2 * (0.8 + (LOOK_STAR_SCALE - 0.8) * pop) + 2) * L.unit;
      const rise = 0.035 * W * progress(t, l0 + 0.1, s0);
      this.attr('wisp', 'transform', `translate(${f1(c.x)} ${f1(c.y - top - rise)}) rotate(${(6 * Math.sin(Math.PI * 2 * 2.2 * (t - l0))).toFixed(1)}) scale(${(wisp * s).toFixed(3)})`);
    }
    // The shake: tiny gold sparks sputter from the star, and shrink as they fly.
    [0.05, 0.12, 0.19].forEach((offset, i) => {
      const at = FAIRY.shake[0] + offset;
      if (t < at || t >= at + 0.14) return;
      const c = fairyStarPoint(at, L);
      const p = progress(t, at, at + 0.14);
      for (let k = 0; k < 3; k++) {
        const angle = (-90 + (k - 1) * 50 + i * 17) * Math.PI / 180;
        const r = 0.1 * W * easeOutCubic(p);
        sparks.push({ x: c.x + Math.cos(angle) * r, y: c.y + Math.sin(angle) * r, size: 11 * s * (1 - p * 0.6) * (1 - p * p), turn: 90 * p, color: k === 1 ? '#fff3b0' : '#ffd23f' });
      }
    });
    // Each tap throws a ring and a circle of mini stars from the tap point; the stars shrink away.
    L.columns.forEach((col, ci) => {
      const p = progress(t, col.tap, col.tap + TAP_BURST_S);
      const live = t >= col.tap && p < 1;
      this.show(`tap-ring-${ci}`, live);
      if (!live) return;
      this.attr(`tap-ring-${ci}`, 'cx', f1(col.x)); this.attr(`tap-ring-${ci}`, 'cy', f1(L.tapY));
      this.attr(`tap-ring-${ci}`, 'r', f1(0.16 * W * easeOutCubic(p)));
      this.attr(`tap-ring-${ci}`, 'stroke-width', f1(3 * s * (1.4 - p)));
      this.attr(`tap-ring-${ci}`, 'opacity', f3(1 - p));
      const r = 0.19 * W * easeOutCubic(p);
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4 + p + ci;
        sparks.push({ x: col.x + Math.cos(angle) * r, y: L.tapY + Math.sin(angle) * r, size: 0.045 * W * (1 - 0.4 * p) * (p < 0.5 ? 1 : 2 - 2 * p), turn: p * 120, color: BURST_COLORS[i % 4] });
      }
    });
    this.sparkles('spark', sparks);
  }
}

/**
 * The whole scene at `time` (s) if given (the lab and tests can pin any exact story time), else playing on its
 * own scene clock (like useSceneTime: it starts when the Stage mounts; unmounting cancels the frame).
 */
export function FairyScene({ time, layout: L }: { time?: number; layout: FairyLayout }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const root = useRef<HTMLDivElement>(null);
  const rig = useRef<FairyRig | null>(null);
  const clock = useRef(time ?? 0);
  const anchors = useMemo<Anchors>(() => ({
    pulses: FAIRY.pulses.map((at) => fairyStarPoint(at, L)),
    fizzle: fairyStarPoint(FAIRY.fizzle + 0.02, L),
    bling: fairyStarPoint(FAIRY.bling, L),
    hover: L.hover,
  }), [L]);
  // Static full-screen light layers: only their opacity changes per frame. The count spotlight is a
  // soft violet vignette that leaves the middle of the room clear; the BLING is a warm flash.
  const lights = useMemo(() => {
    const reach = Math.max(L.vw, L.vh);
    return {
      spot: { background: `radial-gradient(circle at ${px(L.hover.x)} ${px(L.hover.y - 0.1 * L.W)}, #4a2a7a00 0, #4a2a7a00 ${px(1.2 * L.W)}, #4a2a7a ${px(1.05 * reach)})`, display: 'none' },
      flash: { background: `radial-gradient(circle at ${px(anchors.bling.x)} ${px(anchors.bling.y)}, #fffdf0 0, #fff4b8e6 ${px(0.25 * L.W)}, #ffe9a066 ${px(0.3 * reach)}, #ffe9a000 ${px(0.65 * reach)})`, display: 'none' },
    };
  }, [L, anchors]);
  // A new layout (a resize, a late card) builds a new rig over the new DOM and redraws the current moment.
  useLayoutEffect(() => {
    if (!root.current) return;
    rig.current = new FairyRig(root.current, L, id, anchors);
    rig.current.draw(clock.current);
  }, [L, id, anchors]);
  // Pinned time: draw exactly that moment.
  useLayoutEffect(() => {
    if (time === undefined) return;
    clock.current = time;
    rig.current?.draw(time);
  }, [time]);
  // Scene clock.
  const playing = time === undefined;
  useEffect(() => {
    if (!playing) return;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = Math.min(FAIRY_DURATION_MS, now - started);
      clock.current = elapsed / 1000;
      rig.current?.draw(clock.current);
      if (elapsed < FAIRY_DURATION_MS) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  // Big tables keep the wing gloss still (a static highlight) to save work.
  const gloss = L.covers.length <= 20;
  const W = L.W;
  const actorBox: CSSProperties = { width: W, height: W, left: -W * 165 / 330, top: -W * 200 / 330, transform: `translate3d(${px(-2 * W)}, 0, 0)` };
  return <div ref={root} className="fairy-scene">
    <FairyDefs id={id} />
    <div className="fairy-light" data-part="spot" style={lights.spot} />
    <div className="fairy-light" data-part="flash" style={lights.flash} />
    <BackMagicDom id={id} vw={L.vw} vh={L.vh} />
    <div className="fairy-actor" data-part="actor" style={actorBox}>
      <div className="fairy-aura" data-part="aura" />
      <div className="fairy-wings is-flutter" data-part="wings">
        <div className="fairy-wing is-left"><WingArt id={id} />{gloss && <WingGloss />}</div>
        <div className="fairy-wing is-right"><WingArt id={id} mirrored />{gloss && <WingGloss />}</div>
      </div>
      <div className="fairy-skirt" data-part="skirt"><SkirtArt id={id} /></div>
      <BodyArt id={id} />
      <div className="fairy-head" data-part="head"><HeadArt id={id} /></div>
      {/* The wand arm paints in front of her head, so the stick and star always read against the room. */}
      <div className="fairy-arm" data-part="arm">
        <ArmArt />
        <div className="fairy-wand" data-part="wand">
          <WandArt />
          <div className="fairy-star" data-part="star"><StarArt id={id} /></div>
        </div>
        <HandArt />
      </div>
    </div>
    <div className="fairy-hero" data-part="hero" style={{ display: 'none' }}>
      <div className="fairy-hero-fly" data-part="hero-fly"><ButterflyParts /></div>
      <PerchedButterfly />
    </div>
    <FrontMagicDom vw={L.vw} vh={L.vh} columns={L.columns.length} />
  </div>;
}

function FairyStage() {
  const layout = useFairyLayout();
  return layout ? <FairyScene layout={layout} /> : null;
}

// ---------------------------------------------------------------------------
// Cover: CSS keyframes only. The sheet, petals, bud and bloom stay inside the
// card (so scrolling tables still clip them); the butterflies fly from a fixed
// layer so they can leave the card and the table's scroll box.
// ---------------------------------------------------------------------------

const PIECES = ['tl', 'tr', 'bl', 'br'] as const;
const Petals = () => <>{PIECES.map((piece) => <div key={piece} className={`fairy-cover-piece is-${piece}`}><div className="fairy-cover-petal" /></div>)}</>;
const CoverButterfly = ({ which }: { which: 'a' | 'b' }) => <div className={`fairy-bfly is-${which}`}><i className="fairy-bfly-wing is-left" /><i className="fairy-bfly-wing is-right" /></div>;

const FairyCoverArt = memo(function FairyCoverArt() {
  return <>
    <div className="fairy-cover">
      <div className="fairy-cover-sheet" />
      {/* At the tap the four petals whirl into the bloom, like a pinwheel. */}
      <div className="fairy-cover-petals"><Petals /></div>
      <div className="fairy-cover-question"><span>?</span></div>
      {/* The flash burns behind the bud and the bloom, so the flower always reads crisp and saturated. */}
      <div className="fairy-cover-flash" />
      <div className="fairy-cover-bud-hop"><div className="fairy-cover-bud-grow"><div className="fairy-cover-bud" /></div></div>
      <div className="fairy-cover-bloom" />
    </div>
    {/* The butterflies fly from a fixed layer, so they can leave the card and a table's scroll box. */}
    <div className="fairy-cover-fly"><CoverButterfly which="a" /><CoverButterfly which="b" /></div>
  </>;
});

/**
 * Covers set themselves up in the same commit (the first one measures them
 * all), so they never depend on the Stage having mounted.
 */
function FairyCover() {
  const probe = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const cover = probe.current?.closest<HTMLElement>(COVER_SELECTOR);
    if (cover && !cover.dataset.fairyTint) measureFairyLayout();
  }, []);
  return <><span ref={probe} hidden /><FairyCoverArt /></>;
}

export const fairyEffect: RevealEffect = {
  id: 'fairy', name: 'Fairy dust',
  description: 'A little fairy counts to three, fizzles, shakes her wand, then taps each card so it blooms into flowers and butterflies.',
  durationMs: FAIRY_DURATION_MS, sound: 'fairy', Stage: FairyStage, Cover: FairyCover,
};
