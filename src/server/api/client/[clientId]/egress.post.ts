import { discoverExitNodes } from '../../../utils/egressHelper';
import {
  ClientGetSchema,
  ClientEgressUpdateSchema,
} from '#db/repositories/client/types';

// Admin-only: exit-node assignment and device discovery are an admin concern
// (the device list endpoint and the UI selector are both admin-only). Using
// 'admin' means the permission is enforced up front, before any discovery runs,
// so a non-admin can neither trigger discovery for an arbitrary client nor probe
// which device names are valid via the validation response.
export default definePermissionEventHandler(
  'admin',
  'any',
  async ({ event }) => {
    const { clientId } = await getValidatedRouterParams(
      event,
      validateZod(ClientGetSchema, event)
    );

    const data = await readValidatedBody(
      event,
      validateZod(ClientEgressUpdateSchema, event)
    );

    const client = await Database.clients.get(clientId);
    if (!client) {
      throw createError({ statusCode: 404, message: 'Client not found' });
    }

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

    await Database.clients.updateEgress(clientId, data);
    await WireGuard.saveConfig();

    return { success: true };
  }
);
