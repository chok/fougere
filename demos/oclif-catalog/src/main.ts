/**
 * A frond, as a terminal.
 *
 * Try it:
 *   pnpm dev --help                    the topic `product`, formed from the address
 *   pnpm dev product --help            the five operations `Crud(Product)` gives
 *   pnpm dev product:create --help     the flags, read off the entity's own fields
 *   pnpm dev product:create --sku A-1 --name Chair --cents 4900
 *   pnpm dev product:create --state retired     → refused, and it lists the three legal values
 *   pnpm dev product:list
 */
import { serve } from '@fougere/oclif';
import { catalog } from './app.js';

const app = await catalog();

await serve(app);
await app.dispose();
