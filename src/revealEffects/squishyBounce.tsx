import { memo, useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { RevealEffect } from './types';
import { LANDINGS, SQUISHY_DURATION_MS } from './squishyBounceTimeline';
import { measureRevealCovers } from './revealTargets';
import { coverClip, geometryVars, planSquishyBounce, restBand, varsToCss, type Box, type Rect } from './squishyBouncePlan';
import './squishyBounce.css';

// Squishy bounce: a mint gumdrop bounces across sleepy squishy pillows,
// belly-flops SPLAT, and every pillow boings away to reveal its card.
// The Stage plans once (a pure layout planner), writes CSS variables to itself
// and to every cover, and then does no JS work at all: everything that moves
// is a CSS keyframe animation of transform/opacity.

const INK = '#243238';
const COVER_SELECTOR = '.reveal-cover[data-reveal-effect="squishy-bounce"] .sq-cover';

function Line({ d, width = 3.4 }: { d: string; width?: number }) {
  return <path d={d} fill="none" stroke={INK} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />;
}
function Eye({ x, y = 64, rx = 4.8, ry = 6.2 }: { x: number; y?: number; rx?: number; ry?: number }) {
  return <><ellipse cx={x} cy={y} rx={rx} ry={ry} fill={INK} /><circle cx={x + rx * .36} cy={y - ry * .42} r={rx * .38} fill="#fff" /></>;
}

/** The buddy "Gumdrop": a 100x100 box, feet at (50, 100). Every face is drawn once; CSS shows one at a time. */
const Gumdrop = memo(function Gumdrop() {
  return <svg className="sqb-art" viewBox="0 0 100 100" overflow="visible" aria-hidden="true">
    <defs>
      <radialGradient id="sqb-jelly" cx=".36" cy=".34" r=".78"><stop offset="0" stopColor="#E4FDF4" /><stop offset=".35" stopColor="#9BEDD2" /><stop offset=".72" stopColor="#6CDBB8" /><stop offset="1" stopColor="#3DBF99" /></radialGradient>
      <linearGradient id="sqb-rim" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stopColor="#3DBF99" stopOpacity="0" /><stop offset="1" stopColor="#2FA886" stopOpacity=".55" /></linearGradient>
    </defs>
    <g className="sqb-extra-rise" opacity="0"><path d="M30 104v14M50 106v20M70 104v14" stroke="#7FE3C3" strokeWidth="4" strokeLinecap="round" /></g>
    <g className="sqb-extra-fall" opacity="0"><path d="M28 2v-16M50-2v-22M72 2v-16" stroke="#7FE3C3" strokeWidth="4" strokeLinecap="round" /></g>
    <path d="M16 99C7 99 4 93 5 84C7 58 21 13 50 10C79 13 93 58 95 84C96 93 93 99 84 99Z" fill="url(#sqb-jelly)" />
    <path d="M16 99C7 99 4 93 5 84C7 58 21 13 50 10C79 13 93 58 95 84C96 93 93 99 84 99Z" fill="url(#sqb-rim)" stroke="#2A9277" strokeWidth="3" strokeLinejoin="round" />
    <ellipse cx="50" cy="84" rx="28" ry="11" fill="#D4FAEC" opacity=".5" />
    <ellipse cx="31" cy="36" rx="7" ry="13" transform="rotate(32 31 36)" fill="#fff" opacity=".9" />
    <circle cx="27" cy="57" r="3" fill="#fff" opacity=".75" />
    <g fill="#fff" opacity=".8"><rect x="62" y="24" width="4" height="4" rx="1" transform="rotate(20 64 26)" /><rect x="74" y="42" width="3.2" height="3.2" rx="1" transform="rotate(-15 75 43)" /><rect x="19" y="70" width="3" height="3" rx="1" transform="rotate(30 20 71)" /></g>
    <g className="sqb-cheeks"><ellipse cx="28" cy="75" rx="6.5" ry="3.8" fill="#FF9EB8" opacity=".8" /><ellipse cx="72" cy="75" rx="6.5" ry="3.8" fill="#FF9EB8" opacity=".8" /></g>
    <g className="sqb-face sqb-face-happy"><Eye x={39} /><Eye x={61} /><Line d="M44 77Q50 83 56 77" /></g>
    <g className="sqb-face sqb-face-sly">
      <path d="M35 63h10a5 5.5 0 0 1-10 0Z" fill={INK} /><path d="M57 63h10a5 5.5 0 0 1-10 0Z" fill={INK} />
      <circle cx="42.5" cy="65" r="1.3" fill="#fff" /><circle cx="64.5" cy="65" r="1.3" fill="#fff" />
      <Line d="M34 60.5h12M56 60.5h12" /><Line d="M43 77Q52 82 59 74" />
    </g>
    <g className="sqb-face sqb-face-whee"><Line d="M34 66Q39 58 44 66M56 66Q61 58 66 66" /><path d="M42 74Q50 90 58 74Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" /><ellipse cx="50" cy="81.5" rx="4" ry="2.4" fill="#FF7FA0" /></g>
    <g className="sqb-face sqb-face-squint"><Line d="M35 60l7 4-7 4M65 60l-7 4 7 4" /><ellipse cx="50" cy="78" rx="3.6" ry="4" fill={INK} /></g>
    <g className="sqb-face sqb-face-ready"><Eye x={39} y={65} rx={4.4} ry={5.2} /><Eye x={61} y={65} rx={4.4} ry={5.2} /><Line d="M32 55l12 3M68 55l-12 3M42 76Q50 82 58 76" /></g>
    <g className="sqb-face sqb-face-uhoh">
      <circle cx="38" cy="61" r="9" fill="#fff" stroke={INK} strokeWidth="2.2" /><circle cx="62" cy="61" r="9" fill="#fff" stroke={INK} strokeWidth="2.2" />
      <circle cx="38" cy="65.5" r="4" fill={INK} /><circle cx="62" cy="65.5" r="4" fill={INK} /><circle cx="39.3" cy="64" r="1.2" fill="#fff" /><circle cx="63.3" cy="64" r="1.2" fill="#fff" />
      <Line d="M30 50l10-4.5M70 50l-10-4.5" width={2.6} /><Line d="M42 82q2-2.6 4 0t4 0 4 0 4 0" />
      <path d="M85 24q8 12 0 17q-8-5 0-17Z" fill="#AEE0FF" stroke="#5DAEE0" strokeWidth="1.6" /><ellipse cx="83" cy="35" rx="1.3" ry="2.2" fill="#fff" />
    </g>
    <g className="sqb-face sqb-face-fall"><Line d="M33 58l9 5-9 5M67 58l-9 5 9 5" /><ellipse cx="50" cy="79" rx="4.8" ry="6" fill={INK} /></g>
    {/* Drawn in on-screen proportions, then pre-stretched by the inverse of the pancake squash (PANCAKE). */}
    <g className="sqb-face sqb-face-pancake"><g transform="translate(50 54.5) scale(.4545 2.632) translate(-50 -54.5)">
      <Line d="M26 50a2.5 2.5 0 0 1 5 0a5 5 0 0 1-10 0a7.5 7.5 0 0 1 15 0M69 50a2.5 2.5 0 0 1 5 0a5 5 0 0 1-10 0a7.5 7.5 0 0 1 15 0" width={3} />
      <Line d="M39 62.5q2.75-3.2 5.5 0t5.5 0 5.5 0 5.5 0" width={3} />
    </g></g>
    <g className="sqb-face sqb-face-relieved"><Line d="M34 63Q39 68 44 63M56 63Q61 68 66 63M45 77Q50 81 55 77" /></g>
    <g className="sqb-face sqb-face-wink"><Eye x={39} /><Line d="M56 66Q61 58 66 66" /><path d="M42 74Q50 89 58 74Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" /><ellipse cx="50" cy="81" rx="4" ry="2.4" fill="#FF7FA0" /></g>
  </svg>;
});

/** Splash droplets: static offsets in buddy-size units (em). */
const DROPS = Array.from({ length: 8 }, (_, i) => {
  const angle = -Math.PI * (.08 + .84 * i / 7);
  const reach = 1.3 + (i % 3) * .35;
  const lift = .9 + (i % 2) * .4;
  return { '--dx': `${(Math.cos(angle) * reach).toFixed(3)}em`, '--dy': `${(Math.sin(angle) * lift).toFixed(3)}em`, '--dr': `${Math.round(Math.atan2(Math.sin(angle) * lift, Math.cos(angle) * reach) * 180 / Math.PI - 90)}deg` } as CSSProperties;
});

/** Three short strokes each side of the feet, in buddy units (100 = B), radiating from the squashed body's edge. */
const IMPACT_STROKES = 'M-66-3H-92M-62-17-83-31M-55-29-66-50M66-3H92M62-17 83-31M55-29 66-50';

const StageArt = memo(function StageArt() {
  return <>
    {LANDINGS.map((_, k) => <i key={k} className={`sqb-impact sqb-impact-${k + 1}`}><svg viewBox="-100 -70 200 80" aria-hidden="true"><path d={IMPACT_STROKES} fill="none" stroke="#2A9277" strokeWidth="7" strokeLinecap="round" /></svg></i>)}
    <div className="sqb-x">
      <div className="sqb-shadow-y"><i className="sqb-shadow" /></div>
      <div className="sqb-y">
        {/* The splat FX ride the buddy's Y track, so they sink with the squashed pillow. */}
        <div className="sqb-splat-at">
          <i className="sqb-shock" /><i className="sqb-shock sqb-shock-2" />
          <svg className="sqb-star" viewBox="-50 -50 100 100" aria-hidden="true"><path d="M0-46 8-24 25-39 20-15 45-18 26 0 45 18 20 15 25 39 8 24 0 46-8 24-25 39-20 15-45 18-26 0-45-18-20-15-25-39-8-24Z" fill="#fff" stroke="#2A9277" strokeWidth="4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>
          {DROPS.map((style, k) => <i key={k} className="sqb-drop" style={style} />)}
        </div>
        <div className="sqb-spin"><div className="sqb-body"><Gumdrop /></div></div>
        <div className="sqb-dizzy sqb-extra-dizzy">{[1, 2, 3].map((k) => <i key={k} className={`sqb-orbit sqb-orbit-${k}`}><svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-9.5 2.8-3.4 9.3-2.6 4.4 1.9 5.7 8.4 0 5.1-5.7 8.4-4.4 1.9-9.3-2.6-2.8-3.4Z" fill="#FFE27A" stroke="#D99A2B" strokeWidth="1.6" strokeLinejoin="round" /></svg></i>)}</div>
        <svg className="sqb-sparkle" viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-10C1-2 2-1 10 0C2 1 1 2 0 10C-1 2-2 1-10 0C-2-1-1-2 0-10Z" fill="#FFF6C8" stroke="#F2C94C" strokeWidth="1.2" /></svg>
      </div>
    </div>
  </>;
});

/** The client area of the nearest scrolling ancestor (fixed covers escape it, so they are clipped to it by hand). */
function scrollerView(host: Element, cache: Map<Element, Rect | null>): Rect | null {
  const walked: Element[] = [];
  let node = host.parentElement;
  let view: Rect | null = null;
  while (node && node !== document.documentElement) {
    const cached = cache.get(node);
    if (cached !== undefined) { view = cached; break; }
    walked.push(node);
    const style = getComputedStyle(node);
    if (/auto|scroll/.test(style.overflowX + style.overflowY)) {
      const box = node.getBoundingClientRect();
      view = { left: box.left + node.clientLeft, top: box.top + node.clientTop, width: node.clientWidth, height: node.clientHeight };
      break;
    }
    node = node.parentElement;
  }
  for (const element of walked) cache.set(element, view);
  return view;
}

const REPLACED = /^(img|svg|canvas|video|picture|input|button|select|textarea)$/i;
const BADGE_MAX = 96;

/**
 * Labels near the footer (text, icons, small coloured badges) inside the cards' shared container, in viewport px:
 * the buddy must not rest on them once the cards are revealed. One read-only walk that skips every subtree
 * outside the band and every reveal cover; it runs in the same read pass as the card measurements.
 */
function labelBoxes(hosts: readonly Element[], band: { top: number; bottom: number }, views: Map<Element, Rect | null>): Box[] {
  let root = hosts[0]?.parentElement ?? null;
  while (root && !hosts.every((host) => root!.contains(host))) root = root.parentElement;
  if (!root) return [];
  const view = scrollerView(root, views) ?? { left: -Infinity, top: -Infinity, width: Infinity, height: Infinity };
  const boxes: Box[] = [];
  const add = (r: DOMRect | DOMRectReadOnly) => {
    const left = Math.max(r.left, view.left);
    const right = Math.min(r.right, view.left + view.width);
    const top = Math.max(r.top, view.top);
    const bottom = Math.min(r.bottom, view.top + view.height);
    if (right - left >= 1 && bottom - top >= 1 && bottom > band.top && top < band.bottom) boxes.push({ left, top, width: right - left, height: bottom - top });
  };
  const range = document.createRange();
  const stack: Element[] = [root];
  while (stack.length) {
    const element = stack.pop()!;
    if (element.classList.contains('reveal-cover')) continue;
    const r = element.getBoundingClientRect();
    const sized = r.width > 0 || r.height > 0;
    if (sized && (r.bottom <= band.top || r.top >= band.bottom)) continue;
    if (REPLACED.test(element.tagName)) { add(r); continue; }
    if (sized && r.width <= BADGE_MAX && r.height <= BADGE_MAX && element !== root) {
      const style = getComputedStyle(element);
      if (style.backgroundImage !== 'none' || !/^(transparent|rgba\(.*,\s*0\))$/.test(style.backgroundColor)) add(r);
    }
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!child.textContent?.trim()) continue;
        range.selectNodeContents(child);
        for (const rect of Array.from(range.getClientRects())) add(rect);
      } else if (child.nodeType === Node.ELEMENT_NODE) stack.push(child as Element);
    }
  }
  return boxes;
}

