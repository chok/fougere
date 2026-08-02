import { entity, primary, number } from '@fougere/schema';
export default class Ledger extends entity({ id: primary(), amount: number() }) {}
