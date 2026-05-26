import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import type {AccountService} from '../services/account.service';
import {CreateAccountSchema} from '../models/schemas';
import type {CreateAccountRequest} from '../models';

export function registerAccountRoutes(
    app: FastifyInstance,
    accountService: AccountService,
): void {
  app.post('/accounts', async (
      request: FastifyRequest,
      reply: FastifyReply
  ) => {
    const body = CreateAccountSchema.parse(request.body);

    const accountReq: CreateAccountRequest = {
      id: body.id || '',
      name: body.name,
      balance: body.balance,
      direction: body.direction,
    };

    const accountRes = await accountService.create(accountReq);

    return reply.status(201).send(accountRes);
  });

  /** GET /accounts/:id */
  app.get('/accounts/:id', async (
          request: FastifyRequest<{Params: {id: string}}>,
          reply: FastifyReply,
      ) => {
        const account = await accountService.getById(request.params.id);

        return reply.send(account);
      },
  );
}
