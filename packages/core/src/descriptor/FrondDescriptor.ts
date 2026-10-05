import type { OperationContract } from '../wire/OperationContract.js';
import type { OperationOverride } from '../OperationOverride.js';
import type { FrondConfig } from '../FrondConfig.js';
import type { ProviderEntry } from './ProviderEntry.js';
import type { EntityEntry } from './EntityEntry.js';
import type { HandlerEntry } from './HandlerEntry.js';
import type { PresenterEntry } from './PresenterEntry.js';
import type { CollectorEntry } from './CollectorEntry.js';
import type { MiddlewareEntry } from './MiddlewareEntry.js';
import type { SeedEntry } from './SeedEntry.js';
import type { FrondSource } from './FrondSource.js';
import type { ExtensionEntry } from './ExtensionEntry.js';

/**
 * The key a provider answers under. What the source said, and the class's own name only
 * where nobody wrote it down — a statement is read as code, and code can say it.
 */
export const nameOf = (provider: ProviderEntry): string => provider.name ?? provider.ctor.name;

export interface FrondDescriptor extends Pick<FrondConfig, 'pipes' | 'surfaces' | 'reads'> {
  name: string;
  source: FrondSource;
  providers: ProviderEntry[];
  entities: EntityEntry[];
  handlers: HandlerEntry[];
  presenters: PresenterEntry[];
  collectors: CollectorEntry[];
  seeds: SeedEntry[];
  middlewares: MiddlewareEntry[];
  /** What this frond mounts on the process that serves it. Absent when it declares none. */
  extensions?: ExtensionEntry[];
  /**
   * Brought by an EXTENSION rather than by the app — `@fougere/calls` keeping its lines,
   * `@fougere/observability` sending them on. It is installed like any other, and it is not
   * what the app SERVES: a report that lists it describes the instrumentation, not the
   * domain. Set by the boot, never by a declaration.
   */
  brought?: true;
  /**
   * The frond this one inherits code from — its scope hangs off that one's, so a service, a
   * repository, a port or a middleware declared there answers here too. The same word the
   * config uses, set by the boot from `FougereConfig.fronds` and never by a scan: the disk is
   * flat, and a directory says nothing about who shares its code.
   */
  extends?: string;
  /** Per-operation overrides from frond.config.ts. */
  operationsOverrides?: Record<string, OperationContract & Omit<OperationOverride, 'handler'> & {
    /** The handler CLASS of `frond.config.ts`, by the name DI resolves it under. */
    handlerName?: string;
  }>;
}

/** Recognized by its FORM, like everything a config holds: a name and the lists every frond carries. */
export function isFrondDescriptor(value: unknown): value is FrondDescriptor {
  const shape = value as Partial<Record<keyof FrondDescriptor, unknown>> | null;

  return typeof shape?.name === 'string' && Array.isArray(shape.entities) && Array.isArray(shape.handlers);
}
