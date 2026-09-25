<script setup lang="ts">
import type { TreeItem } from '@nuxt/ui';
import type { GestureFile, GestureSummary } from '~~/modules/gestures';
import { diffs, summaries } from '#build/gestures.mjs';

type Gesture = GestureSummary['gesture'];
type Tool = GestureSummary['tool'];

const { t } = useI18n();

useSeoMeta({
  title: () => `Fougere — ${t('compare.title')}`,
  description: () => t('compare.subtitle'),
});

const GESTURES: Gesture[] = ['field', 'split', 'engine'];
const TOOLS: { value: Tool; label: string }[] = [
  { value: 'fougere', label: 'Fougere' },
  { value: 'zenstack', label: 'ZenStack' },
  { value: 'nestjs', label: 'NestJS' },
  { value: 'encore', label: 'Encore' },
];

/** What the diff makes you write that is not the domain — read off the diffs, not declared by any tool. */
const CONCEPTS: Record<Gesture, Partial<Record<Tool, string[]>>> = {
  field: {
    fougere: [],
    zenstack: [],
    nestjs: ['@Column', '@IsOptional', '@IsString'],
    encore: ['ALTER TABLE', 'INSERT … VALUES', 'SELECT columns'],
  },
  split: {
    fougere: ['remote:'],
    zenstack: ['createClient', 'express()', 'ZenStackMiddleware', 'RPCApiHandler'],
    nestjs: ['@nestjs/microservices', 'Transport.TCP', 'connectMicroservice', '@MessagePattern', 'ClientsModule', 'ClientProxy', 'firstValueFrom'],
    encore: ['metadata', 'sql_servers', 'service_discovery'],
  },
  engine: {
    fougere: ["dialect: 'pg'"],
    zenstack: ["provider = 'postgresql'", 'PostgresDialect', 'Pool'],
    nestjs: ["type: 'postgres'", "'timestamptz'"],
  },
};

const COMMANDS: Record<Gesture, Partial<Record<Tool, string[]>>> = {
  field: {
    zenstack: ['zen generate', 'zen migrate dev --name excerpt'],
  },
  split: {
    fougere: ['fougere serve blog --port 4701'],
    zenstack: ['node src/blog.ts'],
    nestjs: ['node dist/main-blog.js'],
    encore: [
      'encore build docker --services=blog --config infra-blog.json',
      'encore build docker --services=digest --config infra-digest.json',
      'psql -f blog/migrations/1_create_posts.up.sql',
    ],
  },
  engine: {
    fougere: ['pnpm add pg'],
    zenstack: ['pnpm add pg', 'rm -rf zenstack/migrations', 'zen migrate dev --name init'],
    nestjs: ['pnpm add pg'],
  },
};

/** The icon set the docs' code trees use; spelled here so the build bundles each one. */
const ICONS: Record<string, string> = {
  ts: 'i-vscode-icons-file-type-typescript',
  json: 'i-vscode-icons-file-type-json',
  app: 'i-vscode-icons-file-type-json',
  sql: 'i-vscode-icons-file-type-sql',
  zmodel: 'i-vscode-icons-file-type-prisma',
  toml: 'i-vscode-icons-file-type-toml',
  yaml: 'i-vscode-icons-file-type-yaml',
};

const gesture = ref<Gesture>('split');
const tool = ref<Tool>('fougere');
const onlyChanged = ref(true);
const path = ref<string>();

const summaryOf = (candidate: Tool) =>
  summaries.find((summary) => summary.gesture === gesture.value && summary.tool === candidate);

const { data: files } = await useAsyncData(
  () => `gestures:${gesture.value}-${tool.value}`,
  async (): Promise<GestureFile[]> => (await diffs[`${gesture.value}-${tool.value}`]?.()) ?? [],
);

const shown = computed(() =>
  (files.value ?? []).filter((file) => !onlyChanged.value || file.status !== 'same'));

