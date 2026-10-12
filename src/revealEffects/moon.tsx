import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRevealTargets } from './revealTargets';
import type { RevealEffect } from './types';
import { ForegroundPalmsArt, GLINT_PATH, INK, MOON_ART, PadLayerArt, SPARKLE, STAR5, StarsArt, r1, r2 } from './moonArt';
import { APOLLO_ART, AstronautActor, FlagActor, FlagGroundMarks, Footprint, LM_HATCH, LM_SHADOW, LanderLegs } from './apolloIllustration';
import { FrameContext, attr, createFrameBus, css, shown, useFrame, useMoonClock, useNodes } from './moonFrame';
import {
  MOON_ASTRO_TURN, MOON_BEATS, MOON_DURATION_MS, MOON_FAR_REST, MOON_FLAG_POLE, MOON_FLAG_SCALE, MOON_FLAG_SPOT, MOON_FLAG_W, MOON_FLAG_WINDOWS,
  MOON_DISC_FILL, MOON_FOOTPRINTS, MOON_GLINT_SIZE, MOON_GLINT_WORLD, MOON_LM_PIVOT_Y, MOON_NEAR_FINAL, MOON_PAD_PUFF_COUNT, MOON_PAD_UNMOUNT, MOON_PILE_BASE,
  MOON_PREMOUNT, MOON_RIM_STAR, MOON_SKY_EARTH, MOON_SUN, MOON_VENTS, RIG_ORIGIN, moonCamLayer, moonCamPoint, moonCamTransform, moonCaption, moonColumbia,
  moonDeckFlash, moonDepthScale, moonDive, moonDust,
  moonDustStreaks, moonFarCam, moonFit, moonGlobe, moonGroundDrop, moonHatch, moonHopGrains, moonIris, moonIrisCenter, moonIrisLift, moonIrisRadius, moonLanderPose,
  moonLaunchOverlay, moonLegs, moonLmFlameScale, moonLmShadow, moonNearCam, moonPadGlow, moonPadPuffs, moonPopLayout, moonRcsPuffs, moonRigScale,
  moonRocketPose, moonShake, moonSkies, moonSpace, moonStagePoses, moonStructureKey, moonToScreen, moonTrenchFire, moonTwinkleSchedule,
  moonVentWisps, moonViewBox, type MoonFit, type MoonTwinkleTarget,
} from './moonTimeline';
import './moon.css';

/*
 * Saturn V · Moon landing, the storybook rebuild.
 *
 * Layers: CSS skies and stars → a shaken "rig" of compositor layers (pad,
 * globe, far and near ground, sky Earth, palms) around one world SVG that
 * holds only the moving actors → overlays that never shake (CSS keyframes,
 * mounted at T = 0 so the lab can seek them) → an iris clip onto the groups.
 *
 * React renders only the structure (moonStructureKey); per frame, writers
 * registered with useFrame set transforms and a few light opacities (sky,
 * glow, flash, shading, shadows) from the pure timeline. Static art is
 * memoized or hoisted. Nothing solid fades: it shrinks, moves, pops or is
 * switched in one frame (the dive swap).
 */

const deg = (a: number) => a * Math.PI / 180;
/** Hide an HTML layer, or clear the override so it inherits (a hidden parent still hides it). */
const hideHtml = (el: HTMLElement | null, on: boolean) => css(el, 'visibility', on ? '' : 'hidden');
const launchOn = (T: number) => T < MOON_PAD_UNMOUNT;

/** Size of the stage root (the fixed, full-screen reveal layer in the app). */
function useStageSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState(() => ({ w: typeof window === 'undefined' ? 1280 : window.innerWidth, h: typeof window === 'undefined' ? 800 : window.innerHeight }));
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const w = element.clientWidth || window.innerWidth;
      const h = element.clientHeight || window.innerHeight;
      setSize((current) => (current.w === w && current.h === h ? current : { w, h }));
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

// ---------------------------------------------------------------- sprite pools (smoke, dust)
type Sprite = { slot: number; href: string; transform: string };
/**
 * A fixed pool of <use> sprites. Each puff keeps its slot (so its shape is
 * never re-cloned); slots without a live puff are hidden.
 */
const SpritePool = memo(function SpritePool({ size, sprites }: { size: number; sprites: (T: number) => Sprite[] }) {
  const group = useRef<SVGGElement>(null);
  const slots = useMemo(() => Array.from({ length: size }, (_, i) => <use key={i} visibility="hidden" />), [size]);
  useFrame((T) => {
    const nodes = group.current?.children;
    if (!nodes) return;
    const live: (Sprite | undefined)[] = Array.from({ length: size });
    for (const sprite of sprites(T)) live[sprite.slot] = sprite;
    for (let i = 0; i < nodes.length; i++) {
      const sprite = live[i];
      shown(nodes[i], !!sprite);
      if (sprite) { attr(nodes[i], 'href', sprite.href); attr(nodes[i], 'transform', sprite.transform); }
    }
  });
  return <g ref={group}>{slots}</g>;
});
/** Pad puffs keep one draw order (back to front as they are seen mid-launch), so no sprite is re-cloned per frame. */
const PAD_ORDER = (() => {
  const order: number[] = Array.from({ length: MOON_PAD_PUFF_COUNT }, () => 0);
  moonPadPuffs(2.45).forEach((p, rank) => { order[p.id] = rank; });
  return order;
})();
const PAD_SLOTS = MOON_VENTS.length + MOON_PAD_PUFF_COUNT;
function padSprites(T: number): Sprite[] {
  const out: Sprite[] = moonVentWisps(T).map((v) => ({ slot: v.id, href: `#mn-smoke${v.shape}`, transform: `translate(${r1(v.x)} ${r1(v.y)}) scale(${r2(v.flip * v.s)} ${r2(v.s)})` }));
  for (const p of moonPadPuffs(T)) out.push({ slot: MOON_VENTS.length + PAD_ORDER[p.id], href: `#${p.warm ? 'mn-warm' : 'mn-smoke'}${p.shape}`, transform: `translate(${r1(p.x)} ${r1(p.y)}) scale(${r2(p.s * p.flip)} ${r2(p.s)})` });
  return out;
}
const DUST_SLOTS = 24;
function dustSprites(T: number): Sprite[] {
  return moonDust(T, moonLanderPose(T).x).map((p) => ({ slot: p.id, href: `#mn-dust${p.shape}`, transform: `translate(${r1(p.x)} ${r1(p.y)}) scale(${r2(p.s * p.flip)} ${r2(p.s * .56)})` }));
}
const RCS_SLOTS = 4;
function rcsSprites(T: number): Sprite[] {
  return moonRcsPuffs(T).map((p) => ({ slot: p.id, href: '#mn-smoke2', transform: `translate(${r1(p.x)} ${p.y}) scale(${r2(p.dir * p.s)} ${r2(p.s)})` }));
}

