import { createHighlighter } from 'shiki';
import { pastel } from '~/code/pastel';

const highlighter = createHighlighter({ themes: [pastel], langs: ['ts', 'yaml'] });

export async function highlight(code: string, lang: 'ts' | 'yaml' = 'ts'): Promise<string> {
  return (await highlighter).codeToHtml(code, { lang, theme: pastel.name });
}
