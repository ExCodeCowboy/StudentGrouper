import { useId } from 'react';
import { catRig, catSkinPoint, fadeWindow, type CatPose, type Point } from './sceneMotion';
import { trimContourLoops } from './contourGeometry';

type RigLeg = ReturnType<typeof catRig>['legs'][number];

const between = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const pair = (p: Point) => `${p.x} ${p.y}`;
const pawPoint = (foot: Point, angle: number, x: number, y: number): Point => {
  const radians = angle * Math.PI / 180;
  return { x: foot.x + x * Math.cos(radians) - y * Math.sin(radians), y: foot.y + x * Math.sin(radians) + y * Math.cos(radians) };
};

/** Rounded skin around the bones, with muscle proximally and a slender distal leg. */
function legOutline({ hip, knee, ankle, foot, hind, toeAngle }: RigLeg) {
  const centers = [hip, between(hip, knee, .5), knee, between(knee, ankle, .3), between(knee, ankle, .72), ankle, pawPoint(foot, toeAngle, 0, -7)];
  const radii = hind ? [21, 19, 13.5, 11.5, 7.5, 5.5, 5.5] : [19, 17, 12, 10.5, 7.5, 5.5, 5.5];
  // A tightly folded elbow can make its inside offsets cross. Trim the skin
  // contour at that join before rounding it; the underlying bones stay fixed.
  const sides = [-1, 1].map(side => trimContourLoops(centers.map((p, i) => {
    const previous = centers[Math.max(0, i - 1)];
    const next = centers[Math.min(centers.length - 1, i + 1)];
    const length = Math.max(1, Math.hypot(next.x - previous.x, next.y - previous.y));
    return { x: p.x + side * (next.y - previous.y) / length * radii[i], y: p.y - side * (next.x - previous.x) / length * radii[i] };
  })));
  const outline = [...sides[0],
    ...[[-7,-2],[-3,0],[6,0],[13,-1],[13,-6],[7,-8]].map(([x,y]) => pawPoint(foot, toeAngle, x, y)),
    ...sides[1].reverse()];
  let path = `M${pair(between(outline.at(-1)!, outline[0], .5))}`;
  outline.forEach((p, i) => { path += `Q${pair(p)} ${pair(between(p, outline[(i + 1) % outline.length], .5))}`; });
  return `${path}Z`;
}

function TabbyLeg({ leg, coat, fur }: { leg: RigLeg; coat: string; fur: string }) {
  const id = useId();
  const { knee, ankle, foot, hind, far, toeAngle } = leg;
  const outline = legOutline(leg);
  const lower = { x: ankle.x - knee.x, y: ankle.y - knee.y };
  const length = Math.hypot(lower.x, lower.y);
  const normal = { x: lower.y / length, y: -lower.x / length };
  return <g strokeLinecap="round" strokeLinejoin="round">
    <defs><clipPath id={`${id}-leg`}><path d={outline} /></clipPath></defs>
    <path d={outline} fill={far ? '#99886e' : coat} stroke={far ? '#756650' : '#847052'} strokeWidth=".9" />
    <g clipPath={`url(#${id}-leg)`}>
      {[.18, .4, .64].map((t, i) => {
        const p = between(knee, ankle, t);
        const width = (hind ? 13 : 11) * (1 - t * .5);
        return <path key={t} d={`M${p.x - normal.x * width} ${p.y - normal.y * width}Q${p.x - lower.x * .04} ${p.y - lower.y * .04} ${p.x + normal.x * width} ${p.y + normal.y * width}`} fill="none" stroke={far ? '#695b49' : '#705b42'} strokeWidth={3.5 - i * .6} opacity=".7" />;
      })}
      <path d={outline} fill={fur} opacity={far ? .45 : 1} />
      <g transform={`rotate(${toeAngle} ${foot.x} ${foot.y})`}>
        <path d={`M${foot.x - 6} ${foot.y - 6}Q${foot.x + 3} ${foot.y - 9} ${foot.x + 14} ${foot.y - 5}V${foot.y + 1}H${foot.x - 7}Z`} fill={far ? '#bcae91' : '#e4d6b7'} />
        <path d={`M${foot.x + 5} ${foot.y - 4}v3m4-3v2`} stroke="#9e8c6d" strokeWidth=".65" />
      </g>
      {!far && <path d={`M${ankle.x - 2} ${ankle.y - 13}l1 4m-2 3 1 4m-2 3 1 3`} stroke="#e5d4b0" strokeWidth=".7" opacity=".65" />}
    </g>
  </g>;
}

