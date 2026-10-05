import type { EffectiveOperation } from '@fougere/core';

/** What a route reads of an effective operation — its `binding` is what the path is derived from. */
export type OperationMeta = Pick<EffectiveOperation, 'input' | 'output' | 'kind' | 'description'>
  & Partial<Pick<EffectiveOperation, 'binding'>>;
