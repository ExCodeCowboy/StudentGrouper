import { StudentConfetti } from '../components/StudentConfetti';
import type { RevealEffect } from './types';
import './confetti.css';

function ConfettiCover() {
  return <div className="confetti-reveal-paper"><span>?</span><i>✦</i><i>✧</i></div>;
}

export const confettiEffect: RevealEffect = {
  id: 'confetti', name: 'Confetti party', description: 'The covers flip open and a burst of confetti cheers on your teams.',
  durationMs: 2800, Stage: StudentConfetti, Cover: ConfettiCover,
};
