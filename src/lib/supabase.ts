'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_client) return _client
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'alisha-auth-session'
    }
  })
  return _client
}

// ============ أنواع البيانات ============
export interface DbUserSettings {
  user_id: string
  response_language: 'ar' | 'en' | 'ja'
  selected_background: string
  auto_change_bg: boolean
  bg_interval_minutes: number
  stt_provider: 'assemblyai' | 'webspeech'
  active_provider: string
  selected_model: string
  updated_at: string
}

export interface DbMemoryItem {
  id: number
  user_id: string
  content: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DbUserKey {
  id: number
  user_id: string
  provider: string
  encrypted_key: string
  iv: string
  created_at: string
}

export interface DbMessage {
  id: number
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// ============ دوال الإعدادات ============
export async function fetchUserSettings(): Promise<DbUserSettings | null> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('alisha_user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error

  // ✅ إذا لم توجد إعدادات (trigger لم يعمل)، أنشئها الآن
  if (!data) {
    const { data: newSettings, error: insertError } = await supabase
      .from('alisha_user_settings')
      .insert({ user_id: user.id })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to init user settings:', insertError)
      return null
    }
    return newSettings
  }

  return data
}

export async function upsertUserSettings(
  settings: Partial<DbUserSettings>
): Promise<void> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('alisha_user_settings')
    .upsert({
      user_id: user.id,
      ...settings,
      updated_at: new Date().toISOString()
    })

  if (error) throw error
}

// ============ دوال الذاكرة ============
export async function fetchMemory(): Promise<DbMemoryItem[]> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('alisha_memory')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data || []
}

export async function addMemoryItem(content: string, sortOrder: number): Promise<DbMemoryItem | null> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('alisha_memory')
    .insert({
      user_id: user.id,
      content,
      sort_order: sortOrder
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateMemoryItem(id: number, content: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('alisha_memory')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteMemoryItem(id: number): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('alisha_memory')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function replaceAllMemory(items: { content: string; sort_order: number }[]): Promise<void> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // حذف كل الذاكرة القديمة ثم إدراج الجديدة في transaction
  await supabase.from('alisha_memory').delete().eq('user_id', user.id)
  if (items.length > 0) {
    const { error } = await supabase
      .from('alisha_memory')
      .insert(items.map(i => ({ user_id: user.id, ...i })))
    if (error) throw error
  }
}

// ============ دوال الرسائل ============
export async function fetchMessages(): Promise<DbMessage[]> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('alisha_messages')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) throw error
  return data || []
}

export async function addMessage(role: 'user' | 'assistant', content: string): Promise<void> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('alisha_messages')
    .insert({ user_id: user.id, role, content })
  if (error) throw error
}

export async function clearMessages(): Promise<void> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('alisha_messages')
    .delete()
    .eq('user_id', user.id)
  if (error) throw error
}
