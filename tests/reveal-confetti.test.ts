import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { confettiEffect } from '../src/revealEffects/confetti';
import {
  BADGE_DELAY_MS, BADGE_MS, BADGE_SHIFT_VMIN, BEATS, BLUSH_KEYS, BURST_FADE_FROM, BURST_MAX_VMIN, CENTRE_GUTTER_PX, CENTRE_HALF_PX, CONFETTI_BURST_MS, CONFETTI_CLEAR_MS, CONFETTI_DURATION_MS, CONFETTI_PALETTE,
  COVER_BITS, COVER_BIT_CAP_PCT, COVER_BURST_MS, COVER_FX_MS, COVER_POP_LEAD_MS, COVER_POP_MS, COVER_POP_SPREAD_MS, COVER_RING_MS, COVER_SPARKLES,
  CURL_BOX, FACE_STEPS, FACE_TIMELINE_MS, FLIGHT_FALL, FLIGHT_RISE, FLIGHT_STOPS, FLIGHT_X, FOOTER_CLIP_PX, GLINT_MS, JET_COUNT, JET_FADE,
  JET_REACH_RANGE, LOOK_KEYS, PICKER_BURST, PICKER_CAPTION_BOX, PICKER_NAME_BOX, PICKER_SPARKLES, POP_SKIN, PIP_BADGE_MS, PIP_KEYS, POPPER_TIMELINE_MS, POP_AIM_DEG, POP_JET_REACH_RANGE, POP_KICK_DEG,
  POP_KEYS, POP_MOUTH, PUFF_APEX, PUFF_AT_MS, PUFF_FADE_FROM, PUFF_MS, PUFF_STOPS, SHOWER_TIER_MS, SHOWER_TIER_SIZE, SPOT_HOME, SPOT_KEYS,
  SPOT_TIMELINE_MS, STAGE_FADE, STAR_FALL_VH, STAR_START_VH, STREAMER_CEILING_PX, STREAMER_FADE_FROM, TABLE_LANE_MIN_PX, TABLE_LANE_PAD_PX, TREMBLE_MS, TREMBLE_ORDER_SPREAD_MS, TREMBLE_START_MS, TREMBLE_STEP_MS,
  TUFT_BOX, TUFT_KEYS, VEIL, VEIL_ORIGIN, beamAngle, confettiJet, confettiStreamers, coverBurstBits, coverPopMs, curlStrands, falseStartPuff,
  flightStop, generatedCss, jetDxPx, laneDxPx, tableLanes, jetPoint, jetReachOutPx, jetReachPx, jetTrack, keyPercent, mouthShares, mouthX, pickerBurstBits,
  popBurstPoints, popReachOutPx, popperHeightPx, popperMouthPx, puffPoint, puffTracks, showerGlints, starGeometry, starShower,
  streamerPose, streamerTracks, trembleStops, tuftStrands, type Track,
} from '../src/revealEffects/confettiTimeline';

const css = readFileSync('src/revealEffects/confetti.css', 'utf8');
const stageSource = readFileSync('src/components/StudentConfetti.tsx', 'utf8');
/** Landscape classroom screens: laptop, 4:3 projector, 16:10 and 16:9 projectors. */
const VIEWPORTS = [[960, 680], [1024, 768], [1280, 800], [1366, 768], [1920, 1080]] as const;
const HEADER_PX = 66;
const FOOTER_PX = 67;
const close = (actual: number, expected: number, epsilon = .011) => Math.abs(actual - expected) <= epsilon;
const burst = CONFETTI_BURST_MS / 1000;

