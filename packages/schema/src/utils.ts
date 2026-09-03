/**
 * So a class name becomes the key an entity registers under.
 * FR : pour qu'un nom de classe devienne la clé sous laquelle une entité s'enregistre.
 * `lowerFirst('Post')` → `'post'`
 */
export function lowerFirst(text: string): string {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}

/**
 * So a registration key becomes the class name a generated file declares.
 * FR : pour qu'une clé d'enregistrement redevienne le nom de classe d'un fichier généré.
 * `upperFirst('post')` → `'Post'`
 */
export function upperFirst(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/**
 * So a card carries no key whose value is `undefined`.
 * FR : pour qu'une carte ne porte aucune clé valant `undefined`.
 * `clean({ a: 1, b: undefined })` → `{ a: 1 }`
 */
export function clean<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) if (obj[key] === undefined) delete obj[key];

  return obj;
}

/**
 * So an array is not mistaken for a declaration, which `typeof` alone would allow.
 * FR : pour qu'un tableau ne passe pas pour une déclaration, ce que `typeof` permettrait.
 * `isObject([])` → `false`; `isObject({})` → `true`
 */
export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
