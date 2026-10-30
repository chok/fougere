export default abstract class Mailer {
  abstract send(subject: string): Promise<void>;
}
