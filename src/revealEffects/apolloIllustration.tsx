import { mix, progress, smooth } from './sceneMotion';

/** Angular blankets and uneven foil highlights, based on Apollo 11 photographs. */
export function LunarLander({ time, id }: { time: number; id: string }) {
  // The gear is extended in lunar orbit, before undocking and powered descent.
  const deploy = smooth(progress(time, 3.52, 3.74));
  const thrust = smooth(progress(time, 4.18, 4.42)) * (1 - smooth(progress(time, 5.71, 5.85)));
  const legY = mix(60, 116, deploy);
  const padX = mix(80, 118, deploy);
  const foil = 'M-69-9-30-17 42-12 73 6 67 45 19 59-65 43-80 16Z';
  return <g strokeLinejoin="round" strokeLinecap="round">
    <defs>
      <clipPath id={`${id}-foil-clip`}><path d={foil} /></clipPath>
      <linearGradient id={`${id}-foil-base`} x2=".4" y2="1"><stop stopColor="#e9c477" /><stop offset=".24" stopColor="#ab7228" /><stop offset=".55" stopColor="#e3b664" /><stop offset="1" stopColor="#654119" /></linearGradient>
      <linearGradient id={`${id}-strut`}><stop stopColor="#715129" /><stop offset=".35" stopColor="#ffe6a0" /><stop offset=".6" stopColor="#bb8d40" /><stop offset="1" stopColor="#655c50" /></linearGradient>
    </defs>
    <g stroke="#92908a" strokeWidth="2" fill="none">
      <path d={`M-27 9 13 ${legY - 20} 42 17M13 ${legY - 20}l7 5`} /><ellipse cx="16" cy={legY - 16} rx="12" ry="3" fill="#756e5f" />
    </g>
    <g opacity={thrust * .65}>
      <path d={`M-8 51Q-17 90 0 ${106 + Math.sin(time * 39) * 5}Q19 85 10 51Z`} fill={`url(#${id}-landing-flame)`} /><path d="M-3 51 0 89 4 51" fill="#fff0ce" opacity=".35" />
    </g>
    <path d="M-13 37H16L22 57Q0 65-20 57Z" fill="#333338" stroke="#919495" strokeWidth="1.3" /><path d="M-16 52Q1 59 19 52" fill="none" stroke="#c1b9a4" strokeWidth="1" />
    <path d={foil} fill={`url(#${id}-foil-base)`} stroke="#68543a" strokeWidth="1.5" />
    <g clipPath={`url(#${id}-foil-clip)`}>
      {Array.from({ length: 96 }, (_, i) => {
        const x = (i * 41) % 159 - 80;
        const y = (i * 29) % 82 - 19;
        const w = 4 + i % 7 * 2;
        return <path key={i} d={`M${x} ${y}l${w} ${2 + i % 4} ${-w + 3} ${5 + i % 9}Z`} fill={['#f9dda0', '#825011', '#d7a554', '#fbe3af', '#583b1d', '#be8c3d'][i % 6]} opacity={.3 + i % 4 * .15} />;
      })}
      <path d="M-57-1-20 3-23 39-59 33ZM-8-4 42-6 39 44-8 41Z" fill="#25262a" stroke="#b69a62" strokeWidth="1.3" />
      <path d="M-51 2-28 6-30 32-54 28ZM-3 0 34-1 32 36-3 32Z" fill="#37383d" />
      <path d="M42-5 65 7 60 35 44 42Z" fill="#8b602d" /><path d="M47 3 57 9 50 27 60 21M-73 17-59 11-65 29M-17-8-14 17-20 28-12 47M24 50l25-7" stroke="#fff0c2" strokeWidth="1" fill="none" opacity=".9" />
      <path d="M-61 38-8 45 14 58" fill="none" stroke="#e7cb8d" strokeWidth="1" />
    </g>
    {/* Far-side equipment and black thermal blankets break the cabin's symmetry. */}
    <path d="M28-100 49-88 61-61 65-34 39-9 11-17Z" fill="#151920" stroke="#7f8388" strokeWidth="1.2" />
    <path d="M-42-83-20-102 10-102 34-85 36-46 18-20-37-17-54-39Z" fill="#a4a6a4" stroke="#bebeb5" strokeWidth="1.2" />
    <path d="M-42-83-20-102-7-79-28-54-54-39Z" fill="#7b8282" /><path d="M-20-102 10-102 34-85-7-79Z" fill="#dfe0d6" /><path d="M-7-79 34-85 36-46 16-24-8-40Z" fill="#c8c9c1" /><path d="M-28-54-7-79-8-40-37-17Z" fill="#939995" />
    <path d="M-44-41-27-54-8-45 16-44 36-46 18-20-37-17Z" fill="#262a2d" stroke="#919591" strokeWidth=".6" />
    <path d="M-18-102-18-109 12-110 23-99" fill="#aeb3ae" stroke="#e8e6d9" strokeWidth=".8" />
    <path d="M-6-106V-111H6V-106" fill="#adb3ac" stroke="#e7e5d8" strokeWidth="1" />
    <path d="M-65-65-48-72-29-54-37-33-63-28-76-44Z" fill="#686e73" stroke="#b5b8b6" strokeWidth="1.3" /><path d="M-65-65-48-72-53-47-76-44ZM-53-47-37-33-63-28Z" fill="#929695" /><path d="M-53-47-29-54M-65-65-53-47-63-28" stroke="#c1c4bd" strokeWidth=".9" fill="none" />
    <path d="M-30-74-8-78-29-58ZM7-78 28-70 29-54Z" fill="#0b141a" stroke="#e1dfd1" strokeWidth="1.4" />
    <path d="M-27-72-12-75M12-74 26-69" stroke="#78929a" strokeWidth=".8" fill="none" />
    <path d="M-32-80-9-85M5-85 31-77M-39-49-32-52M29-46l7-3" stroke="#656f73" strokeWidth="1.2" fill="none" />
    <path d="M-27-39-5-42 3-20-22-15Z" fill="#deddd0" stroke="#6f7577" strokeWidth="1.2" /><path d="M-22-35-9-37-3-23-19-20Z" fill="#747c7e" stroke="#ede9d6" strokeWidth=".6" />
    <path d="M-42-83-7-79 34-85M-7-79-8-40-37-17M36-46 16-24-8-40" stroke="#e7e4d7" strokeWidth=".75" fill="none" />
    <g fill="#e4e3d8">{[[-39,-80],[-20,-99],[9,-99],[30,-84],[-9,-76],[-27,-51],[-36,-20],[16,-27]].map(([x,y]) => <circle key={`${x}:${y}`} cx={x} cy={y} r=".9" />)}</g>
    <g fill="none" stroke="#cbc6b5" strokeWidth="1.2"><path d="M-26-102-38-124M2-102V-129M-9-127H14M43-86 61-113M31-101 35-117" /><path d="M-51-124Q-35-106-23-127Q-38-133-51-124Z" fill="#c4c7c0" /><path d="M-37-118-33-137" /><path d="M48-118Q62-112 66-103L72-118Z" fill="#9da6a9" /></g>
    <g fill="#9a9f9e" stroke="#dcd8c8" strokeWidth=".7"><path d="M-56-79h-8v5h8Zm112 18h8v5h-8Z" /><path d="M-61-80l-3-5-4 4 5 3M61-63l5-6 4 4-6 4" /></g>
    {/* Wide telescoping struts and triangulated braces carry the descent stage. */}
    {[-1, 1].map(side => <g key={side}>
      <path d={`M${side * 61} 2 ${side * padX} ${legY}M${side * 37} 37 ${side * (padX - 4)} ${legY - 6}`} fill="none" stroke="#71634b" strokeWidth="5" />
      <path d={`M${side * 61} 2 ${side * padX} ${legY}`} fill="none" stroke={`url(#${id}-strut)`} strokeWidth="4.2" />
      <path d={`M${side * 62} 5 ${side * (padX - 3)} ${legY - 5}`} fill="none" stroke="#ebe1bd" strokeWidth="2" strokeDasharray="3 10 6 8" />
      <path d={`M${side * 45} 24 ${side * (padX - 13)} ${legY - 24} ${side * 74} 27`} fill="none" stroke="#b5b1a0" strokeWidth="1.6" />
      <path d={`M${side * 37} 37 ${side * (padX - 4)} ${legY - 6}`} fill="none" stroke="#bba977" strokeWidth="2" />
      <ellipse cx={side * padX} cy={legY} rx="19" ry="4.7" fill="#74654c" stroke="#ded0a5" strokeWidth="1.4" /><ellipse cx={side * padX} cy={legY - 1} rx="10" ry="2" fill="#ab9971" />
      <path d={`M${side * padX} ${legY - 7}l${side * 1.5} 8 ${side * mix(0, 17, smooth(progress(time, 5.68, 5.85)))} ${mix(17, -1, smooth(progress(time, 5.68, 5.85)))}`} fill="none" stroke="#aaa594" strokeWidth="1" />
    </g>)}
    <g fill="none" stroke="#c9b987" strokeWidth="2"><path d="M-23 10-22 122M-1 13-2 122M-57 39-22 120M32 46-2 120" /></g>
    <path d="M-25 5H0L-1 43H-25Z" fill="#6a695e" stroke="#ddd1b2" strokeWidth="1" />
    <path d="M-25 45-25 119M-1 45-1 119" fill="none" stroke="#e1dbc3" strokeWidth="2.1" />
    {Array.from({length:8},(_, i)=><path key={i} d={`M-25 ${49+i*9}h24`} stroke="#cfcbb7" strokeWidth="1.6" />)}
    <ellipse cx="-12" cy="123" rx="20" ry="4.5" fill="#877954" stroke="#e1cda0" strokeWidth="1.5" />
    <path d="M-22-35-9-37-3-23-19-20Z" fill="#111820" opacity={smooth(progress(time, 5.9, 6.12))} />
  </g>;
}

