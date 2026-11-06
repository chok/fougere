<script setup lang="ts">
import { PackageManager } from '@fougere/cli/package-manager';

/**
 * One step of the tutorial as a small editor: the project on the left, one file open in the middle —
 * the ones this step touched as tabs — and what grew from the line pointed at on the right.
 */
interface Line { text: string; added: boolean; keys: string[] }
interface Step {
  step: number; name: string; heading: string; lede: string; fig: string;
  files: { path: string; state: string }[];
  code: { path: string; state: string; lines: Line[] }[];
  grows: { key: string; side: string; label: string; detail: string }[];
  tryIt?: { command: string; said: Record<string, string>; output: string };
  install?: Record<string, string>;
  whatIf?: string; zero?: string;
  links: { title: string; path: string }[];
}

const props = defineProps<{ step: Step; steps: { path: string; step: number; name: string }[] }>();

// The docs' code groups and the home line keep the reader's package manager under this key, as a tab index.
const managers = PackageManager.names;
const tab = useState<string>('code-group-pm', () => '0');
onMounted(() => {
  try {
    tab.value = localStorage.getItem('code-group-pm') ?? tab.value;
  } catch { /* storage refused: npm, for this visit */ }
});
const choose = (index: number) => {
  tab.value = String(index);
  try {
    localStorage.setItem('code-group-pm', tab.value);
  } catch { /* storage refused: the choice lasts the visit */ }
};
const manager = computed(() => managers[Number(tab.value)] ?? 'npm');
const said = computed(() => props.step.tryIt?.said[manager.value] ?? props.step.tryIt?.command);
const install = computed(() => props.step.install?.[manager.value]);
/** What the reader copies: a command in their package manager's words, or the file open in the editor. */
const copied = ref<string | null>(null);
async function copy(what: string, text: string) {
  await navigator.clipboard.writeText(text);
  copied.value = what;
  setTimeout(() => { if (copied.value === what) copied.value = null; }, 1600);
}
const openedText = () => props.step.code.find((file) => file.path === opened.value)?.lines.map((line) => line.text).join('\n') ?? '';
const variesByManager = computed(() => new Set(Object.values(props.step.tryIt?.said ?? {})).size > 1);

const lit = ref<{ keys: string[]; line: string } | null>(null);
const isLit = (keys: string[], id: string) =>
  lit.value !== null && (lit.value.line === id || keys.some((key) => lit.value!.keys.includes(key)));

/** What grew from a lettered line, opened under it: pointed at for a glance, clicked or tapped to stay. */
const pane = ref<HTMLElement | null>(null);
const pinned = ref<string | null>(null);
const bubble = ref<{ grows: Step['grows']; top: number } | null>(null);
function show(line: HTMLElement, keys: string[], id: string) {
  lit.value = { keys, line: id };
  const top = line.getBoundingClientRect().bottom - pane.value!.getBoundingClientRect().top + 6;
  bubble.value = { grows: props.step.grows.filter((one) => keys.includes(one.key)), top };
}
function point(event: Event, keys: string[], id: string) {
  if (keys.length && !pinned.value) show(event.currentTarget as HTMLElement, keys, id);
}
function leave() {
  if (pinned.value) return;
  lit.value = null;
  bubble.value = null;
}
function close() {
  pinned.value = null;
  leave();
}
function pin(event: Event, keys: string[], id: string) {
  if (!keys.length) return;
  if (pinned.value === id) return close();
  pinned.value = id;
  show(event.currentTarget as HTMLElement, keys, id);
}
function closeOutside(event: MouseEvent) {
  if (pinned.value && !(event.target as HTMLElement).closest('.line, .bubble')) close();
}
onMounted(() => addEventListener('click', closeOutside));
onBeforeUnmount(() => removeEventListener('click', closeOutside));

/** The file open in the editor: the first this step touched, until the reader opens another. */
// A manifest opens on demand, never first: what it gained is the install line above.
const touched = computed(() => props.step.code.filter((file) => file.state && !file.path.endsWith('package.json')));
const opened = ref<string | undefined>(touched.value[0]?.path);
watch(() => props.step.step, () => { opened.value = touched.value[0]?.path; });
const open = (path: string) => {
  if (!props.step.code.some((file) => file.path === path)) return;
  opened.value = path;
  close();
};
watch(() => props.step.step, close);

