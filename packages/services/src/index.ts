import { Format, type Accepted } from '@fougere/schema';
import { ServiceTypes, serviceFormat } from '@fougere/core';

const PROCESS = serviceFormat('service/process')
  .key('command', Format.text)
  .needs('type', 'port', 'command')
  .closed();

const DOCKER = serviceFormat('service/docker')
  .key('image', Format.text)
  .key('args', Format.text)
  .needs('type', 'port', 'image')
  .closed();

declare module '@fougere/core' {
  interface FougereServices {
    process: Accepted<typeof PROCESS>;
    docker: Accepted<typeof DOCKER>;
  }
}

ServiceTypes.register('process', { format: PROCESS, command: (entry) => entry.command });

ServiceTypes.register('docker', {
  format: DOCKER,
  command: (entry, name) => [
    'docker run --rm',
    `--name fougere-${name}`,
    `-p ${entry.port}:${entry.port}`,
    entry.image,
    ...(entry.args ? [entry.args] : []),
  ].join(' '),
});
