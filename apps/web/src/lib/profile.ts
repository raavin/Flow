import type { AccountMode, BusinessProfileRecord, ProfileRecord } from '@superapp/types'
import { supabase } from './supabase'
import { ensureSocialProfile, updateSocialProfile } from './social'

export async function fetchProfile(userId: string) {
  if (!supabase) return null

  const [{ data: profile, error: profileError }, { data: businessProfile, error: businessError }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle<ProfileRecord>(),
      supabase.from('business_profiles').select('*').eq('id', userId).maybeSingle<BusinessProfileRecord>(),
    ])

  if (profileError) throw profileError
  if (businessError) throw businessError

  return {
    profile,
    businessProfile,
  }
}

export async function upsertOnboarding(payload: {
  userId: string
  accountMode: AccountMode
  activeMode: 'individual' | 'business'
  firstName: string
  lastName?: string
  location: string
  timeZone: string
  useCases: string[]
  integrations: string[]
  handle?: string
  businessName?: string
  category?: string
  serviceArea?: string
  offerings?: string[]
  bookingModel?: string
  availabilityNotes?: string
  visibilityMode?: string
}) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: payload.userId,
    account_mode: payload.accountMode,
    active_mode: payload.activeMode,
    first_name: payload.firstName,
    last_name: payload.lastName ?? null,
    location: payload.location,
    time_zone: payload.timeZone,
    use_cases: payload.useCases,
    integrations: payload.integrations,
  })

  if (profileError) throw profileError

  const displayName = [payload.firstName, payload.lastName].filter(Boolean).join(' ').trim() || payload.firstName
  await ensureSocialProfile(payload.userId, displayName, payload.handle)
  await updateSocialProfile({
    userId: payload.userId,
    displayName,
    handle: payload.handle,
  })

  if (payload.accountMode === 'business' || payload.accountMode === 'both') {
    const { error: businessError } = await supabase.from('business_profiles').upsert({
      id: payload.userId,
      business_name: payload.businessName ?? '',
      category: payload.category ?? '',
      service_area: payload.serviceArea ?? '',
      offerings: payload.offerings ?? [],
      booking_model: payload.bookingModel ?? 'request-based',
      availability_notes: payload.availabilityNotes ?? '',
      visibility_mode: payload.visibilityMode ?? 'progress milestones',
    })

    if (businessError) throw businessError
  }
}

export async function updateActiveMode(userId: string, activeMode: 'individual' | 'business') {
  if (!supabase) return
  const { error } = await supabase.from('profiles').update({ active_mode: activeMode }).eq('id', userId)
  if (error) throw error
}

export async function updateProfileSettings(input: {
  userId: string
  firstName: string
  lastName?: string
  location: string
  timeZone: string
  integrations: string[]
  bio?: string
  handle?: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: input.firstName,
      last_name: input.lastName ?? null,
      location: input.location,
      time_zone: input.timeZone,
      integrations: input.integrations,
    })
    .eq('id', input.userId)
  if (error) throw error

  const displayName = [input.firstName, input.lastName].filter(Boolean).join(' ').trim() || input.firstName
  await ensureSocialProfile(input.userId, displayName, input.handle)
  await updateSocialProfile({
    userId: input.userId,
    displayName,
    bio: input.bio,
    handle: input.handle,
  })
}
