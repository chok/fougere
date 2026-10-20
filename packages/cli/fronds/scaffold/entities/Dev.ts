import { entity, text, number, optional } from "@fougere/schema";

/** `fougere dev <frond>` — one frond alone in its own process, booted from its sources and again at every change. */
export default class Dev extends entity({
  frond: text({ min: 1, description: "Frond to host in its own process" }),
  port: optional(number({ description: "Port to listen on (default 4100)" })),
}) {}
