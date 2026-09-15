/** What the family shares. `shop` declares it and answers nothing itself. */
export default class Money {
  format(cents: number): string {
    return `${(cents / 100).toFixed(2)} EUR`;
  }
}
