import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ARM_SCANS, DEFAULT_POP_MS, HANG_SEARCH_FRAMES, MAX_START_SKIP_MS, QFLY_DX, QFLY_RISE, SELF_ARM_MS, balloonEffect, playRig, revealArmer, startOnClock } from '../src/revealEffects/balloons';
import {
  ARM_LEAD_MS, BALLOON_DURATION_MS, BT, COVER_TAIL, CONFETTI_BUDGET, DENSE_COVERS, EXIT_DRIFTS, EXIT_SCALE, EYE_HOG, EYE_SIZE, FEATHER_GONE, FEATHER_VANE, FOCAL, FOOTER_PX, HANG_CHECK_FROM, HANG_CHECK_TO, HANG_LIFT_VMIN, HANG_MIN_BLOWN_VMIN, HANG_SCALES, HOLD_FROM,
  HEADER_PX, HEART, HERO_Y, HOG_SCALE, INHALE_ARM_MS, KISS, PAINT_END_MS, PAW, PUFF_GONE, PULL_STOPS, QUILLS, RING_ARM_MS, SETTLE_ARM_MS, SHARD_MAX, SHARD_SIZE, SHORT_SCALE, SHORT_VIEWPORT, SPARKLES_GONE, SQUASH_Y, TWIN_BUNCH_MIN_WIDTH, WAVE,
  ahMouth, balloonPose, bunchPopTimes, cardConfetti, confettiPerCard, coverClearAt, coverFocus, coverLayout, coverShape, emptySlot, exitCrossing, exitEase, facePx, focalFor, focusDistance,
  hangAt, hangOverlap, heartTip, heroPopPoint, isDense, noseAnchor, paperShards, popArmMs, popAt, provisionalScene, pullOffset, pullStop, quillTipsRig, rigScaleOf, rigScreenBox, ringMaxRadius, ringRadius, rotateAbout,
  sceneFor, screenCircles, shardGrid, spline, textOverlap,
  type BalloonPose, type Point, type Rect, type Scene,
} from '../src/revealEffects/balloonsTimeline';

const css = readFileSync('src/revealEffects/balloons.css', 'utf8');
const tsx = readFileSync('src/revealEffects/balloons.tsx', 'utf8');
const VIEWPORTS = [[640, 480], [960, 680], [1280, 800], [1920, 1080], [2560, 1080], [768, 1024]] as const;
const close = (actual: number, expected: number, epsilon: number) => Math.abs(actual - expected) <= epsilon;
const vmin = (scene: { width: number; height: number }) => Math.min(scene.width, scene.height) / 100;

type Box = [number, number, number, number];
/**
 * Screens measured in the reveal lab: every card ([left, top, width, height]) and every piece of text
 * outside the covers (names, titles, station labels, table headings), as the Stage reads them.
 */
const LAYOUTS: Record<string, { width: number; height: number; rects: Box[]; texts: Box[] }> = {
  g4: { width: 1280, height: 800, rects: [[24,74,289,637],[333,74,289,637],[643,74,289,637],[952,74,289,637]], texts: [[43,98,37,31],[94,101,56,25],[54,166,77,33],[54,212,93,33],[54,259,55,33],[353,98,37,31],[403,101,62,25],[363,166,68,33],[363,212,49,33],[363,259,69,33],[363,305,81,33],[662,98,37,31],[713,101,106,25],[673,166,81,33],[673,212,49,33],[673,259,42,33],[971,98,37,31],[1022,101,47,25],[982,166,62,33],[982,212,33,33],[982,259,48,33],[982,305,54,33]] },
  g8: { width: 1280, height: 800, rects: [[24,74,289,308],[333,74,289,308],[643,74,289,308],[952,74,289,308],[24,402,289,308],[333,402,289,308],[643,402,289,308],[952,402,289,308]], texts: [[43,98,37,31],[94,101,56,25],[54,166,77,33],[54,212,93,33],[54,259,55,33],[353,98,37,31],[403,101,62,25],[363,166,68,33],[363,212,49,33],[363,259,69,33],[363,305,81,33],[662,98,37,31],[713,101,106,25],[673,166,81,33],[673,212,49,33],[673,259,42,33],[971,98,37,31],[1022,101,47,25],[982,166,62,33],[982,212,33,33],[982,259,48,33],[982,305,54,33],[43,426,37,31],[94,429,68,25],[54,494,54,33],[54,541,45,33],[54,587,73,33],[353,426,37,31],[403,429,46,25],[363,494,39,33],[363,541,77,33],[363,587,93,33],[363,634,55,33],[662,426,37,31],[713,429,105,25],[673,494,55,33],[673,541,68,33],[673,587,49,33],[971,426,37,31],[1022,429,65,25],[982,494,69,33],[982,541,81,33],[982,587,49,33],[982,634,42,33]] },
  g12: { width: 1280, height: 800, rects: [[24,74,289,231],[333,74,289,231],[643,74,289,231],[952,74,289,231],[24,325,289,231],[333,325,289,231],[643,325,289,231],[952,325,289,231],[24,576,289,231],[333,576,289,231],[643,576,289,231],[952,576,289,231]], texts: [[37,89,32,27],[80,92,49,21],[50,141,69,30],[50,180,83,30],[50,220,49,30],[346,89,32,27],[389,92,54,21],[359,141,60,30],[359,180,43,30],[359,220,61,30],[359,259,72,30],[656,89,32,27],[699,92,93,21],[669,141,72,30],[669,180,44,30],[669,220,37,30],[965,89,32,27],[1008,92,41,21],[978,141,55,30],[978,180,30,30],[978,220,43,30],[978,259,48,30],[37,340,32,27],[80,343,60,21],[50,392,48,30],[50,431,40,30],[50,471,65,30],[346,340,32,27],[389,343,40,21],[359,392,34,30],[359,431,69,30],[359,471,83,30],[359,510,49,30],[656,340,32,27],[699,343,92,21],[669,392,49,30],[669,431,60,30],[669,471,43,30],[965,340,32,27],[1008,343,57,21],[978,392,61,30],[978,431,72,30],[978,471,44,30],[978,510,37,30],[37,591,32,27],[80,594,47,21],[50,643,37,30],[50,682,55,30],[346,591,32,27],[389,594,76,21],[359,643,43,30],[359,682,48,30],[656,591,32,27],[699,594,68,21],[669,643,65,30],[669,682,34,30],[965,591,32,27],[1008,594,74,21],[978,643,83,30],[978,682,49,30]] },
  g1: { width: 1280, height: 800, rects: [[24,74,1217,637]], texts: [[43,98,37,31],[94,101,56,25],[54,166,77,33],[54,212,93,33],[54,259,55,33]] },
  g5: { width: 1280, height: 800, rects: [[24,74,227,637],[271,74,227,637],[519,74,227,637],[766,74,227,637],[1014,74,227,637]], texts: [[43,98,37,31],[94,101,56,25],[54,166,77,33],[54,212,93,33],[54,259,55,33],[291,98,37,31],[341,101,62,25],[301,166,68,33],[301,212,49,33],[301,259,69,33],[301,305,81,33],[538,98,37,31],[589,101,106,25],[549,166,81,33],[549,212,49,33],[549,259,42,33],[786,98,37,31],[836,101,47,25],[796,166,62,33],[796,212,33,33],[796,259,48,33],[796,305,54,33],[1033,98,37,31],[1084,101,68,25],[1044,166,54,33],[1044,212,45,33],[1044,259,73,33]] },
  g7: { width: 1280, height: 800, rects: [[24,74,289,308],[333,74,289,308],[643,74,289,308],[952,74,289,308],[24,402,289,308],[333,402,289,308],[643,402,289,308]], texts: [[43,98,37,31],[94,101,56,25],[54,166,77,33],[54,212,93,33],[54,259,55,33],[353,98,37,31],[403,101,62,25],[363,166,68,33],[363,212,49,33],[363,259,69,33],[363,305,81,33],[662,98,37,31],[713,101,106,25],[673,166,81,33],[673,212,49,33],[673,259,42,33],[971,98,37,31],[1022,101,47,25],[982,166,62,33],[982,212,33,33],[982,259,48,33],[982,305,54,33],[43,426,37,31],[94,429,68,25],[54,494,54,33],[54,541,45,33],[54,587,73,33],[353,426,37,31],[403,429,46,25],[363,494,39,33],[363,541,77,33],[363,587,93,33],[363,634,55,33],[662,426,37,31],[713,429,105,25],[673,494,55,33],[673,541,68,33],[673,587,49,33]] },
  g6hd: { width: 1920, height: 1080, rects: [[24,74,293,917],[337,74,293,917],[650,74,293,917],[963,74,293,917],[1275,74,293,917],[1588,74,293,917]], texts: [[43,98,37,31],[94,98,69,30],[54,166,96,42],[54,222,116,42],[54,278,69,42],[356,98,37,31],[407,98,76,30],[367,166,84,42],[367,222,61,42],[367,278,86,42],[367,333,101,42],[669,98,37,31],[720,98,130,30],[680,166,101,42],[680,222,61,42],[680,278,52,42],[982,98,37,31],[1033,98,58,30],[993,166,78,42],[993,222,42,42],[993,278,60,42],[993,333,67,42],[1295,98,37,31],[1345,98,84,30],[1305,166,67,42],[1305,222,57,42],[1305,278,91,42],[1608,98,37,31],[1658,98,57,30],[1618,166,48,42],[1618,222,96,42],[1618,278,116,42],[1618,333,69,42]] },
  g4s960: { width: 960, height: 680, rects: [[24,74,286,258],[330,74,286,258],[635,74,286,258],[24,352,286,258]], texts: [[43,98,37,31],[94,103,48,21],[54,165,64,28],[54,205,78,28],[54,245,46,28],[349,98,37,31],[400,103,53,21],[360,165,56,28],[360,205,41,28],[360,245,57,28],[360,286,68,28],[655,98,37,31],[705,103,90,21],[665,165,68,28],[665,205,41,28],[665,245,35,28],[43,376,37,31],[94,380,40,21],[54,443,52,28],[54,483,28,28],[54,523,40,28],[54,563,45,28]] },
  g5s960: { width: 960, height: 680, rects: [[24,74,286,258],[330,74,286,258],[635,74,286,258],[24,352,286,258],[330,352,286,258]], texts: [[43,98,37,31],[94,103,48,21],[54,165,64,28],[54,205,78,28],[54,245,46,28],[349,98,37,31],[400,103,53,21],[360,165,56,28],[360,205,41,28],[360,245,57,28],[360,286,68,28],[655,98,37,31],[705,103,90,21],[665,165,68,28],[665,205,41,28],[665,245,35,28],[43,376,37,31],[94,380,40,21],[54,443,52,28],[54,483,28,28],[54,523,40,28],[54,563,45,28],[349,376,37,31],[400,380,58,21],[360,443,45,28],[360,483,38,28],[360,523,61,28]] },
  rot5: { width: 1280, height: 800, rects: [[348,123,269,76],[647,123,269,76],[945,123,270,76],[348,216,269,76],[647,216,269,76],[945,216,270,76],[348,309,269,76],[647,309,269,76],[945,309,270,76],[348,402,269,76],[647,402,269,76],[945,402,270,76],[348,495,269,76],[647,495,269,76],[945,495,270,76]], texts: [[50,80,47,22],[358,84,8,16],[384,79,62,22],[446,79,11,22],[656,84,8,16],[683,79,62,22],[744,79,11,22],[954,84,8,16],[981,79,62,22],[1042,79,11,22],[58,146,34,29],[107,148,56,25],[348,145,38,32],[392,156,100,19],[647,145,38,32],[690,156,87,19],[945,145,38,32],[988,156,66,19],[58,239,34,29],[107,241,62,25],[348,238,38,32],[392,249,87,19],[647,238,38,32],[690,249,66,19],[945,238,38,32],[988,249,57,19],[58,332,34,29],[107,334,105,25],[348,331,38,32],[392,342,66,19],[647,331,38,32],[690,342,57,19],[945,331,38,32],[988,342,57,19],[58,425,34,29],[107,427,46,25],[348,424,38,32],[392,435,57,19],[647,424,38,32],[690,435,57,19],[945,424,38,32],[988,435,54,19],[58,518,34,29],[107,520,68,25],[348,517,38,32],[392,528,57,19],[647,517,38,32],[690,528,54,19],[945,517,38,32],[988,528,100,19]] },
  g4p: { width: 768, height: 1024, rects: [[24,74,222,420],[266,74,222,420],[507,74,222,420],[24,514,222,420]], texts: [[43,98,37,31],[94,103,48,21],[54,165,64,28],[54,205,78,28],[54,245,46,28],[285,98,37,31],[336,103,53,21],[296,165,56,28],[296,205,41,28],[296,245,57,28],[296,286,68,28],[527,98,37,31],[577,103,90,21],[537,165,68,28],[537,205,41,28],[537,245,35,28],[43,538,37,31],[94,543,40,21],[54,605,52,28],[54,645,28,28],[54,686,40,28],[54,726,45,28]] },
  g8hd: { width: 1920, height: 1080, rects: [[24,74,449,448],[493,74,449,448],[963,74,449,448],[1432,74,449,448],[24,542,449,448],[493,542,449,448],[963,542,449,448],[1432,542,449,448]], texts: [[43,98,37,31],[94,98,69,30],[54,166,96,42],[54,222,116,42],[54,278,69,42],[513,98,37,31],[563,98,76,30],[523,166,84,42],[523,222,61,42],[523,278,86,42],[523,333,101,42],[982,98,37,31],[1033,98,130,30],[993,166,101,42],[993,222,61,42],[993,278,52,42],[1451,98,37,31],[1502,98,58,30],[1462,166,78,42],[1462,222,42,42],[1462,278,60,42],[1462,333,67,42],[43,566,37,31],[94,566,84,30],[54,634,67,42],[54,690,57,42],[54,746,91,42],[513,566,37,31],[563,566,57,30],[523,634,48,42],[523,690,96,42],[523,746,116,42],[523,802,69,42],[982,566,37,31],[1033,566,129,30],[993,634,69,42],[993,690,84,42],[993,746,61,42],[1451,566,37,31],[1502,566,80,30],[1462,634,86,42],[1462,690,101,42],[1462,746,61,42],[1462,802,52,42]] },
};
const boxes = (list: Box[]): Rect[] => list.map(([left, top, width, height]) => ({ left, top, width, height }));
const rectsOf = (name: string) => boxes(LAYOUTS[name].rects);
const textsOf = (name: string) => boxes(LAYOUTS[name].texts);
const sceneOf = (name: string) => sceneFor(LAYOUTS[name], rectsOf(name), textsOf(name));
/** Screens where a clear hang spot exists (the rest are crowded day tables). */
const ROOMY = ['g4', 'g8', 'g12', 'g1', 'g5', 'g7', 'g6hd', 'g4s960', 'g5s960', 'g4p', 'g8hd'];

