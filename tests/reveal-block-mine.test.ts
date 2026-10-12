import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  BLOCK_MINE_DURATION_MS, BLOCK_MINE_DURATION_S, BUILD_START_S, CRACK_SPREAD, CUBE_FLIGHT_S, EXIT_END_S, EXIT_START_S, GEM_FLIGHT_S, HOUSE_PARTS, HOUSE_ROWS,
  LAST_SMASH_S, MAX_CUBES, MAX_PER_KIND, NEVER, PICK_ENTER_S, PICK_EXIT_DELAY_S, PICK_EXIT_S, PICK_GRIP_TEXEL, PICK_TIP_TEXEL, RIPPLE_MAX_S, SLOT_COUNT,
  SLOT_CUBES, SLOT_PERIOD_S, SMASH_OFFSET_S, SOUND_BEATS, TEXT_CLEARANCE, TICK_OFFSETS_S, WINDUP_OFFSET_S, blockBox, columnsOf, cubeQuotas, finaleFootprint, finaleTextCover, hotbarFor,
  houseBlocks, houseSize, kindOf, planBlockMine, cottageCrossings, toolIconSize, slotForColumn, slotStart, smashTime, tickTime, wallFor, type BlockMinePlan, type FinaleSpot, type Rect, type Viewport,
  FLIGHT_HOP_BLOCKS, FLIGHT_PEAK_SCALE, FLIGHT_START_SCALE, GEM_DRIFT_S, GEM_HOLD_S, GEM_POP_S, HEADER_BOTTOM, HEART_S, HOTBAR_EARLY_EXIT_S, HOTBAR_KINDS, LONG_HOP_LEAD_S, LONG_HOP_PX, houseOutline,
  PICK_HOP_APEX, PICK_HOP_REACH, PICK_REACH_SIDE, PICK_REACH_UP, PICK_SPIN_REACH, gemItemSize, orderChips, overlapArea,
} from '../src/revealEffects/blockMineTimeline';
import { GEM_GLINT_FRAMES, crackLines, gemGlintSheet, gemGrid, pickaxeGrid } from '../src/revealEffects/blockMineArt';

/** CSS lengths of the one-shot cover animations (blockMine.css): block pop, debris, backing fade. */
const BREAK_S = .26;
const DEBRIS_S = .42;
const CLEAR_S = .12;

const viewport = (width: number, height: number): Viewport => ({ width, height, footerTop: height - 66 });

/** Team cards in the student Groups grid (up to 5 per row, like the lab replica). */
function groupCards(count: number, vp: Viewport): Rect[] {
  const perRow = Math.ceil(count / Math.max(1, Math.ceil(count / 5)));
  const rows = Math.ceil(count / perRow);
  const gap = 18;
  const width = (vp.width - 44 - gap * (perRow - 1)) / perRow;
  const height = Math.max(180, (vp.footerTop - 80 - gap * (rows - 1)) / rows);
  return Array.from({ length: count }, (_, i) => ({ left: 22 + (i % perRow) * (width + gap), top: 74 + Math.floor(i / perRow) * (height + gap), width, height }));
}

/** Station cells of the Today table, column-major like measureRevealCovers orders them. */
function todayCells(teams: number, rounds: number, vp: Viewport): Rect[] {
  const cells: Rect[] = [];
  const width = Math.max(205, (vp.width - 380) / rounds);
  for (let round = 0; round < rounds; round++) for (let team = 0; team < teams; team++) cells.push({ left: 334 + round * width, top: 116 + team * 93, width: width - 36, height: 90 });
  return cells;
}

const pickerCard = (vp: Viewport): Rect[] => [{ left: vp.width / 2 - 460, top: 210, width: 918, height: 383 }];

/**
 * Text the reveal uncovers, roughly where the app draws it: a heading and 3-4
 * left-aligned names per team card, an icon and label per Today cell (plus
 * the team column), the picked name centred on the picker card.
 */
function textFor(name: string, rects: Rect[]): Rect[] {
  if (name.startsWith('picker')) return rects.flatMap((card) => [
    { left: card.left + card.width / 2 - 80, top: card.top + 36, width: 160, height: 16 },
    { left: card.left + card.width / 2 - 60, top: card.top + 70, width: 120, height: 120 },
    { left: card.left + card.width / 2 - 100, top: card.top + 200, width: 200, height: 90 },
    { left: card.left + card.width / 2 - 75, top: card.top + 312, width: 150, height: 30 },
  ]);
  if (name.startsWith('today')) {
    const rows = [...new Set(rects.map((cell) => cell.top))];
    return [
      ...rects.map((cell) => ({ left: cell.left + 18, top: cell.top + cell.height / 2 - 16, width: 150, height: 32 })),
      ...rows.map((top) => ({ left: 56, top: top + 25, width: 160, height: 40 })),
    ];
  }
  return rects.flatMap((card, i) => [
    { left: card.left + 18, top: card.top + 16, width: 150, height: 44 },
    ...Array.from({ length: 3 + (i % 2) }, (_, n) => ({ left: card.left + 30, top: card.top + 88 + n * 46, width: 70 + ((i + n) % 3) * 22, height: 32 })),
  ]);
}

