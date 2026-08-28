import { entity, bool, text, optional } from "@fougere/schema";

/** `fougere build` — write down what a scan found, so a deployment reads no disk. */
export default class Build extends entity({
  root: optional(text({ description: "Project to read. Default: the current directory" })),
  out: optional(text({ description: "Where to write it. Default: .fougere/scan.generated.ts" })),
  json: bool({ default: false, description: "Print the report as JSON, with nothing else on stdout" }),
}) {}
