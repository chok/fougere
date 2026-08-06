<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();

useSeoMeta({
  title: () => `Fougere — ${t('home.title')}`,
  description: () => t('home.subtitle'),
});

// Real code from this site's own blog Frond — not marketing pseudocode.
const declareSnippet = `class Post extends entity({
  id: primary(),
  slug: text({ min: 1, max: 80 }),
  title: text({ min: 1, max: 160 }),
  authorId: readOnly(text()),
  status: readOnly(oneOf('draft', 'published',
    { default: 'draft' })),
  publishedAt: readOnly(optional(date())),
}) {}`;

const judgeSnippet = `class PostHandler extends Crud(Post) {
  async publish(id: string, user: User | null) {
    if (!user) throw new FougereError({
      code: ErrorCode.UNAUTHORIZED, /* … */ });
    // Check the author and current status, then update:
    return this.orm.update(id, {
      status: 'published',
      publishedAt: new Date().toISOString(),
    });
  }
}`;

const consumeSnippet = `import Post from '@frond/blog/entities/Post';

const { items } = await useQuery(Post, 'list');
const publish = useCommand(Post, 'publish');

await publish.execute({ params: { id } });
// Queries for Post are then revalidated.`;

// Verbatim output of demos/rust-frond's TypeScript consumer — rules declared
// in Rust, enforced by the TS judge before a single byte goes on the wire.
const foreignSnippet = `$ npx tsx consumer.ts

✗ couleur  — Unknown field
✗ celsius  — 250 is greater than 80.
✗ checksum — Read-only
✗ label    — String is too short (1 < 2).`;

// The before/after: the same shape, hand-synced across a bare Nuxt app…
const glueSnippet = `// schemas/post.ts — the shape, first time
export const postSchema = z.object({
  slug: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
});

// server/db/schema.ts — the shape, again
export const posts = sqliteTable('posts', {
  slug: text('slug').notNull(),
  title: text('title').notNull(),
});

// server/api/posts.post.ts — wired by hand
const body = postSchema.parse(await readBody(event));

// app/components/PostForm.vue — the rules, again
const rules = { title: [required, maxLength(160)] };`;

// …vs an entity definition used by each integration.
const derivedSnippet = `// fronds/blog/entities/Post.ts — entity definition
class Post extends entity({
  id: primary(),
  slug: text({ min: 1, max: 80 }),
  title: text({ min: 1, max: 160 }),
}) {}

// Uses of the entity metadata:
//   validation  (browser + API facade)
//   SQLite table + additive schema sync
//   form contract   useFormFor(Post)
//   API surface     post.create / post.list
//   GraphQL type    type Post { … }`;

// One canonical prompt, English on both locales — agents read English,
// and a translated prompt would be a second truth to keep in sync.
// The doc links are built from this site's own origin — one source,
// valid wherever the site is deployed; the embedded model covers
// agents running without web access.
const origin = useRequestURL().origin;
const auditPrompt = `# Audit schema duplication in this repository

Estimate how much code repeats the same data definitions across
the application. Report migration costs as well as possible savings.

## Fougere reference

Fougere defines a business object with an entity class:

    class Post extends entity({
      id: primary(),
      slug: text({ min: 1, max: 80 }),
      title: text({ min: 1, max: 160 }),
      status: readOnly(oneOf('draft', 'published',
        { default: 'draft' })),
    }) {}

Fougere uses the entity metadata for browser and server input
validation, additive SQLite schema sync, form fields and errors,
API operations, GraphQL types, and TypeScript types. Handlers
implement server-side operations such as publish(id, user).
A Frond can run locally or be routed to a compatible JSON-RPC
host through the remotes configuration.

Current limits: Fougere is in pre-release and is not published
to npm. Storage uses additive SQLite auto-DDL through Kysely;
renames, removals, and type changes require explicit migrations.
There is no Postgres adapter or search-index integration yet.
Authentication uses better-auth for credentials and OAuth.

If you can fetch the web, ground yourself in the docs first:

- ${origin}/docs — overview
- ${origin}/docs/schema/entities — entity fields
- ${origin}/docs/client/forms — forms and validation
- ${origin}/docs/existing-app — incremental adoption

## Review this repository

1. Select three business objects that are central to the
   application and frequently changed. Explain the evidence used.
2. For each object, list every file where its fields are declared:
   validation schema (Zod/Yup/joi), DB table or migration,
   API input/output types, form state and rules, TS
   interfaces, and API-client types. Include declarations owned
   by external systems and identify their constraints.
3. Estimate the lines used only to keep those declarations aligned:
   parse/serialize, DTO mapping, hand-rolled error
   formatting, and manual refetch after mutations. Include
   committed generated output and pass-through wrappers, but
   exclude business logic and computed fields.
4. Report any concrete mismatch between declarations. If none
   is found, say so. Do not treat necessary external contracts
   as duplication that Fougere can remove.

## Report

For each object, provide a table with declaration site, file,
purpose, and estimated lines. Then report:
- code that Fougere could replace with its current feature set;
- code that would remain and why;
- unsupported requirements or migration blockers;
- a staged adoption estimate, including storage changes and
  concepts the team would need to learn.`;

