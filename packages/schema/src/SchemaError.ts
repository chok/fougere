export class SchemaError extends Error {
  constructor(message: string, options?: { received: unknown }) {
    super(
      options ? `${message} — got ${SchemaError.inspect(options.received)}` : message,
    );

    this.name = 'SchemaError';
  }

  static inspect(value: unknown): string {
    return JSON.stringify(value) ?? typeof value;
  }
}
