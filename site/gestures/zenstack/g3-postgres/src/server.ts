import { RPCApiHandler } from '@zenstackhq/server/api';
import { ZenStackMiddleware } from '@zenstackhq/server/express';
import express from 'express';
import { schema } from '../zenstack/schema.ts';
import { db } from './db.ts';
import { digest } from './digest.ts';

const app = express();
app.use(express.json());
app.use('/api/model', ZenStackMiddleware({ apiHandler: new RPCApiHandler({ schema }), getClient: () => db }));
digest(app);
app.listen(Number(process.env.PORT ?? 4000));
