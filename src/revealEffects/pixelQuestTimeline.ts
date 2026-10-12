// Pixel Quest choreography: pure, deterministic planning and motion curves.
// No DOM, React or CSS here, so tests can import it directly.
//
// Every EVENT happens at a fixed time (the chiptune is pre-mixed); only
// POSITIONS adapt to the layout. The planner assigns exactly four bonks to the
// visible card columns, schedules chain pops for upper rows, and precomputes
// every crumble tile, chunk and dust puff so the Stage can hand them to CSS.
import { seededRandom } from './sceneMotion';
import { PQ_POOF_GRID, PQ_POOF_SETS, PQ_POOF_VARIANTS, poofFootprint, type PqPoofVariant } from './pixelQuestSprites';

export const PIXEL_QUEST_DURATION_MS = 7000;

/** Beat sheet, in seconds. */
export const PQ_T = {
  powerOn: .16,
  spawn: .2,
  heroIn: .22,
  heroLand: .34,
  count: [.3, .65, 1] as const,
  go: 1.32,
  goOut: 1.62,
  hits: [1.92, 2.64, 3.36, 4.08] as const,
  rise: .18,
  hitStop: .05,
  chainStep: .12,
  maxChainDepth: 8,
  shatterDelay: .18,
  /** A far tile's crumble (lit, crack, drop) lasts this long. */
  crumble: .12,
  /** Burst chunks flash white for two frames as the block breaks. */
  flash: .034,
  gemRise: .22,
  gemFly: .4,
  plusLife: .55,
  stopBy: 4.56,
  grabHop: 4.62,
  grab: 4.8,
  floatEnd: 5.3,
  clear: 5.3,
  fireworks: [5.36, 5.6, 5.84] as const,
  /** Each firework's rocket climbs for this long before its burst (the sound's rocket hiss starts with it). */
  rocket: .2,
  fireworkLife: .55,
  wink: 5.8,
  winkEnd: 5.95,
  /** Poof anticipation: squash onto the banner, then stretch up into a little hop. */
  poofWindup: 6,
  poofHop: 6.04,
  poof: 6.1,
  poofLife: .32,
  collapse: 6.14,
  collapseStagger: .02,
  collapseFall: .44,
  /** Each sky column pops off this long after its ground strip starts to shudder, as the strip drops. */
  skyWipeLag: .04,
  uiOut: 6.24,
  fadeLength: .32,
  /** The banner exits pixel-style (pop, drop, shrink) in this long. */
  bannerOut: .2,
  /** The HUD slides away this long after the last gem lands (never before hudOutMin) when it would hide a card header. */
  hudHold: .35,
  hudOutMin: 4.9,
  offscreenVanish: 5.6,
  end: 6.88,
  duration: PIXEL_QUEST_DURATION_MS / 1000,
  /** Debris for each bonk (and the finale) mounts this long before it is needed, which keeps the first paint light. */
  actLead: .4,
  /** The finale's placement search runs here: after the countdown's "2" has popped, while the bunny stands still. */
  finaleSearch: .78,
} as const;

/** bandSnapP: a block whose card ends at most this far into the band keeps its full height; minJumpP: the shortest bonk jump. */
export const PQ_LIMITS = { normalJumpP: 22, springJumpP: 48, minJumpP: 8, bandSnapP: 6, tileP: 10, maxTiles: 220, maxChunks: 60, strips: 16 } as const;

/** Hero sprite metrics, in art pixels (P). The sprite is 16x16, anchored at the feet centre. */
/** The held trophy is centred this many P right of the hero's feet (cheer pose). */
export const PQ_CHEER_TROPHY_CENTRE_P = 10;
/** The hero materialises this high above the ground and drops in. */
export const PQ_SPAWN_DROP_P = 16;

export const PQ_HERO = { size: 16, headP: 11, bandP: 25, groundInsetP: 6, springHeightP: 8, springSquashP: 4 } as const;

/**
 * Lazily mounted groups of CSS-timed debris: one per bonk (tiles, chunks, gems, "+1", impact star, landing dust),
 * then the finale in three small groups a few frames or beats apart, so no single frame styles them all: the grab ring
 * and LEVEL CLEAR banner, the fireworks, and the poof with the collapse dirt. Group k mounts at PQ_ACTS[k].
 */
export const PQ_FINALE_ACTS = { banner: 4, fireworks: 5, poof: 6 } as const;
export const PQ_ACTS = [
  ...PQ_T.hits.map((at) => round3(at - PQ_T.actLead)),
  round3(PQ_T.grab - PQ_T.actLead),
  round3(PQ_T.grab - PQ_T.actLead + .07),
  round3(PQ_T.poof - PQ_T.actLead - .04),
] as const;
/** How many acts are due at scene time t. */
export function pqActAt(t: number) {
  let n = 0;
  while (n < PQ_ACTS.length && PQ_ACTS[n] <= t) n++;
  return n;
}
/**
 * Each act mounts in this many slices, one per frame (every slice an even mix of the act's pieces), so no single frame
 * has to create and style a whole act's worth of debris.
 */
export const PQ_ACT_SLICES = 4;
/**
 * How many act slices to have mounted at scene time t when `mounted` already are: one more per frame while slices are
 * due, catching up so at most one act's slices ever wait (a slow machine still mounts each act well before its bonk), or
 * everything due at once (`all`: the review lab's frozen frames).
 */
export function pqSlicesAt(t: number, mounted: number, all = false) {
  const due = pqActAt(t) * PQ_ACT_SLICES;
  if (mounted >= due) return mounted;
  return all ? due : Math.max(mounted + 1, due - (PQ_ACT_SLICES - 1));
}
/** The pieces of an act that slice `slice` mounts. */
export function pqActSlice<T>(items: readonly T[], slice: number): T[] {
  return items.filter((_, i) => i % PQ_ACT_SLICES === slice);
}

export type PqRect = { left: number; top: number; width: number; height: number };
export type PqBox = { x: number; y: number; w: number; h: number };
/**
 * Something that must stay readable; card titles and table labels weigh more than name lines. A text line's zone has a
 * little breathing room round `line`, the letters themselves (a table label has none).
 */
export type PqZone = PqBox & { weight: number; line?: PqBox };
/**
 * `labels` are table header cells (Today's round titles and team names): the sky gets a hole so they read from the start.
 * `texts` are the text lines inside the revealed cards (names, titles): the finale and the HUD keep off them. Without
 * them, each card's top strip stands in for its header.
 */
export type PqLayoutInput = { width: number; height: number; chromeTop?: number; chromeBottom?: number; rects: readonly PqRect[]; labels?: readonly PqRect[]; texts?: readonly PqRect[] };
/** A vertical slice of a block: [from, to] of its width, pop time, and the gem hint tile centre (px from the cover's left). */
export type PqSlice = { from: number; to: number; at: number; hint: number };
export type PqCover = PqRect & {
  index: number; right: number; bottom: number; cx: number;
  onScreen: boolean; visible: boolean; hittable: boolean;
  /** Bottom of the block face (the band below B0 is where the hero runs). */
  edge: number; artH: number; cols: number; rows: number; tileW: number; tileH: number;
  slices: PqSlice[];
};
export type PqHit = { t: number; takeoff: number; land: number; x: number; takeoffX: number; landX: number; edge: number; jumpPx: number; jumpP: number; spring: boolean; targets: number };
/** One gem: a slice of a block popping at `at`. `hx` is the impact x (the bonk x for direct hits, the gem x for chain pops). */
export type PqPop = { cover: number; slice: number; at: number; depth: number; x: number; y: number; gemY: number; hit: number; hx: number };
/** A crumble tile; edgeR/edgeB mark tiles on the block's right or bottom outline. Burst tiles break into four flying quarters instead. */
export type PqTile = { x: number; y: number; w: number; h: number; tileW: number; tileH: number; start: number; delay: number; rot: number; edgeR: boolean; edgeB: boolean; pop: number; side: number; burst: boolean };
/** A debris chunk on an exact parabola: x + dx*u, y + a*u + b*u^2 (u in [0, 1] over its duration), turning `rot` degrees. */
export type PqChunk = { x: number; y: number; w: number; h: number; start: number; duration: number; dx: number; a: number; b: number; rot: number; tone: number; flash: boolean; act: number };
/** Sky kept over a block's bounce headroom from its shatter until its top row crumbles. */
export type PqHeadroom = PqBox & { start: number; end: number; act: number };
/** Dust puff; act -1 = mounted from the start. */
export type PqPuff = { x: number; y: number; at: number; big: boolean; act: number };
/**
 * The LEVEL CLEAR plate spans plateX..plateX + plateW (centred on screen unless that clips a name) around bannerY; the hero
 * stands on its top edge with its feet at (x, feetY), grown to `scale` (2, or 1.5, or 1 on Today when the bigger versions
 * would still hide card text). `pad` is the plate's padding above and below the text.
 */
