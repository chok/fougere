import { withFougere } from '@fougere/next/config';

/**
 * `.mjs` and not `.ts`: Next loads a TypeScript config through a CommonJS require, and
 * `@fougere/next` is ESM-only — the subpath does not resolve there. An `.mjs` config goes
 * through Node's ESM loader, which resolves it fine.
 *
 * `withFougere` states the two things Next has to know: the packages a boot loads at runtime,
 * and a minifier that keeps class names. Your own config goes in the object, untouched.
 */
export default withFougere();
