/**
 * The same handler, restricted to one audience — and still about no row.
 *
 * The default-surface loop treats "pointing at nothing" as legal; the named-surface loop
 * did not. It looked the entity up and `continue`d when it found none, so this file was
 * scanned, skipped, and never mentioned: no facade under `public`, and no line saying why.
 *
 * It answers something the default facade does not, so a test can tell which one replied.
 */
export default class HealthHandler {
  /** Whether this process can answer, for a caller that may see nothing else. */
  async check(): Promise<{ status: string; audience: string }> {
    return { status: 'up', audience: 'public' };
  }
}
