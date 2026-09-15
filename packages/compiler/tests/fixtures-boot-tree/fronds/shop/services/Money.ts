/** What the family shares. `shop` answers at no address of its own. */
export default class Money {
  format(cents: number): string {
    return `${(cents / 100).toFixed(2)} EUR`;
  }
}
