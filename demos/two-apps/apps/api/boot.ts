import { bootApp } from '@fougere/defaults';
import { appNameOf, projectRootOf } from '@fougere/core/node';

const root = projectRootOf(import.meta.dirname);

/** This app, named by its directory: `apps.api` in the config says what it carries. */
export const bootApi = () => bootApp(root, { app: appNameOf(root, import.meta.dirname), migrates: true });
