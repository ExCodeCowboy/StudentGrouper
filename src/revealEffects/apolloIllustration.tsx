import { memo } from 'react';
import { mix } from './sceneMotion';
import { INK, WHITE, ellipseD, r1, r2, starD } from './moonArt';
import { MOON_BOULDERS, MOON_FLAG_H, MOON_FLAG_SCALE, MOON_FLAG_SPOT, MOON_FLAG_W, MOON_HORIZON, flagStars, forearmAngle, moonAstronaut, moonFlag, moonHorizonY, moonLegs, type Vec } from './moonTimeline';
import { attr, shown, useFrame, useNodes } from './moonFrame';

/*
 * Apollo lunar art in the storybook style: the Columbia command ship, a gold
 * 3/4-view Eagle (angular cabin, off-center hatch: no "face"), the astronaut,
 * the U.S. flag (13 stripes, 50 stars, 10:19) and the lunar ground. Static
 * pieces are memoized; the scene moves them with transforms.
 */

// ---------------------------------------------------------------- Columbia (CSM)
export const CsmArt = memo(function CsmArt() {
  // Local: CM apex (docking probe) at 0, body toward +y.
  return <g strokeLinejoin="round" strokeLinecap="round">
    <path d="M-14 132 14 132 22 164 Q0 170-22 164Z" fill="#474c70" stroke={INK} strokeWidth="3" />
    <path d="M-30 36H30V132H-30Z" fill="#dfe4ee" stroke={INK} strokeWidth="3.5" />
    <path d="M-30 36H-12V132H-30Z" fill="#3a3f95" opacity=".14" />
    <path d="M8 38V130M18 38V130" stroke="#b7c0d6" strokeWidth="3" />
    <path d="M-30 60H30M-30 112H30" stroke={INK} strokeWidth="2" opacity=".4" />
    {[-1, 1].map((s) => <g key={s}><path d={`M${s * 30} 66h${s * 8}v14h${-s * 8}Z`} fill="#8d93a6" stroke={INK} strokeWidth="2" /><path d={`M${s * 38} 73h${s * 6}M${s * 34} 66v-6M${s * 34} 80v6`} stroke={INK} strokeWidth="2.5" /></g>)}
    <path d="M30 120 52 142" stroke={INK} strokeWidth="3" /><circle cx="56" cy="146" r="7" fill="#eef1f8" stroke={INK} strokeWidth="2.5" />
    <path d="M-4 0H4L32 36H-32Z" fill="#f4f6fb" stroke={INK} strokeWidth="3.5" />
    <path d="M-4 0-32 36H-14L-1 0Z" fill="#3a3f95" opacity=".14" />
    <path d="M-12 22h7v7h-7ZM6 22h7v7H6Z" fill="#1d2246" />
    <path d="M-2-10H2V0H-2Z" fill="#8d93a6" stroke={INK} strokeWidth="2" />
  </g>;
});

