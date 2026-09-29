import { Fragment } from 'react';
import { useCommand, useFormFor, useQuery } from '@fougere/react';
import './posts.css';
import { post } from '@fronds/facade';
import Post from '@fronds/__frond__/entities/Post';

export default function Posts() {
  const { items } = useQuery(post, 'list');
  const { fields, values, setValue, errors, submit } = useFormFor(Post);
  const publish = useCommand(post, 'publish');
  const remove = useCommand(post, 'delete');

  return (
    <main className="posts">
      <h1>Posts</h1>
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        {fields.map((field) => (
          <Fragment key={field.name}>
            {field.control === 'select' ? (
              <select {...field.attrs} value={String(values[field.name] ?? '')} onChange={(event) => setValue(field.name, event.target.value)}>
                {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : field.control === 'boolean' ? (
              <label><input type="checkbox" checked={Boolean(values[field.name])} onChange={(event) => setValue(field.name, event.target.checked)} /> {field.label}</label>
            ) : field.control === 'text' && !field.attrs?.maxLength ? (
              <textarea {...field.attrs} placeholder={field.label} value={String(values[field.name] ?? '')} onChange={(event) => setValue(field.name, event.target.value)} />
            ) : (
              <input {...field.attrs} placeholder={field.label} value={String(values[field.name] ?? '')} onChange={(event) => setValue(field.name, event.target.value)} />
            )}
            {errors[field.name] && <small>{errors[field.name]}</small>}
          </Fragment>
        ))}
        <button>Create draft</button>
      </form>
      <ul>
        {items.map((row) => (
          <li key={row.id}>
            <strong>{row.title}</strong>
            <span>{row.status}</span>
            {row.status === 'draft' && (
              <button onClick={() => void publish.execute({ params: { id: row.id } }).catch(() => {})}>Publish</button>
            )}
            <button className="delete" onClick={() => void remove.execute({ params: { id: row.id } }).catch(() => {})}>Delete</button>
          </li>
        ))}
      </ul>
      {publish.error && <p className="refused">{publish.error.message}</p>}
      {remove.error && <p className="refused">{remove.error.message}</p>}
    </main>
  );
}
