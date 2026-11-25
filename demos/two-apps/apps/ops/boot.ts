import { bootApp } from '@fougere/defaults';
import { appNameOf, projectRootOf } from '@fougere/core/node';

const root = projectRootOf(import.meta.dirname);

/** This app, named by its directory: no `apps.ops` in the config, so it carries `platform:`. */
export const bootOps = () => bootApp(root, { app: appNameOf(root, import.meta.dirname), migrates: true });