const LAYOUTS: [string, Viewport, (vp: Viewport) => Rect[]][] = [
  ...[1, 2, 3, 4, 5, 6, 8, 12].map((n) => [`groups ${n}`, viewport(1280, 800), (vp: Viewport) => groupCards(n, vp)] as [string, Viewport, (vp: Viewport) => Rect[]]),
  ['groups 4 laptop', viewport(960, 680), (vp) => groupCards(4, vp)],
  ['groups 12 1080p', viewport(1920, 1080), (vp) => groupCards(12, vp)],
  ['today 6x3', viewport(1280, 800), (vp) => todayCells(6, 3, vp)],
  ['today 12x4 (scrolled)', viewport(1280, 800), (vp) => todayCells(12, 4, vp)],
  ['today 2x5', viewport(1280, 800), (vp) => todayCells(2, 5, vp)],
  ['picker', viewport(1280, 800), pickerCard],
  ['picker laptop', viewport(960, 680), () => [{ left: 40, top: 150, width: 880, height: 330 }]],
];

/** The finale spot a plan stands on (hotbar and cottage). */
const spotOf = (plan: BlockMinePlan): FinaleSpot => ({ barLeft: plan.hotbar.centerX - plan.hotbar.width / 2, compactBar: plan.hotbar.compact, house: { block: plan.house.block, left: plan.house.left, bottom: plan.house.bottom } });

const plans = LAYOUTS.flatMap(([name, vp, make]) => [
  { name, vp, plan: planBlockMine(make(vp), vp) },
  { name: `${name} (text measured)`, vp, plan: planBlockMine(make(vp), vp, { text: textFor(name, make(vp)) }) },
]);

void test('block mine stays within its brief window and ends clean', () => {
  assert.ok(BLOCK_MINE_DURATION_MS >= 6000 && BLOCK_MINE_DURATION_MS <= 8500, 'storyboard length 6-8.5 s');
  assert.ok(BLOCK_MINE_DURATION_MS < 9800, 'hard cap');
  assert.ok(EXIT_END_S <= BLOCK_MINE_DURATION_S - .1, 'hotbar and house have sunk out of view before the end');
  assert.ok(LAST_SMASH_S + PICK_EXIT_DELAY_S + PICK_EXIT_S < BUILD_START_S, 'the pickaxe is home before the build');
  for (const { name, plan } of plans) {
    for (const card of plan.cards) {
      for (const block of card.blocks) assert.ok(block.breakAt + Math.max(BREAK_S, DEBRIS_S) < EXIT_START_S, `${name}: every block is gone before the finale ends`);
      assert.ok(card.clearAt + CLEAR_S < BLOCK_MINE_DURATION_S, `${name}: cover backing cleared`);
      assert.ok(card.clearAt <= LAST_SMASH_S + 1e-9, `${name}: every card is revealed by the last smash`);
    }
    for (const cube of plan.cubes.filter((item) => !item.gem)) assert.ok(cube.arriveAt <= BUILD_START_S + 1e-9, `${name}: cubes land before the build starts`);
    const gemCube = plan.cubes.find((item) => item.gem);
    const gemPlacement = plan.house.placements.find((p) => p.material === 'gem');
    assert.ok(gemCube && gemPlacement && gemCube.arriveAt + .3 < gemPlacement.leaveAt, `${name}: the gem is home well before it leaves to crown the house`);
    assert.ok(plan.house.gemLandAt < EXIT_START_S - .3, `${name}: the gem tops the house with time to celebrate`);
  }
});

void test('beats inside a swing slot are ordered and slots do not overlap', () => {
  const offsets = [...TICK_OFFSETS_S, WINDUP_OFFSET_S, SMASH_OFFSET_S];
  offsets.forEach((offset, i) => i && assert.ok(offset > offsets[i - 1]));
  assert.ok(SMASH_OFFSET_S < SLOT_PERIOD_S);
  assert.ok(PICK_ENTER_S < slotStart(0));
  for (let slot = 1; slot < SLOT_COUNT; slot++) assert.ok(smashTime(slot - 1) + RIPPLE_MAX_S < slotStart(slot) + TICK_OFFSETS_S[0]);
});

void test('columns map left to right onto the four fixed swing slots', () => {
  assert.equal(slotForColumn(0, 1), SLOT_COUNT - 1, 'a single column is smashed on the last beat, after three chip slots');
  assert.deepEqual([0, 1].map((c) => slotForColumn(c, 2)), [0, 3]);
  assert.deepEqual([0, 1, 2, 3].map((c) => slotForColumn(c, 4)), [0, 1, 2, 3]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((c) => slotForColumn(c, 6)), [0, 1, 1, 2, 2, 3]);
  const rects = [{ left: 0, top: 0, width: 100, height: 50 }, { left: 0, top: 60, width: 100, height: 50 }, { left: 200, top: 0, width: 100, height: 50 }];
  assert.deepEqual(columnsOf(rects), [0, 0, 1]);
  for (const { name, plan } of plans) {
    const visible = plan.cards.filter((card) => card.visible);
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      assert.ok(visible.some((card) => card.firstSlot <= slot && slot <= card.slot), `${name}: slot ${slot} has something to hit (fixed sound cues)`);
      assert.ok(plan.pickaxes.some((cue) => cue.slot === slot), `${name}: a pickaxe swings in slot ${slot}`);
    }
    for (const card of plan.cards) {
      assert.equal(card.aims.length, card.slot - card.firstSlot + 1, `${name}: one aim per struck slot`);
      const stages = card.crackStages;
      stages.forEach((time, i) => i && assert.ok(time >= stages[i - 1], `${name}: crack stages grow in order`));
      assert.ok(stages[3] < smashTime(card.slot), `${name}: full crack shows before the smash`);
    }
  }
});

