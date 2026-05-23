import type { FastifyInstance } from 'fastify'
import type { AccountService } from '../services/account.service.js'
import { CreateAccountSchema } from '../models/schemas.js'

export function registerAccountRoutes(
  app: FastifyInstance,
  accountService: AccountService,
): void {
  /** POST /accounts */
  app.post('/accounts', async (request, reply) => {
    const body = CreateAccountSchema.parse(request.body)
    const account = await accountService.create(body)
    return reply.status(201).send(account)
  })

  /** GET /accounts/:id */
  app.get<{ Params: { id: string } }>(
    '/accounts/:id',
    async (request, reply) => {
      const account = await accountService.getById(request.params.id)
      return reply.send(account)
    },
  )
}
