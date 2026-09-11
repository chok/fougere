import { DEMO_LANGUAGES } from './modules/demo';

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
  // `./modules/demo` is named rather than left to the modules/ scan: it writes into
  // content/ and must run before @nuxt/content reads it.
  modules: ['./modules/demo', '@nuxt/ui', '@nuxt/content', '@nuxtjs/i18n', '@fougere/nuxt'],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2026-07-18',
  // The audit prompt links to the docs, and `nuxt generate` renders it with no client
  // request to read an origin from — `useRequestURL()` returns http://localhost there.
  // SITE_URL is what the Pages workflow already hands the build.
  runtimeConfig: {
    public: {
      siteUrl: (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    },
  },
  // `lucide` and `noto` are devDependencies so the icons ship with the build instead of
  // being fetched from api.iconify.design at render time. Both halves are named: `scan`
  // inlines every name the source spells into the client bundle, and the collections are
  // listed for the server bundle because Nitro does not trace them into .output/server
  // under pnpm — the same trap as drizzle-storage.
  icon: {
    serverBundle: { collections: ['lucide', 'noto', 'vscode-icons'] },
    // `scan` inlines every name the source spells, which reaches no icon a library picks by
    // itself: `::code-tree` reads a file's extension against a table inside @nuxt/ui, so the
    // nine below are spelled nowhere and were fetched from /api/_nuxt_icon at render time —
    // a route `nuxt generate` does not emit. The twelve below are what `demos/` asks of that
    // table, and a build that names one more says so: `failed to load icon`.
    clientBundle: {
      scan: true,
      icons: [
        'vscode-icons:file-type-typescript',
        'vscode-icons:file-type-vue',
        'vscode-icons:file-type-js',
        'vscode-icons:file-type-rust',
        'vscode-icons:file-type-node',
        'vscode-icons:file-type-nuxt',
        'vscode-icons:file-type-tsconfig',
        'vscode-icons:file-type-markdown',
        'vscode-icons:file-type-git',
        'vscode-icons:file-type-json',
        'vscode-icons:file-type-toml',
      ],
    },
  },
  components: [
    // content/ components are global (usable from markdown) and unprefixed.
    { path: '~/components/content', global: true, pathPrefix: false },
    '~/components',
  ],
  nitro: {
    prerender: { ignore: serverOnlyRoutes },
  },
  // Building them is what took `nuxt build` past Node's default heap: rollup holds the map
  // of every chunk alive for the whole bundle, and the server bundle is where the app
  // lands. Nothing read them — `node .output/server/index.mjs` consults a `.map` only
  // under `--enable-source-maps`, and the Dockerfile passes no flag. Production only:
  // `sourcemap.server` reaches the dev server's config too.
  $production: { sourcemap: { server: false } },
  content: {
    build: {
      markdown: {
        highlight: {
          // Shiki's `github-dark` is GitHub's OLD dark theme: its comments are #6a737d,
          // 3.09:1 on an elevated block where AA asks 4.5 — and this doc explains itself
          // in comments. `github-dark-default` is the current one, #8b949e, 4.84:1.
          theme: { default: 'github-light', dark: 'github-dark-default' },
          langs: [
            ...new Set(['ts', 'vue', 'bash', 'json', 'jsonc', 'dockerfile', 'yaml', 'html', ...DEMO_LANGUAGES]),
          ],
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
