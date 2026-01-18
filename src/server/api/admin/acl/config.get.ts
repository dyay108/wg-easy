export default definePermissionEventHandler('admin', 'any', async () => {
  const config = await Database.acl.getConfig('wg0');
  return config;
});
