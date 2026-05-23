import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

interface AppError extends Error {
  statusCode?: number
  code?: string
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError | AppError | ZodError, _req: FastifyRequest, reply: FastifyReply) => {
      // Zod validation errors → 400
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        })
      }

      const appErr = error as AppError
      const statusCode = appErr.statusCode ?? (error as FastifyError).statusCode ?? 500

      // Cancelled requests
      if (appErr.code === 'REQUEST_ABORTED') {
        return reply.status(499).send({ error: 'Client Closed Request' })
      }

      app.log.error({ err: error }, error.message)

      return reply.status(statusCode).send({
        error: error.message ?? 'Internal Server Error',
      })
    },
  )

  app.setNotFoundHandler((_req: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({ error: 'Not Found' })
  })
}
