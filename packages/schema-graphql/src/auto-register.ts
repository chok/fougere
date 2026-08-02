/**
 * Auto-register GraphQL types and operations from a fougere App.
 *
 * Reads scanned entities + handler facades and registers
 * types, inputs, queries and mutations automatically.
 * Respects handler method-based contracts and surfaces config.
 *
 * Relations (ref/many) are auto-wired between registered types.
 */
import type SchemaBuilder from '@pothos/core';
import type { Fields, SchemaLike } from '@fougere/schema';
import { isNullable } from '@fougere/schema';
import { registerType, registerOperations } from './pothos.js';

type HandlerFacade = Record<string, Function>;

/**
 * The relation a foreign key points at — `authorId → author`, `user_id → user`.
 * Returns undefined when the field carries no id suffix at all: there is nothing to
 * derive, and taking the scalar's own name would collide with it.
 */
function relationNameFor(fieldName: string): string | undefined {
  const stripped = fieldName.replace(/(_id|Id|ID)$/, '');
  return stripped && stripped !== fieldName ? stripped : undefined;
}

/**
 * Redirect specific ops to alternate handlers based on frond.config.ts overrides.
 * For ops declaring `handler: OtherClass, method?: 'name'`, replaces the facade entry
 * with a call into the resolved alternate handler.
 */
function applyOperationOverrides(
  baseFacade: HandlerFacade,
  overrides: Record<string, { handlerName?: string; method?: string }>,
  app: { resolve<T>(name: string): T },
): HandlerFacade {
  const patched: HandlerFacade = { ...baseFacade };
  for (const [opName, override] of Object.entries(overrides)) {
    if (!override.handlerName) continue;
    try {
      const altFacade = app.resolve<HandlerFacade>(override.handlerName);
      const methodName = override.method ?? opName;
      const fn = altFacade[methodName];
      if (typeof fn === 'function') {
        patched[opName] = fn.bind(altFacade);
      }
    } catch { /* alternate handler not in DI — silent skip */ }
  }
  return patched;
}

// ─── Types ──────────────────────────────────────

interface OperationMeta {
  input?: SchemaLike;
  output?: SchemaLike;
  signature?: {
    name: string;
    params: { name: string; type: { raw: string; name: string; array?: boolean; nullable?: boolean; generics?: any[] }; optional?: boolean }[];
    returnType?: { raw: string; name: string; array?: boolean; nullable?: boolean; generics?: any[] };
  };
}

interface EntityEntry {
  name: string;
  entityClass: SchemaLike;
  exposed?: boolean;
}

interface HandlerEntry {
  entityName: string;
  operations: Map<string, OperationMeta>;
  surface?: string;
  outputOverride?: SchemaLike;
  ctor?: { __output?: SchemaLike };
}

interface PresenterFieldMeta {
  name: string;
  returnType?: string;
  nullable?: boolean;
}

interface PresenterEntry {
  entityName: string;
  fields: string[];
  fieldMeta: PresenterFieldMeta[];
}

interface FrondLike {
  name: string;
  entities: EntityEntry[];
  handlers: HandlerEntry[];
  presenters: PresenterEntry[];
  surfaces?: Record<string, string[]>;
  operationsOverrides?: Record<string, {
    kind?: 'query' | 'command';
    handlerName?: string;
    method?: string;
    policy?: string;
  }>;
}

interface AppLike {
  fronds: FrondLike[];
  resolve<T>(name: string): T;
  /** The façade an entity exposes to one audience — `undefined` when none. */
  facadeFor(entity: string, surface?: string): Record<string, Function> | undefined;
}

// ─── Helpers ────────────────────────────────────

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

// ─── Public API ─────────────────────────────────

export interface RegisterAllOptions {
  /** Override which entities to expose. Default: all scanned entities with a handler. */
  filter?: (entity: EntityEntry, frondName: string) => boolean;
  /** Surface name for filtering (e.g. 'graphql', 'rest'). Uses frond.config.ts surfaces if set. */
  surface?: string;
}

/**
 * Auto-register GraphQL types and operations for all entities
 * in the app that have a matching handler facade.
 *
 * Operations are driven by parsed handler signatures (from the scanner).
 * Relations (ref/many) are auto-wired between registered entity types.
 */
