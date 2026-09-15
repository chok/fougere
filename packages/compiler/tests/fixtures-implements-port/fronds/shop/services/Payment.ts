/** The port — a class, so a realization is recognized by extending it. */
export default class Payment {
  charge(_cents: number): string { return 'none'; }
}
