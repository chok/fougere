/**
 * Two declared values, compared member by member. Key ORDER does not count, and a Date
 * equals its clone — the two things serializing both sides got wrong, for twice the cost.
 */
export function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;

  const arrayed = Array.isArray(a);
  if (arrayed !== Array.isArray(b)) return false;
  if (arrayed) {
    const left = a as unknown[];
    const right = b as unknown[];
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) if (!same(left[i], right[i])) return false;
    return true;
  }

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  for (const key of keys) if (!(key in right) || !same(left[key], right[key])) return false;
  return true;
}
