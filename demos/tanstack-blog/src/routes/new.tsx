import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useFormFor } from '@fougere/react';
import Post from '@fronds/blog/entities/Post';

/**
 * The form contract, not a form widget. `fields` comes from the entity's own axes:
 * `status` and `publishedAt` are absent because they are `readOnly`, `title`
 * carries `minlength`/`maxlength` from its shape, and the local judge is the same
 * one the handler runs.
 */
export const Route = createFileRoute('/new')({ component: NewPost });

function NewPost() {
  const navigate = useNavigate();
  const form = useFormFor(Post);

  return (
    <main>
      <h1>New post</h1>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const created = await form.submit();
          if (created) void navigate({ to: '/drafts' });
        }}
        style={{ display: 'grid', gap: '1rem', maxWidth: 460 }}
      >
        {form.fields.map((field) => (
          <label key={field.name} style={{ display: 'grid', gap: '0.25rem' }}>
            <span>{field.label}</span>
            <input
              {...field.attrs}
              value={String(form.values[field.name] ?? '')}
              onChange={(event) => form.setValue(field.name, event.target.value)}
            />
            {form.errors[field.name] && <small style={{ color: '#b00' }}>{form.errors[field.name]}</small>}
          </label>
        ))}

        <button type="submit" disabled={form.loading}>
          {form.loading ? 'Saving…' : 'Create draft'}
        </button>
        {form.error && <p style={{ color: '#b00' }}>{form.error.message}</p>}
      </form>

      <p style={{ color: '#999', marginTop: '2rem' }}>
        The form shows {form.fields.length} of the entity's six fields. <code>id</code> and{' '}
        <code>createdAt</code> are filled by the lifecycle axis, <code>status</code> and{' '}
        <code>publishedAt</code> are <code>readOnly</code>.
      </p>
    </main>
  );
}
