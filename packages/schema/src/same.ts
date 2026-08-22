/**
 * Two declared values, equal by their serialization. Key ORDER counts, and an
 * unserialisable value throws — both hold because a declaration is JSON by construction.
 */
export function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
