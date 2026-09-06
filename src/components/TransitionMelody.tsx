import { useEffect, useState } from 'react';
import { Footprints, Music2, Play, Square } from 'lucide-react';
import { playTransitionMelody, prepareTransitionAudio } from '../transitionAudio';
import { transitionMelodies, type MelodyId } from '../transitionMelodies';
import { formatRotationTime } from '../rotationTimer';

export function TransitionMelody({ melodyId, seconds, compact = false, banner = false }: { melodyId: MelodyId; seconds: number; compact?: boolean; banner?: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [remaining, setRemaining] = useState(seconds);
  const [issue, setIssue] = useState('');
  const melody = transitionMelodies.find((item) => item.id === melodyId)!;
  useEffect(() => {
    if (stopped) return;
    const controller = new AbortController();
    let interval: number | undefined;
    void playTransitionMelody(melodyId, seconds, controller.signal, () => { setRemaining(0); setStopped(true); }).then((playback) => {
      if (!playback || controller.signal.aborted) return;
      interval = window.setInterval(() => setRemaining(playback.remaining()), 200);
    }).catch(() => { if (!controller.signal.aborted) setIssue('Press Play tune to allow sound on this device.'); });
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [melodyId, seconds, attempt, stopped]);
  return <section className={`transition-melody${compact ? ' is-compact' : ''}${banner ? ' is-banner' : ''}`} aria-label="Built-in transition tune">
    <div className="transition-melody-art" aria-hidden="true"><span><Music2 /></span><Footprints /></div>
    <p className="transition-melody-kicker">Little steps. Ready for what’s next.</p>
    <h3>{melody.name}</h3>
    <p>{melody.description}</p>
    <span className="transition-melody-time" role="timer" aria-label={`${Math.ceil(remaining)} seconds of transition music remaining`} aria-live="off">{formatRotationTime(remaining * 1000)}</span>
    <output className={issue ? 'transition-melody-issue' : undefined}>{issue || (remaining === 0 ? 'All ready? Your teacher will start the next round.' : stopped ? 'Music stopped.' : 'Tidy your space. Move safely. Find your next station.')}</output>
    <button type="button" onClick={() => {
      if (!stopped && !issue) setStopped(true);
      else { prepareTransitionAudio(); setStopped(false); setRemaining(seconds); setIssue(''); setAttempt((value) => value + 1); }
    }}>{stopped || issue ? <><Play />Play tune</> : <><Square />Stop music</>}</button>
  </section>;
}
