import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import ExplainHandler from '../fronds/analysis/handlers/ExplainHandler.js';
import ProjectScan from '../fronds/analysis/services/ProjectScan.js';
import { renderExplain, renderExplainJson } from '../app/commands/ExplainCommand.js';

const fixture = join(import.meta.dirname, 'fixtures-explain');
const explain = () => new ExplainHandler(new ProjectScan());

describe('explain', () => {
  it('reports the resolved contract of a valid operation', async () => {
    const result = await explain().execute({ operation: 'Post.publish', root: fixture });

    expect(result).toMatchObject({
      operation: 'Post.publish',
      handler: { class: 'PostHandler', address: 'post', method: 'publish' },
      kind: 'command',
      input: 'Post',
      output: { type: 'Post', cardinality: 'one' },
      exposure: { surfaces: ['default', 'public'], adapters: ['graphql', 'rest'] },
      placement: { frond: 'blog', runtime: 'local', remote: null },
    });
    expect(renderExplain(result)).toContain('PostHandler.publish');
  });

  it('emits stable, parsable JSON with the agent-facing keys', async () => {
    const result = await explain().execute({ operation: 'Post.publish', root: fixture });
    const parsed = JSON.parse(renderExplainJson(result));

    expect(parsed).toMatchObject({
      operation: 'Post.publish',
      kind: 'command',
      handler: { class: 'PostHandler', method: 'publish' },
      exposure: { surfaces: ['default', 'public'] },
      placement: { frond: 'blog' },
    });
    expect(Object.keys(parsed)).toEqual([
      'operation', 'handler', 'kind', 'description', 'input', 'output',
      'parameters', 'collectors', 'contexts', 'semantics', 'exposure', 'placement',
    ]);
    expect(parsed.semantics).toEqual({
      optional: 'undefined',
      undefined: 'absence',
      null: 'explicit-value',
      jsonObjectUndefined: 'omitted',
    });
  });

  it('refuses an unknown operation with deterministic available names', async () => {
    await expect(explain().execute({ operation: 'Post.missing', root: fixture }))
      .rejects.toThrow(
        "Unknown operation 'Post.missing'. Available operations: blog/default/Post.publish.",
      );
  });

  it('shows the body and collector bindings from the resolved plan', async () => {
    const result = await explain().execute({ operation: 'Post.publish', root: fixture });

    expect(result.parameters).toEqual([
      {
        name: 'input', type: 'Post', optional: false, nullable: false, undefinable: false,
        binding: { kind: 'body' },
      },
      {
        name: 'user', type: 'User', optional: true, nullable: false, undefinable: true,
        binding: { kind: 'collector', typeName: 'user' },
      },
    ]);
    expect(result.collectors).toEqual([
      expect.objectContaining({ typeName: 'user', class: 'CurrentUserCollector' }),
    ]);
  });
});
