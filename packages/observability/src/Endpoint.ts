/**
 * Where a batch goes, and what a failure to send is allowed to do — nothing.
 *
 * A trace must never break the call it describes, so a refusal is reported through
 * `onError` or not at all, and `post` resolves either way.
 */
export class Endpoint {
  private constructor(
    private readonly url: string,
    private readonly onError: ((err: unknown) => void) | undefined,
  ) {}

  static at(url: string, onError?: (err: unknown) => void): Endpoint {
    return new Endpoint(url, onError);
  }

  /** The OTLP/HTTP encoding: JSON over a plain POST, so no protobuf and no dependency. */
  async post(body: unknown): Promise<void> {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) this.onError?.(new Error(`${this.url} answered HTTP ${response.status}`));
    } catch (err) {
      this.onError?.(err);
    }
  }
}
