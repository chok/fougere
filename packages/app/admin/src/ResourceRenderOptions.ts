import type { ReactAdminRenderers } from './ReactAdminRenderers.js';
import type { ReactAdminResourceComponents } from './ReactAdminResourceComponents.js';

export interface ResourceRenderOptions {
  renderers?: ReactAdminRenderers;
  components?: ReactAdminResourceComponents;
}
