import { withFougere } from '@fougere/next/config';

/**
 * `.mjs` and not `.ts`: Next loads a TypeScript config through a CommonJS require,
 * and `@fougere/next` is ESM-only — the subpath simply does not resolve there
 * (`ERR_PACKAGE_PATH_NOT_EXPORTED`, measured). An `.mjs` config is loaded by Node's
 * ESM loader, which resolves it fine.
 *
 * `withFougere` sets the two things Next has to know: the packages a boot loads at
 * runtime, and a minifier that keeps class names — designation reads `Post.name`,
 * and a renamed class makes a production build ask for an entity nobody hosts.
 *
 * Your own config goes in the object, untouched.
 */
export default withFougere();
