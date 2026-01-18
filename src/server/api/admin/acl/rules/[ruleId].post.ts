import { AclRuleUpdateSchema } from '#db/repositories/acl/types';

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

    const data = await readValidatedBody(
      event,
      validateZod(AclRuleUpdateSchema, event)
    );

    const rule = await Database.acl.updateRule(Number(ruleId), data);
    await WireGuard.saveConfig();

    return rule;
  }
);
