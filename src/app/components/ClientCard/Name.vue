<template>
  <div
    class="text-sm text-gray-700 md:text-base dark:text-neutral-200"
    :title="$t('client.createdOn') + $d(new Date(client.createdAt))"
  >
    <span class="border-b-2 border-t-2 border-transparent">
      {{ client.name }}
    </span>
    <span
      v-if="isActiveExitNode"
      class="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200"
    >
      {{ $t('client.activeExitNodeLabel') }}
    </span>
  </div>
</template>

<script setup lang="ts">
const { data: aclConfig } = await useFetch('/api/admin/acl/config', {
  method: 'get',
});

const props = defineProps<{
  client: LocalClient;
}>();

const isActiveExitNode = computed(() => {
  const activeExitNodeClientId = aclConfig.value?.exitNodeClientId ?? null;
  return activeExitNodeClientId !== null && Number(activeExitNodeClientId) === Number(props.client.id);
});
</script>
