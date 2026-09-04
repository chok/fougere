import type { SchemaDescriptor } from './Descriptor.js';

export interface FacadeTypesOptions {
  name?: string;
  exported?: boolean;
  rowType?: string;
}

export interface OpDescriptor {
  name: string;
  description?: string;
  output?: SchemaDescriptor;
  cardinality?: 'one' | 'maybe' | 'many' | 'page' | 'none';
}

/**
 * So an operation named `list-all` is still callable on the generated interface.
 * FR : pour qu'une opération nommée `list-all` reste appelable sur l'interface générée.
 * `propertyKey('list-all')` → `"list-all"`
 */
function propertyKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

/**
 * So the operation's own sentence shows on hover in the consumer's editor.
 * FR : pour que la phrase de l'opération s'affiche au survol chez le consommateur.
 * `description: 'Publishes a draft.'` → a doc comment on that member
 */
function docCommentOf(text: string | undefined, indent: string): string {
  if (!text) return '';
  return `${indent}/** ${text.replace(/\*\//g, '*\\/')} */\n`;
}

/**
 * So a consumer sees the cardinality in the type, not in a doc line.
 * FR : pour qu'un consommateur voie la cardinalité dans le type, pas dans une ligne de doc.
 * `'maybe'` → `Post | undefined`; `'page'` → `Post[] & { total?: number; … }`
 */
function returnTypeOf(op: OpDescriptor, rowType: string): string {
  switch (op.cardinality) {
    case 'many': return `${rowType}[]`;
    case 'page': return `${rowType}[] & { total?: number; endCursor?: string; hasMore?: boolean }`;
    case 'maybe': return `${rowType} | undefined`;
    case 'one': return rowType;
    case 'none': return 'unknown';
    default: return 'unknown';
  }
}

export class FacadeTypes {
  private constructor(private readonly operations: readonly OpDescriptor[]) {}

  static of(operations: readonly OpDescriptor[]): FacadeTypes {
    return new FacadeTypes(operations);
  }

  render(options: FacadeTypesOptions = {}): string {
    const name = options.name ?? 'Facade';
    const exported = options.exported === false ? '' : 'export ';
    const rowType = options.rowType ?? 'unknown';
    const members = this.operations.map((operation) => {
      const doc = docCommentOf(operation.description, '  ');
      return `${doc}  ${propertyKey(operation.name)}(invocation?: Invocation): Promise<${returnTypeOf(operation, rowType)}>;`;
    });

    if (members.length === 0) return `${exported}interface ${name} {}`;
    return `${exported}interface ${name} {\n${members.join('\n')}\n}`;
  }
}
