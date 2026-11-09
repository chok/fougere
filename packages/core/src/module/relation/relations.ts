/** Who holds a `ref()`: the source it lives in, this process, or nobody. */
import { lowerFirst, Role, Shapes, type SchemaView } from '@fougere/schema';
import type { Dependent } from './Dependent.js';
import type { RelationCheck } from './RelationCheck.js';
import type { RowHosts } from './RowHosts.js';
import type { Diagnostic } from '../../diagnostic.js';
import type { Releasing } from './Release.js';
import type { EntityEntry } from '../../descriptor/EntityEntry.js';
import { hasForeignKey } from '../../SourceView.js';
import { markOf } from './FougereTarget.js';
import type { Marks } from './Marks.js';
import type { Rows } from './Release.js';

/**
 * Does a foreign key hold this reference? Both sides in ONE source that keeps relations, read by
 * the rule the migration reads too (`hasForeignKey`) — so the PAIR decides, never the engine.
 *
 * And the pair is not enough: an engine's cascade does not pass through the guard, so a hop it
 * owns above a hop it does not would take rows out with nothing left to release THEIR rows. One
 * unkeyed hop anywhere below and the guard takes the whole tree — the engine's own cascade then
 * finds nothing left to do, since the guard walks deepest first and the row goes last.
 */
function keyed(namer: string, target: string, rowHosts: RowHosts, seen = new Set<string>()): boolean {
  const pair = hasForeignKey(namer, target, rowHosts.sourceOf, (source) => rowHosts.enforces(source, 'relation'));
  if (!pair || seen.has(namer)) return pair;
  seen.add(namer);

  return referencesTo(namer, rowHosts).every(({ entity }) => keyed(entity, namer, rowHosts, seen));
}

/** Every field of every entity that names `target` — read over the whole app, both ways need it. */
function referencesTo(target: string, rowHosts: RowHosts): { entity: string; field: string; role: Role }[] {
  return rowHosts.relations().incoming(target).map(({ from, label }) => ({
    entity: from,
    field: label,
    role: Role.of(rowHosts.entities().get(from)!.getFields()[label]),
  }));
}

/**
 * The references a foreign key cannot hold, each as a read the guard makes before the write.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
 */
export function relationChecksOf(entity: SchemaView, name: string, rowHosts: RowHosts): RelationCheck[] {
  const checks: RelationCheck[] = [];

  for (const [field, declared] of Object.entries(entity.getFields())) {
    const role = Role.of(declared);
    if (!role.isReference() || !role.target?.name) continue;

    const target = lowerFirst(role.target.name);
    if (keyed(name, target, rowHosts)) continue;

    checks.push({
      field,
      target,
      inAnotherSource: rowHosts.sourceOf(name) !== rowHosts.sourceOf(target),
      marked: marksKeptBetween(name, target, rowHosts) !== undefined,
      arbitratedHereOnly: marksKeptBetween(name, target, rowHosts)?.inThisProcessOnly ?? false,
      missing: async (keys) => {
        const storage = rowHosts.storageOf(target);
        // Nothing here holds those rows — the process that does answers the same reading,
        // so the question crosses rather than being given up on.
        if (!storage) return rowHosts.peerOf(target)?.missing(target, keys) ?? [];
        const found = await storage.findByKeys(keys.map(String));

        return keys.filter((key) => !found.has(String(key)));
      },
    });
  }

  return checks;
}

/**
 * The rows that name this entity's, and what becomes of them — the dual of `relationChecksOf`.
 *
 * Read over EVERY entity of the app, because a namer is declared wherever its own frond is,
 * and the target learns of it from nowhere else. What a key already holds is left out: the
 * engine answers it at the rows, inside the delete's own transaction.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
 */
export function dependentsOf(target: string, rowHosts: RowHosts): Dependent[] {
  return referencesTo(target, rowHosts)
    .filter(({ entity }) => !keyed(entity, target, rowHosts))
    .map(({ entity, field, role }) => ({ entity, field, onDelete: role.onDelete ?? 'restrict' }));
}

/** Every row that names this entity's, a foreign key's included — what a release asks before anything moves. */
export function namersOf(target: string, rowHosts: RowHosts): Dependent[] {
  return referencesTo(target, rowHosts)
    .map(({ entity, field, role }) => ({ entity, field, onDelete: role.onDelete ?? 'restrict' }));
}

/**
 * `set null` on a field that may not hold one — refused where the FIELD is, not in `ref()`.
 *
 * `optional()` wraps a `ref()` and is applied after it, so only the field the entity ended up
 * declaring knows whether null is admitted. Asked here rather than at the target, because the
 * declaration is the namer's and so is the fix.
 */
export function refuseUnwritableNull(entity: SchemaView, name: string, filePath: string): Diagnostic[] {
  const refused: Diagnostic[] = [];

  for (const [field, declared] of Object.entries(entity.getFields())) {
    if (Role.of(declared).onDelete !== 'set null' || Shapes.isNullable(declared.shape)) continue;
    refused.push({
      severity: 'blocking',
      code: 'on-delete-null-refused',
      filePath,
      subject: `${name}.${field}`,
      message: `${name}.${field} has onDelete: 'set null', but it cannot be null. `
        + "Wrap it in optional(), or use onDelete: 'cascade'.",
    });
  }

  return refused;
}

