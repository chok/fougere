import type { ReactElement } from 'react';
import {
  AppBar,
  Layout,
  Menu,
  TitlePortal,
  defaultDarkTheme,
  defaultLightTheme,
  useTranslate,
  type AppBarProps,
  type LayoutProps,
  type RaThemeOptions,
} from 'react-admin';
import { SvgIcon, type SvgIconProps } from '@mui/material';

type Mode = 'light' | 'dark';

const fern = {
  50: '#EDF9F2', 100: '#D3F0E0', 200: '#A8E1C3', 300: '#74CDA1', 400: '#45B37F',
  500: '#22995F', 600: '#16794D', 700: '#116040', 800: '#0E4C34', 900: '#0B3D2B',
} as const;

const neutral = {
  light: {
    canvas: '#FCFCFD', surface: '#FFFFFF', subtle: '#F7F8F9', sunken: '#F1F3F5',
    borderSubtle: '#ECEEF0', border: '#E1E4E8', borderStrong: '#D0D5DA',
    muted: '#6E7781', text: '#1A1D21',
  },
  dark: {
    canvas: '#0B0C0E', surface: '#141619', subtle: '#1A1D21', sunken: '#101215',
    borderSubtle: '#212529', border: '#2A2F35', borderStrong: '#3A4048',
    muted: '#969DA6', text: '#E6E9EC',
  },
} as const;

