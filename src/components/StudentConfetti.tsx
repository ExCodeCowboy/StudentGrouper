import { useId, useLayoutEffect, useRef, type CSSProperties } from 'react';
import {
  PIP_FALSE_START, confettiJet, confettiStreamers, curlStrands, falseStartPuff, jetTrack, popBurstPoints, puffTracks,
  showerGlints, starGeometry, starShower, streamerTracks, tableLanes, tuftStrands, type TableEdges, type Tone, type Track,
} from '../revealEffects/confettiTimeline';
import '../revealEffects/confetti.css';

/*
 * Confetti party stage: lights down, a follow-spot that searches, catches Pip's
 * too-early little "pop" and fakes out onto Pop, two party-popper buddies who wind up
 * and POP, then two confetti fountains, curly streamers and a gold star shower.
 * Every parameter below is computed once at module load, so a reveal renders
 * static markup. The shared beats are CSS animations; each piece's own path is
 * a Web Animation with px keyframes, started once at mount and cancelled on
 * unmount. No per-frame JS.
 */

const INK = '#3B2A55';
const CONE = 'M60 196C50 170 24 96 12 46L108 46C96 96 70 170 60 196Z';
const COIL = curlStrands();
const TUFT = tuftStrands();
const STAR = starGeometry(24, 25, 22, 10);
const BURST = popBurstPoints();
const PIP_BURST = popBurstPoints(11, 30, 48);

type Side = 'left' | 'right';
const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties;

