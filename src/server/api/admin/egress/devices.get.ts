import { discoverExitNodes } from '../../../utils/egressHelper';

export default definePermissionEventHandler('admin', 'any', async () => {
  const devices = await discoverExitNodes();
  return devices;
});
