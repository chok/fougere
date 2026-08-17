/**
 * `diagrams/*.d2` → `public/diagrams/*.{light,dark}.svg`, in sketch mode.
 *
 * TWO files per source, not one: `darkThemeID` was measured to produce no
 * `prefers-color-scheme` block through D2.js — the colours come out hardcoded — so the
 * choice belongs to `<picture>`, which `D2Figure.vue` writes. The site follows the system
 * preference and offers no toggle, which is what makes a media query enough.
 *
 * D2.js is the WASM build, so this needs no binary:
 *     npx -y @terrastruct/d2 >/dev/null 2>&1 || true      # warms the cache
 *     node scripts/render-diagrams.mjs
 *
 * The tool is deliberately not a dependency of the site: the SVG is committed beside its
 * source, so building the site never needs it — only editing a diagram does.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { D2 } from '@terrastruct/d2';

const here = dirname(new URL(import.meta.url).pathname);
const SRC = join(here, '..', 'diagrams');
const OUT = join(here, '..', 'public', 'diagrams');

const d2 = new D2();
await mkdir(OUT, { recursive: true });

// 0 is D2's neutral light theme, 200 its dark counterpart. Sketch mode is rough.js
// underneath — the same hand-drawn stroke as an Excalidraw board.
const THEMES = { light: 0, dark: 200 };

for (const file of (await readdir(SRC)).filter((f) => f.endsWith('.d2'))) {
  const source = await readFile(join(SRC, file), 'utf8');
  const { diagram, renderOptions } = await d2.compile(source);
  for (const [name, themeID] of Object.entries(THEMES)) {
    // Measured: a themeID handed to `compile` is ignored. `render` is where it lands.
    const svg = await d2.render(diagram, { ...renderOptions, sketch: true, themeID, pad: 20 });
    const out = join(OUT, `${basename(file, '.d2')}.${name}.svg`);
    await writeFile(out, svg);
    console.log(`${file} → public/diagrams/${basename(out)}  (${(svg.length / 1024).toFixed(0)} KB)`);
  }
}
