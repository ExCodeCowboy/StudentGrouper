import { seededRandom } from './sceneMotion';
import type { HouseMaterial } from './blockMineTimeline';

/**
 * Original 16x16 pixel textures and sprites for the block-mine reveal, drawn
 * procedurally (seeded, so every screen gets the same art) and emitted as
 * crisp SVG data URIs. No React, no CSS imports.
 */

export type Grid = (string | null)[][];
const SIZE = 16;

const blank = (width = SIZE, height = SIZE): Grid => Array.from({ length: height }, () => Array.from<string | null>({ length: width }).fill(null));

function hexToRgb(hex: string) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
function rgbToHex([r, g, b]: number[]) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}
/** Multiply toward black (<1) or mix toward a warm white (>1). */
export function shade(hex: string, amount: number) {
  const rgb = hexToRgb(hex);
  if (amount <= 1) return rgbToHex(rgb.map((v) => v * amount));
  const t = amount - 1;
  return rgbToHex(rgb.map((v, i) => v + ([255, 250, 230][i] - v) * t));
}

function pick(random: () => number, weighted: readonly (readonly [string, number])[]) {
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [color, weight] of weighted) { roll -= weight; if (roll <= 0) return color; }
  return weighted[0][0];
}

/* ---------------------------- palettes ---------------------------- */

export const PALETTE = {
  dirt: ['#8d5b30', '#7a4c27', '#9e6a3a', '#643e1f', '#b07a45'],
  grass: ['#67bb3f', '#58a935', '#78cb4d', '#4a9530', '#8ad75d'],
  stone: ['#8e9297', '#9ca0a5', '#7f8388', '#6d7176', '#aeb2b6'],
  ore: ['#f0a23a', '#ffd46e', '#b8651f'],
  planks: ['#c48f52', '#b8834a', '#cc9a5d', '#ad7a42'],
  plankSeam: '#6f4722',
  plankGrain: '#a06f3b',
  gem: ['#ff4f9f', '#ff9bd0', '#ffffff', '#b3276e', '#ffd0e8'],
  glass: ['#bfe8f5', '#8fd0e6', '#eafaff'],
  crack: '#1e1818',
} as const;

/* ---------------------------- textures ---------------------------- */

function noise(seed: number, colors: readonly string[], weights: readonly number[]): Grid {
  const random = seededRandom(seed);
  const grid = blank();
  const weighted = colors.map((color, i) => [color, weights[i] ?? 1] as const);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) grid[y][x] = pick(random, weighted);
  // Chunky clumps: copy some pixels into their right/lower neighbour.
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(random() * (SIZE - 1));
    const y = Math.floor(random() * (SIZE - 1));
    if (random() < .5) grid[y][x + 1] = grid[y][x]; else grid[y + 1][x] = grid[y][x];
  }
  return grid;
}

function dirt(seed = 11): Grid {
  const [mid, dark, light, darkest, pebble] = PALETTE.dirt;
  const grid = noise(seed, [mid, dark, light, darkest], [6, 3, 2.2, .7]);
  const random = seededRandom(seed + 1);
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(random() * 15);
    const y = Math.floor(random() * 15);
    grid[y][x] = pebble; grid[y][x + 1] = light; grid[y + 1][x] = dark;
  }
  return grid;
}

function grassTop(seed = 21): Grid {
  const [mid, dark, light, darkest, bright] = PALETTE.grass;
  return noise(seed, [mid, dark, light, darkest, bright], [6, 3, 2.5, .8, .8]);
}

function grassSide(seed = 31): Grid {
  const grid = dirt(seed);
  const top = grassTop(seed + 3);
  const random = seededRandom(seed + 5);
  for (let x = 0; x < SIZE; x++) {
    const depth = 3 + (random() < .55 ? 1 : 0) + (random() < .25 ? 1 : 0) + (x % 5 === 2 && random() < .7 ? 1 : 0);
    for (let y = 0; y < depth; y++) grid[y][x] = y === depth - 1 ? PALETTE.grass[3] : top[y][x];
  }
  return grid;
}

