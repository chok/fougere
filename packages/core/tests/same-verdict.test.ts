/**
 * The law: one declaration, one verdict — whoever judges.
 *
 * The site says it (`useFormFor` : « local judge = remote judge »), the form primitive
 * is built on it, and nothing demonstrated it. Two judges are genuinely independent:
 *
 *   - the FORM calls `Schema.validate(body)` in the browser (`useFormFor.ts:46`);
 *   - the FAÇADE calls `Judge.row(schema.getFields(), inv.body, …)` (`bootstrap.ts:334`).
 *
 * REST and GraphQL are NOT a third and fourth: both resolve the façade and call it
 * (`routes.ts:214`, `pothos.ts:862`), so they are the same judge by construction.
 * Claiming four doors would have inflated the theorem; there are two.
 *
 * The inputs are not chosen, they are ENUMERATED from the declared fields — the judge
 * is a finite decision table (`validation.ts`), so for a given field the verdict and the
 * input that triggers it are both computable. Not fuzzing: a projection of the schema,
 * like the SQL table and the GraphQL type.
 */
import { Judge } from '@fougere/schema';
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, FougereError } from '../src/index.js';
import { EMPTY_INVOCATION } from '../src/wire/invocation.js';
import { inputFields, type Field, type SchemaView } from '@fougere/schema';
import type { EntityOrm, OrmFactory } from '../src/orm.js';
import Article from './fixtures-same-verdict/fronds/press/entities/Article.js';
import { NewArticle } from './fixtures-same-verdict/fronds/press/handlers/ArticleHandler.js';

const root = join(import.meta.dirname, 'fixtures-same-verdict');

/** A verdict, in the one shape both judges already speak. */
type Verdict = { ok: true } | { ok: false; errors: { path: string; message: string }[] };

const sorted = (errors: { path: string; message: string }[]) =>
  [...errors].sort((a, b) => (a.path + a.message).localeCompare(b.path + b.message));

/** What the browser does before sending — `useFormFor.ts:46`, verbatim. */
function verdictOfForm(schema: SchemaView & { validate(i: unknown): unknown }, body: unknown): Verdict {
  const result = schema.validate(body) as { success: boolean; errors?: { path: string; message: string }[] };
  return result.success ? { ok: true } : { ok: false, errors: sorted(result.errors ?? []) };
}

/** What the door does on arrival. A refusal is a typed error, not a return value. */
async function verdictOfFacade(run: ReturnType<typeof createLocalRunner>, op: string, body: unknown): Promise<Verdict> {
  const [entity, name] = op.split('.');
  try {
    await run({ entity, op: name }, { ...EMPTY_INVOCATION, body });
    return { ok: true };
  } catch (error) {
    if (!(error instanceof FougereError) || error.code !== 'VALIDATION_FAILED') throw error;
    return { ok: false, errors: sorted((error.details ?? []) as { path: string; message: string }[]) };
  }
}

/**
 * The decision table, applied to the declared fields.
 *
 * Three branches are pure axis reads, so they need no value synthesis beyond a valid
 * baseline: an absence no `lifecycle.create` answers is `Required`, a field absent from
 * `inputFields` supplied anyway is refused, a key outside the contract is `Unknown
 * field`. The bounded branch reads `shape` and violates it.
 *
 * The refusal is deliberately NOT spelled here. Against the entity it is `Read-only`
 * (the boundary axis), against a view that dropped the field it is `Unknown field` —
 * and which one is right depends on the schema the op names. Naming the expected
 * message would make this table a third judge; comparing the two is the whole point.
 */
function decisionTable(schema: SchemaView, baseline: Record<string, unknown>) {
  const all = schema.getFields();
  // `inputFields` IS the boundary reader — the same one the façade and the form
  // stand on. Re-deriving `boundary.in === 'closed'` here would make the test a
  // second opinion on the axis instead of a reader of it.
  const writable = new Set(Object.keys(inputFields(all)));
  const cases: { why: string; body: Record<string, unknown> }[] = [];

  for (const [name, field] of Object.entries(all) as [string, Field][]) {
    if (!field.lifecycle?.create && field.role?.relation?.kind !== 'many' && name in baseline) {
      const body = { ...baseline };
      delete body[name];
      cases.push({ why: `${name} absent → Required`, body });
    }
    if (!writable.has(name) && !field.role?.primary) {
      cases.push({ why: `${name} fourni → refusé en entrée`, body: { ...baseline, [name]: 'draft' } });
    }
    const max = (field.shape as { maxLength?: number } | undefined)?.maxLength;
    if (typeof max === 'number') {
      cases.push({ why: `${name} trop long → shape`, body: { ...baseline, [name]: 'x'.repeat(max + 1) } });
    }
    const min = (field.shape as { minLength?: number } | undefined)?.minLength;
    if (typeof min === 'number' && min > 0) {
      cases.push({ why: `${name} trop court → shape`, body: { ...baseline, [name]: 'x'.repeat(min - 1) } });
    }
  }

  cases.push({ why: 'clé hors contrat → Unknown field', body: { ...baseline, couleur: 'rouge' } });
  cases.push({ why: 'corps valide → accepté', body: { ...baseline } });
  return cases;
}

/**
 * Enumerated on the ENTITY, not on the op's view — the widest declaration.
 *
 * Built on the view, the table cannot see a divergence about a field the view dropped:
 * `status` supplied is `Read-only` against the entity and `Unknown field` against
 * `NewArticle`, and a table that never supplies `status` compares nothing. The first
 * version of this file had that blind spot, and passed while proving less.
 */
const baseline = { title: 'Un titre', body: 'Un corps' };
const table = decisionTable(Article, baseline);

describe('un corps, deux juges', () => {
  it('énumère la table de décision plutôt que des exemples choisis', () => {
    // Le garde-fou du garde-fou : si la table se vide, les tests ci-dessous
    // passeraient en ne prouvant rien.
    expect(table.length).toBeGreaterThanOrEqual(6);
    expect(table.map((c) => c.why)).toContain('clé hors contrat → Unknown field');
  });

  it('le formulaire et la façade rendent le même verdict, sur le schéma que le contrat nomme', async () => {
    await using app = await createApp({ root, createContainer, ormFactory: fakeOrm });
    const run = createLocalRunner(app);

    for (const { why, body } of table) {
      const form = verdictOfForm(NewArticle, body);
      const facade = await verdictOfFacade(run, 'article.create', body);
      expect(facade, why).toEqual(form);
    }
  });

  it("le même corps, en mémoire et après l'aller-retour JSON du fil", async () => {
    await using app = await createApp({ root, createContainer, ormFactory: fakeOrm });
    const run = createLocalRunner(app);

    for (const { why, body } of table) {
      const inMemory = await verdictOfFacade(run, 'article.create', body);
      const onTheWire = await verdictOfFacade(run, 'article.create', JSON.parse(JSON.stringify(body)));
      expect(onTheWire, why).toEqual(inMemory);
    }
  });
});

/** Storage is not what is under test — the judge runs before it. */
const fakeOrm: OrmFactory = () => {
  const row = { id: 'a1', ...baseline, status: 'draft', createdAt: new Date().toISOString() };
  return {
    list: async () => [], findById: async () => row, findBy: async () => row, findAllBy: async () => [],
    create: async () => row, update: async () => row, delete: async () => true,
    output(this: unknown) { return this; },
  } as unknown as EntityOrm;
};
