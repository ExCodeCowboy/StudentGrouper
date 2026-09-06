import assert from 'node:assert/strict';
import { test as nodeTest } from 'node:test';
import { createRotationClock, formatRotationTime, normalizePresentationSettings, parseYouTubeVideo, reduceRotationClock, remainingRotationMs } from '../src/rotationTimer';
import { readPlayerMessage, transitionPlayerUrl, HOSTED_PLAYER_URL } from '../src/youtubePlayer';
import { renderTransitionMelody, melodyScore, transitionMelodies } from '../src/transitionMelodies';
import { createSampleData } from '../src/sample';
import { createBackupFile, readBackup } from '../src/storage';

function test(name: string, body: () => void | Promise<void>) { void nodeTest(name, body); }

test('rotation countdown uses a deadline and catches up once after a delayed callback or sleep', () => {
  const initial = createRotationClock('round-1', 60);
  const running = reduceRotationClock(initial, { type: 'start', now: 1000 });
  assert.equal(remainingRotationMs(running, 41350), 19650);
  const ended = reduceRotationClock(running, { type: 'tick', now: 95000 });
  assert.equal(ended.status, 'finished');
  assert.equal(ended.remainingMs, 0);
  assert.equal(ended.runId, 1);
  assert.equal(reduceRotationClock(ended, { type: 'tick', now: 100000 }), ended);
  assert.equal(initial.status, 'idle');
});

test('pausing preserves partial seconds, resuming ignores paused time, and reset cancels a deadline', () => {
  let clock = reduceRotationClock(createRotationClock('one', 30), { type: 'start', now: 100 });
  clock = reduceRotationClock(clock, { type: 'pause', now: 3600 });
  assert.equal(clock.remainingMs, 26500);
  assert.equal(remainingRotationMs(clock, 90000), 26500);
  clock = reduceRotationClock(clock, { type: 'start', now: 90000 });
  assert.equal(clock.endsAt, 116500);
  assert.equal(clock.runId, 1);
  clock = reduceRotationClock(clock, { type: 'reset', durationSeconds: 45 });
  assert.equal(clock.endsAt, null);
  assert.equal(clock.remainingMs, 45000);
  assert.equal(reduceRotationClock(clock, { type: 'tick', now: 500000 }), clock);
});

test('extra time and next round have explicit behavior without changing a schedule or completion marks', () => {
  let clock = reduceRotationClock(createRotationClock('one', 30), { type: 'start', now: 0 });
  clock = reduceRotationClock(clock, { type: 'add-minute', now: 12000 });
  assert.equal(clock.endsAt, 90000);
  clock = reduceRotationClock(clock, { type: 'tick', now: 91000 });
  clock = reduceRotationClock(clock, { type: 'add-minute', now: 92000 });
  assert.equal(clock.status, 'paused');
  assert.equal(clock.remainingMs, 60000);
  clock = reduceRotationClock(clock, { type: 'round', roundId: 'two', durationSeconds: 45, start: true, now: 100000 });
  assert.equal(clock.roundId, 'two');
  assert.equal(clock.endsAt, 145000);
  assert.equal(clock.runId, 2);
  assert.equal(formatRotationTime(1), '00:01');
  assert.equal(formatRotationTime(60001), '01:01');
  assert.equal(formatRotationTime(-100), '00:00');
});

test('YouTube link parsing allows video links and timestamps, rejects other hosts and unsafe input', () => {
  for (const url of ['https://youtu.be/M7lc1UVf-VE?t=1m30s', 'https://www.youtube.com/watch?v=M7lc1UVf-VE&t=90', 'https://www.youtube.com/embed/M7lc1UVf-VE?start=90', 'https://youtube.com/shorts/M7lc1UVf-VE#t=90s', 'https://m.youtube.com/live/M7lc1UVf-VE?t=90']) {
    assert.deepEqual(parseYouTubeVideo(url), { videoId: 'M7lc1UVf-VE', startSeconds: 90 });
  }
  for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.example/watch?v=M7lc1UVf-VE', 'https://evil.example/youtu.be/M7lc1UVf-VE', 'https://user@youtube.com/watch?v=M7lc1UVf-VE', 'https://youtube.com:8080/watch?v=M7lc1UVf-VE', 'https://youtube.com/playlist?list=123', '<iframe src="https://youtube.com/embed/M7lc1UVf-VE"></iframe>', 'https://youtube.com/watch?v=bad']) assert.equal(parseYouTubeVideo(url), null);
});

