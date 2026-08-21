import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ChipField, useRecordContext } from 'react-admin';
import polyglotI18nProvider from 'ra-i18n-polyglot';
import frenchMessages from 'ra-language-french';
import { defineAdminExtension, type AdminExtension } from '@fougere/admin';
import {
  FougereAdmin,
  type FougereDashboardExtension,
  type ReactAdminRenderers,
} from '@fougere/admin/react';
import type { Fetcher } from '@fougere/app/client';
import type { IdentityCard } from '@fougere/core/contract';
import { created, describe, email, entity, oneOf, primary, readOnly, text } from '@fougere/schema';
// The theme names a variable family and cannot load one: a package that ships no CSS
// has no way to. The host does it, and this is the line — without it every weight the
// scale asks for (500/550/600/620) rounds to 700 on the system stack.
import '@fontsource-variable/inter';
import './style.css';

class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 160 }),
  body: text({ min: 1 }),
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
  createdAt: created(),
}) {}

class User extends entity({
  id: primary(),
  name: text({ min: 1, max: 100 }),
  email: email(),
  role: oneOf('admin', 'editor', 'author', { default: 'author' }),
  status: oneOf('invited', 'active', 'suspended', { default: 'invited' }),
  createdAt: created(),
}) {}

const crud = [
  { name: 'list', kind: 'query' as const, cardinality: 'page' as const },
  { name: 'findById', kind: 'query' as const, cardinality: 'maybe' as const },
  { name: 'create', kind: 'command' as const, cardinality: 'one' as const },
  { name: 'update', kind: 'command' as const, cardinality: 'one' as const },
  { name: 'delete', kind: 'command' as const, cardinality: 'none' as const },
];

const card: IdentityCard = {
  fronds: [{
    name: 'cms',
    doors: [
      {
        name: 'post',
        schema: describe(Post, 'post'),
        ops: [
          ...crud,
          {
            name: 'publish',
            kind: 'command',
            cardinality: 'one',
            description: 'Publish a draft after the domain judge accepts the transition.',
          },
        ],
      },
      { name: 'user', schema: describe(User, 'user'), ops: crud },
    ],
    facts: [],
  }],
};

const collections: Record<string, Array<Record<string, unknown>>> = {
  post: [
    {
      id: 'post_1',
      title: 'Une déclaration, toutes les projections',
      body: 'Cet article a été découvert depuis la même carte que tous les autres clients.',
      status: 'published',
      createdAt: '2026-08-19T08:30:00.000Z',
    },
    {
      id: 'post_2',
      title: 'A domain operation, not a field write',
      body: 'Publishing stays a command the domain judges.',
      status: 'draft',
      createdAt: '2026-08-20T15:45:00.000Z',
    },
    {
      id: 'post_3',
      title: 'The dashboard follows the domain',
      body: 'Editorial counts come from the declared facets.',
      status: 'draft',
      createdAt: '2026-08-21T09:15:00.000Z',
    },
    {
      id: 'post_4',
      title: 'Build without ejecting',
      body: 'Extensions stay deltas, and new widgets keep arriving.',
      status: 'published',
      createdAt: '2026-08-18T11:00:00.000Z',
    },
  ],
  user: [
    { id: 'user_1', name: 'Maxime Picaud', email: 'maxime@fougere.dev', role: 'admin', status: 'active', createdAt: '2026-07-14T08:00:00.000Z' },
    { id: 'user_2', name: 'Alice Martin', email: 'alice@fougere.dev', role: 'editor', status: 'active', createdAt: '2026-08-02T10:30:00.000Z' },
    { id: 'user_3', name: 'Noah Bernard', email: 'noah@fougere.dev', role: 'author', status: 'invited', createdAt: '2026-08-20T14:20:00.000Z' },
  ],
};

type DemoRequest = {
  id: number;
  method: string;
  params: {
    params: Record<string, unknown>;
    query: Record<string, unknown>;
    body?: Record<string, unknown>;
  };
};

