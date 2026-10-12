/**
 * Wizard owl · Magic letters: the owl rig, its trail, dust and feathers as
 * Web Animations keyframes, sampled from the pure choreography in
 * wizardTimeline.ts. The browser plays them on the compositor, so nothing
 * runs per frame on the main thread (important on the Today table, where up
 * to ~48 covers share the page). Pure: no DOM, CSS or React imports.
 */
import { progress, smooth, easeOutBack } from './sceneMotion';
import {
  FEATHERS, FEATHER_END, FEATHER_START, FLUFF_HIDDEN, OWL_RIG, WIZARD_BEATS as B, WIZARD_DURATION_MS,
  featherAt, owlCenter, owlHand, owlPose, swirlArcFraction, swirlAt, swirlParam, swirlPolyline, wandTip,
  type OwlEyes, type OwlPose, type Point, type WizardLayout,
} from './wizardTimeline';

export type WizardKeyframe = { offset: number; transform?: string; opacity?: number };
export type WizardTrack = WizardKeyframe[];
/**
 * A track that only runs during its live window (delay and duration in ms). It is played with
 * fill 'none', so outside the window the element shows its base style (invisible) and, once the
 * window is over, the browser drops the animation and its compositor layer.
 */
export type TimedTrack = { frames: WizardTrack; delay: number; duration: number };

/** Samples per second. Linear interpolation between samples is smooth at 60 Hz. */
export const TRACK_FPS = 60;
const DURATION = WIZARD_DURATION_MS / 1000;
const SAMPLES = Math.round(DURATION * TRACK_FPS);
const f = (value: number) => (Math.abs(value) < 5e-4 ? 0 : +value.toFixed(3));
const offsetOf = (time: number) => Math.min(1, Math.max(0, time / DURATION));

/** Unwrap a sequence of angles so consecutive samples never differ by more than 180°. */
export function unwrapAngles(angles: readonly number[]): number[] {
  const out: number[] = [];
  angles.forEach((angle, i) => {
    if (!i) { out.push(angle); return; }
    const prev = out[i - 1];
    out.push(prev + (((angle - prev) % 360) + 540) % 360 - 180);
  });
  return out;
}

/** A discrete on/off track: opacity switches across a single sample interval. */
function stepTrack(times: readonly number[], on: (i: number) => boolean): WizardTrack {
  let last = on(0);
  const frames: WizardTrack = [{ offset: 0, opacity: last ? 1 : 0 }];
  for (let i = 1; i < times.length; i++) {
    const value = on(i);
    if (value === last) continue;
    frames.push({ offset: offsetOf(times[i - 1]), opacity: last ? 1 : 0 }, { offset: offsetOf(times[i]), opacity: value ? 1 : 0 });
    last = value;
  }
  frames.push({ offset: 1, opacity: last ? 1 : 0 });
  return frames;
}

/**
 * While an actor is invisible its position does not matter: freeze the interior of every
 * invisible run (keeping each run's first and last samples, so it fades in and out in place),
 * which lets compressTrack drop those samples.
 */
export function collapseHidden(track: WizardTrack): WizardTrack {
  const out = track.map((frame) => ({ ...frame }));
  let start = -1;
  for (let i = 0; i <= out.length; i++) {
    const hidden = i < out.length && out[i].opacity === 0;
    if (hidden && start < 0) start = i;
    if (!hidden && start >= 0) {
      for (let j = start + 1; j < i - 1; j++) out[j].transform = out[start].transform;
      start = -1;
    }
  }
  return out;
}

/** Drop samples inside constant runs (lossless: linear interpolation reproduces them). */
export function compressTrack(track: WizardTrack): WizardTrack {
  const same = (a: WizardKeyframe, b: WizardKeyframe) => a.transform === b.transform && a.opacity === b.opacity;
  return track.filter((frame, i) => i === 0 || i === track.length - 1 || !same(frame, track[i - 1]) || !same(frame, track[i + 1]));
}

export type OwlTracks = {
  root: WizardTrack; fluff: WizardTrack; wingR: WizardTrack; wingL: WizardTrack; body: WizardTrack; satchel: WizardTrack;
  eyes: Record<'open' | 'lids' | 'happy' | 'wide' | 'wink' | 'blink', WizardTrack>;
  pupils: WizardTrack; blush: WizardTrack; wand: WizardTrack; wandGlow: WizardTrack; hat: WizardTrack;
};

export type WizardTracks = {
  times: number[];
  poses: OwlPose[];
  owl: OwlTracks;
  dust: TimedTrack[];
  feathers: TimedTrack[];
  trail: TimedTrack;
  /** The ribbon, cut into segments that switch on behind the owl. `cap` rounds the glow at the ribbon's two ends. */
  segments: { d: string; cap: string | null; left: number; top: number; width: number; height: number; track: TimedTrack }[];
  glints: { x: number; y: number; track: TimedTrack }[];
  zap: TimedTrack;
  hop: TimedTrack | null;
};

