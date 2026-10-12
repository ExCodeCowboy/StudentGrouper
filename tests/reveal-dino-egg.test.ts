import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DINO_BEATS, DINO_CHIPS, DINO_COVER, DINO_DURATION_MS, DINO_DUST, DINO_EASINGS, DINO_EXIT_VW, DINO_FLASH_OUT, DINO_FOCUS, DINO_HAND_OFF, DINO_HATCH_MS, DINO_HEADROOM, DINO_IMPACT_OUT,
  DINO_KEYFRAMES_CSS, DINO_NEST_EXIT, DINO_NEST_GROUP_PARTS, DINO_OCCLUSION_LIMIT, DINO_RIG, DINO_ROAR_GULP, DINO_ROAR_LINES_OUT, DINO_SPOT, DINO_STAGE_CSS, DINO_STEPS, DINO_TRACKS,
  DINO_TRANSIENT_LAYERS, activeWindow, cubicBezier, dinoCoverSchedule, dinoCoverVars, dinoDistance, dinoEggCenter, dinoEggPlacement, dinoFootfalls, dinoHeroRect, dinoOcclusion, dinoPoseAt,
  dinoReach, dinoRingRadius, dinoTrack, dinoUnit, pinnedPoses, resolvePoses, samplePoses, type CardRect, type Pose,
} from '../src/revealEffects/dinoEggTimeline';
import { dinoEggEffect } from '../src/revealEffects/dinoEgg';

const END = DINO_DURATION_MS / 1000;
const VIEWPORTS: [number, number][] = [[960, 680], [1280, 720], [1280, 800], [1366, 768], [1920, 1080], [2560, 1080]];
const HEADER = 70;
const FOOTER = 80;
const close = (a: number, b: number, epsilon = 1e-6) => Math.abs(a - b) <= epsilon;

// ---- 2D affine helpers: a layer applies translate(pivot) then translate(x,y) rotate(r) scale(sx,sy). ----
type Matrix = [number, number, number, number, number, number]; // a b c d e f
type Chain = [string, readonly [number, number]][];
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
function layerMatrix(pivot: readonly [number, number], pose: Pose): Matrix {
  const radians = pose.r * Math.PI / 180;
  const cos = Math.cos(radians); const sin = Math.sin(radians);
  return [cos * pose.sx, sin * pose.sx, -sin * pose.sy, cos * pose.sy, pivot[0] + pose.x, pivot[1] + pose.y];
}
const apply = (m: Matrix, [x, y]: [number, number]): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const REST: Pose = { x: 0, y: 0, xvw: 0, r: 0, sx: 1, sy: 1, o: 1 };
/** World position (rig units, relative to the nest centre) of a point in the last layer of a chain; xvw is ignored. */
function world(chain: Chain, t: number, point: [number, number] = [0, 0]) {
  const matrix = chain.reduce((m, [layer, pivot]) => multiply(m, layerMatrix(pivot, layer === '' ? REST : dinoPoseAt(layer, t))), IDENTITY);
  return apply(matrix, point);
}
/** Opacity a layer really shows: its own times every ancestor's in the chain. */
const shownOpacity = (chain: Chain, t: number) => chain.reduce((o, [layer]) => o * (layer === '' ? 1 : dinoPoseAt(layer, t).o), 1);
const BABY_CHAIN: Chain = [['quake', [0, 0]], ['baby-x', DINO_RIG.babyX], ['baby-exit', [0, 0]], ['baby-y', [0, 0]], ['baby-body', [0, 0]]];
const HAT_CHAIN: Chain = [...BABY_CHAIN, ['hat', DINO_RIG.hat]];
const SPRING_CHAIN: Chain = [...BABY_CHAIN, ['spring', [0, 0]]];
const ROCK_CHAIN: Chain = [['quake', [0, 0]], ['nest-group', [0, 0]], ['egg-rock', DINO_RIG.eggRock]];
const EGG_TOP_CHAIN: Chain = [...ROCK_CHAIN, ['egg-top', DINO_RIG.eggTop]];
const PEEK_EYES_CHAIN: Chain = [...ROCK_CHAIN, ['peek', [0, 0]], ['peek-eyes', DINO_RIG.peekEyes]];
const SHELL_CHAIN: Chain = [...ROCK_CHAIN, ['egg-bottom-front', [0, 0]]];
/** The half shell's broken rim (egg-rock local): the zigzag peaks and its ends. */
const RIM: [number, number][] = [[-80, -111.5], [-62, -122.5], [-32, -122.5], [-2, -122.5], [28, -122.5], [58, -122.5], [80, -111.5]];

void test('dino egg: every track is sorted, inside the story, and uses a known easing', () => {
  const names = new Set<string>();
  for (const { layer, keys } of DINO_TRACKS) {
    assert.ok(!names.has(layer), `${layer}: one track per layer`);
    names.add(layer);
    assert.ok(keys.length > 0, `${layer}: has keys`);
    keys.forEach((key, index) => {
      assert.ok(key.t >= 0 && key.t <= END, `${layer}: key ${key.t} inside 0..${END}`);
      if (index) assert.ok(key.t > keys[index - 1].t, `${layer}: keys strictly sorted at ${key.t}`);
      assert.ok(key.e === undefined || key.e in DINO_EASINGS, `${layer}: known easing at ${key.t}`);
      for (const value of [key.x, key.y, key.xvw, key.r, key.sx, key.sy, key.o]) assert.ok(value === undefined || Number.isFinite(value), `${layer}: finite values`);
      if (key.o !== undefined) assert.ok(key.o >= 0 && key.o <= 1, `${layer}: opacity in range`);
    });
  }
});

