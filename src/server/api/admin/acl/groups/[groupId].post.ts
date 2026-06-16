import { AclGroupUpdateSchema } from '#db/repositories/acl/types';

export default definePermissionEventHandler(
  'admin',
  'any',
  async ({ event }) => {
    const groupId = getRouterParam(event, 'groupId');
    if (!groupId) {
      throw createError({
        statusCode: 400,
        message: 'Group ID is required',
      });
    }

    const data = await readValidatedBody(
      event,
      validateZod(AclGroupUpdateSchema, event)
    );

    const group = await Database.acl.updateGroup(Number(groupId), data);
    await WireGuard.saveConfig();

    return group;
  }
);
