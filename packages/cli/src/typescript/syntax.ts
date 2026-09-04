/**
 * So a name that is not an identifier is still written as a key.
 * FR : pour qu'un nom qui n'est pas un identifiant s'écrive quand même en clé.
 * `propertyKey('content-type')` → `"content-type"`
 */
export function propertyKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

/**
 * So a sentence shows on hover — and cannot close the comment it sits in.
 * FR : pour qu'une phrase s'affiche au survol sans fermer son commentaire.
 * A comment terminator inside the text is escaped, so it cannot end the block.
 */
export function docCommentOf(text: string | undefined, indent: string): string {
  if (!text) return '';

  return `${indent}/** ${text.replace(/\*\//g, '*\\/')} */\n`;
}
