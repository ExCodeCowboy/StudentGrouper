import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PERCH_BOX, fairyEffect, measureFairyLayout } from '../src/revealEffects/fairy';
import {
  ART, BLING_RAYS_S, BLING_RING_S, BLING_SCALE, FAIRY, FAIRY_DURATION_MS, HERO_AWAY_S, HERO_FLY_W, HERO_PERCH_SIZE, PERCH, PERCH_SPREAD, POSES, RIBBON_CHUNKS, RIBBON_SPAN, coverTap, fairyArm, fairyArmPose,
  fairyBand, fairyBody, fairyBounds, fairyFace, fairyGlitter, fairyHead, fairyLayout, fairyNose, fairyPose, fairyRibbon, fairyStar, fairyStarPoint, fairyWings, heroButterfly,
  heroPerchRoot, perchedWingPolygons, perchWings, ribbonOpacity, ribbonRegrowTimes, ribbonRestart, ribbonShape, ribbonSpan, starLocal, toScreen, glitterRate, LOOK_STAR_SCALE, lookStarPop,
  type FairyRect, type HeroButterfly,
} from '../src/revealEffects/fairyMotion';

// Layouts measured in the reveal lab (card rectangles in viewport px).
type Spec = { name: string; vw: number; vh: number; xs: number[]; ys: number[]; w: number; h: number; count?: number };
const SPECS: Spec[] = [
  { name: 'groups-4 1280', vw: 1280, vh: 800, xs: [24, 333, 643, 952], ys: [74], w: 289, h: 637 },
  { name: 'groups-5 1280', vw: 1280, vh: 800, xs: [24, 271, 519, 766, 1014], ys: [74], w: 227, h: 637 },
  { name: 'groups-6 1280', vw: 1280, vh: 800, xs: [24, 436, 849], ys: [74, 402], w: 392, h: 308 },
  { name: 'groups-8 1280', vw: 1280, vh: 800, xs: [24, 333, 643, 952], ys: [74, 402], w: 289, h: 308 },
  { name: 'groups-12 1280', vw: 1280, vh: 800, xs: [24, 333, 643, 952], ys: [74, 325, 576], w: 289, h: 231 },
  { name: 'groups-4 960', vw: 960, vh: 680, xs: [24, 330, 635], ys: [74, 352], w: 286, h: 258, count: 4 },
  { name: 'groups-6 960', vw: 960, vh: 680, xs: [24, 330, 635], ys: [74, 352], w: 286, h: 258 },
  { name: 'groups-4 1920', vw: 1920, vh: 1080, xs: [24, 493, 963, 1432], ys: [74], w: 449, h: 917 },
  { name: 'groups-6 1920', vw: 1920, vh: 1080, xs: [24, 337, 650, 963, 1275, 1588], ys: [74], w: 293, h: 917 },
  { name: 'groups-1 1280', vw: 1280, vh: 800, xs: [24], ys: [74], w: 1217, h: 637 },
  { name: 'groups-2 1280', vw: 1280, vh: 800, xs: [24, 643], ys: [74], w: 599, h: 637 },
  { name: 'rotations-5 1280', vw: 1280, vh: 800, xs: [348, 647, 945], ys: [123, 216, 309, 402, 495], w: 269, h: 76 },
  { name: 'rotations-8 1280', vw: 1280, vh: 800, xs: [348, 647, 945], ys: [123, 216, 309, 402, 495, 588, 681, 774], w: 269, h: 76 },
  { name: 'rotations-5 960', vw: 960, vh: 680, xs: [272, 491, 709], ys: [141, 260, 379, 498, 617], w: 181, h: 90 },
  { name: 'rotations-5 1920', vw: 1920, vh: 1080, xs: [512, 971, 1429], ys: [141, 260, 379, 498, 617], w: 421, h: 90 },
  { name: 'picker 1280', vw: 1280, vh: 800, xs: [175], ys: [212], w: 916, h: 380 },
  { name: 'no covers', vw: 1280, vh: 800, xs: [], ys: [], w: 0, h: 0 },
];
function rectsFor(spec: Spec): FairyRect[] {
  const rects: FairyRect[] = [];
  for (const top of spec.ys) for (const left of spec.xs) rects.push({ left, top, width: spec.w, height: spec.h });
  return rects.slice(0, spec.count ?? rects.length);
}
const LAYOUTS = SPECS.map((spec) => ({ spec, L: fairyLayout(rectsFor(spec), spec.vw, spec.vh) }));
const END = FAIRY_DURATION_MS / 1000;
const near = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance;
const samples = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

void test('fairy: the effect keeps its id and sound, and fits the presentation window', () => {
  assert.equal(fairyEffect.id, 'fairy');
  assert.equal(fairyEffect.sound, 'fairy');
  assert.equal(fairyEffect.durationMs, FAIRY_DURATION_MS);
  assert.ok(FAIRY_DURATION_MS <= 9800);
  assert.ok(FAIRY.sceneFade[1] <= END && FAIRY.exitEnd <= FAIRY.sceneFade[0] && FAIRY.glitterEnd <= END - 0.04);
  // Beats run in story order.
  const beats = [FAIRY.entrance[1], FAIRY.pulses[0], FAIRY.pulses[1], FAIRY.fizzle, FAIRY.look[0], FAIRY.shake[0], FAIRY.shake[1], FAIRY.bling, FAIRY.anticipation[0],
    FAIRY.sweepT0, FAIRY.arriveMin, FAIRY.land, FAIRY.giggle[0], FAIRY.giggle[1], FAIRY.unflip[0], FAIRY.unflip[1], FAIRY.exitEnd];
  beats.forEach((beat, i) => { if (i) assert.ok(beat >= beats[i - 1], `beat ${i} in order`); });
});

void test('fairy: band math spreads evenly spaced columns across the card band', () => {
  for (let K = 1; K <= 7; K++) {
    const w = 289, gap = 22, vw = Math.max(1280, K * (w + gap) + 60);
    const rects = Array.from({ length: K }, (_, k) => ({ left: 30 + k * (w + gap), top: 100, width: w, height: 500 }));
    const L = fairyLayout(rects, vw, 800);
    assert.equal(L.columns.length, K);
    L.covers.forEach((cover, k) => assert.ok(near(cover.bandX, (k + 0.5) / K, 0.01), `K=${K} column ${k}: ${cover.bandX}`));
    L.columns.forEach((column, k) => assert.ok(near(column.bandX, L.covers[k].bandX, 1e-9)));
  }
  // Stacked rows share one column; off-screen covers clamp; tint is rank mod 4.
  const L = fairyLayout([
    { left: 20, top: 80, width: 300, height: 200 }, { left: 20, top: 320, width: 300, height: 200 },
    { left: 340, top: 80, width: 300, height: 200 }, { left: 340, top: 320, width: 300, height: 200 },
    { left: 1400, top: 80, width: 300, height: 200 }, { left: -500, top: 2000, width: 300, height: 200 },
  ], 1280, 800);
  assert.equal(L.columns.length, 2);
  assert.equal(L.covers[4].bandX, 1);
  assert.equal(L.covers[5].bandX, 0);
  for (const cover of L.covers) assert.ok(cover.focusDy >= 0 && cover.focusDy <= 0.5);
  assert.deepEqual(L.covers.map((c) => c.tint), [1, 2, 3, 0, 1, 0]);
  assert.ok(L.covers.every((c) => !c.dense));
  const dense = fairyLayout(Array.from({ length: 24 }, (_, i) => ({ left: 300 + (i % 3) * 300, top: 100 + Math.floor(i / 3) * 90, width: 280, height: 80 })), 1280, 800);
  assert.ok(dense.covers.every((c) => c.dense));
  // No covers: three virtual columns.
  const empty = fairyLayout([], 1280, 800);
  assert.deepEqual(empty.columns.map((c) => c.bandX), [1 / 6, 1 / 2, 5 / 6]);
});

