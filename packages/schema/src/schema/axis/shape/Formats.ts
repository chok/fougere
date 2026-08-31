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

  static register(name: string, predicate: FormatPredicate): void {
    this.registry.set(name, predicate);
  }

  static resolve(name: string): FormatPredicate | undefined {
    return this.registry.get(name);
  }
}
