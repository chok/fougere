/**
 * A release that goes to the end — the journal is one entity, and the sweep is an operation.
 *
 * Stated and not scanned: `frond()` is what a published package hands over, so a consumer
 * needs no TypeScript loader and no scan of its `node_modules`. The frond is BROUGHT by the
 * extension, which puts it in every process that installs it — and putting it behind
 * `remotes:` is then how two processes come to share one journal.
 */
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

/** How often a process looks for a run somebody stopped driving. */
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
        { ctor: RunRepository, deps: ['RunStorage'] },
        { ctor: LaterRepository, deps: ['LaterStorage'] },
        // Under core's own key, which is how an optional package answers a reading core declares.
        { ctor: RunJournal, deps: ['RunRepository', 'LaterRepository'], name: JOURNAL },
      ],
      // Stated, because a published package is not scanned: nothing reads this handler's
      // source at boot, so what it answers is written here.
      handlers: [{
        ctor: RunHandler,
        deps: ['RunRepository', 'Releasing'],
        operations: { sweep: { binding: [] } },
      }],
      // `sweep` leads with no verb core knows, and it is the word the subject uses — so the
      // kind is stated rather than the operation renamed.
      operationsOverrides: { sweep: { kind: 'command', binding: [] } },
    })],
    up: (app: App) => {
      if (sweepMs <= 0) return;
      const scope = app.container.resolve<Container>('frond:workflow');
      const later = scope.resolve<LaterRepository>('LaterRepository');

      /**
       * A kept call goes out from HERE and not from an operation, because making it is a
       * dispatch: an op that dispatched the due ones would answer for calls it only started.
       */
      const beatOnce = async () => {
        await app.dispatch(new Call(new RouteAddress({ entity: 'run', operation: 'sweep' })))
          .catch(() => undefined);

        for (const row of await later.due()) {
          if (await later.take(row.id) === 'busy') continue;
          // Taken and not yet done: a call that throws is left for the take to expire.
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
