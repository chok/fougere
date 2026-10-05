import type { EffectiveOperation } from '@fougere/core';

/** What a GraphQL field reads of an effective operation; a caller building one by hand may leave out the plan. */
export type OperationMeta = Pick<EffectiveOperation, 'input' | 'output' | 'kind' | 'description'>
  & Partial<Pick<EffectiveOperation, 'signature' | 'binding'>>;
