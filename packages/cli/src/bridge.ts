import { Lifecycle, Role } from '@fougere/schema';
/** Entity → citty bridge. */
import type { Fields } from '@fougere/schema';
import { Shapes, Visibility, type ShapeType } from '@fougere/schema';
import type { ArgsDef, ArgDef } from 'citty';

function toKebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

function suppliedIn(fields: Fields): Fields {
  const written = Visibility.of(fields).input;
  if (Object.keys(written).length > 0) return written;

  return Object.fromEntries(
    Object.entries(fields).filter(([, field]) => Role.of(field).isPrimary()),
  ) as Fields;
}

/** Convert an Entity's fields into citty args definition. */
export function entityToArgs(fields: Fields): ArgsDef {
  const args: ArgsDef = {};
  let positionalIndex = 0;

  for (const [key, field] of Object.entries(suppliedIn(fields))) {
    if (Role.of(field).isRelation()) continue;

    const defaultValue = Lifecycle.of(field).literal?.value;
    const { base: shape, nullable } = Shapes.of(field.shape);
    const type = Shapes.typeOf(field.shape);
    const designates = Role.of(field).isPrimary();
    const common = {
      description: field.shape?.description,
      required: designates || (!nullable && Lifecycle.of(field).requiredAtCreate()),
    };

    const options = shape && 'enum' in shape && shape.enum?.length
      ? shape.enum.filter((value) => value !== null).map(String)
      : undefined;
    const positional = positionalIndex === 0
      && common.required
      && key !== 'force'
      && options === undefined
      && type !== 'boolean'
      && type !== 'date';
    if (positional) positionalIndex++;

    args[toKebab(key) === key ? key : toKebab(key)] = argFor(
      type,
      common,
      defaultValue,
      options,
      positional,
    );
  }

  return args;
}

const CARRIES_DEFAULT: Record<ShapeType, boolean> = {
  number: true,
  integer: true,
  text: true,
  date: true,
  choice: true,
  boolean: false,
  object: false,
  array: false,
};

function argFor(
  type: ShapeType | undefined,
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

  const withDefault = type && CARRIES_DEFAULT[type] && defaultValue !== undefined
    ? { default: String(defaultValue) }
    : {};

  if (options) return { ...common, ...withDefault, type: 'enum', options };
  if (positional) return { ...common, ...withDefault, type: 'positional' };

  return { ...common, ...withDefault, type: 'string' };
}
