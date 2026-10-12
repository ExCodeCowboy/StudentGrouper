import { memo, useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { flushSync } from 'react-dom';
import { measureRevealCovers } from './revealTargets';
import {
  PIXEL_QUEST_DURATION_MS, PQ_ACT_SLICES, PQ_FINALE_ACTS, PQ_HERO, PQ_LIMITS, PQ_SPAWN_DROP_P, PQ_T, heroPose, pixelQuestPlan, placeFinale, pqActSlice, pqHudShown, pqScenery, pqSlicesAt, skyWipeAt, stripFallAt,
  type PqChunk, type PqFrame, type PqLayoutInput, type PqPlan, type PqPoof, type PqRect,
} from './pixelQuestTimeline';
import {
  PQ_CHEER_TROPHY, PQ_CLOUD, PQ_COLORS as C, PQ_GEM, PQ_HERO_FRAMES, PQ_POOF_GRID, PQ_POOF_PALETTE, PQ_POOF_SETS, PQ_SPRING, PQ_STAR, PQ_TROPHY, spritePaths, textPath,
  type PqPoofVariant,
} from './pixelQuestSprites';
import { seededRandom } from './sceneMotion';
import type { RevealEffect } from './types';
import './pixelQuest.css';

type Vars = CSSProperties & Record<`--${string}`, string | number>;
const px = (value: number) => `${Math.round(value * 100) / 100}px`;
const ms = (seconds: number) => `${Math.round(seconds * 1000)}ms`;
const n2 = (value: number) => Math.round(value * 100) / 100;

/* ------------------------------------------------------------- sprites */

const pathCache = new WeakMap<readonly string[], ReactNode>();
function spriteBody(rows: readonly string[]) {
  let body = pathCache.get(rows);
  if (!body) {
    body = spritePaths(rows).map((p) => <path key={p.fill} fill={p.fill} d={p.d} />);
    pathCache.set(rows, body);
  }
  return body;
}

/*
 * Small sprites and texts are single elements with a cached data-URI SVG
 * background: one DOM node each instead of an SVG tree, which keeps the
 * mount and per-frame style work small when dozens of gems and stars exist.
 */
const imageCache = new Map<string, string>();
function cachedImage(key: string, build: () => string) {
  let url = imageCache.get(key);
  if (!url) {
    url = `url("${build()}")`;
    imageCache.set(key, url);
  }
  return url;
}
const spriteKeys = new WeakMap<readonly string[], string>();
function spriteImage(rows: readonly string[], palette?: Record<string, string>) {
  let key = spriteKeys.get(rows);
  if (!key) { key = `s:${rows.join('/')}`; spriteKeys.set(rows, key); }
  const paletteKey = palette ? `:${Object.entries(palette).map(([k, v]) => k + v).join('')}` : '';
  return cachedImage(key + paletteKey, () => svgString(rows[0].length, rows.length, spritePaths(rows, palette).map((p) => `<path fill="${p.fill}" d="${p.d}"/>`).join('')));
}

/** Pixel sprite drawn at `cell` px per art pixel. */
function Sprite({ rows, cell, className, style, palette, ref }: { rows: readonly string[]; cell: number; className?: string; style?: CSSProperties; palette?: Record<string, string>; ref?: Ref<HTMLElement> }) {
  return <i ref={ref} className={`pq-img${className ? ` ${className}` : ''}`} style={{ width: px(rows[0].length * cell), height: px(rows.length * cell), backgroundImage: spriteImage(rows, palette), ...style }} />;
}

/** Outline and drop shadow of the bitmap font at a given cell size, in cells. */
function textMetrics(cell: number) {
  const outline = Math.max(2, Math.round(cell / 3)) / cell;
  const drop = Math.max(outline, 1 / 2);
  return { outline, drop, pad: outline + drop };
}
function textMarkup(d: string, fill: string, outline: number, drop: number) {
  return `<path d="${d}" transform="translate(${n2(drop)} ${n2(drop)})" fill="${C.outline}" stroke="${C.outline}" stroke-width="${n2(outline * 2)}" stroke-linejoin="miter"/><path d="${d}" fill="${fill}" stroke="${C.outline}" stroke-width="${n2(outline * 2)}" stroke-linejoin="miter" paint-order="stroke"/>`;
}

/** 5x7 bitmap text with a crisp dark outline and a drop shadow. Its box is offset so left/top name the glyph grid origin. */
function PixelText({ text, cell, fill, className, style }: { text: string; cell: number; fill: string; className?: string; style?: CSSProperties }) {
  const { outline, drop, pad } = textMetrics(cell);
  const { width, height } = textPath(text);
  const image = cachedImage(`t:${text}:${fill}:${n2(outline)}`, () => {
    const { d } = textPath(text);
    const w = width + 2 * pad;
    const h = height + 2 * pad;
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${n2(w * 10)}" height="${n2(h * 10)}" viewBox="${n2(-pad)} ${n2(-pad)} ${n2(w)} ${n2(h)}" shape-rendering="crispEdges">${textMarkup(d, fill, outline, drop)}</svg>`)}`;
  });
  return <i className={`pq-img${className ? ` ${className}` : ''}`} style={{ width: px((width + 2 * pad) * cell), height: px((height + 2 * pad) * cell), marginLeft: px(-pad * cell), marginTop: px(-pad * cell), backgroundImage: image, ...style }} />;
}

/**
 * One glyph drawn from a shared sheet image (every glyph of `chars` in one fill, side by side). Letters that move on
 * their own (the banner wave) or change (the HUD count) then cost one element each and one image decode in total.
 */
function Glyph({ ch, chars, cell, fill, className, style }: { ch: string; chars: string; cell: number; fill: string; className?: string; style?: CSSProperties }) {
  const { outline, drop, pad } = textMetrics(cell);
  const slot = 5 + 2 * pad;
  const tall = 7 + 2 * pad;
  const image = cachedImage(`g:${chars}:${fill}:${n2(outline)}`, () => {
    const glyphs = chars.split('').map((c, i) => `<g transform="translate(${n2(i * slot)} 0)">${textMarkup(textPath(c).d, fill, outline, drop)}</g>`).join('');
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${n2(chars.length * slot * 10)}" height="${n2(tall * 10)}" viewBox="${n2(-pad)} ${n2(-pad)} ${n2(chars.length * slot)} ${n2(tall)}" shape-rendering="crispEdges">${glyphs}</svg>`)}`;
  });
  const index = Math.max(0, chars.indexOf(ch));
  return <i className={`pq-img${className ? ` ${className}` : ''}`} style={{
    width: px(slot * cell), height: px(tall * cell), marginLeft: px(-pad * cell), marginTop: px(-pad * cell), backgroundImage: image,
    backgroundSize: `${px(chars.length * slot * cell)} ${px(tall * cell)}`, backgroundPosition: `${px(-index * slot * cell)} 0`, ...style,
  }} />;
}
const BANNER_GLYPHS = 'LEVCAR!';
const HUD_GLYPHS = 'x0123456789';

const SPARK = ['..W..', '..Y..', 'WYLYW', '..Y..', '..W..'];
const PUFF = ['.WW..', 'WWWWW', 'WWWWW', '.lll.'];

/* ------------------------------------------------------- layout + plan */

const COVER_SELECTOR = '.reveal-cover[data-reveal-effect="pixel-quest"]';

function readLayout(): { elements: HTMLElement[]; input: PqLayoutInput } {
  let elements = Array.from(document.querySelectorAll<HTMLElement>(COVER_SELECTOR));
  if (!elements.length) elements = Array.from(document.querySelectorAll<HTMLElement>('.reveal-cover'));
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const top = document.querySelector('.student-show-top')?.getBoundingClientRect();
  const controls = document.querySelector('.student-show-controls')?.getBoundingClientRect();
  const chromeTop = top && top.bottom > 0 && top.bottom < height * .35 ? top.bottom : 70;
  const chromeBottom = controls && controls.top > height * .6 && controls.top <= height ? controls.top : height - 72;
  // Covers are position: fixed, so they escape a scrolling table's clip. Clip them ourselves to every
  // scroll container around them: cells scrolled out of the table are then offscreen, not slivers.
  const clips = new Map<Element, { left: number; top: number; right: number; bottom: number } | null>();
  const clipped = (element: Element): PqRect => {
    const r = element.getBoundingClientRect();
    let left = r.left; let top = r.top; let right = r.right; let bottom = r.bottom;
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      let clip = clips.get(node);
      if (clip === undefined) {
        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        clip = style.overflowX === 'visible' && style.overflowY === 'visible' ? null
          : { left: box.left + node.clientLeft, top: box.top + node.clientTop, right: box.left + node.clientLeft + node.clientWidth, bottom: box.top + node.clientTop + node.clientHeight };
        clips.set(node, clip);
      }
      if (clip) { left = Math.max(left, clip.left); top = Math.max(top, clip.top); right = Math.min(right, clip.right); bottom = Math.min(bottom, clip.bottom); }
    }
    return right - left < 1 || bottom - top < 1 ? { left: r.left, top: r.top, width: 0, height: 0 } : { left, top, width: right - left, height: bottom - top };
  };
  const rects = elements.map(clipped);
  // The text lines inside each card (names, titles), clipped like the card: the finale and the HUD keep off them.
  const texts: PqRect[] = [];
  const range = document.createRange();
  elements.forEach((element, i) => {
    const card = element.parentElement;
    const clip = rects[i];
    if (!card || clip.width <= 0) return;
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node && texts.length < 400; node = walker.nextNode()) {
      if (!node.textContent?.trim() || element.contains(node)) continue;
      range.selectNodeContents(node);
      for (const line of Array.from(range.getClientRects())) {
        const left = Math.max(line.left, clip.left);
        const top = Math.max(line.top, clip.top);
        const right = Math.min(line.right, clip.left + clip.width);
        const bottom = Math.min(line.bottom, clip.top + clip.height);
        if (right - left > 1 && bottom - top > 1) texts.push({ left, top, width: right - left, height: bottom - top });
      }
    }
  });
  // Table header cells (Today's round titles and team names) get their own window in the sky.
  const tables = new Set<Element>();
  for (const element of elements) { const table = element.closest('table'); if (table) tables.add(table); }
  const labels = [...tables].flatMap((table) => Array.from(table.querySelectorAll('th'))).map(clipped).filter((rect) => rect.width > 0);
  return { elements, input: { width, height, chromeTop, chromeBottom, rects, labels, texts } };
}

