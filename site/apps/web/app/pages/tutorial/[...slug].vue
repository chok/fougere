<script setup lang="ts">
definePageMeta({ key: (route) => route.path.replace(/\/$/, '') || '/' });

const route = useRoute();
const path = computed(() => route.path.replace(/\/$/, '') || '/');

const { data: steps } = await useAsyncData('tutorial-steps', () =>
  queryCollection('tutorial').select('path', 'step', 'name').order('step', 'ASC').all());

const { data: step } = await useAsyncData(`tutorial:${path.value}`, () => queryCollection('tutorial').path(path.value).first());

if (!step.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true });
}

useSeoMeta({ title: `${step.value.title} — Fougere tutorial`, description: step.value.lede });
</script>

<template>
  <div class="max-w-7xl mx-auto px-6 py-10">
    <TutorialStep v-if="step" :step="step" :steps="steps ?? []" />
  </div>
</template>
