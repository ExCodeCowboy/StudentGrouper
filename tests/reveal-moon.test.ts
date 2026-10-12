import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { moonEffect } from '../src/revealEffects/moon';
import { MOON_COUNTDOWN_DIGITS, MOON_GLOBE_CRATERS } from '../src/revealEffects/moonArt';
import {
  FLAG_STRIPES, MOON_BAND_BOTTOM, MOON_BAND_TOP, MOON_BEATS, MOON_BOULDERS, MOON_CAPTIONS, MOON_CLOUD_CIRCLES, MOON_DAY_CLOUDS,
  MOON_DURATION_MS, MOON_DUST_SETTLE, MOON_FLAG_H, MOON_FLAG_POLE, MOON_FLAG_SCALE, MOON_FLAG_SPOT, MOON_FLAG_W, MOON_FLAG_WINDOWS,
  MOON_HOP_APEX, MOON_HOP_LANDING, MOON_IRIS_HOLD, MOON_LIFTOFF_OVERSHOOT, MOON_LIFTOFF_TEXT, MOON_LM_PADS, MOON_LM_PIVOT_Y, MOON_NEAR_FINAL, MOON_OVERLAY_MS,
  MOON_PAD_UNMOUNT, MOON_PREMOUNT, MOON_PREMOUNT_DONE, MOON_SKY_EARTH, PAD_Y, ROCKET_NOSE_LOCAL, flagStars, moonAstronaut, moonCamPoint, moonCaption, moonDepthScale, moonDust,
  moonFit, moonFlag, moonGroundDrop, moonHopLift, moonIris, moonIrisRadius, moonLanderPose, moonLaunchOverlay, moonLegs, moonNearCam,
  moonPadPuffs, moonRigScale, moonRigToScreen, moonRocketPose, moonSceneVisible, moonShake, moonStagePoses, moonStructureKey, moonToScreen,
  moonTwinkleSchedule, type MoonFit,
  MOON_DISC_FILL, MOON_DIVE_SWAP, MOON_GLINT_SIZE, MOON_GLINT_WORLD, MOON_HORIZON, MOON_PILE_POP, MOON_SMALL_PATH, MOON_SUN, MOON_WASH_OVERSCAN,
  RIG_ORIGIN, ROCKET_SIVB_MID_LOCAL, moonDive, moonGlobe, moonHorizonY, moonLmShadow, moonPadGlow, moonSpace,
  MOON_IRIS_SWELL, MOON_SUN_BLOOM, moonIrisCenter, moonIrisLift, moonIrisRimPad,
  MOON_ASTRO_EMERGE, MOON_LADDER_FOOT_GY, MOON_POP, moonAstroEmerge, moonHatch, moonPopLayout,
} from '../src/revealEffects/moonTimeline';

const css = readFileSync('src/revealEffects/moon.css', 'utf8');
const scene = readFileSync('src/revealEffects/moon.tsx', 'utf8');
/** Measured in the reveal lab: header 0–66 px, footer controls from H − 67 px. */
const HEADER_PX = 66;
const FOOTER_PX = 67;
const VIEWPORTS = [[960, 680], [1024, 768], [1280, 800], [1366, 768], [1440, 900], [1920, 1080], [2560, 1080], [1280, 536]] as const;
const SLICE_VIEWPORTS = [[960, 680], [1024, 768], [1280, 800], [1366, 768], [1920, 1080]] as const;
const FRAME = 1 / 60;
const times = (from: number, to: number, step: number) => { const out: number[] = []; for (let t = from; t <= to + 1e-9; t += step) out.push(Math.round(t * 1e6) / 1e6); return out; };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
/** One @keyframes block, braces matched. */
function keyframes(name: string) {
  const start = css.indexOf(`@keyframes ${name} {`);
  assert.ok(start >= 0, `@keyframes ${name}`);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
  }
  return '';
}
/** Top outline of each boulder (the two quadratic curves of its drawing), sampled. */
const BOULDER_PROFILE = MOON_BOULDERS.flatMap(([x, y, w, h]) => {
  const quad = (p0: number[], p1: number[], p2: number[], t: number) => [0, 1].map((i) => (1 - t) ** 2 * p0[i] + 2 * (1 - t) * t * p1[i] + t * t * p2[i]);
  return times(0, 1, .01).flatMap((t) => [quad([x - w / 2, y], [x - w / 2, y - h * .7], [x - w * .2, y - h], t), quad([x - w * .2, y - h], [x + w * .25, y - h * 1.05], [x + w / 2, y - h * .45], t)]);
});
/** Lowest LM parts (the four pads and the engine bell) in near-ground world units: [x0, x1, bottom y]. */
function landerBottoms(T: number) {
  const lm = moonLanderPose(T);
  const a = lm.r * Math.PI / 180;
  const at = (lx: number, ly: number) => ({ x: lm.x + lm.s * (lx * Math.cos(a) - (ly - MOON_LM_PIVOT_Y) * Math.sin(a)), y: lm.y + lm.s * (MOON_LM_PIVOT_Y + lx * Math.sin(a) + (ly - MOON_LM_PIVOT_Y) * Math.cos(a)) });
  return [...MOON_LM_PADS.map(([px, py]) => at(px, py + 5)), at(0, -58)].map((p) => [p.x - 26 * lm.s, p.x + 26 * lm.s, p.y] as const);
}
const clearance = (T: number) => Math.min(...landerBottoms(T).flatMap(([x0, x1, y]) => BOULDER_PROFILE.filter(([bx]) => bx >= x0 && bx <= x1).map(([, by]) => by - y)), Infinity);
const noseScreen = (fit: MoonFit, T: number) => {
  const p = moonRocketPose(T);
  const L = -ROCKET_NOSE_LOCAL * p.s;
  const a = p.rot * Math.PI / 180;
  const x = p.x + Math.sin(a) * L, y = p.y - Math.cos(a) * L;
  return T < 3.4 ? moonRigToScreen(fit, T, x, y) : moonToScreen(fit, x, y);
};

void test('moon keeps its id, sound and a 9.7 s duration under the 9.8 s cap', () => {
  assert.equal(moonEffect.id, 'moon');
  assert.equal(moonEffect.sound, 'moon');
  assert.equal(MOON_DURATION_MS, 9700);
  assert.ok(MOON_DURATION_MS <= 9800);
  assert.equal(moonEffect.durationMs, MOON_DURATION_MS);
  assert.equal(typeof moonEffect.Stage, 'function');
  assert.equal(typeof moonEffect.Cover, 'function');
});

void test('the story beats are strictly ordered and end inside the reveal', () => {
  const order = ['count3', 'count2', 'count1', 'liftoff', 'whipStart', 'whipEnd', 'sep1', 'sep2', 'glintCut', 'dive', 'hover', 'scoot', 'contact',
    'climb', 'step', 'hopStart', 'hopLand', 'plant', 'flagGlint', 'irisStart', 'hold', 'snap', 'closed', 'popEnd'] as const;
  assert.deepEqual(Object.keys(MOON_BEATS), [...order]);
  for (let i = 1; i < order.length; i++) assert.ok(MOON_BEATS[order[i - 1]] < MOON_BEATS[order[i]], `${order[i - 1]} before ${order[i]}`);
  assert.ok(MOON_BEATS.popEnd <= MOON_DURATION_MS / 1000);
});

