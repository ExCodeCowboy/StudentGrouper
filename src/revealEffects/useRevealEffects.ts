import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveRevealEffect, revealEffects } from './registry';
import { playRevealSound, preloadRevealSounds } from './revealAudio';
import type { RevealPlayback } from './types';

const preferenceKey = 'student-grouper-reveal-effect';
const soundPreferenceKey = 'student-grouper-reveal-sound';
const soundPreferenceEvent = 'student-grouper-reveal-sound-change';
let sessionSoundEnabled = true;
let unsavedSoundPreference: boolean | undefined;
function savedSoundEnabled() {
  if (unsavedSoundPreference !== undefined) return unsavedSoundPreference;
  try {
    const value = localStorage.getItem(soundPreferenceKey);
    return value !== 'off';
  } catch { /* Keep the session preference if local storage is unavailable. */ }
  return sessionSoundEnabled;
}
function savedSelection() {
  try {
    const value = localStorage.getItem(preferenceKey);
    if (value && (value === 'none' || value === 'surprise' || revealEffects.some((effect) => effect.id === value))) return value;
  } catch { /* The presentation works even when browser preferences are unavailable. */ }
  return 'surprise';
}

export function useRevealEffects() {
  const [selection, setSelection] = useState(savedSelection);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [playback, setPlayback] = useState<RevealPlayback | null>(null);
  const [soundEnabled, updateSoundEnabled] = useState(savedSoundEnabled);
  const [soundUnavailable, setSoundUnavailable] = useState(false);
  const soundRequest = useRef<AbortController | null>(null);
  const previous = useRef<string | undefined>(undefined);
  const sequence = useRef(0);
  const animate = selection !== 'none' && !reducedMotion && revealEffects.length > 0;

  const stopSound = useCallback(() => {
    soundRequest.current?.abort();
    soundRequest.current = null;
  }, []);
  const stop = useCallback(() => { stopSound(); setPlayback(null); }, [stopSound]);

  useEffect(() => {
    if (soundEnabled) void preloadRevealSounds();
  }, [soundEnabled]);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    // Muting takes effect in this click; enabling waits for the next reveal.
    if (!enabled) stopSound();
    sessionSoundEnabled = enabled;
    updateSoundEnabled(enabled);
    setSoundUnavailable(false);
    try {
      localStorage.setItem(soundPreferenceKey, enabled ? 'on' : 'off');
      unsavedSoundPreference = undefined;
    } catch { unsavedSoundPreference = enabled; }
    window.dispatchEvent(new Event(soundPreferenceEvent));
  }, [stopSound]);

  useEffect(() => {
    const update = () => {
      const enabled = savedSoundEnabled();
      updateSoundEnabled(enabled);
      if (!enabled) stopSound();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === soundPreferenceKey || event.key === null) {
        unsavedSoundPreference = undefined;
        update();
      }
    };
    const visibility = () => { if (document.hidden) stop(); };
    window.addEventListener(soundPreferenceEvent, update);
    window.addEventListener('storage', storage);
    window.addEventListener('pagehide', stopSound);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stopSound();
      window.removeEventListener(soundPreferenceEvent, update);
      window.removeEventListener('storage', storage);
      window.removeEventListener('pagehide', stopSound);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [stop, stopSound]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReducedMotion(preference.matches); if (preference.matches) stop(); };
    if (preference.addEventListener) preference.addEventListener('change', update);
    // oxlint-disable-next-line typescript/no-deprecated
    else preference.addListener(update);
    return () => {
      if (preference.removeEventListener) preference.removeEventListener('change', update);
      // oxlint-disable-next-line typescript/no-deprecated
      else preference.removeListener(update);
    };
  }, [stop]);

  useEffect(() => {
    if (!playback) return;
    const timer = window.setTimeout(stop, playback.effect.durationMs);
    return () => window.clearTimeout(timer);
  }, [playback, stop]);

  const select = useCallback((value: string) => {
    if (value !== 'none' && value !== 'surprise' && !revealEffects.some((effect) => effect.id === value)) return;
    setSelection(value);
    stop();
    try { localStorage.setItem(preferenceKey, value); } catch { /* Optional device preference. */ }
  }, [stop]);
  const play = useCallback(() => {
    stopSound();
    setSoundUnavailable(false);
    const effect = animate ? resolveRevealEffect(selection, previous.current) : null;
    if (!effect) { setPlayback(null); return; }
    previous.current = effect.id;
    setPlayback({ effect, sequence: ++sequence.current });
    if (soundEnabled && effect.sound) {
      const request = new AbortController();
      soundRequest.current = request;
      // Start from the teacher's click, never from rendering an individual card.
      void playRevealSound(effect.sound, request.signal).then((started) => {
        if (soundRequest.current === request && !request.signal.aborted) setSoundUnavailable(!started);
      });
    }
  }, [selection, animate, soundEnabled, stopSound]);

  return { selection, select, reducedMotion, animate, playback, play, stop, soundEnabled, soundUnavailable, setSoundEnabled };
}
