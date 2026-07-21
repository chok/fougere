import { entity, text, oneOf, bool, optional } from "@fougere/schema";

export default class Init extends entity({
  name: text({ description: "Project name" }),
  // Optional: irrelevant in --frond mode, prompted otherwise.
  template: optional(oneOf("admin", "blog", "api", "blankosse", {
    description: "Starter template",
  })),
  force: bool({ description: "Overwrite existing directory", default: false }),
  frond: bool({ description: "Scaffold a standalone frond, no app", default: false }),
}) {}