export type PqFinale = { x: number; feetY: number; bannerY: number; plateX: number; cell: number; bob: number; pad: number; plateW: number; plateH: number; scale: number };
/** A firework burst centre, how far its rocket climbs to it, and its size (1, or smaller where a full burst would cross names). */
export type PqFirework = { x: number; y: number; climb: number; scale: number };
/** The final poof: its grid centre (px), its art cell (px) and which way its puffs fly apart. */
export type PqPoof = { x: number; y: number; cell: number; variant: PqPoofVariant };
export type PqPlan = {
  W: number; H: number; P: number; G: number; B0: number; E: number; headRest: number;
  chromeTop: number; chromeBottom: number; raised: boolean;
  sizes: string; hits: PqHit[]; x0: number; stopX: number; trophyX: number;
  /** Hero feet x at the grab: the held trophy (drawn right of the raised paw) lands exactly where the ground trophy stood. */
  grabX: number;
  covers: PqCover[]; labels: PqRect[];
  /** Holes in the sky (0..G): every on-screen card and table label shows through its own window. */
  holes: PqBox[];
  /** What must stay readable (card text lines, or card header strips, and labels): the finale banner and the HUD keep off it. */
  zones: PqZone[];
  pops: PqPop[]; tiles: PqTile[]; chunks: PqChunk[]; headrooms: PqHeadroom[]; dirt: PqChunk[]; puffs: PqPuff[];
  merge: number; hud: { x: number; y: number; w: number; h: number; gemX: number; gemY: number };
  /** The HUD slides up behind the header at this time. */
  hudOut: number;
  /**
   * The finale, its fireworks and its poof. A plan made with `deferFinale` holds a quick centred default here until
   * `placeFinale` fills in the searched placement in place (the stage runs it at PQ_T.finaleSearch): nothing may read
   * or memoise these before the finale acts mount, apart from heroPose after the grab.
   */
  finale: PqFinale;
  /** The three finale fireworks, each placed where it covers the least card text. */
  fireworks: PqFirework[];
  poof: PqPoof;
};

export function pixelUnit(height: number) { return Math.max(4, Math.min(9, Math.round(height * .0075))); }

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
function round3(value: number) { return Math.round(value * 1000) / 1000; }
export const pqEaseInOutCubic = (value: number) => { const x = clamp01(value); return x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };
export const overlapArea = (a: PqBox, b: PqBox) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

function compositions(total: number, parts: number, max: number): number[][] {
  const out: number[][] = [];
  const walk = (acc: number[], left: number) => {
    if (acc.length === parts) { if (left === 0) out.push(acc); return; }
    for (let size = 1; size <= Math.min(max, left - (parts - acc.length - 1)); size++) walk([...acc, size], left - size);
  };
  walk([], total);
  return out;
}

/** Fall time after the hit-stop for a jump of J px: longer drops take a little longer, but spring bonks still land before the next spring crouch. */
export function pqFallTime(P: number, jumpPx: number) { return .26 * (Math.max(0, jumpPx) / (14 * P)) ** .35; }

type Column = { cx: number; left: number; right: number; covers: PqCover[]; edge: number; jumpP: number; hittable: boolean; hit?: number; cuts?: number[]; sliceHits?: number[]; orphan?: boolean };
type DraftHit = { x: number; edge: number; targets: { col: Column; slice: number }[]; cuts?: number[] };

/**
 * The whole plan for a layout. With `deferFinale` the finale (LEVEL CLEAR placement, fireworks, poof) gets a quick
 * centred default instead of its search, so the first frame stays light; call `placeFinale(plan)` soon after (it is
 * first needed at 4.4 s) to fill in the real placement.
 */
