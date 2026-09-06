import { renderTransitionMelody } from './transitionMelodies';
import { getTransitionMusic, transitionRecordingUrl, type RichTransitionTrack, type TransitionLength, type TransitionMusicId } from './transitionMusic';

let context: AudioContext | undefined;
let active: { stop: () => void } | undefined;
let latestRequest = 0;
const buffers = new Map<string, AudioBuffer>();
// A decoded stereo recording is much larger than its MP3. Keep only the most
// recently used recording, rather than retaining the entire decoded library.
let cachedRecording: { id: string; buffer: AudioBuffer } | undefined;

function audioContext() {
  if (!context || context.state === 'closed') {
    const Constructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) throw new Error('Audio is unavailable on this device.');
    context = new Constructor();
  }
  return context;
}

// Call from the teacher's Start/Play click, before a timed transition is needed.
export function prepareTransitionAudio(): void {
  try { void audioContext().resume().catch(() => {}); } catch { /* The player provides a manual fallback. */ }
}

function cancellable<T>(work: Promise<T>, signal: AbortSignal, milliseconds: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown, value?: T) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value!);
    };
    const abort = () => finish(new DOMException('Canceled', 'AbortError'));
    const timeout = window.setTimeout(() => finish(new Error(message)), milliseconds);
    signal.addEventListener('abort', abort, { once: true });
    void work.then((value) => finish(undefined, value), (error: unknown) => finish(error));
    if (signal.aborted) abort();
  });
}

async function loadRecording(audio: AudioContext, track: RichTransitionTrack, signal: AbortSignal) {
  if (cachedRecording?.id === track.id) return cachedRecording.buffer;
  const loading = new AbortController();
  const abort = () => loading.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const message = 'This recording could not load. Try again or choose a minimal tune.';
  try {
    return await cancellable((async () => {
      const response = await fetch(transitionRecordingUrl(track), { signal: loading.signal });
      if (!response.ok) throw new Error(message);
      const bytes = await response.arrayBuffer();
      if (loading.signal.aborted) throw new DOMException('Canceled', 'AbortError');
      return audio.decodeAudioData(bytes);
    })(), signal, 15000, message);
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(message);
  } finally {
    loading.abort();
    signal.removeEventListener('abort', abort);
  }
}

export async function playTransitionMelody(id: TransitionMusicId, seconds: TransitionLength, signal: AbortSignal, onEnd: () => void) {
  if (signal.aborted) return null;
  const request = ++latestRequest;
  active?.stop();
  const audio = audioContext();
  const current = () => !signal.aborted && request === latestRequest;
  const unlockMessage = 'Press Play tune to allow sound on this device.';
  try {
    await cancellable(audio.resume(), signal, 2000, unlockMessage);
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(unlockMessage);
  }
  if (!current()) return null;
  if (audio.state !== 'running') throw new Error(unlockMessage);
  const track = getTransitionMusic(id);
  let buffer: AudioBuffer;
  if (track.kind === 'rich') {
    buffer = await loadRecording(audio, track, signal);
    // Decoding cannot be interrupted. A canceled/superseded decode must never
    // restart old music or evict a newer recording from the cache.
    if (!current()) return null;
    cachedRecording = { id, buffer };
  } else {
    const key = `${track.id}:${seconds}`;
    const cached = buffers.get(key);
    if (cached) buffer = cached;
    else {
      const samples = renderTransitionMelody(track.id, seconds);
      buffer = audio.createBuffer(1, samples.length, 22050);
      buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
      buffers.set(key, buffer);
    }
  }
  const duration = Math.min(seconds, 120, buffer.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('This tune could not play. Choose another tune.');
  const source = audio.createBufferSource();
  const gain = audio.createGain();
  const started = audio.currentTime;
  gain.gain.setValueAtTime(.65, started);
  if (track.kind === 'rich') {
    gain.gain.setValueAtTime(0, started);
    gain.gain.linearRampToValueAtTime(.65, started + .04);
    if (duration < buffer.duration - .02) {
      const fadeSeconds = Math.min(3, duration / 4);
      gain.gain.setValueAtTime(.65, started + duration - fadeSeconds);
      gain.gain.linearRampToValueAtTime(0, started + duration);
    }
  }
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(audio.destination);
  let stopped = false;
  const playback = {
    remaining: () => Math.max(0, duration - (audio.currentTime - started)),
    stop: () => {
      if (stopped) return;
      stopped = true;
      source.onended = null;
      source.stop();
      source.disconnect();
      gain.disconnect();
      signal.removeEventListener('abort', playback.stop);
      if (active === playback) active = undefined;
    },
  };
  source.onended = () => { playback.stop(); onEnd(); };
  signal.addEventListener('abort', playback.stop, { once: true });
  active = playback;
  source.start(0, 0, duration);
  return playback;
}