/** `{ percent: declarations }` for one @keyframes block. */
function keyframes(name: string) {
  const start = css.indexOf(`@keyframes ${name} {`);
  assert.ok(start >= 0, `@keyframes ${name} exists`);
  let depth = 0;
  let end = start;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) { end = i; break; }
  }
  const body = css.slice(css.indexOf('{', start) + 1, end);
  const stops = new Map<number, string>();
  for (const match of body.matchAll(/(\d+(?:\.\d+)?%|from|to)\s*\{([^}]*)\}/g)) {
    const key = match[1] === 'from' ? 0 : match[1] === 'to' ? 100 : Number.parseFloat(match[1]);
    stops.set(key, match[2]);
  }
  return stops;
}

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string) {
  const index = css.indexOf(`
${selector} {`);
  assert.ok(index >= 0, `rule ${selector} exists`);
  return css.slice(css.indexOf('{', index) + 1, css.indexOf('}', index));
}

/** Every top-level rule as [selector, declarations] (keyframe bodies excluded). */
function rules() {
  const out: [string, string][] = [];
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  while (i < flat.length) {
    const open = flat.indexOf('{', i);
    if (open < 0) break;
    const selector = flat.slice(i, open).trim();
    if (selector.startsWith('@keyframes')) {
      let depth = 0;
      let j = open;
      for (; j < flat.length; j++) { if (flat[j] === '{') depth++; if (flat[j] === '}' && --depth === 0) break; }
      i = j + 1;
      continue;
    }
    const closeAt = flat.indexOf('}', open);
    out.push([selector, flat.slice(open + 1, closeAt)]);
    i = closeAt + 1;
  }
  return out;
}

/** Undo hogToRig: a rig point back into the hedgehog's own (unsquashed, unleaned) units. */
function rigToHog(point: Point, pose: BalloonPose): Point {
  const unswung = rotateAbout(point, PAW, -pose.swing);
  const scaled = { x: unswung.x / HOG_SCALE, y: unswung.y / HOG_SCALE - pose.bodyY };
  const unleaned = rotateAbout(scaled, { x: 0, y: SQUASH_Y }, -pose.tilt);
  return { x: unleaned.x / pose.sx, y: SQUASH_Y + (unleaned.y - SQUASH_Y) / pose.sy };
}

/** Outline samples of the feather's vane (its own units). */
function featherOutline(): Point[] {
  const numbers = FEATHER_VANE.replace(/[MCZ]/g, ' ').trim().split(/\s+/).map(Number);
  const points: Point[] = [];
  let x = numbers[0];
  let y = numbers[1];
  for (let i = 2; i + 5 < numbers.length; i += 6) {
    const [x1, y1, x2, y2, x3, y3] = numbers.slice(i, i + 6);
    for (let s = 0; s <= 1; s += .1) {
      const u = 1 - s;
      points.push({ x: u * u * u * x + 3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s * x3, y: u * u * u * y + 3 * u * u * s * y1 + 3 * u * s * s * y2 + s * s * s * y3 });
    }
    x = x3; y = y3;
  }
  return points;
}

/** The rig's silhouette on screen at t, as circles (px). */
const silhouette = (t: number, scene: Scene) => screenCircles(balloonPose(t), scene);

// Cards measured in the lab: groups 4 / 6 / 8 / 12 at 1280, 6 at 1920, one team, 960 at 4, day-table cells.
const CARDS = [[289, 637], [293, 917], [289, 308], [289, 231], [392, 308], [1217, 637], [1860, 917], [286, 258], [269, 76], [181, 90], [600, 520]] as const;

void test('balloon pop party is registered with its sound and stays well inside the reveal budget', () => {
  assert.equal(balloonEffect.id, 'balloons');
  assert.equal(balloonEffect.sound, 'balloons');
  assert.equal(balloonEffect.name, 'Balloon pop party');
  assert.equal(balloonEffect.durationMs, BALLOON_DURATION_MS);
  assert.equal(BALLOON_DURATION_MS, BT.duration * 1000);
  assert.ok(BALLOON_DURATION_MS <= 9800);
  assert.equal(typeof balloonEffect.Stage, 'function');
  assert.equal(typeof balloonEffect.Cover, 'function');
});

void test('the story beats happen in order, the goodbye plays while he hangs still, and everything clears before the end', () => {
  const order = [BT.inflateAt, BT.riseStart, BT.nearMissStart, BT.nearMissKiss, BT.nearMissRelease, BT.featherStart, BT.featherLand, BT.ah1, BT.ah1Peak,
    BT.ah1Release, BT.ah2Peak, BT.ah2Release, BT.ah3Peak, BT.sneezeAt, BT.popStart, BT.lookUpStart, BT.recoilEnd, BT.lookUpEnd, BT.waveStart, BT.giggleStart,
    BT.dipStart, BT.exitStart, BT.giggleEnd, BT.exitEnd, BT.duration];
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `beat ${i} (${order[i]}) follows ${order[i - 1]}`);
  assert.ok(BT.riseEnd <= BT.nearMissKiss, 'he has arrived before the heart lands');
  assert.ok(BT.inflateAt + BT.inflateStagger + 2 * BT.sideLag + BT.inflateDur < BT.nearMissStart, 'all card balloons are full before the gag');
  assert.ok(coverClearAt(popAt(1)) <= 4.7, 'the last card is fully revealed by 4.7 s');
  // The wave and the giggle start in the hold, a good quarter-second before the dip and the lift-off.
  assert.ok(BT.dipStart - BT.waveStart >= .15 && BT.exitStart - BT.waveStart >= .25 && BT.giggleStart < BT.dipStart);
  assert.ok(BT.exitEnd >= 4.85 && BT.exitEnd <= 4.9 && BT.exitEnd <= BT.duration - .1);
  assert.ok(popAt(1) + (BT.confettiMin + BT.confettiJitter) <= BT.duration - .03, 'the last confetti is gone before the end');
});

void test('pops ripple outwards exactly as the sneeze ring passes each balloon', () => {
  assert.equal(popAt(0), BT.popStart);
  assert.ok(close(popAt(1), BT.popStart + BT.popSpread, 1e-12));
  assert.equal(popAt(2), popAt(1), 'distance is clamped');
  for (let d = 0; d < 1; d += .01) assert.ok(popAt(d + .01) > popAt(d));
  const scenes = [...VIEWPORTS.map(([width, height]) => focalFor({ width, height })), ...Object.keys(LAYOUTS).map((name) => focalFor(LAYOUTS[name], rectsOf(name)))];
  for (const scene of scenes) {
    const R = ringMaxRadius(scene);
    for (const [cx, cy] of [[0, 0], [scene.width, 0], [0, scene.height], [scene.width, scene.height]]) assert.ok(Math.hypot(cx - scene.fx, cy - scene.fy) <= R + 1e-9, 'the ring reaches every corner');
    for (const [fx, fy] of [[.5, .46], [.1, .15], [.9, .2], [.3, .8], [.62, .5], [0, 1], [1, 1]]) {
      const x = scene.width * fx;
      const y = scene.height * fy;
      const distance = Math.hypot(x - scene.fx, y - scene.fy);
      const radius = ringRadius(popAt(focusDistance(x, y, scene)), scene);
      assert.ok(close(radius, distance, .5), `${scene.width}x${scene.height} (${fx}, ${fy}): ring ${radius.toFixed(2)} vs ${distance.toFixed(2)}`);
    }
    for (let t = BT.popStart; t < BT.popStart + BT.popSpread; t += .01) assert.ok(ringRadius(t + .01, scene) > ringRadius(t, scene));
    assert.equal(ringRadius(BT.popStart - .1, scene), 0);
    assert.equal(ringRadius(5, scene), R);
  }
  const standard = focalFor({ width: 1280, height: 800 });
  assert.ok(close(ringMaxRadius(standard), Math.hypot(640, 800 * .54), 1e-9), 'centred focal point: the bottom corners are farthest');
});

