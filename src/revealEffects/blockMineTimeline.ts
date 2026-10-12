import { seededRandom } from './sceneMotion';

/**
 * Block mine choreography (storyboard: work/design/block-mine.md).
 *
 * Pure numbers only: no CSS or React imports, so tests can pin the contracts.
 * Every sound-bearing event happens at a FIXED time (the reveal ships one
 * pre-mixed WAV). Only positions adapt to the layout: cards are grouped into
 * four left-to-right "swing slots"; each slot is three pickaxe ticks and one
 * smash. A card whose column has no slot of its own is chipped (one corner
 * block pops) on the earlier slots and smashed on its own.
 */

export const BLOCK_MINE_DURATION_MS = 7900;
export const BLOCK_MINE_DURATION_S = BLOCK_MINE_DURATION_MS / 1000;

/* ------------------------------ beats ------------------------------ */

export const SLOT_COUNT = 4;
/** Slot k starts at FIRST_SLOT_S + k * SLOT_PERIOD_S. */
export const FIRST_SLOT_S = .55;
export const SLOT_PERIOD_S = .9;
/** Inside a slot: hop to the card, tik, tik, tik, big wind-up, SMASH, follow-through. */
export const TRAVEL_S = .14;
export const TICK_OFFSETS_S = [.2, .36, .52] as const;
export const WINDUP_OFFSET_S = .56;
export const SMASH_OFFSET_S = .76;
/** The pickaxe swing keyframes run from the end of the hop to the end of the slot. */
export const SWING_LENGTH_S = SLOT_PERIOD_S - TRAVEL_S;
/** The first pickaxe spins up out of its hotbar tool slot to the first card before slot 0. */
export const PICK_ENTER_S = .12;
/** After the last smash the pickaxe flips up and spins home into its tool slot. */
export const PICK_EXIT_DELAY_S = .12;
export const PICK_EXIT_S = .36;

export const slotStart = (slot: number) => FIRST_SLOT_S + slot * SLOT_PERIOD_S;
export const tickTime = (slot: number, tick: number) => slotStart(slot) + TICK_OFFSETS_S[tick];
export const smashTime = (slot: number) => slotStart(slot) + SMASH_OFFSET_S;
export const LAST_SMASH_S = smashTime(SLOT_COUNT - 1);

/** Hotbar rises from behind the footer at the start (ease-out-back). */
export const HOTBAR_RISE_S = [.04, .46] as const;

/**
 * Mini cubes: pop out (arc), hover and bob, then zip into the hotbar. The
 * first ones land 0.58 s after their smash: in the quiet between the next
 * card's second and third tick, never on top of its SMASH.
 */
export const CUBE_POP_S = .22;
export const CUBE_HOVER_S = .16;
export const CUBE_ZIP_S = .2;
export const CUBE_FLIGHT_S = CUBE_POP_S + CUBE_HOVER_S + CUBE_ZIP_S;
export const CUBE_STAGGER_S = .04;
/** Upper bound on cubes in flight over the whole reveal (SLOT_COUNT * SLOT_CUBES block cubes plus the gem). */
export const MAX_CUBES = 18;
/**
 * The rare gem gets a hero moment: it pops straight up above its block
 * (while the pickaxe flies home underneath), drifts to its hero point,
 * hangs there big with a sunburst, then dives into its hotbar slot.
 */
export const GEM_POP_S = .36;
export const GEM_DRIFT_S = .24;
export const GEM_HOLD_S = .45;
export const GEM_ZIP_S = .3;
export const GEM_FLIGHT_S = GEM_POP_S + GEM_DRIFT_S + GEM_HOLD_S + GEM_ZIP_S;
/** The gem lands in the hotbar just after the build begins; the hotbar shines as it does. */
export const GEM_ARRIVE_S = LAST_SMASH_S + GEM_FLIGHT_S;
export const HOTBAR_SHINE_S = GEM_ARRIVE_S + .04;
/** Past this many visible blocks, only the smashed and chipped blocks throw debris (fewer layers). */
export const DEBRIS_BLOCK_BUDGET = 80;
/** Each hotbar count stays at or below this, so no counter ever runs 5, 6, 7. */
export const MAX_PER_KIND = 5;
/** Block cubes per swing slot (the gem comes on top), so every slot's smash sends something home. */
export const SLOT_CUBES = 4;

/**
 * Share each kind's budget of five between the swing slots that can mine it
 * (the later slots get any remainder: the finale smashes stay juicy). The
 * gem is one cube in its own slot.
 */
export function cubeQuotas(events: readonly { slot: number; kinds: readonly Kind[] }[]): Record<Kind, number>[] {
  const quota = Array.from({ length: SLOT_COUNT }, (): Record<Kind, number> => ({ earth: 0, wood: 0, stone: 0, gem: 0 }));
  for (const kind of HOTBAR_KINDS) {
    const slots = [...new Set(events.filter((event) => event.kinds.includes(kind)).map((event) => event.slot))].sort((a, b) => a - b);
    if (!slots.length) continue;
    if (kind === 'gem') { quota[slots[slots.length - 1]].gem = 1; continue; }
    const base = Math.floor(MAX_PER_KIND / slots.length);
    const remainder = MAX_PER_KIND - base * slots.length;
    slots.forEach((slot, i) => { quota[slot][kind] = base + (i >= slots.length - remainder ? 1 : 0); });
  }
  return quota;
}

/** Finale: the collected blocks hop out of the hotbar and build a little house, one row per beat. */
export const BUILD_START_S = 5.2;
export const BUILD_FLIGHT_S = .26;
/** Rows land on a steady beat; blocks inside a row ripple left to right. */
export const BUILD_ROW_S = .2;
export const BUILD_STEP_S = .04;
/** The finished house glows (windows light up) a beat after the gem crowns it. */
export const LIGHTS_ON_DELAY_S = .18;
export const EXIT_START_S = 7.2;
export const EXIT_END_S = 7.7;
/** Hearts float up off the crown for this long, and pop away before the cottage has sunk. */
export const HEART_S = .82;
/** How far the hearts rise (px): this much where there is room, at least the smaller. */
export const HEART_RISE_MAX = 118;
export const HEART_RISE_MIN = 40;

/* ---------------------------- materials ---------------------------- */

export type Material = 'grass' | 'dirt' | 'stone' | 'ore' | 'planks' | 'gem';
export type HouseMaterial = Material | 'door' | 'doorTop' | 'window';
export type Kind = 'earth' | 'wood' | 'stone' | 'gem';
export const HOTBAR_KINDS: readonly Kind[] = ['earth', 'wood', 'stone', 'gem'];
export const kindOf = (material: HouseMaterial): Kind =>
  material === 'grass' || material === 'dirt' ? 'earth' : material === 'planks' || material === 'door' || material === 'doorTop' || material === 'window' ? 'wood' : material === 'gem' ? 'gem' : 'stone';

/** 'mine' is a meadow chunk with a plank support beam down its right side; 'mixed' is that plus the gem. */
export type Theme = 'meadow' | 'mine' | 'wood' | 'quarry' | 'gem' | 'mixed';

/* ------------------------------ layout ------------------------------ */

export type Rect = { left: number; top: number; width: number; height: number };
/** `headerBottom`: the app header draws above the stage down to here (default HEADER_BOTTOM). */
export type Viewport = { width: number; height: number; footerTop: number; headerBottom?: number };
export const HEADER_BOTTOM = 70;
const headerOf = (viewport: Viewport) => viewport.headerBottom ?? HEADER_BOTTOM;
/** A measured text box and when it is uncovered (0: on screen all along). */
export type TimedRect = Rect & { revealAt?: number };

/** A card becomes one chunk of blocks, seen from the front with its top and right faces showing. */
export type Wall = { inset: number; cols: number; rows: number; blockWidth: number; blockHeight: number; depth: number };

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
/** Oblique depth of the top and right faces, as a share of the block size. */
export const DEPTH_RATIO = .28;
/** Blocks pop in a ripple from the smashed block: this much later per grid step. */
export const RIPPLE_STEP_S = .035;
export const RIPPLE_MAX_S = .16;
/** A block's pop (bm-break, .26 s) and its debris (.42 s) are over this long after it breaks. */
export const CHUNK_LINGER_S = .47;
export const round2 = (value: number) => Math.round(value * 100) / 100;

/** Choose a block grid that fills the card with nearly square blocks. */
export function wallFor(width: number, height: number): Wall {
  const inset = clamp(Math.round(Math.min(width, height) * .03), 3, 8);
  const innerWidth = Math.max(8, width - inset * 2);
  const innerHeight = Math.max(8, height - inset * 2);
  const target = clamp(Math.min(innerWidth, innerHeight) * .8, 34, 136);
  let best: Wall & { score: number } | null = null;
  for (let cols = 1; cols <= 14; cols++) {
    for (let rows = 1; rows <= 14; rows++) {
      let depth = Math.round(target * DEPTH_RATIO);
      for (let pass = 0; pass < 3; pass++) depth = Math.round(Math.min((innerWidth - depth) / cols, (innerHeight - depth) / rows) * DEPTH_RATIO);
      const blockWidth = (innerWidth - depth) / cols;
      const blockHeight = (innerHeight - depth) / rows;
      if (blockWidth < 12 || blockHeight < 12) continue;
      const score = Math.abs(Math.log(blockWidth / blockHeight)) * 2.2 + Math.abs(Math.log(Math.sqrt(blockWidth * blockHeight) / target));
      if (!best || score < best.score) best = { inset, cols, rows, blockWidth, blockHeight, depth, score };
    }
  }
  if (!best) return { inset, cols: 1, rows: 1, blockWidth: innerWidth, blockHeight: innerHeight, depth: 0 };
  const { score: _score, ...wall } = best;
  return wall;
}

