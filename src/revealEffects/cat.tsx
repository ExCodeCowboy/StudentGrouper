import { useId, useLayoutEffect, useRef, useState } from 'react';
import { CAT_DURATION_MS, catBlocking, progress, smooth, type CatPose } from './sceneMotion';
import { useSceneTime } from './useSceneTime';
import type { RevealEffect } from './types';
import './cat.css';
import { WalkingTabby } from './catIllustration';

function PawPrint({ x, y, angle = 0 }: { x: number; y: number; angle?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle})`}>
    <path d="M-9 5C-13 15 12 15 10 5L5-2Q0-6-5-2Z" />
    <ellipse cx="-12" cy="-3" rx="4" ry="5" transform="rotate(-25 -12 -3)" /><ellipse cx="-5" cy="-11" rx="4" ry="5" /><ellipse cx="5" cy="-11" rx="4" ry="5" /><ellipse cx="12" cy="-3" rx="4" ry="5" transform="rotate(25 12 -3)" />
  </g>;
}

/** Exported separately so the illustration can be inspected at an exact story time. */
export function CatScene({ time, pose, blocking }: { time: number; pose?: CatPose; blocking?: ReturnType<typeof catBlocking> }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1280, height: 720 });
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { width, scale, distance, x, strideOffset, ballX, ballDistance } = blocking ?? catBlocking(time, size.width);
  const floor = size.height * .7;
  const radius = 36 * scale;
  const edge = Math.max(0, ballX + radius * .45);
  const ballY = floor - radius;
  return <div ref={root} className="cat-reveal-scene" style={{ opacity: 1 - smooth(progress(time, 6.55, 6.8)) }}>
    <div className="cat-yarn-curtain" style={{ clipPath: `inset(0 0 0 ${edge}px)` }}>
      <svg className="cat-wallpaper" width="100%" height="100%">
        <defs><pattern id={`${id}-paws`} width="170" height="150" patternUnits="userSpaceOnUse"><g fill="#dabba6" opacity=".32"><PawPrint x={38} y={40} angle={-20} /><PawPrint x={123} y={115} angle={25} /></g><path d="M0 75q42-24 85 0t85 0" fill="none" stroke="#e2cbbb" strokeWidth="1" opacity=".5" /></pattern></defs>
        <rect width="100%" height="100%" fill={`url(#${id}-paws)`} />
      </svg>
      <span className="cat-scene-caption">Follow the yarn<span>• • •</span></span>
    </div>
    <svg className="cat-yarn-threads" width={size.width} height={size.height}>
      {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${edge} ${-30 + i * (size.height + 60) / 8}C${edge + 26} ${floor * .65} ${ballX - 25} ${ballY - 80} ${ballX} ${ballY}`} fill="none" stroke={i % 2 ? '#8aada4' : '#bdc8b4'} strokeWidth={i % 2 ? 2 : 1} opacity={.58} />)}
      {Array.from({ length: 9 }, (_, i) => {
        const px = size.width * (.07 + i * .112);
        const passed = progress(x + width * .27 - px, 0, width * .55);
        return <g key={i} opacity={passed > 0 ? .15 * (1 - passed) : 0} fill="#ad805e"><PawPrint x={px} y={floor + (i % 2 ? 10 : -7)} angle={90} /></g>;
      })}
      <g transform={`translate(${ballX} ${ballY})`}>
        <ellipse cy={radius + 5} rx={radius * 1.15} ry={7} fill="#5b6859" opacity=".13" />
        <g transform={`rotate(${ballDistance / radius * 180 / Math.PI})`}>
          <circle r={radius} fill="#78a89d" stroke="#477d75" strokeWidth="2" />
          <g fill="none" stroke="#b8d3b9" strokeWidth={2.5 * scale}>
            {[-.72, -.43, -.14, .15, .44, .73].map((line) => <path key={line} d={`M${-radius * Math.sqrt(1 - line * line)} ${radius * line}Q0 ${radius * (line - .48)} ${radius * Math.sqrt(1 - line * line)} ${radius * line}`} />)}
            <path d={`M${-radius * .6} ${-radius * .75}Q${-radius * .5} ${radius * .7} ${radius * .7} ${radius * .68}M${-radius * .3} ${-radius * .95}Q${-radius * .25} ${radius * .5} ${radius * .86} ${radius * .45}`} stroke="#477d75" />
          </g>
        </g>
      </g>
    </svg>
    <div className="cat-walker" style={{ width, left: x, top: floor - 274 * scale }}><WalkingTabby time={time} distance={distance / scale} strideOffset={strideOffset} pose={pose} /></div>
  </div>;
}

function CatStage() { return <CatScene time={useSceneTime(CAT_DURATION_MS)} />; }
function CatCover() { return null; }
export const catEffect: RevealEffect = { id: 'cat', name: 'Cat & yarn', description: 'A curious tabby catches up with a ball of yarn, gives it a gentle tap, and trots after it as the covers unravel.', durationMs: CAT_DURATION_MS, Stage: CatStage, Cover: CatCover };