void test('fairy: every cover is tapped, blooms and is gone before the scene fades', () => {
  for (let b = 0; b <= 1.0001; b += 0.05) for (let f = 0; f <= 0.6; f += 0.05) {
    const tap = coverTap(b, f);
    assert.ok(tap >= FAIRY.sweepT0 && tap <= FAIRY.sweepT0 + FAIRY.sweepSpan + FAIRY.ripple * 0.5 + 1e-9);
    assert.ok(tap + FAIRY.coverTail <= FAIRY.sceneFade[0] + 0.02 && tap + FAIRY.coverTail < END, `cover ends ${tap + FAIRY.coverTail}`);
  }
  for (const { spec, L } of LAYOUTS) {
    for (const cover of L.covers) assert.ok(coverTap(cover.bandX, cover.focusDy) + FAIRY.coverTail < END, spec.name);
    // Cover taps follow the fairy left to right.
    const order = rectsFor(spec).map((r, i) => ({ x: r.left + r.width / 2, tap: coverTap(L.covers[i].bandX, 0) })).sort((a, b) => a.x - b.x);
    order.forEach((o, i) => { if (i) assert.ok(o.tap >= order[i - 1].tap); });
  }
});

/** Parse `animation` shorthands (including comma lists) and `animation-delay` overrides from fairy.css. */
function parseAnimations(css: string) {
  const rules: { selector: string; name: string; duration: number; delay: string; iterations: number }[] = [];
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const splitTop = (value: string) => {
    const parts: string[] = []; let depth = 0, current = '';
    for (const ch of value) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && !depth) { parts.push(current.trim()); current = ''; } else current += ch;
    }
    return [...parts, current.trim()];
  };
  const base = (selector: string) => selector.replace(/\.is-[a-z]+/g, '').replace(/\s+/g, ' ').trim();
  for (const match of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim();
    const anim = /(?:^|;)\s*animation:\s*([^;]+)/.exec(match[2]);
    const override = /animation-delay:\s*([^;]+)/.exec(match[2]);
    if (anim) {
      for (const value of splitTop(anim[1].trim())) {
        const name = value.split(/\s+/)[0];
        // (Dense tables switch the global hop off with `animation: none`.)
        if (name === 'none') continue;
        const times = [...value.matchAll(/(calc\((?:[^()]|\([^()]*\))*\)|var\([^)]*\)|-?[\d.]+ms)/g)].map((m) => m[1]);
        const iterations = /infinite/.test(value) ? Infinity : Number(/\s(\d+)\s+(?:alternate|both|forwards)/.exec(value)?.[1] ?? 1);
        rules.push({ selector, name, duration: Number.parseFloat(times[0]), delay: times[1] ?? '0ms', iterations });
      }
    } else if (override && /fairy-cover|fairy-bfly/.test(selector)) {
      const previous = [...rules].reverse().find((r) => base(r.selector) === base(selector));
      assert.ok(previous, `${selector}: its animation-delay overrides a known animation`);
      rules.push({ ...previous, selector, delay: override[1].trim() });
    }
  }
  return rules;
}
const tapOffset = (delay: string) => {
  if (delay === 'var(--fairy-tap)') return 0;
  const m = /^calc\(var\(--fairy-tap\)\s*([+-])\s*([\d.]+)ms\)$/.exec(delay);
  return m ? (m[1] === '-' ? -1 : 1) * Number(m[2]) : null;
};