// ---------------------------------------------------------------- launch
const Skies = memo(function Skies() {
  const blue = useRef<HTMLDivElement>(null);
  const dawn = useRef<HTMLDivElement>(null);
  const dawnStars = useRef<HTMLDivElement>(null);
  useFrame((T) => {
    const s = moonSkies(T);
    css(blue.current, 'opacity', r2(s.blue)); hideHtml(blue.current, s.blue > 0);
    css(dawn.current, 'opacity', r2(s.dawn)); hideHtml(dawn.current, s.dawn > 0);
    css(dawnStars.current, 'opacity', r2(s.dawn)); hideHtml(dawnStars.current, s.dawn > 0);
  });
  return <>
    <div ref={blue} className="moon-sky moon-blue" />
    <div ref={dawn} className="moon-sky moon-dawn" />
    <div ref={dawnStars} className="moon-stars">{MOON_ART.dawnTwinkles}</div>
  </>;
});
const StarField = memo(function StarField({ viewBox }: { viewBox: string }) {
  const stars = useRef<HTMLDivElement>(null);
  useFrame((T) => { const o = moonSkies(T).stars; css(stars.current, 'opacity', r2(o)); hideHtml(stars.current, o > 0); });
  return <div ref={stars} className="moon-stars"><StarsArt viewBox={viewBox} />{MOON_ART.twinkles}</div>;
});
/**
 * Compositor camera: shake, countdown push-in and release pull-back pivot on
 * the pad; during the iris the whole scene rises with the closing window.
 */