export function pixelQuestPlan(input: PqLayoutInput, { deferFinale = false } = {}): PqPlan {
  const T = PQ_T;
  const W = Math.max(1, input.width);
  const H = Math.max(1, input.height);
  const P = pixelUnit(H);
  const chromeTop = input.chromeTop ?? 70;
  const chromeBottom = input.chromeBottom ?? H - 72;
  const E = 1.5 * P;
  const HEAD = PQ_HERO.headP * P;
  const BAND = PQ_HERO.bandP * P;
  let G = chromeBottom - PQ_HERO.groundInsetP * P;
  let B0 = G - BAND;
  let raised = false;

  const covers: PqCover[] = input.rects.map((rect, index) => {
    const visibleWidth = Math.min(W, rect.left + rect.width) - Math.max(0, rect.left);
    const onScreen = visibleWidth > 0 && rect.top + rect.height > 0 && rect.top < H && rect.width > 0 && rect.height > 0;
    return { ...rect, index, right: rect.left + rect.width, bottom: rect.top + rect.height, cx: rect.left + rect.width / 2, onScreen,
      visible: false, hittable: visibleWidth >= rect.width * .5, edge: 0, artH: 0, cols: 1, rows: 1, tileW: rect.width, tileH: rect.height, slices: [] };
  });
  const faceShows = (c: PqCover, band: number) => c.onScreen && c.top < band - 2 * P && c.bottom > chromeTop + 2 * P;
  // Raise the ground when every block ends well above the band (short Today tables).
  const candidates = covers.filter((c) => faceShows(c, B0) && c.hittable);
  if (candidates.length) {
    const lowest = Math.max(...candidates.map((c) => Math.min(c.bottom, B0)));
    if (lowest < B0 - 2 * P) { B0 = Math.round(lowest); G = B0 + BAND; raised = true; }
  }
  const headRest = G - HEAD;
  for (const c of covers) {
    c.visible = faceShows(c, B0);
    c.hittable = c.visible && c.hittable;
    c.edge = c.visible ? Math.min(c.bottom, B0) : c.top;
    // A card that ends just inside the band keeps its whole height of blocks (no squashed half-row over plain sky):
    // the hero's jump is a little shorter, and the hills stay well below it.
    if (c.visible && c.bottom > B0 && c.bottom - B0 <= PQ_LIMITS.bandSnapP * P && headRest - c.bottom >= PQ_LIMITS.minJumpP * P) c.edge = c.bottom;
    c.artH = Math.max(0, c.edge - c.top);
    c.cols = Math.max(1, Math.round(c.width / (PQ_LIMITS.tileP * P)));
    c.rows = Math.max(1, Math.round(c.artH / (PQ_LIMITS.tileP * P)));
    c.tileW = c.width / c.cols;
    c.tileH = c.artH / c.rows;
  }

  // 1. Columns of visible blocks.
  const visible = covers.filter((c) => c.visible);
  const minW = Math.min(Infinity, ...visible.map((c) => c.width));
  const columns: Column[] = [];
  for (const c of [...visible].sort((a, b) => a.cx - b.cx || a.top - b.top)) {
    const col = columns.find((k) => Math.abs(k.cx - c.cx) < minW * .25);
    if (col) { col.covers.push(c); col.left = Math.min(col.left, c.left); col.right = Math.max(col.right, c.right); }
    else columns.push({ cx: c.cx, left: c.left, right: c.right, covers: [c], edge: 0, jumpP: 0, hittable: false });
  }
  for (const col of columns) {
    col.edge = Math.max(...col.covers.map((c) => c.edge));
    col.jumpP = (headRest - col.edge) / P;
    col.hittable = col.covers.some((c) => c.hittable) && col.jumpP <= PQ_LIMITS.springJumpP && col.jumpP >= 0;
  }
  const bases = columns.filter((k) => k.hittable);
  const n = bases.length;

  // 2. Exactly four bonks, spread so the hero's pace stays even.
  const x0For = (h1: number) => Math.max(.04 * W + 7 * P, h1 - 30 * P);
  const trophyFor = (h4: number) => {
    // Stop near the right edge, but never so far past the last bonk that the final dash turns into a blur.
    let stop = Math.max(Math.min(W - Math.max(10 * P, .05 * W) - 12 * P, h4 + 28 * P), h4 + 4 * P);
    const trophy = Math.min(W - 6 * P, stop + 12 * P);
    stop = Math.max(Math.min(stop, trophy - 16 * P), h4);
    return { stop, trophy };
  };
  const clampX = (x: number) => clamp(x, 6 * P, W - 6 * P);
  const hitsFor = (sizes: number[]): DraftHit[] => {
    const out: DraftHit[] = [];
    if (n < 4) {
      sizes.forEach((m, i) => {
        const col = bases[i];
        const tiles = Math.max(1, Math.min(...col.covers.map((c) => c.cols)));
        // A block narrower than its share of bonks breaks one tile per bonk; spare bonks re-bonk the cleared spot.
        const slices = Math.min(m, tiles);
        const cuts: number[] = [];
        for (let j = 1; j < slices; j++) cuts.push(Math.round(j * tiles / slices) / tiles);
        const bounds = [0, ...cuts, 1];
        const lastCentre = (bounds[slices - 1] + 1) / 2;
        for (let j = 0; j < m; j++) {
          const at = j < slices ? (bounds[j] + bounds[j + 1]) / 2 : lastCentre + (1 - lastCentre) * (j - slices + 1) / (m - slices + 1);
          out.push({ x: clampX(col.left + (col.right - col.left) * at), edge: col.edge, targets: j < slices ? [{ col, slice: j }] : [], cuts });
        }
      });
    } else {
      let at = 0;
      for (const size of sizes) {
        const group = bases.slice(at, at + size);
        at += size;
        const x = size === 1 ? group[0].cx : size % 2 === 0 ? (group[size / 2 - 1].right + group[size / 2].left) / 2 : group[(size - 1) / 2].cx;
        out.push({ x: clampX(x), edge: Math.max(...group.map((k) => k.edge)), targets: group.map((col) => ({ col, slice: 0 })) });
      }
    }
    return out;
  };
  const speedsFor = (draft: DraftHit[]) => {
    const x0 = x0For(draft[0].x);
    const { stop } = trophyFor(draft[3].x);
    return [(draft[0].x - x0) / (T.hits[0] - T.go), ...draft.slice(1).map((h, i) => (h.x - draft[i].x) / (T.hits[i + 1] - T.hits[i] - T.hitStop)), (stop - draft[3].x) / (T.stopBy - T.hits[3] - T.hitStop)];
  };
  let draft: DraftHit[];
  let sizes = '-';
  if (n === 0) {
    draft = [.2, .4, .6, .8].map((f) => ({ x: W * f, edge: B0, targets: [] }));
  } else {
    // Validate the tiny cut slices: a 1-tile-wide card cannot split into more slices than tiles.
    const options = n < 4 ? compositions(4, n, 4) : compositions(n, 4, Math.max(2, Math.ceil(n / 4)));
    let best: { score: number; key: string; draft: DraftHit[] } | null = null;
    for (const option of options) {
      const candidate = hitsFor(option);
      const speeds = speedsFor(candidate);
      const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      const degenerate = n < 4 && option.some((m, i) => m > Math.max(1, Math.min(...bases[i].covers.map((c) => c.cols))));
      const score = speeds.reduce((a, s) => a + (s - mean) ** 2, 0) / speeds.length + (Math.min(...speeds) < 0 ? 1e9 : 0) + (degenerate ? 1e12 : 0);
      const key = option.join('');
      if (!best || score < best.score - 1e-6 || (Math.abs(score - best.score) <= 1e-6 && key < best.key)) best = { score, key, draft: candidate };
    }
    draft = best!.draft;
    sizes = best!.key;
  }

  const { stop: stopX, trophy: trophyX } = trophyFor(draft[3].x);
  const x0 = x0For(draft[0].x);
  const hits: PqHit[] = draft.map((h, k) => {
    const jumpPx = headRest - h.edge;
    const t = T.hits[k];
    return { t, takeoff: t - T.rise, land: t + T.hitStop + pqFallTime(P, jumpPx), x: h.x, takeoffX: 0, landX: 0, edge: h.edge, jumpPx, jumpP: jumpPx / P, spring: jumpPx / P > PQ_LIMITS.normalJumpP, targets: h.targets.length };
  });
  draft.forEach((h, k) => {
    for (const { col, slice } of h.targets) {
      col.hit ??= k;
      if (h.cuts) col.cuts = h.cuts;
      col.sliceHits ??= [];
      col.sliceHits[slice] = k;
    }
  });

  // 3. Orphans (too high, or a sliver at the screen edge) ride the nearest hit.
  for (const col of columns) if (col.hit === undefined) {
    let bestK = 0;
    for (let k = 1; k < hits.length; k++) if (Math.abs(hits[k].x - col.cx) < Math.abs(hits[bestK].x - col.cx)) bestK = k;
    col.hit = bestK; col.orphan = true; col.sliceHits = [bestK];
  }

  // 4. Chain pops, lowest block first.
  const pops: PqPop[] = [];
  for (const col of columns) {
    const sorted = [...col.covers].sort((a, b) => b.edge - a.edge || a.top - b.top);
    sorted.forEach((c, depth) => {
      const d = depth + (col.orphan ? 1 : 0);
      const bounds = [0, ...(col.cuts ?? []), 1];
      c.slices = [];
      for (let j = 0; j < bounds.length - 1; j++) {
        const hit = col.sliceHits?.[j] ?? col.hit!;
        const at = round3(T.hits[hit] + Math.min(d, T.maxChainDepth) * T.chainStep);
        const hint = hintOffset(c, bounds[j], bounds[j + 1]);
        c.slices.push({ from: bounds[j], to: bounds[j + 1], at, hint });
        const x = clamp(c.left + hint, 4 * P, W - 4 * P);
        // A direct hit breaks from the bonk point (clamped into this slice); a chain pop breaks from its gem.
        const hx = d === 0 ? clamp(draft[hit].x, c.left + bounds[j] * c.width, c.left + bounds[j + 1] * c.width) : x;
        pops.push({ cover: c.index, slice: j, at, depth: d, x, y: c.edge, gemY: c.edge - c.tileH / 2, hit, hx });
      }
    });
  }
  for (const c of covers) if (!c.visible) {
    let nearest: Column | null = null;
    for (const k of columns) if (!nearest || Math.abs(k.cx - c.cx) < Math.abs(nearest.cx - c.cx)) nearest = k;
    c.slices = [{ from: 0, to: 1, at: c.onScreen && nearest ? T.hits[nearest.hit!] : T.offscreenVanish, hint: c.width / 2 }];
  }

  // 5. Hero path keys: where each jump takes off and lands.
  const grabX = trophyX - PQ_CHEER_TROPHY_CENTRE_P * P;
  const partial = { P, G, headRest, x0, stopX, trophyX, grabX, hits, W, H } as PqPlan;
  for (const h of hits) { h.takeoffX = heroX(partial, h.takeoff); h.landX = heroX(partial, h.land); }

  // 6. Crumble tiles (merged k x k past the budget). Near each impact, a few tiles burst into flying quarters.
  let tileCount = 0;
  for (const p of pops) { const c = covers[p.cover]; const s = c.slices[p.slice]; tileCount += Math.max(1, Math.round((s.to - s.from) * c.cols)) * c.rows; }
  let merge = 1;
  while (Math.ceil(tileCount / (merge * merge)) > PQ_LIMITS.maxTiles) merge++;
  const tiles: PqTile[] = [];
  pops.forEach((p, i) => tiles.push(...crumbleTiles(P, p, covers[p.cover], merge, i)));
  const chunks = assignBursts(P, pops, tiles, chromeBottom);

  // Sky over each block's bounce headroom until its top row crumbles, so no page strip shows above intact tiles.
  const headrooms: PqHeadroom[] = pops.map((p, i) => {
    const c = covers[p.cover];
    const s = c.slices[p.slice];
    const start = round3(p.at + T.shatterDelay);
    const top = tiles.filter((tile) => tile.pop === i && Math.abs(tile.y - c.top) < .01 && !tile.burst);
    const end = round3(start + Math.max(0, ...top.map((tile) => tile.delay)) + .034);
    return { x: c.left + s.from * c.width, y: c.top - E, w: (s.to - s.from) * c.width, h: E, start, end, act: p.hit };
  });

  // Dust: the landing after the spawn, push-off, every landing.
  const puffs: PqPuff[] = [{ x: x0, y: G, at: T.heroLand, big: false, act: -1 }, { x: x0 - 3 * P, y: G, at: T.go + .02, big: false, act: -1 }];
  hits.forEach((h, k) => puffs.push({ x: h.landX, y: G, at: round3(h.land), big: h.spring, act: k }));

  // 7. Sky holes, header zones, HUD and the finale placement.
  const labels = (input.labels ?? []).filter((l) => l.width > 0 && l.height > 0 && l.left < W && l.left + l.width > 0 && l.top < G && l.top + l.height > 0).map((l) => ({ ...l }));
  const holes: PqBox[] = [];
  for (const c of covers) if (c.onScreen && c.top < G) {
    const hole = skyWindow(c, E, G);
    if (hole.h > 1) holes.push(hole);
  }
  for (const l of labels) holes.push({ x: l.left, y: Math.max(0, l.top), w: l.width, h: Math.min(l.top + l.height, G) - Math.max(0, l.top) });
  // Text gets a little breathing room; a line in a card's header strip (its title) weighs triple. Without measured
  // text, each card's header strip stands in.
  const headerStrip = (c: PqCover) => ({ x: c.left, y: c.top, w: c.width, h: Math.min(c.height, Math.max(64, 10 * P)) });
  const onScreenCovers = covers.filter((c) => c.onScreen);
  const zones: PqZone[] = [
    ...(input.texts ? input.texts.filter((r) => r.width > 0 && r.height > 0).map((r) => {
      const box = { x: r.left - P, y: r.top - P / 2, w: r.width + 2 * P, h: r.height + P };
      const title = onScreenCovers.some((c) => overlapArea({ x: r.left, y: r.top, w: r.width, h: r.height }, headerStrip(c)) > .5 * r.width * r.height);
      return { ...box, weight: title ? 3 : 1, line: { x: r.left, y: r.top, w: r.width, h: r.height } };
    }) : onScreenCovers.map((c) => ({ ...headerStrip(c), weight: 3 }))),
    ...labels.map((l) => ({ x: l.left, y: l.top, w: l.width, h: l.height, weight: 3 })),
  ];

  const hudW = 27 * P;
  const hudH = 10 * P;
  const hud = { x: W - 24 - hudW, y: chromeTop + 1.5 * P, w: hudW, h: hudH, gemX: W - 24 - hudW + 5.5 * P, gemY: chromeTop + 1.5 * P + 5 * P };
  const lastArrival = Math.max(0, ...pops.map((p) => p.at + T.gemRise + T.gemFly));
  const hudHides = zones.some((z) => overlapArea({ x: hud.x, y: hud.y, w: hud.w, h: hud.h }, z) > 0);
  const hudOut = hudHides ? round3(clamp(lastArrival + T.hudHold, T.hudOutMin, T.uiOut)) : T.uiOut;

  const dirt = collapseDirt(P, W, G, chromeBottom);
  const plan: PqPlan = { W, H, P, G, B0, E, headRest, chromeTop, chromeBottom, raised, sizes, hits, x0, stopX, trophyX, grabX, covers, labels, holes, zones, pops, tiles, chunks, headrooms, dirt, puffs, merge, hud, hudOut,
    finale: undefined as unknown as PqFinale, fireworks: [], poof: undefined as unknown as PqPoof };
  return placeFinale(plan, !deferFinale);
}

