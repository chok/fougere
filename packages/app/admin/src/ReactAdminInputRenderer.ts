import { type ReactElement } from 'react';
import type { ReactAdminInputContext } from './ReactAdminInputContext.js';

export type ReactAdminInputRenderer = (context: ReactAdminInputContext) => ReactElement;
