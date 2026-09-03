import { entity, primary, text } from '@fougere/schema';

/** `sqll` is a typo for the adapter this project depends on; `mongo` is simply not one. */
export default class Article extends entity(
  { id: primary(), title: text(), body: text() },
  { adapters: { sqll: { body: {} }, mongo: { body: {} } } } as never,
) {}