// ---------------------------------------------------------------- Lunar Module (local: ground under the center at y 0)
const DS_TOP = [[-97, -160], [-72, -152], [-4, -148], [66, -151], [97, -159]] as const;
const DS_BOT = [[-97, -96], [-72, -88], [-4, -84], [66, -87], [97, -95]] as const;
const dsFace = (i: number) => `M${DS_TOP[i][0]} ${DS_TOP[i][1]}L${DS_TOP[i + 1][0]} ${DS_TOP[i + 1][1]}L${DS_BOT[i + 1][0]} ${DS_BOT[i + 1][1]}L${DS_BOT[i][0]} ${DS_BOT[i][1]}Z`;
export const LM_HATCH = 'M-58-208-28-210-28-178-56-176Z';
/** Long low-sun shadow of the LM, projected to the left: (x, h) → (x − 1.35h, .1h). */
export const LM_SHADOW = 'M-176 0L-210 8-313 16-366 20-401 24-404 26-375 27-322 27-257 25-186 21-119 16-16 8 176 4 150-4Z';
const LM_CABIN = 'M-86-164-96-200-82-236-50-262-8-270 40-268 80-250 100-212 92-164Z';
export const LanderBodyArt = memo(function LanderBodyArt() {
  return <g strokeLinejoin="round" strokeLinecap="round">
    {/* descent engine */}
    <path d="M-16-92H18L28-60Q2-54-26-60Z" fill="#595e7e" stroke={INK} strokeWidth="3" />
    <path d="M7-90H14L22-62 13-60Z" fill="#9097c2" opacity=".7" />
    {/* descent stage: gold-foil octagon, faces stepping dark to bright toward the sun */}
    <path d={dsFace(0)} fill="#b8701a" />
    <path d={dsFace(1)} fill="#df962a" />
    <path d={dsFace(2)} fill="#f6b940" />
    <path d={dsFace(3)} fill="#ffd466" />
    <path d="M-62-151-20-149-20-86-62-88Z" fill="#3b3550" />
    <path d="M-58-140-24-138M-58-118-24-116M-58-98-24-96" stroke="#5f5a80" strokeWidth="2.5" />
    <path d="M4-146 30-148 26-124 6-120ZM38-140 60-142 62-116 40-112ZM14-110 40-108 34-92 12-92ZM70-150 92-156 94-130 72-124ZM72-116 94-122 92-100 74-96ZM-94-150-78-146-80-118-94-122Z" fill="#ffe08a" opacity=".75" />
    <path d="M20-140 36-136 30-116ZM46-104 60-106 58-92ZM-90-110-78-106-80-96Z" fill="#b8701a" opacity=".6" />
    <path d="M2-134Q20-126 40-136M44-126Q58-118 64-128M72-140Q84-132 94-140M8-104Q24-98 46-104" fill="none" stroke="#fff3c4" strokeWidth="2" opacity=".85" />
    <path d={`M${DS_TOP.map(([x, y]) => `${x} ${y}`).join('L')}L${[...DS_BOT].reverse().map(([x, y]) => `${x} ${y}`).join('L')}Z`} fill="none" stroke={INK} strokeWidth="3.5" />
    <path d="M-72-152V-88M-4-148V-84M66-151V-87" stroke={INK} strokeWidth="2" opacity=".55" />
    <path d={`M${DS_TOP.map(([x, y]) => `${x} ${y - 2}`).join('L')}`} fill="none" stroke={INK} strokeWidth="9" />
    <path d={`M${DS_TOP.map(([x, y]) => `${x} ${y - 2}`).join('L')}`} fill="none" stroke="#e3e7ef" strokeWidth="4.5" />
    {/* ascent stage: aft equipment bay, then the angular 3/4 cabin */}
    <path d="M62-250 112-236 114-176 86-166 60-176Z" fill="#2d3046" stroke={INK} strokeWidth="3" />
    <path d="M100-222 112-218M100-198 112-196" stroke="#4a4e6e" strokeWidth="2.5" />
    <path d={LM_CABIN} fill="#f4f6fb" />
    <path d="M-86-164-96-200-82-236-68-232-78-200-70-164Z" fill="#9aa2b8" />
    <path d="M-70-164-78-200-68-232-40-254-6-258-4-164Z" fill="#cdd3df" />
    <path d="M-82-236-50-262-8-270-6-258-40-254-68-232Z" fill="#dfe3ea" />
    <path d="M-4-164-6-258-8-270 40-268 44-256 46-164Z" fill="#e8ebf2" />
    <path d="M40-268 80-250 76-238 44-256Z" fill="#eef1f7" />
    <path d="M-4-180H92L92-164H-4Z" fill="#3b3e57" />
    <path d="M8-180 28-186 48-180 68-186 90-180" fill="none" stroke="#d9982c" strokeWidth="5" strokeLinejoin="round" />
    <path d="M62-236 66-190M84-228 88-196" stroke="#c9cfdc" strokeWidth="2.5" />
    <circle cx="20" cy="-214" r="7" fill="#dfe3ea" stroke="#9aa2b8" strokeWidth="2" />
    <path d="M-6-258-4-180M44-256 46-182" fill="none" stroke={INK} strokeWidth="2" opacity=".45" />
    <path d="M-68-232-40-254-6-258 44-256 76-238" fill="none" stroke={INK} strokeWidth="2" opacity=".35" />
    <path d="M46-182 44-254M-8-268 40-266 78-249 98-212" fill="none" stroke="#ffffff" strokeWidth="3" opacity=".75" />
    <path d={LM_CABIN} fill="none" stroke={INK} strokeWidth="3.5" />
    {/* two triangular windows on the turned front face; the hatch sits off to the left */}
    <path d="M-64-226-44-242-46-212Z" fill="#35518f" stroke={INK} strokeWidth="2.8" />
    <path d="M-36-246-12-252-16-224Z" fill="#35518f" stroke={INK} strokeWidth="2.8" />
    <path d="M-59-226-49-234M-31-246-19-249" stroke="#b8d6ff" strokeWidth="2.4" />
    <path d={LM_HATCH} fill="#dde1ea" stroke={INK} strokeWidth="3" />
    <path d="M-53-203-32-205-32-182-51-180Z" fill="none" stroke="#98a1b8" strokeWidth="2" />
    <path d="M-38-194h5" stroke={INK} strokeWidth="3" />
    {/* docking tunnel, rendezvous radar, steerable antenna, VHF whips */}
    <path d="M-8-286H16V-270H-8Z" fill="#c9cfdc" stroke={INK} strokeWidth="3" />
    <path d="M-12-288H20" stroke={INK} strokeWidth="4" />
    <path d="M-30-262-40-282" stroke={INK} strokeWidth="3" />
    <ellipse cx="-44" cy="-288" rx="13" ry="7" fill="#eef1f8" stroke={INK} strokeWidth="2.5" transform="rotate(-22 -44 -288)" />
    <path d="M56-252 72-282" stroke={INK} strokeWidth="3" />
    <path d="M64-296Q80-302 90-284Q78-278 64-296Z" fill="#eef1f8" stroke={INK} strokeWidth="2.5" />
    <path d="M-62-248-80-286M86-232 108-262" stroke={INK} strokeWidth="2.2" />
    {/* reaction-control thruster quads */}
    <path d="M92-226h14v14H92Z" fill="#8d93a6" stroke={INK} strokeWidth="2.2" /><path d="M106-219h8M99-226v-8M99-212v8" stroke={INK} strokeWidth="3.4" />
    <path d="M-90-222h-10v14h10Z" fill="#6e7590" stroke={INK} strokeWidth="2.2" /><path d="M-100-215h-7M-95-222v-7M-95-208v7" stroke={INK} strokeWidth="3.2" />
  </g>;
});
type Leg = readonly [ax: number, ay: number, px: number, py: number, bx: number, by: number, probe: number];
const LEGS_BACK: readonly Leg[] = [[40, -150, 70, -18, 32, -100, 1], [-90, -146, -150, -8, -84, -100, 1]];
// Probes on three legs, never the ladder leg (as on the real LM).
const LEGS_FRONT: readonly Leg[] = [[90, -136, 150, 8, 86, -94, 1], [-40, -128, -54, 20, -30, -88, 0]];
/** Strut, brace and probe paths for the probe bend (0–1) and strut compression (units). */
function legPaths(legs: readonly Leg[], probe: number, c: number) {
  return legs.map(([ax, ay, px, py, bx, by, hasProbe]) => {
    const mx = mix(ax, px, .55), my = mix(ay + c, py, .55);
    const side = px < 0 ? -1 : 1;
    return {
      main: `M${ax} ${r1(ay + c)}L${px} ${py - 4}`,
      brace: `M${bx} ${r1(by + c)}L${r1(mx)} ${r1(my)}`,
      probe: hasProbe ? `M${px} ${py + 2}l${r1(side * (2 + probe * 20))} ${r1(28 - probe * 28)}` : '',
    };
  });
}
function ladderPaths(c: number) {
  let rungs = '';
  for (let i = 0; i < 9; i++) { const t = (i + .6) / 9.6; rungs += `M${r1(mix(-52, -62, t))} ${r1(mix(-96 + c, 12, t))}h22`; }
  return { rails: `M-52 ${r1(-96 + c)}-62 12M-30 ${r1(-96 + c)}-40 12`, rungs, porch: `M-68 ${r1(-100 + c)}-18 ${r1(-98 + c)}-20 ${r1(-91 + c)}-70 ${r1(-93 + c)}Z` };
}
/** One pair of LM legs (back pair behind the body, front pair with the ladder in front); bends and compresses on touchdown. */
export function LanderLegs({ front }: { front: boolean }) {
  const legs = front ? LEGS_FRONT : LEGS_BACK;
  const { nodes: els, bind } = useNodes();
  useFrame((T) => {
    const { probe, compress } = moonLegs(T);
    legPaths(legs, probe, compress).forEach((p, i) => {
      attr(els[`ink${i}`], 'd', `${p.main}${p.brace}`);
      attr(els[`main${i}`], 'd', p.main);
      attr(els[`brace${i}`], 'd', p.brace);
      if (p.probe) attr(els[`probe${i}`], 'd', p.probe);
    });
    if (front) {
      const l = ladderPaths(compress);
      attr(els.railsInk, 'd', l.rails); attr(els.rails, 'd', l.rails);
      attr(els.rungs, 'd', l.rungs); attr(els.porch, 'd', l.porch);
    }
  });
  return <g strokeLinejoin="round" strokeLinecap="round">
    {legs.map(([, , px, py, , , hasProbe], i) => <g key={i}>
      <path ref={bind(`ink${i}`)} stroke={INK} strokeWidth="11" fill="none" />
      <path ref={bind(`main${i}`)} stroke={front ? '#f0cc70' : '#c9a24c'} strokeWidth="6" fill="none" />
      <path ref={bind(`brace${i}`)} stroke={front ? '#dfe3ec' : '#aeb5c6'} strokeWidth="5" fill="none" />
      {hasProbe ? <path ref={bind(`probe${i}`)} stroke={INK} strokeWidth="2.5" fill="none" /> : null}
      <ellipse cx={px} cy={py - 3} rx="26" ry="8" fill={front ? '#e8d49a' : '#c9b47a'} stroke={INK} strokeWidth="3" />
      <path d={`M${px - 16} ${py - 6}h20`} stroke="#fff3c4" strokeWidth="2.5" opacity={front ? 1 : .5} />
    </g>)}
    {front && <g>
      {/* ladder on the forward strut, porch under the hatch */}
      <path ref={bind('railsInk')} stroke={INK} strokeWidth="5" fill="none" />
      <path ref={bind('rails')} stroke="#eef1f8" strokeWidth="2.5" fill="none" />
      <path ref={bind('rungs')} stroke={INK} strokeWidth="2.5" fill="none" />
      <path ref={bind('porch')} fill="#d7dbe6" stroke={INK} strokeWidth="2.5" />
    </g>}
  </g>;
}
export const LmFlameArt = memo(function LmFlameArt() {
  return <g>
    <ellipse cx="0" cy="34" rx="70" ry="80" fill="url(#mn-lmglow)" />
    <path d="M-24 0C-28 34-14 70 0 104C14 70 28 34 24 0Z" fill="#ffc86a" opacity=".9" stroke="#ff9a3a" strokeWidth="2.5" />
    <path d="M-16 0C-18 26-8 50 0 74C8 50 18 26 16 0Z" fill="#ffe7a0" />
    <path d="M-9 0C-10 16-4 30 0 44C4 30 10 16 9 0Z" fill="#ffffff" />
  </g>;
});