/** `{ percent: declarations }` for one @keyframes block (selector lists expanded). */
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
  for (const match of body.matchAll(/([\d.%,\s]+|from|to)\{([^}]*)\}/g)) {
    for (const selector of match[1].split(',')) {
      const key = selector.trim() === 'from' ? 0 : selector.trim() === 'to' ? 100 : Number.parseFloat(selector);
      stops.set(key, `${stops.get(key) ?? ''}${match[2]}`);
    }
  }
  return stops;
}
const numbers = (text: string) => Array.from(text.matchAll(/-?\d*\.?\d+/g), (match) => Number(match[0]));
/** A number as the CSS writes it (no leading zero). */
const cssNumber = (value: number) => String(value).replace(/^(-?)0\./, '$1.');
const rule = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} rule exists`);
  return css.slice(start, css.indexOf('}', start));
};
const animationOf = (selector: string) => {
  const match = /animation:\s*([^;}]+)/.exec(rule(selector));
  assert.ok(match, `${selector} has an animation`);
  return match[1].trim();
};

/** Picker card rectangles measured in the lab (view=picker) and the name area kept clear inside them. */
const PICKER_CARDS = { '960x680': [36, 176, 909, 502], '1280x800': [173, 210, 1093, 594], '1920x1080': [493, 283, 1413, 801] } as const;
function pickerClearRect(size: keyof typeof PICKER_CARDS) {
  const [left, top, right, bottom] = PICKER_CARDS[size];
  const width = right - left;
  const height = bottom - top;
  const centre = (left + right) / 2;
  // The centre 40% of the card's width, from 30% to 92% of its height: star badge base, name and "It's your turn!".
  return { left: centre - width * .2, right: centre + width * .2, top: top + height * .3, bottom: top + height * .92 };
}

void test('confetti reveal keeps its contract: 4.3 s, the 1.85 s drumroll payoff and its sound', () => {
  assert.equal(confettiEffect.id, 'confetti');
  assert.equal(confettiEffect.sound, 'confetti');
  assert.equal(confettiEffect.durationMs, CONFETTI_DURATION_MS);
  assert.equal(CONFETTI_DURATION_MS, 4300);
  assert.ok(CONFETTI_DURATION_MS <= 9800, 'under the hard reveal cap');
  assert.equal(CONFETTI_BURST_MS, 1850);
  assert.ok(CONFETTI_CLEAR_MS <= CONFETTI_DURATION_MS - 20, 'every track has ended before the reveal ends');
  assert.equal(typeof confettiEffect.Stage, 'function');
  assert.equal(typeof confettiEffect.Cover, 'function');
  assert.equal(css.match(/--cf-burst: 1850ms/g)?.length, 2, 'stage and cover share the burst time');
  assert.match(animationOf('.student-confetti.cf-stage'), new RegExp(`^cf-stage ${CONFETTI_DURATION_MS}ms linear both`));
  // The stage's fade is only a safety net: it starts after everything has left the screen (checked per piece below).
  const stage = keyframes('cf-stage');
  assert.match(stage.get(Number((STAGE_FADE[0] * 100).toFixed(2))) ?? '', /opacity: 1/);
  assert.match(stage.get(Number((STAGE_FADE[1] * 100).toFixed(2))) ?? '', /opacity: 0/);
  assert.equal(stage.size, 4, 'one hold and one quick fade, nothing else');
  assert.ok((STAGE_FADE[1] - STAGE_FADE[0]) * CONFETTI_DURATION_MS <= 50, 'a quick fade, never a lingering one');
  assert.ok(STAGE_FADE[1] * CONFETTI_DURATION_MS <= CONFETTI_DURATION_MS - 20, 'transparent before the reveal unmounts');
});

void test('every generated keyframe block in confetti.css matches the beat tables exactly', () => {
  for (const [name, text] of Object.entries(generatedCss())) {
    assert.ok(css.includes(`/* generated:${name} `) && css.includes(`/* /generated:${name} */`), `${name} markers`);
    assert.ok(css.includes(text), `the ${name} block is up to date (run node work/build/confetti/gen-css.cjs)`);
  }
});

void test('covers pop in a symmetric wave from the edges to the centre and clean up after themselves', () => {
  assert.equal(coverPopMs(0), CONFETTI_BURST_MS + COVER_POP_LEAD_MS);
  assert.equal(coverPopMs(1), coverPopMs(0));
  assert.equal(coverPopMs(.5), CONFETTI_BURST_MS + COVER_POP_LEAD_MS + COVER_POP_SPREAD_MS / 2);
  for (let step = 0; step <= 20; step++) {
    const cx = step / 20;
    assert.ok(close(coverPopMs(cx), coverPopMs(1 - cx), 1e-9), `symmetric at ${cx}`);
    if (step < 10) assert.ok(coverPopMs((step + 1) / 20) > coverPopMs(cx), 'monotonic toward the centre');
    assert.ok(coverPopMs(cx) >= CONFETTI_BURST_MS, 'never before the drum hit');
    assert.ok(coverPopMs(cx) + COVER_POP_MS <= CONFETTI_BURST_MS + 340, 'every name is visible 0.34 s after the hit');
    assert.ok(coverPopMs(cx) + COVER_FX_MS <= CONFETTI_BURST_MS + 800, 'ring and burst finish within 0.8 s of the hit');
  }
  assert.equal(coverPopMs(-3), coverPopMs(0), 'off-screen covers clamp');
  assert.equal(coverPopMs(Number.NaN), coverPopMs(.5), 'an unmeasured cover falls back to the centre');
  assert.ok(css.includes('--cf-dist: max(var(--reveal-center-x, .5) - .5, .5 - var(--reveal-center-x, .5));'));
  assert.ok(css.includes(`--cf-pop: calc(var(--cf-burst) + ${COVER_POP_LEAD_MS}ms + (.5 - var(--cf-dist)) * ${COVER_POP_SPREAD_MS}ms);`));
  assert.ok(css.includes('var(--reveal-cover-width, 240px)') && css.includes('var(--reveal-cover-height, 240px)'));
  // Nothing a cover draws may grow a scroll box (the Today table): the cover clips to its card...
  assert.match(rule('.cf-cover'), /overflow: hidden/);
  // ...and every finished layer falls back to an invisible, zero-size box instead of holding a scaled one.
  for (const [name, selector, lengthMs] of [['cf-cover-pop', '.cf-cover-pop', COVER_POP_MS], ['cf-ring', '.cf-cover-ring', COVER_RING_MS], ['cf-burst', '.cf-cover-burst', COVER_BURST_MS]] as const) {
    const animation = animationOf(selector);
    assert.ok(animation.startsWith(`${name} ${lengthMs}ms var(--cf-pop)`), `${selector} runs ${lengthMs} ms from the pop`);
    assert.ok(animation.endsWith('backwards'), `${selector} fills backwards only`);
    assert.match(rule(selector), /opacity: 0; transform: scale\(0\)/, `${selector} rests invisible at scale 0`);
    assert.match(keyframes(name).get(100) ?? '', /opacity: 0/, `${name} ends invisible`);
    assert.ok(lengthMs <= COVER_FX_MS);
    for (const [percent, declaration] of keyframes(name)) {
      const scale = /scale\(([\d.]+)\)/.exec(declaration);
      if (scale && name !== 'cf-cover-pop') assert.ok(Number(scale[1]) <= 1, `${name} ${percent}% stays inside the card`);
    }
  }
  // The balloon skin: solid while it swells, then cut in one step (never a see-through ghost over the names).
  const pct = (share: number) => Number((share * 100).toFixed(2));
  const skin = keyframes('cf-cover-pop');
  assert.deepEqual([...skin.keys()], [0, pct(POP_SKIN[0]), pct(POP_SKIN[1]), 100]);
  assert.match(skin.get(0) ?? '', /scale\(1\); opacity: 1;/);
  assert.match(skin.get(pct(POP_SKIN[0])) ?? '', /scale\(1\.07\); opacity: 1; animation-timing-function: step-end;/, 'a last little swell (the tremble already inhaled), held, then one cut');
  assert.match(skin.get(pct(POP_SKIN[1])) ?? '', /opacity: 0;/);
  assert.ok(POP_SKIN[1] * COVER_POP_MS <= 50, 'the skin is gone as the bits fly out (within 50 ms of the pop)');
  assert.ok(animationOf('.cf-cover-pop').endsWith('linear backwards'), 'each stop sets its own easing');
  // The paper bits fly out solid and only drop out over the last part of the burst, while they are still spreading.
  for (const name of ['cf-burst', 'cf-burst-wide']) {
    const opacities = [...keyframes(name)].filter(([, declaration]) => declaration.includes('opacity'));
    assert.deepEqual(opacities.map(([percent, declaration]) => [percent, Number(/opacity: ([\d.]+)/.exec(declaration)?.[1])]), [[0, 0], [6, 1], [pct(BURST_FADE_FROM), 1], [100, 0]], `${name} holds its bits solid`);
    assert.match(keyframes(name).get(100) ?? '', /scale\(1(\.04)?\)/, `${name} is still growing while it drops out`);
  }
  // The ring lights the card's rim (its 10 px edge band): it never shrinks in over the heading just revealed.
  for (const [percent, declaration] of keyframes('cf-ring')) assert.ok(Number(/scale\(([\d.]+)\)/.exec(declaration)?.[1]) >= .98, `cf-ring ${percent}% stays on the rim`);
  // A big Today table (more than 24 small cells) just pops: the ring and bits get a zero-length run.
  assert.ok(css.includes('--cf-fx-on: clamp(0, calc((24.5 - var(--reveal-count, 1)) * 100), 1);'));
  assert.ok(rule('.cf-cover-ring').includes(`animation-duration: calc(${COVER_RING_MS}ms * var(--cf-fx-on))`));
  assert.ok(rule('.cf-cover-burst').includes(`animation-duration: calc(${COVER_BURST_MS}ms * var(--cf-fx-on))`));
  // Each card's burst is turned and sized differently (no stamped look).
  assert.match(rule('.cf-bits'), /rotate\(calc\(var\(--reveal-index, 0\) \* 137\.5deg\)\) scale\(calc\(\.9 \+ var\(--reveal-order, \.5\) \* \.2\)\)/);
  // A big card gets a compact burst (capped at 50vmin) of stage-sized paper, not 45-75 px blocks: bits are sized in vmin,
  // and only small sprites (Today cells) shrink them further.
  assert.ok(css.includes(`--burst-size: min(calc(min(var(--reveal-cover-width, 240px), var(--reveal-cover-height, 240px)) * .96), ${BURST_MAX_VMIN}vmin);`));
  assert.ok(css.includes(`width: min(calc(var(--w) * 1vmin), calc(var(--w) * ${COVER_BIT_CAP_PCT}%)); height: min(calc(var(--h) * 1vmin), calc(var(--h) * ${COVER_BIT_CAP_PCT}%));`));
  // The picker: the whole card is the sprite, the bits take their picker places and the burst only grows (no turn).
  assert.match(rule('.student-picker-card .cf-cover-burst'), /left: 0; top: 0; width: 100%; height: 100%; margin: 0; animation-name: cf-burst-wide;/);
  assert.match(rule('.student-picker-card .cf-bits'), /transform: none;/);
  assert.ok(css.includes('.student-picker-card .cf-bit, .student-picker-card .cf-spark { left: var(--px); top: var(--py); }'));
  const wide = keyframes('cf-burst-wide');
  assert.ok((wide.get(0) ?? '').includes(`transform: translate(0, 0) scale(${cssNumber(PICKER_BURST.from)}); opacity: 0;`));
  assert.ok((wide.get(100) ?? '').includes(`transform: translate(0, ${PICKER_BURST.dropPct}%) scale(${cssNumber(PICKER_BURST.to)}); opacity: 0;`));
  assert.ok(![...wide.values()].some((declaration) => declaration.includes('rotate')), 'the picker burst never turns bits into the name');
});

void test('the cover trembles on a 50 ms grid, grows, and freezes centred and inflated at the drum hit', () => {
  assert.equal(TREMBLE_START_MS + TREMBLE_MS, CONFETTI_BURST_MS, 'the leftmost cover holds its breath exactly at the hit');
  assert.ok(TREMBLE_START_MS + TREMBLE_MS + TREMBLE_ORDER_SPREAD_MS <= coverPopMs(0) + COVER_POP_MS);
  assert.ok(css.includes(`cf-tremble ${TREMBLE_MS}ms calc(${TREMBLE_START_MS}ms + var(--reveal-order, .5) * ${TREMBLE_ORDER_SPREAD_MS}ms) linear both`));
  const stops = trembleStops();
  const table = keyframes('cf-tremble');
  assert.equal(stops.length, TREMBLE_MS / TREMBLE_STEP_MS + 1);
  assert.equal(table.size, stops.length);
  let lastAmplitude = 0;
  stops.forEach((stop, i) => {
    const declaration = table.get(stop.percent);
    assert.ok(declaration, `CSS has the ${stop.percent}% stop`);
    const [x, y, rotate, scale] = numbers(declaration);
    assert.ok(close(x, stop.x) && close(y, stop.y) && close(rotate, stop.rotate) && close(scale, stop.scale, 1e-4), `stop ${i} matches trembleStops()`);
    if (i > 0 && i < stops.length - 1) {
      assert.ok(Math.abs(stop.x) >= lastAmplitude, 'jitter only grows');
      assert.ok(Math.abs(stop.x) <= 4 && Math.abs(stop.rotate) <= 1, 'max 4 px / 1 degree: names never peek out');
      lastAmplitude = Math.abs(stop.x);
    }
  });
  assert.deepEqual(stops.at(-1), { percent: 100, x: 0, y: 0, rotate: 0, scale: 1.035 });
});

/** Screen position (px) of a point on a popper at its resting 38-degree lean; (u, v) in the 120 x 200 art. */
function popperPoint(side: 1 | -1, u: number, v: number, width: number, height: number) {
  const pp = popperHeightPx(width, height);
  const angle = 38 * Math.PI / 180;
  const lx = (u - 60) / 120 * .6 * pp;
  const ly = (v - 200) / 200 * pp;
  const x = .04 * width + .3 * pp + lx * Math.cos(angle) - ly * Math.sin(angle);
  const y = height - 34 + lx * Math.sin(angle) + ly * Math.cos(angle);
  return { x: side > 0 ? x : width - x, y };
}

void test('the spotlight catches Pip, fakes out onto Pop, whips back and focuses on the centre at the hit', () => {
  assert.ok(animationOf('.cf-veil').startsWith(`cf-spot ${SPOT_TIMELINE_MS}ms linear both`));
  assert.ok(animationOf('.cf-veil > .cf-beam').startsWith(`cf-beam ${SPOT_TIMELINE_MS}ms linear both`));
  const table = keyframes('cf-spot');
  const beam = keyframes('cf-beam');
  SPOT_KEYS.forEach((key, i) => {
    if (i) assert.ok(key.t > SPOT_KEYS[i - 1].t, 'beat times ascend');
    const declaration = table.get(keyPercent(key.t, SPOT_TIMELINE_MS)) ?? '';
    const [x, y, scale, opacity] = numbers(declaration);
    assert.ok(close(x, key.x - SPOT_HOME.x) && close(y, key.y - SPOT_HOME.y) && close(scale, key.scale) && close(opacity, key.opacity), `spot at ${key.t} s`);
    assert.ok(close(numbers(beam.get(keyPercent(key.t, SPOT_TIMELINE_MS)) ?? '')[0], beamAngle(key.x, key.y), .05), `beam aims at the source at ${key.t} s`);
    // The veil (a scaled, translated layer) still covers the whole viewport.
    const left = key.x - key.scale * (SPOT_HOME.x - VEIL.left);
    const right = key.x + key.scale * (VEIL.left + VEIL.width - SPOT_HOME.x);
    const top = key.y - key.scale * (SPOT_HOME.y - VEIL.top);
    const bottom = key.y + key.scale * (VEIL.top + VEIL.height - SPOT_HOME.y);
    assert.ok(left <= 0 && right >= 100 && top <= 0 && bottom >= 100, `the veil covers the screen at ${key.t} s`);
  });
  assert.ok(css.includes(`transform-origin: ${VEIL_ORIGIN.x}% ${VEIL_ORIGIN.y}%`) && css.includes(`circle at ${VEIL_ORIGIN.x}% ${VEIL_ORIGIN.y}%`));
  const at = (t: number) => SPOT_KEYS.find((key) => close(key.t, t, 1e-9));
  assert.deepEqual(at(burst) && { x: at(burst)?.x, y: at(burst)?.y, scale: at(burst)?.scale }, { x: 50, y: 46, scale: .8 }, 'focused on the centre (the picker card) at the hit');
  assert.equal(SPOT_KEYS.at(-1)?.opacity, 0, 'lights are fully up after the bloom');
  // The pool (about 19vmin of warm light) holds on Pip's face and mouth through the whole gag, and finds Pop for the fake-out.
  for (const [width, height] of VIEWPORTS) {
    const vmin = Math.min(width, height) / 100;
    const lit = (key: { x: number; y: number }, point: { x: number; y: number }) => Math.hypot(key.x * width / 100 - point.x, key.y * height / 100 - point.y) <= 19 * vmin;
    const pipKeys = SPOT_KEYS.filter((key) => key.t >= BEATS.spotOnPip && key.t <= BEATS.spotLeavesPip);
    assert.ok(pipKeys.length >= 3 && pipKeys.at(-1)?.t === BEATS.spotLeavesPip);
    for (const key of pipKeys) {
      assert.ok(lit(key, popperPoint(1, 60, 100, width, height)) && lit(key, popperPoint(1, 60, 46, width, height)), `${width}x${height}: Pip is lit at ${key.t} s`);
    }
    for (const t of [BEATS.spotOnPop, BEATS.spotLeavesPop]) {
      const popKey = at(t);
      assert.ok(popKey && lit(popKey, popperPoint(-1, 60, 100, width, height)) && lit(popKey, popperPoint(-1, 60, 46, width, height)), `${width}x${height}: Pop is lit at ${t} s`);
    }
  }
  // The hold on Pip covers the crouch, the little "pop" and the tuft landing.
  assert.ok(BEATS.spotOnPip <= BEATS.crouch && BEATS.tuftLands < BEATS.spotLeavesPip);
  // The fake-out: one eased swing from Pip straight onto Pop, a hold of at least 0.22 s while Pop acts, then the whip back.
  const leavePip = SPOT_KEYS.findIndex((key) => close(key.t, BEATS.spotLeavesPip, 1e-9));
  const onPop = at(BEATS.spotOnPop);
  const leavePop = at(BEATS.spotLeavesPop);
  assert.equal(SPOT_KEYS[leavePip + 1], onPop, 'one move from Pip to Pop, with no creep stop on the way');
  assert.ok(BEATS.spotOnPop - BEATS.spotLeavesPip <= .2, 'a quick swing');
  assert.ok(onPop && leavePop && onPop.x === leavePop.x && onPop.y === leavePop.y && SPOT_KEYS.indexOf(leavePop) === SPOT_KEYS.indexOf(onPop) + 1, 'the spot holds still on Pop');
  assert.ok(BEATS.spotLeavesPop - BEATS.spotOnPop >= .22, 'held long enough to read from the back of the room');
  assert.ok(BEATS.sideEye >= BEATS.spotOnPop && BEATS.popShake[0] >= BEATS.spotOnPop, 'Pop only acts once it is lit');
  assert.ok(BEATS.popShake[1] <= BEATS.spotLeavesPop + .06, 'and has finished shaking as the light leaves');
  const back = SPOT_KEYS.find((key) => key.t > BEATS.spotLeavesPop && Math.abs(key.x - 50) <= 2 && Math.abs(key.y - 46) <= 2);
  assert.ok(back && back.t <= 1.7, 'whipped back to the centre by 1.70 s');
  const focus = SPOT_KEYS.filter((key) => key.t > BEATS.spotLeavesPop && key.t <= burst && key.x === 50 && key.y === 46);
  assert.ok(focus.length >= 2 && focus[0].t <= 1.72 && focus.at(-1)!.scale === .8, 'then focuses on the centre until the hit');
});

void test('Pip and Pop act out the gag, hit the POP pose at the drum hit and are gone before the stars', () => {
  for (const [name, keys, sign] of [['cf-pip', PIP_KEYS, 1], ['cf-pop', POP_KEYS, -1]] as const) {
    const table = keyframes(name);
    const pose = keys.find((key) => close(key.t, burst, 1e-9));
    const aim = sign > 0 ? 38 : -POP_AIM_DEG;
    assert.deepEqual(pose && [pose.r, pose.ty, pose.sx, pose.sy], [aim, 7, .88, 1.24], `${name} recoils and stretches on the hit, fired along its aim`);
    assert.ok(keys.filter((key) => key.t >= burst && key.t < BEATS.happy + .05).every((key) => Math.abs(key.r - aim) <= 5), `${name} keeps its aim through the recoil`);
    // Then Pip holds its lean while Pop rocks back upright, toward its own screen edge (off the right card's names), and they duck.
    const settle = sign > 0 ? 38 : POP_KICK_DEG;
    assert.ok(keys.filter((key) => key.t >= BEATS.happy + .05).every((key) => Math.abs(key.r - settle) <= 2), `${name} ducks away at ${settle} degrees`);
    assert.ok(sign > 0 || POP_KICK_DEG - aim >= 10, "Pop's kick rocks it at least 10 degrees back toward the edge");
    assert.match(table.get(keyPercent(burst, POPPER_TIMELINE_MS)) ?? '', new RegExp(`translateY\\(7%\\) rotate\\(${aim}deg\\) scale\\(0\\.88, 1\\.24\\)`));
    // Every move is straight up/down on screen (translate before the lean): the duck never slides over the corner card.
    assert.ok([...table.values()].every((declaration) => /transform: translateY\([-\d.]+%\) rotate\(/.test(declaration)));
    assert.equal(keys[0].ty, 118, `${name} starts hidden`);
    assert.equal(keys.at(-1)?.ty, 118, `${name} ends hidden`);
    assert.equal(keys.at(-1)?.t, BEATS.sinkEnd);
    const sinkFrom = [...keys].reverse().find((key) => key.ty !== 118);
    assert.ok(sinkFrom && close(sinkFrom.t, BEATS.sinkStart, 1e-9), 'the sink starts 0.2 s after the hit');
    assert.ok(BEATS.sinkStart - burst <= .22 && BEATS.sinkEnd - burst <= .45, 'the corner cards are clear 0.45 s after the hit');
    assert.ok(BEATS.happy < BEATS.sinkStart - .1, 'the happy grin reads before they duck');
    assert.ok(animationOf(`.cf-popper.is-${sign > 0 ? 'left' : 'right'}`).startsWith(`${name} ${POPPER_TIMELINE_MS}ms`));
    assert.equal(POPPER_TIMELINE_MS / 1000, BEATS.sinkEnd);
    // Squash and stretch conserve roughly the same volume.
    for (const key of keys) assert.ok(key.sx * key.sy > .88 && key.sx * key.sy < 1.12, `${name} volume at ${key.t} s`);
  }
  // Pip's crouch is held long enough to read (>= 120 ms at about 1.1 x .85), then the little "pop" stretches.
  const crouch = PIP_KEYS.filter((key) => key.sx >= 1.1 && key.sy <= .85 && key.t < burst);
  assert.ok(crouch.length >= 2 && crouch.at(-1)!.t - crouch[0].t >= .1 && crouch[0].t === BEATS.crouch, 'crouch held');
  assert.ok(PIP_KEYS.some((key) => key.t > BEATS.puff && key.t <= BEATS.freezeEnd && key.sy >= 1.14), 'the little "pop" stretch and freeze');
  const tilt = Math.min(...PIP_KEYS.filter((key) => key.t > BEATS.tuftLands && key.t < BEATS.squeeze).map((key) => key.r));
  assert.ok(38 - tilt >= 7, 'a clear sheepish tilt');
  const shake = POP_KEYS.filter((key) => key.t >= BEATS.popShake[0] && key.t <= BEATS.popShake[1]).map((key) => key.r + 38);
  assert.ok(Math.min(...shake) <= -6 && Math.max(...shake) >= 6, "Pop's head-shake swings about +-7 degrees");
  // Faces: every swap track is 2.0 s, discrete, and tells the story.
  const faceTracks = Array.from(css.matchAll(/animation: (pp-[\w-]+) (\d+)ms/g));
  assert.ok(faceTracks.length >= 17 && faceTracks.every((match) => Number(match[2]) === FACE_TIMELINE_MS), 'every face track is 2.0 s long');
  const shown = (track: keyof typeof FACE_STEPS, t: number) => [...FACE_STEPS[track]].reverse().find(([time]) => time <= t)?.[1];
  assert.equal(shown('pp-mm-l', BEATS.crouch + .02), 1, 'Pip holds it in');
  assert.equal(shown('pp-o-l', BEATS.puff + .05), 1, 'the little "pop"');
  assert.equal(shown('pp-blink-l', BEATS.tuftLands + .02), 1, 'Pip blinks as the tuft lands');
  assert.equal(shown('pp-blush-lines-l', BEATS.tuftLands + .1), 1, 'Pip blushes');
  assert.equal(shown('pp-blink-r', BEATS.spotOnPop + .01), 1, 'Pop blinks as the light hits it');
  for (const t of [BEATS.sideEye, (BEATS.sideEye + BEATS.spotLeavesPop) / 2, BEATS.spotLeavesPop]) {
    assert.equal(shown('pp-lids-r', t), 1, `Pop's half-lid side-eye is on in the light at ${t} s`);
    assert.equal(shown('pp-hmm-r', t), 1, `with its wavy mouth at ${t} s`);
  }
  assert.ok(FACE_STEPS['pp-lids-r'].every(([t, opacity]) => opacity === 0 || t >= BEATS.spotOnPop), 'the side-eye never starts in the dark');
  // Pop fires from its aim: the emitter, muzzle and hit sit on its 28-degree axis.
  assert.ok(close(mouthShares(POP_AIM_DEG).side, POP_MOUTH.side, .001) && close(mouthShares(POP_AIM_DEG).up, POP_MOUTH.up, .001));
  assert.ok(close(mouthShares(38).side, .768, .01) && close(mouthShares(38).up, .6, .01), "Pip's mouth sits on its 38-degree lean");
  assert.ok(css.includes(`.cf-emitter.is-right { right: calc(4vw + var(--pp) * ${cssNumber(POP_MOUTH.side)}); bottom: calc(34px + var(--pp) * ${cssNumber(POP_MOUTH.up)}); }`));
  for (const [selector, along] of [['.cf-muzzle.is-right', 5], ['.cf-hit.is-right', 2]] as const) {
    // "right: calc(4vw + var(--pp) * SIDE + DXvmin); bottom: calc(34px + var(--pp) * UP + DYvmin)"
    const [, side, dx, , up, dy] = numbers(/right: calc\(([^;]*)\); bottom: calc\(([^;]*)\)/.exec(rule(selector))?.slice(1).join(' ') ?? '');
    assert.ok(close(side, POP_MOUTH.side, 1e-9) && close(up, POP_MOUTH.up, 1e-9), `${selector} starts at Pop's mouth`);
    assert.ok(close(Math.atan2(dx, dy) * 180 / Math.PI, POP_AIM_DEG, .5) && close(Math.hypot(dx, dy), along, .02), `${selector} sits ${along}vmin out along the aim`);
  }
  assert.equal(shown('pp-squint', BEATS.squeeze + .1), 1, 'both squeeze before the POP');
  assert.equal(shown('pp-after', BEATS.happy), 1, 'happy grin after the POP');
  for (const [name, list] of [...Object.entries(FACE_STEPS), ...Object.entries(LOOK_KEYS)]) {
    assert.ok(list.every(([t]) => t <= FACE_TIMELINE_MS / 1000), `${name} fits its track`);
  }
  assert.ok(BLUSH_KEYS.at(-1)![0] <= FACE_TIMELINE_MS / 1000);
  // The tuft lands at 1.10 s with a squash and is blasted off by the POP.
  const land = TUFT_KEYS.find((key) => close(key.t, BEATS.tuftLands, 1e-9));
  assert.deepEqual(land && [land.x, land.y, land.o], [0, 0, 1]);
  assert.ok(TUFT_KEYS.some((key) => key.t > BEATS.tuftLands && key.sx >= 1.3 && key.sy <= .6), 'visible squash on landing');
  assert.equal(TUFT_KEYS.at(-1)?.o, 0);
  // The POP reads on its first frames: hit and muzzle are drawn in FRONT of the poppers and are visible from ~2 ms.
  const popperAt = stageSource.indexOf('cf-popper is-right');
  assert.ok(stageSource.indexOf('"cf-muzzle is-left"') > popperAt && stageSource.indexOf('"cf-hit is-left"') > popperAt);
  assert.match(keyframes('cf-hit').get(2) ?? '', /opacity: 1/);
  assert.match(keyframes('cf-muzzle').get(3) ?? '', /opacity: 1/);
  assert.match(keyframes('cf-badge-l').get(3) ?? '', /scale\(\.42\).*opacity: 1/, 'the POP! word is already readable after the hit');
  assert.match(keyframes('cf-badge-l').get(0) ?? '', /scale\(\.35\)/);
  for (const side of ['left', 'right'] as const) {
    const name = `cf-badge-${side[0]}`;
    assert.ok(animationOf(`.cf-badge.is-${side}`).startsWith(`${name} ${BADGE_MS}ms calc(var(--cf-burst) + ${BADGE_DELAY_MS}ms)`));
    // Solid all the way: once in, a badge is only see-through when it has shrunk to a speck.
    for (const [percent, declaration] of keyframes(name)) {
      const opacity = Number(/opacity: ([\d.]+)/.exec(declaration)?.[1]);
      const scale = Number(/scale\(([\d.]+)\)/.exec(declaration)?.[1]);
      if (percent > 0 && opacity < 1) assert.ok(scale <= .12, `${name} ${percent}% is a speck before it fades`);
    }
  }
  assert.ok(burst + (BADGE_DELAY_MS + BADGE_MS) / 1000 <= 2.18, 'badges gone 0.33 s after the hit');
  // Both lean over the empty right side of their corner card (names and labels are left-aligned).
  assert.ok(rule('.cf-badge.is-left').includes(`left: calc(4vw + var(--pp) * .6 + ${BADGE_SHIFT_VMIN}vmin)`));
  assert.ok(rule('.cf-badge.is-right').includes(`right: calc(4vw + var(--pp) * .6 - ${BADGE_SHIFT_VMIN}vmin)`));
});

