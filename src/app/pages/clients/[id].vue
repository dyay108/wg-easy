<template>
  <main v-if="data">
    <Panel>
      <PanelHead>
        <PanelHeadTitle :text="data.name" />
      </PanelHead>
      <PanelBody>
        <FormElement @submit.prevent="submit">
          <FormGroup>
            <FormHeading>
              {{ $t('form.sectionGeneral') }}
            </FormHeading>
            <FormTextField
              id="name"
              v-model="data.name"
              :label="$t('general.name')"
            />
            <FormSwitchField
              id="enabled"
              v-model="data.enabled"
              :label="$t('client.enabled')"
            />
            <FormDateField
              id="expiresAt"
              v-model="data.expiresAt"
              :description="$t('client.expireDateDesc')"
              :label="$t('client.expireDate')"
            />
          </FormGroup>
          <FormGroup>
            <FormHeading>{{ $t('client.address') }}</FormHeading>
            <FormTextField
              id="ipv4Address"
              v-model="data.ipv4Address"
              label="IPv4"
            />
            <FormTextField
              id="ipv6Address"
              v-model="data.ipv6Address"
              label="IPv6"
            />
            <FormInfoField
              id="endpoint"
              :data="data.endpoint ?? $t('client.notConnected')"
              :label="$t('client.endpoint')"
              :description="$t('client.endpointDesc')"
            />
          </FormGroup>
          <FormGroup>
            <FormHeading :description="$t('client.allowedIpsDesc')">
              {{ $t('general.allowedIps') }}
            </FormHeading>
            <FormNullArrayField v-model="data.allowedIps" name="allowedIps" />
          </FormGroup>
          <FormGroup>
            <FormHeading :description="$t('client.serverAllowedIpsDesc')">
              {{ $t('client.serverAllowedIps') }}
            </FormHeading>
            <FormArrayField
              v-model="data.serverAllowedIps"
              name="serverAllowedIps"
            />
          </FormGroup>
          <FormGroup>
            <FormHeading :description="$t('client.dnsDesc')">
              {{ $t('general.dns') }}
            </FormHeading>
            <FormNullArrayField v-model="data.dns" name="dns" />
          </FormGroup>
          <FormGroup>
            <FormHeading>{{ $t('form.sectionAdvanced') }}</FormHeading>
            <FormNumberField
              id="mtu"
              v-model="data.mtu"
              :description="$t('client.mtuDesc')"
              :label="$t('general.mtu')"
            />
            <FormNumberField
              id="persistentKeepalive"
              v-model="data.persistentKeepalive"
              :description="$t('client.persistentKeepaliveDesc')"
              :label="$t('general.persistentKeepalive')"
            />
          </FormGroup>
          <FormGroup>
            <FormHeading :description="$t('client.egressDesc')">
              {{ $t('client.egress') }}
            </FormHeading>
            <FormSwitchField
              id="egressEnabled"
              v-model="data.egressEnabled"
              :label="$t('client.egressEnabled')"
              :description="$t('client.egressEnabledDesc')"
            />
            <template v-if="data.egressEnabled">
              <div class="flex items-center">
                <FormLabel for="egressDevice">
                  {{ $t('client.egressDevice') }}
                </FormLabel>
                <BaseTooltip :text="$t('client.egressDeviceDesc')">
                  <IconsInfo class="size-4" />
                </BaseTooltip>
              </div>
              <select
                id="egressDevice"
                v-model="data.egressDevice"
                class="w-full rounded-lg border-2 border-gray-100 text-gray-500 focus:border-red-800 focus:outline-0 focus:ring-0 dark:border-neutral-800 dark:bg-neutral-700 dark:text-neutral-200"
              >
                <option :value="null">{{ $t('client.egressDeviceDefault') }}</option>
                <option v-for="device in exitNodes" :key="device" :value="device">
                  {{ device }}
                </option>
              </select>
            </template>
            <FormSwitchField
              id="isExitNode"
              v-model="data.isExitNode"
              :label="$t('client.isExitNode')"
              :description="$t('client.isExitNodeDesc')"
            />
            <div v-if="data.isExitNode" class="col-span-full space-y-4 rounded-lg border-2 border-gray-100 p-4 dark:border-neutral-800">
              <div>
                <p class="mb-2 text-sm font-medium text-gray-700 dark:text-neutral-300">
                  {{ $t('client.isExitNodePostUp') }}
                </p>
                <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth+ -j MASQUERADE</pre>
              </div>
              <div>
                <p class="mb-2 text-sm font-medium text-gray-700 dark:text-neutral-300">
                  {{ $t('client.isExitNodePostDown') }}
                </p>
                <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth+ -j MASQUERADE</pre>
              </div>
            </div>
          </FormGroup>
          <FormGroup v-if="globalStore.information?.isAwg">
            <FormHeading>{{ $t('awg.obfuscationParameters') }}</FormHeading>

            <FormNullNumberField
              id="jC"
              v-model="data.jC"
              :label="$t('awg.jCLabel')"
              :description="$t('awg.jCDescription')"
            />
            <FormNullNumberField
              id="Jmin"
              v-model="data.jMin"
              :label="$t('awg.jMinLabel')"
              :description="$t('awg.jMinDescription')"
            />
            <FormNullNumberField
              id="Jmax"
              v-model="data.jMax"
              :label="$t('awg.jMaxLabel')"
              :description="$t('awg.jMaxDescription')"
            />

            <div class="col-span-full text-sm">* {{ $t('awg.mtuNote') }}</div>

            <FormNullTextField
              id="i1"
              v-model="data.i1"
              :label="$t('awg.i1Label')"
              :description="$t('awg.i1Description')"
            />
            <FormNullTextField
              id="i2"
              v-model="data.i2"
              :label="$t('awg.i2Label')"
              :description="$t('awg.i2Description')"
            />
            <FormNullTextField
              id="i3"
              v-model="data.i3"
              :label="$t('awg.i3Label')"
              :description="$t('awg.i3Description')"
            />
            <FormNullTextField
              id="i4"
              v-model="data.i4"
              :label="$t('awg.i4Label')"
              :description="$t('awg.i4Description')"
            />
            <FormNullTextField
              id="i5"
              v-model="data.i5"
              :label="$t('awg.i5Label')"
              :description="$t('awg.i5Description')"
            />
          </FormGroup>
          <FormGroup>
            <FormHeading :description="$t('client.hooksDescription')">
              {{ $t('client.hooks') }}
            </FormHeading>
            <FormTextField
              id="PreUp"
              v-model="data.preUp"
              :description="$t('client.hooksLeaveEmpty')"
              :label="$t('hooks.preUp')"
            />
            <FormTextField
              id="PostUp"
              v-model="data.postUp"
              :description="$t('client.hooksLeaveEmpty')"
              :label="$t('hooks.postUp')"
            />
            <FormTextField
              id="PreDown"
              v-model="data.preDown"
              :description="$t('client.hooksLeaveEmpty')"
              :label="$t('hooks.preDown')"
            />
            <FormTextField
              id="PostDown"
              v-model="data.postDown"
              :description="$t('client.hooksLeaveEmpty')"
              :label="$t('hooks.postDown')"
            />
          </FormGroup>
          <FormGroup>
            <FormHeading>{{ $t('form.actions') }}</FormHeading>
            <FormPrimaryActionField type="submit" :label="$t('form.save')" />
            <FormSecondaryActionField
              :label="$t('form.revert')"
              @click="revert"
            />
            <ClientsDeleteDialog
              trigger-class="col-span-2"
              :client-name="data.name"
              @delete="deleteClient"
            >
              <FormSecondaryActionField
                :label="$t('client.delete')"
                class="w-full"
                type="button"
                tabindex="-1"
                as="span"
              />
            </ClientsDeleteDialog>
            <ClientsConfigDialog
              trigger-class="col-span-2"
              :client-id="data.id"
            >
              <FormSecondaryActionField
                :label="$t('client.viewConfig')"
                class="w-full"
                type="button"
                tabindex="-1"
                as="span"
              />
            </ClientsConfigDialog>
          </FormGroup>
        </FormElement>
      </PanelBody>
    </Panel>
  </main>
</template>

<script lang="ts" setup>
const globalStore = useGlobalStore();

const route = useRoute();
const id = route.params.id as string;

const { data: _data, refresh } = await useFetch(`/api/client/${id}`, {
  method: 'get',
});
const data = toRef(_data.value);

// Fetch available exit nodes
const { data: exitNodes } = await useFetch<string[]>('/api/admin/egress/devices', {
  method: 'get',
});

const _submit = useSubmit(
  `/api/client/${id}`,
  {
    method: 'post',
  },
  {
    revert: async (success) => {
      if (success) {
        await navigateTo('/');
      } else {
        await revert();
      }
    },
  }
);

function submit() {
  return _submit(data.value);
}

async function revert() {
  await refresh();
  data.value = toRef(_data.value).value;
}

const _deleteClient = useSubmit(
  `/api/client/${id}`,
  {
    method: 'delete',
  },
  {
    revert: async () => {
      await navigateTo('/');
    },
  }
);

function deleteClient() {
  return _deleteClient(undefined);
}
</script>
