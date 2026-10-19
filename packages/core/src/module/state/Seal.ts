import { b64url, bytesOf, textOf, unb64url } from '../../crypto/encoding.js';

/**
 * What the caller keeps, signed: `<value>.<signature>`, the value readable and never changeable — a
 * changed one no longer matches its signature, and reads as absent. Signed, not encrypted: what must
 * stay hidden from a caller is not handed to it, a reference is.
 */
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

/** In constant time: how long a comparison takes says nothing of how much matched. */
function same(given: Uint8Array, expected: Uint8Array): boolean {
  if (given.length !== expected.length) return false;
  let difference = 0;
  for (let at = 0; at < given.length; at++) difference |= given[at]! ^ expected[at]!;

  return difference === 0;
}
