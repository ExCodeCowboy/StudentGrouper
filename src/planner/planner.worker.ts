import highsLoader from 'highs';
import wasmUrl from 'highs/runtime?url';
import { optimizePlanningBlock } from './optimizer';
import type { PlannerRequest, PlannerMessage } from './client';

const send = (message: PlannerMessage) => self.postMessage(message);
self.onmessage = async (event: MessageEvent<PlannerRequest>) => {
  try {
    send({ type: 'progress', label: 'Preparing the whole block' });
    const engine = await highsLoader({ locateFile: () => wasmUrl });
    const request = event.data;
    const result = optimizePlanningBlock(
      engine,
      request.classroom,
      request.blockId,
      {
        preserveSessionIds: request.preserveSessionIds,
        onProgress: () =>
          send({
            type: 'progress',
            label: 'Balancing turns across the whole block',
          }),
      },
    );
    send({ type: 'result', result });
  } catch {
    send({
      type: 'error',
      message:
        'The planner could not finish on this device. Your plan has not changed.',
    });
  }
};
