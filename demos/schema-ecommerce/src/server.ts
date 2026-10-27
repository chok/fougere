/**
 * Demo server — Hono, and a GraphQL schema generated from the fougere entities, answered through
 * the door the adapter brings.
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { answerAt } from '@fougere/core';
import { graphqlDoor, type GraphQLDocument } from '@fougere/adapter-graphql';
import { graphqlSchema } from './adapter-graphql.js';

const door = graphqlDoor(graphqlSchema);
const hono = new Hono();
hono.post('/graphql', async (c) => {
  const { status, data } = await answerAt(door, {
    document: async () => (await c.req.json().catch(() => undefined)) as GraphQLDocument | undefined,
    state: {},
    headers: c.req.raw.headers,
  });

  return c.json(data as object, status as 200);
});

const port = 4000;
serve({ fetch: hono.fetch, port });
const url = `http://localhost:${port}`;

console.log(`
  🌿 Fougere Demo Server

  GraphQL:   POST ${url}/graphql

  Try these queries:

  query {
    products(limit: 10) {
      items {
        id
        name
        price
        stock
        category { name }
      }
      total
      hasMore
    }
  }

  query {
    orders(limit: 5, page: 1) {
      items {
        id
        status
        total
        customer { firstName lastName }
        lines {
          quantity
          unitPrice
          product { name }
        }
      }
      total
      hasMore
    }
  }

  mutation {
    createProduct(input: {
      categoryId: "<category-id>"
      name: "Nouvelle Fougere"
      price: 29.99
      stock: 25
    }) {
      id
      name
      price
    }
  }
`);
