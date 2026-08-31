import { Lifecycle } from './Lifecycle.js';
import { Generators } from './Generators.js';
import { Clock } from './Clock.js';
import { type Field, type Fields } from '../../fields/Field.js';

type Row = Record<string, unknown>;

export function applyCreate(fields: Fields, input: Row): Row {
  const out: Row = { ...input };
  const instant = Clock.now();

  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    if (name in out) continue;
    const rule = Lifecycle.of(field);

    if (rule.create === 'now') out[name] = new Date(instant);
    else if (rule.literal) out[name] = freshValue(rule.literal.value);
    else if (rule.generator) out[name] = Generators.resolve(rule.generator)();
  }

  return out;
}

function freshValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  return structuredClone(value);
}

export function applyUpdate(fields: Fields, patch: Row): Row {
  const out: Row = { ...patch };
  const instant = Clock.now();

  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    if (Lifecycle.of(field).stampedOnUpdate && !(name in out))
      out[name] = new Date(instant);
  }

  return out;
}
