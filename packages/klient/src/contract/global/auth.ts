/**
 * `oauthService` + `authSummaryService` app-scope contracts.
 */

import { z } from 'zod';

import { maybe, noResult } from '../helpers.js';
import type { ServiceContract } from '../types.js';

export const oAuthFlowStatusSchema = z.enum([
  'pending',
  'authenticated',
  'denied',
  'expired',
  'cancelled',
]);

const persistenceSchema = z.enum(['keyring', 'session']);
const methodSchema = z.enum(['browser', 'device']);
const flowCommon = {
  flow_id: z.string(),
  provider: z.string(),
  persistence: persistenceSchema,
  expires_in: z.number(),
  expires_at: z.string(),
};

export const oAuthFlowStartSchema = z.union([
  z.object({
    ...flowCommon,
    method: z.literal('browser'),
    status: z.literal('pending'),
    authorization_uri: z.string(),
    redirect_uri: z.string(),
  }),
  z.object({
    ...flowCommon,
    method: z.literal('device'),
    status: z.literal('pending'),
    verification_uri: z.string(),
    verification_uri_complete: z.string(),
    user_code: z.string(),
    interval: z.number(),
  }),
  z.object({
    flow_id: z.string(),
    provider: z.string(),
    method: methodSchema,
    persistence: persistenceSchema,
    status: z.literal('authenticated'),
  }),
]);

export const oAuthFlowSnapshotSchema = z.object({
  ...flowCommon,
  method: methodSchema,
  status: oAuthFlowStatusSchema,
  authorization_uri: z.string().optional(),
  redirect_uri: z.string().optional(),
  verification_uri: z.string().optional(),
  verification_uri_complete: z.string().optional(),
  user_code: z.string().optional(),
  interval: z.number().optional(),
  resolved_at: z.string().optional(),
  error_message: z.string().optional(),
});

export const oAuthLoginCancelResponseSchema = z.object({
  cancelled: z.boolean(),
  status: oAuthFlowStatusSchema,
});

export const oAuthLogoutResponseSchema = z.object({
  logged_out: z.literal(true),
  provider: z.string(),
});

const identitySchema = z.object({
  issuer: z.string(),
  subject: z.string(),
  name: z.string().optional(),
  preferredUsername: z.string().optional(),
  picture: z.string().optional(),
  email: z.string().optional(),
  emailVerified: z.boolean().optional(),
});

export const authStatusSchema = z.object({
  loggedIn: z.boolean(),
  provider: z.string().optional(),
  identity: identitySchema.optional(),
  persistence: persistenceSchema.optional(),
});

const subscriptionLimitSchema = z.object({
  enabled: z.boolean(),
  remaining_percent: z.number(),
  reset_at: z.string().optional(),
});

export const accountSnapshotSchema = z.object({
  user: z.object({
    sub: z.string(),
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
      id: z.number(),
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

export const refreshOAuthProviderModelsResponseSchema = z.object({
  changed: z.array(
    z.object({
      provider_id: z.string(),
      provider_name: z.string(),
      added: z.number(),
      removed: z.number(),
    }),
  ),
  unchanged: z.array(z.string()),
  failed: z.array(z.object({ provider: z.string(), reason: z.string() })),
});

const startLoginRequestSchema = z.object({
  provider: z.string().optional(),
  method: methodSchema,
  persistence: persistenceSchema,
});

export const authContract = {
  startLogin: { input: z.tuple([startLoginRequestSchema]), output: oAuthFlowStartSchema },
  getFlow: {
    input: z.tuple([z.string().optional()]),
    output: maybe(oAuthFlowSnapshotSchema),
  },
  cancelLogin: {
    input: z.tuple([z.string().optional()]),
    output: oAuthLoginCancelResponseSchema,
  },
  logout: { input: z.tuple([z.string().optional()]), output: oAuthLogoutResponseSchema },
  status: { input: z.tuple([z.string().optional()]), output: authStatusSchema },
  getAccount: { input: z.tuple([z.string().optional()]), output: accountSnapshotSchema },
  refreshOAuthProviderModels: {
    input: z.tuple([]),
    output: refreshOAuthProviderModelsResponseSchema,
  },
} satisfies ServiceContract;

export const authSummaryContract = {
  summarize: { input: z.tuple([]), output: z.array(authStatusSchema) },
  ensureReady: { input: z.tuple([z.string().optional()]), output: noResult },
} satisfies ServiceContract;
