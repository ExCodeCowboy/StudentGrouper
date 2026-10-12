import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { measureRevealCovers } from './revealTargets';
import {
  BLOCK_MINE_DURATION_MS, CUBE_FLIGHT_S, EXIT_END_S, EXIT_START_S, GEM_DRIFT_S, GEM_FLIGHT_S, GEM_POP_S, HEART_S, HOTBAR_EARLY_EXIT_S, HOTBAR_EARLY_SINK_S, HOTBAR_KINDS, HOTBAR_RISE_S, HOTBAR_SHINE_S,
  LAST_SMASH_S, LIGHTS_ON_DELAY_S, NEVER, PICK_ENTER_S, PICK_EXIT_DELAY_S, PICK_EXIT_S, SMASH_OFFSET_S, SWING_LENGTH_S, TICK_OFFSETS_S, TRAVEL_S, WINDUP_OFFSET_S,
  blockBox, gemIconSize, pixelSize, planBlockMine, slotIconSize, slotStart, smashTime, tickTime, toolIconSize, type BlockMinePlan, type CardPlan, type HouseMaterial, type Kind, type Rect,
} from './blockMineTimeline';
import { DEBRIS_COLORS, GEM_GLINT_FRAMES, PICKAXE_GRIP, PICKAXE_SIZE, PICKAXE_TIP, blockFaces, crackSprite, debrisGrid, digitGrid, gemGlintSheet, gemGrid, gridUrl, heartGrid, impactGrid, litFaces, pickaxeGrid, sparkleGrid, sunburstSheet } from './blockMineArt';
import type { RevealEffect } from './types';
import './blockMine.css';

/* ------------------------------------------------------------------ */
/* Generated art stylesheet: textures, sprites and the swing keyframes. */
/* ------------------------------------------------------------------ */

const KIND_ICON: Record<Kind, HouseMaterial> = { earth: 'grass', wood: 'planks', stone: 'stone', gem: 'gem' };
const MATERIALS: HouseMaterial[] = ['grass', 'dirt', 'stone', 'ore', 'planks', 'gem', 'door', 'doorTop', 'window'];

const pct = (seconds: number, length: number) => `${(seconds / length * 100).toFixed(2)}%`;
/** The glint sweeps the gem's face just after it settles at its hero point (with the shimmer cue). */
const GEM_GLINT_DELAY_S = .06;

/** Pickaxe swing (degrees about the grip; 0 = head tip on the block). Beat times come from the timeline. */
function swingKeyframes() {
  const L = SWING_LENGTH_S;
  const rel = (slotOffset: number) => slotOffset - TRAVEL_S;
  const easeIn = 'animation-timing-function:cubic-bezier(.6,0,1,.6)';
  const easeOut = 'animation-timing-function:cubic-bezier(0,.4,.4,1)';
  const frames: string[] = [];
  const at = (seconds: number, rule: string) => frames.push(`${pct(Math.max(0, Math.min(L, seconds)), L)}{${rule}}`);
  at(0, `transform:rotate(26deg);${easeOut}`);
  TICK_OFFSETS_S.forEach((tick, i) => {
    const impact = rel(tick);
    at(impact - .05, `transform:rotate(${40 + i * 2}deg);${easeIn}`);
    at(impact, `transform:rotate(-5deg) scale(1.04,.96);${easeOut}`);
    at(impact + .035, `transform:rotate(12deg);${easeOut}`);
  });
  const windup = rel(WINDUP_OFFSET_S);
  const smash = rel(SMASH_OFFSET_S);
  at(windup + .12, `transform:rotate(80deg) scale(1.08);animation-timing-function:ease-in-out`);
  at(smash - .03, `transform:rotate(86deg) scale(1.12,1.06);${easeIn}`);
  at(smash, `transform:rotate(-12deg) scale(1.14,.88);${easeOut}`);
  at(smash + .04, `transform:rotate(-18deg) scale(1);${easeOut}`);
  at(smash + .09, `transform:rotate(8deg);animation-timing-function:ease-in-out`);
  at(L, 'transform:rotate(24deg)');
  return `@keyframes bm-swing{${frames.join('')}}`;
}

