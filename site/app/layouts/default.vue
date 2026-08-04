<script setup lang="ts">
const { user, refresh } = useCurrentUser();
const readOnly = useReadOnlyDeployment();
const { locale } = useI18n();
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();

const otherLocale = computed(() => (locale.value === 'fr' ? 'en' : 'fr'));

async function logout() {
  await $fetch('/auth/sign-out', { method: 'POST', body: {} });
  await refresh();
  navigateTo(localePath('/'));
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="sticky top-0 z-40 border-b border-default bg-default/80 backdrop-blur">
      <div class="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
        <NuxtLink :to="localePath('/')" class="flex items-center gap-2 font-bold text-highlighted">
          <UIcon name="i-noto-herb" class="size-5" />
          Fougere
        </NuxtLink>
        <nav class="flex items-center gap-4 text-sm">
          <NuxtLink :to="localePath('/docs')" class="text-muted hover:text-highlighted">{{ $t('nav.docs') }}</NuxtLink>
          <NuxtLink :to="localePath('/blog')" class="text-muted hover:text-highlighted">{{ $t('nav.blog') }}</NuxtLink>
        </nav>
        <div class="ml-auto flex items-center gap-2">
          <UButton
            :to="switchLocalePath(otherLocale)"
            variant="ghost"
            size="sm"
            :label="otherLocale.toUpperCase()"
            :aria-label="otherLocale === 'fr' ? 'Français' : 'English'"
          />
          <template v-if="user">
            <UButton :to="localePath('/blog/drafts')" variant="ghost" size="sm" icon="i-lucide-notebook-pen" :label="$t('nav.drafts')" />
            <UButton :to="localePath('/blog/new')" variant="soft" size="sm" icon="i-lucide-plus" :label="$t('nav.write')" />
            <UButton variant="ghost" size="sm" icon="i-lucide-log-out" :aria-label="$t('nav.signOut')" @click="logout" />
          </template>
          <UButton v-else-if="!readOnly" :to="localePath('/login')" variant="ghost" size="sm" :label="$t('nav.signIn')" />
        </div>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-default">
      <div class="max-w-6xl mx-auto px-6 py-6 text-sm text-muted flex items-center justify-between gap-4">
        <span>{{ $t('footer.builtWith') }}</span>
        <UIcon name="i-noto-herb" class="size-4 shrink-0" />
      </div>
    </footer>
  </div>
</template>
