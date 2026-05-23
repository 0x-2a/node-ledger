import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { z } from 'zod'

const TlsSchema = z.object({
  key: z.string(),
  cert: z.string(),
})

const HttpSchema = z.object({
  bodyLimit: z.number().int().positive().default(1_048_576),
  connectionTimeout: z.number().int().positive().default(10_000),
  keepAliveTimeout: z.number().int().positive().default(72_000),
  requestTimeout: z.number().int().positive().default(30_000),
})

const ServerSchema = z.object({
  protocol: z.enum(['http', 'https']).default('http'),
  host: z.string().default('0.0.0.0'),
  port: z.number().int().positive().default(3000),
  tls: TlsSchema.optional(),
  http: HttpSchema.default({}),
})

const LoggingSchema = z.object({
  format: z.enum(['json', 'console']).default('console'),
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
})

const CorsSchema = z.object({
  origin: z.union([z.string(), z.array(z.string())]).default('*'),
  methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
})

const ConfigSchema = z.object({
  server: ServerSchema.default({}),
  logging: LoggingSchema.default({}),
  cors: CorsSchema.default({}),
})

export type Config = z.infer<typeof ConfigSchema>

let _config: Config | null = null

export function loadConfig(configPath?: string): Config {
  if (_config) return _config

  const filePath = configPath ?? path.resolve(process.cwd(), 'config.yaml')

  let raw: unknown = {}
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8')
    raw = yaml.load(content) ?? {}
  }

  const parsed = ConfigSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid config: ${parsed.error.message}`)
  }

  _config = parsed.data
  return _config
}

/** Reset cached config (useful in tests) */
export function resetConfig(): void {
  _config = null
}