function stone(seed = 41): Grid {
  const [mid, light, dark, darker, pale] = PALETTE.stone;
  const grid = noise(seed, [mid, light, dark], [6, 2.4, 2.4]);
  const random = seededRandom(seed + 2);
  // Short darker seams and pale chips give the rock its chunky face.
  // (Kept soft and short so the crack overlay still reads as a crack on stone.)
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(random() * 13);
    const y = Math.floor(random() * 16);
    const length = 2 + Math.floor(random() * 2);
    for (let k = 0; k < length && x + k < SIZE; k++) grid[y][x + k] = k === 0 ? darker : dark;
    if (y > 0) grid[y - 1][x] = pale;
  }
  return grid;
}

function ore(seed = 51): Grid {
  const grid = stone(seed);
  const [gold, glint, shadow] = PALETTE.ore;
  const clusters: [number, number][] = [[2, 3], [10, 2], [6, 8], [12, 11], [2, 12]];
  const random = seededRandom(seed + 4);
  for (const [cx, cy] of clusters) {
    const cells: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2]].filter(() => random() < .82) as [number, number][];
    for (const [dx, dy] of cells) grid[cy + dy][cx + dx] = gold;
    grid[cy][cx] = glint;
    if (cy + 2 < SIZE && cx + 2 < SIZE) grid[cy + 2][cx + 2] = shadow;
  }
  return grid;
}

function planks(seed = 61): Grid {
  const grid = blank();
  const random = seededRandom(seed);
  const joints = [4, 12, 8, 14];
  for (let board = 0; board < 4; board++) {
    const base = PALETTE.planks[board % PALETTE.planks.length];
    for (let y = board * 4; y < board * 4 + 4; y++) {
      for (let x = 0; x < SIZE; x++) {
        const inBoard = y - board * 4;
        grid[y][x] = inBoard === 3 ? PALETTE.plankSeam : inBoard === 0 ? shade(base, 1.1) : random() < .12 ? PALETTE.plankGrain : base;
      }
    }
    const jx = joints[board];
    for (let y = board * 4; y < board * 4 + 3; y++) grid[y][jx] = PALETTE.plankSeam;
    // A nail beside each joint.
    grid[board * 4 + 1][(jx + 2) % SIZE] = '#5a3a1c';
  }
  return grid;
}

function gemOre(seed = 71): Grid {
  const grid = stone(seed);
  const [core, light, glint, dark, halo] = PALETTE.gem;
  const crystal = (cx: number, cy: number, big: boolean) => {
    const cells = big
      ? [[1, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2], [1, 3]]
      : [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]];
    for (const [dx, dy] of cells) grid[cy + dy][cx + dx] = core;
    grid[cy][cx + 1] = light; grid[cy + 1][cx] = light; grid[cy + 1][cx + 1] = glint;
    grid[cy + (big ? 3 : 2)][cx + 1] = dark;
    if (big) grid[cy + 2][cx + 2] = dark;
    // Rosy halo pixels on the stone around it.
    if (cy > 0) grid[cy - 1][cx + 1] = halo;
  };
  crystal(2, 2, true); crystal(10, 1, false); crystal(7, 8, true); crystal(12, 11, false); crystal(2, 11, false);
  return grid;
}

/** Two-block door: the lower half has the knob, the upper half a little window. */
function door(upper: boolean, lit = false): Grid {
  const grid = planks(67);
  const frame = '#5a3a1c';
  const panel = '#8a5a2c';
  const panelLight = '#9c6a36';
  for (let y = upper ? 2 : 0; y < SIZE; y++) for (let x = 3; x < 13; x++) {
    const edge = x === 3 || x === 12 || (upper && y === 2);
    grid[y][x] = edge ? frame : (y % 5 === 4 ? frame : x < 6 ? panelLight : panel);
  }
  if (upper) {
    const glass = lit ? LAMP : PALETTE.glass;
    for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) grid[y][x] = x === 7 || x === 8 || y === 7 ? frame : glass[y < 7 ? 2 : 0];
  } else {
    grid[6][10] = '#ffd46e'; grid[7][10] = '#b8651f';
  }
  return grid;
}

