// Two neighbours, both resolved by TYPE. Nothing in this file says either one runs in
// another process — that is stated once, in `remotes:`, and nowhere else.
declare class ProductHandler {
  list(): Promise<unknown[]>;
}
declare class ShipmentHandler {
  quote(): Promise<{ cents: number }>;
}

export default class CartHandler {
  constructor(
    private productHandler: ProductHandler,
    private shipmentHandler: ShipmentHandler,
  ) {}

  /** What is in the cart, priced by the catalog and quoted by shipping. */
  async checkout() {
    const products = await this.productHandler.list();
    const shipping = await this.shipmentHandler.quote();
    return { items: products.length, shipping: shipping.cents };
  }

  /** The monthly roll-up — deliberately uneven, so a histogram has a shape to show. */
  async report() {
    const products = await this.productHandler.list();
    await new Promise((resolve) => setTimeout(resolve, 5 + Math.floor(Math.random() * 180)));
    return { lines: products.length };
  }
}