/** Profile proportions, tucked elbows, digitigrade hind legs, and short fur. */
export function WalkingTabby({ time, distance, strideOffset = 0, pose }: { time: number; distance: number; strideOffset?: number; pose?: CatPose }) {
  const id = useId();
  const { bob, legs, torso, neckBase, neckAngle, headAngle, tailBase, tailAngle, tailCurl, nearEar, farEar, acting } = pose ?? catRig(time, distance, strideOffset);
  // The torso illustration is narrower than the original sketch; bones stay
  // in their unscaled coordinate system, preserving their physical lengths.
  const inCoat = (point: Point) => ({ x: 140 + (point.x - 140) / .8, y: point.y - bob });
  const skin = (x: number, y: number) => {
    const p = inCoat(catSkinPoint({ x: 140 + (x - 140) * .8, y }, torso));
    return `${p.x} ${p.y}`;
  };
  const haunch = inCoat(legs[2].hip);
  const knee = inCoat(legs[2].knee);
  const thigh = between(haunch, knee, .35);
  const thighAngle = Math.atan2(knee.y - haunch.y, knee.x - haunch.x) * 180 / Math.PI - 90;
  const thighLength = Math.hypot(knee.x - haunch.x, knee.y - haunch.y);
  const thighNormal = { x: (knee.y - haunch.y) / thighLength, y: -(knee.x - haunch.x) / thighLength };
  const thighEdge = (t: number, radius: number) => {
    const point = between(haunch, knee, t);
    return { x: point.x + thighNormal.x * radius, y: point.y + thighNormal.y * radius };
  };
  const thighStart = thighEdge(.25, 16);
  const thighMiddle = thighEdge(.6, 19);
  const thighEnd = thighEdge(1, 13.5);
  const shoulder = inCoat(legs[3].hip);
  const elbow = inCoat(legs[3].knee);
  const foreleg = legs[3];
  const foreBlendStart = between(foreleg.hip, foreleg.knee, .35);
  const shoulderGlide = shoulder.x - 375;
  const scapula = { x: shoulder.x - 25 + shoulderGlide * .3, y: shoulder.y - 27 };
  const neck = inCoat(neckBase);
  const curious = acting.attention;
  const blink = fadeWindow(time, 3.42, 3.47, 3.5, 3.56);
  const tail = tailCurl;
  const coat = `url(#${id}-coat)`;
  const fur = `url(#${id}-fur)`;
  // The croup narrows diagonally into the thigh instead of forming a round rump.
  const body = `M${skin(148,154)}C${skin(155,139)} ${skin(180,136)} ${skin(211,140)}C${skin(255,148)} ${skin(305 + shoulderGlide*.3,134)} ${skin(337 + shoulderGlide*.4,141)}Q${skin(365,151)} ${skin(385,148)}L${skin(404,156)} ${skin(412,180)}Q${skin(413,202)} ${skin(392,213)}C${skin(367,223)} ${skin(343,222)} ${skin(322,216)}Q${skin(282,212)} ${skin(248,205)}Q${skin(232,200)} ${skin(222,203)}C${skin(208,208)} ${skin(184,204)} ${skin(164,191)}C${skin(154,183)} ${skin(146,171)} ${skin(148,154)}Z`;
  const neckShape = 'M364 152C385 155 404 149 422 139L440 150 444 179Q441 188 435 185Q426 181 417 193C410 204 406 212 392 215Q377 217 367 209Z';
  const head = 'M423 151Q422 141 429 137Q438 132 447 137Q458 132 467 140Q475 146 477 155Q480 162 478 165L486 169Q492 172 491 176Q489 180 483 181L482 185Q468 195 449 187Q430 186 425 175Z';
  const tailShape = `M158 151C116 137 86 ${116 + tail} 74 ${89 + tail}C61 ${59 + tail} 64 ${42 + tail} 75 ${44 + tail}C79 ${44 + tail} 80 ${49 + tail} 84 ${50 + tail}C91 ${53 + tail} 93 ${45 + tail} 87 ${41 + tail}C63 ${21 + tail} 47 ${49 + tail} 58 ${86 + tail}C69 ${122 + tail} 105 155 154 167Z`;
  return <svg viewBox="0 0 470 310" className="cat-tabby" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-coat`} gradientUnits="userSpaceOnUse" x1="0" y1="132" x2="30" y2="242"><stop stopColor="#c9b293" /><stop offset=".28" stopColor="#b99f7d" /><stop offset=".7" stopColor="#9a8265" /><stop offset="1" stopColor="#dcc9a6" /></linearGradient>
      <linearGradient id={`${id}-face`} x1=".3" y1="0" x2=".65" y2="1"><stop stopColor="#b49a75" /><stop offset=".55" stopColor="#ceb68e" /><stop offset="1" stopColor="#e0d1b1" /></linearGradient>
      <radialGradient id={`${id}-haunch`} cx=".35" cy=".3"><stop stopColor="#ddc5a0" stopOpacity=".3" /><stop offset="1" stopColor="#8d795e" stopOpacity="0" /></radialGradient>
      <linearGradient id={`${id}-thigh-edge`} gradientUnits="userSpaceOnUse" x1={thighStart.x} y1={thighStart.y} x2={thighEnd.x} y2={thighEnd.y}>
        <stop stopColor="#715c42" stopOpacity="0" /><stop offset=".25" stopColor="#715c42" stopOpacity=".75" /><stop offset=".8" stopColor="#715c42" stopOpacity=".65" /><stop offset="1" stopColor="#715c42" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-belly`} x2="0" y2="1"><stop stopColor="#e9dbbd" stopOpacity="0" /><stop offset="1" stopColor="#eddfc2" stopOpacity=".75" /></linearGradient>
      <pattern id={`${id}-fur`} width="11" height="9" patternUnits="userSpaceOnUse"><path d="m1 2 2 1m4 0 2 1M3 7l3 1" stroke="#f3e1bd" strokeWidth=".6" opacity=".2" /><path d="m5 1 2 1M0 6l2 1m5-2 2 1" stroke="#5d5142" strokeWidth=".5" opacity=".13" /></pattern>
      <clipPath id={`${id}-body-clip`}><path d={body} /></clipPath>
      <linearGradient id={`${id}-foreleg-blend`} gradientUnits="userSpaceOnUse" x1={foreBlendStart.x} y1={foreBlendStart.y} x2={foreleg.knee.x} y2={foreleg.knee.y}>
        <stop stopColor="black" /><stop offset=".18" stopColor="black" /><stop offset=".85" stopColor="white" />
      </linearGradient>
      <mask id={`${id}-near-foreleg`} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="340">
        {/* Blend the shoulder into its coat, but keep a folded forearm in front
            of the chest even when its wrist rises above the belly line. */}
        <path d={legOutline(foreleg)} fill={`url(#${id}-foreleg-blend)`} stroke={`url(#${id}-foreleg-blend)`} strokeWidth="3" />
        <path d={`M${pair(foreleg.knee)}L${pair(foreleg.ankle)} ${pair(foreleg.foot)}`} fill="none" stroke="white" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" />
      </mask>
      <mask id={`${id}-body-edge`} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="310">
        <rect width="600" height="310" fill="white" />
        {/* Do not draw a torso seam through the legs emerging from its coat. */}
        <g transform={`translate(140 ${-bob}) scale(1.25 1) translate(-140 0)`}>
          {legs.map(leg => <path key={leg.key} d={legOutline(leg)} fill="black" stroke="black" strokeWidth="3" />)}
        </g>
      </mask>
      <clipPath id={`${id}-head-clip`}><path d={head} /></clipPath>
      <clipPath id={`${id}-tail-clip`}><path d={tailShape} /></clipPath>
      <radialGradient id={`${id}-shadow`}><stop stopColor="#514d3d" stopOpacity=".23" /><stop offset="1" stopColor="#514d3d" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="260" cy="280" rx="145" ry="9" fill={`url(#${id}-shadow)`} />
    {legs.filter(leg => leg.far).map(leg => <TabbyLeg key={leg.key} leg={leg} coat={coat} fur={fur} />)}
    <g transform={`translate(${tailBase.x - 155} ${tailBase.y - 160}) rotate(${torso[0].angle + tailAngle} 155 160) translate(155 160) scale(1 .86) translate(-155 -160)`}>
      <path d={tailShape} fill={coat} stroke="#7a6953" strokeWidth="1.2" />
      <g clipPath={`url(#${id}-tail-clip)`} fill="none" stroke="#534a3e" strokeWidth="6" opacity=".8">{[[136,151,-65],[117,143,-60],[100,132,-50],[85,116,-35],[73,97,-20],[64,78,-10],[62,61,0],[66,47,25]].map(([x,y,angle],i)=><path key={i} d="M-11 0H11" transform={`translate(${x} ${y+(i>2?tail:0)}) rotate(${angle})`}/>)}<path d={`M78 ${40 + tail}Q87 ${41 + tail} 89 ${49 + tail}`} strokeWidth="9" /><path d={tailShape} stroke={`url(#${id}-fur)`} strokeWidth="16" /></g>
    </g>
    {/* The thigh blends under the flank. The near foreleg is drawn after the
        torso, so crossing the chest cannot hide its elbow or wrist. */}
    {legs.filter(leg => !leg.far && leg.hind).map(leg => <TabbyLeg key={leg.key} leg={leg} coat={coat} fur={fur} />)}
    <g transform={`translate(140 ${bob}) scale(.8 1) translate(-140 0)`}>
      <path d={body} fill={coat} />
      <path d={body} fill="none" stroke="#807056" strokeWidth="1.3" mask={`url(#${id}-body-edge)`} />
      <g clipPath={`url(#${id}-body-clip)`}>
        <path d={`M${skin(145,192)}Q${skin(262,200)} ${skin(425,186)}L${skin(425,233)} ${skin(145,233)}Z`} fill={`url(#${id}-belly)`} />
        <g fill="#5c4f3f" opacity=".65">
          {[184,207,233,262,290,317,345,371].map((x,i) => <path key={x} d={`M${skin(x,131+i*1.5)}Q${skin(x-21,156)} ${skin(x+2,182+i%4*7)}Q${skin(x-21,178)} ${skin(x-19,162)}Q${skin(x-17,146)} ${skin(x-12,132+i*1.5)}Z`} />)}
          {[202,262,335].map((x,i)=><path key={x} d={`M${skin(x,199+i*3)}Q${skin(x+16,191+i*3)} ${skin(x+27,207+i*3)}Q${skin(x+14,201+i*3)} ${skin(x,206+i*3)}Z`} />)}
        </g>
        <path d={body} fill={`url(#${id}-fur)`} />
        <path d={`M${skin(159,144)}Q${skin(180,134)} ${skin(204,143)}M${skin(250,143)}Q${skin(287,135)} ${skin(318,144)}`} stroke="#e8d6b3" strokeWidth="1.5" fill="none" opacity=".7" />
        {/* Moving muscle masses carry their own coat markings over the torso. */}
        <g>
          <path d={`M${haunch.x - 17} ${haunch.y - 7}C${haunch.x + 2} ${haunch.y - 12} ${haunch.x + 20} ${haunch.y + 3} ${knee.x + 12} ${knee.y - 8}L${knee.x + 8} ${knee.y + 11}Q${knee.x - 13} ${knee.y + 10} ${haunch.x - 16} ${haunch.y + 28}Q${haunch.x - 25} ${haunch.y + 6} ${haunch.x - 17} ${haunch.y - 7}Z`} fill={coat} />
          <ellipse cx={thigh.x} cy={thigh.y} rx="22" ry="32" transform={`rotate(${thighAngle} ${thigh.x} ${thigh.y})`} fill={`url(#${id}-haunch)`} />
          <path d={`M${haunch.x - 16} ${haunch.y + 3}q12 2 20 13m-27-2q8 5 13 15M${haunch.x + 10} ${haunch.y + 25}Q${knee.x + 4} ${knee.y - 3} ${knee.x + 2} ${knee.y + 7}`} fill="none" stroke="#655440" strokeWidth="3.8" opacity=".57" />
          {/* A short leading edge describes the near thigh overlapping the flank. */}
          <path d={`M${pair(thighStart)}Q${pair(thighMiddle)} ${pair(thighEnd)}`} fill="none" stroke={`url(#${id}-thigh-edge)`} strokeWidth="1.8" strokeLinecap="round" />
          <path d={`M${scapula.x - 10} ${scapula.y + 7}Q${scapula.x + 22} ${scapula.y - 5} ${shoulder.x + 16} ${shoulder.y + 9}L${elbow.x + 8} ${elbow.y + 8}Q${elbow.x - 11} ${elbow.y + 14} ${shoulder.x - 20} ${shoulder.y + 3}Z`} fill={coat} />
          <path d={`M${scapula.x + 5} ${scapula.y + 8}Q${shoulder.x + 15} ${shoulder.y - 5} ${elbow.x + 5} ${elbow.y + 8}`} fill="none" stroke="#786249" strokeWidth="2.5" opacity=".4" />
          <path d={`M${scapula.x - 10} ${scapula.y + 16}q15 6 24 20m-28-9q14 7 18 18`} fill="none" stroke="#66543e" strokeWidth="3.5" opacity=".4" />
          <path d={body} fill={`url(#${id}-fur)`} />
        </g>
      </g>
      <g transform={`translate(${neck.x-385} ${neck.y-180}) rotate(${neckAngle} 385 180)`}>
        <path d={neckShape} fill={coat} />
        <path d="M364 152C385 155 404 149 422 139M441 188Q435 181 426 187C416 194 411 211 399 213" fill="none" stroke="#8d7859" strokeWidth=".7" opacity=".6" />
        <path d="M393 166q9 6 20 2m-25 8q10 7 20 3m-23 7q9 6 18 4" fill="none" stroke="#796348" strokeWidth="2.8" opacity=".5" />
        <path d={neckShape} fill={`url(#${id}-fur)`} />
        <g transform={`translate(-8 3) rotate(${headAngle} 442 160)`}>
        <g transform={`rotate(${farEar} 453 140)`}>
          <path d="M447 142 453 126Q454 122 457 127L464 145Z" fill="#7a6955" stroke="#6c5d4b" strokeWidth="1" />
          <path d="m454 128 6 10-9-2Z" fill="#b29b85" />
        </g>
        <path d={head} fill={`url(#${id}-face)`} />
        <path d="M423 151Q422 141 429 137Q438 132 447 137Q458 132 467 140Q475 146 477 155Q480 162 478 165L486 169Q492 172 491 176Q489 180 483 181L482 185Q468 195 449 187" fill="none" stroke="#76634c" strokeWidth="1.1" />
        <g transform={`rotate(${nearEar} 434 144)`}>
          <path d="M423 145 427 124Q428 117 433 123L448 139 442 148Z" fill={`url(#${id}-face)`} />
          <path d="M423 145 427 124Q428 117 433 123L448 139" fill="none" stroke="#76634c" strokeWidth="1.1" />
          <path d="M427 138 431 126 442 139Z" fill="#a58174" /><path d="m431 129 3 7 6 2" stroke="#d0bca2" strokeWidth="1.2" fill="none" />
        </g>
        <g clipPath={`url(#${id}-head-clip)`}>
          <g fill="#5c4b3b" opacity=".8"><path d="m445 136 9 15-2-16ZM457 137l8 13-2-11ZM428 154q11 13 32 17-22-2-34-9ZM417 169q17 13 38 12-22 8-37-3Z" /></g>
          <path d="M467 168Q477 165 489 170L496 179 481 190Q469 192 462 182Z" fill="#ede2c9" />
          <path d={head} fill={`url(#${id}-fur)`} />
        </g>
        <g transform={`translate(0 ${156 * blink * .88}) scale(1 ${1 - blink * .88})`}>
          <path d={`M461 157Q468 ${148 - curious * 2} 476 155Q470 ${163 + curious} 461 157Z`} fill="#56492f" />
          <path d={`M463 156Q469 ${150 - curious * 2} 474 156Q469 ${161 + curious} 463 156Z`} fill="#c9b557" />
          <ellipse cx={470 + curious} cy={156 + curious} rx={1.2 + curious * .35} ry="3.1" fill="#273029" /><circle cx={471 + curious} cy={154.5 + curious} r="1" fill="#fff3cb" />
        </g>
        <path d={`M460 151Q468 ${145 - curious * 2} 474 151`} fill="none" stroke="#65523a" strokeWidth="1.4" />
        <path d="m488 169 5 3-3 4-3-2Z" fill="#74524c" />
        <path d="M490 176q-4 5-12 4m5 7 5-4" fill="none" stroke="#75604d" strokeWidth="1" />
        <g fill="#9e8c73"><circle cx="477" cy="175" r=".8" /><circle cx="481" cy="178" r=".8" /><circle cx="475" cy="180" r=".8" /></g>
        <path d="M478 177q21-10 38-7m-38 9 42 2m-42 1q20 7 37 7M460 144l7-9m-9 8 2-9" fill="none" stroke="#eee4cd" strokeWidth=".75" opacity=".9" />
        <path d="m444 185-4 2m9-1-3 2" stroke="#8d775c" strokeWidth=".8" />
        </g>
      </g>
    </g>
    <g mask={`url(#${id}-near-foreleg)`}>
      <TabbyLeg leg={foreleg} coat={coat} fur={fur} />
    </g>
  </svg>;
}
