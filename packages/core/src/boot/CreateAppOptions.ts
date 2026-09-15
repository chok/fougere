import type { Container } from '@fougere/container';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { ScanResult } from '../scan.js';
import type { StorageFactory } from '../storage/StorageFactory.js';
import type { Constraint } from '../Constraint.js';
import type { Transport } from '../wire/Transport.js';
import type { Extension } from './Extension.js';
import type { AuthConfig } from './AuthConfig.js';
import type { DispatchObserver } from '../dispatch/DispatchObserver.js';
import type { App } from './App.js';

/** Options for createApp(). */
export interface CreateAppOptions {
  /**
   * The container this app resolves through. Absent, core builds its own — the only
   * realization there is. A host states one to fill the root BEFORE the boot runs: the CLI
   * registers its terminal that way, and a seed resolving a handler during the ascent would
   * never see a value registered after `createApp` returned.
   */
  createContainer?: () => Container;
  /** Factory to auto-generate Storage for each scanned entity. */
  storageFactory?: StorageFactory;
  /**
   * Which source an entity's rows live in, and how to open a transaction on one — the two
   * questions that decide whether `Together<[…]>` gets the engine's own unwind or replays inverses
   * itself.
   */
  sourceOf?: (entityName: string) => string;
  transacts?: (source: string) => boolean;
  transacted?: <R>(source: string, fn: (storageFactory: StorageFactory) => Promise<R>) => Promise<R>;
  /**
   * Bring the shape of what lives here up to date — a source's own gesture, declared on
   * `Source.migrate` and handed over whole.
   *
   * Handed here rather than assembled by the host: four of them wrote
   * `migrating(storage.migrate)` themselves, one of them as a string inside generated
   * code, and eight demos wrote nothing — so they had no migration and nothing said it.
   * The ASCENT is core's to order, since rows after tables is not a host's preference.
   */
  migrate?: (app: App) => Promise<void> | void;
  /** Whether that source refuses a constraint at the rows — the boot says so when it does not. */
  enforces?: (source: string, constraint: Constraint) => boolean;
  /** Builds the cross-source reader a frond gets when it declares `reads:`. */
  sourcesFactory?: (reads: unknown[], frond: string) => Promise<unknown> | unknown;
  /** What this app is built from — required, because producing it is what reads a disk. */
  scan?: ScanResult | (() => Promise<ScanResult> | ScanResult);
  /** What this app STATES it hosts — `frond('blog', { entities: [Post] })`. */
  fronds?: readonly FrondDescriptor[];
  /**
   * Remote fronds — label → address. What each remote hosts is discovered
   * at the first miss (rpc.discover), never declared here.
   */
  remotes?: Record<string, string>;
  /** Builds the transport used to reach `remotes` addresses. */
  remoteTransport?: (url: string) => Transport;
  /**
   * Which realization answers which port — see `FougereConfig.ports`. Needed only
   * when two classes extend the same port; one is resolved by convention.
   */
  /**
   * What answers a port. A string names the realization; a LIST is the chain, from the
   * outside in — `['Retrying', 'Stripe']` puts `Retrying` in front of `Stripe`, and the
   * last name is what actually charges.
   */
  ports?: Record<string, string | readonly string[]>;
  /** What this app takes on beyond its fronds, each stating what it does and what it undoes. */
  extensions?: readonly (Extension | undefined)[];
  /**
   * Released by `app.dispose()` AFTER the container, for a resource handed in rather than built
   * here — a storage connection is the one case today.
   */
  onDispose?: () => Promise<void> | void;
  /** Which protocol adapters this app serves — see `FougereConfig.adapters`. */
  adapters?: Record<string, boolean | undefined>;
  /** Carries an announced fact out of this process — a broker, a queue, a log. */
  onEmit?: (fact: string, payload: unknown) => void | Promise<void>;
  /** Passive observers of every dispatch transition. */
  dispatchObservers?: readonly DispatchObserver[];
  /**
   * Storage handle to expose to the auth provider via AuthContext.db.
   * Required when `auth` is set.
   */
  db?: unknown;
  /** Auth declaration to wire into the app at boot. */
  auth?: AuthConfig;
}
