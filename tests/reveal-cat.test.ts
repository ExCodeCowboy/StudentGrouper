import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { activeWindow, bakeScene, catEffect, pastel, yarnShade } from '../src/revealEffects/cat';
import {
  BEAT, CAT_DURATION_MS, COVER, COVER_POMS, CUT_EPSILON, DENSE_SCALE, DRIFT, EXIT, EXIT_AT, LAST_COVER_GONE, LEFTOVER_R, MOUTHS, PIVOT, POM_LIFE, RIM_FOLLOWS, SPOT_RANGE, STRAND_SEGMENTS, TANGLE_R, TWINKLES,
  catCuts, catExpression, catLayout, catSampleTimes, catScene, catTop, chainFrame, coverEdge, coverStart, exitPose, looseEndTip, pupilOffset, sitExtent, strandAt, strandCards, strandsOf, tangleAt, tangleShape,
  type CatLayout, type Face, type ScenePose, type TextRect,
} from '../src/revealEffects/catTimeline';

const css = readFileSync('src/revealEffects/cat.css', 'utf8');
const END = CAT_DURATION_MS / 1000;
const VIEWPORTS = [[960, 680], [1024, 768], [1280, 800], [1920, 1080], [768, 1024]] as const;
const HEADER_PX = 70;
const FOOTER_PX = 80;
const times = (step = 1 / 60, from = 0, to = END) => { const out: number[] = []; for (let i = 0; from + i * step <= to + 1e-9; i++) out.push(Math.round((from + i * step) * 1e6) / 1e6); return out; };

/** A grid of cards like the Groups screen, optionally with each card's names (left part, top rows). */
function layoutFor(width: number, height: number, columns = 4, rows = 1, withNames = false): CatLayout {
  const top = HEADER_PX + 20; const bottom = height - FOOTER_PX - 14; const rowHeight = (bottom - top) / rows;
  const cardWidth = width / columns - 16;
  const cards = Array.from({ length: columns * rows }, (_, i) => ({ x: (i % columns + .5) / columns * width, top: top + Math.floor(i / columns) * rowHeight, height: rowHeight - 12, width: cardWidth, color: '#e8a33d' }));
  const texts: TextRect[] = withNames ? cards.flatMap((card) => Array.from({ length: 4 }, (_, line) => ({ x: card.x - cardWidth / 2 + 24, y: card.top + 60 + line * 40, w: cardWidth * .45, h: 33 }))
    .filter((text) => text.y + text.h < card.top + card.height)) : [];
  return catLayout(width, height, height - FOOTER_PX, cards, texts);
}

/** A Today-like table (as measured in the lab): 4 rounds of cells with an icon and a label on their left, team names in the first column, rows below the footer cut off. */
function tableLayout(): CatLayout {
  const cards = Array.from({ length: 32 }, (_, i) => ({ x: 446 + (i % 4) * 224, top: 123 + Math.floor(i / 4) * 93, height: 76, width: 195, color: '#6aa9d8' }));
  const texts: TextRect[] = cards.flatMap((card, i) => [{ x: card.x - 98, y: card.top + 18, w: 38, h: 32 }, { x: card.x - 54, y: card.top + 29, w: 54 + (i * 37) % 47, h: 19 }]);
  for (let row = 0; row < 8; row++) texts.push({ x: 58, y: 123 + row * 93 + 18, w: 34, h: 29 }, { x: 107, y: 123 + row * 93 + 20, w: 70, h: 25 });
  return catLayout(1280, 800, 732.5, cards, texts.filter((text) => text.y < 732.5));
}

const overlaps = (a: TextRect, texts: readonly TextRect[]) => texts.some((r) => a.x < r.x + r.w && a.x + a.w > r.x && a.y < r.y + r.h && a.y + a.h > r.y);

void test('cat reveal: identity, sound and duration contract', () => {
  assert.equal(catEffect.id, 'cat');
  assert.equal(catEffect.sound, 'cat');
  assert.equal(catEffect.durationMs, CAT_DURATION_MS);
  assert.ok(CAT_DURATION_MS < 9800, 'under the 9.8 s hard cap');
  assert.equal(BEAT.end, END);
  const L = layoutFor(1280, 800);
  assert.ok(Math.abs(L.fin.exit + BEAT.exit + BEAT.clear - END) < 1e-9, 'the bound away ends BEAT.clear before the end');
  assert.equal(L.fin.exit, EXIT_AT);
  assert.ok(BEAT.clear >= .35, 'a real margin before the reveal is stopped');
});

void test('cat reveal: the knitted-cover schedule and yarn tails in CSS mirror the timeline', () => {
  const start = css.match(/--cat-start:\s*calc\(([\d.]+)s \+ clamp\(0, \(var\(--reveal-center-x, \.5\) - ([\d.]+)\) \* ([\d.]+), ([\d.]+)\) \* 1s\)/);
  assert.ok(start, 'cover start expression present');
  assert.deepEqual(start!.slice(1).map(Number), [COVER.t0, COVER.x0, COVER.secondsPerWidth, COVER.span]);
  const pull = `${Math.round(COVER.pull * 1000)}ms`;
  assert.ok(css.includes(`.cat-cover-window, .cat-cover-knit { position: absolute; inset: 0; animation: ${pull} linear var(--cat-start) both; }`), 'window/knit slide for exactly the pull time');
  assert.ok(css.includes(`animation: cat-edge ${pull} linear var(--cat-start) both;`));
  assert.ok(css.includes(`cat-gone 1ms linear calc(var(--cat-start) + ${Math.round(COVER.pull * 1000) + 20}ms) both`), 'covers are hidden right after the pull');
  const [min, share, max] = COVER.tail;
  assert.ok(css.includes(`width: clamp(${min}px, ${share * 100}%, ${max}px)`), 'yarn tail size mirrors COVER.tail');
  assert.ok(css.includes(`animation: cat-twitch 620ms ease-in-out ${COVER.twitch}s both`), 'yarn tails twitch with the ear perk');
  assert.equal(COVER.twitch, BEAT.notice);
  for (const x of [0, .2, .43, .5, .63, .8, .87, 1]) {
    const expected = COVER.t0 + Math.max(0, Math.min(COVER.span, (x - COVER.x0) * COVER.secondsPerWidth));
    assert.ok(Math.abs(coverStart(x) - expected) < 1e-12);
  }
});

