export type StringFormat =
  | 'date-time'
  | 'date'
  | 'time'
  | 'email'
  | 'uuid'
  | 'uri'
  | (string & {});

export type FormatPredicate = (value: string) => boolean;

export class Formats {
  private static readonly registry = new Map<string, FormatPredicate>();

  /**
   * So an app can teach the judge a format the engine never heard of.
   * FR : pour qu'une application apprenne au juge un format inconnu du moteur.
   * `Formats.register('siret', (v) => /^\d{14}$/.test(v))`
   */
  static register(name: string, predicate: FormatPredicate): void {
    this.registry.set(name, predicate);
  }

  /**
   * So the judge asks by name, and gets nothing back when the format is the engine's own.
   * FR : pour que le juge demande par le nom, et n'obtienne rien pour un format du moteur.
   * `Formats.resolve('email')` → `undefined` — the engine already judges it
   */
  static resolve(name: string): FormatPredicate | undefined {
    return this.registry.get(name);
  }
}
