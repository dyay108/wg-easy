<template>
  <main v-if="config && rules">
    <!-- ACL Configuration Section -->
    <section class="mb-8">
      <h2 class="mb-4 text-2xl font-bold">
        {{ $t('acl.configuration') }}
      </h2>
      <FormElement @submit.prevent="submitConfigHandler">
        <FormGroup>
          <FormSwitchField
            id="acl-enabled"
            v-model="config.enabled"
            :label="$t('acl.enableACL')"
            :description="$t('acl.enableDescription')"
          />
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
          class="rounded-lg border-2 border-red-800 bg-red-800 px-4 py-2 text-white hover:border-red-600 hover:bg-red-600"
          @click="showCreateModal = true"
        >
          {{ $t('acl.addRule') }}
        </button>
      </div>

      <!-- Rules Table -->
      <div v-if="rules.length > 0" class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead class="bg-gray-100 dark:bg-neutral-700">
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
              class="transition hover:bg-gray-50 dark:hover:bg-neutral-600"
            >
              <td class="border p-2">
                <div class="font-mono text-sm">{{ rule.sourceCidr }}</div>
                <div v-if="getClientNameByCidr(rule.sourceCidr)" class="text-xs text-red-700 dark:text-red-400">
                  {{ getClientNameByCidr(rule.sourceCidr) }}
                </div>
              </td>
              <td class="border p-2">
                <div class="font-mono text-sm">{{ rule.destinationCidr }}</div>
                <div v-if="getClientNameByCidr(rule.destinationCidr)" class="text-xs text-red-700 dark:text-red-400">
                  {{ getClientNameByCidr(rule.destinationCidr) }}
                </div>
              </td>
              <td class="border p-2">
                <span class="rounded bg-gray-200 px-2 py-1 text-xs font-semibold dark:bg-neutral-600">
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
                  class="mr-2 inline-flex items-center rounded-lg border-2 border-gray-100 px-4 py-2 text-gray-700 transition hover:border-red-800 hover:bg-red-800 hover:text-white dark:border-neutral-600 dark:text-neutral-200"
                  @click="editRule(rule)"
                >
                  {{ $t('acl.edit') }}
                </button>
                <button
                  class="inline-flex items-center rounded-lg border-2 border-red-600 bg-red-600 px-4 py-2 text-white transition hover:border-red-800 hover:bg-red-800 dark:border-red-500 dark:bg-red-500"
                  @click="deleteRuleConfirm(rule)"
                >
                  {{ $t('acl.delete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="rounded border border-gray-300 p-8 text-center text-gray-500 dark:border-neutral-700">
        <p>{{ $t('acl.noRules') }}</p>
        <p class="mt-2 text-sm">{{ $t('acl.noRulesHint') }}</p>
      </div>
    </section>

    <!-- Create/Edit Modal -->
    <div
      v-if="showCreateModal || editingRule"
      class="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75 dark:bg-black dark:bg-opacity-50"
      @click.self="closeModal"
    >
      <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white px-6 py-8 shadow-2xl dark:bg-neutral-700">
        <h3 class="mb-6 text-xl font-bold text-gray-900 dark:text-neutral-200">
          {{ editingRule ? $t('acl.editRule') : $t('acl.createRule') }}
        </h3>
        <FormElement class="space-y-6" @submit.prevent="submitRule">
          <FormGroup>
            <label for="sourceCidr" class="mb-2 block text-sm font-medium text-gray-700 dark:text-neutral-300">
              {{ $t('acl.source') }}
            </label>
            <div class="relative">
              <FormTextField
                id="sourceCidr"
                v-model="ruleForm.sourceCidr"
                placeholder="10.8.0.2/32"
                style="padding-right: 8rem;"
                required
              />
              <button
                type="button"
                class="absolute right-2 top-1 bottom-1 ml-2 rounded bg-gray-100 px-3 text-xs transition hover:bg-red-800 hover:text-white dark:bg-neutral-600 dark:text-neutral-300 dark:hover:bg-red-800 dark:hover:text-white"
                @click="showSourceClientPicker = true"
              >
                {{ $t('acl.selectClient') }}
              </button>
            </div>
            <p v-if="getClientNameByCidr(ruleForm.sourceCidr)" class="mt-1 text-sm text-red-700 dark:text-red-400">
              {{ getClientNameByCidr(ruleForm.sourceCidr) }}
            </p>
          </FormGroup>
          <FormGroup>
            <label for="destinationCidr" class="mb-2 block text-sm font-medium text-gray-700 dark:text-neutral-300">
              {{ $t('acl.destination') }}
            </label>
            <div class="relative">
              <FormTextField
                id="destinationCidr"
                v-model="ruleForm.destinationCidr"
                placeholder="10.8.0.3/32"
                style="padding-right: 8rem;"
                required
              />
              <button
                type="button"
                class="absolute right-2 top-1 bottom-1 ml-2 rounded bg-gray-100 px-3 text-xs transition hover:bg-red-800 hover:text-white dark:bg-neutral-600 dark:text-neutral-300 dark:hover:bg-red-800 dark:hover:text-white"
                @click="showDestClientPicker = true"
              >
                {{ $t('acl.selectClient') }}
              </button>
            </div>
            <p v-if="getClientNameByCidr(ruleForm.destinationCidr)" class="mt-1 text-sm text-red-700 dark:text-red-400">
              {{ getClientNameByCidr(ruleForm.destinationCidr) }}
            </p>
          </FormGroup>
          <FormGroup>
            <label for="protocol" class="mb-2 block text-sm font-medium text-gray-700 dark:text-neutral-300">{{ $t('acl.protocol') }}</label>
            <select
              id="protocol"
              v-model="ruleForm.protocol"
              class="w-full rounded-lg border-2 border-gray-100 text-gray-500 focus:border-red-800 focus:outline-0 focus:ring-0 dark:border-neutral-800 dark:bg-neutral-700 dark:text-neutral-200"
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
              :description="$t('acl.portsHint')"
              placeholder="22,80,443 or 1-65535"
              required
            />
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
            <FormSwitchField
              id="rule-enabled"
              v-model="ruleForm.enabled"
              :label="$t('acl.enableRule')"
            />
          </FormGroup>
          <FormGroup>
            <div class="col-span-2 flex gap-2">
              <FormPrimaryActionField
                type="submit"
                :label="editingRule ? $t('form.update') : $t('form.create')"
              />
              <FormSecondaryActionField
                type="button"
                :label="$t('form.cancel')"
                @click="closeModal"
              />
            </div>
          </FormGroup>
        </FormElement>
      </div>
    </div>

    <!-- Client Picker Modal -->
    <div
      v-if="showSourceClientPicker || showDestClientPicker"
      class="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75 dark:bg-black dark:bg-opacity-50"
      @click.self="closeClientPicker"
    >
      <div class="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-2xl dark:bg-neutral-700">
        <h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-neutral-200">{{ $t('acl.selectClient') }}</h3>
        <div v-if="clients && clients.length > 0" class="space-y-2">
          <button
            v-for="client in clients"
            :key="client.id"
            type="button"
            class="w-full rounded border p-3 text-left transition hover:bg-red-50 hover:border-red-200 dark:border-neutral-700 dark:hover:bg-neutral-700 dark:hover:border-red-800"
            @click="selectClient(client)"
          >
            <div class="font-medium">{{ client.name }}</div>
            <div class="text-sm text-gray-600 dark:text-neutral-400">
              {{ client.ipv4Address }}/32
            </div>
          </button>
        </div>
        <div v-else class="text-center text-gray-600 dark:text-neutral-400">
          {{ $t('acl.noClients') }}
        </div>
        <button
          type="button"
          class="mt-4 w-full rounded-lg border-2 border-gray-100 py-2 text-gray-500 hover:border-red-800 hover:bg-red-800 hover:text-white dark:border-neutral-800 dark:bg-neutral-700 dark:text-neutral-200"
          @click="closeClientPicker"
        >
          {{ $t('form.cancel') }}
        </button>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { AclRuleType } from '#db/repositories/acl/types';
import type { ClientType } from '#db/repositories/client/types';

const { data: config, refresh: refreshConfig } = await useFetch('/api/admin/acl/config', {
  method: 'get',
});

const { data: rules, refresh: refreshRules } = await useFetch('/api/admin/acl/rules', {
  method: 'get',
});

const { data: clients } = await useFetch<ClientType[]>('/api/client', {
  method: 'get',
});

const showCreateModal = ref(false);
const editingRule = ref<AclRuleType | null>(null);
const showSourceClientPicker = ref(false);
const showDestClientPicker = ref(false);

const ruleForm = ref({
  interfaceId: 'wg0',
  sourceCidr: '',
  destinationCidr: '',
  protocol: 'tcp' as 'tcp' | 'udp' | 'icmp',
  ports: '',
  description: '',
  enabled: true,
});

function getClientNameByCidr(cidr: string): string | null {
  if (!clients.value || !cidr) return null;
  
  // Extract IP from CIDR (e.g., "10.8.0.2/32" -> "10.8.0.2")
  const ip = cidr.split('/')[0];
  
  const client = clients.value.find(c => c.ipv4Address === ip);
  return client ? client.name : null;
}

function selectClient(client: ClientType) {
  const cidr = `${client.ipv4Address}/32`;
  
  if (showSourceClientPicker.value) {
    ruleForm.value.sourceCidr = cidr;
  } else if (showDestClientPicker.value) {
    ruleForm.value.destinationCidr = cidr;
  }
  
  closeClientPicker();
}

function closeClientPicker() {
  showSourceClientPicker.value = false;
  showDestClientPicker.value = false;
}

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
