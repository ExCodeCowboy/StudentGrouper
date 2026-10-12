import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { blackHoleEffect } from '../src/revealEffects/blackHole';
import { BLACK_HOLE_RINGS, arcPath, cometPath, ringComets, spiralArmPath } from '../src/revealEffects/blackHoleArt';
import {
  BLACK_HOLE_BEATS, BLACK_HOLE_BURST, BLACK_HOLE_BURST_BIRTH, BLACK_HOLE_BURST_START_MS, BLACK_HOLE_CARD_SPREAD, BLACK_HOLE_CENTER_RADIUS, BLACK_HOLE_CRUMBS,
  BLACK_HOLE_CRUMB_DURATION_MS, BLACK_HOLE_CRUMB_START_MS, BLACK_HOLE_CRUMB_STEP_MS, BLACK_HOLE_DENSE_COVERS, BLACK_HOLE_DENSE_STRIPS, BLACK_HOLE_DURATION_MS,
  BLACK_HOLE_DUSK, BLACK_HOLE_FLIGHT, BLACK_HOLE_FOCUS, BLACK_HOLE_HOP_MIN, BLACK_HOLE_HOP_REACH, BLACK_HOLE_LAST_STRIP_END, BLACK_HOLE_MINI_DURATION_MS,
  BLACK_HOLE_MINI_START_MS, BLACK_HOLE_MOUTH_Y, BLACK_HOLE_SCRAPS, BLACK_HOLE_STARS, BLACK_HOLE_STREAKS, BLACK_HOLE_STRIPS, BLACK_HOLE_STRIP_STEP,
  BLACK_HOLE_TWINKLE_MS, BLACK_HOLE_CROWDED_COVERS, BLACK_HOLE_CROWDED_STRIPS, BLACK_HOLE_STRIP_MOUNT_LAST_MS, BLACK_HOLE_STRIP_MOUNT_MS, BLACK_HOLE_STRIP_MOUNT_STEP_MS,
  BLACK_HOLE_SPARK_BODY, BLACK_HOLE_SPARK_MAX_SHIFT, BLACK_HOLE_SLURP_KEYS, BLACK_HOLE_TRAIL_ANCHOR, BLACK_HOLE_TRAIL_LENGTH, blackHoleTrail,
  blackHoleCoverVars, blackHoleDuskAlpha, blackHolePrintSpans, blackHoleSide, blackHoleSize, blackHoleSparkShift, blackHoleStripCount, blackHoleStripDelay, blackHoleStripLayout,
  blackHoleStripMountTimes, blackHoleStripStart,
  blackHoleTug, buildBlackHoleBurst, buildBlackHoleScraps, buildBlackHoleStars, buildBlackHoleStreaks,
} from '../src/revealEffects/blackHoleTimeline';

// Normalise line endings: Windows checkouts use CRLF.
const css = readFileSync('src/revealEffects/blackHole.css', 'utf8').replace(/\r\n/g, '\n');
const source = readFileSync('src/revealEffects/blackHole.tsx', 'utf8').replace(/\r\n/g, '\n');
const beats = BLACK_HOLE_BEATS;
const ms = (seconds: number) => Math.round(seconds * 1000);

/** Every `selector { declarations }` rule outside @keyframes, comments removed. */
function cssRules() {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  return Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g), (match) => ({ selector: match[1].trim(), body: match[2] }));
}
function rule(selector: string) {
  const found = cssRules().find((item) => item.selector === selector);
  assert.ok(found, `rule ${selector} exists`);
  return found.body;
}
function keyframesBody(name: string) {
  const match = css.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`)) ?? css.match(new RegExp(`@keyframes ${name} \\{(.*?\\})\\s*\\}`));
  assert.ok(match, `@keyframes ${name} exists`);
  return match[1];
}
/** The annotated keyframe lines of a beat block as [ms, declarations]. */
function beatKeys(name: string) {
  return Array.from(keyframesBody(name).matchAll(/^\s*[\d.%, ]+ \{([^}]*)\} \/\* ([\dms, ]+) \*\/$/gm)).flatMap(([, body, stamps]) =>
    stamps.split(',').map((stamp) => [Number.parseFloat(stamp), body] as const));
}
/** The `animation` shorthand entry that runs `name` as [duration ms, delay ms] (delays may be calc()). */
function animationOf(name: string) {
  for (const item of cssRules()) {
    const animation = item.body.match(/animation:\s*([^;]+)/)?.[1];
    const entry = animation?.split(/,(?![^(]*\))/).map((part) => part.trim()).find((part) => part.startsWith(`${name} `));
    if (entry) {
      const [duration, delay] = Array.from(entry.matchAll(/(\d+(?:\.\d+)?)ms/g), (match) => Number(match[1]));
      return { selector: item.selector, entry, duration, delay };
    }
  }
  assert.fail(`no rule animates ${name}`);
}

void test('black-hole keeps its id and sound, and fits its presentation budget', () => {
  assert.equal(blackHoleEffect.id, 'black-hole');
  assert.equal(blackHoleEffect.sound, 'black-hole');
  assert.equal(blackHoleEffect.durationMs, BLACK_HOLE_DURATION_MS);
  assert.equal(BLACK_HOLE_DURATION_MS, 5300);
  assert.ok(blackHoleEffect.durationMs <= 5300, 'within the proposed 5300 ms budget');
  assert.ok(blackHoleEffect.durationMs <= 9800, 'under the hard cap');
  assert.equal(ms(beats.end), BLACK_HOLE_DURATION_MS);
  assert.equal(typeof blackHoleEffect.Stage, 'function');
  assert.equal(typeof blackHoleEffect.Cover, 'function');
});

void test('black-hole beats run in story order, the face acting holds long enough to read, and the scene clears before the end', () => {
  const order: (keyof typeof beats)[] = ['spark', 'bloom', 'hopLand', 'lean', 'stretch', 'maxStretch', 'boing', 'slurp', 'powerUp', 'seams', 'swap', 'eat', 'lastBite', 'eyes', 'surprised', 'glanceLeft', 'glanceRight', 'squeeze', 'burp', 'happy', 'deflate', 'twinkle', 'gone', 'clear'];
  for (let index = 1; index < order.length; index++) assert.ok(beats[order[index - 1]] < beats[order[index]], `${order[index - 1]} before ${order[index]}`);
  assert.ok(beats.clear + .1 <= beats.end, 'the screen is clear well inside the duration (a slow first frame never cuts the ending)');
  assert.ok(beats.end - beats.clear <= .15, 'no dead time at the end');
  // The "almost!" strain is held long enough to read at full stretch.
  assert.ok(beats.boing - beats.maxStretch >= .12);
  // Eyes open only after every strip has been eaten.
  assert.ok(BLACK_HOLE_LAST_STRIP_END <= beats.lastBite && beats.lastBite < beats.eyes);
  // Readable from across the room: the surprised "o" and the > < "holding it in" face each hold at least 350 ms.
  assert.ok(beats.squeeze - beats.surprised >= .35 - 1e-9, 'surprised "o" holds');
  assert.ok(beats.burp - beats.squeeze >= .35 - 1e-9, '> < with pressed lips holds before the burp');
  // The burp mouth reads, then the big grin pops in as the burp ring clears and holds, large, before the portal deflates.
  assert.ok(beats.happy - beats.burp >= .14 - 1e-9 && beats.happy - beats.burp <= .16 + 1e-9, 'the grin pops in as the burp ring clears');
  assert.ok(beats.deflate - beats.happy >= .35 - 1e-9, 'the happy face holds, large, before the portal deflates');
  const grow = beatKeys('bh-grow').map(([time, body]) => [time, Number(body.match(/scale\(([\d.]+)\)/)?.[1])] as const);
  const held = grow.filter(([time]) => time >= ms(beats.happy) && time <= ms(beats.deflate));
  assert.ok(held.length >= 2 && held.every(([, scale]) => scale >= 1), 'the hole stays full size while it grins');
  // The grin pops in from a visible .55 on exactly the frame the squeeze and the burp mouth end (no blank face in between):
  // it fills forwards only, over a base opacity of 0, so it is hidden until then.
  assert.match(keyframesBody('bh-happy'), /0% \{ opacity: 1; transform: scale\(\.55\); \}/, 'the grin pops in, visible, near full size');
  assert.match(rule('.bh-happy'), new RegExp(`^\\s*opacity: 0; animation: bh-happy 220ms ${ms(beats.happy)}ms forwards;\\s*$`));
  for (const selector of ['.bh-eyes-squeeze', '.bh-cheeks', '.bh-mouth-o']) {
    const [, duration, delay] = rule(selector).match(/animation: bh-\w+ (\d+)ms (\d+)ms;/) ?? [];
    assert.equal(Number(duration) + Number(delay), ms(beats.happy), `${selector} ends exactly as the grin appears`);
  }
  // The twinkle peaks (35% of its run) as the portal winks out.
  const twinklePeak = ms(beats.twinkle) + BLACK_HOLE_TWINKLE_MS * .35;
  assert.match(keyframesBody('bh-twinkle'), /35% \{ transform: scale\(1\.12\)/);
  assert.ok(Math.abs(twinklePeak - ms(beats.gone)) <= 20, 'twinkle peak lands on the wink-out');
});

void test('the glance is big and holds on each side', () => {
  const keys = beatKeys('bh-glance').map(([time, body]) => [time, Number(body.match(/translateX\((-?[\d.]+)px\)/)?.[1])] as const);
  const left = keys.filter(([, x]) => x <= -6);
  const right = keys.filter(([, x]) => x >= 6);
  assert.ok(left.length >= 2 && right.length >= 2, 'the pupils rest at both sides');
  assert.ok(left.at(-1)![0] - left[0][0] >= 120, 'holds left for at least 120 ms');
  assert.ok(right.at(-1)![0] - right[0][0] >= 120, 'holds right for at least 120 ms');
  assert.ok(left[0][0] >= ms(beats.glanceLeft) && right[0][0] <= ms(beats.glanceRight), 'arrives on its beats');
  assert.equal(keys.at(-1)![0], ms(beats.squeeze), 'the glance lasts until the squeeze');
  // Pupils are clipped to the eye whites (so a 7-unit glance presses them against the rim).
  assert.match(source, /<clipPath id="bh-eye-0">/);
  // A big happy face: an open grin with a tongue, and thick ^ ^ eyes.
  assert.match(source, /<g className="bh-happy">[\s\S]*strokeWidth="6\.5"[\s\S]*<path d="M-15 7H15Q15 28 0 28Q-15 28 -15 7Z"/);
  assert.match(source, /clipPath=\{`url\(#bh-eye-\$\{index\}\)`\}/);
});