void test("Pip's early little pop is a fanned puff and a mini badge that resolve before the real POP", () => {
  const puff = falseStartPuff();
  assert.equal(puff.length, 8);
  const angles = puff.map((piece) => Math.atan2(piece.rise, piece.dx) * 180 / Math.PI);
  assert.ok(Math.min(...angles) >= 29.5 && Math.max(...angles) <= 70.5 && Math.max(...angles) - Math.min(...angles) >= 39, 'fanned over 30-70 degrees');
  const distances = puff.map((piece) => Math.hypot(piece.dx, piece.rise));
  assert.ok(Math.max(...distances) - Math.min(...distances) >= 8, 'scattered, not a dotted line');
  assert.ok(new Set(puff.map((piece) => piece.delay)).size >= 6, 'staggered');
  for (const piece of puff) {
    const tracks = puffTracks(piece, 1280, 800);
    assertTrack(tracks.move, 'puff move');
    assertTrack(tracks.fade, 'puff fade');
    assert.equal(tracks.move.timing.delay, PUFF_AT_MS + piece.delay);
    assert.ok(tracks.move.timing.delay + tracks.move.timing.duration < CONFETTI_BURST_MS, 'resolves before the real POP');
    assert.ok(tracks.fade.frames.every((frame) => frame.transform === undefined), 'the fade track never fights the move track');
    assert.equal(tracks.fade.frames.at(-1)?.opacity, 0);
    assert.equal(tracks.fade.frames.find((frame) => frame.offset === PUFF_FADE_FROM)?.opacity, 1, 'opaque until it has dropped out of sight');
    assert.deepEqual(tracks.move.frames.map((frame) => frame.offset), [...PUFF_STOPS]);
    // Paper, not flat squares: every frame carries the same tumble and a 3D flip of 1.5+ turns (like the jets).
    assert.ok(piece.turns >= 1.5 && tracks.move.frames.every((frame, i) => frame.transform?.includes(`rotate3d(${piece.ax}, ${piece.ay}, .35, ${Math.round(piece.turns * 360 * PUFF_STOPS[i] * 10) / 10}deg)`)));
    for (const [width, height] of VIEWPORTS) {
      const vmin = Math.min(width, height) / 100;
      const path = Array.from({ length: 201 }, (_, i) => puffPoint(piece, width, height, i / 200));
      // Out fast: the top of the arc after 12% of the move, then no hovering: it only falls from there.
      const apex = puffPoint(piece, width, height, PUFF_APEX);
      assert.ok(close(apex.y, -piece.rise * vmin, 1e-6) && close(apex.x, piece.dx * vmin, 1e-6), 'tops out on the fan');
      assert.ok(close(Math.min(...path.map((point) => point.y)), apex.y, 1e-6), 'the apex is the top of the arc');
      path.forEach((point, i) => { if (i > 0 && i / 200 > PUFF_APEX) assert.ok(point.y > path[i - 1].y, 'always falling after the apex'); });
      assert.ok(puffPoint(piece, width, height, 1).y >= 18 * vmin, 'falls at least 18vmin below the mouth');
      // The move frames sit exactly on the path.
      if (width === 1280) {
        for (const frame of tracks.move.frames) {
          const [x, y] = numbers(/translate3d\(([^)]*)\)/.exec(frame.transform ?? '')?.[1] ?? '');
          const at = puffPoint(piece, width, height, frame.offset);
          assert.ok(close(x, at.x, .06) && close(y, at.y, .06), 'frame matches the arc');
        }
      }
      // Still fully opaque until it is behind the footer line (the stage's clip), so nothing fades out in mid-air.
      const mouth = popperMouthPx(width, height, 1);
      assert.ok(mouth.bottom - puffPoint(piece, width, height, PUFF_FADE_FROM).y <= FOOTER_CLIP_PX, `${width}x${height}: behind the footer before it fades`);
    }
  }
  assert.equal(PUFF_MS, 620);
  // A real sound word, small and lowercase (the comic convention for a little sound), that sets up the big POP!.
  assert.match(stageSource, /strokeLinejoin="round">pop<\/text>/);
  assert.ok(!/>pip!?</.test(stageSource));
  assert.ok(css.includes(`animation: cf-pip-badge ${PIP_BADGE_MS}ms ${PUFF_AT_MS}ms`));
  assert.ok(PUFF_AT_MS / 1000 === BEATS.puff && PUFF_AT_MS + PIP_BADGE_MS < BEATS.spotLeavesPip * 1000 + 150);
});

