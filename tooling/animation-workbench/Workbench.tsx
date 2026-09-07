import { useCallback, useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WalkingTabby } from '../../src/revealEffects/catIllustration';
import { evaluateCat } from './catAdapter';
import { CHANNELS, cloneClip, createClip, parseClip, removeKey, sampleChannel, serializeClip, setKey, setKeyEasing, moveKey, holdPose, type ChannelId, type ClipDocument, type Easing } from './model';
import { PoseStage, SceneStage } from './Stage';
import { Timeline } from './Timeline';
import { useClipHistory } from './useClipHistory';

const FPS = 30;
const viewportOptions = [{ width:960,height:680,label:'Laptop · 960 × 680' },{width:1280,height:720,label:'Projector · 1280 × 720'},{width:1920,height:1080,label:'Full HD · 1920 × 1080'}];
const groups = [...new Set(CHANNELS.map(channel => channel.group))];
const clamp = (value:number,min:number,max:number) => Math.max(min,Math.min(max,value));
const filename = (name:string) => name.replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'').slice(0,80) || 'cat-study';
function download(content:string,name:string,mime:string) {
  const url=URL.createObjectURL(new Blob([content],{type:mime}));
  const anchor=document.createElement('a'); anchor.href=url; anchor.download=name; anchor.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

/** Export vectors from the same renderer used on the stage, at repeatable times. */
function poseSvg(clip:ClipDocument,times:number[],width:number) {
  const columns=times.length>1?3:1; const rows=Math.ceil(times.length/columns);
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={columns*600} height={rows*350} viewBox={`0 0 ${columns*600} ${rows*350}`}>
    <style>{'.cat-tabby>ellipse{transform:translateX(var(--cat-shadow-shift,0px))}'}</style>
    <rect width="100%" height="100%" fill="#f7f0e4"/>
    {times.map((time,index)=>{const sample=evaluateCat(clip,time,width);return <svg key={index} x={index%columns*600} y={Math.floor(index/columns)*350} width="600" height="350" viewBox="0 0 600 350" overflow="hidden">
      <text x="22" y="26" fontFamily="system-ui,sans-serif" fontSize="14" fill="#615443">{clip.name} · {time.toFixed(2)} s</text>
      <path d="M20 309H580" stroke="#c9bca7"/>
      <g transform="translate(25 35)" style={{'--cat-shadow-shift':`${sampleChannel(clip,'body.x',time)}px`} as React.CSSProperties}><circle cx={(sample.blocking.ballX-sample.blocking.x)/sample.blocking.scale} cy="238" r="36" fill="#78a89d"/>
        <svg width="470" height="310" overflow="visible"><WalkingTabby time={sample.sourceTime} distance={sample.blocking.distance/sample.blocking.scale} strideOffset={sample.blocking.strideOffset} pose={sample.rig}/></svg>
      </g>
    </svg>})}
  </svg>);
}

