import { type DialectName } from '../dialect/DialectName.js';

export interface GenerateOptions {
  /** Override table name resolution. Default: camelCase → snake_case + 's'. */
  tableName?: (entityName: string) => string;
  /** Target engine. Default: sqlite. */
  dialect?: DialectName;
}
