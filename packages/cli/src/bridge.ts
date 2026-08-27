import { Lifecycle, Role } from '@fougere/schema';
/**
 * Entity → citty bridge.
 *
 * Converts Entity fields into citty ArgsDef.
 * The Entity IS the CLI definition — no duplicate schema.
 */
import type { Fields } from '@fougere/schema';
import { Anatomy, Visibility } from '@fougere/schema';
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
    const { base: shape, nullable } = Anatomy.of(field.shape);

    const kebab = toKebab(key);
    const def: ArgDef = {
      description: field.meta?.description,
      required: !nullable && Lifecycle.of(field).requiredAtCreate,
    };

    switch (shape?.type) {
      case 'boolean':
        (def as Record<string, unknown>).type = 'boolean';
        if (defaultValue !== undefined) def.default = defaultValue as boolean;
        break;
      case 'number':
      case 'integer':
      case 'string':
        // A closed set is citty's `enum`: the shape already names the legal values, so the
        // refusal and the `--help` listing come from the declaration rather than a check
        // written beside it.
        if (shape.type === 'string' && shape.enum?.length) {
          (def as Record<string, unknown>).type = 'enum';
          (def as Record<string, unknown>).options = shape.enum.filter((v) => v !== null);
        // A date-time string stays a named string — never a positional arg.
        } else if (shape.type === 'string' && shape.format === 'date-time') {
          (def as Record<string, unknown>).type = 'string';
        } else if (positionalIndex === 0 && def.required && key !== 'force') {
          // First non-bool required field becomes positional
          (def as Record<string, unknown>).type = 'positional';
          positionalIndex++;
        } else {
          (def as Record<string, unknown>).type = 'string';
        }
        if (defaultValue !== undefined) def.default = String(defaultValue);
        break;
      default:
        (def as Record<string, unknown>).type = 'string';
    }

    args[kebab === key ? key : kebab] = def;
  }

  return args;
}
