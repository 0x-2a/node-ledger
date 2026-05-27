import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import type {TransactionService} from '../services/transaction.service';
import {TransactionReqSchema} from '../models/schemas';
import {Transaction} from '../models';

export function registerTransactionRoutes(
    app: FastifyInstance,
    transactionService: TransactionService,
): void {
  app.post('/transactions', async (
      request: FastifyRequest,
      reply: FastifyReply
  ): Promise<never> => {
    // Handle client hang-up during request.
    const abortSignal = request.signal;

    const transactionReq = TransactionReqSchema.parse(request.body) as Transaction;

    const transactionRes = await transactionService.create(transactionReq, abortSignal);

    return reply.status(201).send(transactionRes);
  });
}