const createFougereTheme = (mode: Mode): RaThemeOptions => {
  const dark = mode === 'dark';
  const base = dark ? defaultDarkTheme : defaultLightTheme;
  const c = neutral[mode];
  const accent = dark ? '#4FC08D' : fern[600];
  const ring = dark ? 'rgba(79,192,141,0.32)' : 'rgba(22,121,77,0.20)';
  const overlay = dark
    ? '0 10px 30px -10px rgba(0,0,0,.70), 0 2px 8px -4px rgba(0,0,0,.60)'
    : '0 8px 24px -8px rgba(16,24,32,.16), 0 2px 6px -2px rgba(16,24,32,.10)';

  return {
    ...base,
    palette: {
      ...base.palette,
      mode,
      primary: {
        main: accent,
        light: dark ? '#7AD3AA' : fern[500],
        dark: dark ? '#22995F' : fern[700],
        contrastText: dark ? '#06180F' : '#FFFFFF',
      },
      secondary: { main: dark ? '#C9A227' : '#8A6D1F', contrastText: dark ? '#171203' : '#FFFFFF' },
      background: { default: c.canvas, paper: c.surface },
      text: { primary: c.text, secondary: c.muted, disabled: c.borderStrong },
      divider: c.border,
      success: { main: dark ? '#4FC08D' : '#127A4C' },
      warning: { main: dark ? '#E0B341' : '#9A6B10' },
      error: { main: dark ? '#F0736A' : '#C1372F' },
      info: { main: dark ? '#67A9F5' : '#1D6FD0' },
    },

    shape: { borderRadius: 8 },
    sidebar: { width: 232, closedWidth: 56 },
    spacing: 8,

    typography: {
      ...base.typography,
      fontFamily: [
        '"Inter Variable"', 'Inter', 'ui-sans-serif', '-apple-system',
        'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif',
      ].join(', '),
      fontSize: 13.5,
      h1: { fontSize: '1.5rem', lineHeight: 1.25, fontWeight: 620, letterSpacing: '-0.021em' },
      h2: { fontSize: '1.25rem', lineHeight: 1.3, fontWeight: 620, letterSpacing: '-0.018em' },
      h3: { fontSize: '1.0625rem', lineHeight: 1.35, fontWeight: 600, letterSpacing: '-0.014em' },
      h4: { fontSize: '0.9375rem', lineHeight: 1.4, fontWeight: 600, letterSpacing: '-0.008em' },
      h5: { fontSize: '0.875rem', lineHeight: 1.45, fontWeight: 600, letterSpacing: '-0.004em' },
      h6: { fontSize: '0.8125rem', lineHeight: 1.45, fontWeight: 600, letterSpacing: 0 },
      body1: { fontSize: '0.875rem', lineHeight: 1.55 },
      body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
      caption: { fontSize: '0.75rem', lineHeight: 1.45, fontWeight: 500 },
      button: { fontSize: '0.8125rem', fontWeight: 550, letterSpacing: '-0.004em', textTransform: 'none' },
    },

    components: {
      ...base.components,

      /** The shortest line in the file that stops this looking like Material. */
      MuiButtonBase: { defaultProps: { disableRipple: true } },

      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundImage: 'none', WebkitFontSmoothing: 'antialiased' },
          '*::selection': { backgroundColor: dark ? 'rgba(79,192,141,.26)' : fern[100] },
          '@media (prefers-reduced-motion: reduce)': {
            '*': { transitionDuration: '0.01ms !important', animationDuration: '0.01ms !important' },
          },
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: {
            color: c.text,
            backgroundColor: dark ? 'rgba(11,12,14,.78)' : 'rgba(252,252,253,.78)',
            backgroundImage: 'none',
            borderBottom: `1px solid ${c.borderSubtle}`,
            boxShadow: 'none',
            backdropFilter: 'blur(12px) saturate(1.4)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: c.canvas,
            backgroundImage: 'none',
            borderRight: `1px solid ${c.borderSubtle}`,
            boxShadow: 'none',
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          elevation1: { border: `1px solid ${c.border}`, boxShadow: 'none' },
          elevation8: { boxShadow: overlay, border: `1px solid ${c.border}` },
          elevation24: { boxShadow: overlay, border: `1px solid ${c.border}` },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { border: `1px solid ${c.border}`, borderRadius: 10, boxShadow: 'none' },
        },
      },
      MuiCardContent: {
        styleOverrides: { root: { padding: 16, '&:last-child': { paddingBottom: 16 } } },
      },

      MuiButton: {
        defaultProps: { disableElevation: true, size: 'small' },
        styleOverrides: {
          root: {
            minHeight: 32,
            borderRadius: 6,
            paddingInline: 12,
            transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
            '&.Mui-focusVisible': { outline: `2px solid ${accent}`, outlineOffset: 1 },
          },
          contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
          outlined: {
            borderColor: c.border,
            color: c.text,
            '&:hover': { borderColor: c.borderStrong, backgroundColor: c.subtle },
          },
          text: { color: c.muted, '&:hover': { color: c.text, backgroundColor: c.subtle } },
          sizeSmall: { minHeight: 28, paddingInline: 10, fontSize: '.78125rem' },
          sizeLarge: { minHeight: 36, paddingInline: 16 },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            padding: 6,
            color: c.muted,
            '&:hover': { color: c.text, backgroundColor: c.subtle },
            '&.Mui-focusVisible': { outline: `2px solid ${accent}`, outlineOffset: 1 },
          },
        },
      },

      MuiTextField: { defaultProps: { variant: 'outlined', margin: 'dense', size: 'small', fullWidth: true } },
      MuiFormControl: { defaultProps: { variant: 'outlined', margin: 'dense', size: 'small', fullWidth: true } },
      MuiInputLabel: { styleOverrides: { root: { fontSize: '.8125rem', color: c.muted } } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            minHeight: 34,
            fontSize: '.8125rem',
            backgroundColor: dark ? 'rgba(255,255,255,.02)' : c.surface,
            transition: 'box-shadow 120ms ease, border-color 120ms ease',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: c.border },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: c.borderStrong },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accent, borderWidth: 1 },
            '&.Mui-focused': { boxShadow: `0 0 0 3px ${ring}` },
          },
          input: { paddingBlock: 7 },
        },
      },

      /** Neutral by default. A status earns its colour from `color`, at the call site. */
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            height: 22,
            fontSize: '.75rem',
            fontWeight: 550,
            backgroundColor: c.subtle,
            color: c.text,
            border: `1px solid ${c.borderSubtle}`,
          },
          label: { paddingInline: 8 },
          colorPrimary: {
            backgroundColor: dark ? 'rgba(79,192,141,.14)' : fern[50],
            color: dark ? '#8FDCB8' : fern[700],
            borderColor: dark ? 'rgba(79,192,141,.24)' : fern[200],
          },
          colorError: {
            backgroundColor: dark ? 'rgba(240,115,106,.14)' : '#FDF0EF',
            color: dark ? '#F0736A' : '#C1372F',
            borderColor: dark ? 'rgba(240,115,106,.26)' : '#F3CFCC',
          },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: c.borderSubtle, paddingBlock: 8, paddingInline: 12, fontSize: '.8125rem' },
          head: {
            color: c.muted,
            backgroundColor: c.subtle,
            fontSize: '.75rem',
            fontWeight: 550,
            letterSpacing: 0,
            textTransform: 'none',
            paddingBlock: 9,
            borderBottom: `1px solid ${c.border}`,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 100ms ease',
            '&:hover': { backgroundColor: c.subtle },
            '&.Mui-selected, &.Mui-selected:hover': {
              backgroundColor: dark ? 'rgba(79,192,141,.10)' : fern[50],
            },
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: dark ? '#2A2F35' : '#1A1D21',
            fontSize: '.75rem',
            borderRadius: 6,
            paddingBlock: 5,
            paddingInline: 8,
          },
        },
      },
      MuiMenu: {
        styleOverrides: { paper: { borderRadius: 8, boxShadow: overlay, border: `1px solid ${c.border}` } },
      },
      MuiMenuItem: {
        styleOverrides: { root: { fontSize: '.8125rem', minHeight: 32, borderRadius: 5, marginInline: 4 } },
      },
      MuiDivider: { styleOverrides: { root: { borderColor: c.borderSubtle } } },
      MuiSkeleton: { styleOverrides: { root: { backgroundColor: c.sunken, borderRadius: 6 } } },

      RaAppBar: {
        styleOverrides: {
          root: {
            '& .RaAppBar-toolbar': { minHeight: 52, paddingInline: 14 },
            '& .RaAppBar-menuButton': { marginRight: 6 },
          },
        },
      },
      RaLayout: {
        styleOverrides: {
          root: {
            '& .RaLayout-appFrame': { marginTop: 52 },
            '& .RaLayout-content': { padding: '20px 24px 28px', backgroundColor: c.canvas },
          },
        },
      },
      RaMenuItemLink: {
        styleOverrides: {
          root: {
            minHeight: 34,
            margin: '1px 8px',
            paddingInline: 10,
            borderRadius: 6,
            fontSize: '.8125rem',
            fontWeight: 500,
            color: c.muted,
            transition: 'background-color 100ms ease, color 100ms ease',
            '& .MuiListItemIcon-root': {
              minWidth: 30,
              color: 'inherit',
              '& .MuiSvgIcon-root': { fontSize: 18 },
            },
            '&:hover': { color: c.text, backgroundColor: c.subtle },
            '&.RaMenuItemLink-active': {
              color: dark ? '#8FDCB8' : fern[700],
              fontWeight: 600,
              backgroundColor: dark ? 'rgba(79,192,141,.11)' : fern[50],
              '& .MuiSvgIcon-root': { color: accent },
            },
          },
        },
      },
      RaDatagrid: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            overflow: 'hidden',
            border: `1px solid ${c.border}`,
            '& .RaDatagrid-headerCell': { color: c.muted },
          },
        },
      },
      RaToolbar: {
        styleOverrides: {
          root: {
            backgroundColor: 'transparent',
            borderTop: `1px solid ${c.borderSubtle}`,
            marginTop: 16,
            paddingTop: 16,
          },
        },
      },
    },
  };
};

