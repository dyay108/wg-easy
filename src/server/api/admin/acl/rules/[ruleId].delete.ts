export default definePermissionEventHandler(
  'admin',
  'any',
  async ({ event }) => {
    const ruleId = getRouterParam(event, 'ruleId');
    if (!ruleId) {
      throw createError({
        statusCode: 400,
        message: 'Rule ID is required',
      });
    }

    await Database.acl.deleteRule(Number(ruleId));
    await WireGuard.saveConfig();

    return { success: true };
  }
);
