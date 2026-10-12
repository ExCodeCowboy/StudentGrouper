import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AHEAD_WINDOW, AIM_TIMES, ALIVE_SHIFT, COVER_EXITS, DOT_BEATS, DOT_TO_DOT_DURATION_MS, GARDEN_DRAIN, HOP_MIN, LIFT_SECONDS, ROCKET_HILL_DRAIN, SCENERY_EXIT, SLOW_INTERVALS,
  SUSPENSE_INTERVALS, WHALE_DIVE, WHALE_ENTRY, WHALE_SEA_DRAIN, aimFor, buildDotPlan, butterflyAlive, chunkDots, dotLabel, inRegion, insidePolygon, labelsAreClassroomSafe, labelsToString,
  pencilAt, pictureIndexForPlay, popAway, rocketAlive, sceneryExit, sceneryLeavesAt, trackStart, trainAlive, trainX, whaleAlive,
} from '../src/revealEffects/dotToDotTimeline';
import { DOT_PICTURES, PAGE_HEIGHT, PAGE_WIDTH } from '../src/revealEffects/dotToDotPictures';
import { DOT_LABELS } from '../src/revealEffects/dotToDotLabels';
import type { Pt } from '../src/revealEffects/dotToDotTimeline';

const plans = DOT_PICTURES.map((spec) => buildDotPlan(spec));
/** Dots showing when the pencil first taps: the printed page the class studies. */
const printedPage = (plan: (typeof plans)[number]) => plan.dots.filter((dot) => dot.appear <= DOT_BEATS.firstHit);
const HARD_CAP_MS = 9800;

void test('dot-to-dot: the reveal fits its brief window and every beat is in order', () => {
  assert.ok(DOT_TO_DOT_DURATION_MS >= 6000 && DOT_TO_DOT_DURATION_MS <= 8500, 'brief: 6-8.5 s');
  assert.ok(DOT_TO_DOT_DURATION_MS < HARD_CAP_MS, 'under the 9.8 s hard cap');
  assert.equal(DOT_BEATS.end * 1000, DOT_TO_DOT_DURATION_MS);
  const order = [DOT_BEATS.washIn, DOT_BEATS.dotsIn, DOT_BEATS.pencilIn, DOT_BEATS.firstHit, DOT_BEATS.slowEnd, DOT_BEATS.liftEarliest, DOT_BEATS.liftLatest, DOT_BEATS.suspense, DOT_BEATS.snap, DOT_BEATS.fillEnd, DOT_BEATS.coversGone, DOT_BEATS.stageOut, DOT_BEATS.end];
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `beat ${i} follows beat ${i - 1}`);
  assert.ok(Math.abs(DOT_BEATS.firstHit + SLOW_INTERVALS.reduce((a, b) => a + b, 0) - DOT_BEATS.slowEnd) < 1e-9, 'slow chant ends exactly when the whoosh starts');
  assert.ok(Math.abs(DOT_BEATS.suspense + SUSPENSE_INTERVALS.reduce((a, b) => a + b, 0) - DOT_BEATS.snap) < 1e-9, 'suspense ends exactly on the snap');
  assert.ok(DOT_BEATS.liftLatest + LIFT_SECONDS < DOT_BEATS.suspense - .5, 'the outline always gets at least half a second before the suspense');
});

void test('dot-to-dot: every sheet has left before the stage clears', () => {
  for (const [id, exit] of Object.entries(COVER_EXITS)) {
    assert.ok(exit.start >= DOT_BEATS.snap * 1000, `${id}: sheets stay until the picture is finished`);
    assert.ok(exit.start + exit.spread + exit.duration <= DOT_BEATS.coversGone * 1000, `${id}: last sheet gone by ${DOT_BEATS.coversGone} s`);
  }
  assert.deepEqual(Object.keys(COVER_EXITS).sort(), DOT_PICTURES.map((spec) => spec.id).sort());
});

