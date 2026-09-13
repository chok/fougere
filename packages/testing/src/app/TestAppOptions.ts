import type { Port } from '../stub/Port.js';

export interface TestAppOptions {
  /** The project to scan. */
  root?: string;
  /** Boot only these fronds, by name. Deduced from the position when absent. */
  fronds?: string[];
  /**
   * The running test file, for hosts other than vitest. Vitest is read automatically
   * through `expect.getState()`; anything else hands its own path in.
   */
  testPath?: string;
  /** Where the rows go. */
  db?: string;
  /**
   * Follow `remotes:` from the config. False by default — a test that meant to exercise
   * one frond should not silently reach for a process that is not running.
   */
  topology?: boolean;
  /**
   * Ports answered by a double instead of their realization. A double carries every
   * method the port declares and returns nothing until the test says what it returns.
   */
  stub?: Port[];
}
