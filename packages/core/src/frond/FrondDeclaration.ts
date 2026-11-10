import { lowerFirst, type Entity, type SchemaView } from '@fougere/schema';
import { addressOf } from '../wire/Facade.js';
import type { CollectorEntry } from '../descriptor/CollectorEntry.js';
import type { EntityEntry } from '../descriptor/EntityEntry.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import type { PresenterEntry } from '../descriptor/PresenterEntry.js';
import type { ProviderEntry } from '../descriptor/ProviderEntry.js';
import type { SeedEntry } from '../descriptor/SeedEntry.js';
import type { ExtensionEntry } from '../descriptor/ExtensionEntry.js';
import { DEFAULT_CONVENTIONS } from '../config/Conventions.js';
import { getPresenterFields } from '../prefab/presenter.js';
import type { OperationContract } from '../wire/OperationContract.js';
import type { ErrorCode } from '../wire/ErrorCode.js';
import type { DeclaredSubject } from './DeclaredSubject.js';
import type { DeclaredHandler } from './DeclaredHandler.js';
import type { Declared, Seating } from './Declared.js';
import { seated, seatsOf } from '../prefab/Repository.js';
import { opsOf } from '../prefab/opsOf.js';
import { builtOn, targetOf } from '../prefab/prefab.js';
import { contractOf, isDeclaredOperation } from './DeclaredOperation.js';
import type { Ctor } from '../Ctor.js';
import type { FrondConfig } from '../descriptor/FrondConfig.js';
import type { PresenterFieldMeta } from '../descriptor/PresenterFieldMeta.js';
import { FrondConfigReading } from '../descriptor/FrondConfigReading.js';


const ctorOf = (d: Declared | DeclaredHandler): Ctor => {
  const written = (typeof d === 'function' ? d : d.ctor) as Ctor;
  const { collects, presents } = typeof d === 'function' ? {} : d as Seating;
  if (collects ?? presents) return builtOn(written, (collects ?? presents) as Entity);

  return seatingOf(d).length > 0 ? seated(written, seatingOf(d)) : written;
};

const seatingOf = (d: Declared | DeclaredHandler): readonly Entity[] => {
  const stated = typeof d === 'function' ? undefined : (d as Seating).repository;

  return stated === undefined ? [] : Array.isArray(stated) ? stated : [stated as Entity];
};

function subjectOf(ctor: Ctor, kind: string): { name: string } {
  const subject = targetOf(ctor);
  if (!subject?.name) {
    throw new Error(
      `${ctor.name} is listed as a ${kind}, so it must say what it ${kind === 'presenter' ? 'presents' : 'collects'}: `
        + `{ ctor: ${ctor.name}, ${kind === 'presenter' ? 'presents: Entity' : 'collects: Type'} }.`,
    );
  }

  return subject;
}

const depsOf = (d: Declared | DeclaredHandler): string[] => [...(typeof d === 'function' ? [] : d.deps ?? []), ...seatsOf(seatingOf(d))];

function declaredOperations(h: Ctor | DeclaredHandler): Map<string, OperationContract> {
  const declared = typeof h === 'function' ? undefined : h.operations;
  const own = opsOf(ctorOf(h));
  const merged = new Map<string, OperationContract>(Object.entries(own));
  for (const [op, contract] of declared instanceof Map ? declared : Object.entries(declared ?? {})) {
    merged.set(op, isDeclaredOperation(contract) ? contractOf(op, contract) : contract as OperationContract);
  }

  return merged;
}

/** What a declaration states about one frond. Everything else is derived from the classes. */
export interface FrondDeclaration extends Pick<FrondConfig, 'pipes' | 'surfaces' | 'protocols' | 'ports'> {
  /** An entity, or one named otherwise than its class — a derivation's name is its file's. */
  entities?: (SchemaView | { entity: SchemaView; name: string })[];
  handlers?: (Ctor | DeclaredHandler)[];
  /** A computed field IS a method; what TypeScript erases of it — its type, its parameters — is `fieldMeta`. */
  presenters?: (Ctor | DeclaredSubject & Seating & { fieldMeta?: PresenterFieldMeta[] })[];
  collectors?: (Ctor | DeclaredSubject & Seating & { refuses?: ErrorCode[]; collecting?: ErrorCode[] })[];
  providers?: Declared[];
  seeds?: { entityName: string; data: SeedEntry['data'] }[];
  /** The import scope this frond answers under. Defaults to the conventional one. */
  scope?: string;
  /** What `frond.config.ts` states — the third producer of an operation contract. */
  operationsOverrides?: FrondDescriptor['operationsOverrides'];
  /** The file each value is declared in, which a refusal names. */
  files?: readonly (readonly [unknown, string])[];
  /** The frond's `frond.config.ts`, imported — read the way the scan reads the file. */
  config?: FrondConfig;
  /** What rises with the process serving this frond — the same thing its `extensions/` states. */
  extensions?: (ExtensionEntry['extension'] & { name: string })[];
}

