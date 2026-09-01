const locales: {
  code: 'en' | 'fr';
  name: string;
  language: string;
  file: string;
}[] = [
  { code: 'en', name: 'English', language: 'en-US', file: 'en.json' },
  { code: 'fr', name: 'Français', language: 'fr-FR', file: 'fr.json' },
];

/**
 * Sections a prerendered deployment cannot serve — the blog is a live Frond
 * (reading it means a database, writing it means a server), and the auth pages
 * are doors onto that server. Stated once as routes; the locale prefixes are
 * derived from the locales above rather than spelled out per language.
 *
 * This binds the crawler alone. Under `nuxt build` they are served normally,
 * which is where the blog is the dogfooding proof.
 */
const serverOnly = ['/blog', '/login', '/register'];
const serverOnlyRoutes = locales.flatMap((l) =>
  serverOnly.map((route) => (l.code === 'en' ? route : `/${l.code}${route}`)),
);

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/content', '@nuxtjs/i18n', '@fougere/nuxt'],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2026-07-18',
  // `lucide` and `noto` are devDependencies so the icons ship with the build instead of
  // being fetched from api.iconify.design at render time. Both halves are named: `scan`
  // inlines every name the source spells into the client bundle, and the collections are
  // listed for the server bundle because Nitro does not trace them into .output/server
  // under pnpm — the same trap as drizzle-storage.
  icon: {
    serverBundle: { collections: ['lucide', 'noto'] },
    clientBundle: { scan: true },
  },
  components: [
    // content/ components are global (usable from markdown) and unprefixed.
    { path: '~/components/content', global: true, pathPrefix: false },
    '~/components',
  ],
  nitro: {
    prerender: { ignore: serverOnlyRoutes },
  },
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
    locales,
  },
});
