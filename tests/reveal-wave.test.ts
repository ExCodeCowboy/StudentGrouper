import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BAKE_FPS, compactKeyframes, joinClock, sampleTrack } from '../src/revealEffects/bakedTimeline';
import { mix } from '../src/revealEffects/sceneMotion';
import { waveEffect } from '../src/revealEffects/wave';
import {
  ALL_WASHED_AT, CARD_TEXT_ZONE, DOLPHIN_SIZE, DIVE, DROP_GONE_SCALE, FLOAT_HEAD, FLOATER, LAP_WIDTH, OTTER_SIZE, TUNNEL_POP, TUNNEL_WINDUP, otterShade, CLAW_ORIGIN, CLAW_REACH, CLICK_TICK, CLICK_TICK_MS, DOLPHIN_FLICK_MS, PUMP_UNTIL, RIDE_OUT, TICK_KEYS, TIDE_DOT_R, WET_GLOSS_WIDTH, CRAB_BUBBLE, CRAB_BUBBLE_AT, CRAB_BUBBLE_MS, CRAB_BUBBLE_SWELL_MS, CRAB_EYES_ONLY, CRAB_PEEK, CRAB_PUPIL_UNITS,
  CRAB_SIZE, CRAB_SPAN, CRAB_STALK_DEG, CRAB_TIMES, CRAB_WALL_PX, DOLPHIN, FACE, HEADER_SAFE_PX, LACE_FADE_MS, LAP_REACH, LAP_SILHOUETTE, LOOP_COUNTS, NAME_CLEARANCE,
  OTTER_ARMS, OTTER_HEAD, OTTER_INBETWEENS, OTTER_PHASES, OTTER_POSES, PUMP_DEG, PUMP_HALF_MS, SPIT_DROPS, SPIT_LANDING, SPIT_STRETCH, SPLASHES, SPLASH_MS, STREAKS,
  STREAK_LENGTH, TUBE_EYE, TUBE_FLASH, TUNNEL, TUNNEL_HEAD, WASH_AHEAD_OF_CREST, WASH_CROSS, WASH_LEAD_MS, WASH_START, WAVE_BODY, WAVE_DURATION_MS, WAVE_SILHOUETTE,
  WAVE_TUBE, WET_LAYER_OPACITY, WET_TONE, WET_TONE_OPACITY, artUnit, blockedSpans, cheerPump, clawPump, clawSnap, coverHitTime, coverWindow, crab, crabBubble, crabClaws,
  crabFx, crabLook, crabPlan, crabRise, crabShows, crabTracks, crestX, dolphin, dolphinTail, hasMist, insidePolygon, lapFront, lapVisible, laceOpacity, lipAngle, loopFx,
  clawPose, crabWall, otterBoxPx, otterPaw, otterScaleX, otterTopPx, outlinePath, outlinePolygon, riseY, splashDrops, streakEnds, surfOtter, tideLine, tubeFlashFx, tunnelEyes, tunnelPupils, vwFor,
  washX, waveCoverVars, waveFx, waveGrow, waveLayout, waveSplashes, waveToScreen, waveTracks, wetPatchSvg, type Box, type CardRect,
} from '../src/revealEffects/waveMotion';

const css = readFileSync('src/revealEffects/wave.css', 'utf8');
const VIEWPORTS = [[960, 680], [1024, 768], [1280, 800], [1920, 1080], [2560, 1080], [768, 1024]] as const;
const LANDSCAPE = VIEWPORTS.filter(([width, height]) => width > height);
const DURATION = WAVE_DURATION_MS / 1000;
const steps = (from: number, to: number, step: number) => { const out: number[] = []; for (let t = from; t <= to + 1e-9; t += step) out.push(Math.round(t * 1e6) / 1e6); return out; };

function faceDistance(x: number, y: number) {
  let best = Infinity;
  for (let i = 1; i < FACE.length; i++) {
    const [x0, y0] = FACE[i - 1];
    const [x1, y1] = FACE[i];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const u = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - x0 - u * dx, y - y0 - u * dy));
  }
  return best;
}

/** Numbers inside a keyframe's transform string, in order. */
const numbers = (value: string | number | undefined | null) => String(value).match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];

void test('wave reveal: identity and duration contract', () => {
  assert.equal(waveEffect.id, 'wave');
  assert.equal(waveEffect.sound, 'wave');
  assert.equal(waveEffect.durationMs, WAVE_DURATION_MS);
  assert.equal(WAVE_DURATION_MS, 4900);
  assert.ok(WAVE_DURATION_MS <= 9800);
  assert.equal(ALL_WASHED_AT, 3.3);
  assert.ok(ALL_WASHED_AT * 1000 + LACE_FADE_MS < WAVE_DURATION_MS - 500, 'names are clean well before the end');
});

void test('wave reveal: the covers wash in exact step with the Stage wash line', () => {
  for (const width of [768, 960, 1280, 1920, 2560]) {
    for (const left of [0, .25, .5, .75, 1]) assert.ok(Math.abs(washX(coverHitTime(left), width) - left * width) < 1e-9, `${width}px, left ${left}`);
    assert.equal(washX(WASH_START, width), 0);
    assert.ok(Math.abs(washX(WASH_START + WASH_CROSS, width) - width) < 1e-9);
  }
  const vars = waveCoverVars();
  assert.equal(vars['--wave-wash-start'], `${WASH_START * 1000}ms`);
  assert.equal(vars['--wave-wash-cross'], `${WASH_CROSS * 1000}ms`);
  assert.equal(vars['--wave-lace-fade'], `${LACE_FADE_MS}ms`);
  assert.equal(vars['--wave-wash-lead'], `${WASH_LEAD_MS}ms`);
  assert.equal(vars['--wave-lap-reach'], `${LAP_REACH}`);
  // Durations turned into distances travelled by the wash line (100vw per crossing).
  assert.equal(vars['--wave-wash-lead-vw'], `${vwFor(WASH_LEAD_MS)}vw`);
  assert.equal(vars['--wave-lace-fade-vw'], `${vwFor(LACE_FADE_MS)}vw`);
  assert.ok(Math.abs(vwFor(WASH_CROSS * 1000) - 100) < 1e-9);
  // The CSS is the coverWindow() mirror: same per-card window and the same keyframe line.
  assert.match(css, /--wave-k: min\(1, var\(--wave-L\) \* 1000\);/);
  assert.match(css, /--wave-end: min\(1, var\(--wave-L\) \+ 2 \* max\(\.01, var\(--reveal-center-x, \.5\) - var\(--wave-L\)\) \+ \(1 - var\(--wave-k\)\) \* 2\);/);
  assert.match(css, /--wave-hit: calc\(var\(--wave-wash-start\) \+ var\(--wave-L\) \* var\(--wave-wash-cross\)\);/);
  assert.match(css, /--wave-run: calc\(max\(\.004, var\(--wave-end\) - var\(--wave-L\)\) \* var\(--wave-wash-cross\)\);/);
  assert.match(css, /--wave-lace-at: calc\(var\(--wave-wash-start\) \+ var\(--wave-end\) \* var\(--wave-wash-cross\)\);/);
  assert.match(css, /@keyframes wave-window \{ from \{ transform: translateX\(calc\(var\(--wave-L\) \* 100vw - var\(--wave-cl\)\)\); \} to \{ transform: translateX\(calc\(var\(--wave-end\) \* 100vw - var\(--wave-cl\)\)\); \} \}/);
  assert.match(css, /@keyframes wave-sand \{ from \{ transform: translateX\(calc\(var\(--wave-cl\) - var\(--wave-L\) \* 100vw\)\); \} to \{ transform: translateX\(calc\(var\(--wave-cl\) - var\(--wave-end\) \* 100vw\)\); \} \}/);
  assert.match(css, /@keyframes wave-wash \{ from \{ transform: translateX\(calc\(var\(--wave-L\) \* 100vw - var\(--wave-wash-lead-vw\) - var\(--wave-cl\)\)\); \} to \{ transform: translateX\(calc\(var\(--wave-end\) \* 100vw \+ var\(--wave-lace-fade-vw\) - var\(--wave-cl\)\)\); \} \}/);
  assert.match(css, /\.wave-sand-window \{[^}]*animation: wave-window var\(--wave-run\) var\(--wave-hit\) linear both, wave-gone 1ms calc\(var\(--wave-hit\) \+ var\(--wave-run\)\) linear forwards;/);
  // The moment its wipe ends the whole sand window goes, so no fractional-pixel rim sliver outlives the wipe
  // (work/build/wave/enddiff.cjs checks the rendered end frames against a no-cover baseline).
  assert.match(css, /@keyframes wave-gone \{ to \{ opacity: 0; \} \}/);
  assert.match(css, /\.wave-sand \{[^}]*animation: wave-sand var\(--wave-run\) var\(--wave-hit\) linear both;/s);
  assert.match(css, /animation: wave-wash calc\(var\(--wave-run\) \+ var\(--wave-wash-lead\) \+ var\(--wave-lace-fade\)\) calc\(var\(--wave-hit\) - var\(--wave-wash-lead\)\) linear both, wave-fade var\(--wave-lace-fade\) var\(--wave-lace-at\) ease-out both;/);

  // Every keyframe of every cover lies on the Stage wash line: x_card(t) = W (t - start) / cross - coverLeft.
  for (const [width] of VIEWPORTS) {
    for (let coverLeft = -0.3 * width; coverLeft <= 1.2 * width; coverLeft += 0.05 * width) {
      for (const cardWidth of [.05, .12, .24, .5, .96].map((fraction) => fraction * width)) {
        const left = Math.max(0, Math.min(1, coverLeft / width));
        const centerX = Math.max(0, Math.min(1, (coverLeft + cardWidth / 2) / width));
        const cover = coverWindow(left, centerX);
        const line = (time: number) => (width * (time - WASH_START)) / WASH_CROSS - coverLeft;
        const wipeStart = left * width - coverLeft;
        const wipeEnd = cover.end * width - coverLeft;
        assert.ok(Math.abs(line(cover.hit) - wipeStart) < 1e-6, 'wipe starts on the wash line');
        if (cover.end - left >= .004) assert.ok(Math.abs(line(cover.hit + cover.run) - wipeEnd) < 1e-6, 'wipe ends on the wash line');
        const bandStart = wipeStart - (vwFor(WASH_LEAD_MS) / 100) * width;
        const bandEnd = wipeEnd + (vwFor(LACE_FADE_MS) / 100) * width;
        assert.ok(Math.abs(line(cover.washFrom) - bandStart) < 1e-3, 'foam band starts on the wash line');
        if (cover.end - left >= .004) assert.ok(Math.abs(line(cover.washUntil) - bandEnd) < 1e-3, 'foam band ends on the wash line');
        // Before its window the wipe edge is left of everything visible; after it, the visible card is clean.
        assert.ok(wipeStart <= Math.max(0, -coverLeft) + 1e-6, 'nothing visible is wiped early');
        const visibleRight = Math.min(cardWidth, width - coverLeft);
        if (visibleRight > Math.max(0, -coverLeft)) assert.ok(wipeEnd >= visibleRight - 1e-6, `visible sand left over: ${coverLeft}/${cardWidth} at ${width}px`);
        // The band's foam leads the wipe by enough to enter from outside the card.
        assert.ok((vwFor(WASH_LEAD_MS) / 100) * width > 80, 'foam enters from off the card');
      }
    }
  }
});

