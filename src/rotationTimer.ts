import type { RotationPresentationSettings } from './model';

export const DEFAULT_ROTATION_SECONDS = 15 * 60;
export const MAX_ROTATION_SECONDS = 120 * 60;
export const defaultPresentationSettings: RotationPresentationSettings = {
  durationSeconds: DEFAULT_ROTATION_SECONDS,
  youtubeUrl: '',
  autoplay: false,
  transitionSource: 'melody',
  melodyId: 'sunny',
  transitionSeconds: 45,
};

export function parseYouTubeVideo(input: string): { videoId: string; startSeconds: number } | null {
  try {
    const url = new URL(input.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);
    let id: string | null = null;
    if (host === 'youtu.be' && parts.length === 1) id = parts[0];
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'].includes(host)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else if (['embed', 'shorts', 'live'].includes(parts[0]) && parts.length === 2) id = parts[1];
    }
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    const time = url.searchParams.get('start') ?? url.searchParams.get('t') ?? new URLSearchParams(url.hash.slice(1)).get('t') ?? '0';
    const units = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(time);
    const seconds = /^\d+$/.test(time) ? Number(time) : units ? Number(units[1] ?? 0) * 3600 + Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0) : 0;
    return { videoId: id, startSeconds: Number.isSafeInteger(seconds) ? Math.min(seconds, 86400) : 0 };
  } catch { return null; }
}

export function canonicalYouTubeUrl(video: { videoId: string; startSeconds: number }): string {
  return `https://www.youtube.com/watch?v=${video.videoId}${video.startSeconds ? `&t=${video.startSeconds}s` : ''}`;
}

export function normalizePresentationSettings(value?: Partial<RotationPresentationSettings> | null): RotationPresentationSettings {
  const seconds = value?.durationSeconds;
  const video = typeof value?.youtubeUrl === 'string' ? parseYouTubeVideo(value.youtubeUrl) : null;
  return {
    durationSeconds: Number.isSafeInteger(seconds) && seconds! >= 5 && seconds! <= MAX_ROTATION_SECONDS ? seconds! : DEFAULT_ROTATION_SECONDS,
    youtubeUrl: video ? canonicalYouTubeUrl(video) : '',
    autoplay: value?.autoplay === true,
    transitionSource: value?.transitionSource === 'youtube' && video ? 'youtube' : 'melody',
    melodyId: ['sunny', 'tiptoe', 'starlight', 'meadow'].includes(value?.melodyId ?? '') ? value!.melodyId! : 'sunny',
    transitionSeconds: [30, 45, 60].includes(value?.transitionSeconds ?? 0) ? value!.transitionSeconds! : 45,
  };
}

export type RotationClock = {
  roundId: string;
  status: 'idle' | 'running' | 'paused' | 'finished';
  durationMs: number;
  remainingMs: number;
  endsAt: number | null;
  runId: number;
};
export type ClockAction =
  | { type: 'tick' | 'start' | 'pause' | 'add-minute'; now: number }
  | { type: 'reset'; durationSeconds: number }
  | { type: 'round'; roundId: string; durationSeconds: number; start?: boolean; now: number };

export function createRotationClock(roundId: string, durationSeconds: number, runId = 0): RotationClock {
  const durationMs = normalizePresentationSettings({ durationSeconds }).durationSeconds * 1000;
  return { roundId, status: 'idle', durationMs, remainingMs: durationMs, endsAt: null, runId };
}

export function remainingRotationMs(clock: RotationClock, now: number): number {
  return Math.max(0, clock.status === 'running' && clock.endsAt !== null ? clock.endsAt - now : clock.remainingMs);
}

export function reduceRotationClock(clock: RotationClock, action: ClockAction): RotationClock {
  if (action.type === 'reset') return createRotationClock(clock.roundId, action.durationSeconds, clock.runId);
  if (action.type === 'round') {
    const next = createRotationClock(action.roundId, action.durationSeconds, clock.runId);
    return action.start ? reduceRotationClock(next, { type: 'start', now: action.now }) : next;
  }
  const remainingMs = remainingRotationMs(clock, action.now);
  if (action.type === 'tick') {
    return clock.status === 'running' && remainingMs === 0 ? { ...clock, remainingMs: 0, endsAt: null, status: 'finished' } : clock;
  }
  if (action.type === 'pause') {
    return clock.status === 'running' ? { ...clock, status: remainingMs ? 'paused' : 'finished', remainingMs, endsAt: null } : clock;
  }
  if (action.type === 'start') {
    if (clock.status === 'running') return clock;
    const restarting = clock.status === 'finished' || remainingMs === 0;
    const nextRemaining = restarting ? clock.durationMs : remainingMs;
    return { ...clock, status: 'running', remainingMs: nextRemaining, endsAt: action.now + nextRemaining, runId: clock.status === 'paused' && !restarting ? clock.runId : clock.runId + 1 };
  }
  const nextRemaining = Math.min(MAX_ROTATION_SECONDS * 1000, remainingMs + 60000);
  return { ...clock, remainingMs: nextRemaining, durationMs: Math.max(clock.durationMs, nextRemaining), endsAt: clock.status === 'running' ? action.now + nextRemaining : null, status: clock.status === 'finished' ? 'paused' : clock.status };
}

export function formatRotationTime(milliseconds: number): string {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
