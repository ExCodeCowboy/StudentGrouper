import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { pixelQuestEffect } from '../src/revealEffects/pixelQuest';
import { PQ_FONT, PQ_GEM, PQ_HERO_FRAMES, PQ_PALETTE, PQ_POOF_FRAMES, PQ_POOF_GRID, PQ_POOF_PALETTE, PQ_POOF_SETS, PQ_POOF_VARIANTS, PQ_SPRING, PQ_STAR, PQ_TEXTS, PQ_TROPHY, poofFootprint } from '../src/revealEffects/pixelQuestSprites';
import {
  PIXEL_QUEST_DURATION_MS, PQ_ACT_SLICES, PQ_ACTS, PQ_CHEER_TROPHY_CENTRE_P, PQ_FINALE_ACTS, PQ_FINALE_SIZES, PQ_HERO, PQ_HILL_MIN_P, PQ_LIMITS, PQ_T, captionAt, finaleCover, finaleFeetY, finaleLayout, finaleHeroBox,
  finaleHeroShape, fireworkBox, heroPose, heroX, hudCount, overlapArea, pixelQuestPlan, poofBloomBox, pqActAt, pqActSlice, pqScenery, pqSlicesAt, runFrame, skyWindow, skyWipeAt, stripFallAt,
  type PqBox, type PqLayoutInput, type PqPlan, type PqPoof,
} from '../src/revealEffects/pixelQuestTimeline';

// Cover rectangles measured in the reveal lab: [name, width, height, header bottom, footer top, [left, top, width, height]*].
const MEASURED: [string, number, number, number, number, number[]][] = [
  ['groups-1x3-1280x800', 1280, 800, 66, 732.5, [24, 74, 1217, 636.5]],
  ['groups-4x3-1280x800', 1280, 800, 66, 732.5, [24, 74, 289.3, 636.5, 333.3, 74, 289.3, 636.5, 642.5, 74, 289.3, 636.5, 951.8, 74, 289.3, 636.5]],
  ['groups-5x3-1280x800', 1280, 800, 66, 732.5, [24, 74, 227.4, 636.5, 271.4, 74, 227.4, 636.5, 518.8, 74, 227.4, 636.5, 766.2, 74, 227.4, 636.5, 1013.6, 74, 227.4, 636.5]],
  ['groups-7x3-1280x800', 1280, 800, 66, 732.5, [24, 74, 289.3, 308.3, 333.3, 74, 289.3, 308.3, 642.5, 74, 289.3, 308.3, 951.8, 74, 289.3, 308.3, 24, 402.3, 289.3, 308.3, 333.3, 402.3, 289.3, 308.3, 642.5, 402.3, 289.3, 308.3]],
  ['groups-8x3-1280x800', 1280, 800, 66, 732.5, [24, 74, 289.3, 308.3, 333.3, 74, 289.3, 308.3, 642.5, 74, 289.3, 308.3, 951.8, 74, 289.3, 308.3, 24, 402.3, 289.3, 308.3, 333.3, 402.3, 289.3, 308.3, 642.5, 402.3, 289.3, 308.3, 951.8, 402.3, 289.3, 308.3]],
  ['groups-12x3-1280x800', 1280, 800, 66, 732.5, [24, 74, 289.3, 231.1, 333.3, 74, 289.3, 231.1, 642.5, 74, 289.3, 231.1, 951.8, 74, 289.3, 231.1, 24, 325.1, 289.3, 231.1, 333.3, 325.1, 289.3, 231.1, 642.5, 325.1, 289.3, 231.1, 951.8, 325.1, 289.3, 231.1, 24, 576.1, 289.3, 231.1, 333.3, 576.1, 289.3, 231.1, 642.5, 576.1, 289.3, 231.1, 951.8, 576.1, 289.3, 231.1]],
  ['groups-4x3-960x680', 960, 680, 66, 612.5, [24, 74, 285.7, 257.8, 329.7, 74, 285.7, 257.8, 635.3, 74, 285.7, 257.8, 24, 351.8, 285.7, 257.8]],
  ['groups-12x3-960x680', 960, 680, 66, 612.5, [24, 74, 285.7, 217.6, 329.7, 74, 285.7, 217.6, 635.3, 74, 285.7, 217.6, 24, 311.6, 285.7, 217.6, 329.7, 311.6, 285.7, 217.6, 635.3, 311.6, 285.7, 217.6, 24, 549.1, 285.7, 217.6, 329.7, 549.1, 285.7, 217.6, 635.3, 549.1, 285.7, 217.6, 24, 786.7, 285.7, 217.6, 329.7, 786.7, 285.7, 217.6, 635.3, 786.7, 285.7, 217.6]],
  ['groups-12x3-1920x1080', 1920, 1080, 66, 1012.5, [24, 74, 292.8, 448.3, 336.8, 74, 292.8, 448.3, 649.7, 74, 292.8, 448.3, 962.5, 74, 292.8, 448.3, 1275.3, 74, 292.8, 448.3, 1588.2, 74, 292.8, 448.3, 24, 542.3, 292.8, 448.3, 336.8, 542.3, 292.8, 448.3, 649.7, 542.3, 292.8, 448.3, 962.5, 542.3, 292.8, 448.3, 1275.3, 542.3, 292.8, 448.3, 1588.2, 542.3, 292.8, 448.3]],
  ['groups-7x3-1920x1080', 1920, 1080, 66, 1012.5, [24, 74, 449.3, 448.3, 493.3, 74, 449.3, 448.3, 962.5, 74, 449.3, 448.3, 1431.8, 74, 449.3, 448.3, 24, 542.3, 449.3, 448.3, 493.3, 542.3, 449.3, 448.3, 962.5, 542.3, 449.3, 448.3]],
  ['rotations-5x3-1280x800', 1280, 800, 66, 732.5, [348.3, 123, 269.3, 76, 646.5, 123, 269.3, 76, 944.8, 123, 270.3, 76, 348.3, 216, 269.3, 76, 646.5, 216, 269.3, 76, 944.8, 216, 270.3, 76, 348.3, 309, 269.3, 76, 646.5, 309, 269.3, 76, 944.8, 309, 270.3, 76, 348.3, 402, 269.3, 76, 646.5, 402, 269.3, 76, 944.8, 402, 270.3, 76, 348.3, 495, 269.3, 76, 646.5, 495, 269.3, 76, 944.8, 495, 270.3, 76]],
  ['rotations-2x3-1280x800', 1280, 800, 66, 732.5, [348.3, 123, 269.3, 76, 646.5, 123, 269.3, 76, 944.8, 123, 270.3, 76, 348.3, 216, 269.3, 76, 646.5, 216, 269.3, 76, 944.8, 216, 270.3, 76]],
  ['rotations-4x6-960x680', 960, 680, 66, 612.5, [412.8, 141, 142.4, 90, 592.1, 141, 142.4, 90, 771.5, 141, 142.4, 90, 950.9, 141, 142.4, 90, 1130.3, 141, 142.4, 90, 1309.6, 141, 143.4, 90, 412.8, 260, 142.4, 90, 592.1, 260, 142.4, 90, 771.5, 260, 142.4, 90, 950.9, 260, 142.4, 90, 1130.3, 260, 142.4, 90, 1309.6, 260, 143.4, 90, 412.8, 379, 142.4, 90, 592.1, 379, 142.4, 90, 771.5, 379, 142.4, 90, 950.9, 379, 142.4, 90, 1130.3, 379, 142.4, 90, 1309.6, 379, 143.4, 90, 412.8, 498, 142.4, 90, 592.1, 498, 142.4, 90, 771.5, 498, 142.4, 90, 950.9, 498, 142.4, 90, 1130.3, 498, 142.4, 90, 1309.6, 498, 143.4, 90]],
  ['rotations-12x4-1920x1080', 1920, 1080, 66, 1012.5, Array.from({ length: 12 }, (_, row) => [512.3, 855.9, 1199.6, 1543.3].flatMap((left, col) => [left, 141 + row * 119, col === 3 ? 307.7 : 306.7, 90])).flat()],
];

function layout([, width, height, chromeTop, chromeBottom, flat]: (typeof MEASURED)[number]): PqLayoutInput {
  const rects = [];
  for (let i = 0; i < flat.length; i += 4) rects.push({ left: flat[i], top: flat[i + 1], width: flat[i + 2], height: flat[i + 3] });
  return { width, height, chromeTop, chromeBottom, rects };
}

