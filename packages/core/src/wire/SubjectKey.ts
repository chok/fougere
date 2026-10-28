/**
 * The container key of a port with a subject, spelled as the type is written — `Repository<Post>`,
 * `Emit<CanBook, Verdict>`, `Together<[Account, Ledger]>`. A class name cannot hold a `<`, so no class
 * of a frond can take one, and the scan reads the same key wherever the type is written.
 *
 * Documented: [ports](https://fougere.dev/docs/business/ports).
 */
export function subjectKeyOf(port: string, ...subjects: readonly string[]): string {
  return `${port}<${subjects.join(', ')}>`;
}

/** The subjects behind a key of that port — `['CanBook', 'Verdict']` — or `undefined` when it is not one. */
export function subjectsOf(key: string, port: string): string[] | undefined {
  if (!key.startsWith(`${port}<`) || !key.endsWith('>')) return undefined;

  return topLevel(key.slice(port.length + 1, -1));
}

/** Splits on the commas no bracket encloses: `[Account, Ledger], [RateMirror]` is two subjects. */
function topLevel(inside: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < inside.length; at++) {
    const char = inside[at];
    if (char === '<' || char === '[') depth++;
    else if (char === '>' || char === ']') depth--;
    else if (char === ',' && depth === 0) {
      parts.push(inside.slice(start, at).trim());
      start = at + 1;
    }
  }
  parts.push(inside.slice(start).trim());

  return parts.filter(Boolean);
}
