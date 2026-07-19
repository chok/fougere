<script setup lang="ts">
definePageMeta({ layout: false });

const { t } = useI18n();
const localePath = useLocalePath();
const email = ref('');
const password = ref('');
const error = ref('');
const { refresh } = useCurrentUser();

async function login() {
  error.value = '';
  try {
    await $fetch('/auth/sign-in/email', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    });
    await refresh();
    navigateTo(localePath('/blog/drafts'));
  } catch (e: any) {
    error.value = e.data?.code === 'INVALID_EMAIL_OR_PASSWORD'
      ? t('auth.wrongCredentials')
      : (e.data?.message || t('auth.signInFailed'));
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

      <h1 class="text-2xl font-bold text-highlighted mb-6">{{ $t('auth.signInTitle') }}</h1>

      <UAlert v-if="error" color="error" :title="error" class="mb-4" />

      <form class="space-y-4" @submit.prevent="login">
        <UFormField :label="$t('auth.email')">
          <UInput v-model="email" type="email" placeholder="you@example.com" required class="w-full" autofocus />
        </UFormField>

        <UFormField :label="$t('auth.password')">
          <UInput v-model="password" type="password" required class="w-full" />
        </UFormField>

        <UButton type="submit" :label="$t('auth.signIn')" block />
      </form>

      <p class="mt-4 text-sm text-muted text-center">
        {{ $t('auth.noAccount') }}
        <NuxtLink :to="localePath('/register')" class="text-primary">{{ $t('auth.register') }}</NuxtLink>
      </p>
    </UCard>
  </div>
</template>
