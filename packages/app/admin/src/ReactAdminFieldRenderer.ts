import { type ReactElement } from 'react';
import type { ReactAdminFieldContext } from './ReactAdminFieldContext.js';

export type ReactAdminFieldRenderer = (context: ReactAdminFieldContext) => ReactElement;
