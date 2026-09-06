import assert from 'node:assert/strict';
import { test as nodeTest } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { playTransitionMelody } from '../src/transitionAudio';

function test(name: string, body: () => void | Promise<void>) { void nodeTest(name, body); }

test('transition audio cancels pending starts, replaces old playback, and releases sound on close and completion', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const sources: Array<{ stopped: boolean; disconnected: boolean; onended: (() => void) | null; stop: () => void }> = [];
  let resume = () => Promise.resolve();
  class FakeAudioContext {
    state = 'running'; currentTime = 0; destination = {};
    resume() { return resume(); }
    createBuffer(_channels: number, length: number) { return { copyToChannel: (data: Float32Array) => assert.equal(data.length, length) }; }
    createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} }; }
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
