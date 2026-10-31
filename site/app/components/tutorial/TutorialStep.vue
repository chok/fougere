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
const variesByManager = computed(() => new Set(Object.values(props.step.tryIt?.said ?? {})).size > 1);

const lit = ref<{ keys: string[]; line?: string } | null>(null);
const isLit = (keys: string[], id: string) =>
  lit.value !== null && (lit.value.line === id || keys.some((key) => lit.value!.keys.includes(key)));
/** On a wide screen, what grew from the line pointed at — a bubble in the column, at that line's height. */
const column = ref<HTMLElement | null>(null);
const bubble = ref<{ grows: Step['grows']; top: number } | null>(null);
function point(event: Event, keys: string[], id: string) {
  lit.value = keys.length ? { line: id, keys } : null;
  if (!keys.length || !column.value) return;
  const top = (event.currentTarget as HTMLElement).getBoundingClientRect().top - column.value.getBoundingClientRect().top;
  bubble.value = { grows: props.step.grows.filter((one) => keys.includes(one.key)), top };
}
function release() {
  lit.value = null;
  bubble.value = null;
}

/** The file open in the editor: the first this step touched, until the reader opens another. */
// A manifest opens on demand, never first: what it gained is the install line above.
const touched = computed(() => props.step.code.filter((file) => file.state && !file.path.endsWith('package.json')));
const opened = ref<string | undefined>(touched.value[0]?.path);
watch(() => props.step.step, () => { opened.value = touched.value[0]?.path; });
const open = (path: string) => {
  if (props.step.code.some((file) => file.path === path)) opened.value = path;
};
/** On a phone the list stands in for the bubble: choosing an item opens the file its line is in. */
const openKey = (key: string) => {
  const file = props.step.code.find((one) => one.lines.some((line) => line.keys.includes(key)));
  if (file) opened.value = file.path;
};

