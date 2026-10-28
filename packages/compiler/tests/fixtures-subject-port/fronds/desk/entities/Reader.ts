import { entity, primary } from '@fougere/schema';

export default class Reader extends entity({ id: primary() }) {}
