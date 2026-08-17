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
    // author-only, draft-only — then realize:
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
// → every mounted query on Post revalidates`;

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

// …vs the single declaration everything derives from.
const derivedSnippet = `// fronds/blog/entities/Post.ts — the shape, once
class Post extends entity({
  id: primary(),
  slug: text({ min: 1, max: 80 }),
  title: text({ min: 1, max: 160 }),
}) {}

// Derived from it — nothing to keep in sync:
//   validation  (browser + façade, same judge)
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
const auditPrompt = `# Audit: how much schema glue does this repo maintain by hand?

You are auditing THIS repository. Be honest: report the costs
of switching as carefully as the gains.

## Reference model — Fougere, a single-schema TS framework

One class declares a business object once:

    class Post extends entity({
      id: primary(),
      slug: text({ min: 1, max: 80 }),
      title: text({ min: 1, max: 160 }),
      status: readOnly(oneOf('draft', 'published',
        { default: 'draft' })),
    }) {}

Everything derives from it — input validation (the same judge
in the browser and at the API facade, unknown keys refused),
the SQL table (additive auto-DDL; renames, removals and type
changes need an explicit migration), the form contract (fields,
rules, per-field error mapping), the API surface (post.list,
post.create...), GraphQL types, and the TS type (the class IS
the type). Business rules are handler operations, e.g.
publish(id, user), judged server-side. Moving a module to its
own process is one line of config; user code does not change.

Scope today (pre-release): storage is additive auto-DDL over
Kysely. SQLite resolves from its name; Postgres, MySQL and SQL
Server work by handing Fougere the Kysely dialect you built
(setupKysely) — only you have the driver. No search-index
projection; auth via better-auth (credentials + OAuth). Price
the adoption costs against THIS scope, not an imagined one.

If you can fetch the web, ground yourself in the docs first:

- ${origin}/docs — the model in one page
- ${origin}/docs/schema/entities — field vocabulary, the 4 axes
- ${origin}/docs/client/forms — the shared browser/facade judge
- ${origin}/docs/existing-app — the feature-by-feature migration
  path (use it to price the adoption cost honestly)

## Measure, in this repo

1. Identify the 3 most-touched business objects. A repo has
   no traffic stats — use git churn as the proxy (most-modified
   schema/form/handler files over the last ~500 commits),
   crossed with the app's main forms and API routes.
2. For each, list every file where its SHAPE is re-declared:
   validation schema (Zod/Yup/joi), DB table or migration,
   API input/output types, form state and rules, TS
   interfaces, API-client types. Quote the paths. If one
   object's shape belongs to an external system (legacy API,
   search index), audit it anyway and flag it: that is the
   unfavorable case, and it belongs in an honest report.
3. Count the lines that exist ONLY to keep those in sync:
   parse/serialize, DTO mapping, hand-rolled error
   formatting, manual refetch after mutations. Counting
   rule: committed codegen output and pass-through wrappers
   count; business logic in resolvers or computed fields
   does not.
4. Look for one place where two of those declarations
   already disagree (a max length, an optional, a nullable).
   There usually is one — that drift is the argument. If there
   is none here, say so plainly rather than reaching.

## Report

Per object: a table declaration-site → file → lines.
Then two totals, honestly:
- lines deletable under a derive-everything model;
- what adopting Fougere would cost HERE: storage handover
  (SQLite auto-DDL today), pre-release status (not on npm
  yet), the feature-by-feature migration path, what the
  team would have to learn.`;

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

    <!-- The one idea. The two sections below it are its two readings, in order. -->
    <section class="border-y border-default bg-elevated/40">
      <div class="max-w-6xl mx-auto px-6 py-16">
        <div class="max-w-3xl mx-auto text-center">
          <h2 class="text-2xl font-bold text-highlighted">{{ $t('home.oneIdeaTitle') }}</h2>
          <p class="mt-3 text-muted">{{ $t('home.oneIdeaText') }}</p>
        </div>
        <div class="mt-10 max-w-4xl mx-auto">
          <CoreAndArcs />
        </div>
      </div>
    </section>

    <!-- First reading: what the declaration does not name is derived from it -->
    <section class="max-w-6xl mx-auto px-6 py-20">
      <div class="text-center mb-8">
        <p class="text-xs uppercase tracking-wider text-muted mb-2">{{ $t('home.readingOne') }}</p>
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
          <p class="text-xs uppercase tracking-wider text-muted mb-2">{{ $t('home.readingTwo') }}</p>
          <h2 class="text-2xl font-bold text-highlighted">{{ $t('home.gradientTitle') }}</h2>
          <p class="mt-3 text-muted">{{ $t('home.gradientText') }}</p>
        </div>
        <div class="mt-10 max-w-5xl mx-auto">
          <GradientOrbits />
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
