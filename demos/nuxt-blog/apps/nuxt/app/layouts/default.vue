<script setup lang="ts">
const { user, refresh } = useCurrentUser();

async function logout() {
  await $fetch('/auth/sign-out', { method: 'POST', body: {} });
  await refresh();
  navigateTo('/');
}

const navItems = [
  [
    { label: "Home", icon: "i-lucide-home", to: "/" },
  ],
  [
    { label: "Posts", icon: "i-lucide-file-text", to: "/blog/posts" },
    { label: "Authors", icon: "i-lucide-users", to: "/blog/authors" },
    { label: "Categories", icon: "i-lucide-tags", to: "/blog/categories" },
  ],
];
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar>
      <template #header>
        <NuxtLink to="/" class="flex items-center gap-2 font-bold text-lg">
          <UIcon name="i-noto-herb" class="text-[var(--ui-primary)] size-5" />
          Fougere
        </NuxtLink>
      </template>

      <UNavigationMenu :items="navItems" orientation="vertical" />

      <template #footer>
        <div v-if="user" class="flex items-center gap-2 px-2 py-1">
          <UIcon name="i-lucide-user" class="text-primary size-4" />
          <span class="text-sm text-highlighted truncate flex-1">{{ user.name || user.email }}</span>
          <UButton size="xs" variant="ghost" icon="i-lucide-log-out" @click="logout" />
        </div>
        <NuxtLink v-else to="/auth/login" class="flex items-center gap-2 px-2 py-1 text-sm text-muted hover:text-highlighted">
          <UIcon name="i-lucide-log-in" class="size-4" />
          Login
        </NuxtLink>
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <slot />
    </UDashboardPanel>
  </UDashboardGroup>
</template>