const heading = computed(() =>
  props.step.heading.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`).replace(/\*([^*]+)\*/g, '<em>$1</em>'));

/** The files as a tree, folders first in reading order, each file with what this step did to it. */
const tree = computed(() => {
  type Node = { dirs: Map<string, Node>; files: { name: string; state: string; path: string }[] };
  const root: Node = { dirs: new Map(), files: [] };
  for (const { path, state } of props.step.files) {
    const parts = path.split('/');
    const name = parts.pop()!;
    let node = root;
    for (const part of parts) {
      if (!node.dirs.has(part)) node.dirs.set(part, { dirs: new Map(), files: [] });
      node = node.dirs.get(part)!;
    }
    if (name) node.files.push({ name, state, path });
  }
  const rows: { depth: number; name: string; dir: boolean; state: string; path?: string }[] = [];
  const walk = (node: Node, depth: number) => {
    for (const [name, child] of node.dirs) {
      rows.push({ depth, name: `${name}/`, dir: true, state: '' });
      walk(child, depth + 1);
    }
    for (const file of node.files) rows.push({ depth, name: file.name, dir: false, state: file.state, path: file.path });
  };
  walk(root, 0);

  return rows;
});

const SIDES = [['in', 'Incoming'], ['out', 'Outgoing'], ['refuses', 'Refuses']] as const;
const titleOf = Object.fromEntries(SIDES) as Record<string, string>;
const KEYWORDS = /\b(export|default|class|extends|implements|abstract|async|await|const|return|throw|if|private|constructor|import|from|type|new)\b/g;
const highlight = (text: string) =>
  text.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`).replace(KEYWORDS, '<span class="kw">$1</span>');

const index = computed(() => props.steps.findIndex((one) => one.step === props.step.step));
const previous = computed(() => props.steps[index.value - 1]);
const next = computed(() => props.steps[index.value + 1]);