void test('the countdown shows 3, 2, 1 only, 0.6 s apart, and LIFTOFF! lands on the next beat', () => {
  assert.deepEqual([...MOON_COUNTDOWN_DIGITS], [3, 2, 1]);
  const { delays, duration } = MOON_OVERLAY_MS.count;
  assert.deepEqual([...delays], [MOON_BEATS.count3, MOON_BEATS.count2, MOON_BEATS.count1].map((t) => Math.round(t * 1000)));
  for (let i = 1; i < delays.length; i++) {
    assert.ok(Math.abs(delays[i] - delays[i - 1] - 600) <= 50, 'a steady beat kids can shout along with');
    assert.ok(delays[i - 1] + duration <= delays[i], 'numerals never overlap');
  }
  const gap = MOON_BEATS.liftoff - MOON_BEATS.count1;
  assert.ok(gap >= .55 && gap <= .65);
  assert.equal(MOON_OVERLAY_MS.liftoff.delay, MOON_BEATS.liftoff * 1000);
  // CSS mirrors the same numbers: one numeral class per digit, nothing else.
  assert.deepEqual([...css.matchAll(/\.moon-count\.is-(\d) \{ animation-delay: (\d+)ms; \}/g)].map((m) => [Number(m[1]), Number(m[2])]), [[3, 150], [2, 750], [1, 1350]]);
  assert.deepEqual([...css.matchAll(/\.moon-count\.is-(\d)/g)].map((m) => m[1]).filter((d, i, a) => a.indexOf(d) === i), ['3', '2', '1']);
});

void test('no text in the reveal shows a 6 followed by a 7', () => {
  const texts = [...MOON_CAPTIONS.map(([, , text]) => text), 'LIFTOFF!', MOON_COUNTDOWN_DIGITS.join('')];
  for (const text of texts) assert.ok(!/6\D*7/.test(text), text);
  for (const [, , text] of MOON_CAPTIONS) assert.ok(!/\d/.test(text), `captions carry no numbers: ${text}`);
});

void test('every CSS overlay finishes inside the reveal and matches the timeline', () => {
  const expected: [string, number, number][] = [
    ['moon-beams', MOON_OVERLAY_MS.beams.duration, MOON_OVERLAY_MS.beams.delay],
    ['moon-liftoff', MOON_OVERLAY_MS.liftoff.duration, MOON_OVERLAY_MS.liftoff.delay],
    ['moon-glint', MOON_OVERLAY_MS.glint.duration, MOON_OVERLAY_MS.glint.delay],
    ['moon-shoot', MOON_OVERLAY_MS.shooting.duration, MOON_OVERLAY_MS.shooting.delays[0]],
    ['moon-flag-glint', MOON_OVERLAY_MS.flagGlint.duration, MOON_OVERLAY_MS.flagGlint.delay],
    ['moon-flag-star', MOON_OVERLAY_MS.flagStars.duration, MOON_OVERLAY_MS.flagStars.delay],
    ['moon-pop-star', MOON_OVERLAY_MS.popStars.duration, MOON_OVERLAY_MS.popStars.delay],
    ['moon-pop-burst', MOON_OVERLAY_MS.popBurst.duration, MOON_OVERLAY_MS.popBurst.delay],
    ['moon-pop-spark', MOON_OVERLAY_MS.popSparks.duration, MOON_OVERLAY_MS.popSparks.delay],
    ['moon-pop-ring', MOON_OVERLAY_MS.popRing.duration, MOON_OVERLAY_MS.popRing.delay],
  ];
  for (const [name, duration, delay] of expected) {
    assert.match(css, new RegExp(`animation: ${name} ${duration}ms ${delay}ms`), name);
    assert.ok(delay + duration <= MOON_DURATION_MS, `${name} ends by ${MOON_DURATION_MS} ms`);
  }
  assert.match(css, new RegExp(`animation-delay: ${MOON_OVERLAY_MS.shooting.delays[1]}ms`));
  assert.ok(MOON_OVERLAY_MS.shooting.delays[1] + MOON_OVERLAY_MS.shooting.duration <= MOON_DURATION_MS);
  const popEnd = Math.max(...[MOON_OVERLAY_MS.popBurst, MOON_OVERLAY_MS.popStars, MOON_OVERLAY_MS.popSparks, MOON_OVERLAY_MS.popRing].map((o) => o.delay + o.duration));
  // The POP bursts with the plop at 9.46 s, as the window snaps shut (the burst swallows its last frames).
  assert.ok(Math.min(MOON_OVERLAY_MS.popStars.delay, MOON_OVERLAY_MS.popBurst.delay) / 1000 >= MOON_BEATS.snap && MOON_OVERLAY_MS.popStars.delay / 1000 < MOON_BEATS.closed);
  assert.ok(near(popEnd / 1000, MOON_BEATS.popEnd, .001));
  // The glint peaks exactly on the sparkle-cut frame.
  assert.ok(near((MOON_OVERLAY_MS.glint.delay + MOON_OVERLAY_MS.glint.duration / 2) / 1000, MOON_BEATS.glintCut, .001));
  // Solid overlays pop away (scale 0) instead of fading.
  for (const name of ['moon-count', 'moon-liftoff', 'moon-glint', 'moon-flag-glint', 'moon-flag-star', 'moon-card-twinkle', 'moon-pop-star', 'moon-pop-burst', 'moon-pop-spark']) {
    assert.match(keyframes(name), /100% \{[^}]*scale\(0\)/, `${name} ends at scale 0`);
  }
});

void test('the fit is plain slice at 4:3 to 16:9 and keeps the action band clear of the header and footer', () => {
  for (const [w, h] of SLICE_VIEWPORTS) {
    const fit = moonFit(w, h);
    const k = Math.max(w / 1600, h / 900);
    assert.ok(near(fit.k, k) && near(fit.ox, (w - 1600 * k) / 2) && near(fit.oy, (h - 900 * k) / 2), `${w}×${h} is slice`);
  }
  for (const [w, h] of VIEWPORTS) {
    const fit = moonFit(w, h);
    const top = moonToScreen(fit, 0, MOON_BAND_TOP).y;
    const bottom = moonToScreen(fit, 0, MOON_BAND_BOTTOM).y;
    assert.ok(top >= HEADER_PX, `${w}×${h}: band top ${top.toFixed(1)} px below the header`);
    assert.ok(bottom <= h - FOOTER_PX, `${w}×${h}: band bottom ${bottom.toFixed(1)} px above the footer`);
    // The world always covers the whole screen (no empty bars).
    assert.ok(fit.oy <= 0 && fit.oy + 900 * fit.k >= h - 1e-6 || fit.k < Math.max(w / 1600, h / 900));
  }
  for (const [w, h] of [[2560, 1080], [1280, 536]] as const) {
    const fit = moonFit(w, h);
    assert.ok(moonToScreen(fit, 0, 90).y >= 70 - 1e-9 && moonToScreen(fit, 0, 800).y <= h - 70 + 1e-9, `${w}×${h} uses the band fit`);
  }
});

