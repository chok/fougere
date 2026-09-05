import { describe, it, expect } from 'vitest';
import { createLocalRunner, validationErrorsOf, type App } from '@fougere/core';
import { EMPTY_INVOCATION } from '@fougere/core/contract';
import { lowerFirst, Visibility, type SchemaView, type ValidationError } from '@fougere/schema';
import { Cases } from '@fougere/schema';
import { derivedCases } from './derive.js';
import { sampleInput, replaySeed, type SampleOptions } from './sample.js';

/** The one shape both the local validator and a door already speak. */
export interface Verdict {
  success: boolean;
  errors?: ValidationError[];
}

/** What a door answers, in the shape a verdict is compared in. */
export async function verdictOf(call: () => Promise<unknown>): Promise<Verdict> {
  try {
    await call();
    return { success: true };
  } catch (error) {
    const refusals = validationErrorsOf(error);
    if (!refusals) throw error;
    return { success: false, errors: refusals };
  }
}

function opsFor(entity: SchemaView): { create: string; update: string; name: string } {
  const name = lowerFirst(entity.name ?? '');
  return { name, create: 'create', update: 'update' };
}

export interface CheckOptions extends SampleOptions {
  /** Values the generator cannot invent — the id of a row a `ref()` points at. */
  given?: Record<string, unknown>;
}

/** The declared contract, posed to the façade that will receive it. */
export function checkContract(app: App, entity: SchemaView, options: CheckOptions = {}): void {
  const { name, create, update } = opsFor(entity);
  const run = createLocalRunner(app);
  const table = derivedCases(entity, options.given ?? {}, options);

  describe(`${entity.name} — the contract it declares`, () => {
    for (const one of table) {
      it(one.why, async () => {
        const verdict = await verdictOf(() => run(
          { entity: name, op: one.patch ? update : create },
          { ...EMPTY_INVOCATION, params: one.patch ? { id: '__absent__' } : {}, input: one.input },
        ));

        expect(Cases.holds(one.expect, verdict), `${JSON.stringify(verdict)} — replay: ${replaySeed()}`).toBe(true);
      });
    }
  });
}

/** What may leave, checked against what the entity says may leave. */
export function checkOutput(app: App, entity: SchemaView, options: CheckOptions = {}): void {
  const { name, create } = opsFor(entity);
  const run = createLocalRunner(app);
  const allowed = new Set(Object.keys(Visibility.of(entity.getFields()).output));
  const closed = Object.keys(entity.getFields()).filter((field) => !allowed.has(field));

  describe(`${entity.name} — what leaves it`, () => {
    it(closed.length > 0 ? `keeps ${closed.join(', ')} in` : 'closes no field, and says so', async () => {
      const row = await run(
        { entity: name, op: create },
        { ...EMPTY_INVOCATION, input: sampleInput(entity, options.given ?? {}, options) },
      ) as Record<string, unknown>;

      expect(Object.keys(row).filter((field) => closed.includes(field))).toEqual([]);
    });

    it('answers with fields the entity declares, and no others', async () => {
      const row = await run(
        { entity: name, op: create },
        { ...EMPTY_INVOCATION, input: sampleInput(entity, options.given ?? {}, options) },
      ) as Record<string, unknown>;

      // A computed field from a presenter is declared by the presenter, not the entity,
      // so this reads the entity's own names as a floor rather than a ceiling.
      expect(Object.keys(row).every((field) => field in entity.getFields())).toBe(true);
    });
  });
}