export const fougereLightTheme = createFougereTheme('light');
export const fougereDarkTheme = createFougereTheme('dark');

type Sprig = { from: readonly [number, number]; via: readonly [number, number]; to: readonly [number, number] };

const MAIN: Sprig = { from: [14.5, 29.5], via: [11.5, 16.5], to: [18.4, 8.1] };
const SIDE: Sprig = { from: [15.5, 26.5], via: [21, 21], to: [25.5, 13.5] };

function leaflets(
  { from, via, to }: Sprig,
  count: number,
  maxLength: number,
  maxWidth: number,
  span: readonly [number, number],
): string[] {
  const [bx, by] = from; const [cx, cy] = via; const [tx, ty] = to;
  const at = (t: number) => [
    (1 - t) ** 2 * bx + 2 * (1 - t) * t * cx + t ** 2 * tx,
    (1 - t) ** 2 * by + 2 * (1 - t) * t * cy + t ** 2 * ty,
  ] as const;
  const along = (t: number) => {
    const dx = 2 * (1 - t) * (cx - bx) + 2 * t * (tx - cx);
    const dy = 2 * (1 - t) * (cy - by) + 2 * t * (ty - cy);
    const n = Math.hypot(dx, dy);

    return [dx / n, dy / n] as const;
  };
  const r = (n: number) => n.toFixed(2);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = span[0] + i * ((span[1] - span[0]) / (count - 1));
    const [px, py] = at(t);
    const [ax, ay] = along(t);
    const length = maxLength * (1 - 0.55 * t);
    const width = maxWidth * (1 - 0.35 * t);
    for (const side of [1, -1]) {
      const kx = -ay * side + ax * 0.52;
      const ky = ax * side + ay * 0.52;
      const k = Math.hypot(kx, ky);
      const [dx, dy] = [kx / k, ky / k];
      const [ex, ey] = [px + dx * length, py + dy * length];
      const [mx, my] = [px + dx * length * 0.42, py + dy * length * 0.42];
      out.push(
        `M${r(px)} ${r(py)}`
        + `C${r(mx - dy * width)} ${r(my + dx * width)} ${r(ex - dy * width * 0.35)} ${r(ey + dx * width * 0.35)} ${r(ex)} ${r(ey)}`
        + `C${r(ex + dy * width * 0.35)} ${r(ey - dx * width * 0.35)} ${r(mx + dy * width)} ${r(my - dx * width)} ${r(px)} ${r(py)}Z`,
      );
    }
  }

  return out;
}

