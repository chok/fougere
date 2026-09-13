import type { Call } from '../wire/Call.js';

export type RouteExecution = (call: Call) => unknown | Promise<unknown>;
