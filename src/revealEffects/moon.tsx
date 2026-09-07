import { useId } from 'react';
import { fadeWindow, mix, MOON_DURATION_MS, progress, smooth } from './sceneMotion';
import { useSceneTime } from './useSceneTime';
import type { RevealEffect } from './types';
import './moon.css';
import { Astronaut, LunarLander } from './apolloIllustration';

function SaturnV({ time, id }: { time: number; id: string }) {
  const separation = progress(time, 2.25, 3.45);
  const secondSeparation = smooth(progress(time, 2.98, 3.56));
  const ignition = smooth(progress(time, .12, .75));
  const towerJettison = smooth(progress(time, 2.72, 3.25));
  const flicker = 1 + Math.sin(time * 72) * .08 + Math.cos(time * 43) * .05;
  const upperPlume = Math.max(0, Math.min(.85, (separation * 270 - 16) / 132));
  const thirdPlume = Math.max(0, Math.min(.85, (secondSeparation * 155 - 14) / 100));
  return <g strokeLinejoin="round" transform="scale(.8 1)">
    <g transform={`translate(${-separation * separation * 16} ${separation * 270}) rotate(${-separation * separation * 9} 0 -70)`} opacity={1 - smooth(progress(time, 3, 3.6))}>
      <g transform={`scale(1 ${ignition * flicker * (1 - smooth(progress(time, 2.12, 2.27)))})`}>
        <path d="M-28 1Q-48 94-38 213L-53 367Q0 409 53 367L39 214Q49 95 28 1Z" fill={`url(#${id}-exhaust)`} />
        <path d="M-20 2Q-28 95-16 194L-25 317Q0 341 25 317L16 194Q29 96 20 2Z" fill={`url(#${id}-exhaust-core)`} />
        <path d="M-12 3-15 136-5 188 2 158 12 193 15 132 12 3Z" fill="#fffef6" />
      </g>
      <g stroke="#394755" strokeWidth="2">
        <path d="M-27-157H27V-10H-27Z" fill={`url(#${id}-white)`} />
        <path d="M-27-152H27V-126H-27Z" fill="#243140" />
        <path d="M-27-57h10v42h-10Zm19 0h16v42H-8Zm26 0h9v42h-9Z" fill="#293139" />
        <path d="M-15-126V-43M16-126V-43" stroke="#e2ddd0" strokeWidth="4" />
        <path d="M-22-119v61M-19-119v61M22-119v61M19-119v61M-23-18h46M-23-22h46" stroke="#8b9393" strokeWidth=".6" opacity=".7" />
        <path d="M-27-44-48-1-25-10M27-44 48-1 25-10" fill="#dee3e5" />
        {[-18, 0, 18].map((x) => <path key={x} d={`M${x - 5}-10h10l4 17h-18Z`} fill="#485768" />)}
        <path d="M-31-8H31" stroke="#bec4c7" strokeWidth="4" />
      </g>
      <text x="3" y="-109" textAnchor="middle" fill="#ad4339" fontSize="8" fontWeight="700"><tspan x="3">U</tspan><tspan x="3" dy="10">S</tspan><tspan x="3" dy="10">A</tspan></text>
    </g>
    <g transform={`translate(${-secondSeparation * secondSeparation * 9} ${secondSeparation * 155}) rotate(${-secondSeparation * 5} 0 -218)`} opacity={1 - smooth(progress(time, 3.4, 3.75))}>
    <g stroke="#394755" strokeWidth="2">
      <path d="M-27-284H27V-157H-27Z" fill={`url(#${id}-white)`} />
      <path d="M-27-276H27V-253H-27Z" fill="#263342" />
      <path d="M-20-275V-253M0-275V-253M20-275V-253" stroke="#eef0e9" strokeWidth="8" />
      <path d="M-27-170H27M-27-178H27M-27-247H27" stroke="#88939b" />
      <path d="M-24-241v57M-21-241v57M21-241v57M24-241v57" stroke="#949c9d" strokeWidth=".6" />
      <path d="M-27-284-19-309H19L27-284Z" fill="#d7dde0" />
    </g>
    <text transform="translate(3 -188) rotate(-90)" fill="#253746" fontSize="7" fontWeight="700" letterSpacing="2">UNITED STATES</text>
    <g opacity={smooth(progress(time, 2.35, 2.49)) * (1 - smooth(progress(time, 2.88, 3.02)))} transform={`translate(0 -154) scale(.67 ${upperPlume * flicker})`}>
      <path d="M-17-5h9l3 8h-15Zm25 0h9l3 8H5ZM-4-5h8l3 8H-7Z" fill="#687277" />
      <path d="M-21 0Q-25 44 0 106Q25 44 21 0Z" fill={`url(#${id}-exhaust)`} /><path d="M-10 0 0 64 10 0" fill="#ffffe8" />
    </g>
    </g>
    <g stroke="#394755" strokeWidth="2">
      <path d="M-19-359H19V-309H-19Z" fill={`url(#${id}-white)`} />
      <path d="M-19-328H19V-309H-19Z" fill="#2b3846" />
      <path d="M-19-359-11-385H11L19-359Z" fill="#efeee4" />
      <path d="M-11-385 0-407 11-385Z" fill="#dde1de" />
      <g transform={`translate(${towerJettison * 66} ${-towerJettison * 84}) rotate(${towerJettison * 12} 0 -429)`} opacity={1 - towerJettison}>
        <path d="M-5-407V-431H5V-407M0-431V-451" fill="#e7e5de" stroke="#e7e5de" />
        <path d="M-6-408 6-428M6-408-6-428" stroke="#6a7782" strokeWidth="1.5" />
      </g>
    </g>
    <g opacity={smooth(progress(time, 3.1, 3.22))} transform={`translate(0 -308) scale(1 ${thirdPlume * flicker})`}>
      <path d="M-5-3H5L8 7H-8Z" fill="#687277" />
      <path d="M-8 7Q-18 49 0 92Q18 49 8 7Z" fill={`url(#${id}-exhaust)`} /><path d="M-4 7 0 60 4 7Z" fill="#fffbe4" />
    </g>
  </g>;
}