function Rig({ fit, children }: { fit: MoonFit; children: ReactNode }) {
  const rig = useRef<HTMLDivElement>(null);
  const iris = useMemo(() => moonIris(fit), [fit]);
  useFrame((T) => {
    if (T >= 3.4) {
      const lift = moonIrisLift(T, iris);
      css(rig.current, 'transform', lift > 0 ? `translate3d(0, ${r1(-lift)}px, 0)` : 'none');
      return;
    }
    const o = moonToScreen(fit, RIG_ORIGIN.x, RIG_ORIGIN.y);
    const shake = moonShake(T);
    css(rig.current, 'transform-origin', `${r1(o.x)}px ${r1(o.y)}px`);
    css(rig.current, 'transform', `translate3d(${r1(shake.x * fit.k)}px, ${r1(shake.y * fit.k)}px, 0) scale(${moonRigScale(T).toFixed(4)})`);
  });
  return <div ref={rig} className="moon-rig">{children}</div>;
}
const PadLayer = memo(function PadLayer({ fit, viewBox }: { fit: MoonFit; viewBox: string }) {
  const layer = useRef<HTMLDivElement>(null);
  useFrame((T) => {
    hideHtml(layer.current, launchOn(T));
    if (launchOn(T)) css(layer.current, 'transform', `translate3d(0, ${r1(moonGroundDrop(T) * fit.k)}px, 0)`);
  });
  return <div ref={layer} className="moon-layer"><PadLayerArt viewBox={viewBox} /></div>;
});
/** Light, so it may fade: the warm wash over the whole frame and the glow around the pad. */
const PadLight = memo(function PadLight({ fit }: { fit: MoonFit }) {
  const wash = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const at = moonToScreen(fit, 740 - 440, 764 - 170);
  useFrame((T) => {
    const g = Math.min(1, moonPadGlow(T));
    for (const el of [wash.current, glow.current]) { css(el, 'opacity', r2(g)); hideHtml(el, g > 0); }
    if (g > 0) css(glow.current, 'transform', `translate3d(0, ${r1(moonGroundDrop(T) * fit.k)}px, 0)`);
  });
  return <>
    <div ref={wash} className="moon-wash" />
    <div ref={glow} className="moon-padglow" style={{ left: r1(at.x), top: r1(at.y), width: r1(880 * fit.k), height: r1(340 * fit.k) }} />
  </>;
});
const Palms = memo(function Palms({ fit, viewBox }: { fit: MoonFit; viewBox: string }) {
  const layer = useRef<HTMLDivElement>(null);
  useFrame((T) => {
    hideHtml(layer.current, launchOn(T));
    if (launchOn(T)) css(layer.current, 'transform', `translate3d(0, ${r1(moonGroundDrop(T) * 1.3 * fit.k)}px, 0)`);
  });
  return <div ref={layer} className="moon-layer"><ForegroundPalmsArt viewBox={viewBox} /></div>;
});
/** Pad-layer actors in the world SVG ride the falling ground with the same drop. */
function PadGroup({ children }: { children: ReactNode }) {
  const g = useRef<SVGGElement>(null);
  useFrame((T) => {
    shown(g.current, launchOn(T));
    if (launchOn(T)) attr(g.current, 'transform', `translate(0 ${r1(moonGroundDrop(T))})`);
  });
  return <g ref={g}>{children}</g>;
}
const TrenchFire = memo(function TrenchFire() {
  const { nodes: flames, bind: bindflames } = useNodes();
  useFrame((T) => {
    const fire = moonTrenchFire(T);
    [-1, 1].forEach((s, i) => {
      shown(flames[i], !!fire);
      if (fire) attr(flames[i], 'transform', `translate(${740 + s * 170} 806) rotate(${-s * 90}) scale(${r2(.42 * fire.fl)} ${r2(.62 * fire.a * (2 - fire.fl))})`);
    });
  });
  return <g>{[0, 1].map((i) => <g key={i} ref={bindflames(i)} visibility="hidden">{MOON_ART.plume}</g>)}</g>;
});
const PadFront = memo(function PadFront() {
  const hot = useRef<SVGEllipseElement>(null);
  const flash = useRef<SVGGElement>(null);
  const streak = useRef<SVGEllipseElement>(null);
  const streak2 = useRef<SVGEllipseElement>(null);
  useFrame((T) => {
    const g = Math.min(1, moonPadGlow(T));
    shown(hot.current, g > 0); attr(hot.current, 'opacity', r2(g));
    const f = moonDeckFlash(T);
    shown(flash.current, !!f);
    if (f) {
      attr(flash.current, 'opacity', r2(f.f));
      attr(streak.current, 'rx', r1(260 + 520 * f.e));
      attr(streak2.current, 'rx', r1(120 + 220 * f.e));
    }
  });
  return <>
    <SpritePool size={PAD_SLOTS} sprites={padSprites} />
    <ellipse ref={hot} cx="740" cy="769" rx="210" ry="90" fill="url(#mn-hotsmoke)" visibility="hidden" />
    <g ref={flash} visibility="hidden">
      <ellipse cx="740" cy="760" rx="230" ry="70" fill="url(#mn-flash)" />
      <ellipse ref={streak} cx="740" cy="760" ry="4.5" fill="#fffbe8" opacity=".9" />
      <ellipse ref={streak2} cx="740" cy="760" ry="9" fill="#fff3c4" opacity=".7" />
    </g>
  </>;
});
/** A kid-readable "pop!": a bright ring and four little puffs that shrink away. */
const RingPuff = memo(function RingPuff({ y, which }: { y: number; which: 'ring1' | 'ring2' }) {
  const root = useRef<SVGGElement>(null);
  const { nodes: els, bind } = useNodes();
  useFrame((T) => {
    const t = moonStagePoses(T)[which];
    shown(root.current, t !== null);
    if (t === null) return;
    const e = 1 - (1 - t) ** 3;
    const w = Math.sqrt(1 - t);
    const [back, front, ...puffs] = [0, 1, 2, 3, 4, 5].map((i) => els[i]);
    for (const el of [back, front]) { attr(el, 'rx', r1(34 + 90 * e)); attr(el, 'ry', r1(12 + 28 * e)); }
    attr(back, 'stroke-width', r1(18 * w + 1));
    attr(front, 'stroke-width', r1(12 * w));
    [[-1, 0], [1, 0], [-.6, -1], [.6, 1]].forEach(([sx, sy], i) => attr(puffs[i], 'transform', `translate(${r1(sx * (50 + 90 * e))} ${r1(sy * (14 + 26 * e))}) scale(${r2(Math.sign(sx) * (.46 - .12 * e) * w)} ${r2((.46 - .12 * e) * w)})`));
  });
  return <g ref={root} transform={`translate(0 ${y})`} visibility="hidden">
    <ellipse ref={bind(0)} fill="none" stroke="#8f82ad" />
    <ellipse ref={bind(1)} fill="none" stroke="#fffaf0" />
    {[2, 3, 4, 5].map((i) => <use key={i} ref={bind(i)} href="#mn-smoke1" />)}
  </g>;
});
/** The Saturn V: burns and stage separations are transforms on memoized art. */
const SaturnV = memo(function SaturnV() {
  const { nodes: e, bind } = useNodes();
  useFrame((T) => {
    shown(e.root, T < MOON_BEATS.glintCut);
    if (T >= MOON_BEATS.glintCut) return;
    const r = moonRocketPose(T);
    attr(e.root, 'transform', `translate(${r1(r.x)} ${r1(r.y)}) rotate(${r1(r.rot)}) scale(${Math.round(r.s * 1000) / 1000})`);
    const p = moonStagePoses(T);
    const f = p.flicker;
    shown(e.s3, p.s3Burn > 0);
    if (p.s3Burn > 0) attr(e.s3, 'transform', `translate(0 -355) scale(${r2(.51 * f)} ${r2(.74 * p.s3Burn * f)})`);
    shown(e.tower, !!p.tower);
    if (p.tower) {
      attr(e.tower, 'transform', `translate(${r1(p.tower.x)} ${r1(p.tower.y)}) rotate(${r1(p.tower.rot)} 0 -578) translate(0 -578) scale(${r2(p.tower.s)}) translate(0 578)`);
      shown(e.towerFlame, p.tower.flame);
    }
    for (const [key, stage] of [['stage1', p.stage1], ['stage2', p.stage2]] as const) {
      shown(e[key], !!stage);
      if (stage) attr(e[key], 'transform', `translate(${r1(stage.x)} ${r1(stage.y)}) rotate(${r1(stage.rot)} 0 ${stage.pivot}) translate(0 ${stage.pivot}) scale(${r2(stage.s)}) translate(0 ${-stage.pivot})`);
    }
    shown(e.s2, p.s2Burn > 0);
    if (p.s2Burn > 0) attr(e.s2, 'transform', `translate(0 -204) scale(${r2(1.06 * f)} ${r2(1.03 * p.s2Burn * f)})`);
    shown(e.s1, p.s1Burn > 0);
    if (p.s1Burn > 0) attr(e.s1, 'transform', `scale(${r2(.925 * (.94 + .06 * p.s1Burn) * (2 - f))} ${r2(.98 * p.s1Burn * f)})`);
    shown(e.seed, p.seed > 0);
    if (p.seed > 0) attr(e.seed, 'transform', `scale(.65 ${r2(p.seed)})`);
    shown(e.underglow, p.underglow > 0);
    attr(e.underglow, 'opacity', r2(p.underglow));
  });
  return <g ref={bind('root')}>
    <g ref={bind('s3')} visibility="hidden">{MOON_ART.smallPlume}</g>
    {MOON_ART.stageThree}
    <g ref={bind('tower')}><g ref={bind('towerFlame')} transform="translate(0 -576) scale(.17 .3)" visibility="hidden">{MOON_ART.smallPlume}</g>{MOON_ART.tower}</g>
    <g ref={bind('stage2')}><g ref={bind('s2')} visibility="hidden">{MOON_ART.smallPlume}</g>{MOON_ART.stageTwo}</g>
    <g ref={bind('stage1')}>
      <g ref={bind('s1')} visibility="hidden">{MOON_ART.plume}</g>
      <g ref={bind('seed')} visibility="hidden">{MOON_ART.plume}</g>
      {MOON_ART.stageOne}
      <path ref={bind('underglow')} d="M-48-94H48V6H-48Z" fill="url(#mn-underglow)" visibility="hidden" />
    </g>
    <RingPuff y={-221} which="ring1" />
    <RingPuff y={-355} which="ring2" />
  </g>;
});
const SUN_AT = `translate(${MOON_SUN.x} ${MOON_SUN.y})`;
const Space = memo(function Space() {
  const flare = useRef<SVGGElement>(null);
  const core = useRef<SVGGElement>(null);
  const earth = useRef<SVGGElement>(null);
  const moon = useRef<SVGGElement>(null);
  const group = useRef<SVGGElement>(null);
  useFrame((T) => {
    const on = T > 3.0 && T < MOON_BEATS.glintCut;
    shown(group.current, on);
    if (!on) return;
    const s = moonSpace(T);
    // Light fades in; the solid disc blooms in by scale, at full strength.
    attr(flare.current, 'opacity', r2(s.flare));
    shown(core.current, s.sunCore > 0);
    attr(core.current, 'transform', s.sunCore === 1 ? SUN_AT : `${SUN_AT} scale(${r2(Math.max(0, s.sunCore))})`);
    attr(earth.current, 'transform', `translate(${r1(s.earth.x)} ${r1(s.earth.y)}) scale(${r2(s.earth.s)})`);
    shown(moon.current, s.moonSmall.show > 0);
    attr(moon.current, 'transform', `translate(${r1(s.moonSmall.x)} ${r1(s.moonSmall.y)}) scale(${r2(s.moonSmall.s * (.4 + .6 * s.moonSmall.show))})`);
  });
  return <g ref={group} visibility="hidden">
    <g ref={flare} transform={SUN_AT}>{MOON_ART.sunLight}</g>
    <g ref={core} transform={SUN_AT} visibility="hidden">{MOON_ART.sunCore}</g>
    <g ref={earth}>{MOON_ART.earth}</g>
    <g ref={moon} visibility="hidden">{MOON_ART.moonGlobe}</g>
  </g>;
});