void test('cat reveal: every cover is gone before she pops out, long before the end', () => {
  assert.ok(Math.abs(LAST_COVER_GONE - (COVER.t0 + COVER.span + COVER.pull)) < 1e-12);
  assert.ok(LAST_COVER_GONE <= BEAT.pop, 'no strand is left dangling when the tangle pops');
  assert.ok(END - LAST_COVER_GONE > 2.5, 'names are readable for the whole happy ending');
  assert.ok(COVER.t0 - COVER.grab > BEAT.tumble, 'strands only grow once the tangle exists');
  assert.ok(BEAT.pounce[0] - BEAT.notice < 1.45, 'no long wait between noticing the yarn and pouncing');
  assert.ok(BEAT.nudge[1] <= BEAT.notice && BEAT.nudge[1] > BEAT.notice - .1, 'the ball hops just before her ears perk');
});

void test('cat reveal: the tangle rolls under each card as its cover starts to unravel', () => {
  for (const [width, height] of VIEWPORTS) {
    const L = layoutFor(width, height, 6);
    for (const card of L.cards) {
      const unclamped = (card.x / width - COVER.x0) * COVER.secondsPerWidth;
      if (unclamped < .1 || unclamped > COVER.span - .15) continue;
      const ballX = tangleAt(card.start, L).x;
      assert.ok(Math.abs(ballX - (card.x - COVER.lead * width)) < .03 * width, `${width}px: the tangle is ${COVER.lead} W short of card ${Math.round(card.x)} when it starts (${Math.round(ballX)})`);
    }
  }
});

void test('cat reveal: strands grow out of each card\'s yarn tail, sag softly, pull the unravel edge, then reel in', () => {
  for (const [width, height] of VIEWPORTS) {
    const L = layoutFor(width, height, 4, 2);
    const strands = strandCards(L.cards);
    assert.equal(strands.length, 4, 'one strand per column');
    strands.forEach((card) => {
      assert.equal(card.top, Math.max(...L.cards.filter((other) => Math.abs(other.x - card.x) < 1).map((other) => other.top)), 'to the lowest card of its column');
      // From its very first visible frame the strand hangs from the tail's pom-pom, and lengthens down toward the ball.
      const tip = looseEndTip(card);
      let length = 0;
      for (const t of times(1 / 120, card.start - COVER.grab, card.start - .005)) {
        const { points, o, reach } = strandAt(t, L, card);
        if (!o) continue;
        const end = points[STRAND_SEGMENTS];
        assert.ok(Math.hypot(end.x - tip.x, end.y - Math.min(tip.y, L.floor - 6 * L.k)) < 1.5, `${width}px: the strand hangs from the yarn tail at ${t}`);
        assert.ok(reach >= length - 1e-9, 'it only grows while reaching');
        length = reach;
      }
      for (const phase of [.05, .3, .6, .95]) {
        const t = card.start + COVER.pull * phase;
        const { points, o } = strandAt(t, L, card);
        assert.equal(o, 1);
        const end = points[STRAND_SEGMENTS];
        const edge = coverEdge(t, card);
        if (phase > .3) assert.ok(Math.abs(end.y - Math.min(edge.y, L.floor - 6 * L.k)) < 1.5, `${width}px: the strand pulls the unravel edge (${end.y.toFixed(1)} vs ${edge.y.toFixed(1)})`);
        assert.ok(end.x >= card.x - card.width / 2 && end.x <= card.x + card.width / 2, 'pull point stays on its card');
        const S = tangleShape(t, L);
        assert.ok(points[0].y > S.cy - S.R * .45, 'leaves from the side of the ball, never from behind her head');
        const a = points[0]; const mid = points[STRAND_SEGMENTS / 2];
        const chord = Math.hypot(end.x - a.x, end.y - a.y);
        const off = Math.abs((end.x - a.x) * (a.y - mid.y) - (a.x - mid.x) * (end.y - a.y)) / Math.max(1e-6, chord);
        if (chord > 60) assert.ok(off > chord * .08, `${width}px: the strand sags (${off.toFixed(1)} of ${chord.toFixed(1)})`);
      }
      // Let go: it reels back into the ball, solid all the way (never a see-through fade), and is wound up by the end.
      let reel = Infinity;
      for (const t of times(1 / 120, card.start + COVER.pull, card.start + COVER.pull + COVER.release - .005)) {
        const { points, o } = strandAt(t, L, card);
        if (t >= L.fin.pop) break;
        assert.equal(o, 1, `${width}px: solid while it reels in at ${t}`);
        const length = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
        assert.ok(length <= reel + 1, 'it only gets shorter');
        reel = length;
      }
      if (card.start + COVER.pull + COVER.release < L.fin.pop) assert.ok(reel < 12 * L.k, `${width}px: wound up by the end of the release (${reel.toFixed(1)} px left)`);
      assert.equal(strandAt(card.start + COVER.pull + COVER.release, L, card).o, 0, 'gone within the release time');
      assert.equal(strandAt(card.start - COVER.grab - .01, L, card).o, 0);
    });
  }
  // A single row of 4: never more than 3 strands pulling at once (one being wound back into the ball doesn't count), and a
  // strand is only ever fully shown or hidden.
  const L = layoutFor(1280, 800);
  for (const t of times(1 / 30)) {
    const pose = catScene(t, L);
    const pulling = strandsOf(L).filter((card, j) => (pose[`str${j}.0`]?.o ?? 0) > 0 && t < card.start + COVER.pull).length;
    assert.ok(pulling <= 3, `${pulling} strands at ${t}`);
    strandsOf(L).forEach((_, j) => assert.ok([0, 1].includes(pose[`str${j}.0`]?.o ?? 0), 'no half-faded strand'));
  }
  // Tables of many cells: one strand per column, never more than 8.
  const table = catLayout(1280, 800, 720, Array.from({ length: 48 }, (_, i) => ({ x: 300 + (i % 6) * 160, top: 100 + Math.floor(i / 6) * 70, height: 60, width: 150, color: '#6aa9d8' })));
  const picked = strandCards(table.cards);
  assert.equal(picked.length, 6);
  assert.ok(picked.every((card) => card.top === 100 + 7 * 70), 'the lowest cell of each column (the shortest strand)');
  const tip = looseEndTip(picked[0]);
  assert.ok(tip.y > picked[0].top && tip.y < picked[0].top + 90);
  // Cells cut off by the footer never get a strand (it would dive behind the footer): the lowest cell with its yarn tail above it does.
  const clipped = strandCards(table.cards, 600);
  assert.equal(clipped.length, 6);
  assert.ok(clipped.every((card) => looseEndTip(card).y < 600 - 6 && card.top === 100 + 6 * 70), 'the lowest cells whose tails show');
  assert.deepEqual(strandsOf(table), strandCards(table.cards, table.clip));
});