function rects(flat: number[]) {
  const out = [];
  for (let i = 0; i < flat.length; i += 4) out.push({ left: flat[i], top: flat[i + 1], width: flat[i + 2], height: flat[i + 3] });
  return out;
}
// Text lines of the 8-team lab screen: [left, top, width, height]*.
const GROUPS8_TEXT = [43.5, 97.8, 37.1, 31, 94, 100.9, 56.2, 25, 54, 166, 77.1, 33, 54, 212.4, 93, 33, 54, 258.8, 54.8, 33, 352.7, 97.8, 37.1, 31, 403.3, 100.9, 61.9, 25, 363.3, 166, 67.5, 33,
  363.3, 212.4, 48.8, 33, 363.3, 258.8, 68.5, 33, 363.3, 305.3, 81.1, 33, 662, 97.8, 37.1, 31, 712.5, 100.9, 105.8, 25, 672.5, 166, 81.1, 33, 672.5, 212.4, 49, 33, 672.5, 258.8, 41.7, 33,
  971.2, 97.8, 37.1, 31, 1021.8, 100.9, 46.7, 25, 981.8, 166, 62.3, 33, 981.8, 212.4, 33.5, 33, 981.8, 258.8, 48.3, 33, 981.8, 305.3, 53.9, 33, 43.5, 426, 37.1, 31, 94, 429.1, 68.4, 25,
  54, 494.3, 53.9, 33, 54, 540.7, 45.4, 33, 54, 587.1, 72.7, 33, 352.7, 426, 37.1, 31, 403.3, 429.1, 46, 25, 363.3, 494.3, 38.6, 33, 363.3, 540.7, 77.1, 33, 363.3, 587.1, 93, 33,
  363.3, 633.5, 54.8, 33, 662, 426, 37.1, 31, 712.5, 429.1, 104.5, 25, 672.5, 494.3, 54.8, 33, 672.5, 540.7, 67.5, 33, 672.5, 587.1, 48.8, 33, 971.2, 426, 37.1, 31, 1021.8, 429.1, 64.6, 25,
  981.8, 494.3, 68.5, 33, 981.8, 540.7, 81.1, 33, 981.8, 587.1, 49, 33, 981.8, 633.5, 41.7, 33];

// Text lines of the 12-team lab screen (1280x800) and the 6-team screen at 960x680.
const GROUPS12_TEXT = [37.2, 89, 31.6, 27, 80, 92.3, 49.4, 21, 50, 141, 68.6, 30, 50, 180.3, 82.7, 30, 50, 219.5, 48.7, 30, 346.5, 89, 31.6, 27, 389.3, 92.3, 54.4, 21, 359.3, 141, 60, 30, 359.3, 180.3, 43.4, 30,
  359.3, 219.5, 60.9, 30, 359.3, 258.8, 72.1, 30, 655.7, 89, 31.6, 27, 698.5, 92.3, 92.9, 21, 668.5, 141, 72.1, 30, 668.5, 180.3, 43.5, 30, 668.5, 219.5, 37.1, 30, 965, 89, 31.6, 27, 1007.8, 92.3, 41.1, 21,
  977.8, 141, 55.4, 30, 977.8, 180.3, 29.8, 30, 977.8, 219.5, 42.9, 30, 977.8, 258.8, 47.9, 30, 37.2, 340.1, 31.6, 27, 80, 343.4, 60.1, 21, 50, 392.1, 47.9, 30, 50, 431.3, 40.4, 30, 50, 470.6, 64.6, 30,
  346.5, 340.1, 31.6, 27, 389.3, 343.4, 40.4, 21, 359.3, 392.1, 34.3, 30, 359.3, 431.3, 68.6, 30, 359.3, 470.6, 82.7, 30, 359.3, 509.9, 48.7, 30, 655.7, 340.1, 31.6, 27, 698.5, 343.4, 91.9, 21, 668.5, 392.1, 48.7, 30,
  668.5, 431.3, 60, 30, 668.5, 470.6, 43.4, 30, 965, 340.1, 31.6, 27, 1007.8, 343.4, 56.8, 21, 977.8, 392.1, 60.9, 30, 977.8, 431.3, 72.1, 30, 977.8, 470.6, 43.5, 30, 977.8, 509.9, 37.1, 30, 37.2, 591.1, 31.6, 27,
  80, 594.5, 46.9, 21, 50, 643.1, 37.1, 30, 50, 682.4, 55.4, 30, 50, 721.7, 29.8, 30, 346.5, 591.1, 31.6, 27, 389.3, 594.5, 76.4, 21, 359.3, 643.1, 42.9, 30, 359.3, 682.4, 47.9, 30, 359.3, 721.7, 40.4, 30,
  359.3, 760.9, 64.6, 30, 655.7, 591.1, 31.6, 27, 698.5, 594.5, 67.6, 21, 668.5, 643.1, 64.6, 30, 668.5, 682.4, 34.3, 30, 668.5, 721.7, 68.6, 30, 965, 591.1, 31.6, 27, 1007.8, 594.5, 74.2, 21, 977.8, 643.1, 82.7, 30,
  977.8, 682.4, 48.7, 30, 977.8, 721.7, 60, 30, 977.8, 760.9, 43.4, 30];
const GROUPS6_960 = [24, 74, 285.7, 257.8, 329.7, 74, 285.7, 257.8, 635.3, 74, 285.7, 257.8, 24, 351.8, 285.7, 257.8, 329.7, 351.8, 285.7, 257.8, 635.3, 351.8, 285.7, 257.8];
const GROUPS6_960_TEXT = [43.5, 97.8, 37.1, 31, 94, 102.7, 47.9, 21, 54, 165, 64.3, 28, 54, 205.2, 77.5, 28, 54, 245.4, 45.7, 28, 349.1, 97.8, 37.1, 31, 399.7, 102.7, 52.7, 21, 359.7, 165, 56.3, 28,
  359.7, 205.2, 40.6, 28, 359.7, 245.4, 57.1, 28, 359.7, 285.6, 67.6, 28, 654.8, 97.8, 37.1, 31, 705.3, 102.7, 90.1, 21, 665.3, 165, 67.6, 28, 665.3, 205.2, 40.8, 28, 665.3, 245.4, 34.8, 28, 43.5, 375.5, 37.1, 31,
  94, 380.4, 39.8, 21, 54, 442.8, 51.9, 28, 54, 482.9, 27.9, 28, 54, 523.1, 40.2, 28, 54, 563.3, 45, 28, 349.1, 375.5, 37.1, 31, 399.7, 380.4, 58.3, 21, 359.7, 442.8, 45, 28, 359.7, 482.9, 37.8, 28,
  359.7, 523.1, 60.5, 28, 654.8, 375.5, 37.1, 31, 705.3, 380.4, 39.2, 21, 665.3, 442.8, 32.2, 28, 665.3, 482.9, 64.3, 28, 665.3, 523.1, 77.5, 28, 665.3, 563.3, 45.7, 28];
// The 4-team lab screen: every card has 3-4 names at the top and empty space below.
const GROUPS4_TEXT = [43.5, 97.8, 37.1, 31, 94, 100.9, 56.2, 25, 54, 166, 77.1, 33, 54, 212.4, 93, 33, 54, 258.8, 54.8, 33, 352.7, 97.8, 37.1, 31, 403.3, 100.9, 61.9, 25, 363.3, 166, 67.5, 33,
  363.3, 212.4, 48.8, 33, 363.3, 258.8, 68.5, 33, 363.3, 305.3, 81.1, 33, 662, 97.8, 37.1, 31, 712.5, 100.9, 105.8, 25, 672.5, 166, 81.1, 33, 672.5, 212.4, 49, 33, 672.5, 258.8, 41.7, 33,
  971.2, 97.8, 37.1, 31, 1021.8, 100.9, 46.7, 25, 981.8, 166, 62.3, 33, 981.8, 212.4, 33.5, 33, 981.8, 258.8, 48.3, 33, 981.8, 305.3, 53.9, 33];

// Edge cases: nothing to reveal, everything scrolled away, tiny and huge screens, a sliver at the edge.
const SYNTHETIC: [string, PqLayoutInput][] = [
  ['no covers', { width: 1280, height: 800, chromeTop: 66, chromeBottom: 732, rects: [] }],
  ['all offscreen', { width: 1280, height: 800, chromeTop: 66, chromeBottom: 732, rects: [{ left: 100, top: 900, width: 300, height: 200 }, { left: -500, top: 100, width: 300, height: 200 }] }],
  ['tiny screen', { width: 640, height: 480, rects: [{ left: 16, top: 80, width: 300, height: 260 }, { left: 324, top: 80, width: 300, height: 260 }] }],
  ['huge screen', { width: 2560, height: 1600, chromeTop: 80, chromeBottom: 1520, rects: Array.from({ length: 6 }, (_, i) => ({ left: 30 + i * 420, top: 100, width: 400, height: 1300 })) }],
  ['edge sliver', { width: 960, height: 680, chromeTop: 66, chromeBottom: 612, rects: [{ left: 300, top: 140, width: 180, height: 90 }, { left: 490, top: 140, width: 180, height: 90 }, { left: 900, top: 140, width: 180, height: 90 }] }],
  ['one small card', { width: 1280, height: 800, chromeTop: 66, chromeBottom: 732, rects: [{ left: 560, top: 200, width: 160, height: 120 }] }],
  // Measured with the card text lines the Stage reads (names, titles): the picker's name sits mid-card.
  ['picker-1280x800 with text', { width: 1280, height: 800, chromeTop: 66, chromeBottom: 732.5, rects: [{ left: 174.5, top: 212.3, width: 916, height: 380 }],
    texts: rects([553.4, 245.1, 158.3, 15, 536, 404.6, 193, 104, 558.2, 525.8, 148.6, 28]) }],
  ['groups-8x3-1280x800 with text', { ...layout(MEASURED.find(([name]) => name === 'groups-8x3-1280x800')!), texts: rects(GROUPS8_TEXT) }],
  ['groups-12x3-1280x800 with text', { ...layout(MEASURED.find(([name]) => name === 'groups-12x3-1280x800')!), texts: rects(GROUPS12_TEXT) }],
  ['groups-4x3-1280x800 with text', { ...layout(MEASURED.find(([name]) => name === 'groups-4x3-1280x800')!), texts: rects(GROUPS4_TEXT) }],
  ['groups-6x3-960x680 with text', { width: 960, height: 680, chromeTop: 66, chromeBottom: 612.5, rects: rects(GROUPS6_960), texts: rects(GROUPS6_960_TEXT) }],
  // Today 5x3 with its header row and team column (the table's th cells) passed as labels.
  ['today with labels', { ...layout(MEASURED.find(([name]) => name === 'rotations-5x3-1280x800')!), labels: [
    { left: 36, top: 70, width: 294, height: 40 }, ...[348.3, 646.5, 944.8].map((left) => ({ left: left - 18, top: 70, width: 298, height: 40 })),
    ...[123, 216, 309, 402, 495].map((top) => ({ left: 36, top: top - 14, width: 294, height: 93 })),
  ] }],
];