/** Integer edges so neighbouring blocks share pixels exactly (no hairline seams). */
export function blockBox(wall: Wall, col: number, row: number) {
  const left = wall.inset + Math.round(col * wall.blockWidth);
  const top = wall.inset + wall.depth + Math.round(row * wall.blockHeight);
  const right = wall.inset + Math.round((col + 1) * wall.blockWidth);
  const bottom = wall.inset + wall.depth + Math.round((row + 1) * wall.blockHeight);
  return { left, top, width: right - left, height: bottom - top };
}

/* ------------------------------ plan ------------------------------ */

export type BlockPlan = {
  col: number; row: number; material: Material;
  /** Seconds: when this block pops. */
  breakAt: number;
  /** Direction it flies when it pops (px) and its spin (deg). */
  dx: number; dy: number; spin: number;
  chip: boolean;
  /** Onset of crack stages 1-4 on this block (seconds; NEVER when not reached before it pops). */
  cracks: [number, number, number, number];
  /** Pickaxe impacts on this block (tick times), for the white hit flash. */
  hits: number[];
  /** Crack sprite orientation (0-3: as drawn, mirrored, flipped, turned), so neighbours never match. */
  variant: number;
};

export const NEVER = 99;
/** Cracks spread from the struck block: one crack stage fainter per grid step, up to this many steps. */
export const CRACK_SPREAD = 2;

export type CardPlan = {
  index: number; rect: Rect; visible: boolean; column: number;
  slot: number; firstSlot: number; theme: Theme; wall: Wall;
  blocks: BlockPlan[];
  hitBlock: number;
  /** Block the pickaxe aims at, per struck slot (firstSlot..slot). */
  aims: number[];
  /** Onset of crack stages 1-4 on the finally smashed block (seconds). */
  crackStages: [number, number, number, number];
  /** Every tick and chip-smash (small jolt) and the wind-ups (tremble). */
  jolts: number[]; windups: number[];
  /** Backing and interior vanish with the final smash. */
  clearAt: number;
  /** Every block and its debris is gone by now: the cover drops its chunk (no layers, no DOM left to style). */
  doneAt: number;
  /** Blocks that throw pixel debris when they pop (all of them unless the screen is crowded). */
  debris: number[];
};

export type PickaxeCue = {
  card: number; slot: number; x: number; y: number; fromX: number; fromY: number;
  /** Swing from the left (sprite mirrored about the tip) when the grip would leave the screen on the right. */
  mirror: boolean;
  /** Integer pixels per sprite texel. */
  scale: number;
  /** The struck block's smaller side (px): the SMASH star is sized to it. */
  blockSize: number;
  /** The hop starts at this share of `scale` (the previous pickaxe's size, or the tool-slot icon's). */
  fromScale: number;
  /** Its size at the top of the hop (share of `scale`): a bigger pickaxe shrinks on the way up, a smaller one grows on the way down, so it is never bigger up high than at either end. */
  midScale: number;
  /** Extra rise at the middle of the hop (px, negative is up), kept below the app header. */
  lift: number;
  /**
   * The last pickaxes fly home into the tool slot after the final smash: the offset of the slot
   * from the tip (px), the rise at the top of that hop (kept below the header), and the size they
   * shrink to (the slot icon's).
   */
  home: { x: number; y: number; lift: number; scale: number } | null;
  enterAt: number; enterFor: number; hideAt: number; exits: boolean; chip: boolean;
};

export type CubeCue = {
  id: number; material: Material; kind: Kind; x: number; y: number; size: number;
  popAt: number; arriveAt: number;
  dx: number; apex: number; rest: number; targetX: number; targetY: number; spin: number;
  /** Its scale as it lands in its slot: the slot icon's size, so the icon takes over without a pop. */
  end: number;
  /** The gem's hero point (offset from x, y), where it hangs big with a sunburst before zipping home. */
  gem: boolean; heroX: number; heroY: number;
};

export type HotbarPlan = {
  centerX: number; top: number; slotSize: number; gap: number; padding: number; width: number; height: number;
  /** The smaller hotbar of crowded screens. */
  compact: boolean;
  /** When it sinks away: with the cottage at the exit cue, or early where it still hides a name. */
  exitAt?: number;
  slots: { kind: Kind; x: number; y: number }[];
  /** The tool slot, left of the block slots: the pickaxe leaves from and returns to it. */
  tool: { x: number; y: number };
  /** Displayed value per slot over time. 0 means empty. */
  counts: { kind: Kind; from: number; to: number; value: number }[][];
  /** When each slot bounces (a cube arrives or a block leaves). */
  bumps: number[][];
};

export type HousePlacement = {
  id: number; col: number; row: number; material: HouseMaterial; kind: Kind;
  x: number; y: number; leaveAt: number; landAt: number; fromX: number; fromY: number;
  /** The top of its hop (offset of the block centre from its place): just above and beside its spot. */
  midX: number; midY: number;
  top: boolean; side: boolean;
};

export type HousePlan = {
  block: number; depth: number; left: number; bottom: number; placements: HousePlacement[]; gemLandAt: number;
  /** Standing on a card's floor rather than on the hotbar's ground line. */
  lifted: boolean;
  /** The hearts floating off the crown: their size, how high they rise (below the header and the names above), and which fly (-1 left, 0 up, 1 right). */
  heart: number; heartRise: number; hearts: number[];
};

export type BlockMinePlan = {
  viewport: Viewport; cards: CardPlan[]; pickaxes: PickaxeCue[]; cubes: CubeCue[];
  hotbar: HotbarPlan; house: HousePlan; usedSlots: number[];
  /** The gem item's size (px): about a full hotbar slot of this screen, even beside the compact hotbar. */
  gemSize: number;
};

const THEMES_BY_COUNT: Record<number, Theme[]> = {
  1: ['mixed'], 2: ['mine', 'gem'], 3: ['meadow', 'wood', 'gem'], 4: ['meadow', 'wood', 'quarry', 'gem'],
};

/** Cluster card centres into columns (left to right). */
export function columnsOf(rects: readonly Rect[]): number[] {
  const order = rects.map((_, index) => index).sort((a, b) => (rects[a].left + rects[a].width / 2) - (rects[b].left + rects[b].width / 2));
  const columns = Array.from<number>({ length: rects.length }).fill(0);
  let column = -1;
  let anchor = -Infinity;
  for (const index of order) {
    const center = rects[index].left + rects[index].width / 2;
    if (center - anchor > Math.max(24, rects[index].width * .35)) { column++; anchor = center; }
    columns[index] = column;
  }
  return columns;
}

/** Left-to-right columns map onto the four swing slots; the first and last slot are always used. */
export function slotForColumn(column: number, columnCount: number) {
  if (columnCount <= 1) return SLOT_COUNT - 1;
  return Math.round(column * (SLOT_COUNT - 1) / (columnCount - 1));
}

function materialFor(theme: Theme, col: number, row: number, cols: number, rows: number, random: () => number): Material {
  if (theme === 'wood') return 'planks';
  // With one or two columns of cards there is no plank card: a support beam brings the wood.
  if ((theme === 'mine' || theme === 'mixed') && cols > 1 && col === cols - 1 && row > 0) return 'planks';
  if (theme === 'meadow' || theme === 'mine' || theme === 'mixed') {
    if (row === 0) return 'grass';
    // A two-row chunk still shows some rock: dirt on the left, stone on the right.
    if (rows <= 2) return col < cols / 2 ? 'dirt' : random() < .2 ? 'ore' : 'stone';
    if (row === 1 || (row === 2 && rows > 4)) return 'dirt';
    return random() < .15 ? 'ore' : 'stone';
  }
  return random() < (theme === 'quarry' ? .22 : .12) ? 'ore' : 'stone';
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));
}

/**
 * Visit a card's chip blocks in the order that keeps the pickaxe's hops short
 * (the longest hop as short as it can be, then the least travel), ending on
 * the block it smashes. `entry` is where it arrives from, when known.
 */
export function orderChips(chips: readonly number[], hit: number, centre: (block: number) => { x: number; y: number }, entry?: { x: number; y: number }): number[] {
  if (chips.length < 2) return [...chips];
  let best: { order: number[]; longest: number; travel: number } | null = null;
  for (const order of permutations(chips)) {
    const points = [...(entry ? [entry] : []), ...[...order, hit].map(centre)];
    let longest = 0;
    let travel = 0;
    for (let i = 1; i < points.length; i++) {
      const hop = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      longest = Math.max(longest, hop);
      travel += hop * hop;
    }
    if (!best || longest < best.longest - 1 || (longest <= best.longest + 1 && travel < best.travel)) best = { order, longest, travel };
  }
  return best!.order;
}

function chipOrder(cols: number, rows: number) {
  const corners: [number, number][] = [[cols - 1, 0], [0, rows - 1], [cols - 1, rows - 1], [0, 0], [cols - 2, 0], [1, rows - 1]];
  const seen = new Set<string>();
  const list: [number, number][] = [];
  for (const [col, row] of corners) {
    if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
    const key = `${col},${row}`;
    if (!seen.has(key)) { seen.add(key); list.push([col, row]); }
  }
  return list;
}

/**
 * Crack beats of one swing slot: tik, tik, tik, then the wind-up tremble.
 * The struck block reaches stage k on beat k; a block d grid steps away lags
 * d beats, so the crack visibly spreads out from the pickaxe.
 */
export function crackBeats(slot: number) {
  return [...TICK_OFFSETS_S.map((offset) => slotStart(slot) + offset), slotStart(slot) + WINDUP_OFFSET_S + .04].map(round2);
}

function addCracks(target: [number, number, number, number], beats: readonly number[], distance: number, before: number) {
  if (distance > CRACK_SPREAD) return;
  for (let stage = 0; stage < 4; stage++) {
    const beat = stage + distance;
    if (beat >= beats.length || beats[beat] >= before) continue;
    target[stage] = Math.min(target[stage], beats[beat]);
  }
}

function isVisible(rect: Rect, viewport: Viewport) {
  return rect.left + rect.width > 0 && rect.left < viewport.width && rect.top + rect.height > 0 && rect.top < viewport.footerTop;
}

