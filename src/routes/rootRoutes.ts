import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import moment from 'moment-timezone';

export function registerRootRoutes(
    app: FastifyInstance,
): void {
  app.get('/', async (_: FastifyRequest, reply: FastifyReply): Promise<never> => {
        return reply.send({
          status: 'healthy',
          timestamp: moment().valueOf(),
        });
      },
  );
}
