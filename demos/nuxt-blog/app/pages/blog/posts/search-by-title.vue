<script setup lang="ts">
import Post from '@frond/blog/entities/Post';

const query = ref('');
const submitted = ref('');
const searched = ref(false);

interface SearchHit { id: string; title: string }

const { items: results, loading } = await useQuery<SearchHit>(
  Post,
  'searchByTitle',
  () => ({ body: { title: submitted.value } }),
  { immediate: false },
);

function search() {
  if (!query.value.trim()) return;
  submitted.value = query.value;
  searched.value = true;
}
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6 max-w-2xl">
    <div class="flex items-center gap-2 text-sm text-muted">
      <NuxtLink to="/blog/posts" class="hover:text-highlighted">Posts</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="size-4" />
      <span class="text-highlighted">Search</span>
    </div>

    <h1 class="text-2xl font-bold text-highlighted">Search Posts</h1>

    <form class="flex gap-2" @submit.prevent="search">
      <UInput
        v-model="query"
        placeholder="Search by title..."
        icon="i-lucide-search"
        class="flex-1"
        autofocus
      />
      <UButton type="submit" label="Search" :loading="loading" />
    </form>

    <UCard v-if="searched">
      <div v-if="!results.length" class="py-6 text-center text-muted">
        <UIcon name="i-lucide-search-x" class="size-8 mb-2 mx-auto" />
        <p>No results found</p>
      </div>
      <table v-else class="w-full">
        <thead>
          <tr class="border-b border-default">
            <th class="text-left py-3 px-4 text-xs font-semibold uppercase text-muted">Title</th>
            <th class="py-3 px-4 w-20"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="post in results" :key="post.id" class="border-b border-default hover:bg-elevated/50 transition-colors">
            <td class="py-3 px-4 font-medium text-highlighted">{{ post.title }}</td>
            <td class="py-3 px-4">
              <UButton :to="`/blog/posts/${post.id}`" variant="ghost" icon="i-lucide-arrow-right" size="xs" />
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>
  </div>
</template>
