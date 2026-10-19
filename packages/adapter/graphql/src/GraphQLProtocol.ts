import { Format, type Accepted } from '@fougere/schema';
import { Protocols } from '@fougere/core';
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
const served = { format: GRAPHQL, executeOn, door: (app: Parameters<typeof schemaOf>[0], surface?: string) => graphqlDoor(schemaOf(app, surface)) };
Protocols.register('graphql', served);
