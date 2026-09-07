/** Small, deterministic motion helpers shared by the illustrated reveals. */
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export const progress = (time: number, start: number, end: number) => clamp01((time - start) / (end - start));
export const smooth = (value: number) => { const x = clamp01(value); return x * x * (3 - 2 * x); };
export const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
export const fadeWindow = (time: number, start: number, full: number, out: number, end: number) => smooth(progress(time, start, full)) * (1 - smooth(progress(time, out, end)));

export type Point = { x: number; y: number };

/** A two-bone limb: its paw follows the ground, rather than rotating with the leg. */
export function kneeBetween(hip: Point, foot: Point, upper: number, lower: number, bend: number): Point {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  const distance = Math.max(.001, Math.hypot(dx, dy));
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const across = Math.sqrt(Math.max(0, upper * upper - along * along));
  return { x: hip.x + dx / distance * along + dy / distance * across * bend, y: hip.y + dy / distance * along - dx / distance * across * bend };
}

export const CAT_DURATION_MS = 6800;
export const MOON_DURATION_MS = 8800;
export const CAT_STRIDE = 288;
const CAT_STANCE = .44;

/** A springy trot: diagonal pairs plant for 44% of a stride, with a brief suspension. */
export function catFoot(distance: number, phase: number, hipX: number): Point {
  const cycle = ((distance / CAT_STRIDE + phase) % 1 + 1) % 1;
  const stance = CAT_STANCE;
  if (cycle < stance) return { x: hipX + CAT_STRIDE * stance / 2 - cycle * CAT_STRIDE, y: 274 };
  const swing = (cycle - stance) / (1 - stance);
  return { x: hipX + mix(-CAT_STRIDE * stance / 2, CAT_STRIDE * stance / 2, smooth(swing)), y: 274 - Math.sin(Math.PI * swing) * 36 };
}

// Upper arm / forearm / forefoot, and thigh / shank / hindfoot.
// Ratios and bend directions follow the feline studies in REVEAL_REFERENCES.md.
export const CAT_LEG_LENGTHS = { front: [54, 57, 19], hind: [59, 64, 31] } as const;
export const CAT_LEGS = [
  { key: 'far-hind', hipX: 185, phase: .5, hind: true, far: true },
  { key: 'far-front', hipX: 321, phase: 0, hind: false, far: true },
  { key: 'near-hind', hipX: 177, phase: 0, hind: true, far: false },
  { key: 'near-front', hipX: 328, phase: .5, hind: false, far: false },
] as const;

type BodySegment = { pivot: Point; angle: number; rise: number; shift?: number };

/** Pelvis, lumbar spine and ribcage: small counter-rotations through the gait. */
export function catTorso(distance: number, walking: number, bob: number): BodySegment[] {
  const cycle = distance / CAT_STRIDE * Math.PI * 2;
  return [
    { pivot: { x: 186, y: 170 }, angle: Math.sin(cycle) * 2.7 * walking, rise: bob },
    { pivot: { x: 253, y: 170 }, angle: Math.sin(cycle + .4) * -4 * walking, rise: bob + Math.sin(cycle) * 1.8 * walking },
    { pivot: { x: 320, y: 172 }, angle: Math.sin(cycle + 1.1) * 2.6 * walking, rise: bob + Math.cos(cycle) * 1.7 * walking },
  ];
}

/** Blend neighboring bone transforms, giving the torso one continuous skin. */
export function catSkinPoint(point: Point, segments: BodySegment[]): Point {
  const index = point.x < segments[1].pivot.x ? 0 : 1;
  const first = segments[index];
  const second = segments[index + 1];
  const weight = smooth((point.x - first.pivot.x) / (second.pivot.x - first.pivot.x));
  const transform = (segment: BodySegment): Point => {
    const radians = segment.angle * Math.PI / 180;
    const x = point.x - segment.pivot.x;
    const y = point.y - segment.pivot.y;
    return { x: segment.pivot.x + x * Math.cos(radians) - y * Math.sin(radians) + (segment.shift ?? 0), y: segment.pivot.y + x * Math.sin(radians) + y * Math.cos(radians) + segment.rise };
  };
  const a = transform(first);
  const b = transform(second);
  return { x: mix(a.x, b.x, weight), y: mix(a.y, b.y, weight) };
}

