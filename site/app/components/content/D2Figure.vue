<script setup lang="ts">
/**
 * A figure authored as text in `diagrams/<name>.<locale>.d2`, rendered to two SVGs by
 * `scripts/render-diagrams.mjs` — D2 in sketch mode (rough.js underneath).
 *
 * Two files and a `<picture>` rather than one theme-aware file: D2's output carries fixed
 * colours, so the media query is the browser's job, not a post-processing step on the SVG.
 */
const props = defineProps<{ name: string; caption?: string }>();
const { locale } = useI18n();

const base = computed(() => `/diagrams/${props.name}.${locale.value}`);
</script>

<template>
  <figure class="not-prose my-5">
    <picture>
      <source :srcset="`${base}.dark.svg`" media="(prefers-color-scheme: dark)" />
      <img :src="`${base}.light.svg`" :alt="caption ?? name" class="w-full h-auto" loading="lazy" />
    </picture>
    <figcaption v-if="caption" class="mt-3 text-center text-sm text-muted">{{ caption }}</figcaption>
  </figure>
</template>
