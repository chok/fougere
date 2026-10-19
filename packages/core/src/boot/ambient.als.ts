/** Node's realization: `AsyncLocalStorage` imported, since every Node the framework runs on has it. */
import { AsyncLocalStorage } from 'node:async_hooks';
import { ambientOver } from './ambient.over.js';

export const ambient = ambientOver(AsyncLocalStorage);
