import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { REVEAL_SOUND_LIBRARY, REVEAL_SOUND_SAMPLE_RATE, type RevealSoundId } from '../src/revealEffects/revealSounds';
import { revealEffects } from '../src/revealEffects/registry';

const folder = 'public/sounds/reveals/';
const rate = REVEAL_SOUND_SAMPLE_RATE;
type BuiltCue = { sourceId: string; file: string; at: number; duration: number; sha256: string };
type CueManifest = { file: string; sha256: string; durationMs: number; cues: BuiltCue[] };
type Source = { id: string; license: string; sourceUrl: string; script?: string; download?: { url: string; sha256: string } };
const manifest = JSON.parse(readFileSync(`${folder}CUES.json`, 'utf8')) as CueManifest[];
const provenance = JSON.parse(readFileSync(`${folder}SOURCES.json`, 'utf8')) as { sources: Source[]; files: { file: string; sha256: string; sourceIds: string[] }[] };
const recipe = JSON.parse(readFileSync('scripts/reveal-sound-cues.json', 'utf8')) as Record<string, { durationMs: number; cues: { sourceId: string; file: string; at: number }[] }>;

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

/** The built layers of one reveal (CUES.json mirrors the recipe, plus each clip's processed length). */
function builtCues(id: RevealSoundId) {
  const entry = manifest.find(item => item.file === `${id}.wav`);
  assert.ok(entry, `${id}: built`);
  return entry.cues;
}
const span = (cues: readonly BuiltCue[]) => [Math.min(...cues.map(cue => cue.at)), Math.max(...cues.map(cue => cue.at + cue.duration))] as const;

