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
  sourceOf?: (entityName: string) => string | undefined;
  transacts?: (source: string) => boolean;
  /** The entities `sources:` holds as one value each, and how each is read. */
  values?: ValueSources;
  transacted?: <R>(source: string, fn: (storageFactory: StorageFactory) => Promise<R>) => Promise<R>;
  /**
   * What the declaration asks of the sources and they do not hold yet — `Source.pending`, handed
   * over whole. The boot READS it and refuses when it is not empty; nothing here writes a schema.
   */
  pending?: (app: App) => Promise<readonly string[]>;
  /** Whether that source refuses a constraint at the rows — the boot says so when it does not. */
  enforces?: (source: string, constraint: Constraint) => boolean;
  /** Builds the cross-source reader a frond gets when it declares `reads:`. */
  sourcesFactory?: (reads: unknown[], frond: string) => Promise<unknown> | unknown;
  /**
   * What this process answers by name — `StringFormats.term('slug', …)`, `Verbs.term('total', 'query')`.
   * The process's, not a frond's: a registry answers every entity that names the word.
   */
  vocabulary?: readonly Term<unknown>[];
  /** What this app STATES it hosts — `frond('blog', { entities: [Post] })`. */
  fronds?: readonly FrondDescriptor[];
  /**
   * Who inherits code from whom — `FougereConfig.fronds`, handed over whole rather than
   * flattened, because a refusal names where an entry sits in it (`shop.cart`). The host has
   * already turned its addresses and its modules into `remotes` and `fronds`.
   */
  under?: FrondEntries;
  /**
   * This process carries a subset of what the project declares — `only:` at the host. A name
   * the tree states and this process left out is then expected, not a typo.
   */
  narrowed?: boolean;
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
  /** The project's directory names, as `fougere.config.ts` restates them — read by the refusals that name a path. */
  conventions?: ConventionsInput;
  /** What this app takes on beyond its fronds, each stating what it does and what it undoes. */
  extensions?: readonly (Extension | undefined)[];
  /**
   * Released by `app.dispose()` AFTER the container, for a resource handed in rather than built
   * here — a storage connection is the one case today.
   */
  onDispose?: () => Promise<void> | void;
  /** The protocols this app serves — see `FougereConfig.protocols`. */
  protocols?: ProtocolConfig;
  /** How each name of the caller's state is kept — see `FougereConfig.state`. */
  state?: Record<string, StateEntry>;
  /** Carries an announced fact out of this process — a broker, a queue, a log. */
  onEmit?: (fact: string, payload: unknown) => void | Promise<void>;
}
