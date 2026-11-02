<script setup lang="ts">
// The tutorial has no page of its own: it opens on its first step.
const { data: first } = await useAsyncData('tutorial-first', () =>
  queryCollection('tutorial').select('path').order('step', 'ASC').first());

await navigateTo(first.value?.path ?? '/docs', { redirectCode: 301, replace: true });
</script>

<template>
  <div />
</template>
