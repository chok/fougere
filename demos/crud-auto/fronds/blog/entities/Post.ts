import { entity, primary, text, ref, auto } from "@fougere/schema";
import Author from "./Author.js";

export default class Post extends entity({
  id: primary(),
  authorId: ref(Author),
  title: text({ min: 1, max: 255 }),
  body: text(),
  createdAt: auto(),
}) {}
