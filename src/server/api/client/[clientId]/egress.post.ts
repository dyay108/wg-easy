import { discoverExitNodes } from '../../../utils/egressHelper';
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

    // Constrain the device to one actually offered by discovery. This blocks
    // crafted values (e.g. `client:<id>:$(...)`) that would otherwise be
    // interpolated into the generated egress shell script.
    if (data.egressDevice !== null) {
      const devices = await discoverExitNodes();
      if (!devices.includes(data.egressDevice)) {
        throw createError({
          statusCode: 400,
          message: 'Unknown egress device',
        });
      }
    }

    const client = await Database.clients.get(clientId);
    checkPermissions(client);

    await Database.clients.updateEgress(clientId, data);
    await WireGuard.saveConfig();

    return { success: true };
  }
);