const lineKeys = (key: string) => props.step.code.flatMap((file, f) =>
  file.lines.flatMap((line, l) => (line.keys.includes(key) ? [`${f}:${l}`] : [])));

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
    for (const file of node.files) rows.push({ depth, name: file.name, dir: false, state: file.state, path: file.path });
    for (const [name, child] of node.dirs) {
      rows.push({ depth, name: `${name}/`, dir: true, state: '' });
      walk(child, depth + 1);
    }
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
  if (event.key === 'ArrowLeft' && previous.value) navigateTo(previous.value.path);
  if (event.key === 'ArrowRight' && next.value) navigateTo(next.value.path);
}
onMounted(() => addEventListener('keydown', onKey));
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
          <div class="managers" role="tablist" aria-label="Package manager">
            <button v-for="(name, index) in managers" :key="name" type="button" role="tab"
              :aria-selected="manager === name" @click="choose(index)">{{ name }}</button>
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
          <div v-if="step.code.length" class="pane">
            <div v-for="(file, f) in step.code" v-show="file.path === opened" :key="file.path" class="card">
            <div class="path">{{ file.path }}</div>
            <div
              v-for="(line, l) in file.lines"
              :key="l"
              class="line"
              :class="{ added: line.added, on: isLit(line.keys, `${f}:${l}`) }"
              :tabindex="line.keys.length ? 0 : undefined"
              @mouseenter="point($event, line.keys, `${f}:${l}`)"
              @mouseleave="release"
              @focus="point($event, line.keys, `${f}:${l}`)"
              @blur="release"
            >
              <span class="no">{{ line.added ? '+' : l + 1 }}</span>
              <code v-html="highlight(line.text) || ' '" />
              <sup v-if="line.keys.length">{{ line.keys.join(' ') }}</sup>
            </div>
          </div>
        </div>
        </div>
        <p v-if="step.grows.length" class="hand hint">point at a lettered line to see what grows from it</p>
        <div v-if="step.zero" class="stamp"><b>0</b> line changed under {{ step.zero }}</div>

        <p class="fig"><span>Fig. {{ step.step }}.</span> {{ step.fig }}</p>

        <div v-if="step.tryIt" class="slip">
          <span class="tag">Try it</span>
          <div v-if="variesByManager" class="managers" role="tablist" aria-label="Package manager">
            <button v-for="(name, index) in managers" :key="name" type="button" role="tab"
              :aria-selected="manager === name" @click="choose(index)">{{ name }}</button>
          </div>
          <pre :class="{ tabbed: variesByManager }"><span class="prompt">$</span> {{ said }}
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

      <aside ref="column" class="leaf grows">
        <div v-if="bubble" class="bubble" :style="{ top: `${bubble.top}px` }" role="tooltip">
          <div v-for="one in bubble.grows" :key="one.key" class="grown" :class="one.side">
            <b>{{ one.key }}</b>
            <span><em>{{ titleOf[one.side] }}</em>{{ one.label }}<small>{{ one.detail }}</small></span>
          </div>
        </div>
        <h4>What grows from it</h4>
        <template v-for="[side, title] in SIDES" :key="side">
          <section v-if="step.grows.some((one) => one.side === side)" class="side">
            <h5 :class="side">{{ title }}</h5>
            <button
              v-for="one in step.grows.filter((g) => g.side === side)"
              :key="one.key"
              type="button"
              class="grown"
              :class="[side, { on: isLit([one.key], '') }]"
              @mouseenter="lit = { keys: [one.key], line: lineKeys(one.key)[0] }"
              @mouseleave="lit = null"
              @focus="lit = { keys: [one.key], line: lineKeys(one.key)[0] }"
              @click="openKey(one.key)"
              @blur="lit = null"
            >
              <b>{{ one.key }}</b>
              <span>{{ one.label }}<small>{{ one.detail }}</small></span>
            </button>
          </section>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.tutorial {
  --terracotta: #c0603a;
  --saffron: #a0701c;
  --slate: #4a6b8c;
  --code: #10180f;
  --hand: 'Architects Daughter', 'Bradley Hand', cursive;
}
.rail {
  list-style: none;
  margin: 0 0 28px;
  padding: 0 0 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
  border-bottom: 1px solid var(--ui-text);
}
.rail a {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #8a948c;
  text-decoration: none;
}
.rail i { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #9aa39b; transition: all 0.3s; }
.rail .done i { background: var(--color-fern-100); border-color: var(--ui-primary); }
.rail .on a { color: var(--ui-text); }
.rail .on i { background: var(--ui-primary); border-color: var(--ui-primary); transform: scale(1.3); }

.leaves { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 880px) minmax(0, 1fr); gap: 32px; align-items: start; }
.leaves > .center { grid-column: 2; }
.leaves > .grows { grid-column: 3; }
/* Too narrow for the code to sit centred with the bubble beside it: the bubble keeps a column of its own. */
@media (max-width: 1360px) {
  .leaves { grid-template-columns: minmax(0, 1fr) 220px; gap: 48px; }
  .leaves > .center { grid-column: 1; }
  .leaves > .grows { grid-column: 2; }
}
/* On a phone the leaves stack in reading order: the title, the project, what was written, what grew, then on. */
@media (max-width: 1024px) {
  .leaves { display: flex; flex-direction: column; align-items: stretch; }
  .center { display: contents; }
  .center h1, .lede { order: 1; }
  .ide, .hint, .stamp, .fig, .slip, .what-if { order: 3; }
  .grows { order: 4; }
  .deeper { order: 5; }
  .pills { order: 6; }
  .leaves > *, .ide, .card, .slip, .slip pre { min-width: 0; max-width: 100%; }
  .ide { grid-template-columns: minmax(0, 1fr); }
  .lede { margin-top: -18px; }
}
.leaf {
  position: sticky;
  top: 88px;
  min-width: 0;
  padding: 16px 16px 18px;
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
  border-radius: 14px;
  box-shadow: 0 1px 0 var(--ui-border), 0 10px 24px -18px rgb(40 50 30 / 0.35);
}
@media (max-width: 1024px) { .leaf { position: static; } }
.leaf h4 { margin: 0 0 12px; font-family: var(--font-serif); font-style: italic; font-weight: 400; font-size: 17px; color: var(--ui-text); }

