/** The port. Nothing declares it as one — a class that extends it does. */
export default class Payment {
  charge(cents: number): { provider: string; cents: number } {
    return { provider: 'none', cents };
  }

  refund(cents: number): boolean {
    return cents >= 0;
  }
}
