<script setup lang="ts">
import { PackageManager } from '@fougere/cli/package-manager';

/**
 * One step of the tutorial in three leaves: the project as it grew, what this step wrote, and
 * what grew from it. A letter on the right is repeated at the end of the line that produced it,
 * and hovering either lights both — the cause and the effect read in one glance.
 */
interface Line { text: string; added: boolean; keys: string[] }
interface Step {
  step: number; name: string; heading: string; lede: string; fig: string;
  files: { path: string; state: string }[];
  code: { path: string; lines: Line[] }[];
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

const lit = ref<{ key?: string; line?: string } | null>(null);
const isLit = (keys: string[], id: string) =>
  lit.value !== null && (lit.value.line === id || (lit.value.key !== undefined && keys.includes(lit.value.key)));
const lineKeys = (key: string) => props.step.code.flatMap((file, f) =>
  file.lines.flatMap((line, l) => (line.keys.includes(key) ? [`${f}:${l}`] : [])));

const heading = computed(() =>
  props.step.heading.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`).replace(/\*([^*]+)\*/g, '<em>$1</em>'));

/** The files as a tree, folders first in reading order, each file with what this step did to it. */
const tree = computed(() => {
  type Node = { dirs: Map<string, Node>; files: { name: string; state: string }[] };
  const root: Node = { dirs: new Map(), files: [] };
  for (const { path, state } of props.step.files) {
    const parts = path.split('/');
    const name = parts.pop()!;
    let node = root;
    for (const part of parts) {
      if (!node.dirs.has(part)) node.dirs.set(part, { dirs: new Map(), files: [] });
      node = node.dirs.get(part)!;
    }
    node.files.push({ name, state });
  }
  const rows: { depth: number; name: string; dir: boolean; state: string }[] = [];
  const walk = (node: Node, depth: number) => {
    for (const file of node.files) rows.push({ depth, name: file.name, dir: false, state: file.state });
    for (const [name, child] of node.dirs) {
      rows.push({ depth, name: `${name}/`, dir: true, state: '' });
      walk(child, depth + 1);
    }
  };
  walk(root, 0);

  return rows;
});

const SIDES = [['in', 'Incoming'], ['out', 'Outgoing'], ['refuses', 'Refuses']] as const;
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
        <NuxtLink :to="one.path"><i /><span>{{ one.step }}</span>{{ one.name }}</NuxtLink>
      </li>
    </ol>

    <div class="leaves" :class="{ lit: lit !== null }">
      <aside class="leaf project">
        <h4>Your project</h4>
        <div
          v-for="(row, r) in tree"
          :key="r"
          class="file"
          :class="[row.state, { dir: row.dir }]"
          :style="{ paddingLeft: `${row.depth * 14}px` }"
        >
          <i v-if="!row.dir" />{{ row.name }}<small v-if="row.state">{{ row.state }}</small>
        </div>
        <div class="legend"><span class="new"><i />new</span><span class="changed"><i />changed</span><span class="moved"><i />moved</span></div>
      </aside>

      <div class="center">
        <p class="label">Step {{ step.step }} — {{ step.name }}</p>
        <h1 v-html="heading" />
        <p class="lede">{{ step.lede }}</p>

        <div v-if="install" class="slip install">
          <span class="hand">install</span>
          <div class="managers" role="tablist" aria-label="Package manager">
            <button v-for="(name, index) in managers" :key="name" type="button" role="tab"
              :aria-selected="manager === name" @click="choose(index)">{{ name }}</button>
          </div>
          <pre class="tabbed"><span class="prompt">$</span> {{ install }}</pre>
        </div>

        <div class="cards">
          <div v-for="(file, f) in step.code" :key="file.path" class="card">
            <div class="path">{{ file.path }}</div>
            <div
              v-for="(line, l) in file.lines"
              :key="l"
              class="line"
              :class="{ added: line.added, on: isLit(line.keys, `${f}:${l}`) }"
              @mouseenter="lit = line.keys.length ? { line: `${f}:${l}`, key: line.keys[0] } : null"
              @mouseleave="lit = null"
            >
              <span class="no">{{ line.added ? '+' : l + 1 }}</span>
              <code v-html="highlight(line.text) || ' '" />
              <sup v-if="line.keys.length">{{ line.keys.join(' ') }}</sup>
            </div>
          </div>
        </div>
        <div v-if="step.zero" class="stamp"><b>0</b> line changed under {{ step.zero }}</div>

        <p class="fig"><span>Fig. {{ step.step }}.</span> {{ step.fig }}</p>

        <div v-if="step.tryIt" class="slip">
          <span class="hand">try it</span>
          <div v-if="variesByManager" class="managers" role="tablist" aria-label="Package manager">
            <button v-for="(name, index) in managers" :key="name" type="button" role="tab"
              :aria-selected="manager === name" @click="choose(index)">{{ name }}</button>
          </div>
          <pre :class="{ tabbed: variesByManager }"><span class="prompt">$</span> {{ said }}
<span class="output">{{ step.tryIt.output }}</span></pre>
        </div>
        <p v-if="step.whatIf" class="hand what-if">what if — {{ step.whatIf }}</p>

        <nav class="pills">
          <NuxtLink v-if="previous" :to="previous.path" class="pill">← {{ previous.name }}</NuxtLink>
          <span v-else />
          <NuxtLink v-if="next" :to="next.path" class="pill ink">{{ next.name }} →</NuxtLink>
          <NuxtLink v-else to="/docs" class="pill ink">Read the docs →</NuxtLink>
        </nav>
      </div>

      <aside class="leaf grows">
        <h4>What grows from it</h4>
        <template v-for="[side, title] in SIDES" :key="side">
          <template v-if="step.grows.some((one) => one.side === side)">
            <h5 :class="side">{{ title }}</h5>
            <button
              v-for="one in step.grows.filter((g) => g.side === side)"
              :key="one.key"
              type="button"
              class="grown"
              :class="[side, { on: isLit([one.key], '') }]"
              @mouseenter="lit = { key: one.key, line: lineKeys(one.key)[0] }"
              @mouseleave="lit = null"
              @focus="lit = { key: one.key, line: lineKeys(one.key)[0] }"
              @blur="lit = null"
            >
              <b>{{ one.key }}</b>
              <span>{{ one.label }}<small>{{ one.detail }}</small></span>
            </button>
          </template>
        </template>
        <div class="deeper">
          <span>Go deeper</span>
          <NuxtLink v-for="link in step.links" :key="link.path" :to="link.path">{{ link.title }}</NuxtLink>
        </div>
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
.rail a span { color: var(--ui-text-dimmed); }
.rail i { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #9aa39b; transition: all 0.3s; }
.rail .done i { background: var(--color-fern-100); border-color: var(--ui-primary); }
.rail .on a { color: var(--ui-text); }
.rail .on i { background: var(--ui-primary); border-color: var(--ui-primary); transform: scale(1.3); }

.leaves { display: grid; grid-template-columns: 220px minmax(0, 1fr) 290px; gap: 26px; align-items: start; }
/* On a phone the leaves stack in reading order: the title, the project, what was written, what grew, then on. */
@media (max-width: 1024px) {
  .leaves { display: flex; flex-direction: column; align-items: stretch; }
  .center { display: contents; }
  .label, .center h1, .lede { order: 1; }
  .project { order: 2; }
  .cards, .stamp, .fig, .slip, .what-if { order: 3; }
  .grows { order: 4; }
  .pills { order: 5; }
  .leaves > *, .cards, .card, .slip, .slip pre { min-width: 0; max-width: 100%; }
  .label { margin-bottom: -18px; }
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

.file { display: flex; align-items: center; gap: 7px; font-family: var(--font-mono); font-size: 12px; line-height: 1.9; color: var(--ui-text-muted); white-space: nowrap; }
.file.dir { color: var(--ui-text-dimmed); padding-left: 13px; }
.file i { width: 6px; height: 6px; border-radius: 50%; background: var(--ui-border-accented); flex: none; }
.file small { font-family: var(--hand); font-size: 12.5px; color: var(--ui-text-dimmed); }
.file.new, .file.changed { color: var(--ui-text); }
.file.new i, .legend .new i { background: var(--ui-primary); }
.file.changed i, .legend .changed i { background: var(--saffron); }
.file.moved i, .legend .moved i { background: var(--slate); }
.legend { display: flex; gap: 12px; margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--ui-border); font-size: 11.5px; color: var(--ui-text-dimmed); }
.legend span { display: inline-flex; gap: 5px; align-items: center; }
.legend i { width: 6px; height: 6px; border-radius: 50%; }

.center { min-width: 0; }
.label { margin: 0; font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ui-primary); }
.center h1 { margin: 8px 0 6px; font-size: clamp(28px, 3.4vw, 42px); line-height: 1.1; }
.center h1 :deep(em) { font-style: italic; color: var(--ui-primary); }
.lede { margin: 0; max-width: 60ch; color: var(--ui-text-muted); }

.cards { display: grid; gap: 12px; margin-top: 20px; }
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

.slip { position: relative; margin-top: 28px; }
.hand { font-family: var(--hand); }
.slip .hand { position: absolute; top: -14px; left: 14px; padding: 0 6px; background: var(--ui-bg); font-size: 17px; color: var(--ui-text-muted); transform: rotate(-2deg); }
.slip pre { margin: 0; padding: 18px 16px 14px; overflow-x: auto; background: var(--code); color: #d9e4da; border-radius: 10px; font-size: 12.5px; line-height: 1.7; }
.slip .prompt { color: #7fc488; }
.slip pre.tabbed { padding-top: 40px; }
.managers { position: absolute; top: 8px; right: 10px; display: flex; gap: 2px; }
.slip.install { margin: 22px 0 6px; }
.managers button { cursor: pointer; padding: 2px 8px; border-radius: 999px; font-family: var(--font-mono); font-size: 11px; color: #7f927f; }
.managers button[aria-selected="true"] { background: #1b3320; color: #d9e4da; }
.slip .output { color: #7f927f; }
.what-if { margin: 16px 0 0; font-size: 16px; line-height: 1.45; color: var(--ui-text-muted); transform: rotate(-1deg); }

.pills { display: flex; justify-content: space-between; gap: 10px; margin-top: 30px; }
.pill { display: inline-flex; align-items: center; min-height: 40px; padding: 0 16px; border: 1px solid var(--ui-text); border-radius: 999px; font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.04em; color: var(--ui-text); text-decoration: none; }
.pill.ink { background: var(--ui-text); color: var(--ui-bg); }

.grows h5 { margin: 14px 0 6px; font-family: var(--font-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; }
.grows h5:first-of-type { margin-top: 0; }
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
.deeper { display: grid; gap: 4px; margin-top: 16px; padding-top: 12px; border-top: 1px dashed var(--ui-border); font-size: 13px; }
.deeper span { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ui-text-dimmed); }
.deeper a { color: var(--ui-primary); }
</style>
