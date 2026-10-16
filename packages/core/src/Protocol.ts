import { Registry, type Format } from '@fougere/schema';
import type { FougereProtocols } from './FougereProtocols.js';

/** The protocols this app serves — a key per protocol, its options as the adapter states them. */
export type ProtocolConfig = { [K in keyof FougereProtocols]?: FougereProtocols[K] };

/** A protocol an adapter serves: what its entry admits. A host reads the rest by name. */
export interface ProtocolType<Options = any> {
  readonly format: Format<Options>;
}

/**
 * Which adapter serves a protocol. Importing one makes it available; naming it in `protocols:`
 * is what serves it — a helper imported elsewhere opens nothing.
 */
export const Protocols = new Registry<ProtocolType>(
  'protocol',
  'import the adapter that serves it, or call Protocols.register(name, { format })',
);

/** Whether `protocols:` names this one — read by a host that imports no adapter, so by name. */
export function serves(protocols: ProtocolConfig | undefined, name: string): boolean {
  return protocols !== undefined && Object.hasOwn(protocols, name);
}
