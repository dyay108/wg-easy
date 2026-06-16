<template>
  <div class="mt-1 flex items-center gap-1 text-xs">
    <span>🌐</span>
    <select
      :value="currentValue"
      :title="$t('client.egressDevice')"
      class="max-w-[12rem] truncate rounded border border-gray-200 bg-gray-50 px-1 py-0.5 text-xs text-gray-700 focus:border-red-800 focus:outline-0 focus:ring-0 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
      @change="onChange"
    >
      <option value="">{{ $t('client.egressOff') }}</option>
      <option value="default">{{ $t('client.egressDeviceDefault') }}</option>
      <option v-for="device in filteredExitNodes" :key="device" :value="device">
        {{ device }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ client: LocalClient }>();

const { t: $t } = useI18n();
const clientsStore = useClientsStore();

const { data: exitNodes } = await useFetch<string[]>(
  '/api/admin/egress/devices',
  { method: 'get', key: 'egress-devices' }
);
const { data: aclConfig } = await useFetch('/api/admin/acl/config', {
  method: 'get',
  key: 'acl-config',
});

/** Encodes the client's egress state as the select's value. */
const currentValue = computed(() => {
  if (!props.client.egressEnabled) return '';
  return props.client.egressDevice ?? 'default';
});

/** Hide the client's own exit-node device so it can't route through itself. */
const filteredExitNodes = computed(() => {
  const devices = exitNodes.value ?? [];
  const activeExitNodeClientId = aclConfig.value?.exitNodeClientId ?? null;
  const currentClientId = props.client.id;
  if (
    activeExitNodeClientId === null ||
    Number(currentClientId) !== Number(activeExitNodeClientId)
  ) {
    return devices;
  }
  const prefix = `client:${currentClientId}:`;
  return devices.filter(
    (device) =>
      !device.startsWith(prefix) && device !== `client:${currentClientId}`
  );
});

async function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  const payload =
    value === ''
      ? { egressEnabled: false, egressDevice: null }
      : value === 'default'
        ? { egressEnabled: true, egressDevice: null }
        : { egressEnabled: true, egressDevice: value };

  await useSubmit(
    (data) =>
      $fetch(`/api/client/${props.client.id}/egress`, {
        method: 'post',
        body: data,
      }),
    {
      successMsg: $t('client.egressUpdated'),
      revert: async () => {
        await clientsStore.refresh();
      },
    }
  )(payload);

  await clientsStore.refresh();
}
</script>
