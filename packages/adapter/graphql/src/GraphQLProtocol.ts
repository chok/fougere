import { Format, upperFirst, type Accepted } from '@fougere/schema';
import { Protocols, listens, type EffectiveOperation } from '@fougere/core';
import { rootFieldOf } from './OperationsConfig.js';
import { executeOn, schemaOf } from './app.js';
import { graphqlDoor } from './door.js';

/** What `protocols: { graphql: … }` may say — nothing yet, so nothing is admitted. */
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

// The host answers `/graphql` through what is registered here, never by importing a package by name.
/** `query posts`, `mutation publish` — nothing for an op a fact calls, which no document reaches. */
function answersAt(operation: EffectiveOperation): string | undefined {
  if (listens(operation) || !operation.signature) return undefined;

  const root = operation.kind === 'query' ? 'query' : 'mutation';

  return `${root} ${rootFieldOf(operation.name, upperFirst(operation.handler.address), operation)}`;
}

const served = {
  format: GRAPHQL,
  executeOn,
  door: (app: Parameters<typeof schemaOf>[0], surface?: string) => graphqlDoor(schemaOf(app, surface)),
  answersAt,
};
Protocols.register('graphql', served);
