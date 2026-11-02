<script setup lang="ts">
const { t } = useI18n();

useSeoMeta({
  title: () => `Fougere — ${t('home.title')}`,
  description: () => t('home.subtitle'),
});
</script>

<template>
  <HomeStory />
  <HomeTry />
</template>