/** Checks shared by every Web Animations track: well-formed, finite, and finished by the clear. */
function assertTrack(track: Track, label: string) {
  const offsets = track.frames.map((frame) => frame.offset);
  assert.equal(offsets[0], 0, `${label} starts at 0`);
  assert.equal(offsets.at(-1), 1, `${label} ends at 1`);
  assert.ok(offsets.every((offset, i) => i === 0 || offset > offsets[i - 1]), `${label} offsets ascend`);
  for (const frame of track.frames) {
    if (frame.transform) assert.ok(!/NaN|Infinity|var\(/.test(frame.transform), `${label}: ${frame.transform}`);
    if (frame.opacity !== undefined) assert.ok(frame.opacity >= 0 && frame.opacity <= 1);
  }
  assert.equal(track.timing.fill, 'both');
  const iterations = track.timing.iterations ?? 1;
  assert.ok(Number.isFinite(iterations), `${label} is finite`);
  assert.ok(track.timing.delay + track.timing.duration * iterations <= CONFETTI_CLEAR_MS + 1100, `${label} ends in time`);
}

void test('confetti fountains frame the centre stage and every piece leaves the screen before it fades', () => {
  const left = confettiJet(1, 7);
  const right = confettiJet(-1, 11);
  assert.deepEqual(confettiJet(1, 7), left, 'deterministic');
  assert.equal(left.length, JET_COUNT);
  assert.equal(right.length, JET_COUNT, "Pop's fountain is as dense as Pip's");
  for (const [side, jet] of [[1, left], [-1, right]] as const) {
    const range = side > 0 ? JET_REACH_RANGE : POP_JET_REACH_RANGE;
    assert.equal(jet.filter((piece) => piece.kind === 'star').length, 4);
    assert.ok(jet.filter((piece) => piece.kind === 'dot').length >= 5);
    assert.equal(new Set(jet.map((piece) => piece.tone)).size, CONFETTI_PALETTE.length, 'all six tones');
    if (side > 0) assert.ok(jet.some((piece) => piece.reach > .7) && jet.some((piece) => piece.reach < -.3), "Pip's fountain fans both ways");
    else assert.ok(jet.every((piece) => piece.reach <= -.25) && jet.some((piece) => piece.reach <= -.85), "Pop's fountain only goes up and out");
    for (const piece of jet) {
      assert.ok(piece.reach >= range[0] && piece.reach <= range[1]);
      assert.ok(piece.rise >= 24 && piece.rise <= 60);
      assert.equal(piece.drop, Math.round((piece.rise + 34) * 100) / 100);
      assert.ok(piece.delay >= 0 && piece.delay <= 90);
      assert.ok(CONFETTI_BURST_MS + piece.delay + piece.duration <= CONFETTI_CLEAR_MS, 'lands before the clear');
      assert.ok(piece.duration <= 2500, 'falls briskly through the name rows');
      assert.ok(Math.abs(piece.sway) <= 3);
      assert.ok(piece.turns >= 2 && piece.turns <= 8 && close(piece.turns, piece.duration / piece.flipMs), 'a lively but readable tumble');
      for (const [width, height] of VIEWPORTS) {
        const mouth = popperMouthPx(width, height, side);
        const apexY = height - mouth.bottom - piece.rise * height / 100;
        assert.ok(apexY >= HEADER_PX, `${width}x${height}: apex below the header`);
        // Opacity holds to 94% of the flight: by then the piece must be below the footer's top edge.
        assert.ok(height - mouth.bottom + jetPoint(piece, side, width, height, JET_FADE[1]).y >= height - FOOTER_PX, `${width}x${height}: no piece vanishes mid-air`);
        const landX = mouthX(width, height, side) + side * jetDxPx(piece.reach, width, height, side);
        assert.ok(landX >= .02 * width && landX <= .98 * width, `${width}x${height}: lands on screen`);
      }
    }
  }
  // The centre stage stays clear: the widest inward piece (plus sway and its own size) stops short of the middle 2 x 192 px.
  for (const [width, height] of VIEWPORTS) {
    const vmin = Math.min(width, height) / 100;
    const inner = popperMouthPx(width, height).left + jetReachPx(width, height) + (3 + 2.7) * vmin;
    assert.ok(inner <= width / 2 - CENTRE_GUTTER_PX - CENTRE_HALF_PX + .5 || jetReachPx(width, height) <= 5 * vmin + 1e-9, `${width}x${height}: fountains frame the middle`);
    assert.ok(jetReachOutPx(width, height) > 0 && popperMouthPx(width, height).left - jetReachOutPx(width, height) - 3 * vmin >= 0, `${width}x${height}: Pip's outward paper stays on screen`);
    assert.ok(popReachOutPx(width, height) > 0 && popperMouthPx(width, height, -1).left - popReachOutPx(width, height) - 3 * vmin >= 0, `${width}x${height}: Pop's paper stays on screen`);
  }
  // The picker's name area stays free of paper for the whole flight, sampled along the exact path the browser plays.
  for (const size of Object.keys(PICKER_CARDS) as (keyof typeof PICKER_CARDS)[]) {
    const [width, height] = size.split('x').map(Number);
    const vmin = Math.min(width, height) / 100;
    const rect = pickerClearRect(size);
    for (const [side, jet] of [[1, left], [-1, right]] as const) {
      const mouth = popperMouthPx(width, height, side);
      for (const piece of jet) {
        for (let step = 0; step <= 50; step++) {
          const at = jetPoint(piece, side, width, height, step / 50);
          const x = mouthX(width, height, side) + at.x;
          const y = height - mouth.bottom + at.y;
          const radius = 2.7 * vmin;
          const inside = x + radius >= rect.left && x - radius <= rect.right && y + radius >= rect.top && y - radius <= rect.bottom;
          assert.ok(!inside, `${size}: a ${side > 0 ? 'Pip' : 'Pop'} piece enters the name area at ${step / 50}`);
        }
      }
    }
  }
});

void test("Pop's fountain goes up and out, never back over the right-hand card's left-aligned names", () => {
  // Team names and station labels are left-aligned, so the right-hand card's names end near Pop's mouth. From 150 ms after
  // the hit, no Pop piece may be in the 90 px band left of the mouth anywhere between the header line and the mouth
  // height, and from 300 ms its whole body (1.2vmin) is right of the mouth line. Sampled along the exact paths played.
  const jet = confettiJet(-1, 11);
  for (const [width, height] of [[1280, 800], [1366, 768], [1920, 1080], [960, 680], [1024, 768]] as const) {
    const vmin = Math.min(width, height) / 100;
    const x0 = mouthX(width, height, -1);
    const y0 = height - popperMouthPx(width, height, -1).bottom;
    for (const piece of jet) {
      for (let step = 0; step <= 400; step++) {
        const p = step / 400;
        const after = piece.delay + p * piece.duration;
        const at = jetPoint(piece, -1, width, height, p);
        const [x, y] = [x0 + at.x, y0 + at.y];
        if (after < 150 || y > y0 || y < HEADER_PX) continue;
        assert.ok(!(x >= x0 - 90 && x < x0), `${width}x${height}: a Pop piece is left of its mouth ${Math.round(after)} ms after the hit`);
        if (after >= 300) assert.ok(x - x0 >= 1.2 * vmin, `${width}x${height}: a Pop piece's body touches the mouth line at ${Math.round(after)} ms`);
      }
      // It lands outward, on screen, with its own size and flutter.
      for (let step = 0; step <= 100; step++) {
        const x = x0 + jetPoint(piece, -1, width, height, step / 100).x;
        assert.ok(x + 1.3 * piece.scale * vmin <= width, `${width}x${height}: Pop's paper stays on screen`);
      }
      assert.ok(jetPoint(piece, -1, width, height, 1).x > 0);
    }
  }
});

/** Today table text edges measured in the lab (work/build/confetti/table-edges.cjs), as StudentConfetti's measureTable() reads them. */
const TABLES = [
  { size: [1280, 800], label: '5 x 3', edges: { teamTextRight: 212, roundLeft: 348, lastTextRight: 1088, lastRight: 1229 } },
  { size: [1280, 800], label: '12 x 4', edges: { teamTextRight: 212, roundLeft: 348, lastTextRight: 1163, lastRight: 1229 } },
  { size: [960, 680], label: '5 x 3', edges: { teamTextRight: 217, roundLeft: 272, lastTextRight: 852, lastRight: 909 } },
  { size: [960, 680], label: '12 x 4 (scrolled)', edges: { teamTextRight: 217, roundLeft: 310, lastTextRight: 838, lastRight: 869 } },
  { size: [1920, 1080], label: '8 x 4', edges: { teamTextRight: 252, roundLeft: 512, lastTextRight: 1687, lastRight: 1869 } },
  { size: [1366, 768], label: '6 x 3', edges: { teamTextRight: 212, roundLeft: 370, lastTextRight: 1153, lastRight: 1315 } },
] as const;

void test('on the Today table both fountains fall in the blank lanes between the labels', () => {
  assert.equal(tableLanes(null, 1280, 800), null, 'no table: the normal fountains');
  assert.equal(tableLanes({ teamTextRight: 0, roundLeft: 348, lastTextRight: 1088, lastRight: 1229 }, 1280, 800), null, 'not laid out');
  assert.equal(tableLanes({ teamTextRight: 212, roundLeft: Number.NaN, lastTextRight: 1088, lastRight: 1229 }, 1280, 800), null);
  for (const { size: [width, height], label, edges } of TABLES) {
    const lanes = tableLanes(edges, width, height);
    assert.ok(lanes, `${width}x${height} ${label}: lanes`);
    for (const [side, jet, lane, from, to] of [
      [1, confettiJet(1, 7), lanes.left, edges.teamTextRight, edges.roundLeft],
      [-1, confettiJet(-1, 11), lanes.right, edges.lastTextRight, edges.lastRight + 8 + TABLE_LANE_PAD_PX],
    ] as const) {
      assert.ok(lane[1] > lane[0] && lane[1] - lane[0] <= to - from, `${label}: a lane inside the gap`);
      assert.ok(lane[1] - lane[0] >= Math.min(TABLE_LANE_MIN_PX, to - from) - 20, `${label}: a usable lane`);
      const x0 = mouthX(width, height, side);
      const y0 = height - popperMouthPx(width, height, side).bottom;
      for (const piece of jet) {
        assert.ok(close(laneDxPx(piece, side, lane), Math.min(Math.max(laneDxPx(piece, side, lane), lane[0]), lane[1]), 1e-9), 'lands inside its lane');
        for (let step = 0; step <= 100; step++) {
          const p = step / 100;
          const at = jetPoint(piece, side, width, height, p, lane);
          // Once it tops out and falls past the rows it stays in the gap: off the names on the left, off the next labels on the right.
          if (p >= .32 && y0 + at.y < height - FOOTER_CLIP_PX) {
            assert.ok(x0 + at.x >= from - 2 && x0 + at.x <= to + 2, `${width}x${height} ${label}: a ${side > 0 ? 'Pip' : 'Pop'} piece falls over a label at x ${Math.round(x0 + at.x)} (${from}-${to})`);
          }
        }
        // The flight is the same path the browser plays.
        const track = jetTrack(piece, side, width, height, lane);
        const last = numbers(/translate3d\(([^)]*)\)/.exec(track.frames.at(-1)?.transform ?? '')?.[1] ?? '');
        assert.ok(close(last[0], jetPoint(piece, side, width, height, 1, lane).x, .06));
      }
    }
  }
  // The stage measures the table once and keeps the streamers home on Today.
  assert.match(stageSource, /querySelector\('\.student-day-table-wrap'\)/);
  assert.match(stageSource, /if \(!table\)[^\n]*cf-streamer/);
});