function measure(): { covers: HTMLElement[]; rects: Rect[]; labels: Box[] } {
  const covers = Array.from(document.querySelectorAll<HTMLElement>(COVER_SELECTOR));
  const views = new Map<Element, Rect | null>();
  // Measure the host .reveal-cover (it fills the card and is never transformed by this effect).
  const hosts = covers.map((cover) => cover.parentElement ?? cover);
  const rects = hosts.map((host): Rect => {
    const r = host.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height, view: scrollerView(host, views) ?? undefined };
  });
  const labels = labelBoxes(hosts.map((host) => host.parentElement ?? host), restBand({ width: window.innerWidth, height: window.innerHeight }), views);
  return { covers, rects, labels };
}

function applyClip(cover: HTMLElement, rect: Rect) {
  const clip = coverClip(rect);
  if (clip === 'hidden') cover.dataset.sqHidden = '';
  else delete cover.dataset.sqHidden;
  const value = clip && clip !== 'hidden' ? clip : '';
  // Older WebKit only knows the prefixed property.
  cover.style.setProperty('-webkit-clip-path', value);
  cover.style.clipPath = value;
}

function applyLowered(cover: HTMLElement, lowered: boolean) {
  if (lowered) cover.dataset.sqLowered = '';
  else delete cover.dataset.sqLowered;
}

