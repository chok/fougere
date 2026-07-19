<script setup lang="ts">
/**
 * Editor-chrome wrapper around a highlighted snippet. Highlighting runs
 * server-side (Shiki, same dual-theme vars as the docs) and travels in the
 * payload — the browser never loads a highlighter.
 */
const props = defineProps<{ code: string; filename: string; lang?: string }>();

const { data: html } = await useAsyncData(`cw:${props.filename}`, async () => {
  const { codeToHtml } = await import('shiki');
  return codeToHtml(props.code, {
    lang: props.lang ?? 'ts',
    themes: { default: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
});
</script>

<template>
  <div class="code-window">
    <div class="code-window-bar">
      <span class="code-dot bg-red-400/80" />
      <span class="code-dot bg-amber-400/80" />
      <span class="code-dot bg-green-400/80" />
      <span class="code-filename">{{ filename }}</span>
    </div>
    <div class="code-window-body" v-html="html" />
  </div>
</template>