void test('on the picker the cover burst frames the picked name and never crosses it', () => {
  const bits = coverBurstBits();
  const placed = pickerBurstBits(bits.length);
  assert.equal(placed.length, bits.length);
  assert.deepEqual(pickerBurstBits(bits.length), placed, 'deterministic');
  assert.equal(PICKER_SPARKLES.length, COVER_SPARKLES.length);
  assert.ok(placed.filter((bit) => bit.x < 50).length >= 4 && placed.filter((bit) => bit.x > 50).length >= 4 && placed.some((bit) => bit.y < 15), 'both sides and the top');
  assert.ok(PICKER_BURST.from >= .55 && PICKER_BURST.to > 1, 'grows outward from well past the name');
  const box = PICKER_NAME_BOX;
  assert.deepEqual(box, { left: 30, right: 70, top: 30, bottom: 92 }, 'the same name area the stage keeps clear');
  for (const size of Object.keys(PICKER_CARDS) as (keyof typeof PICKER_CARDS)[]) {
    const [width, height] = size.split('x').map(Number);
    const vmin = Math.min(width, height) / 100;
    const [left, top, right, bottom] = PICKER_CARDS[size];
    const [cardW, cardH] = [right - left, bottom - top];
    const items = [
      ...bits.map((bit, i) => ({ at: placed[i], w: bit.width, h: bit.height })),
      ...COVER_SPARKLES.map((spark, i) => ({ at: PICKER_SPARKLES[i], w: spark.size, h: spark.size })),
    ];
    // Every frame of the burst: from its first (smallest) size to its last, with the drop growing on the same easing.
    for (let step = 0; step <= 40; step++) {
      const k = step / 40;
      const scale = PICKER_BURST.from + (PICKER_BURST.to - PICKER_BURST.from) * k;
      const drop = PICKER_BURST.dropPct / 100 * cardH * k;
      for (const item of items) {
        // Worst case for a turned bit: its half diagonal (sizes in vmin; the 3.4%-per-vmin cap never bites on this card).
        const half = Math.hypot(Math.min(item.w * vmin, item.w * COVER_BIT_CAP_PCT / 100 * cardW), Math.min(item.h * vmin, item.h * COVER_BIT_CAP_PCT / 100 * cardH)) / 2 * scale;
        const x = cardW / 2 + (item.at.x / 100 * cardW - cardW / 2) * scale;
        const y = cardH / 2 + (item.at.y / 100 * cardH - cardH / 2) * scale + drop;
        const inside = x + half > cardW * box.left / 100 && x - half < cardW * box.right / 100 && y + half > cardH * box.top / 100 && y - half < cardH * box.bottom / 100;
        assert.ok(!inside, `${size}: a burst bit at (${item.at.x}%, ${item.at.y}%) crosses the name at ${Math.round(k * 100)}%`);
        const caption = PICKER_CAPTION_BOX;
        const onCaption = x + half > cardW * caption.left / 100 && x - half < cardW * caption.right / 100 && y + half > cardH * caption.top / 100 && y - half < cardH * caption.bottom / 100;
        assert.ok(!onCaption, `${size}: a burst bit at (${item.at.x}%, ${item.at.y}%) lands on the "A moment to shine" caption at ${Math.round(k * 100)}%`);
        assert.ok(x >= 0 && x <= cardW && y >= 0 && y <= cardH, `${size}: the bit stays on the card`);
      }
    }
  }
});