void test('the focal point: centred, smaller on short screens, and in the empty slot beside an incomplete last row', () => {
  const standard = focalFor({ width: 1280, height: 800 });
  assert.deepEqual([standard.fx, standard.fy, standard.scale], [640, 800 * FOCAL.y, 1]);
  const short = focalFor({ width: 1100, height: 700 });
  assert.ok(Math.min(1100, 700) < SHORT_VIEWPORT && short.scale === SHORT_SCALE && short.fy === 350);
  for (const name of ['g4', 'g8', 'g12', 'g1', 'g5', 'g6hd', 'rot5', 'g8hd']) {
    const focal = focalFor(LAYOUTS[name], rectsOf(name));
    assert.equal(emptySlot(rectsOf(name), LAYOUTS[name], focal.scale), null, `${name}: full rows keep the centred focal point`);
    assert.equal(focal.fx, LAYOUTS[name].width / 2);
  }
  for (const name of ['g4s960', 'g5s960', 'g7', 'g4p']) {
    const scene = sceneOf(name);
    const rects = rectsOf(name);
    const lastTop = Math.max(...rects.map((rect) => rect.top));
    const lastRight = Math.max(...rects.filter((rect) => rect.top === lastTop).map((rect) => rect.left + rect.width));
    assert.ok(scene.fx > lastRight && scene.fy > lastTop, `${name}: he hovers in the empty slot (${scene.fx.toFixed(0)}, ${scene.fy.toFixed(0)})`);
    // While he hovers, his body is clear of every card and his whole rig stays on screen.
    const v = vmin(scene) * scene.scale;
    for (const t of [2, 2.5, 3.2]) {
      const box = rigScreenBox(t, scene);
      assert.ok(box.bottom < scene.height - 70 && box.top > HEADER_PX * .5 && box.right < scene.width, `${name} at ${t}: rig on screen`);
      const face = facePx(balloonPose(t), scene);
      for (const rect of rects) {
        const nearestX = Math.max(rect.left, Math.min(face.x, rect.left + rect.width));
        const nearestY = Math.max(rect.top, Math.min(face.y, rect.top + rect.height));
        assert.ok(Math.hypot(face.x - nearestX, face.y - nearestY) > 9 * v, `${name} at ${t}: his body is off the cards`);
      }
    }
  }
});

void test('card focus runs from the focal point to the farthest corner, with a unit direction', () => {
  for (const [width, height] of VIEWPORTS) {
    const scene = focalFor({ width, height });
    const centreAt = (x: number, y: number) => coverFocus({ left: x - 50, top: y - 40, width: 100, height: 80 }, scene);
    const focal = centreAt(scene.fx, scene.fy);
    assert.ok(focal.distance < 1e-9);
    assert.equal(focal.dx, 0);
    assert.equal(focal.dy, 0);
    const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => centreAt(x, y).distance);
    assert.ok(close(Math.max(...corners), 1, 1e-9));
    assert.equal(centreAt(-500, height * 2).distance, 1);
    for (const [x, y] of [[10, 10], [width - 20, 300], [width / 2, height - 5], [width * .3, height * .47]]) {
      const focus = centreAt(x, y);
      assert.ok(close(Math.hypot(focus.dx, focus.dy), 1, 1e-9));
      assert.ok(focus.dx * (scene.fx - x) >= 0 && focus.dy * (scene.fy - y) >= 0, 'points towards the hedgehog');
    }
  }
});

void test('card shapes and layouts keep every balloon on its own card', () => {
  const expected: Record<string, string> = { '289x637': 'tall', '293x917': 'tall', '289x308': 'box', '289x231': 'box', '392x308': 'box', '1217x637': 'box', '1860x917': 'box', '286x258': 'box', '269x76': 'strip', '181x90': 'strip', '600x520': 'box' };
  for (const [width, height] of CARDS) {
    const shape = coverShape(width, height);
    assert.equal(shape, expected[`${width}x${height}`], `${width}x${height}`);
    for (let variant = 0; variant < 8; variant++) {
      const layout = coverLayout(width, height, variant);
      assert.equal(layout.bunches.length, shape !== 'strip' && width >= TWIN_BUNCH_MIN_WIDTH ? 2 : 1);
      for (const bunch of layout.bunches) {
        const [hero, left, right] = bunch.balloons;
        assert.ok(hero.hero && !left.hero && !right.hero);
        assert.notEqual(hero.color, 'yellow', 'the white ? always has contrast');
        assert.ok(close(hero.centre.y, height * HERO_Y[shape], 1e-9));
        assert.ok(left.centre.x < hero.centre.x && right.centre.x > hero.centre.x, 'companions flank the hero');
        for (const balloon of bunch.balloons) {
          const half = balloon.width / 2;
          assert.ok(balloon.centre.x - half >= -1 && balloon.centre.x + half <= width + 1, `${width}x${height} v${variant}: balloon inside the card horizontally`);
          assert.ok(balloon.centre.y - .62 * balloon.width >= -1, `${width}x${height}: balloon top inside the card`);
          assert.ok(balloon.knot.y > balloon.centre.y && balloon.knot.y <= balloon.anchor.y + 1e-9, 'strings hang from the knot down to the anchor');
          assert.ok(balloon.anchor.y <= height + 1e-9);
        }
        if (shape === 'strip') assert.equal(bunch.bow, null);
        else assert.ok(bunch.bow && bunch.bow.y < height && bunch.bow.y > hero.knot.y);
      }
      if (layout.bunches.length === 2) {
        const [a, b] = layout.bunches.map((bunch) => bunch.balloons);
        assert.ok(a[2].centre.x + a[2].width / 2 < b[1].centre.x - b[1].width / 2, 'twin bunches do not overlap');
        assert.notEqual(a[0].color, b[0].color);
      }
    }
  }
});

void test('the paper tears into small scraps at every card size, covering the whole card and flying away from the hedgehog', () => {
  for (const [width, height] of CARDS) {
    const layout = coverLayout(width, height, 1);
    const focus = { dx: .6, dy: -.8 };
    const shards = paperShards(layout, focus);
    const [cols, rows] = shardGrid(layout);
    assert.equal(shards.length, cols * rows);
    assert.deepEqual(paperShards(layout, focus), shards, 'deterministic');
    if (layout.shape === 'strip') assert.deepEqual([cols, rows], [3, 1]);
    else {
      assert.ok(cols >= 2 && rows >= 2 && cols <= SHARD_MAX.cols && rows <= SHARD_MAX.rows);
      // Pieces are about SHARD_SIZE unless the grid is capped (then as small as the cap allows).
      assert.ok(width / cols <= Math.max(SHARD_SIZE.width * 1.5, width / SHARD_MAX.cols) + 1e-9 && height / rows <= Math.max(SHARD_SIZE.height * 1.5, height / SHARD_MAX.rows) + 1e-9, `${width}x${height}: ${cols}x${rows}`);
    }
    for (let x = 0; x <= width; x += width / 17) {
      for (let y = 0; y <= height; y += height / 13) {
        assert.ok(shards.some((s) => x >= s.left - 1e-6 && x <= s.left + s.width + 1e-6 && y >= s.top - 1e-6 && y <= s.top + s.height + 1e-6), `(${x}, ${y}) covered`);
      }
    }
    for (const shard of shards) {
      assert.ok(shard.left >= -1e-9 && shard.top >= -1e-9 && shard.left + shard.width <= width + 1e-9 && shard.top + shard.height <= height + 1e-9);
      assert.ok(Number.isFinite(shard.tx) && Number.isFinite(shard.ty) && Math.abs(shard.rot) <= 62 && Math.abs(shard.rot) >= 28);
      const piece = layout.shape === 'strip' ? layout.size : Math.sqrt(shard.width * shard.height);
      assert.ok(Math.hypot(shard.tx, shard.ty) <= 2 * piece, 'each scrap travels about its own size');
      assert.ok(shard.points.length >= 4);
      for (const [x, y] of shard.points) assert.ok(x >= shard.left - 6 && x <= shard.left + shard.width + 6 && y >= shard.top - 6 && y <= shard.top + shard.height + 6, 'outline stays near its tile');
    }
    assert.ok(shards.reduce((sum, s) => sum - s.tx * focus.dx - s.ty * focus.dy, 0) > 0, 'on average they are blown away from the hedgehog');
  }
  // The single big team card no longer cracks into six slabs.
  const big = coverLayout(1217, 637, 0);
  assert.deepEqual(shardGrid(big), [6, 4]);
  for (const shard of paperShards(big, { dx: 0, dy: -1 })) assert.ok(shard.width <= 215 && shard.height <= 170 && Math.hypot(shard.tx, shard.ty) <= 360);
});

void test('the heart balloon sinks onto the long prickle, dents on its tip, then boings back home', () => {
  const tips = quillTipsRig(balloonPose(1.2));
  const lengths = tips.map((tip) => Math.hypot(tip.x, tip.y - QUILLS.cy * HOG_SCALE));
  assert.equal(lengths.indexOf(Math.max(...lengths)), QUILLS.long, 'one prickle is clearly longer');
  let closest = Infinity;
  let closestAt = 0;
  for (let t = 1.3; t <= 2.15; t += .001) {
    const pose = balloonPose(t);
    const tip = heartTip(pose);
    const quills = quillTipsRig(pose);
    const distance = Math.hypot(quills[QUILLS.long].x - tip.x, quills[QUILLS.long].y - tip.y);
    if (distance < closest) { closest = distance; closestAt = t; }
    quills.forEach((quill, index) => { if (index !== QUILLS.long) assert.ok(Math.hypot(quill.x - tip.x, quill.y - tip.y) > 20, `only the long prickle is touched (${index} at ${t.toFixed(3)})`); });
  }
  assert.ok(closest >= 2 && closest <= 8, `the tip sits right on the prickle: ${closest.toFixed(2)}u`);
  assert.ok(closestAt >= BT.nearMissKiss - .02 && closestAt <= BT.nearMissRelease + .01, `closest at ${closestAt.toFixed(3)} s`);
  const kiss = balloonPose(BT.nearMissKiss + .045);
  assert.ok(kiss.heartSy <= .87 && kiss.heartSx > 1, 'the heart dents on the prickle');
  assert.ok(close(kiss.heartDx, KISS.dx, .5) && close(kiss.heartDy, KISS.dy, .5));
  assert.ok(kiss.eyeScale >= 1.3 && kiss.mouth === 'o' && kiss.brows > .9, 'a big take');
  assert.ok(Math.max(...[1.79, 1.8, 1.82, 1.84].map((t) => balloonPose(t).quills)) >= 1.1, 'his quills bristle');
  assert.ok(Math.min(...[1.8, 1.81, 1.83].map((t) => balloonPose(t).swing)) <= -4, 'he flinches away');
  const rest = balloonPose(1.2);
  assert.ok(close(heartTip(rest).y, HEART.y + Math.cos(HEART.rot * Math.PI / 180) * HEART.tip, 20), 'heart starts in the bunch');
  for (const t of [BT.nearMissEnd, 2.3, 3]) {
    const pose = balloonPose(t);
    assert.ok(Math.abs(pose.heartDx) <= .5 && Math.abs(pose.heartDy) <= .5 && Math.abs(pose.heartRot) <= .5 && pose.heartSy === 1, `heart home at ${t}`);
  }
});