const CASES: [string, PqLayoutInput][] = [...MEASURED.map((row): [string, PqLayoutInput] => [row[0], layout(row)]), ...SYNTHETIC];
const PLANS = CASES.map(([name, input]): [string, PqPlan] => [name, pixelQuestPlan(input)]);
const EPS = 1e-6;
const planFor = (key: string) => PLANS.find(([name]) => name === key)![1];

void test('pixel-quest is a complete reveal effect well inside the 9.8 s cap', () => {
  assert.equal(pixelQuestEffect.id, 'pixel-quest');
  assert.equal(pixelQuestEffect.durationMs, PIXEL_QUEST_DURATION_MS);
  assert.equal(pixelQuestEffect.durationMs, 7000);
  assert.ok(pixelQuestEffect.durationMs <= 9800);
  assert.equal(pixelQuestEffect.sound, 'pixel-quest');
  assert.equal(typeof pixelQuestEffect.Stage, 'function');
  assert.equal(typeof pixelQuestEffect.Cover, 'function');
  assert.ok(pixelQuestEffect.name.length > 0 && pixelQuestEffect.description.length > 0);
});

void test('pixel-quest beat sheet: four bonks on the beat and everything gone before the end', () => {
  const T = PQ_T;
  assert.equal(T.hits.length, 4);
  for (let k = 1; k < 4; k++) assert.ok(Math.abs(T.hits[k] - T.hits[k - 1] - .72) < EPS, 'bonks are one beat apart');
  assert.ok(T.hits[0] >= T.go + .5, 'the hero needs a run-up after GO!');
  assert.ok(T.count[0] < T.count[1] && T.count[1] < T.count[2] && T.count[2] < T.go && T.go < T.goOut && T.goOut < T.hits[0] - T.rise);
  assert.ok(T.heroIn >= T.spawn && T.heroLand < T.count[1], 'the hero lands before the countdown moves on');
  assert.ok(T.hits[3] + T.chainStep * T.maxChainDepth + T.shatterDelay <= T.clear, 'the deepest chain pop shatters before LEVEL CLEAR');
  assert.ok(T.offscreenVanish + T.shatterDelay < T.collapse, 'scrolled-away cells are gone before the band falls');
  assert.ok(stripFallAt(PQ_LIMITS.strips - 1) + T.collapseFall <= T.end + EPS);
  assert.ok(skyWipeAt(PQ_LIMITS.strips - 1) <= T.end - .3 && T.uiOut + T.fadeLength <= T.end, 'the sky has wiped away well before the end');
  assert.ok(T.poof + T.poofLife <= T.end && T.fireworks.every((at) => at + T.fireworkLife <= T.end));
  assert.ok(T.end <= T.duration - .1, 'nothing remains in the last 100 ms');
  assert.ok(T.stopBy < T.grabHop && T.grabHop < T.grab && T.grab < T.floatEnd && T.floatEnd <= T.clear);
  assert.equal(captionAt(0), null);
  assert.equal(captionAt(T.count[0])?.text, '3');
  assert.equal(captionAt(T.count[1] + .01)?.text, '2');
  assert.equal(captionAt(T.count[2] + .01)?.text, '1');
  assert.equal(captionAt(T.go + .01)?.text, 'GO!');
  assert.equal(captionAt(T.hits[0]), null);
});

void test('pixel-quest geometry stays on the pixel grid and inside the screen', () => {
  for (const [name, plan] of PLANS) {
    const { P, G, B0, W } = plan;
    assert.ok(Number.isInteger(P) && P >= 4 && P <= 9, `${name}: P is a whole number of px`);
    assert.ok(Math.abs(B0 - (G - PQ_HERO.bandP * P)) < EPS, `${name}: band top sits 25P above the ground`);
    assert.ok(G <= plan.chromeBottom - PQ_HERO.groundInsetP * P + EPS, `${name}: the ground clears the footer`);
    assert.ok(B0 > plan.chromeTop, `${name}: the band starts below the header`);
    assert.equal(plan.hits.length, 4);
    plan.hits.forEach((hit, k) => {
      assert.ok(hit.x >= 6 * P - EPS && hit.x <= W - 6 * P + EPS, `${name}: hit ${k} on screen`);
      if (k) assert.ok(hit.x >= plan.hits[k - 1].x - EPS, `${name}: hits run left to right`);
      assert.ok(hit.jumpPx >= PQ_LIMITS.minJumpP * P - .5 && hit.jumpP <= PQ_LIMITS.springJumpP + EPS, `${name}: jump ${k} within reach (${hit.jumpP.toFixed(1)}P)`);
      // Only a block that keeps its full height a little way into the band is reached with a short hop.
      if (hit.jumpPx < 14 * P - .5) assert.ok(hit.edge > B0 && hit.edge <= B0 + PQ_LIMITS.bandSnapP * P + EPS, `${name}: short jump ${k} only for a band-edge block`);
      assert.equal(hit.spring, hit.jumpP > PQ_LIMITS.normalJumpP, `${name}: springs exactly for high blocks`);
    });
    assert.ok(plan.trophyX + 5 * P <= W, `${name}: trophy on screen`);
    assert.ok(plan.grabX + (PQ_CHEER_TROPHY_CENTRE_P + 5) * P <= W + EPS, `${name}: held trophy on screen at the grab`);
    assert.ok(plan.stopX <= plan.grabX, `${name}: the grab hop moves forward`);
    assert.ok(plan.hud.x >= 0 && plan.hud.y >= plan.chromeTop, `${name}: HUD below the header`);
    const { cell, bannerY } = plan.finale;
    assert.ok(cell >= 2 && (12 * 6 - 1) * cell + 8 * P <= W, `${name}: LEVEL CLEAR fits the width`);
    assert.ok(bannerY + plan.finale.plateH / 2 < plan.chromeBottom, `${name}: banner clears the footer`);
  }
});

void test('pixel-quest reveals every card: slices partition each block on tile boundaries and pop in time', () => {
  for (const [name, plan] of PLANS) {
    for (const cover of plan.covers) {
      assert.ok(cover.slices.length >= 1 && cover.slices.length <= 4, `${name}: cover ${cover.index} has 1-4 slices`);
      assert.equal(cover.slices[0].from, 0);
      assert.equal(cover.slices.at(-1)!.to, 1);
      cover.slices.forEach((slice, j) => {
        if (j) assert.equal(slice.from, cover.slices[j - 1].to, `${name}: slices are contiguous`);
        assert.ok(slice.to > slice.from, `${name}: slices are not empty`);
        assert.ok(Math.abs(slice.from * cover.cols - Math.round(slice.from * cover.cols)) < 1e-9, `${name}: cuts land on tile boundaries`);
        assert.ok(slice.at + PQ_T.shatterDelay <= PQ_T.collapse - .1, `${name}: cover ${cover.index} is gone before the collapse`);
        assert.ok(slice.hint >= slice.from * cover.width - EPS && slice.hint <= slice.to * cover.width + EPS, `${name}: gem hint inside its slice`);
      });
      if (!cover.onScreen) assert.equal(cover.slices[0].at, PQ_T.offscreenVanish, `${name}: offscreen covers vanish at the fallback time`);
      else if (!cover.visible) assert.ok(PQ_T.hits.some((at) => Math.abs(at - cover.slices[0].at) < EPS) || cover.slices[0].at === PQ_T.offscreenVanish, `${name}: hidden covers vanish on a bonk`);
      else assert.ok(cover.slices.every((slice) => slice.at + PQ_T.shatterDelay <= PQ_T.clear + EPS), `${name}: visible blocks are gone before LEVEL CLEAR`);
    }
    const visibleSlices = plan.covers.filter((c) => c.visible).reduce((sum, c) => sum + c.slices.length, 0);
    assert.equal(plan.pops.length, visibleSlices, `${name}: one gem per visible slice`);
  }
});

