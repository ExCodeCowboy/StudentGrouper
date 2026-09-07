import { useCallback, useRef, useState } from 'react';
import { createClip, parseClip, serializeClip, type ClipDocument } from './model';

const STORAGE_KEY = 'student-grouper-animation-workbench-v1';
export function useClipHistory() {
  const [initial] = useState(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY); return { clip: saved ? parseClip(saved) : createClip(), warning: '' }; }
    catch { return { clip: createClip(), warning: 'The saved draft could not be read. Export your work regularly.' }; }
  });
  const [clip, setClip] = useState(initial.clip);
  const [saveWarning, setSaveWarning] = useState(initial.warning);
  const current = useRef(clip);
  const past = useRef<ClipDocument[]>([]);
  const future = useRef<ClipDocument[]>([]);
  const transaction = useRef<ClipDocument | null>(null);
  const [counts, setCounts] = useState({ past:0, future:0 });
  const persist = useCallback((next:ClipDocument) => {
    try { localStorage.setItem(STORAGE_KEY, serializeClip(next)); }
    catch { setSaveWarning('Browser storage is unavailable. Use Export to keep this draft.'); }
  }, []);
  const refresh = useCallback(() => setCounts({past:past.current.length,future:future.current.length}),[]);
  const apply = useCallback((next: ClipDocument) => {
    if (serializeClip(next) === serializeClip(current.current)) return;
    if (!transaction.current) { past.current = [...past.current.slice(-79), current.current]; future.current = []; }
    current.current = next; setClip(next); persist(next);refresh();
  }, [persist,refresh]);
  const begin = useCallback(() => { transaction.current ??= current.current; }, []);
  const end = useCallback(() => {
    if (transaction.current && serializeClip(transaction.current) !== serializeClip(current.current)) {
      past.current = [...past.current.slice(-79), transaction.current]; future.current = [];
    }
    transaction.current = null; refresh();
  }, [refresh]);
  const undo = useCallback(() => {
    end(); const previous = past.current.pop(); if (!previous) return;
    future.current.push(current.current); current.current = previous; setClip(previous);persist(previous);refresh();
  }, [end,persist,refresh]);
  const redo = useCallback(() => {
    end(); const next = future.current.pop(); if (!next) return;
    past.current.push(current.current); current.current = next; setClip(next);persist(next);refresh();
  }, [end,persist,refresh]);
  return { clip, apply, begin, end, undo, redo, canUndo: counts.past > 0, canRedo: counts.future > 0, saveWarning };
}
