<script setup lang="ts">
definePageMeta({ key: (route) => route.path });

const route = useRoute();
const { locale } = useI18n();
const localePath = useLocalePath();

// One collection per language, prefixed so document paths match route paths as-is.
const collection = computed(() => (locale.value === 'fr' ? 'docs_fr' : 'docs_en') as 'docs_fr' | 'docs_en');

const [{ data: page }, { data: nav }] = await Promise.all([
  useAsyncData(`docs:${route.path}`, () => queryCollection(collection.value).path(route.path).first()),
  useAsyncData(`docs-nav:${locale.value}`, () => queryCollectionNavigation(collection.value)),
]);

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true });
}

type NavItem = { title: string; path: string; page?: boolean; children?: NavItem[] };

// The docs node sits at a locale-dependent depth — walk the tree.
function findNode(items: NavItem[], path: string): NavItem | undefined {
  for (const item of items) {
    if (item.path === path) return item;
    const hit = item.children && findNode(item.children, path);
    if (hit) return hit;
  }
}

const docsRoot = computed(() => localePath('/docs'));

/** Sidebar model: standalone pages, then labeled sections with their pages. */
const sidebar = computed(() => {
  const docs = findNode((nav.value ?? []) as NavItem[], docsRoot.value);
  const entries = (docs?.children ?? []).filter((item) => item.path !== docsRoot.value);
  return entries.map((item) =>
    item.children?.length
      ? { label: item.title, items: item.children.filter((c) => c.path !== item.path) }
      : { label: null, items: [item] },
  );
});

useSeoMeta({ title: `${page.value.title} — Fougere docs`, description: page.value.description });
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-10 flex gap-12">
    <aside class="w-56 shrink-0 hidden md:block">
      <!-- Its own scroll: the tree is taller than a viewport, so a sticky nav alone still
           forces a page scroll to reach the last section. -->
      <nav class="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain pr-3 -mr-3 text-sm space-y-5 docs-nav">
        <div>
          <NuxtLink
            :to="docsRoot"
            class="block py-1"
            :class="route.path === docsRoot ? 'text-highlighted font-medium' : 'text-muted hover:text-highlighted'"
          >
            {{ $t('docs.overview') }}
          </NuxtLink>
        </div>
        <div v-for="(group, i) in sidebar" :key="i">
          <p v-if="group.label" class="pb-1.5 text-xs font-semibold uppercase tracking-wider text-dimmed">
            {{ group.label }}
          </p>
          <div :class="group.label ? 'border-l border-default' : ''">
            <NuxtLink
              v-for="item in group.items"
              :key="item.path"
              :to="item.path"
              class="block py-1"
              :class="[
                group.label ? 'px-3 -ml-px border-l' : '',
                route.path === item.path
                  ? (group.label ? 'border-(--ui-text-highlighted) text-highlighted font-medium' : 'text-highlighted font-medium')
                  : (group.label ? 'border-transparent text-muted hover:text-highlighted' : 'text-muted hover:text-highlighted'),
              ]"
            >
              {{ item.title }}
            </NuxtLink>
          </div>
        </div>
      </nav>
    </aside>

    <article class="min-w-0 flex-1 max-w-3xl prose-body pb-16">
      <ContentRenderer v-if="page" :value="page" />
    </article>
  </div>
</template>

<style scoped>
/* A thin, self-effacing scrollbar: the nav scrolls, but does not announce it. */
.docs-nav {
  scrollbar-width: thin;
  scrollbar-color: var(--ui-border-accented) transparent;
}
.docs-nav::-webkit-scrollbar {
  width: 6px;
}
.docs-nav::-webkit-scrollbar-thumb {
  background-color: var(--ui-border-accented);
  border-radius: 3px;
}
.docs-nav::-webkit-scrollbar-track {
  background: transparent;
}
</style>
