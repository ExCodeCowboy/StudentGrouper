import { useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink, Play, RotateCcw } from 'lucide-react';
import { randomUuid } from '../platform';
import { readPlayerMessage, transitionPlayerUrl, type PlayerStatus } from '../youtubePlayer';

export function TransitionVideo({ youtubeUrl, onUnavailable }: { youtubeUrl: string; onUnavailable: () => void }) {
  const [channel] = useState(randomUuid);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>('loading');
  const [copied, setCopied] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const url = transitionPlayerUrl(youtubeUrl, channel, window.location.href, import.meta.env.BASE_URL);
  const origin = url ? new URL(url).origin : '';
  const browserLinks = ['http:', 'https:'].includes(window.location.protocol) && window.location.hostname !== 'tauri.localhost';
  const wantsPlay = useRef(true);
  const ready = useRef(false);
  const isVisible = useRef(false);
  const unavailable = useRef(onUnavailable);
  useEffect(() => { unavailable.current = onUnavailable; }, [onUnavailable]);
  const command = (action: 'play' | 'pause') => frame.current?.contentWindow?.postMessage({ type: 'student-grouper-youtube-command', channel, command: action }, origin);

  useEffect(() => {
    if (!url) return;
    ready.current = false;
    wantsPlay.current = true;
    let active = true;
    let hasPlayed = false;
    const deadline = Date.now() + 8000;
    const tryPlay = () => {
      if (ready.current && wantsPlay.current && isVisible.current && document.visibilityState !== 'hidden') {
        wantsPlay.current = false;
        frame.current?.contentWindow?.postMessage({ type: 'student-grouper-youtube-command', channel, command: 'play' }, origin);
      }
    };
    const listener = (event: MessageEvent) => {
      if (!active || event.source !== frame.current?.contentWindow || event.origin !== origin) return;
      const message = readPlayerMessage(event.data, channel);
      if (!message) return;
      setStatus(message.status);
      if (message.status === 'ready') { ready.current = true; setCanPlay(true); tryPlay(); }
      if (message.status === 'playing') hasPlayed = true;
      if (message.status === 'error' || message.status === 'blocked') unavailable.current();
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        frame.current?.contentWindow?.postMessage({ type: 'student-grouper-youtube-command', channel, command: 'pause' }, origin);
      } else {
        if (!hasPlayed && Date.now() >= deadline) unavailable.current();
        else tryPlay();
      }
    };
    const observer = new IntersectionObserver(([entry]) => { isVisible.current = entry.intersectionRatio > 0.5; tryPlay(); }, { threshold: [0, 0.5, 1] });
    if (frame.current) observer.observe(frame.current);
    window.addEventListener('message', listener);
    document.addEventListener('visibilitychange', visibility);
    const timeout = window.setTimeout(() => { if (!hasPlayed && document.visibilityState !== 'hidden') unavailable.current(); }, 8000);
    return () => { active = false; observer.disconnect(); window.clearTimeout(timeout); window.removeEventListener('message', listener); document.removeEventListener('visibilitychange', visibility); };
  }, [url, origin, channel, attempt]);

  if (!url) return <p>Choose a YouTube video in Timer &amp; transition.</p>;
  const help = status === 'blocked' ? 'Automatic playback was blocked. Press Play here or in the video.'
    : status === 'error' ? 'YouTube could not play here. Check your connection, try again, or open the video on YouTube.'
    : status === 'loading' ? 'Connecting to YouTube…' : status === 'ended' ? 'Ready for the next round?' : status === 'playing' ? 'Your transition video is playing. Tidy up, then get ready for your next station.' : 'Press Play here or in the video to begin.';
  return <div className="transition-video">
    <iframe key={attempt} ref={frame} src={url} title="YouTube transition video" allow="autoplay; fullscreen; encrypted-media; picture-in-picture; camera 'none'; microphone 'none'; display-capture 'none'" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    <output>{help}</output>
    <div className="transition-video-actions">
      <button type="button" onClick={() => command('play')} disabled={!canPlay}><Play />{status === 'ended' ? 'Play again' : 'Play video'}</button>
      <button type="button" onClick={() => { setStatus('loading'); setCanPlay(false); setAttempt((value) => value + 1); }}><RotateCcw />Reload video</button>
      {browserLinks && <a href={youtubeUrl} target="_blank" rel="noopener"><ExternalLink />Open YouTube</a>}
      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(youtubeUrl); setCopied(true); } catch { setCopied(false); } }}><Copy />{copied ? 'Copied' : 'Copy link'}</button>
    </div>
  </div>;
}