void test('fairy: CSS cover timing matches the choreography', () => {
  const css = readFileSync('src/revealEffects/fairy.css', 'utf8');
  const tapCalc = /--fairy-tap:\s*calc\(([\d.]+)ms \+ ([\d.]+)ms \* var\(--fairy-band\) \+ ([\d.]+)ms \* var\(--fairy-focus-dy, 0\)\)/.exec(css);
  assert.ok(tapCalc, '--fairy-tap is declared');
  assert.equal(Number(tapCalc[1]), Math.round(FAIRY.sweepT0 * 1000));
  assert.equal(Number(tapCalc[2]), Math.round(FAIRY.sweepSpan * 1000));
  assert.equal(Number(tapCalc[3]), Math.round(FAIRY.ripple * 1000));
  const rules = parseAnimations(css);
  const done = rules.find((r) => r.name === 'fairy-cover-done');
  assert.ok(done && tapOffset(done.delay) === FAIRY.coverTail * 1000, 'covers hide at tap + tail');
  let perCover = 0;
  for (const rule of rules) {
    // Stage layers (the fairy, the hero butterfly) are unmounted with the Stage; only cover rules are timed here.
    if (!/fairy-cover|fairy-bfly/.test(rule.selector) || rule.selector.includes('fairy-hero')) continue;
    assert.notEqual(rule.iterations, Infinity, `${rule.selector}: covers never loop forever`);
    const offset = tapOffset(rule.delay);
    if (offset !== null) {
      perCover++;
      // (+1 ms: the final hide is itself a 1 ms step.)
      assert.ok(offset + rule.duration * rule.iterations <= FAIRY.coverTail * 1000 + 1, `${rule.selector} (${rule.name}) ends ${offset + rule.duration * rule.iterations} ms after the tap`);
      assert.ok(offset >= -120, `${rule.selector} starts near its tap`);
    } else {
      // Global cover animations: the question tile, sprout and anticipation all finish before the sweep ends.
      const band = /^calc\(([\d.]+)ms \+ ([\d.]+)ms \* var\(--fairy-band\)\)$/.exec(rule.delay);
      const start = band ? Number(band[1]) + Number(band[2]) : Number.parseFloat(rule.delay);
      assert.ok(Number.isFinite(start), `${rule.selector}: parsed delay ${rule.delay}`);
      assert.ok(start + rule.duration * rule.iterations <= FAIRY.budHop[1] * 1000 + 1, `${rule.selector} (${rule.name}) ends by ${FAIRY.budHop[1]} s`);
    }
  }
  assert.ok(perCover >= 9, 'per-cover animations were found');
  const question = /fairy-question-out (\d+)ms calc\((\d+)ms \+ 150ms \* var\(--fairy-band\)\) linear both/.exec(css);
  assert.ok(question, 'the "?" tile animation is declared');
  assert.equal(Number(question[1]), FAIRY.questionMs);
  assert.equal(Number(question[2]), Math.round(FAIRY.questionStart * 1000));
  assert.match(css, /fairy-bud-grow 420ms calc\(620ms \+ 150ms \* var\(--fairy-band\)\)/);
  assert.equal(FAIRY.sproutStart * 1000, 620);
  // The "?" tile twists away before its bud grows (no flower in a box): the easing is set per keyframe, and the
  // tile is below half size by the time the bud (overshooting cubic-bezier(.3,1.6,.5,1)) is half grown.
  const qBlock = /@keyframes fairy-question-out \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  assert.match(qBlock, /0% \{[^}]*scale\(1\);\s*animation-timing-function: ease-out;/);
  assert.match(qBlock, /25% \{[^}]*scale\(1\.08\);\s*animation-timing-function: cubic-bezier\(\.4, 0, \.6, 1\);/);
  assert.match(qBlock, /85% \{ opacity: 1; \}/, 'the tile does not fade to a see-through ghost while it is big');
  const bezier = (x1: number, y1: number, x2: number, y2: number) => (x: number) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) { const u = (lo + hi) / 2; if (3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3 < x) lo = u; else hi = u; }
    const u = (lo + hi) / 2;
    return 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3;
  };
  const bud = bezier(0.3, 1.6, 0.5, 1), shrink = bezier(0.4, 0, 0.6, 1);
  const tileAt = (t: number) => {
    const q = (t - FAIRY.questionStart) / (FAIRY.questionMs / 1000);
    return q >= 1 ? 0 : q <= 0.25 ? 1.08 : 1.08 * (1 - shrink((q - 0.25) / 0.75));
  };
  // The bud is about a third grown (and only just opaque) 30 ms in; by then the tile is under half size, and by
  // the time the bud is half grown the tile is all but gone.
  const budHalf = samples(0, 0.42, 0.001).find((s) => bud(s / 0.42) >= 0.5)! + FAIRY.sproutStart;
  assert.ok(tileAt(FAIRY.sproutStart) < 0.5, `tile at ${tileAt(FAIRY.sproutStart).toFixed(2)} as the bud starts`);
  assert.ok(tileAt(budHalf) < 0.15, `tile at ${tileAt(budHalf).toFixed(2)} when the bud is half grown`);
  // The buds' anticipation keyframes land on the count, the fizzle sag and the BLING jump.
  const hop = /fairy-bud-hop (\d+)ms (\d+)ms/.exec(css);
  assert.ok(hop);
  assert.equal(Number(hop[2]), FAIRY.budHop[0] * 1000);
  assert.equal(Number(hop[1]), Math.round((FAIRY.budHop[1] - FAIRY.budHop[0]) * 1000));
  const block = /@keyframes fairy-bud-hop \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  const stops = [...block.matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]) / 100 * (FAIRY.budHop[1] - FAIRY.budHop[0]) + FAIRY.budHop[0]);
  for (const beat of [FAIRY.pulses[0], FAIRY.pulses[1], FAIRY.fizzle + 0.03, FAIRY.bling + 0.01]) {
    assert.ok(stops.some((stop) => near(stop, beat, 0.02)), `a bud keyframe near ${beat} s`);
  }
});

void test('fairy: cover art pops or shrinks away, never a slow see-through fade over the names', () => {
  const css = readFileSync('src/revealEffects/fairy.css', 'utf8');
  const keyframes = (name: string) => {
    const block = new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1];
    assert.ok(block, `@keyframes ${name}`);
    return [...block.matchAll(/([\d.]+)% \{([^}]*)\}/g)].map((m) => ({ at: Number(m[1]) / 100, body: m[2] }));
  };
  // The bud, the bloom, the petal whirl and the flying butterflies all end at scale 0, opaque all the way (after the
  // pop-in): no see-through ghost of solid art.
  for (const name of ['fairy-bud-pop', 'fairy-bloom', 'fairy-petals-in', 'fairy-bfly-a', 'fairy-bfly-b']) {
    const frames = keyframes(name);
    assert.match(frames[frames.length - 1].body, /scale\(0(, 0)?\)/, `${name} shrinks to nothing`);
    for (const frame of frames) {
      const opacity = /opacity:\s*([\d.]+)/.exec(frame.body);
      if (opacity && frame.at > 0.06) assert.equal(Number(opacity[1]), 1, `${name} at ${frame.at * 100}% is see-through`);
    }
  }
  // The paper sheet pops (a quick swell) rather than dissolving over the names.
  const sheet = /fairy-sheet-out (\d+)ms calc\(var\(--fairy-tap\) \+ (\d+)ms\)/.exec(css);
  assert.ok(sheet && Number(sheet[1]) <= 160 && Number(sheet[2]) <= 40, 'the sheet pops right at the tap');
  // The open flower is gone within about 0.4 s of its tap, and on short cards it is at most about two fifths of the
  // card's height, so it never sits over the names it has just uncovered.
  const bloom = /fairy-bloom (\d+)ms var\(--fairy-tap\)/.exec(css);
  assert.ok(bloom && Number(bloom[1]) <= 400, 'the bloom is quick');
  assert.match(css, /--fairy-bloom: min\(calc\(var\(--fairy-bud\) \* 1\.3\), max\(calc\(var\(--reveal-cover-height, 300px\) \* \.42\), 72px\)\);/);
  // The petals whirl into the bloom inside the card (no fixed-layer petals flying across the revealed names).
  assert.doesNotMatch(css, /fairy-cover-fly \.fairy-cover-piece/);
  const source = readFileSync('src/revealEffects/fairy.tsx', 'utf8');
  assert.match(source, /<div className="fairy-cover-fly"><CoverButterfly which="a" \/><CoverButterfly which="b" \/><\/div>/);
  // The cover butterflies fly up and to the right (away from the names, which sit at the left of cards and cells).
  for (const name of ['fairy-bfly-a', 'fairy-bfly-b']) {
    for (const frame of keyframes(name).slice(1)) {
      const x = /translate\((-?[\d.]+)vmin/.exec(frame.body);
      if (x) assert.ok(Number(x[1]) > 0, `${name} heads right at ${frame.at * 100}%`);
    }
  }
});

void test('fairy: the wand star lands on every column at its tap', () => {
  for (const { spec, L } of LAYOUTS) {
    for (const column of L.columns) {
      const star = fairyStarPoint(column.tap, L);
      const miss = Math.hypot(star.x - column.x, star.y - L.tapY);
      assert.ok(miss < 1, `${spec.name}: star misses the column at ${column.tap.toFixed(2)} s by ${miss.toFixed(2)} px`);
    }
  }
});

