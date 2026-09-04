import { Lifecycle, Role } from '@fougere/schema';
/** Entity → citty bridge. */
import type { Fields } from '@fougere/schema';
import { Shapes, Visibility } from '@fougere/schema';
import type { ArgsDef, ArgDef } from 'citty';

function toKebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

/** Convert an Entity's fields into citty args definition. */
export function entityToArgs(fields: Fields): ArgsDef {
  const args: ArgsDef = {};
  let positionalIndex = 0;

  // Axes-derived ingress membership; the CLI additionally skips ALL relations
  // (a ref is not a flag — supplying related rows is not a CLI gesture).
  for (const [key, field] of Object.entries(Visibility.of(fields).input)) {
    if (Role.of(field).relation) continue;

    // A `default(v)` travels as the create rule `{ value }` — citty shows it.
    const defaultValue = Lifecycle.of(field).literal?.value;
    const { base: shape, nullable } = Shapes.of(field.shape);
    const common = {
      description: field.meta?.description,
      required: !nullable && Lifecycle.of(field).requiredAtCreate,
    };

    // A closed set is citty's `enum`: the shape already names the legal values, so the
    // refusal and the `--help` listing come from the declaration rather than a check
    // written beside it.
    const options = shape?.type === 'string' && shape.enum?.length
      ? shape.enum.filter((value): value is string => value !== null)
      : undefined;
    // First required field becomes positional — but never a boolean, a closed set, or a
    // date-time, which stay named flags.
    const positional = positionalIndex === 0
      && common.required
      && key !== 'force'
      && options === undefined
      && shape?.type !== 'boolean'
      && !(shape?.type === 'string' && shape.format === 'date-time');
    if (positional) positionalIndex++;

    args[toKebab(key) === key ? key : toKebab(key)] = argFor(
      shape?.type,
      common,
      defaultValue,
      options,
      positional,
    );
  }

  return args;
}

/** One arg, built WITH its `type`. */
function argFor(
  type: string | undefined,
  common: { description?: string; required: boolean },
  defaultValue: unknown,
  options: string[] | undefined,
  positional: boolean,
): ArgDef {
  if (type === 'boolean') {
    return defaultValue === undefined
      ? { ...common, type: 'boolean' }
      : { ...common, type: 'boolean', default: defaultValue as boolean };
  }

  // Only these three shapes carry a default onto the CLI; anything else is named and bare.
  const carriesDefault = type === 'number' || type === 'integer' || type === 'string';
  const withDefault = carriesDefault && defaultValue !== undefined
    ? { default: String(defaultValue) }
    : {};

  if (options) return { ...common, ...withDefault, type: 'enum', options };
  if (positional) return { ...common, ...withDefault, type: 'positional' };

  return { ...common, ...withDefault, type: 'string' };
}
