import Mailer from './Mailer.js';

export default class ConsoleMailer extends Mailer {
  async send(subject: string): Promise<void> {
    console.log(`mail: ${subject}`);
  }
}
