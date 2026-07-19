<script setup lang="ts">
definePageMeta({ layout: false });

const { t } = useI18n();
const localePath = useLocalePath();
const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const { refresh } = useCurrentUser();

async function register() {
  error.value = '';
  try {
    await $fetch('/auth/sign-up/email', {
      method: 'POST',
      body: { name: name.value, email: email.value, password: password.value },
    });
    await refresh();
    navigateTo(localePath('/blog/drafts'));
  } catch (e: any) {
    error.value = e.data?.message || t('auth.registerFailed');
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen px-4">
    <UCard class="w-full max-w-md">
      <NuxtLink :to="localePath('/')" class="flex items-center gap-2 text-sm text-muted hover:text-highlighted mb-6">
        <UIcon name="i-lucide-arrow-left" class="size-4" />
        {{ $t('auth.back') }}
      </NuxtLink>

      <h1 class="text-2xl font-bold text-highlighted mb-6">{{ $t('auth.registerTitle') }}</h1>

      <UAlert v-if="error" color="error" :title="error" class="mb-4" />

      <form class="space-y-4" @submit.prevent="register">
        <UFormField :label="$t('auth.name')">
          <UInput v-model="name" required class="w-full" autofocus />
        </UFormField>

        <UFormField :label="$t('auth.email')">
          <UInput v-model="email" type="email" placeholder="you@example.com" required class="w-full" />
        </UFormField>

        <UFormField :label="$t('auth.password')" :help="$t('auth.passwordHelp')">
          <UInput v-model="password" type="password" required class="w-full" />
        </UFormField>

        <UButton type="submit" :label="$t('auth.register')" block />
      </form>

      <p class="mt-4 text-sm text-muted text-center">
        {{ $t('auth.hasAccount') }}
        <NuxtLink :to="localePath('/login')" class="text-primary">{{ $t('auth.signIn') }}</NuxtLink>
      </p>
    </UCard>
  </div>
</template>
