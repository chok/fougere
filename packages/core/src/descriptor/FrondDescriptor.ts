import type { OperationContract } from '../wire/OperationContract.js';
import type { OperationOverride } from '../OperationOverride.js';
import type { FrondConfig } from '../FrondConfig.js';
import type { ProviderEntry } from './ProviderEntry.js';
import type { EntityEntry } from './EntityEntry.js';
import type { HandlerEntry } from './HandlerEntry.js';
import type { PresenterEntry } from './PresenterEntry.js';
import type { CollectorEntry } from './CollectorEntry.js';
import type { SeedEntry } from './SeedEntry.js';
import type { FrondSource } from './FrondSource.js';
import type { ExtensionEntry } from './ExtensionEntry.js';
import type { FougereFrondProtocols } from '../FougereFrondProtocols.js';

/** The key a provider answers under: the name the source wrote, or its class name. */
export const nameOf = (provider: ProviderEntry): string => provider.name ?? provider.ctor.name;

export interface FrondDescriptor extends Pick<FrondConfig, 'pipes' | 'surfaces' | 'reads' | 'ports'> {
  name: string;
  source: FrondSource;
  providers: ProviderEntry[];
  entities: EntityEntry[];
  handlers: HandlerEntry[];
  presenters: PresenterEntry[];
  collectors: CollectorEntry[];
  seeds: SeedEntry[];
  /** What this frond mounts on the process that serves it. Absent when it declares none. */
  extensions?: ExtensionEntry[];
  /** Brought by an extension rather than by the app; set by the boot. */
  fromExtension?: true;
  /** The frond this one inherits code from; set by the boot from `fronds:`. */
  extends?: string;
  /** What `frond.config.ts` says to each protocol about the whole frond. */
  protocols?: FougereFrondProtocols;
  /** Per-operation overrides from frond.config.ts, keyed `post.list` — read through `OperationOverrides`. */
  operationsOverrides?: Record<string, OperationContract & Omit<OperationOverride, 'handler'> & {
    /** The handler CLASS of `frond.config.ts`, by the name DI resolves it under. */
    handlerName?: string;
  }>;
}

/** Whether the frond was read from this project's sources, rather than written with `frond()`. */
export function isScanned(frond: Pick<FrondDescriptor, 'source'>): boolean {
  return frond.source.path !== '';
}

/** Recognized by its FORM, like everything a config holds: a name and the lists every frond carries. */
export function isFrondDescriptor(value: unknown): value is FrondDescriptor {
  const shape = value as Partial<Record<keyof FrondDescriptor, unknown>> | null;

  return typeof shape?.name === 'string' && Array.isArray(shape.entities) && Array.isArray(shape.handlers);
}
