'use client'

import { create } from 'zustand'
import { getSupabase } from '@/lib/supabase'

interface AuthState {
  userId: string | null
  email: string | null
  isAuthenticated: boolean
  isLoading: boolean
  initAuth: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
}

let _unsub: (() => void) | null = null

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  email: null,
  isAuthenticated: false,
  isLoading: true,

  initAuth: async () => {
    try {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        set({
          userId: session.user.id,
          email: session.user.email || null,
          isAuthenticated: true,
          isLoading: false
        })
      } else {
        set({ userId: null, email: null, isAuthenticated: false, isLoading: false })
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
        if (sess?.user) {
          set({
            userId: sess.user.id,
            email: sess.user.email || null,
            isAuthenticated: true,
            isLoading: false
          })
        } else {
          set({ userId: null, email: null, isAuthenticated: false, isLoading: false })
        }
      })
      _unsub = subscription.unsubscribe
    } catch (e) {
      console.error('Auth init error:', e)
      set({ isLoading: false })
    }
  },

  signIn: async (email, password) => {
    try {
      const supabase = getSupabase()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (e) {
      console.error('Sign in error:', e)
      return { success: false, error: 'حدث خطأ غير متوقع' }
    }
  },

  signUp: async (email, password) => {
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) return { success: false, error: error.message }
      // إذا تطلب تأكيد البريد، لن يكون هناك session
      if (!data.session) {
        return { success: false, error: 'تحقق من بريدك لتأكيد الحساب' }
      }
      return { success: true }
    } catch (e) {
      console.error('Sign up error:', e)
      return { success: false, error: 'حدث خطأ غير متوقع' }
    }
  },

  signOut: async () => {
    try {
      const supabase = getSupabase()
      await supabase.auth.signOut()
    } catch (e) {
      console.error('Sign out error:', e)
    } finally {
      set({ userId: null, email: null, isAuthenticated: false })
    }
  }
}))
