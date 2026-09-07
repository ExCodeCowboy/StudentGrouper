import type { Point } from './sceneMotion';

const EPSILON = 1e-9;
const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
const samePoint = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) <= EPSILON;

function segmentIntersection(a: Point, b: Point, c: Point, d: Point): Point | undefined {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const rr = rx * rx + ry * ry;
  const ss = sx * sx + sy * sy;
  // Zero-length segments have no contour area to trim.
  if (rr <= EPSILON * EPSILON || ss <= EPSILON * EPSILON) return undefined;

  const qx = c.x - a.x;
  const qy = c.y - a.y;
  const determinant = cross(rx, ry, sx, sy);
  const parallelTolerance = Number.EPSILON * 64 * Math.sqrt(rr * ss);
  if (Math.abs(determinant) <= parallelTolerance) {
    if (Math.abs(cross(qx, qy, rx, ry)) > EPSILON * Math.sqrt(rr)) return undefined;
    // Collinear overlap is a retraced loop too. Keep its earliest point on
    // the first segment, so the incoming contour remains in traversal order.
    const from = (qx * rx + qy * ry) / rr;
    const to = ((d.x - a.x) * rx + (d.y - a.y) * ry) / rr;
    const first = Math.max(0, Math.min(from, to));
    const last = Math.min(1, Math.max(from, to));
    if (first > last + EPSILON) return undefined;
    return { x: a.x + Math.min(1, first) * rx, y: a.y + Math.min(1, first) * ry };
  }

  const t = cross(qx, qy, sx, sy) / determinant;
  const u = cross(qx, qy, rx, ry) / determinant;
  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) return undefined;
  const bounded = Math.max(0, Math.min(1, t));
  return { x: a.x + bounded * rx, y: a.y + bounded * ry };
}

/** Remove inside-joint loops from an OPEN offset contour without moving its ends. */
export function trimContourLoops(points: Point[]): Point[] {
  let contour = points.slice();
  // Each replacement removes at least one point, so nested/overlapping loops
  // converge without a pass limit. Never test an implicit last-to-first edge.
  let trimmed = true;
  while (trimmed) {
    trimmed = false;
    for (let first = 0; first < contour.length - 3 && !trimmed; first++) {
      for (let last = first + 2; last < contour.length - 1; last++) {
        const intersection = segmentIntersection(contour[first], contour[first + 1], contour[last], contour[last + 1]);
        if (!intersection) continue;
        const prefix = contour.slice(0, first + 1);
        const suffix = contour.slice(last + 1);
        if (!samePoint(prefix[prefix.length - 1], intersection) && !samePoint(suffix[0], intersection)) prefix.push(intersection);
        contour = [...prefix, ...suffix];
        trimmed = true;
        break;
      }
    }
  }
  return contour;
}
