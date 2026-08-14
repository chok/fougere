/**
 * The key a class name is filed under — `AuthorUser` → `authorUser`. THE canonical
 * spelling, stated once because three places disagreed and only ever met on one-word
 * names: on `AuthorUser` the card wrote `authoruser` and the derived FK pointed at a
 * table no pass creates. Idempotent, so a card re-describes identically.
 */
export function registrationKeyOf(className: string): string {
  return className ? className[0].toLowerCase() + className.slice(1) : className;
}