void test('cat reveal: exactly one kitten at a time, always solid (no see-through fade), off the screen well before the end', () => {
  for (const [width, height] of VIEWPORTS) {
    for (const L of [layoutFor(width, height), layoutFor(width, height, 4, 3, true)]) {
      const gone = L.fin.exit + BEAT.exit;
      for (const t of times()) {
        const pose = catScene(t, L);
        const visible = ['s', 'g', 'c'].filter((id) => (pose[id]?.o ?? 0) > 0);
        assert.equal(visible.length, t < gone ? 1 : 0, `${width}px ${t}s: ${visible.join(',')}`);
        for (const id of ['s', 'g', 'c', 'b']) assert.ok([0, 1].includes(pose[id]?.o ?? 0), `${id} is fully shown or fully hidden at ${t} (${pose[id]?.o})`);
        assert.equal(pose.scene, undefined, 'no whole-scene fade');
        if (t >= BEAT.tumble) assert.equal(pose.b?.o, 0, 'the yarn ball is gone once she tumbles into it');
      }
      // She (ears, beanie and all) and the little ball have bounded off the nearest edge before she is hidden.
      const last = sitExtent(catScene(gone - CUT_EPSILON, L), L);
      assert.ok(L.exitDir > 0 ? last.left > L.W : last.right < 0, `${width}px: off the screen (${Math.round(last.left)}..${Math.round(last.right)} of ${L.W})`);
    }
  }
});

void test('cat reveal: the stage is empty well before the reveal is stopped (a slow start never cuts her off mid-bound)', () => {
  for (const L of [layoutFor(1280, 800), layoutFor(960, 680, 4, 3, true), layoutFor(1920, 1080, 4, 2, true), tableLayout()]) {
    assert.ok(L.fin.exit + BEAT.exit <= END - .35 + 1e-9, 'gone by the end minus 0.35 s');
    for (const t of times(1 / 60, END - BEAT.clear, END)) {
      const pose = catScene(t, L);
      // Every actor root and every free-standing node is hidden (parts nested in a hidden actor keep their parked pose).
      const loose = Object.entries(pose).filter(([id, p]) => !(id.includes('.') && ['s', 'g', 'c', 'b'].includes(id.split('.')[0]))
        && (p?.o ?? 1) > 0 && Math.min(Math.abs(p?.sx ?? 1), Math.abs(p?.sy ?? 1)) > .002);
      assert.deepEqual(loose.map(([id]) => id), [], `${L.W}px: something is still on stage at ${t}`);
    }
  }
});

void test('cat reveal: swaps are hard cuts, and the new kitten\'s head starts where the old one\'s was, at about the same size', () => {
  for (const L of [layoutFor(1280, 800), layoutFor(1920, 1080, 4, 3, true), tableLayout()]) {
    const samples = catSampleTimes(30, L);
    for (const cut of catCuts(L)) assert.ok(samples.some((t) => Math.abs(t - cut) < 1e-6) && samples.some((t) => Math.abs(t - (cut - CUT_EPSILON)) < 1e-6), `both sides of ${cut} are sampled`);
    const binary = (id: string) => /^(s|g|c|b)$/.test(id) || /\.(eyes|closed|happy|m_\w+)$/.test(id);
    let previous = catScene(samples[0], L);
    for (let i = 1; i < samples.length; i++) {
      const pose = catScene(samples[i], L);
      for (const id of Object.keys(pose)) {
        if (!binary(id)) continue;
        const a = previous[id]?.o ?? 1; const b = pose[id]?.o ?? 1;
        if (Math.abs(a - b) > .01) assert.ok(samples[i] - samples[i - 1] <= CUT_EPSILON + 1e-9, `${id} changes ${a}->${b} over ${samples[i - 1]}..${samples[i]} (not a cut)`);
      }
      previous = pose;
    }
    // Head continuity across both actor swaps, and between every neighbouring frame around them (1/240 s).
    for (const swap of [BEAT.tumble, L.fin.pop]) {
      const before = catExpression(swap - CUT_EPSILON, L).head; const after = catExpression(swap, L).head;
      assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 3, `head stays put across the swap at ${swap}`);
      assert.ok(Math.abs(after.s / before.s - 1) <= .08, `head size ${before.s.toFixed(3)} -> ${after.s.toFixed(3)} at ${swap}`);
      let last = catExpression(swap - .15, L).head;
      for (const t of times(1 / 240, swap - .15 + 1 / 240, swap + .2)) {
        const head = catExpression(t, L).head;
        assert.ok(Math.abs(head.s / last.s - 1) <= .08, `head size jumps ${last.s.toFixed(3)} -> ${head.s.toFixed(3)} at ${t}`);
        assert.ok(Math.hypot(head.x - last.x, head.y - last.y) < 14 * L.k, `head jumps at ${t}`);
        last = head;
      }
    }
    // The landing is a soft squash (about 10% wider and shorter), easing back.
    const land = catScene(BEAT.tumble, L).g;
    assert.ok((land.sx ?? 1) / (land.sy ?? 1) > 1.18 && (land.sx ?? 1) / (land.sy ?? 1) < 1.25);
    const settled = catScene(BEAT.tumble + .2, L).g;
    assert.ok(Math.abs((settled.sx ?? 1) / (settled.sy ?? 1) - 1) < .01);
  }
});

