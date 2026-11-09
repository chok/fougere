'use client';

import type { FougereDashboardContextValue } from '../FougereDashboardContextValue.js';
import type { FougereDashboardWidget } from '../FougereDashboardWidget.js';
import type { FougereDashboardExtension } from '../FougereDashboardExtension.js';
import { createContext, useContext } from 'react';

export const DashboardContext = createContext<FougereDashboardContextValue | undefined>(undefined);

/** Data shared by built-in and contributed widgets. */
export function useFougereDashboard(): FougereDashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useFougereDashboard must be used inside FougereDashboard');

  return context;
}

export function applyDashboardExtensions(
  defaults: readonly FougereDashboardWidget[],
  extensions: readonly FougereDashboardExtension[] = [],
): FougereDashboardWidget[] {
  const widgets = defaults.map((widget) => ({ ...widget }));
  for (const extension of extensions) {
    let index = widgets.findIndex((widget) => widget.id === extension.widget);
    if (index === -1) {
      if (!extension.component) {
        throw new Error(`Dashboard widget '${extension.widget}' does not exist; a new widget needs a component`);
      }
      widgets.push({
        id: extension.widget,
        component: extension.component,
        zone: extension.zone ?? 'main',
        span: extension.span ?? 4,
        hidden: extension.hidden,
      });
      index = widgets.length - 1;
    } else {
      const current = widgets[index]!;
      widgets[index] = {
        ...current,
        ...(extension.component ? { component: extension.component } : {}),
        ...(extension.zone ? { zone: extension.zone } : {}),
        ...(extension.span !== undefined ? { span: extension.span } : {}),
        ...(extension.hidden !== undefined ? { hidden: extension.hidden } : {}),
      };
    }

    const anchorId = extension.before ?? extension.after;
    if (!anchorId) continue;
    const moving = widgets.splice(index, 1)[0]!;
    const anchor = widgets.findIndex((widget) => widget.id === anchorId);
    if (anchor === -1) widgets.push(moving);
    else widgets.splice(anchor + (extension.after ? 1 : 0), 0, moving);
  }

  return widgets.filter((widget) => !widget.hidden);
}