/** Glass panes by day, or lit warm from inside once the house is finished. */
const LAMP = ['#ffe9a8', '#ffc95c', '#fff7d6'] as const;

function windowBlock(lit = false): Grid {
  const grid = planks(61);
  const frame = '#5a3a1c';
  const glass = lit ? LAMP : PALETTE.glass;
  for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) {
    const border = x === 3 || x === 12 || y === 3 || y === 12 || x === 7 || x === 8 || y === 7 || y === 8;
    grid[y][x] = border ? frame : glass[(x + y) % 5 === 0 ? 2 : y < 7 ? 0 : 1];
  }
  return grid;
}

/**
 * Top-left light: a lighter top row and left column, a darker bottom row and
 * right column. Strong enough that every block in a chunk reads on its own
 * (even seamless planks), which matters because each one pops separately.
 */
function bevel(grid: Grid, strength = 1): Grid {
  return grid.map((row, y) => row.map((color, x) => {
    if (!color) return color;
    if (y === 0) return shade(color, 1 + .2 * strength);
    if (y === SIZE - 1) return shade(color, 1 - .32 * strength);
    if (x === 0) return shade(color, 1 + .1 * strength);
    if (x === SIZE - 1) return shade(color, 1 - .22 * strength);
    return color;
  }));
}

const tint = (grid: Grid, amount: number): Grid => grid.map((row) => row.map((color) => color && shade(color, amount)));

/* ------------------------------ SVG ------------------------------ */

/** Merge horizontal runs into rects: small, crisp SVGs. */
export function gridToSvg(grid: Grid, extra = ''): string {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const byColor = new Map<string, string[]>();
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const color = grid[y][x];
      if (!color) { x++; continue; }
      let run = 1;
      while (x + run < width && grid[y][x + run] === color) run++;
      const list = byColor.get(color) ?? [];
      list.push(`M${x} ${y}h${run}v1h-${run}z`);
      byColor.set(color, list);
      x += run;
    }
  }
  const paths = [...byColor].map(([color, parts]) => `<path fill="${color}" d="${parts.join('')}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges">${paths}${extra}</svg>`;
}

export const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/**
 * A grid as a tiny PNG (one pixel per texel) when a canvas is available: it
 * decodes and scales far faster than an SVG of many runs, and stays crisp
 * with image-rendering: pixelated. Falls back to the SVG elsewhere.
 * Colours may carry alpha (#rrggbbaa).
 */
export function gridUrl(grid: Grid): string {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return svgUrl(gridToSvg(grid));
  canvas.width = width; canvas.height = height;
  const image = context.createImageData(width, height);
  grid.forEach((row, y) => row.forEach((color, x) => {
    if (!color) return;
    const value = parseInt(color.slice(1, 7), 16);
    const offset = (y * width + x) * 4;
    image.data[offset] = (value >> 16) & 255;
    image.data[offset + 1] = (value >> 8) & 255;
    image.data[offset + 2] = value & 255;
    image.data[offset + 3] = color.length > 7 ? parseInt(color.slice(7, 9), 16) : 255;
  }));
  context.putImageData(image, 0, 0);
  return `url("${canvas.toDataURL('image/png')}")`;
}

/* --------------------------- block faces --------------------------- */

export type FaceSet = { front: string; top: string; side: string };

function faceSet(front: Grid, top: Grid): FaceSet {
  return {
    front: gridUrl(bevel(front)),
    top: gridUrl(bevel(tint(top, 1.12), .6)),
    side: gridUrl(bevel(tint(front, .7), .5)),
  };
}

/** Lit fronts for the finale: the windows glow once the gem crowns the house. */
export function litFaces() {
  return { window: gridUrl(bevel(windowBlock(true))), doorTop: gridUrl(bevel(door(true, true))) };
}

