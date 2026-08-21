export function clean<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj))
    if (obj[key] === undefined) delete obj[key];

  return obj;
}
