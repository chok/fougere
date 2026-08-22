/**
 * The ascent, named at last — and it is the dual of `dispose`.
 *
 * `container.dispose()` has always had a shape: reverse order, only what it built. The way
 * UP had no name and four call sites under one word, `afterBoot`, carrying two different
 * meanings — the storage's (migrations) and the host's (seeding), the second REPLACING what
 * the framework would have done. One declaration read by four copies is the disease this
 * repo already records for seeding, and it produced the same defect: the copy that runs
 * when you open a Nuxt app had lost the storage fallback.
 *
 * So the pair is one value. An extension states what it does to an app and what it undoes,
 * and neither half can go missing without the other being visible.
 */
import type { App } from './types.js';

/**
 * What a package does to an app, and what it undoes.
 *
 * Not a frond: a frond has entities and may move behind `remotes:`, while this belongs to
 * the PROCESS that hosts them (`@fougere/observability` reads all the fronds and would
 * report the wrong process if it moved). Not a provider either — nothing resolves it.
 *
 * `up` is where a provider that must OPEN something belongs, which a constructor cannot do:
 * it is the one point in the boot that may await.
 */
export interface Extension {
  /** Its identity, and the handle a host overrides it by. */
  name: string;
  up?(app: App): void | Promise<void>;
  down?(app: App): void | Promise<void>;
}

/**
 * The extensions of one app, in the order they will run.
 *
 * A name already present is REPLACED, a new one is appended — the same delta rule
 * `applyDashboardExtensions` states for widgets, and for the same reason: a host must be
 * able to say "the seeding, but mine" without the framework guessing that from a position
 * in a list. It is not a collision to refuse, it is the one way an override can be spelled.
 */
export class Lifecycle {
  private readonly members: Extension[] = [];

  add(...extensions: readonly (Extension | undefined)[]): this {
    for (const extension of extensions) {
      if (!extension) continue;
      const at = this.members.findIndex((held) => held.name === extension.name);
      if (at === -1) this.members.push(extension);
      else this.members[at] = extension;
    }
    return this;
  }

  /** What will run, in order — read by a boot that wants to say so. */
  names(): string[] {
    return this.members.map((extension) => extension.name);
  }

  /**
   * The way up, in declaration order.
   *
   * It THROWS, and the first failure stops the rest: a migration that did not run must not
   * be followed by a seed that assumes it did. This is the opposite of `down` below, and
   * the asymmetry is the point — an app that half-started must not be handed out.
   */
  async up(app: App): Promise<void> {
    for (const extension of this.members) await extension.up?.(app);
  }

  /**
   * The way down, in reverse — the container's own rule, applied one level up.
   *
   * Every `down` runs even when one refuses, and the refusals leave together as an
   * `AggregateError`: a release that abandons the rest on the first failure leaks
   * everything after it, which is the one thing a release must not do. Reporting is still
   * owed — `app.deliver` answers the same way, for the same reason.
   */
  async down(app: App): Promise<void> {
    const refused: unknown[] = [];
    for (const extension of [...this.members].reverse()) {
      try {
        await extension.down?.(app);
      } catch (error) {
        refused.push(error);
      }
    }
    if (refused.length > 0) {
      throw new AggregateError(refused, `${refused.length} extension(s) refused to release`);
    }
  }
}

/**
 * The storage's ascent — tables before rows, and the name stated once.
 *
 * Three hosts build this member (`boot()`, the shared host boot, and the Nitro plugin the
 * Nuxt module generates), so the NAME lives here: a host overrides a member by naming it,
 * and a mistyped name is a silent second member rather than a replacement.
 *
 * It is also the ascent's SKELETON — see below.
 */
export function migrating(migrate?: Extension['up']): Extension {
  // The slot exists even when nothing migrates. Returning nothing here is what let a host's
  // own `migrate` — the Nitro plugin's, which resolves its storage itself — be ADDED after
  // the seeds instead of REPLACING this member in place: rows before tables, on a fresh
  // database, which fails at the driver with nothing naming the cause.
  return migrate ? { name: 'migrate', up: migrate } : { name: 'migrate' };
}
