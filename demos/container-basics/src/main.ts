import type { Container } from '@fougere/container';
import { createContainer } from '@fougere/container-fougere';

// --- Domain classes (no framework imports, no decorators) ---

class Logger {
  info(msg: string) {
    console.log(`[INFO] ${msg}`);
  }
}

class UserRepository {
  constructor(private logger: Logger) {}

  findAll() {
    this.logger.info('UserRepository.findAll()');
    return [
      { id: '1', name: 'Alice', email: 'alice@example.com' },
      { id: '2', name: 'Bob', email: 'bob@example.com' },
    ];
  }

  findById(id: string) {
    return this.findAll().find((u) => u.id === id) ?? null;
  }
}

class NotificationService {
  constructor(private logger: Logger) {}

  send(to: string, message: string) {
    this.logger.info(`→ ${to}: ${message}`);
  }
}

class UserService {
  constructor(
    private userRepository: UserRepository,
    private notificationService: NotificationService,
    private logger: Logger,
  ) {}

  listUsers() {
    return this.userRepository.findAll();
  }

  greetUser(id: string) {
    const user = this.userRepository.findById(id);
    if (!user) throw new Error(`User ${id} not found`);
    this.notificationService.send(user.email, `Hello ${user.name}!`);
    return user;
  }
}

// --- Bootstrap ---

function bootstrap(): Container {
  const container = createContainer();

  // Builtins (would be auto-registered by the framework later)
  container.register('Logger', Logger, { lifetime: 'singleton' });

  // Domain — deps declare constructor type names for type-based resolution
  container.register('UserRepository', UserRepository, { deps: ['Logger'] });
  container.register('NotificationService', NotificationService, { deps: ['Logger'] });
  container.register('UserService', UserService, { deps: ['UserRepository', 'NotificationService', 'Logger'] });

  return container;
}

// --- Run ---

const container = bootstrap();
const userService = container.resolve<UserService>('UserService');

console.log('\n=== List users ===');
console.log(userService.listUsers());

console.log('\n=== Greet user ===');
userService.greetUser('1');

// --- Scoped demo ---

console.log('\n=== Scoped container ===');
const scope = container.createScope();
scope.registerValue('requestId', 'req-abc-123');
console.log('requestId:', scope.resolve('requestId'));

console.log('\n✓ Done');
