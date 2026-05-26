import {loadConfig} from './config';
import {buildApp} from './app';
import {FastifyListenOptions} from 'fastify/types/instance';
import {getLogger, initLogger} from './config/logger';

const configPath = process.env.ENV || 'config.yaml';
const config = loadConfig(configPath);

initLogger(config.logging);
const logger = getLogger();

async function start() {
  logger.info(`Loaded config file: ${configPath}`);

  const app = await buildApp({config});

  const {host, port} = config.server;

  const opts: FastifyListenOptions = {
    host,
    port,
  };

  logger.info(`Server listening on ${config.server.protocol}://${config.server.host}:${config.server.port} . . .`);

  await app.listen(opts);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