// ---------------------------------------------------------------- the Moon
/**
 * The Moon globe from the sparkle cut to the horizon. Nothing on it fades:
 * during the dive its maria and craters rush out past the rim (clipped to the
 * disc) and only the terminator shading, which is light, lifts.
 */
const GlobeLayer = memo(function GlobeLayer({ viewBox }: { viewBox: string }) {
  const layer = useRef<HTMLDivElement>(null);
  const { nodes: e, bind } = useNodes();
  useFrame((T) => {
    const dive = moonDive(T);
    hideHtml(layer.current, dive.globe);
    if (!dive.globe) return;
    const globe = moonGlobe(T);
    attr(e.root, 'transform', `translate(${r1(globe.cx)} ${r1(globe.cy)}) scale(${Math.round(globe.r / 100 * 1000) / 1000})`);
    attr(e.disc, 'fill', dive.disc);
    shown(e.decals, dive.decals !== null);
    if (dive.decals !== null) attr(e.decals, 'transform', dive.decals === 1 ? null : `translate(0 -100) scale(${r2(dive.decals)}) translate(0 100)`);
    shown(e.night, dive.night > 0);
    attr(e.night, 'opacity', r2(dive.night));
  });
  return <div ref={layer} className="moon-layer" style={{ visibility: 'hidden' }}><svg viewBox={viewBox} preserveAspectRatio="none"><g ref={bind('root')}>
    <circle ref={bind('disc')} r="100" fill={MOON_DISC_FILL[0]} />
    <g clipPath="url(#mn-globe-clip)"><g ref={bind('decals')}>{MOON_ART.moonDecals}</g></g>
    <circle ref={bind('night')} r="100" fill="url(#mn-moon-night)" />
    {MOON_ART.moonRim}
  </g></svg></div>;
});
/** During the dive, the ground layers are seen through the growing globe (just inside its rim line, which stays whole). */
function diveClip(fit: MoonFit, T: number) {
  if (T >= 5.95) return 'none';
  const globe = moonGlobe(T);
  return `circle(${r1(Math.max(0, globe.r * fit.k - 1.5))}px at ${r1(fit.ox + globe.cx * fit.k)}px ${r1(fit.oy + globe.cy * fit.k)}px)`;
}
const FAR_CAM = moonCamTransform(MOON_FAR_REST);
const FarLayer = memo(function FarLayer({ fit, viewBox }: { fit: MoonFit; viewBox: string }) {
  const layer = useRef<HTMLDivElement>(null);
  useFrame((T) => {
    const el = layer.current;
    const on = moonDive(T).far;
    hideHtml(el, on);
    if (!on) return;
    const cam = moonCamLayer(fit, MOON_FAR_REST, moonFarCam(T));
    css(el, 'transform-origin', cam.origin);
    css(el, 'transform', cam.transform);
    const clip = diveClip(fit, T);
    css(el, 'clip-path', clip); css(el, '-webkit-clip-path', clip);
  });
  return <div ref={layer} className="moon-layer" style={{ visibility: 'hidden' }}><svg viewBox={viewBox} preserveAspectRatio="none"><g transform={FAR_CAM}>{APOLLO_ART.far}</g></svg></div>;
});
const NearLayer = memo(function NearLayer({ fit, viewBox }: { fit: MoonFit; viewBox: string }) {
  const layer = useRef<HTMLDivElement>(null);
  const cam = useRef<SVGGElement>(null);
  const pile = useRef<SVGGElement>(null);
  useFrame((T) => {
    const el = layer.current;
    const dive = moonDive(T);
    hideHtml(el, dive.near);
    if (!dive.near) return;
    attr(cam.current, 'transform', moonCamTransform(moonNearCam(T)));
    // The boulder pile pops up from its base on the swap frame (an object arriving, not a ghost).
    const { x, y } = MOON_PILE_BASE;
    attr(pile.current, 'transform', dive.pile === 1 ? null : `translate(${x} ${y}) scale(${r2(dive.pile)}) translate(${-x} ${-y})`);
    const clip = diveClip(fit, T);
    css(el, 'clip-path', clip); css(el, '-webkit-clip-path', clip);
  });
  return <div ref={layer} className="moon-layer" style={{ visibility: 'hidden' }}><svg viewBox={viewBox} preserveAspectRatio="none"><g ref={cam}>{APOLLO_ART.near}<g ref={pile}>{APOLLO_ART.boulders}</g></g></svg></div>;
});
const SkyEarth = memo(function SkyEarth({ fit }: { fit: MoonFit }) {
  const layer = useRef<HTMLDivElement>(null);
  const size = 248 * MOON_SKY_EARTH.r / 100 * fit.k;
  const at = moonToScreen(fit, MOON_SKY_EARTH.x, MOON_SKY_EARTH.y);
  useFrame((T) => hideHtml(layer.current, T >= MOON_BEATS.glintCut));
  return <div ref={layer} className="moon-sky-earth" style={{ visibility: 'hidden', left: r1(at.x - size / 2), top: r1(at.y - size / 2), width: r1(size), height: r1(size) }}><svg viewBox="-124 -124 248 248">{MOON_ART.earth}</svg></div>;
});
/** Near-ground camera for the lunar actors (the orbit shots before 5.30 use world space). */
function NearGroup({ children }: { children: ReactNode }) {
  const g = useRef<SVGGElement>(null);
  useFrame((T) => attr(g.current, 'transform', T > 5.3 ? moonCamTransform(moonNearCam(T)) : null));
  return <g ref={g}>{children}</g>;
}
const LmShadow = memo(function LmShadow() {
  const path = useRef<SVGPathElement>(null);
  useFrame((T) => {
    shown(path.current, T > 5.35);
    if (T <= 5.35) return;
    const s = moonLmShadow(T);
    attr(path.current, 'transform', `translate(${r1(s.x)} ${r1(s.y)}) scale(${r2(s.s)})`);
    attr(path.current, 'opacity', r2(s.o));
  });
  return <path ref={path} d={LM_SHADOW} fill="#5f574b" visibility="hidden" />;
});
const DustStreaks = memo(function DustStreaks() {
  const { nodes: paths, bind: bindpaths } = useNodes();
  useFrame((T) => {
    const streaks = moonDustStreaks(T, moonLanderPose(T).x);
    for (let i = 0; i < 8; i++) {
      const s = streaks.find((item) => item.id === `${i < 4 ? -1 : 1}${i % 4}`);
      shown(paths[i], !!s);
      if (s) attr(paths[i], 'd', `M${r1(s.x)} ${s.y}h${r1(s.len)}`);
    }
  });
  return <g stroke="#f6f0e2" strokeWidth="5" strokeLinecap="round">{Array.from({ length: 8 }, (_, i) => <path key={i} ref={bindpaths(i)} visibility="hidden" />)}</g>;
});
const Lander = memo(function Lander() {
  const { nodes: e, bind } = useNodes();
  useFrame((T) => {
    shown(e.root, T >= MOON_BEATS.glintCut);
    const lm = moonLanderPose(T);
    attr(e.root, 'transform', `translate(${r1(lm.x)} ${r1(lm.y)}) scale(${Math.round(lm.s * 1000) / 1000}) rotate(${r1(lm.r)} 0 ${MOON_LM_PIVOT_Y})`);
    const flame = moonLmFlameScale(T);
    shown(e.flame, flame.y > 0);
    if (flame.y > 0) attr(e.flame, 'transform', `translate(0 -64) scale(${r2(flame.x)} ${r2(flame.y)})`);
    attr(e.body, 'transform', `translate(0 ${moonLegs(T).compress})`);
    const hatch = moonHatch(T);
    // The hatch swings open: the dark doorway widens from its hinge edge (solid, so it never fades).
    shown(e.hatch, hatch > 0);
    attr(e.hatch, 'transform', hatch >= 1 ? null : `translate(-28 0) scale(${r2(Math.max(.02, hatch))} 1) translate(28 0)`);
    const c = moonColumbia(T);
    shown(e.csm, !!c);
    if (c) attr(e.csm, 'transform', `translate(${r1(c.x)} ${r1(c.y)}) rotate(${r1(c.rot)}) scale(${r2(c.s)})`);
  });
  return <g ref={bind('root')} visibility="hidden">
    <g ref={bind('flame')} visibility="hidden">{APOLLO_ART.lmFlame}</g>
    <LanderLegs front={false} />
    <g ref={bind('body')}>{APOLLO_ART.lmBody}<path ref={bind('hatch')} d={LM_HATCH} fill="#161a3a" stroke={INK} strokeWidth="3" visibility="hidden" /></g>
    <LanderLegs front />
    <g ref={bind('csm')}>{APOLLO_ART.csm}</g>
    <SpritePool size={RCS_SLOTS} sprites={rcsSprites} />
  </g>;
});
const Footprints = memo(function Footprints() {
  const { nodes: prints, bind: bindprints } = useNodes();
  useFrame((T) => MOON_FOOTPRINTS.forEach(([, , at], i) => shown(prints[i], T > at)));
  return <>{MOON_FOOTPRINTS.map(([x, y], i) => <g key={i} ref={bindprints(i)} visibility="hidden"><Footprint x={x} y={y} s={moonDepthScale(y)} /></g>)}</>;
});
const HopGrains = memo(function HopGrains() {
  const { nodes: dots, bind: binddots } = useNodes();
  useFrame((T) => {
    const grains = moonHopGrains(T);
    for (let i = 0; i < 12; i++) {
      const g = grains.find((item) => item.id === i);
      shown(dots[i], !!g);
      if (g) { attr(dots[i], 'cx', r1(g.x)); attr(dots[i], 'cy', r1(g.y)); attr(dots[i], 'r', r1(3.2 * g.s)); }
    }
  });
  return <g fill="#e6decf" stroke="#8a806f" strokeWidth="1.5">{Array.from({ length: 12 }, (_, i) => <circle key={i} ref={binddots(i)} visibility="hidden" />)}</g>;
});
/**
 * The flag, drawn behind the back-view astronaut (on the ladder rail) or
 * between the front-view body and his gripping arm. Explicit visibility lets
 * the stowed flag show before the astronaut does.
 */
