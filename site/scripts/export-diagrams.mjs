/**
 * The site's own diagrams → standalone SVGs for the README.
 *
 * It reads them off the RENDERED page rather than recomputing them, so the geometry lives
 * in exactly one place — the Vue component — and this script never holds a second copy of
 * it. What it does hold is a palette, twice: a committed SVG cannot read `--ui-*`, so the
 * theme has to be baked in, once per mode, and `<picture>` picks in the README.
 *
 * The handwriting is embedded as base64 for the same reason: outside the site there is no
 * `@nuxt/fonts` to serve it, so a named family would fall back to whatever the reader's
 * machine calls cursive. It is the subset the site already built — 7 KB.
 *
 * Needs the site running:
 *     pnpm --filter site dev
 *     node scripts/export-diagrams.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const SITE = process.env.SITE ?? 'http://localhost:3000';
const OUT = join(dirname(new URL(import.meta.url).pathname), '..', '..', 'docs', 'img');

/** Every diagram to export, and the page it is rendered on. */
const WANTED = [
  { id: 'core-and-arcs', page: '/' },
  { id: 'gradient', page: '/' },
];

/** Nuxt UI's zinc/green, resolved. The only thing duplicated here, and deliberately. */
const THEMES = {
  light: { ink: '#18181b', faint: '#a1a1aa', accent: '#16a34a', dim: '#a1a1aa', muted: '#71717a' },
  dark: { ink: '#fafafa', faint: '#71717a', accent: '#22c55e', dim: '#71717a', muted: '#a1a1aa' },
};

/** The subsetted woff2 the site is already serving, so the export needs no font of its own. */
async function embeddedFont() {
  const sheet = await (await fetch(`${SITE}/_nuxt/assets/css/main.css`)).text();
  const href = sheet.match(/\/_fonts\/[A-Za-z0-9_-]+\.woff2/)?.[0];
  if (!href) throw new Error('no self-hosted font found — is the site running?');
  const buf = Buffer.from(await (await fetch(SITE + href)).arrayBuffer());
  return `@font-face { font-family: 'Architects Daughter'; font-display: block;
  src: url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2'); }`;
}

const css = (c, font) => `${font}
text { font-family: 'Architects Daughter', 'Bradley Hand', cursive; }
.hand-ink { fill: none; stroke: ${c.ink}; stroke-width: 1.7; stroke-linecap: round }
.hand-faint { fill: none; stroke: ${c.faint}; stroke-width: 1.5; stroke-linecap: round }
.hand-accent { fill: none; stroke: ${c.accent}; stroke-width: 1.7; stroke-linecap: round }
.hand-dashed { fill: none; stroke: ${c.faint}; stroke-width: 1.6; stroke-dasharray: 12 9 }
.hand-dotted { fill: none; stroke: ${c.faint}; stroke-width: 2.4; stroke-dasharray: 0.1 11; stroke-linecap: round }
.hand-title { fill: ${c.ink}; font-size: 18px }
.hand-members { fill: ${c.muted}; font-size: 13.5px }
.hand-note { fill: ${c.dim}; font-size: 12.5px; font-style: italic }`;

const pages = new Map();
const load = async (page) => {
  if (!pages.has(page)) pages.set(page, await (await fetch(SITE + page)).text());
  return pages.get(page);
};

await mkdir(OUT, { recursive: true });
const font = await embeddedFont();

for (const { id, page } of WANTED) {
  const html = await load(page);
  const found = html.match(new RegExp(`<svg data-diagram="${id}"[\\s\\S]*?</svg>`));
  if (!found) throw new Error(`${id} not found on ${page} — is the site running?`);

  for (const [mode, colours] of Object.entries(THEMES)) {
    // No background rect: GitHub swaps the two files by theme, so the page shows through.
    const svg = found[0]
      .replace(/<svg[^>]*viewBox="([^"]+)"[^>]*>/, (_, vb) => {
        const [, , w, h] = vb.split(/\s+/);
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}"><style>${css(colours, font)}</style>`;
      })
      .replace(/ class="hand-svg[^"]*"/, '');
    await writeFile(join(OUT, `${id}.${mode}.svg`), svg);
    console.log(`${id}.${mode}.svg`);
  }
}
