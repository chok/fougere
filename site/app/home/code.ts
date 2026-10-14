import { createHighlighter, type ThemeRegistration } from 'shiki';

const pastel: ThemeRegistration = {
  name: 'fougere-pastel',
  type: 'dark',
  colors: { 'editor.background': '#10180f', 'editor.foreground': '#dde5da' },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#7d8c80' } },
    { scope: ['keyword', 'keyword.control'], settings: { foreground: '#8fcf86' } },
    { scope: ['storage', 'storage.type', 'storage.modifier'], settings: { foreground: '#9fbadb' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.type', 'entity.other.inherited-class', 'support.class'], settings: { foreground: '#efcd8f' } },
    { scope: ['string', 'string.quoted', 'constant.numeric', 'constant.language'], settings: { foreground: '#ee9f6b' } },
  ],
};

const highlighter = createHighlighter({ themes: [pastel], langs: ['ts'] });

export async function highlight(code: string): Promise<string> {
  return (await highlighter).codeToHtml(code, { lang: 'ts', theme: pastel.name });
}