let artCss: string | null = null;
function blockMineArtCss() {
  if (artCss) return artCss;
  const faces = blockFaces();
  const rules: string[] = [];
  for (const material of MATERIALS) {
    const set = faces[material];
    rules.push(`.bm-m-${material}>.bm-front,.bm-m-${material}>.bm-f-front,.bm-m-${material}>.bm-f-back{background-image:${set.front}}`);
    rules.push(`.bm-m-${material}>.bm-top,.bm-m-${material}>.bm-f-top{background-image:${set.top}}`);
    rules.push(`.bm-m-${material}>.bm-side,.bm-m-${material}>.bm-f-left,.bm-m-${material}>.bm-f-right,.bm-m-${material}>.bm-f-bottom{background-image:${set.side}}`);
    // Three debris scatters per material, so neighbouring blocks never burst in the same pattern.
    for (let variant = 0; variant < 3; variant++) rules.push(`.bm-d-${material}.is-v${variant}{background-image:${gridUrl(debrisGrid(DEBRIS_COLORS[material], MATERIALS.indexOf(material) * 7 + variant * 31 + 3))}}`);
  }
  rules.push(`.bm-crack{background-image:${crackSprite()}}`);
  rules.push(`.bm-hotbar-frame{background-image:${faces.planks.front}}`);
  rules.push(`.bm-pick-sprite,.bm-tool-icon{background-image:${gridUrl(pickaxeGrid())}}`);
  rules.push(`.bm-sparkle,.bm-spark,.bm-gem-twinkle{background-image:${gridUrl(sparkleGrid())}}`);
  rules.push(`.bm-sparkle.is-pink,.bm-gem-twinkle.is-pink{background-image:${gridUrl(sparkleGrid("#ff8cc6", "#ffffff"))}}`);
  rules.push(`.bm-heart{background-image:${gridUrl(heartGrid())}}`);
  rules.push(`.bm-impact{background-image:${gridUrl(impactGrid())}}`);
  rules.push(`.bm-rays{background-image:${gridUrl(sunburstSheet())}}`);
  rules.push(`.bm-gem-item{background-image:${gridUrl(gemGrid())}}`);
  rules.push(`.bm-gem-glint{background-image:${gridUrl(gemGlintSheet(GEM_GLINT_FRAMES))}}`);
  const lit = litFaces();
  rules.push(`.bm-m-window>.bm-lit{background-image:${lit.window}}`, `.bm-m-doorTop>.bm-lit{background-image:${lit.doorTop}}`);
  for (let value = 1; value <= 5; value++) rules.push(`.bm-n${value}{background-image:${gridUrl(digitGrid(value))}}`);
  rules.push(swingKeyframes());
  artCss = rules.join('\n');
  return artCss;
}

// Draw the textures once in idle time after the app loads, so the first reveal's first frame stays light.
if (typeof window !== 'undefined') {
  const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(() => { blockMineArtCss(); }, { timeout: 4000 }); else window.setTimeout(() => { blockMineArtCss(); }, 2500);
}

function ArtStyle() {
  return <style href="block-mine-art" precedence="default">{blockMineArtCss()}</style>;
}

/* ------------------------------------------------------------------ */
/* One measurement per reveal: covers and stage read the same plan.     */
/* ------------------------------------------------------------------ */

/**
 * Chrome that draws above the stage (header, footer), background decor and the
 * reveal's own layers: never obstacles. (Not aria-hidden: the picker hides its
 * name from screen readers while the reveal plays, but it is on screen.)
 */
const NOT_CONTENT = '.reveal-effects-layer, .reveal-cover, .student-show-controls, .student-show-top, .student-show-decor';

/**
 * Boxes of the on-screen text the reveal uncovers (names, station labels, the
 * picked name) plus icons inside the covered cards, so the finale can stand
 * where it hides none of them. One read pass; the layout is already clean.
 */
function measureText(footerTop: number): Rect[] {
  const boxes: Rect[] = [];
  const keep = (rect: DOMRect) => {
    if (rect.width < 2 || rect.height < 2 || rect.bottom <= 0 || rect.top >= footerTop || rect.right <= 0 || rect.left >= window.innerWidth) return;
    boxes.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
  };
  const root = document.querySelector('.student-show') ?? document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue?.trim() || node.parentElement?.closest(NOT_CONTENT)) continue;
    range.selectNodeContents(node);
    keep(range.getBoundingClientRect());
  }
  for (const cover of document.querySelectorAll('.reveal-cover')) {
    for (const icon of cover.parentElement?.querySelectorAll('svg, img') ?? []) if (!icon.closest(NOT_CONTENT)) keep(icon.getBoundingClientRect());
  }
  return boxes;
}