void test('every strip peels off after the rip and is swallowed before the face appears', () => {
  const distances = [0, .25, .5, .75, 1];
  const centers = [0, .2, .42, .45, .5, .55, .58, .8, 1];
  let latest = 0;
  for (const strips of [BLACK_HOLE_STRIPS, BLACK_HOLE_DENSE_STRIPS, BLACK_HOLE_CROWDED_STRIPS]) {
    for (const centerX of centers) {
      for (const distance of distances) {
        const starts = Array.from({ length: strips }, (_, slice) => blackHoleStripStart(distance, centerX, slice, strips));
        for (const start of starts) {
          assert.ok(start >= beats.swap + .06, 'strips wait for the sheet to step away');
          assert.ok(start + BLACK_HOLE_FLIGHT <= beats.lastBite + 1e-9, 'strips are gone by the last bite');
          latest = Math.max(latest, start + BLACK_HOLE_FLIGHT);
        }
        const first = starts.indexOf(Math.min(...starts));
        if (centerX < .42) assert.equal(first, strips - 1, 'a card left of the hole loses its right-hand strip first');
        if (centerX > .58) assert.equal(first, 0, 'a card right of the hole loses its left-hand strip first');
        if (distance > 0) for (let slice = 0; slice < strips; slice++) {
          assert.ok(blackHoleStripStart(distance, centerX, slice, strips) >= blackHoleStripStart(distance - .25, centerX, slice, strips), 'nearer cards go first');
        }
      }
    }
  }
  assert.ok(Math.abs(latest - BLACK_HOLE_LAST_STRIP_END) < 1e-9);
  // Out-of-range inputs clamp instead of scheduling strips outside the gobble.
  assert.equal(blackHoleStripStart(-3, .5, 0), blackHoleStripStart(0, .5, 0));
  assert.equal(blackHoleStripStart(9, .5, 0), blackHoleStripStart(1, .5, 0));
  assert.equal(blackHoleSide(-1), -1);
  assert.equal(blackHoleSide(2), 1);
  assert.equal(blackHoleSide(BLACK_HOLE_FOCUS.x), 0);
  // Dense reveals (the Today table) cut each cover into fewer ribbons.
  assert.equal(blackHoleStripCount(BLACK_HOLE_DENSE_COVERS), BLACK_HOLE_STRIPS);
  assert.equal(blackHoleStripCount(BLACK_HOLE_DENSE_COVERS + 1), BLACK_HOLE_DENSE_STRIPS);
  assert.equal(blackHoleStripCount(1), BLACK_HOLE_STRIPS);
  assert.equal(blackHoleStripCount(12), BLACK_HOLE_STRIPS, 'every Groups layout (up to 12 teams) keeps 6 strips');
  assert.equal(blackHoleStripCount(13), BLACK_HOLE_DENSE_STRIPS, 'the Today table (more than 12 cells) uses 4');
  assert.equal(blackHoleStripCount(BLACK_HOLE_CROWDED_COVERS), BLACK_HOLE_DENSE_STRIPS);
  assert.equal(blackHoleStripCount(BLACK_HOLE_CROWDED_COVERS + 1), BLACK_HOLE_CROWDED_STRIPS, 'a very large Today table uses 3');
});

void test('strip layouts tile the cover, pivot on the portal and tumble about their own centres', () => {
  const viewport = { width: 1280, height: 800 };
  const portal = { x: viewport.width * BLACK_HOLE_FOCUS.x, y: viewport.height * BLACK_HOLE_FOCUS.y };
  const rect = { left: 40, top: 90, width: 300, height: 560 };
  for (const strips of [BLACK_HOLE_STRIPS, BLACK_HOLE_DENSE_STRIPS]) {
    const cover = { distance: .5, strips };
    const layouts = Array.from({ length: strips }, (_, slice) => blackHoleStripLayout(rect, viewport, cover, slice));
    assert.equal(layouts[0].left, 0);
    for (let slice = 0; slice < strips; slice++) {
      const layout = layouts[slice];
      assert.ok(Math.abs(layout.width - (rect.width / strips + 1)) < 1e-9, 'each strip overlaps the next by 1 px');
      if (slice > 0) assert.ok(Math.abs(layout.left - (layouts[slice - 1].left + layouts[slice - 1].width - 1)) < 1e-9, 'strips tile the cover');
      assert.ok(Math.abs(rect.left + layout.left + layout.originX - portal.x) < 1e-9, 'orbit pivot is the portal (x)');
      assert.ok(Math.abs(rect.top + layout.originY - portal.y) < 1e-9, 'orbit pivot is the portal (y)');
      assert.ok(Math.abs(rect.left + layout.left + (layout.width - 1) / 2 - (portal.x + layout.vx)) < 1e-9, 'v = strip centre - portal (x)');
      assert.ok(Math.abs(rect.top + rect.height / 2 - (portal.y + layout.vy)) < 1e-9, 'v = strip centre - portal (y)');
      assert.ok(Math.abs(layout.k + layouts[strips - 1 - slice].k) < 1e-9, 'twist offsets are symmetric');
      assert.equal(layout.delayMs, Math.round(blackHoleStripStart(.5, (rect.left + rect.width / 2) / viewport.width, slice, strips) * 1000));
    }
    assert.ok(Math.abs(layouts.at(-1)!.left + layouts.at(-1)!.width - 1 - rect.width) < 1e-9, 'the last strip ends at the cover edge');
    // Without a tile size every strip prints everything; with one, each strip keeps exactly the pieces it can show.
    assert.ok(layouts.every((layout) => layout.tile && layout.specks[0] && layout.specks[1]));
    for (const tile of [40, 90, 150]) {
      const culled = Array.from({ length: strips }, (_, slice) => blackHoleStripLayout(rect, viewport, cover, slice, tile));
      const spans = blackHolePrintSpans(rect.width, tile);
      const covers = (span: readonly [number, number], keep: (layout: typeof culled[number]) => boolean) => {
        for (const layout of culled) {
          const inside = span[1] > layout.left && span[0] < layout.left + layout.width;
          assert.equal(keep(layout), inside, `strip at ${layout.left} ${inside ? 'shows' : 'cannot show'} [${span.join(', ')}]`);
        }
      };
      covers(spans.tile, (layout) => layout.tile);
      covers(spans.specks[0], (layout) => layout.specks[0]);
      covers(spans.specks[1], (layout) => layout.specks[1]);
      assert.ok(spans.tile[0] < rect.width / 2 - tile / 2 && spans.tile[1] > rect.width / 2 + tile / 2 + tile * .14, 'the tile span covers the tile and its star');
    }
  }
  // A wide card (one team) keeps the tile in only the strips around its middle.
  const wide = { left: 20, top: 72, width: 1240, height: 644 };
  const wideStrips = Array.from({ length: BLACK_HOLE_STRIPS }, (_, slice) => blackHoleStripLayout(wide, viewport, { distance: 0, strips: BLACK_HOLE_STRIPS }, slice, 100));
  assert.deepEqual(wideStrips.map((layout) => layout.tile), [false, false, true, true, false, false]);
  assert.deepEqual(wideStrips.map((layout) => layout.specks), [[true, false], [false, false], [false, false], [false, false], [false, false], [false, true]]);
  assert.match(source, /\{layout\.specks\[0\] && specks\[0\]\}\{layout\.specks\[1\] && specks\[1\]\}\{layout\.tile && tile\}/);
  // The stylesheet runs every strip with the timeline's flight (its delay comes inline from the layout).
  const fly = animationOf('bh-strip-fly');
  assert.equal(fly.selector, '.bh-strip');
  assert.equal(fly.duration, ms(BLACK_HOLE_FLIGHT));
  assert.equal(fly.delay, undefined, 'no per-strip calc() delay in the stylesheet');
  assert.match(fly.entry, /linear both$/);
  // One animated element per strip: the flight composes the orbit about the portal with the strip's own tumble.
  const body = keyframesBody('bh-strip-fly');
  const frames = Array.from(body.matchAll(/^\s*([\d.]+)% \{ transform: (.*?);( opacity: [\d.]+;)? \}$/gm));
  assert.ok(frames.length >= 12, 'dense enough to follow the tumble easing');
  for (const [, , transform] of frames) assert.match(transform, /^rotate\([-\d.]+deg\) scale\([\d.]+\) translate\(var\(--bh-vx\), var\(--bh-vy\)\) translateY\(calc\(var\(--bh-k\) \* [-\d.]+px\)\) rotate\(calc\(var\(--bh-k\) \* [-\d.]+deg \+ [-\d.]+deg\)\) scale\([\d.]+, [\d.]+\) translate\(calc\(-1 \* var\(--bh-vx\)\), calc\(-1 \* var\(--bh-vy\)\)\)$/, 'the same function list in every keyframe');
  const angleAt = new Map(frames.map(([, percent, transform]) => [Number(percent), Number(transform.match(/^rotate\(([-\d.]+)deg\)/)?.[1])]));
  const angles = [...angleAt.values()];
  for (let index = 1; index < angles.length; index++) assert.ok(angles[index] >= angles[index - 1], 'strips keep spiralling one way');
  assert.ok(angleAt.get(100)! - angleAt.get(60)! > 3 * (angleAt.get(40)! - angleAt.get(0)!), 'the spiral speeds up as the strips fall in');
});

