import type { ColumnDef } from '../table/ColumnDef.js';
import type { TableDef } from '../table/TableDef.js';

export interface FkEdge {
  table: TableDef;
  column: ColumnDef;
}