let cachedPlan: BlockMinePlan | null = null;
/** Per reveal: whether an element scrolls its content (see inScroller). */
let scrollers = new WeakMap<Element, boolean>();
function currentPlan(): BlockMinePlan {
  if (cachedPlan) return cachedPlan;
  const targets = measureRevealCovers();
  const footer = document.querySelector('.student-show-controls');
  const footerTop = Math.min(window.innerHeight, footer ? footer.getBoundingClientRect().top : window.innerHeight - 80);
  const header = document.querySelector('.student-show-top');
  const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : undefined;
  cachedPlan = planBlockMine(targets, { width: window.innerWidth, height: window.innerHeight, footerTop, headerBottom }, { text: measureText(footerTop) });
  // Every cover and the stage lay out in the same commit; the next reveal measures afresh.
  queueMicrotask(() => { cachedPlan = null; scrollers = new WeakMap(); });
  return cachedPlan;
}

/**
 * Is the card inside a scroll box of the page (the Today table's wrapper)?
 * There, pieces bursting past the card's edge would grow the scroll area, and
 * a scrollbar popping in mid-reveal would reflow the table under the stage,
 * so the cover clips its burst to the card. The page itself (.student-show)
 * keeps its scrollbar gutter, so team cards burst freely.
 */
function inScroller(element: Element) {
  const path: Element[] = [];
  let found = false;
  for (let node = element.parentElement; node && node !== document.body && !node.classList.contains('student-show'); node = node.parentElement) {
    const known = scrollers.get(node);
    if (known !== undefined) { found = known; break; }
    path.push(node);
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowX + style.overflowY)) { found = true; break; }
  }
  for (const node of path) scrollers.set(node, found);
  return found;
}

