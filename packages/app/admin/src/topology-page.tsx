'use client';

/**
 * The shape of the system, drawn from what the app says about itself.
 *
 * Every other page in this panel renders a DOOR — a list, a form, a row. This one renders
 * the app: which fronds run in the process it is talking to, which answered from somewhere
 * else, who called whom — and which the config names but nothing has ever answered from.
 * The first three are OBSERVED: a frond is elsewhere because it answered, never because
 * `remotes:` said so. The fourth is the only declared one, and it is the only one the
 * observed half cannot hold — a frond that never answered is absent from it.
 *
 * It is served by `@fougere/observability`, so its absence is a legible state and not an
 * error — which is why the entry stays in the menu when nothing answers. Hiding it would
 * hide the one place that can say what is missing.
 */
import { Box, Card, CardContent, Chip, Skeleton, Typography, type Theme } from '@mui/material';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Title, useTranslate } from 'react-admin';
import { CALL_ENDPOINT, fetcher as browserFetcher, type Fetcher } from '@fougere/app/client';
import { fetchTopology, figureOf, isOpaque, layoutOf, nodesOf, type Edge, type TopologyNode, type TopologyReport } from './topology.js';

/** What the page is: the report, the refusal that means "not observed", or a real failure. */
type State =
  | { status: 'loading' }
  | { status: 'served'; report: TopologyReport }
  | { status: 'unobserved' }
  | { status: 'failed'; error: unknown };

/**
 * Every sentence this page draws goes through a key. Nothing under `@fougere/admin` is
 * written in a language — the counts below carry `smart_count`, which is what lets a
 * translation pick its own plural rather than inherit English's.
 */
function useLabels() {
  const translate = useTranslate();
  return (key: string, fallback: string, options?: Record<string, unknown>) =>
    translate(`fougere.admin.${key}`, { _: fallback, ...options });
}

const Row = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>{children}</Box>
);

/** One call path, with its refusals — the only number here that is a health signal. */
function EdgeLine({ edge, direction }: { edge: Edge; direction: 'out' | 'in' }): ReactElement {
  const label = useLabels();
  return (
    <Row>
      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
        {direction === 'out' ? `→ ${edge.to}` : `← ${edge.from}`}
      </Typography>
      <Typography variant="caption" color="text.secondary">{edge.count}</Typography>
      {edge.errors > 0 && (
        <Chip
          size="small"
          color="error"
          label={label('topology.refused', `${edge.errors} refused`, { smart_count: edge.errors })}
        />
      )}
    </Row>
  );
}

/**
 * A palette path as SVG paint. `sx` resolves `'error.main'` for `color` and `bgcolor` and for
 * nothing else, so `fill` and `stroke` reach CSS verbatim — an invalid value, and SVG falls back
 * to BLACK. Every shape on this page is painted through here.
 */
function paint(paths: { fill?: string; stroke?: string }) {
  const read = (theme: Theme, path: string) =>
    path.split('.').reduce<unknown>((held, key) => (held as Record<string, unknown>)?.[key], theme.palette) as string;

  return (theme: Theme) => ({
    ...(paths.fill ? { fill: read(theme, paths.fill) } : {}),
    ...(paths.stroke ? { stroke: read(theme, paths.stroke) } : {}),
  });
}

/** What a node is painted with, by the one thing that separates the three states. */
function toneOf(node: TopologyNode): 'primary' | 'grey' | 'warning' {
  if (node.silent) return 'warning';

  return node.placement === 'local' ? 'primary' : 'grey';
}

/**
 * The system, drawn. Placement is `layoutOf`'s — ranks, order and routing.
 *
 * The nodes are HTML over an SVG that draws only the lines, which is how React Flow is built and
 * why its nodes look like the rest of an app: a card is a `Box` with `sx`, so it reads the theme
 * like every other element. An SVG `<text>` positioned by hand does not.
 *
 * Both layers sit on ONE scale — the container takes the drawing's aspect ratio, and every node is
 * sized AND placed in per cent of it. A size in pixels does not grow with the viewBox the SVG
 * scales to its container, and the lines then stop short of the cards they point at.
 *
 * What the drawing says beyond who reaches whom: thickness is volume, a broken line is declared
 * and never travelled, and refusals are a figure rather than a red line — colour alone excludes a
 * reader who cannot see it, and "how many" is the question a red line raises without answering.
 */
