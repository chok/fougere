import { Role, Shapes, type ShapeType } from '@fougere/schema';
import { tableColumnsOf, type FormEntity } from './FormEntity.js';
import { rowNameOf } from './RowName.js';
import type { TableColumn } from './TableColumn.js';

/** What a line of a list shows of a row: the field that names it, and the facts read at a glance. */
export interface Summary {
  name?: TableColumn;
  facts: TableColumn[];
}

/** What reads at a glance. A long text, a key, a reference or a document does not. */
const AT_A_GLANCE = new Set<ShapeType>(['choice', 'boolean', 'number', 'integer', 'date']);

export function summaryOf(entity: FormEntity, entityKey: string): Summary {
  const fields = entity.getFields();
  const columns = tableColumnsOf(entity, entityKey);
  const name = columns.find((column) => column.name === rowNameOf(fields));
  const facts = columns.filter((column) => {
    const field = fields[column.name]!;
    const type = Shapes.typeOf(field.shape);

    return column !== name && type !== undefined && AT_A_GLANCE.has(type) && !Role.of(field).isRelation();
  });

  return { ...(name ? { name } : {}), facts };
}

/** One column of a row as a line prints it: a date without its hour, a true boolean by its label, a false one not at all. */
export function cellOf(column: TableColumn, row: object): string {
  const value = (row as Record<string, unknown>)[column.name];
  if (value === undefined || value === null || value === false) return '';
  if (value === true) return column.label;
  if (column.render === 'date') return new Date(value as string | Date).toLocaleDateString();

  return String(value);
}
