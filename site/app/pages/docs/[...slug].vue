<script setup lang="ts">
definePageMeta({ key: (route) => route.path.replace(/\/$/, '') || '/' });

const route = useRoute();
// Static hosting 301s a directory URL onto its trailing slash, so a reload lands on
// `/docs/` while a document path — and the prerendered payload key built from it —
// is spelled without one. Everything below reads this, never `route.path`.
const path = computed(() => route.path.replace(/\/$/, '') || '/');
const localePath = useLocalePath();

const [{ data: page }, { data: nav }, { data: all }] = await Promise.all([
  useAsyncData(`docs:${path.value}`, () => queryCollection('docs').path(path.value).first()),
  useAsyncData('docs-nav', () => queryCollectionNavigation('docs')),
  useAsyncData('docs-uses', () => queryCollection('docs').select('path', 'title', 'uses').all()),
]);

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true });
}

type NavItem = { title: string; path: string; page?: boolean; children?: NavItem[] };

function findNode(items: NavItem[], target: string): NavItem | undefined {
  for (const item of items) {
    if (item.path === target) return item;
    const hit = item.children && findNode(item.children, target);
    if (hit) return hit;
  }
}

const docsRoot = computed(() => localePath('/docs'));

/** Concepts are read in order, so they stay open; any other group opens when it holds this page. */
const sidebar = computed(() => {
  const docs = findNode((nav.value ?? []) as NavItem[], docsRoot.value);
  const groups = (docs?.children ?? []).filter((item) => item.path !== docsRoot.value && item.children?.length);

  return groups.map((group) => {
    const items = group.children!.filter((child) => child.path !== group.path);

    return {
      label: group.title,
      items,
      open: group.path.endsWith('/concepts') || items.some((item) => item.path === path.value),
    };
  });
});

const conceptPath = (name: string) => localePath(`/docs/concepts/${name}`);
const titleOf = (target: string) => (all.value ?? []).find((one) => one.path === target)?.title ?? target;

/** A concept lists the tasks that name it — the reverse of what each task wrote once. */
const putToWork = computed(() => {
  if (page.value?.kind !== 'concept') return [];
  const name = path.value.split('/').pop()!;

  return (all.value ?? []).filter((one) => one.uses?.includes(name));
});

useSeoMeta({ title: `${page.value.title} — Fougere docs`, description: page.value.description });
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-10 flex gap-12">
    <aside class="w-60 shrink-0 hidden md:block">
      <!-- Its own scroll: the tree is taller than a viewport, so a sticky nav alone still
           forces a page scroll to reach the last section. -->
      <nav class="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain pr-3 -mr-3 text-sm space-y-4 docs-nav">
        <NuxtLink
          :to="docsRoot"
          class="block py-1"
          :class="path === docsRoot ? 'text-highlighted font-medium' : 'text-muted hover:text-highlighted'"
        >
          {{ $t('docs.overview') }}
        </NuxtLink>
        <details v-for="group in sidebar" :key="group.label" :open="group.open" class="group">
          <summary class="flex items-baseline justify-between gap-2 cursor-pointer list-none pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted hover:text-highlighted">
            <span>{{ group.label }}</span>
            <span class="font-normal normal-case tracking-normal text-dimmed group-open:hidden">{{ group.items.length }}</span>
          </summary>
          <div class="border-l border-default">
            <NuxtLink
              v-for="item in group.items"
              :key="item.path"
              :to="item.path"
              class="block py-1 px-3 -ml-px border-l"
              :class="path === item.path
                ? 'border-(--ui-text-highlighted) text-highlighted font-medium'
                : 'border-transparent text-muted hover:text-highlighted'"
            >
              {{ item.title }}
            </NuxtLink>
          </div>
        </details>
      </nav>
    </aside>

    <article class="min-w-0 flex-1 max-w-3xl prose-body pb-16">
      <h1>{{ page.title }}</h1>
      <aside v-if="page.kind === 'task' && (page.uses?.length || page.forms?.length)" class="uses not-prose">
        <div v-if="page.uses?.length">
          <span>Concepts used</span>
          <NuxtLink v-for="name in page.uses" :key="name" :to="conceptPath(name)">{{ titleOf(conceptPath(name)) }}</NuxtLink>
        </div>
        <div v-if="page.forms?.length">
          <span>You write</span>
          <code v-for="form in page.forms" :key="form">{{ form }}</code>
        </div>
      </aside>

      <ContentRenderer v-if="page" :value="page" />

      <section v-if="putToWork.length" class="put-to-work">
        <h2>Put it to work</h2>
        <div>
          <NuxtLink v-for="one in putToWork" :key="one.path" :to="one.path">{{ one.title }}</NuxtLink>
        </div>
      </section>
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
.docs-nav summary::-webkit-details-marker {
  display: none;
}

/* The task's card: what it rests on, and what you will write. */
.uses {
  display: grid;
  gap: 0.5rem;
  margin: 0 0 1.75rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--ui-border);
  border-left: 3px solid var(--ui-primary);
  border-radius: 0.65rem;
  background: var(--ui-bg-elevated);
  font-size: 0.875rem;
}
.uses div {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.75rem;
}
.uses span {
  width: 7.5rem;
  flex: none;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ui-text-dimmed);
}
.uses code {
  font-size: 0.78rem;
  padding: 0.05rem 0.5rem;
  border: 0;
  border-radius: 999px;
  background: color-mix(in oklab, #a0701c 14%, transparent);
  color: #7d5814;
}
.put-to-work div {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.put-to-work a {
  text-decoration: none;
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--ui-border-accented);
  border-radius: 999px;
  font-size: 0.875rem;
}
</style>