void test('one sparkly gem block, visible, in the final smash', () => {
  for (const { name, plan } of plans) {
    const gems = plan.cards.flatMap((card) => card.blocks.filter((block) => block.material === 'gem').map(() => card));
    assert.equal(gems.length, 1, `${name}: exactly one gem`);
    assert.ok(gems[0].visible, `${name}: the gem is on screen`);
    assert.equal(gems[0].slot, SLOT_COUNT - 1, `${name}: the gem pops on the last (chime) smash`);
    assert.ok(plan.cubes.some((cube) => cube.material === 'gem'), `${name}: the gem flies to the hotbar`);
  }
});

void test('hotbar counts never exceed five, never run 6 then 7, never show 67', () => {
  for (const { name, plan } of plans) {
    assert.ok(plan.cubes.length <= MAX_CUBES, `${name}: cube budget`);
    plan.hotbar.counts.forEach((slot) => {
      const values = slot.map((count) => count.value);
      assert.ok(values.every((value) => value >= 0 && value <= MAX_PER_KIND), `${name}: counts stay small`);
      const shown = values.filter((value) => value > 0).join(',');
      assert.ok(!/(^|,)6,7(,|$)/.test(shown) && !values.includes(67) && !values.includes(7), `${name}: no 6-7 (${shown})`);
      slot.forEach((count, i) => i && assert.ok(count.from >= slot[i - 1].from, `${name}: count changes are ordered`));
    });
  }
});

void test('cards become chunks of nearly square blocks that exactly fill the card', () => {
  for (const [width, height] of [[290, 645], [297, 90], [918, 383], [210, 520], [180, 230], [1250, 640], [60, 40]]) {
    const wall = wallFor(width, height);
    const aspect = wall.blockWidth / wall.blockHeight;
    assert.ok(aspect > .7 && aspect < 1.45, `${width}x${height}: blocks stay nearly square (${aspect.toFixed(2)})`);
    const last = blockBox(wall, wall.cols - 1, wall.rows - 1);
    assert.ok(Math.abs(last.left + last.width + wall.depth - (width - wall.inset)) <= 1, `${width}x${height}: front + side faces reach the right edge`);
    assert.ok(Math.abs(last.top + last.height - (height - wall.inset)) <= 1, `${width}x${height}: blocks reach the bottom edge`);
    for (let col = 1; col < wall.cols; col++) assert.equal(blockBox(wall, col, 0).left, blockBox(wall, col - 1, 0).left + blockBox(wall, col - 1, 0).width, 'no seams between blocks');
  }
});

void test('pickaxes use integer pixel scales and hop in from the tool slot', () => {
  for (const { name, plan } of plans) {
    for (const cue of plan.pickaxes) {
      assert.ok(Number.isInteger(cue.scale) && cue.scale >= 3 && cue.scale <= 13, `${name}: crisp integer pixel scale`);
      assert.ok(cue.enterFor > 0 && cue.hideAt > cue.enterAt, `${name}: sane pickaxe window`);
    }
    for (const cue of plan.pickaxes.filter((item) => item.slot === 0)) {
      // It grows out of the tool slot's icon: the sprite's middle (6.5, -2.5 texels from the tip) starts on the slot.
      assert.ok(Math.abs(cue.fromX + 6.5 * cue.scale * cue.fromScale - plan.hotbar.tool.x) < 1 && Math.abs(cue.fromY - 2.5 * cue.scale * cue.fromScale - plan.hotbar.tool.y) < 1, `${name}: first pickaxe leaves the tool slot`);
      assert.ok(Math.abs(cue.fromScale * cue.scale * 18 - toolIconSize(plan.hotbar.slotSize)) < 1, `${name}: ... at the icon's size`);
    }
  }
});

void test('the hotbar and cottage fit on screen, apart, above the footer and below the header', () => {
  for (const { name, vp, plan } of plans) {
    const { hotbar, house } = plan;
    const left = hotbar.centerX - hotbar.width / 2;
    const { width, height } = houseSize(house.block);
    assert.ok(houseBlocks(vp).includes(house.block) && house.block % 16 === 0, `${name}: the cottage's blocks are whole-pixel texels`);
    assert.ok(left >= 0 && left + hotbar.width <= vp.width && house.left >= 0 && house.left + width <= vp.width, `${name}: HUD group inside the viewport`);
    assert.ok(house.left >= left + hotbar.width || house.left + width <= left || house.bottom <= hotbar.top, `${name}: the cottage stands beside or above the hotbar, never on it`);
    assert.ok(hotbar.top + hotbar.height <= vp.footerTop && house.bottom <= vp.footerTop, `${name}: hotbar and cottage clear the footer`);
    assert.equal(house.placements.length, HOUSE_ROWS.flat().filter(Boolean).length);
    assert.ok(house.placements.every((p, i) => i === 0 || p.landAt > house.placements[i - 1].landAt), `${name}: blocks land one after another`);
    assert.ok(house.bottom - height >= HEADER_BOTTOM, `${name}: the cottage, crown and all, stays below the header`);
  }
  const vp = viewport(1280, 800);
  const bar = hotbarFor(vp);
  assert.ok(bar.slots.every((slot, i) => i === 0 || slot.x > bar.slots[i - 1].x) && bar.tool.x < bar.slots[0].x);
  assert.ok(CUBE_FLIGHT_S < 1);
});

void test('the plan is deterministic', () => {
  const vp = viewport(1280, 800);
  assert.deepEqual(planBlockMine(groupCards(4, vp), vp), planBlockMine(groupCards(4, vp), vp));
});

