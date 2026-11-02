import type { ThemeRegistration } from 'shiki';

export const pastel: ThemeRegistration = {
  name: 'fougere-pastel',
  type: 'dark',
  colors: { 'editor.background': '#10180f', 'editor.foreground': '#dde5da' },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#7d8c80' } },
    { scope: ['keyword', 'keyword.control', 'storage', 'storage.type', 'storage.modifier', 'entity.name.tag', 'constant.other.option'], settings: { foreground: '#8fcf86' } },
    { scope: ['variable.language'], settings: { foreground: '#8fcf86', fontStyle: 'italic' } },
    { scope: ['markup.heading', 'entity.name.section'], settings: { foreground: '#8fcf86', fontStyle: 'bold' } },
    { scope: ['entity.name.type', 'entity.name.class', 'entity.name.namespace', 'support.type', 'entity.other.inherited-class', 'support.class', 'new.expr entity.name.function'], settings: { foreground: '#efcd8f' } },
    { scope: ['string', 'string.quoted', 'constant.numeric', 'constant.language', 'markup.inline.raw'], settings: { foreground: '#ee9f6b' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#c9b6ea' } },
    { scope: ['variable.other.property', 'variable.other.object.property', 'variable.other.constant.property', 'variable.object.property', 'support.variable.property', 'variable.other.key', 'entity.name.label', 'meta.object-literal.key', 'support.type.property-name', 'entity.other.attribute-name'], settings: { foreground: '#93cfc0' } },
    { scope: ['keyword.operator', 'punctuation', 'meta.brace', 'storage.type.function.arrow'], settings: { foreground: '#a3b0a5' } },
    { scope: ['punctuation.definition.string'], settings: { foreground: '#ee9f6b' } },
    { scope: ['meta.template.expression', 'meta.embedded'], settings: { foreground: '#dde5da' } },
    { scope: ['punctuation.definition.template-expression'], settings: { foreground: '#a3b0a5' } },
  ],
};
