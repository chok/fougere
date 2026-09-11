<script setup lang="ts">
/**
 * One demo of `demos/`, shown whole: its tree, its files, and a sandbox to run it in.
 *
 * The page holds no copy — `modules/demo.ts` projects the demo into `content/demo/` at
 * build, so what is rendered here cannot drift from what the repository ships. The tree is
 * `::code-tree`, which derives its branches from the block labels.
 */
const props = defineProps<{ name: string }>();

const { data: demo } = await useAsyncData(
  () => `demo:${props.name}`,
  () => queryCollection('demo').path(`/demo/${props.name}`).first(),
  { watch: [() => props.name] },
);

const opening = ref(false);

/**
 * StackBlitz takes a whole project over its POST door, so the sandbox needs the sources
 * rather than the highlighted markup the page renders — `public/demo/<name>.json` is the
 * same files, fetched only once a reader asks to run one.
 */
const run = async () => {
  opening.value = true;

  try {
    const files = await $fetch<Record<string, string>>(`/demo/${props.name}.json`);
    const form = document.createElement('form');

    form.method = 'POST';
    form.action = 'https://stackblitz.com/run';
    form.target = '_blank';

    const state = (name: string, value: string) => {
      const field = document.createElement('input');

      field.type = 'hidden';
      field.name = name;
      field.value = value;
      form.appendChild(field);
    };

    for (const [path, content] of Object.entries(files)) state(`project[files][${path}]`, content);

    state('project[title]', props.name);
    state('project[description]', `The ${props.name} demo, from the Fougere repository`);
    state('project[template]', 'node');

    document.body.appendChild(form);
    form.submit();
    form.remove();
  } finally {
    opening.value = false;
  }
};
</script>

<template>
  <section v-if="demo" class="not-prose my-6 rounded-xl border border-default overflow-hidden">
    <header class="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-default bg-elevated/50">
      <UIcon name="i-lucide-folder-tree" class="size-4 text-muted" />
      <code class="text-sm font-medium text-highlighted">demos/{{ demo.name }}</code>
      <span class="text-xs text-muted">{{ demo.count }} files</span>

      <div class="ms-auto flex items-center gap-2">
        <UButton
          v-if="demo.runnable"
          :loading="opening"
          icon="i-lucide-play"
          size="xs"
          color="primary"
          @click="run"
        >
          Run it
        </UButton>
        <UPopover v-else mode="hover">
          <UBadge color="neutral" variant="subtle" size="sm">Local only</UBadge>
          <template #content>
            <div class="p-3 text-xs space-y-1 max-w-xs">
              <p class="text-muted">This demo loads a native binary, which a web sandbox cannot.</p>
              <code class="block text-highlighted">pnpm -C demos/{{ demo.name }} dev</code>
            </div>
          </template>
        </UPopover>
      </div>
    </header>

    <ContentRenderer :value="demo" class="demo-tree" />
  </section>
</template>

<style scoped>
/* `.prose-body ul` in main.css reaches in here and marks every file with a disc.
   `not-prose` does not cover it: that rule is ours, not Tailwind Typography's. */
.demo-tree :deep(ul) {
  list-style: none;
  margin: 0;
  padding-left: 0;
}
.demo-tree :deep(li) {
  margin: 0;
}
.demo-tree :deep(pre) {
  margin: 0;
  border: 0;
  border-radius: 0;
  font-size: 0.78rem;
}
</style>
