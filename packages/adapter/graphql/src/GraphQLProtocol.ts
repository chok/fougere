import { Format, upperFirst, type Accepted } from '@fougere/schema';
import { Protocols, listens, type EffectiveOperation } from '@fougere/core';
import { rootFieldOf } from './rootFields.js';
import { executeOn, schemaOf } from './app.js';
import { graphqlDoor } from './door.js';

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

const served = {
  format: GRAPHQL,
  executeOn,
  door: (app: Parameters<typeof schemaOf>[0], surface?: string) => graphqlDoor(schemaOf(app, surface)),
  answersAt,
};
Protocols.register('graphql', served);
