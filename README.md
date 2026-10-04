<div align="center">

# 🌿 Fougere

**Fougere is focused on your business only. Create it.**<br/>
**Decide later which infrastructure topology you want,**<br/>
**And which technology you want in front of it (GraphQL, REST…).**

With one entity class, everything is derived (validation, table, API…).<br/>
No DTOs to write. It's the same class derived for your needs!<br/>
You split your app into [fronds](https://fougere.dev/docs/concepts/frond), one per business area, and each one can run inside it or on its own.

[![CI](https://github.com/chok/fougere/actions/workflows/ci.yml/badge.svg)](https://github.com/chok/fougere/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@fougere/schema/alpha.svg)](https://www.npmjs.com/package/@fougere/schema)
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)](./KNOWN_ISSUES.md)

**[Documentation →](https://fougere.dev/)**

</div>

> [!IMPORTANT]
> Fougere is in alpha, so use it with caution: APIs and conventions may still change.<br/>
> There are also many [known issues](./KNOWN_ISSUES.md).

---

<!-- prettier-ignore-start -->

<table align="center">
<tr>
<th width="50%">Entity</th>
<th width="50%">Repository</th>
</tr>
<tr>
<td valign="top">

```ts
// entities/Post.ts
export default class Post
  extends entity({
    id: primary(),
    title: text({ max: 200 }),
    body: text(),
    createdAt: created(),
    status: readOnly(oneOf(
      'draft', 'published',
      { default: 'draft' },
    )),
  }) {}

// entities/PostCard.ts
export default class PostCard
  extends Post.pick(
    'id', 'title', 'status',
  ) {}
```

</td>
<td valign="top">

```ts
// repositories/PostRepository.ts
export default class PostRepository
  extends Repository(Post) {
  published() {
    return this.output(PostCard)
      .findAllBy({
        status: 'published',
      });
  }
}
```

</td>
</tr>
<tr>
<th>Handler</th>
<th>Nuxt page (example)</th>
</tr>
<tr>
<td valign="top">

```ts
// handlers/PostHandler.ts
export default class PostHandler
  extends Crud(Post) {
  constructor(
    private posts: PostRepository,
  ) {
    super(posts);
  }

  async publish(id: Post['id']) {
    const post = await this.posts
      .findById(id);

    if (!post) {
      throw new FougereError({
        code: ErrorCode.NOT_FOUND,
        message: `No post '${id}'`,
      });
    }

    return this.posts.update(id, {
      status: 'published',
    });
  }

  listPublished() {
    return this.posts.published();
  }
}
```

</td>
<td valign="top">

```vue
<!-- app/pages/posts.vue -->
<script setup lang="ts">
import { post }
  from '@fronds/facade';

const { items } =
  await useQuery(post, 'list');
const publish =
  useCommand(post, 'publish');
</script>

<template>
  <p
    v-for="row in items"
    :key="row.id"
  >
    {{ row.title }}
    <button
      v-if="row.status === 'draft'"
      @click="publish.execute({
        params: { id: row.id },
      })"
    >
      Publish
    </button>
  </p>
</template>
```

</td>
</tr>
</table>

<!-- prettier-ignore-end -->

That's all! Everything your handler receives is validated against your schema, and it is served over JSON-RPC by default. You can enable REST or GraphQL as well.

> [!TIP]
> If you need full control over routes, for example, you can set them in config.

## Quick start

For now, only pnpm is fully supported. Fougere changes quickly, so to try the latest release:

```bash
pnpm --config.minimum-release-age=0 create fougere
```

With no arguments, it walks you through creating a new app in an interactive terminal UI.

> [!NOTE]
> It runs `fougere new` from the [CLI](https://fougere.dev/docs/cli).

→ [Getting started](https://fougere.dev/docs/getting-started)

## Philosophy

Fougere is heavily inspired by DDD and hexagonal architecture, but doesn't follow them strictly. Think of Fougere as a core around your business logic. Primary adapters, like REST or GraphQL, can be attached to your business logic, but Fougere doesn't know about them. In the same way, the core handles storage without knowing what it is. Implementations are provided for these adapters, but you can write your own to support any kind of input or output.

The one primitive to know is the Frond, the fractal leaf of a fern (_fougère_ in French). It is like a bounded context: you can't call another frond's services directly, only the public code its handlers expose. In return, calling that code is made simple, with several ways to reach a frond's code.

→ [Philosophy](https://fougere.dev/docs/concepts/philosophy)

## Features

- **App**: it's not a standalone framework. You can embed it in the one you already use (Nuxt, Next…), or serve a frond on its own with an existing HTTP framework. Fougere is not an HTTP framework at heart.
- **Schema**: it is the center. Validation, SQL tables, REST, GraphQL and forms are all derived from it.
- **Errors**: they are typed. A frontend knows exactly which errors each operation can return, without declaring them.
- **Events**: no listener to register. Ask for an `Emit<PostPublished>` to announce a fact, and accept a `Fact<PostPublished>` to subscribe to it. Across processes, it goes over HTTP by default, or through Kafka or anything else you plug in.
- **Migrations**: `fougere freeze` saves each version of your schema as extended JSON Schema. Migrations are deduced from that chain of versions: no SQL to write, and the whole history of changes is kept.
- **Deployment**: fronds can run together inside your app, or each in its own process. Moving one is a single line of config:
- **Observability**: you can observe every process, because the framework owns the input and output of every frond, even when they run in separate processes. One trace follows a call across all of them (optional).
- **Convention over configuration**: Fougere relies on conventions, and you can override them. An optional compiler reads your code and derives the configuration from it, but you can also declare it by hand: the compiler isn't needed to run your app.
- **Standards**: a frond can be written in any language. Fougere follows standards (extended JSON Schema, JSON-RPC, Standard Schema), and there is a Rust frond in the demos. SDKs for other languages may follow.
- **CLI**: your operations are available from the command line, with nothing to write. It's derived too.

## Learn more

- [Schema](https://fougere.dev/docs/schema/entities)
- [The gradient](https://fougere.dev/docs/infra/gradient)
- [`Demos`](./demos)
