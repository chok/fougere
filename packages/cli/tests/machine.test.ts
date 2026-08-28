import { describe, expect, it } from 'vitest';
import { machineWanted, machineText } from '../src/machine.js';

describe('the machine door', () => {
  it('is opened by the declaration, not by the command name', () => {
    expect(machineWanted({ json: true })).toBe(true);
    expect(machineWanted({ names: 'operations' })).toBe(true);
    expect(machineWanted({ json: false })).toBe(false);
    expect(machineWanted({})).toBe(false);
  });

  it('converts a Map rather than serializing it as {}', () => {
    const report = { nodes: new Map([['post', { refs: ['author'] }]]), total: 1 };
    const parsed = JSON.parse(machineText(report)) as { nodes: Record<string, unknown> };

    expect(parsed.nodes).toEqual({ post: { refs: ['author'] } });
  });
});