let cachedFaces: Record<HouseMaterial, FaceSet> | null = null;
export function blockFaces(): Record<HouseMaterial, FaceSet> {
  if (cachedFaces) return cachedFaces;
  const planksGrid = planks();
  const stoneGrid = stone();
  cachedFaces = {
    grass: faceSet(grassSide(), grassTop()),
    dirt: faceSet(dirt(), dirt(13)),
    stone: faceSet(stoneGrid, stone(43)),
    ore: faceSet(ore(), stone(47)),
    planks: faceSet(planksGrid, planks(63)),
    gem: faceSet(gemOre(), gemOre(73)),
    door: faceSet(door(false), planks(63)),
    doorTop: faceSet(door(true), planks(63)),
    window: faceSet(windowBlock(), planks(63)),
  };
  return cachedFaces;
}

/* ------------------------------ cracks ------------------------------ */

type Cell = [number, number];

/**
 * Four crack stages stacked vertically in one sprite. Thin fracture lines
 * zig-zag out from an impact pit toward the block edges, and forks split off
 * the longer ones: stage 1 is a small starburst, stage 4 has shattered the
 * whole face. Each stage is a superset of the one before.
 */
export function crackLines(seed = 0x5eed): Cell[][] {
  const random = seededRandom(seed);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  /** One 8-connected fracture line: half-texel steps along a wobbling heading. */
  const walk = (x0: number, y0: number, heading: number, maxLength: number, wobble = .5): Cell[] => {
    const cells: Cell[] = [];
    let x = x0 + .5;
    let y = y0 + .5;
    let angle = heading;
    let last = `${x0},${y0}`;
    for (let step = 0; step < maxLength * 3 && cells.length < maxLength; step++) {
      angle = heading + Math.max(-wobble, Math.min(wobble, angle - heading + (random() - .5) * .8));
      x += Math.cos(angle) * .7;
      y += Math.sin(angle) * .7;
      const gx = Math.floor(x);
      const gy = Math.floor(y);
      if (!inside(gx, gy)) break;
      const key = `${gx},${gy}`;
      if (key !== last) { cells.push([gx, gy]); last = key; }
    }
    return cells;
  };
  const pit: Cell[] = [[7, 7], [8, 7], [7, 8]];
  const turn = random() * Math.PI * 2;
  const rays = Array.from({ length: 5 }, (_, i) => walk(i % 2 ? 8 : 7, i < 3 ? 7 : 8, turn + i * Math.PI * 2 / 5 + (random() - .5) * .5, 12));
  const forks: Cell[][] = [];
  const spurs: Cell[][] = [];
  rays.forEach((ray, i) => {
    if (ray.length < 5) return;
    const at = ray[Math.floor(ray.length * (.42 + random() * .16))];
    const heading = Math.atan2(ray[ray.length - 1][1] - ray[0][1], ray[ray.length - 1][0] - ray[0][0]);
    forks.push(walk(at[0], at[1], heading + (i % 2 ? 1 : -1) * (.62 + random() * .3), 3 + Math.floor(random() * 3), .35));
    const late = ray[Math.floor(ray.length * .78)];
    spurs.push(walk(late[0], late[1], heading + (i % 2 ? -1 : 1) * (.9 + random() * .3), 2, .2));
  });
  const prefix = (line: Cell[], share: number) => line.slice(0, Math.max(0, Math.round(line.length * share)));
  return [
    [...pit, ...rays.slice(0, 3).flatMap((ray) => ray.slice(0, 3))],
    [...pit, ...rays.flatMap((ray) => prefix(ray, .45))],
    [...pit, ...rays.flatMap((ray) => prefix(ray, .78)), ...forks.flatMap((fork) => prefix(fork, .5))],
    [...pit, ...rays.flat(), ...forks.flat(), ...spurs.flat()],
  ];
}