void test('dot-to-dot: numbering skip-counts and never shows 67 or "6, 7"', () => {
  assert.ok(labelsAreClassroomSafe([2, 4, 6, 8]));
  assert.ok(!labelsAreClassroomSafe([5, 6, 7]));
  assert.ok(!labelsAreClassroomSafe([660, 665, 670]));
  assert.ok(!labelsAreClassroomSafe([167]));
  assert.ok(!labelsAreClassroomSafe([16, 17]));
  assert.ok(!labelsAreClassroomSafe([6, 7]));
  for (const plan of plans) {
    const labels = plan.dots.map((dot) => dot.label);
    const { step, name } = plan.spec;
    assert.ok(step === 2 || step === 5, `${name}: counts by 2s or 5s`);
    labels.forEach((label, i) => assert.equal(label, dotLabel(i, step)));
    assert.ok(labelsAreClassroomSafe(labels), `${name}: classroom-safe labels`);
    assert.ok(labels.every((label) => label !== 67 && !String(label).includes('67')), `${name}: no 67 anywhere`);
    for (let i = 1; i < labels.length; i++) assert.ok(!(labels[i - 1] === 6 && labels[i] === 7), `${name}: never 6 then 7`);
    assert.ok(labels.at(-1)! < 670, `${name}: stays below 670`);
    // The numbers read aloud (the slow chant and the suspense before the snap) are extra-safe.
    const spoken = [...labels.slice(0, SLOW_INTERVALS.length + 1), ...labels.slice(-SUSPENSE_INTERVALS.length)];
    assert.ok(!spoken.join(' ').includes('6 7'), `${name}: nothing spoken reads "6 7"`);
  }
});

void test('dot-to-dot: each page is a genuinely hard dot-to-dot', () => {
  for (const plan of plans) {
    const { name } = plan.spec;
    assert.ok(plan.dots.length >= 120 && plan.dots.length <= 240, `${name}: ${plan.dots.length} dots`);
    assert.ok(plan.segments.length >= 4, `${name}: several lift-the-pencil sections`);
    assert.ok(plan.segments.at(-1)!.closed, `${name}: the outline closes on its start star`);
    assert.deepEqual(plan.snapPoint, plan.segments.at(-1)!.points[0]);
    assert.ok(plan.segments[0].points.length > SLOW_INTERVALS.length, `${name}: the chant never hops`);
    for (const dot of plan.dots) {
      assert.ok(dot.x >= 20 && dot.x <= PAGE_WIDTH - 20 && dot.y >= 20 && dot.y <= PAGE_HEIGHT - 20, `${name}: dot ${dot.label} on the page`);
      assert.ok(dot.labelX >= 0 && dot.labelX <= PAGE_WIDTH && dot.labelY >= 0 && dot.labelY <= PAGE_HEIGHT, `${name}: label ${dot.label} on the page`);
    }
    for (const segment of plan.segments) for (let i = 1; i < segment.points.length; i++) {
      const gap = Math.hypot(segment.points[i].x - segment.points[i - 1].x, segment.points[i].y - segment.points[i - 1].y);
      assert.ok(gap >= 14 && gap <= 75, `${name}: dot spacing ${gap.toFixed(1)}`);
    }
    // No two dots sit on top of each other (strokes that cross or touch stay readable).
    for (let i = 0; i < plan.dots.length; i++) for (let j = i + 1; j < plan.dots.length; j++) {
      const a = plan.dots[i]; const b = plan.dots[j];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 12, `${name}: dots ${a.label} and ${b.label} are distinct`);
    }
  }
});

void test('dot-to-dot: the printed page is a jumble of numbers over the whole sheet, not a few tidy clusters', () => {
  // The sheet in 8 x 5 tiles (125 x 124 page units): the printed dots must reach most of them.
  for (const plan of plans) {
    const { name } = plan.spec;
    const printed = printedPage(plan);
    const tiles = new Set(printed.map((dot) => `${Math.min(7, Math.floor(dot.x / 125))},${Math.min(4, Math.floor(dot.y / 124))}`));
    assert.ok(printed.length >= 90, `${name}: ${printed.length} printed dots`);
    assert.ok(tiles.size >= 28, `${name}: printed dots reach ${tiles.size}/40 tiles`);
    // Rings look round (12+ dots), and every closed shape has at least 10 corners or dots.
    plan.segments.forEach((segment, s) => {
      if (!segment.closed || plan.spec.segments[s].role === 'outline') return;
      const c = { x: segment.points.reduce((a, p) => a + p.x, 0) / segment.points.length, y: segment.points.reduce((a, p) => a + p.y, 0) / segment.points.length };
      const radii = segment.points.map((p) => Math.hypot(p.x - c.x, p.y - c.y));
      const round = Math.max(...radii) / Math.min(...radii) < 1.06;
      assert.ok(segment.points.length >= (round ? 12 : 10), `${name}: closed stroke ${s} has ${segment.points.length} dots`);
    });
  }
});

