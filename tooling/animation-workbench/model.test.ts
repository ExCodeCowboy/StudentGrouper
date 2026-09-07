import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHANNELS, KEY_TIME_TOLERANCE, cloneClip, createClip, holdPose, moveKey, parseClip, removeKey,
  sampleChannel, sampleTrack, serializeClip, setKey, setKeyEasing,
  type ChannelId, type ClipDocument, type Keyframe,
} from './model';

const key = (id: string, time: number, value: number, easing: Keyframe['easing'] = 'smooth'): Keyframe => ({ id, time, value, easing });

function frozen<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(frozen);
  }
  return value;
}

void test('an empty clip leaves every adapter channel at its baseline', () => {
  const clip = createClip();
  assert.equal(clip.duration, 6.8);
  assert.equal(new Set(CHANNELS.map(channel => channel.id)).size, 26);
  for (const channel of CHANNELS) {
    assert.ok(channel.min <= 0 && channel.max >= 0 && channel.step > 0);
    for (const time of [-1, 0, 3.22, 6.8, 100]) {
      const expected: number = channel.id === 'motion.time' ? Math.max(0, Math.min(clip.duration, time)) : 0;
      assert.equal(sampleChannel(clip, channel.id, time), expected);
    }
  }
});

void test('source time is an identity mapping until explicitly keyed, then supports retiming and holds', () => {
  const empty = createClip();
  for (const time of [0, 1, 3.22, 6.8]) assert.equal(sampleChannel(empty, 'motion.time', time), time);
  assert.equal(sampleChannel({ ...empty, tracks: { 'motion.time': [] } }, 'motion.time', 2.4), 2.4);
  assert.equal(sampleChannel(empty, 'motion.time', -1), 0);
  assert.equal(sampleChannel(empty, 'motion.time', 100), 6.8);
  const retimed = setKey(setKey(empty, 'motion.time', 0, 0, 'linear'), 'motion.time', 4, 2);
  assert.equal(sampleChannel(retimed, 'motion.time', 2), 1, 'source motion can play at half speed');
  const held = setKey(setKey(retimed, 'motion.time', 4, 2, 'hold'), 'motion.time', 5, 3.22, 'linear');
  assert.equal(sampleChannel(held, 'motion.time', 4.75), 2, 'an outgoing hold freezes the whole source pose');
  assert.equal(sampleChannel(held, 'motion.time', 5), 3.22, 'the next source-time key takes effect at its boundary');
  assert.deepEqual(parseClip(serializeClip(held)), held, 'retiming uses the same version 1 persistence format');
});

void test('holding a pose freezes source time and all keyed offsets while removing interior keys', () => {
  const original = frozen(setKey(setKey(setKey(setKey(createClip(), 'body.x', 0, 0, 'linear'), 'body.x', 2, 20, 'linear'), 'body.x', 3, 30), 'attention', 1, .5));
  const held = holdPose(original, 1.5, 1);
  assert.equal(held.duration, original.duration);
  assert.deepEqual(Object.keys(held.tracks).sort(), ['attention', 'body.x', 'motion.time']);
  assert.deepEqual(held.tracks['body.x']!.map(key => key.time), [0, 1.5, 2.5, 3]);
  assert.deepEqual(held.tracks['motion.time']!.map(key => [key.time, key.value, key.easing]), [
    [0, 0, 'linear'], [1.5, 1.5, 'hold'], [2.5, 1.5, 'linear'], [6.8, 6.8, 'linear'],
  ]);
  for (const time of [1.5, 1.75, 2, 2.499, 2.5]) for (const channel of CHANNELS) {
    assert.equal(sampleChannel(held, channel.id, time), sampleChannel(original, channel.id, 1.5), `${channel.id} freezes for the whole interval`);
  }
  assert.equal(sampleChannel(held, 'body.x', 2.75), 22.5, 'pose offsets resume toward the next surviving key');
  assert.equal(sampleChannel(held, 'motion.time', 6.8), 6.8, 'source time catches up by the final anchor');
  assert.deepEqual(original.tracks['body.x']!.map(key => key.time), [0, 2, 3]);
  assert.equal(original.tracks['motion.time'], undefined);
});

void test('holding an already retimed pose preserves its next source target and handles the clip boundary', () => {
  let clip = setKey(setKey(createClip(), 'motion.time', 0, 0, 'linear'), 'motion.time', 2, 1, 'linear');
  clip = setKey(setKey(clip, 'motion.time', 5, 4, 'linear'), 'motion.time', 6.8, 6.8, 'linear');
  const held = holdPose(clip, 1.5, 1);
  assert.equal(sampleChannel(held, 'motion.time', 2.25), .75);
  assert.equal(sampleChannel(held, 'motion.time', 3.75), 2.375, 'resumption is linear toward the existing next source-time key');
  assert.equal(sampleChannel(held, 'motion.time', 5), 4);
  assert.equal(holdPose(clip, clip.duration), clip);
  const atEnd = holdPose(clip, 6.75, 1);
  assert.ok(atEnd.tracks['motion.time']!.every(key => key.time <= clip.duration));
  assert.equal(sampleChannel(atEnd, 'motion.time', clip.duration), sampleChannel(clip, 'motion.time', 6.75));
  assert.throws(() => holdPose(clip, NaN), /finite/);
  assert.throws(() => holdPose(clip, 1, 0), /greater than zero/);
});

