import { entity, text } from "@fougere/schema";

/** `fougere call <entity>.<op> [--field value …]` — invoke one operation, print the result. */
export default class Call extends entity({
  operation: text({ min: 1, description: "entity.op to invoke (e.g. post.create)" }),
}) {}
