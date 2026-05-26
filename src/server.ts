import {loadConfig} from './config';
import {buildApp} from './app';
import {FastifyListenOptions} from 'fastify/types/instance';

async function start() {
  const config = loadConfig();
  const app = await buildApp({config});

  const {host, port} = config.server;
  const opts: FastifyListenOptions = {
    host,
    port,
  };

  await app.listen(opts);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
