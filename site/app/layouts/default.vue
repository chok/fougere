<script setup lang="ts">
import { post as postFacade } from '@fronds/facade';

const { user, refresh } = useCurrentUser();
const { items: posts } = await useQuery(postFacade, 'list');
const localePath = useLocalePath();
const route = useRoute();
const onPaper = computed(() => route.path === localePath('/'));

async function logout() {
  await $fetch('/auth/sign-out', { method: 'POST', body: {} });
  await refresh();
  navigateTo(localePath('/'));
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="sticky top-0 z-40 paper" :class="{ 'border-b border-default': !onPaper }">
      <div class="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
        <NuxtLink :to="localePath('/')" class="flex items-center gap-2 font-bold text-highlighted">
          <UIcon name="i-noto-herb" class="size-5" />
          Fougere
        </NuxtLink>
        <nav class="ml-auto flex items-center gap-4 text-sm">
          <NuxtLink :to="localePath('/docs')" class="text-muted hover:text-highlighted">{{ $t('nav.docs') }}</NuxtLink>
          <NuxtLink v-if="posts.length" :to="localePath('/blog')" class="text-muted hover:text-highlighted">{{ $t('nav.blog') }}</NuxtLink>
          <a href="https://github.com/chok/fougere" target="_blank" rel="noopener" class="text-muted hover:text-highlighted">GitHub</a>
        </nav>
        <div class="flex items-center gap-2">
          <template v-if="user">
            <UButton :to="localePath('/blog/drafts')" variant="ghost" size="sm" icon="i-lucide-notebook-pen" :label="$t('nav.drafts')" />
            <UButton :to="localePath('/blog/new')" variant="soft" size="sm" icon="i-lucide-plus" :label="$t('nav.write')" />
            <UButton variant="ghost" size="sm" icon="i-lucide-log-out" :aria-label="$t('nav.signOut')" @click="logout" />
          </template>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-default">
      <div class="max-w-6xl mx-auto px-6 py-6 text-sm text-muted flex items-center gap-2">
        <UIcon name="i-noto-herb" class="size-4 shrink-0" />
        <span>{{ $t('footer.builtWith') }}</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.paper {
  background: var(--ui-bg);
}


.paper :is(a, button) {
  color: var(--ui-text);
}

.paper nav a {
  font-size: 15px;
}
</style>