void test('dot-to-dot: no mirrored pair of details gives the picture away early', () => {
  // A body between mirrored pairs of spots is how every child draws a butterfly: a detail and its
  // mirror image (across the page's centre line) are never both showing before the lift.
  for (const plan of plans) {
    const { name } = plan.spec;
    const details = plan.segments.map((segment, s) => ({ s, segment })).filter(({ s }) => plan.spec.segments[s].role === 'detail');
    const centre = (points: readonly Pt[]) => ({ x: points.reduce((a, p) => a + p.x, 0) / points.length, y: points.reduce((a, p) => a + p.y, 0) / points.length });
    for (const a of details) for (const b of details) {
      if (a.s >= b.s) continue;
      const ca = centre(a.segment.points); const cb = centre(b.segment.points);
      if (Math.abs(ca.x + cb.x - PAGE_WIDTH) > 40 || Math.abs(ca.y - cb.y) > 40 || Math.abs(ca.x - cb.x) < 80) continue;
      const shown = Math.max(plan.dots[a.segment.first].appear, plan.dots[b.segment.first].appear);
      assert.ok(shown >= DOT_BEATS.firstHit + (DOT_BEATS.snap - DOT_BEATS.firstHit) * .6, `${name}: strokes ${a.s} and ${b.s} mirror each other and both show at ${shown.toFixed(2)} s`);
    }
  }
});

void test('dot-to-dot: the baked label positions match the pictures', () => {
  // Placing labels is the slow step, so it is baked (work/design/dot-to-dot/bake-labels.ts).
  for (const [i, spec] of DOT_PICTURES.entries()) assert.equal(DOT_LABELS[spec.id], labelsToString(plans[i].dots), `${spec.name}: re-run bake-labels.ts`);
  for (const [i, spec] of DOT_PICTURES.entries()) {
    const baked = buildDotPlan(spec, DOT_LABELS[spec.id]);
    assert.deepEqual(baked.dots, plans[i].dots, `${spec.name}: a baked plan is the same plan`);
  }
});

