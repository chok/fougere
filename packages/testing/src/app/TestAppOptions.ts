import type { Port } from '../stub/Port.js';

export interface TestAppOptions {
  /** The project to scan. */
  root?: string;
  /** Boot only these fronds, by name. Deduced from the position when absent. */
  fronds?: string[];
  /** The running test file, for hosts other than vitest. */
  testPath?: string;
  /** Where the rows go. */
  db?: string;
  /** Follows `remotes:` from the config; false by default. */
  topology?: boolean;
  /** Ports answered by a double that returns nothing until the test says what. */
  stub?: Port[];
}