const GEM_IMAGE = spriteImage(PQ_GEM);

/** Covers are pure CSS: the plan only hands them sizes, cuts, pop times and the horizon stripe offsets. */
function applyCoverVars(plan: PqPlan, elements: HTMLElement[]) {
  const { P, E, G } = plan;
  plan.covers.forEach((cover, index) => {
    const element = elements[index];
    if (!element) return;
    const style = element.style;
    const slices = cover.slices;
    const coverTop = cover.top - E;
    style.setProperty('--pq-p', `${P}px`);
    style.setProperty('--pq-left', `${n2(cover.left)}px`);
    style.setProperty('--pq-top', `${n2(cover.top)}px`);
    style.setProperty('--pq-width', `${n2(cover.width)}px`);
    style.setProperty('--pq-height', `${n2(cover.height)}px`);
    style.setProperty('--pq-e', `${E}px`);
    style.setProperty('--pq-art-h', `${n2(cover.artH)}px`);
    style.setProperty('--pq-tile-w', `${cover.tileW}px`);
    style.setProperty('--pq-tile-h', `${cover.tileH || 1}px`);
    style.setProperty('--pq-hint-size', `${n2(Math.max(0, Math.min(8 * P, cover.tileH - 2 * P, cover.tileW - 2 * P)))}px`);
    style.setProperty('--pq-hz1', `${n2(G - 10 * P - coverTop)}px`);
    style.setProperty('--pq-hz2', `${n2(G - 7 * P - coverTop)}px`);
    style.setProperty('--pq-gem-img', GEM_IMAGE);
    for (let j = 1; j < 4; j++) style.setProperty(`--pq-cut-${j}`, `${slices[j]?.from ?? 1}`);
    for (let j = 0; j < 4; j++) {
      const slice = slices[j] ?? slices[0];
      style.setProperty(`--pq-at-${j}`, ms(slice.at));
      style.setProperty(`--pq-hint-${j}`, `${n2(slice.hint - slice.from * cover.width)}px`);
    }
    element.dataset.pqSlices = String(slices.length);
    element.dataset.pqReady = cover.visible ? 'visible' : 'hidden';
  });
}

/* --------------------------------------------------------- static art */

function svgString(width: number, height: number, body: string) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${n2(width)}" height="${n2(height)}" viewBox="0 0 ${n2(width)} ${n2(height)}" shape-rendering="crispEdges">${body}</svg>`)}`;
}

function spriteMarkup(rows: readonly string[], x: number, y: number, cell: number, palette?: Record<string, string>) {
  return `<g transform="translate(${n2(x)} ${n2(y)}) scale(${cell})">${spritePaths(rows, palette).map((p) => `<path fill="${p.fill}" d="${p.d}"/>`).join('')}</g>`;
}

