import { entity, url } from '@fougere/schema';

/** Where the files answer — `FILES_URL`, which `fougere up` gives from `services.files` and nothing writes by hand. */
export default class Files extends entity({
  url: url(),
}) {}