const FlagSlot = memo(function FlagSlot({ view }: { view: 'back' | 'front' }) {
  const slot = useRef<SVGGElement>(null);
  useFrame((T) => attr(slot.current, 'visibility', (view === 'back' ? T >= 7.08 && T < MOON_ASTRO_TURN : T >= MOON_ASTRO_TURN) ? 'visible' : 'hidden'));
  return <g ref={slot} visibility="hidden"><FlagActor /></g>;
});
const FLAG_BACK = <FlagSlot view="back" />;
const FLAG_FRONT = <FlagSlot view="front" />;
const PlantedMarks = memo(function PlantedMarks() {
  const g = useRef<SVGGElement>(null);
  useFrame((T) => shown(g.current, T >= MOON_FLAG_WINDOWS.plunge[0]));
  return <g ref={g} visibility="hidden"><FlagGroundMarks /></g>;
});
/** The surface story: footprints, the flag and the astronaut (shown from the climb). */
const Surface = memo(function Surface({ back, front, flag, marks }: { back: boolean; front: boolean; flag: boolean; marks: boolean }) {
  const astro = useRef<SVGGElement>(null);
  const backView = useRef<SVGGElement>(null);
  const frontView = useRef<SVGGElement>(null);
  useFrame((T) => {
    shown(astro.current, T >= MOON_BEATS.climb - .04);
    shown(backView.current, T < MOON_ASTRO_TURN);
    shown(frontView.current, T >= MOON_ASTRO_TURN);
  });
  return <>
    {marks && <Footprints />}
    {marks && <PlantedMarks />}
    <g ref={astro} visibility="hidden">
      {back && <g ref={backView}><AstronautActor view="back" flag={flag ? FLAG_BACK : null} /></g>}
      {front && <g ref={frontView} visibility="hidden"><AstronautActor view="front" flag={flag ? FLAG_FRONT : null} /></g>}
    </g>
    {marks && <HopGrains />}
  </>;
});

