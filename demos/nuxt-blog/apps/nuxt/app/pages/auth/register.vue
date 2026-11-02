<script setup lang="ts">
definePageMeta({ layout: false });

const email = ref('');
const password = ref('');
const name = ref('');
const error = ref('');
const { refresh } = useCurrentUser();

async function register() {
  error.value = '';
  try {
    await $fetch('/auth/sign-up/email', {
      method: 'POST',
      body: { email: email.value, password: password.value, name: name.value || email.value },
    });
    await refresh();
    navigateTo('/');
  } catch (e: any) {
    error.value = e.data?.code === 'USER_ALREADY_EXISTS'
      ? 'This email is already registered'
      : (e.data?.message || 'Registration failed');
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

      <h1 class="text-2xl font-bold text-highlighted mb-6">Register</h1>

      <UAlert v-if="error" color="error" :title="error" class="mb-4" />

      <form class="space-y-4" @submit.prevent="register">
        <UFormField label="Name">
          <UInput v-model="name" placeholder="Your name (optional)" class="w-full" />
        </UFormField>

        <UFormField label="Email">
          <UInput v-model="email" type="email" placeholder="you@example.com" required class="w-full" />
        </UFormField>

        <UFormField label="Password">
          <UInput v-model="password" type="password" placeholder="Min 6 characters" required class="w-full" />
        </UFormField>

        <UButton type="submit" label="Register" block />
      </form>

      <USeparator label="or" class="my-6" />

      <UButton to="/auth/oidc/test-idp" external label="Sign up with Test IdP" icon="i-lucide-key-round" variant="outline" block />

      <p class="mt-4 text-sm text-muted text-center">
        Already have an account? <NuxtLink to="/auth/login" class="text-primary">Login</NuxtLink>
      </p>
    </UCard>
  </div>
</template>