/**
 * LEVEL CLEAR, the fireworks and the poof, placed around the card text (in place). Without `search` it is a quick
 * default: the big finale centred at its preferred height and the fireworks at their home spots.
 */
export function placeFinale(plan: PqPlan, search = true): PqPlan {
  const { W, H, P, G, B0, chromeTop, chromeBottom, zones, hud } = plan;
  const finale = finaleLayout(W, H, P, G, chromeTop, zones, search);
  const poof = poofPlacement(W, P, chromeTop, chromeBottom, finale, search ? zones : []);
  // The fireworks keep off card text, the banner, the hero, the poof, and the HUD while it stays.
  const avoid = [finalePlate(finale), ...(plan.hudOut >= PQ_T.uiOut ? [{ x: hud.x, y: hud.y, w: hud.w, h: hud.h }] : [])];
  const fireworks = fireworkSpots(W, H, P, chromeTop, B0, search ? zones : [], avoid, finaleHeroShape(P, finale.x, finale.feetY, finale.scale), [poofBloomBox(poof)], search);
  plan.finale = finale;
  plan.poof = poof;
  plan.fireworks = fireworks;
  return plan;
}

/** The HUD count to show once n of `total` gems have landed. A count ending in 6 waits for the next gem and the counter
 *  ticks by two, so it never shows a 6 followed by a 7 (nor 67). */
export function pqHudShown(n: number, total: number) {
  let shown = Math.min(n, total);
  if (shown % 10 === 6 && shown < total) shown--;
  if (shown === 67) shown = 65;
  return Math.min(99, shown);
}

/**
 * A card's window in the sky. It stays 1 px inside the cover on the sides and the bottom: the browser snaps the cover's
 * edges to whole pixels, so a window reaching the cover's fractional edge would leave a 1 px line of card border showing.
 * The top starts inside the cover's bounce strip (blocks) or at the card (band cards, whose cover starts E higher).
 */
export function skyWindow(c: Pick<PqCover, 'left' | 'top' | 'width' | 'bottom' | 'visible'>, E: number, G: number): PqBox {
  const top = Math.max(0, c.visible ? c.top - E + 1 : c.top);
  const bottom = c.bottom < G ? Math.round(c.bottom) - 1 : G;
  return { x: c.left + 1, y: top, w: Math.max(0, c.width - 2), h: Math.max(0, bottom - top) };
}

/** Centre of the tile nearest the middle of a slice, in px from the cover's left edge. */
export function hintOffset(cover: Pick<PqCover, 'cols' | 'tileW'>, from: number, to: number) {
  const c0 = Math.round(from * cover.cols);
  const c1 = Math.max(c0 + 1, Math.round(to * cover.cols));
  return (Math.floor((c0 + c1 - 1) / 2) + .5) * cover.tileW;
}

/** Where the celebrating hero's feet would float with no card text to avoid; the banner centre sits 12P below. */
export function finaleFeetY(H: number, P: number) { return H * .4 + 16 * P; }

/** The finale hero with its held trophy at `scale`, feet at (x, feet), from its raised paw to the trophy: 23 x 18 art pixels. */
export function finaleHeroBox(P: number, x: number, feet: number, scale = 2): PqBox {
  const s = P * scale;
  return { x: x - 8 * s, y: feet - 18 * s, w: 23 * s, h: 18 * s };
}

/**
 * The same hero as the boxes its cheer pose really fills (in art pixels, from the sprite's top-left corner): the ears
 * with the trophy's rim, the head, the body with the free paw, and the held trophy. The empty corners beside the ears and
 * above the paw stay usable, so the hero can stand right next to a name.
 */
export function finaleHeroShape(P: number, x: number, feet: number, scale = 2): PqBox[] {
  const s = P * scale;
  const box = (c0: number, r0: number, c1: number, r1: number) => ({ x: x + (c0 - 8) * s, y: feet + (r0 - 16) * s, w: (c1 - c0) * s, h: (r1 - r0) * s });
  return [box(3, -2, 16, 5), box(1, 5, 16, 11), box(0, 11, 16, 16), box(16, -2, 23, 10)];
}

/** LEVEL CLEAR sizes, biggest first: the hero's final scale, the banner's glyph cell and its padding above and below, in P. */
export const PQ_FINALE_SIZES = [
  { scale: 2, cellP: 2, padP: 3 },
  { scale: 1.5, cellP: 1.5, padP: 2.5 },
  { scale: 1.5, cellP: 1, padP: 2 },
  // Last resorts for Today tables whose last row reaches the plate: a 1x hero, used only while a 1.5x one hides a title.
  { scale: 1, cellP: 1.5, padP: 2 },
  { scale: 1, cellP: 1, padP: 2 },
] as const;