// ---------------------------------------------------------------- astronaut (local: origin between the boots, helmet top −107)
const SUIT = '#fbfaf5';
const SUIT_SHADE = '#d9dbe8';
const limbD = (points: readonly Vec[]) => `M${points.map(({ x, y }) => `${r1(x)} ${r1(y)}`).join('L')}`;
const HelmetFront = memo(function HelmetFront() {
  return <g>
    <path d="M-15-66H15V-59H-15Z" fill="#cfd4df" stroke={INK} strokeWidth="2.5" />
    <circle cx="0" cy="-84" r="23" fill="#ffffff" stroke={INK} strokeWidth="3.5" />
    <path d="M-22-86Q-24-96-18-102" fill="none" stroke="#3a3f95" strokeWidth="4" opacity=".14" strokeLinecap="round" />
    <path d="M-18-88Q-18-102 0-103Q18-102 18-88L16-77Q0-68-16-77Z" fill="#f0a832" stroke={INK} strokeWidth="2.8" />
    <path d="M-16.5-80Q0-71 16.5-80L16-77Q0-68-16-77Z" fill="#c9751c" />
    <path d="M-12-94Q-5-99 4-98" fill="none" stroke="#fff5cf" strokeWidth="3.4" strokeLinecap="round" />
    <circle cx="11" cy="-92" r="2.4" fill="#ffffff" />
    {/* the flag, reflected small in the gold visor */}
    <g transform="translate(4 -87) skewX(-10)" opacity=".85"><rect width="8" height="5" fill="#fff4dc" /><rect width="8" height="1.2" fill="#d6333f" /><rect y="2.4" width="8" height="1.2" fill="#d6333f" /><rect width="3.4" height="2.8" fill="#27407e" /></g>
  </g>;
});
const TorsoFront = memo(function TorsoFront() {
  return <g strokeLinejoin="round">
    <path d="M-29-82H29V-40H-29Z" fill="#e9eaf1" stroke={INK} strokeWidth="3" />
    <path d="M-29-82H-18V-40H-29Z" fill="#3a3f95" opacity=".12" />
    <path d="M-24-74Q-27-54-21-37H21Q27-54 24-74Q0-80-24-74Z" fill={SUIT} stroke={INK} strokeWidth="3.2" />
    <path d="M-24-74Q-27-54-21-37H-11Q-17-56-13-76Z" fill={SUIT_SHADE} opacity=".7" />
    <path d="M-11-64H11V-51H-11Z" fill="#c9ceda" stroke={INK} strokeWidth="2.2" />
    <circle cx="-5" cy="-57.5" r="2.2" fill="#e2493b" /><circle cx="1" cy="-57.5" r="2.2" fill="#f2c14e" /><circle cx="7" cy="-57.5" r="2.2" fill="#3b73db" />
    <circle cx="-9" cy="-45" r="3" fill="#3b73db" stroke={INK} strokeWidth="1.6" /><circle cx="9" cy="-45" r="3" fill="#e2493b" stroke={INK} strokeWidth="1.6" />
    <path d="M-21-39H21" stroke="#b7bccb" strokeWidth="3" />
    <g transform="translate(12 -72)"><rect width="9" height="5.5" fill={WHITE} /><rect width="9" height="1.1" fill="#d6333f" /><rect y="2.2" width="9" height="1.1" fill="#d6333f" /><rect y="4.4" width="9" height="1.1" fill="#d6333f" /><rect width="3.8" height="3" fill="#27407e" /><rect width="9" height="5.5" fill="none" stroke={INK} strokeWidth=".9" /></g>
  </g>;
});
const BackPack = memo(function BackPack() {
  return <g strokeLinejoin="round">
    <circle cx="0" cy="-86" r="22" fill="#ffffff" stroke={INK} strokeWidth="3.5" />
    <path d="M-27-82H27V-37H-27Z" fill="#eceef4" stroke={INK} strokeWidth="3.2" />
    <path d="M-22-96H22V-82H-22Z" fill="#dfe2ea" stroke={INK} strokeWidth="3" />
    <path d="M-27-82H-13V-37H-27Z" fill="#3a3f95" opacity=".12" />
    <path d="M-19-68H19M-19-54H19" stroke="#b7bccb" strokeWidth="2.5" />
    <path d="M-8-46h16v5H-8Z" fill="#8d93a6" />
  </g>;
});
/** Mitten gloves (drawn at the origin; the writer places and turns them along the forearm). */
const GLOVE_CLOSED = <g>
  <path d="M-6-3Q-7 7 0 8Q7 7 6-3Q6-8 0-8Q-6-8-6-3Z" fill="#b8c0d6" stroke={INK} strokeWidth="2.4" />
  <path d="M-2 6Q0 8 2 6" stroke="#3b73db" strokeWidth="3" strokeLinecap="round" />
  <path d="M5-1Q9-2 9 2Q8 5 5 4" fill="#b8c0d6" stroke={INK} strokeWidth="2.2" />
