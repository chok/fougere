import { upperFirst, type FieldDescriptor, type SchemaDescriptor } from '@fougere/schema';
import { docCommentOf, propertyKey } from './syntax.js';

/**
 * So a nullable field lands as a union.
 * FR : pour qu'un champ nullable atterrisse en union.
 * `{ type: ['string', 'null'] }` → `string | null`
 */
function typeOf(field: FieldDescriptor): string {
  const types = Array.isArray(field.type) ? field.type : field.type ? [field.type] : [];
  const nullable = types.includes('null');
  const base = types.find((t) => t !== 'null');
  const inner = baseTypeOf(base, field);
  return nullable ? `${inner} | null` : inner;
}

/**
 * So `date-time` becomes a `Date`, the same thing the boundary decodes to.
 * FR : pour que `date-time` devienne une `Date`, comme la frontière le décode.
 * `{ type: 'string', format: 'date-time' }` → `Date`; `{ enum: ['a', 'b'] }` → `'a' | 'b'`
 */
function baseTypeOf(base: string | undefined, field: FieldDescriptor): string {
  if (field.enum?.length) {
    return field.enum.map((v) => (v === null ? 'null' : JSON.stringify(v))).join(' | ');
  }
  switch (base) {
    case 'string':
      return field.format === 'date-time' ? 'Date' : 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return field.items ? `${typeOf(field.items)}[]` : 'string[]';
    case 'object':
      return field.properties ? objectTypeOf(field.properties, field.required ?? []) : 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

/**
 * So a nested object keeps its optionality.
 * FR : pour qu'un objet imbriqué garde ses champs optionnels.
 * `{ street }` with `required: []` → `{ street?: string }`
 */
function objectTypeOf(properties: Record<string, FieldDescriptor>, required: readonly string[]): string {
  const members = Object.entries(properties).map(([name, field]) => {
    const optional = required.includes(name) ? '' : '?';
    return `${propertyKey(name)}${optional}: ${typeOf(field)}`;
  });
  return `{ ${members.join('; ')} }`;
}

export interface EntityTypesOptions {
  name?: string;
  exported?: boolean;
}

/**
 * So the generated class carries its row type.
 * FR : pour que la classe générée porte son type de ligne.
 * `{ properties: { title: { type: 'string' } } }` → `{ title: string; }`
 */
function shapeTypeOf(descriptor: SchemaDescriptor, indent = ''): string {
  const entries = Object.entries(descriptor.properties ?? {});
  if (entries.length === 0) return '{}';

  const lines = entries.map(([key, field]) => {
    const doc = docCommentOf(field.description, `${indent}  `);
    return `${doc}${indent}  ${propertyKey(key)}: ${typeOf(field)};`;
  });
  return `{\n${lines.join('\n')}\n${indent}}`;
}

export class EntityTypes {
  private constructor(private readonly descriptor: SchemaDescriptor) {}

  static of(descriptor: SchemaDescriptor): EntityTypes {
    return new EntityTypes(descriptor);
  }

  render(options: EntityTypesOptions = {}): string {
    const name = identifierOf(options.name ?? upperFirst(this.descriptor.title ?? 'Schema'));
    const exported = options.exported === false ? '' : 'export ';
    const card = JSON.stringify(this.descriptor, null, 2)
      .split('\n')
      .map((line, i) => (i === 0 ? line : `  ${line}`))
      .join('\n');

    return `${exported}class ${name} extends Card.fromDescriptor<${shapeTypeOf(this.descriptor)}>(${card}).toSchema() {}`;
  }
}

/**
 * So a name that cannot declare a class is refused before it reaches a file.
 * FR : pour qu'un nom incapable de déclarer une classe soit refusé avant le fichier.
 * `identifierOf('my-post')` → throws `'my-post' is not a TypeScript identifier`
 */
function identifierOf(name: string): string {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
    throw new Error(`'${name}' is not a TypeScript identifier — it cannot name a generated declaration`);
  }
  return name;
}
