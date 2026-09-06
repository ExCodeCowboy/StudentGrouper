import type { CSSProperties } from 'react';
import type { RevealEffect } from './types';
import './blackHole.css';

function BlackHoleStage() {
  return <div className="black-hole-scene">
    <div className="black-hole-halo" />
    <div className="black-hole-core"><i /><i /><i /><span /></div>
    {Array.from({ length: 28 }, (_, index) => <i className="black-hole-stardust" key={index} style={{ '--dust-angle': `${index * 137.5}deg`, '--dust-distance': `${28 + index % 7 * 6}vmax`, '--dust-delay': `${index % 5 * 70}ms` } as CSSProperties} />)}
  </div>;
}

function BlackHoleCover() {
  return <div className="black-hole-paper">{Array.from({ length: 6 }, (_, index) => <div className="black-hole-paper-orbit" key={index} style={{ '--slice': index, '--slice-turn': `${(index - 2.5) * 16}deg` } as CSSProperties}><i><span>✦</span></i></div>)}</div>;
}

export const blackHoleEffect: RevealEffect = {
  id: 'black-hole', name: 'Black-hole whoosh', description: 'Paper ribbons tumble around a swirling space portal, spiraling inward until they disappear.',
  durationMs: 2500, Stage: BlackHoleStage, Cover: BlackHoleCover,
};
