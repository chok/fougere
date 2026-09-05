import { Lifecycle } from './Lifecycle.js';
import { Generators } from './Generators.js';
import { Clock } from './Clock.js';
import { type Field, type Fields } from '../../field/Field.js';

/**
 * So every storage realizes a create the same way.
 * FR : pour que chaque storage réalise une création de la même façon.
 * `applyCreate({ id: primary(), createdAt: created() }, { title: 'a' })`
 * → `id` generated, `createdAt` stamped, `title` untouched
 */
export function applyCreate(fields: Fields, input: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = { ...input };
  const instant = Clock.now();

  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    if (name in values) continue;
    const rule = Lifecycle.of(field);

    if (rule.create === 'now') values[name] = new Date(instant);
    else if (rule.literal) values[name] = freshValue(rule.literal.value);
    else if (rule.generator) values[name] = Generators.resolve(rule.generator)();
  }

  return values;
}

/**
 * So two rows created from one declared default never end up sharing the same object.
 * FR : pour que deux lignes nées d'un même défaut ne partagent pas l'objet.
 * `create: { value: [] }` → each instance gets its own array
 */
function freshValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  return structuredClone(value);
}

/**
 * So `updated()` is stamped by the storage, and no handler has to remember it.
 * FR : pour qu'`updated()` soit estampé par le storage, pas par le handler.
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