export function registerAll(
  builder: InstanceType<typeof SchemaBuilder>,
  app: AppLike,
  options?: RegisterAllOptions,
): void {
  // Collect registered types across all fronds for relation wiring
  const typeRegistry = new Map<
    any,
    { name: string; type: any; facade: HandlerFacade; presenterFields: Set<string> }
  >();

  // ── Pass 1: register types + operations ────────

  for (const frond of app.fronds) {
    const handlerMap = new Map(frond.handlers.filter((h) => !h.surface).map((h) => [h.entityName, h]));
    const presenterMap = new Map((frond.presenters ?? []).map((p) => [p.entityName, p]));

    const surfaceName = options?.surface;

    for (const entity of frond.entities) {
      // Membership is core's answer, not ours — one rule, read here (see App.facadeFor).
      const facade = app.facadeFor(entity.name, surfaceName) as HandlerFacade | undefined;
      if (!facade) continue;

      if (options?.filter && !options.filter(entity, frond.name)) continue;
      if (!surfaceName && entity.exposed === false) continue;

      const handler = (surfaceName
        ? frond.handlers.find((h) => h.entityName === entity.name && h.surface === surfaceName)
        : undefined) ?? handlerMap.get(entity.name);
      const typeName = capitalize(entity.name);

      const presenterMeta = presenterMap.get(entity.name);
      let presenter: Record<string, Function> | undefined;
      if (presenterMeta) {
        try {
          presenter = app.resolve<Record<string, Function>>(`${entity.name[0].toUpperCase()}${entity.name.slice(1)}Presenter`);
        } catch { /* no presenter registered */ }
      }

      // Use handler's output schema if declared, otherwise entity
      const outputSchema = handler?.outputOverride
        ?? (handler?.ctor as any)?.__output
        ?? entity.entityClass;

      const type = registerType(builder, {
        name: typeName,
        entity: outputSchema as any,
        presenter: presenter as any,
        presenterFields: presenterMeta?.fields,
        presenterFieldMeta: presenterMeta?.fieldMeta,
      });

      // Track for relation wiring — key is entity class. The presenter's computed field
      // names travel too: pass 2 must not derive a relation over a name the author wrote.
      typeRegistry.set(entity.entityClass, {
        name: typeName, type, facade,
        presenterFields: new Set(presenterMeta?.fields ?? []),
      });

      // Apply per-op handler/method overrides: redirect specific ops to a different handler instance.
      const opOverrides = frond.operationsOverrides;
      const effectiveFacade = opOverrides
        ? applyOperationOverrides(facade, opOverrides, app)
        : facade;

      registerOperations(builder, {
        name: typeName,
        type,
        facade: effectiveFacade,
        operations: handler?.operations ?? new Map(),
        operationsOverrides: opOverrides,
      });
    }
  }

  // ── Pass 2: auto-wire relations (ref → N:1, many → 1:N) ──

  const presenterFieldsOf = (cls: any) => typeRegistry.get(cls)?.presenterFields ?? new Set<string>();

  for (const [entityClass, { type }] of typeRegistry) {
    const fields = entityClass.getFields() as Fields;
    const relationFields: Record<string, (t: any) => any> = {};

    for (const [fieldName, field] of Object.entries(fields)) {
      if (field.role?.relation?.kind === 'one') {
        const target = field.role.relation.to();
        if (!target) continue;
        const targetEntry = typeRegistry.get(target);
        if (!targetEntry) continue;

        // authorId → author, user_id → user. Both spellings, because a foreign key
        // is named by its author and `/Id$/` alone left `user_id` untouched — the
        // relation then took the scalar's own name and Pothos refused the duplicate,
        // taking the WHOLE schema down with it.
        const relationName = relationNameFor(fieldName);
        // Nothing to strip, or the name is already taken by a field of the entity or by
        // a presenter's computed field: the author named it, the author wins. Deriving
        // over it would either crash the build or shadow what they wrote.
        if (!relationName || relationName in fields || presenterFieldsOf(entityClass).has(relationName)) continue;
        const nullable = isNullable(field.shape);

        relationFields[relationName] = (t: any) => t.field({
          type: targetEntry.type,
          nullable,
          resolve: (parent: any) => {
            const fk = parent[fieldName];
            if (fk == null) return null;
            return targetEntry.facade.findById({ params: { id: fk }, query: {}, body: undefined, state: {} });
          },
        });
      }

      if (field.role?.relation?.kind === 'many') {
        const target = field.role.relation.to();
        if (!target) continue;
        const targetEntry = typeRegistry.get(target);
        if (!targetEntry) continue;

        // Trouver la FK inverse sur l'entité cible (la relation « one » qui pointe ici)
        const targetFields = (target as unknown as SchemaLike).getFields() as Fields;
        const reverseFk = Object.entries(targetFields).find(
          ([, f]) => f.role?.relation?.kind === 'one' && f.role.relation.to() === entityClass,
        );
        if (!reverseFk) continue;

        const [reverseFkName] = reverseFk;

        relationFields[fieldName] = (t: any) => t.field({
          type: [targetEntry.type],
          resolve: (parent: any) => {
            const id = parent.id;
            if (id == null) return [];
            // `where` — un critère se nomme. Passé à la racine de la query, il retombait
            // dans les options de `list()`, qui ignore ce qu'elle ne connaît pas : la
            // relation rendait alors TOUTE la table cible, sans un mot.
            return targetEntry.facade.list({
              params: {}, query: { where: { [reverseFkName]: id } }, body: undefined, state: {},
            }).then((result: any) => Array.isArray(result) ? result : result?.items ?? result);
          },
        });
      }
    }

    if (Object.keys(relationFields).length > 0) {
      (builder as any).objectFields(type, (t: any) => {
        const result: Record<string, any> = {};
        for (const [name, factory] of Object.entries(relationFields)) {
          result[name] = factory(t);
        }
        return result;
      });
    }
  }
}