void test('wave reveal: every cover is clean and gone before the reveal ends; cover one-shots finish before the wave', () => {
  for (let left = 0; left <= 1; left += .01) {
    for (let centerX = left; centerX <= 1; centerX += .01) {
      const cover = coverWindow(left, centerX);
      assert.ok(cover.hit + cover.run <= ALL_WASHED_AT + 1e-9, 'sand gone by 3.3 s');
      assert.ok(cover.laceGone <= ALL_WASHED_AT + LACE_FADE_MS / 1000 + 1e-9, 'foam and lace gone by 3.72 s');
      assert.ok(cover.washUntil <= DURATION - .7);
      assert.ok(cover.washFrom >= WASH_START - WASH_LEAD_MS / 1000 - 1e-9);
      if (left > 0 && centerX - left > .01 && left + 2 * (centerX - left) <= 1) assert.ok(Math.abs(cover.end - (left + 2 * (centerX - left))) < 1e-9, 'ends at the right edge');
    }
  }
  assert.equal(coverWindow(0, .1).end, 1, 'left-edge (maybe clamped) cards run to the viewport edge');
  // The "?" hop ripple and the wet patch fade-in are short one-shots that finish before the busiest Stage frames (1.0 s).
  const hop = css.match(/wave-hop (\d+)ms calc\((\d+)ms \+ var\(--reveal-order, \.5\) \* (\d+)ms\)/);
  assert.ok(hop, 'hop timing');
  assert.ok(Number(hop[1]) + Number(hop[2]) + Number(hop[3]) <= 1000, 'last "?" hop ends by 1.0 s');
  assert.ok(Number(hop[2]) >= 560 && Number(hop[2]) <= 680, 'the hop ripple rides the draw-back');
  const wet = css.match(/\.wave-wet-fade \{ position: absolute; inset: 0; animation: wave-wet (\d+)ms linear both; \}/);
  assert.ok(wet && Number(wet[1]) <= 1000, 'wet patch fade ends before 1.0 s');
  const wetKeys = css.match(/@keyframes wave-wet \{ 0%, (\d+)% \{ opacity: 0; \} 100% \{ opacity: 1; \} \}/);
  assert.ok(wetKeys, 'wet keyframes');
  const wetIn = (Number(wet[1]) * Number(wetKeys[1])) / 100000;
  assert.ok(wetIn >= .5 && wetIn <= .56, `wet patch starts appearing under the lap at full reach (${wetIn})`);
  // Safari/WKWebView-safe CSS, compositor-only wipe, no custom properties inside the Stage's keyframes.
  assert.doesNotMatch(css, /@property|offset-path|view-transition|:has\(/);
  assert.doesNotMatch(css, /@keyframes[^{]*\{[^}]*clip-path/);
  assert.doesNotMatch(css, /&/);
  for (const name of ['wave-hi', 'wave-fade', 'wave-wet', 'wave-hop']) assert.doesNotMatch(css.slice(css.indexOf(`@keyframes ${name} `)).split('\n')[0], /var\(/, `${name} keyframes are constant`);
});

void test('wave reveal: the wet patch is the lap footprint: damp sand, a glossy edge and a line of foam dots', () => {
  const svg = wetPatchSvg();
  assert.match(svg, new RegExp(`viewBox='${-LAP_REACH * 1000} 0 ${LAP_REACH * 1000} 460'`));
  // A cooler, darker sand tone building up to about .34 in the core (five stacked, offset copies feather the top), so it reads across a room.
  assert.equal(WET_TONE, '#c99a5a');
  assert.equal((svg.match(new RegExp(`fill='%23c99a5a' fill-opacity='${WET_LAYER_OPACITY}'`, 'g')) ?? []).length, 5, 'stacked footprints feather the top edge');
  assert.ok(WET_TONE_OPACITY >= .32 && WET_TONE_OPACITY <= .36, `overall tone ${WET_TONE_OPACITY}`);
  // "The water was here": a glossy highlight just inside the lobe edge and tiny foam dots and bubbles along it; no tan scallops.
  assert.match(svg, new RegExp(`stroke='%23fff6df' stroke-opacity='\\.6' stroke-width='${WET_GLOSS_WIDTH}'`));
  assert.ok(WET_GLOSS_WIDTH >= 10, 'a gloss line you can see from the back of the room');
  assert.doesNotMatch(svg, /A13 13 0 0 1|a66f31/);
  const dots = svg.match(/<circle /g) ?? [];
  assert.ok(dots.length >= 8 && dots.length === tideLine().length, `foam dots (${dots.length})`);
  assert.ok((svg.match(/fill='%23ffffff'/g) ?? []).length >= 5 && (svg.match(/fill='none' stroke='%23ffffff'/g) ?? []).length >= 2, 'foam dots and little bubbles');
  // Foam dots twice their old size (r 6-8 art units, about 5-6 px at 800 px high).
  assert.ok(TIDE_DOT_R[0] >= 6 && TIDE_DOT_R[1] >= 8);
  for (const [, radius] of svg.matchAll(/<circle [^>]*r='([\d.]+)'/g)) assert.ok(Number(radius) >= TIDE_DOT_R[0], `dot r ${radius}`);
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), 'svg is complete');
  const art = waveCoverVars()['--wave-wet-art'];
  assert.ok(art.startsWith('url("data:image/svg+xml,%3Csvg') && art.endsWith('%3C/svg%3E")'), 'encoded for a custom property');
  assert.doesNotMatch(art, /[<>#"]\S*[<>#]/, 'no raw markup characters inside the url');
  assert.match(css, /\.wave-wet \{[^}]*background: var\(--wave-wet-art\) 0 0 \/ 100% 100% no-repeat;/s);
  assert.match(css, /\.wave-wet \{[^}]*width: calc\(var\(--wave-lap-reach\) \* min\(100vh, 80vw\)\);/s);
  // The lap is a tongue: tall where the otter floats, thin at the front, with a lobe.
  const top = (x: number) => Math.max(...steps(0, .5, .002).filter((y) => insidePolygon(LAP_SILHOUETTE, x, y)));
  assert.ok(top(-.4) >= .38, `back ${top(-.4)}`);
  assert.ok(top(-.09) <= .19, `sheet ${top(-.09)}`);
  assert.ok(top(-.04) > top(-.08), 'the lobe rolls up at the front');
  assert.ok(top(-.03) >= .15 && top(-.03) <= .21, `front lobe ${top(-.03)}`);
});

void test('wave reveal: the wave stands up in view and the wipe edge always hides inside the water', () => {
  let exposedFrom = 1;
  for (const time of steps(WASH_START, ALL_WASHED_AT, .01)) {
    assert.equal(waveGrow(time), 1, `full size once the wash line enters (${time})`);
    for (const height of steps(.1, .78, .01)) {
      if (!insidePolygon(WAVE_SILHOUETTE, WASH_AHEAD_OF_CREST, height - riseY(time))) exposedFrom = Math.min(exposedFrom, height);
    }
  }
  assert.equal(exposedFrom, 1, `wash line visible at ${exposedFrom} S`);
  // The silhouette really is the drawn body (same segment list).
  assert.ok(outlinePath(WAVE_BODY).startsWith('M-380 1040C'));
  assert.ok(WAVE_SILHOUETTE.length > 60);
  // Hidden below the bottom edge before it starts; a whole small curl (crest included) is on screen while it grows.
  for (const time of steps(0, .58, .02)) assert.ok(riseY(time) >= waveGrow(time) * .82, `wave peeks early at ${time}`);
  for (const [width, height] of LANDSCAPE) {
    const shown = steps(.6, 1, .01).filter((time) => {
      const crest = waveToScreen(time, width, height, 0, .81);
      const back = waveToScreen(time, width, height, -.3, .1);
      return crest.x > 0 && back.x > -0.05 * width && crest.y < height - 0.1 * artUnit(width, height);
    });
    assert.ok(shown.length >= 5, `${width}x${height}: the growing curl is in view (${shown.join(', ')})`);
  }
  // While it rears up its foot draws back a little (anticipation), never far.
  for (const [width, height] of LANDSCAPE) {
    let foot = -Infinity;
    for (const time of steps(.7, 1.2, .01)) {
      const x = waveToScreen(time, width, height, .46, .02).x;
      assert.ok(x > foot - 0.1 * artUnit(width, height), `${width}x${height}: foot slides back too far at ${time}`);
      foot = Math.max(foot, x);
    }
  }
  // The lip unrolls in view and never pitches like a mouth at the tunnel.
  assert.ok(lipAngle(.62) < -20 && lipAngle(1.2) === 0);
  for (const time of steps(2, 3.2, .005)) assert.ok(Math.abs(lipAngle(time)) <= 8, `lip ${lipAngle(time)} at ${time}`);
});

void test('wave reveal: the wave travels forward only and leaves the screen', () => {
  for (const [width, height] of VIEWPORTS) {
    const s = artUnit(width, height);
    let previous = -Infinity;
    for (const time of steps(0, DURATION, .01)) {
      const x = crestX(time, width, s);
      assert.ok(x > previous, 'crest never moves backwards');
      previous = x;
      if (time >= 4.25) assert.ok(x - .39 * s > width, `${width}x${height}: wave back still visible at ${time}`);
    }
  }
  assert.equal(riseY(1.2), 0);
  assert.ok(riseY(.5) > .2, 'wave starts below the screen');
});

void test('wave reveal: the tunnel peek-a-boo holds long enough to read, and never overlaps the otter', () => {
  let farthest = 0;
  for (const time of steps(OTTER_PHASES.land, OTTER_PHASES.stall - .001, .002)) {
    const otter = surfOtter(time);
    farthest = Math.max(farthest, faceDistance(otter.x, otter.y));
    assert.ok(Math.abs(otter.angle) <= 37, `tilt ${otter.angle} at ${time}`);
  }
  assert.ok(farthest <= .02, `board centre ${farthest} S off the face`);
  // The ride-out is on the wave's back, behind the crest: always on the water, board nearly level.
  for (const time of steps(OTTER_PHASES.cheer, 4, .002)) {
    const otter = surfOtter(time);
    assert.ok(insidePolygon(WAVE_SILHOUETTE, otter.x, otter.y) && otter.x < 0, `ride-out board off the wave at ${time}`);
    assert.ok(Math.abs(otter.angle) <= 12, `ride-out tilt ${otter.angle} at ${time}`);
  }
  assert.deepEqual({ ...OTTER_PHASES }, { pop: 1.02, land: 1.22, five: 1.76, fiveEnd: 2.02, stall: 2.08, dive: 2.18, hidden: 2.3, spit: 2.72, cheer: 2.98 });
  for (const time of steps(0, DURATION, .002)) {
    const otter = surfOtter(time);
    const eyes = tunnelEyes(time);
    assert.ok(!(otter.opacity > .05 && eyes.opacity > .05), `otter and eyes both visible at ${time}`);
    if (time >= OTTER_PHASES.hidden && time < OTTER_PHASES.spit) assert.equal(otter.opacity, 0, `otter visible inside the tube at ${time}`);
    if (eyes.opacity > 0) assert.ok(time >= TUNNEL.in && time <= TUNNEL.gone, `eyes at ${time}`);
    assert.ok(otter.opacity >= 0 && otter.opacity <= 1);
    if (time < OTTER_PHASES.pop) assert.equal(otter.opacity, 0);
  }
  // The head pops up where the otter vanished, eyes still squeezed shut from the tuck; they pop open by 2.36.
  assert.ok(tunnelEyes(TUNNEL.in).blink <= .1 && tunnelEyes(TUNNEL.eyesOpen).blink <= .1, 'eyes shut as the head appears');
  assert.ok(tunnelEyes(TUNNEL.in).scaleY <= TUNNEL_POP.from + 1e-9 && tunnelEyes(TUNNEL_POP.peakAt).scaleY > 1.05, 'the head pops up to size with an overshoot');
  assert.ok(Math.abs(TUNNEL_POP.from * TUNNEL_HEAD.width - DIVE.scale * OTTER_SIZE.width) < .02, 'it starts about the size the otter shrank to');
  // Wide open for 160 ms, a ~100 ms blink (closed 35 ms), a real glance, then POP.
  const open = steps(2.36, 2.52, .005).filter((time) => tunnelEyes(time).opacity === 1 && tunnelEyes(time).blink === 1);
  assert.equal(open.length, steps(2.36, 2.52, .005).length, 'eyes fully open 2.36-2.52');
  const blinking = steps(2.4, 2.72, .001).filter((time) => tunnelEyes(time).blink < 1);
  assert.ok(blinking.length >= 95 && blinking.length <= 105, `blink ${blinking.length} ms`);
  const closed = steps(2.4, 2.72, .001).filter((time) => tunnelEyes(time).blink < .1);
  assert.ok(closed.length >= 34, `eyes shut ${closed.length} ms`);
  // A wind-up before the POP: the head squashes down and widens (anticipation), still solid.
  const wound = tunnelEyes(TUNNEL.gone - .011);
  assert.ok(wound.scaleY <= TUNNEL_WINDUP.y + .01 && wound.scaleX >= TUNNEL_WINDUP.x - .01 && wound.opacity === 1, 'wind-up squash');
  assert.equal(tunnelEyes(2.64).blink, 1);
  const shift = Math.abs(tunnelPupils(1).x - tunnelPupils(0).x);
  assert.ok(shift >= .24 * TUNNEL_HEAD.eyeWidth, `pupils move ${shift} of ${TUNNEL_HEAD.eyeWidth}`);
  assert.equal(tunnelEyes(2.66).look, 1, 'glance held before the fade');
  assert.ok(tunnelEyes(2.66).opacity === 1 && tunnelEyes(2.72).opacity === 0);
  // Pupils always stay inside the eye whites (rx 7.4, ry 9.2, pupil r 4.1).
  for (const look of [0, .5, 1]) { const p = tunnelPupils(look); assert.ok(Math.abs(p.x) + 4.1 <= 7.4 && Math.abs(p.y + .5) + 4.1 <= 9.2); }
  // The otter is gone by 2.30 and bursts out at 2.72, bright within 30 ms.
  assert.equal(surfOtter(2.3).opacity, 0);
  assert.equal(surfOtter(2.74).opacity, 1);
  assert.equal(surfOtter(2.75).brightness, 1);
  assert.ok(Math.abs(surfOtter(2.5).x - TUBE_EYE.x) < 1e-9, 'hidden deep in the tube');
});

void test('wave reveal: otter motion is continuous across phase boundaries', () => {
  for (const boundary of [OTTER_PHASES.land, OTTER_PHASES.five, OTTER_PHASES.fiveEnd, OTTER_PHASES.stall, OTTER_PHASES.dive, OTTER_PHASES.cheer]) {
    const before = surfOtter(boundary - .001);
    const after = surfOtter(boundary + .001);
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < .02, `position jump at ${boundary}`);
    assert.ok(Math.abs(after.angle - before.angle) < 3, `angle jump at ${boundary}`);
    assert.ok(Math.abs(after.scale - before.scale) < .05, `scale jump at ${boundary}`);
  }
  // Poses: the paw goes up for the tail-five, the otter tucks for the tunnel and cheers on the way out.
  assert.equal(surfOtter(1.86).pose, 'five');
  assert.equal(surfOtter(2.12).pose, 'tuck');
  assert.equal(surfOtter(3).pose, 'cheer');
});

void test('wave reveal: dolphin leaps out of the face, tail-fives the otter and dives back into the wave', () => {
  {
    const tag = 'dolphin';
    const start = dolphin(DOLPHIN.start);
    assert.ok(insidePolygon(WAVE_SILHOUETTE, start.x, start.y), `${tag}: starts inside the wave`);
    // It breaks the surface on the face, where the leap splash is.
    const exit = steps(DOLPHIN.start, DOLPHIN.fiveAt, .005).find((time) => { const d = dolphin(time); return !insidePolygon(WAVE_SILHOUETTE, d.x, d.y); });
    assert.ok(exit !== undefined && exit <= 1.7, `${tag}: leaves the water at ${exit}`);
    const out = dolphin(exit);
    assert.ok(faceDistance(out.x, out.y) < .05, `${tag}: breaks the surface on the face`);
    const leap = SPLASHES[1];
    assert.ok(Math.abs(leap.at - exit) <= .02 && Math.hypot(leap.x - out.x, leap.y - out.y) < .05, `${tag}: leap splash on the exit point`);
    // Tail meets paw.
    const tail = dolphinTail(DOLPHIN.fiveAt);
    const paw = otterPaw(DOLPHIN.fiveAt);
    assert.ok(Math.hypot(tail.x - paw.x, tail.y - paw.y) <= .02, `${tag}: tail meets paw`);
    // It comes back down into the water, never onto the dry sand in front of the wave.
    for (const time of steps(DOLPHIN.fiveAt, DOLPHIN.end, .005)) {
      const d = dolphin(time);
      if (d.y < .2) assert.ok(d.x <= faceAt(d.y) + .06, `${tag}: over the sand at ${time}`);
    }
    const end = dolphin(DOLPHIN.end);
    assert.ok(insidePolygon(WAVE_SILHOUETTE, end.x, end.y), `${tag}: ends inside the water`);
    for (const time of steps(0, DURATION, .005)) {
      const d = dolphin(time);
      if (time < DOLPHIN.start || time >= DOLPHIN.gone) assert.equal(d.opacity, 0, `dolphin visible at ${time}`);
      assert.ok(d.opacity === 0 || d.opacity === 1, `dolphin see-through at ${time}`);
    }
  }
  const dive = SPLASHES[3];
  const back = steps(DOLPHIN.fiveAt, DOLPHIN.end, .005).find((time) => { const d = dolphin(time); return insidePolygon(WAVE_SILHOUETTE, d.x, d.y); });
  assert.ok(back !== undefined && Math.abs(dive.at - back) <= .03, `dive splash when it re-enters (${back})`);
  assert.ok(faceDistance(dive.x, dive.y) < .04, 'dive splash sits on the face water');
  assert.ok(dolphin(DOLPHIN.end).y <= .1, 'dives below the footer line');
  // It is never faded out: it keeps diving and is cut only once every part of it is under the water line or
  // behind the footer (sampled outline: spine, tail flukes, beak, fins).
  const outline = [...Array.from({ length: 11 }, (_, index) => [index * 24, 62]), [6, 40], [10, 88], [4, 34], [220, 54], [238, 64], [142, 2], [132, 113]];
  for (const time of steps(DOLPHIN.gone - .04, DOLPHIN.gone - .001, .005)) {
    const d = dolphin(time);
    const a = (-d.angle * Math.PI) / 180;
    for (const [px, py] of outline) {
      const lx = ((px - 125) / 240) * DOLPHIN_SIZE.width;
      const ly = -((py - 62) / 120) * DOLPHIN_SIZE.width * DOLPHIN_SIZE.aspect;
      const x = d.x + lx * Math.cos(a) - ly * Math.sin(a);
      const y = d.y + lx * Math.sin(a) + ly * Math.cos(a);
      assert.ok(insidePolygon(WAVE_SILHOUETTE, x, y) || y - riseY(time) <= .06, `dolphin part (${px}, ${py}) still showing at ${time}`);
    }
  }
  // The sparkle is centred on the contact and fans up and away from the otter's head.
  const tail = dolphinTail(DOLPHIN.fiveAt);
  const paw = otterPaw(DOLPHIN.fiveAt);
  const star = SPLASHES.find((splash) => splash.kind === 'star');
  assert.ok(star && Math.abs(star.at - DOLPHIN.fiveAt) < 1e-9 && Math.hypot(star.x - (tail.x + paw.x) / 2, star.y - (tail.y + paw.y) / 2) < .015, 'sparkle sits on the contact');
  assert.ok(star.spread >= 180 && star.spread <= 220 && star.turn > -90 && star.turn < 0, 'stars fan up and to the right');
  assert.equal(star.ring, true);
  const head = surfOtter(DOLPHIN.fiveAt);
  assert.ok(star.x > head.x + .15, 'burst clear of the head');
});

function faceAt(y: number) {
  for (let i = 1; i < FACE.length; i++) {
    const [x0, y0] = FACE[i - 1];
    const [x1, y1] = FACE[i];
    if (y >= y1 || i === FACE.length - 1) return x0 + ((x1 - x0) * (y0 - y)) / (y0 - y1);
  }
  return FACE[0][0];
}

/** Synthetic card layouts (viewport px) of the student screens the crab must never cover. */
function groupsLayout(width: number, height: number, columns: number, rows: number, rowHeight?: number): CardRect[] {
  const gap = 16;
  const left = 22;
  const cardWidth = (width - 2 * left - (columns - 1) * gap) / columns;
  const cardHeight = rowHeight ?? (height - 72 - 84 - (rows - 1) * gap) / rows;
  const cards: CardRect[] = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) cards.push({ left: left + column * (cardWidth + gap), top: 72 + row * (cardHeight + gap), width: cardWidth, height: cardHeight });
  return cards;
}
function rotationsLayout(width: number, rounds: number, teams: number, scrollX = 0): CardRect[] {
  const cards: CardRect[] = [];
  const cellWidth = 124;
  for (let team = 0; team < teams; team++) for (let round = 0; round < rounds; round++) cards.push({ left: 150 + round * (cellWidth + 6) - scrollX, top: 100 + team * 35, width: cellWidth, height: 30 });
  return cards.filter((card) => card.left < width);
}
/** The same cards with their content measured: a heading and `count` names stacked from the top, like the Groups cards. */
function withNames(cards: CardRect[], count: number): CardRect[] {
  return cards.map((card) => ({
    ...card,
    names: [{ left: card.left + 14, top: card.top + 12, width: Math.min(120, card.width - 28), height: 26 },
      ...Array.from({ length: count }, (_, index): Box => ({ left: card.left + 18, top: card.top + 50 + index * 30, width: Math.min(96, card.width - 36), height: 24 }))],
  }));
}
/** Station cells with an icon and a label on one line (Today table). */
function withLabels(cards: CardRect[]): CardRect[] {
  return cards.map((card) => ({ ...card, names: [{ left: card.left + 8, top: card.top + 4, width: 26, height: 22 }, { left: card.left + 40, top: card.top + 6, width: Math.min(76, card.width - 48), height: 18 }] }));
}

void test('wave reveal: the crab never covers names and never pops up over the passing wave', () => {
  const layouts: [string, number, number, CardRect[]][] = [];
  for (const [width, height] of VIEWPORTS) {
    layouts.push([`groups-4 ${width}x${height}`, width, height, groupsLayout(width, height, 4, 1)]);
    layouts.push([`groups-8 ${width}x${height}`, width, height, groupsLayout(width, height, 4, 2)]);
    layouts.push([`groups-12 ${width}x${height}`, width, height, groupsLayout(width, height, 4, 3, 240)]);
    layouts.push([`groups-1 ${width}x${height}`, width, height, [{ left: width * .3, top: 72, width: width * .4, height: height - 160 }]]);
    layouts.push([`today-8x6 ${width}x${height}`, width, height, rotationsLayout(width, 6, 20)]);
    layouts.push([`today-scrolled ${width}x${height}`, width, height, rotationsLayout(width, 8, 20, 180)]);
    layouts.push([`unmeasured ${width}x${height}`, width, height, []]);
    // Measured content: the crab may use the empty bottom of a card, never a name.
    layouts.push([`named groups-4 ${width}x${height}`, width, height, withNames(groupsLayout(width, height, 4, 1), 5)]);
    layouts.push([`named groups-6 ${width}x${height}`, width, height, withNames(groupsLayout(width, height, 6, 1), 4)]);
    layouts.push([`named groups-8 ${width}x${height}`, width, height, withNames(groupsLayout(width, height, 4, 2), 6)]);
    layouts.push([`named groups-12 ${width}x${height}`, width, height, withNames(groupsLayout(width, height, 4, 3, 240), 5)]);
    layouts.push([`packed groups-4 ${width}x${height}`, width, height, withNames(groupsLayout(width, height, 4, 1), 40)]);
    layouts.push([`labelled today-8x6 ${width}x${height}`, width, height, withLabels(rotationsLayout(width, 6, 20))]);
  }
  const hidden: string[] = [];
  for (const [name, width, height, cards] of layouts) {
    const plan = crabPlan(cards, width, height);
    const layout = waveLayout(width, height);
    const s = artUnit(width, height);
    assert.ok(plan.cap === 1 || plan.cap === CRAB_EYES_ONLY || plan.cap === CRAB_PEEK || plan.cap === 0, name);
    if (plan.cap === 0) {
      // Nowhere to peek without covering a name: the crab stays hidden, with no bubble or ticks.
      hidden.push(name);
      for (const time of steps(0, DURATION, .01)) assert.equal(crab(time, width, height, plan).visible, false);
      assert.equal(crabTracks(width, height, plan).crab(4).opacity, 0);
      assert.deepEqual(crabFx(width, height, plan), {});
      continue;
    }
    const lastResort = plan.cap === CRAB_PEEK;
    assert.ok(plan.x > .3 * width && plan.x < width, `${name}: x ${plan.x}`);
    const span = plan.cap === 1 ? CRAB_SPAN.full : CRAB_SPAN.eyes;
    const left = plan.x + (span[0] - .5) * layout.crab.width;
    const right = plan.x + (span[1] - .5) * layout.crab.width;
    assert.ok(right <= width, `${name}: on screen`);
    for (const time of steps(CRAB_TIMES.up, CRAB_TIMES.down, .01)) {
      const c = crab(time, width, height, plan);
      const top = c.wall - layout.crab.height * crabShows(c.rise, plan.cap, clawSnap(time));
      if (top >= c.wall - 1) continue;
      // Raised, pumping claws and their click ticks reach a little higher.
      const reach = top - (plan.cap === 1 ? CLAW_REACH * layout.crab.height : 0);
      for (const card of cards) {
        if (card.names && card.names.length > 0) {
          for (const box of card.names) {
            const overlapsY = box.top < c.wall && box.top + box.height > reach;
            const overlapsX = left < box.left + box.width && right > box.left;
            if (!lastResort) assert.ok(!(overlapsX && overlapsY), `${name}: crab over a name ${JSON.stringify(box)} at ${time}`);
            else if (overlapsY) assert.ok(Math.min(right, box.left + box.width) - Math.max(left, box.left) <= .12 * layout.crab.width, `${name}: peek over a name`);
          }
          continue;
        }
        const overlapsY = card.top < c.wall && card.top + card.height > top;
        const overlapsX = left < card.left + CARD_TEXT_ZONE * card.width && right > card.left;
        if (!lastResort) assert.ok(!(overlapsX && overlapsY), `${name}: crab over names of ${JSON.stringify(card)} at ${time}`);
        // With no gap wide enough anywhere, only the tops of the eyes peek, centred in a gap (barely touching the edges of name zones).
        else if (overlapsY) {
          const overlap = Math.min(right, card.left + CARD_TEXT_ZONE * card.width) - Math.max(left, card.left);
          assert.ok(overlap <= .12 * layout.crab.width, `${name}: peek over names by ${overlap}px`);
          assert.ok(plan.x < card.left || plan.x > card.left + CARD_TEXT_ZONE * card.width, `${name}: eyes centred on names`);
        }
      }
      // Whatever shows is below the header and just above the wall.
      assert.ok(top >= height - CRAB_WALL_PX - .13 * s && top > HEADER_SAFE_PX, `${name}: crab shows too much at ${time}`);
    }
    // When it has room for all of itself behind the wave, the wave's back has passed that spot as it pops up.
    if (plan.cap === 1 && plan.x + .5 * layout.crab.width <= crestX(CRAB_TIMES.up + .06, width, s) - .38 * s) {
      assert.ok(waveToScreen(CRAB_TIMES.up + .06, width, height, -.38, 0).x >= right - 1, `${name}: under the wave`);
    }
  }
  // Only the synthetic, wall-to-wall packed layouts ever leave the crab nowhere to peek.
  assert.ok(hidden.every((name) => name.startsWith('packed') || name.startsWith('labelled')), `hidden crab in ${hidden.join(', ')}`);
  // Groups with four tall cards at 1280x800: the whole crab fits behind the wave.
  const four = crabPlan(withNames(groupsLayout(1280, 800, 4, 1), 5), 1280, 800);
  assert.equal(four.cap, 1);
  // Unmeasured (a fallback only: the Stage measures every card's names at mount), at least the eyes peek.
  assert.ok(crabPlan(groupsLayout(1280, 800, 4, 1), 1280, 800).cap >= CRAB_EYES_ONLY);
  // A dense, unmeasured table has no room: only the eyes peek.
  const dense = crabPlan(rotationsLayout(1280, 9, 20), 1280, 800);
  assert.ok(dense.cap < 1, 'eyes only over a dense table');
  // On a big projector with six measured cards the whole crab sits in the empty bottom of a card (it used to be two eyeballs).
  for (const [width, height] of [[1920, 1080], [1280, 800], [2560, 1080]] as const) {
    const plan = crabPlan(withNames(groupsLayout(width, height, 6, 1), 4), width, height);
    assert.equal(plan.cap, 1, `${width}x${height}: full crab`);
    assert.ok(CRAB_SIZE.width * artUnit(width, height) >= .18 * height - 1e-9, 'a crab you can see across the room');
  }
  // Names are blocked with clearance; unmeasured cards keep their left 70 % clear.
  const spans = blockedSpans([{ left: 100, top: 500, width: 200, height: 300, names: [{ left: 120, top: 700, width: 50, height: 20 }] }, { left: 400, top: 500, width: 200, height: 300 }], 690, 722);
  assert.deepEqual(spans, [[120 - NAME_CLEARANCE, 170 + NAME_CLEARANCE], [398, 400 + CARD_TEXT_ZONE * 200]]);
  assert.deepEqual(blockedSpans([{ left: 100, top: 500, width: 200, height: 300, names: [{ left: 120, top: 520, width: 50, height: 20 }] }], 690, 722), [], 'names above the band do not block');
});

void test('wave reveal: the crab coda reads (long looks, stalks swing, two clicks, a bubble)', () => {
  assert.equal(crabRise(CRAB_TIMES.up), 0);
  assert.ok(crabRise(3.54) > .5, 'eye boing');
  assert.equal(crabRise(3.72), 1);
  const left = steps(3.7, 4.4, .005).filter((time) => crabLook(time) === -1);
  const right = steps(3.7, 4.4, .005).filter((time) => crabLook(time) === 1);
  assert.ok(left.length * .005 >= .18 - 1e-9, `look left held ${left.length * 5} ms`);
  assert.ok(right.length * .005 >= .18 - 1e-9, `look right held ${right.length * 5} ms`);
  assert.ok(Math.max(...left) < Math.min(...right), 'left, then right');
  assert.ok(CRAB_STALK_DEG >= 15 && CRAB_PUPIL_UNITS >= 4, 'a look you can see across the room');
  assert.ok(Math.abs(11.5 - 5.2) >= CRAB_PUPIL_UNITS, 'pupils stay inside the eye whites');
  for (const click of CRAB_TIMES.clicks) {
    assert.equal(clawSnap(click), 1);
    assert.equal(crabClaws(click), 1, 'claws up while clicking');
    assert.equal(crabLook(click), 0, 'looking at the class while clicking');
  }
  assert.ok(CRAB_TIMES.clicks[1] - CRAB_TIMES.clicks[0] >= .1);
  assert.equal(clawSnap(3.7), 0);
  assert.equal(crabRise(CRAB_TIMES.down), 0);
  assert.ok(CRAB_BUBBLE_AT >= CRAB_TIMES.duck - .02 && CRAB_BUBBLE_SWELL_MS >= 150 && CRAB_BUBBLE_AT + CRAB_BUBBLE_MS / 1000 <= DURATION - .05);
  // Eyes-only peeks keep the claws down behind the wall.
  const tracks = crabTracks(1280, 800, { x: 900, cap: CRAB_EYES_ONLY });
  assert.match(String(tracks.crabClawL(4.34).transform), /translateY\(40%\)/);
});

void test('wave reveal: the crab clicks read across a room and its bubble pops clear of its face', () => {
  const full = crabTracks(1280, 800, { x: 900, cap: 1 });
  for (const click of CRAB_TIMES.clicks) {
    // The whole claw pumps up into each click and is back within 90 ms; it squashes as it closes.
    assert.equal(clawPump(click), 1);
    assert.ok(clawPump(click + .07) <= .25, 'back down quickly');
    assert.ok(clawPump(click - .05) <= .2, 'pumps only around its click');
    const [lift, turn, sx, sy] = numbers(full.crabClawL(click).transform);
    const [rest] = numbers(full.crabClawL(CRAB_TIMES.clicks[0] - .04).transform);
    assert.ok(lift <= rest - 9.9, `claw lifts on the click (${lift} vs ${rest})`);
    assert.ok(Math.abs(turn) > 0 && sy <= .9 + 1e-9 && sx >= 1.1 - 1e-9, `claw squashes as it closes (${sx}, ${sy})`);
  }
  // A "click!" tick pops at each pincer on each click (past full size, then settles), then shrinks away.
  const fx = crabFx(1280, 800, { x: 900, cap: 1 });
  for (const name of ['crab-tick-L', 'crab-tick-R']) {
    const tick = fx[name];
    const at = (offset: number) => (tick.timing.delay + offset * tick.timing.duration) / 1000;
    const pops = tick.keyframes.filter((frame) => frame.opacity === 1 && frame.transform === `scale(${CLICK_TICK.pop})`).map((frame) => at(frame.offset));
    assert.equal(pops.length, 2, `${name}: two pops`);
    CRAB_TIMES.clicks.forEach((click, index) => assert.ok(Math.abs(pops[index] - click - .012) < 1e-6, `${name}: pops on click ${index}`));
    assert.ok(tick.keyframes.some((frame) => frame.opacity === 1 && frame.transform === 'scale(1)'), 'settles to full size');
    assert.ok(CLICK_TICK_MS >= 100 && CLICK_TICK_MS <= 120);
    // Its exit is a shrink, not a lingering pale fade.
    for (const frame of tick.keyframes.filter((key) => key.opacity === 0)) assert.ok(numbers(frame.transform)[0] <= .5, `${name}: hides small`);
    assert.equal(tick.keyframes[tick.keyframes.length - 1].opacity, 0);
  }
  assert.equal(CLICK_TICK.pop, 1.25);
  // Saturated gold with an outline twice as thick as before ((11 - 6) / 2 = 2.5 units a side), 1.3x longer strokes.
  assert.equal(CLICK_TICK.fill, '#ffb300');
  assert.ok((CLICK_TICK.outline - CLICK_TICK.core) / 2 >= 2.5);
  assert.ok(Math.abs(CLICK_TICK.top - -13 * 1.3) < .01);
  // CLAW_REACH really covers the raised, pumping claw and its popping tick: compose the claw and tick
  // transforms (as the Stage layers them) and find the highest point of the tick's strokes.
  const tickScale = (time: number) => {
    let scale = 0;
    for (const click of CRAB_TIMES.clicks) {
      for (let index = 1; index < TICK_KEYS.length; index++) {
        const [a, sa, oa] = TICK_KEYS[index - 1];
        const [b, sb, ob] = TICK_KEYS[index];
        const ms = (time - click) * 1000;
        if (ms >= a && ms <= b && Math.max(oa, ob) > 0) scale = Math.max(scale, sa + ((sb - sa) * (ms - a)) / (b - a));
      }
    }
    return scale;
  };
  let reach = 0;
  for (const time of steps(CRAB_TIMES.clawsUp, CRAB_TIMES.clawsDown + .06, .001)) {
    const claw = clawPose(time, false);
    const k = tickScale(time);
    const top = CLICK_TICK.origin[1] + (CLICK_TICK.top - CLICK_TICK.outline / 2 - CLICK_TICK.origin[1]) * k;
    const [x, y] = [CLICK_TICK.origin[0] - CLAW_ORIGIN[0], (k > 0 ? top : 10) - CLAW_ORIGIN[1]];
    const a = (claw.turn * Math.PI) / 180;
    const lifted = CLAW_ORIGIN[1] + x * claw.sx * Math.sin(a) + y * claw.sy * Math.cos(a) + (claw.lift / 100) * 120;
    reach = Math.max(reach, -lifted / 120);
  }
  assert.ok(reach <= CLAW_REACH && reach >= CLAW_REACH - .04, `claws and ticks reach ${reach.toFixed(3)} of the crab's height (CLAW_REACH ${CLAW_REACH})`);
  // The crab hides behind the measured footer edge (not a fixed line above it).
  assert.equal(crabWall({ x: 900, cap: 1, wall: 733 }, 800), 733);
  assert.equal(crabWall({ x: 900, cap: 1 }, 800), 800 - CRAB_WALL_PX);
  assert.equal(crabPlan([], 1280, 800, 733).wall, 733);
  assert.equal(crab(4, 1280, 800, { x: 900, cap: 1, wall: 733 }).wall, 733);
  assert.ok(Math.abs(crabBubble(1280, 800, { x: 900, cap: 1, wall: 733 }).y - crabBubble(1280, 800, { x: 900, cap: 1 }).y - (733 - 722)) < 1e-9, 'bubble follows the wall');
  const stage = readFileSync('src/revealEffects/wave.tsx', 'utf8');
  assert.match(stage, /querySelector\('\.student-show-controls'\)/, 'the Stage measures the footer');
  assert.match(stage, /className="wave-crab-clip" style=\{\{ height: crabWall\(plan, height\) \}\}/, 'the clip stops at the same wall');
  // The goodbye bubble starts above the top of the crab (never over its face), is big enough to read, and floats up.
  for (const [width, height] of VIEWPORTS) {
    for (const cap of [1, CRAB_EYES_ONLY, CRAB_PEEK]) {
      const layout = waveLayout(width, height);
      const bubble = crabBubble(width, height, { x: width * .7, cap });
      const crabTop = height - CRAB_WALL_PX - layout.crab.height * crabShows(cap, cap);
      assert.ok(bubble.y + bubble.size * .45 / 2 <= crabTop - .015 * layout.s, `${width}x${height} cap ${cap}: bubble starts above the crab`);
      assert.ok(bubble.size >= .055 * layout.s && bubble.rise > 0);
    }
  }
  assert.ok(CRAB_BUBBLE.size >= .055);
  assert.match(css, /\.wave-bubble > i \{[^}]*border: max\(3px, calc\(var\(--size\) \* \.08\)\) solid #4fc3d3;[^}]*#7fd8e240;/);
});

void test('wave reveal: the cheer reads as "Yay!" (arms up in a V, paws clear of the head and the grin)', () => {
  const r = OTTER_HEAD.r;
  const bezier = (arm: { from: readonly number[]; ctrl: readonly number[]; to: readonly number[] }, t: number) => [
    (1 - t) ** 2 * arm.from[0] + 2 * (1 - t) * t * arm.ctrl[0] + t * t * arm.to[0],
    (1 - t) ** 2 * arm.from[1] + 2 * (1 - t) * t * arm.ctrl[1] + t * t * arm.to[1],
  ];
  for (const pose of ['cheer', 'lower'] as const) {
    const drawing = OTTER_ARMS[pose];
    for (const side of ['near', 'far'] as const) {
      const arm = drawing[side];
      const paw = [arm.paw[0], arm.paw[1] + drawing.crouch];
      // Paws (r 8.6) sit wholly outside the head's outline.
      assert.ok(Math.hypot(paw[0] - OTTER_HEAD.x, paw[1] - OTTER_HEAD.y) >= r + 8.6, `${pose} ${side}: paw inside the head`);
      if (pose === 'cheer') assert.ok(paw[1] < OTTER_HEAD.earY, `cheer ${side}: paw above the ears`);
      // The arm (stroke half-width 10.5) never passes in front of the grin (its curve and its straight top).
      const grin = [...steps(0, 1, .05).map((t) => bezier(OTTER_HEAD.grin, t)), ...steps(0, 1, .1).map((u) => [mix(OTTER_HEAD.grin.from[0], OTTER_HEAD.grin.to[0], u), OTTER_HEAD.grin.from[1]])];
      for (const t of steps(0, 1, .02)) {
        const [x, y] = bezier(arm, t);
        const nearest = Math.min(...grin.map(([gx, gy]) => Math.hypot(gx - x, gy - (y + drawing.crouch))));
        assert.ok(nearest >= 10.5 + 2, `${pose} ${side}: arm over the grin at t ${t} (${nearest.toFixed(1)})`);
      }
    }
    // A clear V: the paws are far apart, one each side of the head.
    assert.ok(drawing.near.paw[0] > OTTER_HEAD.x + r && drawing.far.paw[0] < OTTER_HEAD.x - r, `${pose}: V`);
  }
  // The cheering arms pump about their shoulders in 180 ms swings while the cheer shows.
  assert.equal(PUMP_DEG, 10);
  assert.equal(PUMP_HALF_MS, 180);
  const pumping = steps(2.8, 3.3, .005).map(cheerPump);
  assert.ok(Math.max(...pumping) >= 9 && Math.min(...pumping) <= -9, 'full swings during the ride-out');
  assert.ok(Math.max(...steps(1.05, 1.2, .005).map(cheerPump)) >= 9, 'a pump as it pops up');
  for (const time of steps(0, DURATION, .01)) {
    if (Math.abs(cheerPump(time)) > 1e-9) assert.equal(surfOtter(time).pose, 'cheer', `pumping outside the cheer at ${time}`);
    assert.ok(Math.abs(cheerPump(time)) <= PUMP_DEG + 1e-9);
  }
  const tracks = waveTracks(1280, 800);
  assert.equal(tracks.cheerNear(2.85).transform, `rotate(${Math.round(cheerPump(2.85) * 100) / 100}deg)`);
  assert.equal(tracks.cheerFar(2.85).transform, `rotate(${Math.round(-cheerPump(2.85) * 100) / 100}deg)`);
});

void test('wave reveal: pose swaps are clean cuts through in-between drawings', () => {
  // The sequence of drawings the surfer goes through, in order.
  const sequence: string[] = [];
  const held = new Map<string, number>();
  let last = '';
  for (const time of steps(OTTER_PHASES.pop, 3.4, .001)) {
    const pose = surfOtter(time).pose;
    if (pose !== last) { sequence.push(pose); last = pose; }
    held.set(`${sequence.length - 1}:${pose}`, (held.get(`${sequence.length - 1}:${pose}`) ?? 0) + 1);
  }
  assert.deepEqual(sequence, ['cheer', 'lower', 'ride', 'reach', 'five', 'reach', 'crouch', 'tuck', 'cheer']);
  // Every in-between holds at least one 60 Hz frame and no more than 80 ms: the crouch leads the squint by ~40 ms.
  for (const [key, ms] of held) {
    const pose = key.split(':')[1];
    if (pose === 'lower' || pose === 'reach' || pose === 'crouch') assert.ok(ms >= 1000 / 60 && ms <= 80, `${key} held ${ms} ms`);
  }
  assert.ok(Math.abs(OTTER_INBETWEENS.squint - OTTER_PHASES.stall - .04) < 1e-9, 'the crouch leads the squint by 40 ms');
  assert.ok(OTTER_PHASES.fiveEnd < OTTER_PHASES.stall && OTTER_PHASES.stall - OTTER_PHASES.fiveEnd >= .06, 'the paw comes down over 60-80 ms');
  // Pose layers switch with step-end keyframes (never a two-pose cross-fade), and exactly one shows at a time.
  const tracks = waveTracks(1280, 800);
  for (const pose of OTTER_POSES) {
    for (const time of steps(0, DURATION, .05)) {
      const frame = tracks[`pose-${pose}`](time);
      assert.equal(frame.easing, 'step-end');
      assert.ok(frame.opacity === 0 || frame.opacity === 1);
    }
  }
  // Hidden in the tube it is already in the cheer drawing, so the burst never shows a stale frame.
  assert.equal(surfOtter(2.5).pose, 'cheer');
  assert.equal(surfOtter(2.5).opacity, 0);
  // It leaves the ride by zooming into the dark: tiny and a solid silhouette of the tube's teal just before the cut.
  const final = surfOtter(OTTER_PHASES.hidden - .001);
  assert.ok(final.opacity === 1 && final.scale <= DIVE.scale + .025 && otterShade(final) >= .999, `dive ends tiny and dark (${final.scale}, ${otterShade(final)})`);
});

void test('wave reveal: the POP is the biggest moment (stretch, squash, flash, two rings of spray)', () => {
  const spit = SPLASHES.find((splash) => splash.kind === 'spit' && splash.at === OTTER_PHASES.spit);
  assert.ok(spit && spit.size >= .45 && spit.ring, 'a big spit splash with a ring at the tube mouth');
  const drops = splashDrops({ ...spit, size: spit.size * 800, kind: 'spit' });
  assert.equal(drops.length, SPIT_DROPS);
  assert.ok(SPIT_DROPS >= 18);
  const inner = drops.filter((_, index) => index % 2 === 0);
  const outer = drops.filter((_, index) => index % 2 === 1);
  assert.ok(Math.max(...inner.map((drop) => drop.reach)) < Math.min(...outer.map((drop) => drop.reach)), 'two rings: inner and outer');
  assert.ok(Math.max(...inner.map((drop) => drop.diameter)) < Math.min(...outer.map((drop) => drop.diameter)), 'of different sizes');
  // A ~100 ms bright disc fills the tube at the POP.
  const flash = tubeFlashFx();
  assert.equal(flash.timing.delay, OTTER_PHASES.spit * 1000);
  assert.ok(flash.timing.duration >= 90 && flash.timing.duration <= 140);
  assert.equal(Math.max(...flash.keyframes.map((frame) => frame.opacity)), 1);
  assert.ok(insidePolygon(outlinePolygon(WAVE_TUBE), TUBE_FLASH.x, TUBE_FLASH.y), 'centred in the tube');
  assert.ok(waveFx(1280, 800)['tube-flash'], 'the Stage plays it');
  assert.match(css, /\.wave-tube-flash \{[^}]*radial-gradient\(circle, #ffffff/);
  // Stretched tall along the burst for the first frames, squashed wide on landing.
  const burst = surfOtter(OTTER_PHASES.spit + .02);
  assert.ok(burst.squash >= SPIT_STRETCH.y - .01 && otterScaleX(burst) <= SPIT_STRETCH.x + .01, `stretch ${otterScaleX(burst)} x ${burst.squash}`);
  assert.equal(SPIT_STRETCH.x, .8);
  assert.equal(SPIT_STRETCH.y, 1.25);
  const relaxed = surfOtter(OTTER_PHASES.spit + SPIT_STRETCH.relaxMs / 1000);
  assert.ok(Math.abs(relaxed.squash - 1) < .01 && Math.abs(otterScaleX(relaxed) - 1) < .01, 'relaxed within 90 ms');
  const land = surfOtter(OTTER_PHASES.cheer + .08);
  assert.ok(Math.abs(land.squash - SPIT_LANDING.y) < .01 && Math.abs(otterScaleX(land) - SPIT_LANDING.x) < .01, `landing squash ${otterScaleX(land)} x ${land.squash}`);
  // It bursts out at full brightness (no dark-grey figure).
  assert.equal(surfOtter(OTTER_PHASES.spit + .005).brightness, 1);
  assert.equal(surfOtter(OTTER_PHASES.spit + .012).opacity, 1);
});

void test('wave reveal: face streaks stay on the water, and the high-five has no mist', () => {
  const tube = outlinePolygon(WAVE_TUBE);
  const inWater = (x: number, y: number) => [0, 45, 90, 135, 180, 225, 270, 315].every((angle) =>
    insidePolygon(WAVE_SILHOUETTE, x + .01 * Math.cos((angle * Math.PI) / 180), y + .01 * Math.sin((angle * Math.PI) / 180)));
  STREAKS.forEach((_, index) => {
    for (const amount of steps(0, 1, .05)) {
      for (const [x, y] of streakEnds(index, amount)) {
        assert.ok(inWater(x, y), `streak ${index} end (${x.toFixed(3)}, ${y.toFixed(3)}) leaves the water at ${amount}`);
        assert.ok(!insidePolygon(tube, x, y), `streak ${index} crosses the tube`);
      }
    }
    const [a, b] = streakEnds(index, 0);
    assert.ok(Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - STREAK_LENGTH) < 1e-9);
    // It climbs the face (up and back), along its own length.
    const [c] = streakEnds(index, 1);
    assert.ok(c[1] > a[1] && c[0] < a[0]);
    const effect = loopFx('streak', index, 800);
    assert.equal(effect.keyframes[0].opacity, 0);
    assert.equal(effect.keyframes[effect.keyframes.length - 1].opacity, 0);
  });
  assert.match(css, /\.wave-streak \{[^}]*margin: calc\(var\(--s\) \* -\.0045\) 0 0 calc\(var\(--s\) \* -\.04\);/, 'centred on its spot');
  // Only water splashes have mist; the stars keep crisp outlines.
  assert.equal(hasMist('water'), true);
  assert.equal(hasMist('star'), false);
  assert.equal(hasMist('spit'), false);
  const fx = waveFx(1280, 800);
  const star = waveSplashes(1280, 800).find((splash) => splash.kind === 'star');
  assert.ok(star && !Object.keys(fx).some((name) => name.startsWith(`${star.id}-mist`)));
  assert.match(css, /\.wave-splash\.is-star > i \{[^}]*stroke='%23e0a300'/);
});

void test('wave reveal: the floating otter says a big, readable hello', () => {
  const hello = css.match(/\.wave-float-arm \{ transform-origin: ([\d.]+)% ([\d.]+)%; animation: wave-hi (\d+)ms (\d+)ms ease-in-out (\d+) alternate both; \}/);
  assert.ok(hello, 'hello timing');
  const [, ox, oy, half, delay, count] = hello.map(Number);
  assert.ok(half >= 170 && half <= 190, `${half} ms half-swings`);
  assert.ok(delay <= 320 && delay >= 280, 'starts as the lap nears full reach');
  assert.equal(count, 4);
  assert.ok(delay + half * count <= 1100);
  const arc = css.match(/@keyframes wave-hi \{ from \{ transform: rotate\((-?\d+)deg\); \} to \{ transform: rotate\((-?\d+)deg\); \} \}/);
  assert.ok(arc && Number(arc[1]) <= -26 + 1e-9 && Number(arc[2]) >= 20 - 1e-9, 'a wide arc');
  // The shoulder sits left of the head (its big head circle at (217, 62) in the 260 x 150 frame), so the paw
  // (62 units out, r 10) never reaches the face even at the widest swing.
  const shoulder = [(ox / 100) * 260, (oy / 100) * 150];
  assert.ok(FLOAT_HEAD.r >= 37 * 1.1, 'a big, cute head');
  for (let angle = Number(arc[1]); angle <= Number(arc[2]); angle += 2) {
    const a = (angle * Math.PI) / 180;
    const paw = [shoulder[0] - 4 * Math.cos(a) + 61 * Math.sin(a), shoulder[1] - 4 * Math.sin(a) - 61 * Math.cos(a)];
    assert.ok(Math.hypot(paw[0] - FLOAT_HEAD.x, paw[1] - FLOAT_HEAD.y) >= FLOAT_HEAD.r + 10, `paw on the face at ${angle} deg`);
  }
  // Big enough to read across a room (1.15x the first build's 0.253 S), lifted clear of the surface line, and
  // with its tail on screen by the time the lap is at full reach.
  assert.ok(FLOATER.width >= .29 - 1e-9 && FLOATER.top <= -.04 + 1e-9, `floater ${FLOATER.width} S at ${FLOATER.top}`);
  for (const [width, height] of LANDSCAPE) {
    const s = artUnit(width, height);
    const left = lapFront(.52, width, s) - LAP_WIDTH * s + FLOATER.left * s;
    assert.ok(left >= 0 && left + FLOATER.width * s < .45 * width, `${width}x${height}: floater at ${left.toFixed(0)} px`);
  }
});

void test('wave reveal: actors respect the header and footer', () => {
  for (const [width, height] of VIEWPORTS) {
    const s = artUnit(width, height);
    const layout = waveLayout(width, height);
    for (const time of steps(0, DURATION, .005)) {
      if (surfOtter(time).opacity > 0) assert.ok(otterTopPx(time, width, height) >= HEADER_SAFE_PX, `${width}x${height}: otter under the header at ${time}`);
      const d = dolphin(time);
      if (d.opacity > 0) {
        const centreY = height - s + riseY(time) * s + (1 - d.y) * s;
        assert.ok(centreY - layout.dolphin.width / 2 >= HEADER_SAFE_PX, `${width}x${height}: dolphin under the header at ${time}`);
      }
      // The growing wave's lip stays under the header too (only its spray may pass behind it).
      assert.ok(waveToScreen(time, width, height, .05, .84).y >= HEADER_SAFE_PX, `${width}x${height}: lip under the header at ${time}`);
    }
  }
});

void test('wave reveal: everything is gone before unmount', () => {
  for (const time of steps(4.2, DURATION, .01)) assert.equal(laceOpacity(time), 0);
  for (const time of steps(CRAB_TIMES.down, DURATION, .01)) assert.equal(crabRise(time), 0);
  for (const splash of SPLASHES) assert.ok(splash.at + SPLASH_MS / 1000 <= DURATION - .5, `splash at ${splash.at}`);
  for (const [width, height] of VIEWPORTS) {
    const s = artUnit(width, height);
    // The otter rides off with the wave (a move exit, no fade), gone well before the crab's goodbye.
    for (const time of steps(4.05, DURATION, .01)) assert.ok(otterBoxPx(time, width, height).left > width, `${width}x${height}: otter still on screen at ${time}`);
    assert.ok(crestX(4.05, width, s) > 0);
  }
  for (const time of steps(TUNNEL.gone, DURATION, .01)) assert.equal(tunnelEyes(time).opacity, 0);
  for (const time of steps(DOLPHIN.gone, DURATION, .01)) assert.equal(dolphin(time).opacity, 0);
  assert.ok(!lapVisible(.94) && !lapVisible(.05));
  assert.ok(lapFront(.92, 1280, 800) <= -.4 * 1280, 'the lap draws back off screen');
  assert.ok(Math.abs(lapFront(.52, 1280, 800) - LAP_REACH * 800) < 1e-9, '"almost!" reach');
});

void test('wave reveal: baked tracks are finite, bounded and end empty', () => {
  for (const [width, height] of VIEWPORTS) {
    const tracks = waveTracks(width, height);
    const crabs = crabTracks(width, height, crabPlan(groupsLayout(width, height, 4, 1), width, height));
    for (const [name, track] of [...Object.entries(tracks), ...Object.entries(crabs)]) {
      for (const time of steps(0, DURATION, 1 / 60)) {
        const frame = track(time);
        if (frame.transform !== undefined) {
          assert.doesNotMatch(frame.transform, /NaN|Infinity/, `${name} at ${time}`);
          assert.ok(numbers(frame.transform).every(Number.isFinite));
        }
        if (frame.opacity !== undefined) assert.ok(frame.opacity >= 0 && frame.opacity <= 1, `${name} opacity at ${time}`);
      }
    }
    // Exactly one otter pose layer shows at any moment.
    for (const time of steps(0, DURATION, .01)) {
      assert.equal(OTTER_POSES.filter((pose) => tracks[`pose-${pose}`](time).opacity === 1).length, 1, `${time}`);
    }
    const end = DURATION;
    for (const name of ['lap', 'dolphin', 'eyes', 'backwash', 'spray', 'crown', 'boardSpray'] as const) assert.equal(tracks[name](end).opacity, 0, `${name} at the end`);
    assert.equal(crabs.crab(end).opacity, 0);
    // The wave box has left the viewport at the end, at full size.
    const [waveX, , scale] = numbers(tracks.wave(end).transform);
    assert.equal(scale, 1);
    assert.ok(waveX + (.56 - .39) * artUnit(width, height) > width);
  }
});

void test('baked timeline: sampling and compaction are exact', () => {
  const track = (time: number) => ({ opacity: Math.round(Math.min(1, Math.max(0, time - 1)) * 1000) / 1000, transform: `translateX(${Math.round(time * 100) / 100}px)` });
  const frames = sampleTrack(track, 4500, 60);
  assert.equal(BAKE_FPS, 60);
  assert.equal(frames.length, 271);
  frames.forEach((frame, index) => {
    assert.deepEqual(frame, { ...track(index / 60), offset: index / 270 });
    if (index) assert.ok((frame.offset ?? 0) > (frames[index - 1].offset ?? 0));
  });
  assert.equal(frames[0].offset, 0);
  assert.equal(frames[270].offset, 1);
  assert.equal(sampleTrack(track, WAVE_DURATION_MS).length, Math.round(DURATION * 60) + 1);

  // Compaction keeps endpoints and reproduces every sampled value under linear playback.
  const flat = (time: number) => ({ opacity: time < 1 ? 0 : time < 2 ? Math.round((time - 1) * 1000) / 1000 : 1 });
  const sampled = sampleTrack(flat, 4500, 60);
  const compact = compactKeyframes(sampled);
  assert.ok(compact.length < sampled.length / 3, `compacted ${sampled.length} -> ${compact.length}`);
  assert.equal(compact[0].offset, 0);
  assert.equal(compact[compact.length - 1].offset, 1);
  for (const frame of sampled) {
    const offset = frame.offset ?? 0;
    const after = compact.findIndex((kept) => (kept.offset ?? 0) >= offset - 1e-12);
    const b = compact[after];
    const a = compact[Math.max(0, after - 1)];
    const span = (b.offset ?? 0) - (a.offset ?? 0);
    const amount = span > 0 ? (offset - (a.offset ?? 0)) / span : 1;
    const value = Number(a.opacity) + (Number(b.opacity) - Number(a.opacity)) * amount;
    assert.ok(Math.abs(value - Number(frame.opacity)) < 1e-9, `offset ${offset}`);
  }
  // Every wave track compacts without changing its first or last frame.
  const tracks = waveTracks(1280, 800);
  for (const [name, sample] of Object.entries(tracks)) {
    const all = sampleTrack(sample, WAVE_DURATION_MS);
    const kept = compactKeyframes(all);
    assert.deepEqual(kept[0], all[0], name);
    assert.deepEqual(kept[kept.length - 1], all[all.length - 1], name);
  }
});

void test('wave reveal: secondary effects are finite Web Animations that finish in time', () => {
  for (const [width, height] of VIEWPORTS) {
    const fx = { ...waveFx(width, height), ...crabFx(width, height, crabPlan([], width, height)) };
    const loops = Object.keys(fx).filter((name) => name.startsWith('loop-'));
    assert.equal(loops.length, Object.values(LOOP_COUNTS).reduce((a, b) => a + b, 0));
    assert.equal(waveSplashes(width, height).length, SPLASHES.length);
    // Over the dark tube the spit is crisp droplets and a ring flash, never a grey mist puff.
    for (const spec of waveSplashes(width, height).filter((splash) => splash.kind === 'spit')) {
      assert.ok(!Object.keys(fx).some((name) => name.startsWith(`${spec.id}-mist`)), `${spec.id} has no mist`);
    }
    assert.ok(fx['splash-4-ring'], 'ring flash at the tube mouth');
    assert.ok(fx['crab-bubble'] && fx['crab-drop-0'], 'crab bubble pops into droplets');
    for (const [name, effect] of Object.entries(fx)) {
      const offsets = effect.keyframes.map((frame) => frame.offset);
      assert.equal(offsets[0], 0, name);
      assert.equal(offsets[offsets.length - 1], 1, name);
      offsets.slice(1).forEach((offset, index) => assert.ok(offset > offsets[index], `${name} offsets increase`));
      for (const frame of effect.keyframes) {
        assert.ok(frame.opacity >= 0 && frame.opacity <= 1, name);
        assert.doesNotMatch(frame.transform, /NaN|Infinity|var\(/, name);
      }
      if (name.startsWith('loop-')) assert.equal(effect.timing.iterations, Infinity, name);
      else {
        assert.equal(effect.timing.iterations, 1, name);
        assert.ok(effect.timing.delay + effect.timing.duration <= WAVE_DURATION_MS - 50, `${name} ends before unmount`);
        assert.equal(effect.keyframes[effect.keyframes.length - 1].opacity, 0, `${name} ends invisible`);
      }
    }
  }
});

void test('wave reveal: visual beats line up with the sound plan', () => {
  assert.deepEqual(SPLASHES.map((splash) => splash.at), [1.02, 1.665, 1.86, 2.165, 2.72, 2.74, 2.98], 'pop-up, leap, tail-five, dive, spit, splashdown');
  assert.equal(DOLPHIN.fiveAt, 1.86);
  assert.ok(surfOtter(2.73).opacity > 0 && surfOtter(2.71).opacity === 0, 'the POP lands at 2.72 s');
  assert.ok(tunnelEyes(2.5).opacity === 1 && tunnelEyes(2.72).opacity === 0, 'hush: only the eyes before the spit');
  assert.deepEqual([...CRAB_TIMES.clicks], [4.34, 4.46]);
  assert.equal(CRAB_BUBBLE_AT, 4.54);
  // The shipped recipe (scripts/reveal-sound-cues.json) puts its accents on these beats.
  type Recipe = { durationMs: number; cues: { file: string; at: number; speed?: number; length?: number; rms?: number }[] };
  const recipe = (JSON.parse(readFileSync('scripts/reveal-sound-cues.json', 'utf8')) as Record<string, Recipe | undefined>).wave;
  assert.ok(recipe, 'the wave has a shipped sound recipe');
  assert.equal(recipe.durationMs, WAVE_DURATION_MS, 'the wave sound is as long as the animation');
  const cue = (file: string) => recipe.cues.filter((entry) => entry.file.endsWith(file)).map((entry) => entry.at);
  assert.ok(cue('plop_02.ogg').some((at) => Math.abs(at + .1 - OTTER_PHASES.spit) <= .03), 'plop transient on the spit');
  assert.ok(cue('splash_10.ogg').some((at) => Math.abs(at - DOLPHIN.fiveAt) <= .02), 'wet pat on the tail-five');
  const clicks = recipe.cues.filter((entry) => entry.file.endsWith('wooden_02.ogg')).map((entry) => entry.at + .06 / (entry.speed ?? 1));
  CRAB_TIMES.clicks.forEach((click, index) => assert.ok(Math.abs(clicks[index] - click) <= .02, `click ${index}`));
  for (const entry of recipe.cues) assert.ok(entry.at >= .08 && entry.at <= DURATION - .05, `${entry.file} at ${entry.at}`);
  // Nothing but a very soft tube murmur plays during the tunnel hush (so it is suspense, not a dropout).
  const murmur = recipe.cues.filter((entry) => entry.at >= TUNNEL.in && entry.at < TUNNEL.open && (entry.rms ?? 1) <= .005);
  assert.equal(murmur.length, 1, 'a quiet murmur under the peek-a-boo');
  assert.ok(murmur[0].at + (murmur[0].length ?? 0) / (murmur[0].speed ?? 1) >= TUNNEL.out - .02, 'it lasts until the spit');
  // ...apart from one tiny, soft tick exactly as the eyes blink shut.
  const blink = recipe.cues.filter((entry) => entry.file.endsWith('plop_01.ogg') && entry.at > TUNNEL.in && entry.at < TUNNEL.out);
  assert.ok(blink.length <= 1 && blink.every((entry) => (entry.rms ?? 1) <= .01 && Math.abs(entry.at - TUNNEL.closed) <= .02), 'at most a soft blink tick');
  for (const entry of recipe.cues) {
    const end = entry.at + (entry.length ?? .3) / (entry.speed ?? 1);
    if (!entry.file.endsWith('plop_02.ogg') && !murmur.includes(entry) && !blink.includes(entry)) assert.ok(end <= TUNNEL.in + .04 || entry.at >= TUNNEL.out, `${entry.file} breaks the hush`);
  }
  // A tiny, soft tick on each of the crab's looks.
  for (const look of [3.84, 4.08]) assert.ok(recipe.cues.some((entry) => entry.file.endsWith('plop_01.ogg') && Math.abs(entry.at - look) <= .03 && (entry.rms ?? 1) <= .015), `peek tick at ${look}`);
  assert.equal(crabLook(3.84), -1);
  assert.equal(crabLook(4.08), 1);
  // A wet slap as the otter lands on the wave's back (splash_12's transient is ~60 ms into the clip). This
  // reads the shipped recipe: it passes once work/sound-recipes/wave.json is merged into it.
  assert.ok(cue('splash_12.ogg').some((at) => Math.abs(at + .06 - OTTER_PHASES.cheer) <= .02), 'splash on the ride-out landing');
});

void test('wave reveal: the cheer after the POP plays on stage, not off the right edge', () => {
  for (const [width, height] of VIEWPORTS) {
    // Fully inside [0, W] from the moment it reaches full size (2.78) for well over 0.45 s.
    let until = 2.78;
    for (const time of steps(2.78, 4, .005)) {
      const box = otterBoxPx(time, width, height);
      if (box.left < 0 || box.right > width) break;
      until = time;
    }
    assert.ok(until - 2.78 >= .5, `${width}x${height}: cheer fully visible only until ${until}`);
    // The landing squash peaks while it is fully visible, and the arms pump there in full swings.
    const peak = OTTER_PHASES.cheer + .08;
    assert.ok(peak < until, `${width}x${height}: landing squash off screen`);
    const swings = steps(OTTER_PHASES.cheer, until, .005).map(cheerPump);
    let crossings = 0;
    for (let index = 1; index < swings.length; index++) if (Math.sign(swings[index]) !== Math.sign(swings[index - 1]) && swings[index] !== 0) crossings++;
    assert.ok(crossings >= 2 && Math.max(...swings) >= 9 && Math.min(...swings) <= -9, `${width}x${height}: pumps after landing (${crossings})`);
    // On screen it holds near the right-hand third: it hops up and back while the wave rolls on beneath it.
    const hop = steps(2.78, OTTER_PHASES.cheer, .01).map((time) => { const box = otterBoxPx(time, width, height); return (box.left + box.right) / 2 / width; });
    assert.ok(Math.max(...hop) - Math.min(...hop) < .08, `${width}x${height}: hop drifts ${Math.max(...hop) - Math.min(...hop)}`);
  }
  // A ballistic hop: it rises, then comes down onto the wave's back and lands with the squash.
  const rise = surfOtter(OTTER_PHASES.spit + .15).y;
  assert.ok(rise > surfOtter(OTTER_PHASES.spit).y + .06 && rise > RIDE_OUT.y + .03);
  assert.ok(Math.abs(surfOtter(OTTER_PHASES.cheer).x - RIDE_OUT.x) < 1e-9 && Math.abs(surfOtter(OTTER_PHASES.cheer).y - RIDE_OUT.y) < 1e-9);
  assert.ok(PUMP_UNTIL >= 3.5 && cheerPump(PUMP_UNTIL + .01) === 0);
  // The splashdown sits under the board as it lands.
  const splashdown = SPLASHES[SPLASHES.length - 1];
  assert.ok(splashdown.at === OTTER_PHASES.cheer && Math.hypot(splashdown.x - RIDE_OUT.x, splashdown.y - RIDE_OUT.y) < .02 && splashdown.kind === 'water');
});

void test('wave reveal: the dolphin follows through after the tail-five instead of snapping over', () => {
  // Never more than ~13 deg per 10 ms (it used to turn 40 deg in 10 ms), and still nose-down for the dive.
  let fastest = 0;
  for (const time of steps(DOLPHIN.fiveAt - .05, DOLPHIN.fiveAt + .2, .005)) fastest = Math.max(fastest, Math.abs(dolphin(time + .01).angle - dolphin(time).angle));
  assert.ok(fastest <= 14, `turns ${fastest.toFixed(1)} deg in 10 ms`);
  assert.ok(dolphin(DOLPHIN.fiveAt + DOLPHIN_FLICK_MS / 1000 + .02).angle > 70, 'nose-down after the flick');
  assert.ok(DOLPHIN_FLICK_MS >= 90 && DOLPHIN_FLICK_MS <= 150);
});

/** A Web Animations keyframe list played at `progress` (0..1): linear between keyframes, or held by a keyframe's step-end. */
function playAt(frames: readonly Keyframe[], progress: number, property: 'opacity'): number {
  const offsets = frames.map((frame, index) => frame.offset ?? index / Math.max(1, frames.length - 1));
  if (progress <= offsets[0]) return Number(frames[0][property]);
  for (let index = 1; index < frames.length; index++) {
    if (progress < offsets[index]) {
      const from = frames[index - 1];
      if (from.easing === 'step-end') return Number(from[property]);
      const amount = (progress - offsets[index - 1]) / (offsets[index] - offsets[index - 1]);
      return Number(from[property]) + (Number(frames[index][property]) - Number(from[property])) * amount;
    }
  }
  return Number(frames[frames.length - 1][property]);
}

void test('wave reveal: no see-through ghost frames (solid art appears and leaves with pops, cuts and shrinks)', () => {
  const frameTime = 1 / BAKE_FPS;
  // The otter and the peeking head are only ever fully there or not there at all...
  for (const time of steps(0, DURATION, .001)) {
    assert.ok([0, 1].includes(surfOtter(time).opacity), `otter opacity ${surfOtter(time).opacity} at ${time}`);
    assert.ok([0, 1].includes(tunnelEyes(time).opacity), `head opacity ${tunnelEyes(time).opacity} at ${time}`);
  }
  // ...and stay so when baked at 60 Hz and played back between samples: the sample before each cut holds (step-end).
  for (const [width, height] of [[1280, 800], [960, 680], [1920, 1080]] as const) {
    const tracks = waveTracks(width, height, BAKE_FPS);
    for (const name of ['otter', 'eyes'] as const) {
      const frames = compactKeyframes(sampleTrack(tracks[name], WAVE_DURATION_MS, BAKE_FPS));
      for (const time of steps(0, DURATION, .0025)) {
        const value = playAt(frames, time / DURATION, 'opacity');
        assert.ok(Math.abs(value) < 1e-9 || Math.abs(value - 1) < 1e-9, `${width}x${height} ${name}: ${value.toFixed(3)} opacity at ${time}`);
      }
    }
    // The cuts land within one frame of the beats: the pop-up, the dive into the tube, the head's peek and the POP.
    const otter = compactKeyframes(sampleTrack(tracks.otter, WAVE_DURATION_MS, BAKE_FPS));
    const eyes = compactKeyframes(sampleTrack(tracks.eyes, WAVE_DURATION_MS, BAKE_FPS));
    const shown = (frames: Keyframe[], time: number) => playAt(frames, time / DURATION, 'opacity') === 1;
    const frame = 1 / BAKE_FPS;
    assert.ok(!shown(otter, OTTER_PHASES.pop - .001) && shown(otter, OTTER_PHASES.pop + frame + .001), 'pop-up');
    assert.ok(shown(otter, OTTER_PHASES.hidden - .002) && !shown(otter, OTTER_PHASES.hidden + frame), 'into the tube');
    assert.ok(!shown(eyes, TUNNEL.in - .002) && shown(eyes, TUNNEL.in + frame), 'head peeks');
    assert.ok(shown(eyes, TUNNEL.gone - .002) && !shown(eyes, TUNNEL.gone + frame), 'head gone at the POP');
    assert.ok(!shown(otter, OTTER_PHASES.spit - .002) && shown(otter, OTTER_PHASES.spit + frame), 'POP');
  }
  // The POP flash is at full brightness from its very first frame and covers the winding-up head, so the head's
  // cut and the otter's first frame both happen under it.
  const flash = tubeFlashFx();
  const lit = flash.keyframes.find((key) => key.opacity === 1);
  assert.ok(lit && lit.offset * flash.timing.duration <= 1, 'flash at full brightness at once');
  assert.ok(flash.keyframes.filter((key) => key.offset * flash.timing.duration <= flash.timing.duration * .35).every((key) => key.offset === 0 || key.opacity === 1), 'and it holds');
  const scale = numbers(lit.transform)[0];
  const opaque = .6 * Math.SQRT1_2 * TUBE_FLASH.size * scale; // radius of the gradient's solid aqua stop
  const head = tunnelEyes(TUNNEL.gone - .001);
  const halfW = (TUNNEL_HEAD.width * head.scaleX) / 2;
  const halfH = (TUNNEL_HEAD.height * head.scaleY) / 2;
  assert.ok(Math.hypot(Math.abs(TUBE_EYE.x - TUBE_FLASH.x) + halfW * .9, Math.abs(TUBE_EYE.y - TUBE_FLASH.y) + halfH * .9) <= opaque, 'flash covers the head');
  // The pop-up: solid from its first frame, small and stretched up ("sproing"), never a see-through fade-in.
  const first = surfOtter(OTTER_PHASES.pop + frameTime);
  assert.ok(first.opacity === 1 && first.scale < .75 && first.squash > 1.05 && otterScaleX(first) < .95, `pop-up ${first.scale} ${first.squash}`);
  // The dive darkens to a solid silhouette before it is cut (it never shows a half-transparent otter).
  assert.ok(otterShade(surfOtter(DIVE.dark[1])) >= .999 && DIVE.dark[1] < OTTER_PHASES.hidden);
  // Droplets, sparkles, the crab's click ticks and its bubble's droplets are solid while they show and leave by
  // shrinking: every keyframe is fully opaque or fully hidden, and the last visible one is tiny.
  const fx = { ...waveFx(1280, 800), ...crabFx(1280, 800, { x: 900, cap: 1 }) };
  for (const [name, effect] of Object.entries(fx)) {
    if (!/-drop-|crab-tick/.test(name)) continue;
    assert.ok(effect.keyframes.every((key) => key.opacity === 0 || key.opacity === 1), `${name} is never see-through`);
    const visible = effect.keyframes.filter((key) => key.opacity === 1);
    const end = numbers(visible[visible.length - 1].transform);
    assert.ok(end[end.length - 1] <= .2, `${name} shrinks away (${end[end.length - 1]})`);
    assert.ok(effect.keyframes[0].opacity === 0 && effect.keyframes[1].offset * effect.timing.duration <= 2, `${name} pops in`);
  }
  assert.ok(DROP_GONE_SCALE <= .1);
});

void test('wave reveal: the first frame stays light (the scene mounts after it and joins the same clock)', () => {
  const stage = readFileSync('src/revealEffects/wave.tsx', 'utf8');
  // Only the tease bakes with the reveal; the rest waits for the first paint; no second forced cover measure at mount.
  assert.match(stage, /const TEASE_TRACKS: readonly WaveTrackName\[\] = \['lap', 'float'\];/);
  assert.match(stage, /afterNextPaint\(\(\) => \{/);
  assert.match(stage, /\{plan && <WaveScene /);
  assert.doesNotMatch(stage, /useRevealTargets\(/);
  assert.equal((stage.match(/useBakedTracks\([^)]*clock\)/g) ?? []).length, 2, 'both bakes share one clock');
  // Joining: a paused reference (scrubbing) pauses and seeks; a playing one shares its start time.
  type Fake = { playState: string; startTime: number | null; currentTime: number | null; playbackRate: number; paused?: boolean; pause(): void };
  const fake = (playState: string, startTime: number | null, currentTime: number | null): Fake => ({ playState, startTime, currentTime, playbackRate: 1, pause() { this.paused = true; this.playState = 'paused'; } });
  const late = fake('running', null, 0);
  joinClock(late as unknown as Animation, fake('paused', null, 3200) as unknown as Animation);
  assert.ok(late.paused && late.currentTime === 3200);
  const live = fake('running', null, 0);
  joinClock(live as unknown as Animation, fake('running', 1234.5, 40) as unknown as Animation);
  assert.equal(live.startTime, 1234.5);
});
