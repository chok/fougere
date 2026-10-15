<script setup lang="ts">
import Marble from '~/story/marble';
import Globe from '~/story/globe';
import { fernFrame } from '~/story/fern';
import { ANCHORS, chapterAt, phasesAt, progressOf } from '~/story/timeline';

const { t, te } = useI18n();
const localePath = useLocalePath();

const codeSnippet = `// fronds/blog/services/Moderation.ts
export default abstract class Moderation {
  abstract canPublish(text: string): Promise<boolean>;
}

// fronds/blog/services/KeywordModeration.ts
export default class KeywordModeration extends Moderation { … }

// fronds/blog/handlers/CommentHandler.ts
export default class CommentHandler {
  constructor(private moderation: Moderation) {}

  async canPublish(text: string) {
    return this.moderation.canPublish(text);
  }
}`;

const schemaSnippet = `// fronds/blog/entities/Post.ts
export default class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  body: text(),
  status: readOnly(oneOf('draft', 'published')),
}) {}

// fronds/blog/handlers/PostHandler.ts
export default class PostHandler {
  async publish(id: Post['id']) { … }
}`;

const derivationSnippet = `class PostHandler extends Crud(Post)  // five CRUD operations
POST /api/blog/posts                  // the API, validated
useFormFor(Post)                      // the form, validated first
posts (title, body, …)                // the table

// GraphQL, or any adapter that reads an entity's schema`;

const choicesSnippet = `// fougere.config.ts
fronds: { blog: 'http://127.0.0.1:4100' },
ports: { Moderation: 'ManualModeration' },`;

const { data: highlighted } = await useAsyncData('home-code', async () => {
  const { highlight } = await import('~/home/code');
  const snippets = { code: codeSnippet, schema: schemaSnippet, derivation: derivationSnippet, choices: choicesSnippet };
  const rendered = await Promise.all(Object.entries(snippets).map(async ([key, code]) => [key, await highlight(code)] as const));

  return Object.fromEntries(rendered) as Record<string, string>;
});

interface Clip {
  src: string;
  wide: string;
  label: string;
  caption: string;
}

const chapters = computed(() => [
  { key: 'code', code: codeSnippet, doc: '/docs/guides/business-logic' },
  { key: 'schema', code: schemaSnippet, doc: '/docs/guides/data' },
  { key: 'derivation', code: derivationSnippet, doc: '/docs/guides/data#forms', legend: true, clip: { src: '/home/derivation.mp4', wide: '/home/derivation-wide.mp4', label: t('home.derivationVideo'), caption: t('home.derivationCaption') } },
  { key: 'choices', code: choicesSnippet, doc: '/docs/guides/config', clip: { src: '/home/gradient.mp4', wide: '/home/gradient-wide.mp4', label: t('home.choicesVideo'), caption: t('home.choicesCaption') } },
  { key: 'rule', doc: '/docs/concepts/philosophy' },
].map((chapter) => ({
  ...chapter,
  docLabel: t(`home.${chapter.key}Doc`),
  label: t(`home.${chapter.key}Label`),
  title: t(`home.${chapter.key}Title`),
  accent: t(`home.${chapter.key}Accent`),
  after: te(`home.${chapter.key}After`) ? t(`home.${chapter.key}After`) : '',
  text: t(`home.${chapter.key}Text`),
})));

const rail = computed(() => ['railCode', 'railSchema', 'railDerivation', 'railChoices', 'railRule'].map((key) => t(`home.${key}`)));

const story = ref<HTMLElement>();
const stage = ref<HTMLElement>();
const marbleCanvas = ref<HTMLCanvasElement>();
const backCanvas = ref<HTMLCanvasElement>();
const frontCanvas = ref<HTMLCanvasElement>();
const fernOutline = ref<SVGPathElement>();
const fernFill = ref<SVGPathElement>();
const fernPlate = ref<SVGImageElement>();
const fernLayer = ref<SVGSVGElement>();

const chapter = ref(0);
const playing = ref<Clip>();

function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'instant' });
}