</g>;
const GLOVE_OPEN = <g transform="scale(-1.3 1.3)">
  <path d="M-7-3Q-8 11 0 12Q8 11 7-3Q6-8 0-8Q-6-8-7-3Z" fill="#c3cadd" stroke={INK} strokeWidth="2.2" />
  <path d="M-4 6V11M0 7V12M4 6V11" stroke="#8d95ad" strokeWidth="1.4" strokeLinecap="round" />
  <path d="M-5 10Q0 13 5 10" stroke="#3b73db" strokeWidth="3" strokeLinecap="round" fill="none" />
  <path d="M6 0Q13-2 13 4Q12 8 6 6" fill="#c3cadd" stroke={INK} strokeWidth="2" />
</g>;
const BACKPACK = <BackPack />;
const TORSO = <TorsoFront />;
const HELMET = <HelmetFront />;
const gloveTransform = (arm: [Vec, Vec, Vec]) => `translate(${r1(arm[2].x)} ${r1(arm[2].y)}) rotate(${r1(-forearmAngle(arm))})`;
type Els = Record<string, SVGElement | null>;
/** Ink-under-suit limb: two paths the writer shapes. */
function LimbPaths({ name, w, bind }: { name: string; w: number; bind: (k: string) => (el: SVGElement | null) => void }) {
  return <g fill="none" strokeLinecap="round" strokeLinejoin="round"><path ref={bind(`${name}Ink`)} stroke={INK} strokeWidth={w + 5.5} /><path ref={bind(name)} stroke={SUIT} strokeWidth={w} /></g>;
}
function writeLimb(els: Els, name: string, points: readonly Vec[]) {
  const d = limbD(points);
  attr(els[`${name}Ink`], 'd', d);
  attr(els[name], 'd', d);
}
/**
 * The astronaut: back view down the ladder, then front view for the step,
 * the giant leap and the wave. The carried flag (`flag`) draws between the
 * body and the gripping arm, so the glove wraps the pole.
 */
