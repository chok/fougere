export default defineNuxtConfig({
  modules: ['@fougere/nuxt'],
  // Fronds are shared at the workspace root, two levels up from apps/<name>.
  fougere: { root: '../..' },
  compatibilityDate: '2026-07-20',
});