type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * The sky, from the top down to the ground line: flat colour, the horizon stripes and clouds, masked by a window
 * for every card and table label. Windows are a mask (not an even-odd path), so overlapping ones stay open.
 */
function skyImage(plan: PqPlan) {
  const { W, G, B0, P } = plan;
  const holes = plan.holes;
  const random = seededRandom(0xc10d + Math.round(W) * 7 + Math.round(B0));
  const clouds: Box[] = [];
  let cloudMarkup = '';
  const scaleFor = (i: number) => (i % 3 === 0 ? 2 : 1) * P;
  const hidden = (box: Box) => holes.reduce((sum, hole) => sum + overlap(box, hole), 0) / (box.w * box.h);
  for (let attempt = 0; attempt < 80 && clouds.length < 7; attempt++) {
    const cell = scaleFor(clouds.length);
    const box = { x: random() * (W - 16 * cell), y: plan.chromeTop + 3 * P + random() * Math.max(1, B0 - plan.chromeTop - 12 * P - 5 * cell), w: 16 * cell, h: 5 * cell };
    if (hidden(box) > .45 || clouds.some((other) => overlap({ ...box, x: box.x - 4 * P, w: box.w + 8 * P }, other) > 0)) continue;
    clouds.push(box);
    cloudMarkup += spriteMarkup(PQ_CLOUD, box.x, box.y, cell, { X: C.cloud, S: C.cloudShade });
  }
  // A couple of small clouds drifting low, just above the hills.
  const low = seededRandom(0x4111 + Math.round(W));
  for (let i = 0, x = low() * 12 * P; i < 3 && x < W - 16 * P; i++, x += (60 + low() * 70) * P) {
    const box = { x, y: B0 + (2 + low() * 3) * P, w: 12 * P, h: 4 * P };
    if (hidden(box) < .45) cloudMarkup += spriteMarkup(PQ_CLOUD, box.x, box.y, P * .75, { X: C.cloud, S: C.cloudShade });
  }
  const windows = holes.map((hole) => `<rect x="${n2(hole.x)}" y="${n2(hole.y)}" width="${n2(hole.w)}" height="${n2(hole.h)}"/>`).join('');
  const body = `<defs><mask id="w" maskUnits="userSpaceOnUse" x="0" y="0" width="${n2(W)}" height="${n2(G)}"><rect width="${n2(W)}" height="${n2(G)}" fill="#fff"/><g fill="#000">${windows}</g></mask></defs>`
    + `<g mask="url(#w)"><rect width="${n2(W)}" height="${n2(G)}" fill="${C.sky}"/><rect y="${n2(G - 10 * P)}" width="${n2(W)}" height="${n2(3 * P)}" fill="${C.sky2}"/><rect y="${n2(G - 7 * P)}" width="${n2(W)}" height="${n2(7 * P)}" fill="${C.sky3}"/>${cloudMarkup}</g>`;
  return svgString(W, G, body);
}

/** The ground (B0..H, transparent above the hills): hills, bushes, grass lip and dirt. It falls away strip by strip. */
function groundImage(plan: PqPlan) {
  const { W, H, P, B0, G } = plan;
  const h = H - B0;
  const g = G - B0; // ground line within the band
  const out: string[] = [];
  const rect = (x: number, y: number, w: number, hh: number, fill: string) => out.push(`<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(hh)}" fill="${fill}"/>`);
  // Hills and bushes stand where they keep clear of every name (see pqScenery).
  const { hills, bushes } = pqScenery(plan);
  // Far hills: soft stepped mounds.
  for (const { x, w: hw, h: hh } of hills) {
    const steps = 4;
    let path = `M${n2(x)} ${n2(g)}`;
    for (let s = 0; s < steps; s++) path += `v${n2(-(hh - 2 * P) / steps)}h${n2(P * (s === steps - 1 ? 1 : 2))}`;
    path += `v${n2(-2 * P)}h${n2(hw - 2 * (2 * P * (steps - 1) + P))}v${n2(2 * P)}`;
    for (let s = steps - 1; s >= 0; s--) path += `h${n2(P * (s === steps - 1 ? 1 : 2))}v${n2((hh - 2 * P) / steps)}`;
    out.push(`<path fill="${C.hill}" d="${path}Z"/>`);
    rect(x + 3 * P, g - hh + P, 3 * P, P, C.hillHi);
    rect(x + 2 * P, g - hh + 2 * P, P, 2 * P, C.hillHi);
  }
  // Bushes: bumpy tops, darker base.
  for (const { x, w: bw } of bushes) {
    out.push(`<path fill="${C.bush}" d="M${n2(x)} ${n2(g)}v${-2 * P}h${P}v${-P}h${2 * P}v${-P}h${n2(bw / 2 - 3 * P)}v${P}h${P}v${-P}h${n2(bw / 2 - 4 * P)}v${P}h${2 * P}v${P}h${P}v${2 * P}Z"/>`);
    rect(x + 2 * P, g - 3 * P, P, P, C.bushHi);
    rect(x + 3 * P, g - 4 * P, 2 * P, P, C.bushHi);
    rect(x, g - P, bw, P, C.bushShade);
  }
  // Ground: grass lip with scallops, dirt with staggered pebbles. The repeating rows are patterns (one tile each), which
  // keeps the image a few KB instead of hundreds of rects.
  const tile = (id: string, y: number, w: number, hh: number, body: string) => `<pattern id="${id}" patternUnits="userSpaceOnUse" x="0" y="${n2(y)}" width="${n2(w)}" height="${n2(hh)}">${body}</pattern>`;
  const cell = (x: number, y: number, w: number, hh: number, fill: string) => `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(hh)}" fill="${fill}"/>`;
  // Scallops every 4P with a dark notch every 8P; pebble rows 4P apart, staggered by 3P, in a 3-row colour cycle.
  const defs = [
    tile('s', g + 2 * P, 8 * P, P, cell(P, 0, 2 * P, P, C.grass) + cell(5 * P, 0, 2 * P, P, C.grass) + cell(2 * P, 0, P, P, C.grassDark)),
    tile('p', g + 5 * P, 6 * P, 24 * P, Array.from({ length: 6 }, (_, row) => cell((row % 2) * 3 * P + P, row * 4 * P, P, P, row % 3 ? C.pebble : C.dirtShade)).join('')),
  ];
  rect(0, g, W, h - g, C.dirt);
  rect(0, g, W, 2 * P, C.grass);
  rect(0, g, W, Math.max(2, P / 2), C.grassHi);
  out.push(`<rect y="${n2(g + 2 * P)}" width="${n2(W)}" height="${n2(P)}" fill="url(#s)"/>`);
  if (h > g + 5 * P) out.push(`<rect y="${n2(g + 5 * P)}" width="${n2(W)}" height="${n2(h - g - 5 * P)}" fill="url(#p)"/>`);
  if (plan.raised) {
    // Deep soil below the short table's raised ground: a darker band with bigger stones.
    const deep = g + 9 * P;
    rect(0, deep - P, W, h - deep + P, C.dirtShade);
    defs.push(tile('d', deep + P, 8 * P, 10 * P, cell(P, 0, 2 * P, 2 * P, C.dirtDeep) + cell(5 * P, 5 * P, 2 * P, 2 * P, C.dirtDeep)));
    if (h > deep + P) out.push(`<rect y="${n2(deep + P)}" width="${n2(W)}" height="${n2(h - deep - P)}" fill="url(#d)"/>`);
  }
  return svgString(W, h, `<defs>${defs.join('')}</defs>${out.join('')}`);
}

