<script setup lang="ts">
import Post from '@frond/blog/entities/Post';
import Author from '@frond/blog/entities/Author';
import Category from '@frond/blog/entities/Category';

const { user } = useCurrentUser();

// The metadata IS the imported class — fields read straight off the schema.
const fronds = [
  {
    name: 'blog',
    entities: [
      { name: 'post', icon: 'i-lucide-file-text', fields: Post.getFields() },
      { name: 'author', icon: 'i-lucide-users', fields: Author.getFields() },
      { name: 'category', icon: 'i-lucide-tags', fields: Category.getFields() },
    ],
  },
];

function pluralize(name: string): string {
  return name.endsWith('y') ? name.slice(0, -1) + 'ies' : name + 's';
}

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const totalEntities = fronds.reduce((acc, f) => acc + f.entities.length, 0);
const totalFields = fronds.reduce(
  (acc, f) => acc + f.entities.reduce((a, e) => a + Object.keys(e.fields).length, 0),
  0,
);
</script>

<template>
  <div class="p-6 lg:p-8 space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-highlighted">Dashboard</h1>
      <p class="mt-1 text-sm text-muted">
        Overview of your Fougere application
      </p>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <UCard>
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-primary/10">
            <UIcon name="i-lucide-boxes" class="text-primary size-5" />
          </div>
          <div>
            <p class="text-2xl font-bold text-highlighted">{{ fronds.length }}</p>
            <p class="text-xs text-muted">Fronds</p>
          </div>
        </div>
      </UCard>
      <UCard>
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-primary/10">
            <UIcon name="i-lucide-database" class="text-primary size-5" />
          </div>
          <div>
            <p class="text-2xl font-bold text-highlighted">{{ totalEntities }}</p>
            <p class="text-xs text-muted">Entities</p>
          </div>
        </div>
      </UCard>
      <UCard>
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-primary/10">
            <UIcon name="i-lucide-columns-3" class="text-primary size-5" />
          </div>
          <div>
            <p class="text-2xl font-bold text-highlighted">{{ totalFields }}</p>
            <p class="text-xs text-muted">Fields</p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Auth -->
    <UCard v-if="!user">
      <div class="flex items-center justify-between">
        <div>
          <p class="font-semibold text-highlighted">Not logged in</p>
          <p class="text-sm text-muted">Create an account or sign in to get started.</p>
        </div>
        <div class="flex gap-2">
          <UButton to="/auth/register" label="Register" />
          <UButton to="/auth/login" label="Login" variant="outline" />
        </div>
      </div>
    </UCard>
    <UCard v-else>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-user-check" class="text-primary size-5" />
          <div>
            <p class="font-semibold text-highlighted">{{ user.name || user.email }}</p>
            <p class="text-xs text-muted">{{ user.role }}</p>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Entity cards per frond -->
    <div v-for="frond in fronds" :key="frond.name">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-muted mb-4">
        {{ frond.name }}
      </h2>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink
          v-for="entity in frond.entities"
          :key="entity.name"
          :to="`/${frond.name}/${pluralize(entity.name)}`"
        >
          <UCard class="hover:ring-2 hover:ring-primary cursor-pointer transition-all h-full">
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <UIcon :name="entity.icon" class="text-primary size-5" />
                  <span class="font-semibold text-highlighted">{{ capitalize(pluralize(entity.name)) }}</span>
                </div>
                <p class="text-sm text-muted">
                  {{ Object.keys(entity.fields).length }} fields
                </p>
              </div>
              <UIcon name="i-lucide-arrow-right" class="text-dimmed size-4" />
            </div>

            <div class="mt-4 flex flex-wrap gap-1.5">
              <UBadge
                v-for="(field, name) in entity.fields"
                :key="name"
                :label="String(name)"
                variant="subtle"
                size="xs"
              />
            </div>
          </UCard>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