/** Folders from the paths themselves — the same derivation `::code-tree` makes. */
const tree = computed<TreeItem[]>(() => {
  const roots: TreeItem[] = [];
  for (const file of shown.value) {
    const segments = file.path.split('/');
    let level = roots;
    segments.forEach((segment, index) => {
      const prefix = segments.slice(0, index + 1).join('/');
      const leaf = index === segments.length - 1;
      let item = level.find((candidate) => candidate.value === prefix);
      if (!item) {
        item = leaf
          ? { label: segment, value: prefix, icon: ICONS[segment.split('.').pop() ?? ''] ?? 'i-lucide-file', file }
          : { label: segment, value: prefix, children: [] };
        level.push(item);
      }
      level = item.children ?? [];
    });
  }

  const ordered = (items: TreeItem[]): TreeItem[] => items
    .map((item) => item.children ? { ...item, children: ordered(item.children) } : item)
    .sort((one, other) => Number(!one.children) - Number(!other.children) || String(one.label).localeCompare(String(other.label)));

  return ordered(roots);
});

const folders = (items: TreeItem[]): string[] =>
  items.flatMap((item) => item.children ? [item.value, ...folders(item.children)] : []);
const expanded = ref<string[]>([]);
watch(tree, (next) => { expanded.value = folders(next); }, { immediate: true });

const current = computed<GestureFile | undefined>(() => files.value?.find((file) => file.path === path.value));

const leaves = (items: TreeItem[]): TreeItem[] => items.flatMap((item) => item.children ? leaves(item.children) : [item]);
const selected = computed(() => leaves(tree.value).find((item) => item.value === path.value));

watch(files, (next) => {
  const changed = (next ?? []).filter((file) => file.status !== 'same' && !file.generated);
  path.value = (changed.find((file) => !file.path.endsWith('package.json')) ?? changed[0] ?? next?.[0])?.path;
}, { immediate: true });

const MARK: Record<GestureFile['status'], { letter: string; color: string }> = {
  added: { letter: 'A', color: 'text-success' },
  modified: { letter: 'M', color: 'text-warning' },
  removed: { letter: 'D', color: 'text-error' },
  same: { letter: '', color: '' },
};

