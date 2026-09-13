/** Raised by an adapter when a request claims JSON but cannot be parsed. */
export class MalformedJsonError extends Error {
  constructor(options?: ErrorOptions) {
    super('Malformed JSON body', options);
    this.name = 'MalformedJsonError';
  }
}