function Popper({ side }: { side: Side }) {
  const id = `cf${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const pip = side === 'left';
  const body = pip ? '#FF6F7D' : '#4FB3F2';
  const stripe = pip ? '#FFE3A3' : '#FFF1C7';
  return <svg viewBox="0 0 120 200" aria-hidden="true">
    <defs><clipPath id={`${id}-cone`}><path d={CONE} /></clipPath></defs>
    <g>
      <path d={CONE} fill={body} />
      <g clipPath={`url(#${id}-cone)`}>
        <g fill={stripe}>
          <path d="M0 74L120 50L120 64L0 88Z" /><path d="M0 116L120 92L120 104L0 128Z" /><path d="M0 156L120 132L120 143L0 167Z" />
        </g>
        {/* Form shading: a cool core shadow down the far side, a soft sheen down the near side. */}
        <path d="M60 200C66 170 84 100 90 44L126 44L126 200Z" fill={INK} opacity=".14" />
        <path d="M60 200C70 170 96 100 102 44L126 44L126 200Z" fill={INK} opacity=".16" />
        <path d="M22 50C30 96 44 150 57 190" fill="none" stroke="#FFFFFF" strokeOpacity=".5" strokeWidth="7" strokeLinecap="round" />
        <ellipse className="pp-cheek" cx="37" cy="114" rx="7" ry="4.4" fill="#FF8FA3" />
        <ellipse className="pp-cheek" cx="83" cy="114" rx="7" ry="4.4" fill="#FF8FA3" />
      </g>
      <path d={CONE} fill="none" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      <ellipse cx="60" cy="46" rx="50" ry="13" fill="#FFC83D" stroke={INK} strokeWidth="3.5" />
      <path d="M14 49Q60 66 106 49" fill="none" stroke="#E59B12" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="60" cy="44" rx="40" ry="8" fill="#4A2A66" />
      <rect x="38" y="33" width="7" height="10" rx="1.5" fill="#4FB3F2" transform="rotate(-18 41 38)" />
      <rect x="56" y="30" width="7" height="10" rx="1.5" fill="#9B7BEA" transform="rotate(12 59 35)" />
      <rect x="73" y="34" width="7" height="10" rx="1.5" fill="#3FC9A5" transform="rotate(28 76 39)" />
      <path d="M22 44Q40 36 60 36" fill="none" stroke="#FFF3C4" strokeWidth="3" strokeLinecap="round" />
    </g>
    <g className="pp-face">
      <g className="pp-eyes-open">
        <ellipse cx="44" cy="92" rx="11" ry="13" fill="#FFFFFF" stroke={INK} strokeWidth="3" />
        <ellipse cx="76" cy="92" rx="11" ry="13" fill="#FFFFFF" stroke={INK} strokeWidth="3" />
        <g className="pp-pupils">
          <circle cx="44" cy="93" r="6.5" fill="#2A1D3F" /><circle cx="76" cy="93" r="6.5" fill="#2A1D3F" />
          <circle cx="41.8" cy="90.4" r="2.4" fill="#FFFFFF" /><circle cx="73.8" cy="90.4" r="2.4" fill="#FFFFFF" />
        </g>
      </g>
      {/* Pop's unimpressed half-lids for the side-eye: heavy caps that cut the tops of the pupils. */}
      {!pip && <g className="pp-lids" fill={body} stroke={INK} strokeWidth="3.2" strokeLinejoin="round">
        <path d="M32.2 89.5A11.8 13.6 0 0 1 55.8 88.5Z" /><path d="M64.2 88.5A11.8 13.6 0 0 1 87.8 89.5Z" />
      </g>}
      <g className="pp-eyes-blink" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round">
        <path d="M34 93Q44 99 54 93" /><path d="M66 93Q76 99 86 93" />
      </g>
      <g className="pp-eyes-squint" fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M35 85L50 92L35 99" /><path d="M85 85L70 92L85 99" />
      </g>
      <g className="pp-eyes-happy" fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round">
        <path d="M34 97Q44 81 54 97" /><path d="M66 97Q76 81 86 97" />
      </g>
      <path className="pp-mouth-smile" d="M52 110Q60 118 68 110" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      {pip ? <>
        <path className="pp-mouth-mm" d="M51 112Q55.5 108.5 60 112Q64.5 115.5 69 112" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        {/* Embarrassed blush hatching on Pip's cheeks while it looks up at the tuft. */}
        <g className="pp-blush-lines" stroke="#C0304A" strokeWidth="2.6" strokeLinecap="round">
          <path d="M31 118L35 110M37 118L41 110M43 118L47 110" /><path d="M75 118L79 110M81 118L85 110M87 118L91 110" />
        </g>
        <ellipse className="pp-mouth-o" cx="60" cy="114" rx="6" ry="7.5" fill="#7A2E45" stroke={INK} strokeWidth="2.8" />
      </> : <path className="pp-mouth-hmm" d="M49 114Q54.5 109 60 114T71 113" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />}
      <path className="pp-mouth-grit" d="M51 112Q60 108 69 112" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path className="pp-mouth-grin" d="M48 106Q60 126 72 106Z" fill="#7A2E45" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    </g>
    {/* The early little pop leaves a tiny ribbon coil on Pip's rim, like a silly tuft (same two-strand coil as the streamers). */}
    {pip && PIP_FALSE_START && <g className="pp-tuft">
      <g transform="translate(57 38) rotate(-78) scale(1.55) translate(0 -9)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={TUFT.back} stroke="#1C7F66" strokeWidth="2.2" />
        <path d={TUFT.front} stroke="#1C7F66" strokeWidth="3.9" />
        <path d={TUFT.front} stroke="#5FE0BD" strokeWidth="2.3" />
      </g>
    </g>}
  </svg>;
}

function Badge({ side }: { side: Side }) {
  return <div className={`cf-badge is-${side}`}><svg viewBox="0 0 160 100" aria-hidden="true">
    <polygon points={BURST} fill="#FFFFFF" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
    <polygon points={BURST} fill="#FFD447" transform="translate(80 50) scale(.78) translate(-80 -50)" />
    <text x="80" y="62" textAnchor="middle" fontSize="36" fontWeight="900" letterSpacing="1" fill={side === 'left' ? '#FF6F7D' : '#4FB3F2'} stroke={INK} strokeWidth="5" paintOrder="stroke" strokeLinejoin="round">POP!</text>
  </svg></div>;
}

/** Pip's mini badge: the same comic burst, smaller and fewer spikes, with a small lowercase "pop" (a little sound) that sets up the big POP!. */
function PipBadge() {
  return <div className="cf-pip-badge"><svg viewBox="0 0 160 100" aria-hidden="true">
    <polygon points={PIP_BURST} fill="#FFFFFF" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
    <text x="80" y="64" textAnchor="middle" fontSize="40" fontWeight="900" fill="#FF6F7D" stroke={INK} strokeWidth="6" paintOrder="stroke" strokeLinejoin="round">pop</text>
  </svg></div>;
}

function FacetStar() {
  return <svg viewBox="0 0 48 48" className="cf-star-art" aria-hidden="true">
    {STAR.facets.map((facet, i) => <path key={i} d={facet.d} fill={facet.light ? '#FFE27A' : '#F7B21B'} />)}
    <path d={STAR.outline} fill="none" stroke="#C97A00" strokeWidth="2.6" strokeLinejoin="round" />
    <ellipse cx="17" cy="17" rx="3.2" ry="2.2" fill="#FFFBE6" transform="rotate(-35 17 17)" />
  </svg>;
}

const toneVars = (tone: Tone) => ({ '--c1': tone[0], '--c2': tone[1] });
const jets = { left: confettiJet(1, 7), right: confettiJet(-1, 11) };
const streamers = { left: confettiStreamers(1, 13), right: confettiStreamers(-1, 17) };
const puff = falseStartPuff();

function Emitter({ side }: { side: Side }) {
  return <div className={`cf-emitter is-${side}`}>
    {side === 'left' && PIP_FALSE_START && puff.map((piece, i) => <i key={`p${i}`} className="cf-puff" style={cssVars({ '--s': piece.scale, ...toneVars(piece.tone) })} />)}
    {streamers[side].map((s, i) => <i key={`s${i}`} className="cf-streamer" style={cssVars({ '--len': `${s.length}vmin` })}>
      <svg className="cf-ribbon" viewBox="0 0 181 40" preserveAspectRatio="none" aria-hidden="true">
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={COIL.back} stroke={s.tone[1]} strokeWidth="3.6" />
          <path d={COIL.front} stroke={s.tone[1]} strokeWidth="6.6" />
          <path d={COIL.front} stroke={s.tone[0]} strokeWidth="4" />
        </g>
      </svg>
    </i>)}
    {jets[side].map((p, i) => <i key={i} className={`cf-piece is-${p.kind}`} style={cssVars({ '--s': p.scale, ...toneVars(p.tone) })} />)}
  </div>;
}

const shower = starShower();
const glints = showerGlints();

/** Right end (screen px) of the visible text in these cells, ignoring reveal covers and screen-reader text. */
function textRight(cells: readonly (Element | undefined)[], range: Range) {
  let right = 0;
  for (const cell of cells) {
    if (!cell) continue;
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim() || node.parentElement?.closest('.reveal-cover, .sr-only')) continue;
      range.selectNodeContents(node);
      const box = range.getBoundingClientRect();
      if (box.width > 0) right = Math.max(right, box.right);
    }
  }
  return right;
}

