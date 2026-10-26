import type Partner from '../entities/Partner.js';

/**
 * The wire to the partner. The address is not written in the frond — it arrives from
 * the environment, like every other thing the declaration must not name.
 */
export default class PartnerApi {
  constructor(private readonly partner: Partner) {}

  async page(page: number, since?: Date): Promise<{ items: Record<string, unknown>[]; next: number | null }> {
    const query = new URLSearchParams({ page: String(page) });
    if (since) query.set('since', since.toISOString());
    const response = await fetch(`${this.partner.url}/books?${query}`);

    return await response.json() as { items: Record<string, unknown>[]; next: number | null };
  }
}