void test('cat reveal: only gentle, cute faces: no open mouth, no half-lid, pupils inside the iris, sparkly eyes after the blink', () => {
  assert.deepEqual([...MOUTHS].sort(), ['o', 'smile', 'w'], 'closed mouths and a small o only');
  const L = layoutFor(1280, 800);
  const seen = new Set<string>();
  for (const t of [...times(1 / 240), ...catSampleTimes(30, L)]) {
    const pose = catScene(t, L);
    const { face, eyeScale, actor } = catExpression(t, L, pose);
    seen.add(`${face.eyes}/${face.mouth}`);
    if (face.eyes === 'open') assert.ok(eyeScale >= .85, `open eyes are never squashed into a lid (${eyeScale.toFixed(2)} at ${t})`);
    if (face.eyes === 'closed') assert.equal(face.mouth, 'smile', 'the slow blink is content');
    if (actor === 'sit' && t >= L.fin.look && face.eyes === 'open') assert.ok(Math.abs(pose['c.head']?.r ?? 0) < .5, `level head with open eyes at ${t}`);
    const p = actor === 'side' ? 's.head' : actor === 'tangle' ? 'g.head' : 'c.head';
    const pupil = pose[`${p}.pupilL`];
    assert.ok(Math.abs(pupil.x ?? 0) + 12.5 * (pupil.sx ?? 1) <= 21 + 1e-9, `pupil inside the iris at ${t}`);
    assert.ok((pupil.y ?? 0) + 6 + 16.5 * (pupil.sy ?? 1) <= 28 && (pupil.y ?? 0) + 6 - 16.5 * (pupil.sy ?? 1) >= -20, `pupil inside the iris vertically at ${t}`);
  }
  for (const expected of ['open/w', 'open/o', 'open/smile', 'happy/smile', 'closed/smile']) assert.ok(seen.has(expected), `uses ${expected}`);
  // She looks toward the yarn (below and to her right) from the trot to the pounce, except the quick glance at the class.
  for (const t of times(1 / 30, .5, BEAT.tumble - .01)) {
    const pupil = catScene(t, L)['s.head.pupilL'];
    if (t >= BEAT.glance[0] && t < BEAT.glance[1]) assert.ok((pupil.x ?? 0) <= 0, `glances at the class at ${t}`);
    else assert.ok((pupil.x ?? 0) > 1.5 && (pupil.y ?? 0) > .5, `looks at the yarn at ${t} (${pupil.x?.toFixed(1)}, ${pupil.y?.toFixed(1)})`);
  }
  // The eyes come back sparkly with a closed "w", and the blush is strongest during the blink.
  const reopened = catScene(L.fin.blink1 + .02, L);
  assert.equal(reopened['c.head.spark'].o, 1);
  assert.equal(reopened['c.head.m_w'].o, 1);
  assert.ok((catScene(L.fin.blink0 + .3, L)['c.head.blush'].sx ?? 1) > (catScene(L.fin.look + .1, L)['c.head.blush'].sx ?? 1));
  const f: Face = { eyes: 'open', mouth: 'w', pupil: 1.3, lookX: 1, lookY: 1 };
  assert.ok(pupilOffset(f).x >= 0 && pupilOffset(f).x + 12.5 * 1.3 <= 21);
  assert.ok(L.fin.lean[0] >= L.fin.blink0 && L.fin.lean[3] <= L.fin.blink1, 'the lean is level again before the eyes reopen');
});

void test('cat reveal: soft pace, never frenetic', () => {
  for (const [width, height] of VIEWPORTS) {
    for (const L of [layoutFor(width, height), layoutFor(width, height, 4, 3, true)]) {
      const step = 1 / 60;
      let previous = catScene(0, L);
      for (const t of times(step).slice(1)) {
        const pose = catScene(t, L);
        for (const id of ['s', 'g', 'c']) {
          if (!pose[id]?.o || !previous[id]?.o) continue;
          const speed = Math.abs(((pose[id].x ?? 0) - (previous[id].x ?? 0)) * L.k) / step;
          // Her two happy bounds after the little ball are quicker (a kitten's bound), but never a dash.
          const limit = id === 'c' && t > L.fin.exit ? .95 : .5;
          assert.ok(speed < limit * width, `${width}px ${id} at ${t.toFixed(2)}s moves ${Math.round(speed)} px/s`);
        }
        previous = pose;
      }
    }
  }
  // The tangle's onward roll to a spot at the far right of a busy table stays gentle too.
  const T = tableLayout();
  assert.ok(T.shift > .1, `the table sends her to the right (${T.shift.toFixed(3)})`);
  for (const t of times(1 / 60, BEAT.tumble, T.fin.pop - .01)) {
    const speed = Math.abs(tangleAt(t + 1 / 60, T).x - tangleAt(t, T).x) * 60;
    assert.ok(speed < .5 * T.W, `onward roll ${Math.round(speed)} px/s at ${t}`);
  }
  assert.ok(Math.abs(tangleAt(T.fin.pop - .01, T).x - T.spotX) < 1, 'the tangle stops exactly on her spot');
});

