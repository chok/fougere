'use client';

/**
 * The shape of the system, drawn from what the app says about itself.
 *
 * Every other page in this panel renders a DOOR — a list, a form, a row. This one renders
 * the app: which fronds run in the process it is talking to, which answered from somewhere
 * else, and who called whom. Nothing here is configured, and nothing is declared: a frond
 * is remote because it answered a call nobody hosts.
 *
 * It is served by `@fougere/observability`, so its absence is a legible state and not an
 * error — which is why the entry stays in the menu when nothing answers. Hiding it would
 * hide the one place that can say what is missing.
 */
import { Box, Card, CardContent, Chip, Skeleton, Typography } from '@mui/material';
import { useEffect, useState, type ReactElement } from 'react';
import { Title, useTranslate } from 'react-admin';
import { CALL_ENDPOINT, fetcher as browserFetcher, type Fetcher } from '@fougere/app/client';
import { fetchTopology, isOpaque, nodesOf, type Edge, type TopologyNode, type TopologyReport } from './topology.js';

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
            color={here ? 'primary' : 'default'}
            label={here ? label('topology.here', 'here') : label('topology.elsewhere', 'elsewhere')}
          />
        </Row>
        {/*
          A remote publishes its own shape under its own service name, so this panel can say
          the frond is reachable and cannot say what it holds. Naming that beats drawing an
          empty frond, which reads as a frond with nothing in it.
        */}
        <Typography variant="body2" color="text.secondary">
          {isOpaque(node)
            ? label('topology.opaque', 'Its shape is published by the process that owns it.')
            : `${label('topology.entities', `${node.entities} entities`, { smart_count: node.entities })}`
              + ` · ${label('topology.doors', `${node.doors} doors`, { smart_count: node.doors })}`}
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
  const elsewhere = nodes.filter((node) => node.placement === 'remote').length;

  return (
    <Box sx={{ p: 3, display: 'grid', gap: 2 }}>
      {title}
      <Row>
        <Typography variant="body2" color="text.secondary">
          {label('topology.here_count', `${nodes.length - elsewhere} here`, { smart_count: nodes.length - elsewhere })}
          {' · '}
          {label('topology.elsewhere_count', `${elsewhere} elsewhere`, { smart_count: elsewhere })}
          {' · '}
          {label('topology.paths', `${state.report.edges.length} observed call paths`, { smart_count: state.report.edges.length })}
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
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {nodes.map((node) => <FrondCard key={node.frond} node={node} />)}
      </Box>
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