/** `a \`b\`` → text and code, without handing a translation to v-html. */
const pieces = (text: string) => text.split('`').map((part, index) => ({ part, code: index % 2 === 1 }));
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-12 space-y-8">
    <header class="space-y-3 max-w-3xl">
      <h1 class="text-3xl font-bold text-highlighted">{{ t('compare.title') }}</h1>
      <p class="text-muted">{{ t('compare.subtitle') }}</p>
    </header>

    <UTabs
      v-model="gesture"
      :items="GESTURES.map((value) => ({ value, label: t(`compare.gestures.${value}`) }))"
      :content="false"
      variant="link"
    />

    <p class="text-sm text-muted -mt-4">
      <template v-for="({ part, code }, index) in pieces(t(`compare.gestureText.${gesture}`))" :key="index">
        <code v-if="code" class="text-highlighted">{{ part }}</code><template v-else>{{ part }}</template>
      </template>
    </p>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <button
        v-for="candidate in TOOLS"
        :key="candidate.value"
        type="button"
        class="text-left rounded-lg border p-4 transition"
        :class="tool === candidate.value ? 'border-primary bg-primary/5' : 'border-default hover:border-accented'"
        @click="tool = candidate.value"
      >
        <div class="font-semibold text-highlighted">{{ candidate.label }}</div>
        <template v-if="summaryOf(candidate.value)">
          <div class="mt-2 font-mono text-sm">
            <span class="text-success">+{{ summaryOf(candidate.value)!.added }}</span>
            <span class="text-error ml-2">−{{ summaryOf(candidate.value)!.removed }}</span>
          </div>
          <div class="text-xs text-muted">
            {{ summaryOf(candidate.value)!.files }} {{ t('compare.files') }}
            · {{ (CONCEPTS[gesture][candidate.value] ?? []).length + (COMMANDS[gesture][candidate.value] ?? []).length }} {{ t('compare.conceptCount') }}
          </div>
        </template>
        <div v-else class="mt-2 text-xs text-muted">{{ t('compare.notApplicable') }}</div>
      </button>
    </div>

    <div v-if="summaryOf(tool)" class="grid md:grid-cols-2 gap-6 text-sm">
      <div class="space-y-2">
        <div class="text-muted">{{ t('compare.concepts') }}</div>
        <div v-if="CONCEPTS[gesture][tool]?.length" class="flex flex-wrap gap-1.5">
          <UBadge v-for="concept in CONCEPTS[gesture][tool]" :key="concept" :label="concept" variant="soft" color="neutral" class="font-mono" />
        </div>
        <div v-else class="text-success">{{ t('compare.noConcept') }}</div>
      </div>
      <div v-if="COMMANDS[gesture][tool]?.length" class="space-y-2">
        <div class="text-muted">{{ t('compare.commands') }}</div>
        <div class="flex flex-wrap gap-1.5">
          <UBadge v-for="command in COMMANDS[gesture][tool]" :key="command" :label="command" variant="outline" color="neutral" icon="i-lucide-terminal" class="font-mono" />
        </div>
      </div>
    </div>

    <div v-if="summaryOf(tool)" class="code-window max-h-[75vh] min-h-80">
      <div class="code-window-bar">
        <span class="code-dot bg-red-400/80" />
        <span class="code-dot bg-amber-400/80" />
        <span class="code-dot bg-green-400/80" />
        <span class="code-filename">{{ current?.path }}</span>
        <span v-if="current && current.status !== 'same'" class="ml-auto font-mono text-xs">
          <span class="text-success">+{{ current.added }}</span>
          <span class="text-error ml-2">−{{ current.removed }}</span>
        </span>
      </div>
      <div class="flex min-h-0 flex-1">
        <aside class="w-72 shrink-0 border-r border-default overflow-y-auto p-2 space-y-2">
          <USwitch v-model="onlyChanged" :label="t('compare.onlyChanged')" size="xs" class="px-2 pt-1" />
          <UTree
            v-model:expanded="expanded"
            :model-value="selected"
            :items="tree"
            :get-key="(item) => item.value"
            size="sm"
            @update:model-value="(item) => { if (item?.file) path = item.value; }"
          >
            <template #item-trailing="{ item }">
              <UBadge v-if="item.file?.generated" :label="t('compare.generated')" size="xs" variant="subtle" color="neutral" />
              <span v-if="item.file" class="font-mono text-xs w-3" :class="MARK[item.file.status as GestureFile['status']].color">
                {{ MARK[item.file.status as GestureFile['status']].letter }}
              </span>
            </template>
          </UTree>
        </aside>
        <div class="code-window-body gesture-diff min-w-0">
          <p v-if="current?.status === 'same'" class="px-4 pt-3 text-xs text-muted">{{ t('compare.unchanged') }}</p>
          <p v-if="current?.status === 'removed'" class="px-4 pt-3 text-xs text-error">{{ t('compare.removedFile') }}</p>
          <div v-if="current" v-html="current.html" />
        </div>
      </div>
    </div>

    <p class="text-xs text-muted max-w-3xl">
      <template v-for="({ part, code }, index) in pieces(t('compare.method'))" :key="index">
        <code v-if="code">{{ part }}</code><template v-else>{{ part }}</template>
      </template>
    </p>
  </div>
</template>

<style scoped>
.gesture-diff :deep(.line) {
  display: inline-block;
  width: 100%;
  padding-inline: 0.5rem;
}
.gesture-diff :deep(.line.diff.add) {
  background: color-mix(in oklab, var(--ui-success) 14%, transparent);
  box-shadow: inset 2px 0 0 var(--ui-success);
}
.gesture-diff :deep(.line.diff.remove) {
  background: color-mix(in oklab, var(--ui-error) 12%, transparent);
  box-shadow: inset 2px 0 0 var(--ui-error);
  opacity: 0.75;
}
.gesture-diff :deep(pre) {
  padding-inline: 0.5rem;
}
</style>
