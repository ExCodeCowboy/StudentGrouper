import { useLayoutEffect, useRef, useState, type AnimationEvent, type CSSProperties, type ReactNode } from 'react';
import type { RevealEffect } from './types';
import { BLACK_HOLE_ARMS, BLACK_HOLE_RINGS, arcPath, ringComets, type BlackHoleRing } from './blackHoleArt';
import {
  BLACK_HOLE_BURST, BLACK_HOLE_CRUMBS, BLACK_HOLE_CRUMB_STEP_MS, BLACK_HOLE_DURATION_MS, BLACK_HOLE_SCRAPS, BLACK_HOLE_STARS, BLACK_HOLE_STREAKS,
  blackHoleCoverVars, blackHoleSparkShift, blackHoleStripDelay, blackHoleStripLayout, blackHoleStripMountTimes, blackHoleTrail, blackHoleTug,
  type BlackHoleStripLayout, type BlackHoleTug,
} from './blackHoleTimeline';
import './blackHole.css';

// Black-hole whoosh. Pure CSS animation: every element renders once, beats are
// literal delays in blackHole.css (mirrored in blackHoleTimeline.ts). A small
// hungry portal tugs the "?" tiles like taffy (a "?" right under it hops out of the way first),
// BOINGs, rips the paper into ribbons that spiral in, then opens its eyes, holds in a burp,
// burps out sparkles, grins and winks out.

// ---- Stage art (module scope: built once, never re-rendered) ------------------------------

const starShadow = BLACK_HOLE_STARS.map(([x, y, big, gold]) => `${x}vmin ${y}vmin 0 ${big ? 1 : 0}px ${gold ? '#ffe9a8' : '#ffffff'}`).join(',');

function RingArt({ ring }: { ring: BlackHoleRing }) {
  const comets = ringComets(ring);
  return <svg viewBox="-100 -100 200 200" aria-hidden="true">
    <circle r={ring.radius} fill="none" stroke={ring.color} strokeWidth={ring.width * 1.8} opacity={.13} />
    <g fill={ring.color} opacity={.9}>{comets.map((comet, index) => <path key={index} d={comet.body} />)}</g>
    <g fill={ring.hot}>{comets.map((comet, index) => <path key={index} d={comet.core} />)}</g>
  </svg>;
}

const ringArt = BLACK_HOLE_RINGS.map((ring) => <div key={ring.radius} className="bh-ring" style={{ '--period': `${ring.periodMs}ms` } as CSSProperties}><RingArt ring={ring} /></div>);

const armArt = <svg viewBox="-100 -100 200 200" aria-hidden="true">
  <defs><radialGradient id="bh-arm-fill" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="100">
    <stop offset=".28" stopColor="#fff2cc" stopOpacity=".95" /><stop offset=".55" stopColor="#d7b8ff" stopOpacity=".7" /><stop offset="1" stopColor="#8e7bff" stopOpacity="0" />
  </radialGradient></defs>
  {BLACK_HOLE_ARMS.map((arm) => <path key={arm} d={arm} fill="url(#bh-arm-fill)" />)}
</svg>;

// Static Doppler beaming: the approaching (left) side of the disk is brighter.
const dopplerArt = <svg viewBox="-100 -100 200 200" aria-hidden="true"><g fill="none" strokeLinecap="round">
  {[150, 100, 50].map((span) => <path key={`b${span}`} d={arcPath(54, 180 - span / 2, 180 + span / 2)} stroke="#fffaf0" strokeWidth={36} opacity={.12} />)}
  {[150, 100, 50].map((span) => <path key={`d${span}`} d={arcPath(54, -span / 2, span / 2)} stroke="#140a3c" strokeWidth={36} opacity={.11} />)}
</g></svg>;

