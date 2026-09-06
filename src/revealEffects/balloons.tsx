import type { CSSProperties } from 'react';
import type { RevealEffect } from './types';
import './balloons.css';

function BalloonStage() {
  return <>{Array.from({ length: 12 }, (_, index) => <div className="lift-off-balloon" key={index} style={{ '--balloon-x': `${(index * 41) % 100}%`, '--balloon-color': ['#e6ad53', '#d98cae', '#75b7cf', '#8db88e'][index % 4], '--balloon-delay': `${index % 4 * 90}ms`, '--balloon-sway': `${index % 2 ? 35 : -35}px` } as CSSProperties}><i /><span /></div>)}</>;
}

function BalloonCover() {
  return <div className="balloon-cover-lift"><div className="balloon-cover-bunch"><i /><i /><i /><span /><span /></div><div className="balloon-cover-paper"><strong>?</strong><span>✦</span></div></div>;
}

export const balloonEffect: RevealEffect = {
  id: 'balloons', name: 'Balloon lift-off', description: 'Balloons tug on the covers, wobble, and carry them up into the sky.',
  durationMs: 2600, Stage: BalloonStage, Cover: BalloonCover,
};
