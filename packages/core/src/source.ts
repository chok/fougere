import { Registry, type SchemaView } from '@fougere/schema';
import type { StorageFactory } from './storage.js';

/**
 * A place rows live, whatever realizes it.
 *
 * `StorageFactory` plus its lifecycle, which is why it lives beside it. Three of the four
 * gestures are optional and ABSENCE IS THE ANSWER: no `transacted` and a frame compensates
 * instead of transacting (`boot/together.ts`), no `migrate` and there is no shape to bring
 * up to date. What a source is MADE OF is not here — `adapter/sql` states `dialect`, `db`
 * and `sink` on its own `SqlSource`, reached by narrowing, the rule {@link Storage.client}
 * already obeys one level down.
 */
export interface Source {
  storageFactory: StorageFactory;
  /** Bring the shape of what lives here up to date. */
  migrate?(view: SourceView): Promise<void>;
  /** Run `fn` as ONE unit of work, with a factory bound to it. */
  transacted?<R>(fn: (factory: StorageFactory) => Promise<R>): Promise<R>;
  close?(): Promise<void>;
  /** What distinguishes it when a query is reported. */
  name?: string;
}

/**
 * The app as ONE source sees it: what lives there, and the NAMES of what does not.
 *
 * The second half is what lets a DDL stop lying. A batch holding every entity cannot tell
 * a cross-source target from a typo, so a `ref()` falls back to a derived table name and
 * the constraint is emitted against a table that may not exist. `elsewhere` says which
 * misses are legitimate — and a target in neither list is a mistake, out loud.
 */
export interface SourceView {
  fronds: readonly { readonly name: string; readonly entities: readonly { readonly name: string }[] }[];
  /** The auth provider's own entities, when they ride with this source. */
  auth?: unknown;
  elsewhere: readonly string[];
}

/**
 * What a config file can carry about a source — values, never a live driver.
 *
 * `source` names the ADAPTER, and everything else belongs to the adapter it named:
 * `adapter/sql` reads `dialect`, a file one reads `path`. That is the shape
 * `EntityAdapters` already has — addressed by adapter, and what sits below is the
 * adapter's own. Which is why the level `schema` owns is not repeated here.
 */
export interface SourceConfig {
  /** The adapter that realizes it. Absent means the conventional one. */
  source?: string;
  /** The entities whose rows live here. Absent on the default source: it holds the rest. */
  entities?: string[];
  [key: string]: unknown;
}

/**
 * Which adapter answers a source name — one per process, no subject to hold.
 *
 * The shape `Generators` already has, and the refusal `resolveStorage` already made: only
 * `sqlite` could be resolved from its name, because it was the one driver `defaults`
 * depended on. That refusal had no owner — it lived in the package that happened to import
 * the driver — so a second adapter had nowhere to say it exists. Here it does, and an
 * unknown name is refused naming what this process answers.
 *
 * Registered at IMPORT by each adapter, so nothing central lists them.
 */
class SourceRegistry extends Registry<(conf: SourceConfig) => Source> {
  /** The source this name stands for, built from the config entry that named it. */
  open(name: string, conf: SourceConfig, path?: string): Source {
    return this.resolve(name, path)(conf);
  }
}

export const Sources = new SourceRegistry(
  'source',
  'import the adapter that answers it, or call Sources.register(name, build)',
);