void test('all reveal recordings match the visuals and retain complete CC0 provenance', () => {
  assert.deepEqual(Object.keys(REVEAL_SOUND_LIBRARY).sort(), revealEffects.map(effect => effect.id).sort());
  assert.deepEqual(Object.keys(recipe).sort(), revealEffects.map(effect => effect.id).sort(), 'the recipe builds exactly the registered reveals');
  assert.equal(manifest.length, revealEffects.length);
  assert.deepEqual(provenance.files.map(item => item.file).sort(), revealEffects.map(effect => `${effect.id}.wav`).sort());
  for (const effect of revealEffects) {
    const id = effect.id as RevealSoundId;
    const profile = REVEAL_SOUND_LIBRARY[id];
    const { bytes, samples } = readWave(id);
    const entry = manifest.find(item => item.file === `${id}.wav`);
    assert.ok(entry);
    assert.equal(effect.sound, id, 'the resolved visual selects its matching recording');
    assert.equal(profile.durationMs, effect.durationMs);
    assert.equal(recipe[id].durationMs, effect.durationMs);
    assert.equal(entry.durationMs, effect.durationMs);
    assert.equal(samples.length, Math.round(effect.durationMs * rate / 1000));
    assert.equal(profile.asset, `/sounds/reveals/${id}.wav?v=${entry.sha256.slice(0, 12)}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    assert.equal(provenance.files.find(item => item.file === `${id}.wav`)?.sha256, entry.sha256, `${id}: SOURCES.json lists this exact file`);
    assert.deepEqual([...new Set(entry.cues.map(cue => cue.sourceId))].sort(), [...profile.sourceIds].sort());
    // The shipped track is the current recipe: same layers, same sources, same start times.
    assert.deepEqual(entry.cues.map(cue => [cue.sourceId, cue.file, cue.at]), recipe[id].cues.map(cue => [cue.sourceId, cue.file, cue.at]), `${id}: built from the current recipe`);
    for (const cue of entry.cues) {
      const source = provenance.sources.find(item => item.id === cue.sourceId);
      assert.ok(source, `${id}: source ${cue.sourceId} is credited`);
      assert.equal(source.license, 'CC0-1.0');
      assert.ok(source.sourceUrl.startsWith('https://'));
      // A recorded clip names its verified download; an electronic sound authored here names its generator script.
      if (source.id.startsWith('authored-')) assert.ok(source.script && existsSync(source.script), `${source.id}: generator script is in the repository`);
      else assert.ok(source.download?.url.startsWith('https://') && /^[a-f0-9]{64}$/.test(source.download.sha256), `${source.id}: verified download`);
      assert.match(cue.sha256, /^[a-f0-9]{64}$/);
      assert.ok(cue.at >= 0 && cue.duration > 0 && cue.at + cue.duration <= effect.durationMs / 1000);
    }
    for (const cue of profile.cues) {
      assert.ok(cue.at + cue.duration <= effect.durationMs / 1000, `${id}: cue "${cue.description}" ends inside the reveal`);
      assert.ok(energy(samples, cue.at, cue.at + cue.duration) > 1e-7, `${id}: cue "${cue.description}" contains sound`);
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

void test('every sound in a reveal track comes from a credited layer', () => {
  // Between (and around) the listed layers the track is digital silence, so nothing unlisted can hide in it.
  for (const id of Object.keys(REVEAL_SOUND_LIBRARY) as RevealSoundId[]) {
    const { samples } = readWave(id);
    const cues = [...builtCues(id)].sort((a, b) => a.at - b.at);
    let covered = 0;
    for (const cue of cues) {
      if (cue.at - covered > .01) assert.equal(energy(samples, covered + .002, cue.at - .002), 0, `${id}: silent between ${covered.toFixed(3)} and ${cue.at} s`);
      covered = Math.max(covered, cue.at + cue.duration);
    }
    assert.equal(energy(samples, covered + .002, samples.length / rate), 0, `${id}: silent after the last layer`);
  }
});

void test('the kitten mews around a quiet wiggle, and the Apollo accents stay in separate phases', () => {
  // Cat (scripts/reveal-sound-cues.json): soft paw taps from 0.30 s, a little mew, a quiet head tilt and wiggle
  // before the swish of the pounce, then a mew-purr after she pops out; the rest are quiet foley accents.
  const cat = readWave('cat').samples;
  const catCues = builtCues('cat');
  const mews = catCues.filter(cue => cue.sourceId === 'cat').sort((a, b) => a.at - b.at);
  assert.ok(mews.length >= 1, 'a real recorded mew');
  assert.equal(energy(cat, 0, span(catCues)[0]), 0, 'silent until the first paw tap');
  for (const mew of mews) assert.ok(energy(cat, mew.at, mew.at + mew.duration) > 1e-4, `the mew at ${mew.at} s is clearly heard`);
  const pounce = catCues.filter(cue => cue.at > mews[0].at + mews[0].duration).sort((a, b) => a.at - b.at)[0];
  assert.ok(pounce.at - (mews[0].at + mews[0].duration) >= .5, 'a real pause for the tilt and wiggle');
  assert.equal(energy(cat, mews[0].at + mews[0].duration + .002, pounce.at - .002), 0, 'the tilt and wiggle stay quiet');

  // Moon: countdown ticks, an engine roar at liftoff, stage pops and a sparkle, quiet space, then the landing accents.
  const moon = readWave('moon').samples;
  const moonCues = builtCues('moon');
  const [roarFrom, roarTo] = span(moonCues.filter(cue => cue.sourceId === 'rocket'));
  assert.ok(energy(moon, roarFrom, roarTo) > 1e-3, 'liftoff roars');
  // A mostly sub-bass clip passed the level checks but disappeared on small
  // speakers. Require enough rumble texture above their weakest bass range.
  const decay = Math.exp(-2 * Math.PI * 200 / rate);
  let previous = 0; let filtered = 0; let midPower = 0; let count = 0;
  for (let i = Math.round(roarFrom * rate); i < Math.round(roarTo * rate); i++) {
    filtered = decay * (filtered + moon[i] - previous);
    previous = moon[i]; midPower += filtered * filtered; count++;
  }
  assert.ok(Math.sqrt(midPower / count) > .03, 'liftoff has usable rumble texture above 200 Hz');
  const ticks = moonCues.filter(cue => cue.at < roarFrom + .1 && cue.sourceId === 'foley');
  assert.equal(ticks.length, 3, '3, 2, 1');
  for (const tick of ticks) assert.ok(energy(moon, tick.at, tick.at + tick.duration) > 1e-5, `countdown tick at ${tick.at} s`);
  // Quiet space: nothing between the sparkle cut to the Moon and the touchdown.
  const sparkle = moonCues.find(cue => cue.sourceId === 'magic');
  assert.ok(sparkle);
  const touchdown = moonCues.filter(cue => cue.at > sparkle.at + sparkle.duration).sort((a, b) => a.at - b.at)[0];
  const spaceFrom = Math.max(...moonCues.filter(cue => cue.at < touchdown.at).map(cue => cue.at + cue.duration));
  assert.ok(touchdown.at - spaceFrom >= 1.5, 'a long hush in space');
  assert.equal(energy(moon, spaceFrom + .002, touchdown.at - .002), 0);
  for (const cue of moonCues.filter(cue => cue.at >= touchdown.at)) assert.ok(energy(moon, cue.at, cue.at + cue.duration) > 1e-6, `landing accent at ${cue.at} s`);
});