// The event-horizon shadow doubles as the character's face once it has eaten.
// Pupils are clipped to the eye whites, so a big sideways glance presses them against the rim.
const eyes = [-18, 18].map((x, index) => <g key={x} clipPath={`url(#bh-eye-${index})`}>
  <ellipse cx={x} cy="-7" rx="12" ry="15" fill="#fff" />
  <g className="bh-pupils">
    <circle cx={x + 1} cy="-4" r="8" fill="#140b38" />
    <circle cx={x + 4} cy="-8.5" r="3" fill="#fff" /><circle cx={x - 1.5} cy="-1" r="1.4" fill="#fff" />
  </g>
</g>);
const coreArt = <svg viewBox="-50 -50 100 100" aria-hidden="true">
  <defs>
    <radialGradient id="bh-core-fill" cx=".42" cy=".38" r=".7"><stop offset="0" stopColor="#1a0f45" /><stop offset=".55" stopColor="#07041a" /><stop offset="1" stopColor="#030110" /></radialGradient>
    <clipPath id="bh-eye-0"><ellipse cx="-18" cy="-7" rx="12" ry="15" /></clipPath>
    <clipPath id="bh-eye-1"><ellipse cx="18" cy="-7" rx="12" ry="15" /></clipPath>
  </defs>
  <circle r="50" fill="url(#bh-core-fill)" />
  <path d="M-34 -24A42 42 0 0 1 10 -41" fill="none" stroke="#5b46b8" strokeWidth="3" strokeLinecap="round" opacity=".55" />
  <g className="bh-face">
    <g className="bh-eyes-open">{eyes}</g>
    <g className="bh-eyes-squeeze" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-29 -16L-12 -7L-29 2" /><path d="M29 -16L12 -7L29 2" />
    </g>
    <g className="bh-mouth-small"><ellipse cx="0" cy="16" rx="3.6" ry="4.4" fill="#2b1760" stroke="#ff9fd0" strokeWidth="1.8" /></g>
    <g className="bh-mouth-hold" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round"><path d="M-8 17Q-4 13.5 0 17Q4 20.5 8 17" /></g>
    <g className="bh-cheeks"><ellipse cx="-30" cy="11" rx="8" ry="5" fill="#ff8fbf" opacity=".6" /><ellipse cx="30" cy="11" rx="8" ry="5" fill="#ff8fbf" opacity=".6" /></g>
    <g className="bh-mouth-o"><ellipse cx="0" cy="18" rx="9" ry="11" fill="#2b1760" stroke="#ff9fd0" strokeWidth="2.4" /><ellipse cx="0" cy="22" rx="5" ry="4" fill="#ff7fb8" /></g>
    <g className="bh-happy">
      <g fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round"><path d="M-32 -4Q-19.5 -23 -7 -4" /><path d="M7 -4Q19.5 -23 32 -4" /></g>
      <path d="M-15 7H15Q15 28 0 28Q-15 28 -15 7Z" fill="#2b1760" stroke="#fff" strokeWidth="3.4" strokeLinejoin="round" />
      <ellipse cx="0" cy="22.5" rx="7.5" ry="4.2" fill="#ff7fb8" />
      <ellipse cx="-32" cy="11" rx="9" ry="5.2" fill="#ff8fbf" opacity=".85" /><ellipse cx="32" cy="11" rx="9" ry="5.2" fill="#ff8fbf" opacity=".85" />
    </g>
  </g>
</svg>;

const photonArt = <svg viewBox="-100 -100 200 200" aria-hidden="true">
  <circle r="31.2" fill="none" stroke="#ffd98a" strokeWidth="5" opacity=".35" />
  <circle r="31.2" fill="none" stroke="#ffe7b0" strokeWidth="1.6" />
  <path d={arcPath(31.2, 125, 235)} fill="none" stroke="#fffbef" strokeWidth="2.6" strokeLinecap="round" />
</svg>;

/**
 * The portal's lip: an exact copy of the core and photon ring (same boxes, same open/grow/act animations), shown
 * only while a slurped "?" goes in, above that "?", so the tile visibly slides under the rim into the hole.
 */
const lipArt = <div className="bh-hole bh-lip"><div className="bh-grow"><div className="bh-act">
  <div className="bh-core"><svg viewBox="-50 -50 100 100" aria-hidden="true">
    <circle r="50" fill="url(#bh-core-fill)" />
    <path d="M-34 -24A42 42 0 0 1 10 -41" fill="none" stroke="#5b46b8" strokeWidth="3" strokeLinecap="round" opacity=".55" />
  </svg></div>
  <div className="bh-photon">{photonArt}</div>
</div></div></div>;