export function crackSprite(seed = 0x5eed): string {
  const grid = blank(SIZE, SIZE * 4);
  // Dark fracture texels with a warm pale lip below-right (light from the top left),
  // so cracks read on dark dirt and on pale stone alike.
  crackLines(seed).forEach((cells, stage) => {
    const inStage = new Set(cells.map(([x, y]) => `${x},${y}`));
    for (const [x, y] of cells) grid[stage * SIZE + y][x] = `${PALETTE.crack}e0`;
    for (const [x, y] of cells) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < SIZE && ny < SIZE && !inStage.has(`${nx},${ny}`)) grid[stage * SIZE + ny][nx] ??= '#fff4dc5c';
      }
    }
    // The impact pit is the deepest part of the crack.
    grid[stage * SIZE + 7][7] = PALETTE.crack;
  });
  return gridUrl(grid);
}

/* ------------------------------ pickaxe ------------------------------ */

/** Grip (pivot) texel of the pickaxe sprite, and the head tip that lands on the block. */
export const PICKAXE_SIZE = 18;
export { PICK_GRIP_TEXEL as PICKAXE_GRIP, PICK_TIP_TEXEL as PICKAXE_TIP } from './blockMineTimeline';

export function pickaxeGrid(): Grid {
  const grid = blank(PICKAXE_SIZE, PICKAXE_SIZE);
  const head = ['#f4f8fb', '#c9d3dc', '#9aa7b3', '#6c7884'];
  // Crescent head bowing toward the top-left, centred on (11.5, 11.5).
  for (let y = 0; y < PICKAXE_SIZE; y++) {
    for (let x = 0; x < PICKAXE_SIZE; x++) {
      const vx = x + .5 - 11.5;
      const vy = y + .5 - 11.5;
      const radius = Math.hypot(vx, vy);
      const angle = Math.atan2(vy, vx) * 180 / Math.PI; // -180..180, up-left quadrant is -180..-90
      const fromMiddle = Math.abs(angle + 135);
      if (angle > -80 || (angle < -190)) continue;
      if (angle > 0) continue;
      const inner = 6.1 + Math.max(0, fromMiddle - 12) * .045;
      const outer = 8.9 - Math.max(0, fromMiddle - 30) * .03;
      if (radius < inner || radius > outer || fromMiddle > 52) continue;
      const depth = (radius - inner) / (outer - inner);
      grid[y][x] = depth > .72 ? head[0] : depth > .45 ? head[1] : depth > .2 ? head[2] : head[3];
    }
  }
  // Handle: two-texel diagonal from the head to the grip, with a wrapped grip.
  for (let i = 6; i <= 15; i++) {
    const grip = i >= 12;
    grid[i][i] = grip ? '#3f6fb8' : '#c28a4c';
    if (i + 1 < PICKAXE_SIZE) grid[i][i + 1] = grip ? '#2a4d85' : '#8d5b2c';
    if (i - 1 >= 0 && i < 15) grid[i + 1][i] = grip ? '#2a4d85' : '#6e4420';
  }
  grid[12][12] = '#9cc2ff';
  grid[14][14] = '#9cc2ff';
  // Collar where the head meets the handle.
  grid[6][6] = '#4b5560'; grid[7][6] = '#4b5560'; grid[6][7] = '#4b5560';
  return outline(grid, '#1f2329');
}

/** One-texel dark outline around every filled texel (4-neighbour). */
export function outline(grid: Grid, color: string): Grid {
  const result = grid.map((row) => [...row]);
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[0].length; x++) {
    if (grid[y][x]) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy]?.[x + dx]);
    if (near) result[y][x] = color;
  }
  return result;
}

/* ------------------------------ digits ------------------------------ */

const DIGITS: Record<string, string[]> = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'],
};

