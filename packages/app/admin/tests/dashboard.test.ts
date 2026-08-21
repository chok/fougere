import { describe, expect, it } from 'vitest';
import type { ComponentType } from 'react';
import { applyDashboardExtensions, type FougereDashboardWidget } from '../src/dashboard.js';

const Empty: ComponentType = () => null;
const Replacement: ComponentType = () => null;

const defaults: FougereDashboardWidget[] = [
  { id: 'stats', zone: 'metrics', span: 1, component: Empty },
  { id: 'recent', zone: 'main', span: 8, component: Empty },
  { id: 'users', zone: 'main', span: 4, component: Empty },
];

describe('dashboard extensions', () => {
  it('patches by stable id and preserves unmentioned default widgets', () => {
    const widgets = applyDashboardExtensions(defaults, [
      { widget: 'recent', span: 6, component: Replacement },
    ]);

    expect(widgets.map((widget) => widget.id)).toEqual(['stats', 'recent', 'users']);
    expect(widgets[1]).toMatchObject({ span: 6, component: Replacement });
  });

  it('adds, positions and hides widgets without snapshotting the dashboard', () => {
    const widgets = applyDashboardExtensions(defaults, [
      { widget: 'analytics', component: Replacement, zone: 'main', span: 12, before: 'recent' },
      { widget: 'users', hidden: true },
    ]);

    expect(widgets.map((widget) => widget.id)).toEqual(['stats', 'analytics', 'recent']);
  });

  it('requires a renderer only when a widget id is genuinely new', () => {
    expect(() => applyDashboardExtensions(defaults, [{ widget: 'unknown', span: 4 }]))
      .toThrow("Dashboard widget 'unknown' does not exist");
  });
});
