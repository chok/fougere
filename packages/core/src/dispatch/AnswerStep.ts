import type { InvocationContext } from '../wire/InvocationContext.js';
import type { ArgumentResolver } from './ArgumentResolver.js';

/** What runs over a handler's answer before its view projects it — a presenter's computed fields are one. */
export type AnswerStep = (answered: unknown, invocation: InvocationContext, args: ArgumentResolver) => Promise<unknown>;
