/**
 * A Frond with no entity at all — an operation about no stored row is ordinary,
 * and its identity card publishes a door with no schema.
 */
export default class ShipmentHandler {
  /** What shipping this basket would cost. */
  async quote() {
    // Carriers are slow and uneven; that is the whole point of quoting one.
    await new Promise((resolve) => setTimeout(resolve, 8 + Math.floor(Math.random() * 45)));
    return { carrier: 'colissimo', cents: 490 + Math.floor(Math.random() * 300) };
  }

  /** Where a parcel is. */
  async track() {
    await new Promise((resolve) => setTimeout(resolve, 4 + Math.floor(Math.random() * 20)));
    return { status: 'in_transit' };
  }
}