function LaunchTower({ time }: { time: number }) {
  const retract = smooth(progress(time, .22, .68));
  return <g stroke="#995d54" strokeWidth="5" fill="none">
    <path d="M666 630V180H712V630M656 630H722" />
    {Array.from({ length: 9 }, (_, i) => <g key={i}><path d={`M666 ${185 + i * 48}l46 48m-46 0 46-48M666 ${185 + i * 48}h46`} /><g transform={`translate(712 ${197 + i * 44}) scale(${mix(1, .32, retract)} 1)`}><path d="M0 0h65v10H0Z" fill="#b27b65" strokeWidth="2" /><path d="M3 0v-6h59v6M18-6v6m19-6v6m18-6v6" stroke="#c2b7aa" strokeWidth="1.2" /></g></g>)}
    <path d="M684 180V150M675 167h20" stroke="#bbc7c7" strokeWidth="3" />
    <path d="M634 630H837L856 648H617Z" fill="#43556b" stroke="#728499" />
  </g>;
}

function Earth({ id }: { id: string }) {
  return <g>
    <circle r="65" fill="#8bd3ed" opacity=".14" /><circle r="60" fill={`url(#${id}-earth)`} />
    <g clipPath={`url(#${id}-earth-clip)`}>
      <path d="M-57-28-39-44-25-42-18-31-28-20-14-15-10 1-23 12-38 2-43-12-59-13ZM-19 9-2 17 4 29-5 42-13 63-21 48-19 32-28 19ZM16-55 45-45 61-23 46-15 26-24 16-12 8-25ZM35-9 62 4 48 30 28 35 19 17Z" fill="#8ab69c" />
      <g fill="none" stroke="#edf5ee" strokeWidth="4" opacity=".85"><path d="M-64-18Q-32-47-6-29T58-13M-51 22Q-35 3-19 12M-4 50Q18 33 57 38M-9-54Q19-60 45-41" /><path d="M-48-31Q-20-38-7-23M17 2Q38-9 62 5" strokeWidth="2" /></g>
      <ellipse cx="29" cy="20" rx="52" ry="64" fill={`url(#${id}-earth-shadow)`} />
    </g>
    <circle r="60" fill="none" stroke="#c9ebf0" strokeOpacity=".5" strokeWidth="2" />
  </g>;
}