const PqWorld = memo(function PqWorld({ plan }: { plan: PqPlan }) {
  const sky = skyImage(plan);
  const ground = groundImage(plan);
  const { W, H, B0, G, P } = plan;
  const strip = W / PQ_LIMITS.strips;
  // The strips share their two images through custom properties set once on their wrapper (through the CSSOM, so no
  // style-src policy can block them), rather than each strip carrying its own copy of the image in its style.
  return <div className="pq-world" style={{ '--pq-sky-img': `url("${sky}")`, '--pq-ground-img': `url("${ground}")` } as Vars}>
    {/* The sky leaves column by column, each column just as the ground under it drops: a crisp wipe, never a see-through fade. */}
    {Array.from({ length: PQ_LIMITS.strips }, (_, i) => <div key={`s${i}`} className="pq-sky" style={{
      left: px(i * strip), width: px(Math.ceil(strip) + 1), height: px(G), backgroundSize: `${px(W)} ${px(G)}`, backgroundPosition: `${px(-i * strip)} 0`,
      '--d': ms(skyWipeAt(i)),
    } as Vars} />)}
    {Array.from({ length: PQ_LIMITS.strips }, (_, i) => <div key={i} className="pq-strip" style={{
      left: px(i * strip), top: px(B0), width: px(Math.ceil(strip) + 1), height: px(H - B0),
      backgroundSize: `${px(W)} ${px(H - B0)}`, backgroundPosition: `${px(-i * strip)} 0`, '--d': ms(stripFallAt(i)), '--fall': px(H - B0 + 4 * P), '--j': px((i % 3 === 1 ? 2 : 1) * P),
    } as Vars} />)}
  </div>;
});

/* ----------------------------------------------------- CSS-timed props */

function stripIndex(plan: PqPlan, x: number) { return Math.max(0, Math.min(PQ_LIMITS.strips - 1, Math.floor(x / (plan.W / PQ_LIMITS.strips)))); }

const PqProps = memo(function PqProps({ plan }: { plan: PqPlan }) {
  const { P, G } = plan;
  return <>
    {plan.hits.filter((h) => h.spring).map((h) => {
      const i = stripIndex(plan, h.takeoffX);
      return <div key={h.t} className="pq-fall" style={{ left: px(Math.round(h.takeoffX - 4 * P)), top: px(G - PQ_HERO.springHeightP * P), '--d': ms(stripFallAt(i)), '--fall': px(plan.H - plan.B0 + 4 * P), '--j': px((i % 3 === 1 ? 2 : 1) * P) } as Vars}>
        <div className="pq-spring" style={{ '--d': ms(h.takeoff - .06) } as Vars}>
          <Sprite rows={PQ_SPRING} cell={P} />
        </div>
      </div>;
    })}
    <div className="pq-trophy" style={{ left: px(Math.round(plan.trophyX - 5 * P)), top: px(G - 12 * P), '--d': ms(PQ_T.grab) } as Vars}>
      <div className="pq-trophy-bob"><Sprite rows={PQ_TROPHY} cell={P} /></div>
      <Sprite className="pq-trophy-glint" rows={SPARK} cell={Math.max(2, Math.round(P * .8))} style={{ left: px(6.5 * P), top: px(-1 * P) }} />
    </div>
  </>;
});

const RING = Array.from({ length: 8 }, (_, i) => ({ ax: n2(Math.cos(i * Math.PI / 4)), ay: n2(Math.sin(i * Math.PI / 4)) }));

/** The pieces of an act come as flat lists, so each of its slices can mount an even share of them (pqActSlice). */
function starRing(key: string, x: number, y: number, at: number, radius: number, cell: number) {
  return RING.map((dir, i) => <Sprite key={`${key}${i}`} className="pq-ring" rows={i % 2 ? SPARK : PQ_STAR} cell={cell} style={{
    left: px(x - (i % 2 ? 2.5 : 3.5) * cell), top: px(y - (i % 2 ? 2.5 : 3.5) * cell), '--d': ms(at), '--rx': px(dir.ax * radius), '--ry': px(dir.ay * radius),
  } as Vars} />);
}

function puffs(plan: PqPlan, act: number) {
  const cell = Math.max(2, Math.round(plan.P * .75));
  return plan.puffs.filter((puff) => puff.act === act).map((puff) => <div key={`d${puff.at}:${puff.x}`} className={`pq-puff${puff.big ? ' is-big' : ''}`} style={{ left: px(puff.x), top: px(puff.y), '--d': ms(puff.at) } as Vars}>
    <Sprite rows={PUFF} cell={cell} className="pq-puff-l" />
    <Sprite rows={PUFF} cell={cell} className="pq-puff-r" />
  </div>);
}

/** What the opening needs: the spawn ring and the first dust. Everything later mounts in its act. */
const PqOpening = memo(function PqOpening({ plan }: { plan: PqPlan }) {
  const { P, G } = plan;
  return <>
    {puffs(plan, -1)}
    {starRing('r', plan.x0, G - (PQ_SPAWN_DROP_P + 8) * P, PQ_T.spawn, 10 * P, Math.max(2, Math.round(P / 2)))}
  </>;
});