void test('pixel-quest chain pops climb each column bottom first, 0.12 s apart; seam bonks pop both blocks at once', () => {
  for (const [name, plan] of PLANS) {
    for (const pop of plan.pops) {
      const expected = PQ_T.hits[pop.hit] + PQ_T.chainStep * Math.min(pop.depth, PQ_T.maxChainDepth);
      assert.ok(Math.abs(pop.at - expected) < 1e-3, `${name}: pop time follows its depth`);
    }
    const visible = plan.covers.filter((c) => c.visible);
    for (const a of visible) for (const b of visible) {
      if (a === b || Math.abs(a.cx - b.cx) > 1 || a.edge <= b.edge) continue;
      assert.ok(a.slices[0].at < b.slices[0].at, `${name}: the lower block ${a.index} pops before the one above it (${b.index})`);
    }
    plan.hits.forEach((hit, k) => {
      if (hit.targets < 2) return;
      const together = plan.pops.filter((p) => p.hit === k && p.depth === 0 && Math.abs(p.at - hit.t) < EPS);
      assert.ok(together.length >= 2, `${name}: seam bonk ${k} pops both blocks together`);
    });
  }
  assert.equal(planFor('groups-4x3-1280x800').sizes, '1111');
  assert.equal(planFor('groups-1x3-1280x800').sizes, '4');
  assert.equal(planFor('groups-1x3-1280x800').covers[0].slices.length, 4, 'one big card breaks in four slices');
  assert.equal(planFor('groups-5x3-1280x800').sizes, '1112');
  assert.ok(planFor('groups-12x3-1920x1080').hits.some((hit) => hit.targets === 2), 'wide grids use seam double-bonks');
  assert.ok(planFor('groups-7x3-1280x800').hits[3].spring, 'a lone top-row card is reached with a spring');
  assert.ok(planFor('rotations-2x3-1280x800').raised, 'short Today tables raise the ground');
  assert.equal(planFor('no covers').pops.length, 0);
});

void test('pixel-quest hero: head meets each block at the bonk, lands before the next take-off, never skates or leaves the screen', () => {
  for (const [name, plan] of PLANS) {
    const { P, G, W } = plan;
    plan.hits.forEach((hit, k) => {
      const pose = heroPose(plan, hit.t);
      assert.equal(pose.frame, 'bonk', `${name}: bonk frame at contact`);
      assert.ok(Math.abs(pose.y - PQ_HERO.headP * P - hit.edge) <= .5, `${name}: head top meets the block edge at bonk ${k}`);
      assert.equal(heroX(plan, hit.t), heroX(plan, hit.t + PQ_T.hitStop), `${name}: the hit-stop freezes the hero`);
      const next = k < 3 ? plan.hits[k + 1].takeoff - (plan.hits[k + 1].spring ? .06 : 0) : PQ_T.grabHop;
      assert.ok(hit.land <= next + EPS, `${name}: bonk ${k} lands (${hit.land.toFixed(3)}) before the next take-off (${next.toFixed(3)})`);
    });
    let maxSpeed = 0;
    let lastFrame = '';
    let lastX = NaN;
    for (let i = 0; i <= 120 * PQ_T.duration; i++) {
      const t = i / 120;
      const pose = heroPose(plan, t);
      if (!pose.frame) continue;
      assert.ok(pose.y <= G + EPS, `${name}: feet never sink below the ground (t=${t.toFixed(2)})`);
      const half = 8 * P * pose.scale * pose.sx;
      assert.ok(pose.x - half >= -EPS && pose.x + half <= W + EPS, `${name}: hero on screen at t=${t.toFixed(2)}`);
      if (pose.trophy) assert.ok(pose.x + (PQ_CHEER_TROPHY_CENTRE_P + 5) * P * pose.scale <= W + P, `${name}: held trophy on screen at t=${t.toFixed(2)}`);
      if (t > PQ_T.go && t < PQ_T.grabHop) maxSpeed = Math.max(maxSpeed, Math.abs(heroX(plan, t + 1 / 120) - heroX(plan, t)) * 120 / P);
      if (pose.frame.startsWith('run') && lastFrame.startsWith('run') && Math.abs(pose.x - lastX) < EPS) assert.equal(pose.frame, lastFrame, `${name}: a standing hero does not cycle run frames`);
      lastFrame = pose.frame;
      lastX = pose.x;
    }
    assert.ok(maxSpeed <= 130, `${name}: running speed ${maxSpeed.toFixed(0)} P/s stays readable`);
    assert.equal(heroPose(plan, PQ_T.poof).frame, null, `${name}: the hero poofs away`);
    assert.equal(heroPose(plan, 0).frame, null);
    assert.equal(runFrame(plan, plan.x0 + 2 * P), runFrame(plan, plan.x0 + 2 * P + 1), 'run frame depends on distance only');
  }
});

void test('pixel-quest HUD counts every gem, monotonically, before the UI fades', () => {
  for (const [name, plan] of PLANS) {
    let last = 0;
    for (let i = 0; i <= 60 * PQ_T.duration; i++) {
      const count = hudCount(plan, i / 60);
      assert.ok(count >= last, `${name}: the counter never goes down`);
      last = count;
    }
    assert.equal(hudCount(plan, PQ_T.uiOut), plan.pops.length, `${name}: all gems land before the HUD fades`);
    assert.equal(hudCount(plan, 0), 0);
  }
});

void test('pixel-quest debris budgets, exact crumble tiling and timely exits', () => {
  for (const [name, plan] of PLANS) {
    assert.ok(plan.tiles.length <= PQ_LIMITS.maxTiles, `${name}: ${plan.tiles.length} crumble tiles`);
    assert.ok(plan.chunks.length <= PQ_LIMITS.maxChunks, `${name}: ${plan.chunks.length} chunks`);
    for (const pop of plan.pops) {
      const cover = plan.covers[pop.cover];
      const slice = cover.slices[pop.slice];
      const left = cover.left + slice.from * cover.width;
      const right = cover.left + slice.to * cover.width;
      const tiles = plan.tiles.filter((tile) => Math.abs(tile.start - (pop.at + PQ_T.shatterDelay)) < 1e-3 && tile.x >= left - .01 && tile.x + tile.w <= right + .01 && tile.y >= cover.top - .01 && tile.y + tile.h <= cover.edge + .01);
      const area = tiles.reduce((sum, tile) => sum + tile.w * tile.h, 0);
      assert.ok(Math.abs(area - (right - left) * cover.artH) < 1e-3 * Math.max(1, area), `${name}: crumble tiles cover slice ${pop.slice} of cover ${cover.index} exactly`);
      for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i];
        const b = tiles[j];
        const overlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        assert.ok(overlap < 1e-3, `${name}: crumble tiles do not overlap`);
      }
    }
    for (const tile of plan.tiles) assert.ok(tile.delay >= 0 && tile.delay <= .3 + EPS && tile.start + tile.delay + PQ_T.crumble <= PQ_T.collapse, `${name}: the crumble wave ends before the collapse`);
    for (const chunk of plan.chunks) {
      assert.ok(chunk.start + chunk.duration <= PQ_T.end, `${name}: chunks are gone by the end`);
      assert.ok(chunk.y + chunk.a + chunk.b >= plan.chromeBottom - EPS || chunk.duration >= 1 - EPS, `${name}: chunks leave behind the footer`);
    }
    for (const puff of plan.puffs) assert.ok(puff.at + .36 <= PQ_T.end);
  }
});

void test('pixel-quest planning is deterministic and never mutates its input', () => {
  for (const [, input] of CASES) {
    const copy = JSON.parse(JSON.stringify(input)) as PqLayoutInput;
    assert.deepEqual(pixelQuestPlan(input), pixelQuestPlan(input));
    assert.deepEqual(input, copy);
  }
});

