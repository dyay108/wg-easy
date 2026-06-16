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
            <label
              for="acl-exit-node-client"
              class="block text-sm font-medium text-gray-700 dark:text-neutral-300"
            >
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
              v-for="client in sortedClients.filter((c) => c.isExitNode)"
              :key="client.id"
              :value="client.id"
            >
              {{ client.name }} ({{ client.ipv4Address }})
            </option>
          </select>
        </FormGroup>
        <FormGroup>
          <FormPrimaryActionField type="submit" :label="$t('form.save')" />
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
              <th class="whitespace-normal break-words border p-2 text-center">
                {{ $t('acl.source') }}
              </th>
              <th class="whitespace-normal break-words border p-2 text-center">
                {{ $t('acl.destination') }}
              </th>
              <th class="whitespace-normal break-words border p-2 text-center">
                {{ $t('acl.protocol') }}
              </th>
              <th
                class="w-48 whitespace-normal break-words border p-2 text-center"
              >
                {{ $t('acl.ports') }}
              </th>
              <th class="whitespace-normal break-words border p-2 text-center">
                {{ $t('acl.description') }}
              </th>
              <th class="whitespace-normal break-words border p-2 text-center">
                {{ $t('acl.enabled') }}
              </th>
              <th
                class="w-64 whitespace-normal break-words border p-2 text-center"
              >
                {{ $t('acl.actions') }}
              </th>
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
                          v-if="sideBadge(rule, 'source')"
                          class="inline-block max-w-full truncate rounded bg-gray-200 px-2 py-1 text-xs font-semibold text-white dark:bg-neutral-600"
                        >
                          {{ sideBadge(rule, 'source') }}
                        </span>
                        <span v-else class="block truncate font-mono text-sm">
                          {{ sideValue(rule, 'source') }}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipPortal>
                      <TooltipContent
                        class="z-[9999] min-w-[16rem] max-w-[32rem] select-none whitespace-pre-wrap break-words rounded bg-gray-600 px-3 py-2 text-center text-sm leading-relaxed text-white shadow-lg will-change-[transform,opacity]"
                        :side-offset="5"
                      >
                        {{ sideTooltip(rule, 'source') }}
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
                          v-if="sideBadge(rule, 'destination')"
                          class="inline-block max-w-full truncate rounded bg-gray-200 px-2 py-1 text-xs font-semibold text-white dark:bg-neutral-600"
                        >
                          {{ sideBadge(rule, 'destination') }}
                        </span>
                        <span v-else class="block truncate font-mono text-sm">
                          {{ sideValue(rule, 'destination') }}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipPortal>
                      <TooltipContent
                        class="z-[9999] min-w-[16rem] max-w-[32rem] select-none whitespace-pre-wrap break-words rounded bg-gray-600 px-3 py-2 text-center text-sm leading-relaxed text-white shadow-lg will-change-[transform,opacity]"
                        :side-offset="5"
                      >
                        {{ sideTooltip(rule, 'destination') }}
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
                      <span
                        class="inline-block max-w-full truncate rounded bg-gray-200 px-2 py-1 text-xs font-semibold dark:bg-neutral-600"
                      >
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
              <td class="whitespace-nowrap border p-2 text-center">
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
            <span
              class="rounded bg-gray-200 px-2 py-1 text-xs font-semibold dark:bg-neutral-600"
            >
              {{ rule.protocol.toUpperCase() }}
            </span>
            <span v-if="rule.enabled" class="text-green-600">✓</span>
            <span v-else class="text-red-600">✗</span>
          </div>

          <div class="grid grid-cols-1 gap-3 text-sm">
            <div>
              <div
                class="text-xs font-medium text-gray-500 dark:text-neutral-400"
              >
                {{ $t('acl.source') }}
              </div>
              <div class="mt-1">
                <details class="group">
                  <summary
                    class="cursor-pointer list-none"
                    style="list-style: none"
                  >
                    <span
                      v-if="sideBadge(rule, 'source')"
                      class="inline-block max-w-full truncate rounded bg-gray-200 px-2 py-1 text-xs font-semibold text-white dark:bg-neutral-600"
                    >
                      {{ sideBadge(rule, 'source') }}
                    </span>
                    <span
                      v-else
                      class="block max-w-full truncate font-mono text-sm"
                    >
                      {{ sideValue(rule, 'source') }}
                    </span>
                  </summary>
                  <div
                    class="mt-1 break-words text-xs text-gray-500 dark:text-neutral-400"
                  >
                    {{ sideTooltip(rule, 'source') }}
                  </div>
                </details>
              </div>
            </div>

            <div>
              <div
                class="text-xs font-medium text-gray-500 dark:text-neutral-400"
              >
                {{ $t('acl.destination') }}
              </div>
              <div class="mt-1">
                <details class="group">
                  <summary
                    class="cursor-pointer list-none"
                    style="list-style: none"
                  >
                    <span
                      v-if="sideBadge(rule, 'destination')"
                      class="inline-block max-w-full truncate rounded bg-gray-200 px-2 py-1 text-xs font-semibold text-white dark:bg-neutral-600"
                    >
                      {{ sideBadge(rule, 'destination') }}
                    </span>
                    <span
                      v-else
                      class="block max-w-full truncate font-mono text-sm"
                    >
                      {{ sideValue(rule, 'destination') }}
                    </span>
                  </summary>
                  <div
                    class="mt-1 break-words text-xs text-gray-500 dark:text-neutral-400"
                  >
                    {{ sideTooltip(rule, 'destination') }}
                  </div>
                </details>
              </div>
            </div>

            <div>
              <div
                class="text-xs font-medium text-gray-500 dark:text-neutral-400"
              >
                {{ $t('acl.ports') }}
              </div>
              <div class="mt-1 min-w-0">
                <details v-if="rule.ports" class="group">
                  <summary
                    class="cursor-pointer list-none"
                    style="list-style: none"
                  >
                    <div class="truncate font-mono text-sm">
                      {{ rule.ports }}
                    </div>
                  </summary>
                  <div
                    class="mt-1 break-words text-xs text-gray-500 dark:text-neutral-400"
                  >
                    {{ rule.ports }}
                  </div>
                </details>
                <div v-else>—</div>
              </div>
            </div>

            <div>
              <div
                class="text-xs font-medium text-gray-500 dark:text-neutral-400"
              >
                {{ $t('acl.description') }}
              </div>
              <div class="mt-1 min-w-0">
                <details v-if="rule.description" class="group">
                  <summary
                    class="cursor-pointer list-none"
                    style="list-style: none"
                  >
                    <div class="w-full truncate">
                      {{ rule.description }}
                    </div>
                  </summary>
                  <div
                    class="mt-1 break-words text-xs text-gray-500 dark:text-neutral-400"
                  >
                    {{ rule.description }}
                  </div>
                </details>
                <div v-else>—</div>
              </div>
            </div>
          </div>

          <div class="mt-4 flex gap-2">
            <button
              class="inline-flex flex-1 items-center justify-center rounded-lg border-2 border-gray-100 px-4 py-2 text-gray-700 transition hover:border-red-800 hover:bg-red-800 hover:text-white dark:border-neutral-600 dark:text-neutral-200"
              @click="editRule(rule)"
            >
              {{ $t('acl.edit') }}
            </button>
            <button
              class="inline-flex flex-1 items-center justify-center rounded-lg border-2 border-red-600 bg-red-600 px-4 py-2 text-white transition hover:border-red-800 hover:bg-red-800 dark:border-red-500 dark:bg-red-500"
              @click="deleteRuleConfirm(rule)"
            >
              {{ $t('acl.delete') }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-else
        class="rounded border border-gray-300 p-8 text-center text-gray-500 dark:border-neutral-700"
      >
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
      <div
        class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white px-6 py-8 shadow-2xl dark:bg-neutral-700"
      >
        <h3 class="mb-6 text-xl font-bold text-gray-900 dark:text-neutral-200">
          {{ editingRule ? $t('acl.editRule') : $t('acl.createRule') }}
        </h3>
        <FormElement
          ref="formElement"
          class="space-y-6"
          @submit.prevent="submitRule"
        >
          <FormGroup>
            <label
              for="sourceCidr"
              class="mb-2 block text-sm font-medium text-gray-700 dark:text-neutral-300"
            >
              {{ $t('acl.source') }}
            </label>
            <div class="mb-2 flex gap-2">
              <button
                type="button"
                :class="toggleBtnClass(ruleForm.sourceType === 'cidr')"
                @click="ruleForm.sourceType = 'cidr'"
              >
                {{ $t('acl.typeCidr') }}
              </button>
              <button
                type="button"
                :class="toggleBtnClass(ruleForm.sourceType === 'group')"
                @click="ruleForm.sourceType = 'group'"
              >
                {{ $t('acl.typeGroup') }}
              </button>
            </div>
            <div v-if="ruleForm.sourceType === 'cidr'">
              <div class="relative">
                <BaseInput
                  id="sourceCidr"
                  v-model.trim="ruleForm.sourceCidr"
                  name="sourceCidr"
                  type="text"
                  placeholder="10.8.0.2/32"
                  autocomplete="off"
                  style="padding-right: 8rem"
                  required
                />
                <button
                  type="button"
                  class="absolute bottom-1 right-2 top-1 ml-2 rounded bg-gray-100 px-3 text-xs transition hover:bg-red-800 hover:text-white dark:bg-neutral-600 dark:text-neutral-300 dark:hover:bg-red-800 dark:hover:text-white"
                  @click="showSourceClientPicker = true"
                >
                  {{ $t('acl.selectClient') }}
                </button>
              </div>
              <p
                v-if="getClientNameByCidr(ruleForm.sourceCidr)"
                class="mt-1 text-sm text-red-700 dark:text-red-400"
              >
                {{ getClientNameByCidr(ruleForm.sourceCidr) }}
              </p>
            </div>
            <select
              v-else
              v-model="ruleForm.sourceGroupId"
              class="w-full rounded-lg border-2 border-gray-100 text-gray-500 focus:border-red-800 focus:outline-0 focus:ring-0 dark:border-neutral-800 dark:bg-neutral-700 dark:text-neutral-200"
            >
              <option :value="null" disabled>
                {{ $t('acl.selectGroup') }}
              </option>
              <option v-for="g in aclGroups || []" :key="g.id" :value="g.id">
                {{ g.name }}
              </option>
            </select>
          </FormGroup>
          <FormGroup>
            <label
              for="destinationCidr"
              class="mb-2 block text-sm font-medium text-gray-700 dark:text-neutral-300"
            >
              {{ $t('acl.destination') }}
            </label>
            <div class="mb-2 flex gap-2">
              <button
                type="button"
                :class="toggleBtnClass(ruleForm.destinationType === 'cidr')"
                @click="ruleForm.destinationType = 'cidr'"
              >
                {{ $t('acl.typeCidr') }}
              </button>
              <button
                type="button"
                :class="toggleBtnClass(ruleForm.destinationType === 'group')"
                @click="ruleForm.destinationType = 'group'"
              >
                {{ $t('acl.typeGroup') }}
              </button>
            </div>
            <div v-if="ruleForm.destinationType === 'cidr'">
              <div class="relative">
                <BaseInput
                  id="destinationCidr"
                  v-model.trim="ruleForm.destinationCidr"
                  name="destinationCidr"
                  type="text"
                  placeholder="10.8.0.3/32"
                  autocomplete="off"
                  style="padding-right: 8rem"
                  required
                />
                <button
                  type="button"
                  class="absolute bottom-1 right-2 top-1 ml-2 rounded bg-gray-100 px-3 text-xs transition hover:bg-red-800 hover:text-white dark:bg-neutral-600 dark:text-neutral-300 dark:hover:bg-red-800 dark:hover:text-white"
                  @click="showDestClientPicker = true"
                >
                  {{ $t('acl.selectClient') }}
                </button>
              </div>
              <p
                v-if="getClientNameByCidr(ruleForm.destinationCidr)"
                class="mt-1 text-sm text-red-700 dark:text-red-400"
              >
                {{ getClientNameByCidr(ruleForm.destinationCidr) }}
              </p>
            </div>
            <select
              v-else
              v-model="ruleForm.destinationGroupId"
              class="w-full rounded-lg border-2 border-gray-100 text-gray-500 focus:border-red-800 focus:outline-0 focus:ring-0 dark:border-neutral-800 dark:bg-neutral-700 dark:text-neutral-200"
            >
              <option :value="null" disabled>
                {{ $t('acl.selectGroup') }}
              </option>
              <option v-for="g in aclGroups || []" :key="g.id" :value="g.id">
                {{ g.name }}
              </option>
            </select>
          </FormGroup>
          <FormGroup>
            <label
              for="protocol"
              class="mb-2 block text-sm font-medium text-gray-700 dark:text-neutral-300"
              >{{ $t('acl.protocol') }}</label
            >
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
      <div
        class="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-2xl dark:bg-neutral-700"
      >
        <h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-neutral-200">
          {{ $t('acl.selectClient') }}
        </h3>
        <div v-if="clients && clients.length > 0" class="space-y-2">
          <button
            v-for="client in sortedClients"
            :key="client.id"
            type="button"
            class="w-full rounded border p-3 text-left transition hover:border-red-200 hover:bg-red-50 dark:border-neutral-700 dark:hover:border-red-800 dark:hover:bg-neutral-700"
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

const { data: _config, refresh: refreshConfig } = await useFetch(
  '/api/admin/acl/config',
  {
    method: 'get',
  }
);
const config = toRef(_config.value);

const { data: _rules, refresh: refreshRules } = await useFetch(
  '/api/admin/acl/rules',
  {
    method: 'get',
  }
);
const rules = toRef(_rules.value);

const { data: clients } = await useFetch<ClientType[]>('/api/client', {
  method: 'get',
});

const sortedClients = computed(() =>
  [...(clients.value ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
);

const { data: aclGroups } = await useFetch('/api/admin/acl/groups', {
  method: 'get',
});

const showCreateModal = ref(false);
const editingRule = ref<AclRuleType | null>(null);
const showSourceClientPicker = ref(false);
const showDestClientPicker = ref(false);
const formElement = ref<HTMLFormElement | null>(null);

type SideType = 'cidr' | 'group';

const ruleForm = ref({
  interfaceId: 'wg0',
  sourceType: 'cidr' as SideType,
  sourceCidr: '',
  sourceGroupId: null as number | null,
  destinationType: 'cidr' as SideType,
  destinationCidr: '',
  destinationGroupId: null as number | null,
  protocol: 'tcp' as 'tcp' | 'udp' | 'icmp',
  ports: '',
  description: '',
  enabled: true,
});

const isFormValid = computed(() => {
  const sourceOk =
    ruleForm.value.sourceType === 'group'
      ? ruleForm.value.sourceGroupId !== null
      : !!ruleForm.value.sourceCidr;
  const destOk =
    ruleForm.value.destinationType === 'group'
      ? ruleForm.value.destinationGroupId !== null
      : !!ruleForm.value.destinationCidr;
  if (!sourceOk || !destOk) {
    return false;
  }
  if (ruleForm.value.protocol !== 'icmp' && !ruleForm.value.ports) {
    return false;
  }
  return true;
});

const validationMessage = computed(() => {
  const missing = [];
  const sourceOk =
    ruleForm.value.sourceType === 'group'
      ? ruleForm.value.sourceGroupId !== null
      : !!ruleForm.value.sourceCidr;
  const destOk =
    ruleForm.value.destinationType === 'group'
      ? ruleForm.value.destinationGroupId !== null
      : !!ruleForm.value.destinationCidr;
  if (!sourceOk) missing.push('Source');
  if (!destOk) missing.push('Destination');
  if (ruleForm.value.protocol !== 'icmp' && !ruleForm.value.ports)
    missing.push('Ports');
  return `Please fill in: ${missing.join(', ')}`;
});

function getClientNameByCidr(cidr: string | null): string | null {
  if (!clients.value || !cidr) return null;

  // Extract IP from CIDR (e.g., "10.8.0.2/32" -> "10.8.0.2")
  const ip = cidr.split('/')[0];

  const client = clients.value.find((c) => c.ipv4Address === ip);
  return client ? client.name : null;
}

function getGroupName(groupId: number | null): string | null {
  if (groupId === null || !aclGroups.value) return null;
  const group = aclGroups.value.find((g) => g.id === groupId);
  return group ? group.name : null;
}

/** True when a rule side references a group */
function sideIsGroup(rule: AclRuleType, side: 'source' | 'destination') {
  return (
    (side === 'source' ? rule.sourceGroupId : rule.destinationGroupId) !== null
  );
}

/**
 * Badge label for a rule side: "Group: name" for groups, the client name for a
 * client CIDR, or null for a plain CIDR (which renders the raw value instead).
 */
function sideBadge(rule: AclRuleType, side: 'source' | 'destination') {
  const groupId =
    side === 'source' ? rule.sourceGroupId : rule.destinationGroupId;
  if (groupId !== null) {
    return `${$t('acl.typeGroup')}: ${getGroupName(groupId) ?? groupId}`;
  }
  const cidr = side === 'source' ? rule.sourceCidr : rule.destinationCidr;
  return getClientNameByCidr(cidr);
}

/** Raw value for a rule side: the CIDR, or the badge label for groups */
function sideValue(rule: AclRuleType, side: 'source' | 'destination') {
  if (sideIsGroup(rule, side)) {
    return sideBadge(rule, side) ?? '';
  }
  const cidr = side === 'source' ? rule.sourceCidr : rule.destinationCidr;
  return cidr ?? '';
}

/** Tooltip text for a rule side */
function sideTooltip(rule: AclRuleType, side: 'source' | 'destination') {
  if (sideIsGroup(rule, side)) {
    return sideBadge(rule, side) ?? '';
  }
  const badge = sideBadge(rule, side);
  const cidr = side === 'source' ? rule.sourceCidr : rule.destinationCidr;
  return badge ? `${badge} (${cidr})` : (cidr ?? '');
}

function toggleBtnClass(active: boolean) {
  return active
    ? 'rounded-lg border-2 border-red-800 bg-red-800 px-3 py-1 text-sm text-white'
    : 'rounded-lg border-2 border-gray-100 px-3 py-1 text-sm text-gray-700 hover:border-red-800 dark:border-neutral-600 dark:text-neutral-200';
}

const { t: $t } = useI18n();

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
    (data) =>
      $fetch('/api/admin/acl/config', {
        method: 'post',
        body: data,
      }),
    {
      revert: async () => {
        await refreshConfig();
        config.value = toRef(_config.value).value;
      },
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

  const f = ruleForm.value;
  const data: Record<string, unknown> = {
    interfaceId: f.interfaceId,
    protocol: f.protocol,
    // Clear ports for ICMP
    ports: f.protocol === 'icmp' ? '' : f.ports,
    description: f.description || undefined,
    enabled: f.enabled,
  };

  if (f.sourceType === 'group') {
    data.sourceGroupId = f.sourceGroupId;
    data.sourceCidr = null;
  } else {
    data.sourceCidr = f.sourceCidr;
    data.sourceGroupId = null;
  }

  if (f.destinationType === 'group') {
    data.destinationGroupId = f.destinationGroupId;
    data.destinationCidr = null;
  } else {
    data.destinationCidr = f.destinationCidr;
    data.destinationGroupId = null;
  }

  try {
    if (editingRule.value) {
      const ruleId = editingRule.value.id;
      await useSubmit(
        (data) =>
          $fetch(`/api/admin/acl/rules/${ruleId}`, {
            method: 'post',
            body: data,
          }),
        {
          revert: async () => {
            await refreshRules();
            rules.value = toRef(_rules.value).value;
          },
        }
      )(data);
    } else {
      await useSubmit(
        (data) =>
          $fetch('/api/admin/acl/rules', {
            method: 'post',
            body: data,
          }),
        {
          revert: async () => {
            await refreshRules();
            rules.value = toRef(_rules.value).value;
          },
        }
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
    sourceType: rule.sourceGroupId !== null ? 'group' : 'cidr',
    sourceCidr: rule.sourceCidr ?? '',
    sourceGroupId: rule.sourceGroupId,
    destinationType: rule.destinationGroupId !== null ? 'group' : 'cidr',
    destinationCidr: rule.destinationCidr ?? '',
    destinationGroupId: rule.destinationGroupId,
    protocol: rule.protocol as 'tcp' | 'udp' | 'icmp',
    ports: rule.ports,
    description: rule.description || '',
    enabled: rule.enabled,
  };
}

async function deleteRuleConfirm(rule: AclRuleType) {
  if (
    !confirm(
      `Delete rule: ${sideValue(rule, 'source')} → ${sideValue(rule, 'destination')}?`
    )
  ) {
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
    sourceType: 'cidr',
    sourceCidr: '',
    sourceGroupId: null,
    destinationType: 'cidr',
    destinationCidr: '',
    destinationGroupId: null,
    protocol: 'tcp',
    ports: '',
    description: '',
    enabled: true,
  };
}
</script>