/** Pickaxe sprite texels (18x18 sprite): the grip is the pivot, the lower head tip strikes. */
export const PICK_GRIP_TEXEL = { x: 15.5, y: 15.5 };
export const PICK_TIP_TEXEL = { x: 2.5, y: 11.5 };

/** Integer pixels per texel for a 16-texel pickaxe sized to its card. */
export function pickaxeScale(rect: Rect) {
  return clamp(Math.round(Math.min(rect.width * .52, rect.height * .5 + 34) / 16), 3, 11);
}
/**
 * How far (texels) the sprite reaches above its tip in any swing pose, the
 * scaled-up wind-up included (PICK_REACH_UP); at the top of a hop, turned a
 * little further back (PICK_HOP_REACH); and late in the spin up from the
 * hotbar, when its handle points up (PICK_SPIN_REACH). Tests check these
 * against the sprite.
 */
export const PICK_REACH_UP = 11.8;
export const PICK_HOP_REACH = 13;
export const PICK_SPIN_REACH = 18.6;
/** How far (texels) the head swings out past the grip side of its tip at the top of the wind-up. */
export const PICK_REACH_SIDE = 27.2;
/** The pickaxe sprite is 18 texels square; in its hotbar slot it is drawn about 70% of the slot wide. */
export const PICKAXE_TEXELS = 18;
export const toolIconSize = (slotSize: number) => pixelSize(PICKAXE_TEXELS, slotSize * .7);
/** At the top of its hop the pickaxe is still this share of its start offset from the target (bm-pick-travel's 50% frame). */
export const PICK_HOP_APEX = .45;
/** Keep the pickaxe this far below the app header. */
const HEADER_CLEAR = 3;
/** Largest pixel scale whose swing stays below the header when aimed at `y`. */
export const pickaxeScaleUnder = (y: number, viewport: Viewport, reach = PICK_REACH_UP) => Math.floor((y - headerOf(viewport) - HEADER_CLEAR) / reach);
/** Hops longer than this leave during the previous slot's follow-through, so the arc can be read. */
export const LONG_HOP_PX = 480;
export const LONG_HOP_LEAD_S = .1;

/** The gem item sprite: 16 texels at an integer scale, about a hotbar slot wide (it doubles at its hero moment). */
export const gemItemSize = (slotSize: number) => 16 * Math.max(3, Math.round(slotSize / 16));
/** The gem's icon in its hotbar slot: 16 texels, about 0.72 of the slot. */
export const gemIconSize = (slotSize: number) => 16 * Math.max(2, Math.round(slotSize * .72 / 16));
/** Whole-pixel sprite sizes: `texels` wide at the integer scale nearest to `target` px (at least `min` px per texel). */
export const pixelSize = (texels: number, target: number, min = 1) => texels * Math.max(min, Math.round(target / texels));

/** A hotbar slot's block icon: 16 texels, at least 2 px each. */
export const slotIconSize = (slotSize: number) => pixelSize(16, slotSize * .5, 2);
/** Full-size hotbar slot for this screen (the crowded hotbar is smaller; cubes keep the screen's scale). */
export const slotSizeFor = (viewport: Viewport) => Math.round(clamp(Math.min(viewport.width, viewport.height) * .074, 42, 80));
/** The mini cubes that fly home: about 0.7 of a full slot, 16 texels at a whole-pixel scale. */
export const miniCubeSize = (viewport: Viewport) => pixelSize(16, slotSizeFor(viewport) * .7, 2);

/** Without measured text, layouts with at most this many visible cards (one row) get the big finale cottage. */
export const ROOMY_CARDS = 5;

/**
 * The finale cottage's block sizes for this screen, smallest first, all at
 * whole-pixel texels (16 texels a block): 2, 3 and 4 px texels (32, 48 and
 * 64 px blocks) on laptops and classroom projectors, 3, 4 and 5 px at 1080p
 * (and 2 px there too, for a crowded screen). The planner takes the biggest
 * one that stands clear of the names.
 */
export function houseBlocks(viewport: Viewport): number[] {
  const vmin = Math.min(viewport.width, viewport.height);
  const texel = Math.max(2, Math.floor(vmin * .05 / 16 + .4));
  // On big screens a crowded layout may still need the 2 px one to stand clear of every name.
  return [...(texel > 2 ? [2] : []), texel, texel + 1, texel + 2].map((t) => t * 16);
}

/** Cottage footprint for a block size: 5 blocks wide plus the oblique depth, HOUSE_ROWS tall (the crown gem on top). */
export function houseSize(block: number) {
  const depth = Math.round(block * .3);
  return { block, depth, width: block * 5 + depth, height: block * HOUSE_ROWS.length };
}

/** Where the cottage stands: its left edge and its ground line (the bottom of the lawn). */
export type HouseSpot = { block: number; left: number; bottom: number };

/**
 * Where the finale stands: the hotbar along the bottom (full size, or the
 * compact one on crowded screens) and the cottage, beside it where there is
 * room, else wherever it stands clear of the names: in the open, or inside a
 * card, standing on the card's floor.
 */
export type FinaleSpot = { barLeft: number; compactBar: boolean; house: HouseSpot };

/** The compact hotbar of crowded screens: smaller slots that still hold the 32 px block icons. */
export const compactSlotSizeFor = (viewport: Viewport) => Math.max(48, Math.round(slotSizeFor(viewport) * .82));

/**
 * Bottom HUD: a tool slot (the pickaxe lives there) and four block slots.
 * Centred unless a spot (chosen to keep names clear) says otherwise. The
 * compact one sits closer to the footer, so it hides as little as it can.
 */
export function hotbarFor(viewport: Viewport, spot: { barLeft?: number; compactBar?: boolean; houseCenter?: number } = {}): Omit<HotbarPlan, 'counts' | 'bumps'> {
  const vmin = Math.min(viewport.width, viewport.height);
  const slotSize = spot.compactBar ? compactSlotSizeFor(viewport) : slotSizeFor(viewport);
  const gap = Math.round(slotSize * .12);
  const padding = Math.round(slotSize * .16);
  const slotCount = HOTBAR_KINDS.length + 1;
  const width = slotSize * slotCount + gap * (slotCount - 1) + padding * 2;
  const height = slotSize + padding * 2;
  const left = Math.round(spot.barLeft ?? Math.max(8, viewport.width / 2 - width / 2));
  const centerX = left + width / 2;
  const top = Math.round(viewport.footerTop - height - (spot.compactBar ? 3 : Math.max(6, vmin * .012)));
  const at = (index: number) => ({ x: left + padding + index * (slotSize + gap) + slotSize / 2, y: top + padding + slotSize / 2 });
  // Tool, earth, wood, stone, gem from the left; mirrored when the cottage stands to the left, so
  // the roof stone and the crown gem always sit on the cottage's side (short hops).
  const mirrored = spot.houseCenter !== undefined && spot.houseCenter < centerX;
  const slots = HOTBAR_KINDS.map((kind, index) => ({ kind, ...at(mirrored ? HOTBAR_KINDS.length - 1 - index : index + 1) }));
  const tool = at(mirrored ? HOTBAR_KINDS.length : 0);
  return { centerX, top, slotSize, gap, padding, width, height, slots, tool, compact: !!spot.compactBar };
}

/** The usual place for the cottage: on the hotbar's ground line, a little gap to its right. */
export function defaultHouse(bar: Pick<HotbarPlan, 'centerX' | 'width' | 'top' | 'height' | 'slotSize'>, block: number): HouseSpot {
  return { block, left: Math.round(bar.centerX + bar.width / 2 + bar.slotSize * .45), bottom: bar.top + bar.height };
}

/** Build beats: rows land on a steady beat, blocks inside a row ripple left to right. */
export const houseLandAt = (row: number, inRow: number) => round2(BUILD_START_S + BUILD_FLIGHT_S + row * BUILD_ROW_S + inRow * BUILD_STEP_S);
/** A cottage block leaves its slot small (bm-hfly 0%) and is a touch oversized at the top of its hop (55%). */
export const FLIGHT_START_SCALE = .55;
export const FLIGHT_PEAK_SCALE = 1.06;
/** How far above its spot (or its slot, when that is higher) a block's hop tops out, in blocks. */
export const FLIGHT_HOP_BLOCKS = .5;

/**
 * The cottage's blocks, where and when each lands, and its hop out of the
 * hotbar: up and across to just beside and above its spot (at most half a
 * block above it, so a hop never sails high over the names), then down into
 * place. The lawn, level with the hotbar, gets a slightly bigger hop.
 */
export function houseLayout(bar: Pick<HotbarPlan, 'slots'>, house: HouseSpot, sourceKind: (material: HouseMaterial) => Kind = kindOf): HousePlacement[] {
  const { block } = house;
  const placements: HousePlacement[] = [];
  HOUSE_ROWS.forEach((cells, row) => cells.forEach((part, col) => {
    if (!part) return;
    const material = HOUSE_PARTS[part] ?? 'planks';
    const kind = sourceKind(material);
    const landAt = houseLandAt(row, cells.slice(0, col).filter(Boolean).length);
    const x = house.left + col * block;
    const y = house.bottom - (row + 1) * block;
    const source = bar.slots[HOTBAR_KINDS.indexOf(kind)];
    const tx = x + block / 2;
    const ty = y + block / 2;
    const dx = tx - source.x;
    const cornerX = tx - Math.sign(dx) * Math.min(Math.abs(dx) * .35, block * .9);
    const hop = row === 0 ? clamp(Math.abs(dx) * .15, block * FLIGHT_HOP_BLOCKS, block * 1.1) : block * FLIGHT_HOP_BLOCKS;
    const top = Math.min(source.y - block * FLIGHT_START_SCALE / 2, y);
    const cornerY = top - hop + block * FLIGHT_PEAK_SCALE / 2;
    placements.push({
      id: placements.length, col, row, material, kind, x, y, landAt, leaveAt: round2(landAt - BUILD_FLIGHT_S),
      fromX: round2(source.x - tx), fromY: round2(source.y - ty), midX: round2(cornerX - tx), midY: round2(cornerY - ty),
      top: !HOUSE_ROWS[row + 1]?.[col], side: !cells[col + 1],
    });
  }));
  return placements;
}