void test('pixel-quest art: 16x16 hero frames, a known palette, and every caption glyph', () => {
  for (const [frame, rows] of Object.entries(PQ_HERO_FRAMES)) {
    assert.equal(rows.length, 16, `${frame}: 16 rows`);
    for (const row of rows) {
      assert.equal(row.length, 16, `${frame}: 16 columns`);
      for (const ch of row) assert.ok(ch === '.' || ch in PQ_PALETTE, `${frame}: '${ch}' is in the palette`);
    }
  }
  assert.equal(PQ_POOF_FRAMES, PQ_POOF_SETS.out);
  for (const variant of PQ_POOF_VARIANTS) PQ_POOF_SETS[variant].forEach((frame, k) => {
    assert.equal(PQ_POOF_SETS[variant].length, 4, 'the poof is four drawn frames');
    assert.equal(frame.length, PQ_POOF_GRID.h);
    assert.ok(frame.every((row) => row.length === PQ_POOF_GRID.w && row.split('').every((ch) => ch === '.' || ch in PQ_POOF_PALETTE)));
    const at = (x: number, y: number) => frame[y]?.[x] ?? '.';
    frame.forEach((row, y) => row.split('').forEach((ch, x) => {
      if (x === 0 || y === 0 || x === PQ_POOF_GRID.w - 1 || y === PQ_POOF_GRID.h - 1) assert.ok(ch === '.' || ch === 'X', `poof ${variant} frame ${k} is not clipped by its frame`);
    }));
    // Twinkles are whole: a pale centre with four gold arms each.
    const count = (ch: string) => frame.join('').split(ch).length - 1;
    assert.equal(count('Y'), 4 * count('L'), `poof ${variant} frame ${k}: every twinkle is complete`);
    if (k > 1) return;
    // The swallow and bloom frames are ONE silhouette: a single connected body with its outline only round the outside.
    const seen = new Set<string>();
    const start = frame.findIndex((row) => /[Wwl]/.test(row));
    const stack: [number, number][] = [[frame[start].search(/[Wwl]/), start]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (seen.has(`${x},${y}`) || !/[Wwl]/.test(at(x, y))) continue;
      seen.add(`${x},${y}`);
      stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
    }
    const body = frame.join('').replace(/[^Wwl]/g, '').length;
    assert.equal(seen.size, body, `poof ${variant} frame ${k} is one connected cloud`);
    // Outline only runs round the outside (a notch between two lobes is fine; a dark line or dot inside is not).
    frame.forEach((row, y) => row.split('').forEach((ch, x) => {
      const inside = (nx: number, ny: number) => /[Wwl]/.test(at(nx, ny));
      if (ch === 'X') assert.ok(!(inside(x - 1, y) && inside(x + 1, y) && inside(x, y + 1) && (inside(x, y - 1) || (inside(x - 1, y - 1) && inside(x + 1, y - 1)))), `poof ${variant} frame ${k}: outline cell ${x},${y} is on the outside`);
    }));
  });
  assert.equal(PQ_POOF_PALETTE.X, '#2B1D52', 'the poof cloud has the dark outline, so it reads on white cards');
  for (const sprite of [PQ_TROPHY, PQ_GEM, PQ_STAR, PQ_SPRING]) {
    assert.ok(sprite.every((row) => row.length === sprite[0].length));
    for (const row of sprite) for (const ch of row) assert.ok(ch === '.' || ch in PQ_PALETTE);
  }
  for (const text of [...PQ_TEXTS, '0123456789', 'x+!']) for (const ch of text) {
    const glyph = PQ_FONT[ch];
    assert.ok(glyph, `glyph '${ch}' exists`);
    assert.equal(glyph.length, 7);
    assert.ok(glyph.every((row) => row.length === 5));
  }
});

const within = (inner: PqBox, outer: PqBox, eps = .01) => inner.x >= outer.x - eps && inner.y >= outer.y - eps && inner.x + inner.w <= outer.x + outer.w + eps && inner.y + inner.h <= outer.y + outer.h + eps;

void test('pixel-quest sky windows: every on-screen card shows through the sky down to the ground, and so do table labels', () => {
  for (const [name, plan] of PLANS) {
    const { G, E } = plan;
    for (const c of plan.covers) {
      if (!c.onScreen || c.top >= G) continue;
      const want = skyWindow(c, E, G);
      if (want.h <= 1) continue;
      assert.ok(plan.holes.some((hole) => within(want, hole)), `${name}: cover ${c.index} (${c.visible ? 'block' : 'band card'}) has a window reaching the ground`);
      // The cover's edges snap to whole pixels, so the window stops a pixel inside them: no card border line shows.
      const cover = { left: Math.round(c.left), right: Math.round(c.right), bottom: Math.round(c.bottom) };
      assert.ok(want.x >= cover.left && want.x + want.w <= cover.right, `${name}: cover ${c.index} window inside the cover's sides`);
      if (c.bottom < G) {
        assert.ok(Number.isInteger(want.y + want.h) && want.y + want.h <= cover.bottom - 1, `${name}: cover ${c.index} window ends a whole pixel inside the cover`);
        assert.ok(want.y + want.h >= c.bottom - 2, `${name}: cover ${c.index} window still reaches the card's bottom`);
      } else assert.equal(want.y + want.h, G, `${name}: cover ${c.index} window reaches the ground`);
    }
    for (const label of plan.labels) {
      const top = Math.max(0, label.top);
      assert.ok(plan.holes.some((hole) => within({ x: label.left, y: top, w: label.width, h: Math.min(label.top + label.height, G) - top }, hole)), `${name}: label window`);
    }
    for (const hole of plan.holes) assert.ok(hole.y + hole.h <= G + EPS && hole.w >= 0 && hole.h > 0, `${name}: windows stay above the ground`);
  }
  assert.equal(planFor('today with labels').labels.length, 9, 'Today header row and team column get windows from the start');
  const twelve = planFor('groups-12x3-1280x800');
  const third = twelve.covers.filter((c) => c.top > twelve.B0);
  assert.equal(third.length, 4, 'the third row of 12 cards sits in the band');
  for (const c of third) assert.ok(!c.visible && c.slices[0].at + PQ_T.shatterDelay < PQ_T.clear, `groups-12 cover ${c.index}: a band card opens on its column's bonk, not at the collapse`);
});

void test('pixel-quest headroom sky holds above each block until its top row crumbles', () => {
  for (const [name, plan] of PLANS) {
    assert.equal(plan.headrooms.length, plan.pops.length, `${name}: one headroom strip per slice`);
    plan.pops.forEach((pop, i) => {
      const room = plan.headrooms[i];
      const cover = plan.covers[pop.cover];
      assert.ok(Math.abs(room.start - (pop.at + PQ_T.shatterDelay)) < 1e-3, `${name}: headroom takes over at the shatter`);
      assert.ok(Math.abs(room.y - (cover.top - plan.E)) < EPS && Math.abs(room.h - plan.E) < EPS, `${name}: headroom spans the bounce strip`);
      const topRow = plan.tiles.filter((tile) => tile.pop === i && !tile.burst && Math.abs(tile.y - cover.top) < .01);
      for (const tile of topRow) assert.ok(room.end >= tile.start + tile.delay - EPS, `${name}: headroom lasts until the top row pops`);
      assert.ok(room.end <= PQ_T.collapse && room.act === pop.hit);
    });
  }
});

void test('pixel-quest bursts: the tiles at each impact break into flying quarters within the chunk budget', () => {
  for (const [name, plan] of PLANS) {
    assert.ok(plan.chunks.length <= PQ_LIMITS.maxChunks, `${name}: ${plan.chunks.length} chunks`);
    const bursts = plan.tiles.filter((tile) => tile.burst);
    assert.equal(plan.chunks.length, bursts.length * 4, `${name}: four quarters per burst tile`);
    for (const tile of bursts) {
      const quarters = plan.chunks.filter((chunk) => chunk.x >= tile.x - .01 && chunk.x + chunk.w <= tile.x + tile.w + .01 && chunk.y >= tile.y - .01 && chunk.y + chunk.h <= tile.y + tile.h + .01 && Math.abs(chunk.start - tile.start) < 1e-3);
      assert.equal(quarters.length, 4, `${name}: a burst tile splits into 2x2 quarters`);
      assert.ok(quarters.every((chunk) => chunk.flash && Math.abs(chunk.w * 2 - tile.w) < .01 && chunk.a < 0), `${name}: quarters flash, then fly up`);
      assert.ok(tile.edgeB, `${name}: bursts come from the row nearest the impact`);
    }
    const direct = plan.pops.map((pop, i) => ({ pop, i })).filter(({ pop }) => pop.depth === 0);
    if (plan.pops.length <= PQ_LIMITS.maxChunks / 4) for (const { i } of direct) assert.ok(bursts.some((tile) => tile.pop === i), `${name}: every direct bonk bursts`);
    for (const { pop, i } of direct) {
      if (!bursts.some((tile) => tile.pop === i)) continue;
      const nearest = plan.tiles.filter((tile) => tile.pop === i && tile.edgeB).sort((a, b) => Math.abs(a.x + a.w / 2 - pop.hx) - Math.abs(b.x + b.w / 2 - pop.hx))[0];
      assert.ok(nearest.burst, `${name}: the tile at the bonk point bursts`);
    }
    for (const tile of plan.tiles) assert.ok(Math.abs(tile.rot) <= 17 && Math.abs(tile.side) <= 1, `${name}: far tiles only tilt a little as they drop`);
    assert.equal(plan.dirt.length, PQ_LIMITS.strips);
    for (const clod of plan.dirt) assert.ok(clod.start >= PQ_T.collapse && clod.start + clod.duration <= PQ_T.end + EPS && clod.a < 0, `${name}: collapse dirt kicks up and is gone by the end`);
  }
  assert.ok(planFor('groups-4x3-1280x800').tiles.filter((tile) => tile.burst).length >= 12, 'the canonical layout bursts three tiles per bonk');
});