const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const edgesCross = (a: Pt, b: Pt, c: Pt, d: Pt) => cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
function pointToEdge(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

void test('dot-to-dot: every stroke is a clean polyline and the scenery keeps clear of the picture', () => {
  for (const plan of plans) {
    const { name } = plan.spec;
    const edgesOf = (s: number) => {
      const { points, closed } = plan.segments[s];
      const edges: [Pt, Pt][] = points.slice(1).map((point, i) => [points[i], point]);
      if (closed) edges.push([points[points.length - 1], points[0]]);
      return edges;
    };
    plan.segments.forEach((segment, s) => {
      const edges = edgesOf(s);
      for (let i = 0; i < edges.length; i++) for (let j = i + 2; j < edges.length; j++) {
        if (segment.closed && i === 0 && j === edges.length - 1) continue;
        assert.ok(!edgesCross(...edges[i], ...edges[j]), `${name}: stroke ${s} never crosses itself`);
      }
    });
    const outline = edgesOf(plan.segments.length - 1);
    for (let s = 0; s < plan.segments.length - 1; s++) {
      for (const [a, b] of edgesOf(s)) for (const [c, d] of outline) assert.ok(!edgesCross(a, b, c, d), `${name}: stroke ${s} never cuts through the outline`);
      if (plan.spec.segments[s].role !== 'scenery') continue;
      const gap = Math.min(...plan.segments[s].points.map((p) => Math.min(...outline.map(([a, b]) => pointToEdge(p, a, b)))));
      assert.ok(gap >= 30, `${name}: scenery stroke ${s} stays ${gap.toFixed(0)} u clear of the picture`);
    }
  }
});

void test('dot-to-dot: it is a guessing game — the picture stays secret until late', () => {
  for (const plan of plans) {
    const { name, key } = plan.spec;
    const n = plan.dots.length;
    const outline = plan.dots.filter((dot) => dot.role === 'outline');
    // At least ~40% of the dots are interior details and scenery (stripes, wheels, stars, spots...).
    assert.ok((n - outline.length) / n >= .4, `${name}: ${Math.round(100 * (n - outline.length) / n)}% detail/scenery dots`);
    // The outline is one closed stroke, numbered last.
    assert.ok(outline.every((dot) => dot.segment === plan.segments.length - 1), `${name}: only the last stroke is outline`);
    assert.ok(plan.dots.slice(0, n - outline.length).every((dot) => dot.role !== 'outline'), `${name}: outline numbered last`);
    // The give-away part (flukes, smokestack, nose cone, upper wings) is numbered in the final third...
    const keyDots = outline.filter((dot) => inRegion(dot, key));
    assert.ok(keyDots.length >= 4, `${name}: the key region holds the give-away outline`);
    const firstKey = Math.min(...keyDots.map((dot) => dot.index));
    assert.ok(firstKey >= n * 2 / 3, `${name}: key outline starts at dot ${firstKey + 1} of ${n}`);
    // ...drawn in the last third of the drawing time, and never printed on the page in advance.
    const drawTime = DOT_BEATS.snap - DOT_BEATS.firstHit;
    for (const dot of keyDots) {
      assert.ok(dot.ahead, `${name}: key dot ${dot.label} is hidden until the pencil comes`);
      assert.ok(dot.hit >= DOT_BEATS.firstHit + drawTime * .65, `${name}: key dot ${dot.label} reached at ${dot.hit.toFixed(2)} s`);
      assert.ok(dot.appear >= plan.lift, `${name}: key dot ${dot.label} appears after the big lift`);
    }
    // The printed page (everything showing when the pencil first taps) has no key dots and at
    // most a third of the outline, and nothing from the key region.
    const printed = plan.dots.filter((dot) => dot.appear <= DOT_BEATS.firstHit);
    assert.ok(printed.every((dot) => !inRegion(dot, key) || dot.role !== 'outline'), `${name}: page gives nothing away`);
    assert.ok(printed.filter((dot) => dot.role === 'outline').length <= outline.length / 3, `${name}: at most a third of the outline is printed`);
    // Hidden dots sprout just ahead of the pencil: in time to be seen, never more than a small window at once.
    for (const dot of outline.filter((d) => d.ahead)) assert.ok(dot.hit - dot.appear >= .15 - 1e-9, `${name}: dot ${dot.label} shows ${(dot.hit - dot.appear).toFixed(2)} s before it is reached`);
    for (let t = plan.lift; t <= DOT_BEATS.snap; t += .02) {
      const waiting = outline.filter((dot) => dot.ahead && dot.appear <= t && dot.hit > t).length;
      // AHEAD_WINDOW dots, plus the few that must show early to keep their minimum lead at full speed.
      assert.ok(waiting <= AHEAD_WINDOW + 8 && waiting <= outline.length / 3, `${name}: ${waiting} sprouted dots waiting at ${t.toFixed(2)} s`);
    }
    assert.ok(plan.lift >= DOT_BEATS.liftEarliest - 1e-9 && plan.lift <= DOT_BEATS.liftLatest + 1e-9, `${name}: lift at ${plan.lift} s`);
  }
});

void test('dot-to-dot: numbers sit beside their own dots without piling onto each other', () => {
  for (const plan of plans) {
    const { name } = plan.spec;
    let overlaps = 0;
    const boxes = plan.dots.map((dot) => { const w = String(dot.label).length * 7.3 + 2; return { x0: dot.labelX - w / 2, x1: dot.labelX + w / 2, y0: dot.labelY - 5, y1: dot.labelY + 5 }; });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]; const b = boxes[j];
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) overlaps++;
    }
    assert.ok(overlaps <= 3, `${name}: ${overlaps} overlapping labels`);
    for (const dot of plan.dots) {
      const own = Math.hypot(dot.labelX - dot.x, dot.labelY - dot.y);
      assert.ok(own >= 8 && own <= 32, `${name}: label ${dot.label} is ${own.toFixed(1)} from its dot`);
      const nearest = Math.min(...plan.dots.filter((other) => other !== dot).map((other) => Math.hypot(dot.labelX - other.x, dot.labelY - other.y)));
      assert.ok(nearest > 6, `${name}: label ${dot.label} does not cover another dot`);
    }
  }
});

