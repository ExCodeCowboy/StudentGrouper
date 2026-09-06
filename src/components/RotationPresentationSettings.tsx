import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { RotationPresentationSettings as Settings } from '../model';
import { canonicalYouTubeUrl, MAX_ROTATION_SECONDS, parseYouTubeVideo } from '../rotationTimer';
import { transitionMelodies } from '../transitionMelodies';
import { TransitionMelody } from './TransitionMelody';
import { prepareTransitionAudio } from '../transitionAudio';

export function RotationPresentationSettings({ settings, container, onSave, onClose }: { settings: Settings; container: HTMLElement | null; onSave: (settings: Settings) => void; onClose: () => void }) {
  const [minutes, setMinutes] = useState(String(Math.floor(settings.durationSeconds / 60)));
  const [seconds, setSeconds] = useState(String(settings.durationSeconds % 60));
  const [youtubeUrl, setYoutubeUrl] = useState(settings.youtubeUrl);
  const [autoplay, setAutoplay] = useState(settings.autoplay);
  const [source, setSource] = useState(settings.transitionSource);
  const [melodyId, setMelodyId] = useState(settings.melodyId);
  const [transitionSeconds, setTransitionSeconds] = useState(settings.transitionSeconds);
  const [preview, setPreview] = useState(false);
  const duration = Number(minutes) * 60 + Number(seconds);
  const validTime = /^\d+$/.test(minutes) && /^\d+$/.test(seconds) && Number(seconds) < 60 && duration >= 5 && duration <= MAX_ROTATION_SECONDS;
  const video = parseYouTubeVideo(youtubeUrl);
  const validVideo = source !== 'youtube' || !!video;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent portalContainer={container} className="rotation-settings-dialog" onKeyDown={(event) => event.stopPropagation()}>
      <DialogHeader><DialogTitle>Timer &amp; transition</DialogTitle><DialogDescription>A quiet timer for station time, and a little music for moving on. Saved for this class.</DialogDescription></DialogHeader>
      <fieldset className="rotation-duration-fields"><legend>Time for each round</legend>
        <label>Minutes<input type="number" min="0" max="120" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label>
        <label>Seconds<input type="number" min="0" max="59" value={seconds} onChange={(event) => setSeconds(event.target.value)} /></label>
      </fieldset>
      {!validTime && <p className="rotation-settings-error">Choose between 5 seconds and 120 minutes.</p>}
      <label className="rotation-video-field">Transition music<select value={source} onChange={(event) => setSource(event.target.value as Settings['transitionSource'])}><option value="melody">Built-in tune · works offline</option><option value="youtube">YouTube video or song</option></select></label>
      {source === 'youtube' && <><label className="rotation-video-field">YouTube link<input type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="Paste a YouTube link" /></label>{!validVideo && <p className="rotation-settings-error">Use a YouTube video link, such as youtube.com/watch?v=… or youtu.be/…</p>}</>}
      <div className="rotation-tune-choices"><label className="rotation-video-field">{source === 'youtube' ? 'Fallback tune' : 'Choose a tune'}<select value={melodyId} onChange={(event) => { setPreview(false); setMelodyId(event.target.value as Settings['melodyId']); }}>{transitionMelodies.map((melody) => <option key={melody.id} value={melody.id}>{melody.name}</option>)}</select></label>
        <label className="rotation-video-field">Tune length<select value={transitionSeconds} onChange={(event) => { setPreview(false); setTransitionSeconds(Number(event.target.value) as Settings['transitionSeconds']); }}><option value={30}>30 seconds</option><option value={45}>45 seconds</option><option value={60}>60 seconds</option></select></label>
      </div>
      <Button variant="outline" onClick={() => { prepareTransitionAudio(); setPreview(!preview); }}>{preview ? 'Close preview' : 'Preview tune'}</Button>
      {preview && <TransitionMelody key={`${melodyId}:${transitionSeconds}`} melodyId={melodyId} seconds={transitionSeconds} compact />}
      <label className="rotation-autoplay-field"><input type="checkbox" checked={autoplay} onChange={(event) => setAutoplay(event.target.checked)} /><span>Play transition music when time is up<small>{source === 'youtube' ? 'If YouTube cannot start, use the fallback tune.' : 'The tune plays once. You decide when the next round starts.'}</small></span></label>
      <p className="rotation-settings-note">The timer is silent. Built-in tunes work offline. YouTube needs internet and may show ads; no student names or classroom details are sent. A start time in your link is kept. Tune length applies to built-in music.</p>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!validTime || !validVideo} onClick={() => onSave({ durationSeconds: duration, youtubeUrl: video ? canonicalYouTubeUrl(video) : '', autoplay, transitionSource: source, melodyId, transitionSeconds })}>Save settings</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
