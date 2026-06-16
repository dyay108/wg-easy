import {
  ClientGetSchema,
  ClientEgressUpdateSchema,
} from '#db/repositories/client/types';

export default definePermissionEventHandler(
  'clients',
  'update',
  async ({ event, checkPermissions }) => {
    const { clientId } = await getValidatedRouterParams(
      event,
      validateZod(ClientGetSchema, event)
    );

    const data = await readValidatedBody(
      event,
      validateZod(ClientEgressUpdateSchema, event)
    );

    const client = await Database.clients.get(clientId);
    checkPermissions(client);

    await Database.clients.updateEgress(clientId, data);
    await WireGuard.saveConfig();

    return { success: true };
  }
);