void test('fairy: taps run left to right with readable spacing', () => {
  for (const { spec, L } of LAYOUTS) {
    L.columns.forEach((column, i) => {
      if (!i) return;
      assert.ok(column.tap > L.columns[i - 1].tap && column.x > L.columns[i - 1].x, `${spec.name}: taps increase`);
      if (L.columns.length <= 7) assert.ok(column.tap - L.columns[i - 1].tap >= 0.15, `${spec.name}: taps ${i - 1}/${i} too close`);
    });
    assert.ok(L.columns[0].tap >= FAIRY.sweepT0 + 0.05, `${spec.name}: first tap after the lean-back`);
    assert.ok(L.columns[L.columns.length - 1].tap <= FAIRY.sweepT0 + FAIRY.sweepSpan, `${spec.name}: last tap`);
    assert.ok(L.arrive >= FAIRY.arriveMin && L.arrive <= FAIRY.arriveMax && L.arrive < FAIRY.land);
  }
});

void test('fairy: motion is continuous, with bounded speed, rotation and squash', () => {
  const step = 1 / 240;
  for (const { spec, L } of LAYOUTS) {
    let prev = fairyPose(FAIRY.entrance[0], L);
    for (const t of samples(FAIRY.entrance[0] + step, END, step)) {
      const pose = fairyPose(t, L);
      for (const value of [pose.x, pose.y, pose.rotate, pose.arm, pose.wrist, pose.head, pose.skirt, pose.sx, pose.sy, pose.spread, pose.star.scale]) assert.ok(Number.isFinite(value));
      const speed = Math.hypot(pose.x - prev.x, pose.y - prev.y) / step / spec.vw;
      assert.ok(speed <= 5, `${spec.name}: ${speed.toFixed(2)} vw/s at ${t.toFixed(3)}`);
      assert.ok(Math.abs(pose.rotate - prev.rotate) <= 4, `${spec.name}: body rotation jump at ${t.toFixed(3)}`);
      assert.ok(Math.abs(pose.arm - prev.arm) <= 8, `${spec.name}: arm jump at ${t.toFixed(3)}`);
      assert.ok(Math.abs(pose.wrist - prev.wrist) <= 9, `${spec.name}: wrist jump at ${t.toFixed(3)}`);
      assert.ok(Math.abs(pose.spread - prev.spread) <= 0.03 && pose.spread >= 0.6 && pose.spread <= 1, `${spec.name}: wing tuck at ${t.toFixed(3)}`);
      assert.ok(Math.abs(pose.head - prev.head) <= 4, `${spec.name}: head jump at ${t.toFixed(3)}`);
      assert.ok(pose.scale >= 0.6 && pose.scale <= 1.05);
      assert.ok(pose.sx >= 0.85 && pose.sx <= 1.15 && pose.sy >= 0.85 && pose.sy <= 1.15, `${spec.name}: squash at ${t.toFixed(3)}`);
      assert.ok(Math.abs(pose.flip) <= 1);
      prev = pose;
    }
  }
});

void test('fairy: she stays clear of the header and footer, and peeks from the right edge', () => {
  for (const { spec, L } of LAYOUTS) {
    // (Through the squat before the zoom too: a lowered peek spot sits just above the footer.)
    for (const t of samples(0.75, FAIRY.unflip[1], 1 / 120)) {
      const b = fairyBounds(t, L);
      // Her body and wings are never cropped by the left edge, from landing until she reaches the peek spot.
      if (t <= L.arrive) assert.ok(b.left >= -0.05 * L.W && b.left >= 0, `${spec.name}: cropped by the left edge at ${t.toFixed(3)} (left ${b.left.toFixed(1)})`);
      assert.ok(b.top >= FAIRY.headerPx - 1, `${spec.name}: under the header at ${t.toFixed(2)} (top ${b.top.toFixed(0)})`);
      assert.ok(b.bottom <= spec.vh - FAIRY.footerPx + 1, `${spec.name}: under the footer at ${t.toFixed(2)} (bottom ${b.bottom.toFixed(0)})`);
    }
    for (const t of [FAIRY.land, FAIRY.giggle[0] + 0.2, FAIRY.giggle[1] - 0.05]) assert.ok(fairyBounds(t, L).left >= spec.vw - 0.95 * L.W, `${spec.name}: peek spot at ${t}`);
  }
});

void test('fairy: she is off-screen before the entrance and after the exit', () => {
  for (const { spec, L } of LAYOUTS) {
    for (const t of [0, 0.1, FAIRY.entrance[0]]) assert.ok(fairyBounds(t, L).right < 0, `${spec.name}: visible at ${t}`);
    for (const t of [FAIRY.exitEnd, END]) {
      const b = fairyBounds(t, L);
      assert.ok(b.left > spec.vw || b.bottom < 0, `${spec.name}: still visible at ${t}`);
    }
    // No empty tail: she is still zooming across the corner until the last few frames.
    const late = fairyBounds(FAIRY.exitEnd - 0.04, L);
    assert.ok(late.left < spec.vw && late.bottom > 0, `${spec.name}: off-screen too early (left ${late.left.toFixed(0)})`);
  }
  assert.ok(END - FAIRY.exitEnd <= 0.05, 'the scene ends as she leaves');
});

void test('fairy: the hero butterfly rides her nose, then leaves before the end', () => {
  for (const { spec, L } of LAYOUTS) {
    const spawn = L.taps[L.taps.length - 1].t + 0.08;
    assert.equal(heroButterfly(spawn - 0.01, L), null);
    for (const t of samples(FAIRY.land, FAIRY.takeoff - 0.01, 0.05)) {
      const bf = heroButterfly(t, L), nose = fairyNose(t, L);
      assert.ok(bf && bf.perched && Math.hypot(bf.x - nose.x, bf.y - nose.y) < 1, `${spec.name}: butterfly off her nose at ${t.toFixed(2)}`);
    }
    // It arrives smoothly: its body within a few px of where the perched body sits, at the perched size.
    const before = heroButterfly(FAIRY.land - 0.004, L), root = heroPerchRoot(FAIRY.land - 0.004, L);
    assert.ok(before && Math.hypot(before.x - root.x, before.y - root.y) < 4, `${spec.name}: lands without a jump`);
    assert.ok(before && Math.abs(before.size - HERO_PERCH_SIZE) < 0.02, `${spec.name}: flies in at its perched size`);
    // Perched, it tilts with her head.
    for (const t of [FAIRY.land + 0.3, FAIRY.giggle[0] + 0.1]) {
      const bf = heroButterfly(t, L)!, body = fairyBody(t, L);
      assert.ok(Math.abs(bf.tilt - (body.rotate + fairyHead(t, L))) < 1e-6, `${spec.name}: tilts with her head`);
    }
    // It flies away and shrinks to nothing (opaque all the way: no see-through ghost), well before she zooms off.
    for (const t of samples(FAIRY.takeoff, END, 0.01)) {
      const bf = heroButterfly(t, L);
      assert.ok(bf && bf.opacity === 1, `${spec.name}: the butterfly fades at ${t.toFixed(2)}`);
      if (t >= FAIRY.takeoff + HERO_AWAY_S) assert.ok(bf.scale <= 0.001, `${spec.name}: butterfly gone at ${t.toFixed(2)}`);
    }
    assert.ok(FAIRY.takeoff + HERO_AWAY_S <= FAIRY.unflip[1] + 0.15);
  }
  // The perch is the tip of her nose, between her eyes.
  assert.ok(Math.abs(ART.perch.x) < 1 && ART.perch.y > -62 && ART.perch.y < -54);
});

