/** So a name that is not an identifier is still written as a key. */
export function propertyKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

/** So a sentence shows on hover — and cannot close the comment it sits in. */
export function docCommentOf(text: string | undefined, indent: string): string {
  if (!text) return '';

  return `${indent}/** ${text.replace(/\*\//g, '*\\/')} */\n`;
}