export function Workbench() {
  const history=useClipHistory(); const {clip,apply,begin,end,undo,redo}=history;
  const [time,setTime]=useState(3);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(1);
  const [loop,setLoop]=useState(true);
  const [loopStart,setLoopStart]=useState(2);
  const [loopEnd,setLoopEnd]=useState(4.3);
  const [view,setView]=useState<'pose'|'scene'|'compare'|'sheet'>('pose');
  const [compareScene,setCompareScene]=useState(false);
  const [viewportIndex,setViewportIndex]=useState(0);
  const [onion,setOnion]=useState(false);
  const [onionFrames,setOnionFrames]=useState(3);
  const [skeleton,setSkeleton]=useState(false);
  const [silhouette,setSilhouette]=useState(false);
  const [selected,setSelected]=useState<ChannelId>('head.angle');
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  const [reference,setReference]=useState(()=>createClip('Original reveal'));
  const [poseCopy,setPoseCopy]=useState<Partial<Record<ChannelId,number>>|null>(null);
  const [dialog,setDialog]=useState<'import'|'export'|null>(null);
  const [json,setJson]=useState('');
  const [message,setMessage]=useState('');
  const fileInput=useRef<HTMLInputElement>(null);
  const timeRef=useRef(time);
  const clipRef=useRef(clip);
  useEffect(()=>{timeRef.current=time;},[time]);
  useEffect(()=>{clipRef.current=clip;},[clip]);
  const viewport=viewportOptions[viewportIndex];
  const metadata=CHANNELS.find(channel=>channel.id===selected)!;
  const keys=clip.tracks[selected]??[];
  const activeKey=keys.find(key=>key.id===selectedKey);
  const currentValue=sampleChannel(clip,selected,time);
  const sample=evaluateCat(clip,time,viewport.width);
  const totalKeys=Object.values(clip.tracks).reduce((sum,track)=>sum+(track?.length??0),0);
  const sheetTimes=Array.from({length:6},(_,index)=>loopStart+(loopEnd-loopStart)*index/5);

  const seek=useCallback((next:number)=>{setPlaying(false);setTime(clamp(next,0,clip.duration));},[clip.duration]);
  const selectChannel=(channel:ChannelId)=>{setSelected(channel);setSelectedKey(null);};
  const setValues=useCallback((changes:Partial<Record<ChannelId,number>>)=>{
    setPlaying(false); let next=clipRef.current;
    for(const [id,value] of Object.entries(changes)) {
      const channel=id as ChannelId;
      if(!next.tracks[channel]?.length) {
        next=setKey(next,channel,0,0,channel==='motion.time'?'linear':'smooth');
        next=setKey(next,channel,next.duration,channel==='motion.time'?next.duration:0,channel==='motion.time'?'linear':'smooth');
      }
      const existing=next.tracks[channel]?.some(key=>Math.abs(key.time-timeRef.current)<1/120);
      next=setKey(next,channel,timeRef.current,value!,channel==='motion.time'&&!existing?'linear':undefined);
    }
    clipRef.current=next; apply(next);
  },[apply]);
  const resetTrack=()=>{
    const tracks={...clip.tracks};delete tracks[selected];apply({...clip,tracks});setSelectedKey(null);
  };
  const importText=(text:string)=>{
    try {
      const next=parseClip(text);
      if(Math.abs(next.duration-6.8)>.0001) throw new Error('This cat adapter uses a 6.8-second reveal. Import a clip with that duration.');
      apply(next);seek(Math.min(time,next.duration));setSelectedKey(null);setDialog(null);setMessage(`Imported ${next.name}.`);
    }catch(error){setMessage(error instanceof Error?error.message:'Could not read that clip.');}
  };
  const exportJson=()=>{setJson(serializeClip(clip));setDialog('export');setMessage('');};
  const copyPose=()=>{setPoseCopy(Object.fromEntries(CHANNELS.map(channel=>[channel.id,sampleChannel(clip,channel.id,time)])));setMessage('Pose offsets copied. Scrub to another time, then paste.');};
  const pastePose=()=>{if(poseCopy)setValues(poseCopy);};
  const playToggle=useCallback(()=>{
    if(!playing && (timeRef.current>=loopEnd || timeRef.current<loopStart)) setTime(loopStart);
    setPlaying(value=>!value);
  },[playing,loopEnd,loopStart]);
  useEffect(()=>{
    if(!playing)return;
    let frame=0;let previous=performance.now();
    const tick=(now:number)=>{
      const elapsed=(now-previous)/1000*speed;previous=now;
      setTime(current=>{
        const next=current+elapsed;
        if(next>loopEnd) {
          if(loop)return loopStart+(next-loopStart)%(loopEnd-loopStart);
          setPlaying(false);return loopEnd;
        }
        return next;
      });
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[playing,speed,loop,loopStart,loopEnd]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(dialog || (event.target instanceof HTMLElement && (event.target.matches('input,textarea,select,button')||event.target.isContentEditable)))return;
      if(event.code==='Space'){event.preventDefault();playToggle();}
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();seek(timeRef.current+(event.key==='ArrowLeft'?-1:1)/FPS);}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();setPlaying(false);if(event.shiftKey)redo();else undo();}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[dialog,playToggle,seek,undo,redo]);

  const renderPose=(document:ClipDocument,at=time,editable=false)=><PoseStage clip={document} time={at} viewportWidth={viewport.width} onion={onion&&view!=='sheet'} onionStep={onionFrames/FPS} skeleton={skeleton} silhouette={silhouette} editable={editable} selected={selected} onSelect={selectChannel} onBegin={()=>{setPlaying(false);begin();}} onChange={setValues} onEnd={end}/>;
  return <div className="workbench">
    <header className="desk-header"><div className="desk-brand"><span className="brand-mark">◒</span><span>MOTION DESK<small>Animation workbench / Cat & yarn</small></span></div>
      <div className="document-name"><input aria-label="Clip name" value={clip.name} maxLength={120} onFocus={begin} onBlur={end} onChange={event=>{if(event.target.value.trim())apply({...clip,name:event.target.value});}}/><span className="save-state">{history.saveWarning?'Storage unavailable':'Draft saved on this browser'}</span></div>
      <div className="header-actions"><button onClick={()=>{setPlaying(false);undo();}} disabled={!history.canUndo} title="Undo · Ctrl/Cmd Z">↶ Undo</button><button onClick={()=>{setPlaying(false);redo();}} disabled={!history.canRedo} title="Redo · Ctrl/Cmd Shift Z">↷</button><span className="divider"/><button onClick={()=>{setDialog('import');setJson('');setMessage('');}}>Import</button><button className="primary" onClick={exportJson}>Export clip ↗</button></div>
    </header>

    <div className="view-toolbar"><div className="segmented" aria-label="Workspace view">{(['pose','scene','compare','sheet'] as const).map(mode=><button key={mode} className={view===mode?'active':''} aria-pressed={view===mode} onClick={()=>setView(mode)}>{({pose:'Pose studio',scene:'Classroom',compare:'A / B compare',sheet:'Contact sheet'})[mode]}</button>)}</div>
      <div className="view-options"><label><input type="checkbox" checked={onion} onChange={event=>setOnion(event.target.checked)}/> Onion skin</label><label><input type="checkbox" checked={skeleton} onChange={event=>setSkeleton(event.target.checked)}/> Bones</label><label><input type="checkbox" checked={silhouette} onChange={event=>setSilhouette(event.target.checked)}/> Silhouette</label><select aria-label="Preview viewport" value={viewportIndex} onChange={event=>setViewportIndex(Number(event.target.value))}>{viewportOptions.map((option,index)=><option key={option.width} value={index}>{option.label}</option>)}</select></div>
    </div>

    <main className="studio-layout">
      <section className="preview-area">
        <div className="stage-caption"><span>{view==='compare'?'SYNCHRONIZED COMPARISON':view==='sheet'?'SIX POSES / SELECTED RANGE':'LIVE RIG / EDITED TAKE'}</span><span>{time.toFixed(2)} s <b>·</b> frame {Math.round(time*FPS)}</span></div>
        <div className={`stage-surface ${view==='compare'?'comparison':view==='sheet'?'sheet':''}`}>
          {view==='pose'&&renderPose(clip,time,true)}
          {view==='scene'&&<SceneStage clip={clip} time={time} width={viewport.width} height={viewport.height}/>}
          {view==='compare'&&<>{[reference,clip].map((document,index)=><div className="compare-cell" key={index}><span className="take-label">{index===0?'A · '+reference.name:'B · Current edit'}</span>{compareScene?<SceneStage clip={document} time={time} width={viewport.width} height={viewport.height}/>:renderPose(document)}</div>)}</>}
          {view==='sheet'&&sheetTimes.map((at,index)=><button className="sheet-frame" key={index} onClick={()=>{seek(at);setView('pose');}}>{renderPose(clip,at)}<span>{at.toFixed(2)} s · frame {Math.round(at*FPS)}</span></button>)}
        </div>
        <div className="stage-footer">
          {view==='pose'?<span>Drag the coral handles to pose. <kbd>←</kbd><kbd>→</kbd> step frames. <kbd>Space</kbd> plays.</span>:view==='compare'?<span>A and B share one clock. Compare the same frame or play the selected range.</span>:<span>Uses the actual classroom illustration and motion. No student data is loaded.</span>}
          {view==='compare'?<div><label><input type="checkbox" checked={compareScene} onChange={event=>setCompareScene(event.target.checked)}/> Classroom</label><button onClick={()=>{setReference(cloneClip(clip));setMessage('Current edit captured as reference A.');}}>Capture edit as A</button><button onClick={()=>setReference(createClip('Original reveal'))}>Original A</button></div>:<button onClick={()=>{download(poseSvg(clip,view==='sheet'?sheetTimes:[time],viewport.width),`${filename(clip.name)}-${view==='sheet'?'sheet':time.toFixed(2)}.svg`,'image/svg+xml');setMessage('Vector artwork exported.');}}>Export {view==='sheet'?'sheet':'pose'} SVG</button>}
        </div>
        {sample.warnings.length>0&&<output className="constraint-note">{sample.warnings.join(' ')}</output>}
      </section>

      <aside className="inspector"><div className="inspector-heading"><span>POSE CONTROLS</span><small>{selected==='motion.time'?'Source time · retime the whole reveal':'Offsets from the original'}</small></div>
        <label className="field">Control<select aria-label="Pose control" value={selected} onChange={event=>selectChannel(event.target.value as ChannelId)}>{groups.map(group=><optgroup key={group} label={group}>{CHANNELS.filter(channel=>channel.group===group).map(channel=><option key={channel.id} value={channel.id}>{channel.group} · {channel.label}</option>)}</optgroup>)}</select></label>
        <div className="value-heading"><strong>{metadata.group} <span>{metadata.label}</span></strong><input aria-label="Control value" type="number" min={metadata.min} max={metadata.max} step={metadata.step} value={Number(currentValue.toFixed(3))} onFocus={begin} onBlur={end} onChange={event=>{if(event.target.value!==''&&Number.isFinite(event.target.valueAsNumber))setValues({[selected]:event.target.valueAsNumber});}}/><small>{metadata.unit}</small></div>
        <input aria-label="Control slider" className="control-slider" type="range" min={metadata.min} max={metadata.max} step={metadata.step} value={currentValue} onPointerDown={begin} onPointerUp={end} onPointerCancel={end} onChange={event=>setValues({[selected]:Number(event.target.value)})}/>
        <div className="range-labels"><span>{metadata.min}{metadata.unit}</span><span>{(metadata.min+metadata.max)/2}</span><span>{metadata.max}{metadata.unit}</span></div>
        <div className="button-row"><button className="primary" onClick={()=>setValues({[selected]:currentValue})}>◇ Key this pose</button><button onClick={()=>setValues({[selected]:selected==='motion.time'?time:0})}>{selected==='motion.time'?'Original time here':'Zero here'}</button></div>
        <p className="help">{selected==='motion.time'?'Map edit time to the original performance. Equal source times create a pause; steeper lines play faster.':'Each edit adds a key at the playhead. New offset tracks start and end at zero. Paws retain their joint lengths above the floor.'}</p>
        {activeKey?<section className="key-inspector"><h3>Selected key</h3><label className="field">Time (seconds)<input aria-label="Key time" type="number" min="0" max={clip.duration} step={1/FPS} value={Number(activeKey.time.toFixed(3))} onFocus={begin} onBlur={end} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))apply(moveKey(clip,selected,activeKey.id,event.target.valueAsNumber));}}/></label><label className="field">Interpolation to next key<select aria-label="Key easing" value={activeKey.easing} onChange={event=>apply(setKeyEasing(clip,selected,activeKey.id,event.target.value as Easing))}><option value="smooth">Ease in / out</option><option value="linear">Steady speed</option><option value="hold">{selected==='motion.time'?'Hold source time':'Hold offset'}</option></select></label><button className="danger" onClick={()=>{apply(removeKey(clip,selected,activeKey.id));setSelectedKey(null);}}>Delete selected key</button></section>:<p className="empty-key">Select a diamond below to adjust its time or hold.</p>}
        <div className="inspector-divider"/><div className="button-row"><button onClick={copyPose}>Copy pose</button><button onClick={pastePose} disabled={!poseCopy}>Paste pose</button><button onClick={()=>{setPlaying(false);apply(holdPose(clip,time));selectChannel('motion.time');setMessage('Held this pose for four frames. Later motion catches up toward the next source-time key.');}} disabled={time>clip.duration-4/FPS}>Hold 4 frames</button><button className="quiet" onClick={resetTrack} disabled={!keys.length}>Reset track</button></div>
        <label className="field compact">Onion spacing <select aria-label="Onion spacing" value={onionFrames} onChange={event=>setOnionFrames(Number(event.target.value))}>{[1,2,3,5,8].map(count=><option key={count} value={count}>{count} frames</option>)}</select></label>
        <div className="draft-summary"><span>{Object.keys(clip.tracks).length} tracks</span><span>{totalKeys} keys</span><span>30 fps</span></div>
      </aside>
    </main>

    <section className="timeline-deck">
      <div className="transport"><div className="transport-main"><button aria-label="Previous frame" onClick={()=>seek(time-1/FPS)}>│‹</button><button className="play-button" onClick={playToggle} aria-label={playing?'Pause playback':'Play playback'}>{playing?'Ⅱ':'▶'}</button><button aria-label="Next frame" onClick={()=>seek(time+1/FPS)}>›│</button><label className="time-display"><input aria-label="Playhead time" type="number" min="0" max={clip.duration} step={1/FPS} value={time.toFixed(3)} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))seek(event.target.valueAsNumber);}}/><span>/ {clip.duration.toFixed(2)} s</span></label><select aria-label="Playback speed" value={speed} onChange={event=>setSpeed(Number(event.target.value))}><option value=".25">¼ speed</option><option value=".5">½ speed</option><option value="1">Normal speed</option><option value="1.5">1½ speed</option></select></div>
        <div className="loop-controls"><label><input type="checkbox" checked={loop} onChange={event=>setLoop(event.target.checked)}/> Loop</label><label>In <input aria-label="Loop start" type="number" min="0" max={loopEnd-1/FPS} step={.1} value={Number(loopStart.toFixed(3))} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber)){setPlaying(false);setLoopStart(clamp(event.target.valueAsNumber,0,loopEnd-1/FPS));}}}/></label><label>Out <input aria-label="Loop end" type="number" min={loopStart+1/FPS} max={clip.duration} step={.1} value={Number(loopEnd.toFixed(3))} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber)){setPlaying(false);setLoopEnd(clamp(event.target.valueAsNumber,loopStart+1/FPS,clip.duration));}}}/></label><button onClick={()=>{setPlaying(false);setLoopStart(2);setLoopEnd(4.3);seek(2);}}>Acting beat</button><button onClick={()=>{setPlaying(false);setLoopStart(0);setLoopEnd(clip.duration);seek(0);}}>Full reveal</button></div>
      </div>
      <Timeline clip={clip} time={time} onTime={seek} selected={selected} onSelect={selectChannel} onChange={next=>{setPlaying(false);apply(next);}} onBegin={begin} onEnd={end} selectedKey={selectedKey} onSelectKey={setSelectedKey} loopStart={loopStart} loopEnd={loopEnd}/>
    </section>
    <footer className="desk-status"><span>{message||history.saveWarning||'Ready · edit the pose, shape the timing, compare the performance.'}</span><span>LOCAL TOOLING · classroom animation changes only when promoted in code</span></footer>

    {dialog&&<dialog className="transfer-dialog" ref={element=>{if(element&&!element.open)element.showModal();}} onCancel={()=>setDialog(null)} aria-label={dialog==='import'?'Import animation clip':'Export animation clip'}>
      <header><h2>{dialog==='import'?'Open a clip':'Keep this take'}</h2><button aria-label="Close dialog" onClick={()=>setDialog(null)}>×</button></header>
      <p>{dialog==='import'?'Choose a saved Motion Desk JSON file or paste its contents below. Import can be undone.':'This JSON stores the editable keyframes. Reopen it here, or use the adapter described in the tooling README to render the take.'}</p>
      <textarea aria-label="Clip JSON" value={json} readOnly={dialog==='export'} onChange={event=>setJson(event.target.value)} spellCheck={false}/>
      {message&&<output className="transfer-message">{message}</output>}
      <div className="dialog-actions">{dialog==='import'?<><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={async event=>{const file=event.target.files?.[0];if(file){if(file.size>1_000_000){setMessage('Clip files must be smaller than 1 MB.');return;}importText(await file.text());}event.target.value='';}}/><button onClick={()=>fileInput.current?.click()}>Choose file</button><button className="primary" onClick={()=>importText(json)}>Import JSON</button></>:<><button onClick={async()=>{try{await navigator.clipboard.writeText(json);setMessage('Copied to clipboard.');}catch{setMessage('Select the JSON above and copy it manually.');}}}>Copy JSON</button><button className="primary" onClick={()=>download(json,`${filename(clip.name)}.json`,'application/json')}>Download clip</button></>}</div>
    </dialog>}
  </div>;
}