/** Distance from a point to a polygon's outline (negative inside). */
function polygonClearance(poly: readonly { x: number; y: number }[], c: { x: number; y: number }) {
  let inside = false, d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    if ((b.y > c.y) !== (a.y > c.y) && c.x < (a.x - b.x) * (c.y - b.y) / (a.y - b.y) + b.x) inside = !inside;
    const dx = b.x - a.x, dy = b.y - a.y, u = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / (dx * dx + dy * dy)));
    d = Math.min(d, Math.hypot(c.x - a.x - u * dx, c.y - a.y - u * dy));
  }
  return inside ? -d : d;
}

void test('fairy: the perched butterfly is front-on in a V, and its wings miss both crossed pupils', () => {
  // Outline half-width (the wing stroke) in fairy art units.
  const stroke = 3.4 / 2 * PERCH.scale;
  let minClear = Infinity, span = 0;
  // From the moment it lands (it arrives with its wings half raised, so they never lie flat over her eyes).
  for (const t of samples(FAIRY.land, FAIRY.takeoff, 1 / 120)) {
    for (const wing of perchedWingPolygons(t)) {
      for (const pupil of ART.crossedPupils) {
        // The polygons are the left wings; the right wings mirror them, so test each pupil against both.
        minClear = Math.min(minClear, polygonClearance(wing, pupil), polygonClearance(wing.map((p) => ({ x: -p.x, y: p.y })), pupil));
      }
      // Low on her face the V stays narrow (between the pupils); the wide part sits over her forehead and bangs.
      for (const p of wing) if (p.y > -72) assert.ok(Math.abs(p.x) <= 9, `wing point (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) spreads over her eyes at ${t.toFixed(2)}`);
      span = Math.max(span, ...wing.map((p) => -p.x));
    }
  }
  assert.ok(minClear - ART.pupilRadius - stroke >= 1, `wings clear the pupils by ${(minClear - ART.pupilRadius - stroke).toFixed(2)} art units`);
  // About 0.2 W across (the art box is 330 units = W).
  assert.ok(2 * span / 330 >= 0.18 && 2 * span / 330 <= 0.24, `span ${(2 * span / 330).toFixed(3)} W`);
  // The wings rise into the V as it lands, then open and close slowly (not a flat squash).
  assert.ok(perchWings(FAIRY.land).fore <= PERCH.fore * PERCH.landRise + 1e-9 && perchWings(FAIRY.land + PERCH.rise).fore >= PERCH.fore - 1e-9, 'the wings rise as it lands');
});

type Box = { left: number; top: number; right: number; bottom: number };
type Pt = { x: number; y: number };
/** How far a convex polygon reaches into a box (separating axes): 0 or less means they are clear of each other. */
function convexBoxOverlap(poly: readonly Pt[], box: Box) {
  const corners = [{ x: box.left, y: box.top }, { x: box.right, y: box.top }, { x: box.right, y: box.bottom }, { x: box.left, y: box.bottom }];
  const axes = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > 1e-9) axes.push({ x: (a.y - b.y) / len, y: (b.x - a.x) / len });
  });
  let depth = Infinity;
  for (const axis of axes) {
    const along = (p: Pt) => p.x * axis.x + p.y * axis.y;
    const a = poly.map(along), c = corners.map(along);
    depth = Math.min(depth, Math.min(Math.max(...a), Math.max(...c)) - Math.max(Math.min(...a), Math.min(...c)));
  }
  return depth;
}
/** The hero butterfly's drawn box (placed as fairy.tsx places it: tilted and scaled about its origin). */
function heroBox(hero: HeroButterfly, W: number): Pt[] {
  const w = hero.perched ? PERCH_BOX.w / 330 * W : HERO_FLY_W * W * hero.size, h = hero.perched ? PERCH_BOX.h / 330 * W : 0.8 * w;
  const ox = hero.perched ? -PERCH_BOX.x / PERCH_BOX.w : 0.5, oy = hero.perched ? -PERCH_BOX.y / PERCH_BOX.h : 0.5;
  const a = hero.tilt * Math.PI / 180;
  return [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => {
    const dx = (u - ox) * w * hero.scale, dy = (v - oy) * h * hero.scale;
    return { x: hero.x + dx * Math.cos(a) - dy * Math.sin(a), y: hero.y + dx * Math.sin(a) + dy * Math.cos(a) };
  });
}
/**
 * The names on a tall single-row team card run down from its top at the left: six long names (9 to 11 letters,
 * the longest about 190 px) fill about the left 75% and the top 56% of the card at 1280 x 800 (less of it on bigger screens).
 */
const NAME_BLOCK = { width: 0.75, height: 0.56 };

void test('fairy: at the peek spot she is fully on screen and leaves the last card\'s names clear', () => {
  let tall = 0;
  for (const { spec, L } of LAYOUTS) {
    const rects = rectsFor(spec);
    const last = rects.length ? rects.reduce((a, r) => (r.left > a.left ? r : a)) : null;
    // She faces right all the way (no turn, so never a paper-thin, edge-on frame): at the peek spot her wand, the
    // giggle and the wave play on the screen-edge side, away from the names.
    for (const t of samples(0, END, 1 / 120)) assert.equal(fairyBody(t, L).flip, 1, `${spec.name}: faces right at ${t.toFixed(3)}`);
    for (const t of samples(L.arrive, FAIRY.unflip[0], 1 / 120)) {
      const b = fairyBounds(t, L);
      assert.ok(b.right <= spec.vw - 1, `${spec.name}: the right edge crops her at ${t.toFixed(2)} (right ${b.right.toFixed(1)})`);
      assert.ok(fairyBody(t, L).spread <= PERCH_SPREAD + 1e-9, `${spec.name}: wings relaxed at the peek spot`);
      // The wand star (about 22 art units across its points) stays inside the right edge through the giggle and the wave.
      assert.ok(fairyStarPoint(t, L).x + 22 * L.unit <= spec.vw + 1, `${spec.name}: the right edge crops the wand star at ${t.toFixed(2)}`);
      // The name area (the left 45% of the rightmost card), where that card is at least as wide as she is.
      if (last && last.width >= L.W) assert.ok(b.left >= last.left + 0.45 * last.width - 0.02 * L.W, `${spec.name}: over the last card's names at ${t.toFixed(2)} (left ${b.left.toFixed(0)})`);
    }
    // A tall single-row last card: from her arrival until she has zoomed off, her body, the wand star and the hero
    // butterfly stay clear of its name block (she peeks from below the names, and from there leaves right first).
    if (!last || rects.filter((r) => r.left === last.left).length !== 1 || last.height < 0.55 * spec.vh) continue;
    tall++;
    const block = { left: last.left, top: last.top, right: last.left + NAME_BLOCK.width * last.width, bottom: last.top + NAME_BLOCK.height * last.height };
    for (const t of samples(L.arrive, FAIRY.exitEnd, 1 / 240)) {
      const body = fairyBody(t, L);
      const hull = ART.bodyHull.map(([x, y]) => toScreen(body, { x, y }, L.unit));
      const over = convexBoxOverlap(hull, block);
      assert.ok(over <= 0, `${spec.name}: her body is ${over.toFixed(1)} px into the last card's names at ${t.toFixed(3)}`);
      const star = fairyStarPoint(t, L);
      assert.ok(star.x >= block.right || star.y >= block.bottom, `${spec.name}: the wand star is over the last card's names at ${t.toFixed(3)}`);
      const hero = heroButterfly(t, L);
      if (hero && hero.scale > 1e-3) {
        const heroOver = convexBoxOverlap(heroBox(hero, L.W), block);
        assert.ok(heroOver <= 0, `${spec.name}: the hero butterfly is ${heroOver.toFixed(1)} px into the last card's names at ${t.toFixed(3)}`);
      }
    }
  }
  assert.ok(tall >= 5, `${tall} tall single-row layouts checked`);
});

