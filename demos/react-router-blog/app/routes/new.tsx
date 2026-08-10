import { useNavigate } from 'react-router';
import { useFormFor } from '@fougere/react';
import Post from '../../fronds/blog/entities/Post';

export default function NewPost() {
  const navigate = useNavigate();
  const form = useFormFor(Post);

  return (
    <main>
      <h1>New post</h1>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (await form.submit()) void navigate('/drafts');
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
        <button type="submit" disabled={form.loading}>{form.loading ? 'Saving…' : 'Create draft'}</button>
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
