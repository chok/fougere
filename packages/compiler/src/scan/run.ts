import { type Diagnostic } from '@fougere/core';
import { type VocabularyEntry } from '@fougere/core/descriptor';
import { getModuleLoader } from '@fougere/core/node';

/** What this scan run could not do. */
let diagnostics: Diagnostic[] = [];
export let vocabulary: VocabularyEntry[] = [];

export function record(d: Diagnostic): void {
  diagnostics.push(d);
}

export async function loadModule(filePath: string): Promise<Record<string, unknown>> {
  return await getModuleLoader()(filePath);
}

/** The modules this run loaded, by file — one identity per class for the whole scan. */
let loaded = new Map<string, Promise<Record<string, unknown>>>();

export function loadOnce(filePath: string): Promise<Record<string, unknown>> {
  const known = loaded.get(filePath) ?? loadModule(filePath);
  loaded.set(filePath, known);

  return known;
}

export function startRun(): void {
  diagnostics = [];
  vocabulary = [];
  loaded = new Map();
}

export function findings(): { diagnostics: Diagnostic[]; vocabulary: VocabularyEntry[] } {
  return { diagnostics, vocabulary };
}