void test('fairy: face, wings and head follow the story beats', () => {
  const expected: [number, string][] = [[0.5, 'happy'], [1.0, 'focus'], [FAIRY.fizzle + 0.1, 'surprised'], [FAIRY.look[0] + 0.12, 'look'], [FAIRY.shake[0] + 0.1, 'effort'], [FAIRY.bling + 0.05, 'delighted'],
    [FAIRY.crossed[0] + 0.1, 'crossed'], [FAIRY.giggle[0] + 0.2, 'delighted'], [FAIRY.wave[0] + 0.1, 'wink'], [FAIRY.exitEnd, 'happy']];
  for (const [t, face] of expected) assert.equal(fairyFace(t), face, `face at ${t}`);
  assert.equal(fairyWings(FAIRY.fizzle + 0.2), 'fizzled');
  assert.equal(fairyWings(FAIRY.giggle[0] + 0.2), 'giggling');
  assert.equal(fairyWings(1.0), 'flutter');
  const L = LAYOUTS[0].L;
  // The fizzled arm droops well below the count pose, and the BLING raises it again.
  assert.ok(fairyArm(FAIRY.fizzle + 0.1, L) > 45 && fairyArm(FAIRY.pulses[0], L) < -10);
  assert.ok(fairyArm(FAIRY.bling, L) < fairyArm(FAIRY.shake[1], L) - 20, 'the arm whips up for the BLING');
  assert.ok(fairyHead(FAIRY.look[0] + 0.1, L) > 8, 'she tilts her head about 10 degrees towards the wand');
});

void test('fairy: the count and the BLING hold the star in clear air, and she looks at her wand', () => {
  // Art units, upright. Her bun is a circle at (0,-138) r 27; her hair reaches x = 53; the hair flower sits on her left (x < 0).
  const clearOfHead = (p: { x: number; y: number }, radius: number) => Math.hypot(p.x, p.y + 138) >= 27 + radius * 0.75 && (p.x - radius * 0.6 >= 45 || p.y + radius * 0.6 <= -150);
  const star = (pose: { arm: number; wrist: number }) => starLocal(pose.arm, pose.wrist);
  const R = 18.4 * 1.2; // star art radius
  assert.ok(clearOfHead(star(POSES.count), R * 1.35), 'count star clears her head');
  assert.ok(clearOfHead(star(POSES.pump), R * 1.5), 'pump star clears her head');
  assert.ok(clearOfHead(star(POSES.bling), R * 1.3) && star(POSES.bling).y < -125, 'BLING star is raised, right of her bun');
  for (const pose of [POSES.count, POSES.pump, POSES.bling]) assert.ok(star(pose).x > 45 && star(pose).y < -120, 'the star is up and to the right, on the wand side');
  // Looking at the wand: the grey star is beside her face, near eye height.
  const look = star(POSES.look);
  assert.ok(look.x > 50 && look.x < 90 && look.y > -100 && look.y < -60, `look star beside her face: ${look.x.toFixed(0)}, ${look.y.toFixed(0)}`);
  const L = LAYOUTS[0].L;
  const lookPose = fairyArmPose(FAIRY.look[0] + 0.14, L);
  assert.ok(Math.abs(lookPose.arm - POSES.look.arm) < 6 && Math.abs(lookPose.wrist - POSES.look.wrist) < 6, 'she holds the look pose');
  // The look reads from the back of the room: the wand is up beside her face, her eyes on it and her head
  // tilted, for at least a quarter of a second before the swing into the shake.
  const held = samples(FAIRY.look[0], FAIRY.shake[0], 1 / 240).filter((t) => {
    const pose = fairyArmPose(t, L), star = starLocal(pose.arm, pose.wrist);
    return Math.abs(pose.arm - POSES.look.arm) <= 6 && Math.abs(pose.wrist - POSES.look.wrist) <= 12 && star.x > 45 && star.x < 95 && star.y > -105 && star.y < -60
      && fairyFace(t) === 'look' && fairyHead(t, L) >= 9;
  });
  assert.ok(held.length / 240 >= 0.25 && held[held.length - 1] - held[0] >= 0.24, `look held ${(held.length / 240).toFixed(3)} s`);
  // Mid-hold she turns the wand over with a little head bob ("huh?"), so the hold stays alive.
  const heads = held.map((t) => fairyHead(t, L));
  assert.ok(Math.max(...heads) - Math.min(...heads) >= 4, 'the head bobs during the hold');
  // The dead grey star is what she is puzzled about, so it pops up to about 1.4x while she peers at it (big enough
  // to read from the back of the room), and is back to its droopy size before the shake.
  const [l0] = FAIRY.look, s0 = FAIRY.shake[0];
  assert.equal(lookStarPop(l0 + 0.05), 0);
  for (const t of samples(l0 + 0.14, s0 - 0.08, 0.01)) {
    const star = fairyStar(t, L);
    assert.ok(star.grey && star.scale >= 0.8 + 0.9 * (LOOK_STAR_SCALE - 0.8), `grey star at ${star.scale.toFixed(2)}x at ${t.toFixed(2)}`);
  }
  assert.ok(Math.abs(fairyStar(s0 + 0.03, L).scale - 0.8) < 1e-6, 'the grey star is back to its droopy size for the shake');
  // The BLING star swells to 2.2x; the rays and shockwave clear away by the first tap.
  assert.ok(Math.abs(fairyStar(FAIRY.bling + 0.08, L).scale - BLING_SCALE) < 0.02);
  for (const { L: layout } of LAYOUTS) assert.ok(layout.columns[0].tap >= FAIRY.bling + BLING_RAYS_S && layout.columns[0].tap >= FAIRY.bling + BLING_RING_S - 0.12);
});

