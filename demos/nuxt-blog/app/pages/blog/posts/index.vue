<script setup lang="ts">
import Post from '@frond/blog/entities/Post';
interface PostRow { id: string; title: string; body: string; authorId: string; createdAt?: string }
const { items: posts, loading: pending, error } = await useQuery<PostRow>(Post, 'list');
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-highlighted">Posts</h1>
        <p class="text-sm text-muted">Manage blog posts</p>
      </div>
      <div class="flex gap-2">
        <UButton to="/blog/posts/search-by-title" variant="soft" icon="i-lucide-search" label="Search" />
        <UButton to="/blog/posts/mine" variant="soft" icon="i-lucide-user" label="My Posts" />
        <UButton to="/blog/posts/new" icon="i-lucide-plus" label="New Post" />
      </div>
    </div>

    <UCard>
      <div v-if="pending" class="py-8 text-center text-muted">Loading...</div>
      <div v-else-if="error" class="py-8 text-center text-error">
        <UIcon name="i-lucide-unplug" class="size-8 mb-2 mx-auto" />
        <p>{{ error.message }}</p>
      </div>
      <div v-else-if="!posts?.length" class="py-8 text-center text-muted">
        <UIcon name="i-lucide-file-text" class="size-8 mb-2 mx-auto" />
        <p>No posts yet</p>
      </div>
      <table v-else class="w-full">
        <thead>
          <tr class="border-b border-default">
            <th class="text-left py-3 px-4 text-xs font-semibold uppercase text-muted">Title</th>
            <th class="text-left py-3 px-4 text-xs font-semibold uppercase text-muted">Created</th>
            <th class="py-3 px-4 w-20"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="post in posts" :key="post.id" class="border-b border-default hover:bg-elevated/50 transition-colors">
            <td class="py-3 px-4">
              <NuxtLink :to="`/blog/posts/${post.id}`" class="font-medium text-highlighted hover:text-primary">
                {{ post.title }}
              </NuxtLink>
            </td>
            <td class="py-3 px-4 text-sm text-muted">{{ post.createdAt }}</td>
            <td class="py-3 px-4">
              <UButton :to="`/blog/posts/${post.id}/edit`" variant="ghost" icon="i-lucide-pencil" size="xs" />
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>
  </div>
</template>
