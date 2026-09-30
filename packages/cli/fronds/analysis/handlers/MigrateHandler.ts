import { loadConfig } from '@fougere/core/node';
import type { App } from '@fougere/core';
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
}

/**
 * Bringing the database up to what `fougere freeze` recorded — the one place a schema is written.
 *
 * A frond whose entities are not its last frozen version is refused before any database is
 * opened: a database another person or process shares receives what was frozen, reviewed and
 * committed, never what happens to be on disk. `latest` lifts that for a local database.
 *
 * The app is booted as its host would boot it, with the schema check and the seeds left out:
 * the check would refuse the very database this is here to bring up, and a migration plants no
 * rows. Booted rather than scanned, because a frond an extension brings — auth's sessions, a
 * workflow's journal — has tables too, and the scan alone never sees it.
 *
 * What touches live data runs FIRST: a rename moves a column before the additive pass would
 * otherwise add its new name empty beside it. Every change is skipped when the columns already
 * say it happened, so the whole thing replays safely.
 */
export default class MigrateHandler {
  constructor(private projectScan: ProjectScan) {}

  /**
   * Plan the migration, and run it when `apply` says so.
   *
   * `json` is the presentation's, so it is not part of what this operation receives.
   */
  async execute(input: Omit<Migrate, 'json'>): Promise<MigrationPlan> {
    const scan = await this.projectScan.at(input.root ?? undefined);
    const perFrond = await Promise.all(scan.fronds.map((frond) => stepsOf(frond.source.path)));
    const steps = perFrond.flat();
    const chain = versionsOf(steps);

    const unfrozen = input.latest ? [] : await unfrozenIn(scan.fronds);
    if (unfrozen.length > 0) return { chain, changes: [], added: [], warnings: [], ran: [], refusals: unfrozen };

    const config = await loadConfig(scan.root);
    const { bootApp, resolveStorage } = await import('@fougere/defaults');
    const storage = resolveStorage(config.db ?? {}, (config as { sources?: never }).sources, scan.root);
    if (!storage.db) {
      await storage.close?.();

      return {
        chain, changes: [], added: [], warnings: [], ran: [],
        refusals: [{ entity: '*', field: '*', reason: 'no `db` in fougere.config.ts — nothing to migrate' }],
      };
    }

    // Resolved from the project rather than named in this package's dependencies:
    // `@fougere/adapter-sql` declares `better-sqlite3`, so a CLI depending on it installs
    // 26 MB of native module into every `npm create fougere`. A project that migrates
    // declares the adapter itself, which is where this resolves from.
    const { actualState, desiredTables, planStep, collapseChain, applyStep, undeclaredColumns } = await import('@fougere/adapter-sql');

    const app = await bootApp(scan.root, { extensions: [{ name: 'schema' }, { name: 'seeds' }] });
    try {
      const tables = desiredTables(app as never);
      const frozen = collapseChain(perFrond.map((one) => collapseChain(one.map(({ step }) => step))));
      const composed = collapseChain([frozen, declaredStep(app, frozen)]);
      const sourceOf = storage.sourceOf ?? (() => 'db');

      const changes: StepChange[] = [];
      const refusals: Plan['refusals'] = [];
      const warnings: string[] = [];
      const plans: { plan: Plan; db: Parameters<typeof actualState>[0] }[] = [];
      for (const source of storage.sources?.() ?? ['db']) {
        const db = (source === 'db' ? storage.db : storage.dbOf?.(source)) as Parameters<typeof actualState>[0];
        if (!db) continue;

        const actual = await actualState(db);
        const plan = planStep(onSource(composed, source, sourceOf), tables, { actual });
        changes.push(...plan.changes);
        refusals.push(...plan.refusals);
        plans.push({ plan, db });

        const renamed = new Set(plan.changes.flatMap((change) => change.kind === 'renameColumn' ? [`${change.table}.${change.from}`] : []));
        const mine = tables.filter((table) => actual.has(table.name));
        for (const { table, columns, added } of undeclaredColumns(mine, actual)) {
          const left = columns.filter((column) => !renamed.has(`${table}.${column}`));
          if (left.length === 0) continue;
          warnings.push(
            `${table} keeps ${left.join(', ')}, which no field declares, while ${added.join(', ')} is added — `
            + `if one replaces the other, declare it on the entity: previous: { ${added[0]}: '${left[0]}' }`,
          );
        }
      }

      const moved = new Set(changes.flatMap((change) => change.kind === 'renameColumn' ? [`${change.table}.${change.to} — no column`] : []));
      const added = (await storage.pending?.(app) ?? []).filter((line) => !moved.has(line));

      if (!input.apply || refusals.length > 0) return { chain, changes, added, refusals, warnings, ran: [] };

      // Held back: a refusal anywhere stops every engine, for the reason it stops every
      // statement — half a chain is worse across two engines than within one.
      const ran: string[] = [];
      for (const { plan, db } of plans) ran.push(...(await applyStep(plan, db)));
      const drift = await storage.migrate?.(app);
      if (drift) warnings.push(drift);

      return { chain, changes, added, refusals, warnings, ran: [...ran, ...added] };
    } finally {
      await app.dispose();
      await storage.close?.();
    }
  }
}

/** What was never frozen, or moved since its last version — one refusal per frond or per entity. */
async function unfrozenIn(
  fronds: readonly { name: string; source: { path: string }; entities: readonly { name: string; entityClass: SchemaView }[] }[],
): Promise<Plan['refusals']> {
  const refusals: Plan['refusals'] = [];
  for (const frond of fronds.filter((one) => one.entities.length > 0)) {
    const last = await lastVersionOf(frond.source.path);
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

/**
 * The renames the entities state themselves — `previous: { content: 'body' }` — as a step, so
 * the live table is the baseline and no version has to have been frozen before the change. What
 * the frozen chain already renames is left out, or the same column would be renamed twice.
 */
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

/** The versions read, oldest first and each named once however many fronds cut it. */
function versionsOf(steps: readonly { version: string }[]): string[] {
  return [...new Set(steps.map(({ version }) => version))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

/** The part of a step whose entities live on one engine. */
function onSource(step: SetDiff, source: string, sourceOf: (entity: string) => string): SetDiff {
  return {
    ...step,
    entities: Object.fromEntries(Object.entries(step.entities).filter(([entity]) => sourceOf(entity) === source)),
  };
}

/** Every recorded step, oldest first — the chain composes, so it is replayed whole. */
async function stepsOf(frondPath: string): Promise<{ version: string; step: SetDiff }[]> {
  const chain = await chainOf(frondPath);

  // The first version has a shape and no step — there was nothing before it to move from.
  return chain.flatMap(({ name, step }) => (step ? [{ version: name, step }] : []));
}
