<script setup lang="ts">
import Author from '@fronds/blog/entities/Author';

interface AuthorRow { id: string; name: string; email: string; bio?: string }
const { items: authors, loading: pending } = await useQuery<AuthorRow>(Author, 'list');
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-highlighted">Authors</h1>
        <p class="text-sm text-muted">Manage blog authors</p>
      </div>
      <UButton to="/blog/authors/new" icon="i-lucide-plus" label="New Author" />
    </div>

    <UCard>
      <div v-if="pending" class="py-8 text-center text-muted">Loading...</div>
      <div v-else-if="!authors?.length" class="py-8 text-center text-muted">
        <UIcon name="i-lucide-users" class="size-8 mb-2 mx-auto" />
        <p>No authors yet</p>
      </div>
      <table v-else class="w-full">
        <thead>
          <tr class="border-b border-default">
            <th class="text-left py-3 px-4 text-xs font-semibold uppercase text-muted">Name</th>
            <th class="text-left py-3 px-4 text-xs font-semibold uppercase text-muted">Email</th>
            <th class="py-3 px-4 w-20"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="author in authors" :key="author.id" class="border-b border-default hover:bg-elevated/50 transition-colors">
            <td class="py-3 px-4">
              <NuxtLink :to="`/blog/authors/${author.id}`" class="font-medium text-highlighted hover:text-primary">
                {{ author.name }}
              </NuxtLink>
            </td>
            <td class="py-3 px-4 text-muted">{{ author.email }}</td>
            <td class="py-3 px-4">
              <UButton :to="`/blog/authors/${author.id}/edit`" variant="ghost" icon="i-lucide-pencil" size="xs" />
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>
  </div>
</template>