void test('cat reveal: she stays between the header and the footer at every size, and never floats', () => {
  for (const [width, height] of VIEWPORTS) for (const rows of [1, 3]) {
    const L = layoutFor(width, height, 4, rows, rows > 1);
    assert.ok(L.floor <= height - FOOTER_PX, 'feet on a line just above the footer controls');
    assert.ok(L.catX - 150 * L.k >= -1, 'her face is on screen while she watches the yarn');
    for (const t of times(1 / 30)) {
      const pose = catScene(t, L);
      const top = catTop(pose, L);
      assert.ok(top > HEADER_PX, `${width}x${height} ${rows} rows at ${t}s: top ${Math.round(top)}`);
      if (pose.g?.o) {
        const S = tangleShape(t, L);
        assert.ok(S.cy + S.R * (1 - S.q) <= L.floor + 1, 'the tangle rolls on the floor, not through it');
      }
      // Once she has landed she sits on the floor (no levitating) until she hops away.
      if (pose.c?.o && t > L.fin.land + .02 && t < L.fin.exit) assert.ok(Math.abs((pose.c.y ?? 0) * L.k - L.floor) < 1, `${width}px sitting on the floor at ${t}`);
    }
  }
});

void test('cat reveal: she pops out right on a spot with no names under her; nothing flies across the names', () => {
  // No names measured: she pops out where the covers' roll ends, full size.
  const plain = layoutFor(1280, 800);
  assert.equal(plain.spotX, plain.endX);
  assert.equal(plain.fs, 1);
  assert.equal(plain.short, false);
  assert.equal(plain.fin.pop, BEAT.pop);
  for (const L of [...VIEWPORTS.map(([width, height]) => layoutFor(width, height, 4, 3, true)), tableLayout()]) {
    const tag = `${L.W}x${L.H}`;
    assert.ok(L.shift >= SPOT_RANGE[0] - 1e-9 && L.shift <= SPOT_RANGE[1] + 1e-9, `${tag}: a short roll from the covers' end`);
    assert.ok(L.fs * L.k < Math.max(.5, Math.min(1.55, Math.min(L.W / 1280, L.H / 800))), 'smaller on dense layouts');
    assert.ok(L.hidden < .05, `${tag}: hides ${L.hidden.toFixed(2)} names`);
    assert.equal(L.short, false);
    // The tangle is already on her spot when she pops: after the pop she only springs up and settles, no travel.
    for (const t of times(1 / 60, L.fin.pop, L.fin.exit)) {
      const c = catScene(t, L).c;
      assert.ok(Math.abs((c.x ?? 0) * L.k - L.spotX) < 8 * L.k, `${tag}: no travel after the pop (${t})`);
    }
    // Pop-out bits: soft pom-poms that are gone within 0.22 s, and tiny hearts/sparkles that never cross a name and stay clear of her face.
    for (const t of times(1 / 30, L.fin.pop, L.fin.pop + 1)) {
      const pose = catScene(t, L);
      COVER_POMS.forEach((_, i) => { if (t >= L.fin.pop + POM_LIFE) assert.equal(pose[`pp${i}`].o, 0); });
      const head = catExpression(t, L, pose).head;
      DRIFT.forEach((_, i) => {
        const p = pose[`pd${i}`];
        if (!p.o) return;
        const r = 12 * (p.sx ?? 1) * L.k; const x = (p.x ?? 0) * L.k; const y = (p.y ?? 0) * L.k;
        assert.ok(!overlaps({ x: x - r, y: y - r, w: 2 * r, h: 2 * r }, L.texts), `${tag}: particle ${i} over a name at ${t}`);
        assert.ok(y > head.y + 50 * head.s * L.k, `${tag}: particle ${i} stays below her chin at ${t}`);
      });
    }
    // Hearts float over empty space.
    const hearts = catScene(L.fin.hearts[1] + .5, L);
    assert.ok((hearts.h1?.o ?? 0) > 0);
  }
  // Names everywhere (a packed table): she leaves early with a happy hop, and her eyes never reopen on top of the names.
  const packed = catLayout(1280, 800, 720, [{ x: 640, top: 90, height: 620, width: 1240, color: '#e8a33d' }],
    Array.from({ length: 16 * 12 }, (_, i) => ({ x: 20 + (i % 16) * 78, y: 100 + Math.floor(i / 16) * 52, w: 70, h: 30 })));
  assert.equal(packed.short, true);
  assert.ok(packed.fin.exit < packed.fin.blink1, 'gone before the eyes would reopen');
  const away = sitExtent(catScene(packed.fin.exit + BEAT.exit - CUT_EPSILON, packed), packed);
  assert.ok(packed.exitDir > 0 ? away.left > packed.W : away.right < 0, 'she has bounded off the screen');
  for (const t of times(1 / 60, packed.fin.blink0 + 1e-6, END)) assert.notEqual(catExpression(t, packed).face.eyes, 'open', `eyes stay shut or happy at ${t}`);
});

