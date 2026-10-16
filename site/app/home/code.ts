import { createHighlighter } from 'shiki';
import { pastel } from '~/code/pastel';

const highlighter = createHighlighter({ themes: [pastel], langs: ['ts'] });

export async function highlight(code: string): Promise<string> {
  return (await highlighter).codeToHtml(code, { lang: 'ts', theme: pastel.name });
}
