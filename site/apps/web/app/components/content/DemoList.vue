<script setup lang="ts">
/**
 * Every demo the repository ships, pickable from one menu, shown by `<Demo>` below it.
 *
 * The list is the `demo` collection, so a demo added to `demos/` appears here without
 * anyone writing it down.
 */

/** Four files and a single declaration — the shortest way into what the site claims. */
const OPENS_ON = 'one-declaration';

const { data: demos } = await useAsyncData('demo:all', () =>
  queryCollection('demo').select('name', 'runnable', 'count').all(),
);

const items = computed(() =>
  (demos.value ?? []).map((demo) => ({
    label: demo.name,
    value: demo.name,
    suffix: `${demo.count} files`,
    runnable: demo.runnable,
  })),
);

const selected = ref(OPENS_ON);
</script>

<template>
  <div class="not-prose my-6">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <USelectMenu
        v-model="selected"
        :items="items"
        value-key="value"
        :search-input="{ placeholder: 'Search a demo…' }"
        class="w-64"
      >
        <template #item="{ item }">
          <span class="flex-1">{{ item.label }}</span>
          <span class="text-xs text-muted">{{ item.suffix }}</span>
          <UIcon v-if="item.runnable" name="i-lucide-play" class="size-3 text-primary" />
        </template>
      </USelectMenu>

      <p class="text-sm text-muted">
        {{ items.length }} demos, all of them running code in this repository.
      </p>
    </div>

    <Demo v-if="selected" :key="selected" :name="selected" />
  </div>
</template>
