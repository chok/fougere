export default class ArticleHandler {
  async ping(): Promise<string> { return 'pong'; }

  async archive(id: string): Promise<string> { return this.slugOf(id); }

  private slugOf(text: string): string { return text.toLowerCase(); }
}
