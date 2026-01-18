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

    const rule = await Database.acl.getRule(Number(ruleId));
    return rule;
  }
);
