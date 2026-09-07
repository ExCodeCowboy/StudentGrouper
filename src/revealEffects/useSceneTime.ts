import { useEffect, useState } from 'react';

/** One clock per screen, never per card. Unmounting cancels the animation frame. */
export function useSceneTime(durationMs: number): number {
  const [time, setTime] = useState(0);
  useEffect(() => {
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = Math.min(durationMs, now - started);
      setTime(elapsed / 1000);
      if (elapsed < durationMs) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs]);
  return time;
}
