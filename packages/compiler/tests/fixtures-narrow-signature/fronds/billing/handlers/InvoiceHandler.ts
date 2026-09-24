/** Un montant en centimes. Juste un number, avec une étiquette. */
export type Cents = number & { readonly __unit: 'cents' };

export default class InvoiceHandler {
  /** Doubler un montant — écrit avec `number`. */
  async doublePlain(amount: number): Promise<unknown> {
    return amount * 2;
  }

  /** Doubler un montant — écrit avec `Cents`. Rien d'autre ne change. */
  async doubleCents(amount: Cents): Promise<unknown> {
    return amount * 2;
  }
}
