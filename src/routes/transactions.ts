import type { FastifyInstance } from 'fastify'
import type { TransactionService } from '../services/transaction.service.js'
import { CreateTransactionSchema } from '../models/schemas.js'

export function registerTransactionRoutes(
  app: FastifyInstance,
  transactionService: TransactionService,
): void {
  /** POST /transactions */
  app.post('/transactions', async (request, reply) => {
    const body = CreateTransactionSchema.parse(request.body)
    const transaction = await transactionService.create(body, request.signal)
    return reply.status(201).send(transaction)
  })
}