void test('dino egg: compiled keyframes run only while a layer moves, pinned at both ends and scoped to the stage', () => {
  for (const { layer, keys } of DINO_TRACKS) {
    const match = new RegExp(`@keyframes dino-${layer}\\{(.*?)\\}\\.dino-stage \\.dino-${layer}\\{animation:dino-${layer} ([\\d.]+)ms linear ([\\d.]+)ms both\\}`).exec(DINO_KEYFRAMES_CSS);
    assert.ok(match, `${layer}: keyframes + scoped animation rule`);
    const stops = [...match[1].matchAll(/(?:^|\})([\d.]+)%\{/g)].map((found) => Number(found[1]));
    assert.equal(stops[0], 0, `${layer}: 0% pinned`);
    assert.equal(stops[stops.length - 1], 100, `${layer}: 100% pinned`);
    stops.forEach((stop, index) => { if (index) assert.ok(stop >= stops[index - 1], `${layer}: keyframe stops never go backwards`); });
    const duration = Number(match[2]); const delay = Number(match[3]);
    assert.ok(delay >= 0 && delay + duration <= DINO_DURATION_MS + 1e-6, `${layer}: its window ${delay} + ${duration} ms is inside the story`);
    // The window shows exactly what the whole track shows: the fill holds the same pose before and after it.
    const { start, end, poses } = activeWindow(keys);
    assert.ok(Math.abs(start * 1000 - delay) < .01 && Math.abs((end - start) * 1000 - duration) < .01, `${layer}: the rule matches its window`);
    const full = pinnedPoses(keys);
    assert.equal(full[0].t, 0);
    assert.equal(full[full.length - 1].t, END);
    // The window closes on its final pose held still (never on a jump), so a finished live animation shows that pose.
    if (end < END) {
      const [closing, final] = poses.slice(-2);
      assert.ok(closing.e !== 'hold' && ['x', 'y', 'xvw', 'r', 'sx', 'sy', 'o'].every((field) => closing[field as keyof Pose] === final[field as keyof Pose]), `${layer}: the window ends on a still pose`);
    }
    for (let t = 0; t <= END + 1e-9; t += .005) {
      if (Math.abs(t - start) < .0015) continue; // the 1 ms lead-in before a held jump
      const expected = samplePoses(full, t);
      const shown = samplePoses(poses, Math.min(end, Math.max(start, t)));
      for (const field of ['x', 'y', 'xvw', 'r', 'sx', 'sy', 'o'] as const) {
        assert.ok(Math.abs(expected[field] - shown[field]) < 1e-6, `${layer}: ${field} at ${t.toFixed(3)} s (${expected[field]} vs ${shown[field]})`);
      }
    }
  }
  // Layers at rest cost nothing frame by frame: at any moment well under half of the rig is animating.
  for (let t = .05; t < END; t += .05) {
    const running = DINO_TRACKS.filter(({ keys }) => { const w = activeWindow(keys); return t >= w.start && t <= w.end; }).length;
    assert.ok(running <= DINO_TRACKS.length * .45, `${running} of ${DINO_TRACKS.length} layers animating at ${t.toFixed(2)} s`);
  }
  assert.ok(DINO_STAGE_CSS.includes('@keyframes dino-spot') && DINO_STAGE_CSS.includes('@keyframes dino-ring'));
  assert.ok(DINO_STAGE_CSS.includes(`.dino-spot{animation:dino-spot ${Math.round((DINO_SPOT.gone - DINO_SPOT.inStart) * 1000)}ms linear ${DINO_SPOT.inStart * 1000}ms both}`), 'the spotlight runs only while it dims');
});