function Graph({ nodes, selected, onSelect }: {
  nodes: readonly TopologyNode[];
  selected: string | undefined;
  onSelect: (frond: string) => void;
}): ReactElement {
  const label = useLabels();
  const drawing = useMemo(() => layoutOf(nodes), [nodes]);
  const per = (value: number, of: number) => `${(value / of) * 100}%`;

  return (
    <Card variant="outlined">
      <Box sx={{ position: 'relative', bgcolor: 'action.hover', aspectRatio: `${drawing.width} / ${drawing.height}` }}>
        <Box
          component="svg"
          viewBox={`0 0 ${drawing.width} ${drawing.height}`}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <defs>
            <marker id="fougere-arrow" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <Box component="path" d="M 0 0 L 8 4 L 0 8 z" sx={paint({ fill: 'text.disabled' })} />
            </marker>
          </defs>

          {drawing.edges.map((edge) => (
            <Box
              component="path"
              key={`${edge.from}-${edge.to}`}
              d={edge.path}
              fill="none"
              strokeLinecap="round"
              strokeWidth={edge.weight === undefined ? 1.5 : 1.5 + edge.weight * 3}
              strokeDasharray={edge.weight === undefined ? '2 5' : undefined}
              markerEnd="url(#fougere-arrow)"
              sx={[paint({ stroke: 'text.disabled' }), { strokeOpacity: 0.5 }]}
            />
          ))}
        </Box>

        {drawing.edges.map((edge) => edge.at && (
          <Box
            key={`figure-${edge.from}-${edge.to}`}
            sx={{
              position: 'absolute',
              left: per(edge.at.x, drawing.width),
              top: per(edge.at.y, drawing.height),
              transform: 'translate(-50%, -50%)',
              px: 0.75,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              fontFamily: 'monospace',
              fontSize: 11,
              fontWeight: 600,
              lineHeight: '17px',
              whiteSpace: 'nowrap',
              color: edge.errors > 0 ? 'error.main' : 'text.secondary',
            }}
          >
            {edge.count === undefined ? label('topology.noTraffic', 'no traffic') : figureOf(edge)}
          </Box>
        ))}

        {drawing.nodes.map(({ node, x, y, width, height }) => {
          const tone = toneOf(node);
          return (
            <Box
              key={node.frond}
              onClick={() => onSelect(node.frond)}
              sx={{
                position: 'absolute',
                left: per(x, drawing.width),
                top: per(y, drawing.height),
                width: per(width, drawing.width),
                height: per(height, drawing.height),
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 0.25,
                overflow: 'hidden',
                px: 1.25,
                borderRadius: 1.5,
                border: node.frond === selected ? 2 : 1.4,
                borderStyle: node.silent ? 'dashed' : 'solid',
                borderColor: tone === 'grey' ? 'divider' : `${tone}.main`,
                bgcolor: 'background.paper',
                cursor: 'pointer',
              }}
            >
              <Box sx={{ fontFamily: 'monospace', fontSize: 13.5, fontWeight: 600 }}>{node.frond}</Box>
              <Row>
                {/* A remote's two zeroes are not a measurement: its shape is published by the
                    process that owns it, so the card says WHERE it is instead of counting. */}
                {!node.silent && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>
                    {isOpaque(node)
                      ? label('topology.elsewhere', 'elsewhere')
                      : `${node.entities} · ${node.facades}`}
                  </Typography>
                )}
                {tone !== 'grey' && (
                  <Chip
                    size="small"
                    color={tone}
                    variant="outlined"
                    sx={{ height: 16, '& .MuiChip-label': { px: 0.75, fontSize: 9.5, letterSpacing: '0.05em' } }}
                    label={node.silent ? label('topology.unheard', 'unheard') : label('topology.here', 'here')}
                  />
                )}
              </Row>
            </Box>
          );
        })}
      </Box>
      <Box sx={{ px: 2, py: 1.25 }}>
        <Typography variant="caption" color="text.secondary">
          {label('topology.legend', 'Thickness is volume. A broken line is declared and never travelled. Click a frond for what it holds.')}
        </Typography>
      </Box>
    </Card>
  );
}

function FrondCard({ node }: { node: TopologyNode }): ReactElement {
  const label = useLabels();
  const here = node.placement === 'local';
  return (
    <Card variant="outlined">
      <CardContent sx={{ display: 'grid', gap: 1 }}>
        <Row>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{node.frond}</Typography>
          <Chip
            size="small"
            color={node.silent ? 'warning' : here ? 'primary' : 'default'}
            label={node.silent
              ? label('topology.unheard', 'declared, unheard')
              : here ? label('topology.here', 'here') : label('topology.elsewhere', 'elsewhere')}
          />
        </Row>
        {/*
          A remote publishes its own shape under its own service name, so this panel can say
          the frond is reachable and cannot say what it holds. Naming that beats drawing an
          empty frond, which reads as a frond with nothing in it.
        */}
        <Typography variant="body2" color="text.secondary">
          {node.silent
            ? label('topology.silent', `Declared at ${node.at ?? 'no address'} — nothing has answered from it.`, { at: node.at ?? '' })
            : isOpaque(node)
              ? label('topology.opaque', 'Its shape is published by the process that owns it.')
              : `${label('topology.entities', `${node.entities} entities`, { smart_count: node.entities })}`
                + ` · ${label('topology.facades', `${node.facades} facades`, { smart_count: node.facades })}`}
        </Typography>
        {node.calls.map((edge) => <EdgeLine key={`out-${edge.to}`} edge={edge} direction="out" />)}
        {node.calledBy.map((edge) => <EdgeLine key={`in-${edge.from}`} edge={edge} direction="in" />)}
      </CardContent>
    </Card>
  );
}