function SquishyBounceStage() {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const stage = root.current;
    if (!stage) return;
    const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
    // One read pass, one plan, one write pass (a single cssText append per cover).
    const { covers, rects, labels } = measure();
    const plan = planSquishyBounce(rects, viewport(), labels);
    covers.forEach((cover, index) => {
      const { vars, tone, hits, breathe, lowered } = plan.covers[index];
      cover.style.cssText += varsToCss(vars);
      applyClip(cover, rects[index]);
      applyLowered(cover, lowered);
      cover.dataset.sqTone = String(tone);
      cover.dataset.sqHits = String(hits);
      if (breathe) cover.dataset.sqBreathe = '';
      cover.dataset.sqReady = '';
    });
    stage.style.cssText += varsToCss(plan.stageVars);
    stage.dataset.sqReady = '';
    // Resizing mid-reveal re-plans positions only; timings and patterns never replay.
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        measureRevealCovers(); // the shared pass refreshes --reveal-cover-* for the fixed covers
        const next = measure();
        if (next.covers.length !== covers.length) return;
        const replan = planSquishyBounce(next.rects, viewport(), next.labels);
        next.covers.forEach((cover, index) => {
          const { vars } = replan.covers[index];
          cover.style.cssText += varsToCss(vars, geometryVars(vars));
          applyClip(cover, next.rects[index]);
          applyLowered(cover, replan.covers[index].lowered);
        });
        stage.style.cssText += varsToCss(replan.stageVars);
      });
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(frame); };
  }, []);
  return <div ref={root} className="sqb-stage"><StageArt /></div>;
}

