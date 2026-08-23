<script setup lang="ts">
import Category from '@fronds/blog/entities/Category';

interface CategoryRow { id: string; name: string }
const { items: categories, loading: pending } = await useQuery<CategoryRow>(Category, 'list');
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-highlighted">Categories</h1>
        <p class="text-sm text-muted">Blog categories</p>
      </div>
      <UButton to="/blog/categories/stats" variant="soft" icon="i-lucide-bar-chart-3" label="Stats" />
    </div>

    <UCard>
      <div v-if="pending" class="py-8 text-center text-muted">Loading...</div>
      <div v-else-if="!categories.length" class="py-8 text-center text-muted">
        <UIcon name="i-lucide-tags" class="size-8 mb-2 mx-auto" />
        <p>No categories yet</p>
      </div>
      <table v-else class="w-full">
        <thead>
          <tr class="border-b border-default">
            <th class="text-left py-3 px-4 text-xs font-semibold uppercase text-muted">Name</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cat in categories" :key="cat.id" class="border-b border-default">
            <td class="py-3 px-4 font-medium text-highlighted">{{ cat.name }}</td>
          </tr>
        </tbody>
      </table>
    </UCard>
  </div>
</template>
