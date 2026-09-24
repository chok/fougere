/** A provider found under `helpers/` — the renamed `services/`. */
export default class Wordcount {
  of(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
  }
}