const streakArt = BLACK_HOLE_STREAKS.map((streak, index) => <i key={index} className="bh-streak" style={{
  '--a': `${streak.angle.toFixed(1)}deg`, '--r0': `${streak.radius.toFixed(1)}vmax`, '--sweep': `${streak.sweep.toFixed(1)}deg`, '--d': `${streak.delayMs}ms`, '--dur': `${streak.durationMs}ms`, '--len': `${streak.length}px`, '--head': `${streak.head}px`, '--c': streak.color,
} as CSSProperties}><b><em className="bh-star" /></b></i>);

const burstArt = BLACK_HOLE_BURST.map((spark, index) => <i key={index} style={{
  '--a': `${spark.angle}deg`, '--dist': `${spark.distance}vmin`, '--spin': `${spark.spin}deg`, '--size': `${spark.size}px`, '--c': spark.color, '--d': `${spark.delayMs}ms`, '--dur': `${spark.durationMs}ms`,
} as CSSProperties}><em className="bh-star" /></i>);

const scrapArt = BLACK_HOLE_SCRAPS.map((scrap, index) => <i key={index} className={scrap.tile ? 'bh-scrap is-tile' : 'bh-scrap'} style={{
  '--a': `${scrap.angle}deg`, '--sweep': `${scrap.sweep}deg`, '--d': `${scrap.delayMs}ms`, '--dur': `${scrap.durationMs}ms`, '--spin': `${scrap.spin}deg`, '--w': scrap.width, '--h': scrap.height,
} as CSSProperties}><b /></i>);

const crumbArt = BLACK_HOLE_CRUMBS.map(([dx, dy, spin], index) => <i key={index} style={{ '--dx': `${dx}vmin`, '--dy': `${dy}vmin`, '--rot': `${spin}deg`, '--d': `${index * BLACK_HOLE_CRUMB_STEP_MS}ms` } as CSSProperties} />);

const miniArt = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([mx, my]) => <i key={`${mx}${my}`} className="bh-star" style={{ '--mx': mx, '--my': my } as CSSProperties} />);

// The dusk sits under the tug copies (the "?" tiles stay bright while they star in the gag);
// everything else is above them, in paint order.
const duskArt = <div className="bh-dim" />;
const sceneArt = <>
  <div className="bh-stars" style={{ boxShadow: starShadow }} />
  <div className="bh-spark"><i className="bh-star" /></div>
  <div className="bh-flash" />
  <div className="bh-streaks">{streakArt}</div>
  <div className="bh-hole"><div className="bh-grow"><div className="bh-act">
    <div className="bh-glow" />
    <div className="bh-disk">
      <div className="bh-band" />
      <div className="bh-disk-boost">
        <div className="bh-arms">{armArt}</div>
        {ringArt}
      </div>
      <div className="bh-doppler">{dopplerArt}</div>
      <div className="bh-scraps">{scrapArt}</div>
    </div>
    <div className="bh-core">{coreArt}</div>
    <div className="bh-photon">{photonArt}</div>
  </div></div></div>
  <div className="bh-pulse" />
  <div className="bh-shock" />
  <div className="bh-burp-ring" />
  <div className="bh-burst">{burstArt}</div>
  <div className="bh-crumbs">{crumbArt}</div>
  <div className="bh-twinkle"><i className="bh-star bh-twinkle-rim" /><i className="bh-star bh-twinkle-body" /></div>
  <div className="bh-minis">{miniArt}</div>
</>;

// ---- Measuring (one pass for every cover mounted in this commit) -----------------------------

type CoverSetup = {
  /** Inline style for the cover's paper. */
  style: CSSProperties;
  strips: number;
  center: boolean;
  /** Cover width and each strip's box, pivot and start (plain values: no per-strip calc() in the stylesheet). */
  width: number;
  layouts: BlackHoleStripLayout[];
  /** Where and how the stage draws this card's stretching "?" tile, or null when it does not draw one. */
  tug: (BlackHoleTug & { tilt: string }) | null;
  /** When this cover adds its strips under the sheet (ms from mount; nearest cover first). */
  mountMs: number;
};
const setups = new WeakMap<Element, CoverSetup>();

/**
 * One read pass over every black-hole cover mounted in this commit (whichever of the
 * stage or the first cover lays out first sees them all). The covers are still empty at
 * this point, so the forced style and layout pass is cheap. Each Cover then renders its
 * sheet, and later (0.5 to 1.2 s in, nearest card first, off the critical first frame) its
 * strips, with every strip's box, pivot and start already worked out (nearest card first;
 * within a card, the strip nearest the hole first); the stage draws each card's tug.
 */
