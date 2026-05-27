import type {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

/**
 * Attaches an AbortController to every request so route handlers can honor
 * client disconnects (analogous to context done/cancel in other languages).
 *
 * Access via `request.signal` in any route handler.
 */
async function abortPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (request) => {
    const controller = new AbortController();
    (request as {signal: AbortSignal}).signal = controller.signal;

    // Fire when the underlying socket closes before a response is sent
    request.raw.on('close', () => {
      if (!request.raw.complete) {
        controller.abort();
      }
    });
  });
}

export default fp(abortPlugin, {name: 'abort-plugin'});