const s = (seconds: number) => `${seconds.toFixed(3)}s`;
const round3 = (value: number) => Math.round(value * 1000) / 1000;
/** The SMASH star's texel: twice the tik sparkle's (the pickaxe's own), at most a sixth of the struck block. */
const impactTexel = (k: number, block: number) => Math.max(2, Math.min(k * 2, Math.floor(block / 6)));
/** Swoosh behind the smash: a tapered arc from the wind-up angle down to the block (grip-centred). */
function smearPath(radius: number, k: number) {
  const base = Math.atan2(-(PICKAXE_GRIP.y - PICKAXE_TIP.y), -(PICKAXE_GRIP.x - PICKAXE_TIP.x));
  const from = base + 80 * Math.PI / 180;
  const to = base - 6 * Math.PI / 180;
  const inner = radius - k * 4.4;
  const point = (r: number, a: number) => `${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
  return `M${point(radius, from)}A${radius} ${radius} 0 0 0 ${point(radius, to)}L${point(inner + k * 2.4, to)}A${inner} ${inner} 0 0 1 ${point(radius - k * .4, from)}Z`;
}

const list = (items: string[]) => items.join(', ');

/* ------------------------------------------------------------------ */
/* Cover: each card becomes a chunk of pixel blocks.                    */
/* ------------------------------------------------------------------ */

const Chunk = memo(function Chunk({ card }: { card: CardPlan }) {
  const { wall } = card;
  const faceWidth = wall.cols * wall.blockWidth;
  const faceHeight = wall.rows * wall.blockHeight;
  // Every smash drops the whole chunk 4 px for one frame (after the tremble, so it wins).
  const smashes = card.aims.map((_, i) => smashTime(card.firstSlot + i));
  const shake = list([
    ...card.jolts.map((time) => `bm-jolt .13s ease-out ${s(time)}`),
    ...card.windups.map((time) => `bm-tremble .18s linear ${s(time + .02)}`),
    ...smashes.map((time) => `bm-drop .04s step-end ${s(time)}`),
  ]);
  // The block struck at each smash blinks its white rim at full strength for both steps.
  const smashedAt = (index: number) => card.aims.flatMap((aim, i) => aim === index ? [smashes[i]] : []);
  return <>
    <div className="bm-backing" style={{ animationDelay: s(card.clearAt) }} />
    <div className="bm-chunk">
      <div className="bm-shake" style={{ animation: shake }}>
        <div className="bm-interior" style={{ left: wall.inset, top: wall.inset + wall.depth, width: Math.round(faceWidth), height: Math.round(faceHeight), animationDelay: s(card.clearAt) }} />
        {card.blocks.map((block, i) => {
          const box = blockBox(wall, block.col, block.row);
          return <div key={i} className={`bm-block bm-m-${block.material}${block.material === 'gem' ? ' is-gem' : ''}`} style={{ left: box.left, top: box.top, width: box.width, height: box.height, '--dx': `${block.dx}px`, '--dy': `${block.dy}px`, '--spin': `${block.spin}deg`, animationDelay: s(block.breakAt) } as CSSProperties}>
            <i className="bm-front" />
            {block.row === 0 && wall.depth > 0 && <i className="bm-top" style={{ height: wall.depth }} />}
            {block.col === wall.cols - 1 && wall.depth > 0 && <i className="bm-side" style={{ width: wall.depth }} />}
            {block.cracks[0] < NEVER && <i className={`bm-crack is-v${block.variant}`} style={{ animation: list(block.cracks.flatMap((at, stage) => at < NEVER ? [`bm-c${stage + 1} 1ms linear ${s(at)} forwards`] : [])) }} />}
            {/* Each tik: a thin white rim (half a texel) that blinks full, then half; on the SMASH it stays full for both steps. The impact stars are on the stage. */}
            {block.hits.length > 0 && <i className="bm-hit" style={{ borderWidth: Math.max(2, Math.round(box.width / 32)), animation: list([...block.hits.map((time) => `bm-hit .12s step-end ${s(time)}`), ...smashedAt(i).map((time) => `bm-hit-big .12s linear ${s(time)}`)]) }} />}
            {/* The gem ore glows and twinkles from frame 0 until it breaks (a set number of loops, never forever). */}
            {block.material === 'gem' && <><i className="bm-gem-glow" style={{ animationIterationCount: Math.ceil(block.breakAt / .7) }} /><i className="bm-sparkle is-pink" style={{ left: '14%', top: '10%', animationIterationCount: Math.ceil(block.breakAt / .9) }} /><i className="bm-sparkle" style={{ left: '66%', top: '58%', animationDelay: '-.45s', animationIterationCount: Math.ceil((block.breakAt + .45) / .9) }} /></>}
          </div>;
        })}
        {card.debris.map((i) => {
          const block = card.blocks[i];
          const box = blockBox(wall, block.col, block.row);
          const size = Math.round(Math.max(box.width, box.height) * (card.debris.length < card.blocks.length ? 1.6 : 1.25));
          return <i key={`d${i}`} className={`bm-debris bm-d-${block.material} is-v${(block.variant + block.col + block.row) % 3}`} style={{ left: box.left + box.width / 2 - size / 2, top: box.top + box.height / 2 - size / 2, width: size, height: size, animationDelay: s(block.breakAt) }} />;
        })}
      </div>
    </div>
  </>;
});

/**
 * True once `seconds` of the reveal have passed: one timer per cover, no
 * per-frame work. It trusts performance.now() over the timer, so a paused or
 * frozen clock (the review lab's still frames) never drops a chunk early.
 */
function useDoneAfter(seconds: number | undefined) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (seconds === undefined) return;
    const start = performance.now();
    let timer = 0;
    const check = () => {
      const left = seconds * 1000 - (performance.now() - start);
      if (left <= 8) setDone(true); else timer = window.setTimeout(check, Math.max(60, left));
    };
    timer = window.setTimeout(check, seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);
  return done;
}

function BlockMineCover() {
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ card: CardPlan | null; clipped: boolean } | null>(null);
  useLayoutEffect(() => {
    const cover = root.current?.parentElement;
    if (!cover) return;
    // Measured once per reveal (the first cover measures them all), before paint.
    const plan = currentPlan();
    const index = Number(cover.style.getPropertyValue('--reveal-index'));
    setState({ card: plan.cards[Number.isFinite(index) ? index : 0] ?? null, clipped: inScroller(cover) });
  }, []);
  // Once its burst is over, the card drops its chunk: nothing left to composite or restyle.
  const done = useDoneAfter(state?.card?.doneAt);
  return <div ref={root} className={`bm-cover${state?.clipped ? ' is-clipped' : ''}`}>
    <ArtStyle />
    {done ? null : state?.card ? <Chunk card={state.card} /> : <div className="bm-backing is-fallback" />}
  </div>;
}

/* ------------------------------------------------------------------ */
/* Stage: pickaxe, mini cubes, hotbar and the little house.             */
/* ------------------------------------------------------------------ */

function ObliqueBlock({ material, size, depth, top = true, side = true, children }: { material: HouseMaterial; size: number; depth: number; top?: boolean; side?: boolean; children?: ReactNode }) {
  return <div className={`bm-oblique bm-m-${material}`} style={{ width: size, height: size }}>
    <i className="bm-front" />
    {top && <i className="bm-top" style={{ height: depth }} />}
    {side && <i className="bm-side" style={{ width: depth }} />}
    {children}
  </div>;
}

function Cube({ material, size }: { material: HouseMaterial; size: number }) {
  return <div className={`bm-cube bm-m-${material}`} style={{ '--c': `${size}px` } as CSSProperties}>
    <i className="bm-f bm-f-front" /><i className="bm-f bm-f-back" /><i className="bm-f bm-f-left" /><i className="bm-f bm-f-right" /><i className="bm-f bm-f-top" /><i className="bm-f bm-f-bottom" />
  </div>;
}

const StageScene = memo(function StageScene({ plan }: { plan: BlockMinePlan }) {
  const { hotbar, house, viewport } = plan;
  /** The gem item is 16 texels at an integer scale (it doubles at its hero moment). */
  const gemItem = plan.gemSize;
  const lightsOn = house.gemLandAt + LIGHTS_ON_DELAY_S;
  // The cottage's ground shadow: one texel of the cottage's own blocks, growing as the lawn lands.
  const texel = house.block / 16;
  const lawnLands = house.placements.filter((p) => p.row === 0).map((p) => p.landAt);
  const early = hotbar.exitAt !== undefined && hotbar.exitAt < EXIT_START_S;
  // The crown gem's spot; hearts float up off it, but stay below the app header.
  const crown = house.placements.find((p) => p.material === 'gem');
  const { heart, heartRise } = house;
  // Hotbar sprites at whole-pixel texel scales: the 18-texel pickaxe icon and the 5x7-texel digits.
  const toolIcon = toolIconSize(hotbar.slotSize);
  const digit = Math.max(2, Math.round(hotbar.slotSize * .3 / 5));
  const slotStartS = slotStart;
  const pickExitAt = LAST_SMASH_S + PICK_EXIT_DELAY_S;
  return <div className="bm-stage">
    {/* Pickaxes: hop in, three ticks, wind up, SMASH, follow through. */}
    {plan.pickaxes.map((cue, i) => {
      const k = cue.scale;
      const tipX = (PICKAXE_GRIP.x - PICKAXE_TIP.x) * k;
      const tipY = (PICKAXE_GRIP.y - PICKAXE_TIP.y) * k;
      const end = cue.exits ? pickExitAt + PICK_EXIT_S : cue.hideAt;
      const ticks = TICK_OFFSETS_S.map((_, t) => tickTime(cue.slot, t));
      const smash = smashTime(cue.slot);
      const reachR = Math.round(Math.hypot(tipX, tipY) + k * 2);
      return <div key={i} className="bm-pick" style={{ left: cue.x, top: cue.y, animation: `bm-window ${s(end - cue.enterAt)} linear ${s(cue.enterAt)}` }}>
        <div className="bm-pick-travel" style={{
          '--fx': `${cue.fromX - cue.x}px`, '--fy': `${cue.fromY - cue.y}px`, '--lift': `${cue.lift}px`, '--turn': cue.slot === 0 ? '-360deg' : '-24deg', '--fs': cue.fromScale, '--fm': cue.midScale,
          ...(cue.home ? { '--hx': `${cue.home.x}px`, '--hy': `${cue.home.y}px`, '--hlift': `${cue.home.lift}px`, '--hs': cue.home.scale } : {}),
          animation: list([`bm-pick-travel ${s(cue.enterFor)} cubic-bezier(.35,.1,.3,1) ${s(cue.enterAt)} both`, ...(cue.home ? [`bm-pick-home ${s(PICK_EXIT_S)} linear ${s(pickExitAt)} forwards`] : [])]),
        } as CSSProperties}>
          <div className="bm-pick-mirror" style={cue.mirror ? { transform: 'scaleX(-1)' } : undefined}><div className="bm-pick-grip" style={{ left: tipX, top: tipY }}>
            <svg className="bm-smear" style={{ left: -reachR, top: -reachR, width: reachR * 2, height: reachR * 2, animationDelay: s(smash - .05) }} viewBox={`${-reachR} ${-reachR} ${reachR * 2} ${reachR * 2}`} aria-hidden="true">
              <path d={smearPath(reachR - k * 1.5, k)} />
            </svg>
            <div className="bm-pick-swing" style={{ animation: `bm-swing ${s(SWING_LENGTH_S)} linear ${s(slotStartS(cue.slot) + TRAVEL_S)} both` }}>
              <i className="bm-pick-sprite" style={{ width: PICKAXE_SIZE * k, height: PICKAXE_SIZE * k, left: -PICKAXE_GRIP.x * k, top: -PICKAXE_GRIP.y * k }} />
            </div>
          </div></div>
        </div>
        <i className="bm-spark" style={{ '--size': `${Math.round(k * 7)}px`, animation: list([...ticks.map((time) => `bm-spark .16s ease-out ${s(time)}`), `bm-spark-big .3s ease-out ${s(smash + .05)}`]) } as CSSProperties} />
        {/* SMASH: a chunky pixel star at twice the tik sparkle's texel size, full size on the hit frame itself. */}
        <i className="bm-impact" style={{ '--size': `${7 * impactTexel(k, cue.blockSize)}px`, animation: `bm-impact .14s step-end ${s(smash)}` } as CSSProperties} />
      </div>;
    })}

    {/* Mini cubes pop, bob and zip into the hotbar. */}
    {plan.cubes.map((cube) => {
      const flight = s(cube.gem ? GEM_FLIGHT_S : CUBE_FLIGHT_S);
      const timing = { animationDelay: s(cube.popAt), animationDuration: flight };
      // Each cube turns only while it flies, starting at its own phase of the 1.2 s turn.
      const phase = (cube.id * .37) % 1.2;
      return <div key={cube.id} className={`bm-cube-x${cube.gem ? ' is-gem' : ''}`} style={{ left: cube.x, top: cube.y, '--dx': `${cube.dx}px`, '--tx': `${cube.targetX}px`, '--hx': `${cube.heroX}px`, ...timing } as CSSProperties}>
        <div className="bm-cube-y" style={{ '--apex': `${cube.apex}px`, '--rest': `${cube.rest}px`, '--ty': `${cube.targetY}px`, '--hy': `${cube.heroY}px`, ...timing } as CSSProperties}>
          <div className="bm-cube-s" style={{ ...timing, '--end': cube.end } as CSSProperties}>
            {cube.gem ? <>
              <div className="bm-rays-env" style={timing}><i className="bm-rays" style={{ width: gemItem * 2.2, height: gemItem * 2.2, animationDelay: s(cube.popAt + GEM_FLIGHT_S * .4), animationIterationCount: 3 }} /></div>
              <i className="bm-cube-glow" />
              {[0, 1, 2, 3].map((i) => <i key={i} className={`bm-gem-twinkle${i % 2 ? ' is-pink' : ''}`} style={{ '--a': `${i * 90 + 35}deg`, '--r': `${Math.round(gemItem * (.62 + (i % 2) * .16))}px`, width: pixelSize(7, gemItem * .34), height: pixelSize(7, gemItem * .34), animationDelay: s(cube.popAt + GEM_POP_S + GEM_DRIFT_S + i * .09) } as CSSProperties} />)}
              {/* Two coin-flips as it pops and drifts, landing face-on for its hero moment; one quick flip on the dive. */}
              <i className="bm-gem-item" style={{ width: gemItem, height: gemItem, left: -gemItem / 2, top: -gemItem / 2, animation: `bm-gem-flip ${s(GEM_FLIGHT_S)} linear ${s(cube.popAt)} both` }} />
              <i className="bm-gem-glint" style={{ width: gemItem, height: gemItem, left: -gemItem / 2, top: -gemItem / 2, animationDelay: s(cube.popAt + GEM_POP_S + GEM_DRIFT_S + GEM_GLINT_DELAY_S) }} />
            </> : <div className="bm-cube-turn" style={{ animationDirection: cube.spin < 0 ? 'reverse' : 'normal', animationDelay: s(cube.popAt - phase), animationIterationCount: round3((phase + CUBE_FLIGHT_S) / 1.2) }}><Cube material={cube.material} size={cube.size} /></div>}
          </div>
        </div>
      </div>;
    })}

    {/* The finale cottage: blocks hop out of the hotbar (flights), land in the cottage (yard), and the gem crowns it. */}
    <div className="bm-flights">
      {house.placements.map((p) => <div key={p.id} className="bm-hfly" style={{ left: p.x, top: p.y, width: house.block, height: house.block, '--fx': `${p.fromX}px`, '--fy': `${p.fromY}px`, '--mx': `${p.midX}px`, '--my': `${p.midY}px`, animationDelay: s(p.leaveAt), animationDuration: s(p.landAt - p.leaveAt) } as CSSProperties}>
        {p.material === 'gem' ? <i className="bm-gem-item" style={{ width: house.block, height: house.block }} /> : <ObliqueBlock material={p.material} size={house.block} depth={house.depth} top={p.top} side={p.side} />}
      </div>)}
    </div>
    {/* The yard ends at the cottage's ground line: at the exit the cottage sinks into its own ground, never across a card or behind the footer. */}
    <div className="bm-yard" style={{ height: house.bottom + texel }}>
      <i className="bm-house-shadow" style={{ left: house.left - texel, top: house.bottom, width: house.block * 5 + house.depth + texel, height: texel, animation: list([`bm-shadow-in ${s(lawnLands[lawnLands.length - 1] - lawnLands[0] + .01)} steps(${lawnLands.length}, start) ${s(lawnLands[0])} forwards`, `bm-shadow-out ${s(EXIT_END_S - EXIT_START_S)} cubic-bezier(.5,0,.9,.5) ${s(EXIT_START_S)} forwards`]) }} />
      <div className="bm-house" style={{ '--sink': `${Math.round(house.block * 6.8)}px`, transformOrigin: `${house.left + house.block * 2.5}px ${house.bottom}px`, animation: list([`bm-house-hop .42s ease-out ${s(house.gemLandAt + .04)}`, `bm-sink ${s(EXIT_END_S - EXIT_START_S)} cubic-bezier(.5,-0.4,.9,.5) ${s(EXIT_START_S)} forwards`]) } as CSSProperties}>
        {house.placements.map((p) => <div key={p.id} className="bm-hland" style={{ left: p.x, top: p.y, width: house.block, height: house.block, animationDelay: s(p.landAt) }}>
          {p.material === 'gem'
            ? <div className="bm-crown" style={{ animationDelay: s(p.landAt + .2), animationIterationCount: Math.ceil((EXIT_END_S - p.landAt - .2) / 1.1) }}><i className="bm-gem-glow" style={{ animationDelay: s(p.landAt), animationIterationCount: Math.ceil((EXIT_END_S - p.landAt) / .7) }} /><i className="bm-gem-item" style={{ width: house.block, height: house.block }} /></div>
            : <ObliqueBlock material={p.material} size={house.block} depth={house.depth} top={p.top} side={p.side}>
              {(p.material === 'window' || p.material === 'doorTop') && <i className="bm-lit" style={{ animationDelay: s(lightsOn + (p.col % 3) * .06) }} />}
            </ObliqueBlock>}
        </div>)}
      </div>
    </div>
    {/* Sparkles burst off the crown and hearts float up and pop: they never sink with the cottage. */}
    {crown && <div className="bm-gem-burst" style={{ left: crown.x + house.block / 2, top: crown.y + house.block / 2 }}>
      {Array.from({ length: 6 }, (_, i) => <i key={i} className={`bm-sparkle${i % 2 ? ' is-pink' : ''}`} style={{ '--a': `${i * 60 + 15}deg`, '--r': `${house.block * (1.4 + (i % 3) * .3)}px`, width: pixelSize(7, house.block * .42), height: pixelSize(7, house.block * .42), animationDelay: s(house.gemLandAt + i * .02) } as CSSProperties} />)}
      {house.hearts.map((side) => <i key={`h${side}`} className="bm-heart" style={{ left: -heart / 2, top: -heart / 2, '--hx': `${side * house.block * 1.1}px`, '--rise': `${-heartRise}px`, width: heart, height: heart, animationDelay: s(house.gemLandAt + .22 + side * .1), animationDuration: s(HEART_S) } as CSSProperties} />)}
    </div>}

    {/* Hotbar: rises from behind the footer, counts up, shines, then sinks back behind it (clipped at the footer line, so it never shows through). */}
    <div className="bm-ground" style={{ height: viewport.footerTop }}>
      <div className="bm-hotbar" style={{ '--sink': `${Math.round(viewport.footerTop - hotbar.top + 6)}px`, left: hotbar.centerX - hotbar.width / 2, top: hotbar.top, width: hotbar.width, height: hotbar.height, animation: list([`bm-rise ${s(HOTBAR_RISE_S[1] - HOTBAR_RISE_S[0])} cubic-bezier(.3,1.5,.5,1) ${s(HOTBAR_RISE_S[0])} both`, early ? `bm-sink ${s(HOTBAR_EARLY_SINK_S)} cubic-bezier(.55,0,.9,.5) ${s(HOTBAR_EARLY_EXIT_S)} forwards` : `bm-sink ${s(EXIT_END_S - EXIT_START_S)} cubic-bezier(.5,-0.4,.9,.5) ${s(EXIT_START_S)} forwards`]) } as CSSProperties}>
        <i className="bm-hotbar-frame" />
        <div className="bm-slot is-tool" style={{ left: hotbar.tool.x - hotbar.slotSize / 2 - (hotbar.centerX - hotbar.width / 2), top: hotbar.padding, width: hotbar.slotSize, height: hotbar.slotSize, animation: `bm-bump .24s ease-out ${s(pickExitAt + PICK_EXIT_S)}` }}>
          <i className="bm-tool-icon" style={{ width: toolIcon, height: toolIcon, left: (hotbar.slotSize - toolIcon) / 2, top: (hotbar.slotSize - toolIcon) / 2, animation: list([`bm-hide 1ms linear ${s(PICK_ENTER_S)} forwards`, `bm-unhide 1ms linear ${s(pickExitAt + PICK_EXIT_S - .01)} forwards`]) }} />
        </div>
        {HOTBAR_KINDS.map((kind, k) => {
          const slot = hotbar.slots[k];
          const first = hotbar.counts[k][0]?.from;
          const icon = slotIconSize(hotbar.slotSize);
          const gemIcon = gemIconSize(hotbar.slotSize);
          // Once its last block has hopped into the cottage, the slot dims back to a ghost: the haul became the house.
          const leaves = house.placements.filter((p) => p.kind === kind).map((p) => p.leaveAt);
          const emptyAt = leaves.length ? Math.max(...leaves) : undefined;
          const iconAnimation = first === undefined ? 'none' : list([`bm-unghost 1ms linear ${s(first)} forwards`, ...(emptyAt === undefined ? [] : [`bm-drain .26s ease-out ${s(emptyAt)} forwards`])]);
          return <div key={kind} className="bm-slot" style={{ left: slot.x - hotbar.slotSize / 2 - (hotbar.centerX - hotbar.width / 2), top: hotbar.padding, width: hotbar.slotSize, height: hotbar.slotSize, animation: list(hotbar.bumps[k].map((time) => `bm-bump .22s ease-out ${s(time)}`)) }}>
            <i className="bm-slot-flash" style={{ animation: list(hotbar.bumps[k].slice(0, hotbar.counts[k].length).map((time) => `bm-flash .3s step-end ${s(time)}`)) }} />
            <div className="bm-slot-icon" style={{ animation: iconAnimation }}>
              {kind === 'gem'
                ? <i className="bm-gem-item" style={{ width: gemIcon, height: gemIcon, left: -gemIcon / 2, top: -gemIcon / 2 }} />
                : <ObliqueBlock material={KIND_ICON[kind]} size={icon} depth={Math.round(icon * .3)} />}
            </div>
            {kind === 'gem' && first !== undefined && <div className="bm-gem-burst" style={{ left: '50%', top: '50%' }}>
              {Array.from({ length: 5 }, (_, i) => <i key={i} className={`bm-sparkle${i % 2 ? '' : ' is-pink'}`} style={{ '--a': `${i * 72 - 90}deg`, '--r': `${Math.round(hotbar.slotSize * .95)}px`, width: pixelSize(7, hotbar.slotSize * .36), height: pixelSize(7, hotbar.slotSize * .36), animationDelay: s(first) } as CSSProperties} />)}
            </div>}
            {hotbar.counts[k].filter((count) => count.value > 0).map((count, i) => <i key={i} className={`bm-count bm-n${count.value}`} style={{ width: digit * 5, height: digit * 7, animation: `bm-window ${s(count.to - count.from)} linear ${s(count.from)}` }} />)}
          </div>;
        })}
        <i className="bm-hotbar-shine" style={{ animationDelay: s(HOTBAR_SHINE_S) }} />
      </div>
    </div>
    <i className="bm-viewport" data-width={viewport.width} />
  </div>;
});

function BlockMineStage() {
  const [plan, setPlan] = useState<BlockMinePlan | null>(null);
  useLayoutEffect(() => {
    const apply = () => setPlan(currentPlan());
    apply();
  }, []);
  return <>
    <ArtStyle />
    {plan && <StageScene plan={plan} />}
  </>;
}

export const blockMineEffect: RevealEffect = {
  id: 'block-mine', name: 'Block mine · Dig & build',
  description: 'Every card turns into chunky pixel blocks. A pickaxe goes tik-tik-tik-CRACK, mini cubes bob into the hotbar, a rare gem sparkles, and the haul builds a little house.',
  durationMs: BLOCK_MINE_DURATION_MS, sound: 'block-mine', Stage: BlockMineStage, Cover: BlockMineCover,
};
