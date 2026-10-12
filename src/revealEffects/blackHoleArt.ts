/**
 * Black-hole whoosh: static vector art, computed once at module load.
 * Pure geometry (path strings and shapes), so it stays out of the render path.
 * Hole art uses a 200-unit viewBox (-100..100), so 100 units = half the hole box.
 */

const rad = (degrees: number) => degrees * Math.PI / 180;
const point = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`;

/** A circular arc path, clockwise on screen from `from` to `to` degrees. */
export function arcPath(radius: number, from: number, to: number) {
  return `M${point(radius * Math.cos(rad(from)), radius * Math.sin(rad(from)))}A${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${point(radius * Math.cos(rad(to)), radius * Math.sin(rad(to)))}`;
}

/**
 * A comet streak lying on a ring: a filled crescent that tapers from a round,
 * full-width head (at `head` degrees, moving clockwise) back to a hair-thin tail.
 */
export function cometPath(radius: number, head: number, span: number, width: number, steps = 20) {
  const outer: string[] = [];
  const inner: string[] = [];
  let half = width / 2;
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const angle = rad(head - span * (1 - t));
    half = width / 2 * (.1 + .9 * t ** 1.5);
    outer.push(point((radius + half) * Math.cos(angle), (radius + half) * Math.sin(angle)));
    inner.unshift(point((radius - half) * Math.cos(angle), (radius - half) * Math.sin(angle)));
  }
  return `M${outer.join('L')}A${half.toFixed(2)} ${half.toFixed(2)} 0 0 1 ${inner[0]}L${inner.slice(1).join('L')}Z`;
}

export type BlackHoleRing = { radius: number; width: number; color: string; hot: string; comets: number; span: number; periodMs: number; phase: number };

/** Accretion rings, outer to inner: inner rings are hotter and faster (a differential swirl). */
export const BLACK_HOLE_RINGS: readonly BlackHoleRing[] = [
  { radius: 82, width: 7, color: '#8f86ff', hot: '#d9d4ff', comets: 3, span: 96, periodMs: 2100, phase: 20 },
  { radius: 70, width: 8, color: '#b996ff', hot: '#efe4ff', comets: 4, span: 78, periodMs: 1500, phase: 0 },
  { radius: 58.5, width: 9, color: '#ff8fc4', hot: '#ffe3f1', comets: 3, span: 104, periodMs: 1100, phase: 40 },
  { radius: 47.5, width: 8.5, color: '#ffc46b', hot: '#fff6dc', comets: 3, span: 118, periodMs: 760, phase: 10 },
  { radius: 38.5, width: 7, color: '#fff0c4', hot: '#ffffff', comets: 2, span: 150, periodMs: 520, phase: 70 },
];

/** Comets for one ring: the coloured body plus a short white-hot leading core. */
export function ringComets(ring: BlackHoleRing) {
  return Array.from({ length: ring.comets }, (_, index) => {
    const head = ring.phase + index * 360 / ring.comets;
    return { body: cometPath(ring.radius, head, ring.span, ring.width), core: cometPath(ring.radius, head, ring.span * .42, ring.width * .45) };
  });
}

/** One tapered logarithmic-spiral arm trailing from the core rim out to the edge. */
export function spiralArmPath(start: number) {
  const left: string[] = [];
  const right: string[] = [];
  for (let step = 0; step <= 24; step++) {
    const radius = 33 + step * 67 / 24;
    const theta = rad(start) - 1.15 * Math.log(radius / 33);
    const half = (1 - step / 24) * 5.5 + .6;
    const [nx, ny] = [Math.cos(theta), Math.sin(theta)];
    left.push(point(radius * nx - ny * half, radius * ny + nx * half));
    right.unshift(point(radius * nx + ny * half, radius * ny - nx * half));
  }
  return `M${left.join('L')}L${right.join('L')}Z`;
}
export const BLACK_HOLE_ARMS = [0, 120, 240].map(spiralArmPath);