void test('every fixed sound beat lines up with something visible, on every layout', () => {
  const near = (a: number, b: number) => Math.abs(a - b) < .006;
  assert.deepEqual(SOUND_BEATS.ticks, Array.from({ length: SLOT_COUNT * 3 }, (_, i) => Math.round(tickTime(Math.floor(i / 3), i % 3) * 100) / 100));
  const all = Object.values(SOUND_BEATS).flat();
  assert.ok(all.every((at) => at >= .08 && at <= BLOCK_MINE_DURATION_S - .3), 'silent first 80 ms; every cue has room for its tail');
  for (const { name, plan } of plans) {
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const breaks = plan.cards.filter((card) => card.visible).flatMap((card) => card.blocks.filter((block) => block.chip || card.blocks.indexOf(block) === card.hitBlock).map((block) => block.breakAt));
      assert.ok(breaks.some((at) => near(at, SOUND_BEATS.smashes[slot])), `${name}: a block breaks on smash ${slot}`);
      assert.ok(plan.cubes.some((cube) => near(cube.arriveAt, SOUND_BEATS.collects[slot])), `${name}: a cube lands in the hotbar on collect ${slot}`);
    }
    const gemCube = plan.cubes.find((cube) => cube.gem)!;
    assert.ok(near(gemCube.popAt, SOUND_BEATS.gemPop) && near(gemCube.arriveAt, SOUND_BEATS.gemHome), `${name}: the gem pops and lands on its chimes`);
    assert.ok(near(plan.house.gemLandAt, SOUND_BEATS.crown), `${name}: the crown lands on its bell`);
    SOUND_BEATS.buildRows.forEach((at, row) => {
      const first = Math.min(...plan.house.placements.filter((p) => p.row === row).map((p) => p.landAt));
      assert.ok(near(first, at), `${name}: house row ${row} lands on its knock`);
    });
  }
  assert.ok(near(SOUND_BEATS.pickHome, LAST_SMASH_S + PICK_EXIT_DELAY_S + PICK_EXIT_S));
  assert.ok(near(SOUND_BEATS.gemHome, LAST_SMASH_S + GEM_FLIGHT_S));
  // Collect 'ta-dings' fall between the next card's second and third tick, never on its smash.
  for (let slot = 0; slot < SLOT_COUNT - 1; slot++) {
    assert.ok(SOUND_BEATS.collects[slot] > tickTime(slot + 1, 1) + .05 && SOUND_BEATS.collects[slot] < tickTime(slot + 1, 2) - .05, `collect ${slot} sits in a quiet gap`);
  }
});

void test('every swing slot sends a few cubes home; the gem smash sends the gem too', () => {
  for (const { name, plan } of plans) {
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const blocks = plan.cubes.filter((cube) => !cube.gem && Math.abs(cube.popAt - smashTime(slot)) < .2);
      assert.ok(blocks.length >= 1 && blocks.length <= SLOT_CUBES, `${name}: slot ${slot} sends 1-${SLOT_CUBES} cubes (${blocks.length})`);
    }
    assert.equal(plan.cubes.filter((cube) => cube.gem).length, 1, `${name}: one gem`);
  }
  const quotas = cubeQuotas([{ slot: 0, kinds: ['earth', 'stone'] }, { slot: 2, kinds: ['stone'] }, { slot: 3, kinds: ['stone', 'gem'] }]);
  assert.deepEqual(quotas.map((q) => q.stone), [1, 0, 2, 2], 'the five of a kind are shared, later slots first');
  assert.equal(quotas[3].gem, 1);
});

void test('cracks spread out from the struck block and never outlive it', () => {
  for (const { name, plan } of plans) {
    for (const card of plan.cards) {
      const aimed = new Set(card.aims);
      card.blocks.forEach((block, i) => {
        block.cracks.forEach((at, stage) => stage && assert.ok(at >= block.cracks[stage - 1], `${name}: crack stages grow in order`));
        assert.ok(block.cracks.every((at) => at === NEVER || at < block.breakAt), `${name}: no crack appears after its block popped`);
        const distance = Math.min(...[...aimed].map((aim) => Math.abs(card.blocks[aim].col - block.col) + Math.abs(card.blocks[aim].row - block.row)));
        if (distance > CRACK_SPREAD) assert.equal(block.cracks[0], NEVER, `${name}: far blocks stay clean`);
        if (aimed.has(i)) {
          assert.ok(block.cracks[3] < block.breakAt, `${name}: a struck block shows its full crack before it breaks`);
          assert.equal(block.hits.length % TICK_OFFSETS_S.length, 0, `${name}: a struck block flashes on every tick`);
        }
      });
    }
  }
});

void test('pickaxes stay on screen: they swing from the left at the right edge', () => {
  for (const { name, vp, plan } of plans) {
    for (const cue of plan.pickaxes) {
      const grip = cue.x + (cue.mirror ? -1 : 1) * (PICK_GRIP_TEXEL.x - PICK_TIP_TEXEL.x) * cue.scale;
      assert.ok(grip >= 0 && grip <= vp.width, `${name}: the pickaxe grip is on screen (${Math.round(grip)})`);
      // Even at the top of the wind-up, where there is room on either side.
      const head = cue.x + (cue.mirror ? -1 : 1) * PICK_REACH_SIDE * cue.scale;
      if (cue.x - PICK_REACH_SIDE * cue.scale >= 0 || cue.x + PICK_REACH_SIDE * cue.scale <= vp.width) assert.ok(head >= 0 && head <= vp.width, `${name}: the wind-up stays on screen (${Math.round(head)})`);
    }
  }
  assert.ok(plans.some(({ plan }) => plan.pickaxes.some((cue) => cue.mirror)), 'the one-card layout exercises the mirror');
});

