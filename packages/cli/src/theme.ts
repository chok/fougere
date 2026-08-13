import pc from 'picocolors';

export interface ThemeColors {
  brand: (text: string) => string;
  success: (text: string) => string;
  error: (text: string) => string;
  warn: (text: string) => string;
  muted: (text: string) => string;
  bold: (text: string) => string;
}

export const defaultTheme: ThemeColors = {
  brand: pc.green,
  success: pc.green,
  error: pc.red,
  warn: pc.yellow,
  muted: pc.dim,
  bold: pc.bold,
};