export function Astronaut({ time, id }: { time: number; id: string }) {
  const climb = smooth(progress(time, 6.04, 6.43));
  const step = smooth(progress(time, 6.43, 6.88));
  const hop = Math.sin(step * Math.PI);
  const climbStride = Math.sin(climb * Math.PI * 4) * (1 - step) * Math.sin(climb * Math.PI);
  const nearKneeY = 19 - Math.max(0, climbStride) * 8 - hop * 6;
  const farKneeY = 18 + Math.min(0, climbStride) * 8 - hop * 3;
  const nearFootY = 30 - Math.max(0, climbStride) * 11;
  const farFootY = 29 + Math.min(0, climbStride) * 11;
  const wave = Math.sin(progress(time, 6.95, 8) * Math.PI * 3) * 10;
  const liftArm = smooth(progress(time, 6.69, 6.98));
  const facingViewer = smooth(progress(step, .08, .72));
  return <g transform={`translate(${mix(788, 875, step)} ${mix(516, 591, climb) + step * 5 - hop * 17}) rotate(${-hop * 5})`} opacity={smooth(progress(time, 6, 6.15))} stroke="#9b9d98" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M-18-33-5-35 4-22 3 5-16 5Z" fill="#bcc0bb" /><path d="M-18-33-21-25-20 3-16 5V-26Z" fill="#7e8587" /><path d="M-16-27H-7M-16-20H-8" stroke="#e9e7d9" />
    <path d="M-9-30Q2-34 12-25L13-2 8 7H-10L-15-6Z" fill="#e8e8da" />
    <path d={`M-8 3-10 ${nearKneeY}-7 ${nearFootY}H-18M7 3 12 ${farKneeY} 12 ${farFootY}H23`} stroke="#e8e8dc" strokeWidth="9" fill="none" />
    <path d={`M-16 ${nearFootY-1}h11l1 4h-14Zm25 ${farFootY-nearFootY}h14l3 4H9Z`} fill="#a7aaa6" />
    <path d={`M-13 ${nearKneeY-3}h7m-8 4h7m-6 4h6M8 ${farKneeY-3}l8-1m-8 5 9-1m-8 5h8`} stroke="#a8ada8" strokeWidth="1" />
    <path d={`M-12-25-23-13-16 ${mix(-27,-4,step)}`} stroke="#e8e8dc" strokeWidth="7" fill="none" />
    <path d="M10-24 22-20" stroke="#eaeade" strokeWidth="7" fill="none" />
    <g transform={`rotate(${mix(-45, mix(104, 0, liftArm), step) + wave * liftArm} 22 -20)`}><path d="M22-20 29-34 31-43" stroke="#f1eddd" strokeWidth="6" fill="none" /><path d="M29-42v-5m3 5 1-5m-5 7-3-2" stroke="#e3ded0" strokeWidth="2" /></g>
    <path d="M-23-15l4 3m-5 1 4 3m37-6 2 4" stroke="#9ca7a5" fill="none" />
    <path d="M-7-11Q-16 0 3 3L10-11" fill="none" stroke="#797e74" strokeWidth="2" /><rect x="-5" y="-23" width="12" height="12" rx="2" fill="#d1d5cd" stroke="#8e9998" /><path d="M-2-18h7m-7 3h5" stroke="#78939c" strokeWidth="1" /><circle cx="5" cy="-18" r="1" fill="#b46950" />
    <g opacity={1 - facingViewer}><path d="M-13-32H12L16-26V4L10 9H-14L-17 3V-26Z" fill="#d6dacf" stroke="#979f9b" /><path d="M-13-32V3H12V-32M-9-25h15M-9-21h15M-8-6H7M-8-2H7" stroke="#f2f0e3" fill="none" /><path d="M12-28l4 2V4l-4 4Z" fill="#a5aeaa" /><path d="M-13 3h25" stroke="#7a8786" /></g>
    <path d="M-10-40Q-11-55 2-56Q18-55 17-40L12-29H-5Z" fill="#ebeade" /><g opacity={facingViewer}><path d="M-5-49Q5-54 13-47L12-36Q4-30-6-37Z" fill={`url(#${id}-visor)`} stroke="#817a65" strokeWidth="1.4" /><path d="M-2-47q5-3 10-1" fill="none" stroke="#ffebad" strokeWidth="1.3" /></g><path d="M-5-49q8-5 16 0M-7-36q10 5 19 0" fill="none" stroke="#bac2b7" strokeWidth="1" opacity={1 - facingViewer} />
    <path d="M-6-32q9 5 18 0" fill="none" stroke="#a6aeaa" strokeWidth="2" />
    <path d="M12-23h4v7h-4" fill="#9f6253" stroke="none" />
  </g>;
}