void test('the finale cottage always looks the same and never draws from an empty slot', () => {
  for (const { name, plan } of plans) {
    for (const p of plan.house.placements) {
      assert.equal(p.material, HOUSE_PARTS[HOUSE_ROWS[p.row][p.col] as string], `${name}: cottage block ${p.row},${p.col}`);
      const slot = plan.hotbar.counts[['earth', 'wood', 'stone', 'gem'].indexOf(p.kind)];
      const shown = slot.find((count) => count.from <= p.leaveAt - 1e-6 && p.leaveAt - 1e-6 < count.to);
      assert.ok(shown && shown.value > 0, `${name}: block ${p.row},${p.col} leaves a slot that holds something`);
    }
  }
});

void test('the finale stands clear of the revealed names wherever there is room', () => {
  const clear = ['groups 1', 'groups 2', 'groups 3', 'groups 4', 'groups 5', 'groups 4 laptop', 'today 2x5', 'picker'];
  const pad = (box: Rect): Rect => ({ left: box.left - TEXT_CLEARANCE, top: box.top - TEXT_CLEARANCE, width: box.width + TEXT_CLEARANCE * 2, height: box.height + TEXT_CLEARANCE * 2 });
  for (const [name, vp, make] of LAYOUTS) {
    const rects = make(vp);
    const text = textFor(name, rects).map(pad);
    const plan = planBlockMine(rects, vp, { text: textFor(name, rects) });
    const spot = spotOf(plan);
    // Where there is room, the cottage stands inside one card (on its floor) or in the open, never on a card's outline.
    if (clear.includes(name)) assert.equal(cottageCrossings(spot.house, rects), 0, `${name}: the cottage stands clear of every card outline`);
    // The solid parts (hotbar, cottage, the big gem) never sit on a name where there is room; the
    // see-through sunburst and the floating hearts may brush past one.
    const solid = finaleFootprint(vp, spot).filter((piece) => piece.solid);
    const hit = solid.some((rect) => text.some((box) => Math.min(rect.left + rect.width, box.left + box.width) > Math.max(rect.left, box.left) && Math.min(rect.top + rect.height, box.top + box.height) > Math.max(rect.top, box.top)));
    if (clear.includes(name)) assert.ok(!hit, `${name}: the hotbar, cottage and gem cover no name`);
    // The solid pieces never hide more (area x time) than the plain centred finale's.
    const solidCover = (plan: BlockMinePlan) => finaleFootprint(vp, spotOf(plan)).filter((piece) => piece.solid).reduce((sum, piece) => sum + text.reduce((total, box) => total + overlapArea(piece, box) * (piece.to - piece.from), 0), 0);
    assert.ok(solidCover(plan) <= solidCover(planBlockMine(rects, vp)) + 1e-6, `${name}: never covers more than the plain centred finale`);
    // Where something must be hidden, the chosen spot hides less (weighted by how long) than the centred one.
    if (!clear.includes(name)) assert.ok(finaleTextCover(vp, spot, text) <= finaleTextCover(vp, spotOf(planBlockMine(rects, vp)), text) + 1e-6, `${name}: hides less than the centred finale`);
  }
  // 1080p, six narrow cards: rather than straddle the gutter between two cards, the compact cottage
  // stands inside one; the plan is still deterministic with text.
  const vp = viewport(1920, 1080);
  const six = groupCards(6, vp);
  const sixPlan = planBlockMine(six, vp, { text: textFor('groups 6', six) });
  assert.equal(cottageCrossings(spotOf(sixPlan).house, six), 0, '1080p, six cards: the cottage stands inside one card');
  assert.deepEqual(sixPlan, planBlockMine(six, vp, { text: textFor('groups 6', six) }));
});

void test('one or two columns of cards still yield wood (a support beam), so the cottage never borrows', () => {
  for (const { name, plan } of plans) {
    const mined = new Set(plan.cubes.map((cube) => cube.kind));
    for (const kind of ['earth', 'wood', 'stone', 'gem'] as const) assert.ok(mined.has(kind), `${name}: some ${kind} reaches the hotbar`);
    for (const p of plan.house.placements) assert.equal(p.kind, kindOf(p.material), `${name}: cottage block ${p.row},${p.col} comes from its own slot`);
  }
});

void test('cracks are thin fracture lines that grow from a small star to the block edges', () => {
  const stages = crackLines();
  assert.equal(stages.length, 4);
  const keys = stages.map((cells) => new Set(cells.map(([x, y]) => `${x},${y}`)));
  keys.forEach((set, stage) => stage && assert.ok([...keys[stage - 1]].every((key) => set.has(key)), `stage ${stage + 1} keeps stage ${stage}`));
  assert.ok(keys[0].size <= 14, `stage 1 is a small star (${keys[0].size})`);
  assert.ok(keys[1].size < keys[2].size && keys[2].size < keys[3].size, 'each stage cracks further');
  assert.ok(stages[3].some(([x, y]) => x === 0 || y === 0 || x === 15 || y === 15), 'the last stage reaches an edge');
  assert.ok(keys[3].size < 16 * 16 * .4, `thin lines, not a blot (${keys[3].size} texels)`);
  for (const [x, y] of stages[3]) assert.ok(x >= 0 && y >= 0 && x < 16 && y < 16);
});

