import type { Fields } from './Field.js';

export type CompositeUnique<TFields extends Fields> = ReadonlyArray<
  ReadonlyArray<Extract<keyof TFields, string>>
>;

export interface EntityDeclarations<TFields extends Fields> {
  unique?: CompositeUnique<TFields>;
  hints?: Hints<TFields>;
  /**
   * What a field used to be called — read by `fougere freeze` and by nothing else.
   * It answers the one question two shapes cannot, and is meant to be deleted after.
   */
  previous?: Previous<TFields>;
}

/** New name to old name: the field states what it WAS, which is how a human writes it. */
export type Previous<TFields extends Fields> = {
  readonly [K in Extract<keyof TFields, string>]?: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
export interface FougereHints<K extends string> {}

export type Hints<TFields extends Fields> = {
  [A in keyof FougereHints<Extract<keyof TFields, string>>]?: FougereHints<
    Extract<keyof TFields, string>
  >[A];
};

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
