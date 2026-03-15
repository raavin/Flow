import type { ConnectedIntegration, IntegrationApiKey, WebhookDelivery, WebhookEndpoint } from '@superapp/types'
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

type IntegrationRow = {
  id: string
  profile_id: string
  provider: string
  status: string
  oauth_token_expires_at: string | null
  oauth_scope: string | null
  provider_account_id: string | null
  provider_account_label: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

type ApiKeyRow = {
  id: string
  profile_id: string
  name: string
  key_prefix: string
  scopes: string[]
  last_used_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

type EndpointRow = {
  id: string
  profile_id: string
  url: string
  description: string
  event_types: string[]
  is_active: boolean
  failure_count: number
  last_success_at: string | null
  last_failure_at: string | null
  created_at: string
  updated_at: string
}

type DeliveryRow = {
  id: string
  endpoint_id: string
  event_type: string
  event_id: string
  payload: Record<string, unknown>
  attempt_count: number
  next_retry_at: string | null
  status: string
  last_response_status: number | null
  last_response_body: string | null
  created_at: string
  delivered_at: string | null
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapIntegration(row: IntegrationRow): ConnectedIntegration {
  return {
    id:                   row.id,
    profileId:            row.profile_id,
    provider:             row.provider as ConnectedIntegration['provider'],
    status:               row.status as ConnectedIntegration['status'],
    oauthTokenExpiresAt:  row.oauth_token_expires_at,
    oauthScope:           row.oauth_scope,
    providerAccountId:    row.provider_account_id,
    providerAccountLabel: row.provider_account_label,
    metadata:             row.metadata ?? {},
    createdAt:            row.created_at,
    updatedAt:            row.updated_at,
  }
}

function mapApiKey(row: ApiKeyRow): IntegrationApiKey {
  return {
    id:         row.id,
    profileId:  row.profile_id,
    name:       row.name,
    keyPrefix:  row.key_prefix,
    scopes:     row.scopes ?? [],
    lastUsedAt: row.last_used_at,
    expiresAt:  row.expires_at,
    isActive:   row.is_active,
    createdAt:  row.created_at,
  }
}

function mapEndpoint(row: EndpointRow): WebhookEndpoint {
  return {
    id:            row.id,
    profileId:     row.profile_id,
    url:           row.url,
    description:   row.description,
    eventTypes:    row.event_types ?? [],
    isActive:      row.is_active,
    failureCount:  row.failure_count,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  }
}

function mapDelivery(row: DeliveryRow): WebhookDelivery {
  return {
    id:                 row.id,
    endpointId:         row.endpoint_id,
    eventType:          row.event_type,
    eventId:            row.event_id,
    payload:            row.payload,
    attemptCount:       row.attempt_count,
    nextRetryAt:        row.next_retry_at,
    status:             row.status as WebhookDelivery['status'],
    lastResponseStatus: row.last_response_status,
    lastResponseBody:   row.last_response_body,
    createdAt:          row.created_at,
    deliveredAt:        row.delivered_at,
  }
}

// ---------------------------------------------------------------------------
// Connected integrations
// ---------------------------------------------------------------------------

export async function fetchConnectedIntegrations(): Promise<ConnectedIntegration[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('connected_integrations')
    .select('id, profile_id, provider, status, oauth_token_expires_at, oauth_scope, provider_account_id, provider_account_label, metadata, created_at, updated_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data as IntegrationRow[]) ?? []).map(mapIntegration)
}

export async function disconnectIntegration(provider: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase
    .from('connected_integrations')
    .update({ status: 'disconnected', updated_at: new Date().toISOString() })
    .eq('provider', provider)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export async function fetchApiKeys(): Promise<IntegrationApiKey[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('integration_api_keys')
    .select('id, profile_id, name, key_prefix, scopes, last_used_at, expires_at, is_active, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data as ApiKeyRow[]) ?? []).map(mapApiKey)
}

export async function createApiKey(
  name: string,
  scopes: string[],
  expiresAt?: string,
): Promise<{ apiKey: string; keyId: string }> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('create_integration_api_key', {
    p_name:       name,
    p_scopes:     scopes,
    p_expires_at: expiresAt ?? null,
  })
  if (error) throw error
  // data is the raw key string
  const rawKey = data as string
  // We need to fetch the key_id — look up by checking the prefix
  const prefix = rawKey.slice(0, 15)
  const { data: row } = await supabase
    .from('integration_api_keys')
    .select('id')
    .eq('key_prefix', prefix)
    .eq('name', name)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return { apiKey: rawKey, keyId: (row as { id: string } | null)?.id ?? '' }
}

export async function revokeApiKey(keyId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase
    .from('integration_api_keys')
    .update({ is_active: false })
    .eq('id', keyId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Webhook endpoints
// ---------------------------------------------------------------------------

export async function fetchWebhookEndpoints(): Promise<WebhookEndpoint[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('id, profile_id, url, description, event_types, is_active, failure_count, last_success_at, last_failure_at, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data as EndpointRow[]) ?? []).map(mapEndpoint)
}

export async function createWebhookEndpoint(
  url: string,
  description: string,
  eventTypes: string[],
): Promise<WebhookEndpoint> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .insert({ url, description, event_types: eventTypes })
    .select('id, profile_id, url, description, event_types, is_active, failure_count, last_success_at, last_failure_at, created_at, updated_at')
    .single()
  if (error) throw error
  return mapEndpoint(data as EndpointRow)
}

export async function updateWebhookEndpoint(
  id: string,
  patch: Partial<{ url: string; description: string; eventTypes: string[]; isActive: boolean }>,
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const dbPatch: Record<string, unknown> = {}
  if (patch.url !== undefined) dbPatch.url = patch.url
  if (patch.description !== undefined) dbPatch.description = patch.description
  if (patch.eventTypes !== undefined) dbPatch.event_types = patch.eventTypes
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive
  dbPatch.updated_at = new Date().toISOString()

  const { error } = await supabase.from('webhook_endpoints').update(dbPatch).eq('id', id)
  if (error) throw error
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id)
  if (error) throw error
}

export async function fetchWebhookDeliveries(endpointId: string): Promise<WebhookDelivery[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('id, endpoint_id, event_type, event_id, payload, attempt_count, next_retry_at, status, last_response_status, last_response_body, created_at, delivered_at')
    .eq('endpoint_id', endpointId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return ((data as DeliveryRow[]) ?? []).map(mapDelivery)
}
