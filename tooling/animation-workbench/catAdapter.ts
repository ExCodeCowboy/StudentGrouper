import {
  CAT_LEG_LENGTHS,
  catBlocking,
  catRig,
  catSkinPoint,
  kneeBetween,
  type CatPose,
  type Point,
} from '../../src/revealEffects/sceneMotion';
import { sampleChannel, type ChannelId, type ClipDocument } from './model';

export type CatHandle = {
  id: string;
  label: string;
  /** Cat-local coordinates, before the scene's position and scale. */
  point: Point;
  channels: { x?: ChannelId; y?: ChannelId };
};

export type CatEvaluation = {
  rig: CatPose;
  blocking: ReturnType<typeof catBlocking>;
  /** Authored reveal time, after the editable timing track has been sampled. */
  sourceTime: number;
  handles: CatHandle[];
  warnings: string[];
};

const FLOOR = 274;
const EPSILON = .00001;
const labels = {
  'near-front': 'Front paw · near',
  'far-front': 'Front paw · far',
  'near-hind': 'Rear paw · near',
  'far-hind': 'Rear paw · far',
} as const;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const offset = (value: number, amount: number) => amount === 0 ? value : value + amount;

/**
 * Project a requested ankle into the fixed two-bone limb's reachable annulus.
 * The distal segment keeps its original orientation and length. Its floor
 * constraint therefore becomes a horizontal bound on the ankle, too.
 */
function reachableAnkle(hip: Point, wanted: Point, original: Point, upper: number, lower: number, distal: Point): Point {
  const minimum = Math.abs(upper - lower) + EPSILON;
  const maximum = upper + lower - EPSILON;
  const vector = subtract(wanted, hip);
  const magnitude = Math.hypot(vector.x, vector.y);
  const fallback = subtract(original, hip);
  const fallbackLength = Math.hypot(fallback.x, fallback.y);
  const direction = magnitude > EPSILON
    ? { x: vector.x / magnitude, y: vector.y / magnitude }
    : fallbackLength > EPSILON
      ? { x: fallback.x / fallbackLength, y: fallback.y / fallbackLength }
      : { x: 0, y: 1 };
  const reach = Math.max(minimum, Math.min(maximum, magnitude));
  let ankle = { x: hip.x + direction.x * reach, y: hip.y + direction.y * reach };
  const ceiling = FLOOR - distal.y;
  if (ankle.y > ceiling) {
    const dy = ceiling - hip.y;
    // Torso roots are constrained above the floor before reaching this solver,
    // so this horizontal boundary always has a feasible point if it is needed.
    const outerX = Math.sqrt(Math.max(0, maximum * maximum - dy * dy));
    const innerX = Math.abs(dy) < minimum ? Math.sqrt(minimum * minimum - dy * dy) : 0;
    let dx = Math.max(-outerX, Math.min(outerX, wanted.x - hip.x));
    if (Math.abs(dx) < innerX) dx = (dx < 0 || (dx === 0 && fallback.x < 0) ? -1 : 1) * innerX;
    ankle = { x: hip.x + dx, y: ceiling };
  }
  return ankle;
}

/**
 * Sample the authored reveal through the source-time track, then apply the
 * additive pose channels at editor time. Empty tracks retain the authored
 * reveal exactly; the editor never replaces the production gait with a second
 * approximation of the cat. A flat source-time segment freezes the base pose
 * while independently keyed expression or body offsets can still move.
 */
