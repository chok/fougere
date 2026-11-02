<script setup lang="ts">
definePageMeta({ layout: false });

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
    navigateTo('/');
  } catch (e: any) {
    error.value = e.data?.code === 'INVALID_EMAIL_OR_PASSWORD'
      ? 'Wrong email or password'
      : (e.data?.message || 'Login failed');
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <UCard class="w-full max-w-md">
      <NuxtLink to="/" class="flex items-center gap-2 text-sm text-muted hover:text-highlighted mb-6">
        <UIcon name="i-lucide-arrow-left" class="size-4" />
        Back to home
      </NuxtLink>

      <h1 class="text-2xl font-bold text-highlighted mb-6">Login</h1>

      <UAlert v-if="error" color="error" :title="error" class="mb-4" />

      <form class="space-y-4" @submit.prevent="login">
        <UFormField label="Email">
          <UInput v-model="email" type="email" placeholder="you@example.com" required class="w-full" />
        </UFormField>

        <UFormField label="Password">
          <UInput v-model="password" type="password" placeholder="Password" required class="w-full" />
        </UFormField>

        <UButton type="submit" label="Login" block />
      </form>

      <USeparator label="or" class="my-6" />

      <UButton to="/auth/oidc/test-idp" external label="Sign in with Test IdP" icon="i-lucide-key-round" variant="outline" block />

      <p class="mt-4 text-sm text-muted text-center">
        No account? <NuxtLink to="/auth/register" class="text-primary">Register</NuxtLink>
      </p>
    </UCard>
  </div>
</template>
