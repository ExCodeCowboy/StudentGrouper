import assert from 'node:assert/strict';
import { test as nodeTest } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { playTransitionMelody } from '../src/transitionAudio';

function test(name: string, body: () => void | Promise<void>) { void nodeTest(name, body); }

test('transition audio cancels pending starts, replaces old playback, and releases sound on close and completion', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const sources: Array<{ stopped: boolean; disconnected: boolean; onended: (() => void) | null; stop: () => void }> = [];
  const contexts: FakeAudioContext[] = [];
  let resume = () => Promise.resolve();
  class FakeAudioContext {
    state = 'running'; currentTime = 0; destination = {};
    constructor() { contexts.push(this); }
    resume() { return resume(); }
    createBuffer(_channels: number, length: number, rate: number) { return { duration: length / rate, copyToChannel: (data: Float32Array) => assert.equal(data.length, length) }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    createBufferSource() {
      const source = { buffer: null, stopped: false, disconnected: false, onended: null as (() => void) | null, connect() {}, start() {}, stop() { source.stopped = true; }, disconnect() { source.disconnected = true; } };
      sources.push(source);
      return source;
    }
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { AudioContext: FakeAudioContext, setTimeout, clearTimeout } });
  try {
    let ended = 0;
    const first = new AbortController();
    await playTransitionMelody('sunny', 30, first.signal, () => ended++);
    const second = new AbortController();
    await playTransitionMelody('tiptoe', 30, second.signal, () => ended++);
    assert.equal(sources[0].stopped, true, 'only one tune can play at a time');
    first.abort();
    assert.equal(sources[1].stopped, false, 'closing an older preview cannot stop newer playback');
    second.abort();
    assert.equal(sources[1].disconnected, true);
    assert.equal(ended, 0, 'canceling music never advances the round');
    const third = new AbortController();
    await playTransitionMelody('meadow', 30, third.signal, () => ended++);
    sources[2].onended!();
    assert.equal(ended, 1);
    assert.equal(sources[2].disconnected, true);
    let allow!: () => void;
    resume = () => new Promise<void>((resolve) => { allow = resolve; });
    const pending = new AbortController();
    const attempt = playTransitionMelody('starlight', 30, pending.signal, () => ended++);
    pending.abort();
    await assert.rejects(attempt, { name: 'AbortError' });
    allow();
    await Promise.resolve();
    assert.equal(sources.length, 3, 'a late audio permission response cannot restart closed music');
  } finally {
    for (const context of contexts) context.state = 'closed';
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('recorded songs fade when shortened, cap playback at two minutes, and cancel stale downloads or decodes', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousFetch = globalThis.fetch;
  const durations = [119.736, 118.416, 118.656, 129.696, 129];
  const filenames = ['bells.mp3', 'oboe.mp3', 'strings.mp3', 'guitar.mp3', 'koto.mp3'];
  const sources: Array<{ buffer: { duration: number } | null; duration: number; stopped: boolean; onended: (() => void) | null }> = [];
  const envelopes: Array<Array<[string, number, number]>> = [];
  let now = 0; let closed = false; let delay = false; let fail = false;
  let decodeStarted!: () => void;
  let finishDecode!: () => void;
  class FakeAudioContext {
    get state() { return closed ? 'closed' : 'running'; }
    get currentTime() { return now; }
    destination = {};
    resume() { return Promise.resolve(); }
    decodeAudioData(bytes: ArrayBuffer) {
      const buffer = { duration: durations[new Uint8Array(bytes)[0]] };
      if (!delay) return Promise.resolve(buffer);
      return new Promise<typeof buffer>((resolve) => { finishDecode = () => resolve(buffer); decodeStarted(); });
    }
    createGain() {
      const envelope: Array<[string, number, number]> = [];
      envelopes.push(envelope);
      return { gain: { setValueAtTime(value: number, at: number) { envelope.push(['set', value, at]); }, linearRampToValueAtTime(value: number, at: number) { envelope.push(['ramp', value, at]); } }, connect() {}, disconnect() {} };
    }
    createBufferSource() {
      const source = { buffer: null, duration: 0, stopped: false, onended: null as (() => void) | null, connect() {}, disconnect() {}, start(_at: number, _offset: number, duration: number) { source.duration = duration; }, stop() { source.stopped = true; } };
      sources.push(source); return source;
    }
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { AudioContext: FakeAudioContext, setTimeout, clearTimeout } });
  globalThis.fetch = (async (url: string, options: RequestInit) => {
    assert.ok(url.startsWith('/music/transitions/'), 'recordings come from the local app');
    assert.ok(options.signal, 'downloads are cancellable');
    const index = filenames.indexOf(url.split('/').at(-1)!);
    assert.ok(index >= 0);
    return { ok: !fail, arrayBuffer: async () => new Uint8Array([index]).buffer } as Response;
  }) as typeof fetch;
  try {
    let ended = 0;
    const bell = await playTransitionMelody('rich-bells', 30, new AbortController().signal, () => ended++);
    assert.equal(sources[0].duration, 30);
    assert.deepEqual(envelopes[0].slice(-2), [['set', .65, 27], ['ramp', 0, 30]], 'three-second fade reaches silence exactly at the cutoff');
    now = 12;
    assert.equal(bell!.remaining(), 18);
    sources[0].onended!();
    assert.equal(ended, 1);
    const guitar = await playTransitionMelody('rich-guitar', 120, new AbortController().signal, () => ended++);
    assert.equal(sources[1].duration, 120, 'a longer recording is capped');
    assert.deepEqual(envelopes[1].slice(-2), [['set', .65, 129], ['ramp', 0, 132]]);
    guitar!.stop();
    assert.equal(ended, 1, 'manual stop does not signal normal completion');
    const oboe = await playTransitionMelody('rich-oboe', 120, new AbortController().signal, () => ended++);
    assert.equal(sources[2].duration, durations[1], 'shorter recordings end naturally without a loop');
    assert.equal(oboe!.remaining(), durations[1], 'countdown uses decoded duration');
    assert.equal(envelopes[2].some(([kind, value]) => kind === 'ramp' && value === 0), false, 'natural endings are retained');
    oboe!.stop();

    delay = true;
    const entered = new Promise<void>((resolve) => { decodeStarted = resolve; });
    const old = playTransitionMelody('rich-strings', 45, new AbortController().signal, () => ended++);
    await entered;
    delay = false;
    const latest = await playTransitionMelody('rich-koto', 60, new AbortController().signal, () => ended++);
    finishDecode();
    assert.equal(await old, null);
    assert.equal(sources.length, 4, 'a superseded decode cannot start old music');
    latest!.stop();

    delay = true;
    const enteredAgain = new Promise<void>((resolve) => { decodeStarted = resolve; });
    const controller = new AbortController();
    const canceled = playTransitionMelody('rich-guitar', 90, controller.signal, () => ended++);
    await enteredAgain;
    controller.abort();
    await assert.rejects(canceled, { name: 'AbortError' });
    finishDecode();
    await Promise.resolve();
    assert.equal(sources.length, 4);
    fail = true; delay = false;
    await assert.rejects(playTransitionMelody('rich-bells', 45, new AbortController().signal, () => ended++), /recording could not load/);
    assert.equal(ended, 1);
  } finally {
    closed = true;
    globalThis.fetch = previousFetch;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('YouTube bridge validates its channel and sender, forwards playback failures, and pauses hidden video', () => {
  const replies: Array<{ status: string }> = [];
  const parent = { postMessage: (value: { status: string }) => replies.push(value) };
  const handlers: Record<string, (event?: unknown) => void> = {};
  const documentHandlers: Record<string, () => void> = {};
  let events!: { onReady: () => void; onAutoplayBlocked: () => void; onStateChange: (event: { data: number }) => void; onError: (event: { data: number }) => void };
  let plays = 0;
  let pauses = 0;
  const window = { parent, addEventListener: (name: string, handler: (event?: unknown) => void) => { handlers[name] = handler; }, onYouTubeIframeAPIReady: () => {} };
  const document = { visibilityState: 'visible', addEventListener: (name: string, handler: () => void) => { documentHandlers[name] = handler; }, createElement: () => ({}), head: { append() {} } };
  const context = vm.createContext({
    window, document, URLSearchParams,
    location: { hash: '#video=M7lc1UVf-VE&start=30&channel=unique-test-channel', origin: 'https://example.org' },
    YT: { Player: class {
      constructor(_id: string, options: { host: string; playerVars: { autoplay: number; start: number }; events: typeof events }) {
        assert.equal(options.host, 'https://www.youtube-nocookie.com');
        assert.equal(options.playerVars.autoplay, 0, 'wait for parent visibility before playing');
        assert.equal(options.playerVars.start, 30);
        events = options.events;
      }
      playVideo() { plays++; }
      pauseVideo() { pauses++; }
      seekTo() {}
    } },
  });
  vm.runInContext(readFileSync('public/transition-player.js', 'utf8'), context);
  window.onYouTubeIframeAPIReady();
  events.onReady();
  assert.equal(replies.at(-1)?.status, 'ready');
  const command = { type: 'student-grouper-youtube-command', channel: 'unique-test-channel', command: 'play' };
  handlers.message({ source: {}, origin: 'https://example.org', data: command });
  handlers.message({ source: parent, origin: 'https://example.org', data: { ...command, channel: 'stale-channel' } });
  assert.equal(plays, 0);
  handlers.message({ source: parent, origin: 'tauri://localhost', data: command });
  assert.equal(plays, 1);
  events.onAutoplayBlocked();
  assert.equal(replies.at(-1)?.status, 'blocked');
  events.onError({ data: 153 });
  assert.equal(replies.at(-1)?.status, 'error');
  events.onStateChange({ data: 1 });
  assert.equal(replies.at(-1)?.status, 'playing');
  document.visibilityState = 'hidden';
  documentHandlers.visibilitychange();
  assert.equal(pauses, 1);
  handlers.message({ source: parent, origin: 'tauri://localhost', data: command });
  assert.equal(plays, 1, 'a hidden player does not autoplay');
  document.visibilityState = 'visible';
  documentHandlers.visibilitychange();
  assert.equal(plays, 2);
});