void test('each jet plays the shared drag + gravity arc as a static px Web Animation', () => {
  const ascending = (values: readonly number[]) => values.every((value, i) => i === 0 || value > values[i - 1]);
  assert.ok(ascending(FLIGHT_STOPS) && ascending(FLIGHT_X) && ascending(FLIGHT_RISE) && ascending(FLIGHT_FALL));
  assert.equal(FLIGHT_STOPS[5], .24, 'apex at 24% of the flight');
  const piece = { dx: 40, rise: 50, drop: 84 };
  const path = FLIGHT_STOPS.map((_, i) => flightStop(piece, i));
  assert.deepEqual(path[0], { x: 0, y: 0 });
  assert.equal(Math.min(...path.map((point) => point.y)), -50, 'the apex is the rise');
  assert.equal(path.at(-1)?.y, 34, 'lands 34 below the mouth');
  for (const [side, jet] of [[1, confettiJet(1, 7)], [-1, confettiJet(-1, 11)]] as const) {
    for (const jetPiece of jet) {
      const track = jetTrack(jetPiece, side, 1280, 800);
      assertTrack(track, 'jet');
      assert.deepEqual(track.frames.map((frame) => frame.offset), [...FLIGHT_STOPS.slice(0, 1), JET_FADE[0], ...FLIGHT_STOPS.slice(1, 11), JET_FADE[1], ...FLIGHT_STOPS.slice(11)]);
      assert.equal(track.timing.delay, CONFETTI_BURST_MS + jetPiece.delay);
      assert.equal(track.timing.duration, jetPiece.duration);
      for (const frame of track.frames) {
        const [x, y] = numbers(/translate3d\(([^)]*)\)/.exec(frame.transform ?? '')?.[1] ?? '');
        const at = jetPoint(jetPiece, side, 1280, 800, frame.offset);
        assert.ok(close(x, at.x, .06) && close(y, at.y, .06), 'frame matches the arc');
        assert.ok(frame.transform?.includes(`rotate3d(${jetPiece.ax}, ${jetPiece.ay}, .35, ${Math.round(jetPiece.turns * frame.offset * 3600) / 10}deg)`), 'the paper flip rides the same track');
        assert.equal(frame.opacity, frame.offset > 0 && frame.offset < 1 ? 1 : 0);
      }
      // Pip's pieces lean right, Pop's left, by the same shares.
      assert.ok(Math.sign(jetPoint(jetPiece, side, 1280, 800, 1).x) === Math.sign(side * jetPiece.reach) || jetPiece.reach === 0);
    }
  }
});

