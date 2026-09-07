import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAT_LEG_LENGTHS, catBlocking, catRig, catSkinPoint, type CatPose } from '../../src/revealEffects/sceneMotion';
import { evaluateCat } from './catAdapter';
import { CHANNELS, createClip, holdPose, setKey, type ChannelId, type ClipDocument } from './model';

const VIEWPORTS = [640, 960, 1280, 1920];
const POSE_TIMES = [0, .5, 2.65, 3.22, 3.75, 5.8, 6.8];

function poseWith(values: Partial<Record<ChannelId, number>>) {
  return Object.entries(values).reduce((clip, [channel, value]) => setKey(clip, channel as ChannelId, 0, value), createClip());
}

function assertMechanics(rig: CatPose, label: string) {
  for (const leg of rig.legs) {
    const context = `${label}: ${leg.key}`;
    const joints = [leg.hip, leg.knee, leg.ankle, leg.foot];
    const lengths = CAT_LEG_LENGTHS[leg.hind ? 'hind' : 'front'];
    for (let index = 0; index < 3; index++) {
      const actual = Math.hypot(joints[index + 1].x - joints[index].x, joints[index + 1].y - joints[index].y);
      assert.ok(Math.abs(actual - lengths[index]) < 1e-8, `${context} segment ${index} remains rigid`);
    }
    assert.ok(joints.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), `${context} coordinates are finite`);
    const bend = (leg.ankle.x - leg.hip.x) * (leg.knee.y - leg.hip.y) - (leg.ankle.y - leg.hip.y) * (leg.knee.x - leg.hip.x);
    assert.ok(leg.hind ? bend < 0 : bend > 0, `${context} preserves its anatomical bend side`);
    assert.ok(leg.hip.y < 274 && leg.foot.y <= 274 + 1e-8, `${context} remains above the floor`);
    assert.ok(leg.ankle.y < leg.foot.y - 15, `${context} preserves wrist/hock clearance`);
    const radians = leg.toeAngle * Math.PI / 180;
    for (const [x, y] of [[-7, -2], [-3, 0], [6, 0], [13, -1], [13, -6], [7, -8]]) {
      const bottom = leg.foot.y + x * Math.sin(radians) + y * Math.cos(radians);
      assert.ok(bottom <= 274 + 1e-8, `${context} toe outline clears the floor`);
    }
  }
}

void test('the workbench baseline exactly preserves the real responsive reveal rig', () => {
  for (const width of VIEWPORTS) for (const time of POSE_TIMES) {
    const blocking = catBlocking(time, width);
    const expected = catRig(time, blocking.distance / blocking.scale, blocking.strideOffset);
    const result = evaluateCat(createClip(), time, width);
    assert.equal(result.sourceTime, time);
    assert.deepEqual(result.blocking, blocking);
    assert.deepEqual(result.rig, expected, `${width}px at ${time}s: no editor offsets alter the baseline`);
    assert.deepEqual(result.warnings, []);
    for (const leg of result.rig.legs) {
      assert.deepEqual(result.handles.find(handle => handle.id === leg.key)!.point, leg.foot, 'the paw control tracks the displayed paw');
    }
  }
});

void test('source-time holds freeze the whole production pose and scene placement until the next key', () => {
  const held = setKey(setKey(createClip(), 'motion.time', 2, 3.22, 'hold'), 'motion.time', 4, 4.5, 'linear');
  for (const width of VIEWPORTS) {
    const expected = evaluateCat(createClip(), 3.22, width);
    for (const time of [2, 2.4, 3.3, 3.999]) {
      const result = evaluateCat(held, time, width);
      assert.equal(result.sourceTime, 3.22);
      assert.deepEqual(result.rig, expected.rig, 'a held source time freezes every authored acting and gait channel');
      assert.deepEqual(result.blocking, expected.blocking, 'the cat and yarn hold together in scene coordinates');
    }
    const after = evaluateCat(held, 4, width);
    assert.equal(after.sourceTime, 4.5);
    assert.notDeepEqual(after.rig, expected.rig);
    assert.notDeepEqual(after.blocking, expected.blocking);
  }
});

void test('retiming changes the baseline clock while pose offsets continue using editor time', () => {
  const halfSpeed = setKey(setKey(createClip(), 'motion.time', 0, 0, 'linear'), 'motion.time', 6.8, 3.4);
  assert.deepEqual(evaluateCat(halfSpeed, 4, 1280).rig, evaluateCat(createClip(), 2, 1280).rig);
  const held = setKey(setKey(createClip(), 'motion.time', 2, 3.22, 'hold'), 'motion.time', 4, 4.5);
  const layered = setKey(setKey(held, 'head.angle', 2, 0, 'linear'), 'head.angle', 4, 20);
  const first = evaluateCat(layered, 2.5, 960);
  const later = evaluateCat(layered, 3.5, 960);
  assert.equal(first.sourceTime, later.sourceTime);
  assert.equal(later.rig.headAngle - first.rig.headAngle, 10, 'an editor-time head turn can be layered over a source-pose hold');
  assert.deepEqual(later.rig.legs, first.rig.legs);
  assert.deepEqual(later.blocking, first.blocking);
});

