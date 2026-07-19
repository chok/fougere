<script setup lang="ts">
/**
 * Same Frond, two topologies — the remotes line is the pivot.
 * Hand-drawn SVG, themed by CSS variables.
 */
const { t } = useI18n();
</script>

<template>
  <div class="not-prose">
    <svg viewBox="0 0 960 262" class="deriv-svg w-full h-auto" role="img" :aria-label="t('diagram.pivot')">
      <defs>
        <marker id="grad-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 8 4 L 0 8 z" class="deriv-arrowhead" />
        </marker>
      </defs>

      <!-- In-process panel -->
      <g>
        <rect x="16" y="26" width="440" height="220" rx="14" class="grad-panel" />
        <text x="40" y="56" class="deriv-core-label">{{ t('diagram.inProcess').toUpperCase() }}</text>

        <rect x="40" y="76" width="392" height="146" rx="10" class="deriv-node-rect" />
        <text x="62" y="102" class="deriv-node-label">Nuxt app</text>
        <text x="62" y="122" class="deriv-node-hint">useQuery(Post, 'list')</text>

        <rect x="240" y="86" width="172" height="52" rx="8" class="deriv-core-rect" />
        <circle cx="264" cy="112" r="4" class="grad-leaf" />
        <text x="278" y="117" class="deriv-node-label">Frond blog</text>

        <path d="M 218 112 L 236 112" class="deriv-link" marker-end="url(#grad-arrow)" />
        

        <text x="62" y="200" class="deriv-node-hint">{{ t('diagram.memoryCall') }}</text>
      </g>

      <!-- Split panel -->
      <g>
        <rect x="504" y="26" width="440" height="220" rx="14" class="grad-panel" />
        <text x="528" y="56" class="deriv-core-label">{{ t('diagram.split').toUpperCase() }}</text>

        <rect x="528" y="76" width="150" height="146" rx="10" class="deriv-node-rect" />
        <text x="550" y="102" class="deriv-node-label">Nuxt app</text>
        <text x="550" y="122" class="deriv-node-hint">useQuery(Post, …)</text>

        <rect x="772" y="76" width="148" height="146" rx="10" class="deriv-node-rect" />
        <text x="792" y="102" class="deriv-node-label">:4100</text>
        <rect x="786" y="116" width="122" height="48" rx="8" class="deriv-core-rect" />
        <circle cx="806" cy="140" r="4" class="grad-leaf" />
        <text x="818" y="145" class="deriv-node-label">Frond blog</text>

        <path d="M 690 148 L 760 148" class="deriv-link" marker-start="url(#grad-arrow)" marker-end="url(#grad-arrow)" />
        <path d="M 690 148 L 760 148" class="deriv-flow" />
        <text x="725" y="134" text-anchor="middle" class="deriv-node-hint">JSON-RPC</text>

        <text x="528" y="240" class="deriv-node-hint">{{ t('diagram.wireCall') }}</text>
      </g>
    </svg>

    <!-- The pivot line -->
    <div class="mt-3 rounded-lg border border-default bg-elevated/60 px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
      <code class="font-mono text-xs text-highlighted">remotes: { blog: 'http://127.0.0.1:4100' }</code>
      <span class="text-xs text-muted">— {{ t('diagram.pivot') }}</span>
    </div>
  </div>
</template>
