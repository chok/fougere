import { BaseReporting } from '../BaseReporting.js';

export default class ArticleHandler extends BaseReporting {
  async ping(): Promise<string> { return 'pong'; }
}