void test('the whole-pose hold helper freezes both source motion and animated offset tracks', () => {
  const moving = setKey(setKey(createClip(), 'head.angle', 0, 0, 'linear'), 'head.angle', 4, 20);
  const held = holdPose(moving, 1.5, 1);
  for (const width of VIEWPORTS) {
    const original = evaluateCat(moving, 1.5, width);
    for (const time of [1.5, 1.75, 2, 2.5]) {
      const result = evaluateCat(held, time, width);
      assert.deepEqual(result.rig, original.rig);
      assert.deepEqual(result.blocking, original.blocking);
    }
  }
});

void test('extreme paw drags and combined torso edits stay within the anatomical constraints', () => {
  const clips: ClipDocument[] = [];
  for (const paw of ['near-front', 'far-front', 'near-hind', 'far-hind'] as const) {
    for (const x of [-90, 90]) for (const y of [-70, 70]) {
      clips.push(poseWith({ [`paw.${paw}.x`]: x, [`paw.${paw}.y`]: y }));
    }
  }
  for (let corner = 0; corner < 4; corner++) {
    const values = Object.fromEntries(CHANNELS.map((channel, index) => [channel.id, (corner < 2 ? corner === 0 : (index + corner) % 2 === 0) ? channel.min : channel.max]));
    clips.push(poseWith(values));
  }
  for (const [index, clip] of clips.entries()) for (const time of [0, 3.22, 3.75, 5.8]) {
    assertMechanics(evaluateCat(clip, time, VIEWPORTS[index % VIEWPORTS.length]).rig, `extreme edit ${index} at ${time}s`);
  }
});

void test('seeded combined pose edits preserve the constraints without modifying saved values', () => {
  let seed = 0x5eed;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
  for (let index = 0; index < 32; index++) {
    const clip = poseWith(Object.fromEntries(CHANNELS.map(channel => [channel.id, channel.min + random() * (channel.max - channel.min)])));
    const snapshot = JSON.stringify(clip);
    const time = random() * 6.8;
    const result = evaluateCat(clip, time, VIEWPORTS[index % VIEWPORTS.length]);
    assertMechanics(result.rig, `seeded edit ${index} at ${time}s`);
    assert.equal(JSON.stringify(clip), snapshot, 'reach correction affects only the evaluated pose, not the saved keyframes');
  }
});

void test('unreachable requests produce a visible warning and a valid corrected pose', () => {
  const clip = poseWith({ 'paw.near-front.y': 70, 'paw.near-front.x': 90 });
  const result = evaluateCat(clip, 3.22, 1280);
  const base = evaluateCat(createClip(), 3.22, 1280);
  const foot = result.rig.legs.find(leg => leg.key === 'near-front')!.foot;
  const originalFoot = base.rig.legs.find(leg => leg.key === 'near-front')!.foot;
  assert.ok(result.warnings.some(warning => warning.includes('Front paw · near') && warning.includes('limited')));
  assert.ok(Math.hypot(foot.x - originalFoot.x - 90, foot.y - originalFoot.y - 70) > .01, 'the unsafe drag is projected into a reachable pose');
  assertMechanics(result.rig, 'limited drag');
});

void test('expression channels apply to the production pose and attachment points follow the edited torso', () => {
  const time = 3.22;
  const original = evaluateCat(createClip(), time, 960);
  const edited = evaluateCat(poseWith({
    'head.angle': 12, 'neck.angle': -8, 'nearEar': 15, 'farEar': -10,
    'tail.angle': 9, 'tail.curl': 13, 'attention': -1,
    'body.x': 8, 'pelvis.x': 4, 'pelvis.y': -5, 'pelvis.angle': 8,
    'chest.y': -4, 'chest.angle': -6,
  }), time, 960);
  assert.equal(edited.rig.headAngle, original.rig.headAngle + 12);
  assert.equal(edited.rig.neckAngle, original.rig.neckAngle - 8);
  assert.equal(edited.rig.nearEar, original.rig.nearEar + 15);
  assert.equal(edited.rig.farEar, original.rig.farEar - 10);
  assert.equal(edited.rig.tailAngle, original.rig.tailAngle + 9);
  assert.equal(edited.rig.tailCurl, original.rig.tailCurl + 13);
  assert.equal(edited.rig.acting.attention, 0);
  assert.deepEqual(edited.rig.tailBase, catSkinPoint({ x: 155, y: 157 }, edited.rig.torso));
  assert.deepEqual(edited.rig.neckBase, catSkinPoint({ x: 336, y: 178 }, edited.rig.torso));
  assert.notDeepEqual(edited.rig.tailBase, original.rig.tailBase, 'the tail stays attached when the pelvis is edited');
  assertMechanics(edited.rig, 'expression and torso edit');
});
