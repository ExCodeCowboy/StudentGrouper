import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { wizardEffect } from '../src/revealEffects/wizard';
import {
  BLOOM, COMMAND_ROOM, BOOP_ANGLE_ABOVE, BOOP_ANGLE_BELOW, BOOP_ANGLE_SIDE, BOOP_TIP_ABOVE, BOOP_TIP_BELOW, BOOP_TIP_SIDE, BOOP_WING, CANDLE_DRIFT_DELAY, CANDLE_EXIT, CANDLE_GONE,
  FEATHER_END, FEATHER_START, FLUFF_HIDDEN, LETTER_EASE, LETTER_POP_MS, OWL_RIG, SWIRL_CURLS, WORD_OUT_MS,
  WIZARD_BEATS as B, WIZARD_DURATION_MS, WIZARD_FOOTER_SAFE, WIZARD_HEADER_SAFE, WIZARD_WORDS,
  boopOptions, boopable, burstPlan, candleSlots, cubicBezier, envelopeSize, featherAt, flightPlan, hiddenCost, irisDiameter, isDense, letterBoxAt, letterFlutter, letterPlan, lockBox, namesBox, namesCenter,
  owlBoxes, owlCenter, owlPose, owlToWorld, passTime, popTime, readingZones, satchelPoint, sparkPlan, wandTipLocal, wordBox,
  WIZARD_COVER_VAR_NAMES, swirlArcFraction, swirlAt, swirlParam, wandTip, wizardCoverVars, wizardLastVisible, wizardLayout,
  type Box, type OwlPose, type Point, type WizardLayout, type WizardRect,
} from '../src/revealEffects/wizardTimeline';
import {
  TRACK_FPS, TRAIL_END, TRAIL_POINTS, TRAIL_PER_SEGMENT, collapseHidden, compressTrack, trackTimes, unwrapAngles, windowTrack, wizardTracks, type TimedTrack,
} from '../src/revealEffects/wizardTracks';

// Cover rectangles measured in the reveal lab (work/design/wizard-layouts.json), rebuilt as grids.
type Case = { name: string; W: number; H: number; rects: WizardRect[] };
const grid = (xs: number[], ys: number[], w: number, h: number, radius: number) =>
  xs.flatMap((left) => ys.map((top) => ({ left, top, width: w, height: h, radius })));
const CASES: Case[] = [
  { name: 'groups-1', W: 1280, H: 800, rects: grid([24], [74], 1217, 637, 25) },
  { name: 'groups-2', W: 1280, H: 800, rects: grid([24, 643], [74], 599, 637, 25) },
  { name: 'groups-4', W: 1280, H: 800, rects: grid([24, 333, 643, 952], [74], 289, 637, 25) },
  { name: 'groups-8', W: 1280, H: 800, rects: grid([24, 333, 643, 952], [74, 402], 289, 308, 25) },
  { name: 'groups-12', W: 1280, H: 800, rects: grid([24, 333, 643, 952], [74, 325, 576], 289, 231, 25) },
  { name: 'today-5x3', W: 1280, H: 800, rects: grid([348, 647, 946], [123, 216, 309, 402, 495], 269, 76, 13) },
  { name: 'today-12x4 (scrolled)', W: 1280, H: 800, rects: grid([348, 572, 796, 1020], Array.from({ length: 12 }, (_, i) => 123 + 93 * i), 210, 76, 13) },
  { name: 'groups-4 @960x680', W: 960, H: 680, rects: [{ left: 24, top: 74, width: 286, height: 258, radius: 25 }, { left: 24, top: 352, width: 286, height: 258, radius: 25 }, { left: 330, top: 74, width: 286, height: 258, radius: 25 }, { left: 635, top: 74, width: 286, height: 258, radius: 25 }] },
  { name: 'today-5x3 @960x680', W: 960, H: 680, rects: grid([272, 491, 710], [141, 260, 379, 498, 617], 181, 90, 13) },
  { name: 'groups-6 @1920x1080', W: 1920, H: 1080, rects: grid([24, 337, 650, 963, 1275, 1588], [74], 293, 917, 25) },
  { name: 'picker', W: 1280, H: 800, rects: [{ left: 190, top: 150, width: 900, height: 520, radius: 32 }] },
];
const layoutOf = (c: Case) => wizardLayout(c.rects, { width: c.W, height: c.H });
const LAYOUTS = CASES.map((c) => ({ ...c, layout: layoutOf(c) }));
const byName = Object.fromEntries(LAYOUTS.map(({ name, layout }) => [name, layout]));
const overlapping = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const envelopeBox = (card: WizardLayout['cards'][number], pad = 0): Box => ({ l: card.centerX - card.envW / 2 - pad, r: card.centerX + card.envW / 2 + pad, t: card.centerY - card.envH / 2 - pad, b: card.centerY + card.envH / 2 + pad });
const readCss = () => readFileSync('src/revealEffects/wizard.css', 'utf8').replace(/\r\n/g, '\n');
const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step + 1e-9) + 1 }, (_, i) => +(from + i * step).toFixed(6));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** The highest and lowest points of the owl rig (hat tip, head, feet) in viewport px. */
function rigExtent(pose: OwlPose, layout: WizardLayout) {
  const b = pose.bodyScale;
  const rad = pose.hatRot * Math.PI / 180;
  const tipLocal = { x: 12, y: -113 - OWL_RIG.hatPivot.y };
  const hatTip = {
    x: pose.hatX + tipLocal.x * Math.cos(rad) - tipLocal.y * Math.sin(rad),
    y: pose.hatY - 56 * (b - 1) + OWL_RIG.hatPivot.y + tipLocal.x * Math.sin(rad) + tipLocal.y * Math.cos(rad),
  };
  const points = [hatTip, { x: 0, y: -60 * b }, { x: 0, y: OWL_RIG.feet * b }].map((p) => owlToWorld(pose, layout.S, p));
  return { top: Math.min(...points.map((p) => p.y)), bottom: Math.max(...points.map((p) => p.y)) };
}

void test('wizard reveal: effect contract and duration budget', () => {
  assert.equal(wizardEffect.id, 'wizard');
  assert.equal(wizardEffect.durationMs, WIZARD_DURATION_MS);
  assert.equal(WIZARD_DURATION_MS, 7200);
  assert.ok(wizardEffect.durationMs <= 9800);
  // No sound until the integrator wires the wizard track (RevealSoundId gains 'wizard' then).
  assert.equal(wizardEffect.sound, 'wizard');
  assert.equal(typeof wizardEffect.Stage, 'function');
  assert.equal(typeof wizardEffect.Cover, 'function');
  assert.match(wizardEffect.name, /owl/i);
});

void test('wizard reveal: beats are ordered and the chant words land on the curl tops', () => {
  const order = [B.nightIn, B.qSpin, B.irisStart, B.owlIn, B.nightFull, B.passStart, B.passEnd, B.uTurn, B.glideStart, B.glideEnd, B.swirlStart, B.chant1, B.chant2, B.wandOut, B.swirlEnd, B.tap, B.starIn, B.starSquash, B.burst, B.perchStart, B.perch, B.poof, B.fizz, B.giggle, B.look, B.hop, B.dip, B.boop, B.recoil, B.exit, B.exitEnd, B.lastLetter];
  for (let i = 1; i < order.length; i++) assert.ok(order[i] >= order[i - 1], `beat ${i} is in order`);
  assert.ok(B.lastLetter * 1000 < WIZARD_DURATION_MS);
  // Nightfall: the "?" finishes its spin (0.10-0.40) inside the still-opaque parchment, then the iris covers the card by 0.64.
  assert.ok(B.qSpin + 0.3 <= B.irisStart + 0.1 && B.irisStart + 0.3 <= B.nightFull + 1e-9);
  // The shockwave (4.42) knocks the owl back (4.44), and the lights come on after the candles are snuffed.
  assert.ok(B.burst < B.perchStart && B.perchStart - B.burst <= 0.05);
  // Lights on is an opaque curtain wipe (wz-veil-lift, 200 ms in wizard.css), not an opacity fade.
  assert.ok(B.candlesOut < B.veilOut && B.veilGone - B.veilOut <= 0.2 + 1e-9, 'a quick lights-on lift');
  assert.ok(Math.abs(swirlParam(B.chant1) - SWIRL_CURLS[0]) < 0.005);
  assert.ok(Math.abs(swirlParam(B.chant2) - SWIRL_CURLS[1]) < 0.005);
  let previous = -1;
  for (const time of range(B.swirlStart, B.swirlEnd, 0.005)) {
    const u = swirlParam(time);
    assert.ok(u >= previous - 1e-12, 'swirl progress never runs backwards');
    previous = u;
  }
  assert.equal(swirlParam(B.swirlStart), 0);
  assert.ok(Math.abs(swirlParam(B.swirlEnd) - 1) < 1e-9);
});

