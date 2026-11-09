import { ambientOver, type AsyncContext } from './ambient.over.js';
import { ambient as queued } from './ambient.queue.js';

const hooks = (globalThis as { process?: { getBuiltinModule?: (id: string) => { AsyncLocalStorage?: AsyncContext } | undefined } })
  .process?.getBuiltinModule?.('node:async_hooks');

export const ambient = hooks?.AsyncLocalStorage ? ambientOver(hooks.AsyncLocalStorage) : queued;
