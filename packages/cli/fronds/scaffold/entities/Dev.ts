import { entity, text, number, optional } from "@fougere/schema";

/** `fougere dev [process]` — run the app, or a process of `processes:`, from its sources, booted again at every change. */
export default class Dev extends entity({
  process: optional(text({ min: 1, description: "Process of processes: to run (default FOUGERE_PROCESS, else the app)" })),
  port: optional(number({ description: "Port to listen on (default the process url, else 4100)" })),
}) {}