/** Keep the gem's sunburst this far below the app header. */
const HERO_HEADER_CLEAR = 4;

/**
 * The gem hangs big over the cottage's spot (before the cottage is built
 * there, so the space is clear of names), sunburst and all on screen and
 * above the footer; given the page's text, it slides up to half a cottage
 * sideways to keep its sunburst off the names.
 */
export function gemHeroPoint(viewport: Viewport, house: HouseSpot, gemSize: number, text: readonly Rect[] = []) {
  const { width, height } = houseSize(house.block);
  const core = gemSize * 2;
  // Its whole sunburst (2.2 gem widths, doubled at the hero moment) stays on screen.
  const reach = core * 1.1 + 4;
  const lowest = viewport.footerTop - reach;
  const highest = headerOf(viewport) + HERO_HEADER_CLEAR + reach;
  const y = round2(clamp(house.bottom - height / 2, Math.min(highest, lowest), lowest));
  const centre = clamp(house.left + width / 2, reach, Math.max(reach, viewport.width - reach));
  if (!text.length) return { x: centre, y };
  const square = (x: number, size: number): Rect => ({ left: x - size / 2, top: y - size / 2, width: size, height: size });
  const cover = (rect: Rect) => text.reduce((sum, box) => sum + overlapArea(rect, box), 0);
  let best = { x: centre, cost: Infinity };
  for (let x = centre - width * .6; x <= centre + width * .6 + 1e-6; x += 6) {
    if (x < reach || x > viewport.width - reach) continue;
    const cost = cover(square(x, core)) * 5 + cover(square(x, core * 2.2)) + Math.abs(x - centre) * 2;
    if (cost < best.cost) best = { x, cost };
  }
  return { x: round2(best.x), y };
}

/**
 * One piece of what the finale draws over the revealed screen, and while it
 * is there. Covering a name costs for every second both are on screen: a
 * name uncovered at 1.3 s and then hidden by the hotbar until the end costs
 * far more than one the cottage hides for its last two seconds. Solid pieces
 * (hotbar, cottage, the big gem) cost the most; the blocks hopping out of
 * the hotbar to build the cottage less (they pass over a name in a moment);
 * the see-through sunburst and the hearts floating off the roof hardly
 * anything (they only brush past).
 */
export type FinalePiece = Rect & { rate: number; from: number; to: number; solid: boolean };
const SOLID_RATE = 4;
/** A block hopping past a name hides it for a moment only (each strip spans its whole row's flights). */
const HOP_RATE = 1;
const SEE_THROUGH_RATE = .15;
/** The cottage (and a hotbar that hides no name) is half sunk by here. */
const FINALE_GONE_S = (EXIT_START_S + EXIT_END_S) / 2;
/**
 * Where the emptied hotbar still hides a name (crowded screens), it sinks
 * early: as soon as the crown gem has left it. The cottage keeps the stage
 * until the exit cue.
 */
export const HOTBAR_EARLY_EXIT_S = 6.24;
export const HOTBAR_EARLY_SINK_S = .36;
/** A hotbar that hides a name is half sunk by here. */
const BAR_GONE_S = HOTBAR_EARLY_EXIT_S + HOTBAR_EARLY_SINK_S / 2;

/** The cottage's rows (roof top included), each solid from the moment it lands. */
function houseRowPieces(house: HouseSpot): FinalePiece[] {
  const { block, depth } = houseSize(house.block);
  return HOUSE_ROWS.map((cells, row) => {
    const cols = cells.flatMap((part, col) => part ? [col] : []);
    return { left: house.left + cols[0] * block, top: house.bottom - (row + 1) * block - depth, width: (cols[cols.length - 1] - cols[0] + 1) * block + depth, height: block + depth, rate: SOLID_RATE, from: houseLandAt(row, 0), to: FINALE_GONE_S, solid: true };
  });
}

export function finaleFootprint(viewport: Viewport, spot: FinaleSpot): FinalePiece[] {
  const bar = hotbarFor(viewport, { ...spot, houseCenter: spot.house.left + houseSize(spot.house.block).width / 2 });
  const { block } = spot.house;
  const pieces: FinalePiece[] = [{ left: bar.centerX - bar.width / 2, top: bar.top, width: bar.width, height: bar.height, rate: SOLID_RATE, from: HOTBAR_RISE_S[1], to: BAR_GONE_S, solid: true }];
  pieces.push(...houseRowPieces(spot.house));
  // The hops that bring the blocks up from the hotbar, sampled along the way (one strip per row and step):
  // they only pass over a name, so they cost little.
  const placements = houseLayout(bar, spot.house);
  HOUSE_ROWS.forEach((_, row) => {
    const inRow = placements.filter((p) => p.row === row);
    const from = Math.min(...inRow.map((p) => p.leaveAt));
    const to = Math.max(...inRow.map((p) => p.landAt));
    for (const t of [.25, .5, .75, 1]) {
      const size = block * (FLIGHT_START_SCALE + (FLIGHT_PEAK_SCALE - FLIGHT_START_SCALE) * t);
      const xs = inRow.map((p) => p.x + block / 2 + p.fromX + (p.midX - p.fromX) * t);
      const ys = inRow.map((p) => p.y + block / 2 + p.fromY + (p.midY - p.fromY) * t);
      const left = Math.min(...xs) - size / 2;
      const top = Math.min(...ys) - size / 2;
      pieces.push({ left, top, width: Math.max(...xs) + size / 2 - left, height: Math.max(...ys) + size / 2 - top, rate: HOP_RATE, from, to, solid: false });
    }
  });
  // Hearts float up from the crown.
  const crownAt = houseLandAt(HOUSE_ROWS.length - 1, 0);
  const roofTop = spot.house.bottom - HOUSE_ROWS.length * block;
  pieces.push({ left: spot.house.left + block * .9, top: roofTop - block * 2.4, width: block * 3.2, height: block * 2.4, rate: SEE_THROUGH_RATE, from: crownAt + .12, to: crownAt + HEART_S + .2, solid: false });
  // The gem's hero moment: the gem itself, then its see-through sunburst.
  const gemSize = gemItemSize(slotSizeFor(viewport));
  const hero = gemHeroPoint(viewport, spot.house, gemSize);
  const gem = gemSize * 2;
  pieces.push({ left: hero.x - gem / 2, top: hero.y - gem / 2, width: gem, height: gem, rate: SOLID_RATE, from: LAST_SMASH_S + GEM_POP_S, to: GEM_ARRIVE_S - GEM_ZIP_S / 2, solid: true });
  pieces.push({ left: hero.x - gem * 1.1, top: hero.y - gem * 1.1, width: gem * 2.2, height: gem * 2.2, rate: SEE_THROUGH_RATE, from: LAST_SMASH_S + GEM_POP_S + GEM_DRIFT_S / 2, to: GEM_ARRIVE_S - GEM_ZIP_S, solid: false });
  return pieces;
}

export const overlapArea = (a: Rect, b: Rect) => {
  const width = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const height = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
};

/** Seconds a piece hides a text box: while both are on screen and the box is uncovered. */
const hiddenFor = (piece: Pick<FinalePiece, 'from' | 'to'>, box: TimedRect) => Math.max(0, piece.to - Math.max(piece.from, box.revealAt ?? 0));

/**
 * What hiding part of a word costs (px² of the padded word, per second): a
 * word half hidden by a solid piece can no longer be read, so touching it at
 * all costs half of the whole word, plus the area hidden. A cut-off team
 * heading or row label weighs the same as a name. See-through pieces only
 * brush past: they cost the area they cross.
 */
export const TOUCH_SHARE = .5;
const coverCost = (piece: Rect & { solid?: boolean }, box: Rect) => {
  const area = overlapArea(piece, box);
  return area > 0 ? area + (piece.solid === false ? 0 : box.width * box.height * TOUCH_SHARE) : 0;
};

/**
 * Costs of a finale spot besides covering text (in the same units, so even a
 * sliver of a name outweighs these):
 * - each card edge the cottage stands across or touches (within
 *   `crossingMargin`): the cottage stands inside one card, on its floor, or
 *   in the open, never on a card's outline;
 * - a smaller cottage, per size step (the big one is the payoff);
 * - the compact hotbar;
 * - each px the hotbar sits off-centre, the cottage away from the hotbar
 *   (beyond the usual small gap), and the cottage away from the gem block
 *   (the gem drifts from there to hang over the cottage's spot).
 */
export const FINALE_COST = { crossing: 1000, crossingMargin: 10, offCentre: .5, smaller: 700, compactBar: 900, apart: .6, gemDrift: .4 };
/** Keep this much clear space around every measured text box (a cottage pressed against a name looks cramped). */
export const TEXT_CLEARANCE = 10;
/** A cottage standing inside a card stands this far above the card's bottom edge (on its floor, not its border). */
export const HOUSE_FLOOR_LIFT = 12;

/** How much of the measured text a spot would hide, and for how long (px² s, weighted). */
export function finaleTextCover(viewport: Viewport, spot: FinaleSpot, text: readonly TimedRect[]) {
  return finaleFootprint(viewport, spot).reduce((sum, piece) => sum + text.reduce((total, box) => total + coverCost(piece, box) * piece.rate * hiddenFor(piece, box), 0), 0);
}

/** The cottage's outline: lawn to roof top (the crown gem floats above it). */
export function houseOutline(house: HouseSpot): Rect {
  const { width, depth, block } = houseSize(house.block);
  const height = block * (HOUSE_ROWS.length - 1) + depth;
  return { left: house.left, top: house.bottom - height, width, height };
}

