import { entity, text, optional } from "@fougere/schema";

/** `fougere env [process]` — what a process is told by whoever starts it, as `KEY=value` lines. */
export default class Env extends entity({
  process: optional(text({ min: 1, description: "Process of processes: (default: the app)" })),
}) {}
