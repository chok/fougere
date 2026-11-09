import { Lifecycle, Role, Shapes, Visibility, type Fields } from '@fougere/schema';
import { Args, Flags } from '@oclif/core';
import type { ArgInput, FlagInput } from '@oclif/core/interfaces';

function suppliedIn(fields: Fields): Fields {
  const written = Visibility.of(fields).input;
  if (Object.keys(written).length > 0) return written;

  return Object.fromEntries(
    Object.entries(fields).filter(([, field]) => Role.of(field).isPrimary()),
  ) as Fields;
}

const kebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export interface Shape {
  args: ArgInput;
  flags: FlagInput;
}

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
    flags[at] = type === 'boolean' ? Flags.boolean({}) : Flags.string({ required });
  }

  return { args: args as ArgInput, flags: flags as FlagInput };
}

/** One operation's input, as the pair oclif parses a command line into. */
export function inputToShape(fields: Fields): Shape {
  const args: Record<string, unknown> = {};
  const flags: Record<string, unknown> = {};
  let positional = false;

  for (const [key, field] of Object.entries(suppliedIn(fields))) {
    if (Role.of(field).isRelation()) continue;

    const { base: shape, nullable } = Shapes.of(field.shape);
    const type = Shapes.typeOf(field.shape);
    const description = field.shape?.description;
    const required = Role.of(field).isPrimary() || (!nullable && Lifecycle.of(field).requiredAtCreate());
    const options = shape && 'enum' in shape && shape.enum?.length
      ? shape.enum.filter((value) => value !== null).map(String)
      : undefined;

    if (!positional && required && type === 'text' && !options) {
      args[key] = Args.string({ description, required: true });
      positional = true;
      continue;
    }

    const at = kebab(key);
    const fallback = Lifecycle.of(field).literal?.value;
    flags[at] = type === 'boolean'
      ? Flags.boolean({ description, default: fallback as boolean | undefined })
      : Flags.string({ description, options, required, default: fallback === undefined ? undefined : String(fallback) });
  }

  return { args: args as ArgInput, flags: flags as FlagInput };
}

function renamed(parsed: Record<string, unknown>, names: readonly string[]): Record<string, unknown> {
  const byFlag = new Map(names.map((name) => [kebab(name), name]));

  return Object.fromEntries(Object.entries(parsed).map(([at, value]) => [byFlag.get(at) ?? at, value]));
}

/** The dual of `inputToShape`: what oclif parsed, handed back as the entity declares it. */
export function inputOf(fields: Fields, parsed: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(renamed(parsed, Object.keys(fields)))
      .map(([key, value]) => [key, Shapes.fromText(fields[key]?.shape, value)]),
  );
}

/** The dual of `paramsToShape`: an operation's bare parameters, under their own names. */
export function paramsOf(
  params: readonly { name: string; type?: { name?: string } }[],
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  const declared = new Map(params.map((param) => [param.name, param.type?.name]));

  return Object.fromEntries(
    Object.entries(renamed(parsed, params.map((param) => param.name)))
      .map(([name, value]) => [
        name,
        declared.get(name) === 'number' ? Shapes.fromText({ type: 'number' }, value) : value,
      ]),
  );
}
