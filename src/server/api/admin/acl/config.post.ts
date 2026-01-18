import { AclConfigUpdateSchema } from '#db/repositories/acl/types';

export default definePermissionEventHandler(
  'admin',
  'any',
  async ({ event }) => {
    const data = await readValidatedBody(
      event,
      validateZod(AclConfigUpdateSchema.omit({ id: true }), event)
    );

    const config = await Database.acl.updateConfig('wg0', data);
    await WireGuard.saveConfig();

    return config;
  }
);
