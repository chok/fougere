/** What both realizations spell identically — bytes in, bytes out, no platform. */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const bytesOf = (text: string): Uint8Array => encoder.encode(text);
export const textOf = (bytes: Uint8Array): string => decoder.decode(bytes);

/** Base64url, unpadded — what JWS puts between the dots. */
export function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? bytesOf(input) : input;
  let binary = '';
  // One character at a time: `String.fromCharCode(...bytes)` overflows the argument
  // limit on a key, and a signature is small enough that the loop costs nothing.
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64url(input: string): Uint8Array {
  const binary = atob(input.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Plain base64, padded — what an environment variable carries a PEM as. */
export function b64(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? bytesOf(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export const unb64 = (input: string): Uint8Array => {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** The DER a PEM wraps. */
export function derOf(pem: string): Uint8Array {
  const body = pem.replace(/-----(BEGIN|END)[^-]+-----/g, '').replace(/\s+/g, '');
  if (body.length === 0) throw new Error('Not a PEM: no base64 body between the armour');
  return unb64(body);
}
