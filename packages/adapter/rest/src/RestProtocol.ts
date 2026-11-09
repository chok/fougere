import { Format, type Accepted } from '@fougere/schema';
import { HTTP_METHODS } from '@fougere/http';
import { Protocols, RouteAddress, isScanned, listens, type EffectiveOperation, type FrondDescriptor, type ProtocolConfig } from '@fougere/core';
import { routeOf } from './routes/RouteDefinition.js';

/** Where one operation answers, when what its contract derives is not what it should be. */
const RESPONSE = Format.of()
  .key('status', Format.count)
  .key('headers', Format.listOf(Format.text))
  .closed();

const ROUTE = Format.of('protocol/rest/route')
  .key('method', Format.tokens(HTTP_METHODS))
  .key('path', Format.text)
  .key('status', Format.count)
  .key('responses', Format.listOf(RESPONSE))
  .closed();

const OPENAPI = Format.of('protocol/rest/openapi')
  .key('ui', Format.either(Format.tokens(['swagger', 'scalar'] as const), Format.flag))
  .closed();

const REST = Format.of('protocol/rest')
  .key('prefix', Format.text)
  /** Publish what REST serves at `{prefix}/openapi.json`. Nothing without it. */
  .key('openapi', OPENAPI)
  .key('overrides', Format.recordOf(ROUTE))
  .closed();

const FROND = Format.of('protocol/rest/frond')
  .key('path', Format.text)
  .closed();

export type RestRoute = Accepted<typeof ROUTE>;

declare module '@fougere/core' {
  interface FougereProtocols {
    rest: Accepted<typeof REST>;
  }
  interface FougereOperationProtocols {
    rest?: RestRoute;
  }
  interface FougereFrondProtocols {
    rest?: Accepted<typeof FROND>;
  }
}

/** Where REST is mounted when `protocols.rest.prefix` says nothing. */
export const PREFIX = '/api';

export function prefixOf(protocols: ProtocolConfig | undefined): string {
  return protocols?.rest?.prefix ?? PREFIX;
}

function misplaced(overrides: Record<string, RestRoute> | undefined, fronds: readonly FrondDescriptor[]): string[] {
  return Object.entries(overrides ?? {}).flatMap(([key, route]) => {
    const named = RouteAddress.parse(key);
    if (!named) return [`overrides: '${key}' names no address. An op is named '<address>.<op>'.`];

    const owner = fronds.find((frond) => frond.handlers.some((handler) => handler.address === named.address));
    if (!owner) return [`overrides: '${key}' — no frond serves the address '${named.address}'.`];
    if (!isScanned(owner)) return [];

    return [
      `overrides: '${key}' belongs to ${owner.name}, whose frond.config.ts is in this project — state it there:\n`
        + `  ${owner.source.path}/frond.config.ts → operations: { '${key}': { rest: ${JSON.stringify(route)} } }`,
    ];
  });
}

function answersAt(operation: EffectiveOperation, options: Accepted<typeof REST>, frond: FrondDescriptor): string | undefined {
  if (listens(operation)) return undefined;

  const { method, path } = routeOf({ rest: options }, frond, operation.handler.address, operation.name, operation);

  return `${method} ${path}`;
}

Protocols.register('rest', {
  format: REST,
  port: 'Rest',
  refusals: (options: Accepted<typeof REST>, fronds) => misplaced(options.overrides, fronds),
  answersAt,
});
