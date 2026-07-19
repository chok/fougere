export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/content', '@nuxtjs/i18n', '@fougere/nuxt'],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2026-07-18',
  components: [
    // content/ components are global (usable from markdown) and unprefixed.
    { path: '~/components/content', global: true, pathPrefix: false },
    '~/components',
  ],
  content: {
    build: {
      markdown: {
        highlight: {
          theme: { default: 'github-light', dark: 'github-dark' },
          langs: ['ts', 'vue', 'bash', 'json', 'jsonc', 'dockerfile', 'yaml', 'html'],
        },
      },
    },
  },
  i18n: {
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    locales: [
      { code: 'en', name: 'English', language: 'en-US', file: 'en.json' },
      { code: 'fr', name: 'Français', language: 'fr-FR', file: 'fr.json' },
    ],
  },
});
