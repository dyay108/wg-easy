import { relations, sql } from 'drizzle-orm';
import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { client, wgInterface } from '../../schema';

export const aclGroup = sqliteTable('acl_group_table', {
  id: int().primaryKey({ autoIncrement: true }),
  interfaceId: text('interface_id')
    .notNull()
    .references(() => wgInterface.name, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export const aclGroupMember = sqliteTable('acl_group_member_table', {
  id: int().primaryKey({ autoIncrement: true }),
  groupId: int('group_id')
    .notNull()
    .references(() => aclGroup.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  /** set when the member is a client; mutually exclusive with `cidr` */
  clientId: int('client_id').references(() => client.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  /** set when the member is a manual CIDR; mutually exclusive with `clientId` */
  cidr: text('cidr'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const aclGroupRelations = relations(aclGroup, ({ many }) => ({
  members: many(aclGroupMember),
}));

export const aclGroupMemberRelations = relations(aclGroupMember, ({ one }) => ({
  group: one(aclGroup, {
    fields: [aclGroupMember.groupId],
    references: [aclGroup.id],
  }),
  client: one(client, {
    fields: [aclGroupMember.clientId],
    references: [client.id],
  }),
}));

export const aclRule = sqliteTable('acl_rules_table', {
  id: int().primaryKey({ autoIncrement: true }),
  interfaceId: text('interface_id')
    .notNull()
    .references(() => wgInterface.name, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  /** null when the source is a group (see `sourceGroupId`) */
  sourceCidr: text('source_cidr'),
  /** null when the destination is a group (see `destinationGroupId`) */
  destinationCidr: text('destination_cidr'),
  /** null when the source is a CIDR; references an acl group otherwise */
  sourceGroupId: int('source_group_id').references(() => aclGroup.id, {
    onDelete: 'restrict',
    onUpdate: 'cascade',
  }),
  /** null when the destination is a CIDR; references an acl group otherwise */
  destinationGroupId: int('destination_group_id').references(
    () => aclGroup.id,
    {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }
  ),
  protocol: text('protocol').notNull(), // 'tcp', 'udp', 'icmp'
  ports: text('ports').notNull(), // "22,80,443" or "1-65535" or "" for ICMP
  enabled: int({ mode: 'boolean' }).notNull().default(true),
  description: text('description'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export const aclConfig = sqliteTable('acl_config_table', {
  /** same as `wgInterface.name` */
  id: text()
    .primaryKey()
    .references(() => wgInterface.name, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  enabled: int({ mode: 'boolean' }).notNull().default(false),
  allowPublicEgress: int('allow_public_egress', { mode: 'boolean' })
    .notNull()
    .default(false),
  exitNodeClientId: int('exit_node_client_id'),
  defaultPolicy: text('default_policy').notNull().default('drop'), // 'drop' or 'accept'
  filterTableName: text('filter_table_name').notNull().default('wg_acl_v4'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});
