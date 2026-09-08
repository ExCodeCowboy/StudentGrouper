import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRevealSoundPlayer } from '../src/revealEffects/revealAudio';
import {
  REVEAL_SOUND_LIBRARY,
  type RevealSoundId,
} from '../src/revealEffects/revealSounds';

const soundIds = Object.keys(REVEAL_SOUND_LIBRARY) as RevealSoundId[];
type FakeBuffer = { duration: number; samples: Float32Array };
type FakeSource = {
  buffer: FakeBuffer | null;
  connected: boolean;
  disconnects: number;
  starts: Array<[number, number]>;
  stops: number[];
  onended: (() => void) | null;
  connect: () => void;
  disconnect: () => void;
  start: (at: number, offset: number) => void;
  stop: (at?: number) => void;
};
type FakeGain = {
  connected: boolean;
  disconnects: number;
  events: Array<[string, number, number]>;
  gain: {
    setValueAtTime: (value: number, at: number) => void;
    linearRampToValueAtTime: (value: number, at: number) => void;
    cancelScheduledValues: (at: number) => void;
  };
  connect: () => void;
  disconnect: () => void;
};

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  for (let index = 0; index < 12; index++) await Promise.resolve();
}

function fixture() {
  let milliseconds = 0;
  let nextTimer = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const loads: RevealSoundId[] = [];
  const decodes: RevealSoundId[] = [];
  const bytes = new Map<RevealSoundId, ArrayBuffer>();
  const contexts: FakeContext[] = [];
  let resume = () => Promise.resolve();
  let load = () => Promise.resolve();
  let decode = () => Promise.resolve();
  let failStart = false;
  let decodeDelay = 0;
  let sampleCount = 22050;
  class FakeContext {
    state: AudioContextState = 'running';
    destination = {};
    resumeCalls = 0;
    sources: FakeSource[] = [];
    gains: FakeGain[] = [];
    buffers: FakeBuffer[] = [];
    get currentTime() {
      return 10 + milliseconds / 1000;
    }
    resume() {
      this.resumeCalls++;
      return resume();
    }
    decodeAudioData(data: ArrayBuffer): Promise<FakeBuffer> {
      const id = soundIds[new Uint8Array(data)[0]];
      assert.ok(id, 'the player passes complete encoded recording bytes');
      decodes.push(id);
      structuredClone(data, { transfer: [data] });
      return decode().then(() => {
        milliseconds += decodeDelay;
        const buffer = {
          duration: sampleCount / 22050,
          samples: new Float32Array(sampleCount).fill(0.35),
        };
        this.buffers.push(buffer);
        return buffer;
      });
    }
    createBufferSource(): FakeSource {
      const source = {
        buffer: null as FakeBuffer | null,
        connected: false,
        disconnects: 0,
        starts: [] as Array<[number, number]>,
        stops: [] as number[],
        onended: null as (() => void) | null,
        connect() {
          this.connected = true;
        },
        disconnect() {
          this.connected = false;
          this.disconnects++;
        },
        start(at: number, offset: number) {
          if (failStart) throw new Error('Blocked start');
          this.starts.push([at, offset]);
        },
        stop(at = 0) {
          this.stops.push(at);
        },
      };
      this.sources.push(source);
      return source;
    }
    createGain(): FakeGain {
      const events: Array<[string, number, number]> = [];
      const gain = {
        connected: false,
        disconnects: 0,
        events,
        gain: {
          setValueAtTime(value: number, at: number) {
            events.push(['set', value, at]);
          },
          linearRampToValueAtTime(value: number, at: number) {
            events.push(['ramp', value, at]);
          },
          cancelScheduledValues(at: number) {
            events.push(['cancel', 0, at]);
          },
        },
        connect() {
          this.connected = true;
        },
        disconnect() {
          this.connected = false;
          this.disconnects++;
        },
      };
      this.gains.push(gain);
      return gain;
    }
  }
  const player = createRevealSoundPlayer({
    now: () => milliseconds,
    createContext: () => {
      const context = new FakeContext();
      contexts.push(context);
      return context as unknown as AudioContext;
    },
    load: (id) => {
      loads.push(id);
      return load().then(() => {
        const recording = new Uint8Array([soundIds.indexOf(id)]).buffer;
        bytes.set(id, recording);
        return recording;
      });
    },
    schedule: (callback, delay) => {
      const id = ++nextTimer;
      timers.set(id, { at: milliseconds + delay, callback });
      return () => {
        timers.delete(id);
      };
    },
  });
  return {
    player,
    contexts,
    timers,
    loads,
    decodes,
    bytes,
    setResume: (operation: () => Promise<void>) => {
      resume = operation;
    },
    setLoad: (operation: () => Promise<void>) => {
      load = operation;
    },
    setDecode: (operation: () => Promise<void>) => {
      decode = operation;
    },
    setStartFailure: () => {
      failStart = true;
    },
    setDecodeDelay: (value: number) => {
      decodeDelay = value;
    },
    setSampleCount: (value: number) => {
      sampleCount = value;
    },
    elapse: (value: number) => {
      milliseconds += value;
    },
    advance: (value: number) => {
      milliseconds += value;
      for (const [id, timer] of timers)
        if (timer.at <= milliseconds) {
          timers.delete(id);
          timer.callback();
        }
    },
  };
}

