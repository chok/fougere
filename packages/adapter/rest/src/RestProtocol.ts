import { Format, type Accepted } from '@fougere/schema';
import { Protocols } from '@fougere/core';

/** What `protocols: { rest: … }` may say — nothing yet, so nothing is admitted. */
const REST = Format.of('protocol/rest').closed();

declare module '@fougere/core' {
  interface FougereProtocols {
    rest: Accepted<typeof REST>;
  }
}

Protocols.register('rest', { format: REST });