function chunkItems(key: string, chunks: PqChunk[], outline: number) {
  return chunks.map((chunk, i) => <div key={`${key}${i}`} className={`pq-chunk pq-tone-${chunk.tone}${chunk.flash ? ' is-flash' : ''}`} style={{
    left: px(chunk.x), top: px(chunk.y), width: px(chunk.w), height: px(chunk.h), '--d': ms(chunk.start), '--life': ms(chunk.duration),
    '--dx': px(chunk.dx), '--a': px(chunk.a), '--b': px(chunk.b), '--r': `${chunk.rot}deg`, '--o': px(outline),
  } as Vars} />);
}

/** Four spin frames of the gem side by side (full, narrow, edge-on, narrow), for a stepped background-position spin. */
const GEM_STRIP = `url("${svgString(32, 8, [1, .55, .18, .55].map((sx, k) => `<g transform="translate(${k * 8 + 4} 0) scale(${sx} 1) translate(-4 0)">${spritePaths(PQ_GEM).map((p) => `<path fill="${p.fill}" d="${p.d}"/>`).join('')}</g>`).join(''))}")`;

/** Bonk k: impact star, the crumble wave and burst quarters, headroom sky, gems and "+1"s, landing dust (one slice of it). */
const PqBonkAct = memo(function PqBonkAct({ plan, k, slice }: { plan: PqPlan; k: number; slice: number }) {
  const { P } = plan;
  const hit = plan.hits[k];
  const gem = 8 * P;
  const pops = plan.pops.map((pop, i) => ({ pop, i })).filter(({ pop }) => pop.hit === k);
  const mine = new Set(pops.map(({ i }) => i));
  const items: ReactNode[] = [
    ...plan.headrooms.filter((room) => room.act === k).map((room, i) => <div key={`h${i}`} className="pq-headroom" style={{ left: px(room.x), top: px(room.y), width: px(room.w), height: px(room.h + 1), '--d': ms(room.start), '--life': ms(room.end - room.start) } as Vars} />),
    ...plan.tiles.filter((tile) => mine.has(tile.pop) && !tile.burst).map((tile, i) => <div key={`t${i}`} className={`pq-tile${tile.edgeR ? ' is-r' : ''}${tile.edgeB ? ' is-b' : ''}`} style={{
      left: px(tile.x), top: px(tile.y), width: px(tile.w), height: px(tile.h), '--d': ms(tile.start), '--life': ms(tile.delay + PQ_T.crumble),
      '--pop': ms(tile.start + tile.delay), '--tw': px(tile.tileW), '--th': px(tile.tileH), '--s': tile.side, '--r': `${tile.rot}deg`,
    } as Vars} />),
    ...chunkItems('c', plan.chunks.filter((chunk) => chunk.act === k), Math.max(2, Math.round(P / 2))),
    ...(hit.targets > 0 ? [<Sprite key="i" className="pq-impact" rows={PQ_STAR} cell={Math.round(1.5 * P)} style={{ left: px(hit.x - 5.25 * P), top: px(hit.edge - 5.25 * P), '--d': ms(hit.t) } as Vars} />] : []),
    ...pops.map(({ pop, i }) => <div key={`g${i}`} className="pq-gem" style={{
      left: px(pop.x - gem / 2), top: px(pop.gemY - gem / 2), width: px(gem), height: px(gem), '--d': ms(pop.at),
      '--dx': px(plan.hud.gemX - pop.x), '--dy': px(plan.hud.gemY - pop.gemY), '--rise': px(-6 * P), backgroundImage: GEM_STRIP,
    } as Vars} />),
    ...pops.map(({ pop, i }) => <PixelText key={`p${i}`} className="pq-plus" text="+1" cell={P} fill={C.white} style={{ left: px(pop.x + 5 * P), top: px(pop.gemY - 12 * P), '--d': ms(pop.at), '--rise': px(-5 * P) } as Vars} />),
    ...puffs(plan, k),
  ];
  return <>{pqActSlice(items, slice)}</>;
});

/**
 * The final poof: four drawn frames (swallow, bloom, break apart, wisps) side by side in one image, stepped through by
 * background-position. One element and one decode; the break and the wisps fly the way the plan picked (off the names).
 */
function poofStrip(variant: PqPoofVariant) {
  const frames = PQ_POOF_SETS[variant];
  return cachedImage(`poof:${variant}`, () => svgString(PQ_POOF_GRID.w * frames.length, PQ_POOF_GRID.h, frames.map((rows, k) => spriteMarkup(rows, k * PQ_POOF_GRID.w, 0, 1, PQ_POOF_PALETTE)).join('')));
}
function Poof({ poof, at }: { poof: PqPoof; at: number }) {
  const { w, h, cx, cy } = PQ_POOF_GRID;
  const { cell } = poof;
  const frames = PQ_POOF_SETS[poof.variant].length;
  return <i className="pq-poof" style={{
    left: px(Math.round(poof.x - cx * cell)), top: px(Math.round(poof.y - cy * cell)), width: px(w * cell), height: px(h * cell), backgroundImage: poofStrip(poof.variant),
    backgroundSize: `${px(w * cell * frames)} ${px(h * cell)}`, '--fw': px(w * cell), '--d': ms(at),
  } as Vars} />;
}

const FIREWORK_COLORS = [['#FF4F8B', '#FFC93C'], ['#37E3D5', '#9A80FF'], ['#FFC93C', '#FF6F91']] as const;

