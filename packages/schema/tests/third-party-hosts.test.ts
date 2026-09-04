import { describe, it, expect } from 'vitest';
import { initTRPC } from '@trpc/server';
import { FormApi } from '@tanstack/form-core';
import { entity } from '../src/entity.js';
import { primary } from '../src/vocabulary/primary.js';
import { text } from '../src/vocabulary/text.js';
import { number } from '../src/vocabulary/number.js';
import { bool } from '../src/vocabulary/bool.js';

/**
 * The README's claim, held by a runner rather than by prose: an entity is
 * accepted wherever a Standard Schema is, with no adapter package and nothing
 * else of fougere in the host's app.
 *
 * Neither host below imports anything from fougere. They read `~standard` off
 * the class exactly as they would off a Zod or a Valibot schema — which is the
 * whole point: the spec is the fixed point, so N hosts x M validators collapses
 * to N + M, and there is no adapter to write per host.
 */

class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  views: number({ min: 0 }),
  draft: bool({ default: false }),
}) {}

class CreatePost extends Post.omit('id') {}

describe('tRPC', () => {
  const t = initTRPC.create();
  const router = t.router({
    create: t.procedure.input(CreatePost).mutation(({ input }) => input),
  });
  const call = t.createCallerFactory(router)({});

  it('takes the entity as .input() — no adapter, no wrapper', async () => {
    await expect(call.create({ title: 'Hello', views: 10 })).resolves.toMatchObject({
      title: 'Hello',
      views: 10,
    });
  });

  it('turns the entity refusal into the host BAD_REQUEST', async () => {
    await expect(call.create({ title: '', views: -1 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('lets the entity, not the host, be the one judging', async () => {
    // `views: -1` is a number and structurally fine; only min(0) rejects it.
    await expect(call.create({ title: 'Hello', views: -1 })).rejects.toThrow();
  });
});

describe('TanStack Form', () => {
  const mounted = () => {
    const form = new FormApi({
      defaultValues: { title: '', views: 0, draft: false },
      // The entity judges correctly at runtime — every assertion below is real.
      // What the compiler refuses is the INPUT side: `~standard.types.input` is
      // declared `Record<string, unknown>` (Schema.ts), so a host that infers its
      // form shape FROM the schema cannot line it up with defaultValues.
      //
      // The two hosts want OPPOSITE inputs, which is why no type here satisfies
      // both. Measured, all three: `PartialRow<TFields>` fails TanStack, which
      // needs input assignable TO its complete defaultValues, not from them.
      // `Row<TFields>` passes TanStack and fails tRPC above, which calls without
      // `draft` — a field carrying a default. The type that would serve makes a
      // field optional exactly when it is not required at creation, and it is not
      // expressible: `Field<T>` carries only the value type, while `default` lives
      // on `shape` and the rule on `lifecycle` — neither reaches a mapped type.
      // Closing this means `Field` retaining its axes in its type parameters.
      // @ts-expect-error — see above: input is untyped, output is not
      validators: { onChange: CreatePost },
    });
    form.mount();
    return form;
  };

  it('takes the entity as a validator — no adapter, no wrapper', () => {
    const form = mounted();
    form.setFieldValue('title', 'Hello');
    form.setFieldValue('views', 10);
    form.validateSync('change');
    expect(form.state.isValid).toBe(true);
  });

  it('surfaces the entity issues on the field that produced them', () => {
    const form = mounted();
    form.setFieldValue('title', ''); // min(1)
    form.validateSync('change');
    expect(form.state.isValid).toBe(false);
    expect(form.getFieldMeta('title')?.errors.length).toBeGreaterThan(0);
  });
});