/** The LEVEL CLEAR plate's box. */
export function finalePlate(finale: PqFinale): PqBox {
  return { x: finale.plateX, y: finale.bannerY - finale.plateH / 2, w: finale.plateW, h: finale.plateH };
}

/**
 * Weighted text a box covers, where a line whose letters it clips counts as the whole line: a name with its last letter
 * cut off is as hard to read as a hidden one, so clipping one costs more than moving (or shrinking) the finale. Touching
 * only the breathing room round a line costs just that area.
 */
function lineCost(box: PqBox, zone: PqZone) {
  const area = overlapArea(box, zone);
  if (area <= 0) return 0;
  return zone.weight * (zone.line && overlapArea(box, zone.line) > 0 ? zone.w * zone.h : area);
}

/** Card text the plate and the hero cover: raw weighted area, raw title area, and the line-counted score. */
export function finaleCover(P: number, finale: PqFinale, zones: readonly PqZone[]) {
  const boxes = [finalePlate(finale), ...finaleHeroShape(P, finale.x, finale.feetY, finale.scale)];
  let text = 0;
  let titles = 0;
  let score = 0;
  for (const zone of zones) {
    let area = 0;
    for (const box of boxes) area += overlapArea(box, zone);
    text += zone.weight * area;
    if (zone.weight > 1) titles += area;
    for (const box of boxes) score += lineCost(box, zone);
  }
  return { text, titles, score };
}

/**
 * LEVEL CLEAR placement. The banner prefers 0.40H but slides up or down (and a little sideways) to wherever its plate
 * covers the least card text (names, titles, table labels); the hero, standing on the plate's top edge, then picks the
 * spot along it that covers the least, preferring the middle. When the big version still hides text, a smaller hero
 * (1.5x) and banner that fit a gap between the rows win, so every team's name, and the picked student's name, stays
 * readable; on a Today table whose rows reach the plate, a 1x hero is the last resort. Without `search` it is the big
 * finale, centred at its preferred height.
 */
export function finaleLayout(W: number, H: number, P: number, G: number, chromeTop: number, zones: readonly PqZone[], search = true): PqFinale {
  let best = finalePlacement(W, H, P, G, chromeTop, zones, PQ_FINALE_SIZES[0], search);
  if (!search) return best;
  let cover = finaleCover(P, best, zones);
  let bestScore = cover.score;
  for (let i = 1; i < PQ_FINALE_SIZES.length && bestScore > 0; i++) {
    const size = PQ_FINALE_SIZES[i];
    if (size.scale < 1.5 && cover.titles <= 0) continue;
    const finale = finalePlacement(W, H, P, G, chromeTop, zones, size, true);
    const next = finaleCover(P, finale, zones);
    // A smaller finale has to earn its place: it must uncover at least a short name line more than the bigger one.
    const score = next.score + i * 24 * P * P;
    if (score < bestScore - 1e-6) { best = finale; bestScore = score; cover = next; }
  }
  return best;
}

function finalePlacement(W: number, H: number, P: number, G: number, chromeTop: number, zones: readonly PqZone[], size: (typeof PQ_FINALE_SIZES)[number], search: boolean): PqFinale {
  const { scale } = size;
  const s = scale * P;
  const cell = Math.max(2, Math.min(Math.round(size.cellP * P), Math.floor(.86 * W / 71)));
  const bob = Math.max(1, Math.round(cell / 3));
  const pad = Math.round(size.padP * P);
  const plateW = 71 * cell + 8 * P;
  // An even plate height keeps its top edge (where the hero stands) on a whole pixel.
  const plateH = 2 * Math.ceil((7 * cell + 2 * pad + bob) / 2);
  const preferred = Math.min(finaleFeetY(H, P), G - 6 * P) + 12 * P;
  // The hero stands on the plate's top edge; its held trophy tops out 18 art pixels above the feet.
  const minY = chromeTop + P + 18 * s + plateH / 2;
  const maxY = G - 2 * P - plateH / 2;
  // The plate is centred, but may slide sideways by up to 12P (staying 2P inside the screen) to clear a name it clips.
  const centreX = Math.round(W / 2 - plateW / 2);
  const reach = search ? Math.max(0, Math.min(12 * P, centreX - 2 * P)) : 0;
  const shifts: number[] = [];
  for (let d = 2 * P; d <= reach + EPS_PX; d += 2 * P) shifts.push(-d, d);
  const plateText = (y: number, px: number, near: readonly PqZone[] = zones) => {
    const plate = { x: px, y: y - plateH / 2, w: plateW, h: plateH };
    let cost = 0;
    for (const zone of near) cost += lineCost(plate, zone);
    return 3 * cost;
  };
  const plateCost = (y: number, px: number, text: number) => text + Math.abs(y - preferred) * plateW * .05 + Math.abs(px - centreX) * plateH * .5;
  // The hero's cost at each x along one plate height, cached: sideways plate shifts reuse it.
  const heroValues = new Map<number, { near: PqZone[]; values: Map<number, number> }>();
  const spread = (x: number) => Math.abs(x - W / 2) * 22 * s * .03;
  /** The hero's best spot on a plate at (y, px), and its cost; `budget` stops the search once nothing can beat it. */
  const heroCost = (y: number, px: number, budget = Infinity) => {
    const feet = y - plateH / 2;
    let row = heroValues.get(y);
    if (!row) { row = { near: zones.filter((zone) => zone.y < feet && zone.y + zone.h > feet - 18 * s), values: new Map() }; heroValues.set(y, row); }
    const { near, values } = row;
    // The hero stands on the plate, and it and its trophy stay on screen.
    const xMin = Math.max(px + 7 * s, 8 * s);
    const xMax = Math.min(px + plateW - 15 * s, W - 15.5 * s);
    let bestX = W / 2;
    let bestCost = Infinity;
    const value = (x: number) => {
      let v = values.get(x);
      if (v === undefined) {
        const shape = finaleHeroShape(P, x, feet, scale);
        let cost = 0;
        for (const zone of near) for (const box of shape) cost += lineCost(box, zone);
        v = 2 * cost + spread(x);
        values.set(x, v);
      }
      return v;
    };
    const tryX = (x: number) => { const v = value(x); if (v < bestCost - 1e-6) { bestCost = v; bestX = x; } };
    if (xMax < xMin) tryX(clamp(W / 2, 8 * s, W - 15.5 * s));
    else {
      // Every 2P outward from the middle, stopping each way once the distance alone costs more than the best (or the
      // budget); then the art pixel either side of the best.
      const mid = clamp(W / 2, xMin, xMax);
      tryX(mid);
      if (search && bestCost > spread(mid) + 1e-6) {
        for (const dir of [-1, 1]) for (let x = mid + dir * 2 * P; x >= xMin && x <= xMax && spread(x) < Math.min(bestCost, budget); x += dir * 2 * P) tryX(x);
        const coarse = bestX;
        for (const x of [coarse - P, coarse + P]) if (x >= xMin && x <= xMax) tryX(x);
      }
    }
    return { x: bestX, cost: bestCost };
  };
  let bannerY = Math.round(maxY >= minY ? clamp(preferred, minY, maxY) : Math.min(preferred, maxY));
  let plateX = centreX;
  let hero = heroCost(bannerY, plateX);
  if (search && maxY >= minY) {
    // Branch and bound: try spots in order of plate cost, and stop once the plate alone costs more than the best total.
    let bestCost = plateCost(bannerY, plateX, plateText(bannerY, plateX)) + hero.cost;
    const spots: { y: number; px: number; plate: number }[] = [];
    const step = Math.max(1, Math.round(P / 3));
    for (let y = Math.ceil(minY); y <= maxY; y += step) {
      const near = zones.filter((zone) => zone.y < y + plateH / 2 && zone.y + zone.h > y - plateH / 2);
      const text = plateText(y, centreX, near);
      const plate = plateCost(y, centreX, text);
      // Spots whose plate alone costs more than the default spot's total can never win.
      if (plate < bestCost) spots.push({ y, px: centreX, plate });
      // Sideways shifts only matter where the centred plate covers text.
      if (text > 0) for (const d of shifts) {
        const shifted = plateCost(y, centreX + d, plateText(y, centreX + d, near));
        if (shifted < bestCost) spots.push({ y, px: centreX + d, plate: shifted });
      }
    }
    spots.sort((a, b) => a.plate - b.plate || a.y - b.y || Math.abs(a.px - centreX) - Math.abs(b.px - centreX) || a.px - b.px);
    for (const { y, px, plate } of spots) {
      if (plate >= bestCost - 1e-6) break;
      const candidate = heroCost(y, px, bestCost - plate);
      if (plate + candidate.cost < bestCost - 1e-6) { bannerY = y; plateX = px; hero = candidate; bestCost = plate + candidate.cost; }
    }
  }
  // Feet on whole pixels, exactly on the plate's top edge.
  const plateTop = bannerY - plateH / 2;
  return { x: Math.round(hero.x), feetY: plateTop, bannerY, plateX, cell, bob, pad, plateW, plateH, scale };
}

