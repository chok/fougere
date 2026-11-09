import { sql, type Kysely } from 'kysely';
import type { Change as ShapeChange, SetDiff } from '@fougere/schema';
import { dequal } from 'dequal';
import { compiler } from '../ddl/SqlSink.js';
import { type DialectName } from '../dialect/DialectName.js';
import { toSnakeCase, toTableName, type TableDef } from '../table/TableDef.js';
import type { StepChange } from './StepChange.js';
import type { Refusal } from './Refusal.js';
import type { PlanOptions } from './PlanOptions.js';

export interface Plan {
  changes: StepChange[];
  /** What the DDL may not decide alone; empty means the step can run whole. */
  refusals: Refusal[];
}

/** Collapse a chain of steps into one, following each field through its renames. */
export function collapseChain(steps: readonly SetDiff[]): SetDiff {
  const entities: SetDiff['entities'] = {};
  const added: string[] = [];
  const removed: string[] = [];

  for (const step of steps) {
    added.push(...step.entitiesAdded);
    removed.push(...step.entitiesRemoved);
    for (const [entity, answer] of Object.entries(step.entities)) {
      const entry = (entities[entity] ??= { changes: [], ambiguous: [] });
      entry.ambiguous.push(...answer.ambiguous);
      for (const change of answer.changes) compose(entry.changes, change);
    }
  }

  return { entities, entitiesAdded: [...new Set(added)], entitiesRemoved: [...new Set(removed)] };
}

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

  const field = 'field' in change ? change.field : undefined;
  const at = held.findIndex((each) => each.kind === 'renamed' && each.to === field);
  if (at === -1) {
    held.push(change);

    return;
  }

  const origin = held[at] as Extract<ShapeChange, { kind: 'renamed' }>;
  if (change.kind === 'removed') held.splice(at, 1);
  held.push({ ...change, field: origin.from });
}

/** Turn a frozen step into what the tables must do, and what nobody may decide for you. */
export function planStep(step: SetDiff, tables: TableDef[], options: PlanOptions = {}): Plan {
  const resolve = options.tableName ?? toTableName;
  const actual = options.actual;
  const byName = new Map(tables.map((table) => [table.name, table]));
  const changes: StepChange[] = [];
  const refusals: Refusal[] = [];

  for (const [entity, answer] of Object.entries(step.entities)) {
    const table = resolve(entity);
    if (!byName.has(table)) {
      refusals.push({ entity, field: '*', reason: `no table '${table}' in this app — did the entity move?` });
      continue;
    }

    for (const change of answer.changes) {
      const decided = realise(entity, table, change, byName.get(table)!);
      if ('reason' in decided) refusals.push(decided);
      else if (decided.change && !(actual && done(decided.change, actual.get(table)))) changes.push(decided.change);
    }
  }

  return { changes, refusals };
}

function realise(
  entity: string,
  table: string,
  change: ShapeChange,
  target: TableDef,
): { change?: StepChange } | Refusal {
  switch (change.kind) {
    case 'renamed':
      return { change: { kind: 'renameColumn', table, from: toSnakeCase(change.from), to: toSnakeCase(change.to) } };

    case 'removed':
      return { change: { kind: 'dropColumn', table, column: toSnakeCase(change.field) } };

    case 'added': {
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
      return {
        entity,
        field: change.field,
        reason: `bounds moved — the facade enforces them, the table keeps its old CHECK until you migrate it`,
      };

    case 'restated':
      return restated(entity, change);
  }
}

function restated(entity: string, change: Extract<ShapeChange, { kind: 'restated' }>): { change?: StepChange } | Refusal {
  const refuse = (reason: string): Refusal => ({ entity, field: change.field, reason });

  if (change.axis === 'boundary') return {};

  if (change.axis === 'lifecycle') {
    const was = literalOf(change.from);
    const is = literalOf(change.to);
    if (was === is) return {};

    return refuse(`default moved ${show(was)} → ${show(is)} — the table keeps the old one, and nothing here alters a DEFAULT`);
  }

  const from = change.from ?? {};
  const to = change.to ?? {};
  if (from.primary !== to.primary) return refuse(`primary moved — a key is not something a step may take from live rows`);
  if (!dequal(from.unique, to.unique)) {
    return refuse(`unique group moved — rows already stored may contradict it, so it is declared and applied by hand`);
  }
  if (!dequal(from.relation, to.relation)) return refuse(`relation moved — a foreign key is a constraint, and nothing here alters one`);
  if (from.index && !to.index) return refuse(`index gone — nothing drops an index today, so the table keeps it`);

  return {};
}

function literalOf(rules: { create?: unknown } | undefined): unknown {
  const create = rules?.create;

  return create && typeof create === 'object' && 'value' in create ? (create as { value: unknown }).value : undefined;
}

const show = (value: unknown): string => (value === undefined ? 'none' : JSON.stringify(value));

function done(change: StepChange, columns: Set<string> | undefined): boolean {
  if (!columns) return true;

  return change.kind === 'renameColumn' ? !columns.has(change.from) : !columns.has(change.column);
}

/** One statement per change — the same rule `migrate` follows: no driver here batches. */
export function stepSQL(change: StepChange, dialectName: DialectName = 'sqlite'): string {
  const alter = compiler(dialectName).schema.alterTable(change.table);

  return change.kind === 'renameColumn'
    ? alter.renameColumn(change.from, change.to).compile().sql
    : alter.dropColumn(change.column).compile().sql;
}

/** Runs a step, or refuses it whole when the plan holds a refusal. */
export async function applyStep(plan: Plan, db: Kysely<any>, dialectName: DialectName = 'sqlite'): Promise<string[]> {
  if (plan.refusals.length > 0) {
    const named = plan.refusals.map((one) => `  ${one.entity}.${one.field} — ${one.reason}`).join('\n');
    throw new Error(`This migration step cannot run as it is:\n${named}`);
  }
  const run: string[] = [];
  for (const change of plan.changes) {
    const statement = stepSQL(change, dialectName);
    await sql.raw(statement).execute(db);
    run.push(statement);
  }

  return run;
}