/** A chunky pixel number with a drop shadow (4 wide x 6 tall texels per digit). */
export function digitGrid(value: number): Grid {
  const text = String(value);
  const width = text.length * 4 + 1;
  const grid = blank(width, 7);
  text.split('').forEach((char, i) => {
    const rows = DIGITS[char] ?? DIGITS[0];
    rows.forEach((row, y) => row.split('').forEach((bit, x) => {
      if (bit !== '1') return;
      grid[y + 2][i * 4 + x + 2] ??= '#2b2622';
      grid[y + 1][i * 4 + x + 1] = '#fffbea';
    }));
  });
  return grid;
}

/* ------------------------------ sparkle ------------------------------ */

export function sparkleGrid(color = '#fff6c9', core = '#ffffff'): Grid {
  const grid = blank(7, 7);
  for (let i = 0; i < 7; i++) { grid[3][i] = color; grid[i][3] = color; }
  grid[3][3] = core; grid[2][3] = core; grid[3][2] = core; grid[4][3] = core; grid[3][4] = core;
  grid[0][3] = null; grid[6][3] = null; grid[3][0] = null; grid[3][6] = null;
  return grid;
}

/**
 * The SMASH star: a chunky 7-texel burst (white core, cream arms, gold tips
 * and diagonal sparks), drawn at twice the tick sparkle's texel size so the
 * hit frame itself carries the punch.
 */
export function impactGrid(): Grid {
  const grid = blank(7, 7);
  const white = '#ffffff'; const cream = '#fff6c9'; const gold = '#ffd46e';
  // A white plus at the heart, cream arms, gold tips and four diagonal sparks.
  for (let i = 1; i < 6; i++) { grid[3][i] = cream; grid[i][3] = cream; }
  for (const [x, y] of [[3, 2], [2, 3], [4, 3], [3, 4], [3, 3]]) grid[y][x] = white;
  for (const [x, y] of [[3, 0], [0, 3], [6, 3], [3, 6], [1, 1], [5, 1], [1, 5], [5, 5]]) grid[y][x] = gold;
  return grid;
}

/**
 * A chunky sunburst behind the hero gem: eight long rays with eight short
 * ones between them, warm gold at the core turning rose outward (colour by
 * radius, so every frame matches). Four frames side by side, each turned a
 * further 11.25 degrees: one ray period (45 degrees) over the loop, so a
 * steps() animation turns it seamlessly without ever rotating (and smearing)
 * the pixels.
 */
export function sunburstSheet(size = 35, frames = 4): Grid {
  const grid = blank(size * frames, size);
  const c = (size - 1) / 2;
  for (let frame = 0; frame < frames; frame++) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = x - c; const dy = y - c;
      const r = Math.hypot(dx, dy);
      if (r > c + .2 || r < 2.5) continue;
      // Position inside one 45-degree period: a long ray centred on 0, a short one on 0.5.
      const turn = (Math.atan2(dy, dx) / (Math.PI * 2) * 8 + frame / frames + 16.5) % 1 - .5;
      const long = Math.abs(turn) < .15 - r / c * .05;
      const short = Math.abs(Math.abs(turn) - .5) < .07 && r < c * .62;
      if (!long && !short) continue;
      grid[y][frame * size + x] = r > c * .78 ? '#ff9ccb8c' : r > c * .5 ? '#ffc6dfc4' : '#ffe79ae8';
    }
  }
  return grid;
}

/**
 * The rare gem: an original rose-pink faceted cut (crown, bright girdle,
 * pavilion to a point), lit from the top left like every block.
 */
export function gemGrid(): Grid {
  const grid = blank(16, 16);
  const spans: [number, number, number][] = [[2, 5, 10], [3, 4, 11], [4, 3, 12], [5, 2, 13], [6, 1, 14], [7, 2, 13], [8, 3, 12], [9, 4, 11], [10, 5, 10], [11, 6, 9], [12, 7, 8]];
  const table = '#ffa6d4'; const crownL = '#ff72b6'; const crownR = '#e0468f'; const girdle = '#ffd0e8';
  const pavL = '#f75aa5'; const pavM = '#ff8fc8'; const pavR = '#b52a6e'; const glint = '#ffffff';
  for (const [y, x0, x1] of spans) for (let x = x0; x <= x1; x++) {
    if (y <= 5) grid[y][x] = x >= 6 && x <= 9 ? table : x < 6 ? crownL : crownR;
    else if (y === 6) grid[y][x] = girdle;
    else grid[y][x] = x === 7 || x === 8 ? pavM : x < 7 ? pavL : pavR;
  }
  grid[3][6] = glint; grid[3][7] = glint; grid[4][6] = glint; grid[6][3] = glint;
  grid[8][5] = '#ffc2e2'; grid[9][6] = '#ffc2e2';
  return outline(grid, '#5c0e3a');
}

