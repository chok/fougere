<script setup lang="ts">
/**
 * The philosophy as a real diagram: the entity declaration is the nucleus,
 * six projections derive from it. Hand-drawn SVG, themed by CSS variables.
 */
const { t } = useI18n();

const left = computed(() => [
  { label: t('diagram.api'), hint: 'post.list · post.publish', cy: 70 },
  { label: t('diagram.table'), hint: 'auto-DDL → SQLite', cy: 215 },
  { label: t('diagram.type'), hint: 'function render(p: Post)', cy: 360 },
]);
const right = computed(() => [
  { label: t('diagram.form'), hint: 'useFormFor(Post)', cy: 70 },
  { label: t('diagram.graphql'), hint: 'type Post { … }', cy: 215 },
  { label: t('diagram.designation'), hint: "useQuery(Post, 'list')", cy: 360 },
]);

const code = [
  'class Post extends entity({',
  '  id: primary(),',
  '  title: text({ min: 1 }),',
  '  status: readOnly(oneOf(',
  "    'draft', 'published')),",
  '}) {}',
];

// Nucleus attach points (staggered on each side) paired with node centers.
const anchors = [165, 215, 265];
</script>

<template>
  <div class="not-prose my-2">
    <svg viewBox="0 0 960 430" class="deriv-svg hidden lg:block w-full h-auto" role="img" :aria-label="t('diagram.caption')">
      <defs>
        <marker id="deriv-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 8 4 L 0 8 z" class="deriv-arrowhead" />
        </marker>
      </defs>

      <!-- Connections: nucleus → projections -->
      <g>
        <template v-for="(node, i) in left" :key="'lc' + i">
          <path
            :d="`M 330 ${anchors[i]} C 305 ${anchors[i]}, 315 ${node.cy}, 288 ${node.cy}`"
            class="deriv-link" marker-end="url(#deriv-arrow)"
          />
          <path
            :d="`M 330 ${anchors[i]} C 305 ${anchors[i]}, 315 ${node.cy}, 288 ${node.cy}`"
            class="deriv-flow"
          />
          <circle cx="330" :cy="anchors[i]" r="3" class="deriv-dot" />
        </template>
        <template v-for="(node, i) in right" :key="'rc' + i">
          <path
            :d="`M 630 ${anchors[i]} C 655 ${anchors[i]}, 645 ${node.cy}, 672 ${node.cy}`"
            class="deriv-link" marker-end="url(#deriv-arrow)"
          />
          <path
            :d="`M 630 ${anchors[i]} C 655 ${anchors[i]}, 645 ${node.cy}, 672 ${node.cy}`"
            class="deriv-flow"
          />
          <circle cx="630" :cy="anchors[i]" r="3" class="deriv-dot" />
        </template>
      </g>

      <!-- Projection nodes -->
      <g>
        <template v-for="(node, i) in left" :key="'ln' + i">
          <rect x="30" :y="node.cy - 30" width="258" height="60" rx="10" class="deriv-node-rect" />
          <text x="52" :y="node.cy - 4" class="deriv-node-label">{{ node.label }}</text>
          <text x="52" :y="node.cy + 17" class="deriv-node-hint">{{ node.hint }}</text>
        </template>
        <template v-for="(node, i) in right" :key="'rn' + i">
          <rect x="672" :y="node.cy - 30" width="258" height="60" rx="10" class="deriv-node-rect" />
          <text x="694" :y="node.cy - 4" class="deriv-node-label">{{ node.label }}</text>
          <text x="694" :y="node.cy + 17" class="deriv-node-hint">{{ node.hint }}</text>
        </template>
      </g>

      <!-- Nucleus: the declaration, wrapped in its judge (a projection too —
           derived from the shape — but normative and shipped with the class) -->
      <g>
        <rect x="330" y="110" width="300" height="212" rx="16" class="deriv-envelope" />
        <rect x="342" y="122" width="276" height="162" rx="10" class="deriv-core-rect" />
        <text x="480" y="100" text-anchor="middle" class="deriv-core-label">{{ t('diagram.coreLabel').toUpperCase() }}</text>
        <text v-for="(line, i) in code" :key="i" x="364" :y="150 + i * 21" class="deriv-code" xml:space="preserve">{{ line }}</text>
        <text x="480" y="301" text-anchor="middle" class="deriv-node-hint">Post.validate(input)</text>
        <text x="480" y="316" text-anchor="middle" class="deriv-judge">{{ t('diagram.judge') }}</text>
      </g>
    </svg>

    <!-- Small screens: nucleus card + chips -->
    <div class="lg:hidden">
      <div class="rounded-xl border border-accented bg-default p-4 mx-auto max-w-xs shadow-sm">
        <p class="text-[10px] uppercase tracking-wider text-muted text-center mb-2">{{ t('diagram.coreLabel') }}</p>
        <pre class="font-mono text-xs leading-relaxed text-highlighted overflow-x-auto"><code>{{ code.join('\n') }}</code></pre>
        <p class="mt-2 pt-2 border-t border-default font-mono text-[11px] text-muted flex justify-between gap-2"><span>Post.validate(input)</span><span class="font-sans italic">{{ t('diagram.judge') }}</span></p>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-2">
        <div v-for="node in [...left, ...right]" :key="node.label" class="rounded-lg border border-default px-3 py-2">
          <p class="text-sm font-medium text-highlighted">{{ node.label }}</p>
          <p class="font-mono text-[11px] text-muted mt-0.5 truncate">{{ node.hint }}</p>
        </div>
      </div>
    </div>

    <p class="mt-4 text-center text-sm text-muted">{{ t('diagram.caption') }}</p>
  </div>
</template>
