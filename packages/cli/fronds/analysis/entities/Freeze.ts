import { entity, bool, text, optional } from "@fougere/schema";

/** `fougere freeze <version>` — record today's shapes under a name, for good. */
export default class Freeze extends entity({
  version: text({ min: 1, description: "Name to record these shapes under (e.g. v2)" }),
  root: optional(text({ description: "Project to read. Default: the current directory" })),
  json: bool({ default: false, description: "Print the report as JSON, with nothing else on stdout" }),
}) {}