void test('reveal audio resumes in the click stack, offsets a short delay, and uses a gentle volume ceiling', async () => {
  const f = fixture();
  const ready = deferred();
  f.setResume(() => ready.promise);
  const result = f.player('confetti', new AbortController().signal);
  assert.equal(
    f.contexts[0].resumeCalls,
    1,
    'resume happens synchronously before the play call returns',
  );
  assert.deepEqual(
    f.loads,
    [],
    'loading does not consume click activation before resume',
  );
  f.elapse(80);
  ready.resolve();
  assert.equal(await result, true);
  const context = f.contexts[0];
  assert.deepEqual(context.sources[0].starts, [[0, 0.08]]);
  assert.deepEqual(context.gains[0].events, [
    ['set', 0, 10.08],
    ['ramp', 0.55, 10.088],
  ]);
  assert.ok(context.gains[0].events.every(([, value]) => value <= 0.55));
  assert.ok(
    Math.max(...context.buffers[0].samples) * 0.55 < 0.193,
    'master gain keeps a peak-.35 recording below .193',
  );
  assert.equal(
    f.timers.size,
    0,
    'successful start releases the permission deadline',
  );
  context.sources[0].onended!();
});

void test('preloading warms all bundled WAVs once without creating a context or requesting playback', async () => {
  const f = fixture();
  await Promise.all([f.player.preload(), f.player.preload()]);
  assert.deepEqual(f.loads, soundIds);
  assert.equal(
    f.contexts.length,
    0,
    'opening the student view does not request audio activation',
  );
  assert.deepEqual(
    f.decodes,
    [],
    'decoding waits for the clicked audio context',
  );
  f.setLoad(() => Promise.reject(new Error('A second download would fail')));
  assert.equal(await f.player('cat', new AbortController().signal), true);
  assert.equal(f.loads.length, soundIds.length);
  assert.deepEqual(f.decodes, ['cat']);
  f.contexts[0].sources[0].onended!();
});

void test('a first click shares its in-flight preload and offsets the remaining download delay', async () => {
  const f = fixture();
  const ready = deferred();
  f.setLoad(() => ready.promise);
  const warming = f.player.preload(['cat']);
  const playback = f.player('cat', new AbortController().signal);
  assert.equal(f.contexts[0].resumeCalls, 1);
  await flushMicrotasks();
  assert.deepEqual(f.loads, ['cat']);
  f.elapse(70);
  ready.resolve();
  await warming;
  assert.equal(await playback, true);
  assert.deepEqual(f.contexts[0].sources[0].starts, [[0, 0.07]]);
  f.contexts[0].sources[0].onended!();
});

void test('failed preloads and decodes fail quietly and can retry the next reveal', async () => {
  const f = fixture();
  f.setLoad(() => Promise.reject(new Error('Missing WAV')));
  await f.player.preload(['cat']);
  assert.equal(await f.player('cat', new AbortController().signal), false);
  assert.equal(f.contexts[0].sources.length, 0);
  f.setLoad(() => Promise.resolve());
  f.setDecode(() => Promise.reject(new Error('Invalid WAV')));
  assert.equal(await f.player('cat', new AbortController().signal), false);
  assert.equal(f.contexts[0].sources.length, 0);
  f.setDecode(() => Promise.resolve());
  assert.equal(await f.player('cat', new AbortController().signal), true);
  assert.equal(
    f.loads.length,
    3,
    'a rejected decode reuses the retained download on retry',
  );
  assert.equal(f.decodes.length, 2);
  assert.equal(f.timers.size, 0);
  f.contexts[0].sources[0].onended!();
});