/** Card edges the cottage stands across or touches (see FINALE_COST). */
export function cottageCrossings(house: HouseSpot, cards: readonly Rect[]) {
  const box = houseOutline(house);
  const margin = FINALE_COST.crossingMargin;
  const right = box.left + box.width;
  const bottom = box.top + box.height;
  let edges = 0;
  for (const card of cards) {
    const cardRight = card.left + card.width;
    const cardBottom = card.top + card.height;
    if (card.top < bottom + margin && cardBottom > box.top - margin) for (const x of [card.left, cardRight]) if (x > box.left - margin && x < right + margin) edges++;
    if (card.left < right + margin && cardRight > box.left - margin) for (const y of [card.top, cardBottom]) if (y > box.top - margin && y < bottom + margin) edges++;
  }
  return edges;
}

/**
 * Pick the finale spot that keeps the revealed names readable. The hotbar
 * slides along the bottom (full size, or compact where that hides less); the
 * cottage tries every size, place and ground (the hotbar's, or the floor of
 * the card it would stand in). Each is scored on its own: the text it hides
 * and for how long, card outlines it would stand on, size and centring. The
 * best pairs that do not overlap are then scored whole (the hops between
 * them, the gem's hero moment, the hearts), preferring the cottage beside
 * the hotbar.
 */