void test('fairy: the BLING core sparkle sits behind the star, so the re-lit star reads saturated gold', () => {
  const source = readFileSync('src/revealEffects/fairy.tsx', 'utf8');
  const back = source.slice(source.indexOf('private drawBack('), source.indexOf('private drawFront('));
  const front = source.slice(source.indexOf('private drawFront('), source.indexOf('export function FairyScene'));
  assert.ok(back.length > 100 && front.length > 100);
  assert.match(back, /'blingcore'/);
  assert.doesNotMatch(front, /blingcore/);
});

void test('fairy: the first hop goes on from the hover spot, and edge taps lean in instead of backing off-screen', () => {
  for (const { spec, L } of LAYOUTS) {
    // (Unless the first card's centre is itself left of the hover spot: then she leans all the way in.)
    assert.ok(L.taps[0].x >= L.hover.x - 0.03 * spec.vw - 1 || L.taps[0].d === 1, `${spec.name}: first tap waist ${L.taps[0].x.toFixed(0)} retreats from hover ${L.hover.x.toFixed(0)}`);
    // The lean-back is in place (no drift towards the edge before the hop).
    assert.ok(Math.abs(fairyBody(FAIRY.anticipation[1], L).x - L.hover.x) < 1, `${spec.name}: anticipation in place`);
    for (const tap of L.taps) assert.ok(tap.d >= 0 && tap.d <= 1 && tap.arm >= POSES.sideTap.arm - 1e-9 && tap.lean >= POSES.sideTap.lean - 1e-9);
  }
  // Wide open layouts keep the side flick for every column after the first.
  const g4 = LAYOUTS[0].L;
  assert.ok(g4.taps.slice(1).every((tap) => tap.d === 0));
});

void test('fairy: after each tap she springs back and holds before travelling on', () => {
  for (const { spec, L } of LAYOUTS) {
    L.taps.forEach((tap, i) => {
      const next = L.taps[i + 1];
      const gap = next ? next.t - tap.t : L.arrive - tap.t;
      const hold = (next ? Math.min(FAIRY.hold, 0.45 * gap) : FAIRY.hold) * (next ? 1 - 0.5 * tap.d : 1);
      const later = fairyBody(tap.t + Math.min(FAIRY.recoil, hold) - 1e-3, L);
      // After a side flick she springs up and back (never on across the bloom she just made) until the hold ends;
      // after a lean-in tap (she is above the bloom) she springs up and on.
      const pull = 0.035 * (1 - tap.d) - 0.03 * tap.d;
      assert.ok(Math.abs(later.x - tap.x) <= 0.04 * spec.vw && (later.x - tap.x) * pull <= 1, `${spec.name}: tap ${i} springs ${pull > 0 ? 'back' : 'on'}`);
      assert.ok(later.y <= tap.y + 0.5, `${spec.name}: tap ${i} springs up`);
      if (tap.d === 0) assert.ok(later.x < tap.x - 0.01 * spec.vw && fairyBody(tap.t + 0.06, L).rotate < tap.lean - 3, `${spec.name}: tap ${i} recoils`);
    });
    // Leaving the last bloom she arcs up over it: when she passes over the last column she is well above the tap row.
    const last = L.taps[L.taps.length - 1], col = L.columns[L.columns.length - 1];
    const over = samples(last.t, L.arrive, 0.002).find((t) => fairyBody(t, L).x >= col.x);
    if (over !== undefined) {
      const y = fairyBody(over, L).y;
      assert.ok(y <= L.tapY - 0.08 * spec.vh || y <= L.hopCeil + 1, `${spec.name}: passes over the last bloom at waist ${y.toFixed(0)} (tap row ${L.tapY.toFixed(0)})`);
    }
  }
});

void test('fairy: late covers are timed against the band the first ones were set up with', () => {
  // A minimal DOM: covers with styles, datasets and rects.
  type FakeCover = {
    style: { setProperty(k: string, v: string): void; getPropertyValue(k: string): string };
    dataset: Record<string, string | undefined>;
    getBoundingClientRect(): { left: number; top: number; width: number; height: number; right: number; bottom: number };
  };
  const make = (left: number, top: number, width: number, height: number): FakeCover => {
    const props = new Map<string, string>();
    return {
      style: { setProperty: (k, v) => void props.set(k, v), getPropertyValue: (k) => props.get(k) ?? '' },
      dataset: {},
      getBoundingClientRect: () => ({ left, top, width, height, right: left + width, bottom: top + height }),
    };
  };
  const covers: FakeCover[] = [make(24, 74, 289, 637), make(333, 74, 289, 637), make(643, 74, 289, 637)];
  const g = globalThis as unknown as { window?: unknown; document?: unknown };
  const saved = { window: g.window, document: g.document };
  g.window = { innerWidth: 1280, innerHeight: 800 };
  g.document = { querySelectorAll: () => covers };
  const timing = (c: FakeCover) => [c.style.getPropertyValue('--fairy-band-x'), c.style.getPropertyValue('--fairy-focus-dy'), c.dataset.fairyTint];
  try {
    const first = measureFairyLayout();
    const before = covers.map(timing);
    assert.deepEqual(first.band, fairyBand(covers.map((c) => c.getBoundingClientRect()), 1280, 800));
    // A fourth card mounts later, to the right of the band.
    covers.push(make(952, 74, 289, 637));
    const late = measureFairyLayout();
    assert.deepEqual(covers.slice(0, 3).map(timing), before, 'running covers are untouched');
    assert.equal(covers[3].style.getPropertyValue('--fairy-band-x'), '1.0000', 'the late cover is timed against the stored band');
    assert.deepEqual(late.band, first.band);
    assert.equal(late.columns.length, 4, 'the Stage layout includes the late column');
    // A resize re-measures everything against a fresh band.
    const resized = measureFairyLayout(true);
    assert.ok(resized.band.right > first.band.right);
    assert.notEqual(covers[0].style.getPropertyValue('--fairy-band-x'), before[0][0]);
  } finally {
    g.window = saved.window; g.document = saved.document;
  }
});


