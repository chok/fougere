<script setup lang="ts">
/**
 * A config file written whole, one key per line. Pointing at a line opens what that key is under it;
 * a click or a tap keeps it open. The sections below the file stay the full reference.
 */
interface Note { type: string; optional: boolean; doc: string; links: { label: string; path: string }[] }
interface File { name: string; lines: { text: string; key?: string }[]; notes: Record<string, Note> }

// Placed in the page's markdown, after its introduction; the file itself is the page's, already fetched.
const route = useRoute();
const { data: page } = useNuxtData<{ file?: File }>(`reference:${route.path.replace(/\/$/, '')}`);
const file = computed(() => page.value?.file);

const card = ref<HTMLElement | null>(null);
const pinned = ref<string | null>(null);
const open = ref<{ key: string; top: number } | null>(null);

function show(line: HTMLElement, key: string) {
  open.value = { key, top: line.getBoundingClientRect().bottom - card.value!.getBoundingClientRect().top + 6 };
}
const point = (event: Event, key?: string) => { if (key && !pinned.value) show(event.currentTarget as HTMLElement, key); };
const leave = () => { if (!pinned.value) open.value = null; };
function pin(event: Event, key?: string) {
  if (!key) return;
  if (pinned.value === key) {
    pinned.value = null;
    open.value = null;

    return;
  }
  pinned.value = key;
  show(event.currentTarget as HTMLElement, key);
}
function closeOutside(event: MouseEvent) {
  if (pinned.value && !(event.target as HTMLElement).closest('.line, .bubble')) {
    pinned.value = null;
    open.value = null;
  }
}
onMounted(() => addEventListener('click', closeOutside));
onBeforeUnmount(() => removeEventListener('click', closeOutside));

const note = computed(() => (open.value ? file.value?.notes[open.value.key] : undefined));
const prose = (text: string) =>
  text.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`).replace(/`([^`]+)`/g, '<code class="word">$1</code>');
const KEYWORDS = /\b(export|default|import|from)\b/g;
const highlight = (text: string) =>
  text.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`).replace(KEYWORDS, '<span class="kw">$1</span>');
</script>

<template>
  <div v-if="file" ref="card" class="annotated not-prose">
    <div class="path">{{ file.name }}</div>
    <div
      v-for="(line, l) in file.lines"
      :key="l"
      class="line"
      :class="{ keyed: line.key, on: open?.key === line.key && line.key }"
      :tabindex="line.key ? 0 : undefined"
      @mouseenter="point($event, line.key)"
      @mouseleave="leave"
      @focus="point($event, line.key)"
      @blur="leave"
      @click="pin($event, line.key)"
      @keydown.enter="pin($event, line.key)"
    >
      <span class="no">{{ l + 1 }}</span>
      <code v-html="highlight(line.text) || ' '" />
    </div>
    <div v-if="open && note" class="bubble" :class="{ pinned }" :style="{ top: `${open.top}px` }" role="tooltip">
      <p class="key"><code>{{ open.key }}</code> <span>{{ note.type }} · {{ note.optional ? 'optional' : 'required' }}</span></p>
      <p v-if="note.doc" class="doc" v-html="prose(note.doc)" />
      <p v-if="note.links.length" class="links">
        <NuxtLink v-for="link in note.links" :key="link.path + link.label" :to="link.path">{{ link.label }}</NuxtLink>
      </p>
      <a :href="`#${open.key.toLowerCase()}`" class="more">The whole entry ↓</a>
    </div>
  </div>
  <p v-if="file" class="hint">Point at a key, or tap it, to see what it is. Every key is described in full below.</p>
</template>

<style scoped>
.annotated { position: relative; margin: 20px 0 6px; padding-bottom: 12px; background: var(--code); color: var(--code-soft); border-radius: var(--radius-card); font-family: var(--font-mono); font-size: 13px; line-height: 1.8; }
.path { padding: 9px 16px 7px; margin-bottom: 6px; border-bottom: 1px solid rgb(255 255 255 / 0.08); font-size: 11px; color: var(--code-muted); }
.line { display: flex; gap: 12px; padding: 0 16px 0 10px; white-space: pre; }
.line .no { width: 18px; flex: none; text-align: right; color: var(--code-number); user-select: none; }
.annotated code { font: inherit; background: none; border: 0; padding: 0; border-radius: 0; color: inherit; box-shadow: none; }
.line code :deep(.kw) { color: var(--code-keyword); }
.line.keyed { cursor: pointer; outline: none; }
.line.keyed:hover, .line.on { background: var(--code-focus); }
.bubble { position: absolute; z-index: 5; left: 48px; width: min(420px, calc(100% - 60px)); display: grid; gap: 6px; padding: 12px 14px; background: var(--ui-bg-elevated); color: var(--ui-text); border: 1px solid var(--ui-border); border-radius: var(--radius-card); box-shadow: 0 14px 30px -14px rgb(0 0 0 / 0.55); font-family: var(--font-sans); font-size: 13px; line-height: 1.45; white-space: normal; pointer-events: none; }
.bubble.pinned { pointer-events: auto; }
.bubble::before { content: ''; position: absolute; top: -7px; left: 22px; width: 12px; height: 12px; background: var(--ui-bg-elevated); border-left: 1px solid var(--ui-border); border-top: 1px solid var(--ui-border); transform: rotate(45deg); }
.bubble p { margin: 0; }
.bubble .key code { font-family: var(--font-mono); font-weight: 600; }
.key span { color: var(--ui-text-dimmed); font-family: var(--font-mono); font-size: 11.5px; }
.doc { color: var(--ui-text-muted); }
.doc :deep(.word) { font-family: var(--font-mono); font-size: 12px; color: var(--ui-text); }
.links { display: flex; flex-wrap: wrap; gap: 4px 12px; }
.links a, .more { color: var(--ui-primary); font-size: 12.5px; }
.hint { margin: 0 0 24px; font-size: 13px; color: var(--ui-text-dimmed); }
</style>
