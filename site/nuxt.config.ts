import { PackageManager } from '@fougere/cli/package-manager';
import { DEMO_LANGUAGES } from './modules/demo';
import { pastel } from './app/code/pastel';

const locales = [{ code: 'en', name: 'English', language: 'en-US', file: 'en.json' }];

/**
 * Pages a prerendered deployment cannot serve: writing a post and signing in need a
 * server. Reading the blog does not — the Frond reads the posts at build time.
 */
const serverOnly = ['/blog/new', '/blog/edit', '/blog/drafts', '/login', '/register'];

export default defineNuxtConfig({
  // A page's data is shared across prerendered pages through JSON, which hands a Date back
  // as a string: the blog's dates arrived as text under `nuxt generate` alone.
  experimental: { sharedPrerenderData: false },
  // `./modules/demo` is named rather than left to the modules/ scan: it writes into
  // content/ and must run before @nuxt/content reads it.
  modules: ['./modules/demo', './modules/managers', '@nuxt/ui', '@nuxt/content', '@nuxtjs/i18n', '@fougere/nuxt'],
  css: ['~/assets/css/main.css'],
  fonts: {
    families: [
      { name: 'Fraunces', weights: [400], styles: ['normal', 'italic'] },
      { name: 'IBM Plex Sans', weights: [400, 500, 600, 700], styles: ['normal', 'italic'] },
      { name: 'IBM Plex Mono', weights: [400], styles: ['normal'] },
    ],
  },
  compatibilityDate: '2026-07-18',
  ui: { colorMode: false },
  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  // The audit prompt links to the docs, and `nuxt generate` renders it with no client
  // request to read an origin from — `useRequestURL()` returns http://localhost there.
  // SITE_URL is what the Pages workflow already hands the build.
  runtimeConfig: {
    public: {
      siteUrl: (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
      readOnly: process.argv.includes('generate'),
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
        // The package-manager marks, named off the list the tabs and the home page are made from.
        ...PackageManager.names.map((name) => `vscode-icons:file-type-${name}`),
        'vscode-icons:file-type-light-pnpm',
      ],
    },
  },
  components: [
    // content/ components are global (usable from markdown) and unprefixed.
    { path: '~/components/content', global: true, pathPrefix: false },
    '~/components',
  ],
  nitro: {
    prerender: { ignore: serverOnly },
    hooks: {
      // A blog with no post answers 404, and on static hosting that is a file not written.
      'prerender:generate'(route) {
        if (route.route === '/blog' && route.error?.statusCode === 404) {
          route.skip = true;
          route.error = undefined;
        }
      },
    },
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
          theme: { default: pastel },
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
