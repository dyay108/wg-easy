<template>
  <input
    :value="label"
    :type="type ?? 'button'"
    :disabled="disabled"
    :class="[
      'col-span-2 rounded-lg border-2 py-2 text-white focus:outline-0 focus:ring-0',
      disabled
        ? 'cursor-not-allowed border-gray-400 bg-gray-400 dark:border-neutral-600 dark:bg-neutral-600'
        : 'border-red-800 bg-red-800 hover:border-red-600 hover:bg-red-600 focus:border-red-800'
    ]"
  />
</template>

<script lang="ts" setup>
import type { InputTypeHTMLAttribute } from 'vue';

defineProps<{
  label: string;
  type?: InputTypeHTMLAttribute;
  disabled?: boolean;
}>();
</script>