/**
 * The Today table's blank strips (see tableLanes in confettiTimeline.ts), measured once over the rows on screen.
 * null when no Today table is showing (Groups, the picker) or it is not laid out.
 */
function measureTable(wrap: Element): TableEdges | null {
  const table = wrap.querySelector('table');
  const heads = table ? Array.from(table.querySelectorAll('thead th')) : [];
  if (!table || heads.length < 2) return null;
  const view = wrap.getBoundingClientRect();
  const [top, bottom, right] = [Math.max(0, view.top), Math.min(view.bottom, window.innerHeight), Math.min(view.right, window.innerWidth)];
  // The last round column that is mostly on screen (a wide table scrolls sideways).
  let last = heads.length - 1;
  while (last > 1 && heads[last].getBoundingClientRect().left > right - 120) last--;
  const rows = Array.from(table.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>).filter((row) => {
    const box = row.getBoundingClientRect();
    return box.bottom > top && box.top < bottom;
  });
  if (!rows.length) return null;
  const range = document.createRange();
  const roundLeft = Math.min(...rows.map((row) => {
    const cell = row.cells[1];
    const content = cell?.firstElementChild ?? cell;
    return content ? content.getBoundingClientRect().left : Infinity;
  }));
  return {
    teamTextRight: textRight(rows.map((row) => row.cells[0]), range),
    roundLeft,
    lastTextRight: textRight(rows.map((row) => row.cells[last]), range),
    lastRight: Math.min(heads[last].getBoundingClientRect().right, right),
  };
}