export function AstronautActor({ view, flag }: { view: 'back' | 'front'; flag: React.ReactNode }) {
  const { nodes: els, bind } = useNodes();
  const front = view === 'front';
  useFrame((T) => {
    const a = moonAstronaut(T);
    const { pose } = a;
    const e = els;
    const t = `translate(${r1(a.x)} ${r1(a.y)}) scale(${r2(a.s * pose.sx)} ${r2(a.s * pose.sy)})`;
    attr(e.body, 'transform', t);
    attr(e.arm, 'transform', t);
    // A shadow is light, so it may fade: it lies on the ground (never at the porch) and comes in as he nears it.
    shown(e.shadowG, a.shadow.o > 0);
    attr(e.shadowG, 'transform', `translate(${r1(a.shadow.x)} ${r1(a.shadow.y)}) scale(${r2(a.s)})`);
    const l = a.lift * .3;
    attr(e.shadow, 'd', `M-16 1H16L${r1(-128 + l)} 16Q${r1(-150 + l)} 16 ${r1(-148 + l)} 8Z`);
    attr(e.shadow, 'opacity', r2((.5 - a.lift * .002) * a.shadow.o));
    const { legL, legR } = pose;
    writeLimb(e, 'legL', [{ x: -9, y: -40 }, { x: -11 - legL * .3, y: -23 + legL * .2 }, { x: -12, y: -9 - legL }]);
    writeLimb(e, 'legR', [{ x: 9, y: -40 }, { x: 11 + legR * .3, y: -23 + legR * .2 }, { x: 12, y: -9 - legR }]);
    attr(e.knees, 'd', `M-16 ${r1(-25 + legL * .2)}h9M16 ${r1(-25 + legR * .2)}h-9`);
    attr(e.bootL, 'd', `M-25 ${r1(-4 - legL)}q0-9 10-9h7q4 0 4 5v4Z`);
    attr(e.bootR, 'd', `M25 ${r1(-4 - legR)}q0-9-10-9h-7q-4 0-4 5v4Z`);
    attr(e.soles, 'd', `M-25 ${r1(-2.5 - legL)}h21M25 ${r1(-2.5 - legR)}h-21`);
    writeLimb(e, 'armL', pose.left);
    writeLimb(e, 'armR', pose.right);
    attr(e.gloveL, 'transform', gloveTransform(pose.left));
    attr(e.gloveR, 'transform', gloveTransform(pose.right));
    if (front) {
      const waving = a.waveIn > 0 && T > 8.58;
      shown(e.wave, waving);
      if (waving) {
        const side = a.wave < 0 ? -1 : 1;
        attr(e.wave, 'transform', `translate(${r1(pose.left[2].x + side * 4)} ${r1(pose.left[2].y - 4)}) scale(${side} 1)`);
        attr(e.wave, 'opacity', r2(a.waveIn * (.55 + .45 * Math.abs(a.wave))));
      }
    }
  });
  const legs = <g>
    <LimbPaths name="legL" w={13} bind={bind} /><LimbPaths name="legR" w={13} bind={bind} />
    <path ref={bind('knees')} stroke="#c3c7d6" strokeWidth="2.2" strokeLinecap="round" />
    <path ref={bind('bootL')} fill="#e3e6ee" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
    <path ref={bind('bootR')} fill="#e3e6ee" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
    <path ref={bind('soles')} stroke="#3b73db" strokeWidth="3.4" strokeLinecap="round" />
  </g>;
  const rightArm = <><LimbPaths name="armR" w={front ? 11 : 10} bind={bind} /><g ref={bind('gloveR')}>{GLOVE_CLOSED}</g></>;
  return <>
    <g ref={bind('shadowG')}><path ref={bind('shadow')} fill="#5f574b" /></g>
    {!front && flag}
    <g ref={bind('body')}>
      {legs}
      {front && TORSO}
      <LimbPaths name="armL" w={front ? 11 : 10} bind={bind} />
      <g ref={bind('gloveL')}>{front ? GLOVE_OPEN : GLOVE_CLOSED}</g>
      {!front && rightArm}
      {front ? HELMET : BACKPACK}
      {front && <g ref={bind('wave')} visibility="hidden" fill="none" stroke="#fff4d8" strokeWidth="3" strokeLinecap="round"><path d="M12-10Q18-2 12 6" /><path d="M19-15Q28-2 19 11" /></g>}
    </g>
    {front && flag}
    {front && <g ref={bind('arm')}>{rightArm}</g>}
  </>;
}