void test('dino egg: the Safari-safe CSS subset is respected', () => {
  const css = readFileSync('src/revealEffects/dinoEgg.css', 'utf8');
  for (const source of [css, DINO_STAGE_CSS]) {
    for (const banned of ['@property', 'offset-path', ':has(', 'color-mix(', 'hypot(', 'abs(', 'sign(', 'transform-box', 'view-transition', '@container']) {
      assert.ok(!source.includes(banned), `no ${banned}`);
    }
    assert.ok(!/&[\s.:#[]/.test(source), 'no CSS nesting');
  }
  const clips = [...css.matchAll(/(?<!-webkit-)clip-path:/g)].length;
  const webkitClips = [...css.matchAll(/-webkit-clip-path:/g)].length;
  assert.equal(clips, webkitClips, 'every clip-path has a -webkit- twin');
  assert.ok(!/@keyframes[^{]+\{[^}]*clip-path/.test(css), 'clip-path is never animated');
  for (const name of Object.keys(dinoCoverVars())) assert.ok(css.includes(`var(${name}`), `dinoEgg.css reads ${name}`);
  assert.ok(css.includes('var(--dino-egg-x,'), 'the egg position honours the stage placement');
});

void test('dino egg: every animated layer exists in the stage tree', () => {
  const source = readFileSync('src/revealEffects/dinoEgg.tsx', 'utf8');
  for (const { layer } of DINO_TRACKS) {
    if (/^chip-\d+$/.test(layer)) assert.ok(Number(layer.slice(5)) <= DINO_CHIPS.length && source.includes('name={`chip-${index + 1}`}'), `${layer} is rendered`);
    else if (DINO_DUST.some((dust) => dust.layer === layer)) assert.ok(source.includes('DINO_DUST.map(') && source.includes('name={layer}'), `${layer} is rendered`);
    else assert.ok(source.includes(`name="${layer}"`), `${layer} is rendered`);
  }
});

void test('dino egg: the easing solver matches CSS cubic-bezier end points and is monotonic', () => {
  const ease = cubicBezier(.65, 0, .35, 1);
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.ok(close(ease(.5), .5, 1e-4));
  let previous = 0;
  for (let p = 0; p <= 1.0001; p += .01) { const value = ease(Math.min(1, p)); assert.ok(value >= previous - 1e-9); previous = value; }
  assert.ok(cubicBezier(.34, 1.56, .64, 1)(.6) > 1, 'back overshoots');
});

void test('dino egg: the nest group fades as one piece (nothing shows through the shell)', () => {
  for (const layer of DINO_NEST_GROUP_PARTS) {
    for (const key of dinoTrack(layer).keys) assert.ok(key.o === undefined || key.o === 0 || key.o === 1, `${layer}: never partly transparent (key ${key.t})`);
    for (let t = .24; t <= END; t += .01) assert.equal(dinoPoseAt(layer, t).o, 1, `${layer}: opaque at ${t.toFixed(2)} s; only the group fades`);
  }
  assert.equal(dinoPoseAt('nest-group', 0).o, 0, 'nothing of the nest at frame 0');
  assert.equal(dinoPoseAt('nest-group', .24).o, 1);
  // It leaves by shrinking away, opaque until it is tiny, then it is simply gone.
  assert.ok(dinoPoseAt('nest-group', DINO_NEST_EXIT + .25).o === 1 && dinoPoseAt('nest-group', DINO_NEST_EXIT + .25).sx < .8, 'the group shrinks away');
  assert.equal(dinoPoseAt('nest-group', DINO_NEST_EXIT + .31).o, 0);
  assert.ok(DINO_NEST_EXIT + .31 <= DINO_BEATS.exitStart, 'gone before the blind scurry starts');
  assert.ok(DINO_NEST_EXIT >= DINO_BEATS.hopOff + .12 && dinoPoseAt('baby-y', DINO_NEST_EXIT).y < -30, 'the baby is up in the air when the nest goes');
  assert.ok(DINO_TRANSIENT_LAYERS.includes('nest-group'));
});

void test('dino egg: solid art never lingers as a see-through ghost (it pops, shrinks or cuts)', () => {
  const solid = ['nest-group', 'peep', 'boom', 'pop-flash', 'roar-lines', 'mouth-roar', 'mouth-peep', ...DINO_CHIPS.map((_, index) => `chip-${index + 1}`), ...DINO_DUST.map(({ layer }) => layer), 'land-dust-l', 'land-dust-r'];
  for (const layer of solid) {
    const poses = pinnedPoses(dinoTrack(layer).keys);
    for (const key of poses) assert.ok(key.o === 0 || key.o === 1, `${layer}: opacity is 0 or 1 at ${key.t}`);
    poses.forEach((pose, index) => {
      const next = poses[index + 1];
      if (next && pose.o !== next.o && pose.o === 1) {
        assert.ok(pose.e === 'hold' || next.t - pose.t <= .005, `${layer}: disappears in one step at ${next.t}`);
        assert.ok(pose.sx * pose.sy <= .25 || layer.startsWith('mouth-'), `${layer}: already small (${pose.sx}x${pose.sy}) when it goes at ${next.t}`);
      }
    });
  }
  // The roar mouth stays opaque while it gulps into the peep's "o", which takes over on the next frame.
  for (let t = 4.06; t < DINO_ROAR_GULP + .005; t += .005) assert.equal(dinoPoseAt('mouth-roar', t).o, 1, `roar mouth opaque at ${t.toFixed(3)}`);
  assert.ok(dinoPoseAt('mouth-roar', DINO_ROAR_GULP).sx <= .25, 'collapsed into the o');
  assert.ok(dinoPoseAt('mouth-roar', DINO_ROAR_GULP + .005).o === 0 && dinoPoseAt('mouth-peep', DINO_ROAR_GULP + .005).o === 1);
  // The roar is sucked back into the mouth just before the gulp; the pop flash twinkles out behind the baby.
  assert.ok(DINO_ROAR_LINES_OUT < 4.06 && dinoPoseAt('roar-lines', DINO_ROAR_LINES_OUT).sx <= .1, 'roar lines retract before the gulp');
  assert.ok(dinoPoseAt('pop-flash', DINO_FLASH_OUT - .01).o === 1 && dinoPoseAt('pop-flash', DINO_FLASH_OUT + .005).o === 0);
  // The stomp rays stay solid while they stretch and blink out within 30 ms (at most two frames of fade).
  const impact = pinnedPoses(dinoTrack('impact').keys);
  const fades = impact.filter((pose, index) => impact[index + 1] && pose.o === 1 && impact[index + 1].o === 0);
  assert.equal(fades.length, 1);
  assert.ok(fades[0].t === DINO_IMPACT_OUT && impact[impact.indexOf(fades[0]) + 1].t - DINO_IMPACT_OUT <= .03 + 1e-9, 'rays blink out fast');
  for (let t = 4.8; t <= DINO_IMPACT_OUT; t += .01) assert.equal(dinoPoseAt('impact', t).o, 1, `rays solid at ${t.toFixed(2)}`);
});

void test('dino egg: each card pit fades as one group (nothing shows through the sinking egg)', () => {
  const css = readFileSync('src/revealEffects/dinoEgg.css', 'utf8');
  const keyframes = new Map([...css.matchAll(/@keyframes ([\w-]+) \{([\s\S]*?)\}\s*\}/g)].map((found) => [found[1], found[2]]));
  const body = (name: string) => keyframes.get(name) ?? '';
  assert.ok(body('dino-sink').includes('transform') && !body('dino-sink').includes('opacity'), 'the sink only moves');
  assert.ok(/\.dino-pit \{[^}]*animation: dino-pit-fade /.test(css), 'the pit itself fades');
  const fadeFrom = Number(/0%, (\d+)% \{ opacity: 1; \} 100% \{ opacity: 0;/.exec(body('dino-pit-fade'))?.[1]);
  assert.ok(fadeFrom >= 35 && fadeFrom <= 80, `the pit fades only in the second part of its sink (from ${fadeFrom}%)`);
  assert.ok(/translateY\(calc\(var\(--H\) \* 1\.0\d*\)\)/.test(body('dino-sink')), 'the sink carries everything right out of the card');
  assert.ok(/\.dino-sinker \{[^}]*animation: dino-sink /.test(css), 'bed, egg and nest sink together on one layer');
  // Inside the pit, the only other opacity changes are the drop-in (from 0 in its first 4%) and instant switches.
  for (const name of ['dino-hatch', 'dino-rock', 'dino-jolt']) assert.ok(!body(name).includes('opacity'), `${name} never fades`);
  // The drop-in pops in (opaque within 4% of 380 ms, about one frame) and grows as it falls: no ghost egg.
  assert.ok(/0% \{[^}]*scale\(\.\d+\);[^}]*opacity: 0;[\s\S]*\n {2}4% \{ opacity: 1; \}/.test(body('dino-settle')), 'the drop-in pops in within its first frame');
  assert.ok(DINO_COVER.settleDuration * .04 <= 17, 'one frame of fade at most');
  // The top shell and the chips (outside the pit) stay opaque until they have shrunk away.
  for (const name of ['dino-top', 'dino-chip-l', 'dino-chip-r']) {
    const frames = body(name);
    assert.ok(/96% \{[^}]*opacity: 1; \}/.test(frames) && /100% \{[^}]*scale\(\.[12]\d*\)/.test(frames) && /100% \{[^}]*opacity: 0;/.test(frames), `${name}: opaque until 96%, tiny when it goes`);
  }
  // The tossed top is already small when it starts to go, and is gone soon after the head pops.
  assert.ok(/96% \{[^}]*scale\(\.2\d*\)/.test(body('dino-top')), 'the top has shrunk to a chip by 96%');
  assert.ok(DINO_COVER.topDuration - DINO_COVER.popAt <= 400, 'the toss lasts at most 0.4 s');
});

/** Animations listed in an `animation:` value, split at top-level commas (var() fallbacks hold commas too). */
function animationNames(value: string, keyframes: Set<string>) {
  const parts: string[] = []; let depth = 0; let current = '';
  for (const char of value) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) { parts.push(current); current = ''; } else current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim().split(/\s+/).find((token) => keyframes.has(token)) ?? '?');
}

