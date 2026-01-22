import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import isCidr from 'is-cidr';

import type { aclConfig, aclRule } from './schema';

// Base types from drizzle
export type AclRuleType = InferSelectModel<typeof aclRule>;
export type AclConfigType = InferSelectModel<typeof aclConfig>;

// Validation schemas
const cidrValidator = z.string().refine((val) => isCidr(val) !== 0, {
  message: 'Must be a valid CIDR notation (e.g., 10.0.0.1/32 or 10.0.0.0/24)',
});

const protocolValidator = z.enum(['tcp', 'udp', 'icmp']);

const portsValidator = z
  .string()
  .refine(
    (val) => {
      // Empty string is valid for ICMP
      if (val === '') return true;
      // Check for valid port formats: "80", "80,443", "1-65535", "22,80-90"
      const parts = val.split(',');
      return parts.every((part) => {
        const trimmed = part.trim();
        if (/^\d+$/.test(trimmed)) {
          const port = parseInt(trimmed, 10);
          return port >= 1 && port <= 65535;
        }
        if (/^\d+-\d+$/.test(trimmed)) {
          const parts = trimmed.split('-').map((p) => parseInt(p, 10));
          const start = parts[0];
          const end = parts[1];
          if (start === undefined || end === undefined) return false;
          return start >= 1 && end <= 65535 && start < end;
        }
        return false;
      });
    },
    {
      message:
        'Must be valid port(s): "80", "80,443", "1-65535", or empty for ICMP',
    }
  );

// Create schema
export const AclRuleCreateSchema = z.object({
  interfaceId: z.string().min(1),
  sourceCidr: cidrValidator,
  destinationCidr: cidrValidator,
  protocol: protocolValidator,
  ports: portsValidator,
  enabled: z.boolean().default(true),
  description: z.string().optional(),
});

// Update schema (all fields optional except id)
export const AclRuleUpdateSchema = AclRuleCreateSchema.partial();

// Config update schema
export const AclConfigUpdateSchema = z.object({
  id: z.string().optional(),
  enabled: z.boolean(),
  allowPublicEgress: z.boolean(),
  exitNodeClientId: z.number().nullable(),
  defaultPolicy: z.enum(['drop', 'accept']),
  filterTableName: z.string().min(1),
});

// Types
export type AclRuleCreateType = z.infer<typeof AclRuleCreateSchema>;
export type AclRuleUpdateType = z.infer<typeof AclRuleUpdateSchema>;
export type AclConfigUpdateType = z.infer<typeof AclConfigUpdateSchema>;
