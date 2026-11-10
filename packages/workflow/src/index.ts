import type { Container } from '@fougere/container';
import { Call, frond, JOURNAL, releasing, RouteAddress, type App, type Extension } from '@fougere/core';
import Later from './Later.js';
import LaterRepository from './LaterRepository.js';
import Run from './Run.js';
import RunRepository from './RunRepository.js';
import RunJournal from './RunJournal.js';
import RunHandler from './RunHandler.js';

export { default as Later } from './Later.js';
export { default as LaterRepository } from './LaterRepository.js';
export { default as Run } from './Run.js';
export { default as RunRepository } from './RunRepository.js';
export { default as RunJournal } from './RunJournal.js';
export { default as RunHandler } from './RunHandler.js';

const SWEEP_MS = 10_000;

export interface WorkflowOptions {
  /** Milliseconds between sweeps. `0` never sweeps — a test drives `sweep()` itself. */
  sweepMs?: number;
}

export function workflow({ sweepMs = SWEEP_MS }: WorkflowOptions = {}): Extension {
  let beat: ReturnType<typeof setInterval> | undefined;

  return {
    name: 'workflow',
    fronds: [frond('workflow', {
      entities: [Run, Later],
      providers: [
        { ctor: RunRepository, repository: Run },
        { ctor: LaterRepository, repository: Later },
        { ctor: RunJournal, deps: ['RunRepository', 'LaterRepository'], name: JOURNAL },
      ],
      handlers: [{
        ctor: RunHandler,
        deps: ['RunRepository', 'Releasing'],
        operations: { sweep: { binding: [] } },
      }],
      operationsOverrides: { 'run.sweep': { kind: 'command', binding: [] } },
    })],
    up: (app: App) => {
      if (sweepMs <= 0) return;
      const scope = app.container.resolve<Container>('frond:workflow');
      const later = scope.resolve<LaterRepository>('LaterRepository');

      const beatOnce = async () => {
        await app.dispatch(new Call(new RouteAddress({ address: 'run', operation: 'sweep' })))
          .catch(() => undefined);

        for (const row of await later.due()) {
          if (await later.take(row.id) === 'busy') continue;
          await app.dispatch(later.callOf(row)).then(() => later.done(row.id), () => undefined);
        }
      };

      beat = setInterval(() => { void beatOnce().catch(() => undefined); }, sweepMs);
      beat.unref?.();
    },
    down: () => { if (beat) clearInterval(beat); },
  };
}

export { releasing };
