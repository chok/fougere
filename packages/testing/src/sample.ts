import { inputFields, Role, type Field, type Fields, type SchemaView } from '@fougere/schema';
import { generateSync, type JsonSchema } from 'json-schema-faker';

/**
 * A body a client could legitimately send, built from what the entity declares.
 *
 * The shape IS JSON Schema, so the value itself is not ours to invent — `json-schema-faker`
 * honours `minLength`, `enum`, `format`, `pattern`, `items` and `required`. What is ours is
 * WHICH fields belong in a body, and that is `inputFields`: the one reader of the boundary
 * and lifecycle axes the façade and the form already stand on. Re-deriving "not primary,
 * not stamped, not read-only" here would make this a second opinion on the axes.
 */
export interface SampleOptions {
  /**
   * Fixes what is generated. Defaults to a value derived from the entity name, so two
   * runs agree and a failure is replayable — a body drawn afresh every time produces the
   * test that fails once in twenty and cannot be reproduced.
   */
  seed?: number;
}

/** Stable across runs and across machines: the entity name is the only input. */
function seedOf(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(hash) || 1;
}

/**
 * A relation has no value of its own to invent — `ref(Author)` names a row that must
 * exist, and a made-up id points at nothing. So it is REFUSED by name rather than
 * omitted: a body silently missing a required reference is a body the judge rejects for
 * a reason that has nothing to do with the test.
 */
function referencesIn(fields: Fields): string[] {
  return Object.entries(fields)
    .filter(([, field]) => Role.of(field as Field).isReference)
    .map(([name]) => name);
}

/**
 * The seed the last sample used, so a failure can say how to replay it.
 *
 * A stable seed nobody can read is a stable seed for nothing: the value has to reach the
 * person looking at the red line. Held here rather than returned, so the signature stays
 * the body a caller wanted.
 */
let lastSeed: { entity: string; seed: number } | undefined;

/** How to reproduce the last generated body, in the words that reproduce it. */
export function replaySeed(): string {
  return lastSeed
    ? `sampleInput(${lastSeed.entity}, {}, { seed: ${lastSeed.seed} })`
    : 'nothing has been sampled yet';
}

export function sampleInput(
  entity: SchemaView,
  given: Record<string, unknown> = {},
  options: SampleOptions = {},
): Record<string, unknown> {
  const fields = inputFields(entity.getFields());
  const missing = referencesIn(fields).filter((name) => !(name in given));
  if (missing.length > 0) {
    throw new Error(
      `[sampleInput] ${missing.join(', ')} ${missing.length > 1 ? 'are references' : 'is a reference'} — `
      + 'a generated id points at no row. Pass the ids: '
      + `sampleInput(Entity, { ${missing.map((n) => `${n}: '…'`).join(', ')} }).`,
    );
  }

  const seed = options.seed ?? seedOf(entity.name ?? 'anonymous');
  lastSeed = { entity: entity.name ?? 'Entity', seed };
  const body: Record<string, unknown> = {};
  let nth = 0;
  for (const [name, field] of Object.entries(fields)) {
    if (name in given) { body[name] = given[name]; continue; }
    // One seed per field, derived from one seed per entity: two fields of the same shape
    // would otherwise carry the same value, and a test asserting on `title` would pass
    // while reading `body`.
    // A `Shape` IS a JSON Schema; the two packages declare the same concept and only
    // disagree on `readonly`, which no value crosses.
    body[name] = generateSync((field as Field).shape as JsonSchema, { seed: seed + nth++ });
  }
  return body;
}
