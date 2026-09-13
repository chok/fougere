import { type SqlSourceOptions } from '../source/SqlSourceOptions.js';

export interface SqliteSourceOptions extends SqlSourceOptions {
  /** Filesystem path to the database. Defaults to a project-local file. */
  path?: string;
}