/** One part of the finale (one slice of it): the grab ring and LEVEL CLEAR!, the fireworks, or the poof and the collapse dirt. */
const PqFinaleAct = memo(function PqFinaleAct({ plan, part, slice }: { plan: PqPlan; part: number; slice: number }) {
  const { P, G } = plan;
  const { bannerY, cell, bob, pad, plateX, plateW, plateH } = plan.finale;
  const letters = 'LEVEL CLEAR!';
  const textW = (letters.length * 6 - 1) * cell;
  let items: ReactNode[];
  if (part === PQ_FINALE_ACTS.poof) items = [<Poof key="poof" poof={plan.poof} at={PQ_T.poof} />, ...chunkItems('dirt', plan.dirt, Math.max(2, Math.round(P / 2)))];
  else if (part === PQ_FINALE_ACTS.fireworks) items = plan.fireworks.map((spot, burst) => <div key={burst} className="pq-firework" style={{ left: px(spot.x), top: px(spot.y), '--d': ms(PQ_T.fireworks[burst]), '--launch': ms(PQ_T.fireworks[burst] - PQ_T.rocket), '--climb': px(spot.climb) } as Vars}>
    <i className="pq-rocket" style={{ width: px(P), height: px(2 * P) }} />
    <Sprite className="pq-flash" rows={PQ_STAR} cell={P} style={{ left: px(-3.5 * P), top: px(-3.5 * P) }} />
    {Array.from({ length: 16 }, (_, k) => {
      const outer = k < 10;
      const angle = (outer ? k / 10 : (k - 10) / 6 + 1 / 12) * Math.PI * 2 + burst * .26;
      // A smaller burst (where a full one would cross names) keeps chunky sparks on a tighter ring.
      const radius = (outer ? 15 : 8) * P * spot.scale;
      const size = spot.scale < 1 ? (outer ? Math.max(2, Math.round(1.5 * P)) : P) : outer ? 2 * P : Math.max(2, Math.round(1.5 * P));
      return <i key={k} className="pq-spark" style={{ width: px(size), height: px(size), marginLeft: px(-size / 2), marginTop: px(-size / 2), background: FIREWORK_COLORS[burst][outer ? k % 2 : 1 - k % 2], '--rx': px(Math.cos(angle) * radius), '--ry': px(Math.sin(angle) * radius), '--droop': px((outer ? 6 : 4) * P * spot.scale) } as Vars} />;
    })}
  </div>);
  else items = [
    ...starRing('r', plan.trophyX, G - 20 * P, PQ_T.grab, 12 * P, Math.max(2, Math.round(P / 2))),
    <div key="banner" className="pq-banner" style={{ left: px(plateX), top: px(bannerY - plateH / 2), width: px(plateW), height: px(plateH), '--d': ms(PQ_T.clear), '--out': ms(PQ_T.uiOut), '--pq-b': px(Math.max(2, P / 2)) } as Vars}>
      <div className="pq-banner-plate" />
      <div className="pq-banner-text" style={{ left: px((plateW - textW) / 2), top: px(pad + bob) }}>
        {letters.split('').map((ch, i) => ch === ' ' ? null : <Glyph key={i} className="pq-letter" ch={ch} chars={BANNER_GLYPHS} cell={cell} fill={i % 2 ? C.cyan : C.yellow}
          style={{ left: px(i * 6 * cell), '--d': ms(PQ_T.clear + .025 * i), '--wave': ms(PQ_T.clear + .35 + .06 * i), '--bob': px(-bob) } as Vars} />)}
      </div>
    </div>,
  ];
  return <>{pqActSlice(items, slice)}</>;
});

/**
 * When the reveal's CSS timelines really started, on the document timeline: the start of the sky's animation, which
 * mounts with the covers and the rest of the level (the first rendered frame, a mount's length after the layout-effect
 * origin). The hero clock and the lazily mounted acts both anchor to it, so everything shares one beat. Before that
 * frame (no start time yet) it is null; without Web Animations or a document timeline it is the origin.
 */
function cssTimelineStart(origin: number): number | null {
  const sky = document.querySelector('.pq-sky');
  // Without Web Animations there is nothing to read: the layout-effect origin is the best anchor.
  if (!sky || typeof sky.getAnimations !== 'function') return origin;
  const animation = sky.getAnimations()[0];
  return animation && typeof animation.startTime === 'number' ? animation.startTime : null;
}

/**
 * Whether an animation frame's timestamp is off the document timeline: the review lab's frozen frames hand frames a
 * virtual time, while CSS animations keep the real clock. On a real clock both are the same frame time however long the
 * frame took, so a slow machine's heavy first frame never looks virtual (it once did, with a performance.now() check,
 * and every act then played late by its mount time).
 */
function virtualFrame(frameTime: number) {
  const timeline = document.timeline?.currentTime;
  return typeof timeline === 'number' && Math.abs(timeline - frameTime) > 50;
}

/** The reveal's one clock: its layout-effect origin, then (within the first frames) the CSS timelines' real start. */
type PqClock = { origin: number; started: number; anchored: boolean; virtual: boolean };
/**
 * Scene time in seconds at `now`: an animation frame's timestamp (`frame`), or performance.now() outside a frame. The
 * clock anchors in its first frames, which also tell a virtual clock apart.
 */
function sceneTime(clock: PqClock, now: number, frame = false) {
  if (!clock.anchored && frame) {
    if (virtualFrame(now)) { clock.anchored = true; clock.virtual = true; }
    else {
      const start = typeof document.timeline?.currentTime === 'number' ? cssTimelineStart(clock.origin) : clock.origin;
      if (start !== null) { clock.started = start; clock.anchored = true; }
    }
  }
  return Math.max(0, Math.min(PIXEL_QUEST_DURATION_MS, now - clock.started)) / 1000;
}

/**
 * An act mounts just before it is needed, which keeps the first paint light. It mounts inside an animation frame, so its
 * CSS animations start on that frame, `shift` seconds into the reveal: every delay in it subtracts --shift and lands on
 * the same beat as the rest of the level and the pre-mixed sound. No Web Animations calls, so no style flush. Under a
 * virtual clock (the review lab seeks every animation to the frame's time) the shift is 0 and the delays are absolute.
 */
function PqAct({ shift, children }: { shift: number; children: ReactNode }) {
  return <div className="pq-act" style={{ '--shift': ms(shift) } as Vars}>{children}</div>;
}
/* ------------------------------------------------------------ captions */

const PqCaptions = memo(function PqCaptions({ plan }: { plan: PqPlan }) {
  const { W, H, P } = plan;
  const cx = W / 2;
  const cy = H * .4;
  const big = 3 * P;
  const digit = (text: string, start: number, end: number, fill: string, extra = '') => {
    const width = (text.length * 6 - 1) * big;
    return <div key={text} className={`pq-cap${extra}`} style={{ left: px(cx - width / 2), top: px(cy - 3.5 * big), '--d': ms(start), '--life': ms(end - start) } as Vars}>
      <div className="pq-cap-pop" style={{ '--d': ms(start) } as Vars}><PixelText text={text} cell={big} fill={fill} /></div>
    </div>;
  };
  const player = (8 * 6 - 1) * P;
  return <>
    <div className="pq-cap pq-cap-player" style={{ left: px(cx - player / 2), top: px(cy - 3.5 * big - 14 * P), '--d': ms(PQ_T.count[0]), '--life': ms(PQ_T.goOut + .08 - PQ_T.count[0]) } as Vars}>
      <div className="pq-cap-pop" style={{ '--d': ms(PQ_T.count[0]) } as Vars}><PixelText text="PLAYER 1" cell={P} fill={C.yellow} /></div>
    </div>
    {digit('3', PQ_T.count[0], PQ_T.count[1], C.white)}
    {digit('2', PQ_T.count[1], PQ_T.count[2], C.white)}
    {digit('1', PQ_T.count[2], PQ_T.go, C.white)}
    {digit('GO!', PQ_T.go, PQ_T.goOut + .08, C.cyan, ' pq-cap-go')}
  </>;
});

