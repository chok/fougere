/**
 * A handler about no row at all — the case that used to vanish.
 *
 * There is no `Health` entity and there should not be one: nothing is stored, nothing
 * has a shape worth declaring. The frond scan found this class, and the façade loop
 * (which walked entities) then never built it — no door, no error, no log.
 */
export default class HealthHandler {
  /** Whether this process can answer. */
  async check(): Promise<{ status: string }> {
    return { status: 'up' };
  }
}
