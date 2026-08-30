// Nuxt's virtual barrel has no file to resolve to; the shim says where its types are,
// never what they say. (`nitropack/runtime` is redirected by tsconfig paths instead:
// it DOES resolve, and an ambient declaration cannot override a resolution.)
declare module '#imports' {
  // Nuxt's virtual barrel, resolved when the app builds.
  export * from 'nuxt/app';
}