void test('pixel-quest finale: LEVEL CLEAR keeps off card headers and labels, and its letter wave stays inside the plate', () => {
  for (const [name, plan] of PLANS) {
    const { P, G, W, H, chromeTop } = plan;
    const { bannerY, feetY, cell, bob, pad, plateW, plateH, scale } = plan.finale;
    assert.equal(feetY, bannerY - plateH / 2, `${name}: the hero stands on the plate's top edge`);
    assert.ok(Number.isInteger(feetY), `${name}: the plate top is on a whole pixel`);
    assert.ok(scale === 2 || scale === 1.5 || scale === 1);
    const plate = { x: plan.finale.plateX, y: bannerY - plateH / 2, w: plateW, h: plateH };
    // The placement weighs the plate and the hero together (a clipped line counts whole), so it may let the plate
    // touch a little header padding to keep the hero off a title: together they never cover more than the big
    // centred finale at its preferred height would.
    const chosen = finaleCover(P, plan.finale, plan.zones);
    const fallback = finaleCover(P, finaleLayout(W, H, P, G, chromeTop, plan.zones, false), plan.zones);
    assert.ok(chosen.score <= fallback.score + EPS && chosen.text <= fallback.text + EPS, `${name}: the finale never covers more card text than its default spot`);
    if (G - 2 * P - plateH / 2 >= chromeTop + P + 18 * P * scale + plateH / 2) {
      assert.ok(feetY - 18 * P * scale >= chromeTop + P - EPS, `${name}: the held trophy clears the header`);
      assert.ok(plate.y + plate.h <= G - 2 * P + EPS, `${name}: the banner sits above the ground`);
    }
    // Text top padding is pad + bob; the wave lifts glyphs by bob and their outline reaches max(2, cell/3) above.
    const border = 2 * Math.max(2, P / 2);
    assert.ok(pad - Math.max(2, Math.round(cell / 3)) >= border - EPS, `${name}: the letter wave stays inside the plate border`);
    assert.ok(plateH >= 7 * cell + 2 * pad + bob, `${name}: the plate holds the text and its padding`);
    assert.ok(bob <= cell / 3 + .5);
  }
  const small = planFor('groups-4x3-960x680');
  const { bannerY, plateX, plateW, plateH } = small.finale;
  const owls = small.zones[3];
  assert.equal(overlapArea({ x: plateX, y: bannerY - plateH / 2, w: plateW, h: plateH }, owls), 0, 'at 960 the banner no longer sits on the Owls header');
  assert.equal(planFor('groups-4x3-1280x800').finale.bannerY, Math.round(finaleFeetY(800, 6) + 12 * 6), 'the canonical layout keeps the centred banner');
  for (const [name, plan] of PLANS) {
    const { P, W } = plan;
    const { x, plateX, plateW, scale } = plan.finale;
    const s = P * scale;
    assert.ok(x - 8 * s >= -EPS && x + 15.5 * s <= W + EPS, `${name}: the finale hero and trophy stay on screen`);
    if (plateW - 22 * s >= 0) assert.ok(x - 7 * s >= plateX - EPS && x + 15 * s <= plateX + plateW + EPS, `${name}: the hero stands on the banner`);
  }
  // The picked student's name stays readable through the whole finale: neither the plate nor the 2x hero covers it.
  const picker = planFor('picker-1280x800 with text');
  const nameBox = { x: 536, y: 404.6, w: 193, h: 104 };
  const pickerPlate = { x: picker.finale.plateX, y: picker.finale.bannerY - picker.finale.plateH / 2, w: picker.finale.plateW, h: picker.finale.plateH };
  assert.equal(overlapArea(pickerPlate, nameBox), 0, 'LEVEL CLEAR is off the picked name');
  assert.equal(overlapArea(finaleHeroBox(picker.P, picker.finale.x, picker.finale.feetY, picker.finale.scale), nameBox), 0, 'the hero is off the picked name');
  assert.equal(heroX(picker, PQ_T.floatEnd), picker.finale.x, 'the lift ends where the finale placed the hero');
  const eight = planFor('groups-8x3-1280x800 with text');
  const eightPlate = { x: eight.finale.plateX, y: eight.finale.bannerY - eight.finale.plateH / 2, w: eight.finale.plateW, h: eight.finale.plateH };
  const covered = (box: PqBox) => rects(GROUPS8_TEXT).reduce((sum, r) => sum + overlapArea(box, { x: r.left, y: r.top, w: r.width, h: r.height }), 0);
  assert.ok(covered(eightPlate) <= .5 * covered({ ...eightPlate, y: finaleFeetY(800, 6) + 12 * 6 - eight.finale.plateH / 2 }), '8 teams: the banner covers at most half the text it would at 0.40H');
  // On Today the team column runs almost down to the ground: the banner drops below the table, off nearly all of it.
  const today = planFor('today with labels');
  const labelOverlap = (y: number, x = today.W / 2 - today.finale.plateW / 2) => today.labels.reduce((sum, label) => sum + overlapArea({ x, y: y - today.finale.plateH / 2, w: today.finale.plateW, h: today.finale.plateH }, { x: label.left, y: label.top, w: label.width, h: label.height }), 0);
  assert.ok(labelOverlap(today.finale.bannerY, today.finale.plateX) <= .2 * labelOverlap(Math.min(finaleFeetY(today.H, today.P), today.G - 6 * today.P) + 12 * today.P), 'Today team names stay readable in the finale');
});

void test('pixel-quest HUD leaves after the last gem when it would hide a card title', () => {
  for (const [name, plan] of PLANS) {
    const last = Math.max(0, ...plan.pops.map((pop) => pop.at + PQ_T.gemRise + PQ_T.gemFly));
    assert.ok(plan.hudOut <= PQ_T.uiOut + EPS && plan.hudOut >= PQ_T.hudOutMin - EPS, `${name}: HUD exit in range`);
    assert.ok(plan.hudOut >= Math.min(PQ_T.uiOut, last + PQ_T.hudHold) - EPS, `${name}: every gem is counted (and seen) before the HUD leaves`);
    assert.equal(hudCount(plan, plan.hudOut), plan.pops.length);
    const hides = plan.zones.some((zone) => overlapArea({ x: plan.hud.x, y: plan.hud.y, w: plan.hud.w, h: plan.hud.h }, zone) > 0);
    if (!hides) assert.equal(plan.hudOut, PQ_T.uiOut, `${name}: a HUD over plain sky stays for the finale`);
  }
  assert.ok(planFor('groups-4x3-960x680').hudOut < PQ_T.clear, 'at 960 the HUD is off the Hedgehogs title before LEVEL CLEAR');
});

void test('pixel-quest acts mount lazily, well before anything in them starts', () => {
  assert.equal(PQ_ACTS.length, 7);
  for (let k = 1; k < PQ_ACTS.length; k++) assert.ok(PQ_ACTS[k] > PQ_ACTS[k - 1], 'acts mount one after another, never in the same frame');
  assert.equal(pqActAt(0), 0);
  assert.equal(pqActAt(PQ_T.duration), PQ_ACTS.length);
  assert.ok(PQ_T.finaleSearch >= PQ_T.count[1] + .12 && PQ_T.finaleSearch <= PQ_T.count[2] - .15 && PQ_T.finaleSearch < PQ_ACTS[PQ_FINALE_ACTS.banner],
    'the finale search runs while the bunny stands still between the 2 and the 1, long before the finale mounts');
  PQ_T.hits.forEach((at, k) => assert.ok(PQ_ACTS[k] <= at - .3 && PQ_ACTS[k] >= PQ_T.go, 'bonk debris mounts after GO! and 0.3 s ahead'));
  assert.ok(PQ_ACTS[PQ_FINALE_ACTS.banner] <= PQ_T.grab - .3 && PQ_ACTS[PQ_FINALE_ACTS.banner] <= PQ_T.clear - .3, 'the grab ring and banner mount ahead');
  assert.ok(PQ_ACTS[PQ_FINALE_ACTS.fireworks] <= PQ_T.fireworks[0] - .2 - .3, 'the fireworks mount before the first rocket climbs');
  assert.ok(PQ_ACTS[PQ_FINALE_ACTS.poof] <= PQ_T.poof - .3 && PQ_ACTS[PQ_FINALE_ACTS.poof] > PQ_T.fireworks[2] - .2, 'the poof mounts after the last rocket, well before the poof');
  for (const [name, plan] of PLANS) {
    const lead = (act: number, at: number) => assert.ok(act >= 0 && PQ_ACTS[act] <= at - .3 + EPS, `${name}: act ${act} is mounted before ${at}`);
    plan.pops.forEach((pop) => lead(pop.hit, pop.at));
    plan.tiles.forEach((tile) => lead(plan.pops[tile.pop].hit, tile.start));
    plan.chunks.forEach((chunk) => lead(chunk.act, chunk.start));
    plan.headrooms.forEach((room) => lead(room.act, room.start));
    plan.dirt.forEach((clod) => lead(clod.act, clod.start));
    plan.puffs.forEach((puff) => { if (puff.act >= 0) lead(puff.act, puff.at); else assert.ok(puff.at < PQ_ACTS[0], `${name}: opening dust is mounted from the start`); });
    plan.hits.forEach((hit, k) => lead(k, hit.t));
  }
});

void test('pixel-quest poof has anticipation: squash, stretch-hop, then gone on the sound', () => {
  for (const [name, plan] of PLANS) {
    const hold = heroPose(plan, PQ_T.poofWindup - .01);
    const squash = heroPose(plan, PQ_T.poofWindup + .01);
    const stretch = heroPose(plan, PQ_T.poofHop + .04);
    assert.ok(squash.sy < 1 && squash.sx > 1 && squash.frame === 'cheerJoy', `${name}: squash before the poof`);
    assert.ok(stretch.sy > 1 && stretch.sx < 1 && stretch.y < squash.y, `${name}: stretch into a hop`);
    assert.equal(squash.y, plan.finale.feetY, `${name}: the squash lands on the banner (no bob)`);
    assert.equal(hold.scale, plan.finale.scale);
    assert.equal(heroPose(plan, PQ_T.poof).frame, null, `${name}: vanish exactly on the poof cue`);
  }
});

