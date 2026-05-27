import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import type {AccountService} from '../services/account.service';
import {AccountReqSchema} from '../models/schemas';
import type {AccountReq} from '../models';

export function registerAccountRoutes(
    app: FastifyInstance,
    accountService: AccountService,
): void {
  app.post('/accounts', async (
      request: FastifyRequest,
      reply: FastifyReply
  ): Promise<never> => {
    const body = AccountReqSchema.parse(request.body);

    const accountReq: AccountReq = {
      id: body.id || '',
      name: body.name,
      balance: body.balance,
      direction: body.direction,
    };

    const accountRes = await accountService.create(accountReq);

    return reply.status(201).send(accountRes);
  });

  app.get('/accounts/:id', async (
          request: FastifyRequest<{Params: {id: string}}>,
          reply: FastifyReply,
      ):Promise<never> => {
        const account = await accountService.getById(request.params.id);

        return reply.send(account);
      },
  );
}