void test('the paper never moves before the rip, and every cover is fully revealed by the end', () => {
  // The intact sheet only steps to transparent at the swap (no lean that would uncover the strips), and only
  // once its strips are in place (.is-armed); --bh-clock re-bases the delay where Web Animations are missing.
  assert.match(rule('.bh-sheet'), /^\s*position: absolute; inset: 0; border-radius: inherit;\s*$/);
  const swap = animationOf('bh-swap-out');
  assert.equal(swap.selector, '.bh-paper.is-armed .bh-sheet');
  assert.equal(swap.delay + swap.duration, ms(beats.swap) + 1);
  assert.match(rule('.bh-paper.is-armed .bh-sheet'), new RegExp(`animation-delay: calc\\(${ms(beats.swap)}ms - var\\(--bh-clock, 0ms\\)\\);`));
  assert.match(source, /className = `bh-paper\$\{setup\?\.center \? ' is-center' : ''\}\$\{clock !== null \? ' is-armed' : ''\}`/);
  assert.match(keyframesBody('bh-swap-out'), /opacity: 0/);
  // The sheet's swap-out and the strips join the reveal clock of the seams layer (which starts with everything else).
  assert.match(source, /querySelector\('\.bh-seams'\)\?\.getAnimations\(\)\[0\]/);
  assert.match(source, /querySelectorAll\('\.bh-sheet, \.bh-strip'\)/);
  // Nothing else ever moves or scales the sheet (a card under the portal keeps its border: no bulge).
  assert.ok(!/bh-sheet-bulge/.test(css));
  for (const item of cssRules()) {
    if (/\.bh-sheet\s*$/.test(item.selector)) assert.ok(!/transform|bulge/.test(item.body) && (!/animation/.test(item.body) || /animation: bh-swap-out 1ms 1780ms both;/.test(item.body)), `${item.selector} only steps away`);
  }
  // Strips end invisible, shrunk to nothing, and hold that state (fill both).
  assert.match(keyframesBody('bh-strip-fly'), /100% \{ transform: rotate\(640deg\) scale\(0\)[^}]*opacity: 0; \}/);
  // The strips' parent never animates (an animated-opacity wrapper would force a render surface).
  assert.ok(!cssRules().some((item) => /\.bh-strips\b/.test(item.selector) && !/\.bh-strips\s*>/.test(item.selector) && /animation/.test(item.body)));
  // No strip shadow (it showed under the card edge at rest); the curl shading is baked into the strip print.
  assert.ok(!/box-shadow/.test(rule('.bh-strip')));
  assert.match(rule('.bh-strip > .bh-print'), /background: linear-gradient\(to right/);
  // No scene-wide fade (an animated-opacity wrapper renders the whole stage into one offscreen surface for the whole reveal):
  // every stage element ends invisible on its own, the last (the twinkle and its minis) by the clear beat.
  assert.match(rule('.bh-scene'), /^\s*position: absolute; inset: 0;\s*$/);
  assert.ok(!/bh-fade-out/.test(css));
  for (const name of ['bh-twinkle', 'bh-mini']) {
    const animation = animationOf(name);
    assert.ok(animation.delay + animation.duration <= ms(beats.clear), `${name} is over by the clear beat`);
    assert.match(keyframesBody(name), /100% \{ transform: [^}]*scale\(0\)/, `${name} pops out (scale 0)`);
  }
});

