/**
 * The wire to the partner. The address is not written in the frond — it arrives from
 * the environment, like every other thing the declaration must not name.
 */
export default class PartnerApi {
  private readonly base = process.env.PARTNER_URL ?? 'http://127.0.0.1:4300';

  async page(page: number, since?: Date): Promise<{ items: Record<string, unknown>[]; next: number | null }> {
    const query = new URLSearchParams({ page: String(page) });
    if (since) query.set('since', since.toISOString());
    const response = await fetch(`${this.base}/books?${query}`);
    return await response.json() as { items: Record<string, unknown>[]; next: number | null };
  }
}