/** The swing poses (blockMine.tsx swingKeyframes): degrees about the grip, with their scales. */
const SWING_POSES: [number, number, number][] = [[26, 1, 1], [40, 1, 1], [42, 1, 1], [44, 1, 1], [-5, 1.04, .96], [12, 1, 1], [80, 1.08, 1.08], [86, 1.12, 1.06], [-12, 1.14, .88], [-18, 1, 1], [8, 1, 1], [24, 1, 1]];
/** Texels the pickaxe sprite reaches above its tip: swung about the grip, then the whole hop turned about the tip. */
function spriteReach(swing: number, sx = 1, sy = 1, travel = 0) {
  const turn = (x: number, y: number, deg: number) => { const a = deg * Math.PI / 180; return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; };
  let reach = -Infinity;
  pickaxeGrid().forEach((row, y) => row.forEach((color, x) => {
    if (!color) return;
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const [gx, gy] = turn((x + ox - PICK_GRIP_TEXEL.x) * sx, (y + oy - PICK_GRIP_TEXEL.y) * sy, swing);
      const [, ty] = turn(gx + PICK_GRIP_TEXEL.x - PICK_TIP_TEXEL.x, gy + PICK_GRIP_TEXEL.y - PICK_TIP_TEXEL.y, travel);
      reach = Math.max(reach, -ty);
    }
  }));
  return reach;
}

void test('the planned pickaxe reach covers the sprite in every pose', () => {
  for (const [angle, sx, sy] of SWING_POSES) {
    assert.ok(spriteReach(angle, sx, sy) <= PICK_REACH_UP, `swing ${angle}deg reaches ${spriteReach(angle, sx, sy).toFixed(2)} texels up`);
    // Sideways: the reach "up" of the pose turned a quarter turn (about the tip) is its reach to the grip side.
    assert.ok(spriteReach(angle, sx, sy, -90) <= PICK_REACH_SIDE, `swing ${angle}deg reaches ${spriteReach(angle, sx, sy, -90).toFixed(2)} texels sideways`);
  }
  // Mid-hop it is turned back by a third of -24deg (bm-pick-travel); late in the spin-in, anywhere from -108deg to upright.
  assert.ok(spriteReach(26, 1, 1, -7.2) <= PICK_HOP_REACH);
  for (let travel = -108; travel <= 0; travel += 3) assert.ok(spriteReach(26, 1, 1, travel) <= PICK_SPIN_REACH, `spin ${travel}deg`);
});

void test('the pickaxe stays below the app header, swinging and hopping', () => {
  for (const { name, plan } of plans) {
    for (const cue of plan.pickaxes) {
      if (cue.scale > 3) assert.ok(cue.y - PICK_REACH_UP * cue.scale >= HEADER_BOTTOM, `${name}: slot ${cue.slot} swing reaches ${Math.round(cue.y - PICK_REACH_UP * cue.scale)}`);
      // The top of the hop clears the header, unless one of its ends is up there already.
      const apex = cue.y + (cue.fromY - cue.y) * PICK_HOP_APEX + cue.lift;
      const reach = (cue.slot === 0 ? PICK_SPIN_REACH : PICK_HOP_REACH * cue.midScale) * cue.scale;
      assert.ok(apex - reach >= Math.min(HEADER_BOTTOM, cue.y - reach, cue.fromY - reach) - 1, `${name}: slot ${cue.slot} hop tops out at ${Math.round(apex - reach)}`);
      assert.ok(cue.midScale <= 1 + 1e-9, `${name}: never bigger mid-hop than at its target`);
      if (cue.home) {
        // After the last smash it flips up and spins home, shrinking to the slot icon's size.
        const homeTop = cue.y + cue.home.y * .25 + cue.home.lift - PICK_SPIN_REACH * cue.scale * .8;
        assert.ok(homeTop >= Math.min(HEADER_BOTTOM, cue.y - PICK_SPIN_REACH * cue.scale * .8) - 1, `${name}: the hop home tops out at ${Math.round(homeTop)}`);
        assert.ok(Math.abs(cue.home.scale * cue.scale * 18 - toolIconSize(plan.hotbar.slotSize)) < 1, `${name}: it lands at the icon's size`);
      }
    }
  }
});

void test('long pickaxe hops leave early, and every hop hands over without a gap or a double', () => {
  for (const { name, plan } of plans) {
    for (const cue of plan.pickaxes.filter((item) => item.slot > 0)) {
      const source = plan.pickaxes.find((item) => item.slot === cue.slot - 1 && Math.abs(item.x - cue.fromX) < .01 && Math.abs(item.y - cue.fromY) < .01);
      assert.ok(source, `${name}: slot ${cue.slot} hops from a pickaxe of the slot before`);
      assert.ok(Math.abs(source.hideAt - cue.enterAt) < 1e-6, `${name}: the old pickaxe hides as the new one leaves`);
      if (Math.hypot(cue.fromX - cue.x, cue.fromY - cue.y) > LONG_HOP_PX) assert.ok(Math.abs(cue.enterAt - (slotStart(cue.slot) - LONG_HOP_LEAD_S)) < 1e-6, `${name}: a long hop leaves during the follow-through`);
      assert.ok(cue.enterAt > smashTime(cue.slot - 1), `${name}: never before the smash it follows`);
    }
  }
  // A card's chips go round its corners, never corner to corner across it.
  const corners: Record<number, { x: number; y: number }> = { 0: { x: 880, y: 40 }, 1: { x: 40, y: 330 }, 2: { x: 880, y: 330 }, 9: { x: 420, y: 190 } };
  const order = orderChips([0, 1, 2], 9, (block) => corners[block], { x: 460, y: 500 });
  for (let i = 1; i < order.length; i++) assert.ok(!(corners[order[i]].x !== corners[order[i - 1]].x && corners[order[i]].y !== corners[order[i - 1]].y), `no diagonal hop (${order.join(',')})`);
});