export const GEM_GLINT_FRAMES = 7;
/**
 * A glint sweeping across the gem's face at its hero moment: frames side by
 * side, each a two-texel diagonal band (with a softer trailing texel) kept to
 * the gem's own facets, moving from the upper left to the lower right. Played
 * with steps(), so it moves in whole texels like the rest of the art.
 */
export function gemGlintSheet(frames = GEM_GLINT_FRAMES): Grid {
  const gem = gemGrid();
  const edge = '#5c0e3a';
  const sheet = blank(SIZE * frames, SIZE);
  // Facet texels run from x + y = 7 (upper left) to 20 (lower right).
  for (let frame = 0; frame < frames; frame++) {
    const lead = 6 + Math.round(frame * 16 / (frames - 1));
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (!gem[y][x] || gem[y][x] === edge) continue;
      const behind = lead - (x + y);
      if (behind >= 0 && behind < 2) sheet[y][frame * SIZE + x] = '#ffffffe0';
      else if (behind === 2) sheet[y][frame * SIZE + x] = '#fff0f880';
    }
  }
  return sheet;
}

export function heartGrid(): Grid {
  const rows = ['.11.11.', '1221111', '1211111', '1111111', '.11111.', '..111..', '...1...'];
  const grid: Grid = rows.map((row) => row.split('').map((c) => c === '1' ? '#ff5d8f' : c === '2' ? '#ffd1e0' : null));
  const empty = (): (string | null)[] => Array.from<string | null>({ length: 7 }).fill(null);
  return outline([empty(), ...grid, empty()].map((row) => [null, ...row, null]), '#7a1f3d');
}

/** Debris: five chunky bits around the centre (1/12 of the sprite each), drawn once per material. */
export function debrisGrid(colors: readonly string[], seed: number): Grid {
  const random = seededRandom(seed);
  const grid = blank(24, 24);
  for (let i = 0; i < 5; i++) {
    const angle = i / 5 * Math.PI * 2 + random() * .8;
    const radius = 5 + random() * 4;
    const x = Math.max(0, Math.min(22, Math.round(11 + Math.cos(angle) * radius)));
    const y = Math.max(0, Math.min(22, Math.round(11 + Math.sin(angle) * radius)));
    const color = colors[i % colors.length];
    grid[y][x] = shade(color, 1.12); grid[y][x + 1] = color; grid[y + 1][x] = color; grid[y + 1][x + 1] = shade(color, .75);
  }
  return grid;
}

export const DEBRIS_COLORS: Record<HouseMaterial, readonly string[]> = {
  grass: [PALETTE.grass[0], PALETTE.dirt[0], PALETTE.grass[2]],
  dirt: [PALETTE.dirt[0], PALETTE.dirt[2], PALETTE.dirt[1]],
  stone: [PALETTE.stone[0], PALETTE.stone[1], PALETTE.stone[3]],
  ore: [PALETTE.stone[0], PALETTE.ore[0], PALETTE.ore[1]],
  planks: [PALETTE.planks[0], PALETTE.planks[2], PALETTE.plankSeam],
  gem: [PALETTE.gem[0], PALETTE.gem[1], PALETTE.gem[2]],
  door: [PALETTE.planks[0], PALETTE.plankSeam],
  doorTop: [PALETTE.planks[0], PALETTE.plankSeam],
  window: [PALETTE.planks[0], PALETTE.glass[0]],
};
