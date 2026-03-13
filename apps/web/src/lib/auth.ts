import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function signOutSession() {
  if (!supabase) {
    return
  }

  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}
