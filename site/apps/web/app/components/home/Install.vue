<script setup lang="ts">
import { PackageManager } from '@fougere/cli/package-manager';

// The key the docs' code groups sync on (`modules/managers.ts`), which holds the TAB's index: the
// tabs are written in the order of `PackageManager.names`, so an index names a package manager.
const KEY = 'code-group-pm';
const names = PackageManager.names;

const tab = useState<string>(KEY, () => '0');
const chosen = computed({
  get: () => names[Number(tab.value)] ?? 'npm',
  set: (name: PackageManager['name']) => { tab.value = String(names.indexOf(name)); },
});
// The list opens on the light page, the chosen one sits on the dark line: pnpm's mark has a version for each.
const markOn = (surface: 'light' | 'dark', name: string) =>
  `i-vscode-icons-file-type-${surface === 'light' && name === 'pnpm' ? 'light-pnpm' : name}`;
const items = names.map((name) => ({ label: name, value: name, icon: markOn('light', name) }));
const command = computed(() => new PackageManager(chosen.value).create());
const copied = ref(false);

onMounted(() => {
  try {
    tab.value = localStorage.getItem(KEY) ?? tab.value;
  } catch { /* storage refused: the choice lasts the visit */ }
});

watch(tab, (index) => {
  try {
    localStorage.setItem(KEY, index);
  } catch { /* storage refused: the choice lasts the visit */ }
});

async function copy() {
  await navigator.clipboard.writeText(command.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}
</script>

<template>
  <div class="install">
    <USelect
      v-model="chosen"
      :items="items"
      :icon="markOn('dark', chosen)"
      variant="none"
      aria-label="Package manager"
      class="manager"
      :ui="{ base: 'text-[#e1ebde]', content: 'min-w-44' }"
    />
    <button type="button" class="line" :aria-label="copied ? 'Copied' : `Copy ${command}`" @click="copy">
      <code>{{ command }}</code>
      <UIcon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" class="size-4 shrink-0" />
    </button>
  </div>
</template>

<style scoped>
.install {
  display: flex;
  align-items: center;
  width: min(100%, 460px);
  min-height: 56px;
  background: #10180f;
  border-radius: 12px;
  padding-left: 8px;
}

.manager {
  flex: none;
  color: #e1ebde;
  font-family: var(--font-mono);
  font-size: 14px;
  border-right: 1px solid rgb(255 255 255 / 0.12);
  border-radius: 0;
}

.line {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  align-self: stretch;
  padding: 0 16px 0 18px;
  border: 0;
  background: transparent;
  color: #7d8c80;
  cursor: pointer;
  text-align: left;
  border-radius: 0 12px 12px 0;
  transition: color 0.2s, background 0.2s;
}

.line:hover {
  color: #e1ebde;
  background: rgb(255 255 255 / 0.04);
}

.line code {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #e1ebde;
  font-family: var(--font-mono);
  font-size: 16px;
}
</style>
