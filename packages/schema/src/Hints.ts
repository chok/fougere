import type { FieldName, Fields } from './Field.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
export interface FougereHints<K extends string> {}

export type Hints<TFields extends Fields> = Partial<FougereHints<FieldName<TFields>>>;

export function deriveHints(
  hints: Hints<Fields> | undefined,
  transform: (key: string) => string | undefined,
): Hints<Fields> | undefined {
  if (!hints) return undefined;
  const out: Record<string, Record<string, unknown>> = {};
  for (const [adapter, perField] of Object.entries(hints as Record<string, Record<string, unknown> | undefined>)) {
    if (!perField || typeof perField !== 'object') continue;
    const mapped: Record<string, unknown> = {};
    for (const [key, hint] of Object.entries(perField)) {
      const next = transform(key);
      if (next !== undefined) mapped[next] = hint;
    }
    if (Object.keys(mapped).length) out[adapter] = mapped;
  }
  return Object.keys(out).length ? (out as Hints<Fields>) : undefined;
}
