import { Card, type SchemaView } from '@fougere/schema';
import { ErrorCode, FougereError, refusalsOf, toHttpError } from '@fougere/core';
import { generateRoutes, type AppLike, type RouteDefinition } from '../routes/RouteDefinition.js';
import type { OperationMeta } from '../routes/OperationMeta.js';

type Schema = Record<string, unknown>;

/** OpenAPI 3.1 — the part of it this writes. */
export interface OpenApiDocument {
  openapi: '3.1.0';
  info: { title: string; version: string };
  tags: { name: string }[];
  paths: Record<string, Record<string, Schema>>;
  components: { schemas: Record<string, Schema> };
}

/** What every refusal answers, whatever the door: `toHttpError`'s body. */
const REFUSAL: Schema = {
  type: 'object',
  properties: {
    code: { type: 'string', enum: Object.values(ErrorCode) },
    message: { type: 'string' },
    details: {},
  },
  required: ['code', 'message'],
};

/**
 * What this process serves on REST, as OpenAPI 3.1 — read off the routes `generateRoutes` already
 * answers, never declared beside them. A schema is the card's descriptor, which IS JSON Schema; a
 * refusal is the op's own `errors` and the half the framework implies, at the status the door says.
 */
export function openApiOf(app: AppLike): OpenApiDocument {
  const schemas: Record<string, Schema> = { Refusal: REFUSAL };
  const named = new Map<SchemaView, string>();
  // An entity keeps its own name; a view cut from it is named by where it is used — `PostUpdateInput` —
  // unless it states what a schema already written states. What a view borrowed from is not a shape.
  const refOf = (view: SchemaView, usedAs: string): Schema => {
    let name = named.get(view);
    if (!name) {
      const { 'x-fougere-derived': derived, ...descriptor } = Card.fromSchema(view).descriptor;
      // A patch view requires nothing: every field it carries is a change, and none must be sent.
      const patch = view.getOpts().patch === true;
      if (patch) delete descriptor.required;
      descriptor.properties = writtenBy(descriptor.properties as Record<string, Schema>, patch) as typeof descriptor.properties;
      const shape = JSON.stringify(descriptor);
      name = Object.keys(schemas).find((one) => JSON.stringify(schemas[one]) === shape);
      if (!name) {
        const title = descriptor.title ?? 'Row';
        const wanted = derived ? title + usedAs : title;
        name = wanted;
        for (let n = 2; schemas[name]; n++) name = `${wanted}${n}`;
        // A reader shows a schema by its title, so a view says its own name and not its entity's.
        schemas[name] = { ...descriptor, title: name } as unknown as Schema;
      }
      named.set(view, name);
    }

    return { $ref: `#/components/schemas/${name}` };
  };

  const paths: OpenApiDocument['paths'] = {};
  const tags = new Set<string>();
  for (const route of generateRoutes(app)) {
    const meta = app.operationsFor(route.address)?.get(route.operationName);
    if (!meta) continue;
    const frond = app.fronds.find((one) => one.handlers.some((handler) => handler.address === route.address))!.name;
    tags.add(frond);
    const path = route.path.replace(/:(\w+)/g, '{$1}');
    paths[path] = { ...paths[path], [route.method.toLowerCase()]: operationOf(route, meta, frond, refOf) };
  }

  return {
    openapi: '3.1.0',
    info: { title: [...tags].join(', ') || 'API', version: 'unversioned' },
    tags: [...tags].map((name) => ({ name })),
    paths,
    components: { schemas },
  };
}

function operationOf(route: RouteDefinition, meta: OperationMeta, frond: string, refOf: (view: SchemaView, usedAs: string) => Schema): Schema {
  const inPath = new Set([...route.path.matchAll(/:(\w+)/g)].map((match) => match[1]!));
  const params = (meta.binding ?? []).flatMap(({ source, optional }) => (source.kind === 'param' ? [{ ...source, optional }] : []));
  const reads = route.method === 'GET' || route.method === 'DELETE';
  const parameters = params
    .filter((param) => inPath.has(param.name) || reads)
    .map((param) => ({
      name: param.name,
      in: inPath.has(param.name) ? 'path' : 'query',
      required: inPath.has(param.name) || !param.optional,
      schema: { type: param.coerce ?? 'string' },
    }));

  const operation = route.operationName[0]!.toUpperCase() + route.operationName.slice(1);

  return {
    operationId: `${route.address}.${route.operationName}`,
    tags: [frond],
    ...(meta.description && { description: meta.description }),
    ...(parameters.length > 0 && { parameters }),
    ...requestBodyOf(meta, reads ? [] : params.filter((param) => !inPath.has(param.name)), (view) => refOf(view, `${operation}Input`)),
    responses: responsesOf(route, meta, inPath.size > 0, (view) => refOf(view, `${operation}Output`)),
  };
}