void test('fairy: ribbon and glitter are bounded, deterministic and done before the end', () => {
  for (const { spec, L } of LAYOUTS) {
    // The ribbon reels in as she lands, so the count and the fizzle play without it (no dim, see-through swirl).
    for (const t of samples(FAIRY.landReel[1], FAIRY.bling - 0.005, 0.02)) assert.equal(fairyRibbon(t, L).pts.length, 0, `${spec.name}: ribbon hidden at ${t}`);
    for (const t of samples(0, END, 0.05)) {
      const ribbon = fairyRibbon(t, L);
      for (const p of ribbon.pts) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
        assert.ok(p.half <= 0.0375 * L.W + 1.5 * L.W / 288 + 0.65 + 1e-9 && p.fill <= p.half && p.fill >= 0);
      }
      if (ribbon.pts.length >= 3) {
        const shape = ribbonShape(ribbon.pts);
        assert.ok(shape.chunks.length >= 1 && shape.chunks.length <= RIBBON_CHUNKS);
        for (const chunk of shape.chunks) for (const d of [chunk.edge, chunk.fill]) assert.match(d, /^M[-\d.]+ [-\d.]+(L[-\d.]+ [-\d.]+)+Z$/);
      }
      const glitter = fairyGlitter(t, L);
      assert.ok(glitter.length <= 32, `${spec.name}: ${glitter.length} glitter at ${t.toFixed(2)}`);
      for (const g of glitter) assert.ok(Number.isFinite(g.x) && Number.isFinite(g.y) && g.opacity <= 1 && g.size >= 0);
    }
    assert.deepEqual(fairyGlitter(2.5, L), fairyGlitter(2.5, L));
    for (const t of samples(FAIRY.glitterEnd, END, 0.01)) assert.equal(fairyGlitter(t, L).length, 0, `${spec.name}: glitter lingers at ${t}`);
    // Glitter shrinks away rather than fading (so it can be drawn batched by colour, all opaque).
    for (const t of samples(0.2, END, 0.1)) for (const g of fairyGlitter(t, L)) assert.equal(g.opacity, 1);
    // A big table gets half the glitter.
    if (L.covers.length > 20) assert.equal(glitterRate(L), 15); else assert.equal(glitterRate(L), 30);
    assert.equal(ribbonOpacity(END, L), 0);
    assert.equal(fairyRibbon(FAIRY.exitEnd, L).pts.length, 0, `${spec.name}: the ribbon has reeled in when she is gone`);
  }
});

void test('fairy: the ribbon is smooth, never folds into spikes, and restarts clean after the BLING', () => {
  for (const { spec, L } of LAYOUTS) {
    for (const t of samples(FAIRY.entrance[0], END, 0.004)) {
      const { pts } = fairyRibbon(t, L);
      // Its edges never run backwards against the centreline (that is what draws spikes and V-kinks).
      const normal = (k: number) => {
        const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        return { x: -dy / len, y: dx / len };
      };
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x, dy = pts[i + 1].y - pts[i].y, n0 = normal(i), n1 = normal(i + 1);
        for (const side of [1, -1]) {
          const ex = dx + side * (n1.x * pts[i + 1].half - n0.x * pts[i].half), ey = dy + side * (n1.y * pts[i + 1].half - n0.y * pts[i].half);
          assert.ok(ex * dx + ey * dy > 0, `${spec.name}: ribbon edge folds at ${t.toFixed(3)} (sample ${i})`);
        }
        // Densely sampled and rounded: no visible corners in the centreline. (Where the star really doubles
        // back, the ribbon pinches to under a pixel, like a ribbon folding over.)
        if (i) {
          const ax = pts[i].x - pts[i - 1].x, ay = pts[i].y - pts[i - 1].y;
          const turn = Math.atan2(Math.abs(ax * dy - ay * dx), ax * dx + ay * dy) * 180 / Math.PI;
          assert.ok(turn <= 75 || pts[i].half <= 1, `${spec.name}: ribbon corner of ${turn.toFixed(0)} degrees at ${t.toFixed(3)} (half-width ${pts[i].half.toFixed(2)})`);
          assert.ok(Math.hypot(ax, ay) <= 0.04 * spec.vw, `${spec.name}: ribbon facet of ${Math.hypot(ax, ay).toFixed(0)} px at ${t.toFixed(3)}`);
        }
      }
      // The ribbon is a comet: widest near the head, thin at the tail.
      if (pts.length > 4) assert.ok(pts[pts.length - 1].half <= 0.25 * Math.max(...pts.map((p) => p.half)) + 0.5, `${spec.name}: ribbon tail at ${t.toFixed(3)}`);
      // After the fizzle the magic comes back on at the BLING: the ribbon only trails what happened since.
      if (t >= FAIRY.bling && t < FAIRY.bling + RIBBON_SPAN) for (const p of pts) assert.ok(t - p.age >= FAIRY.bling - 1e-9, `${spec.name}: ribbon traces the shake at ${t.toFixed(3)}`);
      // Each tap restarts it from the star: it never trails back past the latest tap, so the recoil never folds it
      // over itself or drags it across the card that has just bloomed.
      const lastTap = Math.max(-Infinity, ...L.taps.map((k) => k.t).filter((k) => k <= t));
      for (const p of pts) assert.ok(t - p.age >= lastTap - 1e-6 || !Number.isFinite(lastTap), `${spec.name}: ribbon older than the tap at ${lastTap.toFixed(2)} (t ${t.toFixed(3)})`);
      for (const p of pts) assert.ok(t - p.age >= ribbonRestart(t, L) - 1e-6);
    }
    // After a tap there is no ribbon while she springs back; it regrows once she heads on, so it never hooks back
    // up over the names of the card that has just bloomed.
    const regrow = ribbonRegrowTimes(L);
    L.taps.forEach((tap, i) => {
      assert.ok(regrow[i] >= tap.t && regrow[i] <= tap.t + 0.25, `${spec.name}: tap ${i} regrows at ${regrow[i].toFixed(3)}`);
      const end = L.taps[i + 1]?.t ?? L.arrive;
      const dir = (L.taps[i + 1]?.x ?? L.peek.x) >= tap.x ? 1 : -1;
      const from = fairyStarPoint(regrow[i], L);
      for (const t of samples(tap.t + 0.001, end - 0.002, 0.004)) {
        const { pts } = fairyRibbon(t, L);
        if (t < regrow[i]) assert.equal(pts.length, 0, `${spec.name}: ribbon during the recoil at ${t.toFixed(3)}`);
        for (const p of pts) assert.ok((p.x - from.x) * dir >= -2, `${spec.name}: ribbon hooks back behind the recoil at ${t.toFixed(3)}`);
      }
    });
    // Leaving the last bloom it reels in (it never fades to a ghost), so it does not sweep over the last card's names.
    const leave = L.taps[L.taps.length - 1].t + FAIRY.recoil;
    assert.ok(ribbonSpan(L.arrive, L) <= 1e-9 && fairyRibbon(L.arrive, L).pts.length === 0 && ribbonSpan((leave + L.arrive) / 2, L) < 0.7 * RIBBON_SPAN, `${spec.name}: ribbon reels in on the way to the peek spot`);
    for (const t of samples(L.arrive, FAIRY.unflip[0] - 0.005, 0.02)) assert.equal(fairyRibbon(t, L).pts.length, 0, `${spec.name}: no ribbon at the peek spot (${t.toFixed(2)})`);
  }
});

void test('fairy: layout keeps the tap row and hover spots inside the safe band', () => {
  for (const { spec, L } of LAYOUTS) {
    assert.ok(L.W >= 200 && L.W <= 420);
    assert.ok(L.tapY > FAIRY.headerPx && L.tapY < spec.vh - FAIRY.footerPx, spec.name);
    assert.ok(L.hover.x > 0 && L.hover.x < spec.vw / 2 && L.peek.x > spec.vw / 2, spec.name);
    const body = fairyBody(L.taps[0].t, L);
    assert.ok(near(body.x, L.taps[0].x, 1e-6) && near(body.y, L.taps[0].y, 1e-6), `${spec.name}: tap waypoint reached`);
  }
});
