/**
 * An operation's input contract, as oclif's args and flags.
 *
 * The same derivation `@fougere/cli` does for citty, against another target: what an entity
 * states is read once — a closed set becomes an `enum`, a `default(v)` is shown in `--help`,
 * and a field's own sentence is its description. Nothing is written down twice.
 *
 * The ARGUMENTS come from the operation's own input, never from the entity: `list` accepts
 * nothing while `create` accepts a draft, and an entity-wide derivation would demand a price
 * to read a list.
 */
import { Lifecycle, Role, Shapes, Visibility, type Fields } from '@fougere/schema';
import { Args, Flags } from '@oclif/core';
import type { ArgInput, FlagInput } from '@oclif/core/interfaces';

/** What a caller supplies: the fields the axes admit, or the PRIMARY when they admit nothing. */
function suppliedIn(fields: Fields): Fields {
  const written = Visibility.of(fields).input;
  if (Object.keys(written).length > 0) return written;

  return Object.fromEntries(
    Object.entries(fields).filter(([, field]) => Role.of(field).isPrimary),
  ) as Fields;
}

const kebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export interface Shape {
  args: ArgInput;
  flags: FlagInput;
}

/**
 * A parameter the scan read off the signature, when the operation names no view.
 *
 * `Crud(Product).findById(id: string)` takes a bare string — there is no entity to read axes
 * from, and the terminal would otherwise offer nothing at all. The signature is what remains,
 * and it says the name, the type, and whether it is optional.
 *
 * A parameter the framework fills is skipped: `user?: User` is resolved from the session, and
 * `invocation` is the envelope. Neither is a caller's to type.
 */
const RESOLVED = new Set(['user', 'invocation', 'ctx', 'context']);

export function paramsToShape(params: readonly { name: string; type: { name?: string }; optional?: boolean }[]): Shape {
  const args: Record<string, unknown> = {};
  const flags: Record<string, unknown> = {};
  let positional = false;

  for (const param of params) {
    if (RESOLVED.has(param.name)) continue;
    const type = param.type.name ?? 'string';
    if (!/^(string|number|boolean)$/.test(type)) continue;

    const required = param.optional !== true;
    if (!positional && required && type === 'string') {
      args[param.name] = Args.string({ required: true });
      positional = true;
      continue;
    }

    const at = kebab(param.name);
    flags[at] = type === 'boolean' ? Flags.boolean({})
      : type === 'number' ? Flags.integer({ required })
      : Flags.string({ required });
  }

  return { args: args as ArgInput, flags: flags as FlagInput };
}

/** One operation's input, as the pair oclif parses a command line into. */
export function inputToShape(fields: Fields): Shape {
  const args: Record<string, unknown> = {};
  const flags: Record<string, unknown> = {};
  let positional = false;

  for (const [key, field] of Object.entries(suppliedIn(fields))) {
    if (Role.of(field).isRelation) continue;

    const { base: shape, nullable } = Shapes.of(field.shape);
    const type = Shapes.typeOf(field.shape);
    const description = field.meta?.description;
    const required = Role.of(field).isPrimary || (!nullable && Lifecycle.of(field).requiredAtCreate);
    const options = shape?.type === 'string' && shape.enum?.length
      ? shape.enum.filter((value): value is string => typeof value === 'string')
      : undefined;

    // The first required plain string becomes positional, the rule `fougere explain --root`
    // and `fougere graph <root>` already follow. A closed set stays a flag: its legal values
    // read better named than guessed by position.
    if (!positional && required && type === 'text' && !options) {
      args[key] = Args.string({ description, required: true });
      positional = true;
      continue;
    }

    const at = kebab(key);
    const fallback = Lifecycle.of(field).literal?.value;
    flags[at] = options
      ? Flags.string({ description, options, required, default: fallback as string | undefined })
      : type === 'boolean' ? Flags.boolean({ description, default: fallback as boolean | undefined })
      : type === 'number' ? Flags.integer({ description, required, default: fallback as number | undefined })
      : Flags.string({ description, required, default: fallback as string | undefined });
  }

  return { args: args as ArgInput, flags: flags as FlagInput };
}