/**
 * A `many()` whose target declares no `ref()` back. The key lives on the far row, so a
 * relation neither side states can never be filled: SQL emits no column, GraphQL drops the
 * field when it finds no reverse key, and nothing says why.
 *
 * Asked once every frond is installed, since the target may belong to another one — and left
 * alone when it answers elsewhere, where its fields are declared and cannot be read here.
 */
export function unpaired(entities: readonly EntityEntry[], rowHosts: RowHosts): Diagnostic[] {
  const refused: Diagnostic[] = [];

  for (const entry of entities) {
    for (const [field, declared] of Object.entries(entry.entityClass.getFields())) {
      const role = Role.of(declared);
      const target = role.isCollection() ? role.target?.name : undefined;
      if (!target || !rowHosts.hostedHere(lowerFirst(target))) continue;

      const paired = referencesTo(lowerFirst(entry.name), rowHosts)
        .some((one) => one.entity === lowerFirst(target));
      if (paired) continue;

      refused.push({
        severity: 'blocking',
        code: 'many-without-reference',
        filePath: entry.filePath,
        subject: `${entry.name}.${field}`,
        message: `${entry.entityClass.name}.${field} is many(${target}), but no field of ${target} points back `
          + `to ${entry.entityClass.name}. Add one on ${target}: ref(${entry.entityClass.name}).`,
      });
    }
  }

  return refused;
}


/**
 * What a release asks the boot, built once per app — the same `RowHosts` the guard reads.
 *
 * `dependentsOf` is answered per call rather than cached: a frond installed after this one
 * brings rows that name an entity already registered, and a table taken at boot would miss
 * exactly the crossings this exists for.
 */
export function releasing(rowHosts: RowHosts): Releasing {
  return {
    dependentsOf: (entity) => dependentsOf(entity, rowHosts),
    namersOf: (entity) => namersOf(entity, rowHosts),
    rowsOf: (entity) => rowHosts.storageOf(entity),
    schemaOf: (entity) => rowHosts.entities().get(entity),
    peers: () => rowHosts.peers(),
    journal: (entity) => rowHosts.journal(entity),
    marking: async (namer, target, keys, marked, read) => {
      const kept = marksKeptBetween(namer, target, rowHosts);
      if (!kept) return read(rowHosts.storageOf(namer) as unknown as Rows);
      const marks = keys.map((key) => markOf(target, key));
      const answer = await kept.marking(marks, (factory) => read(factory(rowHosts.entities().get(namer)!, namer) as unknown as Rows));
      marked.push(...marks);

      return answer;
    },
    forget: async (marks) => {
      for (const source of sourcesKeepingMarks(rowHosts)) await rowHosts.marksIn(source)?.forget(marks);
    },
  };
}

function marksKeptBetween(namer: string, target: string, rowHosts: RowHosts): Marks | undefined {
  const source = rowHosts.sourceOf(namer);

  return source !== undefined && source !== rowHosts.sourceOf(target) ? rowHosts.marksIn(source) : undefined;
}

/** The checks whose source keeps no mark: read before the write, and a delete at the same time is not refused. */
export function unarbitratedRelations(checks: readonly RelationCheck[]): string[] {
  return checks.filter((check) => check.inAnotherSource && !check.marked).map((check) => `${check.field} → ${check.target}`);
}

/** The checks whose source arbitrates in this process alone: a second process writing the same rows is not seen. */
export function arbitratedHereOnly(checks: readonly RelationCheck[]): string[] {
  return checks.filter((check) => check.arbitratedHereOnly).map((check) => `${check.field} → ${check.target}`);
}

/** The sources here holding rows that name a row of another source — where marks are kept. */
function sourcesKeepingMarks(rowHosts: RowHosts): string[] {
  const sources = new Set<string>();
  for (const [name, schema] of rowHosts.entities()) {
    if (!rowHosts.hostedHere(name)) continue;
    const source = rowHosts.sourceOf(name);
    if (source === undefined || !rowHosts.marksIn(source)) continue;
    const crosses = Object.values(schema.getFields()).some((field) => {
      const role = Role.of(field);

      return role.isReference() && rowHosts.sourceOf(lowerFirst(role.target?.name ?? '')) !== source;
    });
    if (crosses) sources.add(source);
  }

  return [...sources];
}

/**
 * A release this process can START and cannot FINISH.
 *
 * Read from what is HERE and never asked of anyone: an entity states `cascade` or `set null`,
 * and nothing registered a journal — both facts are local, so the line is too. The same shape
 * as `unique declared, and the source does not enforce it`, one rung up: what is declared, and
 * what this process cannot keep.
 *
 * Silent when a key holds every hop: the engine carries those out in one statement, and there
 * is no half-done state for anybody to finish.
 */
export function unfinishable(rowHosts: RowHosts): string[] {
  if (rowHosts.journal('') !== undefined) return [];

  const found: string[] = [];
  for (const [entity] of rowHosts.entities()) {
    for (const dependent of dependentsOf(entity, rowHosts)) {
      if (dependent.onDelete === 'restrict') continue;
      found.push(`${dependent.entity}.${dependent.field} → ${entity} (${dependent.onDelete})`);
    }
  }

  return found;
}