void test('dot-to-dot: the pencil chants slowly, whooshes, lifts, races the outline and snaps on the final beat', () => {
  for (const plan of plans) {
    const { name } = plan.spec;
    const { moves, dots } = plan;
    moves.slice(0, SLOW_INTERVALS.length).forEach((move) => { assert.equal(move.kind, 'draw'); assert.equal(move.phase, 'slow'); });
    const last = moves.at(-1)!;
    assert.equal(last.phase, 'close', `${name}: last stroke closes the outline`);
    assert.equal(last.to, plan.segments.at(-1)!.first);
    assert.ok(Math.abs(last.end - DOT_BEATS.snap) < 1e-9);
    const lift = moves.filter((move) => move.phase === 'lift');
    assert.equal(lift.length, 1, `${name}: one big lift`);
    assert.equal(lift[0].to, plan.segments.at(-1)!.first, `${name}: the big lift lands on the outline's star`);
    assert.ok(Math.abs(lift[0].end - lift[0].start - LIFT_SECONDS) < 1e-9);
    for (let i = 1; i < moves.length; i++) assert.ok(Math.abs(moves[i].start - moves[i - 1].end) < 1e-9, `${name}: moves are back to back`);
    for (const move of moves) if (move.kind === 'hop') assert.ok(move.end - move.start >= HOP_MIN - 1e-6, `${name}: hops are visible`);
    for (const speed of [plan.cruiseSpeed, plan.outlineSpeed]) assert.ok(speed >= 1200 && speed <= 3600, `${name}: ${speed.toFixed(0)} page units/s`);
    for (let i = 1; i < dots.length; i++) assert.ok(dots[i].hit > dots[i - 1].hit, `${name}: dots are reached in number order`);
    assert.equal(dots[0].hit, DOT_BEATS.firstHit);
    assert.ok(dots.at(-1)!.hit < DOT_BEATS.snap);
    // The first chanted numbers arrive at a speakable pace.
    for (let i = 1; i <= SLOW_INTERVALS.length; i++) assert.ok(dots[i].hit - dots[i - 1].hit >= .28, `${name}: chant beat ${i}`);

    assert.equal(pencilAt(plan, .2).reached, -1);
    const done = pencilAt(plan, DOT_BEATS.snap + .01);
    assert.equal(done.reached, dots.length - 1);
    done.drawn.forEach((length, s) => assert.ok(Math.abs(length - plan.segments[s].total) < 1e-6, `${name}: segment ${s} fully drawn`));
    // The tip never teleports: at 120 Hz it moves less than 45 page units per step.
    let previous = pencilAt(plan, DOT_BEATS.firstHit);
    for (let t = DOT_BEATS.firstHit; t <= DOT_BEATS.snap; t += 1 / 120) {
      const next = pencilAt(plan, t);
      assert.ok(Math.hypot(next.x - previous.x, next.y - previous.y) < 45, `${name}: continuous at ${t.toFixed(3)} s`);
      previous = next;
    }
  }
});

void test('dot-to-dot: the finished picture leaves the stage before it fades', () => {
  const at = DOT_BEATS.stageOut;
  // The whale dives: nose first under the sea, flukes last, then deep below the page.
  const whale = (time: number) => whaleAlive(time).pose;
  assert.ok(whale(at).y > 1000, 'whale dives out of sight');
  assert.ok(whale(WHALE_ENTRY - .12).rotate > 5 && whale(WHALE_ENTRY + .1).rotate < -15, 'it rears back, then tips nose down');
  const sheetsGone = COVER_EXITS.whale.start + COVER_EXITS.whale.spread + COVER_EXITS.whale.duration;
  assert.ok(Math.abs(COVER_EXITS.whale.start / 1000 - WHALE_ENTRY) < .05, 'its sheets wash away on the splash');
  assert.ok(whale(sheetsGone / 1000).y > 600, 'and it is under the sea before the last sheet has gone');
  assert.ok(trainAlive(at).pose.x > 1300, 'train chugs off right');
  assert.ok(rocketAlive(at).pose.y < -1200, 'rocket blasts off the top');
  assert.ok(butterflyAlive(at).pose.y < -1000, 'butterfly flutters away');
  // Nothing moves before the colour has arrived.
  const settled = DOT_BEATS.snap + .3;
  for (const pose of [whaleAlive(settled).pose, trainAlive(settled).pose, rocketAlive(settled).pose, butterflyAlive(settled).pose]) assert.ok(Math.abs(pose.x) < 1 && Math.abs(pose.y) < 1);
  assert.ok(butterflyAlive(DOT_BEATS.snap + .3).antennae < .05 && butterflyAlive(DOT_BEATS.snap + .7).antennae > .95, 'the feelers spring out after the colour');
});