/** Three rigid segments: elbow and knee bend oppositely; wrist and hock stay above the toes. */
export function catLegPose(distance: number, phase: number, hipX: number, hind: boolean, walking: number, bob: number, acting?: { foot: Point; torso: BodySegment[]; toeAngle: number }) {
  const moving = catFoot(distance, phase, hipX);
  // Stop at the current footprint. Blending towards a generic standing pose
  // would drag planted paws sideways while the cat pauses.
  const foot = acting?.foot ?? { x: moving.x, y: mix(274, moving.y, walking) };
  const cycle = (distance / CAT_STRIDE + phase) * Math.PI * 2;
  const bodyRoot = catSkinPoint({ x: hipX, y: hind ? 157 : 167 }, acting?.torso ?? catTorso(distance, walking, bob));
  const hip = {
    x: bodyRoot.x + (hind ? Math.cos(cycle) * 3 * walking : (foot.x - hipX) * .24),
    y: bodyRoot.y + Math.sin(cycle) * (hind ? 1.4 : 2) * walking,
  };
  const [upper, lower, distal] = CAT_LEG_LENGTHS[hind ? 'hind' : 'front'];
  // A raised heel (hock) is not a backwards knee. The short forefoot inclines
  // with the reach, keeping a distinct carpus instead of turning it into a paw.
  const footAngle = hind ? .57 + (foot.x - hip.x) * .0045 : .08 + (foot.x - hip.x) * .008;
  const ankle = { x: foot.x - Math.sin(footAngle) * distal, y: foot.y - Math.cos(footAngle) * distal };
  const knee = kneeBetween(hip, ankle, upper, lower, hind ? 1 : -1);
  const stridePhase = ((distance / CAT_STRIDE + phase) % 1 + 1) % 1;
  const swing = progress(stridePhase, CAT_STANCE, 1);
  // A small toe tuck softens the lifted paw; planted paws always remain flat.
  const toeAngle = acting?.toeAngle ?? Math.sin(Math.PI * swing) ** 2 * 10 * walking;
  return { hip, knee, ankle, foot, toeAngle };
}

/** A shared rig drives both the bones and the skin drawn over them. */
export function catRig(time: number, distance: number, strideOffset = 0) {
  distance += strideOffset;
  const walking = catWalking(time);
  const cycle = distance / CAT_STRIDE * Math.PI * 2;
  const bob = -7 - Math.cos(cycle * 2 + Math.PI * .12) * 3.2 * walking;
  const torso = catTorso(distance, walking, bob);
  const acting = catActing(time);
  // The chest receives the stop first; the pelvis and tail settle after it.
  torso[2].shift = acting.inspect * 7 + acting.recommit * 5;
  torso[2].rise += acting.inspect * 4 - acting.recommit * 2;
  torso[2].angle += acting.inspect * 2;
  torso[1].shift = acting.inspect * 3 + acting.recommit * 2;
  torso[1].rise += acting.inspect * 2;
  torso[0].shift = acting.settle * 2 - acting.push * 3;
  torso[0].rise += acting.settle * 2 + acting.push * 3;
  const legs = CAT_LEGS.map(leg => {
    const moving = catFoot(distance, leg.phase, leg.hipX);
    const foot = { x: moving.x, y: mix(274, moving.y, walking) };
    const swing = progress(((distance / CAT_STRIDE + leg.phase) % 1 + 1) % 1, CAT_STANCE, 1);
    let toeAngle = Math.sin(Math.PI * swing) ** 2 * 10 * walking;
    if (leg.key === 'near-front') {
      // This lifted paw describes an intentional arc. The other three feet
      // retain their ground footprints while the weight moves above them.
      foot.x += acting.paw.x;
      foot.y -= acting.paw.y;
      toeAngle += acting.paw.y / 39 * -14;
    }
    return { ...leg, ...catLegPose(distance, leg.phase, leg.hipX, leg.hind, walking, bob, { foot, torso, toeAngle }) };
  });
  const neckBase = catSkinPoint({ x: 336, y: 178 }, torso);
  const neckAngle = -3 + Math.sin(cycle - .3) * 2.8 * walking + acting.lookDown * 15 - acting.recommit * 4;
  const headAngle = -neckAngle * .35 + Math.sin(cycle - .8) * .8 * walking + acting.lookDown * 7;
  const tailAngle = Math.sin(cycle - .85) * 3.5 * walking + acting.tail * 7;
  const tailCurl = Math.sin(cycle - 1.3) * 6 * walking + acting.tail * 9;
  const tailBase = catSkinPoint({ x: 155, y: 157 }, torso);
  const nearEar = acting.attention * 13 - acting.recommit * 9;
  const farEar = acting.attention * -9 + acting.recommit * 5;
  return { walking, bob, legs, torso, neckBase, neckAngle, headAngle, tailBase, tailAngle, tailCurl, nearEar, farEar, acting };
}

