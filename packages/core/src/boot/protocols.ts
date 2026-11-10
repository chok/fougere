import { JsonSchemaValidator, SchemaError, dotted, type JsonSchema } from '@fougere/schema';
import { Protocols, type ProtocolConfig } from '../extension/Protocol.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';

/** Each protocol named in `protocols:`, judged by its format and by its adapter. */
export function servedProtocols(protocols: ProtocolConfig | undefined, fronds: readonly FrondDescriptor[]): ProtocolConfig {
  for (const [name, options] of Object.entries(protocols ?? {})) {
    const type = Protocols.resolve(name, `protocols.${name}`);
    const refusal = JsonSchemaValidator.of(type.format.schema as JsonSchema).refusalOf(options, [`protocols.${name}`]);
    if (refusal) throw new SchemaError(`${dotted(refusal.path)}: ${refusal.message}`);

    const refused = type.refusals?.(options, fronds) ?? [];
    if (refused.length > 0) throw new SchemaError(refused.map((one) => `protocols.${name}: ${one}`).join('\n'));
  }

  return protocols ?? {};
}
