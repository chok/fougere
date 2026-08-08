/** The warehouse's view of a product — same class name, another frond. */
export default class ProductHandler {
  /** Which frond answered. */
  async who(): Promise<string> {
    return 'inventory';
  }
}