void test('dino egg: every cover animation can run on the compositor', () => {
  const css = readFileSync('src/revealEffects/dinoEgg.css', 'utf8');
  const keyframes = new Map([...css.matchAll(/@keyframes ([\w-]+) \{([\s\S]*?)\}\s*\}/g)].map((found) => [found[1], found[2]]));
  for (const [name, frames] of keyframes) {
    for (const property of frames.matchAll(/([a-z-]+):/g)) {
      assert.ok(['transform', 'opacity', 'animation-timing-function'].includes(property[1]), `@keyframes ${name} animates only transform and opacity (found ${property[1]})`);
    }
  }
  const names = new Set(keyframes.keys());
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*animation(?:-name)?:[^{}]*)\}/g)) {
    const selector = rule[1].trim();
    if (selector.startsWith('@') || /^\d|^from|^to/.test(selector)) continue;
    const value = /animation:\s*([^;]+);?/.exec(rule[2])?.[1];
    if (!value) continue;
    const listed = animationNames(value, names);
    assert.ok(!listed.includes('?'), `${selector}: every listed animation has keyframes`);
    // One transform animation per element: several on one element would all fall back to the main thread.
    const moving = listed.filter((name) => (keyframes.get(name) ?? '').includes('transform'));
    assert.ok(moving.length <= 1, `${selector}: ${moving.join(', ')} all animate transform`);
    assert.ok(listed.length <= 1 || selector.includes('::'), `${selector}: one animation per element`);
  }
});

void test('dino egg: the card baby pops, bounces and ducks on the cover schedule', () => {
  const css = readFileSync('src/revealEffects/dinoEgg.css', 'utf8');
  const hatch = /@keyframes dino-hatch \{([\s\S]*?)\}\s*\}/.exec(css)?.[1] ?? '';
  const stops = [...hatch.matchAll(/([\d.]+)% \{/g)].map((found) => Number(found[1]));
  const C = DINO_COVER;
  const at = (ms: number) => (ms - C.popAt) / DINO_HATCH_MS * 100;
  assert.equal(DINO_HATCH_MS, C.duckAt + C.duckDuration - C.popAt);
  for (const expected of [0, at(C.popAt + C.popDuration), at(C.bounceAt), at(C.bounceAt + C.bounceDuration), 100]) {
    assert.ok(stops.some((stop) => Math.abs(stop - expected) < .02), `a dino-hatch keyframe at ${expected.toFixed(2)}%`);
  }
  assert.ok(stops.some((stop) => Math.abs(stop - at(C.duckAt)) < .02), 'the duck starts on time');
  // The highest the head goes: translateY(-.18 egg) with a 1.06 stretch about its base, inside the card's headroom.
  assert.ok(.18 + .06 <= DINO_HEADROOM + 1e-9, 'the bounce stays inside the headroom');
});

