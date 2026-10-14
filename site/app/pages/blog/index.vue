<script setup lang="ts">

const { t } = useI18n();
const localePath = useLocalePath();

import { post as postFacade } from '@fronds/facade';

const { items: posts, loading, error } = await useQuery(postFacade, 'list');
if (!loading.value && !error.value && !posts.value.length) {
  throw createError({ statusCode: 404, statusMessage: 'No posts yet', fatal: true });
}

useSeoMeta({ title: () => `${t('blog.title')} — Fougere`, description: () => t('blog.subtitle') });

function day(at?: Date | null) {
  return at ? at.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-12">
    <h1 class="text-3xl font-bold text-highlighted">{{ $t('blog.title') }}</h1>
    <p class="mt-2 text-muted">{{ $t('blog.subtitle') }}</p>

    <div v-if="loading" class="py-16 text-center text-muted">…</div>
    <UAlert v-else-if="error" color="error" :title="error.message" class="mt-8" />

    <div v-else class="mt-10 space-y-8">
      <article v-for="post in posts" :key="post.id">
        <NuxtLink :to="localePath(`/blog/${post.slug}`)" class="group block">
          <h2 class="text-xl font-semibold text-highlighted group-hover:text-primary">{{ post.title }}</h2>
          <p class="mt-1 text-sm text-muted">
            {{ day(post.publishedAt) }}<template v-if="post.authorName"> · {{ $t('blog.by') }} {{ post.authorName }}</template>
          </p>
          <p v-if="post.summary" class="mt-2 text-muted">{{ post.summary }}</p>
        </NuxtLink>
      </article>
    </div>
  </div>
</template>