const copied = ref(false);
async function copyAudit() {
  await navigator.clipboard.writeText(auditPrompt);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative">
      <div class="hero-glow" />
      <div class="max-w-6xl mx-auto px-6 pt-24 pb-16 text-center">
        <UBadge :label="$t('home.badge')" variant="subtle" color="neutral" class="mb-6" />
        <h1 class="text-4xl sm:text-6xl font-bold text-highlighted tracking-tight text-balance">
          {{ $t('home.title') }}
        </h1>
        <p class="mt-6 text-lg text-muted max-w-2xl mx-auto text-pretty">
          {{ $t('home.subtitle') }}
        </p>
        <div class="mt-8 flex items-center justify-center gap-3">
          <UButton :to="localePath('/docs/getting-started')" size="lg" :label="$t('home.ctaStart')" trailing-icon="i-lucide-arrow-right" />
          <UButton to="#audit" size="lg" variant="outline" color="neutral" :label="$t('home.ctaAudit')" />
        </div>
        <p class="mt-5 text-sm text-muted flex items-center justify-center gap-1.5">
          <UIcon name="i-lucide-file-check" class="size-4 text-muted" />
          {{ $t('home.realCode') }}
        </p>
      </div>
    </section>

    <!-- The nucleus and its projections -->
    <section class="max-w-6xl mx-auto px-6 pb-20">
      <div class="text-center mb-8">
        <h2 class="text-2xl font-bold text-highlighted">{{ $t('home.derivationTitle') }}</h2>
        <p class="mt-2 text-muted">{{ $t('home.derivationText') }}</p>
      </div>
      <DerivationDiagram />
    </section>

    <!-- Declare → Judge → Consume -->
    <section class="max-w-6xl mx-auto px-6 pb-20 grid lg:grid-cols-3 gap-6">
      <div class="flex flex-col">
        <h2 class="text-base font-semibold text-highlighted flex items-center gap-2 mb-1">
          <span class="flex items-center justify-center size-6 rounded-full bg-elevated border border-default text-highlighted font-mono text-xs">1</span>
          {{ $t('home.declareTitle') }}
        </h2>
        <p class="text-sm text-muted mb-3 lg:min-h-15">{{ $t('home.declareText') }}</p>
        <CodeWindow :code="declareSnippet" filename="fronds/blog/entities/Post.ts" lang="ts" class="flex-1" />
      </div>

      <div class="flex flex-col">
        <h2 class="text-base font-semibold text-highlighted flex items-center gap-2 mb-1">
          <span class="flex items-center justify-center size-6 rounded-full bg-elevated border border-default text-highlighted font-mono text-xs">2</span>
          {{ $t('home.judgeTitle') }}
        </h2>
        <p class="text-sm text-muted mb-3 lg:min-h-15">{{ $t('home.judgeText') }}</p>
        <CodeWindow :code="judgeSnippet" filename="fronds/blog/handlers/PostHandler.ts" lang="ts" class="flex-1" />
      </div>

      <div class="flex flex-col">
        <h2 class="text-base font-semibold text-highlighted flex items-center gap-2 mb-1">
          <span class="flex items-center justify-center size-6 rounded-full bg-elevated border border-default text-highlighted font-mono text-xs">3</span>
          {{ $t('home.consumeTitle') }}
        </h2>
        <p class="text-sm text-muted mb-3 lg:min-h-15">{{ $t('home.consumeText') }}</p>
        <CodeWindow :code="consumeSnippet" filename="app/pages/blog/index.vue" lang="ts" class="flex-1" />
      </div>
    </section>

    <!-- The gradient -->
    <section class="border-y border-default bg-elevated/40">
      <div class="max-w-6xl mx-auto px-6 py-16">
        <div class="max-w-2xl">
          <h2 class="text-2xl font-bold text-highlighted">{{ $t('home.gradientTitle') }}</h2>
          <p class="mt-3 text-muted">{{ $t('home.gradientText') }}</p>
        </div>
        <div class="mt-10 max-w-5xl mx-auto">
          <GradientDiagram />
        </div>
        <ul class="mt-8 grid sm:grid-cols-3 gap-x-8 gap-y-3 text-sm text-muted">
          <li class="flex gap-2.5"><UIcon name="i-lucide-check" class="size-4 text-primary/70 shrink-0 mt-0.5" />{{ $t('home.gradientPoint1') }}</li>
          <li class="flex gap-2.5"><UIcon name="i-lucide-check" class="size-4 text-primary/70 shrink-0 mt-0.5" />{{ $t('home.gradientPoint2') }}</li>
          <li class="flex gap-2.5"><UIcon name="i-lucide-check" class="size-4 text-primary/70 shrink-0 mt-0.5" />{{ $t('home.gradientPoint3') }}</li>
        </ul>
        <div class="mt-4 text-center">
          <UButton :to="localePath('/docs/infra/gradient')" variant="link" :label="$t('home.gradientCta')" trailing-icon="i-lucide-arrow-right" />
        </div>
      </div>
    </section>

    <!-- The far end of the gradient: a Frond that is not TypeScript at all -->
    <section class="max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
      <div>
        <h2 class="text-2xl font-bold text-highlighted">{{ $t('home.foreignTitle') }}</h2>
        <p class="mt-3 text-muted">{{ $t('home.foreignText') }}</p>
        <p class="mt-4 text-muted">{{ $t('home.foreignAxes') }}</p>
      </div>
      <div>
        <CodeWindow :code="foreignSnippet" filename="demos/rust-frond — the TS consumer's output" lang="bash" />
        <p class="mt-3 text-sm text-muted flex items-center gap-2">
          <UIcon name="i-lucide-shield-check" class="size-4 shrink-0 text-primary/70" />
          {{ $t('home.foreignCaption') }}
        </p>
      </div>
    </section>

    <!-- Proof: without the model, the shape is re-declared by hand -->
    <section class="max-w-6xl mx-auto px-6 py-16">
      <div class="max-w-2xl mb-8">
        <h2 class="text-2xl font-bold text-highlighted">{{ $t('home.compareTitle') }}</h2>
        <p class="mt-3 text-muted">{{ $t('home.compareText') }}</p>
      </div>
      <div class="grid lg:grid-cols-2 gap-6 items-start">
        <div class="flex flex-col">
          <CodeWindow :code="glueSnippet" filename="your-nuxt-app/ — 4 files" lang="ts" />
          <p class="mt-3 text-sm text-muted flex items-center gap-2">
            <UIcon name="i-lucide-copy-x" class="size-4 shrink-0" />
            {{ $t('home.compareBeforeLabel') }}
          </p>
        </div>
        <div class="flex flex-col">
          <CodeWindow :code="derivedSnippet" filename="your-fougere-app/ — 1 file" lang="ts" />
          <p class="mt-3 text-sm text-muted flex items-center gap-2">
            <UIcon name="i-lucide-git-branch" class="size-4 shrink-0 text-primary/70" />
            {{ $t('home.compareAfterLabel') }}
          </p>
        </div>
      </div>
    </section>

    <!-- Proof on your own repo: the audit prompt -->
    <section id="audit" class="border-y border-default bg-elevated/40 scroll-mt-20">
      <div class="max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-start">
        <div class="lg:sticky lg:top-24">
          <h2 class="text-2xl font-bold text-highlighted">{{ $t('home.auditTitle') }}</h2>
          <p class="mt-3 text-muted">{{ $t('home.auditText') }}</p>
          <UButton
            class="mt-6"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-clipboard-copy'"
            :label="copied ? $t('home.auditCopied') : $t('home.auditCopy')"
            :color="copied ? 'primary' : 'neutral'"
            variant="outline"
            @click="copyAudit"
          />
        </div>
        <CodeWindow :code="auditPrompt" filename="audit-prompt.md" lang="markdown" class="max-h-[34rem] overflow-y-auto" />
      </div>
    </section>

    <!-- Where it stands: pre-release, each claim seen running -->
    <section class="max-w-6xl mx-auto px-6 pt-16">
      <div class="max-w-2xl">
        <h2 class="text-2xl font-bold text-highlighted">{{ $t('home.statusTitle') }}</h2>
        <p class="mt-3 text-muted">{{ $t('home.statusText') }}</p>
      </div>
      <ul class="mt-8 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm text-muted">
        <li v-for="i in 5" :key="i" class="flex gap-2.5">
          <UIcon name="i-lucide-check" class="size-4 text-primary/70 shrink-0 mt-0.5" />{{ $t(`home.status${i}`) }}
        </li>
      </ul>
    </section>

    <!-- Numbers -->
    <section class="max-w-6xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-8 text-center">
      <div>
        <p class="text-3xl font-semibold text-highlighted tabular-nums">{{ $t('home.statAxes') }}</p>
        <p class="mt-2 text-sm text-muted text-balance">{{ $t('home.statAxesText') }}</p>
      </div>
      <div>
        <p class="text-3xl font-semibold text-highlighted tabular-nums">{{ $t('home.statTopology') }}</p>
        <p class="mt-2 text-sm text-muted text-balance">{{ $t('home.statTopologyText') }}</p>
      </div>
      <div>
        <p class="text-3xl font-semibold text-highlighted">{{ $t('home.statPrimitives') }}</p>
        <p class="mt-2 text-sm text-muted text-balance">{{ $t('home.statPrimitivesText') }}</p>
      </div>
    </section>

    <!-- Dogfood -->
    <section class="max-w-6xl mx-auto px-6 pb-20">
      <UCard>
        <div class="flex items-start gap-4">
          <UIcon name="i-noto-herb" class="size-8 shrink-0" />
          <div>
            <h2 class="text-lg font-semibold text-highlighted">{{ $t('home.dogfoodTitle') }}</h2>
            <p class="mt-2 text-sm text-muted">{{ $t('home.dogfoodText') }}</p>
          </div>
        </div>
      </UCard>
    </section>
  </div>
</template>
