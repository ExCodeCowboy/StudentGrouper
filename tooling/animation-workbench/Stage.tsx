import { useLayoutEffect, useRef, useState } from 'react';
import { WalkingTabby } from '../../src/revealEffects/catIllustration';
import { CatScene } from '../../src/revealEffects/cat';
import { evaluateCat } from './catAdapter';
import { sampleChannel, type ChannelId, type ClipDocument } from './model';

type Changes = Partial<Record<ChannelId, number>>;
export function PoseStage({ clip, time, viewportWidth, onion, onionStep, skeleton, silhouette, editable = false, selected, onSelect, onBegin, onChange, onEnd }: {
  clip: ClipDocument; time: number; viewportWidth: number; onion: boolean; onionStep: number; skeleton: boolean; silhouette: boolean;
  editable?: boolean; selected?: ChannelId; onSelect?: (channel: ChannelId) => void; onBegin?: () => void; onChange?: (changes: Changes) => void; onEnd?: () => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; channels: { x?: ChannelId; y?: ChannelId }; values: Changes } | null>(null);
  const sample = evaluateCat(clip, time, viewportWidth);
  const local = (clientX: number, clientY: number) => {
    const matrix = svg.current?.getScreenCTM();
    return matrix ? new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
  };
  const draw = (at: number) => {
    const pose = evaluateCat(clip, at, viewportWidth);
    return <svg x="25" y="0" width="470" height="310" overflow="visible" style={{'--cat-shadow-shift':`${sampleChannel(clip,'body.x',at)}px`} as React.CSSProperties}><WalkingTabby time={pose.sourceTime} distance={pose.blocking.distance / pose.blocking.scale} strideOffset={pose.blocking.strideOffset} pose={pose.rig} /></svg>;
  };
  return <svg ref={svg} viewBox="0 0 580 320" className="pose-stage" aria-label="Cat pose canvas">
    <defs><pattern id="desk-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#dacfbf" strokeWidth=".4"/></pattern></defs>
    <rect width="580" height="320" fill="url(#desk-grid)"/>
    <path d="M0 274H580" stroke="#b6a994" strokeWidth="1"/>
    <text x="12" y="296" fontSize="8" fill="#8c806e">GROUND</text>
    {onion && [-1, 1].map(direction => <g key={direction} opacity=".16" className={direction < 0 ? 'onion-before' : 'onion-after'}>{draw(Math.max(0, Math.min(clip.duration, time + direction * onionStep)))}</g>)}
    <circle cx={25 + (sample.blocking.ballX - sample.blocking.x) / sample.blocking.scale} cy="238" r="36" fill="#78a89d" opacity=".65" stroke="#477d75" strokeWidth="1.5"/>
    <g className={silhouette ? 'silhouette' : ''}>{draw(time)}</g>
    {skeleton && <g transform="translate(25 0)" fill="#fffaf0">{sample.rig.legs.map(leg => <g key={leg.key} stroke={leg.far ? '#4278ad' : '#c35d42'} opacity={leg.far ? .55 : .9}>
      <polyline points={[leg.hip, leg.knee, leg.ankle, leg.foot].map(point => `${point.x},${point.y}`).join(' ')} fill="none" strokeWidth="1"/>
      {[leg.hip,leg.knee,leg.ankle,leg.foot].map((point,index)=><circle key={index} cx={point.x} cy={point.y} r="2.2" strokeWidth="1"/>)}
    </g>)}</g>}
    {editable && sample.handles.map(handle => <foreignObject key={handle.id} x={handle.point.x+14} y={handle.point.y-11} width="22" height="22">
      <button className={`pose-handle ${selected && Object.values(handle.channels).includes(selected) ? 'selected' : ''}`} aria-label={`Move ${handle.label}`} title={`${handle.label} · drag, or use arrow keys`}
        onKeyDown={event => {
          const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
          const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
          if (!horizontal && !vertical) return;
          const channel = horizontal ? handle.channels.x : handle.channels.y; if (!channel) return;
          event.preventDefault(); event.stopPropagation(); onSelect?.(channel);
          const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
          onChange?.({ [channel]: sampleChannel(clip, channel, time) + direction * (event.shiftKey ? 5 : 1) });
        }}
        onPointerDown={event => {
          event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
          const start = local(event.clientX, event.clientY); const values: Changes = {};
          for (const channel of Object.values(handle.channels)) if (channel) values[channel] = sampleChannel(clip, channel, time);
          drag.current = { x:start.x,y:start.y, channels: handle.channels, values };
          onSelect?.(handle.channels.y ?? handle.channels.x!); onBegin?.();
        }}
        onPointerMove={event => {
          if (!drag.current) return;
          const point = local(event.clientX, event.clientY); const changes: Changes = {};
          if (drag.current.channels.x) changes[drag.current.channels.x] = (drag.current.values[drag.current.channels.x] ?? 0) + point.x - drag.current.x;
          if (drag.current.channels.y) changes[drag.current.channels.y] = (drag.current.values[drag.current.channels.y] ?? 0) + point.y - drag.current.y;
          onChange?.(changes);
        }}
        onPointerUp={() => { drag.current = null; onEnd?.(); }} onPointerCancel={() => { drag.current = null; onEnd?.(); }}/>
    </foreignObject>)}
  </svg>;
}

export function SceneStage({ clip, time, width, height }: { clip: ClipDocument; time: number; width: number; height: number }) {
  const root = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = root.current!; const update = () => setScale(element.clientWidth / width);
    update(); const observer = new ResizeObserver(update); observer.observe(element); return () => observer.disconnect();
  }, [width]);
  const sample = evaluateCat(clip,time,width);
  return <div className="scene-stage" ref={root} style={{ aspectRatio: `${width}/${height}` }}><div style={{ '--cat-shadow-shift':`${sampleChannel(clip,'body.x',time)}px`,width,height,transform:`scale(${scale})`,transformOrigin:'0 0',position:'absolute' } as React.CSSProperties}>
    <div className="sample-class">{['Foxes','Otters','Owls','Hedgehogs'].map(name=><article key={name}><h2>{name}</h2><p>Ready to learn</p></article>)}</div>
    <CatScene time={sample.sourceTime} pose={sample.rig} blocking={sample.blocking}/>
  </div></div>;
}