void test('the feather rests on his nose through the countdown, clear of his eyes and mouth, then is blown away', () => {
  const outline = featherOutline();
  for (let t = BT.featherLand; t < BT.sneezeAt; t += .005) {
    const pose = balloonPose(t);
    const nose = noseAnchor(pose);
    assert.ok(Math.hypot(pose.featherX - nose.x, pose.featherY - nose.y) <= 1, `feather on nose at ${t.toFixed(3)}`);
    assert.equal(pose.featherSize, 1);
    const a = pose.featherRot * Math.PI / 180;
    const inFace = outline.map(({ x, y }) => {
      const mirrored = { x: -x, y };
      const rig = { x: pose.featherX + mirrored.x * Math.cos(a) - mirrored.y * Math.sin(a), y: pose.featherY + mirrored.x * Math.sin(a) + mirrored.y * Math.cos(a) };
      const hog = rigToHog(rig, pose);
      return { x: hog.x, y: hog.y + pose.head };
    });
    const mouth = ahMouth(pose.mouth === 'ah' ? pose.mouthOpen : 0);
    for (const p of inFace) {
      assert.ok(((p.x / mouth.rx) ** 2 + ((p.y - mouth.cy) / mouth.ry) ** 2) > 1, `feather clear of the mouth at ${t.toFixed(3)} (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
      for (const side of [-1, 1]) {
        const rx = EYE_SIZE.rx * pose.eyeScale * .8;
        const ry = EYE_SIZE.ry * pose.eyeScale * .8;
        assert.ok(((p.x - side * EYE_HOG.x) / rx) ** 2 + ((p.y - EYE_HOG.y) / ry) ** 2 > 1, `feather clear of the eye at ${t.toFixed(3)}`);
      }
    }
  }
  const before = balloonPose(BT.featherLand - 1e-6);
  const landed = balloonPose(BT.featherLand);
  assert.ok(Math.hypot(before.featherX - landed.featherX, before.featherY - landed.featherY) < 1, 'no jump when it lands');
  const gone = balloonPose(4.0);
  const sneeze = noseAnchor(balloonPose(BT.sneezeAt));
  assert.ok(Math.hypot(gone.featherX - sneeze.x, gone.featherY - sneeze.y) > 150);
  // It pops into being as it starts to drift and shrinks away when it is blown off: its size, never a fade.
  assert.equal(gone.featherSize, 0);
  assert.equal(balloonPose(FEATHER_GONE).featherSize, 0);
  assert.equal(balloonPose(1).featherSize, 0);
  assert.ok(balloonPose(BT.featherStart + .09).featherSize > 1 && balloonPose(BT.featherStart + .2).featherSize === 1, 'pops in with a little overshoot');
  let size = 1;
  for (let t = BT.sneezeAt; t <= 4.05; t += .01) {
    const next = balloonPose(t).featherSize;
    assert.ok(next <= size + 1e-9, `the blown-away feather only shrinks (${t.toFixed(2)})`);
    size = next;
  }
});

void test('each "ah" is bigger than the last, then CHOO snaps him forward and down', () => {
  const peaks = [BT.ah1Peak, BT.ah2Peak, BT.ah3Peak].map(balloonPose);
  for (const key of ['lift', 'tilt', 'sy', 'nose', 'lid', 'mouthOpen', 'browLift'] as const) {
    assert.ok(peaks[0][key] < peaks[1][key] && peaks[1][key] < peaks[2][key], `${key} escalates: ${peaks.map((pose) => pose[key].toFixed(2)).join(' < ')}`);
  }
  assert.ok(peaks[2].tilt >= 9.5 && peaks[2].sy >= 1.15 && peaks[2].lift >= 2.9, 'a real rear-back on AH3');
  assert.ok(ahMouth(peaks[2].mouthOpen).ry >= 14 && ahMouth(peaks[2].mouthOpen).ry <= 16, 'big oval mouth on AH3');
  assert.ok(peaks[1].nose >= 1.15 && peaks[2].nose >= 1.25, 'nostrils flare');
  const choo = balloonPose(3.64);
  assert.ok(choo.tilt < -2 && choo.sy < .95 && choo.lift < 0, 'snaps forward, squashes and dips on CHOO');
  assert.ok(peaks.every((pose) => pose.eyes === 'half' && pose.mouth === 'ah' && pose.browWorry > .7));
});

void test('the goodbye: he waves clear of his face and giggles while he hangs, dips, then is whisked off', () => {
  // The wave is up and swinging well before the dip; the paw swings outwards, away from his face.
  const shoulder = { x: -45, y: 36 };
  for (let t = BT.waveStart + .04; t <= BT.exitEnd; t += .01) {
    const pose = balloonPose(t);
    const paw = rotateAbout({ x: pose.armEx, y: pose.armEy }, shoulder, pose.armWave);
    assert.ok(paw.x <= -60 || Math.hypot(paw.x, paw.y + 4) >= 62, `paw clear of his face at ${t.toFixed(2)} (${paw.x.toFixed(0)}, ${paw.y.toFixed(0)})`);
    assert.ok(paw.y < 0, 'the paw is up');
  }
  const swings = [];
  for (let t = BT.waveStart; t < BT.dipStart; t += .01) swings.push(balloonPose(t).armWave);
  assert.ok(Math.max(...swings) - Math.min(...swings) >= 1.6 * WAVE.swing, 'a full back-and-forth wave before the dip');
  assert.equal(balloonPose(BT.giggleStart + .05).eyes, 'happy');
  assert.equal(balloonPose(BT.giggleStart + .05).mouth, 'laugh');
  assert.ok(balloonPose(BT.lookUpStart + .06).lookY < -3, 'he checks his balloons first');
  // The dip (anticipation), then the yank upwards: an ease-in that is still fast when he leaves the screen.
  const hang = balloonPose(BT.dipStart);
  const dip = balloonPose(4.38);
  assert.ok(dip.lift <= hang.lift - 2 && dip.sy < .96, 'dips and squashes before lift-off');
  assert.ok(balloonPose(4.47).sy > 1.04, 'stretches on the yank');
  for (let p = 0; p < 1; p += .05) assert.ok(exitEase(p + .05) > exitEase(p) || p === 0);
  assert.ok(exitEase(.5) < .35 && exitEase(1) === 1 && (exitEase(1) - exitEase(.95)) / .05 >= 1.3, 'lingers first, leaves fast');
  // He floats away into the distance: his size shrinks steadily from the hang size to EXIT_SCALE of it.
  let size = balloonPose(BT.exitStart).rigScale;
  assert.equal(size, 1);
  for (let t = BT.exitStart + .02; t <= BT.exitEnd + 1e-9; t += .02) {
    const next = balloonPose(t).rigScale;
    assert.ok(next <= size + 1e-9, `shrinking at ${t.toFixed(2)}`);
    size = next;
  }
  assert.ok(close(size, EXIT_SCALE, 1e-9) && EXIT_SCALE <= .65, `ends at ${size.toFixed(2)} of his hang size`);
});

void test('after the sneeze he hangs where every name stays readable, then the balloons carry him off the top', () => {
  // Unconstrained screens: straight up, at the preferred height.
  for (const [width, height] of VIEWPORTS) {
    const scene = sceneFor({ width, height });
    assert.ok(rigScreenBox(0, scene).top > height, `${width}x${height}: hidden below at the start`);
    const face = facePx(balloonPose(BT.sneezeAt), scene);
    assert.ok(close(face.x, scene.fx, 1) && close(face.y, scene.fy, 1), `${width}x${height}: sneeze at the focal point`);
    // Blown up (straight up where there is room under the header, otherwise less high and a little aside).
    const hang = facePx(balloonPose(4.26), scene);
    const up = (scene.fy - hang.y) / vmin(scene);
    const aside = Math.abs(hang.x - scene.fx) / vmin(scene);
    assert.ok(up >= 3 && up <= HANG_LIFT_VMIN + 1.2 && aside <= 6 && Math.hypot(up, aside) >= HANG_MIN_BLOWN_VMIN - .8, `${width}x${height}: blown ${up.toFixed(1)} vmin up, ${aside.toFixed(1)} aside`);
    if (height > width) assert.ok(close(up, HANG_LIFT_VMIN, 1.2) && aside < .1, `${width}x${height}: a portrait screen has room to blow him straight up`);
    for (let t = HOLD_FROM; t <= BT.exitStart + 1e-9; t += .01) {
      for (const circle of silhouette(t, scene)) assert.ok(circle.y - circle.r >= HEADER_PX, `${width}x${height} at ${t.toFixed(2)}: balloons in full view`);
    }
    assert.ok(rigScreenBox(BT.exitEnd, scene).bottom < 0, `${width}x${height}: gone above the top by ${BT.exitEnd} s`);
    const settled = rigScreenBox(2.5, scene);
    assert.ok(settled.top > HEADER_PX * .5 && settled.bottom < height, `${width}x${height}: whole rig on screen while he hovers`);
  }
  // Measured screens: from 3.85 s until the exit is under way, no part of him (balloons, heart, body, feet, paw,
  // hat) touches any name, title or label, and his body stays between the header and the footer.
  for (const name of ROOMY) {
    const scene = sceneOf(name);
    const texts = textsOf(name);
    assert.equal(hangOverlap(scene, texts), 0, `${name}: hang overlap`);
    for (let t = HANG_CHECK_FROM; t <= HANG_CHECK_TO + 1e-9; t += .025) {
      for (const circle of silhouette(t, scene)) {
        for (const text of texts) assert.equal(textOverlap(circle.x, circle.y, circle.r, text), 0, `${name} at ${t.toFixed(3)}: covers text at ${text.left},${text.top}`);
        assert.ok(circle.x - circle.r >= -1 && circle.x + circle.r <= scene.width + 1 && circle.y + circle.r <= scene.height - FOOTER_PX + 9, `${name} at ${t.toFixed(3)}: on screen`);
        if (!circle.bunch) assert.ok(circle.y - circle.r >= HEADER_PX, `${name} at ${t.toFixed(3)}: his body is below the header`);
      }
    }
    // While he holds still and waves (3.95 s until the exit), his balloons are in full view too, not sliced by
    // the header (on the one-team card he used to hang with the red balloon and the star half under it).
    for (let t = HOLD_FROM; t <= BT.exitStart + 1e-9; t += .01) {
      for (const circle of silhouette(t, scene)) assert.ok(circle.y - circle.r >= HEADER_PX, `${name} at ${t.toFixed(2)}: a balloon is under the header (top ${(circle.y - circle.r).toFixed(0)})`);
    }
    // The hang is a real move: blown clear of the sneeze spot, tumbling away from us.
    const at = facePx(balloonPose(4.26), scene);
    assert.ok(Math.hypot(at.x - scene.fx, at.y - scene.fy) >= 5 * vmin(scene), `${name}: blown at least 5 vmin`);
    assert.ok((HANG_SCALES as readonly number[]).includes(scene.hangScale));
    assert.ok(rigScreenBox(BT.exitEnd, scene).bottom < 0, `${name}: off the top by ${BT.exitEnd} s`);
    // The exit lane is the one that crosses names for the shortest time.
    const chosen = exitCrossing(scene, texts);
    for (const drift of EXIT_DRIFTS) {
      const other = { ...scene, exitDrift: drift * scene.side };
      const endX = scene.fx + scene.hangX + other.exitDrift * vmin(scene);
      if (endX < scene.width * .04 || endX > scene.width * .96 || hangOverlap(other, texts) > 0) continue;
      assert.ok(chosen.time <= exitCrossing(other, texts).time + 1e-9, `${name}: drift ${scene.exitDrift} vs ${other.exitDrift}`);
    }
  }
  // On the way out he crosses names for at most about 80 ms on every lab screen (the day table included):
  // he shrinks into the distance over the empty spot, drifts into the clearest lane, then zips up.
  for (const name of Object.keys(LAYOUTS)) {
    const scene = sceneOf(name);
    const texts = textsOf(name);
    let over = 0;
    for (let t = BT.exitStart; t <= BT.exitEnd + 1e-9; t += .005) {
      if (silhouette(t, scene).some((circle) => circle.y + circle.r >= HEADER_PX && texts.some((text) => textOverlap(circle.x, circle.y, circle.r, text) > 0))) over += .005;
    }
    assert.ok(over <= .08 + 1e-9, `${name}: over names for ${(over * 1000).toFixed(0)} ms on the way out`);
    assert.ok(close(rigScaleOf(balloonPose(BT.exitEnd), scene), scene.scale * scene.hangScale * EXIT_SCALE, 1e-9));
    const end = facePx(balloonPose(BT.exitEnd), scene);
    assert.ok(end.x > 0 && end.x < scene.width, `${name}: leaves through the top`);
  }
  // The day table (crowded): the least-covering spot, far better than straight up.
  for (const name of ['rot5']) {
    const scene = sceneOf(name);
    const texts = textsOf(name);
    const straightUp = { ...scene, ...hangAt(scene, 0, -HANG_LIFT_VMIN * vmin(scene), HANG_SCALES[0]) };
    assert.ok(hangOverlap(scene, texts) * 20 < hangOverlap(straightUp, texts), `${name}: ${hangOverlap(scene, texts).toFixed(1)} vs ${hangOverlap(straightUp, texts).toFixed(1)}`);
  }
  // Without readable text (likely name zones instead), a tall-card screen still finds a clear spot.
  const zoned = sceneFor(LAYOUTS.g6hd, rectsOf('g6hd'));
  assert.ok(Number.isFinite(zoned.hangX) && Number.isFinite(zoned.hangY) && Number.isFinite(zoned.exitRise));
  // Leaving: once the exit is under way he only ever rises.
  for (const name of ['g4', 'g6hd', 'g12']) {
    const scene = sceneOf(name);
    let last = Infinity;
    for (let t = 4.5; t <= BT.exitEnd; t += .01) {
      const y = facePx(balloonPose(t), scene).y;
      assert.ok(y <= last + .5, `${name}: rising at ${t.toFixed(2)}`);
      last = y;
    }
  }
  // Rising in at the start: monotonic up until the overshoot, then settle.
  const scene = sceneFor({ width: 1280, height: 800 });
  let last = Infinity;
  for (let t = BT.riseStart; t <= 1.3; t += .01) {
    const y = facePx(balloonPose(t), scene).y;
    assert.ok(y <= last + 1.3, `rises at ${t.toFixed(2)}`);
    last = y;
  }
});

void test('the first frame gets a provisional scene; the searched hang changes nothing until the sneeze', () => {
  for (const name of Object.keys(LAYOUTS)) {
    const provisional = provisionalScene(LAYOUTS[name], rectsOf(name));
    const searched = sceneOf(name);
    assert.deepEqual([provisional.fx, provisional.fy, provisional.scale], [searched.fx, searched.fy, searched.scale], `${name}: the ring and the confetti keep their focal point`);
    assert.equal(provisional.hangX, 0);
    assert.ok(close(provisional.hangY, -HANG_LIFT_VMIN * vmin(provisional), 1e-9), `${name}: provisionally blown straight up`);
    // Swapping in the searched hang a couple of frames in is invisible: the hang only shows from the sneeze.
    for (let t = 0; t <= BT.sneezeAt + 1e-9; t += .05) {
      const pose = balloonPose(t);
      assert.deepEqual(facePx(pose, provisional), facePx(pose, searched), `${name} at ${t.toFixed(2)}`);
      assert.equal(rigScaleOf(pose, provisional), rigScaleOf(pose, searched));
    }
  }
});

void test('finding the hang spot is quick enough to run at mount', () => {
  for (const name of Object.keys(LAYOUTS)) {
    const started = performance.now();
    sceneOf(name);
    const ms = performance.now() - started;
    assert.ok(ms < 80, `${name}: ${ms.toFixed(1)} ms`);
  }
});

void test('every pose value is finite and the tracks are continuous', () => {
  let previous = balloonPose(0);
  for (let t = 0; t <= BT.duration; t += .004) {
    const pose = balloonPose(t);
    for (const [key, value] of Object.entries(pose)) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${key} at ${t.toFixed(3)}`);
    for (const key of ['lift', 'featherX', 'featherY', 'heartDx', 'heartDy', 'hatLift', 'armEx', 'armEy', 'armWave', 'tilt', 'browLift'] as const) {
      assert.ok(Math.abs(pose[key] - previous[key]) < 12, `${key} jumps at ${t.toFixed(3)} (${previous[key]} -> ${pose[key]})`);
    }
    assert.ok(Math.abs(pose.rise - previous.rise) < .05 && Math.abs(pose.exit - previous.exit) < .05 && Math.abs(pose.recoil - previous.recoil) < .05 && Math.abs(pose.shrink - previous.shrink) < .05);
    previous = pose;
  }
  assert.equal(balloonPose(BT.sneezeAt - .01).eyes, 'squeeze');
  assert.ok(balloonPose(3.7).puffSize === 1 && balloonPose(PUFF_GONE).puffSize === 0 && balloonPose(4.2).puffSize === 0);
  assert.ok(balloonPose(3.8).sparkleSize === 1 && balloonPose(SPARKLES_GONE).sparkleSize === 0);
  assert.ok(balloonPose(3.8).hatLift > 40 && balloonPose(4.3).hatLift === 0);
  assert.ok(balloonPose(3.6).recoil === 0 && close(balloonPose(4.3).recoil, 1, .02) && balloonPose(4.3).shrink === 1);
  for (let t = 0; t <= 1; t += .01) {
    const value = spline(t, [[0, 0], [.4, 1], [.6, 1], [1, 3]]);
    assert.ok(value >= 0 && value <= 3 && (t < .4 || t > .6 || close(value, 1, 1e-9)));
  }
});

void test('the rig paints on the Web Animation clock, so his face, body, ring and pops arrive together on a slow machine', () => {
  type Fake = { attributes: Map<string, string>; classes: Set<string>; animations: FakeAnimation[] } & Record<string, unknown>;
  type FakeAnimation = { currentTime: number | null; playState: string; cancelled: boolean; cancel(): void };
  const frames: ((now: number) => void)[] = [];
  const g = globalThis as unknown as { requestAnimationFrame: (callback: (now: number) => void) => number; cancelAnimationFrame: (id: number) => void };
  const saved = { raf: g.requestAnimationFrame, caf: g.cancelAnimationFrame };
  g.requestAnimationFrame = (callback) => frames.push(callback);
  g.cancelAnimationFrame = () => { frames.length = 0; };
  const element = (): Fake => {
    const fake: Fake = { attributes: new Map(), classes: new Set(), animations: [] };
    Object.assign(fake, {
      setAttribute: (name: string, value: string) => fake.attributes.set(name, value),
      classList: { add: (name: string) => fake.classes.add(name) },
      animate: () => { const animation: FakeAnimation = { currentTime: null, playState: 'pending', cancelled: false, cancel() { this.cancelled = true; } }; fake.animations.push(animation); return animation; },
    });
    return fake;
  };
  const names = ['rig', 'strings', 'bunch', 'heart', 'body', 'feather', 'hat', 'eyeSqueeze1', 'eyeOpen1', 'stringPath', 'puff', 'cloud0', 'sparkle0'];
  const fakes = new Map(names.map((name) => [name, element()]));
  try {
    const player = playRig(fakes as unknown as Map<string, Element>, sceneFor({ width: 1280, height: 800 }));
    const rig = fakes.get('rig')!.animations[0];
    const layers = ['strings', 'bunch', 'heart', 'body', 'feather'].map((name) => fakes.get(name)!.animations[0]);
    assert.ok(rig && layers.every(Boolean), 'the rig and its five layers run as Web Animations');
    const frame = (rigMs: number | null, now: number) => {
      rig.currentTime = rigMs;
      rig.playState = rigMs === null ? 'pending' : rigMs >= BALLOON_DURATION_MS ? 'finished' : 'running';
      const callbacks = frames.splice(0);
      for (const callback of callbacks) callback(now);
      return callbacks.length;
    };
    const hat = () => fakes.get('hat')!.attributes.get('transform');
    const hatAt = (t: number) => { const pose = balloonPose(t); return `translate(0 ${(-pose.hatLift).toFixed(1)}) rotate(${pose.hatRot.toFixed(1)} 3 -86)`; };
    // Still pending (first frame not drawn yet), even though the wall clock has moved on: pose 0.
    frame(null, 400);
    assert.equal(hat(), hatAt(0));
    // A slow machine: the wall clock says 3.9 s but the animations (and the covers) are at 3.58 s.
    frame(3580, 3900);
    assert.equal(fakes.get('eyeSqueeze1')!.attributes.get('display'), 'inline', 'squeeze eyes exactly when the body animation is at 3.58 s');
    assert.equal(hat(), hatAt(3.58), 'the hat has not flown before the body snaps');
    frame(3800, 4100);
    assert.equal(hat(), hatAt(3.8));
    assert.equal(fakes.get('eyeSqueeze1')!.attributes.get('display'), 'none', 'eyes open again after the sneeze, on the same clock');
    assert.equal(fakes.get('eyeOpen1')!.attributes.get('display'), 'inline');
    // The sneeze clouds and sparkles leave by shrinking, never by fading.
    const pose = balloonPose(3.8);
    assert.match(fakes.get('cloud0')!.attributes.get('transform') ?? '', new RegExp(`scale\\(${(1.2 * Math.round(pose.puffSize * 50) / 50).toFixed(3)}\\)`));
    assert.match(fakes.get('sparkle0')!.attributes.get('transform') ?? '', /scale\(/);
    for (const name of ['puff', 'sparkle0', 'cloud0']) assert.ok(!fakes.get(name)!.attributes.has('opacity'), `${name} never fades`);
    // The strings are redrawn in their own layer, snapped to half units (a held pose writes nothing new).
    const strings = fakes.get('stringPath')!.attributes.get('d') ?? '';
    assert.ok(strings.length > 0 && (strings.match(/-?\d+(\.\d+)?/g) ?? []).every((value) => Number.isInteger(Number(value) * 2)), strings);
    // Once he is off the top of the screen the loop stops (the confetti runs without script), and stop() cancels every animation.
    assert.ok(PAINT_END_MS >= BT.exitEnd * 1000 && PAINT_END_MS <= BALLOON_DURATION_MS - 300);
    assert.equal(frame(PAINT_END_MS - 30, 9000), 1);
    assert.equal(frames.length, 1, 'still painting just before he is gone');
    assert.equal(frame(PAINT_END_MS, 9030), 1);
    assert.equal(frames.length, 0, 'no frame is requested once he is off the screen');
    player.stop();
    assert.ok(rig.cancelled && layers.every((animation) => animation.cancelled));
  } finally {
    g.requestAnimationFrame = saved.raf;
    g.cancelAnimationFrame = saved.caf;
  }
  // And in the source: the loop reads the rig animation's currentTime.
  const loop = tsx.slice(tsx.indexOf('export function playRig('), tsx.indexOf('/** The hedgehog\'s body art'));
  assert.match(loop, /rig \? rig\.currentTime : now - started/);
  // The strings layer rides on the bunch's own keyframes, is drawn behind the balloons, and holds only the strings.
  assert.match(tsx, /layerTrackCache = \{ strings: bunch, bunch,/);
  const rigMarkup = tsx.slice(tsx.indexOf('<div className="bp-rig"'));
  assert.ok(rigMarkup.indexOf("refTo('strings')") < rigMarkup.indexOf("refTo('bunch')"));
  assert.match(rigMarkup, /refTo\('bunch'\)}>\s*<svg viewBox=\{RIG_VIEWBOX\}><BunchBalloons \/><\/svg>/);
});

void test('the reveal joins the clock of the click (the sound\'s) on its first frame, cards and rig together', () => {
  type FakeAnimation = { animationName?: string; startTime: number | null; effect: { target: unknown } };
  const cover = { getAnimations: (): FakeAnimation[] => [] };
  const child = {};
  const anim = (animationName: string | undefined, target: unknown): FakeAnimation => ({ animationName, startTime: 77, effect: { target } });
  const early = ['bp-inflate', 'bp-hop', 'bp-q-out', 'bp-grow', 'bp-bow-in', 'bp-sway', 'bp-bob'].map((name) => anim(name, child));
  const late = anim('bp-pull', child);
  const rigAnimations = [anim(undefined, {}), anim(undefined, {}), undefined];
  const g = globalThis as unknown as { document?: unknown };
  const saved = g.document;
  try {
    g.document = { querySelectorAll: () => [cover] };
    cover.getAnimations = () => [...early, late];
    assert.equal(startOnClock(1234, rigAnimations as unknown as Animation[]), true);
    assert.ok([...early, ...rigAnimations.filter(Boolean) as FakeAnimation[]].every((animation) => animation.startTime === 1234), 'the rig and every early card animation start at the click');
    assert.equal(late.startTime, 77, 'late ones are armed on the rig clock later, never moved here');
    // An engine that cannot list a card's children: nothing moves (the rig must never part from the cards).
    const again = early.map((animation) => ({ ...animation, startTime: 5 }));
    const rigAgain = [anim(undefined, {})];
    cover.getAnimations = () => [anim('bp-air', cover)];
    assert.equal(startOnClock(999, rigAgain as unknown as Animation[]), false);
    assert.ok(rigAgain[0].startTime === 77 && again.every((animation) => animation.startTime === 5));
  } finally {
    g.document = saved;
  }
  // The stage records the click's time on the same clock (the document timeline) and hands it to the rig.
  assert.match(tsx, /const \[origin\] = useState\(revealOrigin\);/);
  assert.match(tsx, /document\.timeline\?\.currentTime/);
  assert.match(tsx, /const start = typeof timeline === 'number' \? Math\.max\(origin!, timeline - MAX_START_SKIP_MS\) : origin!;\s*if \(rig\.playState !== 'paused' && lazySupported\(\)\) startOnClock\(start, \[rig, \.\.\.animations\.layers\]\);/);
  assert.ok(MAX_START_SKIP_MS >= 250 && MAX_START_SKIP_MS <= 1000, 'it never skips the hedgehog\'s arrival, however slow the first frame');
});

void test('late animations do not exist until the rig clock arms them, then run exactly on its start time', () => {
  // CSS: every animation that only moves late subtracts an arm time and is switched off until its group is armed;
  // early ones (inflate, string and bow grow-ins, sway, bob, hop, the paper "?") run from the start.
  const gates = rules().filter(([selector, declarations]) => /\[data-lazy\]/.test(selector) && /animation: none !important/.test(declarations));
  for (const [selector, declarations] of gates) assert.match(declarations, /^\s*animation: none !important;\s*$/, selector);
  // The arm times sit in variables from the start (only where the rig arms them), so arming restyles only the gated pieces.
  assert.match(rule('.bp-cover[data-lazy]'), new RegExp(`--bp-ti: ${INHALE_ARM_MS}ms; --bp-tp: ${popArmMs(DEFAULT_POP_MS)}ms;`));
  assert.match(tsx, /'--bp-tp': `\$\{popArmMs\(firstPop\)\}ms`/);
  assert.match(tsx, /const armedAt = \(ms: number\): Vars => \(lazySupported\(\) \? \{ '--bp-t0': `\$\{ms\}ms` \} : \{\}\);/);
  // Pieces that stay invisible until they are armed are not laid out at all (no layer of their own over a moving balloon).
  const hidden = rules().filter(([selector, declarations]) => /\[data-lazy\]:not/.test(selector) && /^\s*display: none;\s*$/.test(declarations))
    .flatMap(([selector]) => selector.split(',').map((part) => part.trim()));
  for (const piece of ['.bp-air', '.bp-shards']) assert.ok(hidden.some((part) => part.endsWith(` ${piece}`)), `${piece} is not laid out until it is armed`);
  const gateLeaves = (variable: string) => {
    const group = { '--bp-ti': ':not([data-inhale])', '--bp-tp': ':not([data-pop])', '--bp-t0': ':not([data-live])' }[variable]!;
    return gates.flatMap(([selector]) => selector.split(',').map((part) => part.trim()))
      .filter((part) => part.includes(group)).map((part) => part.split(/\s+/).at(-1)!.replace(':not([data-live])', ''));
  };
  const leafOf = (selector: string) => selector.split(/\s+/).at(-1)!.replace(/\.is-[a-z]+/g, '');
  const late = rules().filter(([selector, declarations]) => !/\[data-lazy\]/.test(selector) && /animation:/.test(declarations) && /var\(--bp-t[ip0]/.test(declarations));
  assert.ok(late.length >= 12, `${late.length} late rules`);
  for (const [selector, declarations] of late) {
    const variable = /var\((--bp-t[ip0]), 0ms\)/.exec(declarations)![1];
    assert.ok(gateLeaves(variable).some((gate) => leafOf(gate) === leafOf(selector)), `${selector} is only created once ${variable} is armed`);
  }
  for (const [selector, declarations] of rules()) {
    if (!/animation:/.test(declarations) || /animation: none/.test(declarations)) continue;
    if (/var\(--bp-pop\)|\b2620ms|\b3660ms/.test(declarations)) assert.match(declarations, /- var\(--bp-t[ip0], 0ms\)/, `${selector}: a late delay subtracts its arm time`);
  }
  for (const early of ['.bp-b-inflate', '.bp-sway', '.bp-hop', '.bp-paper-q > b', '.bp-string', '.bp-bow', '.bp-b.is-hero .bp-b-bob']) {
    assert.doesNotMatch(rule(early), /var\(--bp-t[ip0]/, `${early} runs from the start`);
  }
  assert.match(css, /\.bp-cover\[data-done\] \{ display: none; \}/);
  assert.match(tsx, /const lazy = lazySupported\(\);[\s\S]*className="bp-cover"[^>]*data-lazy=\{lazy \? '' : undefined\}/);
  assert.match(tsx, /className="bp-stage" data-lazy=\{lazySupported\(\) \? '' : undefined\}/);
  assert.match(tsx, /className="bp-ring" data-arm-at=\{RING_ARM_MS\}/);
  assert.match(tsx, /const armAt = Math\.min\(\.\.\.pieces\.map\(\(piece\) => piece\.delayMs\)\) - ARM_LEAD_MS;\s*return <div key=\{target\.index\} className="bp-bits" data-arm-at=\{armAt\} style=\{armedAt\(armAt\)\}>/);
  assert.match(tsx, /animationDelay: `calc\(\$\{piece\.delayMs\}ms - var\(--bp-t0, 0ms\)\)`/);
  // The pop pieces are still added after the first frame (that frame stays light).
  for (const piece of ['<CoverShards', 'className="bp-burst"', 'className="bp-qfly"']) {
    const at = tsx.indexOf(piece);
    assert.ok(at > 0 && /\blate &&/.test(tsx.slice(at - 60, at)), `${piece} is added after the first frame`);
  }
  assert.match(tsx, /const late = useAfterFirstFrame\(LATE_FRAMES \+ 1\);\s*const cards = late \?/);

  // Arm times: 200 ms before each group first moves.
  assert.equal(ARM_LEAD_MS, 200);
  assert.equal(INHALE_ARM_MS, BT.ah1 * 1000 - ARM_LEAD_MS);
  assert.equal(RING_ARM_MS, BT.popStart * 1000 - ARM_LEAD_MS);
  assert.equal(popArmMs(3800), 3800 - BT.popSquash * 1000 - ARM_LEAD_MS);
  assert.equal(DEFAULT_POP_MS, 3910);
  assert.match(rule('.bp-cover'), new RegExp(`--bp-pop: ${DEFAULT_POP_MS}ms`), 'the armer and the CSS agree on an unmeasured card');
  assert.ok(ARM_SCANS[ARM_SCANS.length - 1] <= popArmMs(Math.round(BT.popStart * 1000)) - 30, 'every look happens before the first pops are armed');
  assert.ok(SELF_ARM_MS > popArmMs(Math.round(popAt(1) * 1000)) + 400 && SELF_ARM_MS < BALLOON_DURATION_MS - 300, 'a card only arms itself well after the stage should have');

  // The armer, with a fake document: covers, the ring and a confetti group.
  type FakeAnimation = { animationName: string; startTime: number | null };
  type FakeNode = {
    attributes: Map<string, string>; vars: Map<string, string>; dataset: Record<string, string>; animations: FakeAnimation[];
    hasAttribute(name: string): boolean; setAttribute(name: string, value: string): void; style: { setProperty(name: string, value: string): void };
    getAnimations(options?: { subtree: boolean }): FakeAnimation[];
  };
  const node = (dataset: Record<string, string>, groups: Record<string, string[]>): FakeNode => {
    const fake: FakeNode = {
      attributes: new Map(), vars: new Map(), dataset, animations: [],
      hasAttribute: (name) => fake.attributes.has(name),
      setAttribute: (name, value) => {
        fake.attributes.set(name, value);
        // Arming a group creates its CSS animations (as the next style flush would).
        for (const animationName of groups[name] ?? []) fake.animations.push({ animationName, startTime: null });
      },
      style: { setProperty: (name, value) => fake.vars.set(name, value) },
      getAnimations: () => fake.animations,
    };
    // Early animations exist from the start and are never touched.
    fake.animations.push({ animationName: 'bp-inflate', startTime: 111 }, { animationName: 'bp-sway', startTime: 111 });
    return fake;
  };
  const INHALE = ['bp-pull', 'bp-lean', 'bp-air'];
  const POPS = ['bp-pop', 'bp-burst', 'bp-shard', 'bp-drop', 'bp-out'];
  const coverGroups = { 'data-inhale': INHALE, 'data-pop': POPS };
  const named = (fake: FakeNode, names: string[]) => fake.animations.filter((animation) => names.includes(animation.animationName));
  const near = node({ popAt: '3700', clearAt: '4090' }, coverGroups);
  const far = node({ popAt: '4100', clearAt: '4490' }, coverGroups);
  const unmeasured = node({}, coverGroups);
  const ring = node({ armAt: String(RING_ARM_MS) }, { 'data-live': ['bp-ring'] });
  const bits = node({ armAt: '3500' }, { 'data-live': ['bp-confetti', 'bp-confetti'] });
  const g = globalThis as unknown as { document?: unknown };
  const saved = g.document;
  let stageNodes: FakeNode[] = [ring];
  g.document = { querySelectorAll: (selector: string) => (selector.startsWith('.bp-cover') ? [near, far, unmeasured] : stageNodes) };
  const RIG = 10_000;
  try {
    const arm = revealArmer();
    arm.tick(0, RIG, false);
    // The confetti group mounts a few frames late and is found at the next look.
    stageNodes = [ring, bits];
    arm.tick(INHALE_ARM_MS - 1, RIG, false);
    for (const fake of [ring, bits]) assert.equal(fake.attributes.size, 0, 'nothing on the stage is armed before the inhale');
    for (const cover of [near, far, unmeasured]) assert.deepEqual([...cover.attributes.keys()], ['data-settled'], 'the cards have only settled (their early animations are removed)');
    arm.tick(INHALE_ARM_MS + 3.4, RIG, false);
    for (const cover of [near, far, unmeasured]) {
      assert.ok(cover.attributes.has('data-inhale') && !cover.attributes.has('data-pop'), 'every card arms its inhale at once');
      assert.equal(cover.vars.size, 0, 'arming only sets an attribute (the arm times are already in the CSS)');
      assert.equal(named(cover, INHALE).length, 3);
      for (const animation of named(cover, INHALE)) assert.equal(animation.startTime, RIG + INHALE_ARM_MS, 'each new animation runs on the rig start time plus its arm time');
      assert.deepEqual(named(cover, ['bp-inflate', 'bp-sway']).map((animation) => animation.startTime), [111, 111], 'early animations are left alone');
    }
    const pulled = named(near, ['bp-pull'])[0].startTime;
    arm.tick(3430, RIG, false);
    assert.ok(near.attributes.has('data-pop') && near.vars.size === 0, 'the near card pops at 3.7 s, so it is armed 280 ms before');
    assert.ok(named(near, POPS).every((animation) => animation.startTime === RIG + popArmMs(3700)), 'on its arm time, even when the frame came a little late');
    assert.equal(named(near, ['bp-pull'])[0].startTime, pulled, 'arming the pops never moves the inhale');
    assert.ok(!far.attributes.has('data-pop') && !ring.attributes.has('data-live') && !bits.attributes.has('data-live'));
    arm.tick(3470, RIG, false);
    assert.ok(ring.attributes.has('data-live') && ring.vars.size === 0 && named(ring, ['bp-ring'])[0].startTime === RIG + RING_ARM_MS);
    assert.ok(!bits.attributes.has('data-live'));
    arm.tick(3500, RIG, false);
    assert.ok(bits.attributes.has('data-live') && named(bits, ['bp-confetti']).every((animation) => animation.startTime === RIG + 3500));
    arm.tick(DEFAULT_POP_MS - 281, RIG, false);
    assert.ok(!unmeasured.attributes.has('data-pop'));
    arm.tick(DEFAULT_POP_MS - 280, RIG, false);
    assert.ok(unmeasured.attributes.has('data-pop'), 'an unmeasured card pops with the CSS default');
    arm.tick(4100 - 280, RIG, false);
    assert.ok(far.attributes.has('data-pop'));
    arm.tick(4090, RIG, false);
    assert.ok(near.attributes.has('data-done') && !far.attributes.has('data-done'), 'a card is taken away once all its pieces have gone');
    arm.tick(4490, RIG, false);
    assert.ok(far.attributes.has('data-done') && unmeasured.attributes.has('data-done'));

    // A card that armed itself (no stage) is never armed again (its animations would jump).
    const self = node({ popAt: '3800', clearAt: '4190' }, coverGroups);
    self.attributes.set('data-pop', '');
    self.vars.set('--bp-tp', '4760ms');
    g.document = { querySelectorAll: (selector: string) => (selector.startsWith('.bp-cover') ? [self] : []) };
    revealArmer().tick(4000, RIG, false);
    assert.equal(self.vars.get('--bp-tp'), '4760ms');

    // A frozen review frame: everything due is armed from the reveal's start (the reviewer seeks each animation
    // itself), it looks every frame, and nothing is moved onto a start time.
    const frozenCover = node({ popAt: '3700', clearAt: '4090' }, coverGroups);
    const frozenBits = node({ armAt: '3500' }, { 'data-live': ['bp-confetti'] });
    let mounted: FakeNode[] = [];
    g.document = { querySelectorAll: (selector: string) => (selector.startsWith('.bp-cover') ? [frozenCover] : mounted) };
    const review = revealArmer();
    review.tick(3950, null, true);
    assert.ok(frozenCover.attributes.has('data-inhale') && frozenCover.attributes.has('data-pop') && !frozenCover.attributes.has('data-done'));
    assert.equal(frozenCover.vars.get('--bp-tp'), '0ms');
    assert.ok(named(frozenCover, POPS).every((animation) => animation.startTime === null), 'the reviewer seeks them');
    mounted = [frozenBits];
    review.tick(3950, null, true);
    assert.ok(frozenBits.attributes.has('data-live'), 'confetti mounting a frame later is still armed before the frame is seeked');

    // A resize moves a card's pops: the next look reads the new time.
    const moving = node({ popAt: '3700', clearAt: '4090' }, coverGroups);
    g.document = { querySelectorAll: (selector: string) => (selector.startsWith('.bp-cover') ? [moving] : []) };
    const resized = revealArmer();
    resized.tick(0, RIG, false);
    moving.dataset.popAt = '3900';
    resized.rescan();
    resized.tick(3500, RIG, false);
    assert.ok(!moving.attributes.has('data-pop'), 'armed for the new pop time, not the old one');
    resized.tick(3620, RIG, false);
    assert.ok(moving.attributes.has('data-pop'));
  } finally {
    g.document = saved;
  }
  assert.ok(QFLY_RISE <= .5 && QFLY_DX > 0, 'the "?" hops up and to the right, away from the names');
  assert.ok(HANG_SEARCH_FRAMES >= 1 && HANG_SEARCH_FRAMES <= 3, 'the hang spot is searched for right after the first frame');
});

void test('confetti stays within budget, is deterministic and bursts from each popping hero', () => {
  for (let n = 1; n <= 48; n++) {
    assert.ok(confettiPerCard(n) * n <= CONFETTI_BUDGET, `${n} cards: ${confettiPerCard(n) * n} pieces`);
    assert.ok(confettiPerCard(n) >= (isDense(n) ? 2 : 4));
  }
  assert.ok(!isDense(15) && isDense(DENSE_COVERS) && DENSE_COVERS <= 24, 'a 5x3 day table keeps the full cover; 8x3 and up go lean');
  for (const [width, height] of [[1280, 800], [960, 680], [1920, 1080]] as const) {
    const scene = focalFor({ width, height });
    const target = { left: 24, top: 74, width: 289, height: 637, index: 0 };
    const pieces = cardConfetti(target, 4, scene);
    assert.deepEqual(cardConfetti(target, 4, scene), pieces);
    assert.equal(pieces.length, confettiPerCard(4));
    const layout = coverLayout(target.width, target.height, target.index);
    const focus = coverFocus(target, scene);
    const hero = heroPopPoint(layout, focus);
    const [pop] = bunchPopTimes(target, layout, scene, focus);
    for (const piece of pieces) {
      assert.ok(close(piece.x, target.left + hero.x, 1e-9) && close(piece.y, target.top + hero.y, 1e-9));
      assert.equal(piece.delayMs, Math.round(pop * 1000));
      assert.ok(piece.delayMs + piece.durationMs <= BALLOON_DURATION_MS - 30);
      assert.ok(Math.hypot(piece.bx, piece.by) <= 1.4 * 200);
    }
  }
});

void test('each balloon pops when the ring reaches it, and the paper tears with the first pop', () => {
  for (const [width, height] of VIEWPORTS) {
    const scene = focalFor({ width, height });
    for (const [cardWidth, cardHeight] of CARDS) {
      for (const [left, top] of [[20, 70], [width / 2 - cardWidth / 2, height * .46 - cardHeight / 2], [width - cardWidth - 20, height - cardHeight - 80]]) {
        const rect = { left, top, width: cardWidth, height: cardHeight };
        const layout = coverLayout(cardWidth, cardHeight, 2);
        const focus = coverFocus(rect, scene);
        const pops = bunchPopTimes(rect, layout, scene, focus);
        pops.forEach((pop, bunch) => {
          const hero = heroPopPoint(layout, focus, bunch);
          const distance = Math.hypot(left + hero.x - scene.fx, top + hero.y - scene.fy);
          if (distance < ringMaxRadius(scene)) assert.ok(close(ringRadius(pop, scene), distance, .5));
          assert.ok(pop >= BT.popStart && pop <= BT.popStart + BT.popSpread);
          assert.ok(coverClearAt(pop) <= 4.7);
        });
        const pull = pullOffset(focus);
        assert.ok(Math.abs(pull.x) <= PULL_STOPS[PULL_STOPS.length - 1].max && Math.abs(pull.y) <= PULL_STOPS[PULL_STOPS.length - 1].max);
      }
    }
  }
  assert.ok(COVER_TAIL > 0 && COVER_TAIL < .5);
});

void test('the inhale draws in only the balloons: the paper never moves, so nothing under it can show', () => {
  // Only the balloon layer (and the balloons inside it) carries the pull and the lean.
  for (const [selector, declarations] of rules()) {
    if (/\bbp-pull\b/.test(declarations)) assert.equal(selector, '.bp-float', `${selector} must not carry the pull`);
    if (/\bbp-lean\b/.test(declarations)) assert.match(selector, /\.bp-lean|\.bp-b-lean/, `${selector} must not carry the lean`);
    if (/bp-paper\b/.test(selector) && !/bp-paper-q/.test(selector)) {
      assert.doesNotMatch(declarations, /\btranslate|\bbp-pull|\bbp-hop|\bbp-lean/, `${selector} never slides`);
    }
  }
  assert.doesNotMatch(rule('.bp-paper'), /transform/);
  // The dense-table paper puffs out a touch, then collapses to nothing where it is: it never slides and never fades.
  const puff = keyframes('bp-paper-puff');
  for (const [, declarations] of puff) assert.doesNotMatch(declarations, /translate|opacity/);
  assert.match(puff.get(100) ?? '', /transform: scale\(0\)/);
  // In the cover markup, the paper and its "?" come before the balloon layer opens (so they are not inside it).
  const cover = tsx.slice(tsx.indexOf('function BalloonCover('));
  const paper = cover.indexOf('className="bp-paper"');
  const float = cover.indexOf('className="bp-float"');
  assert.ok(paper > 0 && float > paper && cover.indexOf('className="bp-paper-q"') < float, 'paper sits outside .bp-float');
  assert.equal(cover.split('className="bp-float"').length, 2);
  // Balloon pull at every stop is bounded; the paper offset is zero at every stop.
  for (const stop of PULL_STOPS) {
    const pull = pullOffset({ targetX: 900, targetY: -900 }, stop);
    assert.ok(Math.abs(pull.x) <= stop.max && Math.abs(pull.y) <= stop.max);
  }
});

void test('the inflate never shows a see-through balloon: the "?" is sucked in, strings shoot up and bows pop in', () => {
  // No group fade over the balloons: each balloon is opaque within a few frames of its own inflate.
  assert.doesNotMatch(css, /bp-fade-in/, 'nothing fades in');
  const inflate = keyframes('bp-inflate');
  const opaqueAt = [...inflate.entries()].filter(([, declarations]) => /opacity: 1/.test(declarations)).map(([stop]) => stop).sort((a, b) => a - b)[0];
  assert.match(inflate.get(0) ?? '', /opacity: 0/);
  assert.ok(opaqueAt * BT.inflateDur * 10 <= 40, `opaque ${opaqueAt}% into the inflate`);
  // Each string grows from the bow to its knot as its balloon starts to fill; the bow pops in with the first balloon.
  assert.match(rule('.bp-string'), /bp-grow 160ms ease-out calc\(var\(--bp-in\) \+ var\(--i\) \* 60ms\) both/);
  assert.match(rule('.bp-bow'), /bp-bow-in 240ms ease-out var\(--bp-in\) both/);
  for (const name of ['bp-grow', 'bp-bow-in']) {
    const frames = keyframes(name);
    assert.match(frames.get(0) ?? '', /transform: scale\(0\)/);
    for (const [, declarations] of frames) assert.doesNotMatch(declarations, /opacity/);
  }
  // Grow-in and drop-away live on different elements (one animation each, so both stay on the compositor).
  const balloonMarkup = tsx.slice(tsx.indexOf('function CoverBalloonView('), tsx.indexOf('function Bow('));
  assert.match(balloonMarkup, /<div className="bp-strand"><svg className="bp-string"/);
  assert.match(tsx.slice(tsx.indexOf('function Bow(')), /<div className="bp-bow-drop"[^>]*>\s*<svg className="bp-bow"/);
  // The paper "?" slides towards the balloon's own "?" and shrinks to nothing within 60 ms.
  assert.ok(BT.questionOut <= .06);
  const out = keyframes('bp-q-out');
  assert.match(out.get(100) ?? '', /^ transform: translate\(-50%, -50%\) translate\(var\(--qx, 0px\), var\(--qy, 0px\)\) scale\(0\); $/);
  assert.match(tsx, /'--qx': `\$\{\(\(knot\.x - centre\.x\) \* QUESTION_SUCK\)/);
});

void test('nothing solid ever fades away: every piece leaves by popping, shrinking or flying off', () => {
  // Exits on the cards and the stage animate their size, never their opacity, and end at nothing.
  for (const name of ['bp-pop', 'bp-burst', 'bp-qfly', 'bp-shard', 'bp-drop', 'bp-confetti', 'bp-paper-puff', 'bp-q-out']) {
    const frames = keyframes(name);
    for (const [stop, declarations] of frames) assert.doesNotMatch(declarations, /opacity/, `${name} ${stop}% fades`);
    assert.match(frames.get(100) ?? '', /scale\(0(, 0)?\)/, `${name} ends at nothing`);
  }
  // Before they start, the pop pieces are hidden by their size too (not by opacity).
  for (const selector of ['.bp-burst', '.bp-qfly', '.bp-shard', '.bp-confetto']) {
    assert.match(rule(selector), /transform: scale\(0\)/, selector);
    assert.doesNotMatch(rule(selector), /opacity/, selector);
  }
  // The pop itself is a squash, then gone within a frame.
  const pop = keyframes('bp-pop');
  const squash = Math.round(BT.popSquash / BT.popDur * 100);
  assert.match(pop.get(squash + 1) ?? '', /scale\(0, 0\)/);
  // The rig: the feather, the sneeze clouds and the sparkles shrink (painted sizes, no opacity on those layers).
  assert.match(tsx, /feather\.push\(\{ offset, transform: styles\.feather \}\)/);
  assert.doesNotMatch(tsx, /this\.attr\('(puff|sparkles|feather)', 'opacity'/);
  assert.doesNotMatch(rule('.bp-feather'), /opacity/);
  for (const [key, gone] of [['puffSize', PUFF_GONE], ['sparkleSize', SPARKLES_GONE]] as const) {
    let size = 1;
    for (let t = BT.sneezeAt; t <= gone + .02; t += .01) {
      const next = balloonPose(t)[key];
      assert.ok(next <= size + 1e-9, `${key} only shrinks (${t.toFixed(2)})`);
      size = next;
    }
    assert.equal(size, 0);
  }
  assert.ok(PUFF_GONE <= 4.05 && SPARKLES_GONE <= 4.1 && FEATHER_GONE <= 4.0, 'all of it is gone as he settles into his hang spot');
});

void test('balloons.css keyframes and delays match the timeline', () => {
  const ms = (seconds: number) => `${Math.round(seconds * 1000)}ms`;
  const inhale = BT.sneezeAt - BT.ah1;
  /** A late delay as written in the CSS: the beat time minus the arm time the rig's clock writes. */
  const armed = (delay: string, variable: string) => `calc\\(${delay} - var\\(${variable}, 0ms\\)\\)`;
  assert.match(rule('.bp-float'), new RegExp(`bp-pull ${ms(inhale)} ease-in-out ${armed(ms(BT.ah1), '--bp-ti')} both`));
  assert.match(rule('.bp-lean.is-group'), new RegExp(`bp-lean ${ms(inhale)} ease-in-out ${armed(ms(BT.ah1), '--bp-ti')} both`));
  assert.match(css, new RegExp(`\\.bp-air svg \\{[^}]*bp-air ${ms(inhale)} linear ${armed(ms(BT.ah1), '--bp-ti')} both`));
  const pull = keyframes('bp-pull');
  const lean = keyframes('bp-lean');
  const air = keyframes('bp-air');
  for (const stop of PULL_STOPS) {
    const percent = Math.round(pullStop(stop.t) * 100);
    assert.ok(close(pullStop(stop.t) * 100, percent, .2), `beat ${stop.t} lands on a whole percent`);
    const pullDeclaration = pull.get(percent);
    const leanDeclaration = lean.get(percent);
    assert.ok(pullDeclaration && leanDeclaration, `stop ${percent}% exists`);
    if (stop.f > 0) {
      assert.ok(pullDeclaration.includes(`clamp(-${stop.max}px, calc(var(--bp-tx, 0px) * ${String(stop.f).replace(/^0/, '')}), ${stop.max}px)`), `pull at ${percent}%`);
      assert.ok(pullDeclaration.includes(`clamp(-${stop.max}px, calc(var(--bp-ty, 0px) * ${String(stop.f).replace(/^0/, '')}), ${stop.max}px)`), `pull y at ${percent}%`);
    }
    assert.ok(leanDeclaration.includes(stop.lean ? `* ${stop.lean}deg` : 'rotate(0deg)'), `lean at ${percent}%: ${leanDeclaration}`);
  }
  // Air streaks: a gust at each inhale peak, invisible by each release.
  for (const t of [BT.ah1Peak, BT.ah2Peak]) assert.match(air.get(Math.round(pullStop(t) * 100)) ?? '', /opacity: 0/);
  for (const t of [BT.ah1Release, BT.ah2Release]) assert.match(air.get(Math.round(pullStop(t) * 100)) ?? '', /opacity: 0; transform: translateX\(0\)/);
  // The ring: drawn at a third of its size and scaled 0 -> 3 (linear, so it meets each balloon as it pops).
  assert.match(rule('.bp-ring'), new RegExp(`bp-ring ${ms(BT.popSpread)} linear ${armed(ms(BT.popStart), '--bp-t0')} forwards`));
  assert.match(rule('.bp-ring'), /opacity: 0; transform: scale\(0\)/);
  assert.match(tsx, /const RING_DRAW = 1 \/ 3;/);
  const ring = keyframes('bp-ring');
  assert.match(ring.get(0) ?? '', /opacity: 1; transform: scale\(0\)/);
  const late = ring.get(88) ?? '';
  assert.ok(Number(/opacity: ([\d.]+)/.exec(late)?.[1]) >= .85, 'the ring stays bright until it has passed the far cards');
  assert.match(ring.get(100) ?? '', /opacity: 0; transform: scale\(3\)/);
  assert.doesNotMatch(rule('.bp-ring'), /will-change/, 'layered only from just before the sneeze (when its animation is armed)');
  // Streaks are thin filled crescents (no strokes that grow with the ring), six of them.
  const streaks = tsx.slice(tsx.indexOf('const RING_STREAKS'), tsx.indexOf('\n', tsx.indexOf('const RING_STREAKS')));
  assert.equal((streaks.match(/\[\d+, \d+, [\d.]+\]/g) ?? []).length, 6);
  const ringMarkup = tsx.slice(tsx.indexOf('<div className="bp-ring"'), tsx.indexOf('</div>', tsx.indexOf('<div className="bp-ring"')));
  assert.doesNotMatch(ringMarkup, /stroke/);
  assert.match(rule('.bp-cover'), new RegExp(`--bp-in: calc\\(${ms(BT.inflateAt)} \\+ var\\(--reveal-order, \\.5\\) \\* ${ms(BT.inflateStagger)}\\)`));
  assert.match(rule('.bp-b-inflate'), new RegExp(`bp-inflate ${ms(BT.inflateDur)} .* calc\\(var\\(--bp-in\\) \\+ var\\(--i\\) \\* ${ms(BT.sideLag)}\\) both`));
  assert.match(rule('.bp-paper-q > b'), new RegExp(`bp-q-out ${ms(BT.questionOut)} ease-in var\\(--bp-in\\) both`));
  assert.match(rule('.bp-paper-q > b'), /transform: translate\(-50%, -50%\) scale\(0\);/, 'once sucked in, the paper "?" rests hidden');
  assert.match(rule('.bp-hop'), new RegExp(`bp-hop ${ms(BT.hopDur)} ease-in-out calc\\(var\\(--bp-in\\) \\+ ${ms(BT.hopDelay)}\\) both`));
  // Early animations fill (so a review frame can seek them) and end exactly at their element's resting style; once the
  // cards have settled they are removed, so they are not compositor layers for the rest of the reveal.
  for (const name of ['bp-inflate', 'bp-hop', 'bp-grow', 'bp-bow-in']) assert.match([...keyframes(name).values()].at(-1) ?? '', /transform: (scale\(1\)|none);/, name);
  assert.match(keyframes('bp-q-out').get(100) ?? '', /scale\(0\)/);
  const settled = rules().filter(([selector]) => /\[data-settled\]/.test(selector)).flatMap(([selector, declarations]) => (/^\s*animation: none;\s*$/.test(declarations) ? selector.split(',').map((part) => part.trim()) : []));
  for (const early of ['.bp-paper-q > b', '.bp-hop', '.bp-b-inflate', '.bp-string', '.bp-bow']) assert.ok(settled.includes(`.bp-cover[data-settled] ${early}`), `${early} is removed once the cards settle`);
  const lastEarly = BT.inflateAt + .15 + BT.inflateStagger + BT.hopDelay + BT.hopDur;
  assert.ok(SETTLE_ARM_MS / 1000 >= lastEarly + .03 && SETTLE_ARM_MS < INHALE_ARM_MS - 500, `settles after the last hop (${lastEarly.toFixed(2)} s, a twin card's second bunch)`);
  const tp = ' - var\\(--bp-tp, 0ms\\)';
  assert.match(rule('.bp-b-pop'), new RegExp(`bp-pop ${ms(BT.popDur)} linear calc\\(var\\(--bp-pop\\) - ${ms(BT.popSquash)} \\+ var\\(--i\\) \\* ${ms(BT.popLag)}${tp}\\) both`));
  assert.match(rule('.bp-burst'), new RegExp(`bp-burst ${ms(BT.burstDur)} linear calc\\(var\\(--bp-pop\\) \\+ var\\(--i\\) \\* ${ms(BT.popLag)}${tp}\\) forwards`));
  assert.match(rule('.bp-strand'), new RegExp(`bp-drop ${ms(BT.stringDrop)} linear calc\\(var\\(--bp-pop\\) \\+ var\\(--i\\) \\* ${ms(BT.popLag)}${tp}\\) forwards`));
  assert.match(rule('.bp-bow-drop'), new RegExp(`bp-drop ${ms(BT.stringDrop)} linear calc\\(var\\(--bp-pop\\)${tp}\\) forwards`));
  assert.match(rule('.bp-qfly'), new RegExp(`bp-qfly ${ms(BT.qflyDur)} linear calc\\(var\\(--bp-pop\\)${tp}\\) forwards`));
  assert.match(rule('.bp-paper'), new RegExp(`bp-out 1ms linear calc\\(var\\(--bp-pop\\) \\+ ${ms(BT.shardDelay)}${tp}\\) forwards`));
  assert.match(css, new RegExp(`\\.bp-shard \\{[^}]*bp-shard ${ms(BT.shardDur)} linear calc\\(var\\(--bp-pop\\) \\+ ${ms(BT.shardDelay)}${tp}\\) forwards`));
  const pop = keyframes('bp-pop');
  const squashStop = Math.round(BT.popSquash / BT.popDur * 100);
  assert.ok(pop.has(squashStop) && pop.has(squashStop + 1), `squash at ${squashStop}%`);
  assert.match(pop.get(squashStop + 1) ?? '', /scale\(0, 0\)/);
  for (const selector of ['.bp-burst', '.bp-qfly', '.bp-paper', '.bp-strand', '.bp-bow-drop', '.bp-shard']) assert.doesNotMatch(rule(selector), /\bboth\b/, `${selector} fills forwards only`);
  // Safari/WKWebView: no nesting, @property, offset-path or view transitions.
  assert.doesNotMatch(css, /@property|offset-path|view-transition|&\s*[.:[]|:has\(/);
});
