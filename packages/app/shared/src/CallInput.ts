import { type InvocationContext } from '@fougere/core/contract';

/** What a page provides of an invocation — the rest is stamped server-side. */
export type CallInput = Partial<Pick<InvocationContext, 'params' | 'query' | 'input'>>;
