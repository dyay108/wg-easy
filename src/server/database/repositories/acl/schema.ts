import { sql } from 'drizzle-orm';
import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { wgInterface } from '../../schema';

export const aclRule = sqliteTable('acl_rules_table', {
  id: int().primaryKey({ autoIncrement: true }),
  interfaceId: text('interface_id')
    .notNull()
    .references(() => wgInterface.name, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  sourceCidr: text('source_cidr').notNull(),
  destinationCidr: text('destination_cidr').notNull(),
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