void test('track sampling uses the outgoing easing and holds endpoint values', () => {
  const linear = [key('a', 1, 0, 'linear'), key('b', 5, 10, 'hold')];
  assert.equal(sampleTrack(linear, 2), 2.5);
  assert.equal(sampleTrack(linear, -10), 0);
  assert.equal(sampleTrack(linear, 10), 10);
  assert.equal(sampleTrack([{ ...linear[0], easing: 'smooth' }, linear[1]], 2), 1.5625);
  const held = [{ ...linear[0], value: -4, easing: 'hold' as const }, linear[1]];
  assert.equal(sampleTrack(held, 4.999), -4);
  assert.equal(sampleTrack(held, 5), 10);
  assert.equal(sampleTrack([key('a', 3, 7)], 0), 7);
  assert.equal(sampleTrack([], 0), 0);
  assert.throws(() => sampleTrack(linear, NaN), /finite/);
});

void test('setting a nearby key replaces it immutably and keeps its identity and easing', () => {
  const original = frozen(setKey(createClip(), 'head.angle', 2, 10, 'linear'));
  const id = original.tracks['head.angle']![0].id;
  const time = 2 + KEY_TIME_TOLERANCE / 2;
  const edited = setKey(original, 'head.angle', time, 20);
  assert.deepEqual(edited.tracks['head.angle'], [key(id, time, 20, 'linear')]);
  assert.deepEqual(original.tracks['head.angle'], [key(id, 2, 10, 'linear')]);
  assert.notEqual(edited.tracks, original.tracks);
  const separate = setKey(edited, 'head.angle', time + KEY_TIME_TOLERANCE * 2, 25);
  assert.equal(separate.tracks['head.angle']!.length, 2);
  assert.equal(setKey(edited, 'head.angle', time, 12, 'hold').tracks['head.angle']![0].easing, 'hold');
});

void test('new keys get deterministic identities unique across channels', () => {
  const original = setKey(createClip(), 'body.x', 0, 0);
  const a = setKey(original, 'chest.y', 1, 2);
  const b = setKey(original, 'chest.y', 1, 2);
  assert.deepEqual(a, b);
  assert.notEqual(a.tracks['body.x']![0].id, a.tracks['chest.y']![0].id);
  assert.equal(original.tracks['chest.y'], undefined);
});

void test('moving a key reorders the track and resolves a collision in favor of the dragged key', () => {
  const original = frozen(setKey(setKey(setKey(createClip(), 'body.x', 1, 10, 'hold'), 'body.x', 2, 20), 'body.x', 3, 30));
  const draggedId = original.tracks['body.x']![0].id;
  const moved = moveKey(original, 'body.x', draggedId, 2.5);
  assert.deepEqual(moved.tracks['body.x']!.map(entry => entry.time), [2, 2.5, 3]);
  assert.equal(moved.tracks['body.x']![1].value, 10);
  assert.equal(moved.tracks['body.x']![1].easing, 'hold');
  const merged = moveKey(moved, 'body.x', draggedId, 3 + KEY_TIME_TOLERANCE / 2, 45);
  assert.equal(merged.tracks['body.x']!.length, 2);
  assert.equal(merged.tracks['body.x']![1].id, draggedId);
  assert.equal(merged.tracks['body.x']![1].value, 45);
  assert.deepEqual(original.tracks['body.x']!.map(entry => entry.time), [1, 2, 3]);
  assert.equal(moveKey(original, 'body.x', 'missing', 1), original);
});

void test('editing clamps positions to clip and channel bounds but rejects nonfinite values', () => {
  const low = setKey(createClip(), 'attention', -1, -500);
  assert.equal(low.tracks.attention![0].time, 0);
  assert.equal(low.tracks.attention![0].value, -1);
  const high = moveKey(low, 'attention', low.tracks.attention![0].id, 100, 500);
  assert.equal(high.tracks.attention![0].time, 6.8);
  assert.equal(high.tracks.attention![0].value, 1);
  assert.throws(() => setKey(low, 'body.x', NaN, 0), /finite/);
  assert.throws(() => setKey(low, 'body.x', 0, Infinity), /finite/);
  assert.throws(() => moveKey(low, 'attention', low.tracks.attention![0].id, 0, NaN), /finite/);
  assert.throws(() => setKey(low, 'unknown' as ChannelId, 0, 0), /Unknown/);
});

