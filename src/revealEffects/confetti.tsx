import type { CSSProperties } from 'react';
import { StudentConfetti } from '../components/StudentConfetti';
import { CONFETTI_DURATION_MS, COVER_SPARKLES, PICKER_SPARKLES, coverBurstBits, pickerBurstBits } from './confettiTimeline';
import type { RevealEffect } from './types';
import './confetti.css';

const BITS = coverBurstBits();
const PICKER_BITS = pickerBurstBits(BITS.length);
const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties;

/**
 * One sprite per card: irregular two-tone paper bits and two sparkles scale
 * outward as a single layer. A per-card turn in CSS (--reveal-index) keeps the
 * bursts from looking stamped. Each bit also carries its picker position
 * (--px/--py): on the picker's one wide card the same bits frame the name.
 */
const BURST_SPRITE = <div className="cf-cover-burst" aria-hidden="true"><div className="cf-bits">
  {BITS.map((bit, i) => <i key={i} className="cf-bit" style={cssVars({
    '--x': `${bit.x}%`, '--y': `${bit.y}%`, '--px': `${PICKER_BITS[i].x}%`, '--py': `${PICKER_BITS[i].y}%`,
    '--w': bit.width, '--h': bit.height, '--r': `${bit.rotate}deg`, '--c1': bit.tone[0], '--c2': bit.tone[1],
  })} />)}
  {COVER_SPARKLES.map((spark, i) => <i key={`s${i}`} className="cf-spark" style={cssVars({
    '--x': `${spark.x}%`, '--y': `${spark.y}%`, '--px': `${PICKER_SPARKLES[i].x}%`, '--py': `${PICKER_SPARKLES[i].y}%`,
    '--w': spark.size, '--h': spark.size, '--r': `${i * 20}deg`,
  })} />)}
</div></div>;

/*
 * Party-paper cover. A still backing never moves (so trembling can't expose
 * names); the sheet on top trembles, inhales, then pops like a balloon on the
 * drum's "DUM" in a wave from the screen edges inward, with a gold ring and a
 * burst of paper bits. The cover clips to its card and every layer falls back
 * to invisible when done. CSS only; everything is gone by ~2.6 s.
 */
const COVER = <div className="cf-cover">
  <div className="cf-cover-pop">
    <div className="cf-cover-backing" />
    <div className="cf-cover-paper"><div className="cf-sheet"><span>?</span><i className="cf-sheet-star is-a" /><i className="cf-sheet-star is-b" /></div></div>
  </div>
  <i className="cf-cover-ring" />
  {BURST_SPRITE}
</div>;

function ConfettiCover() {
  return COVER;
}

export const confettiEffect: RevealEffect = {
  id: 'confetti', name: 'Confetti party',
  description: 'Lights dim and a spotlight searches, catching Pip the party popper going off too early, then both poppers POP: the covers burst, confetti fountains and streamers frame the names and gold stars shower down.',
  durationMs: CONFETTI_DURATION_MS, sound: 'confetti', Stage: StudentConfetti, Cover: ConfettiCover,
};
