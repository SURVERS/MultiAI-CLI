/**
 * `auth` domain — OAuth and account wire DTO schemas.
 */

import { z } from 'zod';

import { isoDateTimeSchema } from '#/_base/utils/isoDateTime';

export const oauthFlowStatusEnum = z.enum([
  'pending',
  'authenticated',
  'denied',
  'expired',
  'cancelled',
]);
export type OAuthFlowStatus = z.infer<typeof oauthFlowStatusEnum>;

export const oauthPersistenceSchema = z.enum(['keyring', 'session']);
export type OAuthPersistence = z.infer<typeof oauthPersistenceSchema>;

const oauthFlowCommon = {
  flow_id: z.string().min(1),
  provider: z.string().min(1),
  persistence: oauthPersistenceSchema,
  expires_in: z.number().int().positive(),
  expires_at: isoDateTimeSchema,
};

export const oauthBrowserFlowStartSchema = z.object({
  ...oauthFlowCommon,
  method: z.literal('browser'),
  status: z.literal('pending'),
  authorization_uri: z.string().url(),
  redirect_uri: z.string().url(),
});
export type OAuthBrowserFlowStart = z.infer<typeof oauthBrowserFlowStartSchema>;

export const oauthDeviceFlowStartSchema = z.object({
  ...oauthFlowCommon,
  method: z.literal('device'),
  status: z.literal('pending'),
  verification_uri: z.string().url(),
  verification_uri_complete: z.string().url(),
  user_code: z.string().min(1),
  interval: z.number().int().positive(),
});
export type OAuthDeviceFlowStart = z.infer<typeof oauthDeviceFlowStartSchema>;

export const oauthFlowStartAuthenticatedSchema = z.object({
  flow_id: z.string().min(1),
  provider: z.string().min(1),
  method: z.enum(['browser', 'device']),
  persistence: oauthPersistenceSchema,
  status: z.literal('authenticated'),
});
export type OAuthFlowStartAuthenticated = z.infer<
  typeof oauthFlowStartAuthenticatedSchema
>;

export const oauthFlowStartSchema = z.union([
  oauthBrowserFlowStartSchema,
  oauthDeviceFlowStartSchema,
  oauthFlowStartAuthenticatedSchema,
]);
export type OAuthFlowStart = z.infer<typeof oauthFlowStartSchema>;

export const oauthFlowSnapshotSchema = z.object({
  ...oauthFlowCommon,
  method: z.enum(['browser', 'device']),
  status: oauthFlowStatusEnum,
  authorization_uri: z.string().url().optional(),
  redirect_uri: z.string().url().optional(),
  verification_uri: z.string().url().optional(),
  verification_uri_complete: z.string().url().optional(),
  user_code: z.string().min(1).optional(),
  interval: z.number().int().positive().optional(),
  resolved_at: isoDateTimeSchema.optional(),
  error_message: z.string().optional(),
});
export type OAuthFlowSnapshot = z.infer<typeof oauthFlowSnapshotSchema>;

export const oauthLoginCancelResponseSchema = z.object({
  cancelled: z.boolean(),
  status: oauthFlowStatusEnum,
});
export type OAuthLoginCancelResponse = z.infer<typeof oauthLoginCancelResponseSchema>;

export const oauthLogoutResponseSchema = z.object({
  logged_out: z.literal(true),
  provider: z.string().min(1),
});
export type OAuthLogoutResponse = z.infer<typeof oauthLogoutResponseSchema>;

const subscriptionLimitSchema = z.object({
  enabled: z.boolean(),
  remaining_percent: z.number(),
  reset_at: z.string().optional(),
});

export const accountSnapshotSchema = z.object({
  user: z.object({
    sub: z.string().min(1),
    display_name: z.string().optional(),
    avatar_url: z.string().optional(),
    email: z.string().optional(),
    email_verified: z.boolean().optional(),
  }),
  account: z.object({
    wallet: z.object({
      total: z.number(),
      classic: z.number(),
      new: z.number(),
      billing_mode: z.string(),
    }),
    subscription: z.object({
      active: z.boolean(),
      available: z.boolean(),
      limits: z.object({
        five_hour: subscriptionLimitSchema,
        weekly: subscriptionLimitSchema,
        monthly: subscriptionLimitSchema,
      }),
    }),
    generated_at: z.string(),
  }),
  keys: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      key: z.string(),
      status: z.string(),
    }),
  ),
  connection: z.object({
    id: z.string(),
    client_id: z.string(),
    client_name: z.string(),
    device_name: z.string(),
    scopes: z.array(z.string()),
    expires_at: z.string(),
  }),
  generated_at: z.string(),
});
export type AccountSnapshot = z.infer<typeof accountSnapshotSchema>;

const providerRefreshChangeSchema = z.object({
  provider_id: z.string().min(1),
  provider_name: z.string().min(1),
  added: z.number().int().min(0),
  removed: z.number().int().min(0),
});

export const refreshOAuthProviderModelsResponseSchema = z.object({
  changed: z.array(providerRefreshChangeSchema),
  unchanged: z.array(z.string().min(1)),
  failed: z.array(z.object({ provider: z.string().min(1), reason: z.string().min(1) })),
});
export type RefreshOAuthProviderModelsResponse = z.infer<
  typeof refreshOAuthProviderModelsResponseSchema
>;