void test('streamers unfurl high in the corners, stay under the header line and out of the picked name, then fall away solid', () => {
  const sides = [[1, confettiStreamers(1, 13)], [-1, confettiStreamers(-1, 17)]] as const;
  assert.deepEqual(confettiStreamers(1, 13), sides[0][1], 'deterministic');
  for (const [side, streamers] of sides) {
    assert.equal(streamers.length, 3, '3 per side');
    for (const streamer of streamers) {
      assert.equal(streamer.anchor, side > 0 ? 'mouth' : 'edge');
      assert.ok(streamer.length >= 18 && streamer.length <= 24);
      assert.ok(streamer.delay + streamer.duration <= 2000, 'gone about 2 s after the pop');
      const end = streamer.a0 + streamer.spin;
      assert.ok(Math.abs(Math.cos(end * Math.PI / 180)) <= .35 && Math.sin(end * Math.PI / 180) > .9, 'ends hanging down');
      const tracks = streamerTracks(streamer, side, 1280, 800);
      assertTrack(tracks.flight, 'streamer flight');
      assertTrack(tracks.unfurl, 'streamer unfurl');
      for (const frame of tracks.flight.frames) {
        const pose = streamerPose(streamer, side, 1280, 800, frame.offset);
        const [x, y] = numbers(/translate3d\(([^)]*)\)/.exec(frame.transform ?? '')?.[1] ?? '');
        assert.ok(close(x, pose.x, .06) && close(y, pose.y, .06) && frame.opacity === pose.opacity, 'flight frame matches the pose');
      }
      assert.equal(tracks.flight.frames.find((frame) => frame.offset === STREAMER_FADE_FROM)?.opacity, 1);
      // No see-through ribbon: fully opaque from its first frames until it has dropped out of sight behind the footer.
      assert.ok(tracks.flight.frames.every((frame) => frame.offset < .03 || frame.offset > STREAMER_FADE_FROM || frame.opacity === 1));
      for (const [width, height] of VIEWPORTS) {
        const pose = streamerPose(streamer, side, width, height, STREAMER_FADE_FROM);
        const angle = pose.angle * Math.PI / 180;
        const anchorY = height - popperMouthPx(width, height, side).bottom + pose.y;
        const top = anchorY + Math.min(0, Math.sin(angle) * pose.length * pose.scaleX) - pose.length * .1105 * pose.scaleY * Math.abs(Math.cos(angle));
        assert.ok(top >= height - FOOTER_CLIP_PX, `${width}x${height}: the ribbon is behind the footer (${Math.round(top)} px) before it is switched off`);
        // And it falls: lower at every later stop of the drape.
        const ys = [.256, .4, .56, .76, 1].map((p) => streamerPose(streamer, side, width, height, p).y);
        assert.ok(ys.every((y, i) => i === 0 || y > ys[i - 1]));
      }
      for (let step = 0; step <= 100; step++) {
        const p = step / 100;
        for (const [width, height] of VIEWPORTS) {
          const mouth = popperMouthPx(width, height, side);
          const pose = streamerPose(streamer, side, width, height, p);
          const angle = pose.angle * Math.PI / 180;
          const anchorY = height - mouth.bottom + pose.y;
          const tipY = anchorY + Math.sin(angle) * pose.length * pose.scaleX;
          const half = pose.length * .1105 * pose.scaleY;
          // Both swing clockwise (rightward): away from the left-aligned team names.
          if (step) assert.ok(pose.angle >= streamer.a0, 'swings clockwise');
          assert.ok(Math.min(anchorY, tipY) - half >= STREAMER_CEILING_PX - 12, `${width}x${height}: coil top ${Math.round(Math.min(anchorY, tipY) - half)} px stays under the header at ${p}`);
        }
        for (const size of Object.keys(PICKER_CARDS) as (keyof typeof PICKER_CARDS)[]) {
          const [width, height] = size.split('x').map(Number);
          const rect = pickerClearRect(size);
          const mouth = popperMouthPx(width, height, side);
          const pose = streamerPose(streamer, side, width, height, p);
          const angle = pose.angle * Math.PI / 180;
          const half = pose.length * .1105 * pose.scaleY;
          for (let k = 0; k <= 10; k++) {
            const x = mouthX(width, height, side) + pose.x + Math.cos(angle) * pose.length * pose.scaleX * k / 10;
            const y = height - mouth.bottom + pose.y + Math.sin(angle) * pose.length * pose.scaleX * k / 10;
            const inside = x >= rect.left - half && x <= rect.right + half && y >= rect.top - half && y <= rect.bottom + half;
            assert.ok(!inside, `${size}: a streamer crosses the picked name at ${p}`);
          }
        }
      }
    }
  }
});

