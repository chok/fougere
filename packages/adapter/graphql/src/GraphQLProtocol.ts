import { Format, upperFirst, type Accepted } from '@fougere/schema';
import { Protocols, listens, type EffectiveOperation } from '@fougere/core';
import { rootFieldOf } from './rootFields.js';
import { answer, GRAPHQL_PATH } from './answer.js';

const GRAPHQL = Format.of('protocol/graphql').closed();

declare module '@fougere/core' {
  interface FougereProtocols {
    graphql: Accepted<typeof GRAPHQL>;
  }
  interface FougereOperationProtocols {
    /** The root field this op answers to — `posts` rather than the derived name. */
    graphql?: string;
  }
}

function answersAt(operation: EffectiveOperation): string | undefined {
  if (listens(operation) || !operation.signature) return undefined;

  const root = operation.kind === 'query' ? 'query' : 'mutation';

  return `${root} ${rootFieldOf(operation.name, upperFirst(operation.handler.address), operation)}`;
}

Protocols.register('graphql', {
  format: GRAPHQL,
  answersAt,
  mountedAt: () => GRAPHQL_PATH,
  answer,
});