void test('cat reveal: after the pop the little ball rests by her paw, and the beanie plops on askew then straightens', () => {
  for (const L of [layoutFor(1280, 800), layoutFor(1280, 800, 4, 3, true), tableLayout()]) {
    const t = L.fin.look;
    const pose = catScene(t, L);
    const c = pose.c; const lb = pose['c.lb'];
    const x = ((c.x ?? 0) + (lb.x ?? 0) * (c.sx ?? 1)) * L.k;
    const radius = TANGLE_R * (lb.sy ?? 1) * (c.sy ?? 1) * L.k;
    const bottom = ((c.y ?? 0) + (lb.y ?? 0) * (c.sy ?? 1)) * L.k + radius;
    assert.ok(Math.abs(radius - LEFTOVER_R * L.fs * L.k) < 1.5, `a small leftover ball (${radius.toFixed(1)} px)`);
    assert.ok(Math.abs(bottom - L.floor) < 1.5, 'resting on the floor');
    assert.ok((x - L.spotX) * L.ballSide > 100 * L.fs * L.k, 'beside her, on its side');
    const askew = catScene(L.fin.hat + .1, L)['c.head.hat'].r ?? 0;
    assert.ok(askew < -8, `askew (${askew})`);
    assert.ok(Math.abs(catScene(L.fin.wiggle + .5, L)['c.head.hat'].r ?? 0) < .5, 'straightened by the ear wiggle');
  }
});

void test('cat reveal: on the picker her ears roll under the big name', () => {
  const card = { x: 640, top: 210, height: 385, width: 920, color: '#e8a33d' };
  const texts: TextRect[] = [{ x: 553, y: 245, w: 158, h: 15 }, { x: 536, y: 405, w: 193, h: 104 }, { x: 558, y: 526, w: 149, h: 28 }];
  const L = catLayout(1280, 800, 733, [card], texts);
  assert.ok(L.gs < 1 && L.gs >= .56, `tangle size ${L.gs}`);
  for (const t of times(1 / 30)) {
    const pose = catScene(t, L);
    if (!pose.g?.o) continue;
    const S = tangleShape(t, L);
    if (S.x + S.R * 1.3 < 536 || S.x - S.R * 1.3 > 729) continue;
    const top = catTop(pose, L);
    assert.ok(top > 509, `ears below the name at ${t} (${Math.round(top)})`);
  }
});

void test('cat reveal: hidden actors hold still so their baked tracks compact', () => {
  const L = layoutFor(1280, 800);
  const before = JSON.stringify(Object.entries(catScene(0, L)).filter(([id]) => id.startsWith('c.') || id === 'c'));
  for (const t of times(1 / 30).filter((t) => t < L.fin.pop)) {
    assert.equal(JSON.stringify(Object.entries(catScene(t, L)).filter(([id]) => id.startsWith('c.') || id === 'c')), before, `sitting kitten static at ${t}`);
  }
  const after = JSON.stringify(Object.entries(catScene(BEAT.tumble + .01, L)).filter(([id]) => id.startsWith('s.')));
  for (const t of times(1 / 30).filter((t) => t > BEAT.tumble + .01)) {
    assert.equal(JSON.stringify(Object.entries(catScene(t, L)).filter(([id]) => id.startsWith('s.'))), after, `side kitten static at ${t}`);
  }
});

void test('cat reveal: yarn colours: strands a deeper shade, beanie stripes a pastel tint of the team colour', () => {
  assert.equal(yarnShade('#ffffff'), 'rgb(214, 196, 191)');
  assert.equal(yarnShade('#e8a33d'), yarnShade('rgb(232, 163, 61)'));
  assert.equal(yarnShade('var(--x)'), 'var(--x)');
  assert.equal(pastel('#000000'), 'rgb(97, 95, 93)');
  assert.equal(pastel('var(--x)'), 'var(--x)');
});

/** Where a body-local point of the side-view kitten is (art units, stage coordinates). */
const onSideBody = (pose: ScenePose, x: number, y: number) => chainFrame(pose, [['s', 0, 0], ['s.body', PIVOT.sideBody[0], PIVOT.sideBody[1]], ['__point', x, y]]);
const SIDE_HEAD = [['s', 0, 0], ['s.body', PIVOT.sideBody[0], PIVOT.sideBody[1]], ['s.neck', PIVOT.sideNeck[0], PIVOT.sideNeck[1]], ['s.head', PIVOT.sideHead[0], PIVOT.sideHead[1]]] as const;

void test('cat reveal: the play bow reads from the back of the room: bottom up, chin low, paws planted, and the bottom wiggles while her head stays put', () => {
  for (const L of [layoutFor(1280, 800), layoutFor(960, 680, 4, 3, true)]) {
    const floor = L.floor / L.k;
    const stand = catScene(BEAT.tilt[0] - .05, L);
    const bow = catScene(BEAT.wiggle[0], L);
    const rise = (pose: ScenePose) => onSideBody(pose, 40, -100).y - onSideBody(pose, -84, -112).y;
    assert.ok(Math.abs(rise(stand)) < 14, `level when standing (${rise(stand).toFixed(1)})`);
    assert.ok(rise(bow) >= 25, `her bottom is well above her shoulders in the bow (${rise(bow).toFixed(1)} a)`);
    const head = (pose: ScenePose) => chainFrame(pose, SIDE_HEAD);
    assert.ok(head(bow).y - head(stand).y >= 25, `chin down (${(head(bow).y - head(stand).y).toFixed(1)} a)`);
    let lowest = Infinity; let highest = -Infinity; const still = head(bow);
    for (const t of times(1 / 120, BEAT.crouch[1], BEAT.wiggle[1])) {
      const pose = catScene(t, L);
      for (const leg of Object.keys(PIVOT.sideLegs) as (keyof typeof PIVOT.sideLegs)[]) {
        const [hx, hy] = PIVOT.sideLegs[leg];
        const paw = chainFrame(pose, [['s', 0, 0], ['s.body', PIVOT.sideBody[0], PIVOT.sideBody[1]], [leg, hx, hy], ['__paw', hx, hy + 52]]);
        assert.ok(Math.abs(paw.y - floor) < 2.5, `${leg} planted at ${t} (${(paw.y - floor).toFixed(2)})`);
      }
      const rump = onSideBody(pose, -84, -112).y;
      lowest = Math.min(lowest, rump); highest = Math.max(highest, rump);
      const h = head(pose);
      assert.ok(Math.hypot(h.x - still.x, h.y - still.y) < 3.5, `her head stays put while she wiggles (${t})`);
    }
    assert.ok(highest - lowest >= 10, `a visible bottom wiggle (${(highest - lowest).toFixed(1)} a)`);
  }
});