const range = () => story.value!.offsetHeight - stage.value!.clientHeight;
const sticksAt = () => parseFloat(getComputedStyle(stage.value!).top);
const scrollFor = (progress: number) => story.value!.getBoundingClientRect().top + window.scrollY - sticksAt() + range() * progress;

function reach(anchor: string) {
  window.scrollTo({ top: scrollFor(progressOf(anchor)!), behavior: 'smooth' });
}

let frame = 0;

onMounted(() => {
  const marble = Marble.on(marbleCanvas.value!);
  const globe = new Globe(backCanvas.value!, frontCanvas.value!);
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const started = performance.now();
  const linked = progressOf(location.hash.slice(1));
  if (linked !== undefined) window.scrollTo({ top: scrollFor(linked), behavior: 'instant' });
  let shown = linked ?? 0;
  let previous = started;

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    const bounds = story.value!.getBoundingClientRect();
    const height = stage.value!.clientHeight;
    const width = stage.value!.clientWidth;
    const scrolled = Math.min(Math.max((stage.value!.getBoundingClientRect().top - bounds.top) / (bounds.height - height), 0), 1);
    shown += (scrolled - shown) * (1 - Math.exp(-(now - previous) / 200));
    previous = now;
    const phase = phasesAt(shown);
    const reached = chapterAt(shown);
    if (reached !== chapter.value) {
      chapter.value = reached;
      if (bounds.bottom > height + sticksAt()) {
        const anchor = reached >= 1 ? `#${ANCHORS[reached - 1]}` : '';
        history.replaceState(history.state, '', `${location.pathname}${location.search}${anchor}`);
      }
    }

    const narrow = width < 760;
    const ratio = Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 2);
    const unit = narrow ? Math.min(height, width * 1.25) : height;
    const center: [number, number] = [narrow ? 0 : Math.min((width / height) * 0.5 - 0.42, 0.3), narrow ? 0.27 : 0];
    const time = still ? 0 : (now - started) / 1000;

    const fern = fernFrame(
      { x: narrow ? width / 2 : width * 0.26, y: narrow ? height * 0.28 : height / 2 },
      { x: width / 2 + center[0] * unit, y: height / 2 - center[1] * unit },
      narrow ? height * 0.4 : Math.min(height * 0.8, 700),
      0.15 * unit,
      phase.travel,
      phase.morph,
      height * 0.06,
    );
    fernOutline.value!.setAttribute('d', fern.outline);
    fernFill.value!.setAttribute('d', fern.outline);
    fernFill.value!.setAttribute('opacity', String(phase.fill));
    for (const [name, value] of Object.entries({ x: fern.x, y: fern.y, width: fern.width, height: fern.height, opacity: phase.plate })) {
      fernPlate.value!.setAttribute(name, String(value));
    }
    fernLayer.value!.style.opacity = String(phase.fern);

    marble?.draw({ unit, time, center, appear: phase.appear, schema: phase.schema, fusion: phase.fusion, globe: phase.globe, split: phase.split }, ratio);
    globe.draw({ unit, time, center, marble: phase.marble, sphere: phase.sphere, wound: phase.wound, split: phase.split, lines: phase.lines }, ratio);
  };
  frame = requestAnimationFrame(tick);
});

onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <div class="story-page">
    <section ref="story" class="story">
      <div ref="stage" class="stage">
        <canvas ref="backCanvas" class="layer" aria-hidden="true" />
        <canvas ref="marbleCanvas" class="layer" aria-hidden="true" />
        <canvas ref="frontCanvas" class="layer" aria-hidden="true" />
        <svg ref="fernLayer" class="layer" aria-hidden="true">
          <defs>
            <clipPath id="fern-outline"><path ref="fernOutline" /></clipPath>
          </defs>
          <path ref="fernFill" fill="#8fa152" opacity="0" />
          <image ref="fernPlate" href="/home/fern.png" preserveAspectRatio="none" clip-path="url(#fern-outline)" />
        </svg>

        <div class="hero" :class="{ off: chapter !== 0 }">
          <h1>
            <i18n-t keypath="home.slogan" scope="global">
              <template #code><em>{{ $t('home.sloganCode') }}</em></template>
              <template #later><em>{{ $t('home.sloganLater') }}</em></template>
            </i18n-t>
          </h1>
          <p class="plate">
            <span>{{ $t('home.plateName') }}</span>
            {{ $t('home.plateCredit') }}
          </p>
        </div>

        <div class="chapters">
          <article v-for="(item, index) in chapters" :key="item.key" class="chapter" :class="{ on: chapter === index + 1 }">
            <p class="label">{{ item.label }}</p>
            <h2>{{ item.title }} <em :class="item.key">{{ item.accent }}</em>{{ item.after && ` ${item.after}` }}</h2>
            <p class="text">{{ item.text }}</p>
            <HomeCode v-if="item.code" class="snippet" :code="item.code" :html="highlighted?.[item.key]" />
            <div v-if="item.legend" class="legend">
              <span><i class="calls" />{{ $t('home.derivationCalls') }}</span>
              <span><i class="called" />{{ $t('home.derivationCalled') }}</span>
            </div>
            <div class="more">
              <button v-if="item.clip" type="button" class="play" @click="playing = item.clip">
                <UIcon name="i-lucide-circle-play" class="play-icon" />
                {{ item.clip.label }}
              </button>
              <NuxtLink :to="localePath(item.doc)" class="doc">{{ item.docLabel }} →</NuxtLink>
            </div>
          </article>
        </div>

        <ol class="rail" :class="{ off: chapter < 1 }">
          <li v-for="(name, index) in rail" :key="name" :class="{ on: Math.max(chapter, 1) === index + 1 }">
            <button type="button" @click="reach(ANCHORS[index]!)">{{ name }}<i /></button>
          </li>
        </ol>

        <div class="shortcuts" :class="{ started: chapter >= 1 }">
          <NuxtLink :to="localePath('/docs/existing-app#ask-your-agent')">{{ $t('home.tryAgent') }}</NuxtLink>
          <button type="button" @click="jump('try')">{{ $t('home.skip') }}</button>
        </div>
        <p v-if="chapter === 0" class="hint">{{ $t('home.scroll') }}<br>↓</p>
      </div>
    </section>


    <div v-if="playing" class="clip" @click="playing = undefined">
      <figure @click.stop>
        <video autoplay controls playsinline>
          <source :src="playing.wide" media="(min-aspect-ratio: 4/3)" type="video/mp4">
          <source :src="playing.src" type="video/mp4">
        </video>
        <figcaption>{{ playing.caption }}</figcaption>
        <button type="button" @click="playing = undefined">{{ $t('home.close') }}</button>
      </figure>
    </div>
  </div>
</template>

<style scoped>
.story-page {
  --paper: var(--ui-bg);
  --ink: var(--ui-text);
  --muted: var(--ui-text-muted);
  --green: var(--ui-primary);
  --terracotta: #c0603a;
  --saffron: #a0701c;
  --slate: #4a6b8c;
  --code: #10180f;
  --header: 3.5rem;
  --gutter: max(1.5rem, calc((100% - 72rem) / 2 + 1.5rem));
  background: var(--paper);
  color: var(--ink);
  font-size: 17px;
  line-height: 1.6;
}

h1, h2 {
  margin: 0;
}

h1 em, h2 em {
  font-style: italic;
  color: var(--green);
}

h2 em.schema { color: var(--saffron); }

h2 em.code { display: block; }

.snippet {
  margin-top: 22px;
  max-width: 580px;
}

.story {
  position: relative;
  height: 650vh;
}

.stage {
  position: sticky;
  top: var(--header);
  height: calc(100svh - var(--header));
  overflow: hidden;
}

.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
}

.hero {
  position: absolute;
  left: 46%;
  right: var(--gutter);
  top: 50%;
  transform: translateY(-50%);
  transition: opacity 0.45s ease;
}

.hero h1 {
  font-size: clamp(34px, 4.1vw, 60px);
  line-height: 1.04;
}

.plate {
  margin: 28px 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--ink);
  max-width: 340px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  color: var(--muted);
}

.plate span {
  display: block;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 18px;
  color: var(--ink);
}

.off {
  opacity: 0;
  pointer-events: none;
}

