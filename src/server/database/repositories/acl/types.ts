import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import isCidr from 'is-cidr';

import type { aclConfig, aclGroup, aclGroupMember, aclRule } from './schema';

// Base types from drizzle
export type AclRuleType = InferSelectModel<typeof aclRule>;
export type AclConfigType = InferSelectModel<typeof aclConfig>;
export type AclGroupType = InferSelectModel<typeof aclGroup>;
export type AclGroupMemberType = InferSelectModel<typeof aclGroupMember>;

/** A group together with its members (as returned by the service/API) */
export type AclGroupWithMembersType = AclGroupType & {
  members: AclGroupMemberType[];
};

// Validation schemas
const cidrValidator = z.string().refine((val) => isCidr(val) !== 0, {
  message: 'Must be a valid CIDR notation (e.g., 10.0.0.1/32 or 10.0.0.0/24)',
});

const protocolValidator = z.enum(['tcp', 'udp', 'icmp']);

const portsValidator = z.string().refine(
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

/**
 * A rule side (source/destination) is either a single CIDR or a group, never
 * both and never neither.
 */
function requireExactlyOneSide(
  data: {
    sourceCidr?: string | null;
    sourceGroupId?: number | null;
    destinationCidr?: string | null;
    destinationGroupId?: number | null;
  },
  ctx: z.RefinementCtx
) {
  const hasSourceCidr =
    data.sourceCidr !== undefined && data.sourceCidr !== null;
  const hasSourceGroup =
    data.sourceGroupId !== undefined && data.sourceGroupId !== null;
  if (hasSourceCidr === hasSourceGroup) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide exactly one of sourceCidr or sourceGroupId',
      path: ['sourceCidr'],
    });
  }

  const hasDestCidr =
    data.destinationCidr !== undefined && data.destinationCidr !== null;
  const hasDestGroup =
    data.destinationGroupId !== undefined && data.destinationGroupId !== null;
  if (hasDestCidr === hasDestGroup) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide exactly one of destinationCidr or destinationGroupId',
      path: ['destinationCidr'],
    });
  }
}

/**
 * For partial updates: a side may be omitted entirely (left unchanged), but a
 * CIDR and a group must never be set on the same side at once.
 */
function forbidBothOnSameSide(
  data: {
    sourceCidr?: string | null;
    sourceGroupId?: number | null;
    destinationCidr?: string | null;
    destinationGroupId?: number | null;
  },
  ctx: z.RefinementCtx
) {
  if (
    data.sourceCidr !== undefined &&
    data.sourceCidr !== null &&
    data.sourceGroupId !== undefined &&
    data.sourceGroupId !== null
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide only one of sourceCidr or sourceGroupId',
      path: ['sourceCidr'],
    });
  }
  if (
    data.destinationCidr !== undefined &&
    data.destinationCidr !== null &&
    data.destinationGroupId !== undefined &&
    data.destinationGroupId !== null
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide only one of destinationCidr or destinationGroupId',
      path: ['destinationCidr'],
    });
  }
}

// Create schema
export const AclRuleCreateSchema = z
  .object({
    interfaceId: z.string().min(1),
    sourceCidr: cidrValidator.nullish(),
    sourceGroupId: z.number().int().nullish(),
    destinationCidr: cidrValidator.nullish(),
    destinationGroupId: z.number().int().nullish(),
    protocol: protocolValidator,
    ports: portsValidator,
    enabled: z.boolean().default(true),
    description: z.string().optional(),
  })
  .superRefine(requireExactlyOneSide);

// Update schema (all fields optional except id)
export const AclRuleUpdateSchema = z
  .object({
    interfaceId: z.string().min(1).optional(),
    sourceCidr: cidrValidator.nullish(),
    sourceGroupId: z.number().int().nullish(),
    destinationCidr: cidrValidator.nullish(),
    destinationGroupId: z.number().int().nullish(),
    protocol: protocolValidator.optional(),
    ports: portsValidator.optional(),
    enabled: z.boolean().optional(),
    description: z.string().optional(),
  })
  .superRefine(forbidBothOnSameSide);

// Group member: exactly one of clientId / cidr
const AclGroupMemberSchema = z
  .object({
    clientId: z.number().int().nullish(),
    cidr: cidrValidator.nullish(),
  })
  .refine(
    (m) =>
      (m.clientId !== undefined && m.clientId !== null) !==
      (m.cidr !== undefined && m.cidr !== null),
    { message: 'Provide exactly one of clientId or cidr' }
  );

export const AclGroupCreateSchema = z.object({
  interfaceId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  members: z.array(AclGroupMemberSchema).default([]),
});

export const AclGroupUpdateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  members: z.array(AclGroupMemberSchema).default([]),
});

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
export type AclGroupMemberInput = z.infer<typeof AclGroupMemberSchema>;
export type AclGroupCreateType = z.infer<typeof AclGroupCreateSchema>;
export type AclGroupUpdateType = z.infer<typeof AclGroupUpdateSchema>;
