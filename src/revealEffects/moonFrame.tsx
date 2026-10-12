import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';

/*
 * Frame bus for the Moon reveal. React renders only the scene's *structure*
 * (which layers and actors are mounted; it changes about 20 times in the
 * whole reveal). Every frame, registered writers apply transforms and a few
 * opacities straight to the DOM, computed from the same pure timeline
 * functions. No JSX is created per frame, so the scene stays light even in
 * development builds, and a fixed `time` still renders an exact still.
 */

export type FrameWriter = (T: number) => void;
export type FrameBus = { T: number; writers: Set<{ current: FrameWriter }> };
export const createFrameBus = (T = 0): FrameBus => ({ T, writers: new Set() });
export const FrameContext = createContext<FrameBus | null>(null);

/**
 * Register a per-frame writer. It runs on mount and after every render (so a
 * new structure is correct before paint) and on every clock tick.
 */
export function useFrame(write: FrameWriter) {
  const bus = useContext(FrameContext);
  const ref = useRef(write);
  useLayoutEffect(() => {
    ref.current = write;
    if (bus) write(bus.T);
  });
  useLayoutEffect(() => {
    if (!bus) return;
    bus.writers.add(ref);
    return () => { bus.writers.delete(ref); };
  }, [bus]);
}

/**
 * One rAF clock (as useSceneTime) that renders React only when the structure
 * key changes, and otherwise applies the writers directly.
 */
export function useMoonClock(durationMs: number, structureKey: (T: number) => string) {
  const [bus] = useState(() => createFrameBus(0));
  const [key, setKey] = useState(() => structureKey(0));
  const keyRef = useRef(key);
  useEffect(() => {
    const b = bus;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = Math.max(0, Math.min(durationMs, now - started));
      const T = elapsed / 1000;
      b.T = T;
      const next = structureKey(T);
      if (next !== keyRef.current) {
        keyRef.current = next;
        // Mount and unmount on this exact frame; the writers run in the layout effects.
        flushSync(() => setKey(next));
      }
      for (const writer of b.writers) writer.current(T);
      if (elapsed < durationMs) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [bus, durationMs, structureKey]);
  return { bus, T: bus.T, key };
}

// ---------------------------------------------------------------- write-if-changed helpers
type Cache = Record<string, string>;
const cacheOf = (el: Element): Cache => ((el as unknown as { __moon?: Cache }).__moon ??= {});
/** Set an attribute only when its value changes (null removes it). */
export function attr(ref: RefObject<Element | null> | Element | null, name: string, value: string | number | null) {
  const el = ref && 'current' in ref ? ref.current : ref;
  if (!el) return;
  const cache = cacheOf(el);
  const text = value === null ? '\u0000' : String(value);
  if (cache[name] === text) return;
  cache[name] = text;
  if (value === null) el.removeAttribute(name); else el.setAttribute(name, text);
}
/** Set an inline style property only when its value changes ('' clears it). */
export function css(ref: RefObject<HTMLElement | SVGElement | null> | HTMLElement | null, name: string, value: string | number) {
  const el = ref && 'current' in ref ? ref.current : ref;
  if (!el) return;
  const cache = cacheOf(el);
  const key = `style:${name}`;
  const text = String(value);
  if (cache[key] === text) return;
  cache[key] = text;
  el.style.setProperty(name, text);
}
/** Hide an SVG element (skips its paint) or show it. */
export const shown = (ref: RefObject<Element | null> | Element | null, on: boolean) => attr(ref, 'visibility', on ? null : 'hidden');

/** A stable bag of DOM nodes filled by callback refs: `ref={bind('name')}`, then `nodes.name` in a writer. */
export function useNodes<E extends Element = SVGElement>() {
  const [bag] = useState(() => {
    const nodes: Record<string, E | null> = {};
    const refs: Record<string, (el: E | null) => void> = {};
    const bind = (key: string | number) => (refs[key] ??= (el: E | null) => { nodes[key] = el; });
    return { nodes, bind };
  });
  return bag;
}
