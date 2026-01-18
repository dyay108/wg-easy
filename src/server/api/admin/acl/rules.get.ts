export default definePermissionEventHandler('admin', 'any', async () => {
  const rules = await Database.acl.getRules('wg0');
  return rules;
});
