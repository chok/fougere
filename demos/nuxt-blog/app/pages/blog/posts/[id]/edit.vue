<script setup lang="ts">
import Post from '@fronds/blog/entities/Post';

const route = useRoute();
const id = route.params.id as string;

const { data: post } = await useQuery<Record<string, unknown>>(Post, 'findById', { params: { id } });
const { fieldsByName, values, errors, submit, loading, error } = useFormFor(Post, {
  op: 'update',
  params: { id },
  initial: post.value ?? undefined,
});

async function onSubmit() {
  if (await submit()) navigateTo(`/blog/posts/${id}`);
}
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6 max-w-2xl">
    <div class="flex items-center gap-2 text-sm text-muted">
      <NuxtLink to="/blog/posts" class="hover:text-highlighted">Posts</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="size-4" />
      <NuxtLink :to="`/blog/posts/${id}`" class="hover:text-highlighted">{{ post?.title ?? id }}</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="size-4" />
      <span class="text-highlighted">Edit</span>
    </div>

    <div class="flex items-center gap-3">
      <h1 class="text-2xl font-bold text-highlighted">Edit Post</h1>
      <UBadge
        v-if="(post as any)?.status"
        :label="(post as any).status"
        :color="(post as any).status === 'published' ? 'success' : 'neutral'"
        variant="subtle"
      />
    </div>

    <UCard>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="Title" :error="errors.title">
          <UInput v-model="values.title" v-bind="fieldsByName.title?.attrs" autofocus />
        </UFormField>

        <UFormField label="Body" :error="errors.body">
          <UTextarea v-model="values.body" v-bind="fieldsByName.body?.attrs" :rows="8" />
        </UFormField>

        <p v-if="error" class="text-sm text-error">{{ error.message }}</p>

        <div class="flex gap-2 pt-2">
          <UButton type="submit" label="Save" :loading="loading" />
          <UButton :to="`/blog/posts/${id}`" variant="ghost" label="Cancel" />
        </div>
      </form>
    </UCard>
  </div>
</template>