void test('pixel-quest a card that ends just inside the band keeps a full height of blocks', () => {
  for (const [name, plan] of PLANS) {
    for (const c of plan.covers) {
      if (!c.visible) continue;
      const snaps = c.bottom > plan.B0 && c.bottom - plan.B0 <= PQ_LIMITS.bandSnapP * plan.P && plan.headRest - c.bottom >= PQ_LIMITS.minJumpP * plan.P;
      assert.equal(c.edge, snaps ? c.bottom : Math.min(c.bottom, plan.B0), `${name}: cover ${c.index} block edge`);
    }
  }
  const today = planFor('rotations-5x3-1280x800');
  const turtles = today.covers.filter((c) => c.top > 490);
  assert.equal(turtles.length, 3);
  for (const c of turtles) assert.ok(c.edge === c.bottom && Math.abs(c.tileH - today.covers[0].tileH) < 1, 'the last Today row has blocks as tall as the other rows');
  const twelve = planFor('groups-12x3-1280x800');
  for (const c of twelve.covers.filter((cover) => cover.top > 300 && cover.top < 400)) assert.equal(c.edge, c.bottom, 'the second row of 12 cards keeps its whole block');
  for (const [name, plan] of PLANS) plan.hits.forEach((hit, k) => {
    const pose = heroPose(plan, hit.t);
    assert.ok(Math.abs(pose.y - PQ_HERO.headP * plan.P - hit.edge) <= .5, `${name}: the shorter hop still meets the block at bonk ${k}`);
  });
});

void test('pixel-quest finale: crowded screens get a smaller hero and banner that keep every title readable', () => {
  const titles = (key: string) => { const plan = planFor(key); return finaleCover(plan.P, plan.finale, plan.zones).titles; };
  for (const key of ['groups-8x3-1280x800 with text', 'groups-12x3-1280x800 with text', 'groups-6x3-960x680 with text', 'groups-4x3-1280x800 with text']) {
    assert.ok(titles(key) < 100, `${key}: no card title under the finale (${titles(key).toFixed(0)} px2)`);
  }
  assert.equal(planFor('groups-4x3-1280x800 with text').finale.scale, 2, 'roomy cards keep the big 2x finale');
  assert.equal(planFor('picker-1280x800 with text').finale.scale, 2, 'the picker keeps the big 2x finale');
  const eight = planFor('groups-8x3-1280x800 with text');
  assert.equal(eight.finale.scale, 1.5, '8 teams: the hero stops at 1.5x');
  for (const [name, plan] of PLANS) {
    // Every size choice is one of the listed ones, and a smaller one only when it covers clearly less text.
    const size = PQ_FINALE_SIZES.findIndex((option) => option.scale === plan.finale.scale && Math.min(Math.round(option.cellP * plan.P), Math.floor(.86 * plan.W / 71)) === plan.finale.cell);
    assert.ok(size >= 0, `${name}: a listed finale size`);
    const shape = finaleHeroShape(plan.P, plan.finale.x, plan.finale.feetY, plan.finale.scale);
    const box = finaleHeroBox(plan.P, plan.finale.x, plan.finale.feetY, plan.finale.scale);
    for (const part of shape) assert.ok(part.x >= box.x - EPS && part.y >= box.y - EPS && part.x + part.w <= box.x + box.w + EPS && part.y + part.h <= box.y + box.h + EPS, `${name}: hero shape inside its box`);
  }
  // Standing on the plate: the cheer bob only hops up, never sinks into it.
  for (const [name, plan] of PLANS) {
    for (let t = PQ_T.floatEnd; t < PQ_T.poof; t += 1 / 120) assert.ok(heroPose(plan, t).y <= plan.finale.feetY + EPS, `${name}: feet on or above the plate at t=${t.toFixed(2)}`);
    assert.equal(heroPose(plan, PQ_T.floatEnd).y, plan.finale.feetY, `${name}: the lift ends standing on the plate`);
  }
});

void test('pixel-quest fireworks burst where they cover the least card text', () => {
  const defaults = [[.2, .24], [.8, .2], [.5, .16]];
  for (const [name, plan] of PLANS) {
    const { P, W } = plan;
    assert.equal(plan.fireworks.length, 3);
    plan.fireworks.forEach((spot, i) => {
      const box = fireworkBox(P, spot.x, spot.y, spot.scale);
      assert.ok(box.x >= -EPS && box.x + box.w <= W + EPS && box.y >= plan.chromeTop - EPS, `${name}: firework ${i} on screen below the header`);
      assert.ok(spot.climb >= 0 && spot.climb <= 24 * P);
      const text = (b: PqBox) => plan.zones.reduce((sum, zone) => sum + zone.weight * overlapArea(b, zone), 0);
      const home = defaults[i];
      const r = 17 * P;
      const homeBox = fireworkBox(P, Math.min(Math.max(home[0] * W, r), W - r), Math.min(Math.max(home[1] * plan.H, plan.chromeTop + r + P), Math.max(plan.chromeTop + r + P, plan.B0 - r - 6 * P)));
      // Weighted as the search weighs it: card text, plus half the banner, hero and a staying HUD.
      const plate = { x: plan.finale.plateX, y: plan.finale.bannerY - plan.finale.plateH / 2, w: plan.finale.plateW, h: plan.finale.plateH };
      const avoid = [plate, ...finaleHeroShape(P, plan.finale.x, plan.finale.feetY, plan.finale.scale), ...(plan.hudOut >= PQ_T.uiOut ? [plan.hud] : [])];
      const weighed = (b: PqBox) => text(b) + .5 * avoid.reduce((sum, other) => sum + overlapArea(b, other), 0);
      assert.ok(weighed(box) <= weighed(homeBox) + EPS, `${name}: firework ${i} covers no more than its default spot`);
    });
    assert.ok(plan.fireworks[0].x < plan.fireworks[2].x && plan.fireworks[2].x < plan.fireworks[1].x, `${name}: left, right, then middle`);
  }
});

void test('pixel-quest sound sync: the pre-mixed chiptune is timed to these exact beats', () => {
  // The recipe (stems from scripts/authored-sounds/pixel-quest.py) places a sound on each of these times; moving a
  // beat means re-timing the track. Blings follow each bonk every chainStep, crumbles land shatterDelay after it, and
  // each firework stem starts with its rocket 0.2 s before the burst.
  assert.deepEqual([PQ_T.spawn, PQ_T.heroLand, ...PQ_T.count, PQ_T.go], [.2, .34, .3, .65, 1, 1.32]);
  assert.deepEqual([...PQ_T.hits], [1.92, 2.64, 3.36, 4.08]);
  assert.deepEqual([PQ_T.chainStep, PQ_T.shatterDelay], [.12, .18]);
  assert.deepEqual([PQ_T.grab, PQ_T.clear, ...PQ_T.fireworks, PQ_T.rocket, PQ_T.wink], [4.8, 5.3, 5.36, 5.6, 5.84, .2, 5.8]);
  assert.deepEqual([PQ_T.poofWindup, PQ_T.poofHop, PQ_T.poof, PQ_T.collapse], [6, 6.04, 6.1, 6.14]);
  // LEVEL CLEAR plays a note on each cheer hop (5.42, 5.66, 5.90): the hero stands on the plate just before and is up just after.
  for (const [name, plan] of PLANS) {
    for (const hop of [5.42, 5.66, 5.9]) {
      assert.ok(Math.abs(heroPose(plan, hop - .01).y - plan.finale.feetY) < EPS, `${name}: on the plate before the ${hop} s note`);
      assert.ok(heroPose(plan, hop + .01).y < plan.finale.feetY - EPS, `${name}: hops on the ${hop} s note`);
    }
  }
});

/** Text lines of a layout as boxes (the letters themselves). */
const textBoxes = (input: PqLayoutInput) => (input.texts ?? []).map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }));