function LunarFlag({ id }: { id: string }) {
  const cloth = 'M1-89H56L59-54Q30-58 1-54Z';
  const stripeHeight = 35 / 13;
  const star = 'M0 -1 .2245 -.309 .9511 -.309 .3633 .118 .5878 .809 0 .382 -.5878 .809 -.3633 .118 -.9511 -.309 -.2245 -.309Z';
  return <g>
    <defs><clipPath id={`${id}-flag-cloth`}><path d={cloth} /></clipPath></defs>
    <g clipPath={`url(#${id}-flag-cloth)`}>
      <path d={cloth} fill="#f5f0df" />
      {Array.from({ length: 7 }, (_, stripe) => <rect key={stripe} x="1" y={-89 + stripe * 2 * stripeHeight} width="59" height={stripeHeight} fill="#b83c43" />)}
      <rect x="1" y="-89" width="22" height={stripeHeight * 7} fill="#233d65" />
      {Array.from({ length: 9 }, (_, row) => Array.from({ length: row % 2 ? 5 : 6 }, (_, column) => <path key={`${row}-${column}`} d={star} fill="#fff8e5" transform={`translate(${1 + (column + .5 + row % 2 * .5) * 22 / 6} ${-89 + (row + 1) * stripeHeight * .7}) scale(.8)`} />))}
    </g>
    <path d={cloth} fill="none" stroke="#d4d0c2" strokeWidth="1" />
  </g>;
}