/** When the gold ribbon (and its glints) is gone: it squeezes into the star after the tap. */
export const TRAIL_END = 4.32;

/**
 * Cut a full-length sampled track (one keyframe per trackTimes() sample) down to its live
 * window [start, end] (seconds, widened to whole samples), re-offset to that window.
 */
export function windowTrack(track: WizardTrack, start: number, end: number): TimedTrack {
  const i0 = Math.max(0, Math.floor(start * TRACK_FPS + 1e-6));
  const i1 = Math.min(track.length - 1, Math.max(i0 + 1, Math.ceil(end * TRACK_FPS - 1e-6)));
  const t0 = i0 / TRACK_FPS, t1 = i1 / TRACK_FPS;
  const frames = track.slice(i0, i1 + 1).map((frame, j) => ({ ...frame, offset: j === i1 - i0 ? 1 : +(j / (i1 - i0)).toFixed(6) }));
  return { frames: compressTrack(collapseHidden(frames)), delay: +(t0 * 1000).toFixed(3), duration: +((t1 - t0) * 1000).toFixed(3) };
}

/** Sample times: every 1/60 s from 0 to the end of the reveal, plus exact beats that must land on a frame. */
export function trackTimes(): number[] {
  return Array.from({ length: SAMPLES + 1 }, (_, i) => +(i / TRACK_FPS).toFixed(6));
}

