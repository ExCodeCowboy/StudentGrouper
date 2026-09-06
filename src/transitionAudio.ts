import { renderTransitionMelody, type MelodyId } from './transitionMelodies';

let context: AudioContext | undefined;
let active: { stop: () => void } | undefined;
const buffers = new Map<string, AudioBuffer>();

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

export async function playTransitionMelody(id: MelodyId, seconds: number, signal: AbortSignal, onEnd: () => void) {
  const audio = audioContext();
  if (signal.aborted) return null;
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(new DOMException('Canceled', 'AbortError'));
    const timeout = window.setTimeout(() => finish(new Error('Press Play tune to allow sound.')), 2000);
    signal.addEventListener('abort', abort, { once: true });
    void audio.resume().then(() => finish(), (error: Error) => finish(error));
  });
  if (signal.aborted) return null;
  if (audio.state !== 'running') throw new Error('Press Play tune to allow sound.');
  active?.stop();
  const key = `${id}:${seconds}`;
  let buffer = buffers.get(key);
  if (!buffer) {
    const samples = renderTransitionMelody(id, seconds);
    buffer = audio.createBuffer(1, samples.length, 22050);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    buffers.set(key, buffer);
  }
  const source = audio.createBufferSource();
  const gain = audio.createGain();
  gain.gain.value = .65;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(audio.destination);
  const started = audio.currentTime;
  let stopped = false;
  const playback = {
    remaining: () => Math.max(0, seconds - (audio.currentTime - started)),
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
  source.start();
  return playback;
}