/** Every phase shares one clock, including the landing dust and final aperture. */
export function MoonScene({ time }: { time: number }) {
  const id = useId();
  const ascent = smooth(progress(time, .55, 2.35));
  const orbit = smooth(progress(time, 2.35, 3.75));
  const landing = smooth(progress(time, 4.15, 5.85));
  const approach = smooth(progress(time, 3.05, 4.65));
  const moonRadius = mix(155, 23000, approach);
  const moonX = mix(1140, 800, approach);
  const moonY = moonRadius + mix(430, 575, approach);
  const camera = 1 + .3 * smooth(progress(time, 4, 5.55));
  const dust = fadeWindow(time, 5.15, 5.6, 5.85, 6.28);
  const landerX = mix(1010, 800, landing);
  const landerY = mix(267, 501, landing);
  const landerScale = mix(.36, 1, landing);
  const undocking = smooth(progress(time, 3.93, 4.65));
  const altitude = Math.max(0, 624 - landerY - landerScale * 123);
  const opening = smooth(progress(time, 7.2, 8.65));
  const astronautStep = smooth(progress(time, 6.43, 6.88));
  const flag = smooth(progress(time, 6.76, 7.02));
  const earthScale = mix(3.8, .55, smooth(progress(time, 2, 3.9)));
  const sceneOpacity = 1 - smooth(progress(time, 8.55, 8.8));
  const caption = time < .55 ? 'A little mission. A giant adventure.' : time < 2.2 ? 'LIFTOFF' : time < 3.6 ? 'NEXT STOP: THE MOON' : time < 4.15 ? 'EAGLE IS READY' : time < 5.85 ? 'EASY DOES IT…' : time < 7.2 ? 'THE EAGLE HAS LANDED' : '';
  return <div className="moon-reveal-scene" style={{ opacity: sceneOpacity }}>
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor="#526c91" /><stop offset=".65" stopColor="#98b8ca" /><stop offset="1" stopColor="#f8d5ad" /></linearGradient>
        <radialGradient id={`${id}-space`} cx=".55" cy=".38" r=".8"><stop stopColor="#101722" /><stop offset=".55" stopColor="#090e16" /><stop offset="1" stopColor="#03060a" /></radialGradient>
        <linearGradient id={`${id}-white`}><stop stopColor="#9eacb6" /><stop offset=".27" stopColor="#fffdf0" /><stop offset=".6" stopColor="#f5f0df" /><stop offset="1" stopColor="#8495a3" /></linearGradient>
        <linearGradient id={`${id}-exhaust`} x2="0" y2="1"><stop stopColor="#fffef5" /><stop offset=".28" stopColor="#fff3c3" /><stop offset=".58" stopColor="#ffc886" stopOpacity=".75" /><stop offset="1" stopColor="#e4a16f" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}-exhaust-core`} x2="0" y2="1"><stop stopColor="#fffef8" /><stop offset=".58" stopColor="#fffceb" /><stop offset="1" stopColor="#fff4cf" stopOpacity="0" /></linearGradient>
        <radialGradient id={`${id}-earth`} cx=".25" cy=".2"><stop stopColor="#8ac6d5" /><stop offset=".65" stopColor="#4179a7" /><stop offset="1" stopColor="#25455e" /></radialGradient>
        <linearGradient id={`${id}-earth-shadow`}><stop stopColor="#102036" stopOpacity="0" /><stop offset="1" stopColor="#0d1b31" stopOpacity=".8" /></linearGradient>
        <clipPath id={`${id}-earth-clip`}><circle r="60" /></clipPath>
        <clipPath id={`${id}-above-pad`}><rect x="-2000" y="-2000" width="6000" height={2630 + ascent * 650} /></clipPath>
        <clipPath id={`${id}-ground-clip`}><circle cx={moonX} cy={moonY} r={moonRadius} /></clipPath>
        <linearGradient id={`${id}-moon`} x2=".35" y2="1"><stop stopColor="#a7a59e" /><stop offset=".2" stopColor="#95948e" /><stop offset="1" stopColor="#777973" /></linearGradient>
        <pattern id={`${id}-regolith`} width="91" height="67" patternUnits="userSpaceOnUse">{Array.from({length:24},(_, i)=><g key={i}><path d={`m${(i*37)%91} ${(i*23)%67} ${2+i%4} -1 ${i%3+1} 2Z`} fill={i%3 ? '#494b4b' : '#d5d1c1'} opacity={.08+i%3*.04} /></g>)}</pattern>
        <radialGradient id={`${id}-smoke`} cx=".5" cy=".3" r=".68"><stop stopColor="#f4ebd8" /><stop offset=".48" stopColor="#d9dad3" stopOpacity=".94" /><stop offset=".8" stopColor="#aeb9b8" stopOpacity=".7" /><stop offset="1" stopColor="#aeb9b8" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}-gold`} x2=".5" y2="1"><stop stopColor="#fff1b5" /><stop offset=".3" stopColor="#d9b367" /><stop offset=".55" stopColor="#edd18c" /><stop offset="1" stopColor="#a57940" /></linearGradient>
        <linearGradient id={`${id}-cabin`}><stop stopColor="#aeb8be" /><stop offset=".45" stopColor="#efeee3" /><stop offset="1" stopColor="#858d97" /></linearGradient>
        <linearGradient id={`${id}-visor`} x2=".8" y2="1"><stop stopColor="#ffe9a6" /><stop offset=".4" stopColor="#b78543" /><stop offset="1" stopColor="#4c4351" /></linearGradient>
        <radialGradient id={`${id}-landing-flame`}><stop stopColor="#ffefbc" stopOpacity=".9" /><stop offset="1" stopColor="#ebc181" stopOpacity="0" /></radialGradient>
        <mask id={`${id}-reveal`} maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900"><rect width="1600" height="900" fill="white" /><circle cx="898" cy="629" r={opening * 1200} fill="black" /></mask>
      </defs>
      <g mask={`url(#${id}-reveal)`}>
        <g transform={`translate(800 625) scale(${camera}) translate(-800 -625)`}>
        <rect width="1600" height="900" fill={`url(#${id}-space)`} />
        <rect width="1600" height="900" fill={`url(#${id}-sky)`} opacity={1 - smooth(progress(time, 1.1, 2.7))} />
        <g opacity={smooth(progress(time, 1.3, 2.5)) * (1 - .92 * landing)}>
          {Array.from({ length: 82 }, (_, i) => {
            const x = (i * 313 + 43) % 1600;
            const y = (i * 157 + 19) % 760;
            return <g key={i} opacity={.25 + (i % 5) * .13}><circle cx={x} cy={y} r={i % 7 === 0 ? 2 : 1.1} fill="#e0e6e9" />{i % 13 === 0 && <path d={`M${x - 5} ${y}h10m-5-5v10`} stroke="#cedee4" strokeWidth="1" />}</g>;
          })}
        </g>
        <g opacity={1 - smooth(progress(time, 1.7, 2.55))} transform={`translate(0 ${ascent * 650})`}>
          <path d="M-50 630Q280 610 590 632T1660 615V1000H-50Z" fill="#667d86" /><path d="M0 671Q590 626 1600 656V950H0Z" fill="#536579" />
          <path d="M505 640H956" stroke="#a3a999" strokeWidth="3" /><LaunchTower time={time} />
        </g>
        <g opacity={fadeWindow(time, .18, .75, 1.55, 2.4)} transform={`translate(0 ${ascent * 650})`}>
          {Array.from({ length: 18 }, (_, i) => {
            const puff = progress(time, .12 + (i % 5) * .055, 1.7);
            const side = i % 2 ? 1 : -1;
            const x = 800 + side * puff * (100 + i * 21);
            const y = 642 - Math.sin(puff * Math.PI) * (15 + i % 4 * 22);
            const radius = 15 + puff * (40 + i % 5 * 13);
            return <g key={i} fill={`url(#${id}-smoke)`} opacity=".94"><ellipse cx={x} cy={y} rx={radius} ry={radius * .56} /><ellipse cx={x - radius * .45} cy={y - radius * .14} rx={radius * .56} ry={radius * .49} /><ellipse cx={x + radius * .32} cy={y - radius * .3} rx={radius * .55} ry={radius * .48} /></g>;
          })}
        </g>
        <g clipPath={`url(#${id}-above-pad)`}><g transform={`translate(${mix(800, 1120, orbit)} ${mix(625, 300, ascent) - orbit * 10}) rotate(${orbit * 54}) scale(${mix(1, .42, ascent) * mix(1, .7, orbit)})`} opacity={1 - smooth(progress(time, 3.5, 3.72))}>
          <SaturnV time={time} id={id} />
        </g></g>
        <g transform={`translate(${mix(380, 410, approach)} ${mix(700, 365, smooth(progress(time, 2, 3.8)))}) scale(${earthScale}) rotate(-18)`} opacity={smooth(progress(time, 1.9, 2.65))}><Earth id={id} /></g>
        <g opacity={smooth(progress(time, 2.85, 3.35))}>
          <circle cx={moonX} cy={moonY} r={moonRadius} fill={`url(#${id}-moon)`} stroke="#dbdace" strokeWidth="2" />
          <g opacity={1 - smooth(progress(approach, 0, .16))} fill="#979daa"><ellipse cx="1110" cy="522" rx="29" ry="21" /><ellipse cx="1204" cy="579" rx="21" ry="27" /><ellipse cx="1101" cy="631" rx="41" ry="23" /></g>
          <g opacity={smooth(progress(time, 4.15, 4.8))} clipPath={`url(#${id}-ground-clip)`}>
            <path d="M-100 746Q445 639 760 660T1700 723V1050H-100Z" fill="#82857f" opacity=".15" />
            <rect x="-100" y="610" width="1800" height="500" fill={`url(#${id}-regolith)`} />
            {Array.from({ length: 7 }, (_, i) => {
              const x = (i * 347 + 20) % 1700 - 50;
              const y = 696 + (i * 73) % 300;
              const r = 8 + (i * 11) % 45;
              return <g key={i}><ellipse cx={x} cy={y} rx={r} ry={r * .2} fill="#535851" opacity=".28" /><path d={`M${x - r} ${y}a${r} ${r * .23} 0 0 1 ${r * 2} 0`} fill="none" stroke="#c2beb0" opacity=".5" strokeWidth="1.5" /><path d={`M${x - r * .7} ${y + 1}q${r * .7}-${r * .15} ${r * 1.4} 0`} fill="none" stroke="#454b46" opacity=".4" strokeWidth="1" /></g>;
            })}
            {Array.from({length:19},(_,i)=>{const x=(i*317+93)%1650;const y=658+(i*53)%260;const r=2+i%5*2;return <g key={i}><path d={`M${x} ${y}l${-r*3} ${r*.4} ${r*3+r} ${r*.2}Z`} fill="#3c423d" opacity=".4" /><path d={`M${x} ${y}l${r*.7} ${-r} ${r} ${r*.4} ${r*.5} ${r*.8}Z`} fill="#94968d" stroke="#c8c5b8" strokeWidth=".7" /><path d={`M${x} ${y}l${r*.7} ${-r} ${r*.3} ${r*1.2}Z`} fill="#5c635c" /></g>})}
          </g>
        </g>
        {/* A short dissolve skips the multi-day coast; Columbia starts docked nose-to-hatch. */}
        <g transform={`translate(${mix(1030.75, 1290, undocking)} ${mix(189.57, 85, undocking)}) rotate(${mix(105, -30, undocking)})`} opacity={fadeWindow(time, 3.55, 3.72, 4.65, 5.2)}>
          <path d="M-45-14H15V14H-45Z" fill="#a2b0ba" stroke="#d5dad7" strokeWidth="2" /><path d="M15-14 42 0 15 14Z" fill="#f5efdc" /><path d="M-46-8-61-13V13L-46 8" fill="#5a677c" /><path d="M-25-14V14M-4-14V14" stroke="#e0e1d7" strokeWidth="2" />
        </g>
        <g clipPath={`url(#${id}-ground-clip)`}>
          <g transform={`translate(${landerX - 800 - altitude * .4} 0)`} opacity={smooth(progress(time, 4.3, 5.8))}>
            <path d="M682 617 738 608 862 608 918 617 855 635 746 657 702 667 578 670 621 653 661 649 740 626Z" fill="#181d1d" opacity={mix(.12, .7, landing)} />
            <path d="M682 617 583 649m205-25-110 34m240-41-83 31" stroke="#171c1d" strokeWidth="3" opacity={landing * .65} />
          </g>
          <g opacity={smooth(progress(time, 5.7, 5.85))} fill="#272c29"><ellipse cx="682" cy="617" rx="20" ry="3" /><ellipse cx="918" cy="617" rx="20" ry="3" /><ellipse cx="788" cy="624" rx="22" ry="3" /></g>
          <g opacity={dust}>
            {Array.from({ length: 26 }, (_, i) => {
              const spread = progress(time, 5.08 + i % 5 * .055, 6.28);
              const direction = i % 2 ? 1 : -1;
              const x = 800 + direction * (30 + spread * (130 + i * 13));
              const y = 624 + i % 4 * 4 - Math.sin(spread * Math.PI) * (2 + i % 3 * 3);
              return <path key={i} d={`M${x} ${y}q${direction * 14} -2 ${direction * (23 + spread * 23)} ${i % 3 - 1}`} fill="none" stroke={i % 2 ? '#e5dfcb' : '#bdbdb2'} strokeWidth={1 + (i % 3) * .7} opacity={.6 * (1 - spread)} />;
            })}
          </g>
        </g>
        <g transform={`translate(${landerX} ${landerY}) rotate(${mix(15, 0, landing) - Math.sin(landing * Math.PI) * 9}) scale(${landerScale})`} opacity={smooth(progress(time, 3.55, 3.72))}><LunarLander time={time} id={id} /></g>
        <path d="M859 629 780 652 799 654 880 632 898 630 879 626Z" transform={`translate(${mix(788, 875, astronautStep) - 875} 0)`} fill="#222927" opacity={smooth(progress(time, 6.4, 6.6)) * (.7 - Math.sin(astronautStep * Math.PI) * .3)} />
        <path d="M926 629 826 656" stroke="#242b29" strokeWidth="2" opacity={flag * .7} />
        <g opacity={flag} transform={`translate(926 ${mix(604, 629, flag)})`}>
          <path d="M0 0V-91H56" stroke="#e6e1c9" strokeWidth="3" fill="none" /><circle cy="-92" r="3" fill="#fce7aa" />
          <g transform={`scale(${flag} 1)`}><LunarFlag id={id} /></g>
        </g>
        <Astronaut time={time} id={id} />
        </g>
      </g>
      {opening > 0 && <g opacity={1 - opening}><circle cx="898" cy="629" r={opening * 1200} fill="none" stroke="#ffefd0" strokeWidth={5 + opening * 30} /><circle cx="898" cy="629" r={opening * 1200 + 11} fill="none" stroke="#f1d1a0" strokeWidth="2" opacity=".4" /></g>}
    </svg>
    <div className="moon-mission-caption" style={{ opacity: 1 - smooth(progress(time, 7.05, 7.25)) }}>
      <div>{caption}</div><div className="moon-mission-progress">{[.55, 2.35, 3.95, 5.85].map(threshold => <i key={threshold} className={time >= threshold ? 'is-lit' : undefined} />)}</div>
    </div>
  </div>;
}

function MoonStage() { return <MoonScene time={useSceneTime(MOON_DURATION_MS)} />; }
function MoonCover() { return null; }
export const moonEffect: RevealEffect = { id: 'moon', name: 'Saturn V · Moon landing', description: 'Liftoff, separation, a gentle lunar landing, and one little astronaut opening a window onto the day.', durationMs: MOON_DURATION_MS, Stage: MoonStage, Cover: MoonCover };
