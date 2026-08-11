/**
 * The key a class name is filed under — `AuthorUser` → `authorUser`.
 *
 * THE canonical spelling, stated here because it was stated three times and the three
 * disagreed: core's `toRegistrationName` lowered the first letter, `describe` lowercased
 * the name wholesale, and `schema-sql` fell back to a no-op on anything already lowered.
 * On a one-word name all three agree, which is why nothing in this repo ever met the
 * divergence. On `AuthorUser` the card wrote `authoruser`, and the FK derived from it
 * pointed at `authorusers` while the table it should reference was `author_users` — a
 * reference to a table no pass ever creates.
 *
 * Idempotent, so a name that already arrived in this form crosses unchanged and
 * re-describing a reconstructed schema yields the same card.
 */
export function registrationKeyOf(className: string): string {
  return className ? className[0].toLowerCase() + className.slice(1) : className;
}