void test('the stage draws each tug over every cover and hands the tile back after the boing', () => {
  // Stretch, "?" and strand run the same window, from the lean to the hand-off, and end invisible.
  for (const name of ['bh-tile-stretch', 'bh-tile-mark', 'bh-strand']) {
    const animation = animationOf(name);
    assert.equal(animation.delay, ms(beats.lean), `${name} starts at the lean`);
    assert.equal(animation.delay + animation.duration, 1700, `${name} ends at the hand-off`);
    assert.match(animation.entry, /both$/);
    const keys = beatKeys(name);
    assert.match(keys.at(-1)![1], /opacity: 0/, `${name}: the copy vanishes at the hand-off`);
    assert.ok(!/opacity/.test(keys[0][1]), `${name}: the copy is visible at rest (it sits on the cover's tile)`);
  }
  // Meanwhile the cover's own tile steps aside (an "only during" window), for exactly that span.
  const away = animationOf('bh-away');
  assert.equal(away.selector, '.bh-paper[data-bh-tug] .bh-sheet .bh-tile', 'only when the stage drew a copy for this cover');
  assert.equal(away.delay, ms(beats.lean));
  assert.equal(away.delay + away.duration, 1700);
  assert.ok(!/both|forwards|backwards/.test(away.entry));
  assert.match(keyframesBody('bh-away'), /from, to \{ opacity: 0; \}/);
  // The copies sit ABOVE the dusk (bright butter tiles while they star in the gag) and under everything else.
  assert.match(source, /<div className=\{art\.hop \? 'bh-scene has-hop' : 'bh-scene'\} style=\{art\.style\}>\{duskArt\}\{art\.tugs\}\{sceneArt\}\{art\.over\}<\/div>/);
  assert.match(source, /const duskArt = <div className="bh-dim" \/>;/);
  assert.ok(!/const sceneArt = <>\s*<div className="bh-dim"/.test(source));
  // ...so each copy fades into the dusk (the same colour and alpha .bh-dim lays over it, which is at full strength
  // by the hand-off) before it vanishes and the dimmed cover tile is back.
  const wash = animationOf('bh-wash');
  assert.equal(wash.selector, '.bh-tug-wash');
  assert.equal(wash.delay, ms(beats.powerUp));
  assert.equal(wash.delay + wash.duration, ms(beats.seams));
  const washKeys = beatKeys('bh-wash');
  assert.match(washKeys[0][1], /opacity: 0/);
  assert.ok(washKeys.some(([time, body]) => time === ms(beats.seams) - 4 && /opacity: 1/.test(body)));
  assert.match(washKeys.at(-1)![1], /opacity: 0/);
  assert.ok(beatKeys('bh-dim').some(([time, body]) => time === ms(beats.seams) && /opacity: 1/.test(body)), 'full dusk at the hand-off');
  assert.match(source, /'--bh-wash-color': `rgba\(48, 22, 134, \$\{tug\.wash\.toFixed\(3\)\}\)`/);
  assert.match(rule('.bh-tile.is-wash'), /background-clip: padding-box/);
  // The portal rim-lights the stretched tiles gold (a static gradient on the hole side, faded with the stretch).
  const rim = animationOf('bh-rim');
  assert.equal(rim.selector, '.bh-rim');
  assert.equal(rim.delay, ms(beats.lean));
  assert.equal(rim.delay + rim.duration, ms(beats.seams));
  const rimKeys = beatKeys('bh-rim');
  const rimAt = (time: number) => Number(rimKeys.find(([at]) => at === time)?.[1].match(/opacity: ([\d.]+)/)?.[1]);
  assert.equal(rimAt(ms(beats.stretch)), 0);
  assert.equal(rimAt(ms(beats.maxStretch)), 1);
  assert.equal(rimAt(ms(beats.boing)), 1);
  assert.equal(rimAt(1600), 0, 'the rim light is gone before the wash');
  assert.match(source, /<i className="bh-rim" style=\{\{ background: `linear-gradient\(\$\{tug\.rimAngle\.toFixed\(1\)\}deg, rgba\(255, 214, 120, 0\)/);
  // A "?" right under the portal hops out (startled by the spark, dropping out of the way before the iris opens on it,
  // landing with one small bounce), is tugged straight up, and after the BOING is slurped up into the portal; its cover
  // never shows its own tile.
  const hop = animationOf('bh-hop');
  assert.equal(hop.selector, '.bh-tug.is-hop > .bh-tug-hop');
  assert.ok(hop.delay > ms(beats.spark) && hop.delay < ms(beats.bloom));
  assert.ok(hop.delay - ms(beats.spark) <= 30, 'startled as soon as the spark appears');
  assert.equal(hop.delay + hop.duration, ms(beats.seams));
  const hopKeys = beatKeys('bh-hop').map(([time, body]) => {
    const match = body.match(/translate\(calc\(var\(--bh-in-x\) \* (-?[\d.]+)\), calc\(var\(--bh-hop\) \* (-?[\d.]+) \+ var\(--bh-in-y\) \* (-?[\d.]+) \+ var\(--T\) \* (-?[\d.]+)\)\) scale\(([\d.]+), ([\d.]+)\)/);
    assert.ok(match, `bh-hop key at ${time}`);
    const [inX, reach, inY, lift, sx, sy] = match.slice(1).map(Number);
    assert.equal(inX, inY, `bh-hop key at ${time}: one path to the portal`);
    return { time, into: inX, reach, lift, sx, sy };
  });
  const landed = hopKeys.find((key) => key.time === ms(beats.hopLand));
  assert.ok(landed && landed.reach === 1 && landed.sx > 1.15 && landed.sy < .85, 'lands squashing on its beat');
  const leap = hopKeys.find((key) => key.reach < 0)!;
  const touchDown = hopKeys.find((key) => key.reach === 1)!;
  assert.ok(touchDown.time - leap.time >= 170, 'a fall long enough to follow from the back of the room');
  assert.ok(leap.time <= ms(beats.bloom) - 80, 'already falling well before the portal opens where it was');
  const settle = hopKeys.filter((key) => key.time > ms(beats.hopLand) && key.time <= ms(beats.boing));
  assert.ok(settle.some((key) => key.lift < -.1) && settle.some((key) => key.lift > 0), 'one small secondary bounce');
  assert.ok(hopKeys.filter((key) => key.time >= ms(beats.hopLand) && key.time <= ms(beats.slurp)).every((key) => key.reach === 1 && key.into === 0 && key.lift >= -.2), 'stays clear of the disk through the tug');
  assert.ok(hopKeys.filter((key) => key.time < ms(beats.hopLand)).every((key) => key.reach <= 1 && key.reach >= -.1 && key.into === 0), 'never jumps up into the portal');
  // The slurp: straight after the BOING squash, about 200 ms, stretching toward the hole, ending at the portal's centre.
  const slurpKeys = hopKeys.filter((key) => key.time >= ms(beats.slurp));
  assert.equal(slurpKeys[0].time, ms(beats.slurp));
  assert.ok(ms(beats.seams) - ms(beats.slurp) >= 180, 'a slurp slow enough to see');
  assert.ok(ms(beats.slurp) - ms(beats.boing) <= 80, 'the slurp follows the BOING at once');
  for (let index = 1; index < slurpKeys.length; index++) assert.ok(slurpKeys[index].into > slurpKeys[index - 1].into, 'keeps moving toward the portal');
  assert.ok(slurpKeys.some((key) => key.sx <= .72 && key.sy >= 1.38), 'stretches toward the hole (about .7 x 1.4) as it zips up');
  const slurped = hopKeys.at(-1)!;
  assert.ok(slurped.into === 1 && slurped.reach === 0 && slurped.sx < .5 && slurped.sy < 1, 'ends at the portal centre, shrinking');
  // It enters the rim only in the last 40 ms: 40 ms before the end it is still less than half way from its landing spot.
  assert.ok(hopKeys.find((key) => key.time === ms(beats.seams) - 40)!.into < .5);
  // Two identical copies: under the portal until the slurp starts, then over the glow and the power-up pulse (the lip over it).
  assert.match(source, /className=\{hop \? `bh-tug is-hop is-\$\{layer\}` : 'bh-tug'\}/);
  assert.match(source, /over: hopper \? <div className="bh-tugs">\{tugCopy\(0, hopper, 'over'\)\}\{lipArt\}<\/div> : null/);
  assert.match(rule('.bh-tug.is-under'), new RegExp(`animation: bh-off 1ms ${ms(beats.slurp) - 1}ms both;`));
  assert.match(rule('.bh-tug.is-over'), new RegExp(`opacity: 0; animation: bh-on 1ms ${ms(beats.slurp) - 1}ms both;`));
  assert.ok(ms(beats.slurp) < ms(beats.powerUp), 'the copy is over the portal before the glow grows over it');
  // The trail and the lip run inside the slurp; the lip is an exact copy of the core and photon ring.
  const trail = animationOf('bh-trail');
  assert.equal(trail.delay, ms(beats.slurp));
  assert.equal(trail.delay + trail.duration, ms(beats.seams));
  assert.match(beatKeys('bh-trail').at(-1)![1], /opacity: 0/);
  assert.match(source, /\{layer === 'over' && <i className="bh-trail" \/>\}/);
  // The trail is taffy stuck to the spot where the "?" sat (not a cone): the timeline mirrors the slurp keys of bh-hop, and
  // at each of them the trail's stretch (inline, per layout) keeps its drop on that spot; then it lets go and snaps up.
  assert.deepEqual(BLACK_HOLE_SLURP_KEYS.map(([time]) => time), slurpKeys.filter((key) => key.into < .5).map((key) => key.time));
  for (const [time, into, scaleY] of BLACK_HOLE_SLURP_KEYS) {
    const key = slurpKeys.find((item) => item.time === time)!;
    assert.equal(key.into, into, `slurp key ${time}: into`);
    assert.equal(key.sy, scaleY, `slurp key ${time}: scaleY`);
  }
  const trailKeys = beatKeys('bh-trail');
  const trailScale = (time: number) => trailKeys.find(([at]) => at === time)?.[1].match(/scale\((var\(--bh-trail-(\d), ([\d.]+)\)|[\d.]+), ([\d.]+)\)/);
  BLACK_HOLE_SLURP_KEYS.slice(1).forEach(([time], index) => assert.equal(trailScale(time)?.[2], String(index + 1), `the trail stretch at ${time} ms comes from --bh-trail-${index + 1}`));
  for (const [size, hop, inX, inY] of [[101.5, 223.8, 7.5, -24.3], [80, 180, 0, -30], [101.5, 300, -40, -10]]) {
    const { angle, scales } = blackHoleTrail({ size, hop, inX, inY });
    const path = Math.hypot(inX, inY - hop);
    assert.ok(Math.abs(Math.cos(angle * Math.PI / 180) * path + inX) < 1e-6 && Math.abs(Math.sin(angle * Math.PI / 180) * path + inY - hop) < 1e-6, 'the trail points back down the path');
    BLACK_HOLE_SLURP_KEYS.slice(1).forEach(([, into, scaleY], index) => {
      const onScreen = scales[index] * BLACK_HOLE_TRAIL_LENGTH * size * scaleY;
      assert.ok(Math.abs(onScreen - (into * path + BLACK_HOLE_TRAIL_ANCHOR * size)) < 1e-6, 'the drop stays where the tile\'s bottom edge rested');
    });
  }
  // The fallbacks are the 1-team 1280x800 values, and the trail art is TRAIL_LENGTH tiles long.
  const g1 = blackHoleTrail({ size: 101.5, hop: 223.8, inX: 7.5, inY: -24.3 });
  BLACK_HOLE_SLURP_KEYS.slice(1).forEach(([time], index) => assert.ok(Math.abs(Number(trailScale(time)?.[3]) - g1.scales[index]) < .01, `fallback stretch at ${time} ms`));
  assert.match(rule('.bh-trail'), new RegExp(`width: calc\\(var\\(--T\\) \\* ${BLACK_HOLE_TRAIL_LENGTH}\\);`));
  assert.match(source, /'--bh-trail-angle': `\$\{trail\.angle\.toFixed\(1\)\}deg`/);
  // It snaps (shrinks back behind the tile) well before the hand-off, and the snap is quick.
  const snapped = trailKeys.filter(([at]) => at > BLACK_HOLE_SLURP_KEYS.at(-1)![0]);
  assert.ok(snapped.length >= 2 && snapped[0][0] - BLACK_HOLE_SLURP_KEYS.at(-1)![0] <= 20, 'lets go and snaps up quickly');
  for (const [, body] of snapped) assert.ok(Number(body.match(/scale\(([\d.]+),/)?.[1]) <= .3, 'snapped back behind the tile');
  const lip = rule('.bh-hole.bh-lip').match(/^\s*opacity: 0; animation: bh-open 700ms 300ms both, bh-gulp (\d+)ms (\d+)ms, bh-window (\d+)ms (\d+)ms;\s*$/);
  assert.ok(lip, 'the lip runs the same opening, the gulp and a short window');
  const [gulpDuration, gulpDelay, lipDuration, lipDelay] = lip.slice(1).map(Number);
  assert.ok(lipDelay <= ms(beats.seams) - 60 && lipDelay + lipDuration >= ms(beats.seams) + 20, 'the lip covers the whole entry');
  assert.ok(lipDelay + lipDuration <= ms(beats.eyes), 'the lip is gone long before the face');
  assert.ok(gulpDelay <= ms(beats.seams) && gulpDelay + gulpDuration > ms(beats.seams), 'the portal gulps as the "?" goes in');
  assert.match(rule('.bh-scene.has-hop .bh-hole:not(.bh-lip)'), new RegExp(`^\\s*animation: bh-open 700ms 300ms both, bh-gulp ${gulpDuration}ms ${gulpDelay}ms;\\s*$`));
  assert.match(css, /@keyframes bh-gulp \{ 0% \{ transform: scale\(1, 1\); \}[^\n]* 100% \{ transform: scale\(1, 1\); \} \}\n/, 'the gulp starts and ends where the opening ends');
  assert.match(source, /const lipArt = <div className="bh-hole bh-lip"><div className="bh-grow"><div className="bh-act">/);
  assert.match(source, /<div className="bh-photon">\{photonArt\}<\/div>\n<\/div><\/div><\/div>;/);
  assert.match(rule('.bh-paper.is-center[data-bh-tug] .bh-tile'), /^\s*opacity: 0;\s*$/);
  assert.match(source, /\{!hop && <span className="bh-tug-wash">/);
  // The "?" rides unstretched: its squash stays mild in every keyframe.
  for (const [, body] of beatKeys('bh-tile-mark')) {
    const scale = body.match(/scale\(([\d.]+), ([\d.]+)\)/);
    if (scale) for (const value of [Number(scale[1]), Number(scale[2])]) assert.ok(value >= .9 && value <= 1.15, `mild "?" squash (${value})`);
  }
  // The taffy strand stays tucked behind the tile at rest and after the boing (its tip stays inside the squashed tile, whose near edge never comes closer than .32 T).
  for (const [time, body] of beatKeys('bh-strand')) {
    const scaleX = Number(body.match(/scale\(([\d.]+),/)?.[1] ?? NaN);
    if ((time <= 700 || time >= 1475) && !Number.isNaN(scaleX)) assert.ok(scaleX * 2.12 <= .34, `strand hidden at ${time} ms`);
  }
  // Full stretch is held until the boing.
  assert.match(keyframesBody('bh-tile-stretch'), new RegExp(`\\} /\\* ${ms(beats.maxStretch)}ms \\*/`));
  assert.match(keyframesBody('bh-tile-stretch'), new RegExp(`scale\\(1\\.74, 0\\.8\\);[^}]*\\} /\\* ${ms(beats.boing)}ms \\*/`));
});

void test('black-hole cover vars rank cards by distance, aim each tug at the portal and spot a card under the portal', () => {
  const viewport = { width: 1280, height: 800 };
  const focus = { x: 640, y: 368 };
  const card = (x: number, y: number, width = 200, height = 300) => ({ left: x - width / 2, top: y - height / 2, width, height });
  const rects = [card(focus.x - 500, focus.y), card(focus.x - 150, focus.y), card(focus.x + 150, focus.y), card(focus.x + 500, focus.y), card(focus.x, focus.y + 300)];
  const vars = blackHoleCoverVars(rects, viewport);
  assert.equal(vars[1].distance, 0, 'nearest card first');
  assert.equal(vars[2].distance, 0, 'equally near cards tie');
  assert.equal(vars[0].distance, 1, 'farthest card last');
  assert.equal(vars[3].distance, 1);
  assert.ok(vars[4].distance > 0 && vars[4].distance < 1);
  for (const item of vars) assert.ok(item.distance >= 0 && item.distance <= 1 && Math.abs(item.side) <= 1 && !item.center && item.strips === BLACK_HOLE_STRIPS);
  assert.ok(Math.abs(vars[0].angle) < 1e-9, 'a card left of the portal pulls right (0 deg)');
  assert.ok(Math.abs(Math.abs(vars[3].angle) - 180) < 1e-9, 'a card right of the portal pulls left');
  assert.ok(Math.abs(vars[4].angle + 90) < 1e-9, 'a card below the portal pulls up (-90 deg)');
  assert.ok(Math.abs(blackHoleCoverVars([card(focus.x, focus.y - 250)], viewport)[0].angle - 90) < 1e-9, 'a card above pulls down');
  assert.equal(vars[0].side, -1);
  assert.equal(vars[3].side, 1);
  assert.deepEqual(blackHoleCoverVars([card(100, 100)], viewport).map((item) => item.distance), [0], 'a single card starts at once');
  assert.deepEqual(blackHoleCoverVars([card(focus.x - 300, focus.y), card(focus.x + 300, focus.y)], viewport).map((item) => item.distance), [0, 0], 'equal distances start together');
  assert.deepEqual(blackHoleCoverVars([], viewport), []);
  // One big centred card sits under the portal: its tile hops out and reaches straight up.
  const near = blackHoleSize(viewport) * BLACK_HOLE_CENTER_RADIUS;
  const [centred] = blackHoleCoverVars([card(focus.x + near * .5, focus.y + near * .5, 900, 560)], viewport);
  assert.ok(centred.center);
  assert.equal(centred.angle, -90);
  assert.ok(!blackHoleCoverVars([card(focus.x + near * 1.2, focus.y, 900, 560)], viewport)[0].center);
  assert.equal(blackHoleSize(viewport), 400);
  assert.equal(blackHoleSize({ width: 3000, height: 2000 }), 560);
  // Many covers share the dense (or, beyond 24, the crowded) strip count.
  const many = blackHoleCoverVars(Array.from({ length: 48 }, (_, index) => card(100 + index * 20, 200, 120, 60)), viewport);
  assert.ok(many.every((item) => item.strips === BLACK_HOLE_CROWDED_STRIPS));
  const today = blackHoleCoverVars(Array.from({ length: 15 }, (_, index) => card(100 + index * 60, 200, 120, 60)), viewport);
  assert.ok(today.every((item) => item.strips === BLACK_HOLE_DENSE_STRIPS));
});

void test('the stage places each tug copy on its tile, hops a "?" out from under the portal, and matches the dusk', () => {
  const viewport = { width: 1280, height: 800 };
  const portal = blackHoleSize(viewport);
  const focus = { x: viewport.width * BLACK_HOLE_FOCUS.x, y: viewport.height * BLACK_HOLE_FOCUS.y };
  // An ordinary card: the copy sits on the tile, with no hop, lit on the side facing the hole.
  const side = { left: 40, top: 72, width: 380, height: 644 };
  const [sideVars] = blackHoleCoverVars([side], viewport);
  const plain = blackHoleTug(side, viewport, sideVars, 70, 2)!;
  assert.ok(plain);
  assert.equal(plain.hop, 0);
  assert.equal(plain.x, side.left + side.width / 2);
  assert.equal(plain.y, side.top + side.height / 2);
  assert.equal(plain.size, Math.min(70 * 1.45, side.height * .6));
  assert.ok(Math.abs(plain.rimAngle - (sideVars.angle + 90 - 2)) < 1e-9, 'gradient points at the hole across the tilted tile');
  assert.equal(plain.wash, blackHoleDuskAlpha(plain.x, plain.y, viewport));
  assert.ok(plain.wash > .1 && plain.wash < .46);
  // The middle card of a row of three sits under the portal: its "?" hops clear of the disk but stays in its card.
  const middle = { left: 435, top: 72, width: 395, height: 644 };
  const [middleVars] = blackHoleCoverVars([middle], viewport);
  assert.ok(middleVars.center);
  const hopper = blackHoleTug(middle, viewport, middleVars, 70)!;
  assert.ok(hopper.hop > 0);
  const landing = hopper.y + hopper.hop;
  assert.ok(landing - focus.y >= portal * BLACK_HOLE_HOP_MIN - 1e-9 && landing - focus.y <= portal * BLACK_HOLE_HOP_REACH + 1e-9, 'lands below the disk');
  assert.ok(landing + hopper.size * .62 <= middle.top + middle.height + 1e-9, 'lands inside its card');
  assert.equal(hopper.angle, -90);
  // A small centred cell has no room to hop: the stage draws no copy and its tile just stays put under the portal.
  const cell = { left: focus.x - 60, top: focus.y - 30, width: 120, height: 60 };
  const [cellVars] = blackHoleCoverVars([cell], viewport);
  assert.ok(cellVars.center);
  assert.equal(blackHoleTug(cell, viewport, cellVars, 30), null);
  // The dusk alpha follows the .bh-dim gradient: deepest at its centre, zero at the header and footer lines and beyond the ellipse.
  const boxHeight = viewport.height - BLACK_HOLE_DUSK.top - BLACK_HOLE_DUSK.bottom;
  const centreY = BLACK_HOLE_DUSK.top + boxHeight * BLACK_HOLE_DUSK.cy;
  assert.ok(Math.abs(blackHoleDuskAlpha(viewport.width / 2, centreY, viewport) - .46) < 1e-9);
  assert.equal(blackHoleDuskAlpha(viewport.width / 2, BLACK_HOLE_DUSK.top - 1, viewport), 0);
  assert.equal(blackHoleDuskAlpha(viewport.width / 2, viewport.height - BLACK_HOLE_DUSK.bottom + 1, viewport), 0);
  assert.equal(blackHoleDuskAlpha(-5000, centreY, viewport), 0);
  let last = 1;
  for (let x = viewport.width / 2; x <= viewport.width; x += 40) {
    const alpha = blackHoleDuskAlpha(x, centreY, viewport);
    assert.ok(alpha <= last + 1e-12, 'fades outward');
    last = alpha;
  }
  const gradient = rule('.bh-dim').match(/radial-gradient\(ellipse ([\d.]+)% ([\d.]+)% at 50% ([\d.]+)%, (.*)\);/);
  assert.ok(gradient);
  assert.equal(Number(gradient[1]) / 100, BLACK_HOLE_DUSK.rx);
  assert.equal(Number(gradient[2]) / 100, BLACK_HOLE_DUSK.ry);
  assert.equal(Number(gradient[3]) / 100, BLACK_HOLE_DUSK.cy);
  const stops = Array.from(gradient[4].matchAll(/rgba\([^)]*, ([\d.]+)\) ([\d.]+)%/g), ([, alpha, offset]) => [Number(offset) / 100, Number(alpha)]);
  assert.deepEqual(stops, BLACK_HOLE_DUSK.stops.map(([offset, alpha]) => [offset, alpha]));
  assert.match(rule('.bh-dim'), new RegExp(`top: ${BLACK_HOLE_DUSK.top}px; bottom: ${BLACK_HOLE_DUSK.bottom}px;`));
});

void test('the strips are added after the first frame, nearest cover first, and join the reveal clock', () => {
  // Mount times: the nearest cover in the first frame (it pays the one-time cost of the first strip layers while
  // nothing moves yet), the rest from 0.5 s, nearest first, at most 40 ms apart, all done well before the rip.
  for (const count of [1, 2, 3, 4, 8, 12, 15, 48]) {
    const distances = Array.from({ length: count }, (_, index) => ((index * 7) % count) / Math.max(1, count - 1));
    const times = blackHoleStripMountTimes(distances);
    assert.equal(times.length, count);
    assert.equal(times.filter((time) => time === 0).length, 1, 'exactly one cover mounts its strips at once');
    assert.equal(distances[times.indexOf(0)], Math.min(...distances), '...the nearest one');
    const later = times.filter((time) => time > 0);
    assert.ok(later.every((time) => time >= BLACK_HOLE_STRIP_MOUNT_MS && time <= BLACK_HOLE_STRIP_MOUNT_LAST_MS));
    if (later.length) assert.equal(Math.min(...later), BLACK_HOLE_STRIP_MOUNT_MS);
    const order = distances.map((distance, index) => [distance, times[index]] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (let index = 1; index < order.length; index++) {
      assert.ok(order[index][1] >= order[index - 1][1], 'nearer covers mount first');
      if (index > 1) assert.ok(order[index][1] - order[index - 1][1] <= BLACK_HOLE_STRIP_MOUNT_STEP_MS + 1, 'spread out, a little per frame');
    }
  }
  assert.match(source, /if \(found\?\.mountMs === 0\) \{ early\.current = true; setClock\(0\); \}/);
  assert.match(source, /if \(clock === 0 && paper\.current && !early\.current\) queueJoin\(paper\.current\);/);
  assert.ok(BLACK_HOLE_STRIP_MOUNT_MS >= ms(beats.bloom), 'after the first frames of the opening');
  assert.ok(BLACK_HOLE_STRIP_MOUNT_LAST_MS + 400 <= ms(beats.swap), 'strips are in place, under the sheet, long before the rip');
  // The trigger: an empty element whose 1 ms opacity animation ends at the cover's mount time (inline delay).
  assert.match(rule('.bh-mount'), /width: 0; height: 0; animation: bh-mount 1ms 500ms;/);
  assert.match(css, /@keyframes bh-mount \{ from, to \{ opacity: 0; \} \}/);
  assert.match(source, /<i className="bh-mount" style=\{\{ animationDelay: `\$\{setup\.mountMs\}ms` \}\} \/>/);
  assert.match(source, /event\.animationName === 'bh-mount'/);
  assert.match(source, /\{setup && clock !== null && strips\(setup, clock\)\}/);
  // Strips keep their absolute delays and take the sheets' start time (or paused time) in one read-then-write pass...
  assert.match(source, /animation\.startTime = reference\.startTime/);
  assert.match(source, /if \(paused\) \{ animation\.pause\(\); animation\.currentTime = reference\.currentTime; \}/);
  assert.match(source, /queueMicrotask\(joinRevealClock\)/);
  assert.ok(!/setTimeout|setInterval|requestAnimationFrame/.test(source), 'no timers or frame loops');
  // ...or, without Web Animations, re-base their delays on the mount time.
  assert.equal(blackHoleStripDelay(1840, 0), 1840);
  assert.equal(blackHoleStripDelay(1840, 501), 1339);
  assert.equal(blackHoleStripDelay(1840, 2000), -160, 'already flying: starts part-way');
});

void test('tear seams and paper creases are identical on the sheet and the strips, so the rip never pops', () => {
  // One shared rule draws every seam: 5 px wide, on the left edge of the strip that follows it (inside its box, never clipped).
  const seam = rule('.bh-seams > i, .bh-strip-seam');
  assert.match(seam, /width: 5px;/);
  assert.match(seam, /1px 0 \/ 3px 100% no-repeat/);
  assert.match(rule('.bh-strip-seam'), /^\s*left: 0;\s*$/);
  assert.match(source, /\{slice > 0 && <i className="bh-strip-seam" \/>\}/);
  assert.match(source, /<i key=\{seam\} style=\{\{ left: `\$\{\(seam \+ 1\) \* 100 \/ count\}%` \}\} \/>/);
  // The sheet's seams layer glows in the strips' crease shading too (repeated once per strip), softly.
  const crease = (body: string) => body.match(/linear-gradient\(to right, rgba\(255, 255, 255, [\d.]+\)[^;]*?rgba\(108, 76, 196, [\d.]+\)\)/)?.[0];
  const sheetCrease = crease(rule('.bh-seams'));
  assert.ok(sheetCrease);
  assert.equal(crease(rule('.bh-strip > .bh-print')), sheetCrease);
  assert.match(sheetCrease, /rgba\(255, 255, 255, \.25\)/);
  assert.match(sheetCrease, /rgba\(108, 76, 196, \.1\)\)$/);
  assert.match(source, /<div className="bh-seams" style=\{\{ backgroundSize: `\$\{100 \/ count\}% 100%` \}\}>/);
  assert.match(source, /backgroundSize: `\$\{\(layout\.width - 1\)\.toFixed\(2\)\}px 100%, auto`/, 'strip creases span exactly one strip');
});

void test('black-hole particles finish inside their beats, stay off the face and are deterministic', () => {
  assert.deepEqual(buildBlackHoleStreaks(), BLACK_HOLE_STREAKS);
  assert.deepEqual(buildBlackHoleScraps(), BLACK_HOLE_SCRAPS);
  assert.deepEqual(buildBlackHoleBurst(), BLACK_HOLE_BURST);
  assert.deepEqual(buildBlackHoleStars(), BLACK_HOLE_STARS);
  assert.ok(BLACK_HOLE_STREAKS.length >= 20 && BLACK_HOLE_SCRAPS.length >= 10 && BLACK_HOLE_BURST.length >= 16);
  for (const streak of BLACK_HOLE_STREAKS) {
    assert.ok(streak.delayMs >= ms(beats.bloom), 'streaks start once the portal is open');
    assert.ok(streak.delayMs + streak.durationMs <= ms(beats.lastBite), 'streaks end before the face');
  }
  for (const scrap of BLACK_HOLE_SCRAPS) {
    assert.ok(scrap.delayMs >= ms(beats.eat), 'disk scraps appear only once paper is being eaten');
    assert.ok(scrap.delayMs + scrap.durationMs <= ms(beats.lastBite), 'disk scraps are swallowed before the face');
    assert.ok(scrap.width > 0 && scrap.height > 0 && scrap.width <= scrap.height);
  }
  // Stars stay in a flat band around the portal (inside the dusk, clear of the header and footer).
  for (const [x, y] of BLACK_HOLE_STARS) assert.ok(Math.abs(y) <= 36 && Math.abs(x) <= 80);
  const lateLimit = ms(beats.clear);
  for (const spark of BLACK_HOLE_BURST) assert.ok(BLACK_HOLE_BURST_START_MS + spark.delayMs + spark.durationMs <= lateLimit, 'burp sparkles are gone before the fade');
  assert.ok(BLACK_HOLE_CRUMB_START_MS + (BLACK_HOLE_CRUMBS.length - 1) * BLACK_HOLE_CRUMB_STEP_MS + BLACK_HOLE_CRUMB_DURATION_MS <= lateLimit, 'crumbs are gone before the fade');
  assert.ok(BLACK_HOLE_BURST_START_MS >= ms(beats.burp) && BLACK_HOLE_CRUMB_START_MS >= ms(beats.burp), 'nothing is spat out before the burp');
  // Crumbs leave the mouth sideways and downward (never up across the eyes), unseen until past the core rim.
  for (const [dx, dy] of BLACK_HOLE_CRUMBS) assert.ok(dy > 0 && Math.hypot(dx, dy) >= 20);
  assert.match(rule('.bh-crumbs'), new RegExp(`top: calc\\(46% \\+ var\\(--bh-size\\) \\* ${String(BLACK_HOLE_MOUTH_Y).replace('0.', '.')}\\)`));
  const crumbKeys = keyframesBody('bh-crumb');
  assert.match(crumbKeys, /0% \{[^}]*scale\(\.2, \.2\); opacity: 0; \}/);
  assert.match(crumbKeys, /22% \{[^}]*opacity: 0; \}/, 'still hidden inside the core');
  // Sparkles are born at the core rim and fly straight out.
  assert.match(keyframesBody('bh-burst'), new RegExp(`0% \\{ transform: rotate\\(var\\(--a\\)\\) translateX\\(calc\\(var\\(--bh-size\\) \\* ${String(BLACK_HOLE_BURST_BIRTH).replace('0.', '.')}\\)\\)`));
  // The stylesheet uses the same burst, crumb and twinkle timing.
  assert.match(animationOf('bh-burst').entry, new RegExp(`calc\\(${BLACK_HOLE_BURST_START_MS}ms \\+ var\\(--d\\)\\)`));
  const crumb = animationOf('bh-crumb');
  assert.equal(crumb.duration, BLACK_HOLE_CRUMB_DURATION_MS);
  assert.equal(crumb.delay, BLACK_HOLE_CRUMB_START_MS);
  const twinkle = animationOf('bh-twinkle');
  assert.equal(twinkle.delay, ms(beats.twinkle));
  assert.equal(twinkle.duration, BLACK_HOLE_TWINKLE_MS);
  assert.ok(twinkle.delay + twinkle.duration <= lateLimit);
  const mini = animationOf('bh-mini');
  assert.equal(mini.delay, BLACK_HOLE_MINI_START_MS);
  assert.equal(mini.duration, BLACK_HOLE_MINI_DURATION_MS);
  assert.ok(mini.delay > twinkle.delay && mini.delay + mini.duration <= lateLimit);
  // A crisp, saturated DING: a darker gold rim behind a gold body with a small white core.
  assert.match(rule('.bh-twinkle > .bh-twinkle-rim'), /#d98a00/);
  assert.match(rule('.bh-twinkle > .bh-twinkle-body'), /#ffc21a[^;]*#ff9f1c/);
});

void test('the dusk fades to nothing before the header and footer', () => {
  const dim = rule('.bh-dim');
  assert.match(dim, /top: 64px; bottom: 66px;/);
  const gradient = dim.match(/radial-gradient\(ellipse ([\d.]+)% ([\d.]+)% at 50% ([\d.]+)%, (.*)\);/);
  assert.ok(gradient);
  const [, , ry, cy, stops] = gradient;
  // The ellipse reaches the top edge of the dusk box (the header line) no later than its last, transparent stop.
  const lastStop = stops.match(/rgba\([^)]*, 0\) ([\d.]+)%$/);
  assert.ok(lastStop, 'the last stop is transparent');
  assert.ok(Number(ry) * Number(lastStop[1]) / 100 <= Number(cy) + 1e-9, 'fully transparent at the header line');
});

void test('each beat keyframe line matches its absolute time, and CSS delays match the beat sheet', () => {
  const blocks = Array.from(css.matchAll(/\/\* [^*]*window (\d+)\.\.(\d+) ms \*\/\s*@keyframes ([\w-]+) \{([\s\S]*?)\n\}/g));
  assert.ok(blocks.length >= 11, 'beat keyframes are annotated');
  for (const [, startText, endText, name, body] of blocks) {
    const [start, end] = [Number(startText), Number(endText)];
    const lines = Array.from(body.matchAll(/^\s*([\d.%, ]+) \{[^}]*\} \/\* ([\dms, ]+) \*\/$/gm));
    assert.ok(lines.length >= 3, `${name} has annotated keyframes`);
    const times: number[] = [];
    for (const [, percents, stamp] of lines) {
      const pcts = percents.split(',').map((part) => Number.parseFloat(part));
      const stamps = stamp.split(',').map((part) => Number.parseFloat(part));
      assert.equal(pcts.length, stamps.length, `${name}: one time per percentage`);
      pcts.forEach((pct, index) => assert.ok(Math.abs(pct - (stamps[index] - start) / (end - start) * 100) < .006, `${name}: ${pct}% is ${stamps[index]} ms`));
      times.push(...stamps);
    }
    assert.equal(times[0], start, `${name} starts at its window`);
    assert.equal(times.at(-1), end, `${name} ends at its window`);
    for (let index = 1; index < times.length; index++) assert.ok(times[index] > times[index - 1], `${name}: keyframes in time order`);
    const animation = animationOf(name);
    assert.equal(animation.delay, start, `${name} delay`);
    assert.equal(animation.duration, end - start, `${name} duration`);
  }
  // Beats the stylesheet must honour.
  assert.equal(animationOf('bh-spark').delay, ms(beats.spark));
  assert.equal(animationOf('bh-open').delay, ms(beats.bloom));
  assert.match(keyframesBody('bh-tile-stretch'), new RegExp(`\\} /\\* ${ms(beats.stretch)}ms \\*/`), 'the stretch starts on its beat');
  assert.equal(animationOf('bh-grow').delay, ms(beats.boing));
  assert.equal(animationOf('bh-pulse').delay, ms(beats.powerUp));
  assert.equal(animationOf('bh-boost').delay, ms(beats.powerUp));
  const boost = animationOf('bh-boost');
  assert.equal(boost.delay + boost.duration, ms(beats.burp), 'the spin boost lasts until the burp');
  const seams = animationOf('bh-show');
  assert.equal(seams.selector, '.bh-seams', 'the seams glow in as one layer');
  assert.equal(seams.delay, ms(beats.seams));
  assert.equal(animationOf('bh-eyes-open').delay, ms(beats.eyes));
  assert.equal(beatKeys('bh-eyes-open').at(-1)![0], ms(beats.squeeze), 'the open eyes hand over to the squeeze');
  assert.equal(animationOf('bh-glance').delay + animationOf('bh-glance').duration, ms(beats.squeeze));
  assert.ok(css.includes(`.bh-mouth-small { animation: bh-mouth ${ms(beats.squeeze - beats.surprised)}ms ${ms(beats.surprised)}ms; }`), 'the surprised "o" lasts until the squeeze');
  assert.ok(css.includes(`.bh-mouth-hold { animation: bh-window ${ms(beats.burp - beats.squeeze)}ms ${ms(beats.squeeze)}ms; }`), 'pressed lips until the burp');
  assert.ok(css.includes(`.bh-eyes-squeeze { animation: bh-window ${ms(beats.happy - beats.squeeze)}ms ${ms(beats.squeeze)}ms; }`), '> < until the smile');
  assert.ok(css.includes(`.bh-mouth-o { animation: bh-mouth ${ms(beats.happy - beats.burp)}ms ${ms(beats.burp)}ms; }`), 'the burp mouth opens on the burp and lasts until the grin');
  assert.equal(animationOf('bh-flash').delay, ms(beats.burp));
  assert.equal(animationOf('bh-burp-ring').delay, ms(beats.burp));
  assert.equal(animationOf('bh-happy').delay, ms(beats.happy));
  const act = beatKeys('bh-act');
  const burpRecoil = act.find(([time]) => time > ms(beats.burp) && time <= ms(beats.burp) + 60);
  assert.ok(burpRecoil && /scale\(0\.82, 1\.22\)/.test(burpRecoil[1]), 'the burp recoil stretch follows the burp');
  assert.match(keyframesBody('bh-grow'), new RegExp(`scale\\(\\.6\\);[^}]*\\} /\\* ${ms(beats.deflate) + 120}ms \\*/`));
  assert.match(keyframesBody('bh-grow'), new RegExp(`100% \\{ transform: scale\\(0\\); \\} /\\* ${ms(beats.gone)}ms \\*/`), 'the portal is gone on its beat');
  const dim = beatKeys('bh-dim');
  assert.ok(dim.some(([time, body]) => time === ms(beats.burp) && /opacity: 1/.test(body)), 'the lights come up from the burp');
});

void test('late elements start invisible and the stylesheet avoids costly or unsupported CSS', () => {
  // (bh-happy fills forwards only, over a base opacity of 0: see the story-order test.)
  for (const name of ['bh-spark', 'bh-burst', 'bh-crumb', 'bh-shock', 'bh-burp-ring', 'bh-twinkle', 'bh-mini', 'bh-scrap-fall', 'bh-pulse', 'bh-eyes-open', 'bh-streak-fall', 'bh-rim', 'bh-wash']) {
    const first = keyframesBody(name).match(/^\s*0%[^{]*\{([^}]*)\}/m)?.[1] ?? '';
    assert.ok(/opacity: 0\b/.test(first) || /scale(?:Y)?\(0\)/.test(first), `${name} starts invisible`);
  }
  for (const item of cssRules()) {
    if (/\.bh-strip\b/.test(item.selector)) assert.ok(!/clip-path/.test(item.body), `${item.selector}: no clip-path on strips`);
    assert.ok(!/::?(before|after)/.test(item.selector), `${item.selector}: no pseudo-elements`);
  }
  assert.ok(!/(^|[\s;{])filter\s*:/.test(css), 'no CSS filters');
  assert.ok(!/drop-shadow|backdrop-filter|@property|offset-path|:has\(|view-transition|mask-image/.test(css), 'Safari-safe, compositor-friendly CSS only');
  assert.ok(!/(^|\n)\s*&/.test(css), 'no CSS nesting');
  // Only transform and opacity are animated.
  for (const [, body] of css.matchAll(/@keyframes [\w-]+ \{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) {
    for (const [, declarations] of body.matchAll(/\{([^}]*)\}/g)) {
      for (const property of declarations.split(';').map((part) => part.split(':')[0].trim()).filter(Boolean)) {
        assert.ok(['transform', 'opacity', 'animation-timing-function'].includes(property), `animates only transform/opacity, not ${property}`);
      }
    }
  }
  // Per-strip geometry comes inline (no calc() chains over custom properties on strips).
  assert.ok(!/var\(--slice\)|--bh-card-delay|--bh-strip-delay/.test(css));
});

void test('black-hole art paths are finite and the swirl is hotter and faster inside', () => {
  const finite = (path: string) => Array.from(path.matchAll(/-?\d+(?:\.\d+)?/g)).every(([number]) => Number.isFinite(Number(number)));
  for (const ring of BLACK_HOLE_RINGS) for (const comet of ringComets(ring)) assert.ok(finite(comet.body) && finite(comet.core) && comet.body.endsWith('Z'));
  assert.ok(finite(spiralArmPath(120)) && finite(arcPath(31.2, 125, 235)) && finite(cometPath(50, 90, 120, 8)));
  const byRadius = [...BLACK_HOLE_RINGS].sort((a, b) => a.radius - b.radius);
  for (let index = 1; index < byRadius.length; index++) assert.ok(byRadius[index].periodMs > byRadius[index - 1].periodMs, 'inner rings spin faster');
  assert.ok(byRadius[0].radius > 31.2, 'the innermost ring clears the photon ring');
  assert.ok(byRadius.at(-1)!.radius + byRadius.at(-1)!.width / 2 <= 100, 'rings stay inside the hole box');
  // The strip-card spread and step are the ones the story was timed with.
  assert.ok(BLACK_HOLE_CARD_SPREAD >= .25 && BLACK_HOLE_STRIP_STEP >= .03, 'the nearest-first wave stays readable');
});

void test('the opening spark twinkles just above a "?" under the portal, and that "?" is slurped to the portal centre', () => {
  const viewport = { width: 1280, height: 800 };
  const portal = blackHoleSize(viewport);
  const focusY = viewport.height * BLACK_HOLE_FOCUS.y;
  // One big centred card: the tile sits right on the focal point, so the spark moves up until its body clears the tile.
  const shift = blackHoleSparkShift({ y: focusY + 25, size: 100 }, viewport);
  assert.ok(shift < 0 && shift >= -portal * BLACK_HOLE_SPARK_MAX_SHIFT - 1e-9);
  assert.ok(focusY + shift + portal * BLACK_HOLE_SPARK_BODY <= focusY + 25 - 50 + 1e-9, 'the spark body peaks above the tile');
  // A tile already clear of the spark (or a layout with no hopper) keeps the spark on the focal point.
  assert.equal(blackHoleSparkShift({ y: focusY + portal * .5, size: 60 }, viewport), 0);
  // The spark sinks back to the focal point as it fades, into the opening portal.
  const spark = keyframesBody('bh-spark');
  assert.match(spark, /0% \{ transform: translateY\(var\(--bh-spark-y, 0px\)\) scale\(0\)/);
  assert.match(spark, /100% \{ transform: translateY\(0px\)/);
  assert.match(source, /style: hopper \? \{ '--bh-spark-y': `\$\{blackHoleSparkShift\(hopper, viewport\)\.toFixed\(1\)\}px` \}/);
  // The hopper's copy knows the way from its tile to the portal centre.
  const middle = { left: 435, top: 72, width: 395, height: 644 };
  const [vars] = blackHoleCoverVars([middle], viewport);
  const tug = blackHoleTug(middle, viewport, vars, 70)!;
  assert.equal(tug.x + tug.inX, viewport.width * BLACK_HOLE_FOCUS.x);
  assert.equal(tug.y + tug.inY, focusY);
  assert.match(source, /'--bh-in-x': `\$\{tug\.inX\.toFixed\(1\)\}px`, '--bh-in-y': `\$\{tug\.inY\.toFixed\(1\)\}px`/);
});

void test('the burp leaves no fading ghosts over the freshly revealed names', () => {
  /** A one-line @keyframes block as [percent, declarations] pairs. */
  const oneLine = (name: string) => {
    const body = css.match(new RegExp(`@keyframes ${name} \\{ (.*) \\}\\n`))?.[1];
    assert.ok(body, `@keyframes ${name} is one line`);
    return Array.from(body.matchAll(/([\d.]+)% \{([^}]*)\}/g), ([, percent, declarations]) => [Number(percent), declarations] as const);
  };
  // Sparkles twinkle out and crumbs flip away at full opacity (shrinking to nothing), instead of fading.
  for (const name of ['bh-burst', 'bh-crumb']) {
    const keys = oneLine(name);
    assert.match(keys.at(-1)![1], /scale\(0(?:, \.3)?\); opacity: 1;/, `${name} ends shrunk to nothing, fully opaque`);
    assert.ok(keys.filter(([percent]) => percent >= 30).every(([, body]) => !/opacity: 0/.test(body)), `${name}: no late fade`);
  }
  // The burp ring and the shockwave pop away quickly (at most about 100 ms of fading) instead of hazing over the names.
  for (const name of ['bh-burp-ring', 'bh-shock']) {
    const animation = animationOf(name);
    const keys = oneLine(name);
    const opaque = keys.filter(([, body]) => /opacity: (?:1|0?\.[5-9]\d*);/.test(body)).at(-1)!;
    const gone = keys.find(([percent, body]) => percent > opaque[0] && /opacity: 0;/.test(body))!;
    assert.ok((gone[0] - opaque[0]) / 100 * animation.duration <= 110, `${name} fades in at most about 100 ms`);
    assert.ok(animation.delay + animation.duration <= ms(beats.deflate), `${name} is over before the portal deflates`);
  }
});