void test('dot-to-dot: pictures rotate between plays and covers share the stage pick', () => {
  const count = DOT_PICTURES.length;
  let clock = 100_000;
  const play = (seed: number) => { clock += 10_000; return pictureIndexForPlay(count, clock, seed); };
  const first = play(12345);
  assert.equal(pictureIndexForPlay(count, clock + 4, 999), first, 'covers mounted in the same commit share the pick');
  const cycle = [first];
  for (let i = 1; i < count; i++) cycle.push(play(12345));
  assert.equal(new Set(cycle).size, count, 'every picture appears once per cycle');
  let previous = cycle.at(-1)!;
  const firsts = new Set<number>();
  for (let round = 0; round < 12; round++) {
    const next = Array.from({ length: count }, () => play(round * 7919 + 17));
    assert.equal(new Set(next).size, count, `cycle ${round} shows every picture`);
    assert.notEqual(next[0], previous, 'never the same picture twice in a row');
    firsts.add(next[0]);
    previous = next.at(-1)!;
  }
  assert.ok(firsts.size > 1, 'the order is shuffled, not a fixed rotation');
});

/** When the sheet over page x starts to leave (the same stagger the covers use), in seconds. */
function sheetLeaves(id: keyof typeof COVER_EXITS, x: number) {
  const exit = COVER_EXITS[id];
  const stagger = exit.stagger === 'order' ? Math.min(1, Math.max(0, x / 1000)) : Math.min(1, Math.abs(x - 500) / 500);
  return (exit.start + stagger * exit.spread) / 1000;
}

void test('dot-to-dot: the scenery pops away with the sheets under it, never over freshly revealed names', () => {
  // A sheet takes about a quarter of a second to move off the names under it: the scenery there is gone by then.
  for (const id of Object.keys(COVER_EXITS) as (keyof typeof COVER_EXITS)[]) {
    for (let x = -100; x <= 1100; x += 50) for (const ground of [false, true]) {
      const leaves = sceneryLeavesAt(id, x, ground);
      assert.ok(leaves >= DOT_BEATS.snap + .6, `${id}: scenery at ${x} stays until the picture has come alive`);
      assert.ok(leaves + SCENERY_EXIT.pop <= sheetLeaves(id, x) + .3, `${id}: scenery at ${x} gone ${(leaves + SCENERY_EXIT.pop - sheetLeaves(id, x)).toFixed(2)} s after its sheet starts to leave`);
      assert.equal(popAway(sceneryExit(leaves + SCENERY_EXIT.pop, id, x, ground)), 0);
      assert.equal(popAway(sceneryExit(leaves - .01, id, x, ground)), 1);
    }
  }
  // A pop is a scale (a small swell, then nothing), never a fade.
  for (let q = 0; q <= 1; q += .01) assert.ok(popAway(q) >= 0 && popAway(q) <= 1.15);
  // The ground bands drain right after: the sea once the flukes are under, the snowy hill once the smoke has gone, the lawn.
  assert.ok(Math.abs(WHALE_SEA_DRAIN.start - (WHALE_DIVE.flukesUnder + ALIVE_SHIFT)) < .02, 'the sea drains as the flukes go under');
  for (const drain of [WHALE_SEA_DRAIN, ROCKET_HILL_DRAIN, GARDEN_DRAIN]) assert.ok(drain.start > DOT_BEATS.snap + 1 && drain.end <= 7.65, `a ground band has drained by ${drain.end} s`);
});

