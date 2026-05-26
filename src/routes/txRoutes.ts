import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import type {TransactionService} from '../services/transaction.service';
import {CreateTransactionSchema} from '../models/schemas';
import {Transaction} from '../models';

export function registerTransactionRoutes(
    app: FastifyInstance,
    transactionService: TransactionService,
): void {
  /** POST /transactions */
  app.post('/transactions', async (
      request: FastifyRequest,
      reply: FastifyReply
  ) => {
    const transactionReq = CreateTransactionSchema.parse(request.body) as Transaction;
    const abortSignal = request.signal;

    const transactionRes = await transactionService.create(transactionReq, abortSignal);

    return reply.status(201).send(transactionRes);
  });
}
