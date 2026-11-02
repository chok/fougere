import pluralize from 'pluralize';

export function lowerFirst(text: string): string {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}

export function upperFirst(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/**
 * The plural of a name's last word — `orderItem` → `orderItems`, `category` → `categories`,
 * `inventory` → `inventories`. Every name a collection is given is read here, so a table and a
 * route never spell one entity two ways.
 */
export function pluralOf(name: string): string {
  const [, head, last] = /^(.*?)([A-Za-z][a-z0-9]*)$/.exec(name) ?? [, '', name];

  return head + pluralize(last!);
}

export function clean<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) if (obj[key] === undefined) delete obj[key];

  return obj;
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isArrayOf = <T>(
  values: readonly unknown[],
  is: (value: unknown) => value is T,
): values is readonly T[] => values.every(is);

