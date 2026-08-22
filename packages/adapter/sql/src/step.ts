/**
 * The half `delta()` refuses — realised from an intention that was written down.
 *
 * `diff.ts` states its own guarantee: additive only, because "a rename is not even
 * detectable from a diff (it reads as a drop plus an add)". That still holds, and this
 * file does not weaken it. What changed is upstream: a frozen step (`fougere freeze`)
 * carries a rename because a human declared it at the moment they made it. The intention
 * exists now, so it can be realised — and only what the step actually says.
 *
 * A drop and a rename both touch live data, so this is the only place either can come
 * from: never introspection, never a guess.
 */
import { sql, type Kysely } from 'kysely';
import type { Change as ShapeChange, SetDiff } from '@fougere/schema';
import { compiler } from './ddl.js';
import { type DialectName } from './dialect.js';
import { toSnakeCase, toTableName, type TableDef } from './table.js';
import type { SchemaState } from './diff.js';

/** What a step asks of the tables — beyond what an additive pass already covers. */
export type StepChange =
  | { kind: 'renameColumn'; table: string; from: string; to: string }
  | { kind: 'dropColumn'; table: string; column: string };

/** Something the step asks and the DDL will not do, naming why and what fixes it. */
export interface Refusal {
  entity: string;
  field: string;
  reason: string;
}

export interface Plan {
  changes: StepChange[];
  /**
   * Empty means the step is realisable whole. Anything here is a decision the DDL may
   * not take alone — reported together so one run names every one of them.
   */
  refusals: Refusal[];
}

export interface PlanOptions {
  /** Entity key → table name. Same resolver `desiredTables` takes. */
  tableName?: (name: string) => string;
  /**
   * What the database actually holds, from `actualState`. Given, a change already
   * realised is skipped.
   *
   * Idempotence by OBSERVATION and not by bookkeeping — the same choice `delta` makes.
   * A ledger of applied steps would be a second record of a fact the columns already
   * carry, and the two would disagree the day someone renamed a column by hand.
   */
  actual?: SchemaState;
}

/**
 * Collapse a chain of steps into one, following each field through its renames.
 *
 * A step judges itself on two names — old gone, new here — so an intermediate rename is
 * unrecognisable once its target has been renamed again: both names are absent and it is
 * proposed forever. Composing the chain first asks the question about the name the field
 * ENDS on, which is the only one the tables can answer.
 */
export function collapseChain(steps: readonly SetDiff[]): SetDiff {
  const entities: SetDiff['entities'] = {};
  const added: string[] = [];
  const removed: string[] = [];

  for (const step of steps) {
    added.push(...step.entitiesAdded);
    removed.push(...step.entitiesRemoved);
    for (const [entity, answer] of Object.entries(step.entities)) {
      const held = (entities[entity] ??= { changes: [], ambiguous: [] });
      held.ambiguous.push(...answer.ambiguous);
      for (const change of answer.changes) compose(held.changes, change);
    }
  }

  return { entities, entitiesAdded: [...new Set(added)], entitiesRemoved: [...new Set(removed)] };
}

/**
 * Add one change to what the chain has said so far, rewriting rather than appending when
 * it continues a field already moved. A rename back to its origin cancels: the tables
 * never held the name in between, so there is nothing for them to do.
 */
function compose(held: ShapeChange[], change: ShapeChange): void {
  if (change.kind === 'renamed') {
    const at = held.findIndex((each) => each.kind === 'renamed' && each.to === change.from);
    if (at === -1) {
      held.push(change);
      return;
    }
    const first = held[at] as Extract<ShapeChange, { kind: 'renamed' }>;
    if (first.from === change.to) held.splice(at, 1);
    else held[at] = { ...first, to: change.to };
    return;
  }

  // Anything else names a field; if the chain renamed it earlier, the tables know it
  // under the name it started with.
  const field = 'field' in change ? change.field : undefined;
  const at = held.findIndex((each) => each.kind === 'renamed' && each.to === field);
  if (at === -1) {
    held.push(change);
    return;
  }

  const origin = held[at] as Extract<ShapeChange, { kind: 'renamed' }>;
  // A field the chain ends by dropping is dropped under its original name, and the
  // renames that led there are work nobody has to do.
  if (change.kind === 'removed') held.splice(at, 1);
  held.push({ ...change, field: origin.from });
}

/**
 * Turn a frozen step into what the tables must do, and what nobody may decide for you.
 *
 * Pure, like `delta` — the comparison is one thing, running it is another.
 */
