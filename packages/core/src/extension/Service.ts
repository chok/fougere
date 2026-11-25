import { Registry } from '@fougere/registry';
import { Format, JsonSchemaValidator, SchemaError, dotted, type JsonSchema, type ObjectFormat } from '@fougere/schema';

/** A service type: what its entry admits, and the command that runs one in the foreground until it is stopped. */
export interface ServiceType<Entry = any> {
  readonly format: Format<Entry>;
  command(entry: Entry, name: string): string;
}

/**
 * The keys every service states — where it answers, how it is spoken to (`http` unless said), and the path that says it is ready.
 * Ex: `serviceFormat('service/docker').key('image', Format.text).needs('type', 'port', 'image').closed()`.
 */
export function serviceFormat(id: string): ObjectFormat<{ type?: string; port?: number; scheme?: string; health?: string }> {
  return Format.of(id).key('type', Format.text).key('port', Format.count).key('scheme', Format.text).key('health', Format.text);
}

class ServiceRegistry extends Registry<ServiceType> {
  /** `command` is handed what `format` admitted, so the entry is typed by the format alone. */
  override register<Entry>(name: string, type: ServiceType<Entry>): ServiceType<Entry> {
    return super.register(name, type) as ServiceType<Entry>;
  }

  /** The command an entry runs, once its type's format has judged it. */
  commandOf(entry: { type?: string }, name: string): string {
    const path = `services.${name}`;
    if (entry.type === undefined) {
      throw new SchemaError(`${path} has no \`type\`. This process answers ${this.names.join(', ') || 'none — import @fougere/services'}.`);
    }
    const type = this.resolve(entry.type, `${path}.type`);
    const refusal = JsonSchemaValidator.of(type.format.schema as JsonSchema).refusalOf(entry, [path]);
    if (refusal) throw new SchemaError(`${dotted(refusal.path)}: ${refusal.message}`);

    return type.command(entry, name);
  }
}

/**
 * The service types this process answers, registered by the package that brings each.
 *
 * Documented: [services](https://fougere.dev/docs/concepts/configuration#the-programs-the-app-needs).
 */
export const ServiceTypes = new ServiceRegistry('service type', 'import the package that provides it');