void test('the gold star shower falls in three parallax tiers and has left the screen before the stage fade', () => {
  const stars = starShower();
  assert.deepEqual(starShower(), stars);
  assert.equal(stars.length, 24);
  assert.ok(SHOWER_TIER_SIZE[0] < SHOWER_TIER_SIZE[1] && SHOWER_TIER_SIZE[1] < SHOWER_TIER_SIZE[2], 'nearer stars are bigger');
  assert.ok(SHOWER_TIER_MS[0] > SHOWER_TIER_MS[1] && SHOWER_TIER_MS[1] > SHOWER_TIER_MS[2], 'nearer stars fall faster');
  for (const star of stars) {
    assert.ok(star.delay >= BEATS.sinkEnd * 1000 && star.delay <= CONFETTI_BURST_MS + 1200, 'starts as the poppers have ducked away');
    assert.ok(star.delay + star.duration <= CONFETTI_CLEAR_MS);
    assert.ok(star.x >= 4 && star.x <= 96);
    assert.ok(STAR_FALL_VH / (star.duration / 1000) <= 86, 'a gentle fall (at most 86vh a second), never a streak');
    // Out of sight (below the footer clip line, allowing for its turn and twinkle) before the stage's safety fade starts.
    for (const [width, height] of VIEWPORTS) {
      const size = star.size * Math.min(width, height) / 100;
      const top = HEADER_PX - STAR_START_VH * height / 100 - .29 * size;
      const gone = star.delay + star.duration * (height - FOOTER_CLIP_PX - top) / (STAR_FALL_VH * height / 100);
      assert.ok(gone <= STAGE_FADE[0] * CONFETTI_DURATION_MS, `${width}x${height}: a star is still in view at ${Math.round(gone)} ms`);
      assert.ok(top + STAR_FALL_VH * height / 100 >= height - FOOTER_CLIP_PX, 'its fall ends below the footer line');
      assert.ok(HEADER_PX - STAR_START_VH * height / 100 + size <= HEADER_PX + 1, 'it starts hidden above the header line');
    }
    // Static CSS: the star's own rule carries its timing, and its fall block ends 104vh down (below the footer).
    const i = stars.indexOf(star);
    assert.ok(rule(`.cf-star.is-s${i} > .cf-star-fall`).includes(`animation: cf-fall-${i} ${star.duration}ms ${star.delay}ms linear both`));
    const sway = /animation: cf-sway-\d+ (\d+)ms (\d+)ms ease-in-out (\d+) alternate both/.exec(rule(`.cf-star.is-s${i}`));
    assert.ok(sway && Number(sway[1]) === star.swayMs && Number(sway[2]) === star.delay, 'sways from its fall start');
    assert.ok(sway && Number(sway[2]) + Number(sway[1]) * Number(sway[3]) <= CONFETTI_DURATION_MS + star.swayMs, 'a finite sway (nothing outlives the reveal)');
    const fall = keyframes(`cf-fall-${i}`);
    assert.equal(fall.size, 10);
    assert.match(fall.get(0) ?? '', /translate3d\(0, 0vh, 0\).*opacity: 0;/);
    assert.ok((fall.get(100) ?? '').includes(`translate3d(0, ${STAR_FALL_VH}vh, 0) rotate(${star.spin}deg)`), 'falls 104vh with its whole spin');
  }
  assert.deepEqual([0, 1, 2].map((tier) => stars.filter((star) => star.tier === tier).length), [8, 8, 8]);
  for (const glint of showerGlints()) assert.ok(glint.delay + GLINT_MS <= STAGE_FADE[0] * CONFETTI_DURATION_MS && glint.y >= 14 && glint.y <= 70);
  assert.ok(rule('.cf-star').includes(`top: -${STAR_START_VH}vh;`));
  // The shower is clipped at the header line, so falling stars never ghost through the see-through header.
  assert.match(rule('.cf-shower'), new RegExp(`top: ${HEADER_PX}px; bottom: 0; overflow: hidden`));
  assert.ok(css.includes(`top: calc(var(--y) - ${HEADER_PX}px)`), 'glints keep their place inside the clip');
  // The stage starts every measured per-piece track once at mount (with its CSS) and cancels it on unmount.
  assert.match(stageSource, /useLayoutEffect\(/);
  assert.match(stageSource, /animation\.cancel\(\)/);
  for (const builder of ['jetTrack(', 'streamerTracks(', 'puffTracks(']) assert.ok(stageSource.includes(builder), `the stage plays ${builder}`);
  assert.ok(stageSource.includes('is-s${i}'), 'each star element takes its generated rule');
});

void test('everything on the stage has finished moving before the reveal unmounts', () => {
  const ends = [
    ...confettiJet(1, 7).map((piece) => CONFETTI_BURST_MS + piece.delay + piece.duration),
    ...confettiStreamers(-1, 17).map((streamer) => CONFETTI_BURST_MS + streamer.delay + streamer.duration),
    ...starShower().map((star) => star.delay + star.duration),
    ...showerGlints().map((glint) => glint.delay + GLINT_MS),
    ...falseStartPuff().map((piece) => PUFF_AT_MS + piece.delay + PUFF_MS),
    CONFETTI_BURST_MS + BADGE_DELAY_MS + BADGE_MS, CONFETTI_BURST_MS + 340, CONFETTI_BURST_MS + 320, SPOT_TIMELINE_MS, FACE_TIMELINE_MS,
    POPPER_TIMELINE_MS, coverPopMs(.5) + COVER_FX_MS,
  ];
  assert.ok(Math.max(...ends) <= CONFETTI_CLEAR_MS, `last motion ${Math.max(...ends)} ms`);
  // No dead time: the last paper and stars leave the screen within 0.25 s of the end, and nothing is in view by the
  // stage's safety fade (jets are below the footer from 94% of their flight).
  const jetsGone = Math.max(...[...confettiJet(1, 7), ...confettiJet(-1, 11)].map((piece) => CONFETTI_BURST_MS + piece.delay + piece.duration * JET_FADE[1]));
  assert.ok(jetsGone <= STAGE_FADE[0] * CONFETTI_DURATION_MS, `paper in view at ${Math.round(jetsGone)} ms`);
  const starsGone = Math.max(...starShower().map((star) => star.delay + star.duration * .9));
  assert.ok(starsGone >= CONFETTI_DURATION_MS - 250, `the shower ends early (${Math.round(starsGone)} ms): dead time`);
  // Poppers, muzzles, badges and paper are clipped just below the footer's top edge (no ghost through its 96% fill).
  assert.match(rule('.cf-clip'), /bottom: 60px; overflow: hidden/);
  assert.match(rule('.cf-world'), /height: calc\(100% \+ 60px\)/);
  assert.ok(FOOTER_CLIP_PX === 60 && FOOTER_CLIP_PX < FOOTER_PX);
});

void test('the art geometry is finite and fits its boxes', () => {
  const inBox = (path: string, width: number, height: number) => {
    const values = numbers(path);
    assert.ok(values.length > 10 && values.length % 2 === 0);
    for (let i = 0; i < values.length; i += 2) {
      assert.ok(Number.isFinite(values[i]) && values[i] >= 0 && values[i] <= width, `x ${values[i]}`);
      assert.ok(Number.isFinite(values[i + 1]) && values[i + 1] >= 0 && values[i + 1] <= height, `y ${values[i + 1]}`);
    }
  };
  const coil = curlStrands();
  assert.ok(coil.front.length > 0 && coil.back.length > 0, 'both strands of the coil are drawn');
  inBox(coil.front, CURL_BOX.width, CURL_BOX.height);
  inBox(coil.back, CURL_BOX.width, CURL_BOX.height);
  const tuft = tuftStrands();
  inBox(tuft.front, TUFT_BOX.width, TUFT_BOX.height);
  inBox(tuft.back, TUFT_BOX.width, TUFT_BOX.height);
  inBox(popBurstPoints(), 160, 100);
  inBox(popBurstPoints(11, 30, 48), 160, 100);
  const star = starGeometry(24, 25, 22, 10);
  assert.equal(star.facets.length, 10);
  inBox(star.outline, 48, 48);
  const bits = coverBurstBits();
  assert.equal(bits.length, COVER_BITS);
  assert.ok(new Set(bits.map((bit) => Math.round(Math.hypot(bit.x - 50, bit.y - 50) / 6))).size >= 4, 'bits fill the disc (not a ring)');
  for (const bit of bits) {
    assert.ok(Math.hypot(bit.x - 50, bit.y - 50) * 1.1 <= 46, 'inside the sprite even at the largest per-card scale');
    // Sized like the stage paper (vmin), no bigger than 3.2vmin on any card, however big the card.
    assert.ok(bit.width >= 1.4 && bit.height > bit.width && Math.max(bit.width, bit.height) <= 3.2, `bit ${bit.width} x ${bit.height}vmin`);
    assert.notEqual(bit.tone[0], bit.tone[1], 'two-tone paper');
  }
  for (const spark of COVER_SPARKLES) assert.ok(spark.x >= 10 && spark.x <= 90 && spark.y >= 10 && spark.y <= 90 && spark.size <= 4.5);
  // On the biggest card (one team at 1920 x 1080) the sprite is capped and the largest bit is still stage-sized.
  const vmin = 10.8;
  const sprite = Math.min(Math.min(1870, 920) * .96, BURST_MAX_VMIN * vmin);
  const biggest = Math.max(...bits.map((bit) => Math.min(bit.height * vmin, bit.height * COVER_BIT_CAP_PCT / 100 * sprite)));
  assert.ok(sprite <= BURST_MAX_VMIN * vmin && biggest <= 3.2 * vmin, `largest bit ${Math.round(biggest)} px`);
});

void test('confetti CSS stays Safari-safe, compositor-friendly and self-consistent', () => {
  for (const banned of ['@property', 'offset-path', ':has(', 'abs(', 'color-mix(', 'view-transition', 'will-change', 'filter:', 'backdrop-filter', 'sin(', 'cos(', '@container', 'mod(']) {
    assert.ok(!css.includes(banned), `no ${banned}`);
  }
  assert.ok(!/(^|[;{\s])(rotate|scale|translate)\s*:/m.test(css), 'no individual transform properties');
  assert.ok(!/\{[^}]*\{/.test(css.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, '')), 'no nested rules outside @keyframes');
  const defined = new Set(Array.from(css.matchAll(/@keyframes ([\w-]+)/g), (match) => match[1]));
  const used = new Set(Array.from(css.matchAll(/animation(?:-name)?:\s*([\w-]+)/g), (match) => match[1]));
  for (const name of used) assert.ok(defined.has(name), `${name} is defined`);
  for (const name of defined) assert.ok(used.has(name), `${name} is used`);
  const blocks = Array.from(css.matchAll(/@keyframes [\w-]+ \{((?:[^{}]*\{[^}]*\})*)[^{}]*\}/g));
  assert.equal(blocks.length, defined.size, 'every keyframes block was inspected');
  for (const match of blocks) {
    // var() inside keyframes makes Chromium re-style the element on every frame; per-piece paths are Web Animations instead.
    assert.ok(!match[0].includes('var('), `no var() in ${match[0].slice(0, 40)}`);
    for (const property of match[1].matchAll(/([\w-]+):/g)) {
      assert.ok(['transform', 'opacity', 'animation-timing-function'].includes(property[1]), `animates only transform/opacity, not ${property[1]}`);
    }
  }
});