const demoFetcher: Fetcher = async <T,>(
  _url: string,
  options: { method: 'POST'; body: unknown },
): Promise<T> => {
  const request = options.body as DemoRequest;
  if (request.method === 'rpc.discover') {
    return { jsonrpc: '2.0', id: request.id, result: card } as T;
  }

  const [resource, operation] = request.method.split('.');
  const rows = collections[resource ?? ''];
  if (!resource || !operation || !rows) {
    return {
      jsonrpc: '2.0', id: request.id,
      error: { code: -32601, message: `Unknown demo method ${request.method}` },
    } as T;
  }

  let result: unknown;
  if (operation === 'list') {
    const { offset = 0, limit = 25, where = {} } = request.params.query as {
      offset?: number;
      limit?: number;
      where?: Record<string, unknown>;
    };
    const filtered = rows.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value));
    result = { items: filtered.slice(offset, offset + limit), total: filtered.length };
  } else if (operation === 'findById') {
    result = rows.find((row) => row.id === request.params.params.id) ?? null;
  } else if (operation === 'create') {
    const defaults = resource === 'post'
      ? { status: 'draft' }
      : { status: 'invited', role: 'author' };
    const row = {
      ...defaults,
      ...request.params.body,
      id: `${resource}_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    collections[resource] = [row, ...rows];
    result = row;
  } else if (operation === 'update') {
    const id = request.params.params.id;
    const index = rows.findIndex((row) => row.id === id);
    rows[index] = { ...rows[index], ...request.params.body, id };
    result = rows[index];
  } else if (operation === 'delete') {
    collections[resource] = rows.filter((row) => row.id !== request.params.params.id);
    result = null;
  } else if (operation === 'publish' && resource === 'post') {
    const id = request.params.params.id;
    const index = rows.findIndex((row) => row.id === id);
    rows[index] = { ...rows[index], status: 'published' };
    result = rows[index];
  } else {
    return {
      jsonrpc: '2.0', id: request.id,
      error: { code: -32601, message: `Unknown demo method ${request.method}` },
    } as T;
  }

  return { jsonrpc: '2.0', id: request.id, result } as T;
};

const extensions: readonly AdminExtension[] = [
  defineAdminExtension({
    resource: 'post',
    label: 'Articles',
    facets: {
      editorial: {
        title: 'title',
        state: { field: 'status', draft: ['draft'], published: ['published'] },
        createdAt: 'createdAt',
      },
    },
    fields: { createdAt: { label: 'Created' } },
    operations: { publish: { label: 'Publish', confirm: 'Publish this article?' } },
  }),
  defineAdminExtension({
    resource: 'user',
    label: 'Users',
    facets: {
      users: {
        name: 'name',
        email: 'email',
        role: 'role',
        state: { field: 'status', active: ['active'], invited: ['invited'], suspended: ['suspended'] },
        createdAt: 'createdAt',
      },
    },
    fields: {
      name: { label: 'Name' },
      role: { label: 'Role' },
      status: { label: 'Statut' },
      createdAt: { label: 'Created' },
    },
  }),
];

const dashboardExtensions: readonly FougereDashboardExtension[] = [
  { widget: 'fougere.recent-content', span: 7 },
  { widget: 'fougere.users', span: 5 },
];

/**
 * A status chip that is coloured only when the value is the good one.
 *
 * The theme paints chips neutral by default, so `color` is a statement rather than
 * decoration — painting every status in brand green put `draft`, `suspended` and
 * `admin` in one colour, which told a reader nothing.
 */
function StatusChip({ column, positive }: { column: { name: string; label: string }; positive: string }) {
  const record = useRecordContext();
  return (
    <ChipField
      source={column.name}
      label={column.label}
      size="small"
      color={record?.[column.name] === positive ? 'primary' : 'default'}
    />
  );
}

const renderers: ReactAdminRenderers = {
  fields: {
    // A status is neutral unless it MEANS something good — the theme paints chips grey
    // by default so `color` is a statement, not decoration. Painting all three would put
    // `draft`, `suspended` and `admin` in the same brand green, which says nothing.
    'post.status': ({ column }) => <StatusChip column={column} positive="published" />,
    'user.status': ({ column }) => <StatusChip column={column} positive="active" />,
    'user.role': ({ column }) => <ChipField source={column.name} label={column.label} size="small" />,
  },
};

/**
 * The admin speaks French here because THIS FILE says so, and nowhere else.
 *
 * Every sentence the package draws goes through a key — `fougere.admin.*` for its own
 * widgets, `post.title` for a field (the `entity.field` convention `FormField.labelKey`
 * states). Nothing under `@fougere/admin` is written in a language. Delete the block
 * below and the same screens come back in English, from the fallbacks.
 */
const messages = {
  ...frenchMessages,
  fougere: {
    admin: {
      overview: { title: "Vue d'ensemble", subtitle: 'Contenus, activité éditoriale et utilisateurs.' },
      metric: {
        content: 'Contenus', contentHint: '%{smart_count} collection |||| %{smart_count} collections',
        drafts: 'Brouillons', draftsHint: 'À compléter ou à relire',
        published: 'Publiés', publishedHint: 'Actuellement visibles',
        users: 'Utilisateurs', usersHint: 'Comptes gérés', noUsersFacet: 'Aucune facet users déclarée',
      },
      recent: {
        title: 'Activité récente', subtitle: 'Les derniers contenus modifiés',
        undated: 'Récemment', empty: 'Aucun contenu pour le moment.',
      },
      users: { title: 'Utilisateurs', subtitle: 'Accès et rôles', empty: 'Déclarez une facet `users` pour remplir ce panneau.' },
      collections: { title: 'Collections', subtitle: 'Toutes les portes annoncées par la carte' },
      structure: {
        title: 'Topologie', subtitle: "Ce que la carte d'identité annonce de cette app",
        fronds: 'Fronds', doors: 'Portes', queries: 'Lectures', commands: 'Écritures',
        frondDoors: '%{smart_count} porte |||| %{smart_count} portes',
        frondFields: '%{smart_count} champ |||| %{smart_count} champs',
        read: 'lecture', write: 'écriture',
        localOnly: "Fronds locales seulement — une carte n'annonce pas ce vers quoi elle route.",
      },
      resource: { rows: '%{smart_count} ligne |||| %{smart_count} lignes' },
      action: {
        createContent: 'Créer du contenu', inviteUser: 'Inviter un utilisateur',
        invite: 'Inviter', seeAll: 'Tout voir', manageUsers: 'Gérer les utilisateurs',
        done: '%{name} : fait',
      },
      error: {
        discoveryTitle: "Cette application n'a pas répondu",
        discoveryBody: "Le panneau demande à l'application ce qu'elle héberge avant de pouvoir afficher quoi que ce soit. Vérifiez que l'adresse sert bien une application Fougere, et qu'elle tourne.",
        retry: 'Réessayer',
      },
    },
  },
  post: { title: 'Titre', body: 'Contenu', status: 'Statut', createdAt: 'Création' },
  user: { name: 'Nom', email: 'E-mail', role: 'Rôle', status: 'Statut', createdAt: 'Inscription' },
};

const i18nProvider = polyglotI18nProvider(
  () => messages,
  'fr',
  [{ locale: 'fr', name: 'Français' }],
);

function App() {
  return (
    <FougereAdmin
      title="Fougere CMS"
      fetcher={demoFetcher}
      extensions={extensions}
      dashboardExtensions={dashboardExtensions}
      renderers={renderers}
      i18nProvider={i18nProvider}
    />
  );
}

const container = document.getElementById('root')!;
const root: Root = import.meta.hot?.data.root ?? createRoot(container);
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(
  <StrictMode><App /></StrictMode>,
);