function onKey(event: KeyboardEvent) {
  if (event.target instanceof HTMLElement && /input|textarea/i.test(event.target.tagName)) return;
  if (event.key === 'Escape') close();
  if (event.key === 'ArrowLeft' && previous.value) navigateTo(previous.value.path);
  if (event.key === 'ArrowRight' && next.value) navigateTo(next.value.path);
}
onMounted(() => addEventListener('keydown', onKey));
// On a phone the path scrolls: the step being read is brought into view, not left past the edge.
onMounted(() => document.querySelector('.rail .on')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
onBeforeUnmount(() => removeEventListener('keydown', onKey));
</script>

<template>
  <div class="tutorial">
    <ol class="rail" aria-label="Steps">
      <li v-for="one in steps" :key="one.path" :class="{ on: one.step === step.step, done: one.step < step.step }">
        <NuxtLink :to="one.path"><i />{{ one.name }}</NuxtLink>
      </li>
    </ol>

    <div class="leaves" :class="{ lit: lit !== null }">
      <div class="center">
        <h1 v-html="heading" />
        <p class="lede">{{ step.lede }}</p>

        <div v-if="install" class="slip install">
          <span class="tag">Install</span>
          <div class="tools">
            <div class="managers" role="tablist" aria-label="Package manager">
              <button v-for="(name, index) in managers" :key="name" type="button" role="tab"
                :aria-selected="manager === name" @click="choose(index)">{{ name }}</button>
            </div>
            <button type="button" class="copy" :aria-label="copied === 'install' ? 'Copied' : 'Copy'" @click="copy('install', install!)">
              <UIcon :name="copied === 'install' ? 'i-lucide-check' : 'i-lucide-copy'" />
            </button>
          </div>
          <pre class="tabbed"><span class="prompt">$</span> {{ install }}</pre>
        </div>

        <div class="ide">
          <nav class="explorer" aria-label="Your project">
            <h4>Your project</h4>
            <component
              :is="row.path && step.code.some((file) => file.path === row.path) ? 'button' : 'div'"
              v-for="(row, r) in tree"
              :key="r"
              class="file"
              :class="[row.state, { dir: row.dir, opened: row.path === opened }]"
              :type="row.path ? 'button' : undefined"
              @click="row.path && open(row.path)"
            >
              <span v-for="d in row.depth" :key="d" class="guide" />
              <i v-if="!row.dir" />{{ row.name }}
            </component>
            <div class="legend"><span class="new"><i />new</span><span class="changed"><i />changed</span><span class="moved"><i />moved</span></div>
          </nav>
          <div v-if="step.code.length" ref="pane" class="pane">
            <div v-for="(file, f) in step.code" v-show="file.path === opened" :key="file.path" class="card">
              <div class="path">
                <span>{{ file.path }}</span>
                <button type="button" class="copy" :aria-label="copied === file.path ? 'Copied' : 'Copy'" @click="copy(file.path, openedText())">
                  <UIcon :name="copied === file.path ? 'i-lucide-check' : 'i-lucide-copy'" />
                </button>
              </div>
              <div
                v-for="(line, l) in file.lines"
                :key="l"
                class="line"
                :class="{ added: line.added, on: isLit(line.keys, `${f}:${l}`) }"
                :tabindex="line.keys.length ? 0 : undefined"
                @mouseenter="point($event, line.keys, `${f}:${l}`)"
                @mouseleave="leave"
                @focus="point($event, line.keys, `${f}:${l}`)"
                @blur="leave"
                @click="pin($event, line.keys, `${f}:${l}`)"
                @keydown.enter="pin($event, line.keys, `${f}:${l}`)"
              >
                <span class="no">{{ line.added ? '+' : l + 1 }}</span>
                <code v-html="highlight(line.text) || ' '" />
                <sup v-if="line.keys.length">{{ line.keys.join(' ') }}</sup>
              </div>
            </div>
            <div v-if="bubble" class="bubble" :class="{ pinned }" :style="{ top: `${bubble.top}px` }" role="tooltip">
              <div v-for="one in bubble.grows" :key="one.key" class="grown" :class="one.side">
                <b>{{ one.key }}</b>
                <span><em>{{ titleOf[one.side] }}</em>{{ one.label }}<small>{{ one.detail }}</small></span>
              </div>
            </div>
          </div>
        </div>
        <p v-if="step.grows.length" class="hand hint">point at a lettered line, or tap it, to see what grows from it</p>
        <div v-if="step.zero" class="stamp"><b>0</b> line changed under {{ step.zero }}</div>

        <p class="fig"><span>Fig. {{ step.step }}.</span> {{ step.fig }}</p>

        <div v-if="step.tryIt" class="slip">
          <span class="tag">Try it</span>
          <div class="tools">
            <div v-if="variesByManager" class="managers" role="tablist" aria-label="Package manager">
              <button v-for="(name, index) in managers" :key="name" type="button" role="tab"
                :aria-selected="manager === name" @click="choose(index)">{{ name }}</button>
            </div>
            <button type="button" class="copy" :aria-label="copied === 'try' ? 'Copied' : 'Copy'" @click="copy('try', said!)">
              <UIcon :name="copied === 'try' ? 'i-lucide-check' : 'i-lucide-copy'" />
            </button>
          </div>
          <pre class="tabbed"><span class="prompt">$</span> {{ said }}
<span class="output">{{ step.tryIt.output }}</span></pre>
        </div>
        <p v-if="step.whatIf" class="hand what-if">what if — {{ step.whatIf }}</p>

        <div v-if="step.links.length" class="deeper">
          <span>Go deeper</span>
          <NuxtLink v-for="link in step.links" :key="link.path" :to="link.path">{{ link.title }}</NuxtLink>
        </div>

        <nav class="pills">
          <NuxtLink v-if="previous" :to="previous.path" class="pill">← {{ previous.name }}</NuxtLink>
          <span v-else />
          <NuxtLink v-if="next" :to="next.path" class="pill ink">{{ next.name }} →</NuxtLink>
          <NuxtLink v-else to="/docs" class="pill ink">Read the docs →</NuxtLink>
        </nav>
      </div>

    </div>
  </div>
</template>

<style scoped>
.tutorial {
  --slate: #4a6b8c;
  --code: #10180f;
  --hand: 'Architects Daughter', 'Bradley Hand', cursive;
}
.rail { list-style: none; display: flex; margin: 0 0 36px; padding: 8px 0 6px; overflow-x: auto; scrollbar-width: none; }
.rail li { position: relative; flex: 1 0 84px; }
.rail li + li::before { content: ''; position: absolute; top: 5px; left: -50%; width: 100%; height: 2px; background: #dcdfd6; }
.rail li.done + li::before, .rail li.done::before, .rail li.on::before { background: var(--ui-primary); }
.rail a { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 9px; font-family: var(--font-mono); font-size: 12px; color: #8a948c; text-decoration: none; white-space: nowrap; }
.rail i { width: 12px; height: 12px; border-radius: 50%; border: 2px solid #c3c9bf; background: var(--ui-bg); transition: all 0.3s; }
.rail .done i { background: var(--ui-primary); border-color: var(--ui-primary); }
.rail .done a { color: var(--ui-text-muted); }
.rail .on a { color: var(--ui-text); font-weight: 600; }
.rail .on i { border-color: var(--ui-primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--ui-primary) 18%, transparent); transform: scale(1.15); }

.leaves { max-width: 880px; margin: 0 auto; }

.explorer {
  --kraft: #efe4cb;
  --kraft-ink: #5a4627;
  --kraft-rule: rgb(120 88 40 / 0.11);
  --kraft-guide: rgb(120 88 40 / 0.22);
  background: var(--kraft);
}
.explorer h4 { margin: 0 4px 8px; font-family: var(--font-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: color-mix(in srgb, var(--kraft-ink) 70%, transparent); }
.file { display: flex; align-items: center; gap: 7px; width: 100%; overflow: hidden; padding: 0 4px; border-radius: 4px; background: none; font-family: var(--font-mono); font-size: 12px; line-height: 24px; color: color-mix(in srgb, var(--kraft-ink) 72%, transparent); white-space: nowrap; text-align: left; box-shadow: inset 0 -1px var(--kraft-rule); }
button.file { cursor: pointer; }
button.file:hover { background: rgb(120 88 40 / 0.08); }
.file.opened { background: rgb(120 88 40 / 0.14); color: var(--kraft-ink); }
.file.dir { color: color-mix(in srgb, var(--kraft-ink) 55%, transparent); }
.guide { align-self: stretch; width: 5px; margin-left: 4px; border-left: 1px solid var(--kraft-guide); flex: none; }

.file i { width: 6px; height: 6px; border-radius: 50%; background: var(--ui-border-accented); flex: none; }
.file small { font-family: var(--hand); font-size: 12.5px; color: var(--ui-text-dimmed); }
.file.new, .file.changed { color: var(--kraft-ink); }
.file.new i, .legend .new i { background: var(--ui-primary); }
.file.changed i, .legend .changed i { background: var(--saffron); }
.file.moved i, .legend .moved i { background: var(--slate); }
.legend { display: flex; gap: 12px; margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--kraft-guide); color: var(--kraft-ink); font-size: 11.5px; color: var(--ui-text-dimmed); }
.legend span { display: inline-flex; gap: 5px; align-items: center; }
.legend i { width: 6px; height: 6px; border-radius: 50%; }

.center { min-width: 0; }
.center h1 { margin: 8px 0 6px; font-size: clamp(28px, 3.4vw, 42px); line-height: 1.1; }
.center h1 :deep(em) { font-style: italic; color: var(--ui-primary); }
.lede { margin: 6px 0 0; color: var(--ui-text-muted); }

.ide { display: grid; grid-template-columns: 224px minmax(0, 1fr); margin-top: 34px; border: 1px solid rgb(120 88 40 / 0.22); border-radius: 12px; box-shadow: 0 14px 30px -24px rgb(40 50 30 / 0.5); }
.explorer { padding: 14px 10px 12px; border-radius: 12px 0 0 12px; }
.pane { position: relative; min-width: 0; background: var(--code); border-radius: 0 12px 12px 0; }
@media (max-width: 760px) {
  .ide { grid-template-columns: minmax(0, 1fr); }
  .explorer { border-radius: 12px 12px 0 0; }
  .pane { border-radius: 0 0 12px 12px; }
}
.pane .card { border-radius: 0; padding-bottom: 14px; }
.card { overflow-x: auto; padding-bottom: 12px; background: var(--code); color: #d9e4da; border-radius: 10px; font-family: var(--font-mono); font-size: 12.5px; line-height: 1.75; }
.path { padding: 9px 16px 7px; margin-bottom: 6px; border-bottom: 1px solid rgb(255 255 255 / 0.08); font-size: 11px; color: #9fb09f; }
.line { display: flex; gap: 12px; padding: 0 16px 0 10px; white-space: pre; transition: background 0.2s, opacity 0.2s; }
.line .no { width: 14px; flex: none; text-align: right; color: #4f604f; user-select: none; }
.line code { font: inherit; }
.line code :deep(.kw) { color: #9cc79f; }
.line sup { margin-left: auto; padding-left: 10px; font-family: var(--hand); font-size: 12px; line-height: inherit; vertical-align: baseline; top: 0; letter-spacing: 0.1em; color: #c9b27a; }
.line.added { background: #1b3320; }
.line.added .no { color: #7fc488; }
.line.on { background: #2a4a2c; }
.leaves.lit .line:not(.on) { opacity: 0.55; }

.stamp { display: inline-flex; align-items: center; gap: 10px; margin-top: 12px; padding: 8px 12px; border: 1.5px solid var(--ui-primary); border-radius: 6px; color: var(--ui-primary); background: var(--ui-bg-elevated); font-family: var(--font-mono); font-size: 11.5px; letter-spacing: 0.04em; transform: rotate(-1.5deg); }
.stamp b { font-family: var(--font-serif); font-size: 26px; font-weight: 400; line-height: 1; }

.fig { margin: 10px 0 0; font-family: var(--font-serif); font-style: italic; font-size: 16px; color: var(--ui-text-muted); }
.fig span { font-style: normal; font-variant: small-caps; letter-spacing: 0.04em; margin-right: 4px; }

.slip { position: relative; margin-top: 44px; }
.hand { font-family: var(--hand); }
.slip .tag { position: absolute; top: -13px; left: 14px; padding: 3px 9px; border-radius: 3px; background: #fff; box-shadow: 0 1px 3px rgb(0 0 0 / 0.18); color: var(--ui-text); font-family: var(--font-sans); font-size: 12.5px; font-weight: 600; transform: rotate(-2deg); }
.slip pre { margin: 0; padding: 18px 16px 14px; overflow-x: auto; background: var(--code); color: #d9e4da; border-radius: 10px; font-size: 12.5px; line-height: 1.7; }
.slip .prompt { color: #7fc488; }
.slip pre.tabbed { padding-top: 40px; }
.tools { position: absolute; top: 8px; right: 10px; display: flex; align-items: center; gap: 6px; }
.managers { display: flex; gap: 2px; }
.copy { display: inline-flex; padding: 4px; font-size: 15px; border-radius: 6px; color: #8fa08f; cursor: pointer; }
.copy:hover { color: #e3ece2; background: rgb(255 255 255 / 0.06); }
.path { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.path .copy { margin: -4px -6px -4px 0; }
.slip.install { margin: 40px 0 6px; }
.managers button { cursor: pointer; padding: 2px 8px; border-radius: 999px; font-family: var(--font-mono); font-size: 11px; color: #7f927f; }
.managers button[aria-selected="true"] { background: #1b3320; color: #d9e4da; }
.slip .output { color: #7f927f; }
.what-if { margin: 16px 0 0; font-size: 16px; line-height: 1.45; color: var(--ui-text-muted); transform: rotate(-1deg); }

.pills { display: flex; justify-content: space-between; gap: 10px; margin-top: 30px; }
.pill { display: inline-flex; align-items: center; min-height: 40px; padding: 0 16px; border: 1px solid var(--ui-text); border-radius: 999px; font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.04em; color: var(--ui-text); text-decoration: none; }
.pill.ink { background: var(--ui-text); color: var(--ui-bg); }

.bubble { position: absolute; z-index: 5; right: 12px; width: min(300px, calc(100% - 24px)); display: grid; gap: 8px; padding: 10px 12px; background: var(--ui-bg-elevated); border: 1px solid var(--ui-border); border-radius: 12px; box-shadow: 0 14px 30px -14px rgb(0 0 0 / 0.55); pointer-events: none; }
.bubble.pinned { pointer-events: auto; }
.bubble::before { content: ''; position: absolute; top: -7px; right: 18px; width: 12px; height: 12px; background: var(--ui-bg-elevated); border-left: 1px solid var(--ui-border); border-top: 1px solid var(--ui-border); transform: rotate(45deg); }
.grown { display: flex; gap: 8px; align-items: baseline; }
.grown b { flex: none; font-family: var(--hand); font-size: 14px; font-weight: 400; color: var(--ui-text-dimmed); }
.grown.in b { color: var(--terracotta); }
.grown.out b { color: var(--slate); }
.grown span { display: grid; gap: 1px; font-family: var(--font-mono); font-size: 12px; color: var(--ui-text); }
.grown small { font-family: var(--font-sans); font-size: 11.5px; line-height: 1.4; color: var(--ui-text-dimmed); }
.grown em { display: block; font-style: normal; font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ui-text-muted); }
.grown.in em { color: var(--terracotta); }
.grown.out em { color: var(--slate); }
.hint { margin: 8px 0 0; font-size: 14px; color: var(--ui-text-dimmed); }
.line[tabindex] { cursor: pointer; outline: none; }
.deeper { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; margin-top: 24px; padding-top: 12px; border-top: 1px dashed var(--ui-border); font-size: 13px; }
.deeper span { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ui-text-dimmed); }
.deeper a { color: var(--ui-primary); }
</style>