void test('wizard reveal: every cover lands, pops and is gone in time; exactly one stubborn letter', () => {
  for (const { name, layout } of LAYOUTS) {
    assert.equal(layout.cards.length, CASES.find((c) => c.name === name)!.rects.length);
    for (const card of layout.cards) {
      assert.ok(card.land >= 0.9 && card.land <= 2.35, `${name} #${card.index}: lands during the delivery pass (${card.land})`);
      if (card.stuck) {
        assert.equal(card.fizz, B.fizz); assert.equal(card.pop, B.boop); assert.equal(card.boost, 1.4);
      } else {
        assert.ok(card.pop >= 4.6 && card.pop <= 5.05, `${name} #${card.index}: pops in the ripple (${card.pop})`);
        assert.equal(card.fizz, card.pop);
      }
      assert.ok(card.pop + 0.56 <= 7.05, `${name} #${card.index}: cover fully transparent by 7.05 s`);
      const vars = wizardCoverVars(card);
      assert.equal(vars['--wz-land'], `${Math.round(card.land * 1000)}ms`);
      assert.equal(vars['--wz-pop'], `${Math.round(card.pop * 1000)}ms`);
      // The night iris clears the card's corners (with its rim glow), and its star field is anchored to the viewport.
      const iris = irisDiameter(card.width, card.height);
      assert.ok(iris >= Math.hypot(card.width, card.height) + 40, `${name}: iris covers the card`);
      assert.equal(vars['--wz-iris'], `${iris.toFixed(2)}px`);
      assert.ok(Math.abs(parseFloat(vars['--wz-sky-x']) + card.left + card.width / 2 - iris / 2) < 0.01);
      assert.ok(Math.abs(parseFloat(vars['--wz-sky-y']) + card.top + card.height / 2 - iris / 2) < 0.01);
    }
    const stuck = layout.cards.filter((card) => card.stuck);
    const anyVisible = layout.cards.some((card) => card.visible > 0);
    assert.equal(stuck.length, anyVisible ? 1 : 0, `${name}: one stubborn letter`);
    if (stuck.length) {
      assert.equal(layout.stuck, stuck[0].index);
      assert.ok(stuck[0].visible >= 0.7, `${name}: the stubborn card is well visible`);
      const metrics = { W: layout.W, H: layout.H, S: layout.S, safeTop: layout.safeTop, safeBottom: layout.safeBottom };
      const anyBoopable = layout.cards.some((card) => card.visible >= 0.7 && boopable({ x: card.sealX, y: card.sealY }, metrics));
      if (anyBoopable) assert.ok(boopable({ x: stuck[0].sealX, y: stuck[0].sealY }, metrics), `${name}: the owl can reach the stubborn seal`);
    }
    assert.ok(wizardLastVisible(layout) <= 7.1, `${name}: nothing visible after 7.1 s`);
  }
  // No visible cards: no stubborn letter, and the owl still flies and leaves.
  const empty = wizardLayout([{ left: 0, top: 2000, width: 200, height: 100 }], { width: 1280, height: 800 });
  assert.equal(empty.stuck, -1);
  assert.equal(empty.boop, null);
  assert.equal(owlPose(7, empty).opacity, 0);
});

void test('wizard reveal: stubborn-card choice and boop pose keep the owl off the revealed names', () => {
  const stuckCard = (name: string) => byName[name].cards[byName[name].stuck];
  assert.equal(stuckCard('groups-1').index, 0);
  // The rightmost card, booped from below-left with the wand in the right wing: the owl hovers over the gutter and the
  // empty lower halves, not over its own names (they appear at the boop) or card 3's.
  assert.equal(stuckCard('groups-4').centerX, 952 + 289 / 2);
  assert.deepEqual([byName['groups-4'].boop?.pose, byName['groups-4'].boop?.side], ['below', 1]);
  // 8 cards: the right column, booped from the side with the owl in the gutter (a short hop from the tap point).
  assert.equal(stuckCard('groups-8').left, 952);
  assert.equal(byName['groups-8'].boop?.pose, 'side');
  // 960x680: the lower-left card, booped from the side with the owl over the empty page right of it (it hides no names).
  assert.deepEqual([stuckCard('groups-4 @960x680').left, stuckCard('groups-4 @960x680').top], [24, 352]);
  assert.equal(byName['groups-4 @960x680'].boop?.pose, 'side');
  // Today: the bottom-right cell, booped from below the table (not over the team column).
  assert.deepEqual([stuckCard('today-5x3').left, stuckCard('today-5x3').top], [946, 495]);
  assert.equal(byName['today-5x3'].boop?.pose, 'below');
  for (const { name, layout } of LAYOUTS) {
    if (!layout.boop) continue;
    assert.equal(layout.boop.clamped, false, `${name}: no clamping needed`);
    assert.equal(layout.boop.cost, boopOptions(layout.boop.seal, layout, readingZones(layout.cards, layout.m, -1))[0].cost, `${name}: the cheapest pose is used`);
  }
  // On the picker the owl boops from beside the seal, not over the middle where the name appears.
  const picker = byName.picker, card = picker.cards[0];
  assert.equal(picker.boop?.pose, 'side');
  assert.ok(Math.abs(picker.boop!.owl.x - (card.left + card.width / 2)) > 0.18 * card.width, 'picker: the owl hovers beside the name');
  // On the group layouts the boop hides (almost) none of the names, the stubborn card's own included (they appear at the boop).
  for (const name of ['groups-2', 'groups-4', 'groups-6 @1920x1080', 'groups-4 @960x680']) {
    const layout = byName[name];
    const zones = readingZones(layout.cards, layout.m, -1).filter((zone) => zone.w === 1);
    const hidden = hiddenCost(owlBoxes(layout.boop!.owl, layout.S, [layout.boop!.side < 0 ? 1 : -1]), zones, layout.S);
    assert.ok(hidden < 0.25, `${name}: boop hides ${hidden.toFixed(2)} S² of names`);
  }
  // After the boop the owl recoils away from the seal and from the stubborn card's name column.
  for (const { name, layout } of LAYOUTS) {
    if (!layout.boop) continue;
    const names = namesCenter(layout.cards[layout.stuck], layout.m);
    const { O, recoil } = layout.path;
    assert.ok(dist(recoil, names) >= dist(O, names) - 1e-6, `${name}: the recoil moves off the name column`);
    assert.ok(dist(recoil, layout.boop.seal) >= dist(O, layout.boop.seal) - 1e-6, `${name}: the recoil moves off the seal`);
  }
});