void test('dino egg: a resize moves eggs but never re-times them', () => {
  const source = readFileSync('src/revealEffects/dinoEgg.tsx', 'utf8');
  assert.ok(/if \(timing\) cover\.style\.setProperty\('--dino-d'/.test(source), '--dino-d is only written when timing is asked for');
  assert.ok(source.includes('writeCoverPlacements(stage.current, true)') && source.includes('writeCoverPlacements(stage.current, false)'), 'mount writes timing, resize does not');
});

void test('dino egg: the lid lifts and the baby peeks out of a real gap before the pop', () => {
  assert.equal(dinoPoseAt('crack', DINO_BEATS.crack).o, 1, 'hairline crack at 2.0');
  for (const layer of ['top-rim', 'bottom-rim']) assert.ok(dinoPoseAt(layer, 2.44).o === 0 && dinoPoseAt(layer, 2.45).o === 1, `${layer}: the first knock cracks the seam all round`);
  assert.equal(dinoPoseAt('crack', 2.45).o, 0, 'the partial crack gives way to the full rims');
  let shown = 0;
  for (let t = DINO_BEATS.lidLifts; t < DINO_HAND_OFF; t += .005) {
    const eyes = dinoPoseAt('peek-eyes', t);
    if (shownOpacity([['peek', [0, 0]], ['peek-eyes', [0, 0]]], t) === 1 && eyes.sy >= .9) shown += .005;
  }
  assert.ok(shown >= .17, `the open eyes show for ${shown.toFixed(3)} s (blink aside)`);
  assert.ok(DINO_HAND_OFF - DINO_BEATS.peek >= .2, 'the peek lasts at least 0.2 s');
  for (let t = 2.8; t <= 2.93; t += .01) assert.ok(dinoPoseAt('egg-top', t).y <= -30, `lid well open at ${t.toFixed(2)}`);
  assert.ok(dinoPoseAt('egg-top', 2.85).r < -5, 'hinged: the right side opens more');
});

void test('dino egg: at the pop the flying lid, the baby and its eyes pick up exactly where the peek left off', () => {
  const t = DINO_HAND_OFF;
  const top = world(EGG_TOP_CHAIN, t - 1e-4);
  const hat = world(HAT_CHAIN, t);
  assert.ok(close(top[0], hat[0], .5) && close(top[1], hat[1], .5), `egg-top ${top.join(',')} vs hat ${hat.join(',')}`);
  assert.equal(dinoPoseAt('egg-top', t - 1e-4).r, dinoPoseAt('hat', t).r);
  const rock = dinoPoseAt('egg-rock', t);
  assert.ok(close(dinoPoseAt('hat', t).sx, rock.sx) && close(dinoPoseAt('hat', t).sy, rock.sy), 'same size: the hat takes the egg squash');
  assert.ok(dinoPoseAt('egg-top', t).o === 0 && dinoPoseAt('hat', t).o === 1, 'exactly one of them is visible after the hand-off');
  assert.ok(dinoPoseAt('hat', t - 1e-4).o === 0 && dinoPoseAt('egg-top', t - 1e-4).o === 1, 'and only the lid before it');
  assert.ok(top[1] >= -250, `apex (rig y ${top[1]}) stays clear of the header`);
  // The peeking eyes and the baby's own eyes are in the same place at the swap.
  for (const side of [-1, 1]) {
    const peek = world(PEEK_EYES_CHAIN, t - 1e-4, [side * DINO_RIG.peekEyeGap, 0]);
    const baby = world(SPRING_CHAIN, t, [DINO_RIG.babyEyes[0] + side * DINO_RIG.babyEyeGap, DINO_RIG.babyEyes[1]]);
    assert.ok(Math.hypot(peek[0] - baby[0], peek[1] - baby[1]) < 5, `eye ${side}: peek ${peek.map(Math.round).join(',')} vs baby ${baby.map(Math.round).join(',')}`);
  }
  assert.equal(dinoPoseAt('peek', t).o, 0);
  assert.equal(dinoPoseAt('spring', t).o, 1);
});

void test('dino egg: the baby springs up out of the shell, not in front of it', () => {
  // The lip overlay is an exact copy of the shell and the nest rim, shown only while the baby is inside.
  assert.deepEqual(dinoTrack('lip-rock').keys, dinoTrack('egg-rock').keys);
  assert.deepEqual(dinoTrack('lip-shell').keys, dinoTrack('egg-bottom-front').keys);
  const swap = dinoTrack('lip-group').keys.at(-1)!.t;
  assert.ok(dinoPoseAt('lip-group', DINO_HAND_OFF).o === 1 && dinoPoseAt('lip-group', DINO_HAND_OFF - 1e-4).o === 0 && dinoPoseAt('lip-group', swap).o === 0);
  // When the copy goes, the baby's bottom is already above the half shell's rim, so the swap never shows.
  const bottom = world(SPRING_CHAIN, swap)[1];
  const rim = Math.min(...RIM.map((point) => world(SHELL_CHAIN, swap, point)[1]));
  assert.ok(bottom <= rim, `the baby's bottom (${bottom.toFixed(1)}) is above the rim (${rim.toFixed(1)}) at ${swap}`);
  for (let index = 1; index <= DINO_CHIPS.length; index++) {
    assert.ok(dinoPoseAt(`chip-${index}`, DINO_HAND_OFF).o === 1 && dinoPoseAt(`chip-${index}`, 3.4).o === 0, `chip ${index} bursts and is gone`);
  }
  assert.ok(dinoPoseAt('pop-flash', DINO_HAND_OFF).o === 1 && dinoPoseAt('pop-flash', 3.2).o === 0, 'a short flash behind the opening');
});

void test('dino egg: the RAWR pose leans back with fierce eyes, a big mouth and claws up', () => {
  for (let t = 3.93; t <= 4.03; t += .01) {
    assert.ok(dinoPoseAt('baby-body', t).r <= -8.5, `leaning back at ${t.toFixed(2)}`);
    for (const layer of ['mouth-roar', 'eyes-fierce', 'brows', 'arm-far-up']) assert.equal(dinoPoseAt(layer, t).o, 1, `${layer} at ${t.toFixed(2)}`);
    assert.equal(dinoPoseAt('arm-far', t).o, 0, 'the far arm is the raised copy');
    assert.ok(dinoPoseAt('arm-near', t).r <= -120 && dinoPoseAt('arm-far-up', t).r >= 120, 'both claws up and out');
    assert.equal(dinoPoseAt('eyes-squeeze', t).o, 0, 'not the squeezed (laughing) eyes');
  }
  assert.equal(dinoPoseAt('mouth-roar', 3.96).sx, 1);
  assert.ok(dinoPoseAt('roar-lines', 3.97).o === 1 && dinoPoseAt('roar-lines', 4.06).o === 0);
  assert.ok(dinoPoseAt('cheeks', 3.95).sx < 1.1, 'no puffed cheeks with the mouth open');
});

void test('dino egg: the hero stays between the header and the footer on every projector size', () => {
  for (const [width, height] of VIEWPORTS) {
    const u = dinoUnit(width, height);
    const nestY = height * DINO_RIG.nestY;
    // The lowest art after the hop: the shadow and landing dust reach 12 u below the floor line.
    const lowest = nestY + (DINO_RIG.groundY + 12) * u;
    assert.ok(lowest <= height - FOOTER - 10, `${width}x${height}: lowest point ${lowest.toFixed(0)} px stays clear of the footer`);
    // Outline samples of the top shell / hat around its rim pivot: dome top, shoulders, rim ends.
    const shell: [number, number][] = [[0, DINO_RIG.shellTop], [-55, -70], [55, -70], [-78, 0], [78, 0]];
    let highest = Infinity;
    for (let t = 2.4; t <= 6.8; t += .005) {
      for (const [chain, layer] of [[HAT_CHAIN, 'hat'], [EGG_TOP_CHAIN, 'egg-top']] as const) {
        if (dinoPoseAt(layer, t).o > 0) for (const point of shell) highest = Math.min(highest, world(chain, t, point)[1]);
      }
      // The top of the baby's head while it springs out (body top at -160).
      highest = Math.min(highest, world(SPRING_CHAIN, t, [-4, -160])[1]);
    }
    assert.ok(nestY + highest * u >= HEADER, `${width}x${height}: highest point ${nestY + highest * u}px clears the ${HEADER}px header`);
    // The hero egg falls from above the screen, so it never pops into view mid-air.
    const dropTop = nestY + (DINO_RIG.eggRock[1] + dinoPoseAt('egg-rock', .2).y - DINO_RIG.eggHeight * dinoPoseAt('egg-rock', .2).sy) * u;
    assert.ok(dropTop + DINO_RIG.eggHeight * u < HEADER + 40, `${width}x${height}: the falling egg starts behind the header or above the screen`);
  }
});

void test('dino egg: hop lands on the floor in front of the nest and the baby scurries off before the end', () => {
  const hop = DINO_BEATS.hopLands;
  assert.equal(dinoPoseAt('baby-x', hop).x, DINO_RIG.hopX);
  assert.equal(DINO_RIG.babyX[1] + dinoPoseAt('baby-y', hop).y, DINO_RIG.groundY);
  assert.equal(DINO_RIG.landDust[1], DINO_RIG.groundY - DINO_RIG.babyX[1], 'the landing dust sits on the floor');
  assert.equal(dinoPoseAt('shadow', hop).y, DINO_RIG.groundY - DINO_RIG.babyX[1], 'the shadow lands with it');
  assert.ok(dinoPoseAt('baby-x', DINO_BEATS.hopOff).x === 0, 'still in the nest until the hop');
  assert.ok(Math.min(...[6.25, 6.3, 6.35].map((t) => dinoPoseAt('baby-y', t).y)) < -40, 'a real hop up before the drop');
  for (const [width, height] of VIEWPORTS) {
    const u = dinoUnit(width, height);
    const leftmost = (t: number) => width / 2 + (DINO_RIG.babyX[0] + dinoPoseAt('baby-x', t).x + DINO_RIG.babyLeft - 20) * u + dinoPoseAt('baby-exit', t).xvw * width / 100;
    assert.ok(leftmost(END - .1) > width, `${width}x${height}: the baby is fully off the right edge by ${END - .1} s (${leftmost(END - .1)})`);
    assert.ok(leftmost(DINO_BEATS.exitStart) < width, `${width}x${height}: it starts its walk on screen`);
    // It lands on screen: the snout (90 u right of the body) stays inside the viewport.
    assert.ok(width / 2 + (DINO_RIG.babyX[0] + DINO_RIG.hopX + 92) * u <= width, `${width}x${height}: the landing is on screen`);
  }
  let previous = -Infinity;
  for (let t = DINO_BEATS.exitStart; t <= END; t += .02) { const x = dinoPoseAt('baby-exit', t).xvw; assert.ok(x >= previous - 1e-9, 'the exit never walks backwards'); previous = x; }
  // The blind beat is short: from the landing to the first step is at most 0.3 s, so it never parks over the names.
  assert.ok(DINO_BEATS.exitStart - DINO_BEATS.hopLands <= .3);
  assert.ok(dinoPoseAt('baby-exit', DINO_BEATS.exitStart + .3).xvw >= 10, 'it is well on its way 0.3 s later');
  assert.equal(dinoPoseAt('baby-exit', END).xvw, DINO_EXIT_VW);
});

void test('dino egg: the scurry steps land on the footfalls the sound uses', () => {
  const falls = dinoFootfalls();
  assert.equal(falls.length, DINO_STEPS.count);
  assert.equal(falls[0], Number((DINO_BEATS.exitStart + DINO_STEPS.every).toFixed(3)));
  falls.forEach((fall, index) => {
    const foot = index % 2 ? 'foot-far' : 'foot-near';
    assert.equal(dinoPoseAt(foot, fall).y, 0, `${foot} down at ${fall}`);
    assert.ok(dinoPoseAt(foot, fall - DINO_STEPS.every / 2).y < -8, `${foot} up before ${fall}`);
    if (fall <= END) assert.equal(dinoPoseAt('baby-y', fall).y, DINO_RIG.groundY - DINO_RIG.babyX[1], `body down on the floor at ${fall}`);
  });
  // The two feet never leave the floor together.
  for (let t = DINO_BEATS.exitStart; t <= END; t += .005) {
    assert.ok(dinoPoseAt('foot-near', t).y > -1 || dinoPoseAt('foot-far', t).y > -1, `one foot down at ${t.toFixed(3)}`);
  }
});

void test('dino egg: nothing but the departing baby is left on the stage at the end', () => {
  for (const layer of DINO_TRANSIENT_LAYERS) {
    assert.equal(dinoPoseAt(layer, END).o, 0, `${layer} hidden at the end`);
    assert.equal(dinoPoseAt(layer, 7.05).o, 0, `${layer} hidden while the baby walks off`);
  }
  assert.ok(DINO_SPOT.inStart < DINO_SPOT.full && DINO_SPOT.full <= DINO_SPOT.outStart && DINO_SPOT.outStart < DINO_SPOT.gone && DINO_SPOT.gone < END, 'spotlight fades in, holds, and is gone well before the end');
  assert.equal(DINO_SPOT.outStart, DINO_BEATS.stomp, 'the stomp lifts the spotlight');
});

void test('dino egg: one expression at a time', () => {
  const groups = [['eyes-open', 'eyes-squeeze', 'eyes-fierce', 'eyes-happy'], ['mouth-smile', 'mouth-puff', 'mouth-roar', 'mouth-peep', 'mouth-shy', 'mouth-grit', 'mouth-grin']];
  for (let t = 3.12; t <= END; t += .01) {
    for (const group of groups) {
      const visible = group.filter((layer) => dinoPoseAt(layer, t).o > .5);
      assert.ok(visible.length <= 1, `${t.toFixed(2)} s: ${visible.join(', ')} overlap`);
      const total = group.reduce((sum, layer) => sum + dinoPoseAt(layer, t).o, 0);
      assert.ok(total > .3, `${t.toFixed(2)} s: some ${group[0].split('-')[0]} shows`);
    }
  }
});

void test('dino egg: the story beats land on their keys (sound sync)', () => {
  assert.equal(dinoPoseAt('egg-rock', DINO_BEATS.heroLands).y, 0, 'hero egg lands');
  assert.ok(dinoPoseAt('egg-rock', DINO_BEATS.heroLands - .1).y < -50, 'and was falling just before');
  assert.equal(dinoPoseAt('egg-rock', DINO_BEATS.wobbleRight).r, 8);
  assert.equal(dinoPoseAt('egg-rock', DINO_BEATS.wobbleLeft).r, -8);
  assert.equal(DINO_BEATS.pop, DINO_HAND_OFF);
  assert.equal(dinoPoseAt('spring', DINO_BEATS.pop - .01).o, 0, 'baby hidden before the pop');
  assert.equal(dinoPoseAt('spring', DINO_BEATS.pop).o, 1, 'baby springs out at the pop');
  assert.equal(dinoPoseAt('hat', DINO_BEATS.hatLands).y, 0, 'hat lands on the head');
  assert.equal(dinoPoseAt('mouth-roar', DINO_BEATS.roar + .07).o, 1, 'roar is held');
  assert.equal(dinoPoseAt('peep', DINO_BEATS.peep - .01).o, 0);
  assert.ok(dinoPoseAt('peep', DINO_BEATS.peep + .06).sx > .5, 'peep bubble pops out');
  const foot = dinoPoseAt('foot-near', DINO_BEATS.stomp);
  assert.ok(foot.y === 0 && dinoPoseAt('foot-near', DINO_BEATS.stomp - .08).y < -30, 'foot slams down at the stomp');
  assert.ok(dinoPoseAt('boom', DINO_BEATS.stomp).o === 1 && dinoPoseAt('boom', DINO_BEATS.stomp - .01).o === 0, 'BOOM at the stomp');
  assert.ok(dinoPoseAt('baby-y', DINO_BEATS.hopLands).y > 50, 'landing');
  assert.ok(dinoPoseAt('baby-exit', DINO_BEATS.exitStart).xvw === 0 && dinoPoseAt('baby-exit', DINO_BEATS.exitEnd).xvw === DINO_EXIT_VW, 'walk-off window');
  assert.ok(DINO_COVER.stompAt / 1000 === DINO_BEATS.stomp && DINO_COVER.crackAt / 1000 === DINO_BEATS.crack, 'covers share the stomp and crack beats');
});

void test('dino egg: card cover choreography contracts', () => {
  const C = DINO_COVER;
  for (const order of [0, .25, .5, .75, 1]) {
    const beat = dinoCoverSchedule(order, .5);
    assert.ok(close(beat.rockEnd, C.rockEnd), `order ${order}: every egg stops knocking together`);
    assert.ok(beat.settleEnd <= beat.rockStart, `order ${order}: settled before it knocks`);
    assert.ok(beat.rockEnd < C.crackAt, 'the knocking stops before the hairline crack');
  }
  assert.ok(C.settleStagger + C.settleDuration <= C.rockStart);
  assert.ok(C.eyesAt < C.happyAt && C.happyAt < C.popAt && C.popAt < C.bounceAt && C.bounceAt < C.duckAt && C.duckAt < C.sinkAt, 'eyes, happy, pop, bounce, duck, then sink');
  assert.ok(C.popAt + C.popDuration <= C.bounceAt && C.bounceAt + C.bounceDuration <= C.duckAt, 'the pop settles before the bounce, the bounce before the duck');
  assert.ok(C.duckAt + C.duckDuration <= C.local && C.sinkAt + C.sinkDuration <= C.local && C.topDuration <= C.local, 'all of one hatch fits in its local window');
  assert.ok(C.duckAt - C.happyAt >= 400, `each group's happy baby is on show for ${C.duckAt - C.happyAt} ms before it ducks`);
  assert.ok(C.stompAt + C.joltDuration <= C.stompAt + C.eyesAt + 100, 'the stomp jolt settles as the first eggs crack');
  const worst = dinoCoverSchedule(1, 1);
  assert.ok(worst.hiddenAt <= 7000, `last cover gone by ${worst.hiddenAt} ms`);
  assert.ok(worst.hiddenAt <= (DINO_BEATS.exitEnd - .3) * 1000, 'covers are gone while the hero is still scurrying off');
  assert.ok(DINO_DURATION_MS <= 9800, 'under the 9.8 s cap');
  let previous = -Infinity;
  for (let d = 0; d <= 1.0001; d += .05) {
    const beat = dinoCoverSchedule(0, d);
    assert.ok(beat.ts >= previous, 'farther cards crack later');
    previous = beat.ts;
    assert.ok(close(dinoRingRadius(beat.ts), Math.min(1, d), 1e-9), `the ring reaches distance ${d.toFixed(2)} as that egg cracks`);
    assert.ok(beat.hiddenAt <= 7000);
  }
  assert.equal(dinoCoverSchedule(-3, 7).ts, C.stompAt + C.rippleSpan, 'inputs are clamped');
});

void test('dino egg: distance from the focal point is normalised, clamped and symmetric', () => {
  for (const [width, height] of VIEWPORTS) {
    assert.equal(dinoDistance(width * DINO_FOCUS.x, height * DINO_FOCUS.y, width, height), 0);
    assert.equal(dinoDistance(width * 3, height * 3, width, height), 1);
    assert.equal(dinoDistance(-width, height * 2, width, height), 1, 'off-screen cards clamp to 1');
    assert.ok(dinoDistance(width, height, width, height) === 1, 'the far corner is at least the reach away');
    for (const [x, y] of [[.1, .2], [.3, .9], [.45, .5]]) {
      const left = dinoDistance(width * x, height * y, width, height);
      const right = dinoDistance(width * (1 - x), height * y, width, height);
      assert.ok(close(left, right, 1e-12), 'left/right symmetric');
      assert.ok(left >= 0 && left <= 1);
    }
    assert.ok(close(dinoReach(width, height), Math.hypot(width, height) / 2));
  }
  assert.equal(dinoDistance(Number.NaN, 10, 100, 100), .5, 'unmeasured cards fall back to the middle of the ripple');
});

void test('dino egg: the ripple is timed from where each egg actually sits', () => {
  // One wide card: the egg moves to 20% of it so the hero never hides it.
  const lone = dinoEggCenter({ left: 30, top: 70, width: 1217, height: 637 }, 1, 800);
  assert.ok(close(lone.x, 30 + 1217 * .2) && lone.eggHeight === 192);
  assert.ok(dinoDistance(lone.x, lone.y, 1280, 800) > .3, 'a lone egg cracks as the ring reaches it, not at the stomp');
  // Tall cards: the egg sits high (nest at 42%), above the card centre.
  const tall = dinoEggCenter({ left: 0, top: 70, width: 289, height: 637 }, 4, 800);
  assert.ok(close(tall.x, 144.5) && tall.y < 70 + 637 / 2, 'egg sits above the card centre');
  // Short Today cells: the egg fits the cell and stays inside it.
  const cell = dinoEggCenter({ left: 0, top: 0, width: 270, height: 76 }, 15, 800);
  assert.ok(cell.eggHeight <= 76 * .66 + 1e-9 && cell.y - cell.eggHeight / 2 >= 0 && cell.y + cell.eggHeight / 2 <= 76);
  for (const count of [1, 2, 4, 8, 12, 48]) {
    const egg = dinoEggCenter({ left: 100, top: 100, width: 300, height: 400 }, count, 800);
    assert.ok(egg.x >= 100 && egg.x <= 400 && egg.y >= 100 && egg.y <= 500, `count ${count}: the egg stays on its card`);
  }
  assert.ok(close(dinoEggCenter({ left: 100, top: 0, width: 200, height: 300 }, 4, 800, { xFraction: .25 }).x, 150), 'an explicit placement wins');
});

void test('dino egg: every card keeps room above its egg, so the popping head is never clipped flat', () => {
  // Today cells, Groups 12 and Groups 8 at 1280x800, a tall Groups 4 card, and Groups 12 at 1920x1080.
  const cards: [card: CardRect, viewportHeight: number][] = [
    [{ left: 0, top: 0, width: 270, height: 76 }, 800], [{ left: 0, top: 0, width: 181, height: 90 }, 680], [{ left: 0, top: 0, width: 289, height: 231 }, 800],
    [{ left: 0, top: 0, width: 289, height: 308 }, 800], [{ left: 0, top: 0, width: 291, height: 645 }, 800], [{ left: 0, top: 0, width: 293, height: 448 }, 1080],
  ];
  for (const [card, viewportHeight] of cards) {
    const egg = dinoEggCenter(card, 12, viewportHeight);
    // The centre sits .39 egg heights above the nest line; the box spans from .11 below it to 1 egg height above.
    const nestLine = egg.y + egg.eggHeight * .39;
    const boxTop = nestLine + egg.eggHeight * .11 - egg.eggHeight;
    assert.ok(boxTop - card.top >= DINO_HEADROOM * egg.eggHeight - 1e-9, `${card.width}x${card.height}: ${(boxTop - card.top).toFixed(1)} px of headroom for a ${egg.eggHeight.toFixed(0)} px egg`);
    const nestBottom = nestLine + egg.eggHeight * .15;
    assert.ok(nestBottom <= card.top + card.height, `${card.width}x${card.height}: the nest rim stays on the card`);
  }
  // An egg tucked above the hero keeps the same headroom under the card top.
  const high = dinoEggPlacement({ left: 560, top: 8, width: 160, height: 330 }, 5, 1280, 800);
  if (high.nestY !== null && high.eggHeight !== null) {
    assert.ok(high.nestY + high.eggHeight * .11 - high.eggHeight >= DINO_HEADROOM * high.eggHeight - 1e-9, 'tucked-above egg has headroom');
  }
});

void test('dino egg: eggs the hero would hide move to the side of their card', () => {
  // Four Groups cards at 1280x800, as the lab lays them out.
  const cards = [23, 332, 642, 951].map((left) => ({ left, top: 72, width: 291, height: 645 }));
  const placed = cards.map((card) => dinoEggPlacement(card, 4, 1280, 800));
  assert.deepEqual(placed.map((p) => p.xFraction === null), [true, false, false, true], 'only the two middle eggs move');
  assert.ok(placed.every((p) => p.nestY === null && p.eggHeight === null), 'sliding sideways is enough here');
  const hero = dinoHeroRect(1280, 800);
  placed.forEach(({ egg, xFraction }, index) => {
    const card = cards[index];
    assert.ok(egg.x - egg.eggWidth / 2 >= card.left && egg.x + egg.eggWidth / 2 <= card.left + card.width, `egg ${index} stays on its card`);
    assert.ok(dinoOcclusion(egg, hero) <= DINO_OCCLUSION_LIMIT, `egg ${index} is mostly clear of the hero`);
    if (xFraction !== null) assert.ok(dinoOcclusion(egg, hero) < dinoOcclusion(dinoEggCenter(card, 4, 800), hero));
  });
  assert.ok(placed[1].xFraction! < .5 && placed[2].xFraction! > .5, 'each moves away from the screen centre');
  assert.ok(close(placed[1].xFraction!, 1 - placed[2].xFraction!, 1e-9), 'mirror-symmetric');
  // Five cards: the narrow middle card cannot slide its egg clear, so a smaller egg is tucked under the hero.
  const middle = { left: 518, top: 72, width: 230, height: 645 };
  const tucked = dinoEggPlacement(middle, 5, 1280, 800);
  assert.ok(tucked.xFraction === null && tucked.nestY !== null && tucked.eggHeight !== null, 'tucked below the hero');
  assert.equal(dinoOcclusion(tucked.egg, hero), 0, 'fully clear of the hero');
  assert.ok(tucked.eggHeight >= dinoEggCenter(middle, 5, 800).eggHeight * .5, 'still a good-sized egg');
  assert.ok(tucked.nestY + tucked.eggHeight * .15 <= middle.height, 'the nest stays on the card');
  // A lone card keeps its 20% egg; cards far from the hero never move; a card with no size is left alone.
  assert.equal(dinoEggPlacement({ left: 30, top: 70, width: 1217, height: 637 }, 1, 1280, 800).xFraction, null);
  assert.equal(dinoEggPlacement({ left: 0, top: 0, width: 200, height: 100 }, 12, 1280, 800).xFraction, null);
  assert.equal(dinoEggPlacement({ left: 600, top: 300, width: 0, height: 0 }, 12, 1280, 800).xFraction, null);
  // Occlusion basics.
  assert.equal(dinoOcclusion({ x: 0, y: 0, eggWidth: 10, eggHeight: 10 }, { left: 100, right: 200, top: 0, bottom: 100 }), 0);
  assert.equal(dinoOcclusion({ x: 150, y: 50, eggWidth: 10, eggHeight: 10 }, { left: 100, right: 200, top: 0, bottom: 100 }), 1);
  assert.ok(close(dinoOcclusion({ x: 100, y: 50, eggWidth: 10, eggHeight: 10 }, { left: 100, right: 200, top: 0, bottom: 100 }), .5));
});

void test('dino egg: hero unit follows the storyboard clamp', () => {
  assert.ok(close(dinoUnit(1280, 800), 1.32));
  assert.ok(close(dinoUnit(960, 680), 1.122, 1e-9));
  assert.equal(dinoUnit(1920, 1080), 1.75);
  assert.equal(dinoUnit(200, 200), .7);
});

void test('dino egg: the effect contract', () => {
  assert.equal(dinoEggEffect.id, 'dino-egg');
  assert.equal(dinoEggEffect.durationMs, DINO_DURATION_MS);
  assert.ok(dinoEggEffect.durationMs <= 9800);
  assert.equal(dinoEggEffect.sound, 'dino-egg');
  assert.ok(dinoEggEffect.name.length > 0 && dinoEggEffect.description.length > 0);
  assert.equal(typeof dinoEggEffect.Stage, 'function');
  assert.equal(typeof dinoEggEffect.Cover, 'function');
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(dinoEggEffect.name + dinoEggEffect.description), 'no emoji');
  // Poses resolve with inheritance: an omitted field carries over.
  const poses = resolvePoses([{ t: 0, x: 4, o: .5 }, { t: 1, y: 2 }]);
  assert.deepEqual([poses[1].x, poses[1].y, poses[1].o], [4, 2, .5]);
});