void test('the Saturn V nose never slides under the header, on the pad or in flight', () => {
  for (const [w, h] of VIEWPORTS) {
    const fit = moonFit(w, h);
    for (const T of times(0, MOON_BEATS.whipStart, .001)) assert.ok(noseScreen(fit, T).y >= 76, `${w}×${h} at ${T}: ${noseScreen(fit, T).y.toFixed(1)} px`);
    for (const T of times(MOON_BEATS.whipStart, MOON_BEATS.glintCut, .002)) assert.ok(noseScreen(fit, T).y >= 74, `${w}×${h} in flight at ${T}`);
  }
});

void test('the launch camera shakes only around liftoff and the ground falls away smoothly', () => {
  for (const T of times(0, .7, .001)) assert.deepEqual(moonShake(T), { x: 0, y: 0 });
  for (const T of times(3.4, 9.7, .01)) assert.deepEqual(moonShake(T), { x: 0, y: 0 });
  let peak = 0;
  for (const T of times(.7, 3.4, .001)) {
    const s = moonShake(T);
    assert.ok(Math.abs(s.x) <= 8 && Math.abs(s.y) <= 8);
    if (Math.abs(T - 2) < .08) peak = Math.max(peak, Math.hypot(s.x, s.y));
  }
  assert.ok(peak >= 6, 'the big jolt comes at release');
  assert.deepEqual(moonShake(1.77), moonShake(1.77), 'deterministic');
  assert.ok(near(moonRigScale(MOON_BEATS.liftoff), 1.03) && near(moonRigScale(MOON_BEATS.whipStart), .92) && near(moonRigScale(MOON_BEATS.whipEnd), 1));
  for (const T of times(0, MOON_BEATS.whipStart, .005)) assert.ok(PAD_Y - moonRocketPose(T).y <= 80 + 1, 'the rocket climbs at most 80 units on screen');
  let last = moonGroundDrop(0);
  for (const T of times(FRAME, MOON_PAD_UNMOUNT, FRAME)) {
    const G = moonGroundDrop(T);
    assert.ok(G >= last - 1e-9 && G - last <= 90, `drop step at ${T}`);
    last = G;
  }
});

void test('the day clouds and pad art have left the frame before the pad layer unmounts', () => {
  const cloudTop = Math.min(...MOON_CLOUD_CIRCLES.map(([, y, r]) => y - r));
  const T = MOON_PAD_UNMOUNT - .001;
  for (const [w, h] of VIEWPORTS) {
    const fit = moonFit(w, h);
    for (const [, y, width] of MOON_DAY_CLOUDS) {
      const top = moonRigToScreen(fit, T, 740, y + cloudTop * width / 200 + moonGroundDrop(T)).y;
      assert.ok(top >= h - FOOTER_PX, `${w}×${h}: day cloud at ${y} is under the footer (${top.toFixed(0)} px)`);
    }
    // The tower crane (world y 82 before the drop) is gone too.
    assert.ok(moonRigToScreen(fit, T, 600, 82 + 24 + moonGroundDrop(T)).y >= h - FOOTER_PX);
  }
});

void test('pad smoke never fades: puffs only grow and move, dust shrinks away', () => {
  const sizes = new Map<number, number>();
  for (const T of times(1.38, MOON_PAD_UNMOUNT - .001, .01)) {
    for (const puff of moonPadPuffs(T)) {
      assert.deepEqual(Object.keys(puff).sort(), ['flip', 'id', 's', 'shape', 'warm', 'x', 'y']);
      assert.ok(puff.s >= 0);
      assert.ok(puff.s >= (sizes.get(puff.id) ?? 0) - 1e-9, `puff ${puff.id} never shrinks`);
      sizes.set(puff.id, puff.s);
    }
  }
  assert.equal(moonPadPuffs(MOON_PAD_UNMOUNT).length, 0);
  for (const T of times(6.62, 7.8, .005)) for (const dust of moonDust(T, 800)) {
    assert.ok(dust.s >= 0);
    assert.ok(dust.age < MOON_DUST_SETTLE[1], 'dust has settled (scale 0) by its settle age');
  }
  assert.equal(moonDust(7.76, 800).length, 0);
});

void test('the Eagle hovers just over the boulders, scoots, and touches down gently', () => {
  assert.deepEqual(moonLanderPose(MOON_BEATS.glintCut), { x: 640, y: 530, s: .6, r: -16 });
  assert.deepEqual(moonLanderPose(MOON_BEATS.contact), { x: 800, y: 732, s: 1, r: 0 });
  // BOULDER FIELD!: a pad hangs just over the boulder pile (6–12 units), never in it, then it flies clear under manual control.
  const hover = Math.min(...times(MOON_BEATS.hover, MOON_BEATS.scoot, .005).map(clearance));
  assert.ok(hover >= 6 && hover <= 12, `hover clearance ${hover.toFixed(1)}`);
  for (const T of times(MOON_BEATS.hover, 6.9, .005)) assert.ok(clearance(T) >= 6, `no pad in the rocks at ${T}`);
  let prev = moonLanderPose(MOON_BEATS.glintCut);
  for (const T of times(MOON_BEATS.glintCut + FRAME, MOON_BEATS.contact, FRAME)) {
    const lm = moonLanderPose(T);
    assert.ok(Math.hypot(lm.x - prev.x, lm.y - prev.y) <= 12, `LM moves smoothly at ${T}`);
    assert.ok(Math.abs(lm.r) <= 16);
    if (T > 5.3) {
      const cam = moonNearCam(T);
      for (const dx of [-150 * lm.s, 150 * lm.s]) {
        const p = moonCamPoint(cam, lm.x + dx, lm.y);
        assert.ok(p.x >= 200 && p.x <= 1400, `LM on screen at ${T}`);
      }
    }
    prev = lm;
  }
  assert.equal(moonLegs(MOON_BEATS.contact).probe, 1);
  assert.equal(moonLegs(7.32).compress, 4.5);
  assert.equal(moonLegs(9).compress, 4.5);
});