// ---------------------------------------------------------------- the flag
const FLAG_CLOTH = `M0 0H${MOON_FLAG_W}V${r1(MOON_FLAG_H - 2)}Q${MOON_FLAG_W * .75} ${r1(MOON_FLAG_H + 3)} ${MOON_FLAG_W * .5} ${r1(MOON_FLAG_H - 1)}Q${MOON_FLAG_W * .25} ${r1(MOON_FLAG_H - 4)} 0 ${r1(MOON_FLAG_H)}Z`;
/** 13 stripes (7 red), a canton of 50 stars; hoist at x 0, top at y 0. */
export const FlagClothArt = memo(function FlagClothArt() {
  const stripe = MOON_FLAG_H / 13;
  return <g>
    <g clipPath="url(#mn-flag-cloth)">
      <rect width={MOON_FLAG_W} height={MOON_FLAG_H + 6} fill={WHITE} />
      <path d={Array.from({ length: 7 }, (_, i) => `M0 ${r2(i * 2 * stripe)}H${MOON_FLAG_W}V${r2(i * 2 * stripe + stripe)}H0Z`).join('')} fill="#d6333f" />
      <rect width={r1(MOON_FLAG_W * .4)} height={r1(stripe * 7)} fill="#27407e" />
      <path d={flagStars().map(([x, y]) => starD(x, y, 1.25)).join('')} fill="#ffffff" />
      <path d={`M${MOON_FLAG_W * .3} 0V${MOON_FLAG_H}M${MOON_FLAG_W * .62} 0V${MOON_FLAG_H}`} stroke={INK} strokeWidth="7" opacity=".08" />
      <path d={`M${MOON_FLAG_W * .46} 0V${MOON_FLAG_H}M${MOON_FLAG_W * .8} 0V${MOON_FLAG_H}`} stroke="#ffffff" strokeWidth="5" opacity=".14" />
    </g>
    <path d={FLAG_CLOTH} fill="none" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
  </g>;
});
/** Furled flag: a striped roll hugging the top of the pole. */
const FURLED = <g>
  <path d="M-5 2h11v30H-5Z" fill="#d6333f" />
  <path d="M-5 12h11M-5 22h11" stroke={WHITE} strokeWidth="3" />
  <path d="M-5 2h6v11h-6Z" fill="#27407e" />
  <path d="M-5 2h11v30H-5Z" fill="none" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
</g>;
const FLAG_CLOTH_EL = <FlagClothArt />;
const TOP_ROD = `M0 0H${MOON_FLAG_W + 2}`;
/**
 * The flag, in world units: stowed on the ladder rail, carried, planted with a
 * telescoping pole, then unfurled from the roll (easeOutBack) with a ripple.
 */
