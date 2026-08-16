/**
 * The two form recognizers every judge uses. A shape is judged by the engine; the other
 * three axes are judged by hand, and by FORM — a brand would refuse a card another language
 * wrote, which is the one input the door exists to accept.
 */
export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Is this value one of a closed token list? The list is the runtime source, not a type. */
export const oneOfTokens = <T extends readonly string[]>(
  value: unknown,
  tokens: T,
): value is T[number] => typeof value === 'string' && (tokens as readonly string[]).includes(value);