/** The input view whole, or the fields a change carries — the path designates, the body carries what changes. */
function requestBodyOf(
  meta: OperationMeta,
  carried: { name: string; coerce?: string; optional: boolean }[],
  refOf: (view: SchemaView) => Schema,
): Schema {
  if (meta.input) return { requestBody: { required: true, content: { 'application/json': { schema: refOf(meta.input) } } } };
  if (carried.length === 0) return {};

  const schema: Schema = {
    type: 'object',
    properties: Object.fromEntries(carried.map((param) => [param.name, { type: param.coerce ?? 'string' }])),
    required: carried.filter((param) => !param.optional).map((param) => param.name),
  };

  return { requestBody: { required: true, content: { 'application/json': { schema } } } };
}

function responsesOf(route: RouteDefinition, meta: OperationMeta, designates: boolean, refOf: (view: SchemaView) => Schema): Record<string, Schema> {
  const responses: Record<string, Schema> = {};
  const answers = meta.output && meta.cardinality !== 'none' && route.method !== 'DELETE';
  if (answers) {
    const row = refOf(meta.output!);
    const schema = meta.cardinality === 'page' ? pageOf(row) : meta.cardinality === 'many' ? { type: 'array', items: row } : row;
    responses[String(route.successStatus ?? (route.creates ? 201 : 200))] = { description: 'Answered.', content: { 'application/json': { schema } } };
  } else {
    responses[String(route.successStatus ?? 204)] = { description: 'Done, nothing to answer.' };
  }

  for (const answer of route.responses ?? []) {
    responses[String(answer.status)] = {
      description: 'Answered in the op\'s place by a door middleware.',
      ...(answer.headers && { headers: Object.fromEntries(answer.headers.map((name) => [name, { schema: { type: 'string' } }])) }),
    };
  }

  const missing = designates && (route.method === 'DELETE' || meta.cardinality === 'one' || meta.cardinality === 'maybe');
  const codes = new Set([...refusalsOf({ kind: meta.kind, input: meta.input, errors: meta.errors }), ...(missing ? [ErrorCode.NOT_FOUND] : [])]);
  const refusedAt = new Map<number, ErrorCode[]>();
  for (const code of codes) {
    const { status } = toHttpError(new FougereError({ code, message: code }));
    refusedAt.set(status, [...(refusedAt.get(status) ?? []), code]);
  }
  // Each status names its own codes, so a reader's example is one this status can answer.
  for (const [status, refused] of refusedAt) {
    responses[String(status)] = {
      description: `Refused: ${refused.join(', ')}.`,
      content: {
        'application/json': {
          schema: { allOf: [{ $ref: '#/components/schemas/Refusal' }, { properties: { code: { enum: refused } } }] },
          example: { code: refused[0], message: 'What was refused, in words.' },
        },
      },
    };
  }

  return responses;
}

/**
 * What the lifecycle axis says of who writes a field, in OpenAPI's words: a value the server fills
 * at creation is `readOnly`, so no request sends it; a field no update may change is not in a patch.
 */
function writtenBy(properties: Record<string, Schema>, patch: boolean): Record<string, Schema> {
  return Object.fromEntries(Object.entries(properties).flatMap(([key, property]) => {
    const lifecycle = (property['x-fougere'] as { lifecycle?: { create?: unknown; update?: unknown } } | undefined)?.lifecycle;
    if (patch && lifecycle?.update === 'forbidden') return [];
    const filled = lifecycle?.create === 'now' || (typeof lifecycle?.create === 'object' && lifecycle.create !== null && 'generate' in lifecycle.create);

    return [[key, filled ? { ...property, readOnly: true } : property]];
  }));
}

function pageOf(row: Schema): Schema {
  return {
    type: 'object',
    properties: {
      items: { type: 'array', items: row },
      total: { type: 'integer' },
      hasMore: { type: 'boolean' },
      endCursor: { type: 'string' },
    },
    required: ['items'],
  };
}
