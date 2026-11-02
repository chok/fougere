<script setup lang="ts">
definePageMeta({ key: (route) => route.path.replace(/\/$/, '') || '/' });

const route = useRoute();
const menu = useState('menu', () => false);
const path = computed(() => route.path.replace(/\/$/, '') || '/');

const [{ data: page }, { data: pages }] = await Promise.all([
  useAsyncData(`reference:${path.value}`, () => queryCollection('reference').path(path.value).first()),
  useAsyncData('reference-pages', () => queryCollection('reference').select('path', 'title', 'description', 'stem').order('stem', 'ASC').all()),
]);

/** What the reference states is read by kind first; one page per package comes after. */
const kinds = computed(() => (pages.value ?? []).filter((one) => !one.path.startsWith('/reference/packages/')));
const packages = computed(() => (pages.value ?? []).filter((one) => one.path.startsWith('/reference/packages/')));

if (path.value !== '/reference' && !page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true });
}

useSeoMeta({ title: `${page.value?.title ?? 'Reference'} — Fougere`, description: page.value?.description ?? 'Every command, code and key Fougere answers.' });
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row gap-8 md:gap-12">
    <aside class="md:w-56 shrink-0 md:block" :class="menu ? 'block' : 'hidden'">
      <nav class="md:sticky top-24 md:max-h-[calc(100vh-7rem)] md:overflow-y-auto text-sm space-y-1">
        <NuxtLink to="/reference" class="block py-1" :class="path === '/reference' ? 'text-highlighted font-medium' : 'text-muted hover:text-highlighted'">Reference</NuxtLink>
        <NuxtLink
          v-for="one in kinds"
          :key="one.path"
          :to="one.path"
          class="block py-1 pl-3 border-l"
          :class="path === one.path ? 'border-(--ui-text-highlighted) text-highlighted font-medium' : 'border-default text-muted hover:text-highlighted'"
        >
          {{ one.title }}
        </NuxtLink>
        <p class="pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">Packages</p>
        <NuxtLink
          v-for="one in packages"
          :key="one.path"
          :to="one.path"
          class="block py-1 pl-3 border-l font-mono text-xs"
          :class="path === one.path ? 'border-(--ui-text-highlighted) text-highlighted font-medium' : 'border-default text-muted hover:text-highlighted'"
        >
          {{ one.title.replace('@fougere/', '') }}
        </NuxtLink>
      </nav>
    </aside>

    <article class="min-w-0 flex-1 max-w-3xl prose-body pb-16">
      <ContentRenderer v-if="page" :value="page" />
      <template v-else>
        <h1>Reference</h1>
        <p>Everything Fougere answers, read off its code: what each config admits, the types a frond is written with, the ports and interfaces you extend, every command and every refusal.</p>
        <h2>By what you write</h2>
        <ul>
          <li v-for="one in kinds" :key="one.path"><NuxtLink :to="one.path">{{ one.title }}</NuxtLink> — {{ one.description }}</li>
        </ul>
        <h2>By package</h2>
        <ul>
          <li v-for="one in packages" :key="one.path"><NuxtLink :to="one.path">{{ one.title }}</NuxtLink> — {{ one.description }}</li>
        </ul>
      </template>
    </article>
  </div>
</template>
