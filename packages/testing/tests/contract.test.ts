/**
 * The whole file, for one entity. Every line below comes from `Article`'s declaration.
 */
import { join } from 'node:path';
import { testApp, checkContract, checkOutput } from '../src/index.js';
import Article from './fixtures/fronds/press/entities/Article.js';

const app = await testApp({ root: join(import.meta.dirname, 'fixtures') });

checkContract(app, Article);
checkOutput(app, Article);