void test('the astronaut hops toward the class, lands on his mark and grows naturally with depth', () => {
  assert.equal(moonDepthScale(752), 1);
  for (const T of times(MOON_BEATS.climb, 9.48, .002)) {
    const a = moonAstronaut(T);
    assert.ok(a.y <= a.gy + 1e-9, 'feet never below the ground line');
  }
  const mid = (MOON_BEATS.hopStart + MOON_BEATS.hopLand) / 2;
  assert.ok(near(moonHopLift(mid), MOON_HOP_APEX, 1e-6));
  const air = times(MOON_BEATS.hopStart, MOON_BEATS.hopLand + .1, .001).filter((T) => moonHopLift(T) > 0);
  assert.ok(air.at(-1)! - air[0] >= .42, 'floaty hang time');
  const land = moonAstronaut(MOON_BEATS.hopLand);
  assert.ok(near(land.x, MOON_HOP_LANDING.x, 1e-6) && near(land.gy, MOON_HOP_LANDING.gy, 1e-6));
  // About 216 px tall at 1280 × 800 in the finale.
  const fit = moonFit(1280, 800);
  const a = moonAstronaut(8.85);
  const height = 107 * a.s * MOON_NEAR_FINAL.z * fit.k;
  assert.ok(height >= 200, `astronaut ${height.toFixed(0)} px tall`);
});

void test('the flag moves on one continuous path: rail, glove, then ground', () => {
  const checks = [MOON_FLAG_WINDOWS.grab, MOON_FLAG_WINDOWS.plunge, [7.0, 9.4]] as const;
  for (const [from, to] of checks.slice(0, 2)) {
    let prev = moonFlag(from - FRAME).foot;
    for (const T of times(from, to + FRAME, FRAME / 4)) {
      const foot = moonFlag(T).foot;
      assert.ok(Math.hypot(foot.x - prev.x, foot.y - prev.y) <= 8 / 4, `flag steady at ${T}`);
      prev = foot;
    }
  }
  // Never a jump anywhere after it appears (the leap's takeoff carries it fast, but it never teleports).
  let prev = moonFlag(checks[2][0]).foot;
  for (const T of times(checks[2][0], checks[2][1], FRAME / 4)) {
    const foot = moonFlag(T).foot;
    assert.ok(Math.hypot(foot.x - prev.x, foot.y - prev.y) <= 30 / 4, `no teleport at ${T}`);
    prev = foot;
  }
  const planted = moonFlag(8.8);
  assert.equal(planted.mode, 'planted');
  assert.deepEqual(planted.foot, { x: MOON_FLAG_SPOT.x, y: MOON_FLAG_SPOT.gy });
  assert.equal(planted.pole, MOON_FLAG_POLE);
  assert.ok(planted.unfurl > .99);
  assert.equal(moonFlag(8.4).unfurl, 0, 'furled until it is planted');
  // The glove holds the pole while carrying it.
  for (const T of times(7.9, 8.5, .01)) {
    const astro = moonAstronaut(T);
    const flag = moonFlag(T);
    const hand = astro.pose.right[2];
    const world = { x: astro.x + hand.x * astro.s * astro.pose.sx, y: astro.y + hand.y * astro.s * astro.pose.sy };
    assert.ok(Math.hypot(world.x - flag.grip.x, world.y - flag.grip.y) <= 6, `glove on the pole at ${T}`);
  }
});

void test('the finale frames the whole LM, the astronaut, the flag and Earth', () => {
  const cam = moonNearCam(8.85);
  assert.deepEqual(cam, MOON_NEAR_FINAL);
  const lm = moonLanderPose(8.85);
  assert.ok(moonCamPoint(cam, lm.x, lm.y - 288).y >= 90, 'docking tunnel below the header band');
  assert.ok(moonCamPoint(cam, lm.x - 150 - 26, lm.y).x >= 200, 'left pad in frame');
  const a = moonAstronaut(8.85);
  const flagTop = MOON_FLAG_SPOT.gy - MOON_FLAG_POLE * MOON_FLAG_SCALE;
  const points = [
    moonCamPoint(cam, a.x - 40 * a.s, a.y - 130 * a.s), moonCamPoint(cam, a.x + 40 * a.s, a.gy),
    moonCamPoint(cam, MOON_FLAG_SPOT.x, MOON_FLAG_SPOT.gy), moonCamPoint(cam, MOON_FLAG_SPOT.x + (MOON_FLAG_W + 2) * MOON_FLAG_SCALE, flagTop),
    { x: MOON_SKY_EARTH.x - MOON_SKY_EARTH.r, y: MOON_SKY_EARTH.y - MOON_SKY_EARTH.r }, { x: MOON_SKY_EARTH.x + MOON_SKY_EARTH.r, y: MOON_SKY_EARTH.y + MOON_SKY_EARTH.r },
  ];
  for (const [w, h] of [[960, 680], [1280, 800], [1920, 1080]] as const) {
    const fit = moonFit(w, h);
    for (const p of points) {
      assert.ok(p.x >= 200 && p.x <= 1400 && p.y >= 90 && p.y <= 825, `(${p.x.toFixed(0)}, ${p.y.toFixed(0)}) in the band`);
      const s = moonToScreen(fit, p.x, p.y);
      assert.ok(s.x >= 0 && s.x <= w && s.y >= HEADER_PX && s.y <= h - FOOTER_PX, `${w}×${h}: on screen`);
    }
  }
  assert.equal(moonCaption(8.85), '', 'no caption over the finale');
});

void test('the flag is a U.S. flag: 13 stripes and 50 stars in 9 rows at 10:19', () => {
  assert.equal(FLAG_STRIPES, 13);
  const stars = flagStars();
  assert.equal(stars.length, 50);
  const rows = [...new Set(stars.map(([, y]) => y.toFixed(4)))];
  assert.equal(rows.length, 9);
  assert.deepEqual(rows.map((row) => stars.filter(([, y]) => y.toFixed(4) === row).length), [6, 5, 6, 5, 6, 5, 6, 5, 6]);
  assert.ok(near(MOON_FLAG_H / MOON_FLAG_W, 10 / 19));
});

