import { Lifecycle } from './Lifecycle.js';
import { Clock } from './Clock.js';
import { type Field } from '../../field/Field.js';
import { type Fields } from '../../field/Fields.js';

/**
 * Fills what the declaration leaves to the storage, so no handler stamps a date itself.
 * FR : remplit ce que la déclaration laisse au storage : aucun handler n'estampe lui-même.
 * `applyCreate({ id: primary(), createdAt: created() }, { title: 'a' })` → `id`, `createdAt`
 */
export function applyCreate(
  fields: Fields,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const values: Record<string, unknown> = { ...input };
  const instant = Clock.now();

  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    if (name in values) continue;

    const born = Lifecycle.of(field).bornWith(instant);

    if (born) values[name] = born.value;
  }

  return values;
}

/**
 * The dual of `applyCreate` on a patch: only `update: 'now'` fields are touched.
 * FR : le dual d'`applyCreate` sur une modification : seuls les champs `update: 'now'`
 * sont touchés.
 * `applyUpdate(fields, { title: 'b' })` → `updatedAt` added, nothing else
 */
export function applyUpdate(
  fields: Fields,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const values: Record<string, unknown> = { ...patch };
  const instant = Clock.now();

  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    if (Lifecycle.of(field).stampedOnUpdate && !(name in values))
      values[name] = new Date(instant);
  }

  return values;
}

/**
 * A write over a row that exists: what it names, and what `update: 'now'` stamps. What the row
 * declares `update: 'forbidden'` keeps what it had, and so does every field the write leaves out.
 * FR : une écriture sur une ligne qui existe : ce qu'elle nomme, et ce que `update: 'now'` estampe.
 * `applyOverwrite(fields, { id, slug: 'moved', title: 'B' })` → `title`, `updatedAt`
 */
export function applyOverwrite(fields: Fields, input: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  const instant = Clock.now();

  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    const assigned = name in input ? { value: input[name] } : undefined;
    const written = Lifecycle.of(field).overwrittenWith(assigned, instant);

    if (written) values[name] = written.value;
  }

  return values;
}
