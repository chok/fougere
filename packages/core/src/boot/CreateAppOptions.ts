import type { Term } from '@fougere/registry';
import type { ValueSources } from '../module/value/ValueSources.js';
import type { Container } from '@fougere/container';
import type { ProtocolConfig } from '../Protocol.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { FrondEntries } from '../FrondEntries.js';
import type { StorageFactory } from '../storage/StorageFactory.js';
import type { Constraint } from '../Constraint.js';
import type { Transport } from '../wire/Transport.js';
import type { Extension } from './Extension.js';
import type { ConventionsInput } from '../ConventionsInput.js';
import type { App } from './App.js';
import type { StateEntry } from '../FougereStates.js';

/** Options for createApp(). */
export interface CreateAppOptions {
  /** The container this app resolves through; core builds its own when absent. */
  createContainer?: () => Container;
  /** Factory to auto-generate Storage for each scanned entity. */
  storageFactory?: StorageFactory;
  /** Which source an entity's rows live in. */
  sourceOf?: (entityName: string) => string | undefined;
  transacts?: (source: string) => boolean;
  /** The entities `sources:` holds as one value each, and how each is read. */
  values?: ValueSources;
  transacted?: <R>(source: string, fn: (storageFactory: StorageFactory) => Promise<R>) => Promise<R>;
  /** What the sources do not hold yet; the boot refuses when it is not empty. */
  pending?: (app: App) => Promise<readonly string[]>;
  /** Whether that source refuses a constraint at the rows — the boot says so when it does not. */
  enforces?: (source: string, constraint: Constraint) => boolean;
  /** Builds the cross-source reader a frond gets when it declares `reads:`. */
  sourcesFactory?: (reads: unknown[], frond: string) => Promise<unknown> | unknown;
  /**
   * What this process answers by name.
   * Ex: `StringFormats.term('slug', …)`.
   */
  vocabulary?: readonly Term<unknown>[];
  /** What this app STATES it hosts — `frond('blog', { entities: [Post] })`. */
  fronds?: readonly FrondDescriptor[];
  /** Who inherits code from whom: `FougereConfig.fronds`, whole. */
  under?: FrondEntries;
  /** This process carries a subset of what the project declares. */
  narrowed?: boolean;
  /** Remote fronds, label → address. */
  remotes?: Record<string, string>;
  /** Builds the transport used to reach `remotes` addresses. */
  remoteTransport?: (url: string) => Transport;
  /**
   * What answers a port: a name, or a chain from the outside in.
   * Ex: `['Retrying', 'Stripe']`.
   */
  ports?: Record<string, string | readonly string[]>;
  /** The project's directory names, as `fougere.config.ts` restates them — read by the refusals that name a path. */
  conventions?: ConventionsInput;
  /** What this app takes on beyond its fronds, each stating what it does and what it undoes. */
  extensions?: readonly (Extension | undefined)[];
  /** Released by `app.dispose()` after the container. */
  onDispose?: () => Promise<void> | void;
  /** The protocols this app serves — see `FougereConfig.protocols`. */
  protocols?: ProtocolConfig;
  /** How each name of the caller's state is kept — see `FougereConfig.state`. */
  state?: Record<string, StateEntry>;
  /** Carries an announced fact out of this process — a broker, a queue, a log. */
  onEmit?: (fact: string, payload: unknown) => void | Promise<void>;
}
