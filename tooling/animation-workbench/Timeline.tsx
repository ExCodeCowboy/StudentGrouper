import { useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { CHANNELS, moveKey, sampleChannel, setKey, type ChannelId, type ClipDocument, type Keyframe } from './model';

export type TimelineProps = {
  clip: ClipDocument; time: number; onTime: (time: number) => void;
  selected: ChannelId; onSelect: (channel: ChannelId) => void;
  onChange: (clip: ClipDocument) => void; onBegin: () => void; onEnd: () => void;
  selectedKey: string | null; onSelectKey: (id: string | null) => void;
  loopStart: number; loopEnd: number;
};

type Drag = {
  pointer: number; rect: DOMRect; startX: number; startY: number;
  clip: ClipDocument; channel?: ChannelId; key?: Keyframe; curve: boolean;
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const frame = 1 / 30;
const curveHeight = 160;
const curveInset = 12;

export function Timeline({ clip, time, onTime, selected, onSelect, onChange, onBegin, onEnd, selectedKey, onSelectKey, loopStart, loopEnd }: TimelineProps) {
  const drag = useRef<Drag | null>(null);
  const metadata = CHANNELS.find(channel => channel.id === selected)!;
  const axisValues = [...new Set([metadata.min, 0, metadata.max])];
  const visible = CHANNELS.filter(channel => channel.id === selected || clip.tracks[channel.id]?.length);
  const keys = clip.tracks[selected] ?? [];
  const percent = (at: number) => `${clamp(at / clip.duration, 0, 1) * 100}%`;
  const valueY = (value: number) => curveInset + (metadata.max - value) / (metadata.max - metadata.min) * (curveHeight - curveInset * 2);
  const quantize = (at: number, fine = false) => clamp(fine ? at : Math.round(at / frame) * frame, 0, clip.duration);
  const pointerTime = (clientX: number, rect: DOMRect, fine = false) => quantize((clientX - rect.left) / Math.max(rect.width, 1) * clip.duration, fine);
  const tickStep = clip.duration <= 1 ? .1 : clip.duration <= 4 ? .5 : clip.duration <= 10 ? 1 : clip.duration <= 30 ? 5 : 10;
  const ticks = Array.from({ length: Math.floor(clip.duration / tickStep) + 1 }, (_, index) => index * tickStep);
  if (clip.duration - ticks[ticks.length - 1] > tickStep * .4) ticks.push(clip.duration);
  const sampleTimes = [...new Set([
    ...Array.from({ length: 161 }, (_, index) => index / 160 * clip.duration),
    ...keys.flatMap(key => [Math.max(0, key.time - .000001), key.time]),
  ])].sort((a, b) => a - b);
  const path = sampleTimes.map((at, index) => `${index ? 'L' : 'M'}${at / clip.duration * 1000},${valueY(sampleChannel(clip, selected, at))}`).join(' ');

  function startScrub(event: PointerEvent<HTMLDivElement | HTMLInputElement>, channel?: ChannelId) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = { pointer: event.pointerId, rect, startX: event.clientX, startY: event.clientY, clip, curve: false };
    if (channel) { onSelect(channel); onSelectKey(null); }
    onTime(pointerTime(event.clientX, rect, event.altKey));
  }

  function startKey(event: PointerEvent<HTMLButtonElement>, channel: ChannelId, key: Keyframe, curve = false) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId, rect: event.currentTarget.parentElement!.getBoundingClientRect(),
      startX: event.clientX, startY: event.clientY, clip, channel, key: { ...key }, curve,
    };
    onSelect(channel); onSelectKey(key.id); onTime(key.time); onBegin();
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    if (!active.key || !active.channel) { onTime(pointerTime(event.clientX, active.rect, event.altKey)); return; }
    const at = quantize(active.key.time + (event.clientX - active.startX) / Math.max(active.rect.width, 1) * active.clip.duration, event.altKey);
    const channel = CHANNELS.find(candidate => candidate.id === active.channel)!;
    const value = active.curve
      ? clamp(active.key.value - (event.clientY - active.startY) / Math.max(active.rect.height, 1) * curveHeight / (curveHeight - curveInset * 2) * (channel.max - channel.min), channel.min, channel.max)
      : active.key.value;
    onChange(moveKey(active.clip, active.channel, active.key.id, at, value)); onTime(at);
  }

  function finish(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    const wasKey = !!drag.current.key; drag.current = null;
    if (wasKey) onEnd();
  }

  function keyCommand(event: KeyboardEvent<HTMLButtonElement>, channel: ChannelId, key: Keyframe, curve = false) {
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    const vertical = curve && (event.key === 'ArrowUp' || event.key === 'ArrowDown');
    if (!horizontal && !vertical) return;
    event.preventDefault(); event.stopPropagation();
    const info = CHANNELS.find(candidate => candidate.id === channel)!;
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1;
    const amount = event.shiftKey ? 10 : 1;
    const at = horizontal ? clamp(key.time + direction * (event.altKey ? .001 : frame) * amount, 0, clip.duration) : key.time;
    const value = vertical ? clamp(key.value + direction * info.step * amount, info.min, info.max) : key.value;
    onSelect(channel); onSelectKey(key.id); onChange(moveKey(clip, channel, key.id, at, value)); onTime(at);
  }

  function addKey(event: MouseEvent<HTMLDivElement>, channel: ChannelId) {
    if (event.target !== event.currentTarget) return;
    const at = pointerTime(event.clientX, event.currentTarget.getBoundingClientRect(), event.altKey);
    const next = setKey(clip, channel, at, sampleChannel(clip, channel, at));
    onSelect(channel); onChange(next); onTime(at);
    onSelectKey(next.tracks[channel]?.find(key => Math.abs(key.time - at) < .000001)?.id ?? null);
  }

  const markers = () => <>
    <div className="loop-region" aria-hidden="true" style={{ position: 'absolute', insetBlock: 0, left: percent(loopStart), width: percent(loopEnd - loopStart), pointerEvents: 'none' }}/>
    <div className="playhead" aria-hidden="true" style={{ position: 'absolute', insetBlock: 0, left: percent(time), pointerEvents: 'none' }}/>
  </>;

  return <div className="timeline" onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
    <div className="timeline-ruler track-row">
      <div className="track-label"><span>Channels</span><small>30 fps</small></div>
      <div className="track-lane ruler-lane" style={{ position: 'relative', touchAction: 'none' }}>
        <input type="range" className="ruler-scrubber" aria-label="Timeline playhead" min={0} max={clip.duration} step="any" value={time} aria-valuetext={`${time.toFixed(2)} seconds`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'ew-resize', zIndex: 5, touchAction: 'none' }}
          onPointerDown={event => startScrub(event)} onChange={event => onTime(Number(event.currentTarget.value))}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            onTime(event.key === 'Home' ? 0 : event.key === 'End' ? clip.duration : clamp(time + (event.key === 'ArrowRight' ? 1 : -1) * frame * (event.shiftKey ? 10 : 1), 0, clip.duration));
          }}/>
        {ticks.map(at => <span className="ruler-tick" key={at} style={{ position: 'absolute', left: percent(at), transform: `translateX(${at === 0 ? '0' : at === clip.duration ? '-100%' : '-50%'})`, pointerEvents: 'none' }}>{Number(at.toFixed(2))}s</span>)}
        {markers()}
      </div>
    </div>
    <div className="timeline-rows">
      {visible.map(channel => <div className={`track-row ${selected === channel.id ? 'selected' : ''}`} key={channel.id}>
        <button type="button" className="track-label" aria-pressed={selected === channel.id} onClick={() => { onSelect(channel.id); onSelectKey(null); }}>
          <span>{channel.group}</span><small>{channel.label}</small>
        </button>
        <div className="track-lane" style={{ position: 'relative', touchAction: 'none' }} onPointerDown={event => startScrub(event, channel.id)} onDoubleClick={event => addKey(event, channel.id)}>
          {markers()}
          {(clip.tracks[channel.id] ?? []).map(key => <button type="button" key={key.id} className={`key-dot ${selectedKey === key.id ? 'selected' : ''}`}
            style={{ position: 'absolute', left: percent(key.time), top: '50%', touchAction: 'none' }} aria-label={`${channel.group} ${channel.label} key at ${key.time.toFixed(2)} seconds, ${key.value.toFixed(2)}${channel.unit}`} aria-pressed={selectedKey === key.id}
            title={`${key.time.toFixed(2)}s · ${key.value.toFixed(2)}${channel.unit} · ${key.easing}. Drag to retime; Alt for fine movement.`}
            onPointerDown={event => startKey(event, channel.id, key)} onKeyDown={event => keyCommand(event, channel.id, key)}
            onClick={() => { onSelect(channel.id); onSelectKey(key.id); onTime(key.time); }} onDoubleClick={event => event.stopPropagation()}/>) }
        </div>
      </div>)}
    </div>
    <div className="timeline-hint">Double-click a lane to add a key. Drag diamonds to retime. Alt: fine movement.</div>
    <div className="curve-panel">
      <div className="curve-header"><strong>{metadata.group} · {metadata.label}</strong><span>{sampleChannel(clip, selected, time).toFixed(2)}{metadata.unit}</span><small>Drag points to change timing and value</small></div>
      <div className="curve-plot" style={{ position: 'relative', height: curveHeight, touchAction: 'none' }} onPointerDown={event => startScrub(event)}>
        <svg viewBox={`0 0 1000 ${curveHeight}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
          {axisValues.map(value => <line className="curve-grid" key={value} x1="0" x2="1000" y1={valueY(value)} y2={valueY(value)} stroke="currentColor" strokeOpacity={value === 0 ? .3 : .12} vectorEffect="non-scaling-stroke"/>)}
          {ticks.map(at => <line className="curve-grid" key={at} x1={at / clip.duration * 1000} x2={at / clip.duration * 1000} y1="0" y2={curveHeight} stroke="currentColor" strokeOpacity=".08" vectorEffect="non-scaling-stroke"/>)}
          <path className="curve-line" d={path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
        </svg>
        {axisValues.map(value => <span className="curve-value-label" key={value} aria-hidden="true"
          style={{ position: 'absolute', left: 5, top: `${valueY(value) / curveHeight * 100}%`, transform: 'translateY(-100%)', fontSize: 9, opacity: .6, pointerEvents: 'none' }}>{value}{metadata.unit}</span>)}
        {markers()}
        {keys.map(key => <button type="button" key={key.id} className={`curve-key ${selectedKey === key.id ? 'selected' : ''}`} aria-label={`${metadata.group} ${metadata.label} curve key at ${key.time.toFixed(2)} seconds, value ${key.value.toFixed(2)}${metadata.unit}`} aria-pressed={selectedKey === key.id}
          style={{ position: 'absolute', left: percent(key.time), top: `${valueY(key.value) / curveHeight * 100}%`, touchAction: 'none' }}
          title={`${key.time.toFixed(2)}s · ${key.value.toFixed(2)}${metadata.unit} · ${key.easing}`}
          onPointerDown={event => startKey(event, selected, key, true)} onKeyDown={event => keyCommand(event, selected, key, true)}
          onClick={() => { onSelectKey(key.id); onTime(key.time); }}/>) }
      </div>
    </div>
  </div>;
}
