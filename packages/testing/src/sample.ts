import { Role, Visibility, type Field, type Fields, type SchemaView } from '@fougere/schema';
import { generateSync, type JsonSchema } from 'json-schema-faker';

/** A body a client could legitimately send, built from what the entity declares. */
export interface SampleOptions {
  /** Fixes what is generated. */
  seed?: number;
}

function seedOf(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;

  return Math.abs(hash) || 1;
}

function referencesIn(fields: Fields): string[] {
  return Object.entries(fields)
    .filter(([, field]) => Role.of(field as Field).isReference())
    .map(([name]) => name);
}

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
  const fields = Visibility.of(entity.getFields()).input;
  const missing = referencesIn(fields).filter((name) => !(name in given));
  if (missing.length > 0) {
    throw new Error(
      `[sampleInput] ${missing.join(', ')} ${missing.length > 1 ? 'point' : 'points'} to other rows, which a generated id cannot do. `
      + 'Pass the ids: '
      + `sampleInput(Entity, { ${missing.map((n) => `${n}: '…'`).join(', ')} }).`,
    );
  }

  const seed = options.seed ?? seedOf(entity.name ?? 'anonymous');
  lastSeed = { entity: entity.name ?? 'Entity', seed };
  const input: Record<string, unknown> = {};
  let nth = 0;
  for (const [name, field] of Object.entries(fields)) {
    if (name in given) { input[name] = given[name]; continue; }
    input[name] = generateSync((field as Field).shape as JsonSchema, { seed: seed + nth++ });
  }

  return input;
}
