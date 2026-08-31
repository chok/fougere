import type { SchemaDescriptor } from './Descriptor.js';

export interface FacadeTypeSourceOptions {
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

function propertyKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function docCommentOf(text: string | undefined, indent: string): string {
  if (!text) return '';
  return `${indent}/** ${text.replace(/\*\//g, '*\\/')} */\n`;
}

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

export class FacadeTypeSource {
  private constructor(private readonly operations: readonly OpDescriptor[]) {}

  static of(operations: readonly OpDescriptor[]): FacadeTypeSource {
    return new FacadeTypeSource(operations);
  }

  render(options: FacadeTypeSourceOptions = {}): string {
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