const frame = (kind: string) => `<div class="sq-frame is-${kind}"><b></b></div>`;
/** The headboard's sleepy-moon appliqué (shown on tall cards only): a stitched crescent with a closed eye and a cheek. */
const CRESCENT = 'M-3.1-39.9A40 40 0 1 0 38.4 11.2A33 33 0 1 1-3.1-39.9Z';
const APPLIQUE = '<svg class="sq-appl" viewBox="-50 -50 100 100" aria-hidden="true">'
  + `<path class="sq-appl-patch" d="${CRESCENT}"/><path class="sq-appl-stitch" transform="translate(-17 13) scale(.74) translate(17 -13)" d="${CRESCENT}"/>`
  + '<path class="sq-appl-face" d="M-29 1q5 5 10 0"/><ellipse class="sq-appl-cheek" cx="-17" cy="12" rx="5" ry="3"/></svg>';
/**
 * The cover is fixed, static markup (a bed, a pillow and two face strips; the
 * Stage's plan drives it through CSS variables). It is parsed natively as one
 * constant string: up to 48 covers mount in the reveal's first frame, and
 * React would otherwise create ~23 elements for each.
 */
export const SQUISHY_COVER_HTML = `<i class="sq-bed">${APPLIQUE}</i><div class="sq-splat"><div class="sq-hits"><div class="sq-breathe"><div class="sq-pillow">`
  + '<div class="sq-face"><div class="sq-face-window"><div class="sq-face-splat">'
  + `<div class="sq-frame sq-face-hit-window"><div class="sq-face-hits">${frame('sleepy')}${frame('squish')}${frame('awake')}</div></div>`
  + `${frame('squashed')}${frame('wide')}${frame('joy')}</div></div></div></div></div></div></div>`;
const coverMarkup = { __html: SQUISHY_COVER_HTML };

function SquishyBounceCover() {
  // Constant markup authored above (no user data), so injecting it is safe.
  return <div className="sq-cover" dangerouslySetInnerHTML={coverMarkup} />;
}

export const squishyBounceEffect: RevealEffect = {
  id: 'squishy-bounce',
  name: 'Squishy bounce',
  description: 'A jelly buddy bounces across sleepy squishy pillows, belly-flops SPLAT, and every pillow boings away.',
  durationMs: SQUISHY_DURATION_MS,
  sound: 'squishy-bounce',
  Stage: SquishyBounceStage,
  Cover: SquishyBounceCover,
};