void test('dot-to-dot: steam leaves with the sheets and the track rolls up behind the train', () => {
  for (let t = DOT_BEATS.snap; t <= DOT_BEATS.end; t += .01) {
    for (const puff of trainAlive(t).puffs) {
      if (puff.r <= .5 || puff.opacity <= 0 || puff.x < -50 || puff.x > 1050) continue;
      assert.ok(t <= sheetLeaves('train', puff.x) + .3, `a puff at ${puff.x.toFixed(0)} is still there at ${t.toFixed(2)} s`);
    }
    assert.ok(trackStart(t) <= 242 - 24 + trainX(t) + 1e-9, `the track never rolls up from under the wheels (${t.toFixed(2)} s)`);
    if (t < DOT_BEATS.snap + .7) assert.equal(trackStart(t), -700, 'the whole track is there until the train sets off');
  }
  assert.ok(trackStart(7.75) >= 1690, 'the track has gone with the train');
});

void test('dot-to-dot: in the suspense the big number sits off the picture, and the pencil off the give-away part', () => {
  for (const plan of plans) {
    const { name, key } = plan.spec;
    const aim = aimFor(plan);
    const shape = plan.segments.at(-1)!.points;
    for (const t of AIM_TIMES) {
      const tip = pencilAt(plan, t);
      assert.ok(!insidePolygon({ x: tip.x + aim.callout.x, y: tip.y + aim.callout.y }, shape), `${name}: the big number is off the picture at ${t.toFixed(2)} s`);
      const dx = Math.cos(aim.angle * Math.PI / 180); const dy = Math.sin(aim.angle * Math.PI / 180);
      const keyDotsUnder = plan.dots.filter((dot) => dot.role === 'outline' && inRegion(dot, key) && dot.hit < DOT_BEATS.snap).filter((dot) => {
        const along = (dot.x - tip.x) * dx + (dot.y - tip.y) * dy;
        return along > 8 && along < 214 && Math.abs((dot.x - tip.x) * dy - (dot.y - tip.y) * dx) < 14;
      });
      assert.ok(keyDotsUnder.length <= 1, `${name}: the pencil hides ${keyDotsUnder.length} dots of the give-away part at ${t.toFixed(2)} s`);
    }
  }
});

void test('dot-to-dot: the page is drawn in runs: numbers grey out together, chanted numbers one by one', () => {
  for (const plan of plans) {
    const { name } = plan.spec;
    const printed = chunkDots(plan.dots, (dot) => !dot.ahead, 10, .12);
    const ahead = chunkDots(plan.dots, (dot) => dot.ahead, 6);
    assert.deepEqual([...printed, ...ahead].flat().map((dot) => dot.index).sort((a, b) => a - b), plan.dots.map((dot) => dot.index), `${name}: every dot is in exactly one run`);
    for (const run of [...printed, ...ahead]) {
      assert.ok(run.every((dot) => dot.segment === run[0].segment), `${name}: a run stays on one stroke`);
      assert.ok(run.every((dot, i) => !i || dot.index === run[i - 1].index + 1), `${name}: a run is consecutive`);
    }
    for (const run of printed) assert.ok(run.length <= 10 && run.at(-1)!.hit - run[0].hit <= .12 + 1e-9, `${name}: a run of numbers greys out within 0.12 s of its first being reached`);
    // The chanted numbers (read aloud) each grey out as they are reached.
    for (let i = 0; i <= SLOW_INTERVALS.length; i++) assert.ok(printed.some((run) => run.length === 1 && run[0].index === i), `${name}: chanted number ${plan.dots[i].label} greys out on its own`);
    // Runs of hidden dots sprout in order, so each joins the page once, as its first dot shows.
    for (let i = 1; i < ahead.length; i++) assert.ok(ahead[i][0].appear >= ahead[i - 1][0].appear && ahead[i].at(-1)!.hit >= ahead[i - 1].at(-1)!.hit, `${name}: hidden runs sprout in order`);
  }
});

void test('dot-to-dot: the whale flukes go under in a splash', () => {
  const under = WHALE_DIVE.flukesUnder + ALIVE_SHIFT;
  assert.ok(whaleAlive(under - .05).flukeSplash > 0, 'the splash is already rising as the last lobe slips under');
  assert.ok(whaleAlive(under + .3).flukeSplash < 1);
});