void test('cat reveal: the finale ends with a chase: the little ball rolls off the nearest edge and she bounds after it', () => {
  for (const L of [layoutFor(1280, 800), layoutFor(960, 680, 4, 3, true), layoutFor(1920, 1080, 4, 3, true), tableLayout()]) {
    const dir = L.spotX >= L.W / 2 ? 1 : -1;
    assert.equal(L.exitDir, dir, 'toward the nearer edge');
    const X = L.fin.exit;
    // She spots it (eyes open, on the ball's side), crouches, then two happy hops with a touch-down between them.
    const spots = catScene(X + .1, L);
    assert.equal(spots['c.head.eyes'].o, 1);
    assert.ok(((spots['c.head.pupilL'].x ?? 0) * dir) > 1, 'watching the ball roll off');
    assert.equal(catExpression(X + .3, L).face.eyes, 'happy');
    assert.equal(exitPose(EXIT.hops[0][1], L).lift, 0);
    assert.ok(exitPose(EXIT.crouch[1] - .05, L).sy < .9, 'a real crouch first');
    assert.ok(exitPose(.3, L).r * dir > 5, 'leaning into the bound');
    if (L.ballSide !== dir) continue;
    // The ball stays ahead of her the whole way.
    for (const t of times(1 / 120, X, X + BEAT.exit - .01)) {
      const pose = catScene(t, L);
      const c = pose.c; const lb = pose['c.lb'];
      const a = (c.r ?? 0) * Math.PI / 180;
      const ballX = ((c.x ?? 0) + ((lb.x ?? 0) * Math.cos(a) - (lb.y ?? 0) * Math.sin(a)) * (c.sx ?? 1)) * L.k;
      const ballR = TANGLE_R * (lb.sx ?? 1) * (c.sx ?? 1) * L.k;
      const front = ((c.x ?? 0) + dir * 92 * Math.abs(c.sx ?? 1)) * L.k;
      const onScreen = dir > 0 ? ballX - ballR < L.W : ballX + ballR > 0;
      if (onScreen) assert.ok((ballX - dir * ballR - front) * dir > -2, `${L.W}px: the little ball leads at ${t}`);
    }
  }
  // The little ball waits on the side she will bound off to.
  assert.equal(layoutFor(1280, 800).ballSide, layoutFor(1280, 800).exitDir);
});

void test('cat reveal: the beanie pops out of the ball beside her cheek, flies up over her head (never across her face) and plops on', () => {
  for (const L of [layoutFor(1280, 800), layoutFor(1280, 800, 4, 3, true), tableLayout()]) {
    const P = L.fin.pop;
    assert.ok((catScene(P + .01, L)['c.head.hat'].sx ?? 1) < .3, 'it starts hidden in the ball');
    let peak = Infinity;
    for (const t of times(1 / 240, P, L.fin.hat)) {
      const hat = catScene(t, L)['c.head.hat'];
      const sc = hat.sx ?? 1; const x = hat.x ?? 0; const y = -50 + (hat.y ?? 0);
      peak = Math.min(peak, hat.y ?? 0);
      // Her face (eyes, nose, mouth) in head units: the flying beanie never covers it.
      const clear = x - 70 * sc > 56 || y + 24 * sc < -24 || y - 66 * sc > 46;
      assert.ok(clear, `the beanie crosses her face at ${t} (x ${x.toFixed(0)}, y ${y.toFixed(0)}, scale ${sc.toFixed(2)})`);
    }
    assert.ok(peak <= -60, `it flies well above her head first (${peak.toFixed(0)})`);
  }
});

void test('cat reveal: cream silhouette rims follow their parts exactly (she reads on a ginger cover)', () => {
  const L = layoutFor(1280, 800);
  for (const t of [.6, 1.5, 2.4, 2.9, 3.5, 4.4]) {
    const pose = catScene(t, L);
    for (const [rim, source] of Object.entries(RIM_FOLLOWS)) assert.deepEqual(pose[rim], pose[source], `${rim} follows ${source} at ${t}`);
  }
});

void test('cat reveal: twinkles only where they are clear of the names, the header and the footer', () => {
  assert.deepEqual(layoutFor(1280, 800).twinkles, [true, true, true, true], 'all four on an empty screen');
  for (const L of [layoutFor(1280, 800, 4, 3, true), layoutFor(960, 680, 4, 3, true), tableLayout()]) {
    const s = L.fs * L.k;
    TWINKLES.forEach(([x, y, r], i) => {
      if (!L.twinkles[i]) return;
      const half = r * 1.15 * s;
      const box = { x: L.spotX + x * s - half, y: L.floor + y * s - half, w: 2 * half, h: 2 * half };
      assert.ok(!overlaps(box, L.texts), `${L.W}px: twinkle ${i} over a name`);
      assert.ok(box.y > HEADER_PX && box.y + box.h < L.clip, `${L.W}px: twinkle ${i} inside the stage`);
    });
  }
});

