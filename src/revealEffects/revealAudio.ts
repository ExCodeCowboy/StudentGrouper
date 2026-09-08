import { REVEAL_SOUND_LIBRARY, type RevealSoundId } from './revealSounds';

const MASTER_GAIN = 0.55;
const ATTACK_SECONDS = 0.008;
const ABORT_FADE_SECONDS = 0.03;
const MAX_DELAY_MS = 250;
const CACHE_LIMIT = 3;

type PlayerDependencies = {
  createContext?: () => AudioContext | undefined;
  now?: () => number;
  load?: (id: RevealSoundId) => Promise<ArrayBuffer>;
  schedule?: (callback: () => void, milliseconds: number) => () => void;
};

function createBrowserContext(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const Constructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  return Constructor ? new Constructor() : undefined;
}

async function loadRecording(id: RevealSoundId): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(REVEAL_SOUND_LIBRARY[id].asset, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('The reveal recording could not load.');
    return await response.arrayBuffer();
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/** Isolated factory so cancellation and delayed browser permission can be tested. */
export function createRevealSoundPlayer(dependencies: PlayerDependencies = {}) {
  const createContext = dependencies.createContext ?? createBrowserContext;
  const now = dependencies.now ?? (() => performance.now());
  const load = dependencies.load ?? loadRecording;
  const schedule =
    dependencies.schedule ??
    ((callback, milliseconds) => {
      const timer = globalThis.setTimeout(callback, milliseconds);
      return () => globalThis.clearTimeout(timer);
    });
  let context: AudioContext | undefined;
  let active: { cancel: () => void } | undefined;
  const recordings = new Map<RevealSoundId, Promise<ArrayBuffer>>();
  const buffers = new Map<RevealSoundId, AudioBuffer>();
  const decoding = new Map<
    RevealSoundId,
    { audio: AudioContext; promise: Promise<AudioBuffer> }
  >();

  function recording(id: RevealSoundId): Promise<ArrayBuffer> {
    const cached = recordings.get(id);
    if (cached) return cached;
    // Keep downloaded bytes for all nine small clips; failed loads can retry.
    const request = Promise.resolve()
      .then(() => load(id))
      .catch((error: unknown) => {
        if (recordings.get(id) === request) recordings.delete(id);
        throw error;
      });
    recordings.set(id, request);
    return request;
  }

  function decoded(
    id: RevealSoundId,
    audio: AudioContext,
  ): Promise<AudioBuffer> {
    const cached = buffers.get(id);
    if (cached) return Promise.resolve(cached);
    const pending = decoding.get(id);
    if (pending?.audio === audio) return pending.promise;
    // decodeAudioData may detach its argument. A copy keeps the small original
    // recording available after a decoded buffer is evicted or a context closes.
    const promise = recording(id)
      .then((bytes) => audio.decodeAudioData(bytes.slice(0)))
      .finally(() => {
        if (decoding.get(id)?.promise === promise) decoding.delete(id);
      });
    decoding.set(id, { audio, promise });
    return promise;
  }

  async function preload(
    ids: readonly RevealSoundId[] = Object.keys(
      REVEAL_SOUND_LIBRARY,
    ) as RevealSoundId[],
  ): Promise<void> {
    await Promise.allSettled(ids.map(recording));
  }

  function play(id: RevealSoundId, signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return Promise.resolve(false);
    const requestedAt = now();
    active?.cancel();

    return new Promise<boolean>((resolve) => {
      let audio: AudioContext | undefined;
      let source: AudioBufferSourceNode | undefined;
      let gain: GainNode | undefined;
      let started = false;
      let startedAt = 0;
      let stopping = false;
      let released = false;
      let settled = false;
      let cancelDeadline = () => {};
      let cancelCleanup = () => {};

      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const release = () => {
        if (released) return;
        released = true;
        cancelDeadline();
        cancelCleanup();
        signal.removeEventListener('abort', cancel);
        if (source) source.onended = null;
        try {
          source?.disconnect();
        } catch {
          /* A closed context may already release nodes. */
        }
        try {
          gain?.disconnect();
        } catch {
          /* Cleanup must never interrupt the visual. */
        }
        if (active === playback) active = undefined;
        settle(false);
      };
      const cancel = () => {
        if (released || stopping) return;
        stopping = true;
        cancelDeadline();
        signal.removeEventListener('abort', cancel);
        if (active === playback) active = undefined;
        settle(false);
        if (!started || !audio || !source || !gain) {
          release();
          return;
        }
        try {
          const at = audio.currentTime;
          const level =
            MASTER_GAIN *
            Math.max(0, Math.min(1, (at - startedAt) / ATTACK_SECONDS));
          gain.gain.cancelScheduledValues(at);
          gain.gain.setValueAtTime(level, at);
          gain.gain.linearRampToValueAtTime(0, at + ABORT_FADE_SECONDS);
          source.stop(at + ABORT_FADE_SECONDS);
          // onended normally releases these. Also clean up if a suspended
          // context stops advancing its audio clock after the view closes.
          cancelCleanup = schedule(release, ABORT_FADE_SECONDS * 1000 + 10);
        } catch {
          try {
            source.stop();
          } catch {
            /* The source may have ended already. */
          }
          release();
        }
      };
      const playback = { cancel };
      active = playback;
      signal.addEventListener('abort', cancel, { once: true });

      try {
        if (!context || context.state === 'closed') {
          context = createContext();
          buffers.clear();
          decoding.clear();
        }
        audio = context;
        if (!audio || signal.aborted) {
          release();
          return;
        }
        // Invoke resume in the original click stack, before loading or
        // awaiting anything, to retain browser user activation on the Mac.
        const resumed = audio.resume();
        cancelDeadline = schedule(cancel, MAX_DELAY_MS);
        void resumed.then(() => {
          if (released || stopping || signal.aborted || active !== playback) {
            cancel();
            return;
          }
          if (
            audio!.state !== 'running' ||
            now() - requestedAt > MAX_DELAY_MS
          ) {
            release();
            return;
          }
          void decoded(id, audio!).then((buffer) => {
            if (
              released ||
              stopping ||
              signal.aborted ||
              active !== playback ||
              audio!.state !== 'running'
            ) {
              cancel();
              return;
            }
            const offset = Math.max(0, (now() - requestedAt) / 1000);
            if (
              !Number.isFinite(offset) ||
              !Number.isFinite(buffer.duration) ||
              offset >= buffer.duration ||
              offset * 1000 > MAX_DELAY_MS
            ) {
              release();
              return;
            }
            buffers.delete(id);
            buffers.set(id, buffer);
            if (buffers.size > CACHE_LIMIT)
              buffers.delete(buffers.keys().next().value!);
            try {
              source = audio!.createBufferSource();
              gain = audio!.createGain();
              source.buffer = buffer;
              source.connect(gain);
              gain.connect(audio!.destination);
              startedAt = audio!.currentTime;
              gain.gain.setValueAtTime(0, startedAt);
              gain.gain.linearRampToValueAtTime(
                MASTER_GAIN,
                startedAt + ATTACK_SECONDS,
              );
              source.onended = release;
              if (signal.aborted || active !== playback) {
                cancel();
                return;
              }
              source.start(0, offset);
              started = true;
              cancelDeadline();
              settle(true);
            } catch {
              release();
            }
          }, release);
        }, release);
      } catch {
        release();
      }
    });
  }
  return Object.assign(play, { preload });
}

const player = createRevealSoundPlayer();

/** Warm the bundled recordings without creating or resuming an audio context. */
export function preloadRevealSounds(): Promise<void> {
  return player.preload();
}

/** Start from the Reveal click; sound failure never delays or rejects the visual. */
export function playRevealSound(
  id: RevealSoundId,
  signal: AbortSignal,
): Promise<boolean> {
  return player(id, signal);
}
