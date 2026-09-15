/** One way to spell an amount, for every frond of the family. */
export default class Money {
  format(cents: number): string {
    return `${(cents / 100).toFixed(2)} EUR`;
  }
}
