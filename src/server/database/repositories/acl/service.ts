import { eq, and, or } from 'drizzle-orm';
import { aclConfig, aclGroup, aclGroupMember, aclRule } from './schema';
import type {
  AclRuleCreateType,
  AclRuleUpdateType,
  AclConfigUpdateType,
  AclGroupCreateType,
  AclGroupUpdateType,
} from './types';
import type { DBType } from '#db/sqlite';

export class AclService {
  #db: DBType;

  constructor(db: DBType) {
    this.#db = db;
  }

  /**
   * Get all ACL rules for an interface
   */
  async getRules(interfaceId: string) {
    return this.#db.query.aclRule.findMany({
      where: eq(aclRule.interfaceId, interfaceId),
      orderBy: (rules, { asc }) => [asc(rules.id)],
    });
  }

  /**
   * Get a single ACL rule by ID
   */
  async getRule(id: number) {
    const rule = await this.#db.query.aclRule.findFirst({
      where: eq(aclRule.id, id),
    });
    if (!rule) {
      throw new Error(`ACL rule ${id} not found`);
    }
    return rule;
  }

  /**
   * Create a new ACL rule
   */
  async createRule(data: AclRuleCreateType) {
    const result = await this.#db.insert(aclRule).values(data).returning();
    return result[0];
  }

  /**
   * Update an ACL rule
   */
  async updateRule(id: number, data: Omit<AclRuleUpdateType, 'id'>) {
    const result = await this.#db
      .update(aclRule)
      .set(data)
      .where(eq(aclRule.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error(`ACL rule ${id} not found`);
    }
    return result[0];
  }

  /**
   * Delete an ACL rule
   */
  async deleteRule(id: number) {
    const result = await this.#db
      .delete(aclRule)
      .where(eq(aclRule.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error(`ACL rule ${id} not found`);
    }
    return result[0];
  }

  /**
   * Get ACL configuration for an interface
   * Creates default config if it doesn't exist
   */
  async getConfig(interfaceId: string) {
    let config = await this.#db.query.aclConfig.findFirst({
      where: eq(aclConfig.id, interfaceId),
    });

    // Create default config if it doesn't exist
    if (!config) {
      const result = await this.#db
        .insert(aclConfig)
        .values({
          id: interfaceId,
          enabled: false,
          allowPublicEgress: false,
          exitNodeClientId: null,
          filterTableName: 'wg_acl_v4',
          defaultPolicy: 'drop',
        })
        .returning();
      const createdConfig = result[0];
      if (!createdConfig) {
        throw new Error(`Failed to create ACL config for ${interfaceId}`);
      }
      config = createdConfig;
    }

    return config;
  }

  /**
   * Update ACL configuration
   */
  async updateConfig(
    interfaceId: string,
    data: Omit<AclConfigUpdateType, 'id'>
  ) {
    const result = await this.#db
      .update(aclConfig)
      .set(data)
      .where(eq(aclConfig.id, interfaceId))
      .returning();

    if (result.length === 0) {
      throw new Error(`ACL config for ${interfaceId} not found`);
    }
    return result[0];
  }

  /**
   * Get enabled rules for an interface (used for script generation)
   */
  async getEnabledRules(interfaceId: string) {
    return this.#db.query.aclRule.findMany({
      where: and(
        eq(aclRule.interfaceId, interfaceId),
        eq(aclRule.enabled, true)
      ),
      orderBy: (rules, { asc }) => [asc(rules.id)],
    });
  }

  /**
   * Get all groups for an interface, each with its members
   */
  async getGroups(interfaceId: string) {
    return this.#db.query.aclGroup.findMany({
      where: eq(aclGroup.interfaceId, interfaceId),
      with: { members: true },
      orderBy: (groups, { asc }) => [asc(groups.name)],
    });
  }

  /**
   * Get a single group with its members
   */
  async getGroup(id: number) {
    const group = await this.#db.query.aclGroup.findFirst({
      where: eq(aclGroup.id, id),
      with: { members: true },
    });
    if (!group) {
      throw new Error(`ACL group ${id} not found`);
    }
    return group;
  }

  /**
   * Create a group together with its members
   */
  async createGroup(data: AclGroupCreateType) {
    return this.#db.transaction(async (tx) => {
      const result = await tx
        .insert(aclGroup)
        .values({
          interfaceId: data.interfaceId,
          name: data.name,
          description: data.description ?? null,
        })
        .returning();
      const group = result[0];
      if (!group) {
        throw new Error('Failed to create ACL group');
      }

      if (data.members.length > 0) {
        await tx.insert(aclGroupMember).values(
          data.members.map((m) => ({
            groupId: group.id,
            clientId: m.clientId ?? null,
            cidr: m.cidr ?? null,
          }))
        );
      }

      return group;
    });
  }

  /**
   * Update a group and replace its member set
   */
  async updateGroup(id: number, data: AclGroupUpdateType) {
    return this.#db.transaction(async (tx) => {
      const result = await tx
        .update(aclGroup)
        .set({ name: data.name, description: data.description ?? null })
        .where(eq(aclGroup.id, id))
        .returning();
      if (result.length === 0) {
        throw new Error(`ACL group ${id} not found`);
      }

      await tx.delete(aclGroupMember).where(eq(aclGroupMember.groupId, id));

      if (data.members.length > 0) {
        await tx.insert(aclGroupMember).values(
          data.members.map((m) => ({
            groupId: id,
            clientId: m.clientId ?? null,
            cidr: m.cidr ?? null,
          }))
        );
      }

      return result[0];
    });
  }

  /**
   * Delete a group. Refuses if any rule still references it.
   */
  async deleteGroup(id: number) {
    const referencing = await this.#db.query.aclRule.findFirst({
      where: or(
        eq(aclRule.sourceGroupId, id),
        eq(aclRule.destinationGroupId, id)
      ),
    });
    if (referencing) {
      throw new Error(
        'Cannot delete a group that is still used by an ACL rule. Remove or edit those rules first.'
      );
    }

    const result = await this.#db
      .delete(aclGroup)
      .where(eq(aclGroup.id, id))
      .returning();
    if (result.length === 0) {
      throw new Error(`ACL group ${id} not found`);
    }
    return result[0];
  }

  /**
   * Resolve each group's members to a list of CIDRs for script generation.
   * Client members resolve to their IPv4 /32; manual CIDR members pass through.
   * Returns a map of groupId -> { name, cidrs } (name is used in nft comments).
   */
  async resolveGroupMembers(interfaceId: string) {
    const groups = await this.getGroups(interfaceId);

    const clientIds = new Set<number>();
    for (const group of groups) {
      for (const member of group.members) {
        if (member.clientId !== null) {
          clientIds.add(member.clientId);
        }
      }
    }

    const clientIpById = new Map<number, string>();
    if (clientIds.size > 0) {
      const clients = await this.#db.query.client.findMany({
        columns: { id: true, ipv4Address: true },
      });
      for (const c of clients) {
        clientIpById.set(c.id, c.ipv4Address);
      }
    }

    const resolved = new Map<number, { name: string; cidrs: string[] }>();
    for (const group of groups) {
      const cidrs: string[] = [];
      for (const member of group.members) {
        if (member.clientId !== null) {
          const ip = clientIpById.get(member.clientId);
          if (ip) {
            cidrs.push(`${ip}/32`);
          }
        } else if (member.cidr) {
          cidrs.push(member.cidr);
        }
      }
      resolved.set(group.id, { name: group.name, cidrs });
    }

    return resolved;
  }
}
