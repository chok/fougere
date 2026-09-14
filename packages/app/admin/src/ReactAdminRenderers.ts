import type { ReactAdminFieldRenderer } from './ReactAdminFieldRenderer.js';
import type { ReactAdminInputRenderer } from './ReactAdminInputRenderer.js';

export interface ReactAdminRenderers {
  /** Exact `resource.field` keys. Unmentioned and future fields keep the default renderer. */
  fields?: Record<string, ReactAdminFieldRenderer>;
  inputs?: Record<string, ReactAdminInputRenderer>;
}
