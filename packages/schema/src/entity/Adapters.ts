import type { Shape } from '../schema/axis/shape/Shape.js';
import { EntryJudge } from '../judge/EntryJudge.js';

export class Adapters {
  private static readonly registry = new Map<string, EntryJudge>();

  /**
   * Registers an adapter under its name and hands back the judge for its own entries.
   * `export const sqlEntries = Adapters.register('sql', ENTRY_FORMAT)`
   */
  static register(name: string, format: Shape): EntryJudge {
    const judge = EntryJudge.of(format);

    this.registry.set(name, judge);

    return judge;
  }

  /**
   * The judge an adapter registered, or `undefined` when this process never loaded it.
   * FR : le juge enregistré par un adaptateur, ou `undefined` si ce process ne l'a pas chargé.
   * `Adapters.judge('sql')`
   */
  static judge(name: string): EntryJudge | undefined {
    return this.registry.get(name);
  }

  /**
   * The names this process answers — what a refusal lists so a typo is visible beside them.
   * FR : les noms auxquels ce process répond — ce qu'un refus énumère pour rendre une faute visible.
   * `Adapters.names` → `['sql']`
   */
  static get names(): string[] {
    return [...this.registry.keys()];
  }

  /**
   * Judges every entry an entity states, through the adapter that registered its own format.
   * A name this process never loaded is SKIPPED, not refused: an entity may state a
   * Postgres column type while this app boots on `adapter/memory`, and the two are
   * indistinguishable here. Deciding a name is a typo needs the project, not the process.
   * FR : juge chaque entrée par l'adaptateur qui a enregistré son format ; un nom non chargé
   * est ignoré, pas refusé — le process ne peut pas le distinguer d'une faute de frappe.
   * `Adapters.check({ sql: { body: { columnTpye: {} } } }, 'Post.adapters')`
   * → throws `Post.adapters.sql.body: Property "columnTpye" does not match …`
   */
  static check(stated: Readonly<Record<string, unknown>> | undefined, at: string): void {
    if (!stated) return;

    for (const [name, entries] of Object.entries(stated)) {
      this.registry.get(name)?.check(entries, `${at}.${name}`);
    }
  }
}