export function FlagActor() {
  const { nodes: els, bind } = useNodes();
  useFrame((T) => {
    const f = moonFlag(T);
    const e = els;
    attr(e.root, 'transform', `translate(${r1(f.foot.x)} ${r1(f.foot.y)}) rotate(${r1(f.tilt)}) scale(${r2(f.s)})`);
    const top = -f.pole;
    const pole = `M0 0V${r1(top)}`;
    attr(e.poleInk, 'd', pole);
    attr(e.pole, 'd', pole);
    shown(e.unfurl, f.unfurl > 0);
    if (f.unfurl > 0) {
      attr(e.unfurl, 'transform', `translate(0 ${r1(top + 2)}) scale(${r2(f.unfurl)} 1)`);
      attr(e.cloth, 'transform', `translate(0 2) skewY(${r1(f.ripple)})`);
    }
    const rollOut = Math.min(1, f.unfurl / .3);
    shown(e.roll, rollOut < 1);
    if (rollOut < 1) attr(e.roll, 'transform', `translate(0 ${r1(top)}) scale(1 ${r2(1 - rollOut)})`);
  });
  return <g ref={bind('root')}>
    <path ref={bind('poleInk')} stroke={INK} strokeWidth="6" strokeLinecap="round" />
    <path ref={bind('pole')} stroke="#efe9d6" strokeWidth="3" strokeLinecap="round" />
    <g ref={bind('unfurl')} visibility="hidden">
      <path d={TOP_ROD} stroke={INK} strokeWidth="5" strokeLinecap="round" /><path d={TOP_ROD} stroke="#efe9d6" strokeWidth="2.4" strokeLinecap="round" />
      <g ref={bind('cloth')}>{FLAG_CLOTH_EL}</g>
    </g>
    <g ref={bind('roll')}>{FURLED}</g>
  </g>;
}
/** The planted pole's long shadow and the little dust ring at its foot (under the astronaut). */
export const FlagGroundMarks = memo(function FlagGroundMarks() {
  return <g transform={`translate(${MOON_FLAG_SPOT.x} ${MOON_FLAG_SPOT.gy}) scale(${r2(MOON_FLAG_SCALE)})`}>
    <path d="M0 0L-200 26L-196 30Z" fill="#5f574b" opacity=".5" />
    <ellipse cx="0" cy="1" rx="12" ry="3" fill="#8a806f" opacity=".7" />
  </g>;
});

// ---------------------------------------------------------------- lunar ground (static)
/** Lunar pattern and the flag-cloth clip, defined once in the always-visible world SVG (a clip inside a hidden group would clip everything). */
export const GroundDefs = memo(function GroundDefs() {
  return <defs>
    <clipPath id="mn-flag-cloth"><path d={FLAG_CLOTH} /></clipPath>
    <pattern id="mn-regolith" width="120" height="80" patternUnits="userSpaceOnUse">
      {Array.from({ length: 22 }, (_, i) => <circle key={i} cx={(i * 53) % 120} cy={(i * 31) % 80} r={.8 + (i % 3) * .5} fill={i % 3 ? '#9a917f' : '#f3ecdd'} opacity=".26" />)}
    </pattern>
  </defs>;
});
type CraterSpec = readonly (readonly [x: number, y: number, rx: number, ry: number])[];
/** Craters as four merged layers (rim light, bowl, inner floor, lip), one path each. */
function Craters({ list }: { list: CraterSpec }) {
  return <g>
    <path d={list.map(([x, y, rx, ry]) => ellipseD(x, y, rx * 1.08, ry * 1.22)).join('')} fill="#efe8da" />
    <path d={list.map(([x, y, rx, ry]) => ellipseD(x, y, rx, ry)).join('')} fill="#a29886" />
    <path d={list.map(([x, y, rx, ry]) => ellipseD(x - rx * .16, y + ry * .12, rx * .82, ry * .78)).join('')} fill="#bdb29f" />
    <path d={list.map(([x, y, rx, ry]) => `M${x - rx} ${y}A${rx} ${ry} 0 0 0 ${x + rx} ${y}`).join('')} fill="none" stroke="#8a806f" strokeWidth="2.2" opacity=".6" />
  </g>;
}
/** Rocks as three merged layers (long shadow, lit body, shaded face). */
function Rocks({ list }: { list: readonly (readonly [x: number, y: number, r: number])[] }) {
  return <g>
    <path d={list.map(([x, y, r]) => ellipseD(x - r * 2, y + 1.5, r * 2.3, r * .3)).join('')} fill="#5f574b" opacity=".45" />
    <path d={list.map(([x, y, r]) => `M${x - r} ${y}Q${x - r} ${y - r} ${x} ${y - r}Q${x + r} ${r1(y - r * .9)} ${x + r} ${y}Z`).join('')} fill="#b8ae9b" stroke={INK} strokeWidth="2.5" />
    <path d={list.map(([x, y, r]) => `M${x - r} ${y}Q${x - r} ${y - r} ${x} ${y - r}L${r1(x - r * .2)} ${y}Z`).join('')} fill="#8d8474" />
  </g>;
}
const FAR_CRATERS = [[250, 560, 80, 11], [640, 548, 38, 6], [980, 556, 48, 7], [1340, 566, 70, 10], [1520, 600, 60, 10], [120, 612, 70, 12], [460, 604, 56, 9], [860, 616, 64, 10], [1180, 626, 80, 13], [-80, 560, 60, 9], [1760, 580, 70, 11], [-300, 600, 64, 10], [2000, 610, 60, 10]] as const;
const FAR_ROCKS = [[380, 580, 5], [720, 592, 6], [1080, 585, 5], [1440, 590, 6], [200, 640, 7], [1300, 650, 7], [560, 630, 6], [-200, 620, 6], [1900, 640, 7]] as const;
/** An arc of the horizon circle from x0 to x1, `dr` units inside it (far-art coordinates). */
const horizonArc = (x0: number, x1: number, dr = 0) => `M${x0} ${r2(moonHorizonY(x0, dr))}A${MOON_HORIZON.r - dr} ${MOON_HORIZON.r - dr} 0 0 1 ${x1} ${r2(moonHorizonY(x1, dr))}`;
const FAR_GROUND = `${horizonArc(-900, 2500)}V3000H-900Z`;
/**
 * Far ground: horizon, craters and pebbles (drawn at the far camera's rest
 * pose). The horizon is the arc the dive's globe ends on, drawn with the
 * globe's own rim line, so the hand-off from the globe at 5.95 s is seamless.
 */