void test('cat reveal: on dense tables the whole story plays smaller, and strands never dive behind the footer', () => {
  const T = tableLayout();
  assert.equal(T.dense, true);
  assert.ok(Math.abs(T.k - .82 * DENSE_SCALE) < 1e-9, `k ${T.k}`);
  assert.equal(layoutFor(1280, 800, 4, 3, true).dense, false, 'a 12-team grid is not a dense table');
  const five = catLayout(1280, 800, 732.5, Array.from({ length: 15 }, (_, i) => ({ x: 483 + (i % 3) * 298, top: 123 + Math.floor(i / 3) * 93, height: 76, width: 270, color: '#e8a33d' })));
  assert.equal(five.dense, true, 'Today with 5 teams');
  for (const card of strandsOf(T)) assert.ok(looseEndTip(card).y < T.clip - 6);
});

void test('cat reveal: on the picker the tangle grows to her size once it is clear of the name, so the pop is no jump', () => {
  const card = { x: 640, top: 210, height: 385, width: 920, color: '#e8a33d' };
  const texts: TextRect[] = [{ x: 553, y: 245, w: 158, h: 15 }, { x: 536, y: 405, w: 193, h: 104 }, { x: 558, y: 526, w: 149, h: 28 }];
  const L = catLayout(1280, 800, 733, [card], texts);
  assert.ok(L.gsEnd > L.gs);
  const before = catExpression(L.fin.pop - CUT_EPSILON, L).head; const after = catExpression(L.fin.pop, L).head;
  assert.ok(Math.abs(after.s / before.s - 1) <= .1, `head size ${before.s.toFixed(2)} -> ${after.s.toFixed(2)} at the pop`);
  const sat = catExpression(L.fin.look, L).head;
  assert.ok(sat.s / before.s <= 1.15, `no growth spurt after the pop (${before.s.toFixed(2)} -> ${sat.s.toFixed(2)})`);
});

void test('cat reveal: baked rotations are continuous, so a strand bar pointing left never spins round between two samples', () => {
  for (const L of [layoutFor(1280, 800), layoutFor(960, 680, 4, 2, true), tableLayout()]) {
    const names = strandsOf(L).flatMap((_, j) => Array.from({ length: STRAND_SEGMENTS }, (__, i) => `str${j}.${i}`));
    const tracks = bakeScene(L, [...names, 'g.ball', 'c.lb.spin', 's.tail']);
    for (const [name, frames] of tracks) {
      const angles = frames.map((frame) => Number(String(frame.transform ?? 'rotate(0deg)').match(/rotate((-?[d.]+)deg)/)?.[1] ?? 0));
      for (let i = 1; i < angles.length; i++) assert.ok(Math.abs(angles[i] - angles[i - 1]) < 120, `${name} turns ${(angles[i] - angles[i - 1]).toFixed(0)} degrees between two keyframes`);
    }
  }
});

void test('cat reveal: the baked animations (trimmed to when each node moves, simplified) replay every sampled pose within a fraction of a pixel', () => {
  const L = layoutFor(1280, 800, 4, 3, true);
  const names = ['s', 's.body', 's.legNF', 's.legFB', 's.neck', 's.tail', 's.head.pupilL', 's.q', 'g', 'g.ball', 'g.head', 'g.head.happy', 'c', 'c.head', 'c.head.hat', 'c.lb', 'c.lb.spin', 'c.lb.end', 'c.head.eyes', 'c.head.closed', 'h1', 'pd0', 'pp1', 'shadow', 'ballShadow', 'shadow2', 'lbShadow', 'twinkle', 'str0.3', 'str0.10', 'str1.6'];
  const tracks = bakeScene(L, names);
  const first = catScene(0, L);
  for (const name of names) {
    const windowed = activeWindow(tracks.get(name)!);
    const k = name.startsWith('str') ? 1 : L.k;
    // A property a node never changes is not animated: it keeps its first-paint inline value.
    const f = first[name];
    const numbers = (frame: Keyframe) => [
      ...(frame.transform === undefined ? [(f?.x ?? 0) * k, (f?.y ?? 0) * k, f?.r ?? 0, f?.sx ?? 1, f?.sy ?? 1] : [...String(frame.transform).matchAll(/-?[\d.]+(?:e-?\d+)?/g)].map(Number)),
      frame.opacity === undefined ? f?.o ?? 1 : Number(frame.opacity),
    ];
    for (const t of catSampleTimes(30, L)) {
      const p = catScene(t, L)[name];
      const expected = [(p?.x ?? 0) * k, (p?.y ?? 0) * k, p?.r ?? 0, p?.sx ?? 1, p?.sy ?? 1, p?.o ?? 1];
      let got: number[];
      if (!windowed) got = numbers(tracks.get(name)![0]);
      else {
        const { keyframes, timing } = windowed;
        const u = Math.max(0, Math.min(1, (t * 1000 - timing.delay) / timing.duration));
        let i = 0;
        while (i < keyframes.length - 2 && u > (keyframes[i + 1].offset as number)) i++;
        const a = keyframes[i]; const b = keyframes[i + 1] ?? a;
        const span = (b.offset as number) - (a.offset as number);
        const f = span > 0 ? Math.max(0, Math.min(1, (u - (a.offset as number)) / span)) : 1;
        const na = numbers(a); const nb = numbers(b);
        got = na.map((value, c) => value + (nb[c] - value) * f);
      }
      // Near a hard cut the two sides are 0.1 ms apart: skip the sliver in between.
      if (catCuts(L).some((cut) => Math.abs(t - cut) < 2e-3)) continue;
      const tolerance = [.35, .35, .3, .005, .005, .012];
      // Rotations are unwrapped (continuous) in the bake, so compare them modulo a full turn.
      const diff = (c: number) => c === 2 ? Math.abs(((got[c] - expected[c]) % 360 + 540) % 360 - 180) : Math.abs(got[c] - expected[c]);
      expected.forEach((value, c) => assert.ok(diff(c) <= tolerance[c] + .006, `${name} channel ${c} at ${t}: ${got[c]} vs ${value}`));
    }
  }
});
