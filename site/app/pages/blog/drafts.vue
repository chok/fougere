<script setup lang="ts">
import Post from '@frond/blog/entities/Post';

const { t, locale } = useI18n();
const localePath = useLocalePath();
const { user } = useCurrentUser();

interface Row { id: string; slug: string; title: string; status: 'draft' | 'published'; createdAt?: string; publishedAt?: string }
const { items: posts, loading } = await useQuery<Row>(Post, 'mine');

useSeoMeta({ title: () => `${t('blog.drafts.title')} — Fougere` });

function day(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString(locale.value === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'medium' }) : '';
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-12">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-highlighted">{{ $t('blog.drafts.title') }}</h1>
        <p class="mt-2 text-muted">{{ $t('blog.drafts.subtitle') }}</p>
      </div>
      <UButton v-if="user" :to="localePath('/blog/new')" icon="i-lucide-plus" :label="$t('blog.drafts.newPost')" />
    </div>

    <UCard v-if="!user" class="mt-10">
      <p class="text-center text-muted py-6">
        {{ $t('blog.drafts.signInPrompt') }}
        <NuxtLink :to="localePath('/login')" class="text-primary">{{ $t('nav.signIn') }}</NuxtLink>
      </p>
    </UCard>

    <div v-else-if="loading" class="py-16 text-center text-muted">…</div>
    <p v-else-if="!posts.length" class="py-16 text-center text-muted">{{ $t('blog.drafts.empty') }}</p>

    <div v-else class="mt-10 space-y-3">
      <UCard v-for="post in posts" :key="post.id">
        <div class="flex items-center gap-4">
          <div class="min-w-0 flex-1">
            <p class="font-medium text-highlighted truncate">{{ post.title }}</p>
            <p class="text-sm text-muted">/blog/{{ post.slug }} · {{ day(post.publishedAt ?? post.createdAt) }}</p>
          </div>
          <UBadge
            :label="post.status === 'published' ? $t('blog.published') : $t('blog.draft')"
            :color="post.status === 'published' ? 'success' : 'neutral'"
            variant="subtle"
          />
          <UButton :to="localePath(`/blog/edit/${post.id}`)" variant="ghost" size="sm" icon="i-lucide-pencil" :aria-label="$t('blog.drafts.edit')" />
          <UButton
            v-if="post.status === 'published'"
            :to="localePath(`/blog/${post.slug}`)"
            variant="ghost"
            size="sm"
            icon="i-lucide-arrow-right"
            :aria-label="$t('blog.drafts.view')"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>