export interface FougereTopologyProps {
  endpoint?: string;
  fetcher?: Fetcher;
}

export function FougereTopology({ endpoint = CALL_ENDPOINT, fetcher = browserFetcher }: FougereTopologyProps = {}): ReactElement {
  const label = useLabels();
  const [state, setState] = useState<State>({ status: 'loading' });
  /** Which frond the detail below is about — the drawing answers "where", one card answers "what". */
  const [selected, setSelected] = useState<string>();

  useEffect(() => {
    let live = true;
    fetchTopology(endpoint, fetcher)
      .then((report) => { if (live) setState(report ? { status: 'served', report } : { status: 'unobserved' }); })
      .catch((error: unknown) => { if (live) setState({ status: 'failed', error }); });
    return () => { live = false; };
  }, [endpoint, fetcher]);

  const title = <Title title={label('topology.title', 'Topology')} />;

  if (state.status === 'loading') {
    return <Box sx={{ p: 3 }}>{title}<Skeleton height={120} /><Skeleton height={120} /></Box>;
  }

  if (state.status === 'unobserved') {
    return (
      <Box sx={{ p: 3, maxWidth: 620 }}>
        {title}
        <Card>
          <CardContent sx={{ display: 'grid', gap: 1.5 }}>
            <Typography variant="h6">{label('topology.unobservedTitle', 'This app is not observing itself')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {label(
                'topology.unobservedBody',
                'The shape of a system is read from inside the process it describes, and this one publishes none. Install @fougere/observability and declare it as an extension of the boot.',
              )}
            </Typography>
            <Typography component="pre" variant="caption" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', overflowX: 'auto' }}>
              {"import { observability } from '@fougere/observability';\n\nextensions: [observability()]"}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (state.status === 'failed') {
    return (
      <Box sx={{ p: 3, maxWidth: 620 }}>
        {title}
        <Card>
          <CardContent sx={{ display: 'grid', gap: 1.5 }}>
            <Typography variant="h6">{label('topology.failedTitle', 'The app did not answer')}</Typography>
            <Typography component="pre" variant="caption" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {(state.error as Error)?.message ?? String(state.error)}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const nodes = nodesOf(state.report);
  // Three counts because there are three ways of being known, and `elsewhere` means ANSWERED
  // from elsewhere: counting a frond that never answered among them makes the summary
  // contradict the card under it.
  const unheard = nodes.filter((node) => node.silent).length;
  const elsewhere = nodes.filter((node) => node.placement === 'remote' && !node.silent).length;
  const shown = nodes.find((node) => node.frond === selected) ?? nodes[0];
  const travelled = new Set(state.report.edges.map((edge) => `${edge.from} ${edge.to}`));
  const quiet = state.report.declared.edges.filter((edge) => !travelled.has(`${edge.from} ${edge.to}`)).length;

  return (
    <Box sx={{ p: 3, display: 'grid', gap: 2 }}>
      {title}
      <Row>
        <Typography variant="body2" color="text.secondary">
          {label('topology.here_count', `${nodes.length - elsewhere - unheard} here`, { smart_count: nodes.length - elsewhere - unheard })}
          {' · '}
          {label('topology.elsewhere_count', `${elsewhere} elsewhere`, { smart_count: elsewhere })}
          {unheard > 0 && <>
            {' · '}
            {label('topology.unheard_count', `${unheard} unheard`, { smart_count: unheard })}
          </>}
          {' · '}
          {label('topology.paths', `${state.report.edges.length} observed call paths`, { smart_count: state.report.edges.length })}
          {/* The two anomalies, counted where a reader looks first — not left to be found in the drawing. */}
          {quiet > 0 && <>
            {' · '}
            {label('topology.quiet_count', `${quiet} link without traffic`, { smart_count: quiet })}
          </>}
        </Typography>
        {/* Saturation: the one signal a static shape cannot carry. */}
        {state.report.active > 0 && (
          <Chip
            size="small"
            color="primary"
            label={label('topology.inFlight', `${state.report.active} in flight`, { smart_count: state.report.active })}
          />
        )}
      </Row>
      <Graph nodes={nodes} selected={shown?.frond} onSelect={setSelected} />
      {shown && <Box sx={{ maxWidth: 520 }}><FrondCard node={shown} /></Box>}
      {/*
        An edge is only knowable on the side that made the call, so a process with no
        outgoing call has none — that is ordinary, not a gap in the reading.
      */}
      {state.report.edges.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          {label('topology.noEdges', 'No call between fronds observed yet — an edge appears the first time one calls another.')}
        </Typography>
      )}
    </Box>
  );
}
