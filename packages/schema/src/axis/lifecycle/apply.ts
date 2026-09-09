import { Lifecycle } from './Lifecycle.js';
import { Generators } from './Generators.js';
import { Clock } from './Clock.js';
import { type Field, type Fields } from '../../field/Field.js';

/**
 * Fills what the declaration leaves to the storage, so no handler stamps a date itself.
 * FR : remplit ce que la déclaration laisse au storage : aucun handler n'estampe lui-même.
 * `applyCreate({ id: primary(), createdAt: created() }, { title: 'a' })` → `id`, `createdAt`
 */
export function applyCreate(fields: Fields, input: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = { ...input };
  const instant = Clock.now();

  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    if (name in values) continue;
    const rule = Lifecycle.of(field);

    if (rule.stampedAtCreate) values[name] = new Date(instant);
    else if (rule.literal) values[name] = freshValue(rule.literal.value);
    else if (rule.generator) values[name] = Generators.resolve(rule.generator)();
  }

  return values;
}

/**
 * Clones a declared default, so two rows born of `create: { value: [] }` hold two arrays.
 * FR : clone un défaut déclaré, pour que deux lignes nées de `create: { value: [] }`
 * tiennent deux tableaux.
 * `create: { value: [] }` → each instance gets its own array
 */
function freshValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  return structuredClone(value);
}

/**
 * The dual of `applyCreate` on a patch: only `update: 'now'` fields are touched.
 * FR : le dual d'`applyCreate` sur une modification : seuls les champs `update: 'now'`
 * sont touchés.
 * `applyUpdate(fields, { title: 'b' })` → `updatedAt` added, nothing else
 */
export function applyUpdate(fields: Fields, patch: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = { ...patch };
  const instant = Clock.now();

  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    if (Lifecycle.of(field).stampedOnUpdate && !(name in values))
      values[name] = new Date(instant);
  }

  return values;
}
