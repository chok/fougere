<script setup lang="ts">
import Post from '@frond/blog/entities/Post';

interface PostRow { id: string; title: string; status: 'draft' | 'published'; publishedAt?: string | null }

const { user, loggedIn } = useCurrentUser();
const { items: posts, loading } = await useQuery<PostRow>(Post, 'mine');
const publish = useCommand(Post, 'publish');
const publishError = ref('');

async function doPublish(id: string) {
  publishError.value = '';
  try {
    await publish.execute({ params: { id } });
  } catch (e: any) {
    publishError.value = e?.message ?? 'Publish failed';
  }
}
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6">
    <div class="flex items-center gap-2 text-sm text-muted">
      <NuxtLink to="/blog/posts" class="hover:text-highlighted">Posts</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="size-4" />
      <span class="text-highlighted">My posts</span>
    </div>

    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-highlighted">My Posts</h1>
        <p class="text-sm text-muted">Drafts and published posts — publishing is an operation, not a field.</p>
      </div>
      <UButton to="/blog/posts/new" icon="i-lucide-plus" label="New Post" />
    </div>

    <UCard v-if="!loggedIn">
      <div class="py-6 text-center text-muted">
        <UIcon name="i-lucide-lock" class="size-8 mb-2 mx-auto" />
        <p>Login to see your posts</p>
        <UButton to="/auth/login" label="Login" class="mt-3" />
      </div>
    </UCard>

    <UCard v-else>
      <UAlert v-if="publishError" color="error" :title="publishError" class="mb-4" />
      <div v-if="loading" class="py-8 text-center text-muted">Loading...</div>
      <div v-else-if="!posts.length" class="py-8 text-center text-muted">
        <UIcon name="i-lucide-file-text" class="size-8 mb-2 mx-auto" />
        <p>No posts yet — create one, it starts as a draft</p>
      </div>
      <table v-else class="w-full">
        <thead>
          <tr class="border-b border-default">
            <th class="text-left py-3 px-4 text-xs font-semibold uppercase text-muted">Title</th>
            <th class="text-left py-3 px-4 text-xs font-semibold uppercase text-muted">Status</th>
            <th class="py-3 px-4 w-40"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="post in posts" :key="post.id" class="border-b border-default hover:bg-elevated/50 transition-colors">
            <td class="py-3 px-4 font-medium text-highlighted">
              <NuxtLink :to="`/blog/posts/${post.id}`" class="hover:underline">{{ post.title }}</NuxtLink>
            </td>
            <td class="py-3 px-4">
              <UBadge
                :label="post.status"
                :color="post.status === 'published' ? 'success' : 'neutral'"
                variant="subtle"
                size="sm"
              />
            </td>
            <td class="py-3 px-4 text-right">
              <UButton
                v-if="post.status === 'draft'"
                label="Publish"
                size="xs"
                icon="i-lucide-send"
                :loading="publish.loading.value"
                @click="doPublish(post.id)"
              />
              <span v-else class="text-xs text-muted">{{ post.publishedAt?.slice(0, 10) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>
  </div>
</template>
