'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/auth-store';
import { LoginScreen } from '@/components/LoginScreen';
import SetupWizard from '@/components/SetupWizard';
import ModelSelector from '@/components/ModelSelector';
import ChatView from '@/components/ChatView';

export default function Home() {
  const appState = useAppStore((s) => s.appState);
  const syncFromSupabase = useAppStore((s) => s.syncFromSupabase);
  const { isAuthenticated, isLoading, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // ✅ عند تسجيل الدخول، حمّل البيانات من Supabase
  useEffect(() => {
    if (isAuthenticated) {
      syncFromSupabase();
    }
  }, [isAuthenticated, syncFromSupabase]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-pink-950 to-indigo-950">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-white/10" />
          <div className="h-4 w-32 bg-white/10 rounded" />
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <main className="min-h-screen">
      {appState === 'enterKey' && <SetupWizard />}
      {appState === 'selectModel' && <ModelSelector />}
      {appState === 'chat' && <ChatView />}
    </main>
  );
}
