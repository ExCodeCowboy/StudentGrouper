import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { REVEAL_SOUND_LIBRARY, REVEAL_SOUND_SAMPLE_RATE, type RevealSoundId } from '../src/revealEffects/revealSounds';
import { revealEffects } from '../src/revealEffects/registry';

const folder = 'public/sounds/reveals/';
const rate = REVEAL_SOUND_SAMPLE_RATE;
type CueManifest = { file: string; sha256: string; durationMs: number; cues: { sourceId: string; file: string; at: number; duration: number; sha256: string }[] };
const manifest = JSON.parse(readFileSync(`${folder}CUES.json`, 'utf8')) as CueManifest[];
const provenance = JSON.parse(readFileSync(`${folder}SOURCES.json`, 'utf8')) as { sources: { id: string; license: string; sourceUrl: string }[] };

function readWave(id: RevealSoundId) {
  const bytes = readFileSync(`${folder}${id}.wav`);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  let data: Buffer | undefined;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const chunk = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    assert.ok(offset + 8 + size <= bytes.length);
    if (chunk === 'fmt ') {
      assert.equal(bytes.readUInt16LE(offset + 8), 1, 'PCM format works offline across WebViews');
      assert.equal(bytes.readUInt16LE(offset + 10), 1, 'mono');
      assert.equal(bytes.readUInt32LE(offset + 12), rate);
      assert.equal(bytes.readUInt16LE(offset + 22), 16);
    }
    if (chunk === 'data') data = bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  assert.ok(data);
  const samples = Float32Array.from({ length: data.length / 2 }, (_, i) => data.readInt16LE(i * 2) / 32768);
  return { bytes, samples };
}

function energy(samples: Float32Array, from: number, to: number) {
  const start = Math.round(from * rate); const end = Math.min(samples.length, Math.round(to * rate));
  let total = 0;
  for (let i = start; i < end; i++) total += samples[i] ** 2;
  return total / Math.max(1, end - start);
}

void test('all reveal recordings match the visuals and retain complete CC0 provenance', () => {
  assert.deepEqual(Object.keys(REVEAL_SOUND_LIBRARY).sort(), revealEffects.map(effect => effect.id).sort());
  assert.equal(manifest.length, revealEffects.length);
  for (const effect of revealEffects) {
    const id = effect.id as RevealSoundId;
    const profile = REVEAL_SOUND_LIBRARY[id];
    const { bytes, samples } = readWave(id);
    const entry = manifest.find(item => item.file === `${id}.wav`);
    assert.ok(entry);
    assert.equal(effect.sound, id, 'the resolved visual selects its matching recording');
    assert.equal(profile.durationMs, effect.durationMs);
    assert.equal(entry.durationMs, effect.durationMs);
    assert.equal(samples.length, Math.round(effect.durationMs * rate / 1000));
    assert.equal(profile.asset, `/sounds/reveals/${id}.wav?v=${entry.sha256.slice(0, 12)}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    assert.deepEqual([...new Set(entry.cues.map(cue => cue.sourceId))].sort(), [...profile.sourceIds].sort());
    for (const cue of entry.cues) {
      const source = provenance.sources.find(item => item.id === cue.sourceId);
      assert.ok(source, `${id}: source ${cue.sourceId} is credited`);
      assert.equal(source.license, 'CC0-1.0');
      assert.ok(source.sourceUrl.startsWith('https://'));
      assert.match(cue.sha256, /^[a-f0-9]{64}$/);
      assert.ok(cue.at >= 0 && cue.duration > 0 && cue.at + cue.duration <= effect.durationMs / 1000);
    }
    for (const cue of profile.cues) {
      assert.ok(energy(samples, cue.at, cue.at + cue.duration) > 1e-7, `${id}: cue contains sound`);
    }
  }
});

void test('bundled reveal recordings keep conservative levels and silent boundaries', () => {
  for (const id of Object.keys(REVEAL_SOUND_LIBRARY) as RevealSoundId[]) {
    const { samples } = readWave(id);
    let peak = 0; let mean = 0;
    for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); mean += sample; }
    assert.ok(peak > .02 && peak <= .241, `${id}: peak ${peak}`);
    assert.ok(energy(samples, 0, samples.length / rate) < .0016, `${id}: RMS below .04 before master gain`);
    assert.ok(Math.abs(mean / samples.length) < .0001, `${id}: no persistent DC offset`);
    assert.equal(energy(samples, 0, .08), 0);
    assert.equal(energy(samples, samples.length / rate - .05, samples.length / rate), 0);
  }
});

void test('cat recording leaves travel quiet and Apollo accents stay in separate phases', () => {
  const cat = readWave('cat').samples;
  assert.equal(energy(cat, 0, 2.05), 0);
  assert.ok(energy(cat, 2.05, 3.22) > 1e-5);
  assert.ok(energy(cat, 3.22, 3.6) > 1e-6);
  assert.equal(energy(cat, 3.61, 6.8), 0);
  const moon = readWave('moon').samples;
  assert.ok(energy(moon, .24, 2.3) > 1e-5);
  // A mostly sub-bass clip passed the level checks but disappeared on small
  // speakers. Require enough rumble texture above their weakest bass range.
  const decay = Math.exp(-2 * Math.PI * 200 / rate);
  let previous = 0; let filtered = 0; let midPower = 0; let count = 0;
  for (let i = Math.round(.24 * rate); i < Math.round(2.3 * rate); i++) {
    filtered = decay * (filtered + moon[i] - previous);
    previous = moon[i]; midPower += filtered * filtered; count++;
  }
  assert.ok(Math.sqrt(midPower / count) > .03, 'liftoff has usable rumble texture above 200 Hz');
  assert.equal(energy(moon, 2.31, 5.85), 0);
  assert.ok(energy(moon, 5.85, 6.25) > 1e-6);
  assert.equal(energy(moon, 6.26, 6.88), 0);
  assert.ok(energy(moon, 6.88, 8.18) > 1e-5);
});
