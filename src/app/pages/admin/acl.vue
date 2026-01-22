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
          <FormSwitchField
            id="acl-allow-public-egress"
            v-model="config.allowPublicEgress"
            :label="$t('acl.allowPublicEgress')"
            :description="$t('acl.allowPublicEgressDescription')"
          />
        </FormGroup>
        <FormGroup v-if="config.allowPublicEgress">
          <div class="mb-2 flex items-center gap-2">
            <label for="acl-exit-node-client" class="block text-sm font-medium text-gray-700 dark:text-neutral-300">
              {{ $t('acl.exitNodeClient') }}
            </label>
            <BaseTooltip :text="$t('acl.exitNodeClientDescription')">
              <IconsInfo class="size-4 text-gray-500 dark:text-neutral-400" />
            </BaseTooltip>
          </div>
          <select
            id="acl-exit-node-client"
            v-model="config.exitNodeClientId"
            class="w-full rounded-lg border-2 border-gray-100 text-gray-500 focus:border-red-800 focus:outline-0 focus:ring-0 dark:border-neutral-800 dark:bg-neutral-700 dark:text-neutral-200"
          >
            <option :value="null">{{ $t('acl.exitNodeClientNone') }}</option>
            <option
              v-for="client in (clients || []).filter(c => c.isExitNode)"
              :key="client.id"
              :value="client.id"
            >
              {{ client.name }} ({{ client.ipv4Address }})
            </option>
          </select>
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

      <!-- Rules Table (Desktop) -->
      <div v-if="rules.length > 0" class="hidden overflow-x-auto sm:block">
        <table class="w-full table-fixed border-collapse">
          <thead class="bg-gray-100 dark:bg-neutral-700">
            <tr>
              <th class="border p-2 text-center whitespace-normal break-words">{{ $t('acl.source') }}</th>
              <th class="border p-2 text-center whitespace-normal break-words">{{ $t('acl.destination') }}</th>
              <th class="border p-2 text-center whitespace-normal break-words">{{ $t('acl.protocol') }}</th>
              <th class="border p-2 text-center whitespace-normal break-words w-48">{{ $t('acl.ports') }}</th>
              <th class="border p-2 text-center whitespace-normal break-words">{{ $t('acl.description') }}</th>
              <th class="border p-2 text-center whitespace-normal break-words">{{ $t('acl.enabled') }}</th>
              <th class="border p-2 text-center whitespace-normal break-words w-64">{{ $t('acl.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="rule in rules"
              :key="rule.id"
              class="transition hover:bg-gray-50 dark:hover:bg-neutral-600"
            >
              <td class="border p-2 text-center">
                <TooltipProvider>
                  <TooltipRoot>
                    <TooltipTrigger as-child>
                      <div class="w-full">
                        <span
                          v-if="getClientNameByCidr(rule.sourceCidr)"
                          class="inline-block max-w-full truncate rounded bg-gray-200 px-2 py-1 text-xs font-semibold text-white dark:bg-neutral-600"
                        >
                          {{ getClientNameByCidr(rule.sourceCidr) }}
                        </span>
                        <span v-else class="block truncate font-mono text-sm">
                          {{ rule.sourceCidr }}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipPortal>
                      <TooltipContent
                        class="z-[9999] min-w-[16rem] max-w-[32rem] select-none whitespace-pre-wrap break-words rounded bg-gray-600 px-3 py-2 text-center text-sm leading-relaxed text-white shadow-lg will-change-[transform,opacity]"
                        :side-offset="5"
                      >
                        {{ getClientNameByCidr(rule.sourceCidr) ? `${getClientNameByCidr(rule.sourceCidr)} (${rule.sourceCidr})` : rule.sourceCidr }}
                        <TooltipArrow class="fill-gray-600" :width="8" />
                      </TooltipContent>
                    </TooltipPortal>
                  </TooltipRoot>
                </TooltipProvider>
              </td>
              <td class="border p-2 text-center">
                <TooltipProvider>
                  <TooltipRoot>
                    <TooltipTrigger as-child>
                      <div class="w-full">
                        <span
                          v-if="getClientNameByCidr(rule.destinationCidr)"
                          class="inline-block max-w-full truncate rounded bg-gray-200 px-2 py-1 text-xs font-semibold text-white dark:bg-neutral-600"
                        >
                          {{ getClientNameByCidr(rule.destinationCidr) }}
                        </span>
                        <span v-else class="block truncate font-mono text-sm">
                          {{ rule.destinationCidr }}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipPortal>
                      <TooltipContent
                        class="z-[9999] min-w-[16rem] max-w-[32rem] select-none whitespace-pre-wrap break-words rounded bg-gray-600 px-3 py-2 text-center text-sm leading-relaxed text-white shadow-lg will-change-[transform,opacity]"
                        :side-offset="5"
                      >
                        {{ getClientNameByCidr(rule.destinationCidr) ? `${getClientNameByCidr(rule.destinationCidr)} (${rule.destinationCidr})` : rule.destinationCidr }}
                        <TooltipArrow class="fill-gray-600" :width="8" />
                      </TooltipContent>
                    </TooltipPortal>
                  </TooltipRoot>
                </TooltipProvider>
              </td>
              <td class="border p-2 text-center">
                <TooltipProvider>
                  <TooltipRoot>
                    <TooltipTrigger as-child>
                      <span class="inline-block max-w-full truncate rounded bg-gray-200 px-2 py-1 text-xs font-semibold dark:bg-neutral-600">
                        {{ rule.protocol.toUpperCase() }}
                      </span>
                    </TooltipTrigger>
                    <TooltipPortal>
                      <TooltipContent
                        class="z-[9999] min-w-[8rem] max-w-[16rem] select-none whitespace-pre-wrap break-words rounded bg-gray-600 px-3 py-2 text-center text-sm leading-relaxed text-white shadow-lg will-change-[transform,opacity]"
                        :side-offset="5"
                      >
                        {{ rule.protocol.toUpperCase() }}
                        <TooltipArrow class="fill-gray-600" :width="8" />
                      </TooltipContent>
                    </TooltipPortal>
                  </TooltipRoot>
                </TooltipProvider>
              </td>
              <td class="border p-2 text-center">
                <TooltipProvider v-if="rule.ports">
                  <TooltipRoot>
                    <TooltipTrigger as-child>
                      <div class="w-full truncate font-mono text-sm">
                        {{ rule.ports }}
                      </div>
                    </TooltipTrigger>
                    <TooltipPortal>
                      <TooltipContent
                        class="z-[9999] min-w-[16rem] max-w-[32rem] select-none whitespace-pre-wrap break-words rounded bg-gray-600 px-3 py-2 text-center text-sm leading-relaxed text-white shadow-lg will-change-[transform,opacity]"
                        :side-offset="5"
                      >
                        {{ rule.ports }}
                        <TooltipArrow class="fill-gray-600" :width="8" />
                      </TooltipContent>
                    </TooltipPortal>
                  </TooltipRoot>
                </TooltipProvider>
                <span v-else>—</span>
              </td>
              <td class="border p-2 text-center">
                <TooltipProvider v-if="rule.description">
                  <TooltipRoot>
                    <TooltipTrigger as-child>
                      <div class="w-full truncate">
                        {{ rule.description }}
                      </div>
                    </TooltipTrigger>
                    <TooltipPortal>
                      <TooltipContent
                        class="z-[9999] min-w-[16rem] max-w-[32rem] select-none whitespace-pre-wrap break-words rounded bg-gray-600 px-3 py-2 text-center text-sm leading-relaxed text-white shadow-lg will-change-[transform,opacity]"
                        :side-offset="5"
                      >
                        {{ rule.description }}
                        <TooltipArrow class="fill-gray-600" :width="8" />
                      </TooltipContent>
                    </TooltipPortal>
                  </TooltipRoot>
                </TooltipProvider>
                <span v-else>—</span>
              </td>
              <td class="border p-2 text-center">
                <BaseTooltip :text="rule.enabled ? 'Enabled' : 'Disabled'">
                  <span v-if="rule.enabled" class="text-green-600">✓</span>
                  <span v-else class="text-red-600">✗</span>
                </BaseTooltip>
              </td>
              <td class="border p-2 text-center whitespace-nowrap">
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

      <!-- Rules List (Mobile) -->
      <div v-if="rules.length > 0" class="space-y-4 sm:hidden">
        <div
          v-for="rule in rules"
          :key="`mobile-${rule.id}`"
          class="rounded-lg border border-gray-200 p-4 shadow-sm dark:border-neutral-700"
        >
          <div class="mb-3 flex items-center justify-between">
            <span class="rounded bg-gray-200 px-2 py-1 text-xs font-semibold dark:bg-neutral-600">
              {{ rule.protocol.toUpperCase() }}
            </span>
            <span v-if="rule.enabled" class="text-green-600">✓</span>
            <span v-else class="text-red-600">✗</span>
          </div>

          <div class="grid grid-cols-1 gap-3 text-sm">
            <div>
              <div class="text-xs font-medium text-gray-500 dark:text-neutral-400">
                {{ $t('acl.source') }}
              </div>
              <div class="mt-1">
                <details class="group">
                  <summary class="cursor-pointer list-none" style="list-style: none;">
                    <span
                      v-if="getClientNameByCidr(rule.sourceCidr)"
                      class="inline-block max-w-full truncate rounded bg-gray-200 px-2 py-1 text-xs font-semibold text-white dark:bg-neutral-600"
                    >
                      {{ getClientNameByCidr(rule.sourceCidr) }}
                    </span>
                    <span v-else class="block max-w-full truncate font-mono text-sm">
                      {{ rule.sourceCidr }}
                    </span>
                  </summary>
                  <div class="mt-1 break-words text-xs text-gray-500 dark:text-neutral-400">
                    {{ rule.sourceCidr }}
                  </div>
                </details>
              </div>
            </div>

            <div>
              <div class="text-xs font-medium text-gray-500 dark:text-neutral-400">
                {{ $t('acl.destination') }}
              </div>
              <div class="mt-1">
                <details class="group">
                  <summary class="cursor-pointer list-none" style="list-style: none;">
                    <span
                      v-if="getClientNameByCidr(rule.destinationCidr)"
                      class="inline-block max-w-full truncate rounded bg-gray-200 px-2 py-1 text-xs font-semibold text-white dark:bg-neutral-600"
                    >
                      {{ getClientNameByCidr(rule.destinationCidr) }}
                    </span>
                    <span v-else class="block max-w-full truncate font-mono text-sm">
                      {{ rule.destinationCidr }}
                    </span>
                  </summary>
                  <div class="mt-1 break-words text-xs text-gray-500 dark:text-neutral-400">
                    {{ rule.destinationCidr }}
                  </div>
                </details>
              </div>
            </div>

            <div>
              <div class="text-xs font-medium text-gray-500 dark:text-neutral-400">
                {{ $t('acl.ports') }}
              </div>
              <div class="mt-1 min-w-0">
                <details v-if="rule.ports" class="group">
                  <summary class="cursor-pointer list-none" style="list-style: none;">
                    <div class="truncate font-mono text-sm">
                      {{ rule.ports }}
                    </div>
                  </summary>
                  <div class="mt-1 break-words text-xs text-gray-500 dark:text-neutral-400">
                    {{ rule.ports }}
                  </div>
                </details>
                <div v-else>—</div>
              </div>
            </div>

            <div>
              <div class="text-xs font-medium text-gray-500 dark:text-neutral-400">
                {{ $t('acl.description') }}
              </div>
              <div class="mt-1 min-w-0">
                <details v-if="rule.description" class="group">
                  <summary class="cursor-pointer list-none" style="list-style: none;">
                    <div class="w-full truncate">
                      {{ rule.description }}
                    </div>
                  </summary>
                  <div class="mt-1 break-words text-xs text-gray-500 dark:text-neutral-400">
                    {{ rule.description }}
                  </div>
                </details>
                <div v-else>—</div>
              </div>
            </div>
          </div>

          <div class="mt-4 flex gap-2">
            <button
              class="flex-1 inline-flex items-center justify-center rounded-lg border-2 border-gray-100 px-4 py-2 text-gray-700 transition hover:border-red-800 hover:bg-red-800 hover:text-white dark:border-neutral-600 dark:text-neutral-200"
              @click="editRule(rule)"
            >
              {{ $t('acl.edit') }}
            </button>
            <button
              class="flex-1 inline-flex items-center justify-center rounded-lg border-2 border-red-600 bg-red-600 px-4 py-2 text-white transition hover:border-red-800 hover:bg-red-800 dark:border-red-500 dark:bg-red-500"
              @click="deleteRuleConfirm(rule)"
            >
              {{ $t('acl.delete') }}
            </button>
          </div>
        </div>
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
        <FormElement ref="formElement" class="space-y-6" @submit.prevent="submitRule">
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
              <div class="relative flex-1">
                <FormPrimaryActionField
                  type="submit"
                  :label="editingRule ? $t('form.update') : $t('form.create')"
                  :disabled="!isFormValid"
                />
                <BaseTooltip v-if="!isFormValid" :text="validationMessage">
                  <div class="absolute inset-0 cursor-not-allowed" />
                </BaseTooltip>
              </div>
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

const { data: _config, refresh: refreshConfig } = await useFetch('/api/admin/acl/config', {
  method: 'get',
});
const config = toRef(_config.value);

const { data: _rules, refresh: refreshRules } = await useFetch('/api/admin/acl/rules', {
  method: 'get',
});
const rules = toRef(_rules.value);

const { data: clients } = await useFetch<ClientType[]>('/api/client', {
  method: 'get',
});

const showCreateModal = ref(false);
const editingRule = ref<AclRuleType | null>(null);
const showSourceClientPicker = ref(false);
const showDestClientPicker = ref(false);
const formElement = ref<HTMLFormElement | null>(null);

const ruleForm = ref({
  interfaceId: 'wg0',
  sourceCidr: '',
  destinationCidr: '',
  protocol: 'tcp' as 'tcp' | 'udp' | 'icmp',
  ports: '',
  description: '',
  enabled: true,
});

const isFormValid = computed(() => {
  if (!ruleForm.value.sourceCidr || !ruleForm.value.destinationCidr) {
    return false;
  }
  if (ruleForm.value.protocol !== 'icmp' && !ruleForm.value.ports) {
    return false;
  }
  return true;
});

const validationMessage = computed(() => {
  const missing = [];
  if (!ruleForm.value.sourceCidr) missing.push('Source CIDR');
  if (!ruleForm.value.destinationCidr) missing.push('Destination CIDR');
  if (ruleForm.value.protocol !== 'icmp' && !ruleForm.value.ports) missing.push('Ports');
  return `Please fill in: ${missing.join(', ')}`;
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
    { 
      revert: async () => { 
        await refreshConfig(); 
        config.value = toRef(_config.value).value;
      } 
    }
  )(config.value);
}

async function submitRule() {
  // Check form validity before submitting
  const form = formElement.value?.$el as HTMLFormElement;
  if (form && !form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const data = { ...ruleForm.value };
  
  // Clear ports for ICMP
  if (data.protocol === 'icmp') {
    data.ports = '';
  }

  try {
    if (editingRule.value) {
      await useSubmit(
        `/api/admin/acl/rules/${editingRule.value.id}`,
        { method: 'post' },
        { revert: async () => { 
          await refreshRules(); 
          rules.value = toRef(_rules.value).value;
        } }
      )(data);
    } else {
      await useSubmit(
        '/api/admin/acl/rules',
        { method: 'post' },
        { revert: async () => { 
          await refreshRules(); 
          rules.value = toRef(_rules.value).value;
        } }
      )(data);
    }

    await refreshRules();
    rules.value = toRef(_rules.value).value;
    closeModal();
  } catch (error) {
    // Don't close modal on error
    console.error('Failed to save rule:', error);
  }
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
  rules.value = toRef(_rules.value).value;
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
