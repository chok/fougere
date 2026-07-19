<script setup lang="ts">
import Post from '@frond/blog/entities/Post';

const route = useRoute();
const id = route.params.id as string;

interface PostRow { id: string; title: string; body: string; authorId?: string; createdAt?: string; status?: 'draft' | 'published'; publishedAt?: string | null }

const { data: post, loading: pending } = await useQuery<PostRow>(Post, 'findById', { params: { id } });
const del = useCommand(Post, 'delete');
const publish = useCommand(Post, 'publish');

async function destroy() {
  if (!confirm('Delete this post?')) return;
  await del.execute({ params: { id } });
  navigateTo('/blog/posts');
}

async function doPublish() {
  await publish.execute({ params: { id } });
}
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6">
    <div class="flex items-center gap-2 text-sm text-muted">
      <NuxtLink to="/blog/posts" class="hover:text-highlighted">Posts</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="size-4" />
      <span class="text-highlighted">{{ post?.title ?? '...' }}</span>
    </div>

    <div v-if="pending" class="py-8 text-center text-muted">Loading...</div>
    <div v-else-if="!post" class="py-8 text-center text-muted">Post not found</div>
    <template v-else>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold text-highlighted">{{ post.title }}</h1>
          <UBadge
            v-if="post.status"
            :label="post.status"
            :color="post.status === 'published' ? 'success' : 'neutral'"
            variant="subtle"
          />
        </div>
        <div class="flex gap-2">
          <UButton
            v-if="post.status === 'draft'"
            label="Publish"
            icon="i-lucide-send"
            :loading="publish.loading.value"
            @click="doPublish"
          />
          <UButton :to="`/blog/posts/${id}/edit`" variant="soft" icon="i-lucide-pencil" label="Edit" />
          <UButton variant="soft" color="error" icon="i-lucide-trash-2" label="Delete" @click="destroy" />
        </div>
      </div>

      <div class="flex gap-3 text-sm text-muted">
        <span v-if="post.createdAt" class="flex items-center gap-1">
          <UIcon name="i-lucide-calendar" class="size-4" />
          {{ post.createdAt }}
        </span>
        <span v-if="post.authorId" class="flex items-center gap-1">
          <UIcon name="i-lucide-user" class="size-4" />
          {{ post.authorId }}
        </span>
      </div>

      <UCard>
        <div class="prose prose-sm max-w-none whitespace-pre-wrap text-highlighted">
          {{ post.body }}
        </div>
      </UCard>
    </template>
  </div>
</template>
