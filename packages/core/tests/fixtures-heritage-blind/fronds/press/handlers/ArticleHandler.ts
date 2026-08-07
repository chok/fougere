import { BaseReporting } from '../BaseReporting.js';

export default class ArticleHandler extends BaseReporting {
  /** Une opération que le scan voit très bien. */
  async ping(): Promise<string> {
    return 'pong';
  }
}
