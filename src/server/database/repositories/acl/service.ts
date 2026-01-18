import { eq, and } from 'drizzle-orm';
import { aclConfig, aclRule } from './schema';
import type {
  AclRuleCreateType,
  AclRuleUpdateType,
  AclConfigUpdateType,
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
          filterTableName: 'wg_acl_v4',
          defaultPolicy: 'drop',
        })
        .returning();
      config = result[0];
    }
    
    return config;
  }

  /**
   * Update ACL configuration
   */
  async updateConfig(interfaceId: string, data: Omit<AclConfigUpdateType, 'id'>) {
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
}