.chapters {
  position: absolute;
  left: var(--gutter);
  top: 0;
  bottom: 0;
  width: min(600px, calc(100% - 32px));
}

.chapter {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-44%);
  opacity: 0;
  transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
  pointer-events: none;
}

.chapter.on {
  opacity: 1;
  transform: translateY(-50%);
  pointer-events: auto;
}

.label {
  margin: 0 0 14px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--green);
}

.chapter h2 {
  font-size: clamp(30px, 3.6vw, 48px);
  line-height: 1.06;
}

.text {
  margin: 18px 0 0;
  max-width: 580px;
  font-size: 18px;
  color: var(--muted);
}

.legend {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 14px;
  color: var(--muted);
}

.legend span {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend i {
  width: 22px;
  height: 3px;
  border-radius: 2px;
}

.legend .calls { background: var(--terracotta); }
.legend .called { background: var(--slate); }

.more {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
}

.play {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px 10px 16px;
  border-radius: 999px;
  border: 1.5px solid var(--ink);
  background: var(--ink);
  color: var(--paper);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}

.doc {
  font-size: 15px;
  color: var(--muted);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.doc:hover {
  color: var(--ink);
}

.play-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.rail {
  position: absolute;
  right: var(--gutter);
  top: 50%;
  transform: translateY(-50%);
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: opacity 0.45s ease;
}

.rail button {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #8a948c;
  background: none;
  border: 0;
  padding: 4px 0;
  cursor: pointer;
  transition: color 0.3s;
}

.rail button:hover { color: var(--ink); }

.rail i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid #9aa39b;
  transition: all 0.3s;
}

.rail .on button { color: var(--ink); }
.rail .on i {
  background: var(--green);
  border-color: var(--green);
  transform: scale(1.3);
}

.shortcuts {
  position: absolute;
  right: var(--gutter);
  bottom: 24px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  transition: opacity 0.4s ease;
}

.shortcuts button, .shortcuts a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid var(--ink);
  background: color-mix(in oklab, var(--paper) 85%, transparent);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: opacity 0.4s ease;
}

.hint {
  position: absolute;
  left: 50%;
  bottom: 28px;
  margin: 0 0 0 -40px;
  width: 80px;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  animation: hint 1.8s ease-in-out infinite;
}

@keyframes hint {
  0%, 100% { transform: translateY(0); opacity: 0.5; }
  50% { transform: translateY(6px); opacity: 1; }
}

.clip {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgb(16 24 15 / 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.clip figure {
  margin: 0;
  max-width: 92vw;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.clip video {
  max-width: 100%;
  max-height: 80vh;
  border-radius: 12px;
  background: #000;
}

.clip figcaption { color: #e1ebde; font-size: 14px; }

.clip button {
  align-self: flex-end;
  min-height: 44px;
  padding: 8px 18px;
  border-radius: 999px;
  border: 1px solid #e1ebde;
  background: transparent;
  color: #e1ebde;
  font: inherit;
  cursor: pointer;
}

@media (max-width: 760px) and (max-height: 700px) {
  .shortcuts.started {
    opacity: 0;
    pointer-events: none;
  }
}

@media (max-width: 760px) and (max-height: 600px) {
  .snippet, .legend { display: none; }
}

@media (max-width: 760px) {
  .hero {
    left: 16px;
    right: 16px;
    top: auto;
    bottom: 12%;
    transform: none;
  }

  .chapters {
    top: auto;
    height: 52%;
    left: 16px;
    right: 16px;
    width: auto;
  }

  .chapter {
    top: auto;
    bottom: 20px;
    transform: translateY(24px);
  }

  .chapter.on { transform: none; }

  .chapter h2 { font-size: 28px; }

  .text {
    margin-top: 12px;
    font-size: 16px;
  }

  .snippet :deep(pre) {
    font-size: 11.5px;
    padding: 12px 44px 12px 14px;
  }

  .rail, .hint { display: none; }

  .shortcuts {
    top: 12px;
    bottom: auto;
    left: 16px;
    right: 16px;
    justify-content: center;
  }

  .shortcuts button, .shortcuts a {
    padding: 8px 12px;
    font-size: 11px;
  }
}
</style>