test('old and malformed timer preferences have silent, offline defaults; new preferences round-trip', async () => {
  const defaults = normalizePresentationSettings();
  assert.equal(defaults.autoplay, false);
  assert.equal(defaults.durationSeconds, 900);
  assert.equal(defaults.transitionSeconds, 45);
  assert.equal(defaults.transitionSource, 'melody');
  const malformed = normalizePresentationSettings({ durationSeconds: NaN, youtubeUrl: 'https://evil.example/', autoplay: true, transitionSource: 'youtube', transitionSeconds: 9, melodyId: 'missing' } as never);
  assert.equal(malformed.transitionSource, 'melody');
  assert.equal(malformed.youtubeUrl, '');
  assert.equal(malformed.durationSeconds, 900);
  assert.equal(malformed.melodyId, 'sunny');
  const data = createSampleData();
  data.classrooms[0].rotationPresentation = { ...defaults, durationSeconds: 1200, transitionSeconds: 60, autoplay: true, melodyId: 'meadow', transitionSource: 'youtube', youtubeUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE&t=30s' };
  const result = await readBackup({ text: async () => createBackupFile(data).contents });
  assert.deepEqual(result.classrooms[0].rotationPresentation, data.classrooms[0].rotationPresentation);
  assert.equal(JSON.stringify(result.classrooms[0].sessions), JSON.stringify(data.classrooms[0].sessions));
});

test('Mac embeds use the HTTPS player bridge and transmit only video parameters, never classroom data', () => {
  const video = 'https://youtu.be/M7lc1UVf-VE?t=12';
  const mac = new URL(transitionPlayerUrl(video, 'unique-player-channel', 'tauri://localhost/index.html', '/')!);
  assert.equal(mac.href.split('#')[0], HOSTED_PLAYER_URL);
  assert.deepEqual([...new URLSearchParams(mac.hash.slice(1)).keys()].sort(), ['channel', 'start', 'video']);
  const web = new URL(transitionPlayerUrl(video, 'unique-player-channel', 'https://example.org/StudentGrouper/app/', '/StudentGrouper/app/')!);
  assert.equal(web.pathname, '/StudentGrouper/app/transition-player.html');
  assert.equal(web.origin, 'https://example.org');
  assert.equal(transitionPlayerUrl('https://evil.example/', 'channel', 'tauri://localhost/', '/'), null);
  assert.equal(readPlayerMessage({ type: 'student-grouper-youtube', channel: 'other', status: 'playing' }, 'ours'), null);
  assert.equal(readPlayerMessage({ type: 'student-grouper-youtube', channel: 'ours', status: 'run-script' }, 'ours'), null);
  assert.deepEqual(readPlayerMessage({ type: 'student-grouper-youtube', channel: 'ours', status: 'blocked' }, 'ours'), { status: 'blocked', code: undefined });
});

test('all four public-domain tunes render for 30, 45 and 60 seconds with bounded sound and a soft ending', () => {
  const fingerprints = new Set<number>();
  for (const melody of transitionMelodies) for (const seconds of [30, 45, 60]) {
    const samples = renderTransitionMelody(melody.id, seconds, 8000);
    assert.equal(samples.length, seconds * 8000);
    assert.equal(samples[0], 0);
    assert.equal(samples.at(-1), 0);
    let peak = 0;
    let energy = 0;
    for (const sample of samples) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
    assert.ok(peak > .1 && peak < .8, `${melody.id}: peak ${peak}`);
    assert.ok(Math.sqrt(energy / samples.length) > .02, 'audible throughout the cue');
    assert.ok(melodyScore(melody.id, seconds).every((note) => note.at >= 0 && note.at + note.duration <= seconds));
    if (seconds === 30) fingerprints.add(energy);
  }
  assert.equal(fingerprints.size, 4);
});

test('transition arrangements avoid clashing simultaneous notes and finish their melody on the tonic', () => {
  const consonant = new Set([0, 3, 4, 5, 7, 8, 9]);
  for (const tune of transitionMelodies) for (const seconds of [30, 45, 60]) {
    const score = melodyScore(tune.id, seconds);
    const lead = score.filter((note) => note.part === 'melody');
    assert.equal(lead.at(-1)!.midi, tune.root, `${tune.name} has a resolved ending`);
    assert.ok(lead.at(-1)!.at + lead.at(-1)!.duration > seconds - .3, 'the melody fills the selected window');
    for (let i = 0; i < score.length; i++) for (let j = i + 1; j < score.length; j++) {
      const a = score[i]; const b = score[j];
      if (Math.min(a.at + a.duration, b.at + b.duration) - Math.max(a.at, b.at) > .001) {
        assert.ok(consonant.has(Math.abs(a.midi - b.midi) % 12), `${tune.name}: ${a.midi} clashes with ${b.midi}`);
      }
    }
    for (let i = 1; i < lead.length; i++) assert.ok(lead[i - 1].at + lead[i - 1].duration <= lead[i].at + .0001, 'previous notes release before the melody moves on');
  }
});

test('music-box synthesis keeps the intended pitch without the old metallic off-key partial', () => {
  const rate = 22050;
  const samples = renderTransitionMelody('starlight', 30, rate);
  const fundamental = 440 * 2 ** ((72 - 69) / 12);
  const amplitude = (frequency: number) => {
    let real = 0; let imaginary = 0;
    const start = Math.floor(.12 * rate); const length = Math.floor(.3 * rate);
    for (let i = 0; i < length; i++) {
      const sample = samples[start + i] * (.5 - .5 * Math.cos(2 * Math.PI * i / (length - 1)));
      const phase = 2 * Math.PI * frequency * i / rate;
      real += sample * Math.cos(phase); imaginary += sample * Math.sin(phase);
    }
    return Math.hypot(real, imaginary);
  };
  assert.ok(amplitude(fundamental) > 1);
  assert.ok(amplitude(fundamental * 2.76) / amplitude(fundamental) < .01, 'no audible inharmonic bell partial');
});
