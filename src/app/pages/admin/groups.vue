<template>
  <main v-if="groups">
    <section>
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-2xl font-bold">{{ $t('groups.title') }}</h2>
        <button
          class="rounded-lg border-2 border-red-800 bg-red-800 px-4 py-2 text-white hover:border-red-600 hover:bg-red-600"
          @click="openCreate"
        >
          {{ $t('groups.addGroup') }}
        </button>
      </div>
      <p class="mb-4 text-sm text-gray-500 dark:text-neutral-400">
        {{ $t('groups.subtitle') }}
      </p>

      <!-- Groups table -->
      <div v-if="groups.length > 0" class="overflow-x-auto">
        <table class="w-full table-fixed border-collapse">
          <thead class="bg-gray-100 dark:bg-neutral-700">
            <tr>
              <th class="border p-2 text-center">{{ $t('groups.name') }}</th>
              <th class="border p-2 text-center">
                {{ $t('groups.description') }}
              </th>
              <th class="w-32 border p-2 text-center">
                {{ $t('groups.memberCount') }}
              </th>
              <th class="w-64 border p-2 text-center">
                {{ $t('groups.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="group in groups"
              :key="group.id"
              class="transition hover:bg-gray-50 dark:hover:bg-neutral-600"
            >
              <td class="border p-2 text-center font-medium">
                {{ group.name }}
                <span
                  v-if="group.kind === 'all'"
                  class="ml-1 rounded bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-neutral-600 dark:text-neutral-300"
                >
                  {{ $t('groups.system') }}
                </span>
              </td>
              <td class="truncate border p-2 text-center">
                {{ group.description || '—' }}
              </td>
              <td class="border p-2 text-center">
                <span v-if="group.kind === 'all'">{{
                  $t('groups.allClients')
                }}</span>
                <span v-else>{{ group.members.length }}</span>
              </td>
              <td class="whitespace-nowrap border p-2 text-center">
                <template v-if="group.kind === 'all'">
                  <span class="text-sm text-gray-500 dark:text-neutral-400">{{
                    $t('groups.locked')
                  }}</span>
                </template>
                <template v-else>
                  <button
                    class="mr-2 inline-flex items-center rounded-lg border-2 border-gray-100 px-4 py-2 text-gray-700 transition hover:border-red-800 hover:bg-red-800 hover:text-white dark:border-neutral-600 dark:text-neutral-200"
                    @click="openEdit(group)"
                  >
                    {{ $t('groups.edit') }}
                  </button>
                  <button
                    class="inline-flex items-center rounded-lg border-2 border-red-600 bg-red-600 px-4 py-2 text-white transition hover:border-red-800 hover:bg-red-800 dark:border-red-500 dark:bg-red-500"
                    @click="deleteGroupConfirm(group)"
                  >
                    {{ $t('groups.delete') }}
                  </button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-else
        class="rounded border border-gray-300 p-8 text-center text-gray-500 dark:border-neutral-700"
      >
        <p>{{ $t('groups.noGroups') }}</p>
        <p class="mt-2 text-sm">{{ $t('groups.noGroupsHint') }}</p>
      </div>
    </section>

    <!-- Create/Edit modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75 dark:bg-black dark:bg-opacity-50"
      @click.self="closeModal"
    >
      <div
        class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white px-6 py-8 shadow-2xl dark:bg-neutral-700"
      >
        <h3 class="mb-6 text-xl font-bold text-gray-900 dark:text-neutral-200">
          {{ editingGroup ? $t('groups.editGroup') : $t('groups.createGroup') }}
        </h3>
        <FormElement class="space-y-6" @submit.prevent="submitGroup">
          <FormGroup>
            <FormTextField
              id="group-name"
              v-model.trim="form.name"
              :label="$t('groups.name')"
              :placeholder="$t('groups.namePlaceholder')"
              required
            />
          </FormGroup>
          <FormGroup>
            <FormTextField
              id="group-description"
              v-model="form.description"
              :label="$t('groups.description')"
              :placeholder="$t('groups.descriptionPlaceholder')"
            />
          </FormGroup>

          <FormGroup>
            <label
              class="mb-2 block text-sm font-medium text-gray-700 dark:text-neutral-300"
            >
              {{ $t('groups.members') }}
            </label>

            <ul v-if="form.members.length > 0" class="mb-3 space-y-2">
              <li
                v-for="(member, index) in form.members"
                :key="index"
                class="flex items-center justify-between rounded border border-gray-200 px-3 py-2 dark:border-neutral-600"
              >
                <span>
                  <span
                    class="mr-2 rounded bg-gray-200 px-2 py-1 text-xs font-semibold dark:bg-neutral-600"
                  >
                    {{
                      member.clientId !== null
                        ? $t('groups.client')
                        : $t('groups.cidr')
                    }}
                  </span>
                  <span class="font-mono text-sm">{{
                    memberLabel(member)
                  }}</span>
                </span>
                <button
                  type="button"
                  class="text-sm text-red-600 hover:text-red-800"
                  @click="removeMember(index)"
                >
                  {{ $t('groups.remove') }}
                </button>
              </li>
            </ul>
            <p v-else class="mb-3 text-sm text-gray-500 dark:text-neutral-400">
              {{ $t('groups.noMembers') }}
            </p>

            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="rounded-lg border-2 border-gray-100 px-3 py-2 text-sm text-gray-700 transition hover:border-red-800 hover:bg-red-800 hover:text-white dark:border-neutral-600 dark:text-neutral-200"
                @click="showClientPicker = true"
              >
                {{ $t('groups.addClient') }}
              </button>
              <div class="flex flex-1 items-center gap-2">
                <BaseInput
                  v-model.trim="cidrInput"
                  type="text"
                  :placeholder="$t('groups.cidrPlaceholder')"
                  autocomplete="off"
                  @keydown.enter.prevent="addCidr"
                />
                <button
                  type="button"
                  class="whitespace-nowrap rounded-lg border-2 border-gray-100 px-3 py-2 text-sm text-gray-700 transition hover:border-red-800 hover:bg-red-800 hover:text-white dark:border-neutral-600 dark:text-neutral-200"
                  @click="addCidr"
                >
                  {{ $t('groups.addCidr') }}
                </button>
              </div>
            </div>
          </FormGroup>

          <FormGroup>
            <div class="col-span-2 flex gap-2">
              <FormPrimaryActionField
                type="submit"
                :label="editingGroup ? $t('form.update') : $t('form.create')"
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

    <!-- Client picker -->
    <div
      v-if="showClientPicker"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-gray-500 bg-opacity-75 dark:bg-black dark:bg-opacity-50"
      @click.self="showClientPicker = false"
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
            @click="addClient(client)"
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
          @click="showClientPicker = false"
        >
          {{ $t('form.cancel') }}
        </button>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import type {
  AclGroupWithMembersType,
  AclGroupMemberType,
} from '#db/repositories/acl/types';
import type { ClientType } from '#db/repositories/client/types';

type MemberInput = Pick<AclGroupMemberType, 'clientId' | 'cidr'>;

const { t: $t } = useI18n();

const { data: _groups, refresh: refreshGroups } = await useFetch(
  '/api/admin/acl/groups',
  { method: 'get' }
);
const groups = toRef(_groups.value);

const { data: clients } = await useFetch<ClientType[]>('/api/client', {
  method: 'get',
});

const sortedClients = computed(() =>
  [...(clients.value ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
);

const showModal = ref(false);
const showClientPicker = ref(false);
const editingGroup = ref<AclGroupWithMembersType | null>(null);
const cidrInput = ref('');

const emptyForm = () => ({
  interfaceId: 'wg0',
  name: '',
  description: '',
  members: [] as MemberInput[],
});
const form = ref(emptyForm());

function clientName(clientId: number): string | null {
  const client = clients.value?.find((c) => c.id === clientId);
  return client ? `${client.name} (${client.ipv4Address}/32)` : null;
}

function memberLabel(member: MemberInput): string {
  if (member.clientId !== null && member.clientId !== undefined) {
    return clientName(member.clientId) ?? `client #${member.clientId}`;
  }
  return member.cidr ?? '';
}

function openCreate() {
  editingGroup.value = null;
  form.value = emptyForm();
  showModal.value = true;
}

function openEdit(group: AclGroupWithMembersType) {
  editingGroup.value = group;
  form.value = {
    interfaceId: 'wg0',
    name: group.name,
    description: group.description ?? '',
    members: group.members.map((m) => ({
      clientId: m.clientId,
      cidr: m.cidr,
    })),
  };
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingGroup.value = null;
  form.value = emptyForm();
  cidrInput.value = '';
}

function addClient(client: ClientType) {
  const exists = form.value.members.some((m) => m.clientId === client.id);
  if (!exists) {
    form.value.members.push({ clientId: client.id, cidr: null });
  }
  showClientPicker.value = false;
}

function addCidr() {
  const value = cidrInput.value.trim();
  if (!value) return;
  const exists = form.value.members.some((m) => m.cidr === value);
  if (!exists) {
    form.value.members.push({ clientId: null, cidr: value });
  }
  cidrInput.value = '';
}

function removeMember(index: number) {
  form.value.members.splice(index, 1);
}

async function submitGroup() {
  const payload = {
    interfaceId: form.value.interfaceId,
    name: form.value.name,
    description: form.value.description || undefined,
    members: form.value.members.map((m) =>
      m.clientId !== null && m.clientId !== undefined
        ? { clientId: m.clientId }
        : { cidr: m.cidr }
    ),
  };

  try {
    if (editingGroup.value) {
      const groupId = editingGroup.value.id;
      await useSubmit(
        (data) =>
          $fetch(`/api/admin/acl/groups/${groupId}`, {
            method: 'post',
            body: data,
          }),
        {
          revert: async () => {
            await refreshGroups();
          },
        }
      )(payload);
    } else {
      await useSubmit(
        (data) =>
          $fetch('/api/admin/acl/groups', { method: 'post', body: data }),
        {
          revert: async () => {
            await refreshGroups();
          },
        }
      )(payload);
    }
    await refreshGroups();
    groups.value = toRef(_groups.value).value;
    closeModal();
  } catch (error) {
    console.error('Failed to save group:', error);
  }
}

async function deleteGroupConfirm(group: AclGroupWithMembersType) {
  if (!confirm(`${$t('groups.deleteConfirm')} (${group.name})`)) {
    return;
  }
  try {
    await $fetch(`/api/admin/acl/groups/${group.id}`, { method: 'DELETE' });
    await refreshGroups();
    groups.value = toRef(_groups.value).value;
  } catch (error) {
    console.error('Failed to delete group:', error);
  }
}
</script>
