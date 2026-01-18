import { AclRuleCreateSchema } from '#db/repositories/acl/types';

export default definePermissionEventHandler(
  'admin',
  'any',
  async ({ event }) => {
    const data = await readValidatedBody(
      event,
      validateZod(AclRuleCreateSchema, event)
    );
    
    const rule = await Database.acl.createRule(data);
    await WireGuard.saveConfig();
    
    return rule;
  }
);
