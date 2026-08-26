export function lowerFirst(text: string): string {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}

export function upperFirst(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export function clean<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) if (obj[key] === undefined) delete obj[key];

  return obj;
}
