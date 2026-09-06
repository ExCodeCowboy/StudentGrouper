import { useEffect, useRef, useState } from 'react';
import { createRotationClock, reduceRotationClock, remainingRotationMs, type ClockAction, type RotationClock } from './rotationTimer';

export function useRotationTimer(roundIds: string[], durationSeconds: number, initial: RotationClock | undefined, remember: (clock: RotationClock) => void) {
  const [clock, setClock] = useState(() => initial && roundIds.includes(initial.roundId)
    ? reduceRotationClock(initial, { type: 'pause', now: Date.now() })
    : createRotationClock(roundIds[0] ?? '', durationSeconds));
  const [now, setNow] = useState(Date.now);
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  const latest = useRef(clock);
  const save = useRef(remember);
  useEffect(() => { latest.current = clock; save.current = remember; }, [clock, remember]);
  useEffect(() => {
    const update = () => {
      const time = Date.now();
      setNow(time);
      setVisible(document.visibilityState !== 'hidden');
      setClock((current) => reduceRotationClock(current, { type: 'tick', now: time }));
    };
    const interval = window.setInterval(update, 250);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
      // Leaving the presentation pauses it. Runtime state never enters backups.
      save.current(reduceRotationClock(latest.current, { type: 'pause', now: Date.now() }));
    };
  }, []);
  const dispatch = (action: ClockAction) => {
    setNow(Date.now());
    setClock((current) => reduceRotationClock(current, action));
  };
  return { clock, dispatch, visible, remainingMs: remainingRotationMs(clock, now) };
}