export function planStep(step: SetDiff, tables: TableDef[], options: PlanOptions = {}): Plan {
  const resolve = options.tableName ?? toTableName;
  const actual = options.actual;
  const byName = new Map(tables.map((table) => [table.name, table]));
  const changes: StepChange[] = [];
  const refusals: Refusal[] = [];

  for (const [entity, answer] of Object.entries(step.entities)) {
    const table = resolve(entity);
    // A step for an entity this app no longer projects has nothing to act on. Saying so
    // beats emitting SQL against a table that is not there.
    if (!byName.has(table)) {
      refusals.push({ entity, field: '*', reason: `no table '${table}' in this app — did the entity move?` });
      continue;
    }

    for (const change of answer.changes) {
      const decided = realise(entity, table, change, byName.get(table)!);
      if ('reason' in decided) refusals.push(decided);
      else if (decided.change && !done(decided.change, actual?.get(table))) changes.push(decided.change);
    }
  }

  return { changes, refusals };
}

/** One shape change: a column instruction, nothing to do, or a refusal that names itself. */
function realise(
  entity: string,
  table: string,
  change: ShapeChange,
  target: TableDef,
): { change?: StepChange } | Refusal {
  switch (change.kind) {
    case 'renamed':
      // The one thing introspection could never infer, and the reason a step exists.
      return { change: { kind: 'renameColumn', table, from: toSnakeCase(change.from), to: toSnakeCase(change.to) } };

    case 'removed':
      return { change: { kind: 'dropColumn', table, column: toSnakeCase(change.field) } };

    case 'added': {
      // The additive pass adds it — unless it cannot: a NOT NULL column with no default
      // fails on a table that already holds rows, and `addColumn` silently leaves it
      // nullable instead. Two guarantees for one entity, decided by whether the table
      // existed yesterday. Refusing here is what makes the declaration true either way.
      if (!change.required) return {};
      const column = target.columns.find((each) => each.field === change.field);
      if (column?.default !== undefined) return {};
      return {
        entity,
        field: change.field,
        reason: `required with no default — existing rows have nothing to hold. Declare one: default(…)`,
      };
    }

    case 'required':
      if (!change.to) return {}; // Loosening is the engine's business, and no row is at risk.
      return {
        entity,
        field: change.field,
        reason: `became required — rows written before it may hold nothing. Declare a default, or keep it optional`,
      };

    case 'retyped':
      return {
        entity,
        field: change.field,
        reason: `type moved ${change.from.join('|')} → ${change.to.join('|')} — no conversion is derivable, write the migration`,
      };

    case 'reshaped':
      // A tightened bound is a CHECK, and altering one on a live table is engine-specific
      // AND may be refused by rows already stored. The judge still enforces it at the door.
      return {
        entity,
        field: change.field,
        reason: `bounds moved — the door enforces them, the table keeps its old CHECK until you migrate it`,
      };
  }
}

/**
 * Has the table already moved? Read off the columns themselves.
 *
 * A rename whose old name is gone and whose new one is there has happened; a drop whose
 * column is absent has happened. Unknown state (no introspection given) answers no, so a
 * plan built without it proposes everything the step says.
 */
function done(change: StepChange, columns: Set<string> | undefined): boolean {
  if (!columns) return false;
  return change.kind === 'renameColumn'
    ? !columns.has(change.from) && columns.has(change.to)
    : !columns.has(change.column);
}

/** One statement per change — the same rule `migrate` follows: no driver here batches. */
export function stepSQL(change: StepChange, dialectName: DialectName = 'sqlite'): string {
  const alter = compiler(dialectName).schema.alterTable(change.table);
  return change.kind === 'renameColumn'
    ? alter.renameColumn(change.from, change.to).compile().sql
    : alter.dropColumn(change.column).compile().sql;
}

/**
 * Run a step. Refuses whole rather than part-way: a plan with any refusal in it is a
 * plan someone has to read, and half a rename is worse than none.
 */
export async function applyStep(plan: Plan, db: Kysely<any>, dialectName: DialectName = 'sqlite'): Promise<string[]> {
  if (plan.refusals.length > 0) {
    const named = plan.refusals.map((one) => `  ${one.entity}.${one.field} — ${one.reason}`).join('\n');
    throw new Error(`This step cannot be realised as it stands:\n${named}`);
  }
  const run: string[] = [];
  for (const change of plan.changes) {
    const statement = stepSQL(change, dialectName);
    await sql.raw(statement).execute(db);
    run.push(statement);
  }
  return run;
}