const MAIN_LEAFLETS = leaflets(MAIN, 8, 6.2, 2.0, [0.06, 0.82]);
const SIDE_LEAFLETS = leaflets(SIDE, 5, 4.2, 1.6, [0.14, 0.86]);

const FERN_DEEP = '#5B9821';
const FERN_LIGHT = '#8DC02C';

export function FougereMark({ size = 28 }: { size?: number }): ReactElement {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g fill={FERN_DEEP}>
        <path d="M14.5 29.5Q11.5 16.5 18.4 8.1" fill="none" stroke={FERN_DEEP} strokeWidth="1.5" strokeLinecap="round" />
        <path
          d="M18.4 8.1c1.1-1.5 3.7-1.7 4 .5c.25 1.85-2.1 2.55-2.75 1.1"
          fill="none" stroke={FERN_DEEP} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        />
        {MAIN_LEAFLETS.map((d) => <path key={d} d={d} />)}
      </g>
      <g fill={FERN_LIGHT}>
        <path d="M15.5 26.5Q21 21 25.5 13.5" fill="none" stroke={FERN_LIGHT} strokeWidth="1.25" strokeLinecap="round" />
        {SIDE_LEAFLETS.map((d) => <path key={d} d={d} />)}
      </g>
    </svg>
  );
}

export function FougereAppBar(props: AppBarProps): ReactElement {
  return (
    <AppBar {...props} color="inherit" elevation={0}>
      <span
        aria-label="Fougere"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexShrink: 0 }}
      >
        <span style={{ display: 'inline-flex', color: 'var(--mui-palette-primary-main, #2d5933)' }}>
          <FougereMark />
        </span>
        <span style={{ fontSize: 16, fontWeight: 750, letterSpacing: '-0.025em' }}>Fougere</span>
      </span>
      <span
        aria-hidden="true"
        style={{ width: 1, height: 24, margin: '0 18px', background: 'currentColor', opacity: 0.12 }}
      />
      <TitlePortal style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, opacity: 0.68 }} />
    </AppBar>
  );
}

const TopologyIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}><path d="M12 2a3 3 0 0 1 1 5.83V10h4a3 3 0 0 1 3 3v1.17a3 3 0 1 1-2 0V13a1 1 0 0 0-1-1h-4v2.17a3 3 0 1 1-2 0V12H7a1 1 0 0 0-1 1v1.17a3 3 0 1 1-2 0V13a3 3 0 0 1 3-3h4V7.83A3 3 0 0 1 12 2Z" /></SvgIcon>
);

const FougereMenu = () => {
  const translate = useTranslate();

  return (
    <Menu>
      <Menu.DashboardItem />
      <Menu.ResourceItems />
      <Menu.Item
        to="/topology"
        primaryText={translate('fougere.admin.topology.title', { _: 'Topology' })}
        leftIcon={<TopologyIcon />}
      />
    </Menu>
  );
};

export function FougereLayout(props: LayoutProps): ReactElement {
  return <Layout {...props} appBar={FougereAppBar} menu={FougereMenu} />;
}
