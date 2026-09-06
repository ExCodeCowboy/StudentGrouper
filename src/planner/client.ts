import type { Classroom } from '../model';
import type { PlannerResult } from './optimizer';

export type PlannerRequest = {
  classroom: Classroom;
  blockId: string;
  preserveSessionIds?: string[];
};
export type PlannerMessage =
  | { type: 'progress'; label: string }
  | { type: 'result'; result: PlannerResult }
  | { type: 'error'; message: string };
export type PlannerTask = {
  promise: Promise<PlannerResult>;
  cancel: () => void;
};
export type PlannerWorker = Pick<
  Worker,
  'postMessage' | 'terminate' | 'onmessage' | 'onerror'
>;

export function plannerInputKey(classroom: Classroom) {
  const {
    activeSessionId: _day,
    activeGroupSetId: _groups,
    ...input
  } = classroom;
  return JSON.stringify(input);
}

export function startBlockPlanner(
  request: PlannerRequest,
  onProgress: (label: string) => void,
  // Production has a self-contained classic worker for older WebKit; Vite's
  // development server serves the source as modules.
  factory: () => PlannerWorker = () =>
    import.meta.env.PROD
      ? new Worker(new URL('./planner.worker.ts', import.meta.url))
      : new Worker(new URL('./planner.worker.ts', import.meta.url), {
          type: 'module',
        }),
): PlannerTask {
  const worker = factory();
  let rejectTask: (reason: Error) => void;
  let settled = false;
  let timeout: ReturnType<typeof setTimeout>;
  const finish = () => {
    settled = true;
    clearTimeout(timeout);
    worker.terminate();
  };
  const promise = new Promise<PlannerResult>((resolve, reject) => {
    rejectTask = reject;
    worker.onmessage = (event: MessageEvent<PlannerMessage>) => {
      if (settled) return;
      const message = event.data;
      if (message.type === 'progress') onProgress(message.label);
      else if (message.type === 'result') {
        finish();
        resolve(message.result);
      } else {
        finish();
        reject(new Error(message.message));
      }
    };
    worker.onerror = () => {
      if (!settled) {
        finish();
        reject(
          new Error(
            'The planner could not start on this device. Your plan has not changed.',
          ),
        );
      }
    };
    timeout = setTimeout(() => {
      if (!settled) {
        finish();
        reject(
          new Error(
            'The planner took too long to respond. Your plan has not changed.',
          ),
        );
      }
    }, 45_000);
    worker.postMessage(request);
  });
  return {
    promise,
    cancel: () => {
      if (!settled) {
        finish();
        rejectTask(new DOMException('Planning canceled', 'AbortError'));
      }
    },
  };
}