/**
 * Starts every per-piece path once, sized for this screen: the jets, streamers (flight + unfurl) and Pip's
 * puff. On the Today table the jets land in its blank lanes (measured here: that layout is needed for the
 * first frame anyway) and the streamers stay home. Created in the same commit as the stage, so they start on
 * the same frame as its CSS animations; the star shower is plain CSS and costs no script. Cancelled on unmount
 * (Hide again, None, leaving the screen).
 */
function useConfettiMotion(root: { current: HTMLDivElement | null }) {
  useLayoutEffect(() => {
    const stage = root.current;
    if (!stage || typeof stage.animate !== 'function') return undefined;
    const width = window.innerWidth || stage.clientWidth;
    const height = window.innerHeight || stage.clientHeight;
    const table = document.querySelector('.student-day-table-wrap');
    const lanes = table ? tableLanes(measureTable(table), width, height) : null;
    const running: Animation[] = [];
    const play = (node: Element | null | undefined, track: Track | undefined) => {
      if (node && track) running.push(node.animate(track.frames as Keyframe[], track.timing));
    };
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? 1 : -1;
      const emitter = stage.querySelector(`.cf-emitter.is-${side}`);
      if (!emitter) continue;
      emitter.querySelectorAll('.cf-puff').forEach((node, i) => {
        if (!puff[i]) return;
        const tracks = puffTracks(puff[i], width, height);
        play(node, tracks.move);
        play(node, tracks.fade);
      });
      emitter.querySelectorAll('.cf-piece').forEach((node, i) => { if (jets[side][i]) play(node, jetTrack(jets[side][i], sign, width, height, lanes?.[side])); });
      // On the Today table the streamers stay home: they would hang over the labels.
      if (!table) emitter.querySelectorAll('.cf-streamer').forEach((node, i) => {
        const streamer = streamers[side][i];
        if (!streamer) return;
        const tracks = streamerTracks(streamer, sign, width, height);
        play(node, tracks.flight);
        play(node.querySelector('.cf-ribbon'), tracks.unfurl);
      });
    }
    return () => { for (const animation of running) animation.cancel(); };
  }, [root]);
}

/** Full-screen stage. Keeps the historic export and root class for print/reduced-motion rules. */
export function StudentConfetti() {
  const root = useRef<HTMLDivElement>(null);
  useConfettiMotion(root);
  return <div ref={root} className="student-confetti cf-stage" aria-hidden="true">
    <div className="cf-veil"><i className="cf-beam" /></div>
    <div className="cf-flash" />
    <div className="cf-clip"><div className="cf-world">
      <Emitter side="left" /><Emitter side="right" />
      <div className="cf-popper is-left"><Popper side="left" /></div>
      <div className="cf-popper is-right"><Popper side="right" /></div>
      <div className="cf-muzzle is-left" /><div className="cf-muzzle is-right" />
      <div className="cf-hit is-left" /><div className="cf-hit is-right" />
      {PIP_FALSE_START && <PipBadge />}
      <Badge side="left" /><Badge side="right" />
      <div className="cf-shower">
        {shower.map((star, i) => <i key={i} className={`cf-star tier-${star.tier} is-s${i}`} style={cssVars({ '--x': `${star.x}vw`, '--size': `${star.size}vmin` })}><b className="cf-star-fall"><FacetStar /></b></i>)}
        {glints.map((glint, i) => <i key={`g${i}`} className="cf-glint" style={cssVars({ '--x': `${glint.x}vw`, '--y': `${glint.y}vh`, '--delay': `${glint.delay}ms`, '--size': `${glint.size}vmin` })} />)}
      </div>
    </div></div>
  </div>;
}
