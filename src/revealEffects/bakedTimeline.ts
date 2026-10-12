import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Baked scene clock.
 *
 * Illustrated reveals keep their choreography as pure pose functions of time
 * (deterministic, testable). Instead of re-rendering React every frame, each
 * actor's track is sampled once at mount into Web Animations keyframes, and
 * the browser plays them on the compositor: no per-frame main-thread commits.
 * The reveal lab still freezes exact frames because it seeks every
 * `document.getAnimations()` entry, which includes these.
 */

/** A pose function: seconds since the reveal started -> one keyframe (transform/opacity strings or numbers). */
export type TrackSample = (seconds: number) => Keyframe;

export const BAKE_FPS = 60;

/**
 * Sample a track at `fps` over `durationMs`: `round(duration * fps) + 1`
 * keyframes, offsets 0..1, keyframe i taken at `i * duration / count` seconds
 * (exactly `i / fps` when the duration is a whole number of frames).
 */
export function sampleTrack(sample: TrackSample, durationMs: number, fps = BAKE_FPS): Keyframe[] {
  const seconds = durationMs / 1000;
  const count = Math.max(1, Math.round(seconds * fps));
  const frames: Keyframe[] = [];
  for (let index = 0; index <= count; index++) frames.push({ ...sample((index * seconds) / count), offset: index / count });
  return frames;
}

function sameValues(a: Keyframe, b: Keyframe) {
  const keys = Object.keys(a).filter((key) => key !== 'offset');
  if (keys.length !== Object.keys(b).filter((key) => key !== 'offset').length) return false;
  return keys.every((key) => a[key] === b[key]);
}

/**
 * Drop interior keyframes that repeat both neighbours. Playback is linear, so
 * a run of identical values interpolates to the same values from its two
 * endpoints alone: the result plays back identically with far fewer frames
 * (opacity tracks that sit at 0 or 1 for most of a reveal shrink to a handful).
 */
export function compactKeyframes(frames: readonly Keyframe[]): Keyframe[] {
  if (frames.length <= 2) return [...frames];
  const kept: Keyframe[] = [frames[0]];
  for (let index = 1; index < frames.length - 1; index++) {
    if (!(sameValues(frames[index], frames[index - 1]) && sameValues(frames[index], frames[index + 1]))) kept.push(frames[index]);
  }
  kept.push(frames[frames.length - 1]);
  return kept;
}

/**
 * One element and what drives it (missing elements are skipped): either a pose
 * function sampled over the whole reveal, or ready-made keyframes with their own
 * timing (loops, delayed one-shots).
 */
export type BakedTrack =
  | { target: Element | null | undefined; sample: TrackSample }
  | { target: Element | null | undefined; keyframes: Keyframe[]; timing: KeyframeEffectOptions };

/**
 * A shared playhead for several `useBakedTracks` calls in one reveal. The first tracks baked become the
 * reference; tracks baked later (a deferred mount, to keep the first frame light) join it at the same
 * moment instead of starting from zero, and pause with it when a paused reference is being scrubbed.
 */
export type BakedClock = RefObject<Animation | null>;

/** Put `animation` on the same moment (and play state) as `reference`. */
export function joinClock(animation: Animation, reference: Animation) {
  if (reference.playState === 'paused') {
    animation.pause();
    animation.currentTime = reference.currentTime;
  } else if (reference.startTime !== null && reference.playbackRate === 1) {
    animation.startTime = reference.startTime;
  } else {
    animation.currentTime = reference.currentTime;
  }
}

/**
 * Play baked tracks for the lifetime of the component. `bake` runs inside a
 * layout effect (after refs attach), so it may look up DOM nodes. It should be
 * memoised (e.g. `useCallback` on the viewport size): when it changes the
 * tracks are re-sampled and resume at the same moment instead of restarting.
 * With a `clockRef` (a `useRef` shared by the calls), tracks baked after others already started join them in step.
 * With an `origin` (a timeline time, e.g. `performance.now()` when the reveal started), the first tracks count from it
 * instead of from their first frame: a slow mount then skips ahead rather than running late against the reveal's stop
 * timer and its sound (both start at the click).
 * Unmounting cancels every animation, so nothing outlives the reveal.
 */
export function useBakedTracks(bake: () => readonly BakedTrack[], durationMs: number, fps = BAKE_FPS, clockRef?: BakedClock, origin?: number) {
  const resumeAt = useRef(0);
  useLayoutEffect(() => {
    const animations: Animation[] = [];
    const reference = clockRef?.current && clockRef.current.playState !== 'idle' ? clockRef.current : null;
    for (const track of bake()) {
      const element = track.target;
      if (!element || typeof element.animate !== 'function') continue;
      const animation = 'sample' in track
        ? element.animate(compactKeyframes(sampleTrack(track.sample, durationMs, fps)), { duration: durationMs, fill: 'both', easing: 'linear' })
        : element.animate(track.keyframes, { fill: 'both', ...track.timing });
      if (resumeAt.current > 0) animation.currentTime = resumeAt.current;
      else if (reference) joinClock(animation, reference);
      else if (origin !== undefined && Number.isFinite(origin)) animation.startTime = origin;
      animations.push(animation);
    }
    if (clockRef && !reference && animations.length > 0) clockRef.current = animations[0];
    return () => {
      const reached = animations[0]?.currentTime;
      resumeAt.current = typeof reached === 'number' ? Math.min(reached, durationMs) : 0;
      if (clockRef && animations.includes(clockRef.current as Animation)) clockRef.current = null;
      for (const animation of animations) animation.cancel();
    };
  }, [bake, durationMs, fps, clockRef, origin]);
}
