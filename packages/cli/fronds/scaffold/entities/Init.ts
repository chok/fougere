import { entity, text, oneOf, bool } from "@fougere/schema";

export default class Init extends entity({
  name: text({ description: "Project name" }),
  template: oneOf("admin", "blog", "api", "blankosse", {
    description: "Starter template",
  }),
  force: bool({ description: "Overwrite existing directory", default: false }),
}) {}
