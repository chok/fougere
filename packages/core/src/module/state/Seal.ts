import { b64url, bytesOf, textOf, unb64url } from '../../crypto/encoding.js';

/** What the caller keeps, signed and readable; a changed value reads as absent. */
export class Seal {
  private constructor(private readonly mac: (data: Uint8Array) => Promise<Uint8Array>) {}

  static async under(secret: string, macOf: (secret: string) => Promise<(data: Uint8Array) => Promise<Uint8Array>>): Promise<Seal> {
    return new Seal(await macOf(secret));
  }

  async close(value: unknown): Promise<string> {
    const payload = b64url(JSON.stringify(value));

    return `${payload}.${b64url(await this.mac(bytesOf(payload)))}`;
  }

  /** The value a token carries, or `undefined` when it was not ours or was changed since. */
  async open(token: string): Promise<unknown> {
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return undefined;
    const payload = token.slice(0, dot);

    try {
      if (!same(unb64url(token.slice(dot + 1)), await this.mac(bytesOf(payload)))) return undefined;

      return JSON.parse(textOf(unb64url(payload)));
    } catch {
      return undefined;
    }
  }
}

function same(given: Uint8Array, expected: Uint8Array): boolean {
  if (given.length !== expected.length) return false;
  let difference = 0;
  for (let at = 0; at < given.length; at++) difference |= given[at]! ^ expected[at]!;

  return difference === 0;
}
