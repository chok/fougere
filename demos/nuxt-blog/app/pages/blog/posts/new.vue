<script setup lang="ts">
import Post from '@frond/blog/entities/Post';
// `fieldsByName` carries what the browser enforces — type, required, bounds — read off
// the entity. The page lays the form out; it states no rule.
const { fieldsByName, values, errors, submit, loading, error } = useFormFor(Post);

async function onSubmit() {
  if (await submit()) navigateTo('/blog/posts/mine');
}
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6 max-w-2xl">
    <div class="flex items-center gap-2 text-sm text-muted">
      <NuxtLink to="/blog/posts" class="hover:text-highlighted">Posts</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="size-4" />
      <span class="text-highlighted">New</span>
    </div>

    <div>
      <h1 class="text-2xl font-bold text-highlighted">New Post</h1>
      <p class="text-sm text-muted mt-1">
        Posts are created as <UBadge label="draft" variant="subtle" size="sm" /> — publish from
        <NuxtLink to="/blog/posts/mine" class="underline hover:text-highlighted">My Posts</NuxtLink>.
      </p>
    </div>

    <UCard>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="Author ID" :error="errors.authorId">
          <UInput v-model="values.authorId" v-bind="fieldsByName.authorId?.attrs" placeholder="Author UUID" />
        </UFormField>

        <UFormField label="Title" :error="errors.title">
          <UInput v-model="values.title" v-bind="fieldsByName.title?.attrs" placeholder="Post title" autofocus />
        </UFormField>

        <UFormField label="Body" :error="errors.body">
          <UTextarea v-model="values.body" v-bind="fieldsByName.body?.attrs" :rows="8" placeholder="Write your post..." />
        </UFormField>

        <p v-if="error" class="text-sm text-error">{{ error.message }}</p>

        <div class="flex gap-2 pt-2">
          <UButton type="submit" label="Create" :loading="loading" />
          <UButton to="/blog/posts" variant="ghost" label="Cancel" />
        </div>
      </form>
    </UCard>
  </div>
</template>
