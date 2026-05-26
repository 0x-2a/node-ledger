import type {FastifyError, FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {ZodError} from 'zod';
import {ErrorNameKey, ErrorNameStatusCodeMap, ErrorTypeMap, TypedErr} from '../errors/errors';
import {getLogger} from '../config/logger';

export function registerErrorHandler(app: FastifyInstance): void {
  const logger = getLogger();

  app.setErrorHandler((
          error: FastifyError | TypedErr | ZodError,
          _: FastifyRequest,
          reply: FastifyReply
      ) => {
        // Handle Zod validation errors → 400.
        if (error instanceof ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            details: error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          });
        }

        // Handle typed application errors.
        if (error instanceof TypedErr) {
          const errTypeKey = error.typeKey || ErrorTypeMap.Unknown;
          const message = error.message || 'Unknown error';
          const errStatus = ErrorNameStatusCodeMap[errTypeKey as ErrorNameKey];

          if (errTypeKey === ErrorTypeMap.Unknown) {
            logger.error({err: error}, 'Unhandled error');
          }

          return reply.status(errStatus).send({
            code: errTypeKey,
            message: message,
          });
        }

        // Handle fastify or remaining unhandled errors.
        const fastifyError = error as FastifyError;
        const statusCode = fastifyError.statusCode || 500;

        logger.error({err: error}, error.message || 'Unhandled error');

        return reply.status(statusCode).send({
          error: error.message ?? 'Internal Server Error',
        });
      },
  );

  app.setNotFoundHandler((_req: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({error: 'Not Found'});
  });
}
