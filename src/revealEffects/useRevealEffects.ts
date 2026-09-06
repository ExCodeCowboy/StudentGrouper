import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveRevealEffect, revealEffects } from './registry';
import type { RevealPlayback } from './types';

const preferenceKey = 'student-grouper-reveal-effect';
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
  const previous = useRef<string | undefined>(undefined);
  const sequence = useRef(0);
  const animate = selection !== 'none' && !reducedMotion && revealEffects.length > 0;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReducedMotion(preference.matches); if (preference.matches) setPlayback(null); };
    if (preference.addEventListener) preference.addEventListener('change', update);
    // oxlint-disable-next-line typescript/no-deprecated
    else preference.addListener(update);
    return () => {
      if (preference.removeEventListener) preference.removeEventListener('change', update);
      // oxlint-disable-next-line typescript/no-deprecated
      else preference.removeListener(update);
    };
  }, []);

  useEffect(() => {
    if (!playback) return;
    const timer = window.setTimeout(() => setPlayback(null), playback.effect.durationMs);
    return () => window.clearTimeout(timer);
  }, [playback]);

  const select = useCallback((value: string) => {
    if (value !== 'none' && value !== 'surprise' && !revealEffects.some((effect) => effect.id === value)) return;
    setSelection(value);
    setPlayback(null);
    try { localStorage.setItem(preferenceKey, value); } catch { /* Optional device preference. */ }
  }, []);
  const stop = useCallback(() => setPlayback(null), []);
  const play = useCallback(() => {
    const effect = animate ? resolveRevealEffect(selection, previous.current) : null;
    if (!effect) { setPlayback(null); return; }
    previous.current = effect.id;
    setPlayback({ effect, sequence: ++sequence.current });
  }, [selection, animate]);

  return { selection, select, reducedMotion, animate, playback, play, stop };
}
