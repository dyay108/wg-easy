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

    const group = await Database.acl.getGroup(Number(groupId));
    return group;
  }
);
