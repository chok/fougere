<script setup lang="ts">
import Post from '@fronds/blog/entities/Post';

const { t } = useI18n();
const localePath = useLocalePath();
const { user } = useCurrentUser();

const { values, errors, submit, loading, error } = useFormFor<{ id: string }>(Post);

// Convenience, not a rule: the slug follows the title until the author touches it.
const slugTouched = ref(false);
watch(() => values.title, (title) => {
  if (slugTouched.value || !title) return;
  values.slug = String(title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
});

async function onSubmit() {
  const created = await submit();
  if (created) navigateTo(localePath(`/blog/edit/${created.id}`));
}

useSeoMeta({ title: () => `${t('blog.form.newTitle')} — Fougere` });
</script>

<template>
  <div class="max-w-2xl mx-auto px-6 py-12">
    <h1 class="text-3xl font-bold text-highlighted">{{ $t('blog.form.newTitle') }}</h1>

    <UCard v-if="!user" class="mt-10">
      <p class="text-center text-muted py-6">
        {{ $t('blog.form.signInPrompt') }}
        <NuxtLink :to="localePath('/login')" class="text-primary">{{ $t('nav.signIn') }}</NuxtLink>
      </p>
    </UCard>

    <UCard v-else class="mt-8">
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField :label="$t('blog.form.fieldTitle')" :error="errors.title">
          <UInput v-model="values.title as string" class="w-full" autofocus />
        </UFormField>

        <UFormField :label="$t('blog.form.fieldSlug')" :help="$t('blog.form.slugHelp')" :error="errors.slug">
          <UInput v-model="values.slug as string" class="w-full font-mono" @input="slugTouched = true" />
        </UFormField>

        <UFormField :label="$t('blog.form.fieldSummary')" :help="$t('blog.form.summaryHelp')" :error="errors.summary">
          <UTextarea v-model="values.summary as string" :rows="2" class="w-full" />
        </UFormField>

        <UFormField :label="$t('blog.form.fieldBody')" :help="$t('blog.form.bodyHelp')" :error="errors.body">
          <UTextarea v-model="values.body as string" :rows="12" class="w-full font-mono" />
        </UFormField>

        <p v-if="error" class="text-sm text-error">{{ error.message }}</p>

        <div class="flex gap-2 pt-2">
          <UButton type="submit" :label="$t('blog.form.create')" :loading="loading" />
          <UButton :to="localePath('/blog/drafts')" variant="ghost" :label="$t('blog.form.cancel')" />
        </div>
      </form>
    </UCard>
  </div>
</template>