void test('easing edits and key removal preserve the original clip and restore an empty channel to baseline', () => {
  const original = frozen(setKey(setKey(createClip(), 'tail.angle', 0, 0), 'tail.angle', 4, 20));
  const id = original.tracks['tail.angle']![0].id;
  const held = setKeyEasing(original, 'tail.angle', id, 'hold');
  assert.equal(sampleChannel(held, 'tail.angle', 3), 0);
  assert.ok(sampleChannel(original, 'tail.angle', 3) > 0);
  const oneLeft = removeKey(held, 'tail.angle', id);
  const empty = removeKey(oneLeft, 'tail.angle', oneLeft.tracks['tail.angle']![0].id);
  assert.equal(empty.tracks['tail.angle'], undefined);
  assert.equal(sampleChannel(empty, 'tail.angle', 3), 0);
  assert.equal(removeKey(empty, 'tail.angle', id), empty);
});

void test('clip export and import round-trip independently and normalize key order', () => {
  const original: ClipDocument = {
    ...createClip('Reach and inspect', 8),
    tracks: { 'head.angle': [key('end', 8, 12, 'linear'), key('start', 0, -3)], 'attention': [] },
  };
  const loaded = parseClip(serializeClip(original));
  assert.deepEqual(loaded.tracks['head.angle']!.map(entry => entry.time), [0, 8]);
  assert.equal(loaded.tracks.attention, undefined);
  assert.equal(serializeClip(loaded), serializeClip(original));
  const copied = cloneClip(loaded);
  copied.tracks['head.angle']![0].value = 7;
  assert.equal(loaded.tracks['head.angle']![0].value, -3);
  assert.equal(original.tracks['head.angle']![0].id, 'end');
});

void test('imports reject invalid document metadata and unrecognized fields or channels', () => {
  for (const input of [
    null, [], {}, { ...createClip(), version: 2 }, { ...createClip(), name: '' },
    { ...createClip(), name: 'a'.repeat(121) }, { ...createClip(), name: 'line\nbreak' },
    { ...createClip(), duration: 0 }, { ...createClip(), duration: 121 }, { ...createClip(), duration: null },
    { ...createClip(), extra: true }, { ...createClip(), tracks: [] },
    { ...createClip(), tracks: { 'unknown.channel': [] } },
  ]) assert.throws(() => parseClip(JSON.stringify(input)));
  assert.throws(() => parseClip('{"version":1,"name":"x","duration":6.8,"tracks":{"__proto__":[]}}'), /Unknown/);
  assert.throws(() => parseClip('{unfinished'), /valid JSON/);
  assert.throws(() => createClip('x', Infinity), /finite/);
  assert.throws(() => parseClip(' '.repeat(1_000_001)), /1 MB/);
});

void test('imports reject malformed, out-of-bounds, duplicate, or nonfinite keys', () => {
  const good = key('a', 2, 0);
  const invalidEntries: unknown[] = [
    null, [], { ...good, time: -1 }, { ...good, time: 7 }, { ...good, time: null },
    { ...good, value: 1000 }, { ...good, value: null }, { ...good, value: '2' },
    { ...good, id: '' }, { ...good, id: 'bad id' }, { ...good, id: 'a'.repeat(65) },
    { ...good, easing: 'bounce' }, { ...good, extra: 1 }, { time: 1, value: 0, easing: 'smooth' },
  ];
  for (const entry of invalidEntries) {
    assert.throws(() => parseClip(JSON.stringify({ ...createClip(), tracks: { 'body.x': [entry] } })));
  }
  assert.throws(() => parseClip(JSON.stringify({ ...createClip(), tracks: { 'body.x': [good, key('b', 2, 1)] } })), /duplicate key times/);
  assert.throws(() => parseClip(JSON.stringify({ ...createClip(), tracks: { 'body.x': [good], 'body.y': [good] } })), /unique/);
  assert.throws(() => serializeClip({ ...createClip(), tracks: { 'body.x': [key('a', 0, Infinity)] } }), /finite/);
});

void test('imports and edits enforce bounded key counts', () => {
  const keys = Array.from({ length: 512 }, (_, index) => key(`k${index + 1}`, index / 100, 0));
  const full: ClipDocument = { ...createClip(), tracks: { 'body.x': keys } };
  assert.equal(parseClip(serializeClip(full)).tracks['body.x']!.length, 512);
  assert.throws(() => setKey(full, 'body.x', 6, 0), /at most 512/);
  assert.throws(() => parseClip(JSON.stringify({ ...full, tracks: { 'body.x': [...keys, key('extra', 6, 0)] } })), /at most 512/);
  const tracks = Object.fromEntries(CHANNELS.slice(0, 9).map((channel, trackIndex) => [channel.id, keys.map(entry => ({ ...entry, id: `t${trackIndex}_${entry.id}` }))]));
  assert.throws(() => parseClip(JSON.stringify({ ...createClip(), tracks })), /at most 4096/);
});
