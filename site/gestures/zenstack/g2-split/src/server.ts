import express from 'express';
import { digest } from './digest.ts';

const app = express();
app.use(express.json());
digest(app);
app.listen(Number(process.env.PORT ?? 4000));
