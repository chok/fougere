<script setup lang="ts">
import Post from '@fronds/blog/entities/Post';

const route = useRoute();
const { t } = useI18n();
const localePath = useLocalePath();
const id = route.params.id as string;

interface Row { id: string; slug: string; title: string; status: 'draft' | 'published' }
const { data: post } = await useQuery<Row>(Post, 'findById', { params: { id } });

const { values, errors, submit, loading, error } = useFormFor(Post, {
  op: 'update',
  params: { id },
  initial: (post.value as Record<string, unknown> | null) ?? undefined,
});

const publish = useCommand<Row>(Post, 'publish');
const remove = useCommand(Post, 'delete');
const saved = ref(false);

async function onSave() {
  saved.value = false;
  if (await submit()) saved.value = true;
}

async function onPublish() {
  // Unsaved edits ride along: save first, then flip.
  if (!(await submit())) return;
  const published = await publish.execute({ params: { id } });
  navigateTo(localePath(`/blog/${published.slug}`));
}

async function onDelete() {
  if (!confirm(t('blog.form.deleteConfirm'))) return;
  await remove.execute({ params: { id } });
  navigateTo(localePath('/blog/drafts'));
}

useSeoMeta({ title: () => `${t('blog.form.editTitle')} — Fougere` });
</script>

<template>
  <div class="max-w-2xl mx-auto px-6 py-12">
    <NuxtLink :to="localePath('/blog/drafts')" class="flex items-center gap-2 text-sm text-muted hover:text-highlighted">
      <UIcon name="i-lucide-arrow-left" class="size-4" />
      {{ $t('blog.drafts.title') }}
    </NuxtLink>

    <div class="mt-4 flex items-center gap-3">
      <h1 class="text-3xl font-bold text-highlighted">{{ $t('blog.form.editTitle') }}</h1>
      <UBadge
        v-if="post"
        :label="post.status === 'published' ? $t('blog.published') : $t('blog.draft')"
        :color="post.status === 'published' ? 'success' : 'neutral'"
        variant="subtle"
      />
    </div>

    <UCard class="mt-8">
      <form class="space-y-4" @submit.prevent="onSave">
        <UFormField :label="$t('blog.form.fieldTitle')" :error="errors.title">
          <UInput v-model="values.title as string" class="w-full" />
        </UFormField>

        <UFormField :label="$t('blog.form.fieldSlug')" :help="$t('blog.form.slugHelp')" :error="errors.slug">
          <UInput v-model="values.slug as string" class="w-full font-mono" />
        </UFormField>

        <UFormField :label="$t('blog.form.fieldSummary')" :help="$t('blog.form.summaryHelp')" :error="errors.summary">
          <UTextarea v-model="values.summary as string" :rows="2" class="w-full" />
        </UFormField>

        <UFormField :label="$t('blog.form.fieldBody')" :help="$t('blog.form.bodyHelp')" :error="errors.body">
          <UTextarea v-model="values.body as string" :rows="12" class="w-full font-mono" />
        </UFormField>

        <p v-if="error" class="text-sm text-error">{{ error.message }}</p>
        <p v-if="publish.error.value" class="text-sm text-error">{{ publish.error.value.message }}</p>
        <p v-if="saved" class="text-sm text-success">{{ $t('blog.form.saved') }}</p>

        <div class="flex items-center gap-2 pt-2">
          <UButton type="submit" :label="$t('blog.form.save')" :loading="loading" />
          <UButton
            v-if="post?.status !== 'published'"
            variant="soft"
            icon="i-lucide-send"
            :label="$t('blog.form.publish')"
            :loading="publish.loading.value"
            @click="onPublish"
          />
          <UButton
            variant="ghost"
            color="error"
            icon="i-lucide-trash-2"
            :label="$t('blog.form.delete')"
            class="ml-auto"
            @click="onDelete"
          />
        </div>
      </form>
    </UCard>
  </div>
</template>
