import { useLayoutEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { revealEffects } from './registry';
import type { RevealEffect, RevealPlayback } from './types';
import './revealEffects.css';

export function RevealEffectPicker({ selection, onSelect, reducedMotion, compact = false }: { selection: string; onSelect: (id: string) => void; reducedMotion: boolean; compact?: boolean }) {
  const name = selection === 'surprise' ? 'Surprise me!' : revealEffects.find((effect) => effect.id === selection)?.name ?? 'None · reveal instantly';
  return <label className={`reveal-effect-picker${compact ? ' is-compact' : ''}`} title={`Reveal effect: ${name}${reducedMotion ? ' (reduced motion: instant)' : ''}`}>
    <span className={compact ? 'sr-only' : undefined}>Reveal effect</span>
    {compact && <ChevronDown aria-hidden="true" />}
    <select value={selection} onChange={(event) => onSelect(event.target.value)}>
      <option value="surprise">Surprise me!</option>
      {revealEffects.map((effect) => <option key={effect.id} value={effect.id}>{effect.name}</option>)}
      <option value="none">None · reveal instantly</option>
    </select>
    {reducedMotion && <small className={compact ? 'sr-only' : undefined}>Reduced motion: instant reveals</small>}
  </label>;
}

export function RevealEffectLayer({ playback }: { playback: RevealPlayback | null }) {
  if (!playback) return null;
  const Stage = playback.effect.Stage;
  return <div className="reveal-effects-layer" data-reveal-effect={playback.effect.id} key={playback.sequence} aria-hidden="true"><Stage /></div>;
}

export function RevealCover({ effect }: { effect: RevealEffect }) {
  const cover = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = cover.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    element.style.setProperty('--reveal-cover-left', `${rect.left}px`);
    element.style.setProperty('--reveal-cover-top', `${rect.top}px`);
    element.style.setProperty('--reveal-cover-width', `${rect.width}px`);
    element.style.setProperty('--reveal-cover-height', `${rect.height}px`);
    element.style.setProperty('--reveal-target-x', `${window.innerWidth * .5 - rect.left - rect.width / 2}px`);
    element.style.setProperty('--reveal-target-y', `${window.innerHeight * .46 - rect.top - rect.height / 2}px`);
    element.style.setProperty('--reveal-left', `${Math.max(0, Math.min(1, rect.left / window.innerWidth))}`);
  }, []);
  const Cover = effect.Cover;
  return <div ref={cover} className="reveal-cover" data-reveal-effect={effect.id} aria-hidden="true"><Cover /></div>;
}