void test('wizard reveal: the owl watches the star, is knocked back by the burst, and perches where it hides the fewest names', () => {
  for (const { name, layout } of LAYOUTS) {
    const { G, T } = layout.path;
    assert.ok(G.x > layout.star.x + layout.star.r, `${name}: the perch is right of the star (the knock-back never crosses it)`);
    assert.ok(Math.hypot(G.x - T.x, G.y - T.y) <= Math.max(2.4 * layout.S, 0.22 * layout.W) + 1e-6, `${name}: a short knock-back from the tap`);
    // It hovers at the tap point (a small bob), eyes on the star, while the star gathers itself and bursts.
    for (const time of range(B.tap, B.perchStart, 0.01)) {
      const p = owlCenter(time, layout);
      assert.ok(Math.abs(p.x - T.x) < 1e-9 && Math.abs(p.y - T.y) <= 0.013 * layout.H, `${name} @${time}: hovering at the tap point`);
    }
    const watching = owlPose(4.38, layout);
    assert.equal(watching.eyes, 'open');
    assert.ok((layout.star.x - watching.x) * watching.pupilX > 0, `${name}: eyes on the star`);
    // The shockwave: most of the way to the perch in the first half of the knock-back, a tumble with the head lagging,
    // wings flared, the hat already lifting, eyes squeezed shut.
    const half = owlCenter((B.perchStart + B.perch) / 2, layout);
    assert.ok(dist(half, G) <= 0.3 * dist(T, G) + 0.36 * layout.S, `${name}: a hard knock-back`);
    const knocked = owlPose(4.49, layout);
    assert.ok(Math.abs(knocked.rot + 25 * layout.path.knockSide) < 3, `${name}: tumbles ${knocked.rot.toFixed(1)}°`);
    assert.ok(knocked.wingL < -25 && knocked.wingR < -25, `${name}: wings flared`);
    assert.ok(knocked.hatY < -5 && knocked.eyes === 'squint');
    assert.ok(Math.abs(owlPose(B.poof, layout).rot) < 3, `${name}: righted for the poof`);
    // The owl is at the perch for the whole poof and giggle.
    for (const time of [B.poof, 5, B.giggle, 5.3, B.hop]) assert.ok(Math.abs(owlCenter(time, layout).x - G.x) < 1e-9, `${name}: perched at ${time}`);
  }
  // On the tall-card layouts the perched owl (wings spread) covers little or none of the opened cards' names;
  // everywhere it covers less of them and of the stubborn envelope than it would have at the tap point T.
  for (const { name, layout } of LAYOUTS) {
    const names = readingZones(layout.cards, layout.m, layout.stuck).filter((zone) => zone.w === 1);
    const hidden = (p: Point) => hiddenCost(owlBoxes(p, layout.S, [-1, 1]), names, layout.S);
    const stubborn = [{ box: envelopeBox(layout.cards[layout.stuck], 4), w: 1.5 }];
    const blocking = (p: Point) => hidden(p) + hiddenCost(owlBoxes(p, layout.S, [-1, 1]), stubborn, layout.S);
    assert.ok(blocking(layout.path.G) <= blocking(layout.path.T) + 1e-9, `${name}: the perch hides no more than the tap point`);
    if (['groups-1', 'groups-2', 'groups-4', 'groups-6 @1920x1080', 'groups-4 @960x680', 'picker'].includes(name)) {
      assert.ok(hidden(layout.path.G) < 0.2, `${name}: the perch hides ${hidden(layout.path.G).toFixed(2)} S² of names`);
    }
  }
  // The old perch (just past the last loop) sat on card 4's names; the new one keeps the stubborn envelope in view
  // (its padlock and head-shake must read), e.g. low in the gutter over the empty lower halves of the cards.
  for (const name of ['groups-1', 'groups-2', 'groups-4', 'groups-8', 'groups-6 @1920x1080', 'groups-4 @960x680', 'today-5x3', 'picker']) {
    const layout = byName[name];
    const card = layout.cards[layout.stuck];
    const owl = owlBoxes(layout.path.G, layout.S, [-1, 1]);
    const seal = { l: card.sealX - 0.8 * card.seal, r: card.sealX + 0.8 * card.seal, t: card.sealY - 0.8 * card.seal, b: card.sealY + 0.8 * card.seal };
    assert.ok(!owl.some((box) => overlapping(box, seal)), `${name}: the stubborn seal stays in view while it fizzles`);
    // Where anything in reach clears it, the whole envelope stays in view (on 2 groups it fills its card, so a corner is covered).
    const onEnvelope = hiddenCost(owl, [{ box: envelopeBox(card), w: 1 }], layout.S);
    if (name !== 'groups-2') assert.ok(onEnvelope < 0.15, `${name}: the perched owl leaves the stubborn envelope in view (${onEnvelope.toFixed(2)})`);
  }
  const g4 = byName['groups-4'];
  assert.ok(g4.path.G.y > g4.cards[g4.stuck].centerY, 'groups-4: perched low, over the empty lower halves of the cards');
});

void test('wizard reveal: envelopes keep their shape and sit inside their cards', () => {
  for (const { name, layout } of LAYOUTS) {
    for (const card of layout.cards) {
      assert.ok(Math.abs(card.envW / card.envH - 1.55) < 1e-9);
      assert.ok(card.envW <= 0.84 * card.width + 1e-9 || card.envW === 24, `${name}: envelope narrower than its card`);
      assert.ok(card.envH <= 0.81 * card.height, `${name}: envelope shorter than its card`);
      assert.ok(Math.abs(card.seal - 0.4 * card.envH) < 1e-9);
      assert.ok(card.sealX > card.left && card.sealX < card.left + card.width && card.sealY > card.top && card.sealY < card.top + card.height, `${name}: seal inside the card`);
    }
  }
  assert.ok(Math.abs(envelopeSize(1217, 637, 1280).envW - 460.8) < 1e-9, 'a single card gets the largest envelope (0.36 W)');
});

void test('wizard reveal: the owl is overhead at each delivery and every letter leaves from its satchel', () => {
  for (const { name, layout } of LAYOUTS) {
    for (const card of layout.cards) {
      assert.ok(Math.abs(passTime(card.cx) - card.pass) < 1e-12);
      assert.ok(Math.abs(owlCenter(card.pass, layout).x - card.cx * layout.W) < 1, `${name} #${card.index}: owl overhead`);
    }
    for (const flight of flightPlan(layout)) {
      const card = layout.cards[flight.index];
      const satchel = satchelPoint(card.launch, layout);
      assert.ok(Math.abs(flight.fx - (satchel.x - card.centerX)) < 0.5 && Math.abs(flight.fy - (satchel.y - card.centerY)) < 0.5);
      assert.ok(Math.abs(flight.at + 380 - card.land * 1000) < 1, `${name}: the flight hands off to the cover exactly at landing`);
    }
  }
});

void test('wizard reveal: the owl stays between the header and footer and moves smoothly', () => {
  for (const { name, layout } of LAYOUTS) {
    const { S, W, H } = layout;
    let previous = owlCenter(0.9, layout);
    for (const time of range(0.9, 6.25, 0.005)) {
      const pose = owlPose(time, layout);
      const { top, bottom } = rigExtent(pose, layout);
      assert.ok(top >= WIZARD_HEADER_SAFE - 3, `${name} @${time}: owl top ${top.toFixed(1)} clears the header`);
      assert.ok(bottom <= H - WIZARD_FOOTER_SAFE + 3, `${name} @${time}: owl bottom ${bottom.toFixed(1)} clears the footer`);
      assert.ok(pose.x >= -0.2 * W && pose.x <= 1.2 * W, `${name} @${time}: owl near the screen`);
      const center = owlCenter(time, layout);
      assert.ok(dist(center, previous) < 0.15 * S, `${name} @${time}: no jumps (${dist(center, previous).toFixed(1)} px in 5 ms)`);
      previous = center;
    }
    // Velocity is continuous across the path seams (the boop at 6.00 s is a deliberate impact).
    for (const seam of [B.passEnd, B.swirlStart, B.swirlEnd, B.tap, B.hop, B.dip]) {
      const v = (a: number, b: number) => { const p = owlCenter(a, layout), q = owlCenter(b, layout); return { x: (q.x - p.x) / (b - a), y: (q.y - p.y) / (b - a) }; };
      const before = v(seam - 0.006, seam - 0.001), after = v(seam + 0.001, seam + 0.006);
      const jump = Math.hypot(after.x - before.x, after.y - before.y);
      assert.ok(jump <= 0.4 * Math.hypot(before.x, before.y) + 250, `${name}: velocity continuous at ${seam} s (jump ${jump.toFixed(0)} px/s)`);
    }
  }
});

void test('wizard reveal: the gold trail is drawn exactly behind the owl, loop by loop', () => {
  for (const { name, layout } of LAYOUTS) {
    let arc = 0;
    for (const time of range(B.swirlStart, B.swirlEnd, 0.005)) {
      const u = swirlParam(time);
      const next = swirlArcFraction(layout, u);
      assert.ok(next >= arc - 1e-12, `${name}: trail only grows`);
      arc = next;
      assert.ok(dist(swirlAt(layout, u), owlCenter(time, layout)) < 0.5, `${name}: trail head is at the owl`);
    }
    assert.ok(Math.abs(arc - 1) < 1e-9);
    assert.ok(Math.abs(owlPose(B.swirlStart, layout).rot) < 15, `${name}: upright entering the loops`);
    const settled = ((owlPose(4.1, layout).rot % 360) + 540) % 360 - 180;
    assert.ok(Math.abs(settled - 12) < 15, `${name}: upright (leaning back) for the wind-up`);
    // Each curl is a real loop-the-loop: the owl turns a full circle between the curl tops.
    const turn = owlPose(B.chant2, layout).rot - owlPose(B.chant1, layout).rot;
    assert.ok(Math.abs(Math.abs(turn) - 360) < 20, `${name}: one full turn per loop (${turn.toFixed(0)}°)`);
  }
});