function measureBlackHoleCovers() {
  const papers = Array.from(document.querySelectorAll<HTMLElement>('.bh-paper')).filter((paper) => !setups.has(paper));
  if (!papers.length) return;
  const hosts = papers.map((paper) => paper.parentElement ?? paper);
  const rects = hosts.map((host) => host.getBoundingClientRect());
  const styles = hosts.map((host) => getComputedStyle(host));
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const vars = blackHoleCoverVars(rects, viewport);
  const mountTimes = blackHoleStripMountTimes(vars.map((item) => item.distance));
  papers.forEach((paper, index) => {
    const { angle, center, strips } = vars[index];
    const rect = rects[index];
    const style = styles[index];
    // The tile is the cover's --T: 1.45 x the question size, at most 60% of the cover height.
    const question = Number.parseFloat(style.getPropertyValue('--reveal-question-size')) || 56;
    const tilt = style.getPropertyValue('--team-tilt').trim() || '0deg';
    const tug = blackHoleTug(rect, viewport, { angle, center }, question, tilt.endsWith('deg') ? Number.parseFloat(tilt) || 0 : 0);
    const tile = Math.min(question * 1.45, rect.height * .6);
    setups.set(paper, {
      style: { '--bh-radius': style.borderTopLeftRadius || '0px' } as CSSProperties,
      strips, center, width: rect.width,
      layouts: Array.from({ length: strips }, (_, slice) => blackHoleStripLayout(rect, viewport, vars[index], slice, tile)),
      tug: tug && { ...tug, tilt },
      mountMs: mountTimes[index],
    });
  });
}

// ---- Stage ------------------------------------------------------------------------------------

const tileMark = <span className="bh-tile-mark">?</span>;
const tileStar = <i className="bh-star bh-tile-star" />;

/**
 * A card's "?" tile, drawn by the stage (above every cover and the dusk) while it leans, stretches like
 * taffy toward the hole, lit gold by it, and BOINGs back, so a long pull is never hidden under the
 * neighbouring card. At rest it sits exactly on the cover's own tile (which hides meanwhile); it fades
 * into the dusk and hands back at 1700 ms. A "?" right under the portal hops out first, and after
 * the boing is slurped up into the portal instead: it is drawn twice, running the same animations, once
 * under the portal ('under', through the hop and the tug) and once over it ('over', from the BOING, so the
 * slurp is never hidden under the glow or the power-up pulse; only the portal's lip covers it as it goes in).
 * The 'over' copy pulls a gold taffy trail loose from the spot where it sat, which snaps up after it.
 */
function tugCopy(key: number, tug: NonNullable<CoverSetup['tug']>, layer: 'under' | 'over' = 'under') {
  const hop = tug.hop > 0;
  const trail = hop && layer === 'over' ? blackHoleTrail(tug) : null;
  const aim = <div className="bh-tug-aim" style={{ transform: `rotate(${tug.angle.toFixed(2)}deg)` }}>
    <i className="bh-strand" />
    <span className="bh-tug-stretch"><span className="bh-tug-upright"><span className="bh-tile">
      <i className="bh-rim" style={{ background: `linear-gradient(${tug.rimAngle.toFixed(1)}deg, rgba(255, 214, 120, 0) 42%, rgba(255, 214, 120, .5) 70%, rgba(255, 236, 170, .85) 88%, rgba(186, 156, 255, .9) 100%)` }} />
      {tileStar}
    </span></span></span>
    <span className="bh-tug-mark"><span className="bh-tug-upright">{tileMark}</span></span>
  </div>;
  return <div key={key} className={hop ? `bh-tug is-hop is-${layer}` : 'bh-tug'} style={{
    left: `${tug.x.toFixed(1)}px`, top: `${tug.y.toFixed(1)}px`, '--T': `${tug.size.toFixed(2)}px`, '--bh-angle': `${tug.angle.toFixed(2)}deg`, '--team-tilt': tug.tilt,
    '--bh-hop': `${tug.hop.toFixed(1)}px`, '--bh-wash-color': `rgba(48, 22, 134, ${tug.wash.toFixed(3)})`,
    ...hop && { '--bh-in-x': `${tug.inX.toFixed(1)}px`, '--bh-in-y': `${tug.inY.toFixed(1)}px` },
    ...trail && { '--bh-trail-angle': `${trail.angle.toFixed(1)}deg`, ...Object.fromEntries(trail.scales.map((scale, index) => [`--bh-trail-${index + 1}`, scale.toFixed(3)])) },
  } as CSSProperties}>
    {hop ? <div className="bh-tug-hop">{layer === 'over' && <i className="bh-trail" />}{aim}</div> : aim}
    {!hop && <span className="bh-tug-wash"><span className="bh-tile is-wash">{tileStar}</span></span>}
  </div>;
}