void test('aborts and start deadlines settle while WAV loading or decoding is still pending', async () => {
  for (const stage of ['load', 'decode'] as const)
    for (const ending of ['abort', 'deadline'] as const) {
      const f = fixture();
      const ready = deferred();
      const entered = deferred();
      const operation = () => {
        entered.resolve();
        return ready.promise;
      };
      if (stage === 'load') f.setLoad(operation);
      else f.setDecode(operation);
      const controller = new AbortController();
      const playback = f.player('cat', controller.signal);
      await entered.promise;
      if (ending === 'abort') controller.abort();
      else f.advance(250);
      assert.equal(
        await playback,
        false,
        `${ending} does not wait for ${stage}`,
      );
      assert.equal(f.timers.size, 0);
      ready.resolve();
      await flushMicrotasks();
      assert.equal(
        f.contexts[0].sources.length,
        0,
        `a late ${stage} completion never creates a source`,
      );
    }
});

void test('an old decode cannot restart or replace a newer reveal', async () => {
  const f = fixture();
  const ready = deferred();
  const entered = deferred();
  f.setDecode(() => {
    entered.resolve();
    return ready.promise;
  });
  const old = f.player('cat', new AbortController().signal);
  await entered.promise;
  f.setDecode(() => Promise.resolve());
  const current = f.player('fairy', new AbortController().signal);
  assert.equal(await old, false);
  assert.equal(await current, true);
  ready.resolve();
  await flushMicrotasks();
  assert.equal(f.contexts[0].sources.length, 1);
  assert.deepEqual(
    f.contexts[0].sources[0].stops,
    [],
    'the new sound remains active',
  );
  f.contexts[0].sources[0].onended!();
});

void test('replaying while the same WAV is decoding shares the decode without reviving the old request', async () => {
  const f = fixture();
  const ready = deferred();
  const entered = deferred();
  f.setDecode(() => {
    entered.resolve();
    return ready.promise;
  });
  const oldController = new AbortController();
  const old = f.player('cat', oldController.signal);
  await entered.promise;
  const current = f.player('cat', new AbortController().signal);
  assert.equal(await old, false);
  await flushMicrotasks();
  assert.deepEqual(f.decodes, ['cat']);
  ready.resolve();
  assert.equal(await current, true);
  oldController.abort();
  assert.equal(f.contexts[0].sources.length, 1);
  assert.deepEqual(f.contexts[0].sources[0].stops, []);
  f.contexts[0].sources[0].onended!();
});

