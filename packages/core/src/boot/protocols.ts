import { JsonSchemaValidator, SchemaError, dotted, type JsonSchema } from '@fougere/schema';
import { Protocols, type ProtocolConfig } from '../Protocol.js';

/** Each protocol named in `protocols:` — served by an imported adapter, and judged by its format. */
export function servedProtocols(protocols: ProtocolConfig | undefined): ProtocolConfig {
  for (const [name, options] of Object.entries(protocols ?? {})) {
    const type = Protocols.resolve(name, `protocols.${name}`);
    const refusal = JsonSchemaValidator.of(type.format.schema as JsonSchema).refusalOf(options, [`protocols.${name}`]);
    if (refusal) throw new SchemaError(`${dotted(refusal.path)}: ${refusal.message}`);
  }

  return protocols ?? {};
}