void test('cottage blocks hop only a little above their spot, from their own slot', () => {
  for (const { name, plan } of plans) {
    const { block } = plan.house;
    for (const p of plan.house.placements) {
      const peakTop = p.y + block / 2 + p.midY - block * FLIGHT_PEAK_SCALE / 2;
      const sourceTop = p.y + block / 2 + p.fromY - block * FLIGHT_START_SCALE / 2;
      const above = (Math.min(sourceTop, p.y) - peakTop) / block;
      assert.ok(above <= (p.row === 0 ? 1.1 : FLIGHT_HOP_BLOCKS) + 1e-6, `${name}: row ${p.row} hops ${above.toFixed(2)} blocks up`);
      assert.ok(Math.abs(p.midX) <= block * .9 + 1e-6, `${name}: it tops out right beside its spot`);
    }
  }
});

void test('each hotbar slot empties exactly as its last block leaves for the cottage', () => {
  for (const { name, plan } of plans) {
    HOTBAR_KINDS.forEach((kind, k) => {
      const leaves = plan.house.placements.filter((p) => p.kind === kind).map((p) => p.leaveAt);
      const last = plan.hotbar.counts[k][plan.hotbar.counts[k].length - 1];
      assert.ok(last && last.value === 0 && Math.abs(last.from - Math.max(...leaves)) < 1e-6, `${name}: the ${kind} slot is empty from its last block's hop`);
    });
  }
});

void test('on crowded screens the finale hides late-revealed names, briefly', () => {
  for (const [name, vp, make] of LAYOUTS) {
    const rects = make(vp);
    const text = textFor(name, rects);
    const plan = planBlockMine(rects, vp, { text });
    const bar = { left: plan.hotbar.centerX - plan.hotbar.width / 2, top: plan.hotbar.top, width: plan.hotbar.width, height: plan.hotbar.height };
    const hidden = text.filter((box) => overlapArea(bar, box) > 0);
    // The hotbar sinks early exactly when it still hides a name.
    assert.equal(plan.hotbar.exitAt === HOTBAR_EARLY_EXIT_S, hidden.length > 0, `${name}: hotbar exit ${plan.hotbar.exitAt}`);
    // It never sinks before the crown gem has left it.
    const crown = plan.house.placements.find((p) => p.material === 'gem')!;
    assert.ok((plan.hotbar.exitAt ?? EXIT_START_S) > crown.leaveAt, `${name}: the hotbar stays until the crown gem has left it`);
    if (name === 'groups 12') {
      // The last column is revealed last: the hotbar hides only its names, not a name uncovered at 1.3 or 2.2 s.
      const lastColumn = plan.cards.filter((card) => card.slot === SLOT_COUNT - 1).map((card) => card.rect);
      for (const box of hidden) assert.ok(lastColumn.some((r) => box.left >= r.left && box.left < r.left + r.width && box.top >= r.top && box.top < r.top + r.height), `${name}: hides only last-column names`);
      // Crowded: the smaller hotbar, hugging the footer.
      assert.ok(plan.hotbar.compact && plan.hotbar.slotSize < hotbarFor(vp).slotSize, `${name}: the compact hotbar`);
      // The cottage stands where it hides the fewest words.
      const outline = houseOutline(spotOf(plan).house);
      const centred = houseOutline(spotOf(planBlockMine(rects, vp)).house);
      assert.ok(text.filter((box) => overlapArea(outline, box) > 0).length <= text.filter((box) => overlapArea(centred, box) > 0).length, `${name}: the cottage hides no more words than a centred one`);
    }
  }
});

void test('every switch-off holds: a keyframe list that ends hidden is hidden just before its end too', () => {
  // In live playback a finished animation fills forwards at a progress just below 1, where a
  // visible-to-hidden step still reads visible (seeked lab frames land on exactly 1 and hide it).
  const css = readFileSync(join(process.cwd(), 'src/revealEffects/blockMine.css'), 'utf8').replace(/\r\n/g, '\n');
  const blocks = [...css.matchAll(/@keyframes ([\w-]+) \{([\s\S]*?)\}\s*\}/g)];
  assert.ok(blocks.length > 30, 'keyframes parsed');
  let checked = 0;
  for (const [, name, body] of blocks) {
    const frames = [...`${body}}`.matchAll(/([\d.%, a-z]+)\{([^}]*)\}/g)].flatMap(([, stops, rules]) => stops.split(',').map((stop) => {
      const at = stop.trim() === 'from' ? 0 : stop.trim() === 'to' ? 100 : parseFloat(stop);
      return { at, visibility: /visibility: (\w+)/.exec(rules)?.[1] };
    })).filter((frame) => frame.visibility).sort((a, b) => a.at - b.at);
    const last = frames[frames.length - 1];
    if (!last || last.at !== 100 || last.visibility !== 'hidden') continue;
    checked++;
    const before = frames[frames.length - 2];
    assert.ok(before?.visibility === 'hidden', `${name}: hidden before its end (${before ? `${before.at}% is ${before.visibility}` : 'implicit start, visible'})`);
  }
  assert.ok(checked >= 8, `checked ${checked} switch-offs`);
});

