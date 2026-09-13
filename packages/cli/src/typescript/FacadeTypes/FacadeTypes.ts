import { docCommentOf, propertyKey } from '../syntax.js';
import type { FacadeTypesOptions } from './FacadeTypesOptions.js';
import type { OpDescriptor } from './OpDescriptor.js';

/** So a consumer sees the cardinality in the type, not in a doc line. */
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
