import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {z} from 'zod';

// Schemas and defaults for loading config.yaml
//

// HTTPS TLS Cert Paths
const TlsSchema = z.object({
  key: z.string(),
  cert: z.string(),
});

// HTTP/S Server Request/Response Limitations
const HttpSchema = z.object({
  bodyLimit: z.number().int().positive().default(1_048_576), // bytes
  connectionTimeout: z.number().int().positive().default(10_000), // millis
  keepAliveTimeout: z.number().int().positive().default(60_000), // millis
  requestTimeout: z.number().int().positive().default(30_000), // millis
});

// HTTP/S Server Core Options
const ServerSchema = z.object({
  protocol: z.enum(['http', 'https']).default('http'),
  host: z.string().default('0.0.0.0'),
  port: z.number().int().positive().default(3000),
  tls: TlsSchema.optional(),
  http: HttpSchema.default({}),
});

// HTTP/S Server Cross Origin Definitions
const CorsSchema = z.object({
  origin: z.union([z.string(), z.array(z.string())]).default('*'),
  methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
});

// Logger Options
const LoggingSchema = z.object({
  format: z.enum(['json', 'console']).default('console'),
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
});

// High-Level Config Definition
const ConfigSchema = z.object({
  server: ServerSchema.default({}),
  logging: LoggingSchema.default({}),
  cors: CorsSchema.default({}),
});

export type Config = z.infer<typeof ConfigSchema>

let _config: Config | null = null;

/**
 * Loads the application configuration from disk, caching the result.
 *
 * @param cfgFilePath - Optional path to the config file. Can be absolute
 * or relative to the current working directory.
 * @returns The loaded configuration object.
 *
 * @throws If the config file cannot be read or parsed.
 */
export function loadConfig(cfgFilePath?: string): Config {
  if (_config) {
    return _config;
  }

  let filePath: string;
  if (!cfgFilePath) {
    // Use default location.
    filePath = path.resolve(process.cwd(), 'config.yaml');
  } else if (path.isAbsolute(cfgFilePath)) {
    // Use absolute path.
    filePath = cfgFilePath;
  } else {
    // Use relative path.
    filePath = path.resolve(process.cwd(), cfgFilePath);
  }

  let cfgObject: unknown = {};
  if (fs.existsSync(filePath)) {
    const fileStr = fs.readFileSync(filePath, 'utf8');
    cfgObject = yaml.load(fileStr) || {};
  }

  const parsedCfg = ConfigSchema.safeParse(cfgObject);
  if (!parsedCfg.success) {
    throw new Error(`Invalid config: ${parsedCfg.error.message}`);
  }

  _config = parsedCfg.data;

  return _config;
}

/** Reset cached config (useful in tests) */
export function resetConfig(): void {
  _config = null;
}
