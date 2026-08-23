<script setup lang="ts">
import Category from '@fronds/blog/entities/Category';

interface CategoryStat { id: string; name: string; postCount: number }
const { items: stats, loading: pending } = await useQuery<CategoryStat>(Category, 'stats');
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6">
    <div class="flex items-center gap-2 text-sm text-muted">
      <NuxtLink to="/blog/categories" class="hover:text-highlighted">Categories</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="size-4" />
      <span class="text-highlighted">Stats</span>
    </div>

    <h1 class="text-2xl font-bold text-highlighted">Category Stats</h1>

    <UCard>
      <div v-if="pending" class="py-8 text-center text-muted">Loading...</div>
      <table v-else-if="stats?.length" class="w-full">
        <thead>
          <tr class="border-b border-default">
            <th class="text-left py-3 px-4 text-xs font-semibold uppercase text-muted">Category</th>
            <th class="text-right py-3 px-4 text-xs font-semibold uppercase text-muted">Posts</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cat in stats" :key="cat.id" class="border-b border-default">
            <td class="py-3 px-4 text-highlighted">{{ cat.name }}</td>
            <td class="py-3 px-4 text-right font-semibold text-highlighted">{{ cat.postCount }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="py-4 text-sm text-muted">No categories yet.</p>
    </UCard>
  </div>
</template>
