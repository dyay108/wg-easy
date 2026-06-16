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

    let group;
    try {
      group = await Database.acl.updateGroup(Number(groupId), data);
    } catch (e) {
      throw createError({
        statusCode: 400,
        message: e instanceof Error ? e.message : 'Failed to update group',
      });
    }
    await WireGuard.saveConfig();

    return group;
  }
);