void test('pixel-quest scenery: hills and bushes never stand over a name, so a bottom-row name reads from its bonk', () => {
  for (const [name, input] of CASES) {
    const plan = pixelQuestPlan(input);
    const { P, G } = plan;
    const { hills, bushes } = pqScenery(plan);
    // Every line of card text above the ground strip: nothing of the scenery may touch it (a pixel of art clear on each side).
    const lines = (input.texts ? textBoxes(input) : plan.zones).filter((box) => box.y < G);
    for (const hill of hills) {
      assert.ok(hill.h >= PQ_HILL_MIN_P * P - EPS && hill.h <= 13 * P + EPS, `${name}: hills keep a shape`);
      for (const line of lines) assert.equal(overlapArea({ x: hill.x - P, y: G - hill.h - P, w: hill.w + 2 * P, h: hill.h + P }, { ...line, h: Math.min(line.h, G - line.y) }), 0, `${name}: a hill at ${hill.x.toFixed(0)} stands over a name`);
    }
    for (const bush of bushes) for (const line of lines) assert.equal(overlapArea({ x: bush.x - P, y: G - 5 * P, w: bush.w + 2 * P, h: 5 * P }, { ...line, h: Math.min(line.h, G - line.y) }), 0, `${name}: a bush stands over a name`);
  }
  // The 8-team screen's bottom row ends its name lists just above the grass: they read at once, and the level keeps hills.
  const eight = planFor('groups-8x3-1280x800 with text');
  const { hills } = pqScenery(eight);
  for (const line of textBoxes(CASES.find(([name]) => name === 'groups-8x3-1280x800 with text')![1]).filter((box) => box.y > 600)) {
    for (const hill of hills) assert.equal(overlapArea({ x: hill.x, y: eight.G - hill.h, w: hill.w, h: hill.h }, line), 0, 'a bottom-row name is not behind a hill');
  }
  assert.ok(hills.length >= 3, 'the 8-team level still has hills');
  assert.ok(pqScenery(planFor('groups-4x3-1280x800')).hills.length >= 5, 'a roomy level keeps all its hills');
});

/** A poof's painted boxes per frame, in px. */
const poofBoxes = (poof: PqPoof) => PQ_POOF_SETS[poof.variant].map((rows) => poofFootprint(rows).map((run) => ({ x: poof.x + run.x * poof.cell, y: poof.y + run.y * poof.cell, w: run.w * poof.cell, h: poof.cell })));
const textUnder = (boxes: PqBox[], lines: PqBox[]) => lines.reduce((sum, line) => sum + boxes.reduce((a, box) => a + overlapArea(box, line), 0), 0);

void test('pixel-quest poof: it swallows the hero, then flies apart only where no names are', () => {
  // The "in" set stays inside the bloom's outline: it is what crowded screens fall back on.
  const bloom = poofFootprint(PQ_POOF_SETS.in[1]);
  const bounds = { x: Math.min(...bloom.map((r) => r.x)), y: Math.min(...bloom.map((r) => r.y)), r: Math.max(...bloom.map((r) => r.x + r.w)), b: Math.max(...bloom.map((r) => r.y + r.h)) };
  for (const frame of [2, 3]) for (const run of poofFootprint(PQ_POOF_SETS.in[frame])) {
    assert.ok(run.x >= bounds.x && run.x + run.w <= bounds.r && run.y >= bounds.y && run.y + run.h <= bounds.b, `the "in" poof frame ${frame} stays inside the bloom`);
  }
  for (const [name, input] of CASES) {
    const plan = pixelQuestPlan(input);
    const { poof, finale, P } = plan;
    const s = Math.floor(P * finale.scale);
    assert.ok(Math.abs(poof.x - (finale.x + 4 * s)) <= 2 * poof.cell + EPS && poof.y <= finale.feetY - 4 * P - 9 * s + EPS && poof.y >= finale.feetY - 4 * P - 9 * s - 2 * poof.cell - EPS, `${name}: the poof sits on the hero`);
    // The swallow frame covers the hero's head and body (the cloud it turns into).
    const swallow = poofBoxes(poof)[0];
    const head = { x: finale.x - 5 * s, y: finale.feetY - 4 * P - 12 * s, w: 10 * s, h: 8 * s };
    assert.ok(textUnder(swallow, [head]) >= .9 * head.w * head.h, `${name}: the cloud swallows the hero`);
    assert.ok(overlapArea(poofBloomBox(poof), poofBloomBox(poof)) > 0);
    if (!input.texts) continue;
    // Against the old poof (the same cloud always bursting out to both sides from the hero's centre), it covers less.
    const lines = textBoxes(input);
    const chosen = poofBoxes(poof).reduce((sum, boxes) => sum + textUnder(boxes, lines), 0);
    const old = poofBoxes({ ...poof, x: finale.x + 4 * s, y: finale.feetY - 4 * P - 9 * s, variant: 'out' }).reduce((sum, boxes) => sum + textUnder(boxes, lines), 0);
    assert.ok(chosen <= old + EPS, `${name}: the poof covers no more names than a plain burst (${chosen.toFixed(0)} vs ${old.toFixed(0)} px2)`);
    assert.ok(chosen <= 1200, `${name}: the poof only grazes names (${chosen.toFixed(0)} px2 over its 0.32 s)`);
  }
  assert.ok(PQ_POOF_VARIANTS.indexOf('in') === PQ_POOF_VARIANTS.length - 1, 'the contained poof is the last resort');
  assert.notEqual(planFor('picker-1280x800 with text').poof.variant, 'in', 'an open screen gets a real burst');
});

void test('pixel-quest acts mount in slices, one per frame, and every slice is mounted well before its first beat', () => {
  // Slices partition an act's pieces.
  const items = Array.from({ length: 23 }, (_, i) => i);
  const parts = Array.from({ length: PQ_ACT_SLICES }, (_, k) => pqActSlice(items, k));
  assert.deepEqual(parts.flat().sort((a, b) => a - b), items);
  assert.ok(parts.every((part) => Math.abs(part.length - items.length / PQ_ACT_SLICES) <= 1), 'an even share each');
  // Frozen frames mount everything due at once; live playback one slice per frame, catching up after a stall.
  assert.equal(pqSlicesAt(PQ_T.duration, 0, true), PQ_ACTS.length * PQ_ACT_SLICES);
  assert.equal(pqSlicesAt(PQ_ACTS[0], 0), 1);
  assert.equal(pqSlicesAt(PQ_ACTS[1], 0), PQ_ACT_SLICES + 1, 'a stall never leaves more than one act waiting');
  assert.equal(pqSlicesAt(PQ_ACTS[0] - .01, 0), 0);
  for (const fps of [60, 30, 20]) {
    const mountedAt: number[] = [];
    for (let t = 0, mounted = 0; t <= PQ_T.duration; t += 1 / fps) {
      const next = pqSlicesAt(t, mounted);
      for (let i = mounted; i < next; i++) mountedAt[i] = t;
      mounted = next;
    }
    assert.equal(mountedAt.length, PQ_ACTS.length * PQ_ACT_SLICES);
    PQ_ACTS.forEach((at, act) => {
      for (let slice = 0; slice < PQ_ACT_SLICES; slice++) assert.ok(mountedAt[act * PQ_ACT_SLICES + slice] <= at + (PQ_ACT_SLICES - 1) / fps + 1 / fps + EPS, `act ${act} slice ${slice} mounts within a few frames at ${fps} fps`);
    });
    // Bonk debris is first needed at its bonk; the finale parts at the grab, the first rocket and the poof.
    const firstBeat = [...PQ_T.hits, PQ_T.grab, PQ_T.fireworks[0] - PQ_T.rocket, PQ_T.poof];
    PQ_ACTS.forEach((_, act) => assert.ok(mountedAt[act * PQ_ACT_SLICES + PQ_ACT_SLICES - 1] <= firstBeat[act] - .2, `act ${act} is fully mounted 0.2 s ahead at ${fps} fps`));
  }
});

void test('pixel-quest sky wipes away column by column as the ground falls, never as a see-through fade', () => {
  for (let i = 0; i < PQ_LIMITS.strips; i++) {
    assert.ok(skyWipeAt(i) >= stripFallAt(i) && skyWipeAt(i) <= stripFallAt(i) + .1, `sky column ${i} leaves with its ground strip`);
    if (i) assert.ok(skyWipeAt(i) > skyWipeAt(i - 1), 'left to right');
  }
  assert.ok(skyWipeAt(0) > PQ_T.poof, 'the sky stays for the poof');
  assert.ok(skyWipeAt(PQ_LIMITS.strips - 1) + 1 / 60 <= PQ_T.end, 'the last column is gone before the end');
});

void test('pixel-quest CSS: every exit is a pop, a move or a shrink (never a see-through fade), and it stays Safari-safe', () => {
  const css = readFileSync('src/revealEffects/pixelQuest.css', 'utf8');
  const tsx = readFileSync('src/revealEffects/pixelQuest.tsx', 'utf8');
  // Opacity inside keyframes is only ever fully on or fully off.
  for (const block of css.match(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g) ?? []) {
    for (const [, value] of block.matchAll(/opacity:\s*([\d.]+)/g)) assert.ok(value === '0' || value === '1', `${block.slice(0, 40)}: opacity ${value}`);
  }
  // The only translucent art is the hero's ground shadow, which never animates its opacity.
  const translucent = [...css.matchAll(/([^{}]+)\{[^{}]*opacity:\s*(0?\.\d+)/g)].map(([, selector]) => selector.trim());
  assert.deepEqual(translucent, ['.pq-shadow']);
  assert.ok(!/@property|offset-path|view-transition|&\s*[.:[]/.test(css), 'no @property, offset-path, view transitions or nesting');
  // The level's images reach the strips through the CSSOM (custom properties), never an inline <style> a CSP could block.
  assert.ok(!/<style/.test(tsx), 'no inline style element');
  assert.match(css, /\.pq-sky \{[^}]*background-image: var\(--pq-sky-img\)/);
  assert.match(css, /\.pq-strip \{ background-image: var\(--pq-ground-img\)/);
});