// ---------------------------------------------------------------- overlays
type PopLayout = ReturnType<typeof moonPopLayout>;
/**
 * The final POP where the window snaps shut: a big ink-outlined comic burst,
 * then stars, sparkles and a shock ring fly out (CSS keyframes; each piece's
 * reach comes from the fit, so none slides under the header or footer).
 */
const Pop = memo(function Pop({ pop }: { pop: PopLayout }) {
  return <div className="moon-pop" style={{ left: `${pop.x}px`, top: `${pop.y}px`, '--u': `${pop.u}px` } as CSSProperties}>
    <i className="moon-pop-ring" />
    <i className="moon-pop-burst">{MOON_ART.popBurst}</i>
    {pop.sparks.map((s, i) => <i key={`s${i}`} className="moon-pop-spark" style={{ '--a': `${s.a}deg`, '--d': `${s.d}px`, color: s.color } as CSSProperties}><svg viewBox="-12 -12 24 24"><path d={SPARKLE} fill="currentColor" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" /></svg></i>)}
    {pop.stars.map((s, i) => <i key={i} className="moon-pop-star" style={{ '--a': `${s.a}deg`, '--d': `${s.d}px`, color: s.color } as CSSProperties}><svg viewBox="-1.1 -1.1 2.2 2.2"><path d={STAR5} fill="currentColor" stroke={INK} strokeWidth=".11" strokeLinejoin="round" /></svg></i>)}
  </div>;
});
/** Overlays animated by CSS only; their props change only on resize. */
const StaticOverlays = memo(function StaticOverlays({ glintX, glintY, glintSize, pop }: { glintX: number; glintY: number; glintSize: number; pop: PopLayout }) {
  return <>
    <div className="moon-glint" style={{ left: `${glintX}px`, top: `${glintY}px`, width: `${glintSize}px`, height: `${glintSize}px`, margin: `${-glintSize / 2}px 0 0 ${-glintSize / 2}px` }}><svg viewBox="-60 -60 120 120"><defs><radialGradient id="mn-gl"><stop stopColor="#ffffff" stopOpacity=".95" /><stop offset=".35" stopColor="#fff3c4" stopOpacity=".6" /><stop offset="1" stopColor="#fff3c4" stopOpacity="0" /></radialGradient></defs><circle r="58" fill="url(#mn-gl)" /><path d={GLINT_PATH} fill="#fff3c4" /><circle r="10" fill="#fff" /></svg></div>
    <div className="moon-shooting" />
    <div className="moon-shooting is-second" />
    <Pop pop={pop} />
  </>;
});
/** The flag's sparkle (CSS keyframes) rides the scene when it rises at the iris. */
const FlagSparkle = memo(function FlagSparkle({ fit, x, y }: { fit: MoonFit; x: number; y: number }) {
  const lift = useRef<HTMLDivElement>(null);
  const iris = useMemo(() => moonIris(fit), [fit]);
  useFrame((T) => { const l = moonIrisLift(T, iris); css(lift.current, 'transform', l > 0 ? `translate3d(0, ${r1(-l)}px, 0)` : 'none'); });
  return <div ref={lift} className="moon-lift">
    <div className="moon-flag-glint" style={{ left: `${x}px`, top: `${y}px` }}>
      <svg viewBox="-60 -60 120 120"><defs><radialGradient id="mn-fg"><stop stopColor="#fff6c8" stopOpacity=".9" /><stop offset="1" stopColor="#ffe07a" stopOpacity="0" /></radialGradient></defs><circle r="54" fill="url(#mn-fg)" /><path d={GLINT_PATH} fill="#ffe07a" stroke="#c98a1c" strokeWidth="4" /><circle r="8" fill="#fffbe8" /></svg>
    </div>
    <div className="moon-flag-stars" style={{ left: `${x}px`, top: `${y}px` }}>
      {Array.from({ length: 6 }, (_, i) => <i key={i} style={{ '--a': `${15 + i * 60}deg`, '--d': `${40 + (i % 3) * 15}px` } as CSSProperties}><svg viewBox="-1.2 -1.2 2.4 2.4"><path d={STAR5} fill="#ffe07a" stroke="#c98a1c" strokeWidth=".16" /></svg></i>)}
    </div>
  </div>;
});
type Twinkle = { index: number; start: number; x: number; y: number; size: number };
/** Each team card sparkles as the closing ring passes it. */
const CardTwinkles = memo(function CardTwinkles({ items }: { items: readonly Twinkle[] }) {
  return <>{items.map((t) => <i key={t.index} className="moon-card-twinkle" style={{ left: `${r1(t.x)}px`, top: `${r1(t.y)}px`, width: `${r1(t.size)}px`, height: `${r1(t.size)}px`, margin: `${r1(-t.size / 2)}px 0 0 ${r1(-t.size / 2)}px`, animationDelay: `${Math.round(t.start * 1000)}ms` }}>
    <svg viewBox="-12 -12 24 24"><circle r="11" fill="#ffe07a" opacity=".33" /><path d="M0-11C1-3 3-1 11 0C3 1 1 3 0 11C-1 3-3 1-11 0C-3-1-1-3 0-11Z" fill="#ffe07a" stroke="#c98a1c" strokeWidth="1.4" /><circle r="2.2" fill="#fffbe8" /></svg>
  </i>)}</>;
});
/** Gold double rim riding the iris, with ten stars that ride it to the center. */
const IrisRim = memo(function IrisRim({ fit }: { fit: MoonFit }) {
  const { nodes: els, bind } = useNodes();
  const iris = moonIris(fit);
  const lw = Math.max(.7, fit.k);
  const size = MOON_RIM_STAR * Math.min(fit.w, fit.h);
  const svg = useRef<SVGSVGElement>(null);
  useFrame((T) => {
    const on = T >= MOON_BEATS.irisStart && T < MOON_BEATS.closed;
    attr(svg.current, 'visibility', on ? null : 'hidden');
    if (!on) return;
    const R = moonIrisRadius(T, iris) ?? iris.R0;
    const c = moonIrisCenter(T, iris);
    const [outer, inner, ...stars] = Array.from({ length: 12 }, (_, i) => els[i]);
    attr(outer, 'r', r1(Math.max(0, R + 6)));
    attr(inner, 'r', r1(Math.max(0, R)));
    for (const ring of [outer, inner]) attr(ring, 'cy', r1(c.y));
    stars.forEach((star, i) => {
      const a = deg(i * 36 + 90 * (T - MOON_BEATS.irisStart));
      attr(star, 'transform', `translate(${r1(c.x + Math.cos(a) * R)} ${r1(c.y + Math.sin(a) * R)}) rotate(${r1(T * 120 + i * 20)}) scale(${r1(size)})`);
    });
  });
  return <svg ref={svg} visibility="hidden" className="moon-rim" width={fit.w} height={fit.h} viewBox={`0 0 ${fit.w} ${fit.h}`}>
    <circle ref={bind(0)} cx={r1(iris.cx)} cy={r1(iris.cy)} fill="none" stroke="#fffaf0" strokeWidth={r1(10 * lw)} />
    <circle ref={bind(1)} cx={r1(iris.cx)} cy={r1(iris.cy)} fill="none" stroke="#ffc94a" strokeWidth={r1(6 * lw)} />
    {Array.from({ length: 10 }, (_, i) => <path key={i} ref={bind(i + 2)} d={STAR5} fill="#ffe07a" stroke="#c98a1c" strokeWidth={r2(2 / size)} />)}
  </svg>;
});
const Caption = memo(function Caption() {
  const pill = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useFrame((T) => {
    const caption = moonCaption(T);
    if (caption && text.current && text.current.textContent !== caption) text.current.textContent = caption;
    pill.current?.classList.toggle('is-on', !!caption);
  });
  return <div ref={pill} className="moon-caption"><span ref={text}>{' '}</span></div>;
});
/** The iris clip is on the scene layers only; overlays stay whole. */
function Iris({ fit, children }: { fit: MoonFit; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const iris = useMemo(() => moonIris(fit), [fit]);
  useFrame((T) => {
    const R = moonIrisRadius(T, iris);
    const c = moonIrisCenter(T, iris);
    const clip = R === null ? 'none' : `circle(${r1(Math.max(0, R))}px at ${r1(c.x)}px ${r1(c.y)}px)`;
    css(el.current, 'clip-path', clip);
    css(el.current, '-webkit-clip-path', clip);
    // Once closed the clip stays at radius 0 (hiding the subtree instead would restyle every element in it).
  });
  return <div ref={el} className="moon-iris">{children}</div>;
}

// ---------------------------------------------------------------- the scene (structure only)
function Scene({ T, fit, twinkles }: { T: number; fit: MoonFit; twinkles: readonly Twinkle[] }) {
  const viewBox = useMemo(() => moonViewBox(fit), [fit]);
  const pop = useMemo(() => moonPopLayout(fit), [fit]);
  const at =(step: keyof typeof MOON_PREMOUNT) => T >= MOON_PREMOUNT[step];
  const glintAt = moonToScreen(fit, MOON_GLINT_WORLD.x, MOON_GLINT_WORLD.y);
  const flyCorner = moonCamPoint(MOON_NEAR_FINAL, MOON_FLAG_SPOT.x + (MOON_FLAG_W + 2) * MOON_FLAG_SCALE, MOON_FLAG_SPOT.gy - (MOON_FLAG_POLE - 2) * MOON_FLAG_SCALE);
  const flagGlintAt = moonToScreen(fit, flyCorner.x, flyCorner.y);
  const launchStyle = useMemo(() => {
    const o = moonLaunchOverlay(fit);
    return { '--moon-launch-x': `${r1(o.x)}px`, '--moon-liftoff-w': `${r1(o.liftoffWidth)}px` } as CSSProperties;
  }, [fit]);
  return <div className="moon-scene">
    <Iris fit={fit}>
      <div className="moon-sky moon-space" />
      <Skies />
      <StarField viewBox={viewBox} />
      <Rig fit={fit}>
        <PadLayer fit={fit} viewBox={viewBox} />
        <PadLight fit={fit} />
        {at('globe') && <GlobeLayer viewBox={viewBox} />}
        {at('far') && <FarLayer fit={fit} viewBox={viewBox} />}
        {at('near') && <NearLayer fit={fit} viewBox={viewBox} />}
        {at('globe') && <SkyEarth fit={fit} />}
        <svg className="moon-world" viewBox={viewBox} preserveAspectRatio="none">
          {MOON_ART.defs}{APOLLO_ART.groundDefs}
          <PadGroup><TrenchFire /></PadGroup>
          {at('space') && <Space />}
          <SaturnV />
          <PadGroup><PadFront /></PadGroup>
          {at('lander') && <NearGroup>
            <LmShadow />
            <DustStreaks />
            <SpritePool size={DUST_SLOTS} sprites={dustSprites} />
            <Lander />
            <Surface back={at('astroBack')} front={at('astroFront')} flag={at('flag')} marks={at('surface')} />
          </NearGroup>}
        </svg>
        <Palms fit={fit} viewBox={viewBox} />
      </Rig>
    </Iris>
    <div className="moon-overlay" style={launchStyle}>
      {MOON_ART.countdown}
      {MOON_ART.liftoff}
      <StaticOverlays glintX={r1(glintAt.x)} glintY={r1(glintAt.y)} glintSize={Math.round(MOON_GLINT_SIZE * fit.k)} pop={pop} />
      <FlagSparkle fit={fit} x={r1(flagGlintAt.x)} y={r1(flagGlintAt.y)} />
      <CardTwinkles items={twinkles} />
      {at('rim') && <IrisRim fit={fit} />}
      <Caption />
    </div>
  </div>;
}

function useFit(ref: React.RefObject<HTMLDivElement | null>) {
  const { w, h } = useStageSize(ref);
  return useMemo(() => moonFit(w, h), [w, h]);
}
const NO_TWINKLES: readonly Twinkle[] = [];

/**
 * Renders the reveal at a fixed `time` (review tools). With `seek`, CSS
 * keyframes inside are paused at the same moment so a still frame is exact.
 */
export function MoonScene({ time, seek = true }: { time: number; seek?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const fit = useFit(root);
  const T = Math.max(0, Math.min(time, MOON_DURATION_MS / 1000));
  const bus = useMemo(() => createFrameBus(T), [T]);
  useLayoutEffect(() => {
    if (!seek || !root.current || typeof root.current.getAnimations !== 'function') return;
    for (const animation of root.current.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = time * 1000; }
  });
  return <FrameContext.Provider value={bus}><div ref={root} className="moon-reveal-root"><Scene T={T} fit={fit} twinkles={NO_TWINKLES} /></div></FrameContext.Provider>;
}

function MoonStage() {
  const { bus, T } = useMoonClock(MOON_DURATION_MS, moonStructureKey);
  const root = useRef<HTMLDivElement>(null);
  const fit = useFit(root);
  const targets = useRevealTargets();
  const twinkles = useMemo(() => moonTwinkleSchedule(targets as readonly MoonTwinkleTarget[], fit), [targets, fit]);
  return <FrameContext.Provider value={bus}><div ref={root} className="moon-reveal-root"><Scene T={T} fit={fit} twinkles={twinkles} /></div></FrameContext.Provider>;
}
function MoonCover() { return null; }

export const moonEffect: RevealEffect = {
  id: 'moon',
  name: 'Saturn V · Moon landing',
  description: 'Shout 3-2-1, blast off through the clouds, pop the stages, fly past a boulder field, and take one giant leap. A gold iris closes in a big POP of stars over the groups.',
  durationMs: MOON_DURATION_MS,
  sound: 'moon',
  Stage: MoonStage,
  Cover: MoonCover,
};