export function wizardTracks(layout: WizardLayout): WizardTracks {
  const times = trackTimes();
  const poses = times.map((time) => owlPose(time, layout));
  const k = layout.S / 100;
  const rot = unwrapAngles(poses.map((pose) => pose.rot));
  // The wand's rotation as drawn: mirrored (negated) in the right wing. While it is put away it waits
  // at the angle it will reappear with, so it never spins as it fades back in.
  const drawnWand = poses.map((pose) => (pose.wand === null ? null : (pose.wandSide < 0 ? 1 : -1) * pose.wand));
  for (let i = drawnWand.length - 2; i >= 0; i--) if (drawnWand[i] === null) drawnWand[i] = drawnWand[i + 1];
  const wand = unwrapAngles(drawnWand.map((angle) => angle ?? 0));
  const hatRot = unwrapAngles(poses.map((pose) => pose.hatRot));

  const root = poses.map((pose, i): WizardKeyframe => ({
    offset: offsetOf(times[i]),
    transform: `translate(${f(pose.x)}px, ${f(pose.y)}px) rotate(${f(rot[i])}deg) scale(${f(pose.scale)}, ${f(pose.scale * pose.squashY)})`,
    opacity: f(pose.opacity),
  }));
  // The fluff is solid: it only ever scales (out from behind the body and back under it), then hides in one step.
  const fluff = poses.map((pose, i): WizardKeyframe => ({ offset: offsetOf(times[i]), transform: `scale(${f(Math.max(FLUFF_HIDDEN, pose.fluff))})`, opacity: pose.fluff > 0 ? 1 : 0 }));
  const body = poses.map((pose, i): WizardKeyframe => ({ offset: offsetOf(times[i]), transform: `scale(${f(pose.bodyScale)})` }));
  const wingR = poses.map((pose, i): WizardKeyframe => ({ offset: offsetOf(times[i]), transform: `translate(${f(40 * pose.bodyScale * k)}px, ${f(-5 * pose.bodyScale * k)}px) rotate(${f(pose.wingR)}deg)` }));
  const wingL = poses.map((pose, i): WizardKeyframe => ({ offset: offsetOf(times[i]), transform: `translate(${f(-40 * pose.bodyScale * k)}px, ${f(-5 * pose.bodyScale * k)}px) scale(-1, 1) rotate(${f(pose.wingL)}deg)` }));
  const wandTrack = poses.map((pose, i): WizardKeyframe => {
    const side = pose.wandSide;
    const hand = owlHand(side, side < 0 ? pose.wingL : pose.wingR);
    const shown = pose.wand !== null && pose.wandScale > 0.01;
    const s = Math.max(0.001, pose.wandScale);
    return { offset: offsetOf(times[i]), transform: `translate(${f(hand.x * pose.bodyScale * k)}px, ${f(hand.y * pose.bodyScale * k)}px) rotate(${f(wand[i])}deg) scale(${f(side < 0 ? s : -s)}, ${f(s)})`, opacity: shown ? 1 : 0 };
  });
  // The tip glow is drawn with a 20-unit radius; scale it to the pose's glow and flash.
  const wandGlow = poses.map((pose, i): WizardKeyframe => ({ offset: offsetOf(times[i]), transform: `scale(${f((14 * pose.wandGlow + 22 * pose.wandFlash) / 20)})` }));
  const hat = poses.map((pose, i): WizardKeyframe => {
    const pivot = OWL_RIG.hatPivot.y * k;
    return { offset: offsetOf(times[i]), transform: `translate(${f(pose.hatX * k)}px, ${f((pose.hatY - 56 * (pose.bodyScale - 1)) * k + pivot)}px) rotate(${f(hatRot[i])}deg) translate(0px, ${f(-pivot)}px)` };
  });
  const pupils = poses.map((pose, i): WizardKeyframe => ({ offset: offsetOf(times[i]), transform: `translate(${f(pose.pupilX * k)}px, ${f((pose.pupilY + (pose.eyes === 'squint' ? 2 : 0)) * k)}px)` }));
  const blush = poses.map((pose, i): WizardKeyframe => ({ offset: offsetOf(times[i]), opacity: f(pose.blush) }));
  const eyesIs = (...states: OwlEyes[]) => stepTrack(times, (i) => states.includes(poses[i].eyes));
  const owl: OwlTracks = {
    root, fluff, body, wingR, wingL, wand: wandTrack, wandGlow, hat, pupils, blush,
    satchel: stepTrack(times, (i) => poses[i].fluff < 0.95),
    eyes: { open: eyesIs('open', 'squint'), lids: eyesIs('squint'), happy: eyesIs('happy'), wide: eyesIs('wide'), wink: eyesIs('wink'), blink: eyesIs('blink') },
  };

  // Sparkle dust: seven motes trailing the owl's path (0.045 s apart), smaller and fainter with age.
  const dust = Array.from({ length: 7 }, (_, j) => times.map((time, i): WizardKeyframe => {
    const p = owlCenter(time - (j + 1) * 0.045, layout);
    const fade = 1 - (j + 1) / 8;
    return { offset: offsetOf(time), transform: `translate(${f(p.x)}px, ${f(p.y + 0.18 * layout.S)}px)`, opacity: f(poses[i].opacity > 0 ? 0.8 * fade * poses[i].dust : 0) };
  }));

  const feathers = FEATHERS.map((_, j) => times.map((time): WizardKeyframe => {
    const feather = featherAt(j, time, layout);
    return { offset: offsetOf(time), transform: `translate(${f(feather.x)}px, ${f(feather.y)}px) rotate(${f(feather.rot)}deg) scale(${f(Math.max(0.001, feather.scale))})`, opacity: f(Math.max(0, feather.opacity)) };
  }));

  // Trail: the gold ribbon is cut into short segments that switch on as the owl passes their far end,
  // then the whole ribbon squeezes into the star at the tap.
  const { star } = layout;
  const trail = times.map((time): WizardKeyframe => {
    const collapse = progress(time, B.tap, TRAIL_END);
    const shown = time >= B.swirlStart && time < TRAIL_END ? 1 - collapse : 0;
    return { offset: offsetOf(time), transform: `scale(${f(1 - 0.9 * collapse)})`, opacity: f(shown) };
  });
  const arcAt = times.map((time) => (time <= B.swirlStart ? 0 : swirlArcFraction(layout, swirlParam(time))));
  const width = trailWidth(layout);
  // A fine polyline keeps the kinks at segment joints tiny (the translucent glow is butt-capped there).
  const points = swirlPolyline(layout, TRAIL_POINTS);
  const segments: WizardTracks['segments'] = [];
  const glowRadius = 1.5 * width;
  for (let start = 0; start < points.length - 1; start += TRAIL_PER_SEGMENT) {
    const run = points.slice(start, Math.min(points.length, start + TRAIL_PER_SEGMENT + 1));
    const endArc = (start + run.length - 1) / (points.length - 1);
    const pad = width * 1.8 + 2;
    const xs = run.map((p) => p.x), ys = run.map((p) => p.y);
    const left = Math.min(...xs) - pad, top = Math.min(...ys) - pad;
    const d = `M${run.map((p) => `${f(p.x - left)} ${f(p.y - top)}`).join('L')}`;
    // Round the glow's two outer ends with a half-disc past the end point (no overlap, so no double alpha).
    const caps: string[] = [];
    if (start === 0) caps.push(halfDisc(run[0], run[1], glowRadius, left, top));
    if (start + run.length >= points.length) caps.push(halfDisc(run[run.length - 1], run[run.length - 2], glowRadius, left, top));
    const appear = times.find((_, i) => arcAt[i] >= endArc - 1e-6) ?? B.swirlEnd;
    // On from the moment the owl passes its far end until the ribbon is gone (off, and unanimated, otherwise).
    const track: TimedTrack = { frames: [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }], delay: +(appear * 1000).toFixed(3), duration: +((TRAIL_END - appear) * 1000).toFixed(3) };
    segments.push({ d, cap: caps.length ? caps.join('') : null, left, top, width: Math.max(...xs) - left + pad, height: Math.max(...ys) - top + pad, track });
  }
  const glintAt = [0.1, 1 / 4.5, 0.34, 0.46, 0.56, 3 / 4.5, 0.79, 0.9];
  const glints = glintAt.map((u, j) => {
    const p = swirlAt(layout, u);
    const reached = times.find((time) => time > B.swirlStart && swirlParam(time) >= u) ?? B.swirlEnd;
    const track = times.map((time): WizardKeyframe => {
      if (time < reached || time >= TRAIL_END) return { offset: offsetOf(time), transform: 'scale(0)', opacity: 0 };
      const pop = easeOutBack(Math.min(1, (time - reached) / 0.08), 2.2);
      const twinkle = 1 + 0.18 * Math.sin(time * 14 + j * 1.7);
      return { offset: offsetOf(time), transform: `scale(${f(pop * twinkle)})`, opacity: 1 };
    });
    return { x: p.x, y: p.y, track: windowTrack(track, reached, TRAIL_END) };
  });

  // The wand's zap: a spark leaps from the wand tip into the centre of the star at the tap.
  const zap = times.map((time, i): WizardKeyframe => {
    const tip = wandTip(poses[i], layout.S) ?? star;
    const k2 = smooth(progress(time, B.tap, 4.21));
    const on = time >= B.tap && time <= 4.23 ? 1 - progress(time, 4.2, 4.23) : 0;
    return { offset: offsetOf(time), transform: `translate(${f(tip.x + (star.x - tip.x) * k2)}px, ${f(tip.y + (star.y - tip.y) * k2)}px)`, opacity: f(on) };
  });
  // If the boop point had to be clamped (seal too near the header or footer), a spark hops the gap.
  const boop = layout.boop;
  const hop = boop?.clamped ? times.map((time, i): WizardKeyframe => {
    const tip: Point = wandTip(poses[i], layout.S) ?? boop.seal;
    const k2 = progress(time, 5.96, B.boop);
    return { offset: offsetOf(time), transform: `translate(${f(tip.x + (boop.seal.x - tip.x) * k2)}px, ${f(tip.y + (boop.seal.y - tip.y) * k2)}px)`, opacity: time >= 5.96 && time <= 6.02 ? 1 : 0 };
  }) : null;

  const c = (track: WizardTrack) => compressTrack(collapseHidden(track));
  const owlCompressed: OwlTracks = {
    root: c(owl.root), fluff: c(owl.fluff), body: c(owl.body), wingR: c(owl.wingR), wingL: c(owl.wingL), wand: c(owl.wand), wandGlow: c(owl.wandGlow),
    hat: c(owl.hat), pupils: c(owl.pupils), blush: c(owl.blush), satchel: owl.satchel,
    eyes: owl.eyes,
  };
  return {
    times, poses, owl: owlCompressed,
    dust: dust.map((track) => windowTrack(track, B.passStart, B.exitEnd)),
    feathers: feathers.map((track) => windowTrack(track, FEATHER_START, FEATHER_END)),
    trail: windowTrack(trail, B.swirlStart, TRAIL_END),
    segments, glints,
    zap: windowTrack(zap, B.tap, 4.23),
    hop: hop ? windowTrack(hop, 5.96, 6.02) : null,
  };
}

export const TRAIL_POINTS = 360;
export const TRAIL_PER_SEGMENT = 12;

/** A half-disc of radius r beyond `end`, facing away from `inner` (segment-local coordinates). */
function halfDisc(end: Point, inner: Point, r: number, left: number, top: number) {
  const dx = end.x - inner.x, dy = end.y - inner.y, d = Math.max(1e-6, Math.hypot(dx, dy));
  const ux = dx / d, uy = dy / d;
  const points = Array.from({ length: 13 }, (_, i) => {
    const a = -Math.PI / 2 + Math.PI * i / 12;
    // Rotate (cos a, sin a) from the +x axis onto the outward direction u.
    const cx = Math.cos(a), cy = Math.sin(a);
    return `${f(end.x - left + r * (cx * ux - cy * uy))} ${f(end.y - top + r * (cx * uy + cy * ux))}`;
  });
  return `M${points.join('L')}Z`;
}

/** Trail core stroke width (px). */
export function trailWidth(layout: Pick<WizardLayout, 'm'>) { return Math.max(5, Math.min(10, 0.007 * layout.m)); }
