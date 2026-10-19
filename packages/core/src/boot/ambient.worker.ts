/**
 * A Worker's realization, chosen when it runs rather than when it is bundled: `nodejs_compat` hands
 * `AsyncLocalStorage` over through `process.getBuiltinModule`, and without the flag there is none —
 * measured 2026-10-19, `nodejs_als` alone hands nothing over to a bundle that imports no `node:` module.
 */
import { ambientOver, type AsyncContext } from './ambient.over.js';
import { ambient as queued } from './ambient.queue.js';

const hooks = (globalThis as { process?: { getBuiltinModule?: (id: string) => { AsyncLocalStorage?: AsyncContext } | undefined } })
  .process?.getBuiltinModule?.('node:async_hooks');

export const ambient = hooks?.AsyncLocalStorage ? ambientOver(hooks.AsyncLocalStorage) : queued;