export const FarSurfaceArt = memo(function FarSurfaceArt() {
  return <g strokeLinejoin="round">
    <path d={FAR_GROUND} fill="#e2dacb" />
    <path d={`${horizonArc(-900, 2500, 26)}V3000H-900Z`} fill="#d4cbb9" />
    <path d={horizonArc(-900, 300, 10)} fill="none" stroke="#efe8da" strokeWidth="3" opacity=".7" />
    <path d={FAR_GROUND} fill="url(#mn-regolith)" />
    <path d={horizonArc(-900, 2500)} fill="none" stroke={INK} strokeWidth="3.5" vectorEffect="non-scaling-stroke" />
    <Craters list={FAR_CRATERS} />
    <Rocks list={FAR_ROCKS} />
  </g>;
});
const NEAR_CRATERS = [[250, 820, 170, 30], [1250, 790, 110, 20], [1460, 870, 150, 28], [860, 880, 120, 22], [-60, 780, 120, 22], [1700, 800, 130, 24]] as const;
const NEAR_ROCKS = [[140, 740, 12], [700, 800, 11], [930, 760, 7], [1130, 752, 9], [1400, 760, 12], [1010, 800, 8], [1190, 830, 13], [380, 760, 9], [-120, 750, 10], [1640, 748, 11]] as const;
/** Near ground: craters and rocks (the boulder pile is its own actor, so it can pop up at the dive swap). */
export const NearSurfaceArt = memo(function NearSurfaceArt() {
  return <g strokeLinejoin="round">
    <Craters list={NEAR_CRATERS} />
    <Rocks list={NEAR_ROCKS} />
    <g fill="#a39985" opacity=".6">{[[980, 748, 3], [1080, 770, 2.5], [1150, 744, 2], [900, 790, 3], [1230, 760, 2.5], [1060, 736, 2], [840, 770, 2]].map(([x, y, r]) => <ellipse key={x} cx={x} cy={y} rx={r * 1.8} ry={r * .7} />)}</g>
  </g>;
});
/** The boulder field the Eagle nearly lands on, until Armstrong takes manual control and flies past it. */
export const BoulderPileArt = memo(function BoulderPileArt() {
  return <g strokeLinejoin="round">
    <ellipse cx="532" cy="746" rx="140" ry="22" fill="#efe8da" />
    <ellipse cx="532" cy="746" rx="130" ry="18" fill="#a29886" />
    {MOON_BOULDERS.map(([x, y, w, h]) => <g key={x}>
      <ellipse cx={x - w * 1.05} cy={y + 3} rx={w * 1.2} ry={r1(h * .16)} fill="#5f574b" opacity=".5" />
      <path d={`M${x - w / 2} ${y}Q${x - w / 2} ${y - h * .7} ${x - w * .2} ${y - h}Q${x + w * .25} ${y - h * 1.05} ${x + w / 2} ${y - h * .45}L${x + w / 2} ${y}Z`} fill="#c7bda9" stroke={INK} strokeWidth="3" />
      <path d={`M${x - w / 2} ${y}Q${x - w / 2} ${y - h * .7} ${x - w * .2} ${y - h}L${x - w * .05} ${y}Z`} fill="#8f8676" />
      <path d={`M${x - w * .1} ${y - h * .92}Q${x + w * .2} ${y - h * .98} ${x + w * .38} ${y - h * .55}`} fill="none" stroke="#f1eadc" strokeWidth="3" strokeLinecap="round" />
    </g>)}
  </g>;
});
export function Footprint({ x, y, s }: { x: number; y: number; s: number }) {
  return <g transform={`translate(${x} ${y}) scale(${r2(s)}) rotate(-6)`}>
    <rect x="-9" y="-3.2" width="18" height="6.4" rx="3.2" fill="#8f8574" />
    <path d="M-5-3v6M-1-3v6M3-3v6" stroke="#b9af9c" strokeWidth="1.4" />
  </g>;
}


/** Hoisted elements (see MOON_ART). */
export const APOLLO_ART = {
  csm: <CsmArt />, lmBody: <LanderBodyArt />, lmFlame: <LmFlameArt />, far: <FarSurfaceArt />, near: <NearSurfaceArt />, boulders: <BoulderPileArt />, groundDefs: <GroundDefs />,
} as const;