type StageArt = { tugs: ReactNode; over: ReactNode; hop: boolean; style?: CSSProperties };

function BlackHoleStage() {
  const [art, setArt] = useState<StageArt>({ tugs: null, over: null, hop: false });
  // Before the first paint (a synchronous re-render): one tug copy per measured cover that gets one.
  useLayoutEffect(() => {
    const apply = () => {
      measureBlackHoleCovers();
      const papers = Array.from(document.querySelectorAll<HTMLElement>('.bh-paper')).filter((paper) => setups.get(paper)?.tug);
      // Only a cover whose tile the stage stands in for hides its own tile during the tug.
      papers.forEach((paper) => { paper.dataset.bhTug = ''; });
      const tugs = papers.map((paper) => setups.get(paper)!.tug!);
      const hopper = tugs.find((tug) => tug.hop > 0);
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      setArt({
        tugs: <div className="bh-tugs">{tugs.map((tug, index) => tugCopy(index, tug))}</div>,
        // The slurped "?" over the portal, then the portal's lip over it.
        over: hopper ? <div className="bh-tugs">{tugCopy(0, hopper, 'over')}{lipArt}</div> : null,
        hop: !!hopper,
        // The opening spark twinkles just above a "?" that sits under the portal, so it never hides the "?"'s face.
        style: hopper ? { '--bh-spark-y': `${blackHoleSparkShift(hopper, viewport).toFixed(1)}px` } as CSSProperties : undefined,
      });
    };
    apply();
  }, []);
  return <div className={art.hop ? 'bh-scene has-hop' : 'bh-scene'} style={art.style}>{duskArt}{art.tugs}{sceneArt}{art.over}</div>;
}

// ---- Cover (inside every card) ---------------------------------------------------------------

const specks = [<i key="a" className="bh-star bh-speck is-a" />, <i key="b" className="bh-star bh-speck is-b" />];
const tile = <span className="bh-tile">{tileMark}{tileStar}</span>;

const sheets = new Map<number, ReactNode>();
/** The intact sheet (identical to the strips put together), which never moves and steps away at the rip. */
function sheetFor(count: number) {
  let sheet = sheets.get(count);
  if (!sheet) {
    sheet = <div className="bh-sheet">
      <div className="bh-print">{specks}{tile}</div>
      <div className="bh-seams" style={{ backgroundSize: `${100 / count}% 100%` }}>{Array.from({ length: count - 1 }, (_, seam) => <i key={seam} style={{ left: `${(seam + 1) * 100 / count}%` }} />)}</div>
    </div>;
    sheets.set(count, sheet);
  }
  return sheet;
}

/**
 * The ribbons under the sheet: static prints of the whole card, each showing its own slice (with only the pieces
 * of the print that fall inside it), its crease shading, and the tear seam on its left edge (the seam it tore along).
 * They are added part-way into the reveal and join its clock (see joinRevealClock); without Web Animations,
 * `clock` re-bases each delay instead.
 */
function strips(setup: CoverSetup, clock: number) {
  return <div className="bh-strips">{setup.layouts.map((layout, slice) => <div key={slice} className="bh-strip" style={{
    left: `${layout.left.toFixed(2)}px`, width: `${layout.width.toFixed(2)}px`, transformOrigin: `${layout.originX.toFixed(1)}px ${layout.originY.toFixed(1)}px`, animationDelay: `${blackHoleStripDelay(layout.delayMs, clock)}ms`,
    '--bh-vx': `${layout.vx.toFixed(1)}px`, '--bh-vy': `${layout.vy.toFixed(1)}px`, '--bh-k': layout.k,
  } as CSSProperties}>
    <div className="bh-print" style={{ left: `${(-layout.left).toFixed(2)}px`, width: `${setup.width.toFixed(2)}px`, backgroundPosition: `${layout.left.toFixed(2)}px 0, 0 0`, backgroundSize: `${(layout.width - 1).toFixed(2)}px 100%, auto` }}>
      {layout.specks[0] && specks[0]}{layout.specks[1] && specks[1]}{layout.tile && tile}
    </div>
    {slice > 0 && <i className="bh-strip-seam" />}
  </div>)}</div>;
}