void test('the iris closes from past the corners onto the astronaut and is fully shut before the end', () => {
  for (const [w, h] of VIEWPORTS) {
    const fit = moonFit(w, h);
    const iris = moonIris(fit);
    const farthest = Math.max(Math.hypot(iris.cx, iris.cy), Math.hypot(w - iris.cx, iris.cy), Math.hypot(iris.cx, h - iris.cy), Math.hypot(w - iris.cx, h - iris.cy));
    assert.equal(moonIrisRadius(MOON_BEATS.irisStart - .001, iris), null, 'no clip before the iris');
    assert.ok(moonIrisRadius(MOON_BEATS.irisStart, iris)! >= farthest, 'starts fully open');
    let prev = Infinity;
    for (const T of times(MOON_BEATS.irisStart, MOON_BEATS.closed, .001)) {
      const R = moonIrisRadius(T, iris)!;
      if (T > MOON_BEATS.hold && T < MOON_BEATS.snap) assert.ok(R <= iris.rH * 1.035 + 1e-9, 'one small swell while holding');
      else assert.ok(R <= prev + 1e-9, `closing at ${T}`);
      prev = R;
    }
    assert.equal(moonIrisRadius(MOON_BEATS.closed, iris), 0);
    assert.ok(near(iris.rH, MOON_IRIS_HOLD * fit.k));
    assert.ok(iris.cx >= iris.rH && iris.cx <= w - iris.rH, `${w}×${h}: circle fits across`);
    assert.ok(iris.cy >= 70 && iris.cy <= h - 70, `${w}×${h}: center between header and footer`);
    // The scene (and the iris with it) rises as the window closes, so the whole gold ring clears the chrome while it holds.
    const reach = (1 + MOON_IRIS_SWELL) * iris.rH + moonIrisRimPad(fit);
    assert.ok(moonIrisRimPad(fit) >= .028 * Math.min(w, h), 'the pad covers a riding star');
    for (const T of times(MOON_BEATS.hold, MOON_BEATS.snap, .005)) {
      const c = moonIrisCenter(T, iris);
      assert.ok(c.y + reach <= h - FOOTER_PX, `${w}×${h} at ${T}: ring bottom ${(c.y + reach).toFixed(0)} clears the footer`);
      assert.ok(c.y - reach >= HEADER_PX, `${w}×${h} at ${T}: ring top clears the header`);
    }
    assert.equal(moonIrisLift(MOON_BEATS.irisStart, iris), 0, 'no jump when the iris starts');
    let lift = 0;
    for (const T of times(MOON_BEATS.irisStart, MOON_DURATION_MS / 1000, .005)) {
      const l = moonIrisLift(T, iris);
      assert.ok(l >= lift - 1e-9 && l - lift <= 4, `${w}×${h}: the lift only rises, gently (${T})`);
      lift = l;
    }
    assert.ok(iris.lift <= .1 * h, `${w}×${h}: a gentle tilt (${iris.lift.toFixed(0)} px)`);
  }
  assert.equal(moonSceneVisible(MOON_BEATS.closed - .001), true);
  for (const T of times(MOON_BEATS.closed, MOON_DURATION_MS / 1000, .001)) assert.equal(moonSceneVisible(T), false);
});

void test('each team card twinkles as the ring passes it, outer cards first', () => {
  const fit = moonFit(1280, 800);
  const cards = [0, 1, 2, 3, 4].map((i) => ({ left: 16 + i * 250, top: 90, width: 230, height: 600 }));
  const schedule = moonTwinkleSchedule(cards, fit);
  const iris = moonIris(fit);
  assert.equal(schedule.length, cards.length, 'every team card twinkles');
  for (let i = 0; i < schedule.length; i++) {
    const t = schedule[i];
    assert.ok(t.start >= 8.92 && t.start <= 9.30, `start ${t.start}`);
    assert.ok(t.start + MOON_OVERLAY_MS.twinkle.duration / 1000 <= 9.62 + 1e-9);
    const final = moonIrisCenter(MOON_BEATS.hold, iris);
    assert.ok(Math.hypot(t.x - final.x, t.y - final.y) > 1.04 * iris.rH, 'each twinkle sits outside the hold circle');
    // It fires as the ring reaches its corner.
    const R = moonIrisRadius(t.start - .02, iris)!;
    assert.ok(Math.abs(R - t.d) <= 2, `ring at the corner when it twinkles (${R.toFixed(0)} vs ${t.d.toFixed(0)})`);
    if (i) assert.ok(schedule[i - 1].d >= t.d && schedule[i - 1].start <= t.start + 1e-9, 'outer cards first');
    // Always the card's top-right corner: the team badge sits top-left.
    const card = cards[t.index];
    assert.ok(t.x > card.left + card.width * .8 && t.x < card.left + card.width && t.y > card.top && t.y < card.top + card.height / 4, `card ${t.index}: top-right corner`);
    const c = moonIrisCenter(t.start - .02, iris);
    assert.ok(Math.abs(t.d - Math.hypot(t.x - c.x, t.y - c.y)) <= 2, 'timed by that same corner, as the rising ring passes it');
  }
  // A tiny card right next to the astronaut gets the POP instead.
  const hold = moonIrisCenter(MOON_BEATS.hold, iris);
  assert.equal(moonTwinkleSchedule([{ left: hold.x - 20, top: hold.y - 20, width: 40, height: 40 }], fit).length, 0);
  assert.equal(moonTwinkleSchedule(Array.from({ length: 30 }, (_, i) => ({ left: i * 40, top: 0, width: 30, height: 30 })), fit).length <= 16, true);
});

void test('the scene mounts everything during the countdown, then only moves, shows and hides it', () => {
  let changes = 0;
  let last = moonStructureKey(0);
  for (const T of times(0, MOON_DURATION_MS / 1000, .001)) {
    const key = moonStructureKey(T);
    if (key !== last) {
      changes++;
      assert.ok(T <= MOON_PREMOUNT_DONE, `no mount or unmount during the action (changed at ${T})`);
      last = key;
    }
  }
  assert.ok(changes <= 12, `${changes} premount steps`);
  // Premount steps are spaced so each one gets its own frames, and all land before the "2".
  const steps = Object.values(MOON_PREMOUNT).sort((p, q) => p - q);
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] - steps[i - 1] >= .05);
  assert.ok(steps.at(-1)! < MOON_BEATS.liftoff - .5);
});

void test('the stylesheet stays Safari-safe', () => {
  assert.doesNotMatch(css, /@property/);
  assert.doesNotMatch(css, /offset-path/);
  // No nested rules: every block opened outside @keyframes/@media closes before the next one opens.
  let depth = 0;
  let inAt = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') {
      const head = css.slice(css.lastIndexOf('}', i) + 1, i);
      if (depth === 0 && /@(keyframes|media)/.test(head)) inAt = 1;
      depth++;
      assert.ok(depth <= 1 + inAt, 'no nested CSS rules');
    } else if (css[i] === '}') { depth--; if (depth === 0) inAt = 0; }
  }
  // Every clip-path written by the scene has a -webkit- twin.
  const plain = scene.match(/'clip-path'/g)?.length ?? 0;
  assert.ok(plain >= 3);
  assert.equal(scene.match(/'-webkit-clip-path'/g)?.length ?? 0, plain);
  assert.doesNotMatch(css, /clip-path/);
});