/** Burst centres by default, as fractions of the screen, and the band of x each burst may search. */
const FIREWORK_HOMES = [{ at: [.2, .24], span: [.06, .36] }, { at: [.8, .2], span: [.64, .94] }, { at: [.5, .16], span: [.36, .64] }] as const;
/** A burst reaches this far (in P) from its centre, and droops 6P more. */
export const PQ_FIREWORK_REACH_P = 17;
/** Where a full burst would still cross card text (Today's tables), a smaller one this size fits a cell's empty end. */
export const PQ_FIREWORK_SMALL = .6;
export function fireworkBox(P: number, x: number, y: number, scale = 1): PqBox {
  const r = PQ_FIREWORK_REACH_P * P * scale;
  return { x: x - r, y: y - r, w: 2 * r, h: 2 * r + 6 * P * scale };
}

/**
 * Three burst centres, one per third of the screen, each where it covers the least card text (then the least banner and
 * hero). The last burst's sparks linger into the wind-up squash and the poof, so it keeps well off the hero and the poof.
 * Where the best full-size spot still crosses text, a smaller burst in a slightly wider band gets a try.
 */
export function fireworkSpots(W: number, H: number, P: number, chromeTop: number, B0: number, zones: readonly PqZone[], avoid: readonly PqBox[], hero: readonly PqBox[] = [], poof: readonly PqBox[] = [], search = true): PqFirework[] {
  const last = FIREWORK_HOMES.length - 1;
  return FIREWORK_HOMES.map(({ at: [fx, fy], span: [a, b] }, burst) => {
    const heroWeight = burst === last ? 3 : .5;
    const spot = (scale: number, lo: number, hi: number) => {
      const r = PQ_FIREWORK_REACH_P * P * scale;
      const yMin = chromeTop + r + P;
      const yMax = Math.max(yMin, B0 - r - 6 * P * scale);
      const home = { x: clamp(fx * W, r, W - r), y: clamp(fy * H, yMin, yMax) };
      const costAt = (x: number, y: number) => {
        const box = fireworkBox(P, x, y, scale);
        let text = 0;
        for (const zone of zones) text += zone.weight * overlapArea(box, zone);
        let cost = text + Math.hypot(x - home.x, y - home.y) * P * .5;
        // Sparks over the plate matter less than sparks over a name.
        for (const other of avoid) cost += .5 * overlapArea(box, other);
        for (const part of hero) cost += heroWeight * overlapArea(box, part);
        if (burst === last) for (const part of poof) cost += overlapArea(box, part);
        return { cost, text };
      };
      let best = { ...home, ...costAt(home.x, home.y) };
      if (search) {
        const x0 = Math.max(r, lo * W);
        const x1 = Math.min(W - r, hi * W);
        for (let x = x0; x <= x1 + EPS_PX; x += 2 * P) for (let y = yMin; y <= yMax + EPS_PX; y += 2 * P) {
          const next = costAt(x, y);
          if (next.cost < best.cost - 1e-6) best = { x, y, ...next };
        }
      }
      return { ...best, scale };
    };
    let best = spot(1, a, b);
    // A smaller burst only where the full one would cross about half a name line or more, and only if it clears most of it.
    if (search && best.text > 30 * P * P) {
      const small = spot(PQ_FIREWORK_SMALL, Math.max(0, a - .08), Math.min(1, b + .08));
      if (small.text < best.text * .5) best = small;
    }
    const x = Math.round(best.x);
    const y = Math.round(best.y);
    return { x, y, climb: Math.max(0, Math.min(24 * P, B0 - y)), scale: best.scale };
  });
}

/**
 * The poof sits on the hero and its trophy at the top of the stretch hop, drawn a little finer than the hero (0.85 of
 * its art pixel, so the bloom is about 1.05x the hero and trophy). Its bloom twinkles and puffs fly apart in whichever
 * direction covers the least card text and stays on screen, trying the most open burst first; where names crowd in on
 * every side, the "in" set keeps everything inside the bloom's outline.
 */
export function poofPlacement(W: number, P: number, chromeTop: number, chromeBottom: number, finale: PqFinale, zones: readonly PqZone[]): PqPoof {
  const s = Math.floor(P * finale.scale);
  const cell = Math.max(2, Math.floor(.85 * s));
  const x0 = finale.x + 4 * s;
  const y0 = finale.feetY - 4 * P - 9 * s;
  const { w, h, cx, cy } = PQ_POOF_GRID;
  // Only the text near the poof's grid can matter.
  const grid = { x: x0 - (cx + 3) * cell, y: y0 - (cy + 3) * cell, w: (w + 6) * cell, h: (h + 6) * cell };
  const near = zones.filter((zone) => overlapArea(grid, zone) > 0);
  const screen = { x: 0, y: chromeTop, w: W, h: chromeBottom - chromeTop };
  let best: PqPoof = { x: x0, y: y0, cell, variant: 'out' };
  let bestCost = Infinity;
  for (const variant of PQ_POOF_VARIANTS) {
    // The cloud may sit a cell or two off the hero's centre (and a little higher) where that clears a name: the hero has
    // just vanished into it, so a nudge that small never reads.
    for (const [dx, dy] of POOF_NUDGES) {
      const x = x0 + dx * cell;
      const y = y0 + dy * cell;
      let cost = (Math.abs(dx) + Math.abs(dy)) * cell * cell;
      for (const frames of POOF_RUNS[variant]) for (const run of frames) {
        const box = { x: x + run.x * cell, y: y + run.y * cell, w: run.w * cell, h: cell };
        for (const zone of near) cost += zone.weight * overlapArea(box, zone);
        // Puffs lost off screen, or under the header or footer, don't read either.
        cost += .5 * (box.w * box.h - overlapArea(box, screen));
      }
      if (cost < bestCost - 1e-6) { bestCost = cost; best = { x, y, cell, variant }; }
    }
  }
  return best;
}
/** Poof offsets the placement may try, in cells (nearest first). */
const POOF_NUDGES: readonly (readonly [number, number])[] = [[0, 0], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1], [-2, 0], [2, 0], [0, -2], [-2, -1], [2, -1]];
/** The painted cells of every poof frame, as row runs (cells from the grid centre). */
const POOF_RUNS = Object.fromEntries(PQ_POOF_VARIANTS.map((variant) => [variant, PQ_POOF_SETS[variant].map((rows) => poofFootprint(rows))])) as Record<PqPoofVariant, PqBox[][]>;
/** The poof's bloom frame bounds (px): where the last firework keeps its sparks off. */
export function poofBloomBox(poof: PqPoof): PqBox {
  const runs = POOF_RUNS[poof.variant][1];
  const x0 = Math.min(...runs.map((run) => run.x));
  const x1 = Math.max(...runs.map((run) => run.x + run.w));
  const y0 = Math.min(...runs.map((run) => run.y));
  const y1 = Math.max(...runs.map((run) => run.y + run.h));
  return { x: poof.x + x0 * poof.cell, y: poof.y + y0 * poof.cell, w: (x1 - x0) * poof.cell, h: (y1 - y0) * poof.cell };
}
const EPS_PX = 1e-6;

