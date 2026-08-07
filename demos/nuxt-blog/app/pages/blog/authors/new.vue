<script setup lang="ts">
import Author from '@frond/blog/entities/Author';

// `fieldsByName` carries what the browser enforces — type, required, bounds — read off
// the entity. The page lays the form out; it states no rule.
const { fieldsByName, values, errors, submit, loading, error } = useFormFor(Author);

async function onSubmit() {
  if (await submit()) navigateTo('/blog/authors');
}
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6 max-w-2xl">
    <div class="flex items-center gap-2 text-sm text-muted">
      <NuxtLink to="/blog/authors" class="hover:text-highlighted">Authors</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="size-4" />
      <span class="text-highlighted">New</span>
    </div>

    <h1 class="text-2xl font-bold text-highlighted">New Author</h1>

    <UCard>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="Name" :error="errors.name">
          <UInput v-model="values.name" v-bind="fieldsByName.name?.attrs" autofocus />
        </UFormField>

        <UFormField label="Email" :error="errors.email">
          <UInput v-model="values.email" v-bind="fieldsByName.email?.attrs" />
        </UFormField>

        <UFormField label="Bio" :error="errors.bio">
          <UTextarea v-model="values.bio" v-bind="fieldsByName.bio?.attrs" :rows="4" />
        </UFormField>

        <p v-if="error" class="text-sm text-error">{{ error.message }}</p>

        <div class="flex gap-2 pt-2">
          <UButton type="submit" label="Create" :loading="loading" />
          <UButton to="/blog/authors" variant="ghost" label="Cancel" />
        </div>
      </form>
    </UCard>
  </div>
</template>