export function chooseFinaleSpot(viewport: Viewport, text: readonly TimedRect[], cards: readonly Rect[], gemAt?: { x: number; y: number }): FinaleSpot {
  const step = 8;
  const blocks = houseBlocks(viewport);
  const barCost = (left: number, width: number, compact: boolean) => Math.abs(left + width / 2 - viewport.width / 2) * FINALE_COST.offCentre + (compact ? FINALE_COST.compactBar : 0);
  // The gem pops out of its block and hangs over the cottage's spot: a spot near it keeps that drift short.
  const houseCost = (house: HouseSpot) => {
    const { width, height } = houseSize(house.block);
    const near = gemAt ? Math.hypot(house.left + width / 2 - gemAt.x, house.bottom - height / 2 - gemAt.y) * FINALE_COST.gemDrift : 0;
    return (blocks.length - 1 - blocks.indexOf(house.block)) * FINALE_COST.smaller + cottageCrossings(house, cards) * FINALE_COST.crossing + near;
  };
  /** How far the cottage stands from the hotbar, beyond the usual gap (or -1 where they would overlap). */
  const apartOf = (bar: Rect, slotSize: number, house: Rect) => {
    const apartX = Math.max(house.left - (bar.left + bar.width), bar.left - (house.left + house.width));
    const apartY = bar.top - (house.top + house.height);
    // Never on top of the hotbar (a cottage standing higher up, on a card's floor, may stand above it).
    if (apartX < 8 && apartY < 8) return -1;
    return Math.max(0, apartX - Math.round(slotSize * .45)) + Math.max(0, apartY);
  };
  /**
   * The text a piece could hide as it slides sideways: the words on its rows, each with its weight
   * (how long it would stay hidden); then any left edge costs one pass over those few words.
   */
  const slider = (piece: Rect, from: number, to: number) => {
    const rows = text.filter((box) => box.top < piece.top + piece.height && box.top + box.height > piece.top).map((box) => ({ box, weight: SOLID_RATE * hiddenFor({ from, to }, box) })).filter(({ weight }) => weight > 0);
    return (left: number) => {
      if (!rows.length) return 0;
      const moved = { left: piece.left + left, top: piece.top, width: piece.width, height: piece.height };
      let cost = 0;
      for (const { box, weight } of rows) cost += coverCost(moved, box) * weight;
      return cost;
    };
  };
  // Hotbars, scored alone.
  const bars: { left: number; compact: boolean; rect: Rect; slotSize: number; cost: number }[] = [];
  for (const compact of [false, true]) {
    const bar = hotbarFor(viewport, { compactBar: compact });
    const hides = slider({ left: 0, top: bar.top, width: bar.width, height: bar.height }, HOTBAR_RISE_S[1], BAR_GONE_S);
    const lefts = new Set([bar.centerX - bar.width / 2]);
    for (let left = 8; left <= viewport.width - bar.width - 8; left += step) lefts.add(left);
    for (const left of lefts) {
      const rect = { left, top: bar.top, width: bar.width, height: bar.height };
      bars.push({ left, compact, rect, slotSize: bar.slotSize, cost: hides(left) + barCost(left, bar.width, compact) });
    }
  }
  // Cottages, scored alone: every size, place and ground.
  const ground = hotbarFor(viewport).top + hotbarFor(viewport).height;
  const houses: { house: HouseSpot; rect: Rect; cost: number }[] = [];
  const rowSliders = new Map<string, ((left: number) => number)[]>();
  const rowsHide = (block: number, bottom: number, left: number) => {
    const key = `${block}:${bottom}`;
    let sliders = rowSliders.get(key);
    if (!sliders) rowSliders.set(key, sliders = houseRowPieces({ block, left: 0, bottom }).map((piece) => slider(piece, piece.from, piece.to)));
    return sliders.reduce((sum, hides) => sum + hides(left), 0);
  };
  for (const block of blocks) {
    const { width, height } = houseSize(block);
    // Every step along the bottom, plus each card's snug left and right spots (a tight fit beside the names).
    const lefts = new Set<number>();
    for (let left = 8; left <= viewport.width - width - 8; left += step) lefts.add(left);
    for (const card of cards) for (const left of [card.left + FINALE_COST.crossingMargin, card.left + card.width - FINALE_COST.crossingMargin - width]) if (left >= 8 && left <= viewport.width - width - 8) lefts.add(Math.ceil(left));
    for (const left of lefts) {
      // The hotbar's ground line, or the floor of a card it fits inside (on the card's floor, not its border).
      const floors = new Set([ground]);
      for (const card of cards) {
        const floor = Math.round(card.top + card.height - HOUSE_FLOOR_LIFT);
        if (card.left + FINALE_COST.crossingMargin <= left && left + width <= card.left + card.width - FINALE_COST.crossingMargin && floor < ground && floor - height > card.top) floors.add(floor);
      }
      for (const bottom of floors) {
        if (bottom - height < headerOf(viewport) + HEADER_CLEAR) continue;
        const house = { block, left, bottom };
        houses.push({ house, rect: houseOutline(house), cost: houseCost(house) + rowsHide(block, bottom, left) });
      }
    }
  }
  // The best cottages, each with the best hotbar to go with it.
  const pairs: { spot: FinaleSpot; cost: number }[] = [];
  bars.sort((a, b) => a.cost - b.cost);
  for (const { house, rect, cost } of [...houses].sort((a, b) => a.cost - b.cost).slice(0, 300)) {
    let pick: { bar: (typeof bars)[number]; cost: number } | null = null;
    for (const bar of bars) {
      // Bars come cheapest first: none further on can beat the pick.
      if (pick && bar.cost >= pick.cost) break;
      const apart = apartOf(bar.rect, bar.slotSize, rect);
      const total = bar.cost + apart * FINALE_COST.apart;
      if (apart >= 0 && (!pick || total < pick.cost)) pick = { bar, cost: total };
    }
    if (pick) pairs.push({ spot: { barLeft: pick.bar.left, compactBar: pick.bar.compact, house }, cost: cost + pick.cost });
  }
  pairs.sort((a, b) => a.cost - b.cost);
  // Then the best few different cottage spots (each with its best hotbar) scored whole: the hops
  // between hotbar and cottage, the gem's hero moment and the hearts as well.
  const seen = new Set<string>();
  let best: { spot: FinaleSpot; cost: number } | null = null;
  for (const { spot } of pairs) {
    const key = `${spot.house.block}:${Math.round(spot.house.left / 40)}:${spot.house.bottom}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const bar = hotbarFor(viewport, { compactBar: spot.compactBar });
    const cost = finaleTextCover(viewport, spot, text) + houseCost(spot.house) + barCost(spot.barLeft, bar.width, spot.compactBar)
      + apartOf({ left: spot.barLeft, top: bar.top, width: bar.width, height: bar.height }, bar.slotSize, houseOutline(spot.house)) * FINALE_COST.apart;
    if (!best || cost < best.cost - 1e-6) best = { spot, cost };
    if (seen.size >= 24) break;
  }
  // Nowhere apart (a tiny screen): the usual centred group.
  if (!best) return centredFinale(viewport, false);
  // The search steps 8 px: settle the cottage and the hotbar to the best 4 px either side.
  const scoreOf = (spot: FinaleSpot) => {
    const bar = hotbarFor(viewport, { compactBar: spot.compactBar });
    const outline = houseOutline(spot.house);
    const apart = apartOf({ left: spot.barLeft, top: bar.top, width: bar.width, height: bar.height }, bar.slotSize, outline);
    const inside = outline.left >= 8 && outline.left + outline.width <= viewport.width - 8 && spot.barLeft >= 8 && spot.barLeft + bar.width <= viewport.width - 8;
    return apart < 0 || !inside ? Infinity : finaleTextCover(viewport, spot, text) + houseCost(spot.house) + barCost(spot.barLeft, bar.width, spot.compactBar) + apart * FINALE_COST.apart;
  };
  for (const dx of [-4, 4]) {
    const moved: FinaleSpot = { ...best.spot, house: { ...best.spot.house, left: best.spot.house.left + dx } };
    const cost = scoreOf(moved);
    if (cost < best.cost - 1e-6) best = { spot: moved, cost };
  }
  return best.spot;
}

/** Without measured text (an unusual page): the hotbar and cottage side by side, centred; the big cottage when `roomy`. */
export function centredFinale(viewport: Viewport, roomy: boolean): FinaleSpot {
  const block = houseBlocks(viewport)[roomy ? 1 : 0];
  const bar = hotbarFor(viewport);
  const groupWidth = bar.width + Math.round(bar.slotSize * .45) + houseSize(block).width;
  const barLeft = Math.round(Math.max(8, viewport.width / 2 - groupWidth / 2));
  return { barLeft, compactBar: false, house: defaultHouse(hotbarFor(viewport, { barLeft }), block) };
}

/** The finale cottage, bottom row first (columns 0-4): lawn, plank walls, slate roof, gem on top. */
export const HOUSE_ROWS: readonly (readonly (string | null)[])[] = [
  ['lawn', 'lawn', 'lawn', 'lawn', 'lawn'],
  [null, 'wall', 'door', 'wall', null],
  [null, 'window', 'doorTop', 'window', null],
  ['roof', 'roof', 'roof', 'roof', 'roof'],
  [null, 'roof', 'roof', 'roof', null],
  [null, null, 'gem', null, null],
];

export const HOUSE_PARTS: Record<string, HouseMaterial> = { lawn: 'grass', wall: 'planks', window: 'window', door: 'door', doorTop: 'doorTop', roof: 'stone', gem: 'gem' };

/**
 * The cottage always looks the same (plank walls, lit windows, a slate roof);
 * a block whose kind was never mined (1-2 cards have no wood) borrows the
 * fullest other slot, so nothing ever leaves an empty slot.
 */
export function houseSourceKind(material: HouseMaterial, counts: Record<Kind, number>): Kind {
  const kind = kindOf(material);
  if (kind === 'gem' || counts[kind] > 0) return kind;
  const others: Kind[] = ['stone', 'earth', 'wood'];
  return others.filter((other) => other !== kind).sort((a, b) => counts[b] - counts[a])[0];
}

export type PlanOptions = {
  /**
   * On-screen text boxes (names, station labels) measured from the page. The
   * finale then stands where it covers the fewest of them. Without them, a
   * card-count rule picks the cottage size and the group is centred.
   */
  text?: readonly Rect[];
  seed?: number;
};

export function planBlockMine(rects: readonly Rect[], viewport: Viewport, options: PlanOptions = {}): BlockMinePlan {
  const seed = options.seed ?? 0x6d696e65;
  const random = seededRandom(seed);
  const visible = rects.map((rect) => isVisible(rect, viewport));
  const visibleRects = rects.filter((_, index) => visible[index]);
  const basis = visibleRects.length ? visibleRects : rects;
  const basisColumns = columnsOf(basis);
  const columnCount = basis.length ? Math.max(...basisColumns) + 1 : 0;
  const columnCenters: number[] = [];
  basis.forEach((rect, index) => { columnCenters[basisColumns[index]] ??= rect.left + rect.width / 2; });

  // Every card takes the column (and so the slot) of the nearest basis column.
  const columnOf = rects.map((rect) => {
    const center = rect.left + rect.width / 2;
    let best = 0;
    columnCenters.forEach((value, column) => { if (Math.abs(value - center) < Math.abs(columnCenters[best] - center)) best = column; });
    return best;
  });
  const slotOf = columnOf.map((column) => slotForColumn(column, columnCount));
  const usedSlots = [...new Set(slotOf)].sort((a, b) => a - b);
  const themes = THEMES_BY_COUNT[Math.min(4, usedSlots.length)] ?? THEMES_BY_COUNT[4];

  // One gem only: the visible card of the last slot nearest the middle of the screen.
  let gemCard = -1;
  rects.forEach((rect, index) => {
    if (slotOf[index] !== usedSlots[usedSlots.length - 1]) return;
    const distance = Math.hypot(rect.left + rect.width / 2 - viewport.width / 2, rect.top + rect.height / 2 - viewport.footerTop * .45) - (visible[index] ? 1e6 : 0);
    if (gemCard < 0) { gemCard = index; return; }
    const other = rects[gemCard];
    const otherDistance = Math.hypot(other.left + other.width / 2 - viewport.width / 2, other.top + other.height / 2 - viewport.footerTop * .45) - (visible[gemCard] ? 1e6 : 0);
    if (distance < otherDistance) gemCard = index;
  });

  const cards: CardPlan[] = rects.map((rect, index) => {
    const slot = slotOf[index];
    const previous = usedSlots.filter((value) => value < slot);
    const firstSlot = previous.length ? previous[previous.length - 1] + 1 : 0;
    let theme = themes[Math.min(themes.length - 1, usedSlots.indexOf(slot))];
    if (theme === 'gem' && index !== gemCard) theme = 'quarry';
    if (theme === 'mixed' && index !== gemCard) theme = 'mine';
    const wall = wallFor(rect.width, rect.height);
    // Aim so the whole pickaxe (tip to grip) sits over its own card, not the next one.
    const reach = (PICK_GRIP_TEXEL.x - PICK_TIP_TEXEL.x) * pickaxeScale(rect);
    const aimX = rect.width / 2 - reach / 2;
    let hitCol = 0;
    for (let col = 1; col < wall.cols; col++) {
      const center = (box: ReturnType<typeof blockBox>) => box.left + box.width / 2;
      if (Math.abs(center(blockBox(wall, col, 0)) - aimX) < Math.abs(center(blockBox(wall, hitCol, 0)) - aimX)) hitCol = col;
    }
    // The middle row, or a lower one where the wind-up would reach up behind the app header.
    const rowCentre = (row: number) => rect.top + blockBox(wall, 0, row).top + blockBox(wall, 0, row).height / 2;
    let hitRow = Math.floor((wall.rows - 1) / 2);
    while (hitRow < wall.rows - 1 && pickaxeScaleUnder(rowCentre(hitRow), viewport, PICK_HOP_REACH) < pickaxeScale(rect)) hitRow++;
    const cardRandom = seededRandom(seed + index * 7919);
    const blocks: BlockPlan[] = [];
    for (let row = 0; row < wall.rows; row++) {
      for (let col = 0; col < wall.cols; col++) {
        const material = (theme === 'gem' || theme === 'mixed') && col === hitCol && row === hitRow ? 'gem' : materialFor(theme, col, row, wall.cols, wall.rows, cardRandom);
        blocks.push({ col, row, material, breakAt: smashTime(slot), dx: 0, dy: 0, spin: 0, chip: false, cracks: [NEVER, NEVER, NEVER, NEVER], hits: [], variant: Math.floor(cardRandom() * 4) });
      }
    }
    const hitBlock = hitRow * wall.cols + hitCol;
    const aims: number[] = [];
    // The corners it chips (the same ones as ever), visited in the order with the shortest hops:
    // in from the card on the left, or up from the hotbar at the bottom (so the spin-in lands low, clear of the header).
    const centreOf = (block: number) => { const box = blockBox(wall, block % wall.cols, Math.floor(block / wall.cols)); return { x: box.left + box.width / 2, y: box.top + box.height / 2 }; };
    const chips = orderChips(
      chipOrder(wall.cols, wall.rows).map(([col, row]) => row * wall.cols + col).filter((block) => block !== hitBlock).slice(0, slot - firstSlot),
      hitBlock, centreOf, firstSlot > 0 ? { x: -rect.width * .5, y: rect.height / 2 } : { x: rect.width / 2, y: viewport.footerTop - rect.top },
    );
    for (let s = firstSlot; s < slot; s++) {
      const chip = chips[s - firstSlot];
      if (chip === undefined) { aims.push(hitBlock); continue; }
      aims.push(chip);
      blocks[chip].chip = true;
      blocks[chip].breakAt = smashTime(s);
    }
    aims.push(hitBlock);

    // Blocks burst away from the smash point in a quick ripple.
    const hitBox = blockBox(wall, hitCol, hitRow);
    blocks.forEach((block, blockIndex) => {
      const box = blockBox(wall, block.col, block.row);
      const vx = box.left + box.width / 2 - (hitBox.left + hitBox.width / 2);
      const vy = box.top + box.height / 2 - (hitBox.top + hitBox.height / 2);
      const distance = Math.hypot(vx, vy);
      const reach = Math.min(box.width, box.height) * (.28 + cardRandom() * .22);
      const angle = distance < 1 ? -Math.PI / 2 + (cardRandom() - .5) : Math.atan2(vy, vx) + (cardRandom() - .5) * .5;
      block.dx = round2(Math.cos(angle) * reach);
      block.dy = round2(Math.sin(angle) * reach - Math.min(box.width, box.height) * .12);
      block.spin = Math.round((cardRandom() - .5) * 16);
      if (!block.chip) {
        const steps = Math.abs(block.col - hitCol) + Math.abs(block.row - hitRow);
        block.breakAt = round2(smashTime(slot) + Math.min(RIPPLE_MAX_S, steps * RIPPLE_STEP_S));
      }
      void blockIndex;
    });

    const ticks: number[] = [];
    const jolts: number[] = [];
    const windups: number[] = [];
    for (let s = firstSlot; s <= slot; s++) {
      const slotTicks = TICK_OFFSETS_S.map((_, t) => round2(tickTime(s, t)));
      ticks.push(...slotTicks);
      windups.push(round2(slotStart(s) + WINDUP_OFFSET_S));
      if (s < slot) jolts.push(round2(smashTime(s)));
      // Cracks spread out from this slot's target; the target flashes on every tick.
      const aim = blocks[aims[s - firstSlot]];
      aim.hits.push(...slotTicks);
      const beats = crackBeats(s);
      for (const block of blocks) addCracks(block.cracks, beats, Math.abs(block.col - aim.col) + Math.abs(block.row - aim.row), block.breakAt);
    }
    jolts.push(...ticks);
    jolts.sort((a, b) => a - b);
    return {
      index, rect, visible: visible[index], column: columnOf[index], slot, firstSlot, theme, wall, blocks, hitBlock, aims,
      crackStages: [...blocks[hitBlock].cracks] as [number, number, number, number], jolts, windups, clearAt: round2(smashTime(slot)), debris: blocks.map((_, i) => i),
      doneAt: round2(Math.max(...blocks.map((block) => block.breakAt)) + CHUNK_LINGER_S),
    };
  });
  const visibleBlocks = cards.reduce((sum, card) => sum + (card.visible ? card.blocks.length : 0), 0);
  if (visibleBlocks > DEBRIS_BLOCK_BUDGET) for (const card of cards) card.debris = card.aims.filter((aim, i, all) => all.indexOf(aim) === i);

  // ---- pickaxes: one per visible card per struck slot, hopping from the previous slot's position.
  const pickaxes: PickaxeCue[] = [];
  // The finale spot comes first: the pickaxe leaves from (and returns to) the hotbar's tool slot.
  // With the page's text measured, the finale stands where it covers the fewest names; with none
  // (an unusual page), five or fewer cards on screen get the big cottage, centred.
  const visibleCards = cards.filter((card) => card.visible);
  // Each text box is uncovered when its card is smashed (text outside the cards shows all along).
  const revealAt = (box: Rect) => {
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const card = visibleCards.find(({ rect }) => x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height);
    return card ? card.clearAt : 0;
  };
  const text: TimedRect[] | undefined = options.text?.length
    ? options.text.map((box) => ({ left: box.left - TEXT_CLEARANCE, top: box.top - TEXT_CLEARANCE, width: box.width + TEXT_CLEARANCE * 2, height: box.height + TEXT_CLEARANCE * 2, revealAt: revealAt(box) }))
    : undefined;
  // The gem block: the gem pops out of it and drifts to hang over the cottage's spot.
  const gemPlan = cards[gemCard];
  const gemBlock = gemPlan?.blocks[gemPlan.hitBlock];
  const gemBox = gemBlock && blockBox(gemPlan.wall, gemBlock.col, gemBlock.row);
  const gemAt = gemBox && { x: gemPlan.rect.left + gemBox.left + gemBox.width / 2, y: gemPlan.rect.top + gemBox.top + gemBox.height / 2 };
  const spot = text ? chooseFinaleSpot(viewport, text, visibleCards.map((card) => card.rect), gemAt) : centredFinale(viewport, visibleCards.length <= ROOMY_CARDS);
  const hotbarBase = hotbarFor(viewport, { ...spot, houseCenter: spot.house.left + houseSize(spot.house.block).width / 2 });
  const toolSlot = hotbarBase.tool;
  // The first pickaxe grows out of the tool slot's icon (18 texels, centred in the slot).
  const toolIcon = toolIconSize(hotbarBase.slotSize);
  // ... and the last ones shrink back into it: its middle (6.5, -2.5 texels from the tip) lands on the slot.
  const homeHop = (x: number, y: number, scale: number) => {
    const shrink = toolIcon / (PICKAXE_TEXELS * scale);
    const home = { x: toolSlot.x - x - 6.5 * scale * shrink, y: toolSlot.y - y + 2.5 * scale * shrink };
    // It flips up first (bm-pick-home's 38% frame: a quarter of the way, at .8 size, mid-spin), never up behind the header.
    const lowest = Math.min(headerOf(viewport) + HEADER_CLEAR + PICK_SPIN_REACH * scale * .8, y);
    const lift = Math.max(-(60 + Math.abs(home.y) * .35), lowest - y - home.y * .25);
    return { x: Math.round(home.x), y: Math.round(home.y), lift: Math.round(Math.min(0, lift)), scale: round2(shrink) };
  };
  for (let s = 0; s < SLOT_COUNT; s++) {
    const struck = cards.filter((card) => card.visible && card.firstSlot <= s && s <= card.slot);
    const previous = pickaxes.filter((cue) => cue.slot === s - 1);
    const drafts = struck.slice(0, 16).map((card) => {
      const aim = card.aims[s - card.firstSlot];
      const block = card.blocks[aim];
      const box = blockBox(card.wall, block.col, block.row);
      const x = round2(card.rect.left + box.left + box.width / 2);
      const y = round2(card.rect.top + box.top + box.height / 2);
      // A smaller pickaxe where a big one's wind-up would reach up behind the app header.
      const scale = Math.max(3, Math.min(pickaxeScale(card.rect), pickaxeScaleUnder(y, viewport, s === 0 ? PICK_SPIN_REACH : PICK_HOP_REACH)));
      const same = previous.find((cue) => cue.card === card.index);
      const source = s === 0 ? null : same ?? previous.reduce<PickaxeCue | null>((best, cue) => !best || Math.abs(cue.y - y) + Math.abs(cue.x - x) * .2 < Math.abs(best.y - y) + Math.abs(best.x - x) * .2 ? cue : best, null);
      const fromScale = source ? source.scale / scale : toolIcon / (PICKAXE_TEXELS * scale);
      // From the tool slot, the sprite's middle (6.5, -2.5 texels from its tip) starts on the icon.
      const from = source ? { x: source.x, y: source.y } : { x: toolSlot.x - 6.5 * scale * fromScale, y: toolSlot.y + 2.5 * scale * fromScale };
      return { card, x, y, scale, source, fromScale, from, blockSize: Math.min(box.width, box.height) };
    });
    // A long hop leaves during the previous smash's follow-through (and so does every hop from that pickaxe).
    const early = new Set(drafts.filter((d) => d.source && Math.hypot(d.from.x - d.x, d.from.y - d.y) > LONG_HOP_PX).map((d) => d.source!));
    for (const cue of early) cue.hideAt = round2(slotStart(s) - LONG_HOP_LEAD_S);
    for (const { card, x, y, scale, source, fromScale, from, blockSize } of drafts) {
      const enterAt = s === 0 ? PICK_ENTER_S : round2(slotStart(s) - (source && early.has(source) ? LONG_HOP_LEAD_S : 0));
      // Swing from the left (mirrored) where the wind-up would carry the head off the right edge.
      const extent = PICK_REACH_SIDE * scale;
      const mirror = x + extent > viewport.width && x - extent >= 0;
      // The hop arcs up, but its top stays below the header (unless one of its ends is higher still).
      const dist = Math.hypot(from.x - x, from.y - y);
      // Up from the tool slot it grows as it rises; between cards it keeps the smaller size until the top of the hop.
      const midScale = s === 0 ? fromScale * .4 + .6 : Math.min(1, fromScale);
      const reachUp = s === 0 ? PICK_SPIN_REACH * scale : PICK_HOP_REACH * scale * midScale;
      const lowest = Math.min(headerOf(viewport) + HEADER_CLEAR + reachUp, y, from.y);
      const lift = Math.round(Math.max(-(40 + dist * .3), lowest - y - (from.y - y) * PICK_HOP_APEX));
      pickaxes.push({
        card: card.index, slot: s, x, y, fromX: round2(from.x), fromY: round2(from.y), scale, blockSize, fromScale: round2(fromScale), midScale: round2(midScale), lift, mirror,
        enterAt, enterFor: round2(slotStart(s) + TRAVEL_S - enterAt), hideAt: round2(slotStart(s) + SLOT_PERIOD_S),
        exits: s === SLOT_COUNT - 1, chip: s < card.slot, home: s === SLOT_COUNT - 1 ? homeHop(x, y, scale) : null,
      });
    }
  }

  // ---- mini cubes: every swing slot sends a few to the hotbar (fixed-time 'tok' cues),
  // and no hotbar count ever passes five.
  type BreakEvent = { card: CardPlan; at: number; slot: number; blocks: number[] };
  const events: BreakEvent[] = [];
  for (const card of cards) {
    if (!card.visible) continue;
    const chipBlocks = card.aims.slice(0, -1).filter((aim, i) => card.blocks[aim].chip && i >= 0);
    chipBlocks.forEach((aim, i) => events.push({ card, at: card.blocks[aim].breakAt, slot: card.firstSlot + i, blocks: [aim] }));
    // Cubes come from the lower, outer blocks first, so they hover away from names (top of a team card, centre of the picker).
    const score = (i: number) => {
      const block = card.blocks[i];
      const lower = card.wall.rows > 1 ? block.row / (card.wall.rows - 1) : .5;
      const outer = card.wall.cols > 1 ? Math.abs(block.col / (card.wall.cols - 1) - .5) * 2 : .5;
      return lower * .6 + outer * .4 + random() * .35;
    };
    const rest = card.blocks.map((_, i) => i).filter((i) => !card.blocks[i].chip && i !== card.hitBlock)
      .map((i) => ({ i, score: score(i) })).sort((a, b) => b.score - a.score).map(({ i }) => i);
    events.push({ card, at: smashTime(card.slot), slot: card.slot, blocks: [card.hitBlock, ...rest] });
  }
  events.sort((a, b) => a.at - b.at || a.card.rect.top - b.card.rect.top);
  const quota = cubeQuotas(events.map((event) => ({ slot: event.slot, kinds: event.blocks.map((i) => kindOf(event.card.blocks[i].material)) })));
  const picks: { event: BreakEvent; blockIndex: number; order: number }[] = [];
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    // Round robin over this slot's breaks: one cube from each card, then a second from each, ...
    const inSlot = events.filter((event) => event.slot === slot);
    const cursor = inSlot.map(() => 0);
    const taken = inSlot.map(() => 0);
    let total = 0;
    let progress = true;
    while (progress && total < SLOT_CUBES) {
      progress = false;
      inSlot.forEach((event, e) => {
        while (total < SLOT_CUBES && cursor[e] < event.blocks.length) {
          const blockIndex = event.blocks[cursor[e]++];
          const kind = kindOf(event.card.blocks[blockIndex].material);
          if (quota[slot][kind] <= 0) continue;
          quota[slot][kind]--;
          // The gem flies its own hero path; block cubes stagger from the smash (the first lands on the collect beat).
          if (kind !== 'gem') total++;
          picks.push({ event, blockIndex, order: kind === 'gem' ? 0 : taken[e]++ });
          progress = true;
          break;
        }
      });
    }
  }
  const kindCounts: Record<Kind, number> = { earth: 0, wood: 0, stone: 0, gem: 0 };
  const cubes: CubeCue[] = [];
  const slotIndex = (kind: Kind) => HOTBAR_KINDS.indexOf(kind);
  // The gem hangs over the spot where the cottage will stand, clear of the names.
  const gemSize = gemItemSize(slotSizeFor(viewport));
  const hero = gemHeroPoint(viewport, spot.house, gemSize, text);
  // It dives into its slot at the slot icon's size, so the icon takes over without a pop.
  const gemEnd = round2(gemIconSize(hotbarBase.slotSize) / gemSize);
  // Mini cubes read from across the room (about 0.7 of a full-size slot, whole-pixel texels; a little
  // smaller than the block they come from on the short Today cells) and land at the slot icon's size:
  // a turning cube shows about 1.2 of its width, the icon its front plus depth.
  const icon = slotIconSize(hotbarBase.slotSize);
  const cubeEndFor = (size: number) => round2((icon + Math.round(icon * .3)) / (size * 1.2));
  for (const { event, blockIndex, order } of picks) {
    const block = event.card.blocks[blockIndex];
    const kind = kindOf(block.material);
    kindCounts[kind]++;
    const box = blockBox(event.card.wall, block.col, block.row);
    const x = event.card.rect.left + box.left + box.width / 2;
    const y = event.card.rect.top + box.top + box.height / 2;
    const gem = block.material === 'gem';
    const size = Math.min(miniCubeSize(viewport), pixelSize(16, Math.min(box.width, box.height) * .6, 2));
    const popAt = round2(event.at + order * CUBE_STAGGER_S);
    const slot = hotbarBase.slots[slotIndex(kind)];
    const side = random() < .5 ? -1 : 1;
    const drift = 18 + random() * 46;
    const heroX = gem ? round2(hero.x - x) : 0;
    const heroY = gem ? round2(hero.y - y) : 0;
    // Every pop goes up first; the gem pops higher, then drifts to its hero point.
    // Cubes pop about half their card's height (70-120 px on team cards, less on the short Today cells).
    const lift = clamp(event.card.rect.height * .5, 40, 70);
    const pop = lift + random() * lift * .7;
    // A cube hovers a moment before it zips home: on the side (and at the height) where it hides the least text.
    const hover = (dx: number, apex: number) => {
      const half = size * .6;
      const at = { left: x + dx * 1.1 - half, top: y + apex * .62 - half, width: half * 2, height: half * 2 };
      return (text ?? []).reduce((sum, box) => sum + overlapArea(at, box), 0);
    };
    const choices = [[side, 1], [-side, 1], [side, .6], [-side, .6]].map(([dir, share]) => ({ dx: round2(dir * drift), apex: round2(-pop * share), hidden: hover(dir * drift, -pop * share) }));
    const pick = choices.reduce((best, choice) => choice.hidden < best.hidden - 1 ? choice : best, choices[0]);
    const dx = pick.dx;
    const apex = gem ? round2(Math.min(heroY, 0) - 90) : pick.apex;
    cubes.push({
      id: cubes.length, material: block.material, kind, x: round2(x), y: round2(y), size, popAt, arriveAt: round2(popAt + (gem ? GEM_FLIGHT_S : CUBE_FLIGHT_S)),
      dx, apex, rest: round2(apex * .62), targetX: round2(slot.x - x), targetY: round2(slot.y - y), spin: random() < .5 ? -1 : 1, end: gem ? gemEnd : cubeEndFor(size), gem, heroX, heroY,
    });
  }

  // ---- finale house: the collected blocks hop out of the hotbar and stack up, row by row.
  const { block, depth } = houseSize(spot.house.block);
  const placements = houseLayout(hotbarBase, spot.house, (material) => houseSourceKind(material, kindCounts));
  // Hearts float up off the crown and pop: up to HEART_RISE_MAX px, but never into the header or onto a name above;
  // a heart whose path would still cross a name (one right beside the crown) stays home.
  const crownSpot = placements.find((p) => p.material === 'gem');
  const heart = pixelSize(9, block * .6, 2);
  let heartRise = HEART_RISE_MAX;
  let hearts = [-1, 0, 1];
  if (crownSpot) {
    const cx = crownSpot.x + block / 2;
    const cy = crownSpot.y + block / 2;
    const reach = block * 1.6 + heart;
    heartRise = Math.min(heartRise, cy - heart / 2 - headerOf(viewport) - HEADER_CLEAR - 8);
    for (const box of text ?? []) if (box.left < cx + reach && box.left + box.width > cx - reach && box.top + box.height <= cy) heartRise = Math.min(heartRise, cy - heart / 2 - (box.top + box.height));
    heartRise = Math.round(clamp(heartRise, HEART_RISE_MIN, HEART_RISE_MAX));
    const path = (side: number): Rect => {
      const x0 = cx + side * block * 1.1;
      const x1 = cx + side * block * 1.54;
      return { left: Math.min(x0, x1) - heart / 2, top: cy - heart / 2 - heartRise, width: Math.abs(x1 - x0) + heart, height: heartRise + heart };
    };
    hearts = hearts.filter((side) => !(text ?? []).some((box) => overlapArea(path(side), box) > 0));
  }
  const house: HousePlan = {
    block, depth, left: spot.house.left, bottom: spot.house.bottom, placements, gemLandAt: placements[placements.length - 1]?.landAt ?? BUILD_START_S,
    lifted: spot.house.bottom < hotbarFor(viewport).top + hotbarFor(viewport).height,
    heart, heartRise, hearts,
  };
  // The emptied hotbar sinks early where it still hides a name that is on show by then.
  const barRect = { left: hotbarBase.centerX - hotbarBase.width / 2, top: hotbarBase.top, width: hotbarBase.width, height: hotbarBase.height };
  const glyphs = (box: Rect): Rect => ({ left: box.left + TEXT_CLEARANCE, top: box.top + TEXT_CLEARANCE, width: box.width - TEXT_CLEARANCE * 2, height: box.height - TEXT_CLEARANCE * 2 });
  const hidesName = (text ?? []).some((box) => (box.revealAt ?? 0) < HOTBAR_EARLY_EXIT_S && overlapArea(barRect, glyphs(box)) > 0);
  const exitAt = hidesName ? HOTBAR_EARLY_EXIT_S : EXIT_START_S;

  // ---- hotbar counts: +1 per arriving cube, then drained while the house is built.
  const counts: HotbarPlan['counts'] = HOTBAR_KINDS.map(() => []);
  const bumps: number[][] = HOTBAR_KINDS.map(() => []);
  HOTBAR_KINDS.forEach((kind, k) => {
    const arrivals = cubes.filter((cube) => cube.kind === kind).map((cube) => cube.arriveAt).sort((a, b) => a - b);
    const leaving = placements.filter((placement) => placement.kind === kind).map((placement) => placement.leaveAt);
    const changes: { at: number; value: number }[] = arrivals.map((at, i) => ({ at, value: i + 1 }));
    const total = arrivals.length;
    leaving.forEach((at, i) => {
      if (!total) return;
      // Round up, so a slot still shows at least 1 until its last block has left.
      const value = Math.ceil(total * (1 - (i + 1) / leaving.length) - 1e-9);
      if (value !== changes[changes.length - 1].value) changes.push({ at, value });
    });
    changes.forEach((change, i) => counts[k].push({ kind, from: change.at, to: changes[i + 1]?.at ?? BLOCK_MINE_DURATION_S, value: change.value }));
    bumps[k] = [...arrivals, ...leaving];
  });

  return { viewport, cards, pickaxes, cubes, hotbar: { ...hotbarBase, exitAt, counts, bumps }, house, usedSlots, gemSize };
}

/* ------------------------------ sound ------------------------------ */

const beatRange = (count: number, at: (index: number) => number) => Array.from({ length: count }, (_, index) => round2(at(index)));

/**
 * Fixed sound beats (seconds). The reveal ships one pre-mixed WAV built on
 * these (work/design/block-mine/audio/make-recipe.ts writes the recipe), so
 * every one of them must line up with something visible on every layout.
 */
export const SOUND_BEATS = {
  /** The hotbar settles after rising from behind the footer. */
  hotbarUp: .3,
  /** The pickaxe leaves its hotbar slot. */
  pickGrab: PICK_ENTER_S,
  /** Tik, tik, tik: three per swing slot. */
  ticks: beatRange(SLOT_COUNT * TICK_OFFSETS_S.length, (i) => tickTime(Math.floor(i / TICK_OFFSETS_S.length), i % TICK_OFFSETS_S.length)),
  /** The downswing whoosh lands on the smash. */
  swings: beatRange(SLOT_COUNT, (slot) => smashTime(slot) - .07),
  smashes: beatRange(SLOT_COUNT, smashTime),
  /** Mini cubes pop out of the break. */
  pops: beatRange(SLOT_COUNT, (slot) => smashTime(slot) + .03),
  /** The first cubes of each smash land in the hotbar (the count ticks up). */
  collects: beatRange(SLOT_COUNT, (slot) => smashTime(slot) + CUBE_FLIGHT_S),
  /** The last smash frees the gem: the extra-happy chime. */
  gemPop: LAST_SMASH_S,
  pickHome: round2(LAST_SMASH_S + PICK_EXIT_DELAY_S + PICK_EXIT_S),
  /** The gem reaches its hero point and hangs there, sparkling. */
  shimmer: round2(LAST_SMASH_S + GEM_POP_S + GEM_DRIFT_S + .06),
  gemHome: round2(GEM_ARRIVE_S),
  /** House rows land (lawn, walls, windows, roof, roof), then the gem crowns it. */
  buildRows: beatRange(HOUSE_ROWS.length - 1, (row) => BUILD_START_S + BUILD_FLIGHT_S + row * BUILD_ROW_S),
  crown: round2(BUILD_START_S + BUILD_FLIGHT_S + (HOUSE_ROWS.length - 1) * BUILD_ROW_S),
  lightsOn: round2(BUILD_START_S + BUILD_FLIGHT_S + (HOUSE_ROWS.length - 1) * BUILD_ROW_S + LIGHTS_ON_DELAY_S),
  exit: EXIT_START_S,
} as const;
