import { parseYouTubeVideo } from './rotationTimer';

export const HOSTED_PLAYER_URL = 'https://excodecowboy.github.io/StudentGrouper/app/transition-player.html';

// macOS uses tauri://localhost, which cannot provide YouTube's HTTP referrer.
// A small HTTPS player page supplies that identity without sending classroom data.
export function transitionPlayerUrl(videoUrl: string, channel: string, pageUrl: string, basePath: string): string | null {
  const video = parseYouTubeVideo(videoUrl);
  if (!video) return null;
  const page = new URL(pageUrl);
  const native = !['http:', 'https:'].includes(page.protocol) || page.hostname === 'tauri.localhost';
  const url = native ? new URL(HOSTED_PLAYER_URL) : new URL(`${basePath}transition-player.html`, page);
  url.hash = new URLSearchParams({ video: video.videoId, start: String(video.startSeconds), channel }).toString();
  return url.href;
}

export type PlayerStatus = 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'blocked' | 'error';
export function readPlayerMessage(value: unknown, channel: string): { status: PlayerStatus; code?: number } | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Record<string, unknown>;
  if (message.type !== 'student-grouper-youtube' || message.channel !== channel || !['ready', 'playing', 'paused', 'ended', 'blocked', 'error'].includes(String(message.status))) return null;
  return { status: message.status as PlayerStatus, code: typeof message.code === 'number' ? message.code : undefined };
}
