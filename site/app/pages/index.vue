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

const validateSnippet = `class PostHandler extends Crud(Post) {
  async publish(id: string, user: User | null) {
    if (!user) throw new FougereError({
      code: ErrorCode.UNAUTHORIZED, /* … */ });
    // author-only, draft-only — then realize:
    return this.storage.update(id, {
      status: 'published',
      publishedAt: new Date().toISOString(),
    });
  }
}`;

const consumeSnippet = `import { post } from '@fronds/facade';

const { items } = await useQuery(post, 'list');
const publish = useCommand(post, 'publish');

await publish.execute({ params: { id } });
// → every mounted query on that facade revalidates`;

// Verbatim output of demos/rust-frond's TypeScript consumer — rules declared
// in Rust, enforced by the TS validator before a single byte goes on the wire.
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
//   validation  (browser + façade, same validator)
//   SQLite table + additive schema sync
//   form contract   useFormFor(Post)
//   API surface     post.create / post.list
//   GraphQL type    type Post { … }`;

// One canonical prompt, English on both locales — agents read English,
// and a translated prompt would be a second truth to keep in sync.
// The doc links are built from SITE_URL, which survives `nuxt generate`;
// the embedded model covers agents running without web access.
const origin = useRuntimeConfig().public.siteUrl;
const auditPrompt = `# Audit: what does a week of work cost here?

You are auditing THIS repository. Be honest: report the costs of
adopting as carefully as the gains, and what would get WORSE as
carefully as what improves. Fougere is added beside what exists,
one module at a time. The question is what the everyday work in
this repo costs today, and what it would cost written that way.

The schema is one subject among several. Most commits in a
backend touch operations, services, wiring and calls to other
systems, not the tables. Weigh every finding by how often that
kind of code actually changes here.

## Reference model — Fougere, a TS framework

One rule: a declaration names nothing outside itself — no table,
no protocol, no host, no address. What it does not name is either
derived from it, or chosen outside it. In practice:

- Shape. One class declares a business object once:

      class Post extends entity({
        id: primary(),
        title: text({ min: 1, max: 160 }),
        status: readOnly(oneOf('draft', 'published',
          { default: 'draft' })),
      }) {}

  Validation (the same in the browser and at the API, unknown
  keys refused), the SQL table, the form contract, the API
  surface, GraphQL types and the TS type all come from it.
- Operations. A handler method is an operation. Its signature is
  its contract: what it takes, what it returns, and the errors it
  can refuse with — found by the scan even when thrown from a
  helper, and published to the client's types.
- Wiring. Nothing is registered by hand. A class in a convention
  folder is found, and constructor parameter types are its
  dependencies. A dependency nothing provides stops the boot,
  naming the class and its file.
- Ports. \`class StripePayment extends Payment\` IS the
  registration. Two implementations stop the boot; one config
  line picks. A retry or a cache is a class that extends the port
  and asks for it, stacked in front by config. Tests get a stub
  derived from the port (\`stubOf(Payment)\`).
- Boundaries. Code lives in fronds (modules). A frond cannot reach
  another frond's rows; it calls its operations or announces a
  fact (\`Emit<T>\`) that others subscribe to by signature. Moving
  a frond to its own process is one config line, with identical
  user code.
- Computed fields. A presenter receives the whole page of rows,
  not one row, so one query per page is the natural form.
- Observability. Every log line says which class wrote it and
  which operation was running. One optional package adds a span
  per operation, its own time apart from its children, and the
  number of SQL queries it ran. An expected refusal and a bug are
  told apart by type, not by convention.
- Reading. \`fougere explain\` and the identity card answer what an
  operation takes, returns, refuses and which modules it reaches.

Scope today (pre-release): storage is additive auto-DDL over
Kysely. SQLite resolves from its name; Postgres, MySQL and SQL
Server work by handing Fougere the Kysely dialect you built. No
search-index projection. Auth via better-auth, or the sessions you
already have behind an auth provider. Price the adoption costs
against THIS scope, not an imagined one.

If you can fetch the web, ground yourself in the docs first:

- ${origin}/docs — the model in one page
- ${origin}/docs/business/handlers — operations
- ${origin}/docs/business/ports — ports and chains
- ${origin}/docs/business/errors — what an operation refuses
- ${origin}/docs/business/presenters — computed fields
- ${origin}/docs/infra/gradient — the process boundary as config
- ${origin}/docs/infra/observability — spans and query counts
- ${origin}/docs/infra/testing — tests and stubs derived
- ${origin}/docs/existing-app — the feature-by-feature path
  (use it to price the adoption cost honestly)

## Rules for every number

- Every sentence carries a unit the reader can recount: a count,
  or a path plus a symbol. Quote the command you ran.
- Where a section finds nothing, write "nothing". It is a result.
- Never claim what Fougere does beyond the model above or a doc
  page you read.
- Never weigh a section by another section's frequency.

## 0. Where the work goes

Run \`git log\` over the last 12 months of the backend and count
the commits that touch each kind of code. Adapt the paths to this
repo and say which you used:

- schema and migrations
- operations: controllers, resolvers, route handlers
- services and business logic
- wiring: module files, DI registration, route tables, barrels
- clients of external systems (HTTP, SDKs, queues)
- tests
- the client side's API calls and generated types

This table is the weight of every section below. A cost paid in
60% of commits and one paid twice a year are not the same size.

## 1. Ports — the systems this code calls

- List every external system the backend calls, with the file of
  its client.
- How many sit behind an abstraction the rest of the code depends
  on, and how many are concrete classes used directly?
- How does a test replace one? Count mock calls, provider
  overrides, fake servers. If tests never replace them, say so.
- Where do retry, cache and timeout live: inside each client, or
  in front of it?

## 2. Wiring — lines that only list things

Count lines whose only job is to register or list what already
exists: module files, provider and export lists, DI tokens, route
tables, path aliases kept in two places. Count names written twice
(declared, then exported). From section 0, how many commits a year
touch these files?

Then: when a dependency is missing, when does this stack say so —
at startup, or at the first call?

## 3. Boundaries — what reaches what

- Build the matrix of imports between top-level domains or
  modules. Report every cycle.
- Does anything refuse a crossing, or does any import pass?
- Pick the module you would most plausibly move to its own
  process. Count the files that would change.
- Count files of business code (not config, not the HTTP layer)
  that name where they run: base URLs, per-service env vars,
  host-specific request objects.

## 4. What an operation refuses

- Count throw sites of expected errors (not found, bad request,
  unauthorized…) by kind.
- Can a caller see them in its types, or does it learn them at
  runtime? Pick three operations and list what each can refuse,
  and how many lines you had to read to find out.
- How is a bug told apart from an expected refusal: by structure,
  or by a convention someone has to remember? Quote the doc or
  helper if there is one.

## 5. Computed fields and reads

- Count fields resolved per row (field resolvers, getters that
  query, serializers that fetch).
- Is there batching? Count hand-made per-request caches.
- Can you tell today how many queries one operation runs?

## 6. Observability

Not "is there tracing" — most stacks auto-instrument HTTP. Ask:

- Can a log line say which operation was running when it was
  written? Count loggers created by hand.
- Are queries counted per operation?
- Is there a hand-kept list (component tags, domain names) that
  copies the folder structure?

## 7. Shape — where the same field is declared again

- Take two business objects: one added in the last year, one the
  app is built around. List every file that re-declares their
  shape: DB, validation, API input and output types, form rules,
  client types.
- Sweep for drift: two declarations of one field that disagree (a
  max length, an enum, a nullable, a default the ORM chose). Quote
  both, and say what breaks between them.
- Files touched per new field (median over at least five commits)
  and per rename. Their frequency comes from section 0.

## 8. Reading by an agent

You are an agent reading this repo, so measure yourself.

- For the three operations of section 4: to know what each takes,
  returns, refuses and which other modules it reaches, how many
  files and lines did you open?
- Count rules in this repo's instruction files (CLAUDE.md,
  AGENTS.md, .cursorrules, CONTRIBUTING) that a person or an agent
  must follow by hand, like "update X when you change Y".
- The other side, stated plainly: this repo's stack is in every
  model's training data, and Fougere is not. An agent writes
  idiomatic code here without reading anything. Say what that is
  worth here.

## Report

Lead with the table from section 0. Then, for each section, its
count and its weight from section 0, side by side.

Then, honestly:
- what this repo ALREADY derives or gets for free — generated
  clients, inferred types, auto-instrumentation, a framework that
  checks wiring at startup. Those are not gains, and a report that
  counts them is lying;
- what would get WORSE: database features in use that Fougere's
  scope does not cover, change-data-capture or search pipelines
  tied to the current ORM, a second migration tool on one
  database, where a Fougere process would be hosted, what the team
  and its agents must learn, the pre-release status;
- what adopting would cost HERE, in counts, named mechanisms and
  versions — never a grade;
- the weighing: which costs and gains recur every week, which are
  paid once, and which side dominates for the work this repo
  actually does. Say it in one paragraph, and say what it rests on;
- where the FIRST frond would go: a module about to be written, or
  an existing one with many external calls and few tables shared
  with the rest. Name it and say why. If nothing fits, say that.

The last section is "What these numbers do not establish", and it
is written seriously.`;

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
      <div class="max-w-6xl mx-auto px-6 pt-24 pb-16 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
        <div class="text-center lg:text-left">
          <UBadge :label="$t('home.badge')" variant="subtle" color="neutral" class="mb-6" />
          <h1 class="text-4xl sm:text-5xl font-bold text-highlighted tracking-tight text-balance">
            {{ $t('home.title') }}
          </h1>
          <p class="mt-6 text-lg text-muted text-pretty">
            {{ $t('home.subtitle') }}
          </p>
          <div class="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
            <UButton :to="localePath('/docs/existing-app')" size="lg" :label="$t('home.ctaStart')" trailing-icon="i-lucide-arrow-right" />
            <UButton to="#audit" size="lg" variant="outline" color="neutral" :label="$t('home.ctaAudit')" />
            <UButton :to="localePath('/docs/getting-started')" size="lg" variant="link" color="neutral" :label="$t('home.ctaScratch')" />
          </div>
        </div>
        <CodeWindow :code="derivedSnippet" filename="fronds/blog/entities/Post.ts — and what derives" lang="ts" />
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

    <!-- Declare → Validate → Consume -->
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
          {{ $t('home.validateTitle') }}
        </h2>
        <p class="text-sm text-muted mb-3 lg:min-h-15">{{ $t('home.validateText') }}</p>
        <CodeWindow :code="validateSnippet" filename="fronds/blog/handlers/PostHandler.ts" lang="ts" class="flex-1" />
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
        <CodeWindow :code="auditPrompt" filename="audit-prompt.md" lang="markdown" class="max-h-[34rem]" />
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