void test('the finale leaves cleanly: nothing ghosts behind the footer, nothing is left at the end', () => {
  const css = readFileSync(join(process.cwd(), 'src/revealEffects/blockMine.css'), 'utf8').replace(/\r\n/g, '\n');
  // The hotbar rises from and sinks behind the footer line, clipped there; the cottage sinks into its own ground.
  assert.match(css, /\.bm-ground \{[^}]*overflow: hidden/, 'the hotbar is clipped at the footer line');
  assert.match(css, /\.bm-yard \{[^}]*overflow: hidden/, 'the cottage is clipped at its ground line');
  // Flights hand over to the landed blocks: the flying copy ends hidden, the landed one stays.
  assert.match(css, /@keyframes bm-hfly \{[\s\S]*?100% \{ visibility: hidden; transform: none; \}/);
  assert.match(css, /\.bm-hland \{[^}]*visibility: hidden;[^}]*bm-unhide 1ms linear forwards/, 'the landed block appears as its flight ends, and stays');
  for (const { name, plan } of plans) {
    // Hearts pop away before the cottage has sunk; the cottage stands on its ground line, above the footer.
    assert.ok(plan.house.gemLandAt + .12 + .2 + HEART_S <= EXIT_END_S - .05, `${name}: the hearts are gone before the end`);
    assert.ok(plan.house.bottom <= plan.viewport.footerTop, `${name}: the cottage's ground is above the footer`);
    assert.ok(plan.house.heartRise >= 40 && plan.house.heartRise <= 118 && plan.house.hearts.every((side) => [-1, 0, 1].includes(side)), `${name}: hearts rise a little, up to 118 px`);
  }
  // Hearts rise no higher than the names above the crown, and a heart whose path would cross a name stays home.
  for (const [name, vp, make] of LAYOUTS) {
    const rects = make(vp);
    const text = textFor(name, rects);
    const { house } = planBlockMine(rects, vp, { text });
    const crown = house.placements.find((p) => p.material === 'gem')!;
    const cx = crown.x + house.block / 2;
    const cy = crown.y + house.block / 2;
    for (const side of house.hearts) {
      const x0 = cx + side * house.block * 1.1;
      const x1 = cx + side * house.block * 1.54;
      const path = { left: Math.min(x0, x1) - house.heart / 2, top: cy - house.heart / 2 - house.heartRise, width: Math.abs(x1 - x0) + house.heart, height: house.heartRise + house.heart };
      assert.ok(!text.some((box) => overlapArea(path, box) > 0), `${name}: heart ${side} floats clear of the names`);
    }
  }
});

void test('the gem shows its face at its hero moment, and its sunburst stays on screen', () => {
  const css = readFileSync(join(process.cwd(), 'src/revealEffects/blockMine.css'), 'utf8').replace(/\r\n/g, '\n');
  const flip = /@keyframes bm-gem-flip \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  const frames = [...flip.matchAll(/([\d.%, ]+)\{ transform: scaleX\(([-\d.]+)\)/g)].flatMap(([, stops, value]) => stops.split(',').map((stop) => [parseFloat(stop), Number(value)] as const));
  const at = (pct: number) => frames.find(([stop]) => Math.abs(stop - pct) < .15)?.[1];
  const arrive = (GEM_POP_S + GEM_DRIFT_S) / GEM_FLIGHT_S * 100;
  const leave = (GEM_POP_S + GEM_DRIFT_S + GEM_HOLD_S) / GEM_FLIGHT_S * 100;
  assert.ok(frames.length >= 10, 'bm-gem-flip parsed');
  assert.equal(at(arrive), 1, 'face-on as it reaches its hero point');
  assert.ok(frames.filter(([stop]) => stop > arrive && stop < leave).every(([, value]) => value === 1), 'face-on through the hold');
  assert.ok(frames.some(([stop, value]) => stop > leave && value < 0), 'one flip on the dive home');
  // The glint: a band that sweeps across the gem's own texels, frame by frame.
  const gem = gemGrid();
  const sheet = gemGlintSheet();
  const centres: number[] = [];
  for (let frame = 0; frame < GEM_GLINT_FRAMES; frame++) {
    const cells: number[] = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (sheet[y][frame * 16 + x]) { assert.ok(gem[y][x], 'glint only on the gem'); cells.push(x + y); }
    if (cells.length) centres.push(cells.reduce((a, b) => a + b, 0) / cells.length);
  }
  assert.ok(centres.length >= 4 && centres.every((c, i) => i === 0 || c > centres[i - 1]), 'the glint sweeps one way');
  for (const { name, vp, plan } of plans) {
    const gemCube = plan.cubes.find((cube) => cube.gem)!;
    const burst = gemItemSize(plan.hotbar.slotSize) * 2 * 1.1;
    const x = gemCube.x + gemCube.heroX;
    assert.ok(x - burst >= 0 && x + burst <= vp.width, `${name}: sunburst on screen`);
  }
});

void test('cover pieces never grow a scroll box (the Today table)', () => {
  const css = readFileSync(join(process.cwd(), 'src/revealEffects/blockMine.css'), 'utf8');
  assert.match(css, /\.bm-cover\.is-clipped \{ overflow: hidden; \}/, 'covers inside a scroll box clip their burst');
  assert.match(css, /\.bm-debris \{[^}]*transform: scale\(0\)/, 'debris is shrunk to nothing before its burst');
  assert.match(css, /@keyframes bm-debris \{.*100% \{ visibility: hidden; transform: scale\(0\); \} \}/, '... and after it');
});
