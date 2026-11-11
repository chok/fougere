import { loadConfig } from '@fougere/core/node';
import { resolveConventions, sourceViewOf, type App } from '@fougere/core';
import type { Plan, StepChange } from '@fougere/adapter-sql';
import { Bundle, Card, lowerFirst, type Change, type SchemaView, type SetDiff } from '@fougere/schema';
import ProjectScan from '../services/ProjectScan.js';
import { chainOf, lastVersionOf, shapesOf } from '../versions.js';
import type Migrate from '../entities/Migrate.js';

export interface MigrationPlan {
  /** Versions whose step was read, oldest first. */
  chain: string[];
  /** What touches live data — renames and drops, from the frozen chain and from `previous:`. */
  changes: StepChange[];
  /** What the additive pass creates — a table, a column. */
  added: string[];
  refusals: Plan['refusals'];
  /** What the plan cannot decide and a reader should — an undeclared rename, a drift. */
  warnings: string[];
  /** The statements actually run — empty unless `apply` was asked for. */
  ran: string[];
  /** The tables read on each SQL source. */
  checked: { source: string; tables: string[] }[];
}

/** Bringing the database up to what `fougere freeze` recorded — the one place a schema is written. */
export default class MigrateHandler {
  constructor(private projectScan: ProjectScan) {}

  /** Plan the migration, and run it when `apply` says so. */
  async execute(input: Omit<Migrate, 'json'>): Promise<MigrationPlan> {
    const scan = await this.projectScan.at(input.root ?? undefined);
    const { versions } = resolveConventions(scan.config.conventions).dirs;
    const perFrond = await Promise.all(scan.fronds.map((frond) => stepsOf(frond.source.path, versions)));
    const steps = perFrond.flat();
    const chain = versionsOf(steps);

    const unfrozen = input.latest ? [] : await unfrozenIn(scan.fronds, versions);
    if (unfrozen.length > 0) return { chain, changes: [], added: [], warnings: [], ran: [], checked: [], refusals: unfrozen };

    const config = await loadConfig(scan.root);
    const { bootApp, resolveStorage } = await import('@fougere/defaults');
    const storage = resolveStorage(config.sources, scan.root);
    const engines = (storage.sources?.() ?? []).filter((source) => storage.dbOf?.(source) !== undefined);
    if (engines.length === 0) {
      await storage.close?.();

      return { chain, changes: [], added: [], warnings: [], ran: [], checked: [], refusals: [] };
    }

    const { actualState, desiredTables, planStep, collapseChain, applyStep, undeclaredColumns } = await import('@fougere/adapter-sql');

    const app = await bootApp(scan.root, { extensions: [{ name: 'schema' }, { name: 'seeds' }] });
    try {
      const tables = desiredTables(sourceViewOf(app.fronds));
      const frozen = collapseChain(perFrond.map((one) => collapseChain(one.map(({ step }) => step))));
      const composed = collapseChain([frozen, declaredStep(app, frozen)]);
      const sourceOf = storage.sourceOf ?? (() => engines[0]!);

      const changes: StepChange[] = [];
      const refusals: Plan['refusals'] = [];
      const warnings: string[] = [];
      const plans: { plan: Plan; db: Parameters<typeof actualState>[0] }[] = [];
      const checked: MigrationPlan['checked'] = [];
      for (const source of engines) {
        const db = storage.dbOf!(source) as Parameters<typeof actualState>[0];

        const actual = await actualState(db);
        const plan = planStep(onSource(composed, source, sourceOf), tables, { actual });
        changes.push(...plan.changes);
        refusals.push(...plan.refusals);
        plans.push({ plan, db });

        const planned = new Set(plan.changes.map((change) => `${change.table}.${change.kind === 'renameColumn' ? change.from : change.column}`));
        const mine = tables.filter((table) => actual.has(table.name));
        checked.push({ source, tables: mine.map((table) => table.name) });
        for (const { table, columns, added } of undeclaredColumns(mine, actual)) {
          const left = columns.filter((column) => !planned.has(`${table}.${column}`));
          if (left.length === 0) continue;
          warnings.push(
            `${table} keeps ${left.join(', ')}, which no field declares, while ${added.join(', ')} is added — `
            + `if one replaces the other, declare it on the entity: previous: { ${added[0]}: '${left[0]}' }`,
          );
        }
      }

      const moved = new Set(changes.flatMap((change) => change.kind === 'renameColumn' ? [`${change.table}.${change.to} — no column`] : []));
      const added = (await storage.pending?.(app) ?? []).filter((line) => !moved.has(line));

      if (!input.apply || refusals.length > 0) return { chain, changes, added, refusals, warnings, ran: [], checked };

      const ran: string[] = [];
      for (const { plan, db } of plans) ran.push(...(await applyStep(plan, db)));
      const drift = await storage.migrate?.(app);
      if (drift) warnings.push(drift);

      return { chain, changes, added, refusals, warnings, ran: [...ran, ...added], checked };
    } finally {
      await app.dispose();
      await storage.close?.();
    }
  }
}

async function unfrozenIn(
  fronds: readonly { name: string; source: { path: string }; entities: readonly { name: string; entityClass: SchemaView }[] }[],
  versions: string,
): Promise<Plan['refusals']> {
  const refusals: Plan['refusals'] = [];
  for (const frond of fronds.filter((one) => one.entities.length > 0)) {
    const last = await lastVersionOf(frond.source.path, versions);
    if (!last) {
      refusals.push({ entity: frond.name, field: '*', reason: 'never frozen — fougere freeze v1, or migrate --latest on a local database' });
      continue;
    }

    const step = Bundle.fromDescriptor(last.bundle).diff(Bundle.fromDescriptor(shapesOf(frond.entities)));
    const moved = [...Object.keys(step.entities), ...step.entitiesAdded, ...step.entitiesRemoved];
    for (const entity of moved) {
      refusals.push({ entity, field: '*', reason: `changed since ${last.name} — freeze it (fougere freeze <version>), or migrate --latest on a local database` });
    }
  }

  return refusals;
}

function declaredStep(app: App, frozen: SetDiff): SetDiff {
  const entities: SetDiff['entities'] = {};
  for (const frond of app.fronds) {
    for (const { name, entityClass } of frond.entities) {
      const previous = entityClass.previous as Record<string, string> | undefined;
      if (!previous) continue;

      const key = lowerFirst(name);
      const known = frozen.entities[key]?.changes ?? [];
      const properties = Card.fromSchema(entityClass).descriptor.properties;
      const changes = Object.entries(previous)
        .filter(([now, was]) => !known.some((change) => change.kind === 'renamed' && change.from === was && change.to === now))
        .map(([now, was]): Change => ({ kind: 'renamed', from: was, to: now, field: properties[now] }));
      if (changes.length > 0) entities[key] = { changes, ambiguous: [] };
    }
  }

  return { entities, entitiesAdded: [], entitiesRemoved: [] };
}

function versionsOf(steps: readonly { version: string }[]): string[] {
  return [...new Set(steps.map(({ version }) => version))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

function onSource(step: SetDiff, source: string, sourceOf: (entity: string) => string | undefined): SetDiff {
  return {
    ...step,
    entities: Object.fromEntries(Object.entries(step.entities).filter(([entity]) => sourceOf(entity) === source)),
  };
}

async function stepsOf(frondPath: string, versions: string): Promise<{ version: string; step: SetDiff }[]> {
  const chain = await chainOf(frondPath, versions);

  return chain.flatMap(({ name, step }) => (step ? [{ version: name, step }] : []));
}
