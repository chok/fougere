<script setup lang="ts">
/**
 * The Frond in the middle, and the four families it names nowhere. Each is chosen
 * outside it — the fourth, read as a movement rather than a list, IS the gradient.
 * Hand-drawn SVG, themed by CSS variables.
 */
const { t } = useI18n();

const families = computed(() => [
  { title: t('diagram.core.host'), lines: ['Nuxt · Next · SvelteKit', 'TanStack · React Router · Express · none'], x: 24, y: 24 },
  { title: t('diagram.core.storage'), lines: ['SQLite · Postgres', 'MySQL · SQL Server'], x: 646, y: 24 },
  { title: t('diagram.core.door'), lines: ['in memory · JSON-RPC', 'REST · GraphQL'], x: 24, y: 284 },
  { title: t('diagram.core.place'), lines: ['same process · another process', 'another repo · another language'], x: 646, y: 284, note: t('diagram.core.gradientNote') },
]);

// Core edge → the corner of each family box. Nothing points inward.
const rays = [
  'M 352 176 L 316 104',
  'M 608 176 L 644 104',
  'M 352 244 L 316 316',
  'M 608 244 L 644 316',
];
</script>

<template>
  <div class="not-prose my-2">
    <svg viewBox="0 0 960 420" class="deriv-svg hidden lg:block w-full h-auto" role="img" :aria-label="t('diagram.core.caption')">
      <defs>
        <marker id="core-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 8 4 L 0 8 z" class="deriv-arrowhead" />
        </marker>
      </defs>

      <g>
        <template v-for="(d, i) in rays" :key="'ray' + i">
          <path :d="d" class="deriv-link" marker-end="url(#core-arrow)" />
          <path :d="d" class="deriv-flow" />
        </template>
      </g>

      <!-- The four families, none of them named by the Frond -->
      <g>
        <template v-for="(f, i) in families" :key="'f' + i">
          <rect :x="f.x" :y="f.y" width="290" height="112" rx="10" class="deriv-node-rect" />
          <text :x="f.x + 22" :y="f.y + 30" class="deriv-node-label">{{ f.title }}</text>
          <line :x1="f.x + 22" :y1="f.y + 44" :x2="f.x + 268" :y2="f.y + 44" class="deriv-sep" />
          <text
            v-for="(line, l) in f.lines" :key="l"
            :x="f.x + 22" :y="f.y + 64 + l * 17" class="deriv-node-hint"
          >{{ line }}</text>
          <text v-if="f.note" :x="f.x + 22" :y="f.y + 102" class="deriv-judge">{{ f.note }}</text>
        </template>
      </g>

      <!-- The core: the Frond, and it names none of the four -->
      <g>
        <rect x="340" y="138" width="280" height="144" rx="16" class="deriv-envelope" />
        <rect x="352" y="150" width="256" height="120" rx="10" class="deriv-core-rect" />
        <text x="480" y="128" text-anchor="middle" class="deriv-core-label">{{ t('diagram.core.coreLabel').toUpperCase() }}</text>
        <text x="376" y="182" class="deriv-code">entities · operations</text>
        <text x="376" y="205" class="deriv-code">its judge</text>
        <text x="376" y="228" class="deriv-code">its facts</text>
        <text x="480" y="256" text-anchor="middle" class="deriv-judge">{{ t('diagram.core.coreNote') }}</text>
      </g>
    </svg>

    <!-- Small screens: the core card, then the four families -->
    <div class="lg:hidden">
      <div class="rounded-xl border border-accented bg-default p-4">
        <p class="text-[10px] uppercase tracking-wider text-muted mb-2">{{ t('diagram.core.coreLabel') }}</p>
        <p class="font-mono text-xs text-highlighted">entities · operations · its judge · its facts</p>
        <p class="mt-2 pt-2 border-t border-default text-[11px] italic text-muted">{{ t('diagram.core.coreNote') }}</p>
      </div>
      <div class="mt-3 grid sm:grid-cols-2 gap-2">
        <div v-for="f in families" :key="f.title" class="rounded-lg border border-default px-3 py-2">
          <p class="text-sm font-medium text-highlighted">{{ f.title }}</p>
          <p v-for="line in f.lines" :key="line" class="font-mono text-[11px] text-muted mt-0.5">{{ line }}</p>
          <p v-if="f.note" class="text-[11px] italic text-muted mt-1">{{ f.note }}</p>
        </div>
      </div>
    </div>

    <p class="mt-4 text-center text-sm text-muted">{{ t('diagram.core.caption') }}</p>
  </div>
</template>