export type CatPose = ReturnType<typeof catRig>;

/** Integral of a trapezoidal speed curve: no position or velocity discontinuity. */
function catWalk(time: number, start: number, end: number) {
    const ramp = .3;
    const elapsed = Math.max(0, Math.min(end - start, time - start));
    const length = end - start;
    const traveled = elapsed < ramp ? elapsed * elapsed / (2 * ramp)
      : elapsed > length - ramp ? length - ramp - (length - elapsed) ** 2 / (2 * ramp)
      : elapsed - ramp / 2;
    return traveled / (length - ramp);
}

/** The cat catches the yarn, considers it, taps it, and chooses to follow. */
export function catTravel(time: number): number {
  if (time < 2.65) return .48 * catWalk(time, .1, 2.65);
  if (time < 3.75) return .48;
  return mix(.48, 1, catWalk(time, 3.75, 6.6));
}

export function catWalking(time: number): number {
  return 1 - fadeWindow(time, 2.4, 2.65, 3.75, 4.02);
}

function catKeys(time: number, keys: readonly (readonly [number, number])[]) {
  for (let i = 1; i < keys.length; i++) {
    if (time <= keys[i][0]) return mix(keys[i - 1][1], keys[i][1], smooth(progress(time, keys[i - 1][0], keys[i][0])));
  }
  return keys.at(-1)![1];
}

/** Authored acting beats are separate from the repeating locomotion cycle. */
export function catActing(time: number) {
  return {
    attention: fadeWindow(time, 2.12, 2.3, 3.65, 4.05),
    lookDown: fadeWindow(time, 2.24, 2.65, 3.27, 3.72),
    inspect: fadeWindow(time, 2.37, 2.78, 3.3, 3.75),
    settle: fadeWindow(time, 2.48, 2.94, 3.42, 3.88),
    recommit: fadeWindow(time, 3.5, 3.73, 3.88, 4.13),
    push: fadeWindow(time, 3.64, 3.79, 3.9, 4.14),
    tail: catKeys(time, [[0,0],[2.5,0],[2.78,-.7],[2.94,0],[3.68,0],[3.94,-.6],[4.23,.3],[4.5,0],[6.8,0]]),
    paw: {
      x: catKeys(time, [[0,0],[2.68,0],[2.85,-8],[2.94,8],[3.06,8],[3.22,54],[3.3,63],[3.48,15],[3.62,0],[6.8,0]]),
      y: catKeys(time, [[0,0],[2.68,0],[2.85,32],[2.94,39],[3.06,39],[3.22,24],[3.3,25],[3.48,26],[3.62,0],[6.8,0]]),
    },
  };
}

/** The paw imparts an impulse, then finishes the push over its follow-through. */
function catYarnRoll(time: number) {
  const length = 6.6 - 3.22;
  const elapsed = Math.max(0, Math.min(length, time - 3.22));
  const push = .08;
  const settle = .3;
  const total = length - push * .25 - settle / 2;
  const traveled = elapsed < push ? elapsed * .5 + elapsed * elapsed / (4 * push)
    : elapsed > length - settle ? total - (length - elapsed) ** 2 / (2 * settle)
    : elapsed - push * .25;
  return traveled / total;
}

/** Shared scene coordinates keep the touch and the planted paws true at any size. */
export function catBlocking(time: number, viewportWidth: number) {
  const width = Math.max(280, Math.min(470, viewportWidth * .39));
  const scale = width / 470;
  const track = viewportWidth + width * 1.15;
  const distance = track * catTravel(time);
  const x = -width * 1.15 + distance;
  const stopDistance = track * .48 / scale;
  const strideOffset = CAT_STRIDE * .22 - stopDistance % CAT_STRIDE;
  const ballStart = -width * 1.15 + 526.4 * scale;
  const ballRest = -width * 1.15 + track * .48 + 430 * scale;
  // The toy stops before the cat. Only the touch at 3.22 s releases it again.
  // After contact it coasts ahead; the cat waits, then catches up slightly.
  const ballX = time < 3.22 ? mix(ballStart, ballRest, catWalk(time, .1, 2.4))
    : ballRest + (viewportWidth + 526.4 * scale - ballRest) * catYarnRoll(time);
  return { width, scale, distance, x, strideOffset, ballX, ballDistance: ballX - ballStart };
}