/** State a frond without reading a disk. */
export function frond(name: string, declared: FrondDeclaration = {}): FrondDescriptor {
  const scope = declared.scope ?? DEFAULT_CONVENTIONS.scope;
  const files = new Map<unknown, string>(declared.files ?? []);
  const fileOf = (value: unknown): string => files.get(value) ?? '';

  const entities: EntityEntry[] = (declared.entities ?? []).map((stated) => {
    const named = typeof stated === 'object' && 'entity' in stated ? stated : undefined;
    const entityClass = named ? named.entity : stated as SchemaView;

    return {
      name: named ? named.name : lowerFirst((entityClass as { name: string }).name),
      entityClass,
      filePath: fileOf(entityClass),
      exposed: true,
    };
  });

  const handlers: HandlerEntry[] = (declared.handlers ?? []).map((h) => {
    const ctor = ctorOf(h);
    const surface = typeof h === 'function' ? undefined : h.surface;
    const address = addressOf(ctor.name);

    return {
      name: ctor.name,
      address,
      ctor,
      entityName: address,
      operations: declaredOperations(h),
      deps: depsOf(h),
      filePath: fileOf(ctor),
      exposed: true,
      ...(surface ? { surface } : {}),
    };
  });

  const presenters: PresenterEntry[] = (declared.presenters ?? []).map((p) => {
    const ctor = ctorOf(p);
    const fields = getPresenterFields(ctor);
    const written = typeof p === 'function' ? [] : p.fieldMeta ?? [];

    return {
      entityName: lowerFirst(subjectOf(ctor, 'presenter').name),
      ctor,
      fields,
      fieldMeta: fields.map((field) => written.find((meta) => meta.name === field) ?? { name: field }),
      deps: depsOf(p),
      filePath: fileOf(ctor),
    };
  });

  const collectors: CollectorEntry[] = (declared.collectors ?? []).map((c) => {
    const ctor = ctorOf(c);

    return {
      typeName: lowerFirst(subjectOf(ctor, 'collector').name),
      ctor,
      deps: depsOf(c),
      filePath: fileOf(ctor),
      ...(typeof c !== 'function' && c.refuses ? { refuses: c.refuses } : {}),
      ...(typeof c !== 'function' && c.collecting ? { collecting: c.collecting } : {}),
    };
  });

  const providers: ProviderEntry[] = (declared.providers ?? []).map((p) => ({
    ...(typeof p === 'function' || !p.name ? {} : { name: p.name }),
    ctor: ctorOf(p),
    deps: depsOf(p),
    filePath: fileOf(ctorOf(p)),
    ...(typeof p !== 'function' && p.abstract ? { abstract: true as const } : {}),
    ...(typeof p !== 'function' && p.implements?.length ? { implements: p.implements } : {}),
    ...(typeof p !== 'function' && p.answers ? { answers: p.answers } : {}),
    ...(typeof p !== 'function' && p.refuses ? { refuses: p.refuses } : {}),
    ...(typeof p !== 'function' && p.collecting ? { collecting: p.collecting } : {}),
  }));

  const seeds: SeedEntry[] = (declared.seeds ?? []).map((s) => ({
    entityName: s.entityName,
    data: s.data,
    filePath: fileOf(s.data),
  }));


  const config = new FrondConfigReading(declared.config);
  if (declared.config) config.markExposed(entities, handlers);

  return {
    name,
    source: { path: '', package: `${scope}/${name}` },
    ...config.members(),
    ...(declared.operationsOverrides ? { operationsOverrides: declared.operationsOverrides } : {}),
    ...(declared.protocols ? { protocols: declared.protocols } : {}),
    providers,
    entities,
    handlers,
    presenters,
    collectors,
    seeds,
    ...(declared.pipes ? { pipes: declared.pipes } : {}),
    ...(declared.ports ? { ports: declared.ports } : {}),
    ...(declared.surfaces ? { surfaces: declared.surfaces } : {}),
    ...(declared.extensions
      ? { extensions: declared.extensions.map((extension) => ({ name: extension.name, extension, filePath: fileOf(extension) })) }
      : {}),
  };
}
