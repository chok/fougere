# @fougere/admin

An extensible React Admin renderer derived at runtime from Fougere's identity card.
It does not generate project files: every load discovers the latest resources, derives
the admin model, applies additive extensions, and renders it.

```tsx
import { defineAdminExtension } from '@fougere/admin';
import { FougereAdmin } from '@fougere/admin/react';

const extensions = [
  defineAdminExtension({
    resource: 'post',
    label: 'Articles',
    facets: {
      editorial: {
        title: 'title',
        state: {
          field: 'status',
          draft: ['draft'],
          published: ['published'],
        },
      },
    },
  }),
];

export const BackOffice = () => (
  <FougereAdmin endpoint="/api/fougere/call" extensions={extensions} />
);
```

## Facets

Facets expose semantic notions without coupling the renderer to entity names. Fougere
ships `editorial` and `users`; contributor packages can add values such as `media`,
`moderation`, or `commerce`. Facet objects merge recursively, while arrays replace.

## Dashboard widgets

The CMS dashboard is composed from stable widget ids. Project code changes only what it
owns, so new default widgets still appear after package upgrades.

```tsx
<FougereAdmin
  dashboardExtensions={[
    { widget: 'fougere.recent-content', span: 7 },
    { widget: 'fougere.users', span: 5 },
    {
      widget: 'acme.analytics',
      component: AnalyticsWidget,
      zone: 'main',
      span: 12,
      after: 'fougere.recent-content',
    },
  ]}
/>
```

An existing widget can be moved, resized, replaced or hidden. A new id with a component
contributes a widget. `useFougereDashboard()` exposes discovered resources, loading state,
base metrics, and navigation to contributed widgets. React Admin's regular `dashboard`
prop remains the full replacement escape hatch.

## Rendering escape hatches

- `renderers.fields['resource.field']` and `renderers.inputs[...]` replace one field.
- `resourceComponents.resource` replaces a list, show, edit, create, or icon component.
- ordinary React Admin props replace the theme, layout, dashboard, auth, and i18n layers.

Unmentioned resources and fields always retain their derived renderer.
