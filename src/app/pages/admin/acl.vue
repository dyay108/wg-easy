<template>
  <main v-if="config && rules">
    <!-- ACL Configuration Section -->
    <section class="mb-8">
      <h2 class="mb-4 text-2xl font-bold">
        {{ $t('acl.configuration') }}
      </h2>
      <FormElement @submit.prevent="submitConfigHandler">
        <FormGroup>
          <div class="flex items-center gap-4">
            <input
              id="acl-enabled"
              v-model="config.enabled"
              type="checkbox"
              class="h-4 w-4"
            />
            <label for="acl-enabled" class="font-medium">
              {{ $t('acl.enableACL') }}
            </label>
          </div>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ $t('acl.enableDescription') }}
          </p>
        </FormGroup>
        <FormGroup>
          <FormPrimaryActionField
            type="submit"
            :label="$t('form.save')"
          />
        </FormGroup>
      </FormElement>
    </section>

    <!-- ACL Rules Section -->
    <section>
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-2xl font-bold">{{ $t('acl.rules') }}</h2>
        <button
          class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          @click="showCreateModal = true"
        >
          {{ $t('acl.addRule') }}
        </button>
      </div>

      <!-- Rules Table -->
      <div v-if="rules.length > 0" class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead class="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th class="border p-2 text-left">{{ $t('acl.source') }}</th>
              <th class="border p-2 text-left">{{ $t('acl.destination') }}</th>
              <th class="border p-2 text-left">{{ $t('acl.protocol') }}</th>
              <th class="border p-2 text-left">{{ $t('acl.ports') }}</th>
              <th class="border p-2 text-left">{{ $t('acl.description') }}</th>
              <th class="border p-2 text-left">{{ $t('acl.enabled') }}</th>
              <th class="border p-2 text-center">{{ $t('acl.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="rule in rules"
              :key="rule.id"
              class="hover:bg-gray-50 dark:hover:bg-gray-900"
            >
              <td class="border p-2 font-mono text-sm">{{ rule.sourceCidr }}</td>
              <td class="border p-2 font-mono text-sm">{{ rule.destinationCidr }}</td>
              <td class="border p-2">
                <span class="rounded bg-gray-200 px-2 py-1 text-xs font-semibold dark:bg-gray-700">
                  {{ rule.protocol.toUpperCase() }}
                </span>
              </td>
              <td class="border p-2 font-mono text-sm">{{ rule.ports || '—' }}</td>
              <td class="border p-2">{{ rule.description || '—' }}</td>
              <td class="border p-2 text-center">
                <span v-if="rule.enabled" class="text-green-600">✓</span>
                <span v-else class="text-red-600">✗</span>
              </td>
              <td class="border p-2 text-center">
                <button
                  class="mr-2 text-blue-600 hover:text-blue-800"
                  @click="editRule(rule)"
                >
                  {{ $t('acl.edit') }}
                </button>
                <button
                  class="text-red-600 hover:text-red-800"
                  @click="deleteRuleConfirm(rule)"
                >
                  {{ $t('acl.delete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="rounded border border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700">
        <p>{{ $t('acl.noRules') }}</p>
        <p class="mt-2 text-sm">{{ $t('acl.noRulesHint') }}</p>
      </div>
    </section>

    <!-- Create/Edit Modal -->
    <div
      v-if="showCreateModal || editingRule"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      @click.self="closeModal"
    >
      <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 class="mb-4 text-xl font-bold">
          {{ editingRule ? $t('acl.editRule') : $t('acl.createRule') }}
        </h3>
        <FormElement @submit.prevent="submitRule">
          <FormGroup>
            <FormTextField
              id="sourceCidr"
              v-model="ruleForm.sourceCidr"
              :label="$t('acl.source')"
              placeholder="10.172.16.2/32"
              required
            />
            <FormTextField
              id="destinationCidr"
              v-model="ruleForm.destinationCidr"
              :label="$t('acl.destination')"
              placeholder="10.172.16.3/32"
              required
            />
          </FormGroup>
          <FormGroup>
            <label for="protocol" class="block font-medium">{{ $t('acl.protocol') }}</label>
            <select
              id="protocol"
              v-model="ruleForm.protocol"
              class="w-full rounded border p-2"
              required
            >
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="icmp">ICMP</option>
            </select>
          </FormGroup>
          <FormGroup v-if="ruleForm.protocol !== 'icmp'">
            <FormTextField
              id="ports"
              v-model="ruleForm.ports"
              :label="$t('acl.ports')"
              placeholder="22,80,443 or 1-65535"
              required
            />
            <p class="mt-1 text-sm text-gray-600">{{ $t('acl.portsHint') }}</p>
          </FormGroup>
          <FormGroup>
            <FormTextField
              id="description"
              v-model="ruleForm.description"
              :label="$t('acl.description')"
              placeholder="Admin phone access"
            />
          </FormGroup>
          <FormGroup>
            <div class="flex items-center gap-4">
              <input
                id="rule-enabled"
                v-model="ruleForm.enabled"
                type="checkbox"
                class="h-4 w-4"
              />
              <label for="rule-enabled" class="font-medium">
                {{ $t('acl.enableRule') }}
              </label>
            </div>
          </FormGroup>
          <FormGroup>
            <div class="flex gap-2">
              <FormPrimaryActionField
                type="submit"
                :label="editingRule ? $t('form.update') : $t('form.create')"
              />
              <FormSecondaryActionField
                :label="$t('form.cancel')"
                @click="closeModal"
              />
            </div>
          </FormGroup>
        </FormElement>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { AclRuleType } from '#db/repositories/acl/types';

const { data: config, refresh: refreshConfig } = await useFetch('/api/admin/acl/config', {
  method: 'get',
});

const { data: rules, refresh: refreshRules } = await useFetch('/api/admin/acl/rules', {
  method: 'get',
});

const showCreateModal = ref(false);
const editingRule = ref<AclRuleType | null>(null);

const ruleForm = ref({
  interfaceId: 'wg0',
  sourceCidr: '',
  destinationCidr: '',
  protocol: 'tcp' as 'tcp' | 'udp' | 'icmp',
  ports: '',
  description: '',
  enabled: true,
});

async function submitConfigHandler() {
  await useSubmit(
    '/api/admin/acl/config',
    { method: 'post' },
    { revert: async () => { await refreshConfig(); } }
  )(config.value);
}

async function submitRule() {
  const data = { ...ruleForm.value };
  
  // Clear ports for ICMP
  if (data.protocol === 'icmp') {
    data.ports = '';
  }

  if (editingRule.value) {
    await useSubmit(
      `/api/admin/acl/rules/${editingRule.value.id}`,
      { method: 'post' },
      { revert: async () => { await refreshRules(); } }
    )(data);
  } else {
    await useSubmit(
      '/api/admin/acl/rules',
      { method: 'post' },
      { revert: async () => { await refreshRules(); } }
    )(data);
  }

  await refreshRules();
  closeModal();
}

function editRule(rule: AclRuleType) {
  editingRule.value = rule;
  ruleForm.value = {
    interfaceId: rule.interfaceId,
    sourceCidr: rule.sourceCidr,
    destinationCidr: rule.destinationCidr,
    protocol: rule.protocol as 'tcp' | 'udp' | 'icmp',
    ports: rule.ports,
    description: rule.description || '',
    enabled: rule.enabled,
  };
}

async function deleteRuleConfirm(rule: AclRuleType) {
  if (!confirm(`Delete rule: ${rule.sourceCidr} → ${rule.destinationCidr}?`)) {
    return;
  }

  await $fetch(`/api/admin/acl/rules/${rule.id}`, { method: 'DELETE' });
  await refreshRules();
}

function closeModal() {
  showCreateModal.value = false;
  editingRule.value = null;
  ruleForm.value = {
    interfaceId: 'wg0',
    sourceCidr: '',
    destinationCidr: '',
    protocol: 'tcp',
    ports: '',
    description: '',
    enabled: true,
  };
}
</script>
