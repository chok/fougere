/**
 * The boot, re-exported under a path inside this package.
 *
 * Every runtime file here reaches `@fougere/app` by name, because it is resolved
 * from this package's own node_modules. The generated Nitro plugin cannot: it is
 * written into the user's `.nuxt/`, so a bare `@fougere/app` would be resolved from
 * the USER's project, where a transitive dependency is not visible under pnpm.
 *
 * So the codegen imports this file by absolute path, and this file — which does sit
 * in `@fougere/nuxt` — does the resolving. One indirection, one reason.
 */
export { configureFougere, useFougereApp, type FougereServerConfig } from '@fougere/app';