/** Crumble wave: every tile of the slice's visible art pops in place, radiating from the impact. */
export function crumbleTiles(P: number, pop: PqPop, cover: PqCover, merge = 1, popIndex = 0): PqTile[] {
  const slice = cover.slices[pop.slice];
  const c0 = Math.round(slice.from * cover.cols);
  const c1 = Math.max(c0 + 1, Math.round(slice.to * cover.cols));
  const out: PqTile[] = [];
  const start = round3(pop.at + PQ_T.shatterDelay);
  // A little jitter in timing and tilt breaks the grid, so the wave reads as rubble, not a dissolve.
  const random = seededRandom(0x7117 + cover.index * 31 + pop.slice * 7);
  for (let r = 0; r < cover.rows; r += merge) for (let c = c0; c < c1; c += merge) {
    const x = cover.left + c * cover.tileW;
    const y = cover.top + r * cover.tileH;
    const w = Math.min(merge, c1 - c) * cover.tileW;
    const h = Math.min(merge, cover.rows - r) * cover.tileH;
    const cx = x + w / 2;
    const dist = Math.hypot(cx - pop.hx, y + h / 2 - pop.y);
    const side = Math.abs(cx - pop.hx) < w * .25 ? (c % 2 ? 1 : -1) : Math.sign(cx - pop.hx);
    const delay = round3(Math.min(.3, dist / (360 * P) + random() * .04));
    const rot = Math.round((side || 1) * (5 + random() * 12) * (random() < .25 ? -1 : 1));
    out.push({ x, y, w, h, tileW: cover.tileW, tileH: cover.tileH, start, delay, rot, edgeR: c + merge >= cover.cols, edgeB: r + merge >= cover.rows, pop: popIndex, side, burst: false });
  }
  return out;
}

export const PQ_GRAVITY_P = 560;

/**
 * The bottom-row tiles nearest each impact burst into 2x2 quarters that fly out and fall behind the footer.
 * Every pop gets one burst tile while the budget lasts (direct hits first), then direct hits get up to three.
 */
function assignBursts(P: number, pops: PqPop[], tiles: PqTile[], floor: number): PqChunk[] {
  let budget = Math.floor(PQ_LIMITS.maxChunks / 4);
  const order = pops.map((_, i) => i).sort((a, b) => pops[a].depth - pops[b].depth || pops[a].at - pops[b].at || a - b);
  const candidates = pops.map((pop, i) => tiles.filter((tile) => tile.pop === i && tile.edgeB)
    .sort((a, b) => Math.abs(a.x + a.w / 2 - pop.hx) - Math.abs(b.x + b.w / 2 - pop.hx) || a.x - b.x));
  const taken = pops.map(() => 0);
  for (const i of order) if (budget > 0 && candidates[i].length) { taken[i] = 1; budget--; }
  for (let round = 1; round < 3; round++) for (const i of order) if (pops[i].depth === 0 && budget > 0 && candidates[i].length > round) { taken[i]++; budget--; }
  const chunks: PqChunk[] = [];
  pops.forEach((pop, i) => candidates[i].slice(0, taken[i]).forEach((tile, k) => {
    tile.burst = true;
    chunks.push(...burstChunks(P, tile, pop, floor, 0x5eed + i * 97 + k * 13));
  }));
  return chunks;
}

/** Four quarters of a tile: they flash white for two frames, then fly up and outward from the impact and fall. */
export function burstChunks(P: number, tile: PqTile, pop: PqPop, floor: number, seed: number): PqChunk[] {
  const random = seededRandom(seed);
  const g = PQ_GRAVITY_P * P;
  const w = tile.w / 2;
  const h = tile.h / 2;
  const out: PqChunk[] = [];
  for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 2; qx++) {
    const x = tile.x + qx * w;
    const y = tile.y + qy * h;
    const off = x + w / 2 - pop.hx;
    const dir = Math.abs(off) < w * .5 ? (qx ? 1 : -1) : Math.sign(off);
    const vx = dir * (16 + 20 * Math.min(2, Math.abs(off) / tile.tileW) + random() * 14) * P;
    const vy = -((qy ? 48 : 70) + random() * 24) * P;
    const drop = floor + h - y;
    const duration = Math.min(1, (-vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, drop))) / g);
    out.push({ x, y, w, h, start: tile.start, duration: round3(duration), dx: vx * duration, a: vy * duration, b: .5 * g * duration * duration,
      rot: Math.round(dir * (14 + random() * 26)), tone: (qx + qy) % 3, flash: true, act: pop.hit });
  }
  return out;
}

/** A stepped hill in the ground band: left x, width and height (px), standing on the ground line. */
export type PqHill = { x: number; w: number; h: number };
/** A bush on the ground line: left x and width (px); it is 4P tall. */
export type PqBush = { x: number; w: number };
/** Hills are never lower than this (in P), or their steps lose their shape; where a name needs more room, they go. */
export const PQ_HILL_MIN_P = 5;

/**
 * The hills and bushes in front of the cards' lower ends. They keep below every line of card text (and table label) by
 * a pixel of art: a hill over a name is lowered, or left out when even a low one would touch it, so a name revealed in a
 * bottom-row card never waits behind the scenery for the collapse. Only text reaching into the ground strip itself stays
 * hidden until then.
 */
export function pqScenery(plan: Pick<PqPlan, 'W' | 'P' | 'G' | 'zones'>): { hills: PqHill[]; bushes: PqBush[] } {
  const { W, P, G } = plan;
  const random = seededRandom(0x4112 + Math.round(W));
  const texts = plan.zones.map((zone) => zone.line ?? zone).filter((box) => box.y < G && box.y + box.h > G - 14 * P);
  /** How tall scenery spanning [x, x + w] may stand before it touches text (Infinity when nothing is above it). */
  const room = (x: number, w: number) => {
    let top = Infinity;
    for (const box of texts) if (box.x < x + w + P && box.x + box.w > x - P) top = Math.min(top, G - Math.min(G, box.y + box.h) - P);
    return top;
  };
  const hills: PqHill[] = [];
  // Far hills: soft stepped mounds.
  for (let x = -24 * P * random(); x < W; x += (26 + random() * 20) * P) {
    const w = (22 + random() * 12) * P;
    const h = Math.min((8 + random() * 5) * P, Math.floor(room(x, w) / P) * P);
    if (h >= PQ_HILL_MIN_P * P) hills.push({ x, w, h });
  }
  const bushes: PqBush[] = [];
  // Bushes: bumpy tops, darker base.
  for (let x = 4 * P * random(); x < W; x += (28 + random() * 34) * P) {
    const w = (8 + Math.round(random() * 3) * 2) * P;
    if (room(x, w) >= 4 * P) bushes.push({ x, w });
  }
  return { hills, bushes };
}

/** As the ground falls away, a clod of grass or dirt kicks up off each strip's edge. */
export function collapseDirt(P: number, W: number, G: number, floor: number): PqChunk[] {
  const random = seededRandom(0xd127 + Math.round(W));
  const g = PQ_GRAVITY_P * P;
  const strip = W / PQ_LIMITS.strips;
  return Array.from({ length: PQ_LIMITS.strips }, (_, i) => {
    const size = Math.round((random() < .5 ? 3 : 2.5) * P);
    const x = (i + .15 + random() * .5) * strip;
    const y = G - size / 2;
    const vx = (random() - .5) * 36 * P;
    const vy = -(40 + random() * 26) * P;
    const start = round3(stripFallAt(i) + .02);
    const reach = (-vy + Math.sqrt(vy * vy + 2 * g * (floor + size - y))) / g;
    const duration = round3(Math.min(reach, PQ_T.end - start - .01));
    return { x, y, w: size, h: size, start, duration, dx: vx * duration, a: vy * duration, b: .5 * g * duration * duration, rot: Math.round((vx < 0 ? -1 : 1) * (20 + random() * 40)), tone: i % 2 ? 3 : 4, flash: false, act: PQ_FINALE_ACTS.poof };
  });
}

/* ------------------------------------------------------------------ hero */

export type PqFrame = 'idle' | 'idle2' | 'crouch' | 'run1' | 'run2' | 'run3' | 'jump' | 'bonk' | 'fallA' | 'fallB' | 'cheer' | 'cheerWink' | 'cheerJoy';
/** sx/sy squash and stretch the sprite about its feet, on top of `scale`. */
export type PqPose = { x: number; y: number; frame: PqFrame | null; scale: number; sx: number; sy: number; trophy: boolean; lift: number };

