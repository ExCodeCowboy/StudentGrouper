import { StudentConfetti } from '../components/StudentConfetti';
import type { RevealEffect } from './types';
import './confetti.css';

function ConfettiCover() {
  return <div className="confetti-reveal-paper"><span>?</span><i>✦</i><i>✧</i></div>;
}

export const confettiEffect: RevealEffect = {
  id: 'confetti', name: 'Confetti party', description: 'A little drumroll, then the covers flip open with a celebratory confetti burst.',
  durationMs: 3800, sound: 'confetti', Stage: StudentConfetti, Cover: ConfettiCover,
};