export function evaluateCat(doc: ClipDocument, time: number, viewportWidth: number): CatEvaluation {
  const safeTime = Number.isFinite(time) ? time : 0;
  const safeWidth = Number.isFinite(viewportWidth) ? Math.max(280, viewportWidth) : 960;
  const warnings: string[] = [];
  const read = (channel: ChannelId) => {
    const value = sampleChannel(doc, channel, safeTime);
    if (Number.isFinite(value)) return value;
    warnings.push(`${channel}: a non-finite value was ignored.`);
    return 0;
  };
  const sourceTime = read('motion.time');
  const blocking = catBlocking(sourceTime, safeWidth);
  const baseline = catRig(sourceTime, blocking.distance / blocking.scale, blocking.strideOffset);
  const body = { x: read('body.x'), y: read('body.y') };
  const segmentOffsets = [
    { x: read('pelvis.x'), y: read('pelvis.y'), angle: read('pelvis.angle') },
    { x: 0, y: read('lumbar.y'), angle: read('lumbar.angle') },
    { x: read('chest.x'), y: read('chest.y'), angle: read('chest.angle') },
  ];
  const torso = baseline.torso.map((segment, index) => ({
    ...segment,
    pivot: { ...segment.pivot },
    shift: offset(segment.shift ?? 0, body.x + segmentOffsets[index].x),
    rise: offset(segment.rise, body.y + segmentOffsets[index].y),
    angle: offset(segment.angle, segmentOffsets[index].angle),
  }));

  // An extreme downward body drag cannot put the joints beneath the floor and
  // still produce an anatomical standing leg. Limit the body as one mass,
  // instead of moving a disconnected leg root away from its drawn torso.
  const lowestRoot = Math.max(...baseline.legs.map(leg => catSkinPoint({ x: leg.hipX, y: leg.hind ? 157 : 167 }, torso).y));
  if (lowestRoot > FLOOR - 20) {
    const correction = lowestRoot - (FLOOR - 20);
    torso.forEach(segment => { segment.rise -= correction; });
    warnings.push('Body height was limited to keep its leg joints above the floor.');
  }

  const legs = baseline.legs.map(leg => {
    const paw = { x: read(`paw.${leg.key}.x`), y: read(`paw.${leg.key}.y`) };
    const restRoot = { x: leg.hipX, y: leg.hind ? 157 : 167 };
    const rootDelta = subtract(catSkinPoint(restRoot, torso), catSkinPoint(restRoot, baseline.torso));
    const hip = add(leg.hip, rootDelta);
    const requestedFoot = add(leg.foot, { x: body.x + paw.x, y: body.y + paw.y });
    if (distance(hip, leg.hip) < EPSILON && distance(requestedFoot, leg.foot) < EPSILON) return leg;

    const [upper, lower, distalLength] = CAT_LEG_LENGTHS[leg.hind ? 'hind' : 'front'];
    const originalDistal = subtract(leg.foot, leg.ankle);
    const originalLength = Math.hypot(originalDistal.x, originalDistal.y);
    const distal = { x: originalDistal.x / originalLength * distalLength, y: originalDistal.y / originalLength * distalLength };
    const desiredAnkle = subtract(requestedFoot, distal);
    const ankle = reachableAnkle(hip, desiredAnkle, leg.ankle, upper, lower, distal);
    const foot = add(ankle, distal);
    const knee = kneeBetween(hip, ankle, upper, lower, leg.hind ? 1 : -1);
    const toeRadians = leg.toeAngle * Math.PI / 180;
    const toeBottom = Math.max(...[[-7, -2], [-3, 0], [6, 0], [13, -1], [13, -6], [7, -8]]
      .map(([x, y]) => x * Math.sin(toeRadians) + y * Math.cos(toeRadians)));
    const toeAngle = foot.y + toeBottom > FLOOR - .001 ? 0 : leg.toeAngle;
    if (distance(foot, requestedFoot) > .01) {
      warnings.push(`${labels[leg.key]} was limited to its reachable area above the floor.`);
    }
    return { ...leg, hip, knee, ankle, foot, toeAngle };
  });
  const attentionOffset = read('attention');
  const attention = Math.max(0, Math.min(1, baseline.acting.attention + attentionOffset));
  const rig: CatPose = {
    ...baseline,
    torso,
    legs,
    neckBase: catSkinPoint({ x: 336, y: 178 }, torso),
    tailBase: catSkinPoint({ x: 155, y: 157 }, torso),
    neckAngle: offset(baseline.neckAngle, read('neck.angle')),
    headAngle: offset(baseline.headAngle, read('head.angle')),
    tailAngle: offset(baseline.tailAngle, read('tail.angle')),
    tailCurl: offset(baseline.tailCurl, read('tail.curl')),
    nearEar: offset(baseline.nearEar, read('nearEar')),
    farEar: offset(baseline.farEar, read('farEar')),
    acting: { ...baseline.acting, attention, paw: { ...baseline.acting.paw } },
  };
  const handles: CatHandle[] = [
    ...rig.legs.map(leg => ({
      id: leg.key,
      label: labels[leg.key],
      point: { ...leg.foot },
      channels: { x: `paw.${leg.key}.x` as ChannelId, y: `paw.${leg.key}.y` as ChannelId },
    })),
    { id: 'pelvis', label: 'Hips', point: catSkinPoint({ x: 186, y: 170 }, torso), channels: { x: 'pelvis.x', y: 'pelvis.y' } },
    { id: 'chest', label: 'Chest', point: catSkinPoint({ x: 320, y: 172 }, torso), channels: { x: 'chest.x', y: 'chest.y' } },
    { id: 'body', label: 'Body', point: catSkinPoint({ x: 253, y: 140 }, torso), channels: { x: 'body.x', y: 'body.y' } },
  ];
  return { rig, blocking, sourceTime, handles, warnings };
}