.explorer {
  --kraft: #efe4cb;
  --kraft-ink: #5a4627;
  --kraft-rule: rgb(120 88 40 / 0.11);
  --kraft-guide: rgb(120 88 40 / 0.22);
  background: var(--kraft);
}
:global(.dark) .explorer { --kraft: #2b251b; --kraft-ink: #d8c9a8; --kraft-rule: rgb(230 200 140 / 0.06); --kraft-guide: rgb(230 200 140 / 0.14); }
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
.lede { margin: 6px 0 0; max-width: 60ch; color: var(--ui-text-muted); }

.ide { display: grid; grid-template-columns: 224px minmax(0, 1fr); margin-top: 34px; border: 1px solid rgb(120 88 40 / 0.22); border-radius: 12px; overflow: hidden; box-shadow: 0 14px 30px -24px rgb(40 50 30 / 0.5); }
.explorer { padding: 14px 10px 12px; }
.pane { min-width: 0; background: var(--code); }
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
.slip .tag { position: absolute; top: -11px; left: 14px; padding: 3px 10px; border-radius: 999px; background: var(--ui-primary); color: var(--ui-bg); font-family: var(--font-sans); font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }
.slip pre { margin: 0; padding: 18px 16px 14px; overflow-x: auto; background: var(--code); color: #d9e4da; border-radius: 10px; font-size: 12.5px; line-height: 1.7; }
.slip .prompt { color: #7fc488; }
.slip pre.tabbed { padding-top: 40px; }
.managers { position: absolute; top: 8px; right: 10px; display: flex; gap: 2px; }
.slip.install { margin: 40px 0 6px; }
.managers button { cursor: pointer; padding: 2px 8px; border-radius: 999px; font-family: var(--font-mono); font-size: 11px; color: #7f927f; }
.managers button[aria-selected="true"] { background: #1b3320; color: #d9e4da; }
.slip .output { color: #7f927f; }
.what-if { margin: 16px 0 0; font-size: 16px; line-height: 1.45; color: var(--ui-text-muted); transform: rotate(-1deg); }

.pills { display: flex; justify-content: space-between; gap: 10px; margin-top: 30px; }
.pill { display: inline-flex; align-items: center; min-height: 40px; padding: 0 16px; border: 1px solid var(--ui-text); border-radius: 999px; font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.04em; color: var(--ui-text); text-decoration: none; }
.pill.ink { background: var(--ui-text); color: var(--ui-bg); }

.grows h5 { margin: 14px 0 6px; font-family: var(--font-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; }
.grows .side:first-of-type h5 { margin-top: 0; }
/* On a wide screen the column holds nothing but the bubble of the line pointed at; a phone lists everything. */
@media (min-width: 1025px) {
  .grows { position: relative; align-self: stretch; padding: 0; background: none; border: 0; box-shadow: none; }
  .grows > h4, .grows .side { display: none; }
}
@media (max-width: 1024px) { .bubble, .hint { display: none; } }
.bubble { position: absolute; left: -12px; width: 220px; display: grid; gap: 7px; padding: 9px 11px; background: var(--ui-bg-elevated); border: 1px solid var(--ui-border); border-radius: 12px; box-shadow: 0 12px 28px -16px rgb(40 50 30 / 0.45); transform: translateY(-14px); }
.bubble::before { content: ''; position: absolute; top: 18px; left: -7px; width: 12px; height: 12px; background: var(--ui-bg-elevated); border-left: 1px solid var(--ui-border); border-bottom: 1px solid var(--ui-border); transform: rotate(45deg); }
.bubble .grown { padding: 0; gap: 7px; }
.bubble .grown b { font-size: 13px; }
.bubble .grown span { font-size: 11.5px; }
.bubble .grown small { font-size: 11px; line-height: 1.4; }
.bubble .grown em { font-size: 9.5px; }
.grown em { display: block; font-style: normal; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ui-text-muted); }
.grown.in em { color: var(--terracotta); }
.grown.out em { color: var(--slate); }
.hint { margin: 8px 0 0; font-size: 14px; color: var(--ui-text-dimmed); }
.line[tabindex] { cursor: help; outline: none; }
.grows h5.in { color: var(--terracotta); }
.grows h5.out { color: var(--slate); }
.grows h5.refuses { color: var(--ui-text-muted); }
.grown { display: flex; gap: 10px; align-items: baseline; width: 100%; padding: 4px 8px; border: 0; border-radius: 6px; background: transparent; text-align: left; cursor: default; transition: background 0.2s; }
.grown.on { background: var(--ui-bg-muted); }
.grown b { flex: none; font-family: var(--hand); font-size: 15px; font-weight: 400; color: var(--ui-text-dimmed); }
.grown.in b { color: var(--terracotta); }
.grown.out b { color: var(--slate); }
.grown span { display: grid; gap: 1px; font-family: var(--font-mono); font-size: 12.5px; color: var(--ui-text); }
.grown small { font-family: var(--font-sans); font-size: 12px; color: var(--ui-text-dimmed); }
.deeper { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; margin-top: 24px; padding-top: 12px; border-top: 1px dashed var(--ui-border); font-size: 13px; }
.deeper span { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ui-text-dimmed); }
.deeper a { color: var(--ui-primary); }
</style>
