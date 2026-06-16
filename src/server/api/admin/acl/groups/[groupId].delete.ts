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

    try {
      await Database.acl.deleteGroup(Number(groupId));
    } catch (e) {
      throw createError({
        statusCode: 400,
        message: e instanceof Error ? e.message : 'Failed to delete group',
      });
    }
    await WireGuard.saveConfig();

    return { success: true };
  }
);
