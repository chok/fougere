import { Registry } from '@fougere/registry';
import type { Format } from '@fougere/schema';
import type { FougereProtocols } from './FougereProtocols.js';
import type { FrondDescriptor } from './descriptor/FrondDescriptor.js';
import type { EffectiveOperation } from './EffectiveOperation.js';

/** The protocols this app serves — a key per protocol, its options as the adapter states them. */
export type ProtocolConfig = { [K in keyof FougereProtocols]?: FougereProtocols[K] };

/** A protocol an adapter serves: what its entry admits. A host reads the rest by name. */
export interface ProtocolType<Options = any> {
  readonly format: Format<Options>;
  /**
   * The port its door's links stand in front of.
   * Ex: `'Rest'`.
   */
  readonly port?: string;
  /** What the entry may not say of the fronds this app is made of — a sentence per refusal. */
  refusals?(options: Options, fronds: readonly FrondDescriptor[]): string[];
  /**
   * Where an operation answers on this protocol, or `undefined`.
   * Ex: `PATCH /api/blog/posts/:id`.
   *
   * Documented: [REST and GraphQL](https://fougere.dev/docs/serve/rest-graphql).
   */
  answersAt?(operation: EffectiveOperation, options: Options, frond: FrondDescriptor): string | undefined;
}

/** Which adapter serves a protocol; naming it in `protocols:` is what serves it. */
export const Protocols = new Registry<ProtocolType>(
  'protocol',
  'import the adapter that provides it',
);

/** Whether `protocols:` names this one — read by a host that imports no adapter, so by name. */
export function serves(protocols: ProtocolConfig | undefined, name: string): boolean {
  return protocols !== undefined && Object.hasOwn(protocols, name);
}
