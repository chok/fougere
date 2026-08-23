<script setup lang="ts">
import Post from '@fronds/blog/entities/Post';
import MarkdownIt from 'markdown-it';

const route = useRoute();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const slug = route.params.slug as string;

interface Full { id: string; slug: string; title: string; summary?: string; body?: string; authorName?: string; publishedAt?: string }
const { data: post, error } = await useQuery<Full>(Post, 'findBySlug', { body: { slug } });

const md = new MarkdownIt({ linkify: true });
const rendered = computed(() => (post.value?.body ? md.render(post.value.body) : ''));

useSeoMeta({
  title: () => (post.value ? `${post.value.title} — Fougere` : 'Fougere'),
  description: () => post.value?.summary,
});

function day(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString(locale.value === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-12">
    <NuxtLink :to="localePath('/blog')" class="flex items-center gap-2 text-sm text-muted hover:text-highlighted">
      <UIcon name="i-lucide-arrow-left" class="size-4" />
      {{ $t('blog.backToBlog') }}
    </NuxtLink>

    <template v-if="post">
      <h1 class="mt-6 text-3xl font-bold text-highlighted">{{ post.title }}</h1>
      <p class="mt-2 text-sm text-muted">
        {{ day(post.publishedAt) }}<template v-if="post.authorName"> · {{ $t('blog.by') }} {{ post.authorName }}</template>
      </p>
      <div class="mt-8 prose-body" v-html="rendered" />
    </template>

    <div v-else class="py-16 text-center text-muted">
      <UIcon name="i-lucide-file-question" class="size-8 mb-2 mx-auto" />
      <p>{{ error?.message ?? $t('blog.notFound') }}</p>
    </div>
  </div>
</template>
