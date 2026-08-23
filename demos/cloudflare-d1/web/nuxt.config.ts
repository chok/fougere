export default defineNuxtConfig({
  modules: ['@fougere/nuxt'],
  compatibilityDate: '2026-08-01',
  // A consumer ships no server rows, so it needs no server storage — and Nitro's
  // cloudflare preset is the only line that says where this runs.
  nitro: { preset: process.env.NITRO_PRESET },
});
