/**
 * Serveur demo — Hono + GraphiQL avec schema genere depuis les entites fougere
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createHonoRouter } from '@fougere/http';
import { registerGraphQL } from '@fougere/schema-graphql';
import { graphqlSchema } from './adapter-graphql.js';

const hono = new Hono();
const router = createHonoRouter(hono);

registerGraphQL(router, graphqlSchema);

const port = 4000;
serve({ fetch: hono.fetch, port });
const url = `http://localhost:${port}`;

console.log(`
  🌿 Fougere Demo Server

  GraphQL:   ${url}/graphql
  GraphiQL:  ${url}/graphql  (open in browser)

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