/* ------------------------------------------------ live layer (scene clock) */

const FRAME_NAMES = Object.keys(PQ_HERO_FRAMES) as PqFrame[];
// The hero box is resized (not scaled) to grow and squash, so every size is drawn fresh at its own resolution and stays
// crisp; the art stretches to fill it. The held trophy is placed in percent of the box, so it follows.
const HERO_ART = FRAME_NAMES.map((frame) => <svg key={frame} className="pq-hero-art" data-frame={frame} viewBox="0 0 16 16" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">{spriteBody(PQ_HERO_FRAMES[frame])}</svg>);
const TROPHY_ART = <svg className="pq-hero-trophy" viewBox="0 0 10 12" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">{spriteBody(PQ_TROPHY)}</svg>;
const TRAIL = 5;
/** The held trophy (10 x 12 art pixels) relative to the 16 x 16 hero box, in percent, so it grows and squashes with it. */
const TROPHY_BOX: CSSProperties = {
  left: `${(8 + PQ_CHEER_TROPHY.x) / .16}%`, top: `${(16 + PQ_CHEER_TROPHY.y) / .16}%`, width: `${10 / .16}%`, height: `${12 / .16}%`,
};

const HudDigits = memo(function HudDigits({ count, cell }: { count: number; cell: number }) {
  const text = `x${String(Math.min(99, count)).padStart(2, '0')}`;
  return <>{text.split('').map((ch, i) => <Glyph key={i} ch={ch} chars={HUD_GLYPHS} cell={cell} fill={C.white} style={{ position: 'absolute', left: px(i * 6 * cell), top: 0 }} />)}</>;
});

/**
 * The only scene-clock layer: hero, shadow, lift sparkles and the HUD count.
 * One rAF loop writes transforms straight to the DOM; React re-renders only
 * when the shown gem count changes or the next act slice is due (mounted in
 * that same frame, so its CSS timelines start on it).
 */
const PqLive = memo(function PqLive({ plan, clock, onFrame }: { plan: PqPlan; clock: PqClock; onFrame: (t: number, sync: boolean) => void }) {
  const { P, G } = plan;
  const hero = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const hudCountEl = useRef<HTMLDivElement>(null);
  const trail = useRef<(HTMLElement | null)[]>([]);
  const [count, setCount] = useState(0);
  useLayoutEffect(() => {
    const frames = new Map<string, SVGElement>();
    hero.current?.querySelectorAll<SVGElement>('[data-frame]').forEach((node) => frames.set(node.dataset.frame ?? '', node));
    const trophy = hero.current?.querySelector<HTMLElement>('.pq-hero-trophy-wrap');
    const arrive = PQ_T.gemRise + PQ_T.gemFly;
    const arrivals = plan.pops.map((pop) => pop.at + arrive).sort((x, y) => x - y);
    const total = arrivals.length;
    let shown: string | null = null;
    let boxW = 0;
    let boxH = 0;
    let lastCount = -1;
    let raf = 0;
    const draw = (t: number, sync: boolean) => {
      onFrame(t, sync);
      const pose = heroPose(plan, t);
      const heroEl = hero.current;
      if (heroEl) {
        heroEl.style.visibility = pose.frame ? 'visible' : 'hidden';
        // Whole-pixel art cells; the box only changes size at the 1x/1.5x/2x steps and the wind-up squash and stretch.
        const cell = Math.floor(P * pose.scale);
        const w = pose.sx === 1 ? 16 * cell : Math.round(16 * cell * pose.sx);
        const h = pose.sy === 1 ? 16 * cell : Math.round(16 * cell * pose.sy);
        if (w !== boxW || h !== boxH) { boxW = w; boxH = h; heroEl.style.width = `${w}px`; heroEl.style.height = `${h}px`; }
        heroEl.style.transform = `translate(${Math.round(pose.x - w / 2)}px, ${Math.round(pose.y) - h}px)`;
        if (pose.frame !== shown) {
          if (shown) frames.get(shown)?.style.setProperty('display', 'none');
          if (pose.frame) frames.get(pose.frame)?.style.setProperty('display', 'block');
          shown = pose.frame;
        }
        if (trophy) trophy.style.display = pose.trophy ? 'block' : 'none';
      }
      if (shadow.current) {
        const onGround = !!pose.frame && !pose.trophy;
        const width = Math.max(4, 10 - Math.round((G - pose.y) / (4 * P))) * P;
        shadow.current.style.visibility = onGround ? 'visible' : 'hidden';
        shadow.current.style.width = `${width}px`;
        shadow.current.style.transform = `translate3d(${Math.round(pose.x - width / 2)}px, ${Math.round(G - P / 2)}px, 0)`;
      }
      for (let i = 1; i <= TRAIL; i++) {
        const star = trail.current[i - 1];
        if (!star) continue;
        const past = t - i * .06;
        const on = t >= PQ_T.grab && t < PQ_T.floatEnd + .12 && past >= PQ_T.grab;
        star.style.visibility = on ? 'visible' : 'hidden';
        if (on) {
          const p = heroPose(plan, past);
          star.style.transform = `translate3d(${Math.round(p.x + (i % 2 ? 5 : -5) * P - 2 * P)}px, ${Math.round(p.y - 7 * P * p.scale)}px, 0)`;
        }
      }
      let n = 0;
      while (n < total && arrivals[n] <= t) n++;
      const value = pqHudShown(n, total);
      if (value !== lastCount) { lastCount = value; setCount(value); }
      if (hudCountEl.current) {
        // A crisp hop each time the shown count changes (whole pixels, so the digits never blur).
        let changed = n;
        while (changed > 0 && pqHudShown(changed - 1, total) === pqHudShown(changed, total)) changed--;
        const since = changed ? t - arrivals[changed - 1] : 1;
        hudCountEl.current.style.transform = `translateY(${since < .04 ? -P : since < .08 ? -Math.round(P / 2) : 0}px)`;
      }
    };
    const tick = (now: number) => {
      const t = sceneTime(clock, now, true);
      draw(t, true);
      if (t < PIXEL_QUEST_DURATION_MS / 1000) raf = requestAnimationFrame(tick);
    };
    // A re-plan (resize) picks up at the current scene time; the clock never restarts.
    draw(sceneTime(clock, performance.now()), false);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [plan, clock, onFrame, P, G]);
  const spark = Math.max(2, Math.round(P * .8));
  return <>
    <div ref={shadow} className="pq-shadow" style={{ height: px(P) }} />
    {/* The older trail sparkles are smaller, not see-through. */}
    {Array.from({ length: TRAIL }, (_, i) => <Sprite key={i} ref={(node) => { trail.current[i] = node; }} className="pq-trail" rows={SPARK} cell={i > 2 ? Math.max(2, Math.round(spark * .6)) : spark} />)}
    <div ref={hero} className="pq-hero" style={{ width: px(16 * P), height: px(16 * P) }}>
      <div className="pq-hero-trophy-wrap" style={TROPHY_BOX}>{TROPHY_ART}</div>
      {HERO_ART}
    </div>
    <div className="pq-hud" style={{ left: px(plan.hud.x), top: px(plan.hud.y), width: px(plan.hud.w), height: px(plan.hud.h), '--d': ms(PQ_T.spawn), '--out': ms(plan.hudOut), '--pq-b': px(Math.max(2, P / 2)) } as Vars}>
      <Sprite className="pq-hud-gem" rows={PQ_GEM} cell={P} style={{ left: px(1.5 * P), top: px(1.5 * P) }} />
      <div ref={hudCountEl} className="pq-hud-count" style={{ left: px(10 * P), top: px(1.5 * P - P * .6), width: px(17 * P), height: px(7 * P) }}><HudDigits count={count} cell={P} /></div>
    </div>
  </>;
});
/* ---------------------------------------------------------------- stage */

type PqActSlot = { key: string; shift: number };

function PixelQuestStage() {
  const [scene, setScene] = useState<{ plan: PqPlan; clock: PqClock; id: number } | null>(null);
  const [acts, setActs] = useState<PqActSlot[]>([]);
  const sceneId = useRef(0);
  const clockRef = useRef<PqClock | null>(null);
  const mounted = useRef(0);
  const pendingFinale = useRef<PqPlan | null>(null);
  // Act slices only ever add, one per frame while they are due (a resize re-keys them all at once); each starts at the
  // scene time it mounts.
  const onFrame = useCallback((t: number, sync: boolean) => {
    const virtual = !!clockRef.current?.virtual;
    // The finale search runs in the countdown's calm gap (or at once on a frozen frame), well before anything reads it.
    if (pendingFinale.current && (virtual || t >= PQ_T.finaleSearch)) { placeFinale(pendingFinale.current); pendingFinale.current = null; }
    const next = pqSlicesAt(t, mounted.current, virtual);
    if (next <= mounted.current) return;
    mounted.current = next;
    const shift = virtual ? 0 : t;
    const add = () => setActs((list) => {
      if (next <= list.length) return list;
      const out = list.slice();
      for (let i = list.length; i < next; i++) out.push({ key: `${sceneId.current}:${i}`, shift });
      return out;
    });
    if (sync) flushSync(add);
    else add();
  }, []);
  useLayoutEffect(() => {
    // One clock origin for the whole reveal, taken before the first paint (the same frame the CSS
    // timelines start). A resize re-plans positions but never restarts time.
    const origin = performance.now();
    const clock: PqClock = { origin, started: origin, anchored: false, virtual: false };
    clockRef.current = clock;
    const layout = (deferFinale: boolean) => {
      const { elements, input } = readLayout();
      const plan = pixelQuestPlan(input, { deferFinale });
      applyCoverVars(plan, elements);
      return plan;
    };
    // The first frame gets only what it shows; the finale search (first needed at 4.4 s) runs in a calm moment of the
    // countdown and fills plan.finale, plan.poof and plan.fireworks in place (nothing reads them before the banner act
    // mounts). Measure-then-render before paint (the same pattern as useRevealTargets): the scene state is set from the
    // layout this effect just read, so the stage's first commit already has its plan.
    const start = () => {
      const plan = layout(true);
      sceneId.current = 1;
      pendingFinale.current = plan;
      setScene({ plan, clock, id: 1 });
    };
    start();
    // Resizes (a fullscreen switch sends a burst) re-plan at most every 150 ms, in an animation frame, and only when
    // the window really changed size. The mounted act slices then remount on the new plan at the current scene time.
    let size = `${window.innerWidth}x${window.innerHeight}`;
    let frame = 0;
    let timer = 0;
    let last = -Infinity;
    const run = (now: number) => {
      frame = 0;
      const next = `${window.innerWidth}x${window.innerHeight}`;
      if (next === size) return;
      size = next;
      last = now;
      measureRevealCovers();
      const plan = layout(false);
      pendingFinale.current = null;
      const shift = clock.virtual ? 0 : sceneTime(clock, now, true);
      const id = ++sceneId.current;
      flushSync(() => {
        setScene({ plan, clock, id });
        setActs((list) => list.map((_, i) => ({ key: `${id}:${i}`, shift })));
      });
    };
    const resize = () => {
      if (frame || timer) return;
      const wait = last + 150 - performance.now();
      if (wait > 0) timer = window.setTimeout(() => { timer = 0; frame = requestAnimationFrame(run); }, wait);
      else frame = requestAnimationFrame(run);
    };
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);
  if (!scene) return null;
  const { plan, clock } = scene;
  return <div className="pq-stage" style={{ '--pq-p': px(plan.P), '--pq-e': px(plan.E) } as Vars}>
    <PqWorld plan={plan} />
    <PqProps plan={plan} />
    <PqOpening plan={plan} />
    <PqCaptions plan={plan} />
    {acts.map(({ key, shift }, i) => {
      const act = Math.floor(i / PQ_ACT_SLICES);
      const slice = i % PQ_ACT_SLICES;
      return <PqAct key={key} shift={shift}>
        {act >= PQ_FINALE_ACTS.banner ? <PqFinaleAct plan={plan} part={act} slice={slice} /> : <PqBonkAct plan={plan} k={act} slice={slice} />}
      </PqAct>;
    })}
    <PqLive plan={plan} clock={clock} onFrame={onFrame} />
  </div>;
}

/* ---------------------------------------------------------------- cover */

/** Each slice is two nodes: its sky backing and the tile wall (whose pseudo-elements draw the gem hint and its glint). */
function PixelQuestCover() {
  return <div className="pq-cover">
    {[0, 1, 2, 3].map((j) => <div key={j} className="pq-slice"><div className="pq-art" /></div>)}
  </div>;
}

export const pixelQuestEffect: RevealEffect = {
  id: 'pixel-quest',
  name: 'Pixel Quest · Level clear!',
  description: 'A pixel bunny bonks every block for a gem, collects the trophy and clears the level.',
  durationMs: PIXEL_QUEST_DURATION_MS,
  sound: 'pixel-quest',
  Stage: PixelQuestStage,
  Cover: PixelQuestCover,
};