void test('wizard reveal: the wand touches the stubborn seal exactly at the boop', () => {
  for (const { name, layout } of LAYOUTS) {
    if (!layout.boop) continue;
    const tip = wandTip(owlPose(B.boop, layout), layout.S);
    assert.ok(tip && dist(tip, layout.boop.seal) < 1, `${name}: wand tip on the seal (${tip && dist(tip, layout.boop.seal).toFixed(2)} px)`);
  }
  const tipOffset = (p: Point, S: number) => ({ x: p.x * S, y: p.y * S });
  assert.ok(BOOP_TIP_ABOVE.y > 0.3 && BOOP_TIP_ABOVE.x < 0, 'above pose: the wand points down from the left wing');
  assert.ok(Math.abs(BOOP_TIP_SIDE.y) < 0.2 && BOOP_TIP_SIDE.x < -1, 'side pose: the wand points left');
  assert.ok(BOOP_TIP_BELOW.y < -0.4 && BOOP_TIP_BELOW.x < -1, 'below pose: the wand reaches up and out');
  // In the right wing the whole wand is the mirror image.
  for (const angle of [BOOP_ANGLE_ABOVE, BOOP_ANGLE_BELOW, BOOP_ANGLE_SIDE, 115, -72]) {
    const left = wandTipLocal(BOOP_WING, angle, 1, -1), right = wandTipLocal(BOOP_WING, angle, 1, 1);
    assert.ok(Math.abs(left.x + right.x) < 1e-9 && Math.abs(left.y - right.y) < 1e-9);
  }
  // Every pose, in either wing, puts the tip on the seal (checked through the full rig at 6.00 s on synthetic layouts).
  const seen = new Set<string>();
  for (const rect of [
    { left: 700, top: 300, width: 289, height: 300, radius: 25 }, { left: 60, top: 300, width: 289, height: 300, radius: 25 },
    { left: 952, top: 74, width: 289, height: 200, radius: 25 }, { left: 24, top: 74, width: 289, height: 200, radius: 25 },
    { left: 952, top: 460, width: 289, height: 250, radius: 25 }, { left: 500, top: 330, width: 280, height: 90, radius: 13 },
  ]) {
    const layout = wizardLayout([rect], { width: 1280, height: 800 });
    for (const option of boopOptions({ x: layout.cards[0].sealX, y: layout.cards[0].sealY }, layout)) {
      // Same rig, with this pose's wand wing and angle, hovering at this pose's point.
      const forced = { ...layout, boop: { ...option, card: 0, seal: { x: layout.cards[0].sealX, y: layout.cards[0].sealY } } };
      const tip = wandTip({ ...owlPose(B.boop, forced), x: option.owl.x, y: option.owl.y }, forced.S);
      assert.ok(tip && dist(tip, forced.boop.seal) < 1, `${option.pose}/${option.side}: tip on the seal`);
      seen.add(`${option.pose}/${option.side}`);
    }
  }
  assert.equal(seen.size, 6, 'all six poses exercised');
  assert.ok(dist(tipOffset(BOOP_TIP_ABOVE, 100), { x: -91.9, y: 43.8 }) < 0.2);
  // A seal hugging the header cannot be reached from above or beside: the owl is clamped and a spark hops the gap.
  const clamped = wizardLayout([{ left: 500, top: 72, width: 280, height: 90, radius: 13 }], { width: 1280, height: 800 });
  assert.ok(clamped.boop?.clamped, 'clamped boop is reported');
  assert.ok(wizardTracks(clamped).hop, 'and bridged by a spark hop');
});

void test('wizard reveal: sparks, letters and flights are scheduled from the same numbers as the covers', () => {
  for (const { name, layout } of LAYOUTS) {
    const shown = layout.cards.filter((card) => card.shown);
    const sparks = sparkPlan(layout), letters = letterPlan(layout), flights = flightPlan(layout);
    assert.equal(sparks.length, shown.length); assert.equal(flights.length, shown.length);
    // On a packed Today table only the stubborn letter jumps out; everywhere else every shown card has one.
    assert.equal(letters.length, isDense(layout.cards) ? shown.filter((card) => card.stuck).length : shown.length, `${name}: letters`);
    for (const spark of sparks) {
      const card = layout.cards[spark.index];
      assert.equal(spark.delay, B.burst * 1000);
      assert.ok(Math.abs(spark.delay + spark.duration - card.spark * 1000) < 1, `${name}: spark arrives at the pop (or the fizzle)`);
      assert.ok(Math.abs(spark.x + spark.tx - card.sealX) < 1e-9 && Math.abs(spark.y + spark.ty - card.sealY) < 1e-9);
    }
    for (const letter of letters) {
      const card = layout.cards[letter.index];
      assert.ok(Math.abs(letter.a1 - (card.pop + 0.06) * 1000) < 1e-6);
      assert.ok(letter.ends <= B.lastLetter * 1000 + 1e-6, `${name}: letter gone by 7.05 s`);
      // A sailing letter really goes somewhere; a popping one twirls in place and is quick about it.
      if (letter.kind === 'sail') assert.ok(Math.hypot(letter.dx, letter.dy) >= 0.25 * Math.min(layout.W, layout.H), `${name}: letters sail well away`);
      else assert.ok(letter.dx === 0 && letter.dy === 0 && letter.go === LETTER_POP_MS);
      assert.equal(letter.stuck, card.stuck);
    }
  }
  assert.ok(isDense(byName['today-12x4 (scrolled)'].cards) && !isDense(byName['today-5x3'].cards));
});

void test('wizard reveal: while the stubborn card is still dark, the other letters keep off it (and are opaque wherever they go)', () => {
  for (const { name, layout } of LAYOUTS) {
    const stuckCard = layout.cards.find((card) => card.stuck);
    if (!stuckCard) continue;
    const dark = { l: stuckCard.left, r: stuckCard.left + stuckCard.width, t: stuckCard.top, b: stuckCard.top + stuckCard.height };
    for (const letter of letterPlan(layout).filter((candidate) => !candidate.stuck)) {
      for (const k of range(0, 1, 0.02)) {
        if ((letter.a2 + k * letter.go) / 1000 >= B.boop) break;
        const box = letterBoxAt(letter, k);
        if (letterFlutter(k, letter.kind).scale < 0.05) continue;
        assert.ok(!overlapping(box, dark), `${name} #${letter.index} (${letter.kind}): letter over the dark stubborn card at ${k.toFixed(2)}`);
        assert.equal(letterFlutter(k, letter.kind).opacity, 1, `${name}: letters are opaque while they show`);
      }
    }
  }
});

