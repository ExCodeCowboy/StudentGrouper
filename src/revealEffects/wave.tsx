import type { RevealEffect } from './types';
import './wave.css';

const waveLayers = [
  { fill: '#dbfbff', d: 'M0 0H520C640 30 590 180 700 170C830 150 760 15 890 65C1100 150 910 350 1020 440C1140 550 1080 700 1200 900H0Z' },
  { fill: '#66d2e0', d: 'M0 0H480C600 60 550 220 700 210C850 190 770 65 890 110C1010 180 875 360 980 465C1080 565 1030 725 1160 900H0Z' },
  { fill: '#359ec5', d: 'M0 0H300C520 180 400 370 690 360C950 330 800 590 940 660C1050 720 1000 815 1080 900H0Z' },
  { fill: '#247da8', d: 'M0 260C170 170 350 500 470 455C700 370 780 790 880 900H0Z' },
];

function WaveStage() {
  return <div className="ocean-reveal-wave">
    <svg viewBox="-1200 0 2400 900" preserveAspectRatio="none" aria-hidden="true">
      {/* Both edges share the same curves, including the foam and inner layers. */}
      {[1, -1].map((direction) => <g key={direction} transform={`scale(${direction} 1)`}>
        {waveLayers.map((layer) => <path key={layer.fill} {...layer} />)}
        <g fill="none" stroke="#eaffff" strokeWidth="8" opacity=".8"><circle cx="600" cy="340" r="13" /><circle cx="770" cy="530" r="22" /><circle cx="470" cy="210" r="9" /><circle cx="970" cy="710" r="14" /></g>
      </g>)}
    </svg>
    <span className="ocean-reveal-fish">🐠</span><span className="ocean-reveal-turtle">🐢</span>
  </div>;
}

function WaveCover() { return <div className="ocean-reveal-cover"><span>?</span><i /><i /></div>; }

export const waveEffect: RevealEffect = {
  id: 'wave', name: 'Ocean wave', description: 'A foamy wave washes the covers away, with a couple of ocean friends along for the ride.',
  durationMs: 2600, sound: 'wave', Stage: WaveStage, Cover: WaveCover,
};
