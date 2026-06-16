import { AclGroupCreateSchema } from '#db/repositories/acl/types';

export default definePermissionEventHandler(
  'admin',
  'any',
  async ({ event }) => {
    const data = await readValidatedBody(
      event,
      validateZod(AclGroupCreateSchema, event)
    );

    const group = await Database.acl.createGroup(data);
    await WireGuard.saveConfig();

    return group;
  }
);