void test('default preloading fetches the registry asset and retries an HTTP failure', async () => {
  assert.match(REVEAL_SOUND_LIBRARY.cat.asset, /sounds\/reveals\/cat\.wav\?v=[a-f0-9]{12}$/);
  const previousFetch = globalThis.fetch;
  const urls: unknown[] = [];
  const signals: AbortSignal[] = [];
  globalThis.fetch = ((url, options) => {
    urls.push(url);
    signals.push(options!.signal as AbortSignal);
    return Promise.resolve(
      new Response(new Uint8Array([1]), {
        status: urls.length === 1 ? 404 : 200,
      }),
    );
  }) as typeof fetch;
  try {
    const player = createRevealSoundPlayer({ createContext: () => undefined });
    await player.preload(['cat']);
    await player.preload(['cat']);
    await player.preload(['cat']);
    assert.deepEqual(urls, [
      REVEAL_SOUND_LIBRARY.cat.asset,
      REVEAL_SOUND_LIBRARY.cat.asset,
    ]);
    assert.ok(signals.every((signal) => !signal.aborted));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

void test('aborting a reveal fades briefly then releases nodes even if the audio clock stops', async () => {
  const f = fixture();
  const controller = new AbortController();
  assert.equal(await f.player('fairy', controller.signal), true);
  f.elapse(50);
  controller.abort();
  const context = f.contexts[0];
  const source = context.sources[0];
  assert.deepEqual(context.gains[0].events.slice(-3), [
    ['cancel', 0, 10.05],
    ['set', 0.55, 10.05],
    ['ramp', 0, 10.08],
  ]);
  assert.deepEqual(source.stops, [10.08]);
  assert.equal(
    source.connected,
    true,
    'the graph remains connected for the 30ms fade',
  );
  context.state = 'suspended';
  f.advance(40);
  assert.equal(source.connected, false);
  assert.equal(context.gains[0].connected, false);
  assert.equal(source.onended, null);
  assert.equal(f.timers.size, 0);
  controller.abort();
  assert.equal(source.disconnects, 1, 'cleanup is idempotent');
});

void test('canceling during the attack fades from the current level rather than jumping to full volume', async () => {
  const f = fixture();
  const controller = new AbortController();
  await f.player('confetti', controller.signal);
  f.elapse(4);
  controller.abort();
  const level = f.contexts[0].gains[0].events.at(-2)![1];
  assert.ok(Math.abs(level - 0.275) < 1e-10);
  f.advance(40);
});

void test('rapid replacement and old aborts cannot stop the newest reveal', async () => {
  const f = fixture();
  const first = new AbortController();
  const second = new AbortController();
  await f.player('confetti', first.signal);
  await f.player('fairy', second.signal);
  const context = f.contexts[0];
  assert.equal(f.contexts.length, 1, 'reveals reuse one context');
  assert.equal(context.sources[0].stops.length, 1);
  first.abort();
  assert.equal(context.sources[1].stops.length, 0);
  context.sources[0].onended!();
  const third = new AbortController();
  await f.player('cat', third.signal);
  assert.equal(
    context.sources[1].stops.length,
    1,
    'ending old audio did not clear the new active request',
  );
  second.abort();
  assert.equal(context.sources[2].stops.length, 0);
  third.abort();
  f.advance(40);
  assert.ok(context.sources.every((source) => source.disconnects === 1));
  assert.ok(context.gains.every((gain) => gain.disconnects === 1));
});

void test('pending cancellation and supersession resolve promptly and ignore late resume completions', async () => {
  const f = fixture();
  const firstReady = deferred();
  f.setResume(() => firstReady.promise);
  const firstController = new AbortController();
  const first = f.player('confetti', firstController.signal);
  firstController.abort();
  assert.equal(
    await first,
    false,
    'abort does not wait for a browser permission response',
  );
  assert.equal(f.timers.size, 0);
  firstReady.resolve();
  await Promise.resolve();
  assert.equal(f.contexts[0].sources.length, 0);

  const secondReady = deferred();
  f.setResume(() => secondReady.promise);
  const second = f.player('fairy', new AbortController().signal);
  f.setResume(() => Promise.resolve());
  const thirdController = new AbortController();
  const third = f.player('cat', thirdController.signal);
  assert.equal(await second, false);
  assert.equal(await third, true);
  secondReady.resolve();
  await Promise.resolve();
  assert.equal(
    f.contexts[0].sources.length,
    1,
    'a stale request never allocates or starts its source',
  );
  thirdController.abort();
  f.advance(40);
});

void test('normal completion disconnects once and removes the abort callback', async () => {
  const f = fixture();
  const controller = new AbortController();
  let removed = 0;
  const removeListener = controller.signal.removeEventListener.bind(
    controller.signal,
  );
  Object.defineProperty(controller.signal, 'removeEventListener', {
    value: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: EventListenerOptions | boolean,
    ) => {
      if (type === 'abort') removed++;
      removeListener(type, listener, options);
    },
  });
  await f.player('moon', controller.signal);
  const context = f.contexts[0];
  const ended = context.sources[0].onended!;
  ended();
  controller.abort();
  ended();
  assert.equal(context.sources[0].disconnects, 1);
  assert.equal(context.gains[0].disconnects, 1);
  assert.equal(context.sources[0].stops.length, 0);
  assert.equal(context.sources[0].onended, null);
  assert.equal(removed, 1);
  assert.equal(f.timers.size, 0);
});

void test('blocked, rejected, unavailable, and already canceled playback fail quietly', async () => {
  const unavailable = createRevealSoundPlayer({
    createContext: () => undefined,
  });
  assert.equal(await unavailable('cat', new AbortController().signal), false);
  const broken = createRevealSoundPlayer({
    createContext: () => {
      throw new Error('No device');
    },
  });
  assert.equal(await broken('cat', new AbortController().signal), false);
  const aborted = new AbortController();
  aborted.abort();
  const f = fixture();
  assert.equal(await f.player('cat', aborted.signal), false);
  assert.equal(f.contexts.length, 0);

  f.setResume(() => Promise.reject(new Error('Not allowed')));
  assert.equal(await f.player('cat', new AbortController().signal), false);
  assert.equal(f.timers.size, 0);
  f.setResume(() => {
    throw new Error('Resume unavailable');
  });
  assert.equal(await f.player('cat', new AbortController().signal), false);
  f.setResume(() => Promise.resolve());
  f.contexts[0].state = 'suspended';
  assert.equal(await f.player('cat', new AbortController().signal), false);
  assert.equal(f.contexts[0].sources.length, 0);
  f.contexts[0].state = 'running';
  f.setStartFailure();
  assert.equal(await f.player('cat', new AbortController().signal), false);
  assert.equal(f.contexts[0].sources[0].disconnects, 1);
  assert.equal(f.contexts[0].gains[0].disconnects, 1);
  assert.equal(f.timers.size, 0);
});

void test('the browser context constructor supports the Mac webkit fallback', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const f = fixture();
  await f.player('cat', new AbortController().signal);
  const context = f.contexts[0];
  context.sources[0].onended!();
  let constructed = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      webkitAudioContext: class {
        constructor() {
          constructed++;
          return context;
        }
      },
    },
  });
  try {
    const play = createRevealSoundPlayer({
      now: () => 0,
      load: () =>
        Promise.resolve(new Uint8Array([soundIds.indexOf('confetti')]).buffer),
      schedule: () => () => {},
    });
    assert.equal(await play('confetti', new AbortController().signal), true);
    assert.equal(constructed, 1);
    assert.equal(context.sources.length, 2);
    context.sources[1].onended!();
  } finally {
    if (previousWindow)
      Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

void test('permission deadlines, elapsed sound durations, and slow decoding never start a late reveal', async () => {
  const f = fixture();
  const ready = deferred();
  f.setResume(() => ready.promise);
  const pending = f.player('cat', new AbortController().signal);
  f.advance(250);
  assert.equal(
    await pending,
    false,
    'a browser resume that never settles is bounded',
  );
  ready.resolve();
  await Promise.resolve();
  assert.equal(f.contexts[0].sources.length, 0);

  const late = deferred();
  f.setResume(() => late.promise);
  const delayed = f.player('cat', new AbortController().signal);
  f.elapse(251); // Simulate a delayed timer callback as well as delayed resume.
  late.resolve();
  assert.equal(await delayed, false);
  assert.equal(f.contexts[0].sources.length, 0);

  f.setResume(() => Promise.resolve());
  f.setDecodeDelay(251);
  assert.equal(await f.player('cat', new AbortController().signal), false);
  assert.equal(f.contexts[0].sources.length, 0);

  const short = fixture();
  short.setSampleCount(2205);
  const shortReady = deferred();
  short.setResume(() => shortReady.promise);
  const finished = short.player('confetti', new AbortController().signal);
  short.elapse(120);
  shortReady.resolve();
  assert.equal(
    await finished,
    false,
    'an already finished buffer is never started even within the latency budget',
  );
  assert.equal(short.contexts[0].sources.length, 0);
});

void test('the three-buffer LRU reuses recent sounds and resets when a closed context is replaced', async () => {
  const f = fixture();
  for (const id of [
    'confetti',
    'fairy',
    'cat',
    'confetti',
    'moon',
    'confetti',
    'fairy',
  ] as const) {
    await f.player(id, new AbortController().signal);
    f.contexts[0].sources.at(-1)!.onended!();
  }
  assert.deepEqual(
    f.decodes,
    ['confetti', 'fairy', 'cat', 'moon', 'fairy'],
    'fourth unique sound evicts the least recently used of three decoded entries',
  );
  assert.deepEqual(
    f.loads,
    ['confetti', 'fairy', 'cat', 'moon'],
    'eviction keeps the smaller downloaded recording',
  );
  assert.ok(
    [...f.bytes.values()].every((recording) => recording.byteLength === 1),
    'decoding never detaches the retained original bytes',
  );
  f.contexts[0].state = 'closed';
  await f.player('confetti', new AbortController().signal);
  assert.equal(f.contexts.length, 2);
  assert.equal(
    f.decodes.at(-1),
    'confetti',
    'audio buffers are decoded for the replacement context',
  );
  assert.equal(
    f.loads.length,
    4,
    'a replaced context still reuses the downloaded WAV',
  );
  f.contexts[1].sources[0].onended!();
});