void test('the countdown and LIFTOFF! sit in open sky right of the rocket at every size', () => {
  for (const [w, h] of VIEWPORTS) {
    const fit = moonFit(w, h);
    const o = moonLaunchOverlay(fit);
    // The rocket's right edge (fins included) at the strongest push-in, plus the widest shake.
    const rocketRight = moonRigToScreen(fit, MOON_BEATS.liftoff, 740 + 45, 400).x + 8 * fit.k;
    const liftoff = o.liftoffWidth * MOON_LIFTOFF_TEXT * MOON_LIFTOFF_OVERSHOOT;
    assert.ok(o.x - liftoff / 2 >= rocketRight, `${w}×${h}: LIFTOFF! clears the rocket`);
    assert.ok(o.x + liftoff / 2 <= w, `${w}×${h}: LIFTOFF! stays on screen`);
    const numeral = Math.max(130, Math.min(.28 * h, 320)) * 1.12 * 180 / 210;
    assert.ok(o.x - numeral / 2 >= rocketRight && o.x + numeral / 2 <= w, `${w}×${h}: numerals clear the rocket`);
  }
  assert.match(css, /\.moon-count \{[^}]*left: var\(--moon-launch-x/);
  assert.match(css, /\.moon-liftoff \{[^}]*width: var\(--moon-liftoff-w/);
});

void test('spent stages and the escape tower recede to nothing before they unmount (no pops)', () => {
  for (const T of [4.44, 4.449]) {
    const p = moonStagePoses(T);
    assert.ok(!p.stage1 || p.stage1.s <= .02, `S-IC gone at ${T}`);
    assert.ok(!p.tower || p.tower.s <= .02, `tower gone at ${T}`);
  }
  assert.equal(moonStagePoses(4.45).stage1, null);
  assert.equal(moonStagePoses(4.45).tower, null);
  // The S-II recedes until the sparkle cut hides the swap.
  assert.ok(moonStagePoses(4.79).stage2!.s <= .05);
  // Shrinking only (no fading), monotonic.
  let last = 1;
  for (const T of times(MOON_BEATS.sep1, 4.449, .005)) { const s = moonStagePoses(T).stage1!.s; assert.ok(s <= last + 1e-9); last = s; }
});

void test('every SVG id is defined once, and clip paths live in always-visible defs', () => {
  const sources = ['moon.tsx', 'moonArt.tsx', 'apolloIllustration.tsx'].map((file) => readFileSync(`src/revealEffects/${file}`, 'utf8'));
  const ids = sources.flatMap((source) => [...source.matchAll(/id="(mn-[\w-]+)"/g)].map((m) => m[1]));
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(", ")}`);
  // Two flag instances (back and front view) share the cloth clip, so it must not sit inside a hidden actor.
  const illustration = sources[2];
  const groundDefs = illustration.slice(illustration.indexOf('export const GroundDefs'), illustration.indexOf('});', illustration.indexOf('export const GroundDefs')));
  assert.match(groundDefs, /clipPath id="mn-flag-cloth"/);
});

void test('the warm wash covers the frame edge to edge while the rig zooms out at the whip', () => {
  const rule = css.slice(css.indexOf('.moon-wash {'), css.indexOf('}', css.indexOf('.moon-wash {')));
  const pct = (side: string) => Number(rule.match(new RegExp(`${side}: -(\\d+(?:\\.\\d+)?)%`))?.[1] ?? 0) / 100;
  assert.ok(near(pct('left'), MOON_WASH_OVERSCAN) && near(pct('right'), MOON_WASH_OVERSCAN) && near(pct('bottom'), MOON_WASH_OVERSCAN), 'moon.css mirrors MOON_WASH_OVERSCAN');
  assert.doesNotMatch(css, /\.moon-wash[^{]*,[^{]*\{[^}]*inset: 0/, 'the wash is not in the inset-0 group');
  let checked = 0;
  for (const [w, h] of VIEWPORTS) {
    const fit = moonFit(w, h);
    const o = moonToScreen(fit, RIG_ORIGIN.x, RIG_ORIGIN.y);
    for (const T of times(1.40, 3.10, .002)) {
      if (moonPadGlow(T) <= 0) continue;
      const s = moonRigScale(T);
      const shake = moonShake(T);
      const to = (x: number, y: number) => ({ x: o.x + (x - o.x) * s + shake.x * fit.k, y: o.y + (y - o.y) * s + shake.y * fit.k });
      const tl = to(-MOON_WASH_OVERSCAN * w, 0);
      const br = to(w * (1 + MOON_WASH_OVERSCAN), h * (1 + MOON_WASH_OVERSCAN));
      assert.ok(tl.x <= 0 && br.x >= w, `${w}×${h} at ${T}: wash spans ${tl.x.toFixed(1)}–${br.x.toFixed(1)} px`);
      assert.ok(br.y >= h, `${w}×${h} at ${T}: wash reaches the bottom`);
      checked++;
    }
  }
  assert.ok(checked > 1000);
});

void test('the dive never cross-fades solid ground: the globe gives way to the ground in one frame', () => {
  let swaps = 0;
  let prev = moonDive(MOON_BEATS.glintCut);
  for (const T of times(MOON_BEATS.glintCut, 6.2, FRAME / 4)) {
    const d = moonDive(T);
    assert.equal(typeof d.globe, 'boolean');
    assert.equal(d.far, d.near, 'far and near ground switch together');
    assert.equal(d.far, T >= MOON_DIVE_SWAP);
    if (d.far !== prev.far) swaps++;
    // Before the swap only the globe shows; its decals have rushed past the rim by the swap.
    if (!d.far) assert.ok(d.globe);
    if (T >= MOON_DIVE_SWAP) assert.equal(d.decals, null, `globe decals gone at ${T}`);
    else if (d.decals !== null) assert.ok(d.decals >= (prev.decals ?? 1) - 1e-9, 'decals only rush outward');
    // The terminator shading is light: it lifts fully before the swap, and the disc has reached the ground's fill.
    assert.ok(d.night >= 0 && d.night <= 1);
    if (T >= MOON_DIVE_SWAP) { assert.equal(d.night, 0); assert.equal(d.disc, MOON_DISC_FILL[1]); }
    prev = d;
  }
  assert.equal(swaps, 1, 'one hard switch');
  assert.equal(moonDive(MOON_BEATS.dive).decals, 1);
  assert.equal(moonDive(MOON_BEATS.dive).disc, MOON_DISC_FILL[0]);
  assert.equal(moonDive(5.95).globe, false);
  // The boulder pile pops up from its base on the swap, with a little overshoot, and has settled before the hover.
  assert.equal(moonDive(MOON_DIVE_SWAP - .001).pile, 0);
  assert.ok(near(moonDive(MOON_DIVE_SWAP).pile, .6));
  assert.ok(Math.max(...times(MOON_PILE_POP[0], MOON_PILE_POP[1], .002).map((T) => moonDive(T).pile)) > 1, 'easeOutBack overshoot');
  for (const T of times(MOON_PILE_POP[1], MOON_BEATS.contact, .01)) assert.equal(moonDive(T).pile, 1);
  assert.ok(MOON_PILE_POP[1] < MOON_BEATS.hover);
  // Texture stays on screen through the swap: on the last globe frame a crater rim is still in the action band, on the disc.
  for (const T of [MOON_DIVE_SWAP - FRAME, MOON_DIVE_SWAP - 2 * FRAME, MOON_DIVE_SWAP - 3 * FRAME]) {
    const g = moonGlobe(T);
    const s = moonDive(T).decals!;
    const onScreen = MOON_GLOBE_CRATERS.some(([x, y, r]) => times(0, 1, 1 / 64).some((a) => {
      const lx = s * (x + r * Math.cos(2 * Math.PI * a)), ly = s * (y + 100 + r * Math.sin(2 * Math.PI * a)) - 100;
      const wx = g.cx + lx * g.r / 100, wy = g.cy + ly * g.r / 100;
      return Math.hypot(lx, ly) < 97 && wx > 40 && wx < 1560 && wy > MOON_BAND_TOP && wy < MOON_BAND_BOTTOM - 20;
    }));
    assert.ok(onScreen, `a crater rim is still on screen at ${T.toFixed(3)}`);
  }
  // The LM's shadow (light) only comes in once the ground is there to catch it.
  for (const T of times(MOON_BEATS.glintCut, MOON_DIVE_SWAP, .01)) assert.equal(moonLmShadow(T).o, 0);
});

void test('the Sun in space blooms in: its light fades in, its solid disc scales up from nothing', () => {
  assert.ok(near(moonSpace(MOON_SUN_BLOOM[0]).sunCore, 0));
  assert.ok(near(moonSpace(MOON_SUN_BLOOM[1]).sunCore, 1));
  assert.ok(Math.max(...times(MOON_SUN_BLOOM[0], MOON_SUN_BLOOM[1], .005).map((T) => moonSpace(T).sunCore)) > 1.05, 'a little overshoot, like a sparkle');
  for (const T of times(MOON_SUN_BLOOM[1], MOON_BEATS.glintCut, .01)) assert.ok(near(moonSpace(T).sunCore, 1));
  // The disc has bloomed before the light is at full strength, so it never shows as a washed-out ghost.
  assert.ok(MOON_SUN_BLOOM[1] <= 3.4 && moonSpace(3.2).flare < 1 && moonSpace(3.2).sunCore > .9);
  assert.match(scene, /attr\(core\.current, 'transform'/);
});

void test('in the scene, only light fades: no layer or solid actor writes an opacity', () => {
  // Components (memo or plain function) and the opacity writes inside each.
  const starts = [...scene.matchAll(/^(?:const (\w+) = memo\(function|function (\w+)\()/gm)].map((m) => ({ name: m[1] ?? m[2], at: m.index }));
  const writes = new Map<string, string[]>();
  starts.forEach((c, i) => {
    const body = scene.slice(c.at, starts[i + 1]?.at ?? scene.length);
    const found = [...body.matchAll(/(?:attr|css)\(([^,]+), 'opacity'/g)].map((m) => m[1].trim());
    if (found.length) writes.set(c.name, found);
  });
  const LIGHT: Record<string, string[]> = {
    Skies: ['blue.current', 'dawn.current', 'dawnStars.current'], StarField: ['stars.current'], PadLight: ['el'], PadFront: ['hot.current', 'flash.current'],
    SaturnV: ['e.underglow'], Space: ['flare.current'], GlobeLayer: ['e.night'], LmShadow: ['path.current'],
  };
  assert.ok(writes.size >= 5, 'the scan finds the light writers');
  for (const [name, targets] of writes) {
    assert.ok(name in LIGHT, `${name} writes an opacity but is not a light-only layer`);
    for (const target of targets) assert.ok(LIGHT[name].includes(target), `${name}: ${target} is not light`);
  }
  for (const name of ['FarLayer', 'NearLayer']) assert.ok(!writes.has(name), `${name} never fades`);
});

void test('the far horizon is the arc the dive ends on, so the globe hands over without a pop', () => {
  const end = moonGlobe(5.9);
  for (const T of times(5.9, 6.2, .01)) assert.deepEqual(moonGlobe(T), end, 'the globe is still once the dive ends');
  // Far art sits 140 units below camera space at the far rest pose.
  assert.ok(near(MOON_HORIZON.cx, end.cx) && near(MOON_HORIZON.cy, end.cy + 140) && near(MOON_HORIZON.r, end.r));
  for (const x of [-900, 0, 400, 800, 1200, 1600, 2500]) {
    const camY = moonHorizonY(x) - 140;
    assert.ok(near(Math.hypot(x - end.cx, camY - end.cy), end.r, 1e-6), `on the globe rim at x ${x}`);
  }
  const art = readFileSync('src/revealEffects/apolloIllustration.tsx', 'utf8');
  const far = art.slice(art.indexOf('export const FarSurfaceArt'), art.indexOf('});', art.indexOf('export const FarSurfaceArt')));
  assert.match(far, /d=\{horizonArc\(-900, 2500\)\} fill="none" stroke=\{INK\} strokeWidth="3\.5" vectorEffect="non-scaling-stroke"/, 'drawn with the globe rim line');
  assert.doesNotMatch(far, /<rect/, 'no pattern rect pokes above the curved horizon');
});

void test('at the sparkle cut the S-IVB flies into the little Moon, and the Earth appears where the sky was empty', () => {
  const cut = MOON_BEATS.glintCut;
  const r = moonRocketPose(cut);
  const a = r.rot * Math.PI / 180;
  const mid = { x: r.x - ROCKET_SIVB_MID_LOCAL * r.s * Math.sin(a), y: r.y + ROCKET_SIVB_MID_LOCAL * r.s * Math.cos(a) };
  assert.ok(near(mid.x, MOON_GLINT_WORLD.x, 1e-6) && near(mid.y, MOON_GLINT_WORLD.y, 1e-6), 'the S-IVB sits on the glint');
  const moon = moonSpace(cut).moonSmall;
  assert.ok(near(moon.x, MOON_SMALL_PATH.to.x) && near(moon.y, MOON_SMALL_PATH.to.y) && near(moon.s, MOON_SMALL_PATH.to.s));
  const R = 100 * moon.s;
  assert.ok(Math.hypot(MOON_GLINT_WORLD.x - moon.x, MOON_GLINT_WORLD.y - moon.y) < R * .4, 'the glint is on the face of the Moon');
  assert.ok(MOON_GLINT_SIZE / 2 * 1.25 * 46 / 60 >= R, 'the glint arms reach past the rim of the Moon at their peak');
  // It swells as we close in and drifts steadily down into the path of the rocket.
  let prev = moonSpace(3.3).moonSmall;
  for (const T of times(3.3 + FRAME, cut, FRAME)) {
    const m = moonSpace(T).moonSmall;
    assert.ok(m.s >= prev.s - 1e-9 && m.y >= prev.y - 1e-9 && m.x <= prev.x + 1e-9, `little Moon approaches at ${T}`);
    prev = m;
  }
  // Where the sky Earth appears after the cut, nothing was drawn in the frames before it.
  for (const T of times(4.5, cut, .01)) {
    const m = moonSpace(T).moonSmall;
    assert.ok(Math.hypot(m.x - MOON_SKY_EARTH.x, m.y - MOON_SKY_EARTH.y) > 100 * m.s + MOON_SKY_EARTH.r, `sky Earth spot is empty at ${T}`);
  }
  assert.ok(Math.hypot(moon.x - MOON_SUN.x, moon.y - MOON_SUN.y) - R >= 250, 'clear of the sun flare');
  assert.match(scene, /moonToScreen\(fit, MOON_GLINT_WORLD\.x, MOON_GLINT_WORLD\.y\)/, 'the glint overlay sits on the target');
});

void test('the final POP lands big on a projector and stays between the header and the footer', () => {
  const rule = (name: string) => css.slice(css.indexOf(`.${name} {`), css.indexOf('}', css.indexOf(`.${name} {`)));
  const units = (name: string) => Number(rule(name).match(/width: calc\(var\(--u\) \* ([\d.]+)\)/)?.[1]);
  // moon.css mirrors MOON_POP.
  assert.equal(units('moon-pop-burst'), MOON_POP.burst);
  assert.equal(units('moon-pop-star'), MOON_POP.star);
  assert.equal(units('moon-pop-spark'), MOON_POP.spark);
  assert.equal(units('moon-pop-ring'), MOON_POP.ring);
  const num = (n: number) => String(n).replace(/^0\./, '.');
  assert.ok(keyframes('moon-pop-burst').includes(`scale(${num(MOON_POP.burstPeak)})`));
  assert.ok(keyframes('moon-pop-star').includes(`translateX(calc(var(--d) * ${num(MOON_POP.starPeakAt)})) scale(${num(MOON_POP.starPeak)})`));
  assert.ok(keyframes('moon-pop-spark').includes(`translateX(calc(var(--d) * ${num(MOON_POP.sparkPeakAt)})) scale(${num(MOON_POP.sparkPeak)})`));
  // The shock ring and both its ink lines are gone at its 80% frame, so no hairline circle lingers at the end.
  assert.ok(keyframes('moon-pop-ring').includes(`80% { transform: scale(${num(MOON_POP.ringPeak)}); border-width: 0; box-shadow: 0 0 0 0 #23264d, inset 0 0 0 0 #23264d; }`));
  assert.ok((MOON_OVERLAY_MS.popRing.delay + .8 * MOON_OVERLAY_MS.popRing.duration) / 1000 <= 9.65, 'the ring is gone before the last frames');
  for (const [w, h] of VIEWPORTS) {
    const fit = moonFit(w, h);
    const pop = moonPopLayout(fit);
    const iris = moonIris(fit);
    const closed = moonIrisCenter(MOON_BEATS.closed, iris);
    assert.ok(near(pop.x, closed.x, .06) && near(pop.y, closed.y, .06), `${w}×${h}: the POP bursts where the window closes`);
    const u = Math.min(w, h) / 100;
    // Big: at its peak the burst spans over a third of the screen's short side, and every star flies at least 26 units out.
    assert.ok(MOON_POP.burst * MOON_POP.burstPeak >= 35);
    assert.equal(pop.stars.length, 10);
    assert.equal(pop.sparks.length, 8);
    assert.ok(Math.min(...pop.stars.map((s) => s.d)) >= 26 * u, `${w}×${h}: stars fly far (${Math.min(...pop.stars.map((s) => s.d)).toFixed(0)} px)`);
    // In the band: each piece at its widest stays clear of the header, the footer and the screen sides.
    for (const s of pop.stars) {
      const reach = Math.max(s.d, MOON_POP.starPeakAt * s.d + MOON_POP.star * MOON_POP.starPeak * u / 2);
      assert.ok(reach <= pop.clearance(s.a) + 1e-6, `${w}×${h}: star at ${s.a}° stays in the band`);
    }
    for (const s of pop.sparks) {
      const reach = Math.max(s.d, MOON_POP.sparkPeakAt * s.d + MOON_POP.spark * MOON_POP.sparkPeak * u / 2);
      assert.ok(reach <= pop.clearance(s.a) + 1e-6, `${w}×${h}: sparkle at ${s.a}° stays in the band`);
    }
    const nearest = Math.min(...times(0, 359, 1).map((a) => pop.clearance(a)));
    assert.ok(MOON_POP.burst / 2 * MOON_POP.burstPeak * u <= nearest, `${w}×${h}: the burst stays in the band`);
    assert.ok((MOON_POP.ring / 2 * MOON_POP.ringPeak + .3) * u <= nearest, `${w}×${h}: the ring stays in the band`);
  }
});

void test('captions speak real mission words (no baby talk) in step with the action', () => {
  const texts: string[] = MOON_CAPTIONS.map(([, , text]) => text);
  for (const text of texts) assert.doesNotMatch(text, /UH-OH|OOPS|SCOOT|HELLO|EASY DOES|BOOP|WHEE|YAY/, text);
  for (const phrase of ['THE EAGLE HAS WINGS', 'GO FOR LANDING', 'BOULDER FIELD!', 'TAKING MANUAL CONTROL', 'THE EAGLE HAS LANDED']) assert.ok(texts.includes(phrase), phrase);
  for (let i = 0; i < MOON_CAPTIONS.length; i++) {
    const [from, to] = MOON_CAPTIONS[i];
    assert.ok(to - from >= .3 - 1e-9, `${MOON_CAPTIONS[i][2]} shows long enough to read aloud`);
    if (i) assert.ok(near(MOON_CAPTIONS[i - 1][1], from), 'back to back, no flicker');
  }
  // Undocking, the descent, the boulder field under the hovering Eagle, Armstrong flying it past, touchdown.
  assert.equal(moonCaption(5.2), 'THE EAGLE HAS WINGS');
  assert.equal(moonCaption(5.6), 'GO FOR LANDING');
  assert.equal(moonCaption(MOON_BEATS.hover), 'BOULDER FIELD!');
  assert.equal(moonCaption((MOON_BEATS.scoot + 6.68) / 2), 'TAKING MANUAL CONTROL');
  assert.equal(moonCaption(MOON_BEATS.contact), 'THE EAGLE HAS LANDED');
});

void test('the astronaut pops out of the open hatch, and his shadow lies on the ground, never at the porch', () => {
  const [from, to] = MOON_ASTRO_EMERGE;
  assert.ok(moonHatch(from) > .9, 'the hatch is open when he comes out');
  assert.ok(moonAstroEmerge(from) <= .5, 'he starts small in the hatchway');
  assert.equal(moonAstroEmerge(to), 1);
  assert.ok(Math.max(...times(from, to, .002).map(moonAstroEmerge)) > 1.02, 'with a little overshoot');
  assert.ok(to <= MOON_BEATS.climb + .12, 'before he is far down the ladder');
  for (const T of times(to, 9.48, .01)) assert.equal(moonAstroEmerge(T), 1);
  let prev = moonAstronaut(from).shadow;
  for (const T of times(from, 9.4, FRAME)) {
    const a = moonAstronaut(T);
    assert.ok(a.shadow.y >= MOON_LADDER_FOOT_GY - 1e-9, `the shadow is on the ground at ${T}`);
    if (a.gy < MOON_LADDER_FOOT_GY - 48) assert.equal(a.shadow.o, 0, `no shadow in mid-air at ${T}`);
    // It slides in from the left as he nears the foot of the ladder and joins his boots without a jump.
    if (T < MOON_BEATS.step + .1 && a.shadow.o > 0 && prev.o > 0) assert.ok(Math.hypot(a.shadow.x - prev.x, a.shadow.y - prev.y) <= 10, `the shadow moves smoothly at ${T}`);
    prev = a.shadow;
  }
  assert.equal(moonAstronaut(MOON_BEATS.step + .01).shadow.o, 1);
});
