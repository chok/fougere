import { type App } from '@fougere/core';
import { boot } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { resolveStorage, type DbConfig } from '@fougere/defaults';
import { installStubs, type Port, type Stub } from './stub.js';
import { scopeOfRun } from './scope.js';
import { lowerFirst } from '@fougere/schema';

export interface TestAppOptions {
  /**
   * The project to scan. Read from the test file's own position when absent — a file
   * under `fronds/blog/tests/` states that its subject is `blog` and that the project
   * starts above `fronds/`.
   */
  root?: string;
  /** Boot only these fronds, by name. Deduced from the position when absent. */
  fronds?: string[];
  /**
   * The running test file, for hosts other than vitest. Vitest is read automatically
   * through `expect.getState()`; anything else hands its own path in.
   */
  testPath?: string;
  /**
   * Where the rows go. `':memory:'` by default — a real SQLite engine, so the DDL, the
   * `CHECK` constraints, `unique` and real transactions are all exercised, and nothing is
   * written to disk.
   *
   * Not an in-memory storage: `createMemoryStorage` realizes the axes but is not the engine
   * production runs, and a tool whose thesis is *the realizations must agree* cannot pick
   * the one that does not ship.
   */
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

/** An app, plus the doubles standing in front of its ports and the facts it announced. */
export interface TestApp extends App {
  /** The double installed for a port, to state a return or read what was called. */
  stub<T>(port: abstract new (...args: never[]) => T): Stub<T>;
  /**
   * What was announced under a fact's name, in order.
   *
   * Read from the carrier's own seat: `Emissions.announce` hands EVERY announced fact to
   * `onEmit`, whether or not anything in this process listens. So watching costs nothing
   * and adds no second dispatcher — the one thing `Emissions` refuses to become.
   *
   * Its dual needs no help at all: `app.deliver(fact, payload)` is already the carrier's
   * door, and it rejects when a subscriber refuses.
   */
  announced(fact: { name: string } | string): unknown[];
}

/**
 * An app to ask questions of, wired the conventional way.
 *
 * Wraps `boot()`, which already loads the config, creates the container, sets the storage
 * up and seeds — its own comment names tests among the surfaces it serves. What this adds
 * is the two decisions a test makes differently: the rows live in memory, and the
 * topology is not followed.
 *
 * Storage still goes through `resolveStorage`, the single place that knows a storage
 * package; calling `setupSqlite` here would be a second one.
 */
export async function testApp(options: TestAppOptions = {}): Promise<TestApp> {
  const db: DbConfig = { dialect: 'sqlite', path: options.db ?? ':memory:' };
  // The position is consulted only for what the caller did not state: an explicit `root`
  // or `fronds` wins, the way a config key wins over a convention everywhere else.
  const scope = (options.root && options.fronds) ? undefined
    : await scopeOfRun(options.testPath ?? currentTestPath());

  // One entry per announcement, in order. `Emissions.announce` calls the carrier for
  // every fact, so this sees them all — including those nobody in this process listens to.
  const heard: { fact: string; payload: unknown }[] = [];

  const app = await boot({
    onEmit: (fact, payload) => { heard.push({ fact, payload }); },
    root: options.root ?? scope?.root,
    createContainer,
    fronds: options.fronds ?? (scope?.frond ? [scope.frond] : undefined),
    // `boot` merges this over the file, so a project declaring a real database still
    // gets the in-memory one here.
    config: options.topology ? undefined : { remotes: {} },
    db: () => resolveStorage(db),
  });

  const doubles = installStubs(app, options.stub ?? []);
  return Object.assign(app, {
    announced(fact: { name: string } | string): unknown[] {
      // A fact travels under its REGISTRATION key — `postPublished`, not `PostPublished`
      // — the same lowering every entity gets. Both spellings are accepted here and
      // lowered before comparing, so a caller may hand in the class or the name.
      const wanted = lowerFirst(typeof fact === 'string' ? fact : fact.name);
      return heard.filter((one) => lowerFirst(one.fact) === wanted).map((one) => one.payload);
    },
    stub<T>(port: abstract new (...args: never[]) => T): Stub<T> {
      const found = doubles.get(port as Port);
      if (!found) {
        throw new Error(
          `[stub] ${(port as Port).name} was not stubbed — name it: testApp({ stub: [${(port as Port).name}] }).`,
        );
      }
      return found as Stub<T>;
    },
  });
}

/**
 * Vitest's own answer to "which file is running", or nothing.
 *
 * Imported dynamically: a package that imports vitest at the top level stops being
 * loadable outside a test run, and `testApp` is meant to work under any host.
 */
function currentTestPath(): string | undefined {
  const globals = globalThis as { __vitest_worker__?: { filepath?: string } };
  return globals.__vitest_worker__?.filepath;
}