void test('wizard reveal: on tall cards the letters flutter down into their own empty card space instead of across other names', () => {
  for (const name of ['groups-4', 'groups-6 @1920x1080']) {
    const layout = byName[name];
    for (const letter of letterPlan(layout).filter((candidate) => !candidate.stuck)) {
      const card = layout.cards[letter.index];
      // It never crosses another card's name column.
      for (const k of range(0, 1, 0.02)) {
        const box = letterBoxAt(letter, k);
        for (const other of layout.cards) {
          if (other.index === letter.index || other.stuck) continue;
          assert.ok(!overlapping(box, namesBox(other, layout.m)), `${name} #${letter.index}: crosses #${other.index}'s names at ${k.toFixed(2)}`);
        }
      }
      const end = letterBoxAt(letter, 0.9);
      if (card.left > 100) assert.ok(letter.dy > 0 && end.t > card.top + 0.4 * layout.m, `${name} #${letter.index}: down into the lower half of its card`);
    }
  }
  // The pop's planning model matches wz-letter-pop: a lift and swell to 45%, then it shrinks away from 62%, opaque until 98.5%.
  assert.ok(letterFlutter(0.45, 'pop').scale > 1.05 && Math.abs(letterFlutter(0.62, 'pop').scale - 1) < 1e-9 && letterFlutter(1, 'pop').scale < 1e-6);
  assert.ok(letterFlutter(0.98, 'pop').opacity === 1 && letterFlutter(1, 'pop').opacity === 0);
  const css = readCss();
  assert.match(css, /@keyframes wz-letter-pop \{\s*0% \{ opacity: 1; transform: none; \}\s*45% \{ transform: translateY\(-6%\) rotate\(-7deg\) scale\(1\.06\); \}\s*62% \{ opacity: 1; transform: translateY\(0\) rotate\(-2deg\) scale\(1\);/);
  assert.match(css, /\.wizard-letter\.is-pop \.wizard-letter-flutter \{ animation-name: wz-letter-pop; \}/);
});

void test('wizard reveal: letters never slide under the header and leave the names they cover quickly', () => {
  for (const { name, layout } of LAYOUTS) {
    for (const letter of letterPlan(layout)) {
      const card = layout.cards[letter.index];
      // The jump overshoots ~10%: the letter's top stays at or below its card's top edge (less 8 px) and the header.
      const jumpTop = letter.y + 1.1 * letter.rise - letter.h / 2;
      assert.ok(letter.rise <= 0 && (jumpTop >= Math.max(card.top - 8, WIZARD_HEADER_SAFE + 4) - 1e-6 || letter.rise === 0), `${name} #${letter.index}: jump top ${jumpTop.toFixed(0)}`);
      // While it is still clearly visible (opacity >= 0.6), the sailing letter stays below the header.
      for (const k of range(0, 0.8, 0.05)) {
        const box = letterBoxAt(letter, k);
        if (box.r <= 0 || box.l >= layout.W) continue;
        assert.ok(box.t >= WIZARD_HEADER_SAFE - 6, `${name} #${letter.index}: letter top ${box.t.toFixed(0)} at ${k}`);
      }
    }
    // The stubborn letter leaves its own (just revealed) names by 6.5 s.
    const stuck = letterPlan(layout).find((letter) => letter.stuck);
    if (!stuck) continue;
    const zone = readingZones([layout.cards[stuck.index]], layout.m, -1)[0].box;
    const k = (6.5 * 1000 - stuck.a2) / stuck.go;
    const box = letterBoxAt(stuck, k);
    const covered = Math.max(0, Math.min(box.r, zone.r) - Math.max(box.l, zone.l)) * Math.max(0, Math.min(box.b, zone.b) - Math.max(box.t, zone.t));
    assert.ok(covered <= 0.15 * (zone.r - zone.l) * (zone.b - zone.t), `${name}: the stubborn letter is off its names by 6.5 s (${(covered / ((zone.r - zone.l) * (zone.b - zone.t))).toFixed(2)})`);
  }
  // The planning easing matches CSS: cubic-bezier(.3,.15,.6,1) is slow out of the gate and settles at 1.
  assert.ok(LETTER_EASE(0.2) < 0.2 && Math.abs(LETTER_EASE(1) - 1) < 1e-9 && Math.abs(cubicBezier(0.25, 0.25, 0.75, 0.75)(0.4) - 0.4) < 1e-6);
  assert.equal(letterFlutter(0).opacity, 1);
  // Letters stay fully opaque while they sail (no grey ghosts), then pop away by shrinking to nothing (wz-letter-flutter).
  assert.ok(letterFlutter(0.8).opacity === 1 && letterFlutter(0.98).opacity === 1 && letterFlutter(1).opacity === 0);
  assert.ok(letterFlutter(0.88).scale > 0.7 && letterFlutter(1).scale < 1e-6);
});

void test('wizard reveal: candles float clear of envelopes, words and the header and footer', () => {
  for (const { name, layout } of LAYOUTS) {
    const { width, slots } = layout.candles;
    assert.ok(slots.length <= 6);
    const again = candleSlots(layout);
    assert.deepEqual(again.slots, slots, `${name}: deterministic`);
    for (const [i, slot] of slots.entries()) {
      const box = { l: slot.x - width * 0.6, r: slot.x + width * 0.6, t: slot.y - 1.7 * width - 1.4 * width, b: slot.y + 1.7 * width };
      assert.ok(box.t >= WIZARD_HEADER_SAFE && box.b <= layout.H - WIZARD_FOOTER_SAFE, `${name}: candle ${i} in the safe band`);
      for (const card of layout.cards) {
        const env = { l: card.centerX - card.envW / 2 - 8, r: card.centerX + card.envW / 2 + 8, t: card.centerY - card.envH / 2 - 8, b: card.centerY + card.envH / 2 + 8 };
        assert.ok(!(box.l < env.r && box.r > env.l && box.t < env.b && box.b > env.t), `${name}: candle ${i} clear of envelope ${card.index}`);
        const over = box.l < card.left + card.width && box.r > card.left && box.t < card.top + card.height && box.b > card.top;
        if (over) assert.ok(slot.out + 0.4 <= card.pop + 0.05 + 1e-9, `${name}: candle ${i} drifts off before its card opens`);
      }
      for (const other of slots.slice(0, i)) assert.ok(dist(slot, other) >= 6 * width - 1e-9, `${name}: candles spaced out`);
      assert.ok(slot.out <= B.candlesOut && slot.out < B.veilOut, 'candles are snuffed before the lights come on');
    }
    for (const word of [layout.words.chant1, layout.words.chant2, layout.words.spell, layout.words.command]) {
      if (!word) continue;
      assert.ok(word.y >= WIZARD_HEADER_SAFE && word.x > 0 && word.x < layout.W, `${name}: words on screen, below the header`);
    }
  }
});

void test('wizard reveal: the spoken words are real Latin, big enough to read, and clear of the envelopes and the owl', () => {
  // No baby talk on screen: the owl's incantation and command are real Latin; the stubborn letter answers without words.
  assert.deepEqual(Object.values(WIZARD_WORDS), ['Arcanum…', '…stellae…', 'APERIO!', 'Aperi!']);
  for (const { name, layout } of LAYOUTS) {
    const { words, S } = layout;
    // Chant words sit clear of every envelope (they were on the Today table's first row before); only a full
    // grid of big envelopes (12 groups) leaves no gap, and there they only ever move up, off the owl's loop tops.
    const envelopes = layout.cards.filter((card) => card.shown).map((card) => envelopeBox(card, 6));
    const defaultY = Math.max(WIZARD_HEADER_SAFE + 0.75 * words.size, layout.Yc - layout.R - 0.62 * layout.S - 0.6 * words.size - 6);
    for (const word of [words.chant1, words.chant2]) {
      const box = wordBox(word, words.size, 7);
      if (name !== 'groups-12') assert.ok(!envelopes.some((env) => overlapping(box, env)), `${name}: chant word clear of the envelopes`);
      assert.ok(box.t >= WIZARD_HEADER_SAFE - 1 && word.y <= defaultY + 1e-9, `${name}: chant word below the header and never lower than planned`);
    }
    if (!layout.boop) { assert.equal(words.command, null); continue; }
    // "Aperi!" is as big as "APERIO!" and holds for well over half a second (it used to pop out as soon as it was full size).
    const command = words.command!;
    assert.ok(words.bigSize >= 32 && (layout.m < 540 || Math.abs(words.bigSize - 0.06 * layout.m) < 1e-9), `${name}: command size ${words.bigSize}`);
    assert.ok(B.commandOut - (B.commandIn + 0.25) >= 0.35 && B.commandIn <= B.boop, 'the command is said as the wand taps and stays readable');
    // On screen and clear of the header and footer, with room for (most of) its 60 ms pop-out swell.
    const swell = wordBox(command, COMMAND_ROOM * words.bigSize, WIZARD_WORDS.command.length);
    assert.ok(swell.l >= 4 && swell.r <= layout.W - 4 && swell.t >= WIZARD_HEADER_SAFE && swell.b <= layout.H - WIZARD_FOOTER_SAFE, `${name}: "Aperi!" on screen`);
    // Near the tap (it reads as what the owl says), off the owl's body and hat at the boop, and off the stubborn
    // card's own names (they appear right under it).
    assert.ok(dist(command, layout.boop.seal) <= 3.4 * S, `${name}: "Aperi!" near the seal (${(dist(command, layout.boop.seal) / S).toFixed(2)} S)`);
    const box = wordBox(command, words.bigSize, WIZARD_WORDS.command.length);
    const [body, hat] = owlBoxes(layout.boop.owl, S, []);
    assert.ok(hiddenCost([box], [{ box: body, w: 1 }, { box: hat, w: 1 }], S) < 0.05, `${name}: "Aperi!" clear of the owl at the boop`);
    const ownNames = hiddenCost([box], [{ box: namesBox(layout.cards[layout.stuck], layout.m), w: 1 }], S);
    assert.ok(ownNames < 0.05, `${name}: "Aperi!" off the stubborn card's names (${ownNames.toFixed(2)})`);
    assert.ok(!overlapping(box, { l: layout.boop.seal.x - 0.5 * layout.cards[layout.stuck].seal, r: layout.boop.seal.x + 0.5 * layout.cards[layout.stuck].seal, t: layout.boop.seal.y - 0.5 * layout.cards[layout.stuck].seal, b: layout.boop.seal.y + 0.5 * layout.cards[layout.stuck].seal }), `${name}: the tap on the seal stays in view`);
  }
  // On the roomy layouts it hides (almost) no names at all.
  for (const name of ['groups-1', 'groups-2', 'groups-4', 'groups-4 @960x680', 'groups-6 @1920x1080', 'picker', 'today-5x3']) {
    const layout = byName[name];
    const hidden = hiddenCost([wordBox(layout.words.command!, layout.words.bigSize, WIZARD_WORDS.command.length)], readingZones(layout.cards, layout.m, -1).filter((zone) => zone.w === 1), layout.S);
    assert.ok(hidden < 0.1, `${name}: "Aperi!" hides ${hidden.toFixed(2)} S² of names`);
  }
  // Today 5x3: both chant words lift into the band above the first row.
  const today = byName['today-5x3'];
  assert.ok(today.words.chant1.y < 123 && today.words.chant2.y < 123);
  // The CSS holds every word between its pop-in and pop-out; the command uses the same pop as the others.
  const tsx = readFileSync('src/revealEffects/wizard.tsx', 'utf8');
  assert.match(tsx, /text=\{WIZARD_WORDS\.command\}[^\n]*size=\{words\.bigSize\}[^\n]*at=\{B\.commandIn\} out=\{B\.commandOut\}/);
  assert.ok(!/nuh|boop!|STAR-POP!|Swirly|twirly/i.test(Object.values(WIZARD_WORDS).join(' ')));
});

void test('wizard reveal: the stubborn letter refuses with a padlock that shakes "no" with it and pops off at the boop', () => {
  const css = readCss();
  for (const { name, layout } of LAYOUTS) {
    const card = layout.cards.find((candidate) => candidate.stuck);
    if (!card) { assert.equal(layout.lock, null); continue; }
    const lock = layout.lock!;
    assert.ok(lock, `${name}: a padlock`);
    // It hangs off the envelope's own shake pivot (.wz-chant turns about 50% 60% of the envelope) and its body sits on the seal.
    assert.ok(Math.abs(lock.x - card.centerX) < 1e-9 && Math.abs(lock.y - (card.centerY + 0.1 * card.envH)) < 1e-9);
    assert.ok(Math.abs(lock.y + lock.dy - card.sealY) < 1e-9, `${name}: padlock on the seal`);
    assert.ok(lock.size >= 0.034 * layout.m - 1e-9 && lock.size >= 0.95 * card.seal - 1e-9, `${name}: padlock big enough to read (${lock.size.toFixed(1)} px)`);
    const box = lockBox(lock);
    assert.ok(box.t >= WIZARD_HEADER_SAFE && box.b <= layout.H - WIZARD_FOOTER_SAFE, `${name}: padlock between the header and footer`);
    // The perched owl leaves it in view while it shakes.
    const hidden = hiddenCost(owlBoxes(layout.path.G, layout.S, [-1, 1]), [{ box, w: 1 }], layout.S);
    assert.ok(hidden < 0.1, `${name}: the perched owl keeps off the padlock (${hidden.toFixed(2)})`);
  }
  // Its CSS timing is the story's: on at lockOn, the shackle clicks shut at lockShut, springs open at the boop, gone by lockOff.
  const ms = (seconds: number) => Math.round(seconds * 1000);
  const pop = /\.wizard-lock-pop \{[^}]*animation: wz-lock-pop (\d+)ms (\d+)ms/.exec(css)!;
  assert.equal(+pop[2], ms(B.lockOn)); assert.equal(+pop[1] + +pop[2], ms(B.lockOff));
  const shackle = /\.wizard-lock-shackle \{[^}]*animation: wz-lock-shackle (\d+)ms (\d+)ms/.exec(css)!;
  const at = (percent: string) => +shackle[2] + +shackle[1] * parseFloat(percent) / 100;
  const keys = /@keyframes wz-lock-shackle \{([\s\S]*?)\n\}/.exec(css)![1];
  const shut = /([\d.]+)% \{ transform: none; \}/.exec(keys)!, open = /([\d.]+)% \{ transform: none; animation-timing-function/.exec(keys)!;
  assert.ok(Math.abs(at(shut[1]) - ms(B.lockShut)) <= 1, 'the shackle clicks shut on the beat');
  assert.ok(Math.abs(at(open[1]) - ms(B.boop)) <= 1, 'the shackle springs open at the boop');
  const popKeys = /@keyframes wz-lock-pop \{([\s\S]*?)\n\}/.exec(css)![1];
  const boopAt = +pop[2] + +pop[1] * parseFloat(/([\d.]+)% \{ opacity: 1; transform: none;/.exec(popKeys)![1]) / 100;
  assert.ok(Math.abs(boopAt - ms(B.boop)) <= 1, 'the padlock holds still until the boop');
  // It leaves by shrinking while opaque (never a half-transparent ghost), and shakes exactly like the envelope.
  assert.match(popKeys, /99\.9% \{ opacity: 1; \}\s*100% \{ opacity: 0; transform: [^}]*scale\(0\); \}/);
  const shake = /\.wizard-lock-shake \{ animation: wz-lock-shake (\d+)ms (\d+)ms ease-in-out both; \}/.exec(css)!;
  const chant = /\.wz-cover \.wz-chant \{ animation: wz-chant (\d+)ms (\d+)ms ease-in-out both; \}/.exec(css)!;
  const stuckKeys = /@keyframes wz-chant-stuck \{([\s\S]*?)\n\}/.exec(css)![1];
  const shakeStart = /([\d.]+)%, ([\d.]+)% \{ transform: none; \}\n  ([\d.]+)% \{ transform: rotate\(-6deg\); \}/.exec(stuckKeys)!;
  assert.ok(Math.abs(+chant[2] + +chant[1] * parseFloat(shakeStart[2]) / 100 - +shake[2]) <= 1, 'the padlock starts shaking with the envelope');
  assert.ok(Math.abs(+chant[2] + +chant[1] - (+shake[2] + +shake[1])) <= 1, 'and stops with it');
  const angles = (block: string) => [...block.matchAll(/rotate\((-?\d+)deg\)/g)].map((match) => +match[1]);
  const lockKeys = /@keyframes wz-lock-shake \{([\s\S]*?)\n\}/.exec(css)![1];
  assert.deepEqual(angles(lockKeys), angles(stuckKeys.slice(stuckKeys.indexOf(`${shakeStart[2]}%`))));
});

void test('wizard reveal: the star burst and candles clear out in time', () => {
  for (const { name, layout } of LAYOUTS) {
    const { rays, confetti } = burstPlan(layout);
    assert.equal(rays.length, 10); assert.equal(confetti.length, 8);
    for (const ray of rays) {
      assert.ok(ray.size >= 0.04 * layout.m, `${name}: rays are fat`);
      assert.ok(ray.ends <= 5000, 'rays gone by 5.0 s');
    }
    for (const piece of confetti) {
      assert.ok(piece.up > 0 && piece.fall > piece.up, 'confetti pops up, then falls a little below where it started');
      assert.ok(piece.ends <= 5500, 'confetti gone by 5.5 s');
    }
    assert.deepEqual(burstPlan(layout), burstPlan(layout), 'deterministic');
    for (const slot of layout.candles.slots) assert.ok(slot.out + CANDLE_GONE <= 5.6, `${name}: candle blown out and gone by 5.6 s`);
  }
  assert.ok(CANDLE_DRIFT_DELAY + CANDLE_EXIT <= CANDLE_GONE && CANDLE_EXIT <= 0.2);
  const css = readCss();
  // The burst never ends as grey ghosts: the core flash collapses while opaque, the ring thins away to nothing (opaque),
  // rays and confetti stay opaque until 85% of their flight, and candles leave by transform (opaque until the last 50 ms).
  assert.match(css, /@keyframes wz-star-core \{[^}]*\}[^@]*85% \{ opacity: 1; transform: scale\(\.28\)/);
  assert.match(css, /@keyframes wz-star-ring \{[\s\S]*?100% \{ opacity: 1; transform: scale\(2\.42\); \}/);
  assert.match(css, /@keyframes wz-ring-thin \{ from \{ stroke-width: 18px; \} to \{ stroke-width: 0; \} \}/);
  assert.match(css, /@keyframes wz-ray-art \{[^\n]*85% \{ opacity: 1;/);
  assert.match(css, /\.wizard-candle-out \{[^}]*wz-candle-out 160ms/);
  assert.match(css, /@keyframes wz-candle-out \{ 0% \{ opacity: 1; transform: none; \} 68\.75% \{ opacity: 1; \}/);
});

void test('wizard reveal: each card is revealed through a cream bloom, never a grey dissolve', () => {
  const css = readCss();
  const ms = (seconds: number) => Math.round(seconds * 1000);
  // The bloom opens (opaque) from pop + 20 ms, the night switches off in one step under the full bloom, then the bloom fades.
  assert.match(css, new RegExp(`\\.wz-bloom \\{[^}]*background: #fffaf0;[^}]*animation: wz-bloom ${ms(BLOOM.end - BLOOM.start)}ms calc\\(var\\(--wz-pop\\) \\+ ${ms(BLOOM.start)}ms\\)`));
  assert.match(css, new RegExp(`\\.wz-night \\{[^}]*animation: wz-fade-out 1ms calc\\(var\\(--wz-pop\\) \\+ ${ms(BLOOM.nightOff)}ms\\)`));
  const bloom = /@keyframes wz-bloom \{([\s\S]*?)\n\}/.exec(css)![1];
  const full = (BLOOM.full - BLOOM.start) / (BLOOM.end - BLOOM.start) * 100, fade = (BLOOM.fadeFrom - BLOOM.start) / (BLOOM.end - BLOOM.start) * 100;
  assert.match(bloom, new RegExp(`${full.toFixed(2)}% \\{ opacity: 1; transform: none;`));
  assert.match(bloom, new RegExp(`${fade.toFixed(2)}% \\{ opacity: 1; transform: none;`));
  assert.ok(BLOOM.nightOff >= BLOOM.full && BLOOM.nightOff < BLOOM.fadeFrom, 'the night goes off while the bloom is full and opaque');
  // The veil lifts quickly, as the last ordinary card's bloom peaks.
  for (const { name, layout } of LAYOUTS) {
    const pops = layout.cards.filter((card) => !card.stuck).map((card) => card.pop);
    if (pops.length) assert.ok(Math.max(...pops) + BLOOM.full <= B.veilOut + 0.12, `${name}: the veil lifts as the last bloom peaks`);
    for (const card of layout.cards) assert.ok(card.pop + BLOOM.end <= card.pop + 0.56 && card.pop + BLOOM.end <= 7.05);
  }
});

void test('wizard reveal: everything ends on time (owl, feathers, words, veil)', () => {
  for (const { name, layout } of LAYOUTS) {
    assert.ok(owlPose(B.exitEnd, layout).opacity < 1e-6, `${name}: owl gone at 6.98 s`);
    assert.equal(owlPose(0.5, layout).opacity, 0, 'owl hidden before its entrance');
    // The owl flies out of frame fully opaque (no see-through ghost owl): whenever any of it is on screen, it is solid.
    for (const time of range(B.exit, B.exitEnd - 0.005, 0.01)) {
      const pose = owlPose(time, layout);
      const onScreen = owlBoxes({ x: pose.x, y: pose.y }, layout.S * pose.scale, [-1, 1]).some((box) => box.r > 0 && box.l < layout.W && box.b > 0 && box.t < layout.H);
      if (onScreen) assert.equal(pose.opacity, 1, `${name} @${time}: the leaving owl is opaque`);
    }
    // ...and by the time it is switched off it is wholly off screen.
    const last = owlPose(B.exitEnd - 1e-6, layout);
    const gone = owlBoxes({ x: last.x, y: last.y }, layout.S * last.scale, [-1, 1]).every((box) => box.r <= 0 || box.l >= layout.W || box.b <= 0 || box.t >= layout.H || box.b <= WIZARD_HEADER_SAFE);
    assert.ok(gone, `${name}: the owl has left the screen (or gone behind the header) before it is switched off`);
    for (let i = 0; i < 4; i++) {
      assert.equal(featherAt(i, 4.69, layout).opacity, 0);
      assert.ok(featherAt(i, 5.7, layout).opacity < 1e-9, 'feathers gone by 5.7 s');
      // Feathers pop out and shrink away, opaque while they are there (never a fading smudge).
      for (const time of range(FEATHER_START, FEATHER_END - 0.01, 0.05)) assert.equal(featherAt(i, time, layout).opacity, 1);
      assert.ok(featherAt(i, FEATHER_END - 0.005, layout).scale < 0.1 && featherAt(i, 5, layout).scale > 0.95, `${name}: feather ${i} pops out and shrinks away`);
    }
  }
  // Each envelope grows out of the satchel fully opaque (a fade-in over the night read as a grey ghost envelope).
  assert.match(readCss(), /@keyframes wz-fly-art \{ 0% \{ opacity: 1; transform: rotate\(-38deg\) scale\(0\); \} 99\.9% \{ opacity: 1; transform: rotate\(6deg\) scale\(1\); \}/);
  // Every keyframe pair that reaches scale(0) lists the same transform functions on both sides, so it interpolates
  // function by function (a mismatched list falls back to matrices, which cannot decompose scale(0): it would jump).
  const css = readCss();
  for (const block of css.matchAll(/@keyframes ([\w-]+) \{([^\n]*)\}\n|@keyframes ([\w-]+) \{\n([\s\S]*?)\n\}/g)) {
    const name = block[1] ?? block[3], body = block[2] ?? block[4];
    const lists = [...body.matchAll(/transform: ([^;]+);/g)].map((match) => match[1].trim());
    const kinds = (list: string) => (list === 'none' ? null : [...list.matchAll(/([a-zA-Z]+)\(/g)].map((match) => match[1]));
    for (let i = 1; i < lists.length; i++) {
      if (!/scale\(0\)/.test(lists[i]) && !/scale\(0\)/.test(lists[i - 1])) continue;
      const a = kinds(lists[i - 1]), b = kinds(lists[i]);
      if (!a || !b) continue;
      const n = Math.min(a.length, b.length);
      assert.deepEqual(a.slice(0, n), b.slice(0, n), `@keyframes ${name}: ${lists[i - 1]} -> ${lists[i]} interpolates function by function`);
    }
  }
  assert.ok(B.spellOut + WORD_OUT_MS / 1000 <= 4.8, '"APERIO!" gone by 4.8 s');
  assert.ok(B.chantOut + WORD_OUT_MS / 1000 <= B.starIn + 0.05, 'chant words gone as the star pops in');
  assert.ok(B.veilGone <= 5.6);
  assert.ok(B.commandOut + WORD_OUT_MS / 1000 <= 7);
  // Words pop out (swell, then shrink to nothing) in WORD_OUT_MS, and their SVG has a real box (no reliance on SVG-root overflow).
  assert.match(css, new RegExp(`\\.wizard-word-out \\{[^}]*animation: wz-word-out ${WORD_OUT_MS}ms`));
  assert.match(css, /@keyframes wz-word-out \{[\s\S]*?scale\(1\.2\)[\s\S]*?opacity: 0; transform: scale\(0\)/);
  const tsx = readFileSync('src/revealEffects/wizard.tsx', 'utf8');
  assert.ok(!tsx.includes('width="1" height="1"'), 'no 1x1 SVG boxes');
});

void test('wizard reveal: owl animation tracks are complete, ordered and seam-free', () => {
  const times = trackTimes();
  assert.equal(times.length, Math.round(WIZARD_DURATION_MS / 1000 * TRACK_FPS) + 1);
  assert.equal(times[360], B.boop, 'the boop lands exactly on a sample');
  assert.deepEqual(unwrapAngles([170, -170, 179, -179]), [170, 190, 179, 181]);
  for (const { name, layout } of LAYOUTS) {
    const tracks = wizardTracks(layout);
    const timed: TimedTrack[] = [...tracks.dust, ...tracks.feathers, tracks.trail, tracks.zap, ...tracks.segments.map((s) => s.track), ...tracks.glints.map((g) => g.track), ...(tracks.hop ? [tracks.hop] : [])];
    const all = [
      ...Object.values(tracks.owl).filter((track) => Array.isArray(track)), ...Object.values(tracks.owl.eyes), ...timed.map((track) => track.frames),
    ];
    for (const track of all) {
      assert.equal(track[0].offset, 0); assert.equal(track[track.length - 1].offset, 1);
      for (let i = 1; i < track.length; i++) assert.ok(track[i].offset >= track[i - 1].offset, `${name}: offsets ordered`);
      for (const frame of track) if (frame.opacity !== undefined) assert.ok(frame.opacity >= 0 && frame.opacity <= 1);
    }
    assert.equal(tracks.owl.root[tracks.owl.root.length - 1].opacity, 0, `${name}: the owl ends invisible`);
    // Short-lived actors only run in their live window (then their animation, and its layer, is gone).
    for (const track of timed) {
      assert.ok(track.delay >= 0 && track.duration > 0 && track.delay + track.duration <= WIZARD_DURATION_MS + 1e-6, `${name}: window inside the reveal`);
    }
    for (const segment of tracks.segments) assert.ok(Math.abs(segment.track.delay + segment.track.duration - TRAIL_END * 1000) < 1e-6, `${name}: segments end with the ribbon`);
    assert.ok(tracks.trail.delay >= (B.swirlStart - 1 / TRACK_FPS) * 1000 - 1e-6 && tracks.trail.delay + tracks.trail.duration <= TRAIL_END * 1000 + 1000 / TRACK_FPS);
    for (const track of tracks.feathers) assert.ok(track.delay >= (FEATHER_START - 1 / TRACK_FPS) * 1000 - 1e-6 && track.delay + track.duration <= (FEATHER_END + 1 / TRACK_FPS) * 1000 + 1e-6);
    assert.ok(tracks.zap.duration <= 120, `${name}: the zap only exists for the tap`);
    // The fluff is solid: fully opaque whenever shown, and it only scales (out from behind the body and back under it).
    for (const frame of tracks.owl.fluff) {
      assert.ok(frame.opacity === 0 || frame.opacity === 1, `${name}: fluff never see-through`);
      const scale = Number(/scale\((-?[\d.]+)\)/.exec(frame.transform ?? '')?.[1]);
      if (frame.opacity === 1) assert.ok(scale >= FLUFF_HIDDEN - 1e-9 && scale <= 1.3, `${name}: fluff scale ${scale}`);
    }
    const fluffShown = tracks.poses.filter((pose) => pose.fluff > 0);
    assert.ok(fluffShown.length > 0 && Math.max(...fluffShown.map((pose) => pose.fluff)) >= 1.19, `${name}: the fluff puffs out`);
    // The trail: 30 segments; only the ribbon's two ends carry the glow's round caps.
    assert.equal(tracks.segments.length, TRAIL_POINTS / TRAIL_PER_SEGMENT);
    tracks.segments.forEach((segment, i) => assert.equal(segment.cap !== null, i === 0 || i === tracks.segments.length - 1));
    const rotations = tracks.owl.root.map((frame) => Number(/rotate\((-?[\d.]+)deg\)/.exec(frame.transform ?? '')?.[1]));
    for (let i = 1; i < rotations.length; i++) assert.ok(Math.abs(rotations[i] - rotations[i - 1]) < 60, `${name}: no spin glitches between samples`);
    const boopFrame = tracks.owl.root.find((frame) => Math.abs(frame.offset - B.boop / (WIZARD_DURATION_MS / 1000)) < 1e-9);
    if (layout.boop && boopFrame) {
      const [x, y] = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(boopFrame.transform ?? '')!.slice(1).map(Number);
      assert.ok(dist({ x, y }, layout.boop.owl) < 0.01, `${name}: rig keyframe puts the owl on its boop point`);
    }
  }
});

void test('wizard reveal: nothing is visible after 7.1 s, candles and burst debris included', () => {
  for (const { name, layout } of LAYOUTS) assert.ok(wizardLastVisible(layout) <= 7.1, name);
});

void test('wizard reveal: deterministic and free of Math.random', () => {
  const original = Math.random;
  Math.random = () => { throw new Error('Math.random used'); };
  try {
    const a = layoutOf(CASES[2]), b = layoutOf(CASES[2]);
    assert.deepEqual(a, b);
    assert.deepEqual(wizardTracks(a).owl.root, wizardTracks(b).owl.root);
    assert.deepEqual(owlPose(3.4, a), owlPose(3.4, b));
    assert.equal(popTime(0.5, 0.44), B.popBase);
  } finally { Math.random = original; }
});

void test('wizard reveal: no var() inside @keyframes (WebKit resolves them differently); stubborn variants by attribute', () => {
  const css = readCss();
  const blocks = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)];
  assert.ok(blocks.length > 20);
  for (const match of blocks) {
    let depth = 0, i = match.index! + match[0].length - 1;
    const start = i;
    for (; i < css.length; i++) { if (css[i] === '{') depth++; else if (css[i] === '}' && --depth === 0) break; }
    assert.ok(!css.slice(start, i).includes('var('), `@keyframes ${match[1]} uses no custom properties`);
  }
  for (const name of ['wz-chant-stuck', 'wz-seal-pop-big', 'wz-burst-big']) assert.match(css, new RegExp(`\\[data-wz-stuck\\][^{]*\\{ animation-name: ${name}; \\}`));
});

void test('wizard reveal: the cover-variable list covers everything the Stage writes', () => {
  const card = LAYOUTS[2].layout.cards[0];
  assert.deepEqual(Object.keys(wizardCoverVars(card)).sort(), Object.keys(WIZARD_COVER_VAR_NAMES).sort());
});

void test('wizard reveal: track compaction only touches invisible or constant samples', () => {
  const track = [
    { offset: 0, transform: 'translate(0px, 0px)', opacity: 0 },
    { offset: 0.1, transform: 'translate(5px, 0px)', opacity: 0 },
    { offset: 0.2, transform: 'translate(9px, 0px)', opacity: 0 },
    { offset: 0.3, transform: 'translate(12px, 0px)', opacity: 0 },
    { offset: 0.4, transform: 'translate(20px, 0px)', opacity: 1 },
    { offset: 0.5, transform: 'translate(30px, 0px)', opacity: 1 },
    { offset: 1, transform: 'translate(30px, 0px)', opacity: 1 },
  ];
  const collapsed = collapseHidden(track);
  assert.deepEqual(collapsed.slice(4), track.slice(4), 'visible samples untouched');
  assert.equal(collapsed[3].transform, track[3].transform, 'the sample before it reappears keeps its place');
  assert.equal(collapsed[1].transform, track[0].transform);
  const compressed = compressTrack(collapsed);
  assert.deepEqual(compressed.map((frame) => frame.offset), [0, 0.2, 0.3, 0.4, 0.5, 1], 'the frozen interior sample drops; the run edges stay');
  // Windowing a full-length sampled track keeps its samples and re-offsets them to the window.
  const full = trackTimes().map((time) => ({ offset: time / (WIZARD_DURATION_MS / 1000), opacity: time >= 1 && time <= 2 ? 1 : 0 }));
  const windowed = windowTrack(full, 1, 2);
  assert.equal(windowed.delay, 1000); assert.equal(windowed.duration, 1000);
  assert.deepEqual([windowed.frames[0].offset, windowed.frames[windowed.frames.length - 1].offset], [0, 1]);
  assert.ok(windowed.frames.every((frame) => frame.opacity === 1));
});

void test('wizard reveal: window resizes are debounced and the pending update is cancelled on unmount', () => {
  const tsx = readFileSync('src/revealEffects/wizard.tsx', 'utf8');
  assert.match(tsx, /addEventListener\('resize', onResize\)/);
  assert.match(tsx, /window\.setTimeout\(update, RESIZE_SETTLE_MS\)/);
  assert.match(tsx, /removeEventListener\('resize', onResize\);\s*window\.clearTimeout\(pending\);/);
});
