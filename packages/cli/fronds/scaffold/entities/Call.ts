import { entity, text } from "@fougere/schema";

/** `fougere call <address>.<op> [--field value …]` — invoke one operation, print the result. */
export default class Call extends entity({
  operation: text({ min: 1, description: "address.op to invoke — the facade a handler serves, then its operation (e.g. post.create)" }),
}) {}