/** Hero horizontal path: piecewise through fixed-time keys; speed changes only mid-air. */
export function heroX(plan: Pick<PqPlan, 'x0' | 'hits' | 'stopX' | 'grabX' | 'finale'>, t: number): number {
  const T = PQ_T;
  if (t >= T.grab) return plan.grabX + (plan.finale.x - plan.grabX) * pqEaseInOutCubic((t - T.grab) / (T.floatEnd - T.grab));
  // Each bonk freezes the hero for the hit-stop, so the contact reads.
  const keys: [number, number][] = [[T.go, plan.x0], ...plan.hits.flatMap((h): [number, number][] => [[h.t, h.x], [h.t + T.hitStop, h.x]]), [T.stopBy, plan.stopX], [T.grabHop, plan.stopX], [T.grab, plan.grabX]];
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, x1] = keys[i];
    const [t0, xStart] = keys[i - 1];
    if (t <= t1) {
      let u = (t - t0) / (t1 - t0);
      if (i === 1) u = 2 * u * u - u * u * u; // push off from rest, arrive at cruising speed
      else if (i === keys.length - 3) {
        // Settle into the stop: leave the last bonk at the running pace, arrive at rest (cubic Hermite).
        const [ta, xa] = keys[i - 3]; // the run into the last bonk (keys[i - 2] is its hit-stop)
        const [tb, xb] = keys[i - 2];
        const pace = Math.abs(x1 - xStart) > 1e-6 ? (xb - xa) / Math.max(1e-6, tb - ta) * (t1 - t0) / (x1 - xStart) : 0;
        const m0 = Math.max(0, Math.min(3, pace));
        u = (u * u * u - 2 * u * u + u) * m0 + (3 * u * u - 2 * u * u * u);
      }
      else if (i === keys.length - 1) u = 1 - (1 - u) * (1 - u); // hop onto the trophy
      return xStart + (x1 - xStart) * u;
    }
  }
  return keys[keys.length - 1][1];
}

const RUN_CYCLE: PqFrame[] = ['run1', 'run2', 'run3', 'run2'];
const PQ_PRE_JUMP = .04;

/** Run frame chosen by distance travelled, so the feet never skate. */
export function runFrame(plan: Pick<PqPlan, 'x0' | 'P'>, x: number): PqFrame {
  return RUN_CYCLE[Math.floor(Math.abs(x - plan.x0) / (5 * plan.P)) % 4];
}

/** Everything about the hero at time t: feet position (px, viewport), sprite frame, scale and squash. */
export function heroPose(plan: PqPlan, t: number): PqPose {
  const T = PQ_T;
  const { P, G } = plan;
  const x = heroX(plan, t);
  const base: PqPose = { x, y: G, frame: null, scale: 1, sx: 1, sy: 1, trophy: false, lift: 0 };
  if (t < T.heroIn || t >= T.poof) return base;
  // Spawn: drop in from the sparkle, land with a squash.
  if (t < T.heroLand) {
    const u = (t - T.heroIn) / (T.heroLand - T.heroIn);
    return { ...base, y: G - PQ_SPAWN_DROP_P * P * (1 - u * u), frame: Math.floor((t - T.heroIn) / .06) % 2 ? 'fallB' : 'fallA' };
  }
  if (t < T.heroLand + .08) return { ...base, frame: 'crouch' };
  if (t < T.count[2]) return { ...base, frame: t > .55 && t < .65 ? 'idle2' : 'idle' };
  if (t < T.go) return { ...base, frame: 'crouch' };
  for (let k = 0; k < plan.hits.length; k++) {
    const h = plan.hits[k];
    const J = h.jumpPx;
    const land = h.land;
    const springTop = h.spring ? PQ_HERO.springSquashP * P : 0;
    if (h.spring && t >= h.takeoff - .06 && t < h.takeoff) return { ...base, y: G - springTop, frame: 'crouch' };
    // Anticipation: a two-frame crouch before each running jump (when the feet are free).
    if (!h.spring && t >= h.takeoff - PQ_PRE_JUMP && t < h.takeoff && (k === 0 || t >= plan.hits[k - 1].land + .07)) return { ...base, frame: 'crouch' };
    if (t >= h.takeoff && t < h.t) {
      const u = (t - h.takeoff) / T.rise;
      const from = springTop;
      return { ...base, y: G - (from + (J - from) * (1.25 * u - .25 * u * u)), frame: 'jump' };
    }
    if (t >= h.t && t < h.t + T.hitStop) return { ...base, y: G - J, frame: 'bonk' };
    if (t >= h.t + T.hitStop && t < land) {
      const s = (t - h.t - T.hitStop) / (land - h.t - T.hitStop);
      return { ...base, y: G - J * (1 - s * s), frame: t - h.t < .1 ? 'bonk' : Math.floor((t - h.t) / .06) % 2 ? 'fallB' : 'fallA' };
    }
    if (t >= land && t < land + .07) return { ...base, frame: 'crouch' };
  }
  if (t >= T.stopBy && t < T.grabHop) return { ...base, frame: 'idle' };
  if (t >= T.grabHop && t < T.grab) {
    const u = (t - T.grabHop) / (T.grab - T.grabHop);
    return { ...base, y: G - 8 * P * (1 - (1 - u) ** 2), frame: 'jump' };
  }
  if (t >= T.grab) {
    const k = clamp01((t - T.grab) / (T.floatEnd - T.grab));
    const u = pqEaseInOutCubic(k);
    const from = G - 8 * P;
    const to = plan.finale.feetY;
    // Standing on the plate, the cheer is a little hop off it every 0.24 s (up for 0.08 s); the last one lands just before
    // the wind-up squash.
    const beat = (t - T.floatEnd) % .24;
    const bob = t > T.floatEnd && t < T.poofWindup && beat >= .12 && beat < .2 ? -P : 0;
    const top = plan.finale.scale;
    const scale = top > 1.5 ? (k < 1 / 3 ? 1 : k < 2 / 3 ? 1.5 : top) : k < .5 ? 1 : top;
    const pose: PqPose = { ...base, y: from + (to - from) * u + bob, frame: t >= T.wink && t < T.winkEnd ? 'cheerWink' : 'cheer', trophy: true, scale, lift: k };
    // Poof anticipation: a squash onto the banner with a big grin, then a stretch into a little hop, then gone.
    if (t >= T.poofWindup && t < T.poofHop) return { ...pose, sx: 1.14, sy: .84, frame: 'cheerJoy' };
    if (t >= T.poofHop) return { ...pose, y: pose.y - (t - T.poofHop < .03 ? 2 : 4) * P, sx: .9, sy: 1.12, frame: 'cheerJoy' };
    return pose;
  }
  if (t < T.go + .06) return { ...base, frame: 'crouch' };
  const frame = runFrame(plan, x);
  // Passing frames ride one art pixel higher: a bouncy, weighted run.
  return { ...base, y: frame === 'run2' ? G - P : G, frame };
}

/** HUD gem count: a gem lands in the counter .62 s after its pop. */
export function hudCount(plan: Pick<PqPlan, 'pops'>, t: number) {
  const arrive = PQ_T.gemRise + PQ_T.gemFly;
  let count = 0;
  for (const pop of plan.pops) if (pop.at + arrive <= t) count++;
  return count;
}

/** Band strip i starts falling at this time. */
export function stripFallAt(i: number) { return PQ_T.collapse + i * PQ_T.collapseStagger; }
/** Sky column i (above band strip i) leaves at this time. */
export function skyWipeAt(i: number) { return round3(stripFallAt(i) + PQ_T.skyWipeLag); }

/** Countdown caption at time t (null when none). */
export function captionAt(t: number): { text: '3' | '2' | '1' | 'GO!'; since: number } | null {
  const T = PQ_T;
  if (t < T.count[0] || t >= T.goOut + .08) return null;
  if (t >= T.go) return { text: 'GO!', since: t - T.go };
  if (t >= T.count[2]) return { text: '1', since: t - T.count[2] };
  if (t >= T.count[1]) return { text: '2', since: t - T.count[1] };
  return { text: '3', since: t - T.count[0] };
}