/** Web Animations (getAnimations, startTime) are available: new strips can join the running reveal clock exactly. */
const canSync = () => typeof Element !== 'undefined' && typeof Element.prototype.getAnimations === 'function';

/** Covers whose strips were just added and still have to join the reveal clock. */
const joining = new Set<HTMLElement>();
let joinQueued = false;

/**
 * Put freshly added strips (and their sheet's swap-out) on the reveal's CSS clock: the seams layer's animation
 * started with every other one at mount, so each new animation takes its start time (or, when a review tool
 * has paused and seeked the reveal, its paused time), and the absolute delays line up exactly. This runs once
 * per commit, after it (a microtask, before the next frame): all reads first (one style pass), then all writes.
 */
function joinRevealClock() {
  joinQueued = false;
  const papers = Array.from(joining).filter((paper) => paper.isConnected);
  joining.clear();
  const reference = papers[0]?.querySelector('.bh-seams')?.getAnimations()[0];
  if (!reference) return;
  const animations = papers.flatMap((paper) => Array.from(paper.querySelectorAll('.bh-sheet, .bh-strip')).flatMap((node) => node.getAnimations()));
  const paused = reference.playState === 'paused';
  for (const animation of animations) {
    if (paused) { animation.pause(); animation.currentTime = reference.currentTime; }
    else if (reference.startTime !== null) animation.startTime = reference.startTime;
  }
}
function queueJoin(paper: HTMLElement) {
  joining.add(paper);
  if (!joinQueued) { joinQueued = true; queueMicrotask(joinRevealClock); }
}

function BlackHoleCover() {
  const paper = useRef<HTMLDivElement>(null);
  const [setup, setSetup] = useState<CoverSetup | null>(null);
  // null until the strips are added (setup.mountMs in), then how far their delays must be re-based
  // (0 when they join the reveal clock through Web Animations).
  const [clock, setClock] = useState<number | null>(null);
  // The strips went in with the first frame (the nearest cover), so they already share the reveal clock.
  const early = useRef(false);
  // Measure before the first paint, then render the paper (a synchronous re-render, still before paint).
  useLayoutEffect(() => {
    const node = paper.current;
    if (!node) return;
    const apply = () => {
      if (!setups.has(node)) measureBlackHoleCovers();
      const found = setups.get(node) ?? null;
      setSetup(found);
      if (found?.mountMs === 0) { early.current = true; setClock(0); }
    };
    apply();
  }, []);
  // The trigger's 1 ms animation ends setup.mountMs into the reveal: add the strips under the sheet then.
  const mount = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.animationName === 'bh-mount') setClock((current) => current ?? (canSync() ? 0 : (setup?.mountMs ?? 0) + 1));
  };
  // Before the strips are painted, align their animations with the reveal clock.
  useLayoutEffect(() => {
    if (clock === 0 && paper.current && !early.current) queueJoin(paper.current);
  }, [clock]);
  const className = `bh-paper${setup?.center ? ' is-center' : ''}${clock !== null ? ' is-armed' : ''}`;
  const style = clock ? { ...setup?.style, '--bh-clock': `${clock}ms` } as CSSProperties : setup?.style;
  return <div ref={paper} className={className} style={style} onAnimationEnd={mount}>
    {setup && clock !== null && strips(setup, clock)}
    {setup && sheetFor(setup.strips)}
    {setup && clock === null && <i className="bh-mount" style={{ animationDelay: `${setup.mountMs}ms` }} />}
  </div>;
}

export const blackHoleEffect: RevealEffect = {
  id: 'black-hole', name: 'Black-hole whoosh',
  description: 'A hungry space portal tugs the question marks like taffy, rips the paper into ribbons and slurps them down, then holds in a burp, burps out sparkles, grins and winks out.',
  durationMs: BLACK_HOLE_DURATION_MS, sound: 'black-hole', Stage: BlackHoleStage, Cover: BlackHoleCover,
};
