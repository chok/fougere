import { entity, text, number, bool, optional } from "@fougere/schema";

/** `fougere serve <frond>` — run one frond alone in its own process (JSON-RPC over HTTP). */
export default class Serve extends entity({
  frond: text({ min: 1, description: "Frond to host in its own process" }),
  port: optional(number({ description: "Port to listen on (default 4100)" })),
  watch: optional(bool({ description: "Rebuild the app when the frond changes" })),
}) {}
