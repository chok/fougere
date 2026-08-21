import { entity, text } from "@fougere/schema";

/** `fougere grant <frond>` — vouch for one frond, so any receiver admits it. */
export default class Grant extends entity({
  frond: text({ min: 1, description: "Frond to vouch for" }),
}) {}
