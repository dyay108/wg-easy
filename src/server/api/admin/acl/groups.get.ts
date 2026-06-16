export default definePermissionEventHandler('admin', 'any', async () => {
  const groups = await Database.acl.getGroups('wg0');
  return groups;
});
